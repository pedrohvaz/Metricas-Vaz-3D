/* Equipe (só o dono): quem acessa o painel e com qual perfil. */
import { esc, dataBR, toast, msgErro, modal, confirmar, lerForm, ocupado, opcoes, campo } from '../ui.js';

const PAPEIS = [['equipe', 'Equipe · pedidos, projetos, clientes e estoque'], ['dono', 'Dono · acesso total, inclusive financeiro']];

export async function render(el, ctx, acoes) {
  const { pb } = ctx;
  acoes.innerHTML = '<button class="btn btn-primary" type="button" id="novoU">+ Pessoa</button>';
  async function carregar() {
    const us = await pb.collection('users').getFullList({ sort: 'name' });
    el.innerHTML = `<p class="dica">A equipe não vê o financeiro, as configurações de custo nem o preço e o custo dos projetos.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Desde</th><th></th></tr></thead><tbody>
      ${us.map(u => `<tr><td><b>${esc(u.name || '—')}</b>${u.id === ctx.user.id ? ' <small>(você)</small>' : ''}</td><td>${esc(u.email)}</td><td>${u.papel === 'dono' ? 'Dono' : 'Equipe'}</td><td>${dataBR(u.created)}</td>
        <td class="num">${u.id !== ctx.user.id ? `<button type="button" class="btn sm" data-ed="${u.id}">Editar</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
    el._us = Object.fromEntries(us.map(u => [u.id, u]));
  }
  el.addEventListener('click', e => { const b = e.target.closest('[data-ed]'); if (b) editar(ctx, el._us[b.dataset.ed], carregar); });
  document.getElementById('novoU').addEventListener('click', () => editar(ctx, null, carregar));
  await carregar();
}

function editar(ctx, u, aoMudar) {
  const { pb } = ctx;
  const m = modal({
    titulo: u ? u.name || u.email : 'Nova pessoa na equipe',
    corpo: `<form class="frm" novalidate>
      ${campo('Nome', `<input name="name" required value="${esc(u?.name || '')}">`, { full: true })}
      ${u ? '' : campo('E-mail', '<input name="email" type="email" required autocomplete="off">', { full: true })}
      ${campo('Perfil', `<select name="papel">${opcoes(PAPEIS, u?.papel || 'equipe')}</select>`, { full: true })}
      ${campo(u ? 'Nova senha (opcional)' : 'Senha inicial', `<input name="password" type="text" autocomplete="off" minlength="10" ${u ? '' : 'required'}>`, { full: true, dica: 'Mínimo de 10 caracteres. Passe para a pessoa e peça para trocar em “Minha conta”.' })}
    </form>`,
    rodape: `${u ? '<button type="button" class="btn btn-perigo esq" data-del>Remover acesso</button>' : ''}<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primary" data-salvar>Salvar</button>`,
  });
  m.el.querySelector('[data-salvar]').addEventListener('click', async ev => {
    const d = lerForm(m.form);
    if (!d.name) return toast('Informe o nome.', 'erro');
    if (d.password && d.password.length < 10) return toast('A senha precisa de pelo menos 10 caracteres.', 'erro');
    const dados = { name: d.name, papel: d.papel };
    if (d.password) Object.assign(dados, { password: d.password, passwordConfirm: d.password });
    if (!u) Object.assign(dados, { email: d.email, verified: true, emailVisibility: true });
    try { await ocupado(ev.target, () => u ? pb.collection('users').update(u.id, dados) : pb.collection('users').create(dados)); toast('Acesso salvo'); m.fechar(); aoMudar(); }
    catch (e) { toast(msgErro(e), 'erro'); }
  });
  m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmar(`Remover o acesso de ${u.name || u.email}?`, { ok: 'Remover', perigo: true }))) return;
    try { await pb.collection('users').delete(u.id); toast('Acesso removido'); m.fechar(); aoMudar(); } catch (e) { toast(msgErro(e), 'erro'); }
  });
}
