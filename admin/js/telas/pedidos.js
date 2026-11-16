/* Pedidos e orçamentos que chegam do site (loja, encomenda, sob consulta, calculadora). */
import { $, $$, esc, money, num, dataHora, foneBR, waLink, toast, msgErro, modal, confirmar, lerForm, ocupado, opcoes, vazio, campo } from '../ui.js';
import { STATUS_PEDIDO, TIPO_PEDIDO, pilula, nomeDe } from '../rotulos.js';

let filtro = 'abertos', busca = '';

export async function render(el, ctx, acoes) {
  const { pb } = ctx;
  acoes.innerHTML = '<button class="btn btn-primary" type="button" id="novoPed">+ Pedido manual</button>';
  el.innerHTML = `<div class="barra">
    <div class="abas" role="tablist">${[['abertos', 'Em aberto'], ...STATUS_PEDIDO, ['todos', 'Todos']].map(([k, t]) => `<button type="button" role="tab" data-f="${k}" aria-selected="${k === filtro}">${t}</button>`).join('')}</div>
    <input type="search" id="bPed" placeholder="Buscar por nome ou WhatsApp" value="${esc(busca)}">
  </div><div id="lista"></div>`;

  async function carregar() {
    const fs = [];
    if (filtro === 'abertos') fs.push('(status = "novo" || status = "em_conversa" || status = "aprovado")');
    else if (filtro !== 'todos') fs.push(`status = "${filtro}"`);
    if (busca) fs.push(pb.filter('(nome ~ {:q} || whatsapp ~ {:q})', { q: busca }));
    const r = await pb.collection('pedidos').getList(1, 100, { filter: fs.join(' && '), sort: '-created' });
    $('#lista', el).innerHTML = r.items.length ? `<div class="tabela-wrap"><table class="tabela">
      <thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Resumo</th><th class="num">Total</th><th>Status</th></tr></thead>
      <tbody>${r.items.map(p => `<tr data-id="${p.id}" tabindex="0">
        <td>${dataHora(p.created)}</td><td><b>${esc(p.nome)}</b><small>${foneBR(p.whatsapp)}</small></td>
        <td>${TIPO_PEDIDO[p.tipo] || p.tipo}${p.arquivos?.length ? ` <span class="pil">${p.arquivos.length} arq.</span>` : ''}</td>
        <td class="resumo">${esc(resumo(p))}</td><td class="num">${p.total ? money(p.total) : '—'}</td><td>${pilula(STATUS_PEDIDO, p.status)}</td>
      </tr>`).join('')}</tbody></table></div>` : vazio('Nenhum pedido aqui.');
  }

  el.addEventListener('click', async e => {
    const aba = e.target.closest('[data-f]');
    if (aba) { filtro = aba.dataset.f; $$('[data-f]', el).forEach(b => b.setAttribute('aria-selected', b === aba)); return carregar(); }
    const tr = e.target.closest('tr[data-id]');
    if (tr) abrir(ctx, tr.dataset.id, carregar);
  });
  el.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') abrir(ctx, tr.dataset.id, carregar); });
  let t; $('#bPed', el).addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { busca = e.target.value.trim(); carregar(); }, 250); });
  $('#novoPed').addEventListener('click', () => manual(ctx, carregar));
  await carregar();
  const id = (location.hash.split('/')[2] || '');
  if (id) abrir(ctx, id, carregar);
}

const resumo = p => {
  if (Array.isArray(p.itens) && p.itens.length) return p.itens.map(i => i.nome ? `${i.qtd || 1}× ${i.nome}` : i.arquivo ? `STL ${i.arquivo}` : '').filter(Boolean).join(', ');
  return (p.mensagem || '').replace(/\s+/g, ' ').slice(0, 90);
};

