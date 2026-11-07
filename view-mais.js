import { sb, q, state, loadBase, getConfig, clearConfig } from './db.js';
import {
  esc, icon, money, toast, openModal, confirmDialog, formData, fmtPhone, onlyDigits,
  DEFAULT_MSGS, MSG_LABELS, COLORS, fillTemplate
} from './utils.js';
import { setTopbar, go, install, setTheme, getTheme, APP_VERSION, APP_CHANGELOG, showChangelog } from './app.js';
import { msgVars } from './forms.js';

export async function renderMais(view, params, alive) {
  const sub = params.sub;
  const pages = { clinica, servicos, profissionais, mensagens, categorias, equipe };
  if (sub && pages[sub]) return pages[sub](view, alive);
  return menu(view);
}

function menu(view) {
  setTopbar({ title: 'Mais' });
  const admin = state.perfil?.papel === 'admin';
  const tema = getTheme();
  const cfg = getConfig();
  const item = (href, ico, title, sub) => `<a class="list-item" href="${href}" style="text-decoration:none;color:inherit">
    <div class="settings-ico">${icon(ico)}</div><div class="grow"><div class="li-title">${title}</div><div class="li-sub">${sub}</div></div>${icon('chevR', 'go')}</a>`;
  view.innerHTML = `
    <div class="card row">
      <div class="avatar lg">${icon('user')}</div>
      <div class="grow"><div class="li-title">${esc(state.perfil?.nome || '')}</div><div class="li-sub">${esc(state.user.email)}</div>
      <span class="chip ${admin ? 'confirmado' : ''} mt-s">${admin ? 'Administradora' : 'Equipe'}</span></div>
    </div>

    <div class="section-title">Aparência</div>
    <div class="card">
      <div class="row between"><div><div class="li-title">Tema</div><div class="li-sub">Rosa & branco ou escuro</div></div>
        <div class="seg" id="tema">
          <label><input type="radio" name="t" value="claro" ${tema === 'claro' ? 'checked' : ''}><span>${icon('sun')}</span></label>
          <label><input type="radio" name="t" value="escuro" ${tema === 'escuro' ? 'checked' : ''}><span>${icon('moon')}</span></label>
          <label><input type="radio" name="t" value="auto" ${tema === 'auto' ? 'checked' : ''}><span style="font-size:12px">Auto</span></label>
        </div></div>
    </div>

    <div class="section-title">Clínica</div>
    <div class="card pad-0 settings-group"><div class="list">
      ${item('#/mais/clinica', 'heart', 'Dados da clínica', esc(state.config.nome_clinica || ''))}
      ${item('#/mais/servicos', 'sparkle', 'Serviços e preços', `${state.servicos.filter((s) => s.ativo).length} ativos`)}
      ${item('#/mais/profissionais', 'users', 'Profissionais e comissões', `${state.profissionais.filter((p) => p.ativo).length} ativos`)}
      ${item('#/mais/mensagens', 'whats', 'Mensagens do WhatsApp', 'Confirmação, lembrete, aniversário…')}
      ${item('#/lembretes', 'bell', 'Central de lembretes', 'Enviar avisos de amanhã')}
      ${item('#/mais/categorias', 'tag', 'Categorias financeiras', `${state.categorias.length} categorias`)}
      ${admin ? item('#/mais/equipe', 'shield', 'Equipe e acessos', 'Liberar acesso de recepção/profissionais') : ''}
    </div></div>

    <div class="section-title">Aplicativo</div>
    <div class="card pad-0 settings-group"><div class="list">
      <button class="list-item" id="m-install"><div class="settings-ico">${icon('install')}</div><div class="grow"><div class="li-title">Instalar no celular</div><div class="li-sub">${install.installed ? 'Já instalado neste aparelho ✓' : 'Adicionar à tela inicial'}</div></div>${icon('chevR', 'go')}</button>
      <div class="list-item" style="cursor:default"><div class="settings-ico">${icon('db')}</div><div class="grow"><div class="li-title">Banco de dados</div><div class="li-sub ellipsis">${esc(cfg?.url || '')}</div></div>
        ${cfg?.fromFile ? '' : '<button class="btn sm ghost" id="m-db">Trocar</button>'}</div>
      <button class="list-item" id="m-version"><div class="settings-ico">${icon('sparkle')}</div><div class="grow"><div class="li-title">Versão ${esc(APP_VERSION)}</div><div class="li-sub">${APP_CHANGELOG[0] ? `Atualizado em ${APP_CHANGELOG[0].data.split('-').reverse().join('/')} · ver novidades` : 'Ver novidades'}</div></div>${icon('chevR', 'go')}</button>
      <button class="list-item" id="m-update"><div class="settings-ico">${icon('download')}</div><div class="grow"><div class="li-title">Procurar atualização</div><div class="li-sub">Baixa a versão mais recente</div></div>${icon('chevR', 'go')}</button>
      <button class="list-item" id="m-out"><div class="settings-ico" style="background:var(--danger-soft);color:var(--danger)">${icon('logout')}</div><div class="grow"><div class="li-title">Sair</div></div></button>
    </div></div>
    <p class="tiny muted" style="text-align:center;margin-top:20px">Nita Reis · Gestão · versão ${esc(APP_VERSION)}</p>`;

  view.querySelectorAll('#tema input').forEach((r) => (r.onchange = () => setTheme(r.value)));
  view.querySelector('#m-install').onclick = () => install.run();
  view.querySelector('#m-version').onclick = () => showChangelog();
  view.querySelector('#m-update').onclick = async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      const res = await fetch('version.js', { cache: 'no-store' });
      const txt = await res.text();
      const remota = (txt.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
      if (remota && remota !== APP_VERSION) { toast(`Versão ${remota} encontrada. Atualizando…`, 'success'); setTimeout(() => location.reload(), 1200); }
      else toast(`Você já está na versão mais recente (${APP_VERSION}) ✓`);
    } catch { toast('Sem internet para procurar atualização', 'error'); }
    btn.disabled = false;
  };
  view.querySelector('#m-db')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Desconectar deste projeto Supabase? Você vai precisar informar a URL e a chave de novo.'))) return;
    await sb.auth.signOut(); clearConfig(); location.reload();
  });
  view.querySelector('#m-out').onclick = async () => { if (await confirmDialog('Sair da sua conta?', { ok: 'Sair' })) sb.auth.signOut(); };
}

