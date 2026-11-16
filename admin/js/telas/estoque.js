/* Estoque de filamento: carretéis, movimentações e histórico. */
import { $, $$, esc, money, num, kg, dataBR, dataIn, dataOut, dataHora, hojeISO, toast, msgErro, modal, confirmar, lerForm, ocupado, opcoes, campo, vazio } from '../ui.js';
import { MATERIAIS } from '../rotulos.js';

let aba = 'carreteis', mostrarInativos = false;

export async function render(el, ctx, acoes) {
  const { pb } = ctx;
  acoes.innerHTML = '<button class="btn btn-primary" type="button" id="novoFil">+ Carretel</button>';
  el.innerHTML = `<div class="barra"><div class="abas" role="tablist">
    <button type="button" role="tab" data-aba="carreteis" aria-selected="${aba === 'carreteis'}">Carretéis</button>
    <button type="button" role="tab" data-aba="historico" aria-selected="${aba === 'historico'}">Histórico</button></div>
    <label class="chk"><input type="checkbox" id="vInat"${mostrarInativos ? ' checked' : ''}> Mostrar carretéis acabados</label></div>
    <div id="conteudo"></div>`;

  async function carregar() {
    const alvo = $('#conteudo', el);
    if (aba === 'historico') {
      const r = await pb.collection('movimentos').getList(1, 150, { sort: '-created', expand: 'filamento,projeto,usuario' });
      alvo.innerHTML = r.items.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Carretel</th><th>Tipo</th><th class="num">Gramas</th><th>Projeto / observação</th><th>Quem</th></tr></thead><tbody>
        ${r.items.map(m => { const f = m.expand?.filamento; return `<tr><td>${dataHora(m.created)}</td><td>${f ? `<i class="cor" style="--c:${esc(f.cor_hex || '#888')}"></i>${esc(f.material)} ${esc(f.cor)}` : '—'}</td>
          <td>${{ entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' }[m.tipo]}</td><td class="num ${m.tipo === 'saida' || m.gramas < 0 ? 'neg' : 'pos'}">${m.tipo === 'saida' ? '−' : m.gramas > 0 ? '+' : ''}${num(Math.abs(m.gramas), 1)}</td>
          <td>${m.expand?.projeto ? `<a href="#/projetos/${m.projeto}">${esc(m.expand.projeto.titulo)}</a>` : esc(m.obs || '')}</td><td>${esc(m.expand?.usuario?.name || '—')}</td></tr>`; }).join('')}
      </tbody></table></div>` : vazio('Nenhuma movimentação ainda.');
      return;
    }
    const fils = await pb.collection('filamentos').getFullList({ filter: mostrarInativos ? '' : 'ativo = true', sort: 'material,cor' });
    const ativos = fils.filter(f => f.ativo);
    const porMat = {};
    let valor = 0;
    for (const f of ativos) {
      porMat[f.material] = (porMat[f.material] || 0) + f.peso_restante;
      valor += window.MVCalc.custoGrama(f) * f.peso_restante;
    }
    alvo.innerHTML = `<div class="kpis">
      ${Object.entries(porMat).map(([m, g]) => `<div class="kpi"><span>${esc(m)} em estoque</span><b>${kg(g)}</b></div>`).join('')}
      ${ctx.dono ? `<div class="kpi"><span>Valor em filamento</span><b>${money(valor)}</b></div>` : ''}
      <div class="kpi${ativos.some(f => f.peso_restante <= f.minimo) ? ' alerta' : ''}"><span>Abaixo do mínimo</span><b>${ativos.filter(f => f.peso_restante <= f.minimo).length}</b></div>
    </div>
    ${fils.length ? `<div class="carreteis">${fils.map(f => {
      const pct = f.peso_inicial ? Math.max(0, Math.min(100, f.peso_restante / f.peso_inicial * 100)) : 0;
      const baixo = f.ativo && f.peso_restante <= f.minimo;
      return `<article class="carretel${baixo ? ' baixo' : ''}${f.ativo ? '' : ' inativo'}" data-id="${f.id}">
        <div class="carretel-topo"><i class="cor grande" style="--c:${esc(f.cor_hex || '#888')}"></i><div><b>${esc(f.material)} · ${esc(f.cor)}</b><small>${esc([f.marca, f.acabamento].filter(Boolean).join(' · ') || '—')}</small></div></div>
        <div class="nivel" role="img" aria-label="${num(pct)}% restante"><span style="width:${pct}%"></span></div>
        <p class="carretel-num"><b>${kg(f.peso_restante)}</b> de ${kg(f.peso_inicial)}${baixo ? ' · <em class="atraso">repor</em>' : ''}${f.ativo ? '' : ' · acabado'}</p>
        ${ctx.dono && f.custo ? `<small>${money(window.MVCalc.custoGrama(f) * 1000)}/kg · comprado ${dataBR(f.data_compra)}</small>` : ''}
        <div class="carretel-acoes"><button type="button" class="btn sm" data-mov="${f.id}">Movimentar</button><button type="button" class="btn sm" data-ed="${f.id}">Editar</button></div>
      </article>`;
    }).join('')}</div>` : vazio('Nenhum carretel cadastrado.', '<button class="btn btn-primary" type="button" data-novo>Cadastrar o primeiro carretel</button>')}`;
    alvo._fils = Object.fromEntries(fils.map(f => [f.id, f]));
  }

  el.addEventListener('click', e => {
    const a = e.target.closest('[data-aba]');
    if (a) { aba = a.dataset.aba; $$('[data-aba]', el).forEach(b => b.setAttribute('aria-selected', b === a)); return carregar(); }
    const fils = $('#conteudo', el)._fils || {};
    const mv = e.target.closest('[data-mov]'); if (mv) return movimentar(ctx, fils[mv.dataset.mov], carregar);
    const ed = e.target.closest('[data-ed]'); if (ed) return editar(ctx, fils[ed.dataset.ed], carregar);
    if (e.target.closest('[data-novo]')) editar(ctx, null, carregar);
  });
  $('#vInat', el).addEventListener('change', e => { mostrarInativos = e.target.checked; carregar(); });
  $('#novoFil').addEventListener('click', () => editar(ctx, null, carregar));
  await carregar();
}

function editar(ctx, f, aoMudar) {
  const { pb, dono } = ctx;
  const novo = !f;
  f = f || { material: 'PLA', peso_inicial: 1000, minimo: 150, ativo: true, cor_hex: '#333333', data_compra: hojeISO() };
  const m = modal({
    titulo: novo ? 'Novo carretel' : 'Editar carretel',
    corpo: `<form class="frm" novalidate>
      ${campo('Material', `<select name="material">${opcoes(MATERIAIS.map(x => [x, x]), f.material)}</select>`)}
      ${campo('Marca', `<input name="marca" value="${esc(f.marca || '')}" placeholder="Ex.: 3D Fila, Voolt, Sunlu">`)}
      ${campo('Cor (nome)', `<input name="cor" required value="${esc(f.cor || '')}" placeholder="Ex.: Preto, Azul royal">`)}
      ${campo('Cor (amostra)', `<input name="cor_hex" type="color" value="${esc(f.cor_hex || '#333333')}">`)}
      ${campo('Acabamento', `<input name="acabamento" value="${esc(f.acabamento || '')}" placeholder="Fosco, seda, metalizado…">`)}
      ${campo('Data da compra', `<input name="data_compra" type="date" value="${dataIn(f.data_compra) || f.data_compra || ''}">`)}
      ${campo('Peso do carretel (g)', `<input name="peso_inicial" type="number" min="0" value="${f.peso_inicial}">`, { dica: 'Só o filamento, sem o carretel vazio.' })}
      ${novo ? '' : campo('Peso restante (g)', `<input name="peso_restante" type="number" min="0" step="0.1" value="${f.peso_restante}">`, { dica: 'Para corrigir, prefira “Movimentar → Ajuste”, que fica no histórico.' })}
      ${dono ? campo('Valor pago (R$)', `<input name="custo" type="number" min="0" step="0.01" value="${f.custo ?? ''}">`) : ''}
      ${campo('Avisar quando restar (g)', `<input name="minimo" type="number" min="0" value="${f.minimo}">`)}
      ${campo('Observações', `<input name="obs" value="${esc(f.obs || '')}">`, { full: true })}
      <label class="chk full"><input type="checkbox" name="ativo"${f.ativo ? ' checked' : ''}> Carretel em uso (desmarque quando acabar)</label>
      ${novo && dono ? '<label class="chk full"><input type="checkbox" name="lancar" checked> Lançar a compra como despesa no financeiro</label>' : ''}
    </form>`,
    rodape: `${!novo && dono ? '<button type="button" class="btn btn-perigo esq" data-del>Excluir</button>' : ''}<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Salvar</button>`,
  });
  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    if (!d.cor) return toast('Informe a cor.', 'erro');
    const lancar = d.lancar; delete d.lancar;
    d.data_compra = dataOut(d.data_compra);
    try {
      await ocupado(ev.target, async () => {
        if (novo) {
          const r = await pb.collection('filamentos').create(d);
          if (lancar && d.custo > 0) await pb.collection('lancamentos').create({ tipo: 'saida', categoria: 'filamento', descricao: `Filamento ${d.material} ${d.cor}${d.marca ? ' ' + d.marca : ''}`, valor: d.custo, pago: true, data_pagamento: d.data_compra || dataOut(hojeISO()), vencimento: d.data_compra });
          return r;
        }
        return pb.collection('filamentos').update(f.id, d);
      });
      toast('Carretel salvo'); m.fechar(); aoMudar();
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
  m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir este carretel e todo o histórico dele? Para carretéis que acabaram, prefira desmarcar “em uso”.', { ok: 'Excluir', perigo: true }))) return;
    try { await pb.collection('filamentos').delete(f.id); toast('Carretel excluído'); m.fechar(); aoMudar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });
}

function movimentar(ctx, f, aoMudar) {
  const m = modal({
    titulo: `Movimentar · ${f.material} ${f.cor}`,
    corpo: `<p class="dica">Restam ${kg(f.peso_restante)}. A baixa dos projetos é automática; use aqui para impressões avulsas, testes, perdas ou correções.</p>
    <form class="frm" novalidate>
      ${campo('Tipo', `<select name="tipo">${opcoes([['saida', 'Saída (uso, teste, perda)'], ['entrada', 'Entrada (sobra devolvida)'], ['ajuste', 'Ajuste (corrigir pesando o carretel)']], 'saida')}</select>`)}
      ${campo('Gramas', '<input name="gramas" type="number" min="0" step="0.1" required>', { dica: 'No ajuste, informe o peso real que restou.' })}
      ${campo('Observação', '<input name="obs" placeholder="Ex.: teste de calibração, peça que falhou">', { full: true })}
    </form>`,
    rodape: '<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Registrar</button>',
  });
  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    if (!(d.gramas >= 0) || d.gramas === '') return toast('Informe os gramas.', 'erro');
    // ajuste: o usuário informa o peso real; registramos a diferença com sinal
    const dados = { filamento: f.id, tipo: d.tipo, obs: d.obs, gramas: d.tipo === 'ajuste' ? Math.round((d.gramas - f.peso_restante) * 10) / 10 : d.gramas };
    if (d.tipo === 'ajuste' && !dados.gramas) return toast('O peso informado é igual ao atual.', 'info');
    try { await ocupado(ev.target, () => ctx.pb.collection('movimentos').create(dados)); toast('Movimentação registrada'); m.fechar(); aoMudar(); }
    catch (e) { toast(msgErro(e), 'erro'); }
  });
}
