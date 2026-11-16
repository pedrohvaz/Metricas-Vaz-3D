/* Teste de ponta a ponta do servidor (regras, permissões, estoque, financeiro, pedidos do site).
   Só roda num banco VAZIO e descartável: cria contas de teste (dono@teste.local, equipe@teste.local).
   Uso, com uma cópia separada do servidor:
     MV_PORTA=8091 MV_DADOS=/tmp/mv-teste MV_SAIDA=/tmp/mv-teste-dist node scripts/servidor.js
     node tests/integracao.js http://127.0.0.1:8091 /tmp/mv-teste-dist --banco-descartavel
   Depois apague as duas pastas temporárias. */
const fs = require('fs'), path = require('path');
const B = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/+$/, '');
const DIST = process.argv[3];
if (!DIST || !process.argv.includes('--banco-descartavel')) { console.error('Uso: node tests/integracao.js <url-do-servidor-de-teste> <pasta-da-loja-de-teste> --banco-descartavel'); process.exit(1); }
// um banco real recém-instalado também está vazio: por isso exigimos a confirmação acima e recusamos a porta padrão
if (/:8090$/.test(B)) { console.error('Recusado: 8090 é a porta do servidor de verdade. Suba uma cópia separada (MV_PORTA=8091, MV_DADOS e MV_SAIDA em pastas temporárias).'); process.exit(1); }
let ok = 0, falha = 0;
const t = (nome, cond, info = '') => { cond ? ok++ : falha++; console.log(`${cond ? 'PASS' : 'FALHA'}  ${nome}${!cond && info ? '  -> ' + JSON.stringify(info).slice(0, 400) : ''}`); };
async function api(metodo, rota, { token, json, form } = {}) {
  const h = {}; if (token) h.Authorization = token; let body;
  if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); } else if (form) body = form;
  const r = await fetch(B + rota, { method: metodo, headers: h, body });
  let d = null; try { d = await r.json(); } catch (e) { }
  return { s: r.status, d };
}
const login = async (e, p) => (await api('POST', '/api/collections/users/auth-with-password', { json: { identity: e, password: p } })).d.token;
const cuboSTL = () => {
  const s = 20, V = [[0,0,0],[s,0,0],[s,s,0],[0,s,0],[0,0,s],[s,0,s],[s,s,s],[0,s,s]];
  const F = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  const b = Buffer.alloc(84 + F.length * 50); b.writeUInt32LE(F.length, 80);
  F.forEach((f, i) => { let o = 84 + i * 50 + 12; f.forEach(vi => V[vi].forEach(c => { b.writeFloatLE(c, o); o += 4; })); });
  return b;
};
const q = f => encodeURIComponent(f);

