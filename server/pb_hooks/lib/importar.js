/* Importações de produtos: catálogo atual da loja (data/produtos.json) e catálogos internos (data/importar/<nome>.json).
   Usado pelas rotas do painel e pela importação automática na primeira inicialização. */
const RAIZ = __hooks + '/../..';

function comPublicacaoPausada(app, fn) {
  app.store().set('mv_pausar_publicacao', true);
  try { return fn(); } finally { app.store().remove('mv_pausar_publicacao'); }
}

const produtosDaLoja = app => app.findRecordsByFilter('produtos', 'interno != true', '', 0, 0).length;

/* Os produtos atuais do site. Só roda se ainda não houver nenhum produto da loja no banco. */
function importarCatalogo(app) {
  if (produtosDaLoja(app) > 0) return { importados: 0, motivo: 'ja_existem' };
  const loja = JSON.parse(toString($os.readFile(RAIZ + '/data/produtos.json')));
  const col = app.findCollectionByNameOrId('produtos');
  const destaques = loja.destaques || [];
  const pasta = RAIZ + '/assets/img/produtos/';
  const arquivo = nome => { try { return $filesystem.fileFromPath(pasta + nome); } catch (err) { return null; } };
  let n = 0;
  comPublicacaoPausada(app, () => {
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
      r.set('interno', false);
      r.set('licenca', 'propria');
      const fotos = (p.fotos || []).map(arquivo).filter(Boolean);
      if (fotos.length) r.set('fotos', fotos);
      const jpg = (p.fotos || [])[0] ? arquivo(p.fotos[0].replace(/\.webp$/i, '.jpg')) : null;
      if (jpg) r.set('foto_previa', jpg);
      app.save(r);
      n++;
    });
  });
  return { importados: n };
}

function lerColecao(colecao) {
  return JSON.parse(toString($os.readFile(RAIZ + '/data/importar/' + colecao + '.json')));
}

const jaImportados = (app, colecao) => app.findRecordsByFilter('produtos', 'codigo ~ {:p}', '', 0, 0, { p: colecao + '-%' }).length;

function listarColecoes(app) {
  const lista = [];
  let arquivos = [];
  try { arquivos = $os.readDir(RAIZ + '/data/importar'); } catch (err) { arquivos = []; }
  for (const a of arquivos) {
    const nome = a.name();
    if (a.isDir() || !/\.json$/.test(nome)) continue;
    try {
      const d = JSON.parse(toString($os.readFile(RAIZ + '/data/importar/' + nome)));
      const colecao = String(d.colecao || nome.replace(/\.json$/, ''));
      lista.push({ colecao, arquivo: nome, total: (d.itens || []).length, importados: jaImportados(app, colecao), fonte: d.fonte || '' });
    } catch (err) { /* arquivo inválido */ }
  }
  return lista;
}

/* Catálogo interno: produtos OCULTOS (interno = true), sem duplicar os que já existem. */
function importarColecao(app, colecao) {
  const d = lerColecao(colecao);
  const col = app.findCollectionByNameOrId('produtos');
  const pastaImg = RAIZ + '/data/importar/' + colecao + '/';
  const categoria = colecao === 'natal' ? 'natal' : 'decoracao';
  let criados = 0, existentes = 0, semFoto = 0;
  comPublicacaoPausada(app, () => {
    for (const it of (d.itens || [])) {
      let existe = null;
      try { existe = app.findFirstRecordByData('produtos', 'codigo', it.codigo); } catch (err) { existe = null; }
      if (existe) { existentes++; continue; }
      if (it.marca_registrada) continue; // personagens e marcas de terceiros não entram no catálogo
      const r = new Record(col);
      r.set('codigo', it.codigo);
      r.set('ref', 'NT-' + String(it.numero).padStart(3, '0'));
      r.set('nome', String(it.nome).slice(0, 100));
      r.set('categoria', categoria);
      r.set('preco', 0);
      r.set('sob_consulta', true);
      r.set('material', 'PLA');
      r.set('art', 'gear');
      r.set('cores', ['vermelho', 'verde', 'branco', 'dourado']);
      r.set('descricao', ('Modelo "' + it.nome_original + '" de ' + it.criador + ' (' + (d.fonte || 'MakerWorld') + ').').slice(0, 1000));
      r.set('credito', String(it.criador || '').slice(0, 120));
      if (it.link) r.set('link_modelo', it.link);
      r.set('licenca', 'nao_verificada');
      r.set('interno', true);
      r.set('ativo', false);
      r.set('ordem', 1000 + Number(it.numero || 0));
      if (it.arquivo) {
        try { r.set('foto_referencia', $filesystem.fileFromPath(pastaImg + it.arquivo)); } catch (err) { semFoto++; }
      } else semFoto++;
      app.save(r);
      criados++;
    }
  });
  return { colecao, criados, existentes, sem_foto: semFoto };
}

module.exports = { importarCatalogo, listarColecoes, importarColecao, jaImportados, produtosDaLoja };
