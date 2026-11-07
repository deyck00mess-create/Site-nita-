import { sb, q, qAll, state, catById, profById, catByName } from './db.js';
import {
  esc, icon, money, ymd, today, parseYmd, addMonths, startOfMonth, endOfMonth, monthName, fmtDate,
  toast, downloadFile, FORMAS, debounce
} from './utils.js';
import { setTopbar, go, parseHash } from './app.js';
import { openLancamentoForm } from './forms.js';

const sum = (arr) => arr.reduce((s, l) => s + (+l.valor || 0), 0);

export async function renderFinanceiro(view, params, alive) {
  const aba = params.aba || 'resumo';
  const ref = params.m ? parseYmd(params.m + '-01') : startOfMonth(new Date());
  const m0 = ymd(startOfMonth(ref)), m1 = ymd(endOfMonth(ref));
  const nav = (p) => {
    const cur = { aba, m: ymd(ref).slice(0, 7), f: params.f, ...p };
    go(`/financeiro?${new URLSearchParams(Object.entries(cur).filter(([, v]) => v)).toString()}`);
  };
  const reload = () => renderFinanceiro(view, parseHash().params, alive);

  setTopbar({ title: 'Financeiro', actions: `<button class="icon-btn" id="tb-new" aria-label="Novo lançamento">${icon('plus')}</button>` });
  document.getElementById('tb-new').onclick = () => openLancamentoForm().then((r) => r && reload());

  view.innerHTML = `
    <div class="segmented mb" role="tablist">
      ${[['resumo', 'Resumo'], ['lancamentos', 'Lançamentos'], ['comissoes', 'Comissões']].map(([k, v]) =>
        `<button role="tab" aria-selected="${aba === k}" class="${aba === k ? 'active' : ''}" data-aba="${k}">${v}</button>`).join('')}
    </div>
    <div class="month-nav mb">
      <button class="icon-btn" id="m-prev" aria-label="Mês anterior">${icon('chevL')}</button>
      <b>${esc(monthName(ref))}</b>
      <button class="icon-btn" id="m-next" aria-label="Próximo mês">${icon('chevR')}</button>
    </div>
    <div id="fin-body"><div class="empty">Carregando…</div></div>
    <button class="fab" id="fab" aria-label="Novo lançamento">${icon('plus')}</button>`;
  view.querySelector('#m-prev').onclick = () => nav({ m: ymd(addMonths(ref, -1)).slice(0, 7) });
  view.querySelector('#m-next').onclick = () => nav({ m: ymd(addMonths(ref, 1)).slice(0, 7) });
  view.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => nav({ aba: b.dataset.aba, f: '' })));
  view.querySelector('#fab').onclick = () => openLancamentoForm().then((r) => r && reload());
  const body = view.querySelector('#fin-body');

  if (aba === 'resumo') return resumo(body, ref, m0, m1, alive, nav);
  if (aba === 'lancamentos') return lancamentos(body, ref, m0, m1, params, alive, nav, reload);
  if (aba === 'comissoes') return comissoes(body, ref, m0, m1, alive, reload);
}

