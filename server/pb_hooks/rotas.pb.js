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

/* Importa os produtos atuais do site (data/produtos.json + fotos) para o banco. Só roda se ainda não houver produtos da loja. */
routerAdd('POST', '/api/mv/importar-catalogo', (e) => {
  const U = require(`${__hooks}/lib/util.js`);
  const I = require(`${__hooks}/lib/importar.js`);
  if (!U.ehDono(e.auth)) throw new ForbiddenError('Apenas o dono pode importar o catálogo.');
  const r = I.importarCatalogo(e.app);
  if (r.motivo === 'ja_existem') throw new BadRequestError('Os produtos da loja já foram importados.');
  const pub = U.publicarSite(e.app);
  return e.json(200, { importados: r.importados, publicado: pub.ok, saida: pub.saida });
}, $apis.requireAuth('users', '_superusers'));

/* Catálogos internos disponíveis em data/importar/<nome>.json (ex.: natal). */
routerAdd('GET', '/api/mv/colecoes', (e) => {
  const U = require(`${__hooks}/lib/util.js`);
  if (!U.ehDono(e.auth)) throw new ForbiddenError('Apenas o dono.');
  return e.json(200, require(`${__hooks}/lib/importar.js`).listarColecoes(e.app));
}, $apis.requireAuth('users', '_superusers'));

/* Importa um catálogo interno como produtos OCULTOS (interno = true), sem duplicar os que já existem. */
routerAdd('POST', '/api/mv/importar-colecao', (e) => {
  const U = require(`${__hooks}/lib/util.js`);
  if (!U.ehDono(e.auth)) throw new ForbiddenError('Apenas o dono pode importar catálogos.');
  const colecao = String((e.requestInfo().body || {}).colecao || '').replace(/[^a-z0-9-]/g, '');
  if (!colecao) throw new BadRequestError('Informe a coleção.');
  try { return e.json(200, require(`${__hooks}/lib/importar.js`).importarColecao(e.app, colecao)); }
  catch (err) { throw new NotFoundError('Catálogo não encontrado em data/importar/' + colecao + '.json'); }
}, $apis.requireAuth('users', '_superusers'));

/* Ações em massa nos produtos (painel → Produtos → selecionar). Aplica tudo numa transação e publica a loja uma vez. */
routerAdd('POST', '/api/mv/produtos/lote', (e) => {
  const U = require(`${__hooks}/lib/util.js`);
  if (!U.ehDono(e.auth)) throw new ForbiddenError('Apenas o dono pode alterar produtos em massa.');
  const b = e.requestInfo().body || {};
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(id => /^[a-z0-9]{15}$/.test(id)).slice(0, 1000);
  const acao = String(b.acao || '');
  const valor = b.valor;
  if (!ids.length) throw new BadRequestError('Nenhum produto selecionado.');
  const LIC = ['nao_verificada', 'comercial_ok', 'sem_licenca_comercial', 'propria'];
  const CAT = e.app.findCollectionByNameOrId('produtos').fields.getByName('categoria').values;
  const cats = []; for (let i = 0; i < CAT.length; i++) cats.push(String(CAT[i]));
  const aplica = {
    licenca: r => { if (LIC.indexOf(valor) < 0) throw new BadRequestError('Licença inválida.'); r.set('licenca', valor); },
    categoria: r => { if (cats.indexOf(valor) < 0) throw new BadRequestError('Categoria inválida.'); r.set('categoria', valor); },
    ativo: r => r.set('ativo', !!valor),
    interno: r => r.set('interno', !!valor),
    destaque: r => r.set('destaque', !!valor),
    preco: r => {
      const p = Math.round(Number(valor) * 100) / 100;
      if (!(p >= 0) || p > 100000) throw new BadRequestError('Preço inválido.');
      r.set('preco', p); r.set('sob_consulta', !(p > 0));
    },
    sob_consulta: r => { r.set('sob_consulta', true); r.set('preco', 0); },
  };
  if (acao !== 'excluir' && !aplica[acao]) throw new BadRequestError('Ação inválida.');
  let feitos = 0;
  e.app.store().set('mv_pausar_publicacao', true);
  try {
    e.app.runInTransaction((tx) => {
      for (const id of ids) {
        let r;
        try { r = tx.findRecordById('produtos', id); } catch (err) { continue; }
        if (acao === 'excluir') tx.delete(r);
        else { aplica[acao](r); tx.save(r); }
        feitos++;
      }
    });
  } finally {
    e.app.store().remove('mv_pausar_publicacao');
  }
  const pub = U.publicarSite(e.app);
  return e.json(200, { feitos, publicado: pub.ok });
}, $apis.requireAuth('users', '_superusers'));

/* Publica no Netlify: exporta o que é público no banco (produtos da loja e vitrine de Natal) e envia ao GitHub. */
routerAdd('POST', '/api/mv/publicar-netlify', (e) => {
  const U = require(`${__hooks}/lib/util.js`);
  if (!U.ehDono(e.auth)) throw new ForbiddenError('Apenas o dono pode publicar no Netlify.');
  const node = $os.getenv('MV_NODE') || 'node';
  let saida = '', ok = true;
  try {
    const cmd = $os.cmd(node, U.RAIZ + '/scripts/publicar-netlify.js', '--painel');
    cmd.dir = U.RAIZ;
    saida = toString(cmd.combinedOutput());
    if (saida.indexOf('✖') >= 0) ok = false;
  } catch (err) {
    ok = false;
    saida = String(err);
  }
  e.app.logger().info('Publicação no Netlify', 'ok', ok, 'saida', saida.slice(0, 3000));
  return e.json(ok ? 200 : 500, { ok, saida: saida.slice(0, 3000) });
}, $apis.requireAuth('users', '_superusers'));
