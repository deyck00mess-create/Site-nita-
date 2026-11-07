// =====================================================================
// Documentos em PDF (recibo, ficha de anamnese) e backup dos dados
// Bibliotecas incluídas no próprio app: lib-pdf.js (pdf-lib) e lib-zip.js (JSZip)
// =====================================================================
import { sb, q, qAll, state, catById } from './db.js';
import { esc, icon, toast, openModal, money, fmtDate, fmtPhone, age, initials, onlyDigits, waLink, FORMAS, today } from './utils.js';
import { ANAMNESE, TERMO, alertasAnamnese } from './anamnese-schema.js';

// ---------- Carregamento sob demanda das bibliotecas ----------
const loaded = {};
function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  loaded[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => (window[globalName] ? res(window[globalName]) : rej(new Error('Falha ao carregar ' + src)));
    s.onerror = () => { delete loaded[src]; rej(new Error('Sem conexão para carregar o gerador de documentos')); };
    document.head.appendChild(s);
  });
  return loaded[src];
}
const getPDFLib = () => loadScript('lib-pdf.js', 'PDFLib');
const getJSZip = () => loadScript('lib-zip.js', 'JSZip');

// ---------- Valor por extenso (pt-BR) ----------
const UN = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function ate999(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const p = [], c = Math.floor(n / 100), r = n % 100;
  if (c) p.push(CT[c]);
  if (r) { if (r < 20) p.push(UN[r]); else { p.push(DZ[Math.floor(r / 10)]); if (r % 10) p.push(UN[r % 10]); } }
  return p.join(' e ');
}
function inteiroExtenso(n) {
  if (n === 0) return 'zero';
  const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000;
  const partes = [];
  if (mi) partes.push(mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`);
  if (mil) partes.push(mil === 1 ? 'mil' : `${ate999(mil)} mil`);
  if (resto) partes.push(ate999(resto));
  if (partes.length === 1) return partes[0];
  const ult = partes.pop();
  const ultNum = resto || (mil * 1000);
  const liga = (ultNum < 100 || ultNum % 100 === 0) ? ' e ' : ' ';
  return partes.join(' ') + liga + ult;
}
export function valorPorExtenso(valor) {
  const total = Math.round((Number(valor) || 0) * 100);
  const reais = Math.floor(total / 100), cent = total % 100;
  const r = reais ? `${inteiroExtenso(reais)}${reais % 1e6 === 0 && reais >= 1e6 ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}` : '';
  const c = cent ? `${ate999(cent)} ${cent === 1 ? 'centavo' : 'centavos'}` : '';
  if (!r && !c) return 'zero real';
  return [r, c].filter(Boolean).join(' e ');
}

// ---------- Utilidades de PDF ----------
const W = 595.28, H = 841.89, M = 44;
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function clean(t) {
  return String(t ?? '').replace(/\r/g, '').split('').map((ch) => {
    const c = ch.charCodeAt(0);
    if (ch === '\n') return ch;
    if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WINANSI_EXTRA.includes(ch)) return ch;
    if (ch === '✓' || ch === '✔') return 'OK';
    return '';
  }).join('').replace(/[ \t]+/g, ' ');
}
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';
const dataLonga = (d = new Date()) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

async function novoDocumento(titulo) {
  const L = await getPDFLib();
  const { PDFDocument, StandardFonts, rgb } = L;
  const doc = await PDFDocument.create();
  doc.setTitle(titulo); doc.setAuthor(state.config.nome_clinica || 'Nita Reis'); doc.setCreator('Nita Reis · Gestão');
  const f = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRomanBold),
    ital: await doc.embedFont(StandardFonts.HelveticaOblique)
  };
  const C = {
    rose: rgb(0.878, 0.353, 0.553), roseDark: rgb(0.761, 0.231, 0.447), roseSoft: rgb(0.992, 0.925, 0.953),
    ink: rgb(0.176, 0.106, 0.141), text2: rgb(0.369, 0.275, 0.322), muted: rgb(0.584, 0.478, 0.529),
    line: rgb(0.949, 0.851, 0.89), danger: rgb(0.824, 0.235, 0.337), dangerSoft: rgb(0.992, 0.91, 0.925),
    white: rgb(1, 1, 1), success: rgb(0.137, 0.533, 0.365)
  };
  let logo = null;
  try { const bytes = await (await fetch('icon-192.png')).arrayBuffer(); logo = await doc.embedPng(bytes); } catch {}

  const ctx = { L, doc, f, C, logo, page: null, y: 0, titulo };
  ctx.width = (t, size, font = f.reg) => font.widthOfTextAtSize(clean(t), size);
  ctx.wrap = (t, size, maxW, font = f.reg) => {
    const out = [];
    for (const par of clean(t).split('\n')) {
      let line = '';
      for (const word of par.split(' ')) {
        const tryL = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(tryL, size) <= maxW) { line = tryL; continue; }
        if (line) out.push(line);
        // palavra maior que a linha: quebra por caracteres
        let w = word;
        while (font.widthOfTextAtSize(w, size) > maxW) {
          let i = w.length; while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > maxW) i--;
          out.push(w.slice(0, i)); w = w.slice(i);
        }
        line = w;
      }
      out.push(line);
    }
    return out;
  };
  ctx.text = (t, x, y, size, opt = {}) => ctx.page.drawText(clean(t), { x, y, size, font: opt.font || f.reg, color: opt.color || C.ink });
  ctx.right = (t, xr, y, size, opt = {}) => ctx.text(t, xr - ctx.width(t, size, opt.font || f.reg), y, size, opt);
  ctx.rect = (x, yTop, w, h, opt = {}) => {
    const r = opt.r ?? 8;
    const p = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    ctx.page.drawSvgPath(p, { x, y: yTop, color: opt.fill, borderColor: opt.border, borderWidth: opt.border ? (opt.bw || 0.8) : 0 });
  };
  ctx.hline = (y, x1 = M, x2 = W - M, color = C.line, th = 0.8) => ctx.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: th, color });

  // Cabeçalho com marca da clínica
  ctx.cabecalho = (docTitulo, linhaDireita = '', compacto = false) => {
    ctx.page = doc.addPage([W, H]);
    ctx.page.drawRectangle({ x: 0, y: H - 7, width: W, height: 7, color: C.rose });
    const top = H - 30;
    if (compacto) {
      ctx.text(state.config.nome_clinica || 'Nita Reis', M, top - 10, 12, { font: f.serif });
      ctx.right(docTitulo, W - M, top - 10, 9, { font: f.bold, color: C.roseDark });
      ctx.hline(top - 22);
      ctx.y = top - 42;
      return;
    }
    const lx = M; let tx = M;
    if (logo) { ctx.page.drawImage(logo, { x: lx, y: top - 46, width: 46, height: 46 }); tx = M + 58; }
    ctx.text(state.config.nome_clinica || 'Nita Reis', tx, top - 18, 20, { font: f.serif });
    ctx.text('Estética & Massoterapia', tx, top - 32, 9.5, { color: C.muted });
    const contato = [state.config.telefone ? fmtPhone(state.config.telefone) : '', state.config.instagram || ''].filter(Boolean).join('   ·   ');
    if (contato) ctx.text(contato, tx, top - 45, 8.5, { color: C.text2 });
    ctx.right(docTitulo, W - M, top - 16, 11, { font: f.bold, color: C.roseDark });
    if (linhaDireita) ctx.right(linhaDireita, W - M, top - 30, 9, { color: C.muted });
    if (state.config.endereco) ctx.right(state.config.endereco, W - M, top - 45, 8.5, { color: C.text2 });
    ctx.hline(top - 60, M, W - M, C.rose, 1.2);
    ctx.y = top - 84;
  };
  // Garante espaço; se faltar, abre nova página
  ctx.espaco = (h) => { if (ctx.y - h < 70) { ctx.cabecalho(ctx.titulo.toUpperCase(), '', true); return true; } return false; };
  ctx.rodape = () => {
    const pages = doc.getPages(), n = pages.length;
    const gerado = `Documento gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${state.config.nome_clinica || 'Nita Reis'}`;
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.6, color: C.line });
      p.drawText(clean(gerado), { x: M, y: 32, size: 7.5, font: f.reg, color: C.muted });
      const pg = `Página ${i + 1} de ${n}`;
      p.drawText(pg, { x: W - M - f.reg.widthOfTextAtSize(pg, 7.5), y: 32, size: 7.5, font: f.reg, color: C.muted });
    });
  };
  return ctx;
}

// ---------------------------------------------------------------------
// RECIBO
// ---------------------------------------------------------------------
export function numeroRecibo(l) {
  const d = (l.data_pagamento || l.vencimento || today()).replace(/-/g, '');
  return `RC-${d}-${String(l.id || '').replace(/-/g, '').slice(0, 5).toUpperCase()}`;
}

export async function gerarReciboPDF(l, cliente) {
  const ctx = await novoDocumento('Recibo');
  const { f, C } = ctx;
  const nro = numeroRecibo(l);
  const dataPg = l.data_pagamento || l.vencimento;
  ctx.cabecalho('RECIBO DE PAGAMENTO', `Nº ${nro}`);

  // Título + valor em destaque
  ctx.y -= 10;
  ctx.text('Recibo', M, ctx.y - 6, 30, { font: f.serif });
  const bw = 200, bh = 62, bx = W - M - bw, btop = ctx.y + 16;
  ctx.rect(bx, btop, bw, bh, { fill: C.roseSoft, r: 12 });
  ctx.text('VALOR RECEBIDO', bx + 16, btop - 20, 8.5, { font: f.bold, color: C.roseDark });
  ctx.text(money(l.valor), bx + 16, btop - 48, 24, { font: f.bold, color: C.roseDark });
  ctx.y -= 70;

  // Texto principal
  const nome = cliente?.nome || 'cliente';
  const corpo = `Recebemos de ${nome} a importância de ${money(l.valor)} (${valorPorExtenso(l.valor)}), referente a ${String(l.descricao || 'serviços prestados').replace(/\s+—\s+.*$/, '') || 'serviços prestados'}.`;
  for (const ln of ctx.wrap(corpo, 12.5, W - 2 * M)) { ctx.text(ln, M, ctx.y, 12.5, { color: C.ink }); ctx.y -= 19; }
  ctx.y -= 14;

  // Detalhes
  const det = [
    ['Cliente', nome],
    ['CPF', cliente?.cpf || ''],
    ['Data do pagamento', fmtDate(dataPg)],
    ['Forma de pagamento', FORMAS[l.forma_pagamento] || 'Não informada'],
    ['Referente a', l.descricao || ''],
    ['Parcela', l.parcela || ''],
    ['Situação', l.status === 'pago' ? 'Pago' : 'Pendente']
  ].filter(([, v]) => v);
  const boxH = det.length * 24 + 14;
  ctx.rect(M, ctx.y + 4, W - 2 * M, boxH, { border: C.line, r: 10 });
  let yy = ctx.y - 20;
  det.forEach(([k, v], i) => {
    ctx.text(k, M + 16, yy, 9.5, { color: C.muted });
    const vv = ctx.wrap(v, 10.5, W - 2 * M - 190, f.bold)[0];
    ctx.text(vv, M + 170, yy, 10.5, { font: f.bold, color: k === 'Situação' ? C.success : C.ink });
    if (i < det.length - 1) ctx.hline(yy - 9, M + 14, W - M - 14);
    yy -= 24;
  });
  ctx.y -= boxH + 40;

  // Local, data e assinatura
  const cidade = (state.config.cidade || '').trim();
  ctx.right(`${cidade ? cidade + ', ' : ''}${dataLonga(dataPg ? new Date(dataPg + 'T12:00') : new Date())}`, W - M, ctx.y, 10.5, { color: C.text2 });
  ctx.y -= 70;
  const sx1 = W / 2 - 130, sx2 = W / 2 + 130;
  ctx.page.drawLine({ start: { x: sx1, y: ctx.y }, end: { x: sx2, y: ctx.y }, thickness: 0.9, color: C.ink });
  const nc = state.config.nome_clinica || 'Nita Reis';
  ctx.text(nc, W / 2 - ctx.width(nc, 11, f.bold) / 2, ctx.y - 16, 11, { font: f.bold });
  const doc = (state.config.documento || '').trim();
  const sub = doc ? `${onlyDigits(doc).length > 11 ? 'CNPJ' : 'CPF'}: ${doc}` : 'Estética & Massoterapia';
  ctx.text(sub, W / 2 - ctx.width(sub, 9) / 2, ctx.y - 30, 9, { color: C.muted });
  ctx.y -= 70;

  // Agradecimento
  ctx.rect(M, ctx.y + 6, W - 2 * M, 44, { fill: C.roseSoft, r: 10 });
  const ob = 'Obrigada pela preferência! Foi um prazer cuidar de você.';
  ctx.text(ob, W / 2 - ctx.width(ob, 11, f.ital) / 2, ctx.y - 23, 11, { font: f.ital, color: C.roseDark });
  if (state.config.chave_pix) {
    const px = `Chave Pix: ${state.config.chave_pix}`;
    ctx.text(px, W / 2 - ctx.width(px, 8.5) / 2, ctx.y - 62, 8.5, { color: C.muted });
  }
  ctx.rodape();
  return ctx.doc.save();
}

// ---------------------------------------------------------------------
// FICHA DE ANAMNESE
// ---------------------------------------------------------------------
export async function gerarAnamnesePDF(an, cliente) {
  const ctx = await novoDocumento('Ficha de Anamnese');
  const { f, C, L } = ctx;
  const d = an.dados || {};
  ctx.cabecalho('FICHA DE ANAMNESE', `Avaliação de ${fmtDate(an.data)}`);

  // Dados da cliente
  const info = [
    ['Cliente', cliente.nome],
    ['Nascimento', cliente.data_nascimento ? `${fmtDate(cliente.data_nascimento)} (${age(cliente.data_nascimento)} anos)` : '—'],
    ['WhatsApp', fmtPhone(cliente.telefone) || '—'],
    ['Profissão', cliente.profissao || '—'],
    ['CPF', cliente.cpf || '—'],
    ['Data da avaliação', fmtDate(an.data)]
  ];
  const colW = (W - 2 * M - 32) / 2;
  const rows = Math.ceil(info.length / 2), bh = rows * 34 + 16;
  ctx.rect(M, ctx.y + 4, W - 2 * M, bh, { fill: C.roseSoft, r: 12 });
  info.forEach(([k, v], i) => {
    const cx = M + 16 + (i % 2) * (colW + 16), cy = ctx.y - 16 - Math.floor(i / 2) * 34;
    ctx.text(k.toUpperCase(), cx, cy, 7.5, { font: f.bold, color: C.roseDark });
    ctx.text(ctx.wrap(v, 11, colW, f.bold)[0] || '', cx, cy - 14, 11, { font: f.bold });
  });
  ctx.y -= bh + 18;

  // Alertas
  const alertas = alertasAnamnese(d);
  if (alertas.length) {
    const linhas = alertas.flatMap((a) => ctx.wrap('•  ' + a, 9.5, W - 2 * M - 32));
    const ah = 34 + linhas.length * 13;
    ctx.espaco(ah + 10);
    ctx.rect(M, ctx.y + 4, W - 2 * M, ah, { fill: C.dangerSoft, r: 10 });
    ctx.page.drawRectangle({ x: M, y: ctx.y + 4 - ah, width: 4, height: ah - 8, color: C.danger });
    ctx.text('ATENÇÃO — CUIDADOS E CONTRAINDICAÇÕES', M + 16, ctx.y - 14, 9, { font: f.bold, color: C.danger });
    let ay = ctx.y - 30;
    for (const ln of linhas) { ctx.text(ln, M + 16, ay, 9.5, { color: C.ink }); ay -= 13; }
    ctx.y -= ah + 18;
  }

  // Seções
  const labelW = 190, valX = M + labelW + 12, valW = W - M - valX;
  const valor = (c) => {
    const v = d[c.id];
    if (c.type === 'yn') return v === 'sim' ? ['Sim' + (d[c.id + '_det'] ? ' — ' + d[c.id + '_det'] : ''), true] : ['Não', false];
    if (c.type === 'multi') return [(v || []).length ? v.join(', ') : '—', false];
    if (v === null || v === undefined || v === '') return ['—', false];
    return [String(v), false];
  };
  for (const s of ANAMNESE) {
    ctx.espaco(60);
    ctx.text(s.titulo, M, ctx.y, 13.5, { font: f.serif, color: C.roseDark });
    ctx.hline(ctx.y - 7, M, W - M, C.rose, 0.9);
    ctx.y -= 24;
    for (const c of s.campos) {
      const [txt, alerta] = valor(c);
      const lab = ctx.wrap(c.label, 9, labelW);
      const val = ctx.wrap(txt, 10, valW, alerta ? f.bold : f.reg);
      const h = Math.max(lab.length * 12, val.length * 13) + 4;
      if (ctx.espaco(h + 4)) { ctx.text(s.titulo + ' (continuação)', M, ctx.y, 11, { font: f.serif, color: C.roseDark }); ctx.y -= 18; }
      lab.forEach((ln, i) => ctx.text(ln, M, ctx.y - i * 12, 9, { color: C.muted }));
      val.forEach((ln, i) => ctx.text(ln, valX, ctx.y - i * 13, 10, { font: alerta ? f.bold : f.reg, color: alerta ? C.danger : C.ink }));
      ctx.y -= h;
      ctx.hline(ctx.y + 4, M, W - M, C.line, 0.5);
      ctx.y -= 7;
    }
    ctx.y -= 8;
  }

  // Termo e assinatura
  const termo = ctx.wrap(TERMO, 9.5, W - 2 * M - 32);
  const th = 40 + termo.length * 13 + 120;
  ctx.espaco(th);
  ctx.text('Termo de responsabilidade', M, ctx.y, 13.5, { font: f.serif, color: C.roseDark });
  ctx.hline(ctx.y - 7, M, W - M, C.rose, 0.9);
  ctx.y -= 26;
  termo.forEach((ln) => { ctx.text(ln, M, ctx.y, 9.5, { color: C.text2 }); ctx.y -= 13; });
  ctx.y -= 18;
  const sx = W / 2 - 140, sw = 280;
  if (an.assinatura && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(an.assinatura)) {
    try {
      const bytes = Uint8Array.from(atob(an.assinatura.split(',')[1]), (ch) => ch.charCodeAt(0));
      const img = await ctx.doc.embedPng(bytes);
      const ih = 70, iw = Math.min(sw, (img.width / img.height) * ih);
      ctx.page.drawImage(img, { x: W / 2 - iw / 2, y: ctx.y - ih, width: iw, height: ih });
    } catch {}
  }
  ctx.y -= 76;
  ctx.page.drawLine({ start: { x: sx, y: ctx.y }, end: { x: sx + sw, y: ctx.y }, thickness: 0.9, color: C.ink });
  const nm = cliente.nome;
  ctx.text(nm, W / 2 - ctx.width(nm, 10.5, f.bold) / 2, ctx.y - 15, 10.5, { font: f.bold });
  const dt = `Assinatura da cliente · ${fmtDate(an.data)}`;
  ctx.text(dt, W / 2 - ctx.width(dt, 8.5) / 2, ctx.y - 28, 8.5, { color: C.muted });

  ctx.rodape();
  return ctx.doc.save();
}

// ---------------------------------------------------------------------
// Entregar documento: compartilhar (WhatsApp), baixar ou imprimir
// ---------------------------------------------------------------------
function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function imprimir(blob) {
  const url = URL.createObjectURL(blob);
  if (matchMedia('(pointer: coarse)').matches) { window.open(url, '_blank'); return; }
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  fr.src = url;
  fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { window.open(url, '_blank'); } };
  document.body.appendChild(fr);
  setTimeout(() => { fr.remove(); URL.revokeObjectURL(url); }, 60000);
}

export function documentoModal({ titulo, descricao, arquivo, gerar, telefone, mensagem }) {
  let blob = null;
  const m = openModal({
    title: titulo,
    body: `
      <div class="row card flat" style="background:var(--surface-2);border:none">
        <div class="settings-ico" style="width:46px;height:46px">${icon('file')}</div>
        <div class="grow" style="min-width:0"><div class="li-title ellipsis">${esc(arquivo)}</div>
          <div class="li-sub" id="doc-status">Preparando o PDF…</div></div>
      </div>
      ${descricao ? `<p class="small muted">${esc(descricao)}</p>` : ''}
      <div class="stack mt">
        <button class="btn whats block" id="doc-share" disabled>${icon('whats')} Enviar pelo WhatsApp</button>
        <div class="row" style="gap:10px">
          <button class="btn ghost grow" id="doc-dl" disabled>${icon('download')} Baixar PDF</button>
          <button class="btn ghost grow" id="doc-print" disabled>${icon('print')} Imprimir</button>
        </div>
      </div>`,
    onMount(el) {
      const st = el.querySelector('#doc-status');
      const btns = ['#doc-share', '#doc-dl', '#doc-print'].map((s) => el.querySelector(s));
      gerar().then((bytes) => {
        blob = new Blob([bytes], { type: 'application/pdf' });
        st.textContent = `PDF pronto · ${Math.max(1, Math.round(blob.size / 1024))} KB`;
        btns.forEach((b) => (b.disabled = false));
      }).catch((e) => { console.error(e); st.textContent = 'Não foi possível gerar o PDF.'; toast(e.message || 'Erro ao gerar PDF', 'error'); });

      el.querySelector('#doc-dl').onclick = () => { baixar(blob, arquivo); toast('PDF baixado ✓', 'success'); };
      el.querySelector('#doc-print').onclick = () => imprimir(blob);
      el.querySelector('#doc-share').onclick = async () => {
        const file = new File([blob], arquivo, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: titulo, text: mensagem || '' }); return; }
          catch (e) { if (e.name === 'AbortError') return; }
        }
        // Sem compartilhamento de arquivos (ex.: computador): baixa o PDF e abre a conversa
        baixar(blob, arquivo);
        if (onlyDigits(telefone)) {
          window.open(waLink(telefone, (mensagem || '') + '\n\n(Segue o PDF em anexo)'), '_blank', 'noopener');
          toast('PDF baixado. Anexe o arquivo na conversa do WhatsApp 📎');
        } else toast('PDF baixado. Cliente sem WhatsApp cadastrado.');
      };
    }
  });
  return m;
}

export async function abrirRecibo(lanc) {
  let cliente = lanc.cliente && lanc.cliente.nome ? lanc.cliente : null;
  if (lanc.cliente_id) {
    try { cliente = await q(sb.from('clientes').select('id,nome,telefone,cpf').eq('id', lanc.cliente_id).single(), { silent: true }); } catch {}
  }
  const primeiroNome = (cliente?.nome || '').split(' ')[0];
  documentoModal({
    titulo: 'Recibo de pagamento',
    descricao: `${money(lanc.valor)} · ${lanc.descricao}`,
    arquivo: `Recibo-${slug(cliente?.nome)}-${lanc.data_pagamento || lanc.vencimento || today()}.pdf`,
    gerar: () => gerarReciboPDF(lanc, cliente),
    telefone: cliente?.telefone,
    mensagem: `Olá${primeiroNome ? ', ' + primeiroNome : ''}! Segue o recibo do seu pagamento de ${money(lanc.valor)}. Obrigada pela preferência! 🌸`
  });
}

export function abrirAnamnesePDF(an, cliente) {
  documentoModal({
    titulo: 'Ficha de anamnese',
    descricao: `Avaliação de ${fmtDate(an.data)}`,
    arquivo: `Anamnese-${slug(cliente.nome)}-${an.data}.pdf`,
    gerar: () => gerarAnamnesePDF(an, cliente),
    telefone: cliente.telefone,
    mensagem: `Olá, ${(cliente.nome || '').split(' ')[0]}! Segue a sua ficha de anamnese. 🌸`
  });
}

// ---------------------------------------------------------------------
// BACKUP (planilha Excel + arquivo completo)
// ---------------------------------------------------------------------
const TABELAS = ['configuracoes', 'perfis', 'servicos', 'profissionais', 'categorias_financeiras', 'clientes', 'pacotes', 'agendamentos', 'lancamentos', 'anamneses', 'evolucoes'];

export async function carregarTudo(onProgress) {
  const dados = {};
  for (const [i, t] of TABELAS.entries()) {
    onProgress?.(`Lendo ${t.replace('_', ' ')}… (${i + 1}/${TABELAS.length})`);
    dados[t] = await qAll(() => sb.from(t).select('*').order('id'));
  }
  return dados;
}

const xmlEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
function colName(i) { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
function sheetXml(headers, rows, money = []) {
  const widths = headers.map((h, ci) => Math.min(60, Math.max(h.length + 2, ...rows.slice(0, 300).map((r) => String(r[ci] ?? '').length + 1), 8)));
  const cell = (v, r, c, isHead) => {
    const ref = colName(c) + (r + 1);
    if (isHead) return `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEsc(v)}</t></is></c>`;
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return `<c r="${ref}" s="${money.includes(c) ? 2 : 0}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  };
  const allRows = [headers, ...rows];
  const last = colName(headers.length - 1) + allRows.length;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${allRows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v, ri, ci, ri === 0)).join('')}</row>`).join('')}</sheetData>
${rows.length ? `<autoFilter ref="A1:${last}"/>` : ''}
</worksheet>`;
}