// ---------------------------------------------------------------------
async function resumo(body, ref, m0, m1, alive, nav) {
  const h0 = ymd(startOfMonth(addMonths(ref, -5)));
  const [pagos6, pendMes, vencidos, ags] = await Promise.all([
    qAll(() => sb.from('lancamentos').select('tipo,valor,data_pagamento,forma_pagamento,categoria_id').eq('status', 'pago').gte('data_pagamento', h0).lte('data_pagamento', m1).order('id')),
    q(sb.from('lancamentos').select('tipo,valor').eq('status', 'pendente').gte('vencimento', m0).lte('vencimento', m1)),
    q(sb.from('lancamentos').select('tipo,valor').eq('status', 'pendente').lt('vencimento', today())),
    q(sb.from('agendamentos').select('valor,desconto,status,servico:servicos(nome)').eq('status', 'concluido').gte('inicio', new Date(m0 + 'T00:00').toISOString()).lte('inicio', new Date(m1 + 'T23:59:59').toISOString()))
  ]);
  if (!alive()) return;

  const mes = pagos6.filter((l) => l.data_pagamento >= m0);
  const rec = mes.filter((l) => l.tipo === 'receita'), desp = mes.filter((l) => l.tipo === 'despesa');
  const R = sum(rec), D = sum(desp), saldo = R - D;
  const aReceber = sum(pendMes.filter((l) => l.tipo === 'receita')), aPagar = sum(pendMes.filter((l) => l.tipo === 'despesa'));
  const vRec = sum(vencidos.filter((l) => l.tipo === 'receita')), vPag = sum(vencidos.filter((l) => l.tipo === 'despesa'));
  const ticket = ags.length ? sum(ags.map((a) => ({ valor: Math.max(0, a.valor - a.desconto) }))) / ags.length : 0;

  // 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(ref, i - 5), a = ymd(startOfMonth(d)), b = ymd(endOfMonth(d));
    const it = pagos6.filter((l) => l.data_pagamento >= a && l.data_pagamento <= b);
    return { label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), r: sum(it.filter((l) => l.tipo === 'receita')), d: sum(it.filter((l) => l.tipo === 'despesa')) };
  });
  const max = Math.max(1, ...meses.flatMap((m) => [m.r, m.d]));

  const group = (arr, keyFn) => {
    const g = {};
    arr.forEach((l) => { const k = keyFn(l); g[k] = (g[k] || 0) + (+l.valor || 0); });
    return Object.entries(g).sort((a, b) => b[1] - a[1]);
  };
  const porForma = group(rec, (l) => FORMAS[l.forma_pagamento] || 'Não informado');
  const porCatDesp = group(desp, (l) => catById(l.categoria_id)?.nome || 'Sem categoria');
  const porServ = group(ags.map((a) => ({ valor: Math.max(0, a.valor - a.desconto), nome: a.servico?.nome })), (a) => a.nome || 'Outro');
  const qtdServ = {}; ags.forEach((a) => { const k = a.servico?.nome || 'Outro'; qtdServ[k] = (qtdServ[k] || 0) + 1; });

  const hbars = (rows, color) => {
    if (!rows.length) return '<div class="empty small">Sem dados no período</div>';
    const top = rows[0][1] || 1;
    return rows.map(([k, v]) => `<div class="hbar"><span class="small">${esc(k)}</span><b class="small num">${money(v)}</b>
      <div class="track"><div class="fill" style="width:${Math.max(2, (v / top) * 100)}%;${color ? `background:${color}` : ''}"></div></div></div>`).join('');
  };

  body.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="label">${icon('up')} Receitas</div><div class="value text-success">${money(R)}</div><div class="sub">${rec.length} recebimento(s)</div></div>
      <div class="kpi"><div class="label">${icon('down')} Despesas</div><div class="value text-danger">${money(D)}</div><div class="sub">${desp.length} pagamento(s)</div></div>
      <div class="kpi accent"><div class="label">Lucro do mês</div><div class="value">${money(saldo)}</div><div class="sub">margem ${R ? Math.round((saldo / R) * 100) : 0}%</div></div>
      <div class="kpi"><div class="label">Ticket médio</div><div class="value">${money(ticket)}</div><div class="sub">${ags.length} atendimento(s)</div></div>
    </div>
    <div class="kpis mt" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <button class="kpi" style="text-align:left;cursor:pointer" data-goto="receber"><div class="label">A receber no mês</div><div class="value text-warning">${money(aReceber)}</div>${vRec ? `<div class="sub text-danger">${money(vRec)} vencido</div>` : '<div class="sub">nada vencido</div>'}</button>
      <button class="kpi" style="text-align:left;cursor:pointer" data-goto="pagar"><div class="label">A pagar no mês</div><div class="value">${money(aPagar)}</div>${vPag ? `<div class="sub text-danger">${money(vPag)} vencido</div>` : '<div class="sub">nada vencido</div>'}</button>
    </div>

    <div class="card mt">
      <div class="card-title"><h3>Últimos 6 meses</h3><div class="legend"><span><i style="background:var(--primary)"></i>Receitas</span><span><i style="background:var(--border-strong)"></i>Despesas</span></div></div>
      <div class="bars" role="img" aria-label="Receitas e despesas dos últimos 6 meses">
        ${meses.map((m) => `<div class="bar-group" title="${m.label}: receitas ${money(m.r)} · despesas ${money(m.d)}">
          <div class="bar-pair"><div class="bar rec" style="height:${(m.r / max) * 100}%"></div><div class="bar desp" style="height:${(m.d / max) * 100}%"></div></div>
          <span class="bar-label">${m.label}</span></div>`).join('')}
      </div>
    </div>

    <div class="grid-2 mt">
      <div class="card"><div class="card-title"><h3>Receitas por forma de pagamento</h3></div>${hbars(porForma)}</div>
      <div class="card"><div class="card-title"><h3>Despesas por categoria</h3></div>${hbars(porCatDesp, 'var(--danger)')}</div>
    </div>
    <div class="card mt"><div class="card-title"><h3>Serviços realizados no mês</h3></div>
      ${porServ.length ? porServ.map(([k, v]) => `<div class="hbar"><span class="small">${esc(k)} <span class="muted">· ${qtdServ[k]}x</span></span><b class="small num">${money(v)}</b>
        <div class="track"><div class="fill" style="width:${Math.max(2, (v / (porServ[0][1] || 1)) * 100)}%"></div></div></div>`).join('') : '<div class="empty small">Nenhum atendimento concluído no mês</div>'}
    </div>`;
  body.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => nav({ aba: 'lancamentos', f: b.dataset.goto })));
}

// ---------------------------------------------------------------------
async function lancamentos(body, ref, m0, m1, params, alive, nav, reload) {
  // Compatibilidade com links antigos
  const alias = { receitas: 'recebido', despesas: 'pago' };
  const f = alias[params.f] || params.f || 'todos';
  const [doMes, vencidos] = await Promise.all([
    qAll(() => sb.from('lancamentos').select('*, cliente:clientes(nome)')
      .or(`and(status.eq.pago,data_pagamento.gte.${m0},data_pagamento.lte.${m1}),and(status.eq.pendente,vencimento.gte.${m0},vencimento.lte.${m1})`)
      .order('vencimento', { ascending: false }).order('created_at', { ascending: false }).order('id')),
    qAll(() => sb.from('lancamentos').select('*, cliente:clientes(nome)').eq('status', 'pendente').lt('vencimento', today())
      .order('vencimento', { ascending: false }).order('id'))
  ]);
  if (!alive()) return;

  const grupos = {
    recebido: { label: 'Recebido', cls: 'in', test: (l) => l.tipo === 'receita' && l.status === 'pago' },
    pago: { label: 'Pago', cls: 'out', test: (l) => l.tipo === 'despesa' && l.status === 'pago' },
    receber: { label: 'A receber', cls: 'warn', test: (l) => l.tipo === 'receita' && l.status === 'pendente' },
    pagar: { label: 'A pagar', cls: 'out', test: (l) => l.tipo === 'despesa' && l.status === 'pendente' }
  };
  let rows = f === 'vencidos' ? vencidos : grupos[f] ? doMes.filter(grupos[f].test) : doMes;
  const vRec = vencidos.filter((l) => l.tipo === 'receita'), vPag = vencidos.filter((l) => l.tipo === 'despesa');

  body.innerHTML = `
    <div class="ftiles mb">
      ${Object.entries(grupos).map(([k, g]) => {
        const it = doMes.filter(g.test);
        return `<button class="ftile ${g.cls} ${f === k ? 'active' : ''}" data-f="${k}" aria-pressed="${f === k}">
          <span class="ft-label">${g.label}</span><span class="ft-value num">${money(sum(it))}</span><span class="ft-sub">${it.length} lançamento${it.length === 1 ? '' : 's'}</span></button>`;
      }).join('')}
    </div>
    ${vencidos.length ? `<button class="venc-banner mb ${f === 'vencidos' ? 'active' : ''}" data-f="vencidos">
      ${icon('alert')}<span class="grow"><b>${vencidos.length} vencido${vencidos.length > 1 ? 's' : ''}</b>
      ${vRec.length ? ` · ${money(sum(vRec))} a receber` : ''}${vPag.length ? ` · ${money(sum(vPag))} a pagar` : ''}</span>
      <span class="small">${f === 'vencidos' ? 'Mostrando' : 'Ver'}</span></button>` : ''}
    <div class="row mb" style="gap:8px">
      <div class="search grow">${icon('search')}<input type="search" id="busca" placeholder="Buscar por descrição, cliente…"></div>
      <button class="icon-btn" id="csv" aria-label="Exportar planilha" title="Exportar CSV">${icon('download')}</button>
    </div>
    <div class="row between small mb" id="totais"></div>
    <div id="lista"></div>`;
  body.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => nav({ f: b.dataset.f === f ? '' : b.dataset.f })));

  const lista = body.querySelector('#lista');
  const busca = body.querySelector('#busca');
  const draw = () => {
    const t = busca.value.trim().toLowerCase();
    const list = t ? rows.filter((l) => `${l.descricao} ${l.cliente?.nome || ''} ${catById(l.categoria_id)?.nome || ''}`.toLowerCase().includes(t)) : rows;
    const ent = sum(list.filter((l) => l.tipo === 'receita')), sai = sum(list.filter((l) => l.tipo === 'despesa'));
    const nomeFiltro = f === 'vencidos' ? 'Vencidos' : grupos[f]?.label;
    body.querySelector('#totais').innerHTML = `<span>${nomeFiltro ? `<b>${nomeFiltro}</b> · ` : ''}${list.length} lançamento${list.length === 1 ? '' : 's'}${nomeFiltro ? ' · <button class="link-btn small" id="limpar" style="padding:0">mostrar todos</button>' : ''}</span>
      <span><span class="money-in">+${money(ent)}</span> · <span class="money-out">−${money(sai)}</span></span>`;
    body.querySelector('#limpar')?.addEventListener('click', () => nav({ f: '' }));
    if (!list.length) { lista.innerHTML = `<div class="card empty">${icon('wallet')}<p>${t ? 'Nada encontrado nessa busca.' : nomeFiltro ? `Nenhum lançamento em “${nomeFiltro}” neste mês.` : 'Nenhum lançamento neste mês.'}</p><button class="btn soft" id="vazio-novo">${icon('plus')} Novo lançamento</button></div>`;
      lista.querySelector('#vazio-novo').onclick = () => openLancamentoForm().then((r) => r && reload()); return; }
    const groups = {};
    list.forEach((l) => { const d = l.status === 'pago' ? l.data_pagamento : l.vencimento; (groups[d] ||= []).push(l); });
    lista.innerHTML = Object.keys(groups).sort().reverse().map((d) => `
      <div class="section-title" style="margin-top:14px">${parseYmd(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
      <div class="card pad-0"><div class="list">${groups[d].map((l) => {
        const venc = l.status === 'pendente' && l.vencimento < today();
        const cat = catById(l.categoria_id);
        return `<div class="list-item" data-l="${l.id}">
          <div class="settings-ico" style="${l.tipo === 'receita' ? 'background:var(--success-soft);color:var(--success)' : 'background:var(--danger-soft);color:var(--danger)'}">${icon(l.tipo === 'receita' ? 'up' : 'down')}</div>
          <div class="grow"><div class="li-title ellipsis">${esc(l.descricao)}</div>
            <div class="li-sub ellipsis">${esc(cat?.nome || 'Sem categoria')}${l.forma_pagamento ? ` · ${FORMAS[l.forma_pagamento]}` : ''}${l.parcela ? ` · ${l.parcela}` : ''}</div></div>
          <div style="text-align:right;flex:none">
            <div class="${l.tipo === 'receita' ? 'money-in' : 'money-out'} num">${l.tipo === 'receita' ? '+' : '−'}${money(l.valor)}</div>
            ${l.status === 'pendente' ? `<button class="btn sm ${venc ? 'danger' : 'soft'}" data-pay="${l.id}" style="min-height:28px;padding:3px 10px;margin-top:3px">${l.tipo === 'receita' ? 'Receber' : 'Pagar'}${venc ? ' · vencido' : ''}</button>` : '<span class="chip pago">pago</span>'}
          </div></div>`;
      }).join('')}</div></div>`).join('');
    lista.querySelectorAll('[data-l]').forEach((r) => (r.onclick = () => openLancamentoForm(rows.find((l) => l.id === r.dataset.l)).then((x) => x && reload())));
    lista.querySelectorAll('[data-pay]').forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      await q(sb.from('lancamentos').update({ status: 'pago', data_pagamento: today() }).eq('id', b.dataset.pay));
      toast('Marcado como pago ✓', 'success'); reload();
    }));
  };
  busca.addEventListener('input', debounce(draw, 150));
  body.querySelector('#csv').onclick = () => {
    const head = ['Tipo', 'Descrição', 'Cliente', 'Categoria', 'Valor', 'Forma', 'Situação', 'Vencimento', 'Pagamento', 'Parcela'];
    const csv = [head, ...rows.map((l) => [l.tipo, l.descricao, l.cliente?.nome || '', catById(l.categoria_id)?.nome || '', String(l.valor).replace('.', ','),
      FORMAS[l.forma_pagamento] || '', l.status, fmtDate(l.vencimento), l.data_pagamento ? fmtDate(l.data_pagamento) : '', l.parcela || ''])]
      .map((r) => r.map((v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; }).join(';')).join('\n');
    downloadFile(`financeiro-${ymd(ref).slice(0, 7)}.csv`, csv);
  };
  draw();
}

// ---------------------------------------------------------------------
async function comissoes(body, ref, m0, m1, alive, reload) {
  const [recs, pagas] = await Promise.all([
    q(sb.from('lancamentos').select('valor,profissional_id').eq('tipo', 'receita').eq('status', 'pago').not('profissional_id', 'is', null).gte('data_pagamento', m0).lte('data_pagamento', m1)),
    q(sb.from('lancamentos').select('valor,profissional_id,status').eq('tipo', 'despesa').eq('categoria_id', catByName('Comissões', 'despesa')?.id || '00000000-0000-0000-0000-000000000000').gte('vencimento', m0).lte('vencimento', m1))
  ]);
  if (!alive()) return;
  const profs = state.profissionais;
  const linhas = profs.map((p) => {
    const fat = sum(recs.filter((r) => r.profissional_id === p.id));
    const com = Math.round(fat * (+p.comissao_pct || 0)) / 100;
    const lancado = sum(pagas.filter((r) => r.profissional_id === p.id));
    return { p, fat, com, lancado };
  }).filter((l) => l.fat > 0 || l.p.ativo);

  body.innerHTML = !profs.length
    ? `<div class="card empty">${icon('percent')}<p>Cadastre profissionais em <b>Mais → Profissionais</b> com o percentual de comissão.</p><a class="btn soft" href="#/mais/profissionais">Cadastrar profissionais</a></div>`
    : `<p class="small muted" style="margin-top:0">Calculado sobre os recebimentos pagos no mês vinculados a cada profissional.</p>
      <div class="stack">${linhas.map((l) => `
        <div class="card">
          <div class="row between"><div class="li-title">${esc(l.p.nome)}</div><span class="chip">${(+l.p.comissao_pct || 0).toLocaleString('pt-BR')}%</span></div>
          <dl class="kv mt-s"><dt>Faturamento</dt><dd class="num">${money(l.fat)}</dd><dt>Comissão</dt><dd class="num"><b>${money(l.com)}</b></dd><dt>Já lançado</dt><dd class="num">${money(l.lancado)}</dd></dl>
          ${l.com - l.lancado > 0.009 ? `<button class="btn sm primary mt" data-p="${l.p.id}">Lançar comissão de ${money(l.com - l.lancado)}</button>` : l.com > 0 ? '<span class="chip pago mt-s">Comissão lançada</span>' : ''}
        </div>`).join('')}</div>`;
  body.querySelectorAll('[data-p]').forEach((b) => (b.onclick = async () => {
    const l = linhas.find((x) => x.p.id === b.dataset.p);
    const r = await openLancamentoForm(null, {
      tipo: 'despesa', descricao: `Comissão ${monthName(ref)} — ${l.p.nome}`, valor: Math.round((l.com - l.lancado) * 100) / 100,
      categoria_id: catByName('Comissões', 'despesa')?.id, profissional_id: l.p.id, status: 'pendente', vencimento: ymd(endOfMonth(ref))
    });
    if (r) reload();
  }));
}
