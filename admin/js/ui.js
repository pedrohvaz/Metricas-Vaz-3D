/* Utilitários de interface do painel. */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = v => brl.format(Number(v) || 0).replace(/ /g, ' ');
export const num = (v, d = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(Number(v) || 0);
export const kg = g => (Number(g) || 0) >= 1000 ? `${num(g / 1000, 2)} kg` : `${num(g, 0)} g`;

/* Datas: o PocketBase guarda "2026-11-15 12:00:00.000Z". Gravamos ao meio-dia UTC para não mudar de dia no Brasil. */
export const dataIn = v => (v ? String(v).slice(0, 10) : '');
export const dataOut = s => (s ? `${s} 12:00:00.000Z` : '');
export const dataBR = v => { if (!v) return '—'; const [a, m, d] = String(v).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
export const dataHora = v => v ? new Date(String(v).replace(' ', 'T')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const waLink = (fone, msg = '') => { let d = String(fone || '').replace(/\D/g, ''); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}${msg ? '?text=' + encodeURIComponent(msg) : ''}`; };
export const foneBR = f => { const d = String(f || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : f || '—'; };

/* Mensagem de erro legível a partir de um erro do PocketBase. */
export function msgErro(e) {
  const d = e && e.response && e.response.data;
  if (d && typeof d === 'object') {
    const [campo, info] = Object.entries(d)[0] || [];
    if (info && info.message) return `${campo}: ${info.message}`;
  }
  if (e && e.status === 0) return 'Sem conexão com o servidor.';
  if (e && e.status === 403) return (e.response && e.response.message) || 'Você não tem permissão para isso.';
  return (e && e.response && e.response.message) || (e && e.message) || 'Algo deu errado.';
}

let tt;
export function toast(t, tipo = '') {
  const el = $('#toast');
  el.textContent = t; el.className = `toast show ${tipo}`;
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3200);
}

/* Janela modal. Retorna { el, fechar, form }. Ao fechar, remove do DOM. */
export function modal({ titulo, corpo, largo = false, rodape = '' }) {
  const d = document.createElement('dialog');
  d.className = `mdl${largo ? ' largo' : ''}`;
  d.innerHTML = `<div class="mdl-head"><h2>${esc(titulo)}</h2><button type="button" class="x" data-fechar aria-label="Fechar">×</button></div>
    <div class="mdl-body">${corpo}</div>${rodape ? `<div class="mdl-foot">${rodape}</div>` : ''}`;
  document.body.appendChild(d);
  const fechar = () => { d.close(); d.remove(); };
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-fechar]')) fechar(); });
  d.addEventListener('cancel', e => { e.preventDefault(); fechar(); });
  d.showModal();
  const primeiro = d.querySelector('.mdl-body input:not([type=hidden]), .mdl-body select, .mdl-body textarea');
  if (primeiro) primeiro.focus();
  return { el: d, fechar, form: d.querySelector('form') };
}

export function confirmar(texto, { ok = 'Confirmar', perigo = false } = {}) {
  return new Promise(res => {
    const m = modal({ titulo: 'Confirmar', corpo: `<p>${esc(texto)}</p>`, rodape: `<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn ${perigo ? 'btn-perigo' : 'btn-primary'}" data-ok>${esc(ok)}</button>` });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.fechar(); res(true); });
    m.el.addEventListener('close', () => res(false));
  });
}

/* Lê um formulário em objeto. Campos number viram número; checkbox vira booleano; vazios viram ''. */
export function lerForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') { if (el.dataset.lista != null) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else if (el.type === 'number') o[el.name] = el.value === '' ? '' : Number(el.value.replace(',', '.'));
    else if (el.type === 'file') continue;
    else o[el.name] = el.value.trim();
  }
  return o;
}

/* Botão com estado "salvando" durante uma ação assíncrona. */
export async function ocupado(btn, fn) {
  if (btn) { btn.disabled = true; btn.dataset.txt = btn.textContent; btn.textContent = 'Salvando…'; }
  try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.txt; } }
}

export const opcoes = (lista, atual) => lista.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(t)}</option>`).join('');
export const vazio = (texto, acao = '') => `<div class="vazio"><p>${esc(texto)}</p>${acao}</div>`;
export const campo = (rotulo, html, { full = false, dica = '' } = {}) => `<label class="fld${full ? ' full' : ''}"><span>${rotulo}</span>${html}${dica ? `<small>${dica}</small>` : ''}</label>`;
