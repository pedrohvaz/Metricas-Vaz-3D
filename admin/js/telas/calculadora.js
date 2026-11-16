/* Calculadora completa (só o dono): custo detalhado, preço sugerido e lucro. */
import { $, esc, money, num, kg, toast, opcoes, campo, lerForm } from '../ui.js';
import { FORMAS } from '../rotulos.js';
import { editar as editarProjeto } from './projetos.js';

const NOMES = { filamento: 'Filamento', energia: 'Energia elétrica', maquina: 'Desgaste e manutenção da máquina', falha: 'Reserva para falhas', mao_de_obra: 'Mão de obra (preparo e acabamento)', embalagem: 'Embalagem' };

export async function render(el, ctx) {
  const { pb } = ctx;
  const cfg = window.MVCalc.normalizar(ctx.config);
  const fils = await pb.collection('filamentos').getFullList({ filter: 'ativo = true', sort: 'material,cor' });
  el.innerHTML = `<div class="calc">
    <form class="bloco frm" id="cForm" novalidate>
      <fieldset class="full grupo"><legend>Peça</legend>
        <label class="drop-adm full"><input type="file" id="cStl" accept=".stl"><span><b>Ler um STL</b> (opcional) para estimar gramas e horas</span></label>
        <p class="dica full" id="cStlInfo"></p>
        <div class="frm">
          ${campo('Gramas por peça', '<input name="gramas" type="number" min="0" step="0.1" required>', { dica: 'Do fatiador (Anycubic Slicer Next mostra “filamento usado”).' })}
          ${campo('Horas por peça', '<input name="horas" type="number" min="0" step="0.05" required>', { dica: 'Tempo estimado do fatiador.' })}
          ${campo('Material', `<select name="material">${opcoes(Object.keys(cfg.materiais).map(m => [m, m]), 'PLA')}</select>`)}
          ${campo('Carretel', `<select name="carretel"><option value="">Preço médio do material</option>${fils.map(f => `<option value="${f.id}">${esc(`${f.material} ${f.cor}${f.marca ? ' · ' + f.marca : ''}`)}${f.custo ? ` · ${money(window.MVCalc.custoGrama(f) * 1000)}/kg` : ''}</option>`).join('')}</select>`)}
          ${campo('Trocas de cor por peça', '<input name="trocas_cor" type="number" min="0" value="0">', { dica: 'Para multicor: o fatiador mostra o número de trocas.' })}
          ${campo('Minutos de preparo e acabamento', `<input name="min_trabalho" type="number" min="0" value="${cfg.min_trabalho_padrao}">`)}
          ${campo('Quantidade', '<input name="quantidade" type="number" min="1" value="1">')}
          ${campo('Forma de pagamento', `<select name="forma">${opcoes(FORMAS, 'pix')}</select>`)}
          <label class="chk full"><input type="checkbox" name="embalagem" checked> Incluir embalagem</label>
        </div>
      </fieldset>
    </form>
    <section class="bloco" id="cRes"><p class="dica">Preencha gramas e horas para ver o custo.</p></section>
  </div>`;
  const form = $('#cForm', el);
  const F = Object.fromEntries(fils.map(f => [f.id, f]));
  let ultimo = null;

  const calcular = () => {
    const d = lerForm(form);
    if (!(d.gramas > 0) || !(d.horas > 0)) { $('#cRes', el).innerHTML = '<p class="dica">Preencha gramas e horas para ver o custo.</p>'; ultimo = null; return; }
    const fil = F[d.carretel];
    const precoKg = fil && fil.custo ? window.MVCalc.custoGrama(fil) * 1000 : 0;
    const r = window.MVCalc.calcular(cfg, { gramas: d.gramas, horas: d.horas, material: fil ? fil.material : d.material, preco_kg: precoKg, trocas_cor: d.trocas_cor, min_trabalho: d.min_trabalho, quantidade: d.quantidade, embalagem: d.embalagem });
    const taxa = window.MVCalc.taxaPagamento(cfg, d.forma, r.preco);
    const precoComTaxa = taxa ? Math.ceil((r.preco + taxa) * 100) / 100 : r.preco;
    ultimo = { d, r, fil };
    $('#cRes', el).innerHTML = `
      <div class="calc-preco"><span>Preço sugerido${r.quantidade > 1 ? ` · ${r.quantidade} peças` : ''}</span><b>${money(r.preco)}</b>
        ${r.quantidade > 1 ? `<small>${money(r.preco_unitario)} por peça + embalagem</small>` : ''}
        ${taxa ? `<small>Para receber ${money(r.preco)} líquido no ${FORMAS.find(f => f[0] === d.forma)[1].toLowerCase()}, cobre <b>${money(precoComTaxa)}</b> (taxa ${money(taxa)}).</small>` : ''}</div>
      <table class="tabela mini custo"><tbody>
        ${Object.entries(r.itens).map(([k, v]) => `<tr><td>${NOMES[k]}</td><td class="num">${money(v)}</td></tr>`).join('')}
        <tr class="tot"><td>Custo total</td><td class="num">${money(r.custo)}</td></tr>
        <tr class="pos"><td>Lucro</td><td class="num">${money(r.lucro)} (${num(r.margem_real)}%)</td></tr>
      </tbody></table>
      <p class="dica">${kg(r.gramas_total)} de filamento · ${num(r.horas_total, 1)} h de máquina · margem configurada ${num(cfg.margem)}% · mínimo por peça ${money(cfg.minimo_peca)}${precoKg ? ` · filamento a ${money(precoKg)}/kg` : ` · ${d.material} a ${money(cfg.materiais[d.material]?.preco_kg)}/kg (padrão)`}</p>
      <div class="acoes-linha"><button type="button" class="btn" id="cCopiar">Copiar resumo</button><button type="button" class="btn btn-primary" id="cProjeto">Criar projeto com este cálculo</button></div>`;
  };
  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);

  $('#cStl', el).addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const s = await window.MVStl.lerArquivo(f);
      const d = lerForm(form);
      const est = window.MVCalc.estimarDoVolume(cfg, s.volume_cm3, F[d.carretel]?.material || d.material);
      form.elements.gramas.value = est.gramas; form.elements.horas.value = est.horas;
      $('#cStlInfo', el).textContent = `${f.name}: ${s.dim.map(x => num(x, 1)).join(' × ')} mm · ${num(s.volume_cm3, 1)} cm³. Estimativa preenchida; para mais precisão use os valores do fatiador.`;
      calcular();
    } catch (err) { toast(err.message, 'erro'); }
  });

  el.addEventListener('click', e => {
    if (!ultimo) return;
    const { d, r, fil } = ultimo;
    if (e.target.id === 'cCopiar') {
      const txt = `Peça: ${num(d.gramas, 1)} g, ${num(d.horas, 1)} h, ${d.quantidade} un.\nCusto: ${money(r.custo)}\nPreço sugerido: ${money(r.preco)}\nLucro: ${money(r.lucro)} (${num(r.margem_real)}%)`;
      navigator.clipboard.writeText(txt).then(() => toast('Resumo copiado'), () => toast('Não foi possível copiar', 'erro'));
    }
    if (e.target.id === 'cProjeto') {
      editarProjeto(ctx, null, p => { if (p) location.hash = `#/projetos/${p.id}`; }, {
        titulo: '', quantidade: d.quantidade, horas_maquina: Math.round(d.horas * d.quantidade * 100) / 100,
        min_trabalho: d.min_trabalho * d.quantidade, trocas_cor: d.trocas_cor * d.quantidade, preco: r.preco,
        uso_filamento: fil ? [{ filamento: fil.id, gramas: Math.round(r.gramas_total * 10) / 10 }] : [],
        custo: r.itens, custo_total: r.custo,
      });
    }
  });
}
