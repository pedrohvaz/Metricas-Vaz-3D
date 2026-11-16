/* Produtos (só o dono): loja pública e catálogo interno. Salvar publica a loja de novo automaticamente. */
import { $, $$, esc, money, num, toast, msgErro, modal, confirmar, lerForm, ocupado, opcoes, campo, vazio } from '../ui.js';

const LICENCAS = [['nao_verificada', 'Não verificada'], ['comercial_ok', 'Uso comercial liberado'], ['sem_licenca_comercial', 'Sem licença comercial'], ['propria', 'Modelo próprio']];
const PIL_LIC = { nao_verificada: 'st-novo', comercial_ok: 'st-aprovado', sem_licenca_comercial: 'st-recusado', propria: 'st-aprovado' };
let aba = 'loja', busca = '', fcat = '', flic = '';
const sel = new Set(); // produtos selecionados para ações em massa
let ultimaAcao = 'licenca', ultimoValor = { licenca: 'comercial_ok' }; // a barra lembra a última escolha
const ACOES = [
  ['licenca', 'Mudar licença para…'], ['categoria', 'Mudar categoria para…'],
  ['ativo_on', 'Mostrar na loja'], ['ativo_off', 'Ocultar da loja'],
  ['interno_on', 'Mover para o catálogo interno'], ['interno_off', 'Tirar do catálogo interno'],
  ['destaque_on', 'Marcar como destaque'], ['destaque_off', 'Tirar do destaque'],
  ['preco', 'Definir preço…'], ['sob_consulta', 'Marcar como sob consulta'], ['excluir', 'Excluir'],
];

