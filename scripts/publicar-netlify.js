/* Publica no Netlify (hospedagem estática) o que está público no banco local:
   produtos da loja (preços, fotos, destaques) e a vitrine "Ideias de Natal".
   1) lê a API pública do servidor local (sem login: só o que qualquer visitante já vê)
   2) grava data/produtos.json, data/vitrine.json e as fotos em assets/img/
   3) faz commit só desses arquivos e envia ao GitHub (o Netlify gera o site sozinho)
   Uso: node scripts/publicar-netlify.js          (exporta e envia)
        node scripts/publicar-netlify.js --sem-git (só exporta, para conferir antes) */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PB = (process.env.MV_PB_URL || 'http://127.0.0.1:8090').replace(/\/+$/, '');
const SEM_GIT = process.argv.includes('--sem-git');
const DIR_PROD = path.join(ROOT, 'assets/img/produtos');
const DIR_NATAL = path.join(ROOT, 'assets/img/natal');

async function lista(filtro) {
  const r = await fetch(`${PB}/api/collections/produtos/records?perPage=500&sort=ordem,created&filter=${encodeURIComponent(filtro)}`);
  if (!r.ok) throw new Error(`Servidor local respondeu ${r.status}. Ele está ligado (npm run servidor)?`);
  return (await r.json()).items || [];
}
async function baixar(rec, arquivo, destino, thumb) {
  const r = await fetch(`${PB}/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(arquivo)}${thumb ? `?thumb=${thumb}` : ''}`);
  if (!r.ok) throw new Error(`Não foi possível baixar ${arquivo} (${r.status}).`);
  const novo = Buffer.from(await r.arrayBuffer());
  if (fs.existsSync(destino) && fs.readFileSync(destino).equals(novo)) return false; // igual: não mexe
  fs.writeFileSync(destino, novo);
  return true;
}
const ext = f => (path.extname(f) || '.jpg').toLowerCase();
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

(async () => {
  const loja = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/produtos.json'), 'utf8'));

  /* ---------- produtos da loja ---------- */
  const recs = await lista('ativo=true && interno!=true');
  if (!recs.length) throw new Error('O banco não tem produtos da loja ainda. Nada foi alterado.');
  fs.mkdirSync(DIR_PROD, { recursive: true });
  let fotosNovas = 0;
  const produtos = [];
  for (const r of recs) {
    const fotos = [];
    for (const [i, f] of (r.fotos || []).entries()) {
      const nome = `${r.codigo}${i ? `-${i + 1}` : ''}${ext(f)}`;
      if (await baixar(r, f, path.join(DIR_PROD, nome))) fotosNovas++;
      fotos.push(nome);
    }
    // prévia de link: mesmo nome da 1ª foto em .jpg (o gerador usa sozinho)
    if (r.foto_previa && fotos[0]) {
      const jpg = fotos[0].replace(/\.[a-z0-9]+$/i, '.jpg');
      if (jpg !== fotos[0] && await baixar(r, r.foto_previa, path.join(DIR_PROD, jpg))) fotosNovas++;
    }
    const p = {
      id: r.codigo, ref: r.ref, nome: r.nome, cat: r.categoria,
      preco: r.sob_consulta || !(r.preco > 0) ? 0 : r.preco,
      material: r.material, tamanho: r.tamanho, tempo: r.tempo,
      art: r.art || 'gear', cores: Array.isArray(r.cores) && r.cores.length ? r.cores : ['preto'],
      desc: r.descricao, fotos,
    };
    if (r.camada) p.camada = r.camada;
    if (r.tag) p.tag = r.tag;
    if (r.personalizavel) p.personalizavel = true;
    produtos.push(p);
  }
  loja.produtos = produtos;
  loja.destaques = recs.filter(r => r.destaque).map(r => r.codigo);
  fs.writeFileSync(path.join(ROOT, 'data/produtos.json'), JSON.stringify(loja, null, 2) + '\n');

  /* ---------- vitrine Ideias de Natal (só modelos com licença comercial confirmada) ---------- */
  const vit = await lista('interno=true && licenca="comercial_ok" && marca!=true && categoria="natal"');
  fs.mkdirSync(DIR_NATAL, { recursive: true });
  const usados = new Set();
  const vitrine = [];
  for (const r of vit) {
    const propria = (r.fotos || [])[0];
    const origem = propria || r.foto_referencia;
    let foto = '';
    if (origem) {
      const nome = `${r.codigo}${ext(origem)}`;
      // WebP já vem leve; a miniatura do PocketBase para WebP sai em PNG (bem maior), então só JPG/PNG usam miniatura
      if (await baixar(r, origem, path.join(DIR_NATAL, nome), /\.webp$/i.test(origem) ? '' : '600x600')) fotosNovas++;
      usados.add(nome);
      foto = `assets/img/natal/${nome}`;
    }
    vitrine.push({ nome: r.nome, ref: r.ref, credito: r.credito || '', foto, fotoDesigner: !propria && !!r.foto_referencia });
  }
  // fotos de modelos que saíram da vitrine não ficam publicadas
  for (const f of fs.readdirSync(DIR_NATAL)) if (!usados.has(f)) fs.unlinkSync(path.join(DIR_NATAL, f));
  fs.writeFileSync(path.join(ROOT, 'data/vitrine.json'), JSON.stringify({ _leia: 'Gerado por scripts/publicar-netlify.js a partir do banco. Não edite à mão.', itens: vitrine }, null, 1) + '\n');

  console.log(`Retrato do banco: ${produtos.length} produtos da loja, ${vitrine.length} na vitrine de Natal, ${fotosNovas} foto(s) nova(s) ou alterada(s).`);
  if (SEM_GIT) return;

  /* ---------- envia ao GitHub só esses arquivos ---------- */
  const caminhos = ['data/produtos.json', 'data/vitrine.json', 'assets/img/produtos', 'assets/img/natal'];
  git('add', '-A', '--', ...caminhos);
  if (!git('diff', '--cached', '--name-only', '--', ...caminhos)) { console.log('Nada mudou desde a última publicação.'); return; }
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  git('commit', '-m', `Publica loja a partir do painel (${data})\n\n${produtos.length} produtos da loja, ${vitrine.length} na vitrine de Natal.`, '--', ...caminhos);
  git('push', 'origin', 'HEAD:main');
  console.log('Enviado ao GitHub. O Netlify atualiza o site em 1 a 2 minutos.');
})().catch(e => {
  // chamado pelo painel (--painel): termina sem erro para o servidor conseguir ler a mensagem
  console.log('✖ ' + (e.stderr ? String(e.stderr).trim() : e.message));
  process.exit(process.argv.includes('--painel') ? 0 : 1);
});