(async () => {
  const SD = 'Teste-Dono-12345', SE = 'Teste-Equipe-12345';
  const st = await (await fetch(B + '/api/mv/status')).json();
  if (!st.primeiro_acesso) { console.error('Este banco já tem usuários. O teste só roda numa cópia vazia e descartável do servidor.'); process.exit(1); }
  let r = await api('POST', '/api/mv/primeiro-acesso', { json: { nome: 'Dono Teste', email: 'dono@teste.local', senha: SD } });
  t('primeiro acesso cria o dono', r.s === 200, r.d);
  r = await api('POST', '/api/mv/primeiro-acesso', { json: { nome: 'Outro', email: 'outro@teste.local', senha: SD } });
  t('primeiro acesso nao roda duas vezes', r.s === 403, r.d);
  const TD = await login('dono@teste.local', SD);
  t('login do dono', !!TD);
  r = await api('GET', '/api/collections/config/records/configuracao001', { token: TD });
  t('dono le a configuracao de custos', r.s === 200 && r.d.custos && r.d.custos.margem === 120, r.d);

  r = await api('POST', '/api/mv/importar-catalogo', { token: TD });
  t('importa o catalogo (11 produtos) e publica', r.s === 200 && r.d.importados === 11 && r.d.publicado, r.d);
  r = await api('GET', '/api/collections/produtos/records?perPage=50&sort=ordem');
  const prods = (r.d && r.d.items) || [];
  t('visitante ve 11 produtos', prods.length === 11, r.d);
  t('fotos importadas (webp + jpg de previa)', prods.length && prods.every(p => p.fotos.length === 1) && prods.every(p => p.foto_previa), prods.map(p => [p.codigo, p.fotos, p.foto_previa]));
  t('visitante nao ve gramas/horas', prods.length && prods.every(p => !('gramas' in p)), prods[0]);
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  t('loja publicada usa fotos do banco', /\/api\/files\/[^"]+dragao[^"]*\.webp/.test(html));

  const torre = prods.find(p => p.codigo === 'torre');
  r = await api('PATCH', `/api/collections/produtos/records/${torre.id}`, { token: TD, json: { sob_consulta: true, preco: 0, gramas: 120, horas: 11 } });
  t('dono edita produto', r.s === 200, r.d);
  const pdp = fs.readFileSync(path.join(DIST, 'produtos/torre-de-dados/index.html'), 'utf8');
  t('salvar produto republica a loja (torre vira Sob consulta)', pdp.includes('id="consulta"') && pdp.includes('Sob consulta'));

  r = await api('POST', '/api/collections/users/records', { token: TD, json: { name: 'Equipe Teste', email: 'equipe@teste.local', password: SE, passwordConfirm: SE, papel: 'equipe', verified: true, emailVisibility: true } });
  t('dono cadastra a equipe', r.s === 200, r.d);
  const TE = await login('equipe@teste.local', SE);
  t('login da equipe', !!TE);
  r = await api('GET', '/api/collections/lancamentos/records', { token: TE });
  t('equipe nao ve o financeiro', (r.s === 200 && r.d.totalItems === 0) || r.s === 403, r.d);
  r = await api('GET', '/api/collections/config/records/configuracao001', { token: TE });
  t('equipe nao ve a configuracao de custos', r.s === 404 || r.s === 403, r.d);
  r = await api('PATCH', `/api/collections/produtos/records/${torre.id}`, { token: TE, json: { preco: 1 } });
  t('equipe nao edita produtos', r.s === 404 || r.s === 403, r.d);
  const eu = (await api('GET', '/api/collections/users/records?filter=' + q('email="equipe@teste.local"'), { token: TE })).d.items[0];
  r = await api('PATCH', `/api/collections/users/records/${eu.id}`, { token: TE, json: { papel: 'dono' } });
  t('equipe nao vira dono sozinha', r.s === 404 || r.s === 403 || r.s === 400, r.d);
  r = await api('POST', '/api/mv/publicar', { token: TE });
  t('equipe nao publica a loja', r.s === 403, r.d);

  r = await api('POST', '/api/collections/filamentos/records', { token: TD, json: { material: 'PLA', cor: 'Roxo', cor_hex: '#7C5CE0', marca: 'Teste', peso_inicial: 1000, custo: 110, ativo: true } });
  const fil = r.d;
  t('cadastra carretel com peso restante = inicial', r.s === 200 && fil.peso_restante === 1000 && fil.minimo === 150, r.d);
  r = await api('POST', '/api/collections/movimentos/records', { token: TE, json: { filamento: fil.id, tipo: 'saida', gramas: 50, obs: 'teste' } });
  t('equipe registra saida avulsa (com usuario)', r.s === 200 && !!r.d.usuario, r.d);
  r = await api('POST', '/api/collections/movimentos/records', { token: TD, json: { filamento: fil.id, tipo: 'ajuste', gramas: 10 } });
  let f2 = (await api('GET', `/api/collections/filamentos/records/${fil.id}`, { token: TD })).d;
  t('saida e ajuste atualizam o carretel (1000 - 50 + 10 = 960)', f2.peso_restante === 960, f2);

  r = await api('POST', '/api/collections/pedidos/records', { json: { tipo: 'loja', nome: 'Cliente Site', whatsapp: '(31) 99999-0001', itens: [{ id: 'dragao', cor: 'Roxo', qtd: 2, preco: 0.01 }], total: 1, status: 'aprovado' } });
  const ped = r.d;
  t('pedido da loja pelo site', r.s === 200, r.d);
  t('preco recalculado no servidor (2 x 59,90) e status forcado como novo', ped.total === 119.8 && ped.status === 'novo' && ped.itens[0].preco === 59.9, ped);
  const pedV = (await api('GET', `/api/collections/pedidos/records/${ped.id}`, { token: TE })).d;
  t('pedido ligado a um cliente criado pelo WhatsApp', !!pedV.cliente && pedV.whatsapp === '31999990001', pedV);
  r = await api('POST', '/api/collections/pedidos/records', { json: { tipo: 'consulta', nome: 'Cliente Site', whatsapp: '31999990001', itens: [{ id: 'torre', qtd: 1 }] } });
  const pedK = (await api('GET', `/api/collections/pedidos/records/${r.d.id}`, { token: TE })).d;
  t('mesmo WhatsApp reaproveita o cliente', pedK.cliente === pedV.cliente, [pedK.cliente, pedV.cliente]);

  let fd = new FormData();
  fd.append('tipo', 'calculadora'); fd.append('nome', 'Cliente STL'); fd.append('whatsapp', '11988887777');
  fd.append('estimativa', JSON.stringify({ min: 16, max: 23 })); fd.append('arquivos', new Blob([cuboSTL()]), 'cubo.stl');
  r = await api('POST', '/api/collections/pedidos/records', { form: fd });
  t('pedido da calculadora com STL anexado', r.s === 200 && r.d.arquivos.length === 1, r.d);
  fd = new FormData(); fd.append('tipo', 'encomenda'); fd.append('nome', 'X'); fd.append('whatsapp', '11988887777'); fd.append('arquivos', new Blob(['MZ']), 'virus.exe');
  r = await api('POST', '/api/collections/pedidos/records', { form: fd });
  t('arquivo .exe recusado', r.s === 400, r.d);
  r = await api('GET', '/api/collections/pedidos/records');
  t('visitante nao lista pedidos', r.d.totalItems === 0, r.d);

  r = await api('POST', '/api/collections/projetos/records', { token: TE, json: { titulo: 'Teste equipe', status: 'orcamento', preco: 50 } });
  t('equipe nao define preco de projeto', r.s >= 400, r.d);
  r = await api('POST', '/api/collections/projetos/records', { token: TE, json: { titulo: 'Dragoes para feira', status: 'orcamento', cliente: pedV.cliente, pedido: ped.id, uso_filamento: [{ filamento: fil.id, gramas: 80 }], horas_maquina: 7 } });
  const proj = r.d;
  t('equipe cria projeto sem preco', r.s === 200, r.d);
  r = await api('PATCH', `/api/collections/projetos/records/${proj.id}`, { token: TD, json: { preco: 100, custo_total: 40, status: 'aprovado' } });
  t('dono define preco e aprova', r.s === 200 && r.d.receita_gerada === true, r.d);
  let lancs = (await api('GET', `/api/collections/lancamentos/records?filter=${q(`projeto="${proj.id}"`)}`, { token: TD })).d.items;
  t('aprovar gera conta a receber de R$ 100', lancs.length === 1 && lancs[0].valor === 100 && !lancs[0].pago && lancs[0].tipo === 'entrada', lancs);
  r = await api('PATCH', `/api/collections/projetos/records/${proj.id}`, { token: TE, json: { status: 'acabamento' } });
  f2 = (await api('GET', `/api/collections/filamentos/records/${fil.id}`, { token: TD })).d;
  t('equipe move para Acabamento e o estoque baixa 80 g (960 -> 880)', r.s === 200 && f2.peso_restante === 880, [r.s, r.d, f2.peso_restante]);
  await api('PATCH', `/api/collections/projetos/records/${proj.id}`, { token: TE, json: { status: 'pronto' } });
  await api('PATCH', `/api/collections/projetos/records/${proj.id}`, { token: TD, json: { status: 'entregue', preco: 110 } });
  f2 = (await api('GET', `/api/collections/filamentos/records/${fil.id}`, { token: TD })).d;
  lancs = (await api('GET', `/api/collections/lancamentos/records?filter=${q(`projeto="${proj.id}"`)}`, { token: TD })).d.items;
  t('avancar de novo nao baixa estoque nem lanca receita em dobro', f2.peso_restante === 880 && lancs.length === 1, [f2.peso_restante, lancs.length]);
  r = await api('GET', `/api/collections/projetos/records/${proj.id}`, { token: TE });
  t('equipe nao ve preco/custo do projeto', r.s === 200 && !('preco' in r.d) && !('custo_total' in r.d), r.d);
  const movs = (await api('GET', `/api/collections/movimentos/records?filter=${q(`projeto="${proj.id}"`)}`, { token: TD })).d.items;
  t('baixa automatica fica no historico ligada ao projeto', movs.length === 1 && movs[0].gramas === 80 && movs[0].tipo === 'saida', movs);

  r = await api('POST', '/api/collections/lancamentos/records', { token: TD, json: { tipo: 'entrada', categoria: 'venda_loja', descricao: 'Venda cartao', valor: 100, forma_pagamento: 'cartao_credito', pago: true } });
  t('entrada no cartao calcula taxa de 4,99% e data de pagamento', r.s === 200 && r.d.taxa === 4.99 && !!r.d.data_pagamento, r.d);
  r = await api('POST', '/api/collections/lancamentos/records', { token: TD, json: { tipo: 'saida', categoria: 'energia', descricao: 'Conta de luz', valor: 80, pago: false, vencimento: '2026-11-20 12:00:00.000Z' } });
  t('conta a pagar em aberto', r.s === 200 && !r.d.pago && !r.d.data_pagamento, r.d);
  r = await api('PATCH', `/api/collections/lancamentos/records/${r.d.id}`, { token: TD, json: { pago: true } });
  t('marcar como pago preenche a data', r.s === 200 && !!r.d.data_pagamento, r.d);
  r = await api('POST', '/api/mv/publicar', { token: TD });
  t('dono publica a loja pelo botao', r.s === 200 && r.d.ok, r.d);

  console.log(`\n${ok} passaram, ${falha} falharam`);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
