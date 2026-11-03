/* Gerador do site Métricas Vaz 3D.
   Uso: node src/build.js   →   gera a pasta dist/ pronta para publicar.
   Não precisa instalar nada além do Node.js (versão 18 ou mais nova). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ARGS = process.argv.slice(2);
const SAIDA = (ARGS.find(a => a.startsWith('--saida=')) || '--saida=dist').split('=')[1];
const DIST = path.join(ROOT, SAIDA);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const site = JSON.parse(read('data/site.json'));
const loja = JSON.parse(read('data/produtos.json'));
const MV = require('./art.js');
MV.setCores(loja.cores);

/* ---------- utilidades ---------- */
/* Links: no modo normal usam site.base (ex.: "/"). Com --relativo, cada página usa caminhos
   relativos e links terminados em index.html, para abrir o site direto do computador,
   em pré-visualizações ou no GitHub Pages sem domínio. */
const RELATIVO = ARGS.includes('--relativo') || site.base === './';
const B = '__BASE__/';
function ajustaLinks(html, pagina) {
  const prof = pagina.endsWith('.html') ? 0 : pagina.split('/').filter(Boolean).length;
  const prefixo = RELATIVO ? '../'.repeat(prof) : (site.base || '/');
  html = html.replace(/__PREFIXO__/g, prefixo);
  if (RELATIVO) html = html.replace(/__BASE__\/((?:[\w-]+\/)*)(?=["'?#<\s])/g, (m, dir) => prefixo + dir + 'index.html');
  return html.replace(/__BASE__\//g, prefixo);
}
const SITE_URL = (site.url || '').trim();
const absUrl = p => SITE_URL ? SITE_URL.replace(/\/+$/, '') + '/' + String(p).replace(/^\/+/, '') : '';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = v => brl.format(v).replace(/ /g, ' ');
const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let pendencias = new Set();
const todo = html => String(html).replace(/\[PREENCHER:?([^\]]*)\]/g, (m, t) => { pendencias.add(t.trim()); return `<mark class="todo">${m}</mark>`; });
const isTodo = s => !s || /\[PREENCHER/.test(s);
const waLink = msg => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(msg)}`;

const CAT = loja.categorias;
const produtos = loja.produtos.map((p, i) => ({ ...p, slug: slugify(p.nome), ordem: i, fotos: p.fotos || [] }));
produtos.forEach(p => { p.url = `${B}produtos/${p.slug}/`; p.path = `produtos/${p.slug}/`; });
const P = Object.fromEntries(produtos.map(p => [p.id, p]));
const matFam = p => /resina/i.test(p.material) ? 'Resina' : /petg/i.test(p.material) ? 'PETG' : /tpu/i.test(p.material) ? 'TPU' : 'PLA';
const faixa = p => p.preco <= 30 ? 'ate30' : p.preco <= 60 ? '30a60' : '60mais';
const camada = p => /resina/i.test(p.material) ? '0,05 mm' : '0,2 mm';
const imgProduto = p => p.fotos.length ? `assets/img/produtos/${p.fotos[0]}` : `assets/img/produtos/${p.slug}.png`;

const LINKS = { topo: '', inicio: '', produtos: 'produtos/', encomenda: 'encomenda/', duvidas: 'duvidas/', materiais: '#materiais' };
const fixLinks = html => html.replace(/href="#([a-z][\w-]*)"/g, (m, id) => id in LINKS ? `href="${B}${LINKS[id]}"` : m);
const partial = n => fixLinks(read(`src/partials/${n}.html`));

/* ---------- blocos comuns ---------- */
const ICON = {
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#wa-ico"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};
const NAV = [['produtos/', 'Produtos'], ['encomenda/', 'Sob encomenda'], ['sobre/', 'Sobre'], ['duvidas/', 'Dúvidas']];

function header(atual) {
  return `<div class="topbar"><div class="wrap">
  <span>Envio para todo o Brasil</span><span>Pix ou cartão de crédito</span><span>Atendimento pelo WhatsApp</span>
</div></div>
<header class="site-header">
  <div class="wrap hdr">
    <a class="brand" href="${B}" aria-label="${esc(site.nome)}, página inicial">
      <img class="logo" src="${B}assets/img/logo-128.webp" alt="" width="46" height="46">
      <span><b>${esc(site.nome)}</b><small>${esc(site.slogan)}</small></span>
    </a>
    <nav class="nav" id="mainNav" aria-label="Principal">
      <a href="${B}" class="nav-home"${atual === '' ? ' aria-current="page"' : ''}>Início</a>
      ${NAV.map(([h, t]) => `<a href="${B}${h}"${atual === h ? ' aria-current="page"' : ''}>${t}</a>`).join('\n      ')}
    </nav>
    <div class="hdr-actions">
      <button class="icon-btn theme-btn" id="themeBtn" type="button" aria-label="Ativar modo claro" title="Modo claro / escuro">
        <svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
        <svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>
      </button>
      <button class="btn cart-btn" id="openCart" type="button" aria-label="Abrir carrinho">
        ${ICON.cart}
        <span class="cart-lbl">Carrinho</span> <span class="count" id="cartCount">0</span>
      </button>
      <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="mainNav">
        <svg class="ico-bars" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        <svg class="ico-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
  </div>
</header>`;
}

function redes() {
  const r = site.redes || {};
  const itens = [['instagram', 'Instagram', u => `https://www.instagram.com/${u}/`], ['tiktok', 'TikTok', u => `https://www.tiktok.com/@${u}`], ['facebook', 'Facebook', u => `https://www.facebook.com/${u}`]]
    .filter(([k]) => r[k] && !r[k].startsWith('_'));
  return itens.map(([k, n, f]) => `<li><a href="${f(r[k].replace(/^@/, ''))}" target="_blank" rel="noopener">${n} @${esc(r[k].replace(/^@/, ''))}</a></li>`).join('');
}

function footer() {
  const e = site.empresa;
  const rd = redes();
  return `<footer class="footer">
  <div class="wrap">
    <div class="foot">
      <div>
        <a class="brand" href="${B}"><img class="logo" src="${B}assets/img/logo-256.webp" alt="Logotipo MV 3D" width="88" height="88" loading="lazy"><span><b>${esc(site.nome)}</b><small>${esc(site.slogan)}</small></span></a>
        <p style="margin-top:16px;max-width:30em">Impressão 3D de decoração, colecionáveis, brinquedos e projetos sob encomenda, com envio para todo o Brasil.</p>
      </div>
      <div><h4>Loja</h4><ul><li><a href="${B}produtos/">Produtos</a></li><li><a href="${B}encomenda/">Sob encomenda</a></li><li><a href="${B}#materiais">Materiais</a></li><li><a href="${B}sobre/">Sobre</a></li></ul></div>
      <div><h4>Ajuda</h4><ul><li><a href="${B}duvidas/">Dúvidas frequentes</a></li><li><a href="${B}trocas/">Trocas e devoluções</a></li><li><a href="${B}privacidade/">Privacidade</a></li></ul></div>
      <div><h4>Contato</h4><p style="margin-bottom:6px">WhatsApp</p><div class="phone"><b class="wa-num">${esc(site.whatsapp_exibir)}</b><button class="copy" type="button" data-copy="phone">Copiar</button></div>
        <p style="margin-top:12px">${esc(site.horario)}</p>
        ${isTodo(e.email) ? `<p>${todo(e.email)}</p>` : `<p><a href="mailto:${esc(e.email)}">${esc(e.email)}</a></p>`}
        ${rd ? `<ul style="margin-top:12px">${rd}</ul>` : ''}
      </div>
    </div>
    <div class="legal">
      <span>© <span id="year">${new Date().getFullYear()}</span> ${todo(esc(e.razao_social))} · ${todo(esc(e.documento))} · ${todo(esc(e.cidade_uf))}${e.endereco ? ' · ' + esc(e.endereco) : ''}</span>
      <span>Imagens ilustrativas. Pode haver pequenas variações de tom entre lotes de filamento.</span>
    </div>
  </div>
</footer>`;
}

function layout({ path: p, titulo, descricao, conteudo, nav = '', jsonld = [], ogImage = 'og-image.png', extraHead = '' }) {
  const canonical = absUrl(p);
  const og = SITE_URL ? absUrl(ogImage) : B + ogImage;
  const dados = {
    base: '__PREFIXO__', whatsapp: site.whatsapp, whatsapp_exibir: site.whatsapp_exibir, nome: site.nome,
    cores: loja.cores, categorias: CAT,
    produtos: produtos.map(x => ({ id: x.id, ref: x.ref, nome: x.nome, preco: x.preco, art: x.art, cores: x.cores, personalizavel: !!x.personalizavel, url: x.url, fotos: x.fotos })),
  };
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>try{var t=localStorage.getItem('mv3d-tema');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
${canonical ? `<link rel="canonical" href="${canonical}">\n` : ''}<meta name="theme-color" content="#07060C" id="themeColor">
<link rel="icon" href="${B}favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="${B}favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="${B}apple-touch-icon.png">
<link rel="manifest" href="${B}site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${esc(site.nome)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:image" content="${og}">
${canonical ? `<meta property="og:url" content="${canonical}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Caveat:wght@700&display=swap">
<link rel="stylesheet" href="${B}assets/css/site.css">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
${extraHead}
</head>
<body>
${header(nav)}
${read('src/partials/defs.html')}
<main id="topo">
${conteudo}
</main>
${footer()}
<a class="wa-float" id="waFloat" href="${waLink(`Olá, ${site.nome}! Vim pelo site e gostaria de tirar uma dúvida.`)}" target="_blank" rel="noopener" aria-label="Falar com a ${esc(site.nome)} no WhatsApp">${ICON.wa}</a>
${partial('cart')}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>window.SITE=${JSON.stringify(dados)};</script>
<script src="${B}assets/js/art.js"></script>
<script src="${B}assets/js/site.js"></script>
</body>
</html>
`;
}

const crumbs = itens => `<nav class="crumbs mono" aria-label="Você está em">${itens.map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join(' / ')}</nav>`;
const crumbsLd = itens => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: itens.map(([t, h], i) => ({ '@type': 'ListItem', position: i + 1, name: t, ...(h || i === itens.length - 1 ? { item: SITE_URL ? absUrl((h || '').replace(B, '')) : undefined } : {}) })) });
const pageHero = (itens, h1, lead, extra = '', id = 'pageTitle') => `<div class="cat-hero"><div class="wrap">
  ${crumbs(itens)}
  <h1 id="${id}">${h1}</h1>
  ${lead ? `<p>${lead}</p>` : ''}
  ${extra}
</div></div>`;

function card(p) {
  const cor = p.cores[0];
  const media = p.fotos.length
    ? `<img src="${B}assets/img/produtos/${esc(p.fotos[0])}" alt="${esc(p.nome)}" loading="lazy" width="600" height="600">`
    : MV.art(p.art, cor);
  return `<article class="card" data-id="${p.id}" data-cat="${p.cat}" data-mat="${matFam(p)}" data-faixa="${faixa(p)}" data-preco="${p.preco}" data-pers="${p.personalizavel ? 1 : 0}" data-ordem="${p.ordem}" data-busca="${esc((p.nome + ' ' + p.material + ' ' + CAT[p.cat] + ' ' + p.desc).toLowerCase())}">
    <a class="media" href="${p.url}" aria-label="Ver ${esc(p.nome)}" tabindex="-1">${p.tag ? `<span class="badge">${esc(p.tag)}</span>` : ''}${media}</a>
    <div class="info">
      <span class="label">${esc(CAT[p.cat])}</span>
      <h3><a href="${p.url}">${esc(p.nome)}</a></h3>
      <span class="meta">${esc(p.material)} · ${esc(p.tamanho)}</span>
      <div class="pricerow"><span class="price">${money(p.preco)}</span>
        <div class="dots" role="group" aria-label="Cores de ${esc(p.nome)}">${p.cores.map(c => `<button class="dot" type="button" style="--c:${loja.cores[c].hex}" data-dot="${p.id}" data-cor="${c}" aria-pressed="${c === cor}" title="${esc(loja.cores[c].nome)}"><span class="sr">${esc(loja.cores[c].nome)}</span></button>`).join('')}</div>
      </div>
      ${p.personalizavel ? `<a class="add" href="${p.url}">Personalizar</a>` : `<button class="add" type="button" data-quick="${p.id}">Adicionar ao carrinho</button>`}
    </div>
  </article>`;
}

const orgLd = () => {
  const e = site.empresa, o = { '@context': 'https://schema.org', '@type': 'Store', name: site.nome, description: 'Impressão 3D de decoração, colecionáveis, brinquedos e peças sob encomenda.', telephone: '+' + site.whatsapp, priceRange: 'R$' };
  if (SITE_URL) { o.url = absUrl(''); o.logo = absUrl('assets/img/logo-512.webp'); o.image = absUrl('og-image.png'); }
  if (!isTodo(e.email)) o.email = e.email;
  if (!isTodo(e.razao_social)) o.legalName = e.razao_social;
  if (!isTodo(e.cidade_uf)) o.address = { '@type': 'PostalAddress', addressLocality: e.cidade_uf.split('/')[0].trim(), addressRegion: (e.cidade_uf.split('/')[1] || '').trim(), addressCountry: 'BR' };
  const r = site.redes || {};
  const same = [r.instagram && `https://www.instagram.com/${r.instagram}/`, r.tiktok && `https://www.tiktok.com/@${r.tiktok}`, r.facebook && `https://www.facebook.com/${r.facebook}`].filter(Boolean);
  if (same.length) o.sameAs = same;
  return o;
};

/* ---------- páginas ---------- */
const paginas = [];
const add = (p, html) => paginas.push([p, html]);

// Início
(function () {
  let hero = partial('hero')
    .replace('<div id="heroArt"></div>', MV.art('dragon', 'roxo'))
    .replace(/<button class="btn btn-primary" type="button" data-open="dragao"([^>]*)>Ver<\/button>/, `<a class="btn btn-primary" href="${P.dragao ? P.dragao.url : B + 'produtos/'}"$1>Ver</a>`);
  const destaques = loja.destaques.filter(id => P[id]).map(id => card(P[id])).join('');
  const make = partial('make').replace('<figure class="scene" id="makeScene"></figure>', `<figure class="scene" id="makeScene">${MV.cenaProcesso('#9B30FF')}</figure>`);
  const kinds = partial('kinds').replace('<div class="kinds-grid" id="kindsGrid"></div>', `<div class="kinds-grid" id="kindsGrid">${site.tipos.map(t => `<a class="kind" href="${t.cat ? `${B}produtos/?categoria=${t.cat}` : `${B}encomenda/`}">
  <div class="kind-img">${MV.art(t.art, '#B9BEC9')}</div>
  <div class="kind-body"><h3>${esc(t.titulo)}</h3><p>${esc(t.texto)}</p>
    <ul class="pills">${t.tags.map(x => `<li>${ICON.check}${esc(x)}</li>`).join('')}</ul>
    <span class="kind-more">${esc(t.link_texto)} <span aria-hidden="true">→</span></span></div>
</a>`).join('')}</div>`);
  const meter = n => `<span class="meter" role="img" aria-label="${n} de 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const materiais = partial('materiais').replace('<tbody id="matRows"></tbody>', `<tbody id="matRows">${loja.materiais.map(m => `<tr><th scope="row"><i style="--c:${m.cor}"></i>${esc(m.nome)}</th><td>${meter(m.res)}</td><td>${meter(m.det)}</td><td class="num">${esc(m.camada)}</td><td class="num">${esc(m.temp)}</td><td>${esc(m.uso)}</td></tr>`).join('')}</tbody>`);
  const faq = site.faq.loja.slice(0, 4);
  const conteudo = `${hero}
${partial('assure')}
  <section class="section" id="destaques">
    <div class="wrap">
      <div class="head">
        <div><span class="label">Destaques</span><h2>Mais pedidos</h2><p>Escolha a cor do filamento em cada peça. Os valores não incluem o frete.</p></div>
        <a class="btn" href="${B}produtos/">Ver todos os ${produtos.length} produtos</a>
      </div>
      <div class="grid">${destaques}</div>
    </div>
  </section>
${make}
${kinds}
${partial('teaser')}
${materiais}
  <section class="section alt" id="duvidas">
    <div class="wrap faq-grid">
      <div>
        <span class="label">Suporte</span>
        <h2 class="h2">Perguntas frequentes</h2>
        <div class="contact-box">
          <p>Não encontrou a resposta? Veja todas as dúvidas ou fale com a gente.</p>
          <div style="display:flex;flex-wrap:wrap;gap:10px"><a class="btn" href="${B}duvidas/">Todas as dúvidas</a><a class="btn btn-wa" href="${waLink(`Olá, ${site.nome}! Tenho uma dúvida sobre os produtos.`)}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a></div>
        </div>
      </div>
      <div class="faq">${faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.pergunta)}</summary><p>${f.resposta}</p></details>`).join('')}</div>
    </div>
  </section>`;
  add('', layout({
    path: '', nav: '', titulo: `${site.nome} | Impressão 3D sob encomenda e pronta entrega`,
    descricao: 'Peças impressas em 3D com acabamento de estúdio: decoração, colecionáveis, brinquedos articulados e projetos sob encomenda. Pedido pelo WhatsApp e envio para todo o Brasil.',
    conteudo, jsonld: [orgLd()],
  }));
})();

// Catálogo
(function () {
  const conta = fn => produtos.filter(fn).length;
  const MATS = [...new Set(produtos.map(matFam))];
  const PRECOS = [['todos', 'Qualquer preço', () => true], ['ate30', 'Até R$ 30', p => faixa(p) === 'ate30'], ['30a60', 'R$ 30 a R$ 60', p => faixa(p) === '30a60'], ['60mais', 'Acima de R$ 60', p => faixa(p) === '60mais']];
  const opt = (type, name, value, label, n, checked) => `<label class="opt"><input type="${type}" name="${name}" value="${value}"${checked ? ' checked' : ''}><span>${esc(label)}</span><em>${n}</em></label>`;
  const conteudo = `<section class="catalog" aria-labelledby="catTitle">
  ${pageHero([['Início', B], ['Produtos']], 'Todos os produtos', 'Cada peça é impressa depois do pedido, na cor que você escolher. Os valores não incluem o frete.', '', 'catTitle')}
  <div class="wrap cat-layout">
    <aside class="filters" id="filters" aria-label="Filtros">
      <div class="f-head"><h2>Filtros</h2><button class="linkbtn" type="button" data-clear>Limpar</button></div>
      <fieldset><legend>Categoria</legend><div id="fCat">${opt('radio', 'fcat', 'todos', 'Todas', produtos.length, true)}${Object.entries(CAT).map(([k, v]) => opt('radio', 'fcat', k, v, conta(p => p.cat === k))).join('')}</div></fieldset>
      <fieldset><legend>Material</legend><div id="fMat">${MATS.map(m => opt('checkbox', 'fmat', m, m, conta(p => matFam(p) === m))).join('')}</div></fieldset>
      <fieldset><legend>Preço</legend><div id="fPreco">${PRECOS.map(([k, v, f], i) => opt('radio', 'fpreco', k, v, conta(f), i === 0)).join('')}</div></fieldset>
      <fieldset><legend>Personalização</legend><label class="opt"><input type="checkbox" id="fPers"><span>Com nome personalizado</span></label></fieldset>
    </aside>
    <div class="cat-main">
      <div class="cat-bar">
        <button class="btn f-toggle" id="fToggle" type="button" aria-expanded="false" aria-controls="filters"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtros</button>
        <p class="cat-count" id="catCount" aria-live="polite">${produtos.length} produtos</p>
        <div class="cat-tools">
          <label class="search"><span class="sr">Buscar produto</span>${ICON.search}<input id="catQ" type="search" placeholder="Buscar produto" autocomplete="off"></label>
          <label><span class="sr">Ordenar</span><select id="catSort"><option value="rel">Destaques</option><option value="asc">Menor preço</option><option value="desc">Maior preço</option><option value="az">Nome (A–Z)</option></select></label>
        </div>
      </div>
      <div class="active-f" id="activeF"></div>
      <div class="grid cat-grid" id="catGrid">${produtos.map(card).join('')}</div>
      <div class="none" id="catEmpty" hidden><p>Nenhum produto com esses filtros.</p><p><button type="button" class="btn" data-clear>Limpar filtros</button></p><p>Não achou o que procura? <a href="${B}encomenda/">Peça sob encomenda</a>.</p></div>
    </div>
  </div>
</section>`;
  const lista = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: produtos.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.nome, ...(SITE_URL ? { url: absUrl(p.path) } : {}) })) };
  add('produtos/', layout({ path: 'produtos/', nav: 'produtos/', titulo: `Produtos impressos em 3D | ${site.nome}`, descricao: `Catálogo com ${produtos.length} peças impressas em 3D: decoração, miniaturas de RPG, brinquedos articulados e presentes personalizados. Escolha a cor e peça pelo WhatsApp.`, conteudo, jsonld: [lista, crumbsLd([['Início', B], ['Produtos', B + 'produtos/']])] }));
})();

