// Service worker: deixa o app instalável e abrindo rápido (mesmo com internet fraca).
// Ao publicar uma nova versão, aumente o número abaixo.
const VERSION = 'nr-v1.0.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/config.js', './js/app.js', './js/db.js', './js/utils.js', './js/forms.js', './js/anamnese-schema.js',
  './js/views/dashboard.js', './js/views/agenda.js', './js/views/clientes.js', './js/views/financeiro.js',
  './js/views/mais.js', './js/views/lembretes.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
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

  // Arquivos do app: rede primeiro (pega atualizações), cache se estiver sem internet
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
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
