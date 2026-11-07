import { sb, q, state, isAdmin } from './db.js';
import { esc, icon, toast, confirmDialog, money, hm, ymd, today, addDays, startOfMonth, endOfMonth, initials, firstName, fmtDayMonth, parseYmd, STATUS_LABEL } from './utils.js';
import { setTopbar, go, install, refresh } from './app.js';
import { editarNome } from './view-mais.js';
import { AG_SELECT, openAgendamentoForm, openClienteForm, openLancamentoForm, openConcluir, whatsMenu, sendWhats } from './forms.js';

export async function renderDashboard(view, _p, alive) {
  setTopbar({ title: 'Início', actions: `<button class="icon-btn" id="tb-new" aria-label="Novo agendamento">${icon('plus')}</button>` });
  document.getElementById('tb-new').onclick = () => openAgendamentoForm().then((r) => r && refresh());

  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d1 = addDays(d0, 1), d2 = addDays(d0, 2);
  const m0 = ymd(startOfMonth(now)), m1 = ymd(endOfMonth(now));

  const admin = isAdmin();
  const [ags, amanha, lancMes, pendentes, clientes, aguardando] = await Promise.all([
    q(sb.from('agendamentos').select(AG_SELECT).gte('inicio', d0.toISOString()).lt('inicio', d1.toISOString()).order('inicio')),
    q(sb.from('agendamentos').select('id,lembrete_enviado,status,cliente:clientes(telefone)').gte('inicio', d1.toISOString()).lt('inicio', d2.toISOString()).in('status', ['agendado', 'confirmado'])),
    admin ? q(sb.from('lancamentos').select('tipo,valor,data_pagamento').eq('status', 'pago').gte('data_pagamento', m0).lte('data_pagamento', m1)) : [],
    admin ? q(sb.from('lancamentos').select('tipo,valor,vencimento').eq('status', 'pendente')) : [],
    q(sb.from('clientes').select('id,nome,telefone,data_nascimento').eq('ativo', true).not('data_nascimento', 'is', null)),
    admin ? q(sb.from('perfis').select('id,nome,email,created_at').eq('papel', 'pendente').order('created_at')) : []
  ]);
  if (!alive()) return;

  const t = today();
  const recHoje = lancMes.filter((l) => l.tipo === 'receita' && l.data_pagamento === t).reduce((s, l) => s + +l.valor, 0);
  const recMes = lancMes.filter((l) => l.tipo === 'receita').reduce((s, l) => s + +l.valor, 0);
  const despMes = lancMes.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + +l.valor, 0);
  const aReceber = pendentes.filter((l) => l.tipo === 'receita').reduce((s, l) => s + +l.valor, 0);
  const aPagarVenc = pendentes.filter((l) => l.tipo === 'despesa' && l.vencimento <= ymd(addDays(d0, 3)));
  const ativos = ags.filter((a) => !['cancelado', 'faltou'].includes(a.status));
  const lembretesPend = amanha.filter((a) => !a.lembrete_enviado && a.cliente?.telefone).length;

  // Aniversariantes dos próximos 7 dias
  const bdays = clientes.map((c) => {
    const b = parseYmd(c.data_nascimento);
    let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (next < d0) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
    return { ...c, next, dias: Math.round((next - d0) / 86400000) };
  }).filter((c) => c.dias <= 7).sort((a, b) => a.dias - b.dias);

  const hora = now.getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = firstName(state.perfil?.nome || '');
  const nomeGenerico = !state.perfil?.nome || state.perfil.nome === String(state.user.email || '').split('@')[0];

  view.innerHTML = `
    <div class="hero">
      <h2>${saud}${nome ? `, ${esc(nome)}` : ''} 🌸</h2>
      <p>${now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${ativos.length ? `${ativos.length} atendimento${ativos.length > 1 ? 's' : ''} hoje` : 'agenda livre hoje'}</p>
    </div>

    ${nomeGenerico ? `<button class="install-banner mt" id="fix-nome" style="width:100%;border:none;text-align:left;cursor:pointer;color:var(--text)">
      <div class="settings-ico">${icon('user')}</div>
      <div class="grow"><b>Como você quer ser chamada?</b><span class="small muted">Toque para colocar seu nome</span></div>
      <span class="btn sm primary">Ajustar</span></button>` : ''}

    ${!install.installed ? `<div class="install-banner mt" id="install-banner">
      <div class="settings-ico">${icon('install')}</div>
      <div class="grow"><b>Instale o app no celular</b><span class="small muted">Acesso rápido pela tela inicial</span></div>
      <button class="btn sm primary" id="btn-install">Instalar</button></div>` : ''}

    ${admin ? `<div class="kpis mt">
      <div class="kpi accent"><div class="label">${icon('calendar')} Hoje</div><div class="value">${ativos.length}</div><div class="sub">${ativos.filter((a) => a.status === 'concluido').length} concluído(s)</div></div>
      <div class="kpi"><div class="label">Recebido hoje</div><div class="value">${money(recHoje)}</div><div class="sub">no caixa</div></div>
      <div class="kpi"><div class="label">Faturamento do mês</div><div class="value">${money(recMes)}</div><div class="sub">lucro ${money(recMes - despMes)}</div></div>
      <div class="kpi"><div class="label">A receber</div><div class="value text-warning">${money(aReceber)}</div><div class="sub">${pendentes.filter((l) => l.tipo === 'receita').length} pendente(s)</div></div>
    </div>` : `<div class="kpis mt">
      <div class="kpi accent"><div class="label">${icon('calendar')} Hoje</div><div class="value">${ativos.length}</div><div class="sub">atendimento(s)</div></div>
      <div class="kpi"><div class="label">Concluídos</div><div class="value text-success">${ativos.filter((a) => a.status === 'concluido').length}</div><div class="sub">hoje</div></div>
      <div class="kpi"><div class="label">A confirmar</div><div class="value text-warning">${ativos.filter((a) => a.status === 'agendado').length}</div><div class="sub">hoje</div></div>
      <div class="kpi"><div class="label">Próximo</div><div class="value">${(() => { const p = ativos.find((a) => ['agendado', 'confirmado'].includes(a.status) && new Date(a.fim) > now); return p ? hm(new Date(p.inicio)) : '—'; })()}</div><div class="sub">horário</div></div>
    </div>`}

    <div class="quick mt">
      <button id="q-ag"><span class="q-ico">${icon('calendar')}</span>Agendar</button>
      <button id="q-cl"><span class="q-ico">${icon('user')}</span>Nova cliente</button>
      <button id="q-lc"><span class="q-ico">${icon('wallet')}</span>${admin ? 'Lançamento' : 'Recebimento'}</button>
    </div>

    ${aguardando.length ? `<div class="card mt" style="border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)">
      <div class="row" style="margin-bottom:10px"><div class="settings-ico">${icon('shield')}</div>
        <div class="grow"><div class="li-title">${aguardando.length === 1 ? '1 pessoa pediu acesso' : `${aguardando.length} pessoas pediram acesso`}</div><div class="li-sub">Libere só quem você conhece</div></div></div>
      ${aguardando.map((p) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--border)">
        <div class="grow" style="min-width:0"><div class="li-title ellipsis">${esc(p.nome || '')}</div><div class="li-sub ellipsis">${esc(p.email || '')}</div></div>
        <button class="btn sm ghost" data-recusar="${p.id}">Recusar</button><button class="btn sm primary" data-liberar="${p.id}">Liberar</button></div>`).join('')}
    </div>` : ''}

    ${lembretesPend || aPagarVenc.length ? `<div class="stack mt">
      ${lembretesPend ? `<button class="card row" id="go-lemb" style="cursor:pointer;text-align:left;width:100%;color:var(--text)">
        <div class="settings-ico" style="background:#25d36622;color:#1a9e4b">${icon('bell')}</div>
        <div class="grow"><div class="li-title">${lembretesPend} lembrete${lembretesPend > 1 ? 's' : ''} para enviar</div><div class="li-sub">Atendimentos de amanhã ainda sem aviso no WhatsApp</div></div>${icon('chevR')}</button>` : ''}
      ${aPagarVenc.length ? `<a class="card row" href="#/financeiro?aba=lancamentos&f=pagar" style="text-decoration:none;color:var(--text)">
        <div class="settings-ico" style="background:var(--danger-soft);color:var(--danger)">${icon('alert')}</div>
        <div class="grow"><div class="li-title">${aPagarVenc.length} conta${aPagarVenc.length > 1 ? 's' : ''} a pagar vencendo</div><div class="li-sub">${money(aPagarVenc.reduce((s, l) => s + +l.valor, 0))} até ${fmtDayMonth(addDays(d0, 3))}</div></div>${icon('chevR')}</a>` : ''}
    </div>` : ''}

    <div class="grid-2">
      <div>
        <div class="section-title row between"><span>Atendimentos de hoje</span><a href="#/agenda" class="small" style="text-transform:none;letter-spacing:0">Ver agenda</a></div>
        <div class="stack" id="today-list">
          ${ags.length ? ags.map(apptCard).join('') : `<div class="card empty">${icon('leaf')}<p>Nenhum atendimento hoje.</p><button class="btn soft" id="empty-ag">${icon('plus')} Agendar</button></div>`}
        </div>
      </div>
      <div>
        <div class="section-title">Aniversariantes da semana</div>
        <div class="card pad-0">
          ${bdays.length ? `<div class="list">${bdays.map((c) => `
            <div class="list-item" data-bd="${c.id}">
              <div class="avatar">${icon('gift')}</div>
              <div class="grow"><div class="li-title">${esc(c.nome)}</div><div class="li-sub">${c.dias === 0 ? '🎉 Hoje!' : c.dias === 1 ? 'Amanhã' : `${fmtDayMonth(c.next)} · em ${c.dias} dias`}</div></div>
              <button class="icon-btn whats" data-wa="${c.id}" aria-label="Parabenizar no WhatsApp">${icon('whats')}</button>
            </div>`).join('')}</div>` : `<div class="empty small">${icon('gift')}<p>Nenhum aniversário nos próximos 7 dias.</p></div>`}
        </div>
      </div>
    </div>`;

  view.querySelector('#q-ag').onclick = () => openAgendamentoForm().then((r) => r && refresh());
  view.querySelector('#empty-ag')?.addEventListener('click', () => openAgendamentoForm().then((r) => r && refresh()));
  view.querySelector('#q-cl').onclick = () => openClienteForm().then((c) => c && go(`/cliente/${c.id}`));
  view.querySelector('#q-lc').onclick = () => openLancamentoForm().then((r) => r && refresh());
  view.querySelector('#go-lemb')?.addEventListener('click', () => go('/lembretes'));
  view.querySelectorAll('[data-liberar]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { await q(sb.from('perfis').update({ papel: 'equipe' }).eq('id', b.dataset.liberar)); toast('Acesso liberado como Equipe ✓', 'success'); refresh(); } catch { b.disabled = false; }
  }));
  view.querySelectorAll('[data-recusar]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmDialog('Recusar este pedido de acesso? A pessoa continuará sem ver nenhum dado do sistema.', { ok: 'Recusar' }))) return;
    try { await q(sb.from('perfis').delete().eq('id', b.dataset.recusar)); toast('Pedido recusado'); refresh(); } catch {}
  }));
  view.querySelector('#btn-install')?.addEventListener('click', () => install.run());
  view.querySelector('#fix-nome')?.addEventListener('click', () => editarNome(state.perfil, refresh));
  view.querySelectorAll('[data-wa]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const c = bdays.find((x) => x.id === b.dataset.wa);
    sendWhats('aniversario', { cliente: c });
  }));
  view.querySelectorAll('[data-bd]').forEach((r) => (r.onclick = () => go(`/cliente/${r.dataset.bd}`)));
  bindApptActions(view, ags, refresh);
}

// ---------- Cartão de agendamento (reutilizado na agenda) ----------
export function apptCard(a) {
  const ini = new Date(a.inicio), fim = new Date(a.fim);
  const cor = a.servico?.cor || a.profissional?.cor || 'var(--primary)';
  const total = Math.max(0, (+a.valor || 0) - (+a.desconto || 0));
  const aberto = ['agendado', 'confirmado'].includes(a.status);
  return `
    <article class="appt ${a.status}" style="--c:${esc(cor)}" data-ag="${a.id}">
      <div class="appt-time"><b>${hm(ini)}</b><span>${hm(fim)}</span></div>
      <div class="appt-body">
        <div class="row between" style="align-items:flex-start">
          <div class="grow"><div class="li-title ellipsis">${esc(a.cliente?.nome || 'Cliente')}</div>
          <div class="li-sub ellipsis">${esc(a.servico?.nome || '')}${a.profissional ? ` · ${esc(a.profissional.nome)}` : ''}</div></div>
          <span class="chip dot ${a.status}">${STATUS_LABEL[a.status]}</span>
        </div>
        <div class="row small muted mt-s wrap" style="gap:8px">
          <span class="num">${a.pacote_id ? `${icon('box', '')} Pacote` : money(total)}</span>
          ${a.confirmacao_enviada ? '<span>✓ confirmação enviada</span>' : ''}
          ${a.lembrete_enviado ? '<span>✓ lembrete enviado</span>' : ''}
        </div>
        ${a.observacoes ? `<div class="small mt-s" style="color:var(--text-2)">📝 ${esc(a.observacoes)}</div>` : ''}
        <div class="appt-actions">
          <button class="btn sm whats" data-act="wa">${icon('whats')} WhatsApp</button>
          ${aberto && a.status === 'agendado' ? `<button class="btn sm soft" data-act="confirmar">Confirmou</button>` : ''}
          ${aberto ? `<button class="btn sm success" data-act="concluir">${icon('check')} Concluir</button>` : ''}
          ${aberto ? `<button class="btn sm ghost" data-act="faltou">Faltou</button>` : ''}
          <button class="btn sm ghost" data-act="editar" aria-label="Editar">${icon('edit')}</button>
        </div>
      </div>
    </article>`;
}

export function bindApptActions(root, list, onChange) {
  root.querySelectorAll('[data-ag]').forEach((card) => {
    const a = list.find((x) => x.id === card.dataset.ag);
    card.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      const act = b.dataset.act;
      if (act === 'wa') whatsMenu(a, onChange);
      if (act === 'editar') { const r = await openAgendamentoForm({ agendamento: a }); if (r) onChange(); }
      if (act === 'concluir') { if (await openConcluir(a)) onChange(); }
      if (act === 'confirmar' || act === 'faltou') {
        await q(sb.from('agendamentos').update({ status: act === 'confirmar' ? 'confirmado' : 'faltou' }).eq('id', a.id));
        onChange();
      }
    }));
    card.querySelector('.li-title').style.cursor = 'pointer';
    card.querySelector('.li-title').onclick = () => go(`/cliente/${a.cliente_id}`);
  });
}