export async function gerarPlanilha(D) {
  const JSZip = await getJSZip();
  const by = (t) => Object.fromEntries((D[t] || []).map((r) => [r.id, r]));
  const cli = by('clientes'), serv = by('servicos'), prof = by('profissionais'), cat = by('categorias_financeiras'), pac = by('pacotes');
  const dt = (s) => (s ? fmtDate(s) : '');
  const hora = (s) => (s ? new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  const num = (v) => (v === null || v === undefined || v === '' ? '' : Number(v));
  const status = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Faltou' };
  const campos = ANAMNESE.flatMap((s) => s.campos);

  const sheets = [
    ['Clientes', ['Nome', 'WhatsApp', 'E-mail', 'CPF', 'Nascimento', 'Sexo', 'Profissão', 'Endereço', 'Como conheceu', 'Observações', 'Ativa', 'Cadastro'],
      (D.clientes || []).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.nome, fmtPhone(c.telefone), c.email, c.cpf, dt(c.data_nascimento), c.sexo, c.profissao, c.endereco, c.como_conheceu, c.observacoes, c.ativo ? 'Sim' : 'Não', dt(c.created_at)]), []],
    ['Agendamentos', ['Data', 'Início', 'Fim', 'Cliente', 'Serviço', 'Profissional', 'Valor', 'Desconto', 'Status', 'Pacote', 'Confirmação enviada', 'Observações'],
      (D.agendamentos || []).sort((a, b) => a.inicio.localeCompare(b.inicio)).map((a) => [dt(a.inicio), hora(a.inicio), hora(a.fim), cli[a.cliente_id]?.nome, serv[a.servico_id]?.nome, prof[a.profissional_id]?.nome, num(a.valor), num(a.desconto), status[a.status] || a.status, pac[a.pacote_id]?.nome, a.confirmacao_enviada ? 'Sim' : 'Não', a.observacoes]), [6, 7]],
    ['Financeiro', ['Tipo', 'Descrição', 'Cliente', 'Categoria', 'Valor', 'Forma de pagamento', 'Situação', 'Vencimento', 'Pagamento', 'Parcela', 'Profissional', 'Observações'],
      (D.lancamentos || []).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map((l) => [l.tipo === 'receita' ? 'Receita' : 'Despesa', l.descricao, cli[l.cliente_id]?.nome, cat[l.categoria_id]?.nome, num(l.valor), FORMAS[l.forma_pagamento] || '', l.status === 'pago' ? 'Pago' : 'Pendente', dt(l.vencimento), dt(l.data_pagamento), l.parcela, prof[l.profissional_id]?.nome, l.observacoes]), [4]],
    ['Anamneses', ['Cliente', 'Data', ...campos.map((c) => c.label), 'Assinada'],
      (D.anamneses || []).map((a) => {
        const d = a.dados || {};
        return [cli[a.cliente_id]?.nome, dt(a.data), ...campos.map((c) => {
          const v = d[c.id];
          if (c.type === 'yn') return v === 'sim' ? 'Sim' + (d[c.id + '_det'] ? ' — ' + d[c.id + '_det'] : '') : 'Não';
          if (Array.isArray(v)) return v.join(', ');
          return v ?? '';
        }), a.assinatura ? 'Sim' : 'Não'];
      }), []],
    ['Evoluções', ['Cliente', 'Data', 'Anotação'], (D.evolucoes || []).map((e) => [cli[e.cliente_id]?.nome, dt(e.data), e.texto]), []],
    ['Pacotes', ['Cliente', 'Pacote', 'Serviço', 'Sessões', 'Valor', 'Validade', 'Situação'],
      (D.pacotes || []).map((p) => [cli[p.cliente_id]?.nome, p.nome, serv[p.servico_id]?.nome, num(p.total_sessoes), num(p.valor), dt(p.validade), p.status]), [4]],
    ['Serviços', ['Serviço', 'Categoria', 'Duração (min)', 'Preço', 'Ativo'], (D.servicos || []).map((s) => [s.nome, s.categoria, num(s.duracao_min), num(s.preco), s.ativo ? 'Sim' : 'Não']), [3]],
    ['Profissionais', ['Nome', 'Telefone', 'Comissão (%)', 'Ativo'], (D.profissionais || []).map((p) => [p.nome, fmtPhone(p.telefone), num(p.comissao_pct), p.ativo ? 'Sim' : 'Não']), []]
  ];

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Backup ${xmlEsc(state.config.nome_clinica || 'Nita Reis')}</dc:title><dc:creator>Nita Reis · Gestão</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>
${sheets.map(([n], i) => `<sheet name="${xmlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE05A8D"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);
  sheets.forEach(([, h, rows, money], i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(h, rows, money)));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function gerarBackupJSON(D) {
  const meta = { aplicativo: 'Nita Reis · Gestão', versao: self.APP_VERSION, gerado_em: new Date().toISOString(), clinica: state.config.nome_clinica };
  return new Blob([JSON.stringify({ ...meta, tabelas: D }, null, 1)], { type: 'application/json' });
}

export function marcarBackup() { try { localStorage.setItem('nr_ultimo_backup', new Date().toISOString()); } catch {} }
export function ultimoBackup() { try { return localStorage.getItem('nr_ultimo_backup'); } catch { return null; } }
export { baixar };
