// =====================================================================
// Nita Reis · Gestão — inicialização, rotas, login e layout
// =====================================================================
import { sb, initClient, getConfig, saveConfig, state, loadBase, q, friendlyError, isAdmin } from './db.js';
import { esc, icon, toast, $, $$, closeAllModals } from './utils.js';
import { renderDashboard } from './view-dashboard.js';
import { renderAgenda } from './view-agenda.js';
import { renderClientes, renderCliente } from './view-clientes.js';
import { renderFinanceiro } from './view-financeiro.js';
import { renderMais } from './view-mais.js';
import { renderLembretes } from './view-lembretes.js';

const app = document.getElementById('app');

// ---------- Tema ----------
export function setTheme(t) {
  localStorage.setItem('nr_tema', t);
  applyTheme();
}
export function getTheme() { return localStorage.getItem('nr_tema') || 'claro'; }
function applyTheme() {
  const t = getTheme();
  const dark = t === 'escuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#17121a' : '#e05a8d'));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
applyTheme();

// ---------- Instalação (PWA) ----------
export const install = {
  prompt: null,
  get installed() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; },
  get isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
  async run() {
    if (this.installed) { toast('O app já está instalado neste aparelho 💕'); return; }
    if (this.prompt) {
      this.prompt.prompt();
      const { outcome } = await this.prompt.userChoice;
      if (outcome === 'accepted') toast('App instalado! Procure o ícone na tela inicial 🌸', 'success');
      this.prompt = null;
      return;
    }
    const { openModal } = await import('./utils.js');
    openModal({
      title: 'Instalar no celular',
      body: this.isIOS ? `
        <ol style="padding-left:20px;margin:0;line-height:1.9">
          <li>Abra este endereço no <b>Safari</b>.</li>
          <li>Toque no botão <b>Compartilhar</b> (quadrado com seta ↑).</li>
          <li>Role e toque em <b>Adicionar à Tela de Início</b>.</li>
          <li>Toque em <b>Adicionar</b>. Pronto! 🌸</li>
        </ol>` : `
        <ol style="padding-left:20px;margin:0;line-height:1.9">
          <li>Abra este endereço no <b>Chrome</b>.</li>
          <li>Toque no menu <b>⋮</b> (canto superior direito).</li>
          <li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
          <li>Confirme. O ícone aparece junto com seus outros apps. 🌸</li>
        </ol>`,
      foot: '<button class="btn primary" data-close>Entendi</button>'
    });
  }
};
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  install.prompt = e;
  document.dispatchEvent(new CustomEvent('nr:installable'));
});

// ---------- Versão e atualizações ----------
export const APP_VERSION = self.APP_VERSION || '1.0.0';
export const APP_CHANGELOG = self.APP_CHANGELOG || [];

export async function showChangelog(onlyNew = false) {
  const { openModal, esc: e, fmtDate: fd } = await import('./utils.js');
  const lista = onlyNew ? APP_CHANGELOG.slice(0, 1) : APP_CHANGELOG;
  openModal({
    title: onlyNew ? `Novidades da versão ${APP_VERSION} ✨` : 'Histórico de versões',
    body: lista.map((v, i) => `
      <div class="${i ? 'mt' : ''}">
        <div class="row between"><b>Versão ${e(v.versao)}</b>${i === 0 ? '<span class="chip confirmado">atual</span>' : ''}<span class="tiny muted">${fd(v.data)}</span></div>
        <ul style="margin:6px 0 0;padding-left:20px;line-height:1.7">${v.itens.map((t) => `<li>${e(t)}</li>`).join('')}</ul>
      </div>`).join('<hr style="border:none;border-top:1px solid var(--border);margin:14px 0 0">'),
    foot: '<button class="btn primary" data-close>Ok</button>'
  });
}

function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  const el = document.createElement('div');
  el.id = 'update-banner';
  el.className = 'update-banner';
  el.innerHTML = `<span>${icon('sparkle')} Nova versão disponível</span><button class="btn sm primary">Atualizar</button>`;
  el.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(el);
}

// Depois de atualizar, mostra as novidades uma vez
function checkNewVersion() {
  const last = localStorage.getItem('nr_versao');
  localStorage.setItem('nr_versao', APP_VERSION);
  if (last && last !== APP_VERSION) setTimeout(() => showChangelog(true), 600);
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      // Versão nova instalada enquanto o app está aberto → avisa
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBanner(); });
      // Procura atualização ao voltar para o app e a cada 30 min
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 30 * 60 * 1000);
    } catch {}
  });
}

// ---------- Rotas ----------
const ROUTES = [
  { re: /^\/?$/, view: renderDashboard, nav: 'inicio' },
  { re: /^\/agenda$/, view: renderAgenda, nav: 'agenda' },
  { re: /^\/clientes$/, view: renderClientes, nav: 'clientes' },
  { re: /^\/cliente\/([\w-]+)$/, view: renderCliente, nav: 'clientes' },
  { re: /^\/financeiro$/, view: renderFinanceiro, nav: 'financeiro', admin: true },
  { re: /^\/lembretes$/, view: renderLembretes, nav: 'agenda' },
  { re: /^\/mais(?:\/(\w+))?$/, view: renderMais, nav: 'mais' }
];

