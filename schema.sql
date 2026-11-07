-- =====================================================================
--  NITA REIS · Sistema de Gestão — Estética & Massoterapia
--  Banco de dados Supabase (PostgreSQL)
--
--  Como usar: Supabase → SQL Editor → New query → cole TUDO → Run.
--  Pode rodar de novo sem problema (é idempotente).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Esquema privado para funções de segurança (não exposto pela API)
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- PERFIS (usuários do sistema)
--   O 1º usuário que se cadastrar vira ADMIN automaticamente.
--   Os próximos ficam "pendente" até o admin aprovar em Mais → Equipe.
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  email       text,
  papel       text not null default 'pendente' check (papel in ('admin','equipe','pendente')),
  created_at  timestamptz not null default now()
);

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis
                 where id = (select auth.uid()) and papel in ('admin','equipe'));
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis
                 where id = (select auth.uid()) and papel = 'admin');
$$;

grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.perfis where papel = 'admin')
         then 'pendente' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- CONFIGURAÇÕES DA CLÍNICA (linha única)
-- ---------------------------------------------------------------------
create table if not exists public.configuracoes (
  id             int primary key default 1 check (id = 1),
  nome_clinica   text not null default 'Nita Reis',
  telefone       text,
  endereco       text,
  instagram      text,
  chave_pix      text,
  mensagens      jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);
