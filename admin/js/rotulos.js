/* Nomes legíveis dos valores guardados no banco. */
export const STATUS_PEDIDO = [
  ['novo', 'Novo'], ['em_conversa', 'Em conversa'], ['aprovado', 'Aprovado'], ['recusado', 'Recusado'], ['convertido', 'Virou projeto'],
];
export const TIPO_PEDIDO = { loja: 'Loja', encomenda: 'Encomenda', consulta: 'Sob consulta', calculadora: 'Calculadora', manual: 'Manual' };
export const STATUS_PROJETO = [
  ['orcamento', 'Orçamento'], ['aprovado', 'Aprovado'], ['imprimindo', 'Imprimindo'], ['acabamento', 'Acabamento'],
  ['pronto', 'Pronto'], ['enviado', 'Enviado'], ['entregue', 'Entregue'], ['cancelado', 'Cancelado'],
];
export const CATEGORIAS_FIN = [
  ['venda_loja', 'Venda da loja'], ['encomenda', 'Encomenda'], ['filamento', 'Filamento'], ['energia', 'Energia'],
  ['manutencao', 'Manutenção'], ['equipamento', 'Equipamento'], ['embalagem', 'Embalagem'], ['frete', 'Frete'],
  ['marketing', 'Marketing'], ['impostos', 'Impostos'], ['outros', 'Outros'],
];
export const FORMAS = [
  ['pix', 'Pix'], ['cartao_credito', 'Cartão de crédito'], ['cartao_debito', 'Cartão de débito'],
  ['dinheiro', 'Dinheiro'], ['boleto', 'Boleto'], ['transferencia', 'Transferência'],
];
export const MATERIAIS = ['PLA', 'PETG', 'TPU', 'Outro'];
export const nomeDe = (lista, v) => (lista.find(([k]) => k === v) || [v, v || '—'])[1];
export const pilula = (lista, v) => `<span class="pil st-${v}">${nomeDe(lista, v)}</span>`;
