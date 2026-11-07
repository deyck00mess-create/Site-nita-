import { sb, q } from './db.js';
import { esc, icon, hm, ymd, addDays, fmtDateLong, fmtDate, fmtPhone, initials, toast } from './utils.js';
import { setTopbar } from './app.js';
import { AG_SELECT, sendWhats } from './forms.js';

export async function renderLembretes(view, params, alive) {
  setTopbar({ title: 'Central do WhatsApp', back: '/agenda' });
  const aba = params.aba || 'lembretes';
  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  view.innerHTML = `
    <div class="tabs">
      <button class="tab ${aba === 'lembretes' ? 'active' : ''}" data-aba="lembretes">Lembretes de amanhã</button>
      <button class="tab ${aba === 'confirmar' ? 'active' : ''}" data-aba="confirmar">Confirmações</button>
      <button class="tab ${aba === 'retorno' ? 'active' : ''}" data-aba="retorno">Clientes sumidas</button>
    </div>
    <div id="body"><div class="empty">Carregando…</div></div>`;
  view.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => (location.hash = `#/lembretes?aba=${b.dataset.aba}`)));
  const body = view.querySelector('#body');

  const item = (a, tipo, flag) => `
    <div class="list-item" data-id="${a.id}">
      <div class="avatar">${esc(initials(a.cliente?.nome))}</div>
      <div class="grow"><div class="li-title">${esc(a.cliente?.nome)}</div>
        <div class="li-sub">${a.inicio ? `${fmtDate(a.inicio)} · ${hm(new Date(a.inicio))} · ${esc(a.servico?.nome || '')}` : esc(fmtPhone(a.cliente?.telefone))}</div></div>
      ${a[flag] ? '<span class="chip concluido">enviado</span>' : ''}
      <button class="btn sm whats" data-send="${a.id}" ${a.cliente?.telefone ? '' : 'disabled'}>${icon('whats')} ${a[flag] ? 'Reenviar' : 'Enviar'}</button>
    </div>`;

  if (aba === 'lembretes' || aba === 'confirmar') {
    const ini = aba === 'lembretes' ? addDays(d0, 1) : now;
    const fim = aba === 'lembretes' ? addDays(d0, 2) : addDays(d0, 15);
    const flag = aba === 'lembretes' ? 'lembrete_enviado' : 'confirmacao_enviada';
    let rows = await q(sb.from('agendamentos').select(AG_SELECT).gte('inicio', ini.toISOString()).lt('inicio', fim.toISOString()).in('status', ['agendado', 'confirmado']).order('inicio'));
    if (aba === 'confirmar') rows = rows.filter((r) => !r.confirmacao_enviada && r.status === 'agendado');
    if (!alive()) return;
    const pend = rows.filter((r) => !r[flag] && r.cliente?.telefone);
    body.innerHTML = `
      <div class="card mb" style="background:var(--surface-2);box-shadow:none;border:none">
        <div class="small">${aba === 'lembretes'
          ? `Atendimentos de <b>${esc(fmtDateLong(addDays(d0, 1)))}</b>. Toque em “Enviar” para abrir o WhatsApp com a mensagem pronta — depois é só apertar enviar.`
          : 'Agendamentos dos próximos 15 dias que ainda não receberam a mensagem de confirmação.'}</div>
        ${pend.length > 1 ? `<button class="btn primary block mt-s" id="next-send">${icon('whats')} Enviar o próximo (${pend.length} pendentes)</button>` : ''}
      </div>
      <div class="card pad-0">${rows.length ? `<div class="list">${rows.map((a) => item(a, aba, flag)).join('')}</div>`
        : `<div class="empty">${icon('check')}<p>${aba === 'lembretes' ? 'Nenhum atendimento amanhã.' : 'Tudo confirmado! 🌸'}</p></div>`}</div>`;
    const send = async (a) => {
      if (!sendWhats(aba === 'lembretes' ? 'lembrete' : 'confirmacao', a)) return;
      await q(sb.from('agendamentos').update({ [flag]: true }).eq('id', a.id));
      a[flag] = true;
      const row = body.querySelector(`[data-id="${a.id}"]`);
      if (row && !row.querySelector('.chip')) row.querySelector('[data-send]').insertAdjacentHTML('beforebegin', '<span class="chip concluido">enviado</span>');
      row.querySelector('[data-send]').innerHTML = `${icon('whats')} Reenviar`;
      const left = rows.filter((r) => !r[flag] && r.cliente?.telefone).length;
      const nb = body.querySelector('#next-send');
      if (nb) { if (left) nb.innerHTML = `${icon('whats')} Enviar o próximo (${left} pendentes)`; else nb.remove(); }
    };
    body.querySelectorAll('[data-send]').forEach((b) => (b.onclick = () => send(rows.find((r) => r.id === b.dataset.send))));
    body.querySelector('#next-send')?.addEventListener('click', () => {
      const a = rows.find((r) => !r[flag] && r.cliente?.telefone);
      if (a) send(a); else toast('Todos enviados!');
    });
    return;
  }

  // Clientes sem atendimento há mais de 45 dias
  const [clientes, ags] = await Promise.all([
    q(sb.from('clientes').select('id,nome,telefone').eq('ativo', true).not('telefone', 'is', null)),
    q(sb.from('agendamentos').select('cliente_id,inicio,status').in('status', ['concluido', 'agendado', 'confirmado']).gte('inicio', addDays(d0, -365).toISOString()))
  ]);
  if (!alive()) return;
  const ultimo = {}; const futuro = new Set();
  for (const a of ags) {
    if (new Date(a.inicio) > now) { futuro.add(a.cliente_id); continue; }
    if (a.status === 'concluido' && (!ultimo[a.cliente_id] || a.inicio > ultimo[a.cliente_id])) ultimo[a.cliente_id] = a.inicio;
  }
  const limite = addDays(d0, -45).toISOString();
  const sumidas = clientes.filter((c) => ultimo[c.id] && ultimo[c.id] < limite && !futuro.has(c.id))
    .map((c) => ({ ...c, ultimo: ultimo[c.id] })).sort((a, b) => b.ultimo.localeCompare(a.ultimo));
  body.innerHTML = `
    <p class="small muted" style="margin-top:0">Clientes que já foram atendidas, mas não voltam há mais de 45 dias e não têm horário marcado.</p>
    <div class="card pad-0">${sumidas.length ? `<div class="list">${sumidas.map((c) => `
      <div class="list-item">
        <div class="avatar">${esc(initials(c.nome))}</div>
        <div class="grow"><a class="li-title" href="#/cliente/${c.id}" style="color:inherit;text-decoration:none">${esc(c.nome)}</a>
          <div class="li-sub">Última visita: ${fmtDate(c.ultimo)} · há ${Math.round((now - new Date(c.ultimo)) / 86400000)} dias</div></div>
        <button class="btn sm whats" data-c="${c.id}">${icon('whats')} Convidar</button>
      </div>`).join('')}</div>` : `<div class="empty">${icon('heart')}<p>Nenhuma cliente sumida. Ótimo trabalho! 💕</p></div>`}</div>`;
  body.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
    const c = sumidas.find((x) => x.id === b.dataset.c);
    sendWhats('retorno', { cliente: c });
  }));
}