// ---------------------------------------------------------------------
async function clinica(view) {
  setTopbar({ title: 'Dados da clínica', back: '/mais' });
  const c = state.config;
  view.innerHTML = `
    <form class="card form-grid collapse" id="f">
      <label class="field full"><span>Nome da clínica</span><input class="input" name="nome_clinica" required value="${esc(c.nome_clinica || '')}"></label>
      <label class="field"><span>Telefone / WhatsApp</span><input class="input" name="telefone" inputmode="tel" value="${esc(fmtPhone(c.telefone))}"></label>
      <label class="field"><span>Instagram</span><input class="input" name="instagram" placeholder="@suaclinica" value="${esc(c.instagram || '')}"></label>
      <label class="field full"><span>Endereço</span><input class="input" name="endereco" value="${esc(c.endereco || '')}"></label>
      <label class="field full"><span>Chave Pix (usada nas mensagens de cobrança)</span><input class="input" name="chave_pix" value="${esc(c.chave_pix || '')}"></label>
      <div class="full"><button class="btn primary">Salvar</button></div>
    </form>`;
  view.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target); f.telefone = onlyDigits(f.telefone) || null; f.updated_at = new Date().toISOString();
    state.config = await q(sb.from('configuracoes').update(f).eq('id', 1).select().single());
    document.querySelector('.sidebar .brand b').textContent = state.config.nome_clinica;
    toast('Dados salvos', 'success');
  };
}

