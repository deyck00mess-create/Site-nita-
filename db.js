// =====================================================================
// Conexão com Supabase + cache simples de dados de apoio
// =====================================================================
import { toast, DEFAULT_MSGS } from './utils.js';

const LS_KEY = 'nr_supabase';

export function getConfig() {
  const c = window.APP_CONFIG || {};
  if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY) return { url: c.SUPABASE_URL, key: c.SUPABASE_ANON_KEY, fromFile: true };
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (s?.url && s?.key) return s; } catch {}
  return null;
}
export function saveConfig(url, key) { localStorage.setItem(LS_KEY, JSON.stringify({ url: url.trim().replace(/\/$/, ''), key: key.trim() })); }
export function clearConfig() { localStorage.removeItem(LS_KEY); }

export let sb = null;
export function initClient() {
  const cfg = getConfig();
  if (!cfg || !window.supabase) return null;
  sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nr_auth' }
  });
  return sb;
}

// Executa uma query e mostra erro amigável
export async function q(promise, { silent = false } = {}) {
  const { data, error, count } = await promise;
  if (error) {
    console.error(error);
    if (!silent) toast(friendlyError(error), 'error');
    throw error;
  }
  return count !== undefined && count !== null && data === null ? count : data;
}

function friendlyError(e) {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com a internet';
  if (m.includes('row-level security') || e?.code === '42501') return 'Sem permissão. Peça ao administrador para liberar seu acesso.';
  if (m.includes('does not exist') || e?.code === '42P01' || e?.code === 'PGRST205') return 'Banco de dados não configurado. Rode o arquivo schema.sql no Supabase.';
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada)';
  if (m.includes('already registered')) return 'Este e-mail já tem cadastro';
  if (m.includes('apenas a administradora') || m.includes('pelo menos uma administradora')) return e.message;
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Novos cadastros estão desligados. Peça à administradora para criar seu acesso.';
  if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres';
  return e?.message || 'Algo deu errado';
}
export { friendlyError };

// Busca todas as linhas em páginas de 1000 (limite do Supabase por consulta).
// "build" deve criar a consulta do zero, com ordenação estável.
export async function qAll(build, page = 1000) {
  let out = [];
  for (let i = 0; ; i += page) {
    const rows = await q(build().range(i, i + page - 1));
    out = out.concat(rows || []);
    if (!rows || rows.length < page) return out;
  }
}

// ---------- Estado em memória ----------
export const state = {
  user: null,
  perfil: null,
  config: { nome_clinica: 'Nita Reis', mensagens: {} },
  servicos: [],
  profissionais: [],
  categorias: [],
  loaded: false
};

export async function loadBase() {
  const [cfg, serv, prof, cat] = await Promise.all([
    q(sb.from('configuracoes').select('*').eq('id', 1).maybeSingle()),
    q(sb.from('servicos').select('*').order('nome')),
    q(sb.from('profissionais').select('*').order('nome')),
    q(sb.from('categorias_financeiras').select('*').order('nome'))
  ]);
  state.config = cfg || state.config;
  state.servicos = serv || [];
  state.profissionais = prof || [];
  state.categorias = cat || [];
  state.loaded = true;
}

export const isAdmin = () => state.perfil?.papel === 'admin';
export const msgTemplate = (key) => (state.config.mensagens || {})[key] || DEFAULT_MSGS[key];
export const servicoById = (id) => state.servicos.find((s) => s.id === id);
export const profById = (id) => state.profissionais.find((p) => p.id === id);
export const catById = (id) => state.categorias.find((c) => c.id === id);
export const catByName = (nome, tipo) => state.categorias.find((c) => c.nome === nome && c.tipo === tipo);