insert into public.configuracoes (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- PROFISSIONAIS
-- ---------------------------------------------------------------------
create table if not exists public.profissionais (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  telefone      text,
  cor           text default '#e05a8d',
  comissao_pct  numeric(5,2) not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SERVIÇOS
-- ---------------------------------------------------------------------
create table if not exists public.servicos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  categoria     text not null default 'Massoterapia',
  duracao_min   int  not null default 60,
  preco         numeric(10,2) not null default 0,
  cor           text default '#e05a8d',
  descricao     text,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CLIENTES
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  telefone         text,
  email            text,
  cpf              text,
  data_nascimento  date,
  sexo             text,
  endereco         text,
  profissao        text,
  como_conheceu    text,
  observacoes      text,
  ativo            boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists clientes_nome_idx on public.clientes (lower(nome));

-- ---------------------------------------------------------------------
-- FICHAS DE ANAMNESE
-- ---------------------------------------------------------------------
create table if not exists public.anamneses (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  data         date not null default current_date,
  dados        jsonb not null default '{}'::jsonb,
  assinatura   text,           -- imagem da assinatura (data URL)
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists anamneses_cliente_idx on public.anamneses (cliente_id);
create index if not exists anamneses_created_by_idx on public.anamneses (created_by);

-- ---------------------------------------------------------------------
-- PACOTES DE SESSÕES
-- ---------------------------------------------------------------------
create table if not exists public.pacotes (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  servico_id      uuid references public.servicos(id) on delete set null,
  nome            text not null,
  total_sessoes   int not null default 10,
  valor           numeric(10,2) not null default 0,
  validade        date,
  status          text not null default 'ativo' check (status in ('ativo','finalizado','cancelado')),
  observacoes     text,
  created_at      timestamptz not null default now()
);
create index if not exists pacotes_cliente_idx on public.pacotes (cliente_id);
create index if not exists pacotes_servico_idx on public.pacotes (servico_id);

-- ---------------------------------------------------------------------
-- AGENDAMENTOS
-- ---------------------------------------------------------------------
create table if not exists public.agendamentos (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null references public.clientes(id) on delete cascade,
  servico_id           uuid references public.servicos(id) on delete set null,
  profissional_id      uuid references public.profissionais(id) on delete set null,
  pacote_id            uuid references public.pacotes(id) on delete set null,
  inicio               timestamptz not null,
  fim                  timestamptz not null,
  valor                numeric(10,2) not null default 0,
  desconto             numeric(10,2) not null default 0,
  status               text not null default 'agendado'
                       check (status in ('agendado','confirmado','concluido','cancelado','faltou')),
  observacoes          text,
  confirmacao_enviada  boolean not null default false,
  lembrete_enviado     boolean not null default false,
  created_at           timestamptz not null default now()
);
create index if not exists agendamentos_inicio_idx       on public.agendamentos (inicio);
create index if not exists agendamentos_cliente_idx      on public.agendamentos (cliente_id);
create index if not exists agendamentos_servico_idx      on public.agendamentos (servico_id);
create index if not exists agendamentos_profissional_idx on public.agendamentos (profissional_id);
create index if not exists agendamentos_pacote_idx       on public.agendamentos (pacote_id);

-- ---------------------------------------------------------------------
-- EVOLUÇÃO / PRONTUÁRIO (anotações de cada sessão)
-- ---------------------------------------------------------------------
create table if not exists public.evolucoes (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes(id) on delete cascade,
  agendamento_id   uuid references public.agendamentos(id) on delete set null,
  data             date not null default current_date,
  texto            text not null,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);
create index if not exists evolucoes_cliente_idx     on public.evolucoes (cliente_id);
create index if not exists evolucoes_agendamento_idx on public.evolucoes (agendamento_id);
create index if not exists evolucoes_created_by_idx  on public.evolucoes (created_by);

-- ---------------------------------------------------------------------
-- FINANCEIRO
-- ---------------------------------------------------------------------
create table if not exists public.categorias_financeiras (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tipo        text not null check (tipo in ('receita','despesa')),
  cor         text default '#e05a8d',
  created_at  timestamptz not null default now(),
  unique (nome, tipo)
);

create table if not exists public.lancamentos (
  id                uuid primary key default gen_random_uuid(),
  tipo              text not null check (tipo in ('receita','despesa')),
  descricao         text not null,
  valor             numeric(10,2) not null check (valor >= 0),
  categoria_id      uuid references public.categorias_financeiras(id) on delete set null,
  forma_pagamento   text check (forma_pagamento in ('pix','dinheiro','debito','credito','transferencia','boleto','outro')),
  status            text not null default 'pago' check (status in ('pago','pendente')),
  vencimento        date not null default current_date,
  data_pagamento    date,
  cliente_id        uuid references public.clientes(id) on delete set null,
  agendamento_id    uuid references public.agendamentos(id) on delete set null,
  pacote_id         uuid references public.pacotes(id) on delete set null,
  profissional_id   uuid references public.profissionais(id) on delete set null,
  parcela           text,
  observacoes       text,
  created_at        timestamptz not null default now()
);
create index if not exists lancamentos_vencimento_idx   on public.lancamentos (vencimento);
create index if not exists lancamentos_pagamento_idx    on public.lancamentos (data_pagamento);
create index if not exists lancamentos_categoria_idx    on public.lancamentos (categoria_id);
create index if not exists lancamentos_cliente_idx      on public.lancamentos (cliente_id);
create index if not exists lancamentos_agendamento_idx  on public.lancamentos (agendamento_id);
create index if not exists lancamentos_pacote_idx       on public.lancamentos (pacote_id);
create index if not exists lancamentos_profissional_idx on public.lancamentos (profissional_id);

-- Categorias padrão
insert into public.categorias_financeiras (nome, tipo, cor) values
  ('Atendimentos',         'receita', '#e05a8d'),
  ('Pacotes',              'receita', '#b04ad6'),
  ('Venda de produtos',    'receita', '#2f9e6e'),
  ('Outras receitas',      'receita', '#5b8def'),
  ('Aluguel',              'despesa', '#d9485f'),
  ('Produtos e insumos',   'despesa', '#e08a3c'),
  ('Água, luz e internet', 'despesa', '#5b8def'),
  ('Comissões',            'despesa', '#b04ad6'),
  ('Marketing',            'despesa', '#e05a8d'),
  ('Impostos e taxas',     'despesa', '#7a6a72'),
  ('Equipamentos',         'despesa', '#2f9e6e'),
  ('Outras despesas',      'despesa', '#a08a95')
on conflict (nome, tipo) do nothing;

-- Serviços de exemplo (só se a tabela estiver vazia)
insert into public.servicos (nome, categoria, duracao_min, preco, cor)
select * from (values
  ('Massagem relaxante',         'Massoterapia', 60, 120.00, '#e05a8d'),
  ('Massagem terapêutica',       'Massoterapia', 60, 140.00, '#c23b72'),
  ('Drenagem linfática',         'Estética',     60, 130.00, '#b04ad6'),
  ('Limpeza de pele',            'Estética',     90, 150.00, '#5b8def'),
  ('Pedras quentes',             'Massoterapia', 75, 160.00, '#e08a3c'),
  ('Massagem modeladora',        'Estética',     50, 110.00, '#2f9e6e')
) as v(nome, categoria, duracao_min, preco, cor)
where not exists (select 1 from public.servicos);

-- =====================================================================
-- SEGURANÇA (Row Level Security)
--   Só usuários aprovados (admin/equipe) leem e gravam dados.
-- =====================================================================
alter table public.perfis                 enable row level security;
alter table public.configuracoes          enable row level security;
alter table public.profissionais          enable row level security;
alter table public.servicos               enable row level security;
alter table public.clientes               enable row level security;
alter table public.anamneses              enable row level security;
alter table public.pacotes                enable row level security;
alter table public.agendamentos           enable row level security;
alter table public.evolucoes              enable row level security;
alter table public.categorias_financeiras enable row level security;
alter table public.lancamentos            enable row level security;

-- Perfis: cada um vê o próprio; equipe vê todos; só admin altera papéis
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));

drop policy if exists perfis_update on public.perfis;
create policy perfis_update on public.perfis for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists perfis_delete on public.perfis;
create policy perfis_delete on public.perfis for delete to authenticated
  using ((select private.is_admin()) and id <> (select auth.uid()));

-- Demais tabelas: acesso total para equipe aprovada
do $$
declare t text;
begin
  foreach t in array array['configuracoes','profissionais','servicos','clientes','anamneses',
                           'pacotes','agendamentos','evolucoes','categorias_financeiras','lancamentos']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select private.is_staff())) with check ((select private.is_staff()))',
      t || '_staff_all', t);
  end loop;
