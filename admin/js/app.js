/* Painel administrativo Métricas Vaz 3D: login, menu, navegação entre telas. */
import PocketBase from '../vendor/pocketbase.es.mjs';
import { $, $$, esc, toast, msgErro, modal, lerForm, ocupado, campo } from './ui.js';

const BASE = new URL('..', location.href).href.replace(/\/$/, '');
export const pb = new PocketBase(BASE);
pb.autoCancellation(false);

export const ctx = {
  pb, BASE, user: null, dono: false, config: null, catalogo: { categorias: {}, cores: {}, arts: [] },
  async recarregarConfig() {
    if (!ctx.dono) return null;
    try { ctx.config = (await pb.collection('config').getOne('configuracao001')).custos || {}; } catch (e) { ctx.config = {}; }
    return ctx.config;
  },
};

const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TELAS = [
  { id: 'inicio', nome: 'Início', ic: I('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>') },
  { id: 'pedidos', nome: 'Pedidos', ic: I('<path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/>') },
  { id: 'projetos', nome: 'Projetos', ic: I('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>') },
  { id: 'estoque', nome: 'Estoque', ic: I('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>') },
  { id: 'clientes', nome: 'Clientes', ic: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>') },
  { id: 'produtos', nome: 'Produtos', dono: true, ic: I('<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>') },
  { id: 'financeiro', nome: 'Financeiro', dono: true, ic: I('<path d="M4 19V9M10 19V5M16 19v-7M21 19H3"/>') },
  { id: 'calculadora', nome: 'Calculadora', dono: true, ic: I('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/>') },
  { id: 'config', nome: 'Configurações', dono: true, ic: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>') },
  { id: 'equipe', nome: 'Equipe', dono: true, ic: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') },
];

/* ---------- acesso ---------- */
async function telaAcesso() {
  document.body.className = 'acesso';
  let primeiro = false;
  try { primeiro = (await (await fetch(`${BASE}/api/mv/status`)).json()).primeiro_acesso; } catch (e) { /* servidor fora do ar */ }
  $('#app').innerHTML = `<main class="login">
    <div class="login-card">
      <img src="${BASE}/assets/img/logo-256.webp" alt="Logotipo MV 3D" width="116" height="96">
      <h1>${primeiro ? 'Primeiro acesso' : 'Painel Métricas Vaz 3D'}</h1>
      <p>${primeiro ? 'Crie a conta do dono do sistema. Depois você cadastra a equipe em Equipe.' : 'Entre com seu e-mail e senha.'}</p>
      <form id="fAcesso" class="frm" novalidate>
        ${primeiro ? campo('Seu nome', '<input name="nome" autocomplete="name" required>', { full: true }) : ''}
        ${campo('E-mail', '<input name="email" type="email" autocomplete="username" required>', { full: true })}
        ${campo('Senha', `<input name="senha" type="password" autocomplete="${primeiro ? 'new-password' : 'current-password'}" required${primeiro ? ' minlength="10"' : ''}>`, { full: true, dica: primeiro ? 'Mínimo de 10 caracteres.' : '' })}
        ${primeiro ? campo('Chave de instalação <small>(só no servidor online)</small>', '<input name="chave" autocomplete="off">', { full: true, dica: 'No seu computador, deixe em branco.' }) : ''}
        <p class="err" id="eAcesso" hidden></p>
        <button class="btn btn-primary full" type="submit">${primeiro ? 'Criar conta e entrar' : 'Entrar'}</button>
      </form>
      <a class="voltar" href="${BASE}/">← Voltar para a loja</a>
    </div></main>`;
  $('#fAcesso').addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerForm(e.target), err = $('#eAcesso');
    err.hidden = true;
    try {
      await ocupado(e.submitter, async () => {
        if (primeiro) {
          const r = await fetch(`${BASE}/api/mv/primeiro-acesso`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.message || 'Não foi possível criar a conta.');
        }
        await pb.collection('users').authWithPassword(d.email, d.senha);
      });
      iniciar();
    } catch (ex) { err.textContent = ex.status === 400 ? 'E-mail ou senha incorretos.' : msgErro(ex); err.hidden = false; }
  });
}

/* ---------- estrutura ---------- */
function montarLayout() {
  document.body.className = 'painel';
  const telas = TELAS.filter(t => !t.dono || ctx.dono);
  $('#app').innerHTML = `
  <aside class="lateral" id="lateral">
    <a class="marca" href="#/inicio"><img src="${BASE}/assets/img/logo-128.webp" alt="" width="46" height="38"><span><b>Métricas Vaz 3D</b><small>Painel</small></span></a>
    <nav class="menu" aria-label="Painel">${telas.map(t => `<a href="#/${t.id}" data-tela="${t.id}">${t.ic}<span>${t.nome}</span>${t.id === 'pedidos' ? '<em class="badge" id="bPedidos" hidden></em>' : ''}</a>`).join('')}</nav>
    <div class="lateral-pe">
      <a href="${BASE}/" target="_blank" rel="noopener">Ver a loja ↗</a>
      <button type="button" class="link" id="bConta">${esc(ctx.user.name || ctx.user.email)} · ${ctx.dono ? 'dono' : 'equipe'}</button>
      <button type="button" class="link" id="bSair">Sair</button>
    </div>
  </aside>
  <div class="area">
    <header class="topo"><button type="button" class="icone menu-btn" id="bMenu" aria-label="Abrir menu" aria-expanded="false">☰</button><h1 id="titulo">—</h1><div class="topo-acoes" id="acoes"></div></header>
    <main id="tela" class="tela" tabindex="-1"></main>
  </div>`;
  $('#bSair').addEventListener('click', () => { pb.authStore.clear(); location.hash = ''; telaAcesso(); });
  $('#bConta').addEventListener('click', minhaConta);
  $('#bMenu').addEventListener('click', () => { const ab = document.body.classList.toggle('menu-aberto'); $('#bMenu').setAttribute('aria-expanded', ab); });
  $('#lateral').addEventListener('click', e => { if (e.target.closest('a')) document.body.classList.remove('menu-aberto'); });
}

function minhaConta() {
  const m = modal({
    titulo: 'Minha conta',
    corpo: `<form class="frm" novalidate>
      ${campo('Nome', `<input name="name" value="${esc(ctx.user.name || '')}">`, { full: true })}
      ${campo('Senha atual', '<input name="oldPassword" type="password" autocomplete="current-password">', { full: true, dica: 'Preencha só se for trocar a senha.' })}
      ${campo('Nova senha', '<input name="password" type="password" autocomplete="new-password" minlength="10">')}
      ${campo('Repita a nova senha', '<input name="passwordConfirm" type="password" autocomplete="new-password">')}
    </form>`,
    rodape: '<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Salvar</button>',
  });
  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    const dados = { name: d.name };
    if (d.password) Object.assign(dados, { oldPassword: d.oldPassword, password: d.password, passwordConfirm: d.passwordConfirm });
    try {
      await ocupado(ev.target, () => pb.collection('users').update(ctx.user.id, dados));
      if (d.password) { toast('Senha alterada. Entre novamente.'); pb.authStore.clear(); m.fechar(); telaAcesso(); return; }
      ctx.user.name = d.name; $('#bConta').textContent = `${d.name} · ${ctx.dono ? 'dono' : 'equipe'}`;
      toast('Dados salvos'); m.fechar();
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
}

/* ---------- navegação ---------- */
let renderizando = 0;
export async function navegar() {
  const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1] || 'inicio';
  const t = TELAS.find(x => x.id === id && (!x.dono || ctx.dono)) || TELAS[0];
  $$('dialog.mdl').forEach(d => { d.close(); d.remove(); }); // janelas abertas não sobrevivem à troca de tela
  $$('.menu a').forEach(a => a.toggleAttribute('aria-current', a.dataset.tela === t.id));
  $('#titulo').textContent = t.nome;
  document.title = `${t.nome} · Painel Métricas Vaz 3D`;
  $('#acoes').innerHTML = '';
  const el = $('#tela');
  el.innerHTML = '<div class="carregando">Carregando…</div>';
  const n = ++renderizando;
  try {
    const mod = await import(`./telas/${t.id}.js`);
    if (n !== renderizando) return;
    el.innerHTML = '';
    await mod.render(el, ctx, $('#acoes'));
  } catch (e) {
    console.error(e);
    if (e && e.status === 401) { pb.authStore.clear(); telaAcesso(); return; }
    el.innerHTML = `<div class="vazio"><p>Não foi possível abrir esta tela.</p><p class="err">${esc(msgErro(e))}</p></div>`;
  }
}
export const recarregar = () => navegar();

/* Pedidos novos: contador no menu e aviso em tempo real. */
async function vigiarPedidos() {
  const atualiza = async () => {
    try {
      const r = await pb.collection('pedidos').getList(1, 1, { filter: 'status = "novo"', fields: 'id' });
      const b = $('#bPedidos'); if (!b) return;
      b.textContent = r.totalItems; b.hidden = !r.totalItems;
    } catch (e) { /* sem conexão */ }
  };
  await atualiza();
  try {
    await pb.collection('pedidos').subscribe('*', ev => {
      if (ev.action === 'create') toast(`Novo pedido de ${ev.record.nome}`, 'info');
      atualiza();
    });
  } catch (e) { /* realtime indisponível */ }
}

async function iniciar() {
  if (!pb.authStore.isValid) return telaAcesso();
  try { await pb.collection('users').authRefresh(); } catch (e) { pb.authStore.clear(); return telaAcesso(); }
  ctx.user = pb.authStore.record;
  ctx.dono = ctx.user.papel === 'dono';
  try { ctx.catalogo = await (await fetch('catalogo.json', { cache: 'no-cache' })).json(); } catch (e) { /* sem catálogo */ }
  await ctx.recarregarConfig();
  montarLayout();
  vigiarPedidos();
  await navegar();
}

window.addEventListener('hashchange', () => { if (ctx.user) navegar(); });
iniciar();
