/// <reference path="../pb_data/types.d.ts" />
/* Rotas próprias da Métricas Vaz 3D (prefixo /api/mv/). */

/* Estado público do sistema: o painel usa para saber se precisa criar o primeiro acesso. */
routerAdd('GET', '/api/mv/status', (e) => {
  let usuarios = 0;
  try { usuarios = e.app.countRecords('users'); } catch (err) { usuarios = 0; }
  return e.json(200, { primeiro_acesso: usuarios === 0 });
});

/* Cria o primeiro dono. Só funciona com o banco sem nenhum usuário.
   No VPS, defina a variável MV_CHAVE_INSTALACAO e informe a mesma chave no formulário;
   sem ela, só é aceito a partir do próprio computador (localhost). */
routerAdd('POST', '/api/mv/primeiro-acesso', (e) => {
  if (e.app.countRecords('users') > 0) throw new ForbiddenError('O primeiro acesso já foi configurado.');
  const corpo = e.requestInfo().body || {};
  const chave = $os.getenv('MV_CHAVE_INSTALACAO');
  if (chave) {
    if (String(corpo.chave || '') !== chave) throw new ForbiddenError('Chave de instalação incorreta.');
  } else {
    // sem chave, só aceita quem está no próprio computador: IP local, endereço local e sem proxy no meio
    const host = String(e.request.host || '').replace(/:\d+$/, '');
    const local = ['127.0.0.1', '::1'].indexOf(e.realIP()) >= 0 && ['127.0.0.1', 'localhost', '[::1]'].indexOf(host) >= 0 && !e.request.header.get('X-Forwarded-For');
    if (!local) throw new ForbiddenError('Defina MV_CHAVE_INSTALACAO no servidor para criar o primeiro acesso remotamente.');
  }
  const nome = String(corpo.nome || '').trim().slice(0, 100);
  const email = String(corpo.email || '').trim().toLowerCase();
  const senha = String(corpo.senha || '');
  if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestError('Informe nome e e-mail válidos.');
  if (senha.length < 10) throw new BadRequestError('A senha precisa ter pelo menos 10 caracteres.');
  const u = new Record(e.app.findCollectionByNameOrId('users'));
  u.set('name', nome);
  u.set('email', email);
  u.setPassword(senha);
  u.set('verified', true);
  u.set('emailVisibility', true);
  u.set('papel', 'dono');
  e.app.save(u);
  return e.json(200, { ok: true });
});

/* Estimativa de preço para a calculadora do site (o cliente nunca vê margens nem custos). */
routerAdd('POST', '/api/mv/estimativa', (e) => {
  const U = require(`${__hooks}/lib/util.js`);
  const C = require(`${__hooks}/lib/calc.js`);
  const b = e.requestInfo().body || {};
  const cfg = C.normalizar(U.custos(e.app));
  const volume = Number(b.volume_cm3);
  const dim = (Array.isArray(b.dim) ? b.dim : []).slice(0, 3).map(Number);
  if (!(volume > 0) || volume > 20000) throw new BadRequestError('Não foi possível ler o volume da peça. Confira o arquivo STL.');
  if (dim.length !== 3 || dim.some(d => !(d > 0) || d > 5000)) throw new BadRequestError('Medidas da peça inválidas.');
  const material = cfg.materiais[b.material] ? String(b.material) : 'PLA';
  const cores = Math.max(1, Math.min(4, Math.round(Number(b.cores) || 1)));
  const quantidade = Math.max(1, Math.min(500, Math.round(Number(b.quantidade) || 1)));

  const est = C.estimarDoVolume(cfg, volume, material);
  const altura = Math.max.apply(null, dim) ; // pior caso: impressa "em pé"
  const trocas = cores > 1 ? Math.min(80, (cores - 1) * Math.ceil(altura / 4)) : 0;
  const r = C.calcular(cfg, { gramas: est.gramas, horas: est.horas, material, trocas_cor: trocas, quantidade });
  const f = C.faixa(cfg, r.preco);

  const avisos = [];
  const area = (cfg.area_max_mm || [260, 260, 260]).slice().sort((a, b2) => b2 - a);
  const ord = dim.slice().sort((a, b2) => b2 - a);
  if (ord.some((d, i) => d > area[i])) avisos.push(`A peça (${ord.map(d => Math.round(d)).join(' × ')} mm) é maior que a área de impressão (${area.join(' × ')} mm). Ela pode ser impressa em partes; o valor final vem no orçamento.`);
  if (ord[2] < 1) avisos.push('A peça é muito fina. Confira se o arquivo está na escala certa (milímetros).');
  if (cores > 1) avisos.push('Peças multicor variam bastante com o desenho; a faixa considera as trocas de cor.');

  return e.json(200, {
    min: f.min, max: f.max, quantidade,
    gramas: Math.round(r.gramas_total), horas: Math.round(r.horas_total * 10) / 10,
    material, cores, avisos,
  });
});