// Página de cada produto
for (const p of produtos) {
  const cor = p.cores[0];
  const itens = [['Início', B], ['Produtos', B + 'produtos/'], [CAT[p.cat], `${B}produtos/?categoria=${p.cat}`], [p.nome]];
  const media = p.fotos.length
    ? `<div class="pdp-gallery"><img id="pdpFoto" src="${B}assets/img/produtos/${esc(p.fotos[0])}" alt="${esc(p.nome)}" width="1000" height="1000">${p.fotos.length > 1 ? `<div class="pdp-thumbs">${p.fotos.map((f, i) => `<button type="button" data-foto="${B}assets/img/produtos/${esc(f)}" aria-label="Foto ${i + 1}"><img src="${B}assets/img/produtos/${esc(f)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>`
    : `<div class="pdp-art" id="pdpArt">${MV.art(p.art, cor)}</div><span class="label corner">Ref. ${esc(p.ref)} · ${esc(p.tamanho)}</span>`;
  const relacionados = [...produtos.filter(x => x.cat === p.cat && x.id !== p.id), ...produtos.filter(x => x.cat !== p.cat)].slice(0, 4);
  const conteudo = `<div class="cat-hero slim"><div class="wrap">${crumbs(itens)}</div></div>
<section class="section pdp">
  <div class="wrap pdp-grid" id="produto" data-id="${p.id}">
    <div class="pdp-media">${media}</div>
    <div class="pdp-info">
      <span class="label">${esc(CAT[p.cat])} · Ref. ${esc(p.ref)}</span>
      <h1>${esc(p.nome)}</h1>
      <div class="pm-price">${money(p.preco)}<small>frete calculado pelo CEP</small></div>
      <p class="pm-desc">${esc(p.desc)}</p>
      <fieldset class="swatches"><legend>Cor <span id="pdpCorNome">· ${esc(loja.cores[cor].nome)}</span></legend>
        ${p.cores.map(c => `<label class="sw" style="--c:${loja.cores[c].hex}"><input type="radio" name="pdpCor" value="${c}"${c === cor ? ' checked' : ''}><i></i>${esc(loja.cores[c].nome)}</label>`).join('')}
      </fieldset>
      ${p.personalizavel ? `<div class="field"><label for="pdpNome">Texto personalizado <small>(até 10 caracteres)</small></label><input id="pdpNome" maxlength="10" autocomplete="off" placeholder="Ex.: MARIANA"><p class="err" id="pdpErr" hidden>Informe o texto que vai na peça.</p></div>` : ''}
      <dl class="tech">
        <div><dt>Material</dt><dd>${esc(p.material)}</dd></div>
        <div><dt>Dimensão</dt><dd>${esc(p.tamanho)}</dd></div>
        <div><dt>Tempo de impressão</dt><dd>${esc(p.tempo)}</dd></div>
        <div><dt>Altura de camada</dt><dd>${camada(p)}</dd></div>
      </dl>
      <div class="buyrow">
        <div class="qty" role="group" aria-label="Quantidade"><button type="button" data-q="-1" aria-label="Diminuir">−</button><span id="pdpQtd">1</span><button type="button" data-q="1" aria-label="Aumentar">+</button></div>
        <button class="btn btn-primary" type="button" id="pdpAdd">Adicionar · <span id="pdpSub">${money(p.preco)}</span></button>
      </div>
      <ul class="pdp-notes">
        <li>Produzido depois do pedido · ${esc(site.prazo_producao)} de produção</li>
        <li>Envio pelos Correios para todo o Brasil</li>
        <li>Quer outro tamanho ou cor? <a href="${B}encomenda/">Peça sob encomenda</a></li>
      </ul>
    </div>
  </div>
</section>
<section class="section alt">
  <div class="wrap">
    <div class="head"><div><span class="label">Veja também</span><h2>Você também pode gostar</h2></div><a class="btn" href="${B}produtos/">Ver todos</a></div>
    <div class="grid">${relacionados.map(card).join('')}</div>
  </div>
</section>`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.nome, description: p.desc, sku: p.ref, category: CAT[p.cat], material: p.material,
    brand: { '@type': 'Brand', name: site.nome },
    image: SITE_URL ? absUrl(imgProduto(p)) : B + imgProduto(p),
    offers: { '@type': 'Offer', price: p.preco.toFixed(2), priceCurrency: 'BRL', availability: 'https://schema.org/MadeToOrder', itemCondition: 'https://schema.org/NewCondition', ...(SITE_URL ? { url: absUrl(p.path) } : {}) },
  };
  add(p.path, layout({ path: p.path, nav: 'produtos/', titulo: `${p.nome} em ${p.material} | ${site.nome}`, descricao: `${p.desc} ${money(p.preco)}. ${p.material}, ${p.tamanho}. Escolha a cor e peça pelo WhatsApp.`.slice(0, 300), conteudo, jsonld: [ld, crumbsLd(itens.map(([t, h], i) => [t, i === itens.length - 1 ? B + p.path : h]))], ogImage: imgProduto(p) }));
}

// Sob encomenda
(function () {
  let html = partial('encomenda');
  html = html.replace(/<section id="viewEncomenda"[^>]*>/, '<div class="enc-page">');
  html = html.replace(/<\/section>\s*$/, '</div>');
  html = html.replace(/<nav class="crumbs[\s\S]*?<\/nav>/, crumbs([['Início', B], ['Sob encomenda']]));
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: site.faq.encomendas.map(f => ({ '@type': 'Question', name: f.pergunta, acceptedAnswer: { '@type': 'Answer', text: f.resposta.replace(/<[^>]+>/g, '') } })) };
  add('encomenda/', layout({ path: 'encomenda/', nav: 'encomenda/', titulo: `Impressão 3D sob encomenda | ${site.nome}`, descricao: 'Peças únicas, reposições, protótipos e brindes impressos em 3D a partir do seu arquivo, desenho ou foto. Orçamento grátis pelo WhatsApp, com envio de imagens.', conteudo: html, jsonld: [faqLd, crumbsLd([['Início', B], ['Sob encomenda', B + 'encomenda/']])] }));
})();

// Dúvidas
(function () {
  const grupo = (titulo, lista, id) => `<section class="faq-group" aria-labelledby="${id}"><h2 id="${id}" class="faq-title">${titulo}</h2><div class="faq">${lista.map(f => `<details><summary>${esc(f.pergunta)}</summary><p>${f.resposta}</p></details>`).join('')}</div></section>`;
  const conteudo = `${pageHero([['Início', B], ['Dúvidas']], 'Dúvidas frequentes', 'Prazos, pagamento, entrega, materiais e encomendas. Se a sua dúvida não estiver aqui, fale com a gente pelo WhatsApp.')}
<section class="section"><div class="wrap faq-page">
  <div>${grupo('Compras na loja', site.faq.loja, 'gLoja')}${grupo('Sob encomenda', site.faq.encomendas, 'gEnc')}</div>
  <aside class="contact-box" style="margin-top:0;align-self:start"><p>Ainda com dúvida? Respondemos pelo WhatsApp, ${esc(site.horario.toLowerCase())}.</p><a class="btn btn-wa" href="${waLink(`Olá, ${site.nome}! Tenho uma dúvida.`)}" target="_blank" rel="noopener">${ICON.wa}Chamar no WhatsApp</a><p style="margin-top:16px"><a href="${B}trocas/">Trocas e devoluções</a> · <a href="${B}privacidade/">Privacidade</a></p></aside>
</div></section>`;
  const todas = [...site.faq.loja, ...site.faq.encomendas];
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: todas.map(f => ({ '@type': 'Question', name: f.pergunta, acceptedAnswer: { '@type': 'Answer', text: f.resposta.replace(/<[^>]+>/g, '') } })) };
  add('duvidas/', layout({ path: 'duvidas/', nav: 'duvidas/', titulo: `Dúvidas frequentes | ${site.nome}`, descricao: 'Prazo de produção, frete, pagamento por Pix ou cartão, cores, arquivos STL e encomendas: respostas sobre como comprar peças impressas em 3D.', conteudo, jsonld: [faqLd] }));
})();

