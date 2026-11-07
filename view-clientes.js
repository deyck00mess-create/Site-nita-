import { sb, q, qAll, state, isAdmin } from './db.js';
import {
  esc, icon, money, fmtDate, fmtPhone, initials, age, hm, today, parseYmd, onlyDigits, debounce, toast,
  confirmDialog, openModal, formData, STATUS_LABEL, FORMAS
} from './utils.js';
import { setTopbar, go, parseHash } from './app.js';
import {
  AG_SELECT, openClienteForm, openAgendamentoForm, openAnamneseForm, anamneseHtml, printHtml,
  openPacoteForm, openLancamentoForm, sendWhats, whatsMenu
} from './forms.js';
import { alertasAnamnese } from './anamnese-schema.js';
import { abrirAnamnesePDF, abrirRecibo } from './docs.js';

// ---------------------------------------------------------------------
// Lista de clientes
// ---------------------------------------------------------------------
export async function renderClientes(view, params, alive) {
  setTopbar({ title: 'Clientes', actions: `<button class="icon-btn" id="tb-new" aria-label="Nova cliente">${icon('plus')}</button>` });
  const novo = () => openClienteForm().then((c) => c && go(`/cliente/${c.id}`));
  document.getElementById('tb-new').onclick = novo;
  const filtro = params.f || 'todas';

  const rows = await qAll(() => sb.from('clientes').select('id,nome,telefone,data_nascimento,ativo,created_at').order('nome').order('id'));
  if (!alive()) return;
  const mes = new Date().getMonth();

  view.innerHTML = `
    <div class="search mb">${icon('search')}<input type="search" id="busca" placeholder="Buscar por nome ou telefone" value="${esc(params.b || '')}" autocomplete="off"></div>
    <div class="tabs">
      <button class="tab ${filtro === 'todas' ? 'active' : ''}" data-f="todas">Todas (${rows.filter((r) => r.ativo).length})</button>
      <button class="tab ${filtro === 'aniv' ? 'active' : ''}" data-f="aniv">🎂 Aniversariantes do mês</button>
      <button class="tab ${filtro === 'novas' ? 'active' : ''}" data-f="novas">Novas (30 dias)</button>
      <button class="tab ${filtro === 'inativas' ? 'active' : ''}" data-f="inativas">Inativas</button>
    </div>
    <div class="card pad-0" id="lista"></div>
    <button class="fab" id="fab" aria-label="Nova cliente">${icon('plus')}</button>`;

  const lista = view.querySelector('#lista');
  const busca = view.querySelector('#busca');
  const draw = () => {
    const t = busca.value.trim().toLowerCase();
    const dig = onlyDigits(t);
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
    let list = rows.filter((r) => (filtro === 'inativas' ? !r.ativo : r.ativo));
    if (filtro === 'aniv') list = list.filter((r) => r.data_nascimento && parseYmd(r.data_nascimento).getMonth() === mes)
      .sort((a, b) => parseYmd(a.data_nascimento).getDate() - parseYmd(b.data_nascimento).getDate());
    if (filtro === 'novas') list = list.filter((r) => r.created_at >= d30);
    if (t) list = list.filter((r) => r.nome.toLowerCase().includes(t) || (dig.length >= 3 && onlyDigits(r.telefone).includes(dig)));
    lista.innerHTML = list.length ? `<div class="list">${list.map((c) => `
      <div class="list-item" data-id="${c.id}">
        <div class="avatar">${esc(initials(c.nome))}</div>
        <div class="grow"><div class="li-title ellipsis">${esc(c.nome)}</div>
          <div class="li-sub">${esc(fmtPhone(c.telefone) || 'sem telefone')}${filtro === 'aniv' ? ` · 🎂 ${parseYmd(c.data_nascimento).getDate()}/${mes + 1}` : ''}</div></div>
        ${c.telefone ? `<button class="icon-btn whats" data-wa="${c.id}" aria-label="WhatsApp">${icon('whats')}</button>` : ''}
      </div>`).join('')}</div>`
      : `<div class="empty">${icon('users')}<p>${rows.length ? 'Nenhuma cliente encontrada.' : 'Nenhuma cliente cadastrada ainda.'}</p>${rows.length ? '' : `<button class="btn soft" id="empty-new">${icon('plus')} Cadastrar primeira cliente</button>`}</div>`;
    lista.querySelectorAll('[data-id]').forEach((r) => (r.onclick = () => go(`/cliente/${r.dataset.id}`)));
    lista.querySelectorAll('[data-wa]').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const c = rows.find((x) => x.id === b.dataset.wa);
      sendWhats(filtro === 'aniv' ? 'aniversario' : 'retorno', { cliente: c });
    }));
    lista.querySelector('#empty-new')?.addEventListener('click', novo);
  };
  busca.addEventListener('input', debounce(draw, 120));
  view.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => go(`/clientes?f=${b.dataset.f}`)));
  view.querySelector('#fab').onclick = novo;
  draw();
}