export function go(path) { location.hash = '#' + path; }
export function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path, params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

const NAV = [
  { id: 'inicio', href: '#/', label: 'Início', ico: 'home' },
  { id: 'agenda', href: '#/agenda', label: 'Agenda', ico: 'calendar' },
  { id: 'clientes', href: '#/clientes', label: 'Clientes', ico: 'users' },
  { id: 'financeiro', href: '#/financeiro', label: 'Financeiro', ico: 'wallet', admin: true },
  { id: 'mais', href: '#/mais', label: 'Mais', ico: 'menu' }
];

const navItems = () => NAV.filter((n) => !n.admin || isAdmin());

function renderShell() {
  setTimeout(() => { const b = document.getElementById('side-version'); if (b) b.onclick = () => showChangelog(); }, 0);
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">NR</div><div><b>${esc(state.config.nome_clinica || 'Nita Reis')}</b><span class="tiny muted">Estética & Massoterapia</span></div></div>
        ${navItems().map((n) => `<a href="${n.href}" data-nav="${n.id}">${icon(n.ico)}<span>${n.label}</span></a>`).join('')}
        <button class="link-btn tiny muted" id="side-version" style="margin-top:auto;text-align:left;padding:8px 12px">Versão ${esc(APP_VERSION)}</button>
      </aside>
      <div>
        <header class="app-header">
          <nav class="top-nav" aria-label="Navegação principal" style="grid-template-columns:repeat(${navItems().length},1fr)">
            ${navItems().map((n) => `<a href="${n.href}" data-nav="${n.id}">${icon(n.ico)}<span>${n.label}</span></a>`).join('')}
          </nav>
          <div class="topbar"><div class="topbar-inner" id="topbar"></div></div>
        </header>
        <main class="main" id="view"></main>
      </div>
    </div>`;
}

// Usado pelas telas para definir o título e botões do topo
export function setTopbar({ title, back, actions = '' }) {
  const tb = document.getElementById('topbar');
  if (!tb) return;
  tb.innerHTML = `
    ${back ? `<button class="icon-btn" id="tb-back" aria-label="Voltar">${icon('back')}</button>` : ''}
    <h1>${esc(title)}</h1>
    ${actions}`;
  if (back) $('#tb-back').onclick = () => (history.length > 1 ? history.back() : go(back));
  document.title = `${title} · ${state.config.nome_clinica || 'Nita Reis'}`;
}

let renderToken = 0;
async function router() {
  if (!state.user || !state.loaded) return;
  closeAllModals();
  const { path, params } = parseHash();
  let route = ROUTES.find((r) => r.re.test(path)) || ROUTES[0];
  if (route.admin && !isAdmin()) { toast('Área disponível só para a administradora'); location.replace('#/'); return; }
  const m = path.match(route.re);
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route.nav));
  const view = document.getElementById('view');
  const token = ++renderToken;
  view.innerHTML = '<div class="empty">Carregando…</div>';
  window.scrollTo(0, 0);
  try {
    await route.view(view, { ...params, id: m?.[1], sub: m?.[1] }, () => token === renderToken);
  } catch (e) {
    console.error(e);
    if (token === renderToken) view.innerHTML = `<div class="card empty">${icon('alert')}<p>${esc(friendlyError(e))}</p><button class="btn soft" onclick="location.reload()">Tentar de novo</button></div>`;
  }
}
window.addEventListener('hashchange', router);
export const refresh = () => router();

// ---------- Telas de acesso ----------
function renderSetup(msg = '') {
  app.innerHTML = `
    <div class="auth"><div class="auth-card">
      <div class="brand-mark">NR</div>
      <h1>Conectar ao Supabase</h1>
      <p class="sub">Só precisa fazer isso uma vez neste aparelho.</p>
      <form class="card stack" id="setup-form">
        ${msg ? `<div class="chip cancelado" style="white-space:normal">${esc(msg)}</div>` : ''}
        <label class="field"><span>URL do projeto</span><input class="input" name="url" placeholder="https://xxxx.supabase.co" required inputmode="url" autocomplete="off"></label>
        <label class="field"><span>Chave pública (anon / publishable)</span><textarea class="input" name="key" rows="3" placeholder="eyJhbGciOi… ou sb_publishable_…" required></textarea></label>
        <p class="small muted" style="margin:0">Encontre em Supabase → <b>Project Settings → API</b>. Nunca use a chave <i>service_role</i>.</p>
        <button class="btn primary block" type="submit">Conectar</button>
      </form>
    </div></div>`;
  $('#setup-form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const url = String(f.get('url')).trim();
    if (!/^https:\/\/.+/.test(url)) { toast('A URL deve começar com https://', 'error'); return; }
    saveConfig(url, String(f.get('key')));
    location.reload();
  };
}

function renderLogin(mode = 'entrar') {
  const signup = mode === 'cadastrar';
  app.innerHTML = `
    <div class="auth"><div class="auth-card">
      <div class="brand-mark">NR</div>
      <h1>${signup ? 'Criar acesso' : 'Bem-vinda'}</h1>
      <p class="sub">${signup ? 'O primeiro cadastro vira administradora.' : 'Entre para gerenciar sua clínica'}</p>
      <form class="card stack" id="auth-form">
        ${signup ? '<label class="field"><span>Seu nome</span><input class="input" name="nome" required autocomplete="name"></label>' : ''}
        <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required autocomplete="email" inputmode="email"></label>
        <label class="field"><span>Senha</span><input class="input" type="password" name="senha" required minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
        <button class="btn primary block" type="submit">${signup ? 'Criar conta' : 'Entrar'}</button>
        ${signup ? '' : '<button type="button" class="link-btn small" id="forgot">Esqueci minha senha</button>'}
      </form>
      <p style="text-align:center" class="small">
        ${signup ? 'Já tem conta?' : 'Primeiro acesso?'}
        <button class="link-btn" id="switch">${signup ? 'Entrar' : 'Criar conta'}</button>
      </p>
      <p style="text-align:center"><button class="link-btn tiny muted" id="reset-cfg">Trocar projeto Supabase</button></p>
    </div></div>`;
  $('#switch').onclick = () => renderLogin(signup ? 'entrar' : 'cadastrar');
  $('#reset-cfg').onclick = () => { localStorage.removeItem('nr_supabase'); location.reload(); };
  $('#forgot')?.addEventListener('click', async () => {
    const email = $('#auth-form [name=email]').value.trim();
    if (!email) { toast('Digite seu e-mail primeiro', 'error'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    toast(error ? friendlyError(error) : 'Enviamos um link para redefinir a senha 📩', error ? 'error' : 'success');
  });
  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const f = new FormData(e.target);
    const email = String(f.get('email')).trim(), password = String(f.get('senha'));
    try {
      if (signup) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nome: f.get('nome') } } });
        if (error) throw error;
        if (!data.session) { toast('Conta criada! Confirme pelo link enviado ao seu e-mail 📩', 'success'); renderLogin('entrar'); return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { toast(friendlyError(err), 'error'); btn.disabled = false; }
  };
}

function renderPending() {
  app.innerHTML = `
    <div class="auth"><div class="auth-card card" style="text-align:center">
      <div class="brand-mark">NR</div>
      <h1 style="font-size:24px">Acesso aguardando aprovação</h1>
      <p class="muted">Sua conta (<b>${esc(state.user.email)}</b>) foi criada. A administradora precisa liberar seu acesso em <b>Mais → Equipe</b>.</p>
      <div class="row" style="justify-content:center"><button class="btn soft" onclick="location.reload()">Verificar de novo</button><button class="btn ghost" id="out">Sair</button></div>
    </div></div>`;
  $('#out').onclick = () => sb.auth.signOut();
}

async function renderNewPassword() {
  app.innerHTML = `
    <div class="auth"><div class="auth-card">
      <div class="brand-mark">NR</div><h1>Nova senha</h1><p class="sub">Escolha uma nova senha de acesso</p>
      <form class="card stack" id="pw"><label class="field"><span>Nova senha</span><input class="input" type="password" name="s" minlength="6" required autocomplete="new-password"></label>
      <button class="btn primary block">Salvar</button></form></div></div>`;
  $('#pw').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: e.target.s.value });
    if (error) return toast(friendlyError(error), 'error');
    toast('Senha atualizada!', 'success');
    location.hash = '#/'; location.reload();
  };
}

// ---------- Início ----------
async function onSession(session) {
  if (!session) { state.user = null; state.loaded = false; renderLogin(); return; }
  if (state.user?.id === session.user.id && state.loaded) return;
  state.user = session.user;
  try {
    state.perfil = await q(sb.from('perfis').select('*').eq('id', session.user.id).maybeSingle(), { silent: true });
  } catch (e) {
    renderSetup('Não encontrei as tabelas do sistema. Rode o arquivo supabase/schema.sql no SQL Editor do Supabase e tente de novo.');
    return;
  }
  if (!state.perfil || state.perfil.papel === 'pendente') { renderPending(); return; }
  try { await loadBase(); } catch { return; }
  renderShell();
  router();
  checkNewVersion();
}

async function boot() {
  if (!getConfig()) { renderSetup(); return; }
  if (!window.supabase) {
    app.innerHTML = `<div class="auth"><div class="card empty">${icon('alert')}<p>Sem conexão com a internet para carregar o sistema.</p><button class="btn soft" onclick="location.reload()">Tentar de novo</button></div></div>`;
    return;
  }
  initClient();
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { renderNewPassword(); return; }
    if (event === 'SIGNED_OUT') { state.user = null; state.loaded = false; renderLogin(); return; }
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') setTimeout(() => onSession(session), 0);
  });
}

boot();
