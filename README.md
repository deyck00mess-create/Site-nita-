# Nita Reis · Gestão — Estética & Massoterapia

Sistema de gestão para clínica de massoterapia e estética. Funciona no computador e **instala como app no celular** (Android e iPhone).

## O que tem

- **Início** — atendimentos do dia, recebido hoje, faturamento do mês, contas a receber, aniversariantes da semana e alertas.
- **Agenda** — dia a dia com semana, filtro por profissional, horários livres, aviso de conflito de horário, status (agendado, confirmado, concluído, faltou, cancelado). Deslize para trocar de dia.
- **WhatsApp** — confirmação ao agendar, lembrete da véspera, agradecimento pós-atendimento, aniversário, cobrança e convite de retorno. A **Central do WhatsApp** lista quem ainda não recebeu aviso e envia um por um.
- **Clientes** — cadastro, busca, histórico de atendimentos, total gasto, faltas, aniversariantes, clientes inativas.
- **Ficha de anamnese** — saúde, medicamentos, alergias, hábitos, avaliação estética, regiões de dor, termo de responsabilidade com **assinatura no dedo** e impressão/PDF. Contraindicações aparecem em destaque na ficha da cliente.
- **Evolução** — anotações de cada sessão.
- **Pacotes** — venda de pacotes de sessões com controle de sessões usadas.
- **Financeiro** — receitas e despesas, contas a receber/pagar, vencidos, parcelamento e lançamentos mensais repetidos, gráfico de 6 meses, receitas por forma de pagamento, despesas por categoria, ticket médio, serviços mais realizados, **comissões por profissional** e exportação para planilha (CSV).
- **Tema rosa & branco** ou **escuro** (ou automático).
- **Equipe** — o 1º cadastro vira administradora; os próximos só entram depois de liberados.

---

## 1. Configurar o banco no Supabase

1. Entre em [supabase.com](https://supabase.com) com a conta que quer usar e crie um projeto (região **South America (São Paulo)**).
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `schema.sql` e clique em **Run**.
3. Em **Authentication → Sign In / Providers → Email**, se quiser entrar sem precisar confirmar e-mail, desligue **Confirm email**.
4. Em **Project Settings → API** copie a **Project URL** e a chave **anon / publishable**.

> Depois de criar sua conta de administradora (e da equipe), você pode desligar **Allow new users to sign up** em Authentication para ninguém mais se cadastrar.

## 2. Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `nita-reis-gestao`).
2. Envie todos os arquivos desta pasta (botão **Add file → Upload files**, arraste tudo, **Commit**).
3. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
4. Em 1–2 minutos o app estará em `https://SEU-USUARIO.github.io/nita-reis-gestao/`.

**Conectar ao Supabase:** na primeira vez que abrir, o app pede a URL e a chave. Ou deixe fixo editando `config.js`.

Em **Supabase → Authentication → URL Configuration**, coloque o endereço do GitHub Pages em **Site URL** (para o link de "esqueci minha senha" funcionar).

## 3. Instalar no celular

- **Android (Chrome):** abra o endereço → toque em **Instalar** na tela inicial do app (ou menu ⋮ → *Instalar app*).
- **iPhone (Safari):** abra o endereço → **Compartilhar** → **Adicionar à Tela de Início**.

## Sobre o WhatsApp

O app abre o WhatsApp com a mensagem **já escrita** para a cliente; você só toca em enviar. É gratuito e funciona com WhatsApp normal ou Business. As mensagens são editáveis em **Mais → Mensagens do WhatsApp**.

Envio 100% automático (sem tocar em nada) exige a API oficial do WhatsApp Business, que é paga por mensagem — dá para integrar depois via Supabase Edge Function.

## Versões e atualizações

A versão atual fica em **`version.js`** e aparece em **Mais → Versão** (e no menu lateral no computador).

Para publicar uma atualização:

1. Abra `version.js` e aumente `APP_VERSION`:
   - correção pequena: `1.1.0` → `1.1.1`
   - função nova: `1.1.0` → `1.2.0`
2. Adicione no **topo** de `APP_CHANGELOG` o que mudou.
3. Envie os arquivos alterados **junto com o `version.js`** para o GitHub.

O que acontece no celular:
- Ao abrir o app (ou voltar para ele), aparece **"Nova versão disponível · Atualizar"**.
- Depois de atualizar, aparece a tela **"Novidades da versão X"** uma única vez.
- Em **Mais → Procurar atualização** dá para forçar a busca na hora.

## Estrutura

Todos os arquivos ficam soltos na raiz (sem pastas), para facilitar o envio pelo celular.

```
index.html, manifest.webmanifest, sw.js   página, instalação e offline
styles.css                                visual (rosa/branco e escuro)
version.js                                número da versão + novidades
config.js                                 URL e chave do Supabase
app.js, db.js, utils.js, forms.js         núcleo do app
view-*.js                                 telas
icon-*.png, apple-touch-icon.png          ícones
schema.sql                                banco de dados + segurança
```