// ---------------------------------------------------------------------
async function servicos(view) {
  setTopbar({ title: 'Serviços', back: '/mais', actions: `<button class="icon-btn" id="tb-new" aria-label="Novo serviço">${icon('plus')}</button>` });
  const draw = () => {
    const cats = [...new Set(state.servicos.map((s) => s.categoria))];
    view.innerHTML = cats.map((cat) => `
      <div class="section-title">${esc(cat)}</div>
      <div class="card pad-0"><div class="list">${state.servicos.filter((s) => s.categoria === cat).map((s) => `
        <button class="list-item" data-id="${s.id}" style="${s.ativo ? '' : 'opacity:.5'}">
          <span style="width:12px;height:12px;border-radius:4px;background:${esc(s.cor)};flex:none"></span>
          <div class="grow"><div class="li-title">${esc(s.nome)}</div><div class="li-sub">${s.duracao_min} min${s.ativo ? '' : ' · inativo'}</div></div>
          <b class="num">${money(s.preco)}</b></button>`).join('')}</div></div>`).join('')
      || `<div class="card empty">${icon('sparkle')}<p>Nenhum serviço cadastrado.</p></div>`;
    view.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => form(state.servicos.find((s) => s.id === b.dataset.id))));
  };
  const form = (s = null) => {
    const v = s || { categoria: 'Massoterapia', duracao_min: 60, cor: COLORS[0], ativo: true };
    const cats = [...new Set(['Massoterapia', 'Estética', 'Facial', 'Corporal', ...state.servicos.map((x) => x.categoria)])];
    const m = openModal({
      title: s ? 'Editar serviço' : 'Novo serviço',
      body: `<form id="sf" class="form-grid">
        <label class="field full"><span>Nome</span><input class="input" name="nome" required value="${esc(v.nome || '')}"></label>
        <label class="field"><span>Categoria</span><input class="input" name="categoria" list="cats" value="${esc(v.categoria)}"><datalist id="cats">${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</datalist></label>
        <label class="field"><span>Duração (min)</span><input class="input" type="number" name="duracao_min" min="5" step="5" data-type="int" value="${v.duracao_min}"></label>
        <label class="field"><span>Preço (R$)</span><input class="input" name="preco" inputmode="decimal" data-type="money" value="${(+v.preco || 0).toFixed(2).replace('.', ',')}"></label>
        <label class="field"><span>Situação</span><select class="input" name="ativo"><option value="1" ${v.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${v.ativo ? '' : 'selected'}>Inativo</option></select></label>
        <div class="field full"><span class="field-label">Cor na agenda</span><div class="swatches">${COLORS.map((c) => `<label><input type="radio" name="cor" value="${c}" ${c === v.cor ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
        <label class="field full"><span>Descrição</span><textarea class="input" name="descricao" rows="2">${esc(v.descricao || '')}</textarea></label>
      </form>`,
      foot: `${s ? `<button class="btn danger" id="del" style="flex:0 0 auto">${icon('trash')}</button>` : ''}<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button>`,
      onMount(el) {
        el.querySelector('#ok').onclick = async () => {
          const fm = el.querySelector('#sf'); if (!fm.reportValidity()) return;
          const f = formData(fm); f.ativo = f.ativo === '1';
          if (s) await q(sb.from('servicos').update(f).eq('id', s.id)); else await q(sb.from('servicos').insert(f));
          await loadBase(); m.close(); draw(); toast('Serviço salvo', 'success');
        };
        el.querySelector('#del')?.addEventListener('click', async () => {
          if (!(await confirmDialog('Excluir este serviço? Os agendamentos antigos continuam, mas sem o nome do serviço. Prefira marcar como inativo.', { ok: 'Excluir', danger: true }))) return;
          await q(sb.from('servicos').delete().eq('id', s.id)); await loadBase(); m.close(); draw();
        });
      }
    });
  };
  document.getElementById('tb-new').onclick = () => form();
  draw();
}

// ---------------------------------------------------------------------
async function profissionais(view) {
  setTopbar({ title: 'Profissionais', back: '/mais', actions: `<button class="icon-btn" id="tb-new" aria-label="Novo profissional">${icon('plus')}</button>` });
  const draw = () => {
    view.innerHTML = `<p class="small muted" style="margin-top:0">Cadastre quem atende para separar a agenda e calcular comissões.</p>
      <div class="card pad-0"><div class="list">${state.profissionais.map((p) => `
        <button class="list-item" data-id="${p.id}" style="${p.ativo ? '' : 'opacity:.5'}">
          <div class="avatar" style="background:${esc(p.cor)}22;color:${esc(p.cor)}">${esc(p.nome.slice(0, 1).toUpperCase())}</div>
          <div class="grow"><div class="li-title">${esc(p.nome)}</div><div class="li-sub">${esc(fmtPhone(p.telefone))}${p.ativo ? '' : ' · inativo'}</div></div>
          <span class="chip">${(+p.comissao_pct).toLocaleString('pt-BR')}% comissão</span></button>`).join('')
        || `<div class="empty">${icon('users')}<p>Nenhum profissional cadastrado.</p></div>`}</div></div>`;
    view.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => form(state.profissionais.find((p) => p.id === b.dataset.id))));
  };
  const form = (p = null) => {
    const v = p || { cor: COLORS[0], comissao_pct: 0, ativo: true };
    const m = openModal({
      title: p ? 'Editar profissional' : 'Novo profissional',
      body: `<form id="pf" class="form-grid">
        <label class="field full"><span>Nome</span><input class="input" name="nome" required value="${esc(v.nome || '')}"></label>
        <label class="field"><span>Telefone</span><input class="input" name="telefone" inputmode="tel" value="${esc(fmtPhone(v.telefone))}"></label>
        <label class="field"><span>Comissão (%)</span><input class="input" name="comissao_pct" inputmode="decimal" data-type="money" value="${String(+v.comissao_pct || 0).replace('.', ',')}"></label>
        <label class="field"><span>Situação</span><select class="input" name="ativo"><option value="1" ${v.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${v.ativo ? '' : 'selected'}>Inativo</option></select></label>
        <div class="field full"><span class="field-label">Cor</span><div class="swatches">${COLORS.map((c) => `<label><input type="radio" name="cor" value="${c}" ${c === v.cor ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
      </form>`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button>`,
      onMount(el) {
        el.querySelector('#ok').onclick = async () => {
          const fm = el.querySelector('#pf'); if (!fm.reportValidity()) return;
          const f = formData(fm); f.ativo = f.ativo === '1'; f.telefone = onlyDigits(f.telefone) || null;
          if (p) await q(sb.from('profissionais').update(f).eq('id', p.id)); else await q(sb.from('profissionais').insert(f));
          await loadBase(); m.close(); draw(); toast('Profissional salvo', 'success');
        };
      }
    });
  };
  document.getElementById('tb-new').onclick = () => form();
  draw();
}

// ---------------------------------------------------------------------
async function mensagens(view) {
  setTopbar({ title: 'Mensagens do WhatsApp', back: '/mais' });
  const msgs = { ...DEFAULT_MSGS, ...(state.config.mensagens || {}) };
  const exemplo = msgVars({ cliente: { nome: 'Maria Silva' }, inicio: new Date(Date.now() + 86400000).toISOString().slice(0, 11) + '14:00:00', servico: { nome: 'Drenagem linfática' }, valor: 130 });
  view.innerHTML = `
    <div class="card mb" style="background:var(--surface-2);box-shadow:none;border:none">
      <div class="small">Use as variáveis: <code>{nome}</code> <code>{data}</code> <code>{dia}</code> <code>{hora}</code> <code>{servico}</code> <code>{profissional}</code> <code>{valor}</code> <code>{clinica}</code> <code>{endereco}</code> <code>{pix}</code>. Texto entre *asteriscos* fica em <b>negrito</b> no WhatsApp.</div>
    </div>
    <form id="mf" class="stack">
      ${Object.keys(DEFAULT_MSGS).map((k) => `
        <div class="card">
          <label class="field"><span>${MSG_LABELS[k]}</span><textarea class="input" name="${k}" rows="5">${esc(msgs[k])}</textarea></label>
          <div class="row between mt-s"><button type="button" class="btn sm ghost" data-prev="${k}">Pré-visualizar</button><button type="button" class="btn sm ghost" data-reset="${k}">Restaurar padrão</button></div>
          <div class="small hidden" data-out="${k}" style="white-space:pre-wrap;background:#dcf8c6;color:#111;border-radius:12px;padding:10px 12px;margin-top:8px"></div>
        </div>`).join('')}
      <button class="btn primary">Salvar mensagens</button>
    </form>`;
  const f = view.querySelector('#mf');
  view.querySelectorAll('[data-prev]').forEach((b) => (b.onclick = () => {
    const out = view.querySelector(`[data-out="${b.dataset.prev}"]`);
    out.textContent = fillTemplate(f[b.dataset.prev].value, exemplo); out.classList.remove('hidden');
  }));
  view.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = () => { f[b.dataset.reset].value = DEFAULT_MSGS[b.dataset.reset]; }));
  f.onsubmit = async (e) => {
    e.preventDefault();
    const mensagens = {}; Object.keys(DEFAULT_MSGS).forEach((k) => (mensagens[k] = f[k].value));
    state.config = await q(sb.from('configuracoes').update({ mensagens }).eq('id', 1).select().single());
    toast('Mensagens salvas 💬', 'success');
  };
}

// ---------------------------------------------------------------------
async function categorias(view) {
  setTopbar({ title: 'Categorias financeiras', back: '/mais' });
  const draw = () => {
    view.innerHTML = ['receita', 'despesa'].map((t) => `
      <div class="section-title">${t === 'receita' ? 'Receitas' : 'Despesas'}</div>
      <div class="card pad-0"><div class="list">${state.categorias.filter((c) => c.tipo === t).map((c) => `
        <div class="list-item" style="cursor:default"><span style="width:12px;height:12px;border-radius:4px;background:${esc(c.cor)}"></span>
        <div class="grow">${esc(c.nome)}</div><button class="icon-btn" data-del="${c.id}" aria-label="Excluir" style="width:34px;height:34px">${icon('trash')}</button></div>`).join('')}</div>
        <form class="row" data-add="${t}" style="padding:10px 12px;border-top:1px solid var(--border)"><input class="input" name="nome" placeholder="Nova categoria de ${t}" required><button class="btn soft">${icon('plus')}</button></form></div>`).join('');
    view.querySelectorAll('[data-add]').forEach((fm) => (fm.onsubmit = async (e) => {
      e.preventDefault();
      await q(sb.from('categorias_financeiras').insert({ nome: fm.nome.value.trim(), tipo: fm.dataset.add, cor: COLORS[state.categorias.length % COLORS.length] }));
      await loadBase(); draw();
    }));
    view.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!(await confirmDialog('Excluir categoria? Os lançamentos ficarão "Sem categoria".', { ok: 'Excluir', danger: true }))) return;
      await q(sb.from('categorias_financeiras').delete().eq('id', b.dataset.del)); await loadBase(); draw();
    }));
  };
  draw();
}

// ---------------------------------------------------------------------
async function equipe(view, alive) {
  setTopbar({ title: 'Equipe e acessos', back: '/mais' });
  if (state.perfil?.papel !== 'admin') { view.innerHTML = '<div class="card empty">Apenas a administradora gerencia acessos.</div>'; return; }
  const perfis = await q(sb.from('perfis').select('*').order('created_at'));
  if (!alive()) return;
  const label = { admin: 'Administradora', equipe: 'Equipe', pendente: 'Aguardando aprovação' };
  view.innerHTML = `
    <div class="card mb" style="background:var(--surface-2);box-shadow:none;border:none"><div class="small">
      Para dar acesso a outra pessoa: peça para ela abrir o app e tocar em <b>Criar conta</b>. Ela aparecerá aqui como “aguardando aprovação”. Toque em <b>Liberar</b>.</div></div>
    <div class="card pad-0"><div class="list">${perfis.map((p) => `
      <div class="list-item" style="cursor:default">
        <div class="avatar">${esc((p.nome || p.email || '?').slice(0, 1).toUpperCase())}</div>
        <div class="grow"><div class="li-title">${esc(p.nome || '')}${p.id === state.user.id ? ' (você)' : ''}</div><div class="li-sub ellipsis">${esc(p.email || '')}</div>
          <span class="chip ${p.papel === 'pendente' ? 'pendente' : p.papel === 'admin' ? 'confirmado' : 'concluido'} mt-s">${label[p.papel]}</span></div>
        ${p.id === state.user.id ? '' : `<select class="input" data-id="${p.id}" style="width:auto;min-height:36px;padding:6px 30px 6px 10px;font-size:14px">
          <option value="pendente" ${p.papel === 'pendente' ? 'selected' : ''}>Bloqueado</option>
          <option value="equipe" ${p.papel === 'equipe' ? 'selected' : ''}>Equipe</option>
          <option value="admin" ${p.papel === 'admin' ? 'selected' : ''}>Admin</option></select>`}
        ${p.papel === 'pendente' ? `<button class="btn sm primary" data-ok="${p.id}">Liberar</button>` : ''}
      </div>`).join('')}</div></div>`;
  const set = async (id, papel) => { await q(sb.from('perfis').update({ papel }).eq('id', id)); toast('Acesso atualizado', 'success'); equipe(view, alive); };
  view.querySelectorAll('select[data-id]').forEach((s) => (s.onchange = () => set(s.dataset.id, s.value)));
  view.querySelectorAll('[data-ok]').forEach((b) => (b.onclick = () => set(b.dataset.ok, 'equipe')));
}
