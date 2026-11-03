/* Gera assets/img/produtos/<produto>.png (1200×1200) a partir dos desenhos.
   Essas imagens aparecem na prévia do link de cada produto e no Google.
   Opcional: só precisa rodar de novo se mudar produtos ou desenhos.
   Requer Playwright:  npm i -D playwright && npx playwright install chromium
   Uso: node scripts/gerar-imagens.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const loja = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/produtos.json'), 'utf8'));
const MV = require(path.join(ROOT, 'src/art.js'));
MV.setCores(loja.cores);
const css = fs.readFileSync(path.join(ROOT, 'assets/css/site.css'), 'utf8');
const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
(async () => {
  const out = path.join(ROOT, 'assets/img/produtos'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 1200 } });
  for (const prod of loja.produtos) {
    if (prod.fotos && prod.fotos.length) continue;
    await p.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..800&family=IBM+Plex+Mono:wght@500&display=swap"><style>${css}
      body{margin:0;width:1200px;height:1200px;background:radial-gradient(55% 55% at 50% 45%,rgba(155,48,255,.28),transparent 70%),linear-gradient(rgba(181,123,255,.07) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(90deg,rgba(181,123,255,.07) 1px,transparent 1px) 0 0/40px 40px,#07060C;position:relative;font-family:Archivo}
      .a{position:absolute;inset:120px 140px 200px}.a .art{width:100%;height:100%}
      .t{position:absolute;left:60px;right:60px;bottom:56px;display:flex;justify-content:space-between;align-items:flex-end}
      .t b{font:700 64px/1 Archivo;font-stretch:88%;color:#F1F0F7}.t span{font:500 26px 'IBM Plex Mono';color:#B57BFF;letter-spacing:.06em}
      .r{position:absolute;top:50px;left:60px;font:500 24px 'IBM Plex Mono';letter-spacing:.12em;color:#A5A2B8}</style></head>
      <body><div class="r">MV 3D · MÉTRICAS VAZ 3D · REF. ${prod.ref}</div><div class="a">${MV.art(prod.art, prod.cores[0])}</div>
      <div class="t"><b>${prod.nome}</b><span>${prod.material.toUpperCase()}</span></div></body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(out, slugify(prod.nome) + '.png') });
    console.log('✔', prod.nome);
  }
  await b.close();
})();
