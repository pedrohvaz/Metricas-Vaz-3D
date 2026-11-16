/* Financeiro (só o dono): lançamentos, contas a pagar/receber, resultado do mês e exportação. */
import { $, $$, esc, money, num, dataBR, dataIn, dataOut, hojeISO, toast, msgErro, modal, confirmar, lerForm, ocupado, opcoes, campo, vazio } from '../ui.js';
import { CATEGORIAS_FIN, FORMAS, nomeDe } from '../rotulos.js';

let mes = hojeISO().slice(0, 7), aba = 'mes';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = ym => { const [a, m] = ym.split('-'); return `${MESES[+m - 1]}/${a.slice(2)}`; };
/* datas de calendário são gravadas ao meio-dia UTC; 'created' é um instante real, convertido para o dia local */
const diaLocal = v => { const d = new Date(String(v).replace(' ', 'T')); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const refData = l => l.pago && l.data_pagamento ? l.data_pagamento.slice(0, 10) : l.vencimento ? l.vencimento.slice(0, 10) : l.created ? diaLocal(l.created) : '';
const liquido = l => l.tipo === 'entrada' ? l.valor - (l.taxa || 0) : l.valor;

export async function render(el, ctx, acoes) {
  const { pb } = ctx;
  acoes.innerHTML = `<input type="month" id="fMes" value="${mes}" aria-label="Mês"><button class="btn" type="button" id="csv">Exportar planilha</button><button class="btn btn-primary" type="button" id="novoL">+ Lançamento</button>`;
  let todos = [], projetos = [];

  async function carregar() {
    [todos, projetos] = await Promise.all([
      pb.collection('lancamentos').getFullList({ sort: '-created', expand: 'projeto,cliente' }),
      pb.collection('projetos').getFullList({ filter: 'preco > 0', fields: 'id,titulo,preco,custo_total,status,created' }),
    ]);
    desenhar();
  }

  function desenhar() {
    const hoje = hojeISO();
    const doMes = todos.filter(l => refData(l).startsWith(mes));
    const pagosMes = doMes.filter(l => l.pago);
    const recebido = pagosMes.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const taxas = pagosMes.filter(l => l.tipo === 'entrada').reduce((s, l) => s + (l.taxa || 0), 0);
    const pago = pagosMes.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0);
    const pend = todos.filter(l => !l.pago);
    const receber = pend.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const pagar = pend.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0);
    const vencidos = pend.filter(l => l.vencimento && l.vencimento.slice(0, 10) < hoje);

    // últimos 6 meses até o mês escolhido (só o que foi efetivamente pago/recebido)
    const serie = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(+mes.slice(0, 4), +mes.slice(5) - 1 - i, 15);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const pg = todos.filter(l => l.pago && (l.data_pagamento || '').startsWith(ym));
      serie.push({ ym, entradas: pg.filter(l => l.tipo === 'entrada').reduce((s, l) => s + liquido(l), 0), saidas: pg.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0) });
    }

    el.innerHTML = `<div class="kpis">
      <div class="kpi"><span>Recebido em ${nomeMes(mes)}</span><b>${money(recebido - taxas)}</b><small>${taxas ? `${money(taxas)} de taxas` : 'líquido de taxas'}</small></div>
      <div class="kpi"><span>Pago em ${nomeMes(mes)}</span><b>${money(pago)}</b></div>
      <div class="kpi ${recebido - taxas - pago >= 0 ? 'pos' : 'neg'}"><span>Resultado do mês</span><b>${money(recebido - taxas - pago)}</b></div>
      <div class="kpi"><span>A receber (total)</span><b>${money(receber)}</b></div>
      <div class="kpi"><span>A pagar (total)</span><b>${money(pagar)}</b></div>
      <div class="kpi${vencidos.length ? ' alerta' : ''}"><span>Contas vencidas</span><b>${vencidos.length}</b></div>
    </div>
    <section class="bloco">${grafico(serie, el.clientWidth - 40)}</section>
    <div class="barra"><div class="abas" role="tablist">
      ${[['mes', `Lançamentos de ${nomeMes(mes)}`], ['contas', `Contas em aberto (${pend.length})`], ['categorias', 'Por categoria'], ['projetos', 'Lucro por projeto']].map(([k, t]) => `<button type="button" role="tab" data-aba="${k}" aria-selected="${k === aba}">${t}</button>`).join('')}
    </div></div>
    <div id="fConteudo">${aba === 'mes' ? tabela(doMes, hoje) : aba === 'contas' ? tabela(pend.sort((a, b) => (a.vencimento || '9').localeCompare(b.vencimento || '9')), hoje) : aba === 'categorias' ? porCategoria(pagosMes) : lucroProjetos(projetos)}</div>`;
  }

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-aba]'); if (a) { aba = a.dataset.aba; return desenhar(); }
    const pg = e.target.closest('[data-pagar]');
    if (pg) {
      e.stopPropagation();
      try { await pb.collection('lancamentos').update(pg.dataset.pagar, { pago: true, data_pagamento: dataOut(hojeISO()) }); toast('Marcado como pago'); carregar(); } catch (err) { toast(msgErro(err), 'erro'); }
      return;
    }
    const tb = e.target.closest('[data-tabela]'); if (tb) { const t = $('#gTabela', el); t.hidden = !t.hidden; tb.textContent = t.hidden ? 'Ver em tabela' : 'Esconder tabela'; return; }
    const tr = e.target.closest('tr[data-id]'); if (tr) editar(ctx, todos.find(l => l.id === tr.dataset.id), carregar);
  });
  el.addEventListener('mousemove', e => {
    const b = e.target.closest('[data-tip]'), tip = $('#gTip', el);
    if (!tip) return;
    if (!b) { tip.hidden = true; return; }
    const box = $('.grafico', el).getBoundingClientRect();
    tip.innerHTML = b.dataset.tip; tip.hidden = false;
    tip.style.left = `${Math.min(e.clientX - box.left + 12, box.width - 170)}px`; tip.style.top = `${e.clientY - box.top - 10}px`;
  });
  $('#fMes').addEventListener('change', e => { if (e.target.value) { mes = e.target.value; desenhar(); } });
  $('#novoL').addEventListener('click', () => editar(ctx, null, carregar));
  $('#csv').addEventListener('click', () => exportar(todos.filter(l => refData(l).startsWith(mes)), mes));
  await carregar();
}

