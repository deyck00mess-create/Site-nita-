// =====================================================================
// Formulários e janelas compartilhadas entre as telas
// =====================================================================
import { sb, q, state, servicoById, profById, catByName, msgTemplate, isAdmin } from './db.js';
import {
  esc, icon, toast, openModal, confirmDialog, formData, money, parseMoney, fmtDate, fmtDateLong, fmtPhone,
  ymd, hm, today, parseYmd, addMonths, initials, firstName, openWhats, fillTemplate, debounce, age,
  STATUS_LABEL, FORMAS, MSG_LABELS, COLORS
} from './utils.js';
import { ANAMNESE, TERMO, alertasAnamnese } from './anamnese-schema.js';
import { abrirRecibo } from './docs.js';

export const AG_SELECT = '*, cliente:clientes(id,nome,telefone,data_nascimento), servico:servicos(id,nome,cor,duracao_min), profissional:profissionais(id,nome,cor), pacote:pacotes(id,nome,total_sessoes)';
const moneyVal = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');

// ---------------------------------------------------------------------
// Seleção de cliente com busca
// ---------------------------------------------------------------------
export function clientPicker(container, { selected = null, onChange } = {}) {
  let current = selected;
  container.innerHTML = `
    <div class="cp-selected ${current ? '' : 'hidden'}">
      <div class="row card flat" style="padding:10px 12px">
        <div class="avatar">${esc(initials(current?.nome))}</div>
        <div class="grow"><div class="li-title cp-name">${esc(current?.nome || '')}</div><div class="li-sub cp-phone">${esc(fmtPhone(current?.telefone))}</div></div>
        <button type="button" class="btn sm ghost cp-change">Trocar</button>
      </div>
    </div>
    <div class="cp-search ${current ? 'hidden' : ''}">
      <div class="search">${icon('search')}<input type="search" placeholder="Buscar cliente por nome ou telefone" autocomplete="off"></div>
      <div class="pick-list hidden"></div>
      <button type="button" class="btn sm soft mt-s cp-new">${icon('plus')} Nova cliente</button>
      <div class="cp-quick hidden mt-s form-grid">
        <label class="field"><span>Nome da nova cliente</span><input class="input" name="nova_nome" autocomplete="off"></label>
        <label class="field"><span>WhatsApp</span><input class="input" name="nova_tel" inputmode="tel" placeholder="(11) 99999-9999"></label>
      </div>
    </div>`;
  const input = container.querySelector('.cp-search input');
  const list = container.querySelector('.pick-list');
  const set = (c) => {
    current = c;
    container.querySelector('.cp-selected').classList.toggle('hidden', !c);
    container.querySelector('.cp-search').classList.toggle('hidden', !!c);
    if (c) {
      container.querySelector('.cp-name').textContent = c.nome;
      container.querySelector('.cp-phone').textContent = fmtPhone(c.telefone);
      container.querySelector('.avatar').textContent = initials(c.nome);
      container.querySelector('.cp-quick').classList.add('hidden');
    }
    onChange?.(c);
  };
  const search = debounce(async () => {
    const t = input.value.trim();
    if (t.length < 2) { list.classList.add('hidden'); return; }
    const digits = t.replace(/\D/g, '');
    let query = sb.from('clientes').select('id,nome,telefone,data_nascimento').eq('ativo', true).order('nome').limit(8);
    query = digits.length >= 4 ? query.ilike('telefone', `%${digits.slice(-8)}%`) : query.ilike('nome', `%${t}%`);
    const rows = await q(query);
    list.classList.remove('hidden');
    list.innerHTML = rows.length
      ? rows.map((r) => `<button type="button" class="list-item" data-id="${r.id}"><div class="avatar">${esc(initials(r.nome))}</div><div class="grow"><div class="li-title">${esc(r.nome)}</div><div class="li-sub">${esc(fmtPhone(r.telefone))}</div></div></button>`).join('')
      : '<div class="empty small">Nenhuma cliente encontrada</div>';
    list.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => set(rows.find((r) => r.id === b.dataset.id))));
  }, 220);
  input.addEventListener('input', search);
  container.querySelector('.cp-change').onclick = () => { set(null); input.value = ''; input.focus(); };
  container.querySelector('.cp-new').onclick = () => {
    const quick = container.querySelector('.cp-quick');
    quick.classList.remove('hidden');
    const n = quick.querySelector('[name=nova_nome]');
    if (input.value && !/\d{4}/.test(input.value)) n.value = input.value;
    n.focus();
  };
  return {
    get value() { return current; },
    // Retorna cliente selecionada ou cria a nova cliente rápida
    async resolve() {
      if (current) return current;
      const nome = container.querySelector('[name=nova_nome]').value.trim();
      const tel = container.querySelector('[name=nova_tel]').value.trim();
      if (!nome) return null;
      const c = await q(sb.from('clientes').insert({ nome, telefone: tel || null }).select('id,nome,telefone,data_nascimento').single());
      toast('Cliente cadastrada');
      return c;
    }
  };
}

// ---------------------------------------------------------------------
// Variáveis para mensagens de WhatsApp
// ---------------------------------------------------------------------
export function msgVars(ag = {}, extra = {}) {
  const ini = ag.inicio ? new Date(ag.inicio) : null;
  return {
    nome: firstName(ag.cliente?.nome || extra.nome),
    clinica: state.config.nome_clinica || 'Nita Reis',
    data: ini ? ini.toLocaleDateString('pt-BR') : '',
    dia: ini ? ini.toLocaleDateString('pt-BR', { weekday: 'long' }) : '',
    hora: ini ? hm(ini) : '',
    servico: ag.servico?.nome || extra.servico || 'seu atendimento',
    profissional: ag.profissional?.nome || '',
    valor: money(extra.valor ?? ag.valor),
    endereco: state.config.endereco || '',
    pix: state.config.chave_pix ? `Chave Pix: ${state.config.chave_pix}` : '',
    ...extra
  };
}

export function sendWhats(tipo, ag, extra = {}) {
  const phone = ag.cliente?.telefone ?? extra.telefone;
  return openWhats(phone, fillTemplate(msgTemplate(tipo), msgVars(ag, extra)));
}

