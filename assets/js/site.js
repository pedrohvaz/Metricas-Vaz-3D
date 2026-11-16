/* Comportamento do site Métricas Vaz 3D (carrinho, catálogo, produto, orçamento).
   As páginas já chegam prontas em HTML; este arquivo só acrescenta interatividade. */
(function () {
'use strict';
const S = window.SITE;
const MV = window.MV;
MV.setCores(S.cores);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = v => brl.format(v).replace(/ /g, ' ');
const P = Object.fromEntries(S.produtos.map(p => [p.id, p]));
const corNome = c => (S.cores[c] || {}).nome || c;
const waLink = msg => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(msg)}`;
const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const thumb = (p, cor, nome) => p.foto ? `<img src="${S.base}${esc(p.foto)}" alt="">` : MV.art(p.art, cor, { nome });
const soDigitos = s => String(s || '').replace(/\D/g, '');
const waValido = s => { const d = soDigitos(s); return d.length >= 10 && d.length <= 13; };

/* ---------- envio de pedidos ao painel (quando o site roda junto do servidor) ----------
   dados: campos do pedido; arquivos: lista de File. Resolve com o registro criado. */
async function enviarPedido(dados, arquivos) {
  if (!S.api) throw new Error('offline');
  const url = `${S.base}api/collections/pedidos/records`;
  let opts;
  if (arquivos && arquivos.length) {
    const fd = new FormData();
    Object.entries(dados).forEach(([k, v]) => { if (v != null) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); });
    arquivos.forEach(f => fd.append('arquivos', f));
    opts = { method: 'POST', body: fd };
  } else {
    opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados), keepalive: true };
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const campo = j.data && Object.values(j.data)[0];
    throw new Error((campo && campo.message) || j.message || 'Não foi possível enviar agora.');
  }
  return j;
}
const protocolo = reg => (reg && reg.id ? reg.id.slice(-6).toUpperCase() : '');
window.MVPedido = { enviar: enviarPedido, waLink, protocolo, waValido, toast: t => toast(t) };

/* ---------- aviso ---------- */
let tt;
function toast(t) { const el = $('#toast'); if (!el) return; el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2400); }

/* ---------- carrinho ---------- */
const KEY = 'mv3d-carrinho';
let cart = [];
try { const c = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(c)) cart = c.filter(i => P[i.id] && S.cores[i.cor]); } catch (e) { }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { } };
const total = () => cart.reduce((s, i) => s + P[i.id].preco * i.qtd, 0);
const cartDlg = $('#cart');

function addToCart(id, cor, nome, qtd) {
  const key = `${id}|${cor}|${nome}`;
  const it = cart.find(i => i.key === key);
  if (it) it.qtd += qtd; else cart.push({ key, id, cor, nome, qtd });
  save(); renderCart(); toast(`${P[id].nome} adicionado ao carrinho`);
}
function renderCart() {
  const n = cart.reduce((s, i) => s + i.qtd, 0);
  $('#cartCount').textContent = n;
  $('#openCart').setAttribute('aria-label', `Abrir carrinho, ${n} ${n === 1 ? 'item' : 'itens'}`);
  if (!cartDlg) return;
  const vazio = !cart.length;
  $('#cartEmpty').hidden = !vazio; $('#checkout').hidden = vazio; $('#cartFoot').hidden = vazio;
  $('#cartTitle').textContent = vazio ? 'Carrinho' : `Carrinho (${n})`;
  $('#cartLines').innerHTML = cart.map(i => {
    const p = P[i.id];
    return `<div class="line">
      <a class="thumb" href="${p.url}">${thumb(p, i.cor, i.nome)}</a>
      <div><h3>${esc(p.nome)}</h3><small>${esc(corNome(i.cor))}${i.nome ? ` · “${esc(i.nome)}”` : ''}</small><small>${money(p.preco)} / un.</small></div>
      <div class="line-r"><b>${money(p.preco * i.qtd)}</b><div class="qty sm" role="group" aria-label="Quantidade de ${esc(p.nome)}"><button type="button" data-cq="-1" data-key="${esc(i.key)}" aria-label="Diminuir">−</button><span>${i.qtd}</span><button type="button" data-cq="1" data-key="${esc(i.key)}" aria-label="Aumentar">+</button></div></div>
    </div>`;
  }).join('');
  $('#cartTotal').textContent = money(total());
  updateCartLink();
}
function cartMessage() {
  const f = $('#checkout');
  const L = [`Olá, ${S.nome}! Gostaria de fazer o seguinte pedido:`, ''];
  cart.forEach(i => { const p = P[i.id]; L.push(`• ${i.qtd}x ${p.nome} (${p.ref}) — ${corNome(i.cor)} — ${money(p.preco * i.qtd)}`); if (i.nome) L.push(`   Texto personalizado: ${i.nome}`); });
  L.push('', `Subtotal: ${money(total())} (frete não incluso)`, '', `Nome: ${$('#c-nome').value.trim() || '—'}`);
  if ($('#c-wa') && $('#c-wa').value.trim()) L.push(`WhatsApp: ${$('#c-wa').value.trim()}`);
  L.push(f.entrega.value === 'correios' ? `Entrega: Correios — CEP ${$('#c-cep').value || '—'}` : 'Entrega: retirada combinada');
  L.push(`Pagamento: ${f.pag.value}`);
  const obs = $('#c-obs').value.trim(); if (obs) L.push(`Observações: ${obs}`);
  return L.join('\n');
}
function updateCartLink() { if (!cart.length || !cartDlg) return; const m = cartMessage(); $('#cartPreview').textContent = m; $('#cartSend').href = waLink(m); }

if (cartDlg) {
  $('#openCart').addEventListener('click', () => { renderCart(); $('#cartOk').hidden = true; cartDlg.showModal(); });
  cartDlg.addEventListener('click', e => {
    const c = e.target.closest('[data-close]');
    if (e.target === cartDlg || c) { cartDlg.close(); if (c && c.dataset.goto) { const l = document.querySelector('#mainNav a[href*="produtos"]'); location.href = l ? l.href : S.base + 'produtos/'; } return; }
    const b = e.target.closest('[data-cq]');
    if (b) { const it = cart.find(i => i.key === b.dataset.key); if (!it) return; it.qtd += +b.dataset.cq; if (it.qtd <= 0) cart = cart.filter(i => i !== it); save(); renderCart(); }
  });
  const cepFmt = v => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
  $('#c-cep').addEventListener('input', e => { e.target.value = cepFmt(e.target.value); });
  $('#checkout').addEventListener('input', () => { updateCartLink(); $('#cartErr').hidden = true; $$('#checkout .invalid').forEach(i => i.classList.remove('invalid')); });
  $('#checkout').addEventListener('change', () => { $('#cepField').hidden = $('#checkout').entrega.value !== 'correios'; updateCartLink(); });
  $('#checkout').addEventListener('submit', e => e.preventDefault());
  $('#cartSend').addEventListener('click', e => {
    const nome = $('#c-nome'), cep = $('#c-cep'), wa = $('#c-wa'); let msg = '';
    if (!nome.value.trim()) { msg = 'Informe seu nome para finalizar o pedido.'; nome.classList.add('invalid'); nome.focus(); }
    else if (wa && !waValido(wa.value)) { msg = 'Informe seu WhatsApp com DDD.'; wa.classList.add('invalid'); wa.focus(); }
    else if ($('#checkout').entrega.value === 'correios' && cep.value.replace(/\D/g, '').length !== 8) { msg = 'Confira o CEP: são 8 números.'; cep.classList.add('invalid'); cep.focus(); }
    if (msg) { e.preventDefault(); $('#cartErr').textContent = msg; $('#cartErr').hidden = false; return; }
    updateCartLink(); $('#cartOk').hidden = false;
    // registra o pedido no painel sem atrasar a abertura do WhatsApp
    if (S.api) {
      const f = $('#checkout');
      enviarPedido({
        tipo: 'loja', nome: nome.value.trim(), whatsapp: wa ? wa.value : '',
        itens: cart.map(i => ({ id: i.id, cor: corNome(i.cor), nome: i.nome, qtd: i.qtd })),
        mensagem: [f.entrega.value === 'correios' ? `Entrega: Correios, CEP ${cep.value}` : 'Entrega: retirada combinada', `Pagamento: ${f.pag.value}`, $('#c-obs').value.trim()].filter(Boolean).join('\n'),
      }).catch(() => { /* o WhatsApp continua sendo o canal principal */ });
    }
  });
}

/* ---------- cards (cor e compra rápida) ---------- */
const cardCor = {};
document.addEventListener('click', e => {
  const dot = e.target.closest('[data-dot]');
  if (dot) {
    const id = dot.dataset.dot, p = P[id], card = dot.closest('.card');
    cardCor[id] = dot.dataset.cor;
    const svg = $('.media .art', card);
    if (svg && !(p.fotos && p.fotos.length)) svg.outerHTML = MV.art(p.art, dot.dataset.cor);
    $$('.dot', card).forEach(d => d.setAttribute('aria-pressed', d === dot));
    return;
  }
  const q = e.target.closest('[data-quick]');
  if (q) { const p = P[q.dataset.quick]; addToCart(p.id, cardCor[p.id] || p.cores[0], '', 1); }
});

/* ---------- página do produto ---------- */
const pdp = $('#produto');
if (pdp) {
  const p = P[pdp.dataset.id];
  const st = { cor: p.cores[0], nome: '', qtd: 1 };
  const desenha = () => { const a = $('#pdpArt'); if (a) a.innerHTML = MV.art(p.art, st.cor, { nome: st.nome }); };
  pdp.addEventListener('change', e => { if (e.target.name === 'pdpCor') { st.cor = e.target.value; $('#pdpCorNome').textContent = '· ' + corNome(st.cor); desenha(); } });
  pdp.addEventListener('input', e => { if (e.target.id === 'pdpNome') { st.nome = e.target.value.trim(); e.target.classList.remove('invalid'); $('#pdpErr').hidden = true; desenha(); } });
  pdp.addEventListener('click', e => {
    const q = e.target.closest('[data-q]');
    if (q) { st.qtd = Math.max(1, Math.min(99, st.qtd + +q.dataset.q)); $('#pdpQtd').textContent = st.qtd; $('#pdpSub').textContent = money(p.preco * st.qtd); return; }
    const f = e.target.closest('[data-foto]');
    if (f) { $('#pdpFoto').src = f.dataset.foto; return; }
    if (e.target.closest('#pdpAdd')) {
      if (p.personalizavel && !st.nome) { const i = $('#pdpNome'); i.classList.add('invalid'); $('#pdpErr').hidden = false; i.focus(); return; }
      addToCart(p.id, st.cor, st.nome, st.qtd);
      if (cartDlg) { renderCart(); $('#cartOk').hidden = true; cartDlg.showModal(); }
    }
  });
}

/* ---------- produto sob consulta: pedido de orçamento ---------- */
const kf = $('#consulta');
if (kf && pdp) {
  const p = P[pdp.dataset.id];
  if (location.hash === '#consulta') setTimeout(() => { kf.scrollIntoView({ block: 'center' }); $('#k-nome').focus(); }, 200);
  let enviadoK = false;
  kf.addEventListener('input', () => { $('#k-err').hidden = true; $$('#consulta .invalid').forEach(i => i.classList.remove('invalid')); });
  kf.addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('#k-nome'), wa = $('#k-wa'), btn = $('#k-enviar');
    const corSel = (pdp.querySelector('input[name="pdpCor"]:checked') || {}).value || p.cores[0];
    const qtd = Math.max(1, Math.min(999, parseInt($('#k-qtd').value, 10) || 1));
    if (!nome.value.trim()) { nome.classList.add('invalid'); nome.focus(); $('#k-err').textContent = 'Informe seu nome.'; $('#k-err').hidden = false; return; }
    if (!waValido(wa.value)) { wa.classList.add('invalid'); wa.focus(); $('#k-err').textContent = 'Informe seu WhatsApp com DDD.'; $('#k-err').hidden = false; return; }
    const texto = `Olá, ${S.nome}! Gostaria de um orçamento: ${qtd}x ${p.nome} (${p.ref}), cor ${corNome(corSel)}.${$('#k-obs').value.trim() ? ' ' + $('#k-obs').value.trim() : ''} Meu nome é ${nome.value.trim()}.`;
    const abrirWA = msg => { $('#k-ok').innerHTML = `<a class="btn btn-wa btn-block" href="${waLink(msg)}" target="_blank" rel="noopener">Continuar no WhatsApp</a>`; $('#k-ok').hidden = false; };
    if (!S.api || enviadoK) { abrirWA(texto); window.open(waLink(texto), '_blank', 'noopener'); return; }
    btn.disabled = true;
    enviarPedido({ tipo: 'consulta', nome: nome.value.trim(), whatsapp: wa.value, itens: [{ id: p.id, cor: corNome(corSel), qtd }], mensagem: $('#k-obs').value.trim() })
      .then(reg => {
        enviadoK = true;
        const n = protocolo(reg);
        abrirWA(`Olá, ${S.nome}! Enviei pelo site um pedido de orçamento (nº ${n}) para ${qtd}x ${p.nome}. Meu nome é ${nome.value.trim()}.`);
        $('#k-ok').insertAdjacentHTML('afterbegin', `<p><b>Pedido nº ${esc(n)} recebido.</b> Respondemos pelo WhatsApp com o valor.</p>`);
      })
      .catch(err => { $('#k-err').textContent = `${err.message} Você também pode chamar no WhatsApp.`; $('#k-err').hidden = false; abrirWA(texto); })
      .finally(() => { btn.disabled = false; });
  });
}

/* ---------- catálogo ---------- */
const grid = $('#catGrid');
if (grid) {
  const cards = $$('.card', grid);
  const cf = { cat: 'todos', mats: new Set(), preco: 'todos', pers: false, q: '', sort: 'rel' };
  const params = new URLSearchParams(location.search);
  if (params.get('categoria') && S.categorias[params.get('categoria')]) cf.cat = params.get('categoria');
  if (params.get('busca')) { cf.q = params.get('busca'); $('#catQ').value = cf.q; }
  const passa = (c, skip) => {
    const d = c.dataset, q = semAcento(cf.q.trim());
    return (skip === 'cat' || cf.cat === 'todos' || d.cat === cf.cat)
      && (skip === 'mat' || !cf.mats.size || cf.mats.has(d.mat))
      && (skip === 'preco' || cf.preco === 'todos' || d.faixa === cf.preco)
      && (!cf.pers || d.pers === '1')
      && (!q || semAcento(d.busca).includes(q));
  };
  const conta = (skip, fn) => cards.filter(c => passa(c, skip) && fn(c)).length;
  const rotulos = { ate30: 'Até R$ 30', '30a60': 'R$ 30 a R$ 60', '60mais': 'Acima de R$ 60' };
  function render() {
    const vis = cards.filter(c => passa(c));
    const ord = [...cards].sort((a, b) => cf.sort === 'asc' ? a.dataset.preco - b.dataset.preco : cf.sort === 'desc' ? b.dataset.preco - a.dataset.preco : cf.sort === 'az' ? a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent, 'pt-BR') : a.dataset.ordem - b.dataset.ordem);
    ord.forEach(c => { c.hidden = !vis.includes(c); grid.appendChild(c); });
    $('#catEmpty').hidden = vis.length > 0;
    $('#catCount').textContent = `${vis.length} ${vis.length === 1 ? 'produto' : 'produtos'}`;
    $('#catTitle').textContent = cf.cat === 'todos' ? 'Todos os produtos' : S.categorias[cf.cat];
    $$('#fCat input').forEach(i => { i.checked = i.value === cf.cat; i.closest('.opt').querySelector('em').textContent = conta('cat', c => i.value === 'todos' || c.dataset.cat === i.value); });
    $$('#fMat input').forEach(i => { i.checked = cf.mats.has(i.value); i.closest('.opt').querySelector('em').textContent = conta('mat', c => c.dataset.mat === i.value); });
    $$('#fPreco input').forEach(i => { i.checked = i.value === cf.preco; i.closest('.opt').querySelector('em').textContent = conta('preco', c => i.value === 'todos' || c.dataset.faixa === i.value); });
    $('#fPers').checked = cf.pers;
    const a = [];
    if (cf.cat !== 'todos') a.push(['cat', S.categorias[cf.cat]]);
    cf.mats.forEach(m => a.push(['mat:' + m, m]));
    if (cf.preco !== 'todos') a.push(['preco', rotulos[cf.preco]]);
    if (cf.pers) a.push(['pers', 'Personalizáveis']);
    if (cf.q.trim()) a.push(['q', `“${cf.q.trim()}”`]);
    $('#activeF').innerHTML = a.length ? a.map(([k, v]) => `<button type="button" class="fchip" data-rm="${esc(k)}" aria-label="Remover filtro ${esc(v)}">${esc(v)} <span aria-hidden="true">×</span></button>`).join('') + '<button type="button" class="linkbtn" data-clear>Limpar filtros</button>' : '';
    const u = new URL(location.href);
    cf.cat === 'todos' ? u.searchParams.delete('categoria') : u.searchParams.set('categoria', cf.cat);
    cf.q.trim() ? u.searchParams.set('busca', cf.q.trim()) : u.searchParams.delete('busca');
    try { history.replaceState(null, '', u); } catch (e) { }
  }
  const limpar = () => { cf.cat = 'todos'; cf.mats.clear(); cf.preco = 'todos'; cf.pers = false; cf.q = ''; $('#catQ').value = ''; render(); };
  $('#filters').addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'fcat') cf.cat = t.value;
    if (t.name === 'fmat') { if (t.checked) cf.mats.add(t.value); else cf.mats.delete(t.value); }
    if (t.name === 'fpreco') cf.preco = t.value;
    if (t.id === 'fPers') cf.pers = t.checked;
    render();
  });
  $('#catQ').addEventListener('input', e => { cf.q = e.target.value; render(); });
  $('#catSort').addEventListener('change', e => { cf.sort = e.target.value; render(); });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-clear]')) { limpar(); return; }
    const r = e.target.closest('[data-rm]');
    if (r) {
      const k = r.dataset.rm;
      if (k === 'cat') cf.cat = 'todos'; else if (k === 'preco') cf.preco = 'todos'; else if (k === 'pers') cf.pers = false;
      else if (k === 'q') { cf.q = ''; $('#catQ').value = ''; } else if (k.startsWith('mat:')) cf.mats.delete(k.slice(4));
      render(); return;
    }
    const t = e.target.closest('#fToggle');
    if (t) { const aberto = $('#filters').classList.toggle('open'); t.setAttribute('aria-expanded', aberto); }
  });
  render();
}

/* ---------- orçamento sob encomenda ---------- */
const qf = $('#quoteForm');
let fotos = [], shareFalhou = false, apiFalhou = false, enviado = false;
const FOTO_MAX = 5, FOTO_MB = 10;
function quoteMessage() {
  const v = id => $(id).value.trim();
  const L = [`Olá, ${S.nome}! Gostaria de um orçamento sob encomenda.`, ''];
  L.push(`Nome: ${v('#q-nome') || '—'}`); if ($('#q-wa') && v('#q-wa')) L.push(`WhatsApp: ${v('#q-wa')}`); if (v('#q-emp')) L.push(`Empresa: ${v('#q-emp')}`);
  L.push(`Descrição: ${v('#q-desc') || '—'}`); if (v('#q-tam')) L.push(`Dimensões: ${v('#q-tam')}`);
  L.push(`Quantidade: ${v('#q-qtd') || '1'}`, `Material: ${v('#q-mat')}`);
  if (v('#q-cor')) L.push(`Cor: ${v('#q-cor')}`); if (v('#q-link')) L.push(`Arquivo: ${v('#q-link')}`); if (v('#q-prazo')) L.push(`Prazo: ${v('#q-prazo')}`);
  if (fotos.length) L.push(`Imagens do projeto: ${fotos.length} (envio nesta conversa)`);
  return L.join('\n');
}
if (qf) {
  // vindo da vitrine "Ideias de Natal": já preenche o modelo escolhido
  const pq = new URLSearchParams(location.search);
  if (pq.get('modelo')) {
    const ref = (pq.get('ref') || '').replace(/[^\w-]/g, '').slice(0, 12);
    $('#q-desc').value = `Quero o modelo "${pq.get('modelo').slice(0, 120)}"${ref ? ` (ref. ${ref})` : ''}. Cor e tamanho: `;
    setTimeout(() => { qf.scrollIntoView({ block: 'start' }); $('#q-nome').focus(); }, 150);
  }
  const LABEL_TEXTO = $('#quoteSendTxt').textContent, LABEL_FOTOS = 'Enviar orçamento com imagens';
  const updateQuoteLink = () => { $('#quoteSend').href = waLink(quoteMessage()); };
  const podeCompartilhar = () => { try { return !shareFalhou && fotos.length > 0 && !!navigator.canShare && navigator.canShare({ files: fotos.map(f => f.file) }); } catch (e) { return false; } };
  const renderFotos = () => {
    $('#thumbs').innerHTML = fotos.map((f, i) => `<li>${f.url ? `<img src="${f.url}" alt="Imagem do projeto ${i + 1}">` : `<span class="arq" title="${esc(f.nome)}">${ICONE_ARQ}<small>${esc(f.nome.split('.').pop().toUpperCase())}</small></span>`}<button type="button" data-rmfoto="${i}" aria-label="Remover imagem ${i + 1}">×</button></li>`).join('');
    $('#fotoCount').textContent = fotos.length ? `${fotos.length} de ${FOTO_MAX} imagens selecionadas` : '';
    $('#quoteSendTxt').textContent = podeCompartilhar() ? LABEL_FOTOS : LABEL_TEXTO;
  };
  const MODELO = /\.(stl|obj|3mf|step|stp|pdf)$/i;
  const ICONE_ARQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>';
  if (S.api && $('#dropInfo')) $('#dropInfo').textContent = 'Fotos, desenhos ou o arquivo 3D · JPG, PNG, STL, OBJ, 3MF, STEP, PDF · imagens até 10 MB, arquivos 3D até 50 MB';
  const addFotos = list => {
    let aviso = '';
    for (const f of list) {
      if (fotos.length >= FOTO_MAX) { aviso = `Limite de ${FOTO_MAX} arquivos.`; break; }
      const ehModelo = S.api && MODELO.test(f.name);
      if (!f.type.startsWith('image/') && !ehModelo) { aviso = S.api ? `${f.name}: envie imagem, STL, OBJ, 3MF, STEP ou PDF.` : `${f.name} não é uma imagem.`; continue; }
      const limite = ehModelo ? 50 : FOTO_MB;
      if (f.size > limite * 1024 * 1024) { aviso = `${f.name} excede ${limite} MB.`; continue; }
      fotos.push({ file: f, url: ehModelo ? '' : URL.createObjectURL(f), nome: f.name });
    }
    shareFalhou = false; renderFotos(); updateQuoteLink(); if (aviso) toast(aviso);
  };
  const fi = $('#q-fotos'), drop = $('#drop');
  fi.addEventListener('change', () => { addFotos([...fi.files]); fi.value = ''; });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); addFotos([...e.dataTransfer.files]); });
  $('#thumbs').addEventListener('click', e => { const b = e.target.closest('[data-rmfoto]'); if (!b) return; const [f] = fotos.splice(+b.dataset.rmfoto, 1); if (f.url) URL.revokeObjectURL(f.url); renderFotos(); updateQuoteLink(); });
  qf.addEventListener('input', () => { updateQuoteLink(); $('#quoteErr').hidden = true; $$('#quoteForm .invalid').forEach(i => i.classList.remove('invalid')); });
  qf.addEventListener('submit', e => e.preventDefault());
  $('#quoteSend').addEventListener('click', e => {
    const n = $('#q-nome'), d = $('#q-desc'), wa = $('#q-wa'); let msg = '';
    if (!n.value.trim()) { msg = 'Informe seu nome.'; n.classList.add('invalid'); n.focus(); }
    else if (wa && !waValido(wa.value)) { msg = 'Informe seu WhatsApp com DDD.'; wa.classList.add('invalid'); wa.focus(); }
    else if (d.value.trim().length < 5) { msg = 'Descreva a peça que você precisa.'; d.classList.add('invalid'); d.focus(); }
    if (msg) { e.preventDefault(); $('#quoteErr').textContent = msg; $('#quoteErr').hidden = false; return; }
    // Com o servidor: os arquivos vão direto para o painel e o WhatsApp vira só a continuação da conversa
    if (S.api && !apiFalhou && !enviado) {
      e.preventDefault();
      const btn = $('#quoteSend'); btn.classList.add('loading'); btn.setAttribute('aria-disabled', 'true'); $('#quoteSendTxt').textContent = 'Enviando…';
      enviarPedido({ tipo: 'encomenda', nome: n.value.trim(), whatsapp: wa.value, mensagem: quoteMessage() }, fotos.map(f => f.file))
        .then(reg => {
          enviado = true;
          const p = protocolo(reg);
          const m = `Olá, ${S.nome}! Acabei de enviar um pedido de orçamento pelo site (nº ${p}). Meu nome é ${n.value.trim()}.`;
          btn.href = waLink(m); $('#quoteSendTxt').textContent = 'Continuar no WhatsApp';
          $('#quoteOk').innerHTML = `<b>Pedido nº ${esc(p)} recebido.</b> ${fotos.length ? 'Seus arquivos chegaram para a nossa equipe. ' : ''}Respondemos pelo WhatsApp no horário de atendimento. Se quiser adiantar a conversa, toque em “Continuar no WhatsApp”.`;
          $('#quoteOk').hidden = false; $('#quoteFotoTip').hidden = true;
        })
        .catch(err => {
          apiFalhou = true; renderFotos();
          $('#quoteErr').textContent = `${err.message} Toque no botão de novo para enviar pelo WhatsApp.`; $('#quoteErr').hidden = false;
        })
        .finally(() => { btn.classList.remove('loading'); btn.removeAttribute('aria-disabled'); });
      return;
    }
    if (enviado) return; // o link já aponta para a conversa com o número do pedido
    if (podeCompartilhar()) {
      e.preventDefault();
      navigator.share({ files: fotos.map(f => f.file), text: quoteMessage() })
        .then(() => toast('Pedido de orçamento enviado'))
        .catch(err => {
          if (err && err.name === 'AbortError') return;
          shareFalhou = true; renderFotos();
          $('#quoteErr').textContent = 'Não foi possível enviar as imagens por aqui. Toque no botão novamente para abrir o WhatsApp com o texto e anexe as imagens na conversa.';
          $('#quoteErr').hidden = false;
        });
      return;
    }
    updateQuoteLink(); $('#quoteOk').hidden = false; $('#quoteFotoTip').hidden = !fotos.length;
  });
  updateQuoteLink();
}

/* ---------- copiar, rolagem e geral ---------- */
async function copyText(text, el) {
  try { await navigator.clipboard.writeText(text); toast('Copiado'); }
  catch (e) { if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Texto selecionado. Use a opção copiar do seu aparelho.'); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]');
  if (b) {
    const k = b.dataset.copy;
    if (k === 'phone') copyText(S.whatsapp_exibir, b.previousElementSibling);
    if (k === 'cart') { $('.preview-wrap').open = true; copyText(cartMessage(), $('#cartPreview')); }
    if (k === 'quote') copyText(quoteMessage(), null);
    return;
  }
  const s = e.target.closest('[data-scrollto]');
  if (s) { const el = document.getElementById(s.dataset.scrollto); if (el) el.scrollIntoView(); }
});
$$('.wa-num').forEach(el => { el.textContent = S.whatsapp_exibir; });

/* ---------- modo claro / escuro ---------- */
const root = document.documentElement, themeBtn = $('#themeBtn');
function aplicaTema(t) {
  const claro = t === 'light';
  root.setAttribute('data-theme', claro ? 'light' : 'dark');
  if (themeBtn) themeBtn.setAttribute('aria-label', claro ? 'Ativar modo escuro' : 'Ativar modo claro');
  const tc = $('#themeColor'); if (tc) tc.content = claro ? '#FFFFFF' : '#0C0C0D';
}
aplicaTema(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
if (themeBtn) themeBtn.addEventListener('click', () => {
  const novo = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  aplicaTema(novo);
  try { localStorage.setItem('mv3d-tema', novo); } catch (e) { }
});

/* ---------- menu no celular ---------- */
const menuBtn = $('#menuBtn'), nav = $('#mainNav');
function menu(abrir) {
  if (!menuBtn) return;
  nav.classList.toggle('open', abrir);
  menuBtn.setAttribute('aria-expanded', abrir);
  menuBtn.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
}
if (menuBtn) {
  menuBtn.addEventListener('click', () => { const abrir = !nav.classList.contains('open'); menu(abrir); if (abrir) { const a = nav.querySelector('a'); if (a) a.focus(); } });
  nav.addEventListener('click', e => { if (e.target.closest('a')) menu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { menu(false); menuBtn.focus(); } });
  document.addEventListener('click', e => { if (nav.classList.contains('open') && !e.target.closest('#mainNav') && !e.target.closest('#menuBtn')) menu(false); });
  matchMedia('(min-width: 1201px)').addEventListener('change', e => { if (e.matches) menu(false); });
}
renderCart();
})();
