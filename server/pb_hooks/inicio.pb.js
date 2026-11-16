/// <reference path="../pb_data/types.d.ts" />
/* Importa sozinho os produtos da loja e os catálogos internos de data/importar/ logo depois que o servidor sobe.
   Roda a cada minuto, mas cada importação acontece uma única vez (fica anotada na configuração),
   então itens apagados depois não voltam. */
cronAdd('mv_importacao_inicial', '* * * * *', () => {
  const I = require(`${__hooks}/lib/importar.js`);
  const U = require(`${__hooks}/lib/util.js`);
  try {
    const cfg = $app.findRecordById('config', 'configuracao001');
    let custos = {};
    try { custos = JSON.parse(cfg.getString('custos') || '{}') || {}; } catch (err) { custos = {}; }
    const feitas = Object.assign({}, custos._importacoes || {});
    const pendentes = I.listarColecoes($app).filter(c => !feitas[c.colecao]);
    if (feitas.catalogo && !pendentes.length) return; // nada a fazer

    const hoje = new Date().toISOString().slice(0, 10);
    let importou = false;
    if (!feitas.catalogo) {
      const r = I.importarCatalogo($app);
      if (r.importados) { console.log(`Importados ${r.importados} produtos da loja.`); importou = true; }
      feitas.catalogo = hoje;
    }
    for (const c of pendentes) {
      if (c.importados === 0) {
        const r = I.importarColecao($app, c.colecao);
        console.log(`Catálogo interno "${c.colecao}": ${r.criados} modelos importados (${r.sem_foto} sem foto).`);
        importou = true;
      }
      feitas[c.colecao] = hoje;
    }
    custos._importacoes = feitas;
    cfg.set('custos', custos);
    $app.save(cfg);
    if (importou) U.publicarSite($app);
  } catch (err) {
    console.log('Importação automática não concluída: ' + err);
  }
});
