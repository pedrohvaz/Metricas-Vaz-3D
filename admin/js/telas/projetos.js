/* Projetos em produção: quadro por etapa, edição com uso de filamento e custo. */
import { $, $$, esc, money, num, kg, dataBR, dataIn, dataOut, hojeISO, toast, msgErro, modal, confirmar, lerForm, ocupado, opcoes, campo, vazio } from '../ui.js';
import { STATUS_PROJETO, nomeDe } from '../rotulos.js';

const COLUNAS = ['orcamento', 'aprovado', 'imprimindo', 'acabamento', 'pronto', 'enviado'];
const FINAIS = ['entregue', 'cancelado'];
let verFinais = false;

export async function render(el, ctx, acoes) {
  const { pb, dono } = ctx;
  acoes.innerHTML = `<label class="chk"><input type="checkbox" id="vFin"${verFinais ? ' checked' : ''}> Mostrar entregues e cancelados</label><button class="btn btn-primary" type="button" id="novoProj">+ Novo projeto</button>`;

  async function carregar() {
    const filtro = verFinais ? '' : FINAIS.map(s => `status != "${s}"`).join(' && ');
    const lista = await pb.collection('projetos').getFullList({ filter: filtro, sort: 'prazo,-created', expand: 'cliente' });
    const hoje = hojeISO();
    const cols = verFinais ? [...COLUNAS, ...FINAIS] : COLUNAS;
    el.innerHTML = `<p class="dica">Ao passar um projeto para <b>Acabamento</b> (ou depois), o filamento usado é baixado do estoque automaticamente. Ao <b>aprovar</b> um projeto com preço, a conta a receber entra no financeiro.</p>
    <div class="quadro">${cols.map(st => {
      const itens = lista.filter(p => p.status === st);
      return `<section class="coluna" aria-label="${nomeDe(STATUS_PROJETO, st)}"><h2>${nomeDe(STATUS_PROJETO, st)} <span>${itens.length}</span></h2>
        ${itens.map(p => {
          const atraso = p.prazo && p.prazo.slice(0, 10) < hoje && !FINAIS.includes(p.status) && p.status !== 'enviado';
          const i = cols.indexOf(st);
          return `<article class="cartao" data-id="${p.id}" tabindex="0">
            <b>${esc(p.titulo)}</b>
            <small>${esc(p.expand?.cliente?.nome || 'Sem cliente')}</small>
            <div class="cartao-pe">
              ${p.prazo ? `<span class="${atraso ? 'atraso' : ''}">${atraso ? 'Atrasado · ' : ''}${dataBR(p.prazo)}</span>` : '<span></span>'}
              ${dono && p.preco ? `<span>${money(p.preco)}</span>` : ''}
            </div>
            <div class="mover">${i > 0 ? `<button type="button" data-mv="${cols[i - 1]}" aria-label="Voltar para ${nomeDe(STATUS_PROJETO, cols[i - 1])}">←</button>` : '<span></span>'}${i < COLUNAS.length - 1 && COLUNAS.includes(st) ? `<button type="button" data-mv="${COLUNAS[i + 1]}" aria-label="Avançar para ${nomeDe(STATUS_PROJETO, COLUNAS[i + 1])}">→</button>` : st === 'enviado' ? '<button type="button" data-mv="entregue" aria-label="Marcar como entregue">✓</button>' : ''}</div>
          </article>`;
        }).join('') || '<p class="col-vazia">—</p>'}
      </section>`;
    }).join('')}</div>`;
  }

  el.addEventListener('click', async e => {
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      e.stopPropagation();
      const id = mv.closest('[data-id]').dataset.id;
      try { await pb.collection('projetos').update(id, { status: mv.dataset.mv }); toast(`Movido para ${nomeDe(STATUS_PROJETO, mv.dataset.mv)}`); carregar(); }
      catch (err) { toast(msgErro(err), 'erro'); }
      return;
    }
    const c = e.target.closest('.cartao');
    if (c) editar(ctx, c.dataset.id, carregar);
  });
  el.addEventListener('keydown', e => { const c = e.target.closest('.cartao'); if (c && e.key === 'Enter') editar(ctx, c.dataset.id, carregar); });
  $('#vFin').addEventListener('change', e => { verFinais = e.target.checked; carregar(); });
  $('#novoProj').addEventListener('click', () => editar(ctx, null, carregar));
  await carregar();
  const id = location.hash.split('/')[2];
  if (id) editar(ctx, id, carregar);
}

