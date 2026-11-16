/// <reference path="../pb_data/types.d.ts" />
/* O dono pode criar contas já verificadas e redefinir a senha de quem é da equipe. */
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.manageRule = '@request.auth.papel = "dono"';
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId('users');
  users.manageRule = null;
  app.save(users);
});
