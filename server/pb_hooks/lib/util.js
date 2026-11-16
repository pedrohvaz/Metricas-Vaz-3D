/* Funções compartilhadas pelos hooks. Cada handler do PocketBase roda isolado, então os hooks fazem
   require deste arquivo dentro do próprio handler. */

const RAIZ = __hooks + '/../..'; // server/pb_hooks → raiz do projeto
const CONFIG_ID = 'configuracao001';
const STATUS_PRODUZIDO = ['acabamento', 'pronto', 'enviado', 'entregue'];
const STATUS_RECEITA = ['aprovado', 'imprimindo', 'acabamento', 'pronto', 'enviado', 'entregue'];

function lerJSON(rec, campo, padrao) {
  try {
    const bruto = rec.getString(campo);
    if (bruto && bruto !== 'null') return JSON.parse(bruto);
  } catch (e) { /* tenta a forma abaixo */ }
  try { return JSON.parse(toString(rec.get(campo))) || padrao; } catch (e) { return padrao; }
}

function custos(app) {
  try { return lerJSON(app.findRecordById('config', CONFIG_ID), 'custos', {}) || {}; } catch (e) { return {}; }
}

const ehDono = auth => !!auth && (auth.isSuperuser() || auth.getString('papel') === 'dono');
const soDigitos = s => String(s || '').replace(/\D/g, '');
const hojeISO = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';

/* Liga o pedido a um cliente (procura pelo WhatsApp; cria se não existir). */
function vincularCliente(app, pedido) {
  const wa = soDigitos(pedido.getString('whatsapp'));
  if (!wa) return;
  let cli = null;
  try { cli = app.findFirstRecordByFilter('clientes', 'whatsapp = {:wa}', { wa }); } catch (e) { cli = null; }
  if (!cli) {
    cli = new Record(app.findCollectionByNameOrId('clientes'));
    cli.set('nome', pedido.getString('nome'));
    cli.set('whatsapp', wa);
    if (pedido.getString('email')) cli.set('email', pedido.getString('email'));
    if (pedido.getString('cidade')) cli.set('cidade', pedido.getString('cidade'));
    app.save(cli);
  }
  pedido.set('cliente', cli.id);
  app.save(pedido);
}

/* Recalcula os itens de um pedido da loja com os preços do banco (o navegador não define preço). */
function normalizarItensLoja(app, itens) {
  const lista = Array.isArray(itens) ? itens.slice(0, 50) : [];
  let total = 0;
  const saida = [];
  for (const it of lista) {
    let p = null;
    try { p = app.findFirstRecordByFilter('produtos', 'codigo = {:c} && ativo = true', { c: String(it.id || it.codigo || '') }); } catch (e) { p = null; }
    if (!p) continue;
    const qtd = Math.max(1, Math.min(99, Math.round(Number(it.qtd) || 1)));
    const consulta = p.getBool('sob_consulta') || !(p.getFloat('preco') > 0);
    const preco = consulta ? 0 : p.getFloat('preco');
    total += preco * qtd;
    saida.push({
      id: p.getString('codigo'), nome: p.getString('nome'), ref: p.getString('ref'),
      cor: String(it.cor || '').slice(0, 30), texto: String(it.nome || it.texto || '').slice(0, 20),
      qtd, preco, sob_consulta: consulta,
    });
  }
  return { itens: saida, total: Math.round(total * 100) / 100 };
}

/* Baixa de estoque e conta a receber de um projeto (chamado depois de salvar). */
function processarProjeto(app, proj, acoes, auth) {
  if (acoes.estoque) {
    const uso = lerJSON(proj, 'uso_filamento', []) || [];
    const col = app.findCollectionByNameOrId('movimentos');
    for (const u of uso) {
      const g = Number(u.gramas) || 0;
      if (!u.filamento || g <= 0) continue;
      const m = new Record(col);
      m.set('filamento', u.filamento);
      m.set('tipo', 'saida');
      m.set('gramas', g);
      m.set('projeto', proj.id);
      if (auth && !auth.isSuperuser()) m.set('usuario', auth.id);
      m.set('obs', 'Baixa automática: ' + proj.getString('titulo').slice(0, 120));
      app.save(m);
    }
  }
  if (acoes.receita) {
    const l = new Record(app.findCollectionByNameOrId('lancamentos'));
    l.set('tipo', 'entrada');
    l.set('categoria', proj.getString('pedido') ? 'encomenda' : 'venda_loja');
    l.set('descricao', 'Projeto: ' + proj.getString('titulo').slice(0, 180));
    l.set('valor', proj.getFloat('preco'));
    l.set('pago', false);
    if (proj.getString('prazo')) l.set('vencimento', proj.getString('prazo'));
    l.set('projeto', proj.id);
    if (proj.getString('cliente')) l.set('cliente', proj.getString('cliente'));
    l.set('obs', 'Gerado automaticamente quando o projeto foi aprovado.');
    app.save(l);
  }
}

/* O que precisa acontecer neste salvamento (avaliado ANTES de salvar). */
function acoesDoProjeto(proj) {
  const st = proj.getString('status');
  const uso = lerJSON(proj, 'uso_filamento', []) || [];
  const acoes = {
    estoque: STATUS_PRODUZIDO.indexOf(st) >= 0 && !proj.getBool('estoque_baixado') && uso.some(u => Number(u.gramas) > 0),
    receita: STATUS_RECEITA.indexOf(st) >= 0 && !proj.getBool('receita_gerada') && proj.getFloat('preco') > 0,
  };
  if (acoes.estoque) proj.set('estoque_baixado', true);
  if (acoes.receita) proj.set('receita_gerada', true);
  return acoes;
}

/* Gera o site público de novo (node src/build.js lendo os produtos do banco). */
function publicarSite(app) {
  if (app.store().get('mv_pausar_publicacao')) return { ok: true, saida: 'adiado' };
  const node = $os.getenv('MV_NODE') || 'node';
  const url = $os.getenv('MV_PB_URL') || 'http://127.0.0.1:8090';
  try {
    const cmd = $os.cmd(node, RAIZ + '/src/build.js', '--pb=' + url);
    cmd.dir = RAIZ;
    const saida = toString(cmd.combinedOutput());
    app.logger().info('Site publicado', 'saida', saida.slice(0, 3000));
    return { ok: true, saida };
  } catch (err) {
    app.logger().error('Falha ao publicar o site', 'erro', String(err));
    return { ok: false, saida: String(err) };
  }
}

module.exports = {
  RAIZ, CONFIG_ID, STATUS_PRODUZIDO, STATUS_RECEITA,
  lerJSON, custos, ehDono, soDigitos, hojeISO,
  vincularCliente, normalizarItensLoja, processarProjeto, acoesDoProjeto, publicarSite,
};