// Menu de mensagens para um agendamento
export function whatsMenu(ag, onDone) {
  const tipos = ['confirmacao', 'lembrete', 'agradecimento', 'cobranca', 'retorno'];
  const m = openModal({
    title: `WhatsApp · ${firstName(ag.cliente?.nome)}`,
    body: `<div class="card pad-0 flat">${tipos.map((t) => `
      <button class="list-item" data-t="${t}">
        <div class="settings-ico" style="background:#25d36622;color:#1a9e4b">${icon('whats')}</div>
        <div class="grow"><div class="li-title">${MSG_LABELS[t]}</div>
        <div class="li-sub ellipsis">${esc(fillTemplate(msgTemplate(t), msgVars(ag)).replace(/\n+/g, ' '))}</div></div>
        ${t === 'confirmacao' && ag.confirmacao_enviada ? '<span class="chip concluido">enviada</span>' : ''}
        ${t === 'lembrete' && ag.lembrete_enviado ? '<span class="chip concluido">enviado</span>' : ''}
      </button>`).join('')}</div>
      <p class="tiny muted mt">As mensagens podem ser editadas em Mais → Mensagens do WhatsApp.</p>`,
    onMount(el) {
      el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = async () => {
        const t = b.dataset.t;
        if (!sendWhats(t, ag)) return;
        const patch = t === 'confirmacao' ? { confirmacao_enviada: true } : t === 'lembrete' ? { lembrete_enviado: true } : null;
        if (patch && ag.id) { await q(sb.from('agendamentos').update(patch).eq('id', ag.id)); Object.assign(ag, patch); }
        m.close(); onDone?.();
      }));
    }
  });
}