/* Publica o site de novo (botão "Publicar loja" no painel). */
routerAdd('POST', '/api/mv/publicar', (e) => {
  const U = require(`${__hooks}/lib/util.js`);
  if (!U.ehDono(e.auth)) throw new ForbiddenError('Apenas o dono pode publicar a loja.');
  const r = U.publicarSite(e.app);
  return e.json(r.ok ? 200 : 500, r);
}, $apis.requireAuth('users', '_superusers'));

/* Importa os produtos atuais do site (data/produtos.json + fotos) para o banco. Só roda com a tabela vazia. */
routerAdd('POST', '/api/mv/importar-catalogo', (e) => {
  const U = require(`${__hooks}/lib/util.js`);
  if (!U.ehDono(e.auth)) throw new ForbiddenError('Apenas o dono pode importar o catálogo.');
  if (e.app.countRecords('produtos') > 0) throw new BadRequestError('Já existem produtos cadastrados. A importação só roda com o catálogo vazio.');
  const loja = JSON.parse(toString($os.readFile(U.RAIZ + '/data/produtos.json')));
  const col = e.app.findCollectionByNameOrId('produtos');
  const destaques = loja.destaques || [];
  const pasta = U.RAIZ + '/assets/img/produtos/';
  const arquivo = nome => { try { return $filesystem.fileFromPath(pasta + nome); } catch (err) { return null; } };
  let n = 0;
  e.app.store().set('mv_pausar_publicacao', true);
  try {
    loja.produtos.forEach((p, i) => {
      const r = new Record(col);
      r.set('codigo', p.id);
      r.set('ref', p.ref || '');
      r.set('nome', p.nome);
      r.set('categoria', p.cat);
      r.set('preco', p.preco || 0);
      r.set('sob_consulta', !(p.preco > 0));
      r.set('material', p.material || '');
      r.set('tamanho', p.tamanho || '');
      r.set('tempo', p.tempo || '');
      r.set('camada', p.camada || '');
      r.set('art', p.art || '');
      r.set('tag', p.tag || '');
      r.set('personalizavel', !!p.personalizavel);
      r.set('cores', p.cores || []);
      r.set('descricao', p.desc || '');
      r.set('destaque', destaques.indexOf(p.id) >= 0);
      r.set('ordem', destaques.indexOf(p.id) >= 0 ? destaques.indexOf(p.id) : 10 + i);
      r.set('ativo', true);
      const fotos = (p.fotos || []).map(arquivo).filter(Boolean);
      if (fotos.length) r.set('fotos', fotos);
      const jpg = (p.fotos || [])[0] ? arquivo(p.fotos[0].replace(/\.webp$/i, '.jpg')) : null;
      if (jpg) r.set('foto_previa', jpg);
      e.app.save(r);
      n++;
    });
  } finally {
    e.app.store().remove('mv_pausar_publicacao');
  }
  const pub = U.publicarSite(e.app);
  return e.json(200, { importados: n, publicado: pub.ok, saida: pub.saida });
}, $apis.requireAuth('users', '_superusers'));