async function abrir(ctx, id, aoMudar) {
  const { pb } = ctx;
  let p;
  try { p = await pb.collection('pedidos').getOne(id, { expand: 'cliente' }); } catch (e) { return toast(msgErro(e), 'erro'); }
  let token = '';
  if (p.arquivos?.length) { try { token = await pb.files.getToken(); } catch (e) { /* sem token */ } }
  const arqs = (p.arquivos || []).map(f => `<li><a href="${pb.files.getURL(p, f, { token, download: true })}" target="_blank" rel="noopener">${esc(f)}</a></li>`).join('');
  const est = p.estimativa && p.estimativa.min ? `<p class="dica">Estimativa mostrada ao cliente: <b>${money(p.estimativa.min)} a ${money(p.estimativa.max)}</b> · ${num(p.estimativa.gramas)} g · ${num(p.estimativa.horas, 1)} h · ${esc(p.estimativa.material || '')}</p>` : '';
  const itens = Array.isArray(p.itens) && p.itens.length ? `<table class="tabela mini"><thead><tr><th>Item</th><th>Cor / texto</th><th class="num">Qtd</th><th class="num">Preço</th></tr></thead><tbody>${p.itens.map(i => `<tr><td>${esc(i.nome || i.arquivo || '—')}${i.ref ? ` <small>${esc(i.ref)}</small>` : ''}</td><td>${esc([i.cor, i.texto && `“${i.texto}”`, i.material].filter(Boolean).join(' · ') || '—')}</td><td class="num">${i.qtd || 1}</td><td class="num">${i.sob_consulta ? 'consulta' : i.preco ? money(i.preco * (i.qtd || 1)) : '—'}</td></tr>`).join('')}</tbody></table>` : '';
  const m = modal({
    titulo: `${TIPO_PEDIDO[p.tipo] || 'Pedido'} · ${p.nome}`, largo: true,
    corpo: `<div class="det">
      <div class="det-info">
        <p><b>${esc(p.nome)}</b> · ${foneBR(p.whatsapp)}${p.email ? ` · ${esc(p.email)}` : ''}${p.cidade ? ` · ${esc(p.cidade)}` : ''}</p>
        <p class="dica">Recebido em ${dataHora(p.created)} · nº ${p.id.slice(-6).toUpperCase()}${p.expand?.cliente ? ` · cliente <a href="#/clientes/${p.expand.cliente.id}">${esc(p.expand.cliente.nome)}</a>` : ''}</p>
        ${itens}${p.total ? `<p>Total dos itens: <b>${money(p.total)}</b> <small>(sem frete)</small></p>` : ''}
        ${est}
        ${p.mensagem ? `<h3>Mensagem</h3><pre class="msg">${esc(p.mensagem)}</pre>` : ''}
        ${arqs ? `<h3>Arquivos</h3><ul class="arqs">${arqs}</ul>` : ''}
      </div>
      <form class="frm" novalidate>
        ${campo('Status', `<select name="status">${opcoes(STATUS_PEDIDO, p.status)}</select>`, { full: true })}
        ${campo('Anotações internas', `<textarea name="obs_interna" rows="4" placeholder="Valor combinado, prazo, detalhes da conversa…">${esc(p.obs_interna || '')}</textarea>`, { full: true })}
      </form>
    </div>`,
    rodape: `${ctx.dono ? '<button type="button" class="btn btn-perigo esq" data-del>Excluir</button>' : ''}
      <a class="btn btn-wa" href="${waLink(p.whatsapp, `Olá, ${p.nome.split(' ')[0]}! Aqui é da Métricas Vaz 3D, sobre o seu pedido nº ${p.id.slice(-6).toUpperCase()}.`)}" target="_blank" rel="noopener">WhatsApp</a>
      ${p.status !== 'convertido' ? '<button type="button" class="btn" data-proj>Criar projeto</button>' : ''}
      <button type="button" class="btn btn-primary" data-salvar>Salvar</button>`,
  });
  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    try { await ocupado(ev.target, () => pb.collection('pedidos').update(p.id, lerForm(m.form))); toast('Pedido atualizado'); m.fechar(); aoMudar(); }
    catch (e) { toast(msgErro(e), 'erro'); }
  });
  m.el.querySelector('[data-proj]')?.addEventListener('click', async ev => {
    try {
      const proj = await ocupado(ev.target, async () => {
        const titulo = resumo(p) || `Pedido de ${p.nome}`;
        const dados = {
          titulo: titulo.slice(0, 120), cliente: p.cliente || '', pedido: p.id, status: 'orcamento', quantidade: 1,
          itens: p.itens || [], obs: [p.mensagem, p.obs_interna].filter(Boolean).join('\n\n').slice(0, 3000),
        };
        if (ctx.dono && p.total) dados.preco = p.total;
        const r = await pb.collection('projetos').create(dados);
        await pb.collection('pedidos').update(p.id, { status: 'convertido' });
        return r;
      });
      toast('Projeto criado'); m.fechar(); location.hash = `#/projetos/${proj.id}`;
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
  m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir este pedido e os arquivos enviados? Isso não pode ser desfeito.', { ok: 'Excluir', perigo: true }))) return;
    try { await pb.collection('pedidos').delete(p.id); toast('Pedido excluído'); m.fechar(); aoMudar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });
}

function manual(ctx, aoMudar) {
  const m = modal({
    titulo: 'Pedido manual',
    corpo: `<p class="dica">Para pedidos que chegaram pelo Instagram, telefone ou pessoalmente.</p><form class="frm" novalidate>
      ${campo('Nome do cliente', '<input name="nome" required>')}
      ${campo('WhatsApp', '<input name="whatsapp" type="tel" required>')}
      ${campo('Cidade', '<input name="cidade">')}
      ${campo('Status', `<select name="status">${opcoes(STATUS_PEDIDO, 'em_conversa')}</select>`)}
      ${campo('O que o cliente quer', '<textarea name="mensagem" rows="4" required></textarea>', { full: true })}
    </form>`,
    rodape: '<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Salvar</button>',
  });
  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    if (!d.nome || !d.whatsapp) return toast('Informe nome e WhatsApp.', 'erro');
    try {
      // o servidor liga o pedido ao cadastro do cliente (pelo WhatsApp) automaticamente
      await ocupado(ev.target, () => ctx.pb.collection('pedidos').create({ ...d, whatsapp: d.whatsapp.replace(/\D/g, ''), tipo: 'manual' }));
      toast('Pedido criado'); m.fechar(); aoMudar();
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
}