// Páginas de texto (sobre, trocas, privacidade)
function textoPage(arquivo, pathP, titulo, h1, lead, descricao, nav = '') {
  const e = site.empresa;
  let corpo = read(`src/paginas/${arquivo}`)
    .replace(/\{\{nome\}\}/g, esc(site.nome)).replace(/\{\{razao_social\}\}/g, esc(e.razao_social)).replace(/\{\{documento\}\}/g, esc(e.documento))
    .replace(/\{\{cidade_uf\}\}/g, esc(e.cidade_uf)).replace(/\{\{email\}\}/g, esc(e.email)).replace(/\{\{whatsapp\}\}/g, esc(site.whatsapp_exibir))
    .replace(/\{\{horario\}\}/g, esc(site.horario)).replace(/\{\{prazo\}\}/g, esc(site.prazo_producao)).replace(/\{\{atualizado\}\}/g, new Date(site.politicas_atualizadas_em + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }))
    .replace(/\{\{base\}\}/g, B).replace(/\{\{wa_link\}\}/g, waLink(`Olá, ${site.nome}!`));
  corpo = todo(corpo);
  const conteudo = `${pageHero([['Início', B], [h1]], esc(h1), lead)}
<section class="section"><div class="wrap"><article class="prose">${corpo}</article></div></section>`;
  add(pathP, layout({ path: pathP, nav, titulo: `${titulo} | ${site.nome}`, descricao, conteudo }));
}
textoPage('sobre.html', 'sobre/', 'Sobre', 'Sobre a Métricas Vaz 3D', 'Quem faz as peças, como trabalhamos e onde estamos.', 'Conheça a Métricas Vaz 3D: estúdio de impressão 3D que produz decoração, colecionáveis, brinquedos e peças sob encomenda, com envio para todo o Brasil.', 'sobre/');
textoPage('trocas.html', 'trocas/', 'Trocas e devoluções', 'Trocas e devoluções', 'Como funcionam arrependimento, defeitos e produtos personalizados.', 'Política de trocas e devoluções da Métricas Vaz 3D: direito de arrependimento, garantia contra defeitos e regras para produtos personalizados.');
textoPage('privacidade.html', 'privacidade/', 'Política de privacidade', 'Política de privacidade', 'Quais dados usamos, para quê e como você pode pedir a exclusão.', 'Política de privacidade da Métricas Vaz 3D, de acordo com a Lei Geral de Proteção de Dados (LGPD).');