end $$;

-- Ninguém anônimo acessa as tabelas da clínica
revoke all on public.perfis, public.configuracoes, public.profissionais, public.servicos,
  public.clientes, public.anamneses, public.pacotes, public.agendamentos, public.evolucoes,
  public.categorias_financeiras, public.lancamentos from anon;

-- ---------------------------------------------------------------------
-- v1.2.0 · Cada usuário edita o próprio nome; só a admin muda papéis
-- ---------------------------------------------------------------------
drop policy if exists perfis_update_self on public.perfis;
drop policy if exists perfis_update on public.perfis;
create policy perfis_update on public.perfis for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

create or replace function private.protege_papel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Painel do Supabase / servidor (sem usuário logado) tem acesso total
  if (select auth.uid()) is null then return new; end if;
  if new.papel is distinct from old.papel and not private.is_admin() then
    raise exception 'Apenas a administradora pode alterar o nível de acesso';
  end if;
  if new.email is distinct from old.email and not private.is_admin() then
    new.email := old.email;
  end if;
  if old.papel = 'admin' and new.papel <> 'admin'
     and not exists (select 1 from public.perfis where papel = 'admin' and id <> old.id) then
    raise exception 'É preciso ter pelo menos uma administradora';
  end if;
  return new;
end;
$$;

drop trigger if exists perfis_protege_papel on public.perfis;
create trigger perfis_protege_papel before update on public.perfis
  for each row execute function private.protege_papel();
-- =====================================================================
-- v1.3.0 · Permissões por papel
--   ADMIN  → acesso total
--   EQUIPE → agenda, clientes, anamnese, evolução e REGISTRAR recebimentos.
--            Sem acesso a despesas, lucro, totais, preços e configurações.
-- (Incluído no final do schema.sql; pode rodar de novo sem problema.)
-- =====================================================================

