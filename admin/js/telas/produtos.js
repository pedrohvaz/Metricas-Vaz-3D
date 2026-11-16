/* Produtos da loja (só o dono). Cada alteração publica o site de novo automaticamente. */
import { $, $$, esc, money, num, toast, msgErro, modal, confirmar, lerForm, ocupado, opcoes, campo, vazio } from '../ui.js';

export async function render(el, ctx, acoes) {
  const { pb, catalogo } = ctx;
  acoes.innerHTML = '<button class="btn" type="button" id="publicar">Publicar loja</button><button class="btn btn-primary" type="button" id="novoProd">+ Produto</button>';
  async function carregar() {
    const lista = await pb.collection('produtos').getFullList({ sort: 'ordem,nome' });
    el.innerHTML = `<p class="dica">Ao salvar um produto, a loja é atualizada sozinha em alguns segundos. Use “Publicar loja” se mudar algo fora do painel.</p>
    ${lista.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th></th><th>Produto</th><th>Categoria</th><th class="num">Preço</th><th class="num">Custo estimado</th><th>Na loja</th></tr></thead><tbody>
      ${lista.map(p => {
        const custo = p.gramas && p.horas && ctx.config ? window.MVCalc.calcular(ctx.config, { gramas: p.gramas, horas: p.horas, material: (p.material || 'PLA').split(' ')[0], embalagem: false }).custo : 0;
        return `<tr data-id="${p.id}" tabindex="0">
          <td class="foto">${p.fotos?.length ? `<img src="${pb.files.getURL(p, p.fotos[0], { thumb: '600x600' })}" alt="" width="48" height="48" loading="lazy">` : ''}</td>
          <td><b>${esc(p.nome)}</b><small>${esc(p.ref || '')}${p.destaque ? ' · destaque' : ''}</small></td>
          <td>${esc(catalogo.categorias?.[p.categoria] || p.categoria)}</td>
          <td class="num">${p.sob_consulta || !p.preco ? '<span class="pil">Sob consulta</span>' : money(p.preco)}</td>
          <td class="num">${custo ? `${money(custo)}${p.preco ? ` <small>${num((p.preco - custo) / custo * 100)}% lucro</small>` : ''}` : '<small>informe g e h</small>'}</td>
          <td>${p.ativo ? '<span class="pil st-aprovado">Visível</span>' : '<span class="pil">Oculto</span>'}</td></tr>`;
      }).join('')}
    </tbody></table></div>` : vazio('Nenhum produto no banco ainda.', '<button class="btn btn-primary" type="button" id="importar">Importar os 11 produtos do site atual</button><p class="dica">Traz nomes, preços, cores, descrições e fotos que já estão no site.</p>')}`;
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
  el.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) editar(ctx, tr.dataset.id, carregar); });
  el.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') editar(ctx, tr.dataset.id, carregar); });
  $('#novoProd').addEventListener('click', () => editar(ctx, null, carregar));
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

async function editar(ctx, id, aoMudar) {
  const { pb, catalogo } = ctx;
  const p = id ? await pb.collection('produtos').getOne(id) : { ativo: true, categoria: Object.keys(catalogo.categorias || {})[0] || 'decoracao', cores: [], fotos: [], ordem: 50, art: 'gear', material: 'PLA' };
  const cores = Object.entries(catalogo.cores || {});
  const m = modal({
    titulo: id ? p.nome : 'Novo produto', largo: true,
    corpo: `<form class="frm" novalidate>
      ${campo('Nome', `<input name="nome" required maxlength="100" value="${esc(p.nome || '')}">`)}
      ${campo('Código interno', `<input name="codigo" required pattern="[a-z0-9-]+" value="${esc(p.codigo || '')}" ${id ? 'readonly' : ''}>`, { dica: id ? 'Não muda depois de criado (vai no endereço do carrinho).' : 'Só letras minúsculas, números e hífen. Ex.: vaso-espiral' })}
      ${campo('Referência', `<input name="ref" maxlength="20" value="${esc(p.ref || '')}" placeholder="DC-031">`)}
      ${campo('Categoria', `<select name="categoria">${opcoes(Object.entries(catalogo.categorias || {}), p.categoria)}</select>`)}
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
      <fieldset class="full grupo"><legend>Fotos</legend>
        <div class="fotos-ed">${(p.fotos || []).map(f => `<figure><img src="${pb.files.getURL(p, f, { thumb: '600x600' })}" alt=""><label class="chk"><input type="checkbox" data-remover="${esc(f)}"> remover</label></figure>`).join('')}</div>
        <input type="file" name="novas" accept="image/jpeg,image/png,image/webp" multiple>
        <small class="dica">Quadradas, cerca de 1000 × 1000 px. A primeira foto vira a capa. Até 8 fotos, 5 MB cada.</small>
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
    rodape: `${id ? '<button type="button" class="btn btn-perigo esq" data-del>Excluir</button>' : ''}<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Salvar e publicar</button>`,
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
    const fd = new FormData();
    for (const [k, v] of Object.entries(d)) fd.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    for (const f of m.form.elements.novas.files) fd.append('fotos+', f);
    $$('[data-remover]:checked', m.el).forEach(c => fd.append('fotos-', c.dataset.remover));
    try {
      await ocupado(ev.target, () => id ? pb.collection('produtos').update(id, fd) : pb.collection('produtos').create(fd));
      toast('Produto salvo. A loja foi atualizada.'); m.fechar(); aoMudar();
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
  m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmar(`Excluir “${p.nome}” da loja? Para tirar só temporariamente, desmarque “Visível na loja”.`, { ok: 'Excluir', perigo: true }))) return;
    try { await pb.collection('produtos').delete(id); toast('Produto excluído'); m.fechar(); aoMudar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });
}