// 404
add('404.html', layout({ path: '404.html', titulo: `Página não encontrada | ${site.nome}`, descricao: 'Página não encontrada.', conteudo: `${pageHero([['Início', B], ['Página não encontrada']], 'Página não encontrada', 'O endereço pode ter mudado ou ter sido digitado errado.', `<div class="enc-ctas"><a class="btn btn-primary" href="${B}produtos/">Ver produtos</a><a class="btn" href="${B}">Ir para o início</a></div>`)}` }));

/* ---------- gravação ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
const write = (rel, data) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
for (const [p, html] of paginas) write(p.endsWith('.html') ? p : p + 'index.html', ajustaLinks(html, p));

const copyDir = (src, dst) => { if (!fs.existsSync(src)) return; for (const e of fs.readdirSync(src, { withFileTypes: true })) { const s = path.join(src, e.name), d = path.join(dst, e.name); if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); } else fs.copyFileSync(s, d); } };
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
copyDir(path.join(ROOT, 'static'), DIST);

const indexaveis = paginas.map(([p]) => p).filter(p => !p.endsWith('.html'));
if (SITE_URL) {
  const hoje = new Date().toISOString().slice(0, 10);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexaveis.map(p => `  <url><loc>${absUrl(p)}</loc><lastmod>${hoje}</lastmod></url>`).join('\n')}\n</urlset>\n`);
}
write('robots.txt', `User-agent: *\nAllow: /\n${SITE_URL ? `Sitemap: ${absUrl('sitemap.xml')}\n` : ''}`);

/* ---------- relatório ---------- */
console.log(`✔ ${paginas.length} páginas geradas em ${SAIDA}/ (${produtos.length} produtos)${RELATIVO ? ' com links relativos' : ''}`);
if (!SITE_URL) console.log('! data/site.json: "url" está vazio. Preencha depois de publicar para gerar sitemap.xml e prévia completa no WhatsApp/Google.');
const semFoto = produtos.filter(p => !p.fotos.length).length;
if (semFoto) console.log(`! ${semFoto} produtos ainda usam desenho no lugar de foto.`);
if (pendencias.size) { console.log(`! Campos [PREENCHER] pendentes (${pendencias.size}):`); for (const t of pendencias) console.log('   - ' + (t || '(sem descrição)')); }