// ---------------------------------------------------------------------
// Ficha da cliente
// ---------------------------------------------------------------------
export async function renderCliente(view, params, alive) {
  const id = params.id;
  const admin = isAdmin();
  const aba = params.aba || 'historico';
  const reload = () => renderCliente(view, { id, aba: parseHash().params.aba || aba }, alive);

  const [c, ags, anams, evols, pacotes, lancs] = await Promise.all([
    q(sb.from('clientes').select('*').eq('id', id).single()),
    q(sb.from('agendamentos').select(AG_SELECT).eq('cliente_id', id).order('inicio', { ascending: false })),
    q(sb.from('anamneses').select('*').eq('cliente_id', id).order('data', { ascending: false })),
    q(sb.from('evolucoes').select('*').eq('cliente_id', id).order('data', { ascending: false }).order('created_at', { ascending: false })),
    q(sb.from('pacotes').select('*, servico:servicos(nome), agendamentos(id,status,inicio)').eq('cliente_id', id).order('created_at', { ascending: false })),
    admin ? q(sb.from('lancamentos').select('*, cliente:clientes(nome,telefone)').eq('cliente_id', id).eq('tipo', 'receita').order('vencimento', { ascending: false })) : []
  ]);
  if (!alive()) return;

  setTopbar({ title: c.nome, back: '/clientes', actions: `<button class="icon-btn" id="tb-edit" aria-label="Editar">${icon('edit')}</button>` });
  document.getElementById('tb-edit').onclick = () => openClienteForm(c).then((r) => r && reload());

  const now = new Date();
  const concluidos = ags.filter((a) => a.status === 'concluido');
  const futuros = ags.filter((a) => new Date(a.inicio) >= now && ['agendado', 'confirmado'].includes(a.status)).reverse();
  const gasto = lancs.filter((l) => l.status === 'pago').reduce((s, l) => s + +l.valor, 0);
  const devendo = lancs.filter((l) => l.status === 'pendente').reduce((s, l) => s + +l.valor, 0);
  const alertas = anams[0] ? alertasAnamnese(anams[0].dados) : [];
  const faltas = ags.filter((a) => a.status === 'faltou').length;

  const tabs = [
    ['historico', `Histórico (${ags.length})`], ['anamnese', `Anamnese${anams.length ? ` (${anams.length})` : ''}`],
    ['evolucao', 'Evolução'], ['pacotes', `Pacotes${pacotes.length ? ` (${pacotes.length})` : ''}`],
    ...(admin ? [['financeiro', 'Financeiro']] : []), ['dados', 'Dados']
  ];

  view.innerHTML = `
    <div class="card">
      <div class="profile-head">
        <div class="avatar lg">${esc(initials(c.nome))}</div>
        <div class="grow">
          <h2 class="display" style="font-size:22px">${esc(c.nome)}</h2>
          <div class="small muted">${c.data_nascimento ? `${age(c.data_nascimento)} anos · ` : ''}${esc(fmtPhone(c.telefone) || 'sem telefone')}</div>
          ${!c.ativo ? '<span class="chip cancelado mt-s">Inativa</span>' : ''}
        </div>
      </div>
      <div class="row wrap mt" style="gap:8px">
        <button class="btn sm whats" id="c-wa" ${c.telefone ? '' : 'disabled'}>${icon('whats')} WhatsApp</button>
        ${c.telefone ? `<a class="btn sm ghost" href="tel:${onlyDigits(c.telefone)}">${icon('phone')} Ligar</a>` : ''}
        <button class="btn sm primary" id="c-ag">${icon('calendar')} Agendar</button>
        ${admin ? '' : `<button class="btn sm soft" id="c-rec">${icon('wallet')} Recebimento</button>`}
      </div>
      <div class="stat-row">
        <div><b>${concluidos.length}</b><span>atendimentos</span></div>
        ${admin ? `<div><b>${money(gasto)}</b><span>total pago</span></div>
        <div><b class="${devendo ? 'text-warning' : ''}">${money(devendo)}</b><span>em aberto</span></div>`
        : `<div><b>${concluidos[0] ? fmtDate(concluidos[0].inicio) : '—'}</b><span>última visita</span></div>
        <div><b>${futuros.length}</b><span>agendado(s)</span></div>`}
      </div>
      ${faltas ? `<p class="small text-danger" style="margin:10px 0 0">⚠ ${faltas} falta${faltas > 1 ? 's' : ''} registrada${faltas > 1 ? 's' : ''}</p>` : ''}
    </div>

    ${alertas.length ? `<div class="card mt" style="background:var(--danger-soft);border-color:transparent;box-shadow:none">
      <div class="row" style="color:var(--danger);font-weight:700;margin-bottom:8px">${icon('alert')} Atenção na anamnese</div>
      <div class="alert-list">${alertas.map((a) => `<span class="chip cancelado" style="white-space:normal">${esc(a)}</span>`).join('')}</div></div>`
      : !anams.length ? `<button class="card row mt" id="c-anam-cta" style="width:100%;text-align:left;cursor:pointer;color:var(--text)">
      <div class="settings-ico">${icon('file')}</div><div class="grow"><div class="li-title">Preencher ficha de anamnese</div><div class="li-sub">Esta cliente ainda não tem ficha</div></div>${icon('chevR')}</button>` : ''}

    ${futuros.length ? `<div class="section-title">Próximos horários</div><div class="card pad-0"><div class="list">${futuros.map((a) => `
      <div class="list-item" data-ag="${a.id}"><div class="settings-ico">${icon('clock')}</div>
      <div class="grow"><div class="li-title">${fmtDate(a.inicio)} às ${hm(new Date(a.inicio))}</div><div class="li-sub">${esc(a.servico?.nome || '')}</div></div>
      <span class="chip ${a.status}">${STATUS_LABEL[a.status]}</span></div>`).join('')}</div></div>` : ''}

    <div class="tabs mt">${tabs.map(([k, v]) => `<button class="tab ${k === aba ? 'active' : ''}" data-aba="${k}">${v}</button>`).join('')}</div>
    <div id="tab-body"></div>`;

  view.querySelector('#c-wa').onclick = () => whatsMenu({ cliente: c, ...(futuros[0] || {}), cliente_id: c.id });
  view.querySelector('#c-ag').onclick = () => openAgendamentoForm({ cliente: c }).then((r) => r && reload());
  view.querySelector('#c-rec')?.addEventListener('click', () => openLancamentoForm(null, { cliente_id: id, descricao: `Atendimento — ${c.nome}` }));
  view.querySelector('#c-anam-cta')?.addEventListener('click', () => openAnamneseForm(c).then((r) => r && go(`/cliente/${id}?aba=anamnese`)));
  view.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => history.replaceState(null, '', `#/cliente/${id}?aba=${b.dataset.aba}`) || renderTab(b.dataset.aba)));
  view.querySelectorAll('.list-item[data-ag]').forEach((r) => (r.onclick = () => {
    const a = ags.find((x) => x.id === r.dataset.ag);
    openAgendamentoForm({ agendamento: a }).then((x) => x && reload());
  }));

  const body = view.querySelector('#tab-body');
  function renderTab(t) {
    view.querySelectorAll('[data-aba]').forEach((b) => b.classList.toggle('active', b.dataset.aba === t));
    if (t === 'historico') {
      body.innerHTML = ags.length ? `<div class="card pad-0"><div class="list">${ags.map((a) => `
        <div class="list-item" data-h="${a.id}">
          <div class="grow"><div class="li-title">${esc(a.servico?.nome || 'Atendimento')}</div>
          <div class="li-sub">${fmtDate(a.inicio)} · ${hm(new Date(a.inicio))}${a.profissional ? ` · ${esc(a.profissional.nome)}` : ''}${a.pacote_id ? ' · pacote' : ''}</div>
          ${a.observacoes ? `<div class="small" style="color:var(--text-2)">📝 ${esc(a.observacoes)}</div>` : ''}</div>
          <div style="text-align:right"><span class="chip ${a.status}">${STATUS_LABEL[a.status]}</span>
          <div class="small num mt-s">${a.pacote_id ? '' : money(Math.max(0, a.valor - a.desconto))}</div></div>
        </div>`).join('')}</div></div>` : `<div class="card empty">${icon('calendar')}<p>Nenhum atendimento ainda.</p></div>`;
      body.querySelectorAll('[data-h]').forEach((r) => (r.onclick = () => openAgendamentoForm({ agendamento: ags.find((a) => a.id === r.dataset.h) }).then((x) => x && reload())));
    }
    if (t === 'anamnese') {
      body.innerHTML = `
        <button class="btn primary mb" id="an-new">${icon('plus')} Nova ficha de anamnese</button>
        ${anams.length ? anams.map((an, i) => `
          <div class="card ${i ? 'mt' : ''}">
            <div class="card-title"><h3>Ficha de ${fmtDate(an.data)} ${i === 0 ? '<span class="chip concluido">mais recente</span>' : ''}</h3>
              <div class="row" style="gap:6px"><button class="btn sm soft" data-pdf="${an.id}">${icon('file')} PDF</button>
              <button class="icon-btn" data-edit="${an.id}" aria-label="Editar">${icon('edit')}</button></div></div>
            ${i === 0 ? anamneseHtml(an, c, { alertas: false }) : `<button class="btn sm ghost" data-show="${an.id}">Ver ficha completa</button><div data-full="${an.id}"></div>`}
          </div>`).join('') : `<div class="card empty">${icon('file')}<p>Nenhuma ficha preenchida.</p></div>`}`;
      body.querySelector('#an-new').onclick = () => openAnamneseForm(c).then((r) => r && reload());
      body.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => openAnamneseForm(c, anams.find((a) => a.id === b.dataset.edit)).then((r) => r && reload())));
      body.querySelectorAll('[data-pdf]').forEach((b) => (b.onclick = () => abrirAnamnesePDF(anams.find((a) => a.id === b.dataset.pdf), c)));
      body.querySelectorAll('[data-show]').forEach((b) => (b.onclick = () => { body.querySelector(`[data-full="${b.dataset.show}"]`).innerHTML = anamneseHtml(anams.find((a) => a.id === b.dataset.show), c); b.remove(); }));
    }
    if (t === 'evolucao') {
      body.innerHTML = `
        <form class="card stack" id="ev-form">
          <label class="field"><span>Nova anotação</span><textarea class="input" name="texto" rows="3" required placeholder="Como foi a sessão, evolução, recomendações…"></textarea></label>
          <div class="row"><input class="input" type="date" name="data" value="${today()}" style="max-width:180px"><button class="btn primary">Salvar</button></div>
        </form>
        <div class="stack mt">${evols.map((e) => `
          <div class="card"><div class="row between"><b class="small">${fmtDate(e.data)}</b>
            <button class="icon-btn" data-del="${e.id}" aria-label="Excluir" style="width:32px;height:32px">${icon('trash')}</button></div>
            <p style="margin:6px 0 0;white-space:pre-wrap">${esc(e.texto)}</p></div>`).join('') || '<div class="empty small">Nenhuma anotação ainda. As anotações feitas ao concluir um atendimento também aparecem aqui.</div>'}</div>`;
      body.querySelector('#ev-form').onsubmit = async (e) => {
        e.preventDefault();
        const f = formData(e.target);
        await q(sb.from('evolucoes').insert({ cliente_id: id, texto: f.texto, data: f.data || today() }));
        toast('Anotação salva', 'success'); reload();
      };
      body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
        if (!(await confirmDialog('Excluir esta anotação?', { ok: 'Excluir', danger: true }))) return;
        await q(sb.from('evolucoes').delete().eq('id', b.dataset.del)); reload();
      }));
    }
    if (t === 'pacotes') {
      body.innerHTML = `
        ${admin ? `<button class="btn primary mb" id="pc-new">${icon('plus')} Vender pacote</button>` : ''}
        <div class="stack">${pacotes.map((p) => {
          const usadas = (p.agendamentos || []).filter((a) => a.status !== 'cancelado' && a.status !== 'faltou').length;
          const pct = Math.min(100, Math.round((usadas / p.total_sessoes) * 100));
          const vencido = p.validade && p.validade < today();
          return `<div class="card">
            <div class="row between"><div><div class="li-title">${esc(p.nome)}</div><div class="li-sub">${money(p.valor)}${p.validade ? ` · validade ${fmtDate(p.validade)}` : ''}</div></div>
            <span class="chip ${vencido && p.status === 'ativo' ? 'vencido' : p.status}">${vencido && p.status === 'ativo' ? 'vencido' : p.status}</span></div>
            <div class="row between small mt"><span>${usadas} de ${p.total_sessoes} sessões usadas</span><b>${p.total_sessoes - usadas} restantes</b></div>
            <div class="progress mt-s"><div style="width:${pct}%"></div></div>
            ${p.status === 'ativo' && admin ? `<div class="row mt" style="gap:6px"><button class="btn sm soft" data-fin="${p.id}">Finalizar</button><button class="btn sm ghost" data-can="${p.id}">Cancelar pacote</button></div>` : ''}
          </div>`;
        }).join('') || `<div class="card empty">${icon('box')}<p>Nenhum pacote.</p></div>`}</div>`;
      body.querySelector('#pc-new')?.addEventListener('click', () => openPacoteForm(c).then((r) => r && reload()));
      body.querySelectorAll('[data-fin],[data-can]').forEach((b) => (b.onclick = async () => {
        const st = b.dataset.fin ? 'finalizado' : 'cancelado';
        if (!(await confirmDialog(`Marcar pacote como ${st}?`))) return;
        await q(sb.from('pacotes').update({ status: st }).eq('id', b.dataset.fin || b.dataset.can)); reload();
      }));
    }
    if (t === 'financeiro') {
      body.innerHTML = `
        <div class="row wrap mb" style="gap:8px"><button class="btn primary" id="lc-new">${icon('plus')} Lançar recebimento</button>
          ${devendo ? `<button class="btn whats" id="cobrar">${icon('whats')} Cobrar ${money(devendo)}</button>` : ''}</div>
        <div class="card pad-0">${lancs.length ? `<div class="list">${lancs.map((l) => `
          <div class="list-item" data-l="${l.id}">
            <div class="grow"><div class="li-title">${esc(l.descricao)}</div>
            <div class="li-sub">${fmtDate(l.status === 'pago' ? l.data_pagamento : l.vencimento)}${l.forma_pagamento ? ` · ${FORMAS[l.forma_pagamento]}` : ''}${l.parcela ? ` · parcela ${l.parcela}` : ''}</div></div>
            <div style="text-align:right"><div class="money-in num">${money(l.valor)}</div><span class="chip ${l.status}">${l.status}</span></div>
            ${l.status === 'pago' ? `<button class="icon-btn" data-rec="${l.id}" aria-label="Recibo" title="Recibo em PDF">${icon('file')}</button>` : ''}
          </div>`).join('')}</div>` : `<div class="empty">${icon('wallet')}<p>Nenhum lançamento.</p></div>`}</div>`;
      body.querySelector('#lc-new').onclick = () => openLancamentoForm(null, { cliente_id: id, descricao: `Atendimento — ${c.nome}` }).then((r) => r && reload());
      body.querySelector('#cobrar')?.addEventListener('click', () => sendWhats('cobranca', { cliente: c }, { valor: devendo, servico: 'atendimentos anteriores' }));
      body.querySelectorAll('[data-l]').forEach((r) => (r.onclick = () => openLancamentoForm(lancs.find((l) => l.id === r.dataset.l)).then((x) => x && reload())));
      body.querySelectorAll('[data-rec]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); abrirRecibo(lancs.find((l) => l.id === b.dataset.rec)); }));
    }
    if (t === 'dados') {
      const kv = [['Nome', c.nome], ['WhatsApp', fmtPhone(c.telefone)], ['E-mail', c.email], ['CPF', c.cpf], ['Nascimento', c.data_nascimento ? `${fmtDate(c.data_nascimento)} (${age(c.data_nascimento)} anos)` : ''],
        ['Sexo', c.sexo], ['Profissão', c.profissao], ['Endereço', c.endereco], ['Como conheceu', c.como_conheceu], ['Observações', c.observacoes], ['Cliente desde', fmtDate(c.created_at)]];
      body.innerHTML = `<div class="card"><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || '—')}</dd>`).join('')}</dl></div>
        <div class="row wrap mt" style="gap:8px">
          <button class="btn soft" id="d-edit">${icon('edit')} Editar dados</button>
          <button class="btn ghost" id="d-ativo">${c.ativo ? 'Marcar como inativa' : 'Reativar cliente'}</button>
          ${admin ? `<button class="btn danger" id="d-del">${icon('trash')} Excluir</button>` : ''}
        </div>`;
      body.querySelector('#d-edit').onclick = () => openClienteForm(c).then((r) => r && reload());
      body.querySelector('#d-ativo').onclick = async () => { await q(sb.from('clientes').update({ ativo: !c.ativo }).eq('id', id)); reload(); };
      if (body.querySelector('#d-del')) body.querySelector('#d-del').onclick = async () => {
        if (!(await confirmDialog(`Excluir ${c.nome} e TODO o histórico (agendamentos, fichas, evoluções)? Isso não pode ser desfeito. Para só esconder a cliente, use "Marcar como inativa".`, { ok: 'Excluir tudo', danger: true }))) return;
        await q(sb.from('clientes').delete().eq('id', id)); toast('Cliente excluída'); go('/clientes');
      };
    }
  }
  renderTab(aba);
}
