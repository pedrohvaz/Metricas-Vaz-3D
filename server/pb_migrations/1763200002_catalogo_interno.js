/// <reference path="../pb_data/types.d.ts" />
/* Catálogo interno (ex.: Coleção de Natal com modelos de terceiros do MakerWorld).
   Produtos "interno" nunca aparecem na loja, mesmo marcados como ativos. */
migrate((app) => {
  const c = app.findCollectionByNameOrId('produtos');
  const cat = c.fields.getByName('categoria');
  const valores = [];
  for (let i = 0; i < cat.values.length; i++) valores.push(String(cat.values[i]));
  if (valores.indexOf('natal') < 0) valores.push('natal');
  cat.values = valores;
  c.fields.add(new BoolField({ name: 'interno' }));
  c.fields.add(new SelectField({ name: 'licenca', values: ['nao_verificada', 'comercial_ok', 'sem_licenca_comercial', 'propria'], maxSelect: 1 }));
  c.fields.add(new TextField({ name: 'credito', max: 120 }));
  c.fields.add(new URLField({ name: 'link_modelo' }));
  c.fields.add(new TextField({ name: 'obs_interna', max: 1000 }));
  c.fields.add(new FileField({ name: 'foto_referencia', maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], thumbs: ['600x600'], protected: true }));
  const LOGADO = '@request.auth.id != ""';
  c.listRule = `(ativo = true && interno != true) || ${LOGADO}`;
  c.viewRule = `(ativo = true && interno != true) || ${LOGADO}`;
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId('produtos');
  for (const n of ['interno', 'licenca', 'credito', 'link_modelo', 'obs_interna', 'foto_referencia']) c.fields.removeByName(n);
  c.listRule = 'ativo = true || @request.auth.id != ""';
  c.viewRule = 'ativo = true || @request.auth.id != ""';
  app.save(c);
});
