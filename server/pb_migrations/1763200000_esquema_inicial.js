/// <reference path="../pb_data/types.d.ts" />
/* Esquema do sistema Métricas Vaz 3D.
   Perfis: "dono" vê e altera tudo; "equipe" trabalha com pedidos, projetos, clientes e estoque,
   sem acesso ao financeiro, à configuração de custos nem aos preços/custos dos projetos. */
migrate((app) => {
  const LOGADO = '@request.auth.id != ""';
  const DONO = '@request.auth.papel = "dono"';
  const datas = [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ];

  /* ---------- equipe (coleção de login padrão "users") ---------- */
  const users = app.findCollectionByNameOrId('users');
  users.fields.add(new SelectField({ name: 'papel', values: ['dono', 'equipe'], maxSelect: 1, required: true }));
  users.listRule = LOGADO;
  users.viewRule = LOGADO;
  users.createRule = DONO; // ninguém se cadastra sozinho; o primeiro dono é criado em /api/mv/primeiro-acesso
  users.updateRule = `${DONO} || (id = @request.auth.id && @request.body.papel:isset = false)`;
  users.deleteRule = `${DONO} && id != @request.auth.id`;
  app.save(users);

  /* ---------- configuração (um único registro) ---------- */
  const config = new Collection({
    type: 'base', name: 'config',
    listRule: DONO, viewRule: DONO, createRule: null, updateRule: DONO, deleteRule: null,
    fields: [{ name: 'custos', type: 'json', maxSize: 20000 }, ...datas],
  });
  app.save(config);
  const cfg = new Record(config);
  cfg.set('id', 'configuracao001');
  cfg.set('custos', {
    _leia: 'Valores de referência. Ajuste em Configurações no painel.',
    tarifa_kwh: 0.95,          // R$ por kWh (conta de luz, com impostos)
    consumo_kw: 0.15,          // consumo médio da impressora imprimindo (kW)
    valor_impressora: 3500,    // R$ pagos na impressora
    vida_util_h: 5000,         // horas de impressão até precisar trocar/reformar
    manutencao_h: 0.30,        // R$ por hora (bicos, correias, PEI, lubrificação)
    hora_trabalho: 25,         // R$ por hora de preparo e acabamento
    min_trabalho_padrao: 10,   // minutos de preparo/acabamento por peça na estimativa do site
    taxa_falha: 10,            // % sobre filamento + energia + máquina
    margem: 120,               // % de lucro sobre o custo
    embalagem: 3,              // R$ por pedido
    minimo_peca: 15,           // preço mínimo de uma peça
    purga_g_troca: 2.5,        // gramas perdidos em cada troca de cor
    velocidade_g_h: 14,        // gramas impressos por hora (para estimar tempo a partir do STL)
    fator_preenchimento: 0.42, // fração do volume do STL que vira plástico (paredes + preenchimento)
    faixa_inferior: 0.9,       // multiplicadores da faixa mostrada ao cliente
    faixa_superior: 1.3,
    area_max_mm: [260, 260, 260],
    materiais: {
      PLA: { densidade: 1.24, preco_kg: 110 },
      PETG: { densidade: 1.27, preco_kg: 120 },
      TPU: { densidade: 1.21, preco_kg: 160 },
    },
    taxas: { pix: 0, cartao_credito: 4.99, cartao_debito: 1.99, dinheiro: 0, boleto: 0, transferencia: 0 },
  });
  app.save(cfg);

  /* ---------- estoque de filamento ---------- */
  const filamentos = new Collection({
    type: 'base', name: 'filamentos',
    listRule: LOGADO, viewRule: LOGADO, createRule: LOGADO, updateRule: LOGADO, deleteRule: DONO,
    fields: [
      { name: 'marca', type: 'text', max: 60 },
      { name: 'material', type: 'select', values: ['PLA', 'PETG', 'TPU', 'Outro'], maxSelect: 1, required: true },
      { name: 'cor', type: 'text', max: 60, required: true },
      { name: 'cor_hex', type: 'text', max: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
      { name: 'acabamento', type: 'text', max: 40 }, // fosco, seda, metalizado, brilha no escuro...
      { name: 'peso_inicial', type: 'number', min: 0, required: true },
      { name: 'peso_restante', type: 'number', min: 0 },
      { name: 'custo', type: 'number', min: 0 },
      { name: 'data_compra', type: 'date' },
      { name: 'minimo', type: 'number', min: 0 },
      { name: 'ativo', type: 'bool' },
      { name: 'obs', type: 'text', max: 500 },
      ...datas,
    ],
  });
  app.save(filamentos);

  /* ---------- clientes ---------- */
  const clientes = new Collection({
    type: 'base', name: 'clientes',
    listRule: LOGADO, viewRule: LOGADO, createRule: LOGADO, updateRule: LOGADO, deleteRule: DONO,
    fields: [
      { name: 'nome', type: 'text', max: 100, required: true },
      { name: 'whatsapp', type: 'text', max: 20 },
      { name: 'email', type: 'email' },
      { name: 'cidade', type: 'text', max: 80 },
      { name: 'obs', type: 'text', max: 1000 },
      ...datas,
    ],
    indexes: ['CREATE INDEX idx_clientes_whatsapp ON clientes (whatsapp)'],
  });
  app.save(clientes);

  /* ---------- produtos da loja ---------- */
  const produtos = new Collection({
    type: 'base', name: 'produtos',
    listRule: `ativo = true || ${LOGADO}`, viewRule: `ativo = true || ${LOGADO}`,
    createRule: DONO, updateRule: DONO, deleteRule: DONO,
    fields: [
      { name: 'codigo', type: 'text', max: 40, required: true, pattern: '^[a-z0-9-]+$' },
      { name: 'ref', type: 'text', max: 20 },
      { name: 'nome', type: 'text', max: 100, required: true },
      { name: 'categoria', type: 'select', values: ['decoracao', 'colecionaveis', 'brinquedos'], maxSelect: 1, required: true },
      { name: 'preco', type: 'number', min: 0 },
      { name: 'sob_consulta', type: 'bool' },
      { name: 'material', type: 'text', max: 40 },
      { name: 'tamanho', type: 'text', max: 60 },
      { name: 'tempo', type: 'text', max: 30 },
      { name: 'camada', type: 'text', max: 20 },
      { name: 'gramas', type: 'number', min: 0 },
      { name: 'horas', type: 'number', min: 0 },
      { name: 'art', type: 'text', max: 20 },
      { name: 'tag', type: 'text', max: 30 },
      { name: 'personalizavel', type: 'bool' },
      { name: 'cores', type: 'json', maxSize: 2000 },
      { name: 'descricao', type: 'text', max: 1000 },
      { name: 'fotos', type: 'file', maxSelect: 8, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], thumbs: ['600x600'] },
      { name: 'foto_previa', type: 'file', maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png'] },
      { name: 'destaque', type: 'bool' },
      { name: 'ordem', type: 'number' },
      { name: 'ativo', type: 'bool' },
      ...datas,
    ],
    indexes: ['CREATE UNIQUE INDEX idx_produtos_codigo ON produtos (codigo)'],
  });
  app.save(produtos);

  /* ---------- pedidos e orçamentos que chegam do site ---------- */
  const pedidos = new Collection({
    type: 'base', name: 'pedidos',
    listRule: LOGADO, viewRule: LOGADO,
    createRule: '', // o site público pode enviar (validado em pb_hooks/pedidos.pb.js)
    updateRule: LOGADO, deleteRule: DONO,
    fields: [
      { name: 'tipo', type: 'select', values: ['loja', 'encomenda', 'consulta', 'calculadora', 'manual'], maxSelect: 1, required: true },
      { name: 'status', type: 'select', values: ['novo', 'em_conversa', 'aprovado', 'recusado', 'convertido'], maxSelect: 1 },
      { name: 'nome', type: 'text', max: 80, required: true },
      { name: 'whatsapp', type: 'text', max: 20, required: true },
      { name: 'email', type: 'email' },
      { name: 'cidade', type: 'text', max: 80 },
      { name: 'itens', type: 'json', maxSize: 20000 },
      { name: 'mensagem', type: 'text', max: 3000 },
      { name: 'arquivos', type: 'file', maxSelect: 6, maxSize: 52428800, protected: true },
      { name: 'estimativa', type: 'json', maxSize: 5000 },
      { name: 'total', type: 'number', min: 0 },
      { name: 'cliente', type: 'relation', collectionId: clientes.id, maxSelect: 1, cascadeDelete: false },
      { name: 'obs_interna', type: 'text', max: 2000 },
      ...datas,
    ],
  });
  app.save(pedidos);

  /* ---------- projetos (produção) ---------- */
  // equipe cria e move projetos, mas só o dono define preço e custo
  const semValores = '@request.body.preco:isset = false && @request.body.custo:isset = false && @request.body.custo_total:isset = false';
  const projetos = new Collection({
    type: 'base', name: 'projetos',
    listRule: LOGADO, viewRule: LOGADO,
    createRule: `${DONO} || (${LOGADO} && ${semValores})`, updateRule: `${DONO} || (${LOGADO} && ${semValores})`, deleteRule: DONO,
    fields: [
      { name: 'titulo', type: 'text', max: 120, required: true },
      { name: 'cliente', type: 'relation', collectionId: clientes.id, maxSelect: 1, cascadeDelete: false },
      { name: 'pedido', type: 'relation', collectionId: pedidos.id, maxSelect: 1, cascadeDelete: false },
      { name: 'status', type: 'select', values: ['orcamento', 'aprovado', 'imprimindo', 'acabamento', 'pronto', 'enviado', 'entregue', 'cancelado'], maxSelect: 1, required: true },
      { name: 'prazo', type: 'date' },
      { name: 'itens', type: 'json', maxSize: 20000 },
      { name: 'uso_filamento', type: 'json', maxSize: 5000 }, // [{ filamento: id, gramas: n }]
      { name: 'horas_maquina', type: 'number', min: 0 },
      { name: 'min_trabalho', type: 'number', min: 0 },
      { name: 'trocas_cor', type: 'number', min: 0 },
      { name: 'quantidade', type: 'number', min: 0 },
      { name: 'custo', type: 'json', maxSize: 5000 },
      { name: 'custo_total', type: 'number', min: 0 },
      { name: 'preco', type: 'number', min: 0 },
      { name: 'estoque_baixado', type: 'bool' },
      { name: 'receita_gerada', type: 'bool' },
      { name: 'arquivos', type: 'file', maxSelect: 10, maxSize: 52428800, protected: true },
      { name: 'obs', type: 'text', max: 3000 },
      ...datas,
    ],
  });
  app.save(projetos);

  /* ---------- movimentações de estoque (histórico, não se edita) ---------- */
  const movimentos = new Collection({
    type: 'base', name: 'movimentos',
    listRule: LOGADO, viewRule: LOGADO, createRule: LOGADO, updateRule: null, deleteRule: null,
    fields: [
      { name: 'filamento', type: 'relation', collectionId: filamentos.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'tipo', type: 'select', values: ['entrada', 'saida', 'ajuste'], maxSelect: 1, required: true },
      { name: 'gramas', type: 'number', required: true },
      { name: 'projeto', type: 'relation', collectionId: projetos.id, maxSelect: 1, cascadeDelete: false },
      { name: 'usuario', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: 'obs', type: 'text', max: 300 },
      ...datas,
    ],
  });
  app.save(movimentos);

  /* ---------- financeiro ---------- */
  const lancamentos = new Collection({
    type: 'base', name: 'lancamentos',
    listRule: DONO, viewRule: DONO, createRule: DONO, updateRule: DONO, deleteRule: DONO,
    fields: [
      { name: 'tipo', type: 'select', values: ['entrada', 'saida'], maxSelect: 1, required: true },
      { name: 'categoria', type: 'select', values: ['venda_loja', 'encomenda', 'filamento', 'energia', 'manutencao', 'equipamento', 'embalagem', 'frete', 'marketing', 'impostos', 'outros'], maxSelect: 1, required: true },
      { name: 'descricao', type: 'text', max: 200, required: true },
      { name: 'valor', type: 'number', min: 0, required: true },
      { name: 'forma_pagamento', type: 'select', values: ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'boleto', 'transferencia'], maxSelect: 1 },
      { name: 'taxa', type: 'number', min: 0 },
      { name: 'vencimento', type: 'date' },
      { name: 'pago', type: 'bool' },
      { name: 'data_pagamento', type: 'date' },
      { name: 'projeto', type: 'relation', collectionId: projetos.id, maxSelect: 1, cascadeDelete: false },
      { name: 'cliente', type: 'relation', collectionId: clientes.id, maxSelect: 1, cascadeDelete: false },
      { name: 'obs', type: 'text', max: 1000 },
      ...datas,
    ],
  });
  app.save(lancamentos);

  /* ---------- configurações do servidor ---------- */
  const s = app.settings();
  unmarshal({
    meta: { appName: 'Métricas Vaz 3D' },
    backups: { cron: '0 3 * * *', cronMaxKeep: 14 },
    // no VPS o PocketBase fica atrás do Caddy; o IP real do visitante vem neste cabeçalho
    // (o servidor só escuta em 127.0.0.1, então ninguém de fora consegue forjá-lo)
    trustedProxy: { headers: ['X-Forwarded-For'], useLeftmostIP: false },
    rateLimits: {
      enabled: true,
      rules: [
        { label: '*:auth', audience: '', duration: 3, maxRequests: 2 },
        { label: '*:create', audience: '', duration: 5, maxRequests: 20 },
        { label: 'pedidos:create', audience: '@guest', duration: 600, maxRequests: 8 },
        { label: 'POST /api/mv/estimativa', audience: '@guest', duration: 60, maxRequests: 30 },
        { label: 'POST /api/mv/primeiro-acesso', audience: '', duration: 60, maxRequests: 5 },
        { label: '/api/', audience: '', duration: 10, maxRequests: 300 },
      ],
    },
  }, s);
  app.save(s);
}, (app) => {
  for (const n of ['lancamentos', 'movimentos', 'projetos', 'pedidos', 'produtos', 'clientes', 'filamentos', 'config']) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (e) { /* já removida */ }
  }
  const users = app.findCollectionByNameOrId('users');
  users.fields.removeByName('papel');
  app.save(users);
});
