// Service worker: deixa o app instalável e abrindo rápido (mesmo com internet fraca).
// A versão vem de version.js — para publicar atualização, mude só lá.
importScripts('./version.js');
const VERSION = 'nr-v' + self.APP_VERSION;
const SHELL = [
  './', './index.html', './manifest.webmanifest', './styles.css',
  './version.js', './config.js', './app.js', './db.js', './utils.js', './forms.js', './anamnese-schema.js',
  './view-dashboard.js', './view-agenda.js', './view-clientes.js', './view-financeiro.js',
  './view-mais.js', './view-lembretes.js', './docs.js', './lib-pdf.js', './lib-zip.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Dados do Supabase: sempre direto da internet
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;

  // Arquivos do app: rede primeiro, ignorando o cache do navegador/GitHub (pega atualizações na hora);
  // cópia salva quando estiver sem internet
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Bibliotecas e fontes (CDN): cache primeiro
  if (/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res;
    })));
  }
});
