/* Configurações de custo (só o dono). Valem para as duas calculadoras e para os custos dos projetos. */
import { $, $$, esc, money, toast, msgErro, ocupado, campo } from '../ui.js';
import { FORMAS } from '../rotulos.js';

const GRUPOS = [
  ['Energia e máquina', [
    ['tarifa_kwh', 'Tarifa de energia (R$ por kWh)', 'Valor total da conta ÷ kWh consumidos, com impostos.', 0.01],
    ['consumo_kw', 'Consumo da impressora imprimindo (kW)', 'Média com a mesa aquecida. Uma tomada medidora dá o número exato.', 0.01],
    ['valor_impressora', 'Valor pago na impressora (R$)', '', 1],
    ['vida_util_h', 'Vida útil em horas de impressão', 'Horas até a máquina precisar ser trocada ou reformada.', 100],
    ['manutencao_h', 'Manutenção por hora (R$)', 'Bicos, correias, mesa PEI, lubrificação.', 0.01],
  ]],
  ['Trabalho e venda', [
    ['hora_trabalho', 'Valor da sua hora (R$)', 'Usado no tempo de preparo, retirada de suportes e acabamento.', 1],
    ['min_trabalho_padrao', 'Minutos de trabalho por peça (padrão)', 'Usado na estimativa do site.', 1],
    ['margem', 'Margem de lucro (%) sobre o custo', '100% = preço é o dobro do custo.', 1],
    ['minimo_peca', 'Preço mínimo por peça (R$)', '', 0.5],
    ['embalagem', 'Embalagem por pedido (R$)', '', 0.5],
    ['taxa_falha', 'Reserva para falhas (%)', 'Peças que dão errado e precisam ser reimpressas.', 1],
  ]],
  ['Estimativa a partir do STL', [
    ['velocidade_g_h', 'Gramas impressos por hora', 'Média das suas impressões (gramas ÷ horas do fatiador).', 0.5],
    ['fator_preenchimento', 'Fração do volume que vira plástico', '0,42 ≈ 3 paredes + 15% de preenchimento.', 0.01],
    ['purga_g_troca', 'Gramas perdidos por troca de cor', '', 0.1],
    ['faixa_inferior', 'Faixa mostrada ao cliente: multiplicador mínimo', 'Ex.: 0,9 = 10% abaixo do calculado.', 0.05],
    ['faixa_superior', 'Faixa mostrada ao cliente: multiplicador máximo', 'Ex.: 1,3 = 30% acima do calculado.', 0.05],
  ]],
];

export async function render(el, ctx, acoes) {
  const { pb } = ctx;
  const cfg = window.MVCalc.normalizar(await ctx.recarregarConfig());
  acoes.innerHTML = '<button class="btn btn-primary" type="button" id="salvarCfg">Salvar configurações</button>';
  el.innerHTML = `<form id="fCfg" novalidate>
    ${GRUPOS.map(([t, campos]) => `<section class="bloco"><h2>${t}</h2><div class="frm">
      ${campos.map(([k, rot, dica, passo]) => campo(rot, `<input name="${k}" type="number" min="0" step="${passo}" value="${cfg[k]}">`, { dica })).join('')}
    </div></section>`).join('')}
    <section class="bloco"><h2>Materiais</h2>
      <p class="dica">Usados quando o projeto não informa o carretel. O preço do carretel cadastrado no estoque tem prioridade.</p>
      <div class="tabela-wrap"><table class="tabela mini"><thead><tr><th>Material</th><th>Densidade (g/cm³)</th><th>Preço médio do kg (R$)</th></tr></thead><tbody>
        ${Object.entries(cfg.materiais).map(([m, v]) => `<tr data-mat="${esc(m)}"><td><b>${esc(m)}</b></td><td><input type="number" min="0.5" max="3" step="0.01" data-k="densidade" value="${v.densidade}"></td><td><input type="number" min="0" step="1" data-k="preco_kg" value="${v.preco_kg}"></td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="bloco"><h2>Taxas das formas de pagamento (%)</h2><div class="frm">
      ${FORMAS.map(([k, n]) => campo(n, `<input type="number" min="0" max="30" step="0.01" data-taxa="${k}" value="${cfg.taxas[k] ?? 0}">`)).join('')}
    </div></section>
    <section class="bloco"><h2>Área de impressão (mm)</h2><div class="frm">
      ${['X', 'Y', 'Z'].map((e, i) => campo(e, `<input type="number" min="10" max="2000" data-area="${i}" value="${cfg.area_max_mm[i]}">`)).join('')}
    </div></section>
    <section class="bloco"><h2>Backup</h2>
      <p class="dica">O banco faz backup automático todo dia às 3h (14 últimos). Para baixar ou restaurar, entre no painel técnico do servidor em <a href="${ctx.BASE}/_/" target="_blank" rel="noopener">${esc(ctx.BASE)}/_/</a> → Settings → Backups.</p>
    </section>
  </form>`;

  $('#salvarCfg').addEventListener('click', async ev => {
    const f = $('#fCfg', el);
    const novo = { ...ctx.config };
    for (const [, campos] of GRUPOS) for (const [k] of campos) { const v = Number(f.elements[k].value); if (Number.isFinite(v)) novo[k] = v; }
    novo.materiais = {};
    $$('tr[data-mat]', f).forEach(tr => { novo.materiais[tr.dataset.mat] = Object.fromEntries($$('[data-k]', tr).map(i => [i.dataset.k, Number(i.value)])); });
    novo.taxas = Object.fromEntries($$('[data-taxa]', f).map(i => [i.dataset.taxa, Number(i.value) || 0]));
    novo.area_max_mm = $$('[data-area]', f).map(i => Number(i.value) || 260);
    try {
      await ocupado(ev.target, () => pb.collection('config').update('configuracao001', { custos: novo }));
      ctx.config = novo; toast('Configurações salvas');
    } catch (e) { toast(msgErro(e), 'erro'); }
  });
}