// ---------------------------------------------------------------------
// Agendamento (novo / editar)
// ---------------------------------------------------------------------
export function openAgendamentoForm({ agendamento = null, data = null, hora = null, cliente = null } = {}) {
  if (!agendamento && !state.servicos.some((s) => s.ativo)) {
    if (isAdmin()) { toast('Cadastre pelo menos um serviço antes de agendar'); location.hash = '#/mais/servicos'; }
    else toast('Nenhum serviço cadastrado. Peça à administradora para cadastrar.', 'error');
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const ag = agendamento;
    const ini = ag ? new Date(ag.inicio) : null;
    const servs = state.servicos.filter((s) => s.ativo || s.id === ag?.servico_id);
    const profs = state.profissionais.filter((p) => p.ativo || p.id === ag?.profissional_id);
    const dur = ag ? Math.round((new Date(ag.fim) - ini) / 60000) : (servs[0]?.duracao_min || 60);
    let saved = false;
    const m = openModal({
      title: ag ? 'Editar agendamento' : 'Novo agendamento',
      body: `
        <form id="ag-form" class="stack">
          <div class="field"><span class="field-label">Cliente</span><div id="ag-cliente"></div></div>
          <label class="field"><span>Serviço</span>
            <select class="input" name="servico_id" required>
              ${servs.map((s) => `<option value="${s.id}" ${s.id === ag?.servico_id ? 'selected' : ''}>${esc(s.nome)} · ${s.duracao_min} min · ${money(s.preco)}</option>`).join('')}
            </select></label>
          <div class="form-grid">
            <label class="field"><span>Data</span><input class="input" type="date" name="data" required value="${ini ? ymd(ini) : (data || today())}"></label>
            <label class="field"><span>Horário</span><input class="input" type="time" name="hora" required step="300" value="${ini ? hm(ini) : (hora || '09:00')}"></label>
            <label class="field"><span>Duração (min)</span><input class="input" type="number" name="duracao" min="5" step="5" data-type="int" value="${dur}"></label>
            <label class="field"><span>Profissional</span>
              <select class="input" name="profissional_id"><option value="">—</option>
                ${profs.map((p) => `<option value="${p.id}" ${p.id === ag?.profissional_id || (!ag && profs.length === 1) ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
              </select></label>
            <label class="field"><span>Valor (R$)${isAdmin() ? '' : ' 🔒'}</span><input class="input" name="valor" inputmode="decimal" data-type="money" ${isAdmin() ? '' : 'readonly tabindex="-1" style="background:var(--surface-2)"'} value="${moneyVal(ag ? ag.valor : servs[0]?.preco)}"></label>
            ${isAdmin() ? `<label class="field"><span>Desconto (R$)</span><input class="input" name="desconto" inputmode="decimal" data-type="money" value="${moneyVal(ag?.desconto)}"></label>` : ''}
          </div>
          <label class="field hidden" id="ag-pacote-wrap"><span>Usar sessão de pacote</span><select class="input" name="pacote_id"><option value="">Não usar pacote</option></select></label>
          ${ag ? `<label class="field"><span>Status</span><select class="input" name="status">${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === ag.status ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
          <label class="field"><span>Observações</span><textarea class="input" name="observacoes" rows="2" placeholder="Ex.: preferiu óleo sem cheiro">${esc(ag?.observacoes || '')}</textarea></label>
        </form>`,
      foot: `${ag && isAdmin() ? `<button class="btn danger" id="ag-del" style="flex:0 0 auto">${icon('trash')}</button>` : ''}
             <button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ag-save">${ag ? 'Salvar' : 'Agendar'}</button>`,
      onMount(el) {
        const form = el.querySelector('#ag-form');
        const pacoteWrap = el.querySelector('#ag-pacote-wrap');
        const pacoteSel = form.pacote_id;
        let pacotes = [];
        const loadPacotes = async (c) => {
          pacoteWrap.classList.add('hidden');
          if (!c) return;
          pacotes = (await q(sb.from('pacotes').select('id,nome,total_sessoes,servico_id,validade,agendamentos(id,status)').eq('cliente_id', c.id).eq('status', 'ativo')))
            .map((p) => ({ ...p, usadas: (p.agendamentos || []).filter((a) => !['cancelado', 'faltou'].includes(a.status) && a.id !== ag?.id).length }));
          const ok = pacotes.filter((p) => (p.usadas < p.total_sessoes && !(p.validade && p.validade < today())) || p.id === ag?.pacote_id);
          if (!ok.length) return;
          pacoteSel.innerHTML = '<option value="">Não usar pacote</option>' + ok.map((p) =>
            `<option value="${p.id}" ${p.id === ag?.pacote_id ? 'selected' : ''}>${esc(p.nome)} (${p.usadas}/${p.total_sessoes} usadas)</option>`).join('');
          pacoteWrap.classList.remove('hidden');
          if (!ag) { const match = ok.find((p) => p.servico_id === form.servico_id.value); if (match) { pacoteSel.value = match.id; form.valor.value = '0,00'; } }
        };
        const picker = clientPicker(el.querySelector('#ag-cliente'), { selected: ag?.cliente || cliente, onChange: loadPacotes });
        if (ag?.cliente || cliente) loadPacotes(ag?.cliente || cliente);
        form.servico_id.onchange = () => {
          const s = servicoById(form.servico_id.value);
          if (s) { form.duracao.value = s.duracao_min; if (!pacoteSel.value) form.valor.value = moneyVal(s.preco); }
        };
        pacoteSel.onchange = () => {
          if (pacoteSel.value) form.valor.value = '0,00';
          else form.valor.value = moneyVal(servicoById(form.servico_id.value)?.preco);
        };
        el.querySelector('#ag-del')?.addEventListener('click', async () => {
          if (!(await confirmDialog('Excluir este agendamento? Se ele só foi desmarcado, prefira mudar o status para "Cancelado".', { ok: 'Excluir', danger: true }))) return;
          await q(sb.from('agendamentos').delete().eq('id', ag.id));
          toast('Agendamento excluído'); saved = true; m.close(); resolve(true);
        });
        el.querySelector('#ag-save').onclick = async (ev) => {
          const btn = ev.currentTarget;
          if (!form.reportValidity()) return;
          btn.disabled = true;
          try {
            const c = await picker.resolve();
            if (!c) { toast('Selecione ou cadastre a cliente', 'error'); btn.disabled = false; return; }
            const f = formData(form);
            const inicio = new Date(`${f.data}T${f.hora}`);
            const fim = new Date(inicio.getTime() + (f.duracao || 60) * 60000);
            // Conflito de horário
            const dayStart = new Date(`${f.data}T00:00`), dayEnd = new Date(`${f.data}T23:59:59`);
            let cq = sb.from('agendamentos').select('id,inicio,fim,profissional_id,cliente:clientes(nome)')
              .gte('inicio', dayStart.toISOString()).lte('inicio', dayEnd.toISOString()).not('status', 'in', '(cancelado,faltou)');
            const others = (await q(cq)).filter((o) => o.id !== ag?.id
              && (!f.profissional_id || !o.profissional_id || o.profissional_id === f.profissional_id)
              && new Date(o.inicio) < fim && new Date(o.fim) > inicio);
            if (others.length) {
              const o = others[0];
              const go = await confirmDialog(`Já existe atendimento de ${o.cliente?.nome || 'outra cliente'} às ${hm(new Date(o.inicio))} nesse horário. Agendar mesmo assim?`, { ok: 'Agendar mesmo assim' });
              if (!go) { btn.disabled = false; return; }
            }
            const row = {
              cliente_id: c.id, servico_id: f.servico_id, profissional_id: f.profissional_id || null,
              pacote_id: f.pacote_id || null, inicio: inicio.toISOString(), fim: fim.toISOString(),
              valor: f.valor || 0, desconto: isAdmin() ? (f.desconto || 0) : (ag?.desconto || 0), observacoes: f.observacoes
            };
            if (ag) row.status = f.status;
            const res = ag
              ? await q(sb.from('agendamentos').update(row).eq('id', ag.id).select(AG_SELECT).single())
              : await q(sb.from('agendamentos').insert(row).select(AG_SELECT).single());
            saved = true; m.close();
            toast(ag ? 'Agendamento atualizado' : 'Agendado com sucesso 🌸', 'success');
            if (!ag && res.cliente?.telefone) askSendConfirmation(res);
            resolve(res);
          } catch (e) { btn.disabled = false; }
        };
      }
    });
    m.onClose = () => { if (!saved) resolve(null); };
  });
}

function askSendConfirmation(ag) {
  const m = openModal({
    title: 'Avisar a cliente?',
    body: `<p style="margin-top:0">Enviar a confirmação do horário para <b>${esc(ag.cliente.nome)}</b> pelo WhatsApp?</p>
      <div class="card flat small" style="white-space:pre-wrap;background:var(--surface-2)">${esc(fillTemplate(msgTemplate('confirmacao'), msgVars(ag)))}</div>`,
    foot: `<button class="btn ghost" data-close>Agora não</button><button class="btn whats" id="send">${icon('whats')} Enviar</button>`,
    onMount(el) {
      el.querySelector('#send').onclick = async () => {
        if (sendWhats('confirmacao', ag)) await q(sb.from('agendamentos').update({ confirmacao_enviada: true }).eq('id', ag.id));
        m.close();
      };
    }
  });
}

// ---------------------------------------------------------------------
// Concluir atendimento + registrar pagamento
// ---------------------------------------------------------------------
export async function openConcluir(ag) {
  // Procura recebimento já lançado para este atendimento ou para a cliente no mesmo dia (evita duplicar)
  const dia = ymd(new Date(ag.inicio));
  let jaLancado = [];
  try {
    const [porAg, porCli] = await Promise.all([
      q(sb.from('lancamentos').select('id,descricao,valor,status,agendamento_id').eq('agendamento_id', ag.id)),
      q(sb.from('lancamentos').select('id,descricao,valor,status,agendamento_id,cliente_id').eq('tipo', 'receita').is('agendamento_id', null).eq('vencimento', dia))
    ]);
    const nome = (ag.cliente?.nome || '').toLowerCase();
    jaLancado = [...porAg, ...porCli.filter((l) => l.cliente_id === ag.cliente_id || (nome && l.descricao.toLowerCase().includes(nome)))];
  } catch {}
  return new Promise((resolve) => {
    let ok = false;
    const total = Math.max(0, (Number(ag.valor) || 0) - (Number(ag.desconto) || 0));
    const usaPacote = !!ag.pacote_id;
    const m = openModal({
      title: 'Concluir atendimento',
      body: `
        <div class="row card flat" style="background:var(--surface-2);border:none">
          <div class="avatar">${esc(initials(ag.cliente?.nome))}</div>
          <div class="grow"><div class="li-title">${esc(ag.cliente?.nome)}</div><div class="li-sub">${esc(ag.servico?.nome || '')} · ${hm(new Date(ag.inicio))}</div></div>
        </div>
        <form id="cc-form" class="stack mt">
          ${usaPacote ? `<div class="chip confirmado" style="white-space:normal">${icon('box')} Sessão do pacote “${esc(ag.pacote?.nome || '')}”${total > 0 ? ' + valor adicional' : ' — sem cobrança'}</div>` : ''}
          <div class="form-grid">
            <label class="field"><span>Valor a receber (R$)${isAdmin() ? '' : ' 🔒'}</span><input class="input" name="valor" inputmode="decimal" data-type="money" ${isAdmin() ? '' : 'readonly tabindex="-1" style="background:var(--surface-2)"'} value="${moneyVal(total)}"></label>
            <label class="field ${jaLancado.length ? 'full' : ''}"><span>Situação</span><select class="input" name="status">
              ${jaLancado.map((l) => `<option value="link:${l.id}">Já lançado · ${esc(money(l.valor))} · ${l.status === 'pago' ? 'pago' : 'pendente'}</option>`).join('')}
              <option value="pago">Pago agora</option><option value="pendente">Fica pendente</option></select></label>
          </div>
          ${jaLancado.length ? `<div class="small" style="background:var(--warning-soft);color:var(--warning);border-radius:12px;padding:10px 12px">
            Já existe um recebimento de <b>${esc(money(jaLancado[0].valor))}</b> (“${esc(jaLancado[0].descricao)}”). Ele será vinculado a este atendimento, sem lançar de novo.</div>` : ''}
          <div class="field"><span class="field-label">Forma de pagamento</span>
            <div class="check-grid">${Object.entries(FORMAS).filter(([k]) => k !== 'boleto').map(([k, v], i) =>
              `<label class="check"><input type="radio" name="forma" value="${k}" ${i === 0 ? 'checked' : ''}>${v}</label>`).join('')}</div></div>
          <label class="field"><span>Anotação da sessão (opcional · vai para a evolução da cliente)</span>
            <textarea class="input" name="evolucao" rows="3" placeholder="Ex.: tensão forte em trapézio, melhorou após 20 min. Indicar 1x por semana."></textarea></label>
        </form>`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="cc-ok">${icon('check')} Concluir</button>`,
      onMount(el) {
        const ccf = el.querySelector('#cc-form');
        const syncLink = () => {
          const link = String(ccf.status.value).startsWith('link:');
          ccf.valor.closest('.field').classList.toggle('hidden', link);
          ccf.querySelector('.check-grid').closest('.field').classList.toggle('hidden', link);
        };
        ccf.status.onchange = syncLink; syncLink();
        el.querySelector('#cc-ok').onclick = async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          const f = formData(el.querySelector('#cc-form'));
          let lanc = null;
          try {
            if (String(f.status).startsWith('link:')) {
              // Vincula o recebimento já existente a este atendimento e à cliente
              lanc = await q(sb.from('lancamentos').update({ agendamento_id: ag.id, cliente_id: ag.cliente_id, profissional_id: ag.profissional_id || null }).eq('id', f.status.slice(5)).select().single());
            } else if (f.valor > 0) {
              const exists = await q(sb.from('lancamentos').select('id').eq('agendamento_id', ag.id).limit(1));
              const row = {
                tipo: 'receita', descricao: `${ag.servico?.nome || 'Atendimento'} — ${ag.cliente?.nome || ''}`.trim(),
                valor: f.valor, categoria_id: catByName('Atendimentos', 'receita')?.id || null, forma_pagamento: f.forma,
                status: f.status, vencimento: dia, data_pagamento: f.status === 'pago' ? today() : null,
                cliente_id: ag.cliente_id, agendamento_id: ag.id, profissional_id: ag.profissional_id || null
              };
              lanc = exists.length
                ? await q(sb.from('lancamentos').update(row).eq('id', exists[0].id).select().single())
                : await q(sb.from('lancamentos').insert(row).select().single());
            }
            // Só marca como concluído depois que o financeiro foi gravado
            await q(sb.from('agendamentos').update({ status: 'concluido' }).eq('id', ag.id));
            if (f.evolucao) await q(sb.from('evolucoes').insert({ cliente_id: ag.cliente_id, agendamento_id: ag.id, data: ymd(new Date(ag.inicio)), texto: f.evolucao }));
            ok = true; m.close();
            toast('Atendimento concluído ✨', 'success');
            const podeRecibo = lanc && lanc.status === 'pago';
            if (ag.cliente?.telefone || podeRecibo) {
              const t = openModal({
                title: 'Atendimento concluído ✨',
                body: `<p style="margin-top:0">O que deseja enviar para <b>${esc(firstName(ag.cliente?.nome))}</b>?</p>
                  <div class="stack">
                    ${ag.cliente?.telefone ? `<button class="btn whats block" id="ty">${icon('whats')} Mensagem de agradecimento</button>` : ''}
                    ${podeRecibo ? `<button class="btn soft block" id="rc">${icon('file')} Recibo em PDF (${esc(money(lanc.valor))})</button>` : ''}
                  </div>`,
                foot: `<button class="btn ghost" data-close>Agora não</button>`,
                onMount(e2) {
                  e2.querySelector('#ty')?.addEventListener('click', () => { sendWhats('agradecimento', ag); e2.querySelector('#ty').innerHTML = `${icon('check')} Agradecimento aberto no WhatsApp`; });
                  e2.querySelector('#rc')?.addEventListener('click', () => { t.close(); abrirRecibo({ ...lanc, cliente: ag.cliente }); });
                }
              });
            }
            resolve(true);
          } catch { btn.disabled = false; }
        };
      }
    });
    m.onClose = () => { if (!ok) resolve(false); };
  });
}

// ---------------------------------------------------------------------
// Cliente (cadastro / edição)
// ---------------------------------------------------------------------
export function openClienteForm(cliente = null) {
  return new Promise((resolve) => {
    let ok = false;
    const c = cliente || {};
    const m = openModal({
      title: cliente ? 'Editar cliente' : 'Nova cliente',
      body: `
        <form id="cl-form" class="form-grid collapse">
          <label class="field full"><span>Nome completo *</span><input class="input" name="nome" required value="${esc(c.nome || '')}" autocomplete="off"></label>
          <label class="field"><span>WhatsApp</span><input class="input" name="telefone" inputmode="tel" placeholder="(11) 99999-9999" value="${esc(fmtPhone(c.telefone))}"></label>
          <label class="field"><span>Data de nascimento</span><input class="input" type="date" name="data_nascimento" value="${esc(c.data_nascimento || '')}"></label>
          <label class="field"><span>E-mail</span><input class="input" type="email" name="email" value="${esc(c.email || '')}"></label>
          <label class="field"><span>CPF</span><input class="input" name="cpf" inputmode="numeric" value="${esc(c.cpf || '')}"></label>
          <label class="field"><span>Sexo</span><select class="input" name="sexo"><option value="">—</option>${['Feminino', 'Masculino', 'Outro'].map((s) => `<option ${s === c.sexo ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label class="field"><span>Profissão</span><input class="input" name="profissao" value="${esc(c.profissao || '')}"></label>
          <label class="field full"><span>Endereço</span><input class="input" name="endereco" value="${esc(c.endereco || '')}"></label>
          <label class="field full"><span>Como conheceu a clínica?</span><select class="input" name="como_conheceu"><option value="">—</option>${['Instagram', 'Indicação', 'Google', 'WhatsApp', 'Passou na frente', 'Outro'].map((s) => `<option ${s === c.como_conheceu ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label class="field full"><span>Observações</span><textarea class="input" name="observacoes" rows="2">${esc(c.observacoes || '')}</textarea></label>
        </form>`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="cl-save">Salvar</button>`,
      onMount(el) {
        el.querySelector('#cl-save').onclick = async (ev) => {
          const btn = ev.currentTarget;
          const form = el.querySelector('#cl-form');
          if (!form.reportValidity()) return;
          btn.disabled = true;
          const f = formData(form);
          f.telefone = f.telefone ? f.telefone.replace(/\D/g, '') : null;
          try {
            const res = cliente
              ? await q(sb.from('clientes').update(f).eq('id', cliente.id).select().single())
              : await q(sb.from('clientes').insert(f).select().single());
            ok = true; m.close(); toast('Cliente salva', 'success'); resolve(res);
          } catch { btn.disabled = false; }
        };
      }
    });
    m.onClose = () => { if (!ok) resolve(null); };
  });
}

// ---------------------------------------------------------------------
// Lançamento financeiro (receita / despesa)
// ---------------------------------------------------------------------
export function openLancamentoForm(lanc = null, defaults = {}) {
  const admin = isAdmin();
  if (!admin) defaults = { categoria_id: catByName('Atendimentos', 'receita')?.id, ...defaults, tipo: 'receita' };
  return new Promise((resolve) => {
    let ok = false;
    const l = lanc || { tipo: 'receita', status: 'pago', vencimento: today(), ...defaults };
    const catOpts = (tipo) => state.categorias.filter((c) => c.tipo === tipo)
      .map((c) => `<option value="${c.id}" ${c.id === l.categoria_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
    const m = openModal({
      title: lanc ? 'Editar lançamento' : admin ? 'Novo lançamento' : 'Registrar recebimento',
      body: `
        <form id="lc-form" class="stack">
          ${admin ? '' : '<input type="hidden" name="tipo" value="receita">'}
          <div class="seg ${admin ? '' : 'hidden'}" style="align-self:flex-start">
            <label><input type="radio" name="tipo" value="receita" ${l.tipo === 'receita' ? 'checked' : ''}><span>Receita</span></label>
            <label><input type="radio" name="tipo" value="despesa" ${l.tipo === 'despesa' ? 'checked' : ''}><span>Despesa</span></label>
          </div>
          <label class="field"><span>Descrição *</span><input class="input" name="descricao" required value="${esc(l.descricao || '')}" placeholder="${admin ? 'Ex.: Aluguel da sala, Óleo de massagem…' : 'Ex.: Drenagem — Maria'}"></label>
          ${defaults.cliente_id ? '' : `<div class="field ${l.tipo === 'receita' ? '' : 'hidden'}" id="lc-cli-wrap"><span class="field-label">Cliente (opcional — aparece no histórico dela)</span><div id="lc-cli"></div></div>`}
          <div class="form-grid">
            <label class="field"><span>Valor (R$) *</span><input class="input" name="valor" inputmode="decimal" data-type="money" required value="${l.valor != null ? moneyVal(l.valor) : ''}" placeholder="0,00"></label>
            <label class="field ${admin ? '' : 'hidden'}"><span>Categoria</span><select class="input" name="categoria_id"><option value="">—</option>${catOpts(l.tipo)}</select></label>
            <label class="field"><span>Situação</span><select class="input" name="status"><option value="pago" ${l.status === 'pago' ? 'selected' : ''}>Pago / recebido</option><option value="pendente" ${l.status === 'pendente' ? 'selected' : ''}>Pendente</option></select></label>
            <label class="field"><span>Forma de pagamento</span><select class="input" name="forma_pagamento"><option value="">—</option>${Object.entries(FORMAS).map(([k, v]) => `<option value="${k}" ${k === l.forma_pagamento ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="field"><span>Vencimento</span><input class="input" type="date" name="vencimento" required value="${esc(l.vencimento || today())}"></label>
            <label class="field"><span>Data do pagamento</span><input class="input" type="date" name="data_pagamento" value="${esc(l.data_pagamento || (l.status === 'pago' && !lanc ? today() : ''))}"></label>
            <label class="field ${admin ? '' : 'hidden'}"><span>Profissional (comissão)</span><select class="input" name="profissional_id"><option value="">—</option>${state.profissionais.map((p) => `<option value="${p.id}" ${p.id === l.profissional_id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
            ${lanc || !admin ? '' : `<label class="field"><span>Repetir</span><select class="input" name="repetir">
                <option value="">Não repetir</option>
                <option value="parc">Parcelar (dividir o valor)</option>
                <option value="mensal">Repetir todo mês (mesmo valor)</option></select></label>
              <label class="field hidden" id="lc-n"><span>Quantidade</span><input class="input" type="number" name="vezes" min="2" max="48" value="2" data-type="int"></label>`}
          </div>
          <label class="field"><span>Observações</span><textarea class="input" name="observacoes" rows="2">${esc(l.observacoes || '')}</textarea></label>
        </form>`,
      foot: `${lanc && admin ? `<button class="btn danger" id="lc-del" style="flex:0 0 auto">${icon('trash')}</button>` : ''}
        ${lanc && lanc.tipo === 'receita' && lanc.status === 'pago' ? `<button class="btn soft" id="lc-rec" style="flex:0 0 auto" aria-label="Recibo">${icon('file')} Recibo</button>` : ''}
        <button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="lc-save">Salvar</button>`,
      onMount(el) {
        const form = el.querySelector('#lc-form');
        const cliBox = el.querySelector('#lc-cli');
        const picker = cliBox ? clientPicker(cliBox, { selected: lanc?.cliente_id ? { id: lanc.cliente_id, nome: lanc.cliente?.nome || 'Cliente', telefone: lanc.cliente?.telefone } : null }) : null;
        form.querySelectorAll('[name=tipo]').forEach((r) => (r.onchange = () => {
          form.categoria_id.innerHTML = '<option value="">—</option>' + catOpts(form.tipo.value);
          el.querySelector('#lc-cli-wrap')?.classList.toggle('hidden', form.tipo.value !== 'receita');
        }));
        form.status.onchange = () => { if (form.status.value === 'pago' && !form.data_pagamento.value) form.data_pagamento.value = today(); if (form.status.value === 'pendente') form.data_pagamento.value = ''; };
        form.repetir?.addEventListener('change', () => el.querySelector('#lc-n').classList.toggle('hidden', !form.repetir.value));
        el.querySelector('#lc-rec')?.addEventListener('click', () => { abrirRecibo(lanc); });
        el.querySelector('#lc-del')?.addEventListener('click', async () => {
          if (!(await confirmDialog('Excluir este lançamento?', { ok: 'Excluir', danger: true }))) return;
          await q(sb.from('lancamentos').delete().eq('id', lanc.id));
          ok = true; m.close(); toast('Lançamento excluído'); resolve(true);
        });
        el.querySelector('#lc-save').onclick = async (ev) => {
          const btn = ev.currentTarget;
          if (!form.reportValidity()) return;
          const f = formData(form);
          if (!(f.valor > 0)) { toast('Informe o valor', 'error'); return; }
          btn.disabled = true;
          const { repetir, vezes } = f; delete f.repetir; delete f.vezes; delete f.nova_nome; delete f.nova_tel;
          if (f.status === 'pago' && !f.data_pagamento) f.data_pagamento = today();
          if (f.status === 'pendente') f.data_pagamento = null;
          const base = { ...defaults, ...f, profissional_id: f.profissional_id || null, categoria_id: f.categoria_id || null, forma_pagamento: f.forma_pagamento || null };
          try {
            if (picker) {
              const c = f.tipo === 'receita' ? await picker.resolve() : null;
              base.cliente_id = c?.id || null;
            }
            if (lanc) await q(sb.from('lancamentos').update(base).eq('id', lanc.id));
            else if (repetir && vezes > 1) {
              const rows = [];
              const venc0 = parseYmd(f.vencimento);
              const valorParc = repetir === 'parc' ? Math.round((f.valor / vezes) * 100) / 100 : f.valor;
              for (let i = 0; i < vezes; i++) {
                const v = repetir === 'parc' && i === vezes - 1 ? Math.round((f.valor - valorParc * (vezes - 1)) * 100) / 100 : valorParc;
                rows.push({ ...base, valor: v, vencimento: ymd(addMonths(venc0, i)), parcela: `${i + 1}/${vezes}`,
                  status: i === 0 ? base.status : 'pendente', data_pagamento: i === 0 ? base.data_pagamento : null });
              }
              await q(sb.from('lancamentos').insert(rows));
            } else {
              const novo = await q(sb.from('lancamentos').insert(base).select().single());
              if (novo?.tipo === 'receita' && novo.status === 'pago' && novo.cliente_id) setTimeout(() => ofertarRecibo(novo), 250);
            }
            ok = true; m.close(); toast('Lançamento salvo', 'success'); resolve(true);
          } catch { btn.disabled = false; }
        };
      }
    });
    m.onClose = () => { if (!ok) resolve(null); };
  });
}

// ---------------------------------------------------------------------
// Pacote de sessões
// ---------------------------------------------------------------------
export function openPacoteForm(cliente) {
  return new Promise((resolve) => {
    let ok = false;
    const servs = state.servicos.filter((s) => s.ativo);
    const m = openModal({
      title: 'Novo pacote',
      body: `
        <form id="pc-form" class="form-grid">
          <label class="field full"><span>Serviço</span><select class="input" name="servico_id">${servs.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join('')}</select></label>
          <label class="field"><span>Nº de sessões</span><input class="input" type="number" name="total_sessoes" min="1" value="10" data-type="int"></label>
          <label class="field"><span>Valor total (R$)</span><input class="input" name="valor" inputmode="decimal" data-type="money"></label>
          <label class="field full"><span>Nome do pacote</span><input class="input" name="nome" required></label>
          <label class="field"><span>Validade</span><input class="input" type="date" name="validade" value="${ymd(addMonths(new Date(), 6))}"></label>
          <label class="field"><span>Pagamento</span><select class="input" name="pg"><option value="pago">Pago à vista</option><option value="pendente">Pendente</option><option value="parc">Parcelado</option></select></label>
          <label class="field"><span>Forma</span><select class="input" name="forma">${Object.entries(FORMAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label class="field hidden" id="pc-n"><span>Parcelas</span><input class="input" type="number" name="vezes" min="2" max="24" value="3" data-type="int"></label>
        </form>`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="pc-save">Criar pacote</button>`,
      onMount(el) {
        const form = el.querySelector('#pc-form');
        const upd = () => {
          const s = servicoById(form.servico_id.value); const n = Number(form.total_sessoes.value) || 1;
          form.nome.value = `Pacote ${n}x ${s?.nome || ''}`.trim();
          form.valor.value = moneyVal((s?.preco || 0) * n * 0.9);
        };
        form.servico_id.onchange = upd; form.total_sessoes.oninput = upd; upd();
        form.pg.onchange = () => el.querySelector('#pc-n').classList.toggle('hidden', form.pg.value !== 'parc');
        el.querySelector('#pc-save').onclick = async (ev) => {
          const btn = ev.currentTarget;
          if (!form.reportValidity()) return;
          const f = formData(form);
          btn.disabled = true;
          try {
            const p = await q(sb.from('pacotes').insert({ cliente_id: cliente.id, servico_id: f.servico_id, nome: f.nome, total_sessoes: f.total_sessoes, valor: f.valor, validade: f.validade }).select().single());
            if (f.valor > 0) {
              const n = f.pg === 'parc' ? Math.max(2, f.vezes || 2) : 1;
              const parc = Math.round((f.valor / n) * 100) / 100;
              const rows = [];
              for (let i = 0; i < n; i++) {
                const pago = f.pg === 'pago' || (f.pg === 'parc' && i === 0);
                rows.push({
                  tipo: 'receita', descricao: `${f.nome} — ${cliente.nome}`, valor: i === n - 1 ? Math.round((f.valor - parc * (n - 1)) * 100) / 100 : parc,
                  categoria_id: catByName('Pacotes', 'receita')?.id || null, forma_pagamento: f.forma, status: pago ? 'pago' : 'pendente',
                  vencimento: ymd(addMonths(new Date(), i)), data_pagamento: pago ? today() : null,
                  cliente_id: cliente.id, pacote_id: p.id, parcela: n > 1 ? `${i + 1}/${n}` : null
                });
              }
              await q(sb.from('lancamentos').insert(rows));
            }
            ok = true; m.close(); toast('Pacote criado 🎁', 'success'); resolve(p);
          } catch { btn.disabled = false; }
        };
      }
    });
    m.onClose = () => { if (!ok) resolve(null); };
  });
}

// ---------------------------------------------------------------------
// Ficha de anamnese (preencher / ver / imprimir)
// ---------------------------------------------------------------------
function campoHtml(c, d) {
  const v = d[c.id];
  switch (c.type) {
    case 'yn': return `
      <div class="yn"><div class="grow"><div class="yn-label">${esc(c.label)}</div>
        ${c.detalhe ? `<input class="input mt-s ${v === 'sim' ? '' : 'hidden'}" name="${c.id}_det" placeholder="${esc(c.placeholder || 'Detalhes')}" value="${esc(d[c.id + '_det'] || '')}">` : ''}</div>
        <div class="seg"><label><input type="radio" name="${c.id}" value="nao" ${v !== 'sim' ? 'checked' : ''}><span>Não</span></label><label><input type="radio" name="${c.id}" value="sim" ${v === 'sim' ? 'checked' : ''}><span>Sim</span></label></div>
      </div>`;
    case 'multi': return `<div class="field"><span class="field-label">${esc(c.label)}</span><div class="check-grid">
      ${c.options.map((o) => `<label class="check"><input type="checkbox" data-multi="1" name="${c.id}" value="${esc(o)}" ${(v || []).includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div></div>`;
    case 'select': return `<label class="field"><span>${esc(c.label)}</span><select class="input" name="${c.id}"><option value="">—</option>${c.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    case 'scale': return `<label class="field"><span>${esc(c.label)}: <b class="scale-out">${v ?? 0}</b></span><input type="range" name="${c.id}" min="${c.min}" max="${c.max}" value="${v ?? 0}" style="accent-color:var(--primary)"></label>`;
    case 'textarea': return `<label class="field"><span>${esc(c.label)}</span><textarea class="input" name="${c.id}" rows="2" placeholder="${esc(c.placeholder || '')}">${esc(v || '')}</textarea></label>`;
    default: return `<label class="field"><span>${esc(c.label)}</span><input class="input" name="${c.id}" value="${esc(v || '')}"></label>`;
  }
}

function signaturePad(wrap) {
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let drawing = false, dirty = false, last = null;
  const resize = () => {
    const r = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr; ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#2d1b24';
  };
  setTimeout(resize, 50);
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); wrap.querySelector('.sig-hint')?.remove(); });
  canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; dirty = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => canvas.addEventListener(t, () => (drawing = false)));
  return {
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
    get empty() { return !dirty; },
    toDataURL() { return dirty ? canvas.toDataURL('image/png') : null; }
  };
}

export function openAnamneseForm(cliente, anamnese = null) {
  return new Promise((resolve) => {
    let ok = false;
    const d = anamnese?.dados || {};
    const m = openModal({
      title: anamnese ? 'Editar anamnese' : 'Ficha de anamnese',
      wide: true,
      body: `
        <div class="row mb"><div class="avatar">${esc(initials(cliente.nome))}</div><div><div class="li-title">${esc(cliente.nome)}</div><div class="li-sub">${cliente.data_nascimento ? `${age(cliente.data_nascimento)} anos · ` : ''}${esc(fmtPhone(cliente.telefone))}</div></div></div>
        <form id="an-form">
          <label class="field mb" style="max-width:220px"><span>Data da avaliação</span><input class="input" type="date" name="__data" value="${esc(anamnese?.data || today())}"></label>
          ${ANAMNESE.map((s) => `<section class="anam-section card flat"><h4>${esc(s.titulo)}</h4><div class="stack">${s.campos.map((c) => campoHtml(c, d)).join('')}</div></section>`).join('')}
          <section class="anam-section card flat">
            <h4>Termo de responsabilidade</h4>
            <p class="small" style="margin-top:0">${esc(TERMO)}</p>
            ${anamnese?.assinatura ? `<div class="mb"><span class="tiny muted">Assinatura registrada:</span><br><img class="sig-img" src="${anamnese.assinatura}" alt="Assinatura"></div>` : ''}
            <div class="sig-wrap"><canvas></canvas><div class="sig-hint">${anamnese?.assinatura ? 'Assine aqui para substituir' : 'Assinatura da cliente (use o dedo)'}</div></div>
            <button type="button" class="btn sm ghost mt-s" id="sig-clear">Limpar assinatura</button>
          </section>
        </form>`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="an-save">Salvar ficha</button>`,
      onMount(el) {
        const form = el.querySelector('#an-form');
        const pad = signaturePad(el.querySelector('.sig-wrap'));
        el.querySelector('#sig-clear').onclick = () => pad.clear();
        form.addEventListener('change', (e) => {
          if (e.target.type === 'radio' && e.target.closest('.yn')) {
            const det = e.target.closest('.yn').querySelector('input.input');
            det?.classList.toggle('hidden', e.target.value !== 'sim');
            if (e.target.value === 'sim') det?.focus();
          }
        });
        form.addEventListener('input', (e) => { if (e.target.type === 'range') e.target.closest('.field').querySelector('.scale-out').textContent = e.target.value; });
        el.querySelector('#an-save').onclick = async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          const dados = formData(form);
          const data = dados.__data || today(); delete dados.__data;
          if (dados.intensidade_dor != null) dados.intensidade_dor = Number(dados.intensidade_dor);
          const row = { cliente_id: cliente.id, data, dados };
          const sig = pad.toDataURL(); if (sig) row.assinatura = sig;
          try {
            const res = anamnese
              ? await q(sb.from('anamneses').update(row).eq('id', anamnese.id).select().single())
              : await q(sb.from('anamneses').insert(row).select().single());
            ok = true; m.close(); toast('Ficha de anamnese salva 📋', 'success'); resolve(res);
          } catch { btn.disabled = false; }
        };
      }
    });
    m.onClose = () => { if (!ok) resolve(null); };
  });
}

export function anamneseHtml(an, cliente, { print = false, alertas: showAlerts = true } = {}) {
  const d = an.dados || {};
  const alertas = alertasAnamnese(d);
  const valor = (c) => {
    const v = d[c.id];
    if (c.type === 'yn') return v === 'sim' ? `<b class="text-danger">Sim</b>${d[c.id + '_det'] ? ` — ${esc(d[c.id + '_det'])}` : ''}` : 'Não';
    if (c.type === 'multi') return (v || []).length ? esc(v.join(', ')) : '—';
    if (v === null || v === undefined || v === '') return '—';
    return esc(String(v)).replace(/\n/g, '<br>');
  };
  return `
    ${print ? `<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #e05a8d;padding-bottom:8px;margin-bottom:12px">
      <div><h1>${esc(state.config.nome_clinica || 'Nita Reis')}</h1><div>Ficha de Anamnese</div></div>
      <div style="text-align:right;font-size:12px">${esc(state.config.telefone ? fmtPhone(state.config.telefone) : '')}<br>${esc(state.config.endereco || '')}</div></div>
      <dl class="kv" style="margin-bottom:14px"><dt>Cliente</dt><dd>${esc(cliente.nome)}</dd><dt>Nascimento</dt><dd>${fmtDate(cliente.data_nascimento)}${cliente.data_nascimento ? ` (${age(cliente.data_nascimento)} anos)` : ''}</dd><dt>Telefone</dt><dd>${esc(fmtPhone(cliente.telefone))}</dd><dt>Data da avaliação</dt><dd>${fmtDate(an.data)}</dd></dl>` : ''}
    ${showAlerts && alertas.length ? `<div class="card flat mb" style="background:var(--danger-soft);border-color:transparent"><div class="row" style="color:var(--danger);font-weight:700;margin-bottom:6px">${icon('alert')} Atenção</div><div class="alert-list">${alertas.map((a) => `<span class="chip cancelado" style="white-space:normal">${esc(a)}</span>`).join('')}</div></div>` : ''}
    ${ANAMNESE.map((s) => `<div class="anam-section"><h4>${esc(s.titulo)}</h4><dl class="kv">${s.campos.map((c) => `<dt>${esc(c.label)}</dt><dd>${valor(c)}</dd>`).join('')}</dl></div>`).join('')}
    <div class="anam-section"><h4>Termo de responsabilidade</h4><p class="small">${esc(TERMO)}</p>
      ${an.assinatura ? `<img class="sig-img" src="${an.assinatura}" alt="Assinatura"><div class="tiny muted">${esc(cliente.nome)} · ${fmtDate(an.data)}</div>` : '<p class="muted small">Sem assinatura registrada.</p>'}</div>`;
}

export function printHtml(html) {
  let area = document.getElementById('print-area');
  if (!area) { area = document.createElement('div'); area.id = 'print-area'; document.body.appendChild(area); }
  area.innerHTML = html;
  setTimeout(() => window.print(), 50);
}

export { COLORS };

// Depois de registrar um recebimento pago, oferece o recibo
export function ofertarRecibo(lanc) {
  const t = openModal({
    title: 'Recebimento registrado ✓',
    body: `<p style="margin:0">Deseja gerar o <b>recibo em PDF</b> de ${esc(money(lanc.valor))} para enviar à cliente?</p>`,
    foot: `<button class="btn ghost" data-close>Agora não</button><button class="btn primary" id="rc">${icon('file')} Gerar recibo</button>`,
    onMount(el) { el.querySelector('#rc').onclick = () => { t.close(); abrirRecibo(lanc); }; }
  });
}