export async function render(el, ctx, acoes) {
  const { pb, catalogo } = ctx;
  acoes.innerHTML = '<button class="btn" type="button" id="publicar">Publicar loja</button><button class="btn btn-primary" type="button" id="novoProd">+ Produto</button>';
  let token = '';
  try { token = await pb.files.getToken(); } catch (e) { /* sem token: fotos de referência não aparecem */ }

  async function carregar() {
    const [lista, colecoes] = await Promise.all([
      pb.collection('produtos').getFullList({ sort: 'ordem,nome' }),
      fetch(`${ctx.BASE}/api/mv/colecoes`, { headers: { Authorization: pb.authStore.token } }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    const internos = lista.filter(p => p.interno), loja = lista.filter(p => !p.interno);
    let vis = aba === 'interno' ? internos : loja;
    if (fcat) vis = vis.filter(p => p.categoria === fcat);
    if (flic) vis = vis.filter(p => (p.licenca || 'nao_verificada') === flic);
    if (busca) { const q = busca.toLowerCase(); vis = vis.filter(p => `${p.nome} ${p.ref} ${p.credito || ''} ${p.codigo}`.toLowerCase().includes(q)); }
    const cats = Object.entries(catalogo.categorias || {});
    const pend = colecoes.filter(c => !c.ja_feita && c.importados < c.total);
    el.innerHTML = `
    ${pend.map(c => `<div class="bloco aviso-col"><div><b>Catálogo interno disponível: ${esc(catalogo.categorias?.[c.colecao] || c.colecao)}</b>
      <p class="dica">${c.total} modelos de ${esc(c.fonte || 'terceiros')}${c.importados ? ` · ${c.importados} já importados` : ''}. Entram ocultos, só para consulta interna; nada aparece na loja.</p></div>
      <button class="btn btn-primary" type="button" data-importar="${esc(c.colecao)}">Importar ${c.total - c.importados} modelos</button></div>`).join('')}
    <div class="barra">
      <div class="abas" role="tablist">
        <button type="button" role="tab" data-aba="loja" aria-selected="${aba === 'loja'}">Loja (${loja.length})</button>
        <button type="button" role="tab" data-aba="interno" aria-selected="${aba === 'interno'}">Catálogo interno (${internos.length})</button>
      </div>
      <div class="filtros-linha">
        <select id="fCatP" aria-label="Categoria"><option value="">Todas as categorias</option>${opcoes(cats, fcat)}</select>
        <select id="fLicP" aria-label="Licença"><option value="">Todas as licenças</option>${opcoes(LICENCAS, flic)}</select>
        <input type="search" id="bProd" placeholder="Buscar nome, referência ou designer" value="${esc(busca)}">
      </div>
    </div>
    <p class="dica">${aba === 'loja' ? 'Ao salvar um produto, a loja é atualizada sozinha em alguns segundos.' : 'Confira a licença na página do designer (link “abrir”). Ao marcar “Uso comercial liberado”, o modelo aparece na página Ideias de Natal da loja só com a imagem (e o crédito da foto) e o botão “Quero este”, sem link para fora do site. Os demais ficam só aqui.'}</p>
    <div class="lote" id="lote" hidden>
      <span><b id="loteN">0</b> selecionados</span>
      <button type="button" class="link" id="loteTodos">Selecionar todos os ${vis.length} da lista</button>
      <select id="loteAcao" aria-label="Ação">${opcoes(ACOES, ultimaAcao)}</select>
      <span id="loteValor"></span>
      <button type="button" class="btn btn-primary sm" id="loteAplicar">Aplicar</button>
      <button type="button" class="link" id="loteLimpar">Limpar seleção</button>
    </div>
    ${vis.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th class="sel"><input type="checkbox" id="selTodos" aria-label="Selecionar todos os ${vis.length} da lista"></th><th></th><th>Produto</th><th>Categoria</th>${aba === 'interno' ? '<th>Designer</th><th>Licença</th>' : '<th class="num">Preço</th><th class="num">Custo estimado</th><th>Na loja</th>'}</tr></thead><tbody>
      ${vis.map(p => {
        const foto = p.fotos?.length ? pb.files.getURL(p, p.fotos[0], { thumb: '600x600' }) : p.foto_referencia && token ? pb.files.getURL(p, p.foto_referencia, { thumb: '600x600', token }) : '';
        const custo = aba === 'loja' && p.gramas && p.horas && ctx.config ? window.MVCalc.calcular(ctx.config, { gramas: p.gramas, horas: p.horas, material: (p.material || 'PLA').split(' ')[0], embalagem: false }).custo : 0;
        return `<tr data-id="${p.id}" tabindex="0"${sel.has(p.id) ? ' class="marcado"' : ''}>
          <td class="sel"><input type="checkbox" data-sel="${p.id}" aria-label="Selecionar ${esc(p.nome)}"${sel.has(p.id) ? ' checked' : ''}></td>
          <td class="foto">${foto ? `<img src="${foto}" alt="" width="48" height="48" loading="lazy">` : ''}</td>
          <td><b>${esc(p.nome)}</b><small>${esc(p.ref || '')}${p.destaque ? ' · destaque' : ''}${p.obs_interna ? ' · <span class="atraso">atenção</span>' : ''}</small></td>
          <td>${esc(catalogo.categorias?.[p.categoria] || p.categoria)}</td>
          ${aba === 'interno'
            ? `<td>${esc(p.credito || '—')}${p.link_modelo ? ` <a href="${esc(p.link_modelo)}" target="_blank" rel="noopener" data-link>abrir ↗</a>` : ''}</td><td><span class="pil ${PIL_LIC[p.licenca] || 'st-novo'}">${esc((LICENCAS.find(l => l[0] === p.licenca) || LICENCAS[0])[1])}</span>${p.licenca === 'comercial_ok' && p.categoria === 'natal' ? '<small>na vitrine Ideias de Natal</small>' : ''}</td>`
            : `<td class="num">${p.sob_consulta || !p.preco ? '<span class="pil">Sob consulta</span>' : money(p.preco)}</td>
               <td class="num">${custo ? `${money(custo)}${p.preco ? ` <small>${num((p.preco - custo) / custo * 100)}% lucro</small>` : ''}` : '<small>informe g e h</small>'}</td>
               <td>${p.ativo ? '<span class="pil st-aprovado">Visível</span>' : '<span class="pil">Oculto</span>'}</td>`}
        </tr>`;
      }).join('')}
    </tbody></table></div>` : lista.length ? vazio('Nenhum produto com esses filtros.') : vazio('Nenhum produto no banco ainda.', '<button class="btn btn-primary" type="button" id="importar">Importar os 11 produtos do site atual</button><p class="dica">Traz nomes, preços, cores, descrições e fotos que já estão no site.</p>')}`;

    $('#bProd', el).addEventListener('input', ev => { clearTimeout(el._t); el._t = setTimeout(() => { busca = ev.target.value.trim(); carregar(); }, 250); });
    $('#fCatP', el).addEventListener('change', ev => { fcat = ev.target.value; carregar(); });
    $('#fLicP', el).addEventListener('change', ev => { flic = ev.target.value; carregar(); });
    el._vis = vis; el._lista = lista;
    const existentes = new Set(lista.map(p => p.id));
    for (const id of [...sel]) if (!existentes.has(id)) sel.delete(id); // produtos que não existem mais saem da seleção
    campoValor(); // a segunda lista (licença, categoria, preço) aparece já com a ação escolhida
    atualizaLote();
    $('#importar', el)?.addEventListener('click', async ev => {
      try {
        const r = await ocupado(ev.target, async () => {
          const resp = await fetch(`${ctx.BASE}/api/mv/importar-catalogo`, { method: 'POST', headers: { Authorization: pb.authStore.token } });
          const j = await resp.json(); if (!resp.ok) throw new Error(j.message); return j;
        });
        toast(`${r.importados} produtos importados${r.publicado ? ' e loja publicada' : ''}`); carregar();
      } catch (e) { toast(msgErro(e), 'erro'); }
    });
  }

  /* ---------- seleção e ações em massa ---------- */
  function atualizaLote() {
    const lote = $('#lote', el); if (!lote) return;
    const vis = el._vis || [];
    lote.hidden = !sel.size;
    $('#loteN', el).textContent = sel.size;
    const todos = $('#selTodos', el);
    if (todos) { const n = vis.filter(p => sel.has(p.id)).length; todos.checked = n > 0 && n === vis.length; todos.indeterminate = n > 0 && n < vis.length; }
    $('#loteTodos', el).hidden = vis.every(p => sel.has(p.id));
    $$('tr[data-id]', el).forEach(tr => tr.classList.toggle('marcado', sel.has(tr.dataset.id)));
  }
  function campoValor() {
    const sAcao = $('#loteAcao', el), alvo = $('#loteValor', el);
    if (!sAcao || !alvo) return;
    const acao = sAcao.value; ultimaAcao = acao;
    const v = ultimoValor[acao];
    alvo.innerHTML = acao === 'licenca' ? `<select id="loteV" aria-label="Licença">${opcoes(LICENCAS, v || 'comercial_ok')}</select>`
      : acao === 'categoria' ? `<select id="loteV" aria-label="Categoria">${opcoes(Object.entries(catalogo.categorias || {}), v || '')}</select>`
      : acao === 'preco' ? `<input id="loteV" type="number" min="0" step="0.01" placeholder="R$" aria-label="Preço" style="width:110px" value="${esc(v || '')}">` : '';
  }
  async function aplicarLote(btn) {
    const acaoUI = $('#loteAcao', el).value;
    const ids = [...sel];
    const lista = el._lista || [];
    const [acao, valor] = acaoUI.endsWith('_on') ? [acaoUI.slice(0, -3), true] : acaoUI.endsWith('_off') ? [acaoUI.slice(0, -4), false]
      : [acaoUI, $('#loteV', el) ? $('#loteV', el).value : null];
    if (['licenca', 'categoria', 'preco'].includes(acao) && (valor == null || valor === '')) return toast('Escolha o valor ao lado da ação.', 'erro');
    if (acao === 'preco' && !(Number(valor) >= 0)) return toast('Informe o preço.', 'erro');
    if (valor != null) ultimoValor[acao] = valor;
    const nome = (ACOES.find(a => a[0] === acaoUI) || [, acaoUI])[1].replace('…', '');
    if (acao === 'excluir' && !(await confirmar(`Excluir ${ids.length} produto(s)? Isso não pode ser desfeito.`, { ok: 'Excluir', perigo: true }))) return;
    // itens que passariam a aparecer na loja sem licença confirmada
    const vaiPublicar = p => (acao === 'ativo' && valor ? !p.interno : acao === 'interno' && !valor ? p.ativo : false);
    const semLic = lista.filter(p => sel.has(p.id) && vaiPublicar(p) && !['comercial_ok', 'propria'].includes(p.licenca));
    if (semLic.length && !(await confirmar(`${semLic.length} dos selecionados vão aparecer na loja sem a licença marcada como “Uso comercial liberado” ou “Modelo próprio”. Continuar?`, { ok: 'Continuar', perigo: true }))) return;
    try {
      const r = await ocupado(btn, async () => {
        const resp = await fetch(`${ctx.BASE}/api/mv/produtos/lote`, { method: 'POST', headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, acao, valor }) });
        const j = await resp.json(); if (!resp.ok) throw new Error(j.message); return j;
      });
      toast(`${nome}: ${r.feitos} produto(s)${r.publicado ? ' · loja atualizada' : ''}`);
      sel.clear(); carregar();
    } catch (err) { toast(msgErro(err), 'erro'); }
  }
  const marcar = (id, sim) => (sim ? sel.add(id) : sel.delete(id));
  el.addEventListener('change', e => {
    const c = e.target.closest('[data-sel]');
    if (c) { marcar(c.dataset.sel, c.checked); return atualizaLote(); }
    if (e.target.id === 'selTodos') { (el._vis || []).forEach(p => marcar(p.id, e.target.checked)); $$('[data-sel]', el).forEach(i => { i.checked = e.target.checked; }); return atualizaLote(); }
    if (e.target.id === 'loteAcao') campoValor();
  });

  el.addEventListener('click', async e => {
    if (e.target.closest('[data-link]')) return; // link do designer abre em nova aba
    if (e.target.closest('td.sel, th.sel')) return; // clicar na caixa não abre o produto
    if (e.target.id === 'loteTodos') { (el._vis || []).forEach(p => sel.add(p.id)); $$('[data-sel]', el).forEach(i => { i.checked = true; }); return atualizaLote(); }
    if (e.target.id === 'loteLimpar') { sel.clear(); $$('[data-sel]', el).forEach(i => { i.checked = false; }); return atualizaLote(); }
    if (e.target.id === 'loteAplicar') return aplicarLote(e.target);
    const a = e.target.closest('[data-aba]');
    if (a) { aba = a.dataset.aba; sel.clear(); return carregar(); }
    const imp = e.target.closest('[data-importar]');
    if (imp) {
      try {
        const r = await ocupado(imp, async () => {
          const resp = await fetch(`${ctx.BASE}/api/mv/importar-colecao`, { method: 'POST', headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ colecao: imp.dataset.importar }) });
          const j = await resp.json(); if (!resp.ok) throw new Error(j.message); return j;
        });
        toast(`${r.criados} modelos no catálogo interno${r.sem_foto ? ` (${r.sem_foto} sem foto de referência)` : ''}`);
        aba = 'interno'; carregar();
      } catch (err) { toast(msgErro(err), 'erro'); }
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (tr) editar(ctx, tr.dataset.id, carregar, token);
  });
  el.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter' && !e.target.closest('td.sel')) editar(ctx, tr.dataset.id, carregar, token); });
  $('#novoProd').addEventListener('click', () => editar(ctx, null, carregar, token));
  $('#publicar').addEventListener('click', async ev => {
    try {
      await ocupado(ev.target, async () => {
        const r = await fetch(`${ctx.BASE}/api/mv/publicar`, { method: 'POST', headers: { Authorization: pb.authStore.token } });
        const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.message || (j.saida || '').slice(0, 200) || 'Falha ao publicar');
      });
      toast('Loja publicada');
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
  await carregar();
}

async function editar(ctx, id, aoMudar, token) {
  const { pb, catalogo } = ctx;
  const p = id ? await pb.collection('produtos').getOne(id) : { ativo: true, interno: false, licenca: 'propria', categoria: Object.keys(catalogo.categorias || {})[0] || 'decoracao', cores: [], fotos: [], ordem: 50, art: 'gear', material: 'PLA' };
  const cores = Object.entries(catalogo.cores || {});
  const ref = p.foto_referencia && token ? pb.files.getURL(p, p.foto_referencia, { thumb: '600x600', token }) : '';
  const m = modal({
    titulo: id ? p.nome : 'Novo produto', largo: true,
    corpo: `<form class="frm" novalidate>
      ${campo('Nome', `<input name="nome" required maxlength="100" value="${esc(p.nome || '')}">`)}
      ${campo('Código interno', `<input name="codigo" required pattern="[a-z0-9-]+" value="${esc(p.codigo || '')}" ${id ? 'readonly' : ''}>`, { dica: id ? 'Não muda depois de criado (vai no endereço do carrinho).' : 'Só letras minúsculas, números e hífen. Ex.: vaso-espiral' })}
      ${campo('Referência', `<input name="ref" maxlength="20" value="${esc(p.ref || '')}" placeholder="DC-031">`)}
      ${campo('Categoria', `<select name="categoria">${opcoes(Object.entries(catalogo.categorias || {}), p.categoria)}</select>`)}
      <fieldset class="full grupo interno-grupo"><legend>Origem e licença</legend><div class="frm">
        <label class="chk full"><input type="checkbox" name="interno"${p.interno ? ' checked' : ''}> Catálogo interno (nunca aparece na loja)</label>
        ${campo('Licença do modelo', `<select name="licenca">${opcoes(LICENCAS, p.licenca || 'nao_verificada')}</select>`, { dica: 'Confira na página do modelo se a venda de impressões é permitida.' })}
        ${campo('Designer / crédito', `<input name="credito" maxlength="120" value="${esc(p.credito || '')}">`)}
        ${campo('Link do modelo', `<input name="link_modelo" type="url" value="${esc(p.link_modelo || '')}" placeholder="https://makerworld.com/...">${p.link_modelo ? ` <a href="${esc(p.link_modelo)}" target="_blank" rel="noopener">abrir página do modelo ↗</a>` : ''}`, { full: true })}
        ${campo('Observação interna', `<textarea name="obs_interna" rows="2" maxlength="1000">${esc(p.obs_interna || '')}</textarea>`, { full: true })}
        ${ref ? `<figure class="ref-foto full"><img src="${ref}" alt="Foto de referência do designer"><figcaption>Foto do designer: só para referência interna, não vai para a loja.</figcaption></figure>` : ''}
      </div></fieldset>
      <fieldset class="full grupo"><legend>Preço</legend><div class="frm">
        ${campo('Preço (R$)', `<input name="preco" type="number" min="0" step="0.01" value="${p.preco || ''}">`, { dica: 'Deixe vazio para “Sob consulta”.' })}
        <label class="chk"><input type="checkbox" name="sob_consulta"${p.sob_consulta ? ' checked' : ''}> Sob consulta (cliente pede orçamento)</label>
      </div></fieldset>
      ${campo('Descrição', `<textarea name="descricao" rows="3" maxlength="1000">${esc(p.descricao || '')}</textarea>`, { full: true })}
      ${campo('Material', `<input name="material" value="${esc(p.material || '')}" placeholder="PLA, PETG, PLA translúcido…">`)}
      ${campo('Tamanho', `<input name="tamanho" value="${esc(p.tamanho || '')}" placeholder="180 mm de altura">`)}
      ${campo('Tempo exibido', `<input name="tempo" value="${esc(p.tempo || '')}" placeholder="6 h">`)}
      ${campo('Altura de camada', `<input name="camada" value="${esc(p.camada || '')}" placeholder="0,2 mm">`)}
      <fieldset class="full grupo"><legend>Produção <small>(para o custo; não aparece na loja)</small></legend><div class="frm">
        ${campo('Gramas por peça', `<input name="gramas" type="number" min="0" step="0.1" value="${p.gramas ?? ''}">`)}
        ${campo('Horas por peça', `<input name="horas" type="number" min="0" step="0.1" value="${p.horas ?? ''}">`)}
        <p class="dica full" id="custoProd"></p>
      </div></fieldset>
      <fieldset class="full grupo"><legend>Cores oferecidas</legend><div class="cores-opc">
        ${cores.map(([k, c]) => `<label class="cor-opc"><input type="checkbox" name="cores" data-lista value="${k}"${(p.cores || []).includes(k) ? ' checked' : ''}><i class="cor" style="--c:${esc(c.hex)}"></i>${esc(c.nome)}</label>`).join('')}
      </div></fieldset>
      <fieldset class="full grupo"><legend>Fotos da loja</legend>
        <div class="fotos-ed">${(p.fotos || []).map(f => `<figure><img src="${pb.files.getURL(p, f, { thumb: '600x600' })}" alt=""><label class="chk"><input type="checkbox" data-remover="${esc(f)}"> remover</label></figure>`).join('')}</div>
        <input type="file" name="novas" accept="image/jpeg,image/png,image/webp" multiple>
        <small class="dica">Fotos das suas peças, quadradas, cerca de 1000 × 1000 px. A primeira vira a capa. Até 8 fotos, 5 MB cada.</small>
      </fieldset>
      ${campo('Selo no card', `<input name="tag" maxlength="30" value="${esc(p.tag || '')}" placeholder="Mais vendido, Novo…">`)}
      ${campo('Desenho (sem foto)', `<select name="art">${opcoes((catalogo.arts || []).map(a => [a, a]), p.art)}</select>`)}
      ${campo('Ordem', `<input name="ordem" type="number" value="${p.ordem ?? 50}">`, { dica: 'Menor aparece primeiro.' })}
      <div class="fld full chks">
        <label class="chk"><input type="checkbox" name="ativo"${p.ativo ? ' checked' : ''}> Visível na loja</label>
        <label class="chk"><input type="checkbox" name="destaque"${p.destaque ? ' checked' : ''}> Destaque na página inicial</label>
        <label class="chk"><input type="checkbox" name="personalizavel"${p.personalizavel ? ' checked' : ''}> Aceita texto personalizado</label>
      </div>
    </form>`,
    rodape: `${id ? '<button type="button" class="btn btn-perigo esq" data-del>Excluir</button>' : ''}<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Salvar</button>`,
  });
  const atualizaCusto = () => {
    const d = lerForm(m.form);
    const alvo = $('#custoProd', m.el);
    if (!(d.gramas > 0 && d.horas > 0) || !ctx.config) { alvo.textContent = ''; return; }
    const r = window.MVCalc.calcular(ctx.config, { gramas: d.gramas, horas: d.horas, material: (d.material || 'PLA').split(' ')[0], embalagem: false });
    alvo.innerHTML = `Custo por peça: <b>${money(r.custo)}</b> · preço sugerido: <b>${money(r.preco)}</b>${d.preco ? ` · com ${money(d.preco)} o lucro é <b>${money(d.preco - r.custo)}</b>` : ''}`;
  };
  m.form.addEventListener('input', atualizaCusto); atualizaCusto();

  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    if (!d.nome || !d.codigo) return toast('Informe nome e código.', 'erro');
    if (!/^[a-z0-9-]+$/.test(d.codigo)) return toast('Código: só letras minúsculas, números e hífen.', 'erro');
    if (!d.cores.length) return toast('Escolha pelo menos uma cor.', 'erro');
    if (!d.preco) d.sob_consulta = true;
    // publicar um modelo de terceiro sem licença confirmada pede confirmação
    const vaiParaLoja = d.ativo && !d.interno;
    if (vaiParaLoja && !['comercial_ok', 'propria'].includes(d.licenca)) {
      if (!(await confirmar('Este produto vai aparecer na loja, mas a licença do modelo não está marcada como “Uso comercial liberado” ou “Modelo próprio”. Vender impressões de modelos sem licença comercial pode gerar denúncia do designer. Publicar mesmo assim?', { ok: 'Publicar mesmo assim', perigo: true }))) return;
    }
    if (vaiParaLoja && !(p.fotos || []).length && !m.form.elements.novas.files.length && p.foto_referencia) {
      toast('Coloque uma foto sua antes de publicar: a foto de referência do designer não vai para a loja.', 'info');
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(d)) fd.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    for (const f of m.form.elements.novas.files) fd.append('fotos+', f);
    $$('[data-remover]:checked', m.el).forEach(c => fd.append('fotos-', c.dataset.remover));
    try {
      await ocupado(ev.target, () => id ? pb.collection('produtos').update(id, fd) : pb.collection('produtos').create(fd));
      toast(vaiParaLoja ? 'Produto salvo. A loja foi atualizada.' : 'Produto salvo.'); m.fechar(); aoMudar();
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
  m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmar(`Excluir “${p.nome}”? Para tirar só da loja, desmarque “Visível na loja”.`, { ok: 'Excluir', perigo: true }))) return;
    try { await pb.collection('produtos').delete(id); toast('Produto excluído'); m.fechar(); aoMudar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });
}
