/* Cálculo de custo e preço das peças — usado pelo servidor (pb_hooks) e pelo painel (copiado para /admin/calc.js).
   Todos os parâmetros vêm de config.custos (Configurações no painel). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.MVCalc = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const PADRAO = {
    tarifa_kwh: 0.95, consumo_kw: 0.15, valor_impressora: 3500, vida_util_h: 5000, manutencao_h: 0.3,
    hora_trabalho: 25, min_trabalho_padrao: 10, taxa_falha: 10, margem: 120, embalagem: 3, minimo_peca: 15,
    purga_g_troca: 2.5, velocidade_g_h: 14, fator_preenchimento: 0.42, faixa_inferior: 0.9, faixa_superior: 1.3,
    area_max_mm: [260, 260, 260],
    materiais: { PLA: { densidade: 1.24, preco_kg: 110 }, PETG: { densidade: 1.27, preco_kg: 120 }, TPU: { densidade: 1.21, preco_kg: 160 } },
    taxas: { pix: 0, cartao_credito: 4.99, cartao_debito: 1.99, dinheiro: 0, boleto: 0, transferencia: 0 },
  };

  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : (d || 0); };
  const r2 = v => Math.round(v * 100) / 100;

  function normalizar(cfg) {
    const c = Object.assign({}, PADRAO, cfg || {});
    c.materiais = Object.assign({}, PADRAO.materiais, (cfg && cfg.materiais) || {});
    c.taxas = Object.assign({}, PADRAO.taxas, (cfg && cfg.taxas) || {});
    return c;
  }

  function material(cfg, nome) {
    const m = cfg.materiais[nome] || cfg.materiais.PLA || PADRAO.materiais.PLA;
    return { densidade: n(m.densidade, 1.24), preco_kg: n(m.preco_kg, 110) };
  }

  /* Estima gramas e horas a partir do volume do STL (cm³). Peças pequenas ficam quase maciças,
     por isso o fator de preenchimento sobe quando o volume é pequeno. */
  function estimarDoVolume(cfgBruto, volume_cm3, nomeMaterial) {
    const cfg = normalizar(cfgBruto);
    const v = Math.max(0, n(volume_cm3));
    const m = material(cfg, nomeMaterial);
    const fator = v < 5 ? Math.min(1, cfg.fator_preenchimento + 0.4) : v < 30 ? Math.min(1, cfg.fator_preenchimento + 0.15) : cfg.fator_preenchimento;
    const gramas = v * m.densidade * fator + 1; // +1 g de borda/aderência
    const horas = gramas / Math.max(1, n(cfg.velocidade_g_h, 14)) + 0.15; // +aquecimento e nivelamento
    return { gramas: r2(gramas), horas: r2(horas) };
  }

  /* entrada: { gramas, horas, material, preco_kg (opcional, do carretel), trocas_cor, min_trabalho, quantidade, embalagem (bool, padrão true) }
     gramas, horas, trocas e minutos são POR PEÇA. */
  function calcular(cfgBruto, e) {
    const cfg = normalizar(cfgBruto);
    const q = Math.max(1, Math.round(n(e.quantidade, 1)));
    const m = material(cfg, e.material);
    const precoKg = n(e.preco_kg) > 0 ? n(e.preco_kg) : m.preco_kg;
    const gramas = Math.max(0, n(e.gramas));
    const horas = Math.max(0, n(e.horas));
    const trocas = Math.max(0, n(e.trocas_cor));
    const minutos = e.min_trabalho == null || e.min_trabalho === '' ? cfg.min_trabalho_padrao : Math.max(0, n(e.min_trabalho));

    const filamento = (gramas + trocas * cfg.purga_g_troca) * precoKg / 1000;
    const energia = horas * cfg.consumo_kw * cfg.tarifa_kwh;
    const maquina = horas * (cfg.valor_impressora / Math.max(1, cfg.vida_util_h) + cfg.manutencao_h);
    const falha = (filamento + energia + maquina) * cfg.taxa_falha / 100;
    const mao = minutos / 60 * cfg.hora_trabalho;
    const unitario = filamento + energia + maquina + falha + mao;
    const embalagem = e.embalagem === false ? 0 : cfg.embalagem;

    const custo = unitario * q + embalagem;
    const precoUnit = Math.max(unitario * (1 + cfg.margem / 100), cfg.minimo_peca);
    const preco = precoUnit * q + embalagem;
    const lucro = preco - custo;
    return {
      itens: {
        filamento: r2(filamento * q), energia: r2(energia * q), maquina: r2(maquina * q),
        falha: r2(falha * q), mao_de_obra: r2(mao * q), embalagem: r2(embalagem),
      },
      quantidade: q, gramas_total: r2((gramas + trocas * cfg.purga_g_troca) * q), horas_total: r2(horas * q),
      custo_unitario: r2(unitario), custo: r2(custo), preco_unitario: r2(precoUnit), preco: r2(preco),
      lucro: r2(lucro), margem_real: custo > 0 ? r2(lucro / custo * 100) : 0,
    };
  }

  function faixa(cfgBruto, preco) {
    const cfg = normalizar(cfgBruto);
    const arred = v => Math.max(cfg.minimo_peca, Math.round(v));
    return { min: arred(preco * cfg.faixa_inferior), max: arred(preco * cfg.faixa_superior) };
  }

  function taxaPagamento(cfgBruto, forma, valor) {
    const cfg = normalizar(cfgBruto);
    return r2(n(valor) * n(cfg.taxas[forma]) / 100);
  }

  /* Custo por grama de um carretel (R$/g). */
  const custoGrama = f => n(f.peso_inicial) > 0 ? n(f.custo) / n(f.peso_inicial) : 0;

  return { PADRAO, normalizar, estimarDoVolume, calcular, faixa, taxaPagamento, custoGrama };
});
