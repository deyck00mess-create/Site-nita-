// =====================================================================
// Utilitários: formatação, ícones, modal, toast, WhatsApp
// =====================================================================

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Números e datas ----------
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (v) => brl.format(Number(v) || 0);
export const parseMoney = (s) => {
  if (typeof s === 'number') return s;
  const t = String(s || '').replace(/[^\d,.-]/g, '');
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(t) || 0;
};

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const today = () => ymd(new Date());
export const parseYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths = (d, n) => { const x = new Date(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; };
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const fmtDate = (s) => { if (!s) return '—'; const d = typeof s === 'string' && s.length === 10 ? parseYmd(s) : new Date(s); return d.toLocaleDateString('pt-BR'); };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
export const fmtDateLong = (d) => cap(d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
export const fmtDayMonth = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
export const monthName = (d) => cap(d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
export const weekdayShort = (d) => d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3);

export const age = (birth) => {
  if (!birth) return null;
  const b = parseYmd(birth), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};
export const initials = (name) => String(name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// ---------- Telefone / WhatsApp ----------
export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
export const fmtPhone = (s) => {
  let d = onlyDigits(s);
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s || '';
};
export const waNumber = (s) => {
  let d = onlyDigits(s);
  if (!d) return '';
  if (d.length <= 11) d = '55' + d; // padrão Brasil
  return d;
};
export const waLink = (phone, text) => {
  const n = waNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text || '')}`;
};
export const openWhats = (phone, text) => {
  if (!waNumber(phone)) { toast('Cliente sem telefone cadastrado', 'error'); return false; }
  window.open(waLink(phone, text), '_blank', 'noopener');
  return true;
};
export const fillTemplate = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

export const DEFAULT_MSGS = {
  confirmacao: 'Olá, {nome}! 🌸\nSeu horário na *{clinica}* está agendado:\n\n📅 {data} ({dia})\n⏰ {hora}\n💆‍♀️ {servico}\n\nPode confirmar sua presença respondendo *SIM*? Obrigada!',
  lembrete: 'Oi, {nome}! 💕 Passando para lembrar do seu atendimento *amanhã*:\n\n⏰ {hora} — {servico}\n📍 {clinica}\n\nTe espero! Se precisar remarcar, é só avisar. 🌷',
  agradecimento: 'Obrigada pela visita, {nome}! 🌸\nFoi um prazer cuidar de você hoje. Qualquer dúvida sobre os cuidados pós-atendimento, estou à disposição. 💕',
  aniversario: 'Feliz aniversário, {nome}! 🎉🌷\nA equipe *{clinica}* deseja um dia lindo e cheio de carinho. Que tal se presentear com um momento de cuidado? 💆‍♀️💕',
  cobranca: 'Olá, {nome}! Tudo bem? 🌸\nConsta em aberto o valor de *{valor}* referente a {servico}.\n{pix}\nQualquer dúvida estou à disposição. Obrigada!',
  retorno: 'Oi, {nome}! 💕 Sentimos sua falta por aqui na *{clinica}*. Que tal agendar seu próximo momento de cuidado? Tenho horários essa semana! 🌸'
};
export const MSG_LABELS = {
  confirmacao: 'Confirmação de agendamento',
  lembrete: 'Lembrete (véspera)',
  agradecimento: 'Agradecimento pós-atendimento',
  aniversario: 'Feliz aniversário',
  cobranca: 'Cobrança de valor pendente',
  retorno: 'Convite para retorno'
};

// ---------- Ícones (SVG inline) ----------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19v3"/><rect x="3" y="7.5" width="18" height="13" rx="2.5"/><circle cx="16.5" cy="14" r="1.3"/>',
  menu: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  whats: '<path d="M20.5 11.6a8.6 8.6 0 0 1-12.7 7.5L3.5 20.5l1.4-4.2a8.6 8.6 0 1 1 15.6-4.7z"/><path d="M9 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.5.9 1.5 1.9 2.5 2.4.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.4 0 .6-.3 1.4-1 1.7-.6.3-1.6.4-3.4-.5a9.5 9.5 0 0 1-3.5-3.4c-.8-1.4-.6-2.5-.2-3.1z" fill="currentColor" stroke="none"/>',
  phone: '<path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.6-7.5 10-7.5 10z"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8C10 4 7 4.5 7 6.5S10 8 12 8zM12 8c2-4 5-3.5 5-1.5S14 8 12 8z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  up: '<path d="M7 17 17 7M9 7h8v8"/>',
  down: '<path d="M17 7 7 17M15 17H7V9"/>',
  sparkle: '<path d="M12 3c.5 4 2 5.5 6 6-4 .5-5.5 2-6 6-.5-4-2-5.5-6-6 4-.5 5.5-2 6-6zM18.5 15c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-5 6-7.5 10-9.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  db: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  msg: '<path d="M4 5h16v11H8l-4 4z"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  pix: '<path d="m12 3 4 4-4 4-4-4zM12 13l4 4-4 4-4-4zM3 12l4-4 4 4-4 4zM13 12l4-4 4 4-4 4z"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 7v7M9 11l3 3 3-3M10 18.5h4"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};
export const icon = (name, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

// ---------- Toast ----------
export function toast(msg, type = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

// ---------- Modal ----------
let modalStack = [];
export function openModal({ title, body, foot = '', wide = false, onMount } = {}) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3>
        <button class="icon-btn" data-close aria-label="Fechar">${icon('close')}</button></div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
  root.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  const api = {
    el: wrap.querySelector('.modal'),
    close() {
      wrap.remove();
      modalStack = modalStack.filter((m) => m !== api);
      if (!modalStack.length) document.body.style.overflow = '';
      api.onClose?.();
    }
  };
  modalStack.push(api);
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) api.close(); });
  onMount?.(api.el, api);
  const first = api.el.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea');
  if (first && matchMedia('(min-width: 700px)').matches) setTimeout(() => first.focus(), 60);
  return api;
}
export const closeAllModals = () => [...modalStack].forEach((m) => m.close());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close(); });

export function confirmDialog(message, { ok = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title: 'Confirmar',
      body: `<p style="margin:0">${esc(message)}</p>`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onMount(el) { el.querySelector('[data-ok]').onclick = () => { done = true; resolve(true); m.close(); }; }
    });
    m.onClose = () => { if (!done) resolve(false); };
  });
}

// Lê os campos de um formulário em objeto (respeita data-type="money|int|bool")
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; continue; }
    if (el.type === 'checkbox') {
      if (el.dataset.multi) { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); }
      else out[el.name] = el.checked;
      continue;
    }
    let v = el.value.trim();
    if (el.dataset.type === 'money') v = parseMoney(v);
    else if (el.dataset.type === 'int') v = v === '' ? null : parseInt(v, 10);
    else if (v === '') v = null;
    out[el.name] = v;
  }
  return out;
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export function downloadFile(name, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const STATUS_LABEL = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Faltou' };
export const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', debito: 'Cartão de débito', credito: 'Cartão de crédito', transferencia: 'Transferência', boleto: 'Boleto', outro: 'Outro' };
export const COLORS = ['#e05a8d', '#c23b72', '#b04ad6', '#5b8def', '#2f9e6e', '#e08a3c', '#d9485f', '#7a6a72'];
