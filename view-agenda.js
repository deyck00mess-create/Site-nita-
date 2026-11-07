import { sb, q, state } from './db.js';
import { esc, icon, ymd, hm, today, parseYmd, addDays, fmtDateLong, weekdayShort, money } from './utils.js';
import { setTopbar, go, parseHash } from './app.js';
import { AG_SELECT, openAgendamentoForm } from './forms.js';
import { apptCard, bindApptActions } from './view-dashboard.js';

const HORA_INI = 8, HORA_FIM = 20;

export async function renderAgenda(view, params, alive) {
  const dia = params.d ? parseYmd(params.d) : parseYmd(today());
  const prof = params.p || '';
  const setDay = (d) => go(`/agenda?d=${ymd(d)}${prof ? `&p=${prof}` : ''}`);
  const reload = () => renderAgenda(view, parseHash().params, alive);

  setTopbar({
    title: 'Agenda',
    actions: `<a class="icon-btn" href="#/lembretes" aria-label="Lembretes do WhatsApp">${icon('bell')}</a>
              <button class="icon-btn" id="tb-today" aria-label="Hoje">${icon('calendar')}</button>`
  });
  document.getElementById('tb-today').onclick = () => setDay(new Date());

  // Semana (domingo a sábado) que contém o dia
  const ws = addDays(dia, -dia.getDay());
  const we = addDays(ws, 7);
  let wq = sb.from('agendamentos').select(AG_SELECT).gte('inicio', ws.toISOString()).lt('inicio', we.toISOString()).order('inicio');
  if (prof) wq = wq.eq('profissional_id', prof);
  const semana = await q(wq);
  if (!alive()) return;

  const key = ymd(dia);
  const doDia = semana.filter((a) => ymd(new Date(a.inicio)) === key);
  const ativos = doDia.filter((a) => !['cancelado', 'faltou'].includes(a.status));
  const previsto = ativos.reduce((s, a) => s + Math.max(0, +a.valor - +a.desconto), 0);

  // Horários livres (de hora em hora)
  const livres = [];
  const now = new Date();
  for (let h = HORA_INI; h < HORA_FIM; h++) {
    const s = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, 0);
    const e = new Date(s.getTime() + 60 * 60000);
    if (s < now) continue;
    if (!ativos.some((a) => new Date(a.inicio) < e && new Date(a.fim) > s)) livres.push(`${String(h).padStart(2, '0')}:00`);
  }

  const profs = state.profissionais.filter((p) => p.ativo);

  view.innerHTML = `
    <div class="day-nav">
      <button class="icon-btn" id="prev" aria-label="Dia anterior">${icon('chevL')}</button>
      <div class="day-label"><b>${esc(fmtDateLong(dia))}</b><span class="small muted">${ativos.length} atendimento${ativos.length === 1 ? '' : 's'} · previsto ${money(previsto)}</span></div>
      <button class="icon-btn" id="next" aria-label="Próximo dia">${icon('chevR')}</button>
    </div>
    <div class="week">
      ${Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i), k = ymd(d);
        const n = semana.filter((a) => ymd(new Date(a.inicio)) === k && !['cancelado', 'faltou'].includes(a.status)).length;
        return `<button data-day="${k}" class="${k === key ? 'sel' : ''} ${k === today() ? 'today' : ''}">
          <span class="wd">${weekdayShort(d)}</span><span class="dn">${d.getDate()}</span>
          <span class="dots">${'<i></i>'.repeat(Math.min(n, 4))}</span></button>`;
      }).join('')}
    </div>
    ${profs.length > 1 ? `<div class="tabs"><button class="tab ${!prof ? 'active' : ''}" data-p="">Todas</button>${profs.map((p) => `<button class="tab ${prof === p.id ? 'active' : ''}" data-p="${p.id}">${esc(p.nome)}</button>`).join('')}</div>` : ''}
    <div class="stack" id="list">
      ${doDia.length ? doDia.map(apptCard).join('') : `<div class="card empty">${icon('leaf')}<p>Nenhum atendimento neste dia.</p></div>`}
    </div>
    ${livres.length ? `<div class="section-title">Horários livres</div>
      <div class="row wrap" style="gap:8px">${livres.map((h) => `<button class="btn sm ghost" data-free="${h}">${icon('plus')} ${h}</button>`).join('')}</div>` : ''}
    <button class="fab" id="fab" aria-label="Novo agendamento">${icon('plus')}</button>`;

  view.querySelector('#prev').onclick = () => setDay(addDays(dia, -1));
  view.querySelector('#next').onclick = () => setDay(addDays(dia, 1));
  view.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => setDay(parseYmd(b.dataset.day))));
  view.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => go(`/agenda?d=${key}${b.dataset.p ? `&p=${b.dataset.p}` : ''}`)));
  const novo = (hora) => openAgendamentoForm({ data: key, hora }).then((r) => {
    if (!r) return;
    const d = ymd(new Date(r.inicio));
    if (d !== key) setDay(parseYmd(d)); else reload();
  });
  view.querySelector('#fab').onclick = () => novo(livres[0] || '09:00');
  view.querySelectorAll('[data-free]').forEach((b) => (b.onclick = () => novo(b.dataset.free)));
  bindApptActions(view, doDia, reload);

  // Gestos: deslizar para trocar de dia
  let x0 = null;
  const list = view.querySelector('#list');
  list.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  list.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 80) setDay(addDays(dia, dx < 0 ? 1 : -1));
  });
}