-- Quem registrou cada lançamento
alter table public.lancamentos add column if not exists created_by uuid
  references auth.users(id) on delete set null default auth.uid();
create index if not exists lancamentos_created_by_idx on public.lancamentos (created_by);

-- Remove as regras antigas "equipe pode tudo" (menos evolução)
do $$
declare t text;
begin
  foreach t in array array['configuracoes','profissionais','servicos','categorias_financeiras',
                           'clientes','agendamentos','pacotes','anamneses','lancamentos']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
  end loop;
end $$;

-- Cadastros da clínica: equipe só consulta; admin altera
do $$
declare t text;
begin
  foreach t in array array['configuracoes','profissionais','servicos','categorias_financeiras','pacotes']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_staff()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_delete', t);
  end loop;
end $$;

-- Dia a dia: equipe consulta, cadastra e edita; só admin exclui
do $$
declare t text;
begin
  foreach t in array array['clientes','agendamentos','anamneses']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_staff()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_staff()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_delete', t);
  end loop;
end $$;

-- Financeiro: admin vê tudo; equipe só vê RECEITAS recentes (para não duplicar
-- recebimentos) ou registradas por ela, e só cria/edita receitas
create policy lancamentos_select on public.lancamentos for select to authenticated
  using ((select private.is_admin())
         or ((select private.is_staff()) and tipo = 'receita'
             and (created_by = (select auth.uid()) or vencimento >= current_date - 7)));
create policy lancamentos_insert on public.lancamentos for insert to authenticated
  with check ((select private.is_admin()) or ((select private.is_staff()) and tipo = 'receita'));
create policy lancamentos_update on public.lancamentos for update to authenticated
  using ((select private.is_admin())
         or ((select private.is_staff()) and tipo = 'receita'
             and (created_by = (select auth.uid()) or vencimento >= current_date - 7)))
  with check ((select private.is_admin()) or ((select private.is_staff()) and tipo = 'receita'));
create policy lancamentos_delete on public.lancamentos for delete to authenticated
  using ((select private.is_admin()));

-- Equipe não altera valores de lançamentos já existentes
-- (pode vincular a cliente/atendimento e marcar pendente como pago)
create or replace function private.protege_lancamento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_admin() then return new; end if;
  if new.valor is distinct from old.valor or new.tipo is distinct from old.tipo
     or new.descricao is distinct from old.descricao or new.categoria_id is distinct from old.categoria_id
     or new.vencimento is distinct from old.vencimento or new.parcela is distinct from old.parcela
     or (old.status = 'pago' and new.status = 'pendente') then
    raise exception 'Apenas a administradora pode alterar valores do financeiro';
  end if;
  return new;
end;
$$;
drop trigger if exists lancamentos_protege on public.lancamentos;
create trigger lancamentos_protege before update on public.lancamentos
  for each row execute function private.protege_lancamento();

-- Equipe não define preço nem desconto: o valor vem da tabela de serviços
create or replace function private.protege_preco_agendamento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_admin() then return new; end if;
  if tg_op = 'INSERT'
     or new.servico_id is distinct from old.servico_id
     or new.pacote_id is distinct from old.pacote_id then
    new.valor := case when new.pacote_id is not null then 0
                      else coalesce((select preco from public.servicos where id = new.servico_id), 0) end;
    new.desconto := 0;
  else
    new.valor := old.valor;
    new.desconto := old.desconto;
  end if;
  return new;
end;
$$;
drop trigger if exists agendamentos_protege_preco on public.agendamentos;
create trigger agendamentos_protege_preco before insert or update on public.agendamentos
  for each row execute function private.protege_preco_agendamento();

-- v1.4.0 · Cidade e CPF/CNPJ da clínica (usados no recibo)
alter table public.configuracoes add column if not exists cidade text;
alter table public.configuracoes add column if not exists documento text;
