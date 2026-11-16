/// <reference path="../pb_data/types.d.ts" />
/* Vitrine "Ideias de Natal": modelos do catálogo interno com licença comercial confirmada ficam visíveis na loja
   (com crédito e link do designer). Personagens e marcas de terceiros saem do catálogo. */
migrate((app) => {
  const c = app.findCollectionByNameOrId('produtos');
  c.fields.add(new BoolField({ name: 'marca' }));
  const ref = c.fields.getByName('foto_referencia');
  ref.protected = false; // a vitrine mostra a foto do designer (com crédito) nos modelos liberados
  const LOGADO = '@request.auth.id != ""';
  const regra = `(ativo = true && interno != true) || (interno = true && licenca = "comercial_ok" && marca != true) || ${LOGADO}`;
  c.listRule = regra;
  c.viewRule = regra;
  app.save(c);

  // remove personagens/marcas de terceiros que já tenham sido importados
  const MARCA = /grinch|mario|pok[eé]mon|pikachu|皮卡丘|mickey|olaf|death star|star ?wars|estrela da morte|hogwarts/i;
  const recs = app.findRecordsByFilter('produtos', 'interno = true', '', 0, 0);
  for (const r of recs) {
    if (MARCA.test(r.getString('nome') + ' ' + r.getString('descricao'))) app.delete(r);
  }
}, (app) => {
  const c = app.findCollectionByNameOrId('produtos');
  c.fields.removeByName('marca');
  c.fields.getByName('foto_referencia').protected = true;
  const LOGADO = '@request.auth.id != ""';
  c.listRule = `(ativo = true && interno != true) || ${LOGADO}`;
  c.viewRule = `(ativo = true && interno != true) || ${LOGADO}`;
  app.save(c);
});