export async function editar(ctx, id, aoMudar, preenchido = {}) {
  const { pb, dono } = ctx;
  const [p, clientes, fils] = await Promise.all([
    id ? pb.collection('projetos').getOne(id) : Promise.resolve({ status: 'orcamento', quantidade: 1, uso_filamento: [], ...preenchido }),
    pb.collection('clientes').getFullList({ sort: 'nome', fields: 'id,nome,whatsapp' }),
    pb.collection('filamentos').getFullList({ sort: 'material,cor', fields: 'id,material,cor,cor_hex,marca,peso_restante,peso_inicial,custo,ativo' }),
  ]);
  const F = Object.fromEntries(fils.map(f => [f.id, f]));
  const optFil = atual => `<option value="">Carretel…</option>` + fils.filter(f => f.ativo || f.id === atual).map(f => `<option value="${f.id}"${f.id === atual ? ' selected' : ''}>${esc(`${f.material} ${f.cor}${f.marca ? ' · ' + f.marca : ''} (restam ${kg(f.peso_restante)})`)}</option>`).join('');
  const linhaUso = (u = {}) => `<div class="uso-linha"><select data-uso-fil>${optFil(u.filamento)}</select><input type="number" min="0" step="0.1" data-uso-g placeholder="gramas" value="${u.gramas ?? ''}"><button type="button" class="icone" data-uso-rm aria-label="Remover">×</button></div>`;
  let token = '';
  if (p.arquivos?.length) { try { token = await pb.files.getToken(); } catch (e) { /* */ } }

  const m = modal({
    titulo: id ? 'Projeto' : 'Novo projeto', largo: true,
    corpo: `<form class="frm" novalidate>
      ${campo('Título', `<input name="titulo" required maxlength="120" value="${esc(p.titulo || '')}">`, { full: true })}
      ${campo('Cliente', `<select name="cliente"><option value="">Sem cliente</option>${clientes.map(c => `<option value="${c.id}"${c.id === p.cliente ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>`)}
      ${campo('Etapa', `<select name="status">${opcoes(STATUS_PROJETO, p.status)}</select>`)}
      ${campo('Prazo de entrega', `<input name="prazo" type="date" value="${dataIn(p.prazo)}">`)}
      ${campo('Quantidade de peças', `<input name="quantidade" type="number" min="1" value="${p.quantidade || 1}">`)}
      <fieldset class="full grupo"><legend>Produção <small>(total do projeto)</small></legend>
        <div class="frm">
          ${campo('Horas de máquina', `<input name="horas_maquina" type="number" min="0" step="0.1" value="${p.horas_maquina ?? ''}">`, { dica: 'Tempo do fatiador somado.' })}
          ${campo('Minutos de preparo e acabamento', `<input name="min_trabalho" type="number" min="0" value="${p.min_trabalho ?? ''}">`)}
          ${campo('Trocas de cor', `<input name="trocas_cor" type="number" min="0" value="${p.trocas_cor ?? ''}">`, { dica: 'Só para peças multicor.' })}
        </div>
        <div class="uso"><span class="rot">Filamento usado</span><div id="usoLinhas">${(p.uso_filamento?.length ? p.uso_filamento : [{}]).map(linhaUso).join('')}</div>
          <button type="button" class="link" id="usoMais">+ outro carretel</button>
          ${p.estoque_baixado ? '<p class="dica ok-txt">Estoque já baixado para este projeto.</p>' : ''}</div>
      </fieldset>
      ${dono ? `<fieldset class="full grupo"><legend>Custo e preço</legend>
        <div class="frm">
          ${campo('Preço cobrado (R$)', `<input name="preco" type="number" min="0" step="0.01" value="${p.preco ?? ''}">`)}
          <div class="fld"><span>&nbsp;</span><button type="button" class="btn" id="calcProj">Calcular custo e preço sugerido</button></div>
        </div>
        <div id="calcRes">${p.custo_total ? resumoCusto(p.custo, p.custo_total, p.preco) : ''}</div>
        ${p.receita_gerada ? '<p class="dica ok-txt">Conta a receber já lançada no financeiro.</p>' : ''}
      </fieldset>` : ''}
      ${campo('Arquivos', `<input type="file" name="novos" multiple>${p.arquivos?.length ? `<ul class="arqs">${p.arquivos.map(f => `<li><a href="${pb.files.getURL(p, f, { token, download: true })}" target="_blank" rel="noopener">${esc(f)}</a></li>`).join('')}</ul>` : ''}`, { full: true })}
      ${campo('Observações', `<textarea name="obs" rows="4">${esc(p.obs || '')}</textarea>`, { full: true })}
    </form>`,
    rodape: `${id && dono ? '<button type="button" class="btn btn-perigo esq" data-del>Excluir</button>' : ''}<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Salvar</button>`,
  });
  const box = m.el;
  // projeto novo vindo da calculadora já traz o custo calculado
  let custoCalc = !id && p.custo_total ? { itens: p.custo, custo: p.custo_total } : null;
  const lerUso = () => $$('.uso-linha', box).map(l => ({ filamento: $('[data-uso-fil]', l).value, gramas: Number($('[data-uso-g]', l).value) || 0 })).filter(u => u.filamento && u.gramas > 0);
  $('#usoMais', box).addEventListener('click', () => $('#usoLinhas', box).insertAdjacentHTML('beforeend', linhaUso()));
  box.addEventListener('click', e => { const rm = e.target.closest('[data-uso-rm]'); if (rm) rm.closest('.uso-linha').remove(); });

  $('#calcProj', box)?.addEventListener('click', () => {
    const d = lerForm(m.form), uso = lerUso();
    const gramas = uso.reduce((s, u) => s + u.gramas, 0);
    if (!gramas || !d.horas_maquina) return toast('Informe o filamento usado (gramas) e as horas de máquina.', 'erro');
    // preço por kg ponderado pelos carretéis usados (custo ÷ peso inicial)
    const custoFil = uso.reduce((s, u) => s + (F[u.filamento] ? window.MVCalc.custoGrama(F[u.filamento]) : 0) * u.gramas, 0);
    const precoKg = custoFil > 0 ? custoFil / gramas * 1000 : 0;
    const mat = F[uso[0].filamento]?.material || 'PLA';
    const r = window.MVCalc.calcular(ctx.config, { gramas, horas: d.horas_maquina, material: mat, preco_kg: precoKg, trocas_cor: d.trocas_cor || 0, min_trabalho: d.min_trabalho === '' ? undefined : d.min_trabalho, quantidade: 1 });
    custoCalc = r;
    $('#calcRes', box).innerHTML = resumoCusto(r.itens, r.custo, d.preco || r.preco, r.preco);
    const ip = m.form.elements.preco;
    if (!ip.value) ip.value = r.preco.toFixed(2);
  });

  box.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    if (!d.titulo) return toast('Informe o título do projeto.', 'erro');
    const fd = new FormData();
    const dados = { ...d, prazo: dataOut(d.prazo), uso_filamento: lerUso() };
    if (dono && custoCalc) { dados.custo = custoCalc.itens; dados.custo_total = custoCalc.custo; }
    for (const [k, v] of Object.entries(dados)) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v === '' ? '' : String(v));
    for (const f of m.form.elements.novos.files) fd.append('arquivos+', f);
    try {
      const r = await ocupado(ev.target, () => id ? pb.collection('projetos').update(id, fd) : pb.collection('projetos').create(fd));
      toast(id ? 'Projeto salvo' : 'Projeto criado'); m.fechar();
      if (location.hash.split('/')[2]) history.replaceState(null, '', '#/projetos');
      aoMudar && aoMudar(r);
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
  box.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir este projeto? O estoque já baixado não volta automaticamente.', { ok: 'Excluir', perigo: true }))) return;
    try { await pb.collection('projetos').delete(id); toast('Projeto excluído'); m.fechar(); aoMudar && aoMudar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });
}

const NOMES = { filamento: 'Filamento', energia: 'Energia', maquina: 'Desgaste da máquina', falha: 'Reserva para falhas', mao_de_obra: 'Mão de obra', embalagem: 'Embalagem' };
function resumoCusto(itens, custo, preco, sugerido) {
  const lucro = (Number(preco) || 0) - custo;
  return `<table class="tabela mini custo"><tbody>
    ${Object.entries(itens || {}).map(([k, v]) => `<tr><td>${NOMES[k] || k}</td><td class="num">${money(v)}</td></tr>`).join('')}
    <tr class="tot"><td>Custo total</td><td class="num">${money(custo)}</td></tr>
    ${sugerido ? `<tr><td>Preço sugerido (margem da configuração)</td><td class="num">${money(sugerido)}</td></tr>` : ''}
    ${preco ? `<tr class="${lucro >= 0 ? 'pos' : 'neg'}"><td>Lucro com ${money(preco)}</td><td class="num">${money(lucro)} (${custo ? num(lucro / custo * 100) : 0}%)</td></tr>` : ''}
  </tbody></table>`;
}
