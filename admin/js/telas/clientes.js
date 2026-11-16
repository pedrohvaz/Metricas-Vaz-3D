/* Clientes: cadastro e histórico. */
import { $, esc, money, dataBR, dataHora, foneBR, waLink, toast, msgErro, modal, confirmar, lerForm, ocupado, campo, vazio } from '../ui.js';
import { STATUS_PEDIDO, STATUS_PROJETO, TIPO_PEDIDO, pilula } from '../rotulos.js';

let busca = '';

export async function render(el, ctx, acoes) {
  const { pb } = ctx;
  acoes.innerHTML = '<button class="btn btn-primary" type="button" id="novoCli">+ Cliente</button>';
  el.innerHTML = `<div class="barra"><input type="search" id="bCli" placeholder="Buscar por nome, WhatsApp ou cidade" value="${esc(busca)}"></div><div id="lista"></div>`;
  async function carregar() {
    const filtro = busca ? pb.filter('nome ~ {:q} || whatsapp ~ {:q} || cidade ~ {:q}', { q: busca }) : '';
    const r = await pb.collection('clientes').getList(1, 200, { filter: filtro, sort: 'nome' });
    $('#lista', el).innerHTML = r.items.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>WhatsApp</th><th>Cidade</th><th>Desde</th></tr></thead><tbody>
      ${r.items.map(c => `<tr data-id="${c.id}" tabindex="0"><td><b>${esc(c.nome)}</b></td><td>${foneBR(c.whatsapp)}</td><td>${esc(c.cidade || '—')}</td><td>${dataBR(c.created)}</td></tr>`).join('')}
    </tbody></table></div>${r.totalItems > r.items.length ? `<p class="dica">Mostrando ${r.items.length} de ${r.totalItems}. Use a busca.</p>` : ''}` : vazio(busca ? 'Nenhum cliente encontrado.' : 'Os clientes aparecem aqui automaticamente quando fazem pedidos pelo site.');
  }
  el.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) abrir(ctx, tr.dataset.id, carregar); });
  el.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') abrir(ctx, tr.dataset.id, carregar); });
  let t; $('#bCli', el).addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { busca = e.target.value.trim(); carregar(); }, 250); });
  $('#novoCli').addEventListener('click', () => abrir(ctx, null, carregar));
  await carregar();
  const id = location.hash.split('/')[2];
  if (id) abrir(ctx, id, carregar);
}

async function abrir(ctx, id, aoMudar) {
  const { pb, dono } = ctx;
  let c = { nome: '', whatsapp: '' }, pedidos = [], projetos = [];
  if (id) {
    try {
      [c, pedidos, projetos] = await Promise.all([
        pb.collection('clientes').getOne(id),
        pb.collection('pedidos').getFullList({ filter: pb.filter('cliente = {:id}', { id }), sort: '-created' }),
        pb.collection('projetos').getFullList({ filter: pb.filter('cliente = {:id}', { id }), sort: '-created' }),
      ]);
    } catch (e) { return toast(msgErro(e), 'erro'); }
  }
  const total = projetos.filter(p => p.status !== 'cancelado').reduce((s, p) => s + (p.preco || 0), 0);
  const m = modal({
    titulo: id ? c.nome : 'Novo cliente', largo: !!id,
    corpo: `<div class="${id ? 'det' : ''}">
      <form class="frm" novalidate>
        ${campo('Nome', `<input name="nome" required value="${esc(c.nome)}">`, { full: true })}
        ${campo('WhatsApp', `<input name="whatsapp" type="tel" value="${esc(c.whatsapp || '')}">`)}
        ${campo('E-mail', `<input name="email" type="email" value="${esc(c.email || '')}">`)}
        ${campo('Cidade', `<input name="cidade" value="${esc(c.cidade || '')}">`, { full: true })}
        ${campo('Observações', `<textarea name="obs" rows="3">${esc(c.obs || '')}</textarea>`, { full: true })}
      </form>
      ${id ? `<div class="det-info">
        ${dono && total ? `<p>Total em projetos: <b>${money(total)}</b></p>` : ''}
        <h3>Pedidos (${pedidos.length})</h3>${pedidos.length ? `<ul class="lista">${pedidos.map(p => `<li><a href="#/pedidos/${p.id}"><b>${TIPO_PEDIDO[p.tipo] || p.tipo}</b><span>${dataHora(p.created)}</span>${pilula(STATUS_PEDIDO, p.status)}</a></li>`).join('')}</ul>` : '<p class="dica">Nenhum.</p>'}
        <h3>Projetos (${projetos.length})</h3>${projetos.length ? `<ul class="lista">${projetos.map(p => `<li><a href="#/projetos/${p.id}"><b>${esc(p.titulo)}</b><span>${dataBR(p.created)}${dono && p.preco ? ' · ' + money(p.preco) : ''}</span>${pilula(STATUS_PROJETO, p.status)}</a></li>`).join('')}</ul>` : '<p class="dica">Nenhum.</p>'}
      </div>` : ''}
    </div>`,
    rodape: `${id && dono ? '<button type="button" class="btn btn-perigo esq" data-del>Excluir</button>' : ''}${c.whatsapp ? `<a class="btn btn-wa" href="${waLink(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button type="button" class="btn" data-fechar>Fechar</button><button type="button" class="btn btn-primary" data-salvar>Salvar</button>`,
  });
  m.el.addEventListener('click', e => { if (e.target.closest('.lista a')) m.fechar(); });
  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    if (!d.nome) return toast('Informe o nome.', 'erro');
    d.whatsapp = d.whatsapp.replace(/\D/g, '');
    try { await ocupado(ev.target, () => id ? pb.collection('clientes').update(id, d) : pb.collection('clientes').create(d)); toast('Cliente salvo'); m.fechar(); aoMudar(); }
    catch (e) { toast(msgErro(e), 'erro'); }
  });
  m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir o cadastro deste cliente? Pedidos e projetos continuam, sem o vínculo.', { ok: 'Excluir', perigo: true }))) return;
    try { await pb.collection('clientes').delete(id); toast('Cliente excluído'); m.fechar(); aoMudar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });
}