function tabela(lista, hoje) {
  if (!lista.length) return vazio('Nenhum lançamento aqui.');
  return `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th class="num">Valor</th><th>Situação</th></tr></thead><tbody>
    ${lista.map(l => {
      const venc = !l.pago && l.vencimento && l.vencimento.slice(0, 10) < hoje;
      return `<tr data-id="${l.id}" tabindex="0"><td>${dataBR(refData(l))}</td>
      <td><b>${esc(l.descricao)}</b>${l.expand?.cliente ? `<small>${esc(l.expand.cliente.nome)}</small>` : ''}</td>
      <td>${nomeDe(CATEGORIAS_FIN, l.categoria)}</td><td>${l.forma_pagamento ? nomeDe(FORMAS, l.forma_pagamento) : '—'}</td>
      <td class="num ${l.tipo === 'entrada' ? 'pos' : 'neg'}">${l.tipo === 'entrada' ? '+' : '−'} ${money(l.valor)}${l.taxa ? `<small>taxa ${money(l.taxa)}</small>` : ''}</td>
      <td>${l.pago ? `<span class="pil st-aprovado">${l.tipo === 'entrada' ? 'Recebido' : 'Pago'}</span>` : `<span class="pil ${venc ? 'st-recusado' : 'st-novo'}">${venc ? 'Vencido' : 'Em aberto'}</span> <button type="button" class="btn sm" data-pagar="${l.id}">${l.tipo === 'entrada' ? 'Recebi' : 'Paguei'}</button>`}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function porCategoria(pagos) {
  const grupos = {};
  for (const l of pagos) { const k = `${l.tipo}|${l.categoria}`; grupos[k] = (grupos[k] || 0) + liquido(l); }
  const linhas = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
  if (!linhas.length) return vazio('Nada pago ou recebido neste mês.');
  const max = Math.max(...linhas.map(x => x[1]));
  return `<div class="cat-barras">${linhas.map(([k, v]) => { const [t, c] = k.split('|'); return `<div class="cat-linha"><span>${t === 'entrada' ? 'Entrada' : 'Saída'} · ${nomeDe(CATEGORIAS_FIN, c)}</span><div class="cat-trilho"><i class="${t}" style="width:${v / max * 100}%"></i></div><b>${money(v)}</b></div>`; }).join('')}</div>`;
}

function lucroProjetos(projetos) {
  const comCusto = projetos.filter(p => p.custo_total > 0 && p.status !== 'cancelado').sort((a, b) => b.created.localeCompare(a.created)).slice(0, 60);
  if (!comCusto.length) return vazio('Calcule o custo dos projetos (botão “Calcular custo” no projeto) para ver o lucro de cada um.');
  return `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Projeto</th><th>Criado</th><th class="num">Preço</th><th class="num">Custo</th><th class="num">Lucro</th><th class="num">Margem</th></tr></thead><tbody>
    ${comCusto.map(p => { const l = p.preco - p.custo_total; return `<tr><td><a href="#/projetos/${p.id}">${esc(p.titulo)}</a></td><td>${dataBR(p.created)}</td><td class="num">${money(p.preco)}</td><td class="num">${money(p.custo_total)}</td><td class="num ${l >= 0 ? 'pos' : 'neg'}">${money(l)}</td><td class="num">${num(l / p.custo_total * 100)}%</td></tr>`; }).join('')}
  </tbody></table></div>`;
}

/* Barras agrupadas: entradas x saídas pagas, 6 meses. Cores validadas para daltonismo e contraste no fundo escuro. */
function grafico(serie, largura) {
  const W = Math.max(320, Math.round(largura || 640)), H = 240, M = { t: 16, r: 8, b: 28, l: 64 };
  const max = Math.max(1, ...serie.flatMap(s => [s.entradas, s.saidas]));
  const passo = 10 ** Math.floor(Math.log10(max));
  const topo = Math.ceil(max / passo) * passo;
  const y = v => M.t + (H - M.t - M.b) * (1 - v / topo);
  const gw = (W - M.l - M.r) / serie.length, bw = Math.min(26, gw * 0.3);
  const ticks = [0, topo / 2, topo];
  const barra = (x, v, cls, rot) => {
    const h = Math.max(0, y(0) - y(v)), r = Math.min(4, h / 2);
    const d = h ? `M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bw - r} Q${x + bw},${y(v)} ${x + bw},${y(v) + r} V${y(0)} Z` : '';
    return `<g data-tip="${esc(rot)}"><rect x="${x - 3}" y="${M.t}" width="${bw + 6}" height="${H - M.t - M.b}" fill="transparent"/>${d ? `<path class="${cls}" d="${d}"/>` : ''}</g>`;
  };
  return `<div class="bloco-head"><h2>Entradas e saídas pagas · últimos 6 meses</h2><div class="legenda"><span><i class="lg-ent"></i>Entradas (líquidas)</span><span><i class="lg-sai"></i>Saídas</span><button type="button" class="link" data-tabela>Ver em tabela</button></div></div>
  <div class="grafico"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas dos últimos 6 meses">
    ${ticks.map(t => `<line class="grade" x1="${M.l}" x2="${W - M.r}" y1="${y(t)}" y2="${y(t)}"/><text class="eixo" x="${M.l - 8}" y="${y(t) + 4}" text-anchor="end">${t >= 1000 ? `R$ ${num(t / 1000, 1)} mil` : `R$ ${num(t)}`}</text>`).join('')}
    ${serie.map((s, i) => { const cx = M.l + gw * i + gw / 2; return `${barra(cx - bw - 1, s.entradas, 'b-ent', `<b>${nomeMes(s.ym)}</b><br>Entradas: ${money(s.entradas)}<br>Saídas: ${money(s.saidas)}`)}${barra(cx + 1, s.saidas, 'b-sai', `<b>${nomeMes(s.ym)}</b><br>Entradas: ${money(s.entradas)}<br>Saídas: ${money(s.saidas)}`)}<text class="eixo" x="${cx}" y="${H - 8}" text-anchor="middle">${nomeMes(s.ym)}</text>`; }).join('')}
  </svg><div class="tip" id="gTip" hidden></div></div>
  <table class="tabela mini" id="gTabela" hidden><thead><tr><th>Mês</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Resultado</th></tr></thead><tbody>${serie.map(s => `<tr><td>${nomeMes(s.ym)}</td><td class="num">${money(s.entradas)}</td><td class="num">${money(s.saidas)}</td><td class="num">${money(s.entradas - s.saidas)}</td></tr>`).join('')}</tbody></table>`;
}

async function editar(ctx, l, aoMudar) {
  const { pb } = ctx;
  const novo = !l;
  l = l || { tipo: 'saida', categoria: 'outros', pago: true, data_pagamento: dataOut(hojeISO()), vencimento: dataOut(hojeISO()) };
  const clientes = await pb.collection('clientes').getFullList({ sort: 'nome', fields: 'id,nome' });
  const m = modal({
    titulo: novo ? 'Novo lançamento' : 'Lançamento',
    corpo: `<form class="frm" novalidate>
      <div class="fld full"><span>Tipo</span><div class="seg">
        <label><input type="radio" name="tipo" value="entrada"${l.tipo === 'entrada' ? ' checked' : ''}> Entrada (recebi)</label>
        <label><input type="radio" name="tipo" value="saida"${l.tipo === 'saida' ? ' checked' : ''}> Saída (paguei)</label></div></div>
      ${campo('Descrição', `<input name="descricao" required maxlength="200" value="${esc(l.descricao || '')}">`, { full: true })}
      ${campo('Valor (R$)', `<input name="valor" type="number" min="0" step="0.01" required value="${l.valor ?? ''}">`)}
      ${campo('Categoria', `<select name="categoria">${opcoes(CATEGORIAS_FIN, l.categoria)}</select>`)}
      ${campo('Forma de pagamento', `<select name="forma_pagamento"><option value="">—</option>${opcoes(FORMAS, l.forma_pagamento)}</select>`)}
      ${campo('Taxa da forma (R$)', `<input name="taxa" type="number" min="0" step="0.01" value="${l.taxa ?? ''}">`, { dica: 'Em entradas, vazio = calcula pela taxa configurada.' })}
      ${campo('Vencimento', `<input name="vencimento" type="date" value="${dataIn(l.vencimento)}">`)}
      ${campo('Data do pagamento', `<input name="data_pagamento" type="date" value="${dataIn(l.data_pagamento)}">`)}
      <label class="chk full"><input type="checkbox" name="pago"${l.pago ? ' checked' : ''}> Já foi pago / recebido</label>
      ${campo('Cliente', `<select name="cliente"><option value="">—</option>${clientes.map(c => `<option value="${c.id}"${c.id === l.cliente ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>`)}
      ${l.projeto ? `<p class="dica">Ligado ao projeto <a href="#/projetos/${l.projeto}">${esc(l.expand?.projeto?.titulo || 'ver')}</a>.</p>` : ''}
      ${campo('Observações', `<textarea name="obs" rows="2">${esc(l.obs || '')}</textarea>`, { full: true })}
    </form>`,
    rodape: `${!novo ? '<button type="button" class="btn btn-perigo esq" data-del>Excluir</button>' : ''}<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Salvar</button>`,
  });
  m.el.addEventListener('click', e => { if (e.target.closest('a[href^="#/"]')) m.fechar(); });
  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    if (!d.descricao || !(d.valor > 0)) return toast('Informe descrição e valor.', 'erro');
    d.vencimento = dataOut(d.vencimento);
    d.data_pagamento = d.pago ? dataOut(d.data_pagamento || hojeISO()) : '';
    if (d.taxa === '') d.taxa = 0;
    try { await ocupado(ev.target, () => novo ? pb.collection('lancamentos').create(d) : pb.collection('lancamentos').update(l.id, d)); toast('Lançamento salvo'); m.fechar(); aoMudar(); }
    catch (e) { toast(msgErro(e), 'erro'); }
  });
  m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir este lançamento?', { ok: 'Excluir', perigo: true }))) return;
    try { await pb.collection('lancamentos').delete(l.id); toast('Lançamento excluído'); m.fechar(); aoMudar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });
}

/* Planilha CSV (abre no Excel/Google Planilhas) para o contador. */
function exportar(lista, ym) {
  const cab = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Taxa', 'Líquido', 'Forma de pagamento', 'Situação', 'Vencimento', 'Cliente'];
  const v = n => String((Number(n) || 0).toFixed(2)).replace('.', ',');
  const linhas = lista.map(l => [dataBR(refData(l)), l.tipo === 'entrada' ? 'Entrada' : 'Saída', nomeDe(CATEGORIAS_FIN, l.categoria), l.descricao, v(l.valor), v(l.taxa), v(liquido(l)), l.forma_pagamento ? nomeDe(FORMAS, l.forma_pagamento) : '', l.pago ? 'Pago' : 'Em aberto', l.vencimento ? dataBR(l.vencimento) : '', l.expand?.cliente?.nome || '']);
  const csv = '﻿' + [cab, ...linhas].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `financeiro-metricas-vaz-${ym}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${lista.length} lançamentos exportados`);
}
