/* Início: o que precisa de atenção hoje. */
import { esc, money, kg, dataBR, dataHora, hojeISO, somaDias, vazio } from '../ui.js';
import { STATUS_PROJETO, TIPO_PEDIDO, pilula } from '../rotulos.js';

export async function render(el, ctx) {
  const { pb, dono } = ctx;
  const hoje = hojeISO();
  const iniMes = hoje.slice(0, 8) + '01';
  const [novos, producao, carreteis, prazos] = await Promise.all([
    pb.collection('pedidos').getList(1, 6, { filter: 'status = "novo"', sort: '-created' }),
    pb.collection('projetos').getList(1, 1, { filter: 'status = "aprovado" || status = "imprimindo" || status = "acabamento"', fields: 'id' }),
    pb.collection('filamentos').getFullList({ filter: 'ativo = true && peso_restante <= minimo', sort: 'peso_restante' }),
    pb.collection('projetos').getList(1, 6, { filter: `prazo != "" && prazo <= "${somaDias(hoje, 7)} 23:59:59" && status != "entregue" && status != "cancelado" && status != "enviado"`, sort: 'prazo', expand: 'cliente' }),
  ]);
  let fin = null;
  if (dono) {
    const lanc = await pb.collection('lancamentos').getFullList({ filter: `(pago = true && data_pagamento >= "${iniMes} 00:00:00") || pago = false`, fields: 'tipo,valor,taxa,pago,vencimento' });
    fin = { receita: 0, despesa: 0, receber: 0, pagar7: 0 };
    for (const l of lanc) {
      if (l.pago) { if (l.tipo === 'entrada') fin.receita += l.valor - (l.taxa || 0); else fin.despesa += l.valor; }
      else if (l.tipo === 'entrada') fin.receber += l.valor;
      else if (!l.vencimento || l.vencimento.slice(0, 10) <= somaDias(hoje, 7)) fin.pagar7 += l.valor;
    }
  }

  const card = (rot, val, link, alerta = false) => `<a class="kpi${alerta ? ' alerta' : ''}" href="${link}"><span>${rot}</span><b>${val}</b></a>`;
  el.innerHTML = `
  <div class="kpis">
    ${card('Pedidos novos', novos.totalItems, '#/pedidos', novos.totalItems > 0)}
    ${card('Projetos em produção', producao.totalItems, '#/projetos')}
    ${card('Carretéis acabando', carreteis.length, '#/estoque', carreteis.length > 0)}
    ${fin ? card('Resultado do mês', money(fin.receita - fin.despesa), '#/financeiro') : ''}
    ${fin ? card('A receber', money(fin.receber), '#/financeiro') : ''}
    ${fin ? card('A pagar em 7 dias', money(fin.pagar7), '#/financeiro', fin.pagar7 > 0) : ''}
  </div>
  <div class="cols2">
    <section class="bloco"><div class="bloco-head"><h2>Pedidos novos</h2><a href="#/pedidos">Ver todos</a></div>
      ${novos.items.length ? `<ul class="lista">${novos.items.map(p => `<li><a href="#/pedidos/${p.id}"><b>${esc(p.nome)}</b><span>${TIPO_PEDIDO[p.tipo] || p.tipo} · ${dataHora(p.created)}</span></a></li>`).join('')}</ul>` : vazio('Nenhum pedido novo.')}
    </section>
    <section class="bloco"><div class="bloco-head"><h2>Prazos nos próximos 7 dias</h2><a href="#/projetos">Projetos</a></div>
      ${prazos.items.length ? `<ul class="lista">${prazos.items.map(p => `<li><a href="#/projetos/${p.id}"><b>${esc(p.titulo)}</b><span>${p.prazo.slice(0, 10) < hoje ? '<em class="atraso">Atrasado</em> · ' : ''}${dataBR(p.prazo)} · ${esc(p.expand?.cliente?.nome || 'sem cliente')}</span>${pilula(STATUS_PROJETO, p.status)}</a></li>`).join('')}</ul>` : vazio('Nenhum prazo próximo.')}
    </section>
    <section class="bloco"><div class="bloco-head"><h2>Carretéis acabando</h2><a href="#/estoque">Estoque</a></div>
      ${carreteis.length ? `<ul class="lista">${carreteis.slice(0, 8).map(f => `<li><a href="#/estoque"><i class="cor" style="--c:${esc(f.cor_hex || '#888')}"></i><b>${esc(f.material)} ${esc(f.cor)}</b><span>${esc(f.marca || '')} · restam ${kg(f.peso_restante)}</span></a></li>`).join('')}</ul>` : vazio('Todos os carretéis acima do mínimo.')}
    </section>
  </div>`;
}
