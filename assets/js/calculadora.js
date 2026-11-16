/* Calculadora de preço do site: lê o STL no navegador, pede a faixa ao servidor e envia o pedido de orçamento. */
(function () {
  'use strict';
  const S = window.SITE, PED = window.MVPedido, STL = window.MVStl;
  const $ = s => document.querySelector(s);
  const form = $('#calcForm');
  if (!form || !PED || !STL) return;
  const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  const num = (v, d = 1) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const erro = (el, msg) => { el.textContent = msg; el.hidden = !msg; };

  let arquivo = null, leitura = null, estimativa = null, enviado = false;

  if (!S.api) {
    $('#calcBtn').textContent = 'Ver medidas da peça';
    $('#calcComo').insertAdjacentHTML('afterbegin', '<p class="calc-off">Esta é uma prévia do site. A estimativa de preço funciona quando o site está publicado com o servidor.</p>');
  }

  async function carregar(file) {
    erro($('#calcErr'), ''); $('#calcRes').hidden = true; estimativa = null; enviado = false;
    try {
      leitura = await STL.lerArquivo(file);
      arquivo = file;
      $('#ciNome').textContent = file.name;
      $('#ciDim').textContent = leitura.dim.map(d => num(d, 1)).join(' × ') + ' mm';
      $('#ciVol').textContent = num(leitura.volume_cm3, 1) + ' cm³';
      $('#ciTri').textContent = num(leitura.triangulos, 0);
      $('#calcInfo').hidden = false;
      $('#calcDrop').classList.add('done');
      $('#calcDrop span').innerHTML = `<b>${esc(file.name)}</b> · trocar arquivo`;
    } catch (e) {
      arquivo = null; leitura = null; $('#calcInfo').hidden = true;
      erro($('#calcErr'), e.message || 'Não foi possível ler o arquivo.');
    }
  }

  const input = $('#calcArq'), drop = $('#calcDrop');
  input.addEventListener('change', () => { if (input.files[0]) carregar(input.files[0]); });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) carregar(e.dataTransfer.files[0]); });

  form.addEventListener('change', e => { if (e.target.id !== 'calcArq') { $('#calcRes').hidden = true; enviado = false; } });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!leitura) { erro($('#calcErr'), 'Selecione o arquivo STL da peça.'); return; }
    if (!S.api) { erro($('#calcErr'), 'Medidas lidas. Para receber o preço, envie o arquivo pelo orçamento sob encomenda.'); return; }
    const btn = $('#calcBtn'); btn.disabled = true; btn.textContent = 'Calculando…';
    erro($('#calcErr'), '');
    const corpo = {
      volume_cm3: leitura.volume_cm3, dim: leitura.dim,
      material: $('#calcMat').value,
      cores: +(form.querySelector('input[name="calcCores"]:checked') || { value: 1 }).value,
      quantidade: Math.max(1, Math.min(500, parseInt($('#calcQtd').value, 10) || 1)),
    };
    try {
      const r = await fetch(`${S.base}api/mv/estimativa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || 'Não foi possível calcular agora.');
      estimativa = j;
      $('#crQtd').textContent = j.quantidade === 1 ? '1 peça' : `${j.quantidade} peças`;
      $('#crFaixa').textContent = j.min === j.max ? brl(j.min) : `${brl(j.min)} a ${brl(j.max)}`;
      $('#crSub').textContent = `${j.material} · ${j.cores === 1 ? '1 cor' : j.cores + ' cores'} · cerca de ${num(j.gramas, 0)} g de material e ${num(j.horas, 1)} h de impressão. Frete não incluso.`;
      $('#crAvisos').innerHTML = (j.avisos || []).map(a => `<li>${esc(a)}</li>`).join('');
      $('#calcRes').hidden = false;
      $('#cpOk').hidden = true; enviado = false;
      $('#calcRes').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      erro($('#calcErr'), err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Calcular estimativa';
    }
  });

  $('#calcPedido').addEventListener('input', () => erro($('#cpErr'), ''));
  $('#calcPedido').addEventListener('submit', async e => {
    e.preventDefault();
    if (enviado) return;
    const nome = $('#cpNome'), wa = $('#cpWa');
    if (!nome.value.trim()) { erro($('#cpErr'), 'Informe seu nome.'); nome.focus(); return; }
    if (!PED.waValido(wa.value)) { erro($('#cpErr'), 'Informe seu WhatsApp com DDD.'); wa.focus(); return; }
    const btn = $('#cpBtn'); btn.disabled = true;
    const resumo = `Calculadora: ${arquivo.name}, ${leitura.dim.map(d => num(d, 1)).join(' × ')} mm, ${num(leitura.volume_cm3, 1)} cm³. ${estimativa.material}, ${estimativa.cores} cor(es), ${estimativa.quantidade} un. Estimativa: ${brl(estimativa.min)} a ${brl(estimativa.max)}.`;
    try {
      const reg = await PED.enviar({
        tipo: 'calculadora', nome: nome.value.trim(), whatsapp: wa.value,
        mensagem: [resumo, $('#cpObs').value.trim()].filter(Boolean).join('\n'),
        estimativa: Object.assign({}, estimativa, { arquivo: arquivo.name, dim: leitura.dim, volume_cm3: leitura.volume_cm3 }),
        itens: [{ arquivo: arquivo.name, material: estimativa.material, cores: estimativa.cores, qtd: estimativa.quantidade }],
      }, [arquivo]);
      enviado = true;
      const n = PED.protocolo(reg);
      const msg = `Olá, ${S.nome}! Enviei pela calculadora do site o arquivo ${arquivo.name} (pedido nº ${n}). Meu nome é ${nome.value.trim()}.`;
      $('#cpOk').innerHTML = `<p><b>Pedido nº ${esc(n)} recebido.</b> Seu arquivo chegou para a nossa equipe. Respondemos pelo WhatsApp com o valor final.</p><a class="btn btn-wa btn-block" href="${PED.waLink(msg)}" target="_blank" rel="noopener">Continuar no WhatsApp</a>`;
      $('#cpOk').hidden = false;
    } catch (err) {
      erro($('#cpErr'), err.message);
    } finally {
      btn.disabled = false;
    }
  });
})();
