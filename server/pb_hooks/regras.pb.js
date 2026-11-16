/// <reference path="../pb_data/types.d.ts" />
/* Regras de negócio que rodam no servidor a cada gravação. */

/* ---------- Pedidos vindos do site ---------- */
onRecordCreateRequest((e) => {
  const U = require(`${__hooks}/lib/util.js`);
  const r = e.record;
  const interno = !!e.auth || e.hasSuperuserAuth();

  if (!interno) {
    const tipo = r.getString('tipo');
    if (['loja', 'encomenda', 'consulta', 'calculadora'].indexOf(tipo) < 0) throw new BadRequestError('Tipo de pedido inválido.');
    const wa = U.soDigitos(r.getString('whatsapp'));
    if (wa.length < 10 || wa.length > 13) throw new BadRequestError('Informe um WhatsApp com DDD.');
    r.set('whatsapp', wa);
    r.set('status', 'novo');
    r.set('cliente', '');
    r.set('obs_interna', '');

    const permitidas = /\.(stl|obj|3mf|step|stp|jpe?g|png|webp|heic|pdf)$/i;
    const arquivos = r.get('arquivos') || [];
    for (const f of arquivos) {
      const nome = typeof f === 'string' ? f : (f && (f.originalName || f.name)) || '';
      if (!permitidas.test(nome)) throw new BadRequestError('Tipo de arquivo não aceito: ' + nome + '. Envie STL, OBJ, 3MF, STEP, imagem ou PDF.');
    }

    if (tipo === 'loja' || tipo === 'consulta') {
      const n = U.normalizarItensLoja(e.app, U.lerJSON(r, 'itens', []));
      if (!n.itens.length) throw new BadRequestError('Nenhum produto válido no pedido.');
      r.set('itens', n.itens);
      r.set('total', n.total);
    } else {
      r.set('total', 0);
    }
  } else if (!r.getString('status')) {
    r.set('status', 'novo');
  }
  e.next();
}, 'pedidos');

onRecordAfterCreateSuccess((e) => {
  const U = require(`${__hooks}/lib/util.js`);
  if (!e.record.getString('cliente')) {
    try { U.vincularCliente(e.app, e.record); } catch (err) { e.app.logger().warn('Não foi possível vincular cliente', 'erro', String(err)); }
  }
  e.next();
}, 'pedidos');

/* ---------- Estoque ---------- */
onRecordCreate((e) => {
  const r = e.record;
  if (!(r.getFloat('peso_restante') > 0)) r.set('peso_restante', r.getFloat('peso_inicial'));
  if (!r.getFloat('minimo')) r.set('minimo', 150);
  e.next();
}, 'filamentos');

onRecordCreateRequest((e) => {
  if (e.auth && !e.auth.isSuperuser()) e.record.set('usuario', e.auth.id);
  e.next();
}, 'movimentos');

/* Cada movimentação altera o peso restante do carretel (entrada soma, saída subtrai, ajuste soma o valor com sinal). */
onRecordCreate((e) => {
  e.next();
  const m = e.record;
  const fil = e.app.findRecordById('filamentos', m.getString('filamento'));
  const g = m.getFloat('gramas');
  const tipo = m.getString('tipo');
  const delta = tipo === 'entrada' ? Math.abs(g) : tipo === 'saida' ? -Math.abs(g) : g;
  fil.set('peso_restante', Math.max(0, Math.round((fil.getFloat('peso_restante') + delta) * 10) / 10));
  e.app.save(fil);
}, 'movimentos');

/* ---------- Projetos: baixa automática de estoque e conta a receber ---------- */
onRecordCreate((e) => {
  const U = require(`${__hooks}/lib/util.js`);
  const acoes = U.acoesDoProjeto(e.record);
  e.next();
  U.processarProjeto(e.app, e.record, acoes, null);
}, 'projetos');

onRecordUpdate((e) => {
  const U = require(`${__hooks}/lib/util.js`);
  const acoes = U.acoesDoProjeto(e.record);
  e.next();
  U.processarProjeto(e.app, e.record, acoes, null);
}, 'projetos');

/* A equipe não vê preço nem custo dos projetos. */
onRecordEnrich((e) => {
  const U = require(`${__hooks}/lib/util.js`);
  const auth = e.requestInfo && e.requestInfo.auth;
  if (auth && !U.ehDono(auth)) e.record.hide('custo', 'custo_total', 'preco');
  e.next();
}, 'projetos');

/* Visitantes do site não veem os dados internos de produção dos produtos. */
onRecordEnrich((e) => {
  const auth = e.requestInfo && e.requestInfo.auth;
  if (!auth) e.record.hide('gramas', 'horas');
  e.next();
}, 'produtos');

/* ---------- Financeiro ---------- */
onRecordCreate((e) => {
  const U = require(`${__hooks}/lib/util.js`);
  const C = require(`${__hooks}/lib/calc.js`);
  const r = e.record;
  if (r.getString('tipo') === 'entrada' && r.getString('forma_pagamento') && !(r.getFloat('taxa') > 0)) {
    r.set('taxa', C.taxaPagamento(U.custos(e.app), r.getString('forma_pagamento'), r.getFloat('valor')));
  }
  if (r.getBool('pago') && !r.getString('data_pagamento')) r.set('data_pagamento', new DateTime());
  e.next();
}, 'lancamentos');

onRecordUpdate((e) => {
  const r = e.record;
  if (r.getBool('pago') && !r.getString('data_pagamento')) r.set('data_pagamento', new DateTime());
  if (!r.getBool('pago')) r.set('data_pagamento', '');
  e.next();
}, 'lancamentos');

/* ---------- Site público: gera de novo quando um produto muda ---------- */
onRecordAfterCreateSuccess((e) => { require(`${__hooks}/lib/util.js`).publicarSite(e.app); e.next(); }, 'produtos');
onRecordAfterUpdateSuccess((e) => { require(`${__hooks}/lib/util.js`).publicarSite(e.app); e.next(); }, 'produtos');
onRecordAfterDeleteSuccess((e) => { require(`${__hooks}/lib/util.js`).publicarSite(e.app); e.next(); }, 'produtos');
