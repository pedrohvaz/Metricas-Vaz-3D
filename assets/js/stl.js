/* Leitor de STL (binário e texto) no navegador: volume, medidas e número de triângulos.
   Usado pela calculadora do site e pela calculadora do painel. Unidade esperada: milímetros. */
(function (raiz) {
  'use strict';

  function ehBinario(buf) {
    if (buf.byteLength < 84) return false;
    const n = new DataView(buf).getUint32(80, true);
    if (84 + n * 50 === buf.byteLength) return true;
    // alguns exportadores escrevem "solid" no cabeçalho do binário; texto de verdade tem "facet"
    const ini = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(512, buf.byteLength)));
    return !/^\s*solid[\s\S]*facet/i.test(ini);
  }

  function acumular(st, ax, ay, az, bx, by, bz, cx, cy, cz) {
    // volume com sinal do tetraedro (origem, a, b, c)
    st.vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]]) {
      if (x < st.min[0]) st.min[0] = x; if (y < st.min[1]) st.min[1] = y; if (z < st.min[2]) st.min[2] = z;
      if (x > st.max[0]) st.max[0] = x; if (y > st.max[1]) st.max[1] = y; if (z > st.max[2]) st.max[2] = z;
    }
    st.tri++;
  }

  function ler(buf) {
    const st = { vol: 0, tri: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    if (ehBinario(buf)) {
      const dv = new DataView(buf);
      const n = dv.getUint32(80, true);
      if (84 + n * 50 > buf.byteLength) throw new Error('Arquivo STL incompleto.');
      for (let i = 0, o = 84; i < n; i++, o += 50) {
        const f = k => dv.getFloat32(o + 12 + k * 4, true);
        acumular(st, f(0), f(1), f(2), f(3), f(4), f(5), f(6), f(7), f(8));
      }
    } else {
      const txt = new TextDecoder().decode(buf);
      const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
      const v = [];
      let m;
      while ((m = re.exec(txt))) {
        v.push(+m[1], +m[2], +m[3]);
        if (v.length === 9) { acumular(st, ...v); v.length = 0; }
      }
    }
    if (!st.tri) throw new Error('Não encontramos a peça neste arquivo. Confira se é um STL válido.');
    const dim = [0, 1, 2].map(i => Math.max(0, st.max[i] - st.min[i]));
    return {
      volume_cm3: Math.abs(st.vol) / 1000,
      dim, // mm (X, Y, Z)
      triangulos: st.tri,
    };
  }

  async function lerArquivo(file) {
    if (!/\.stl$/i.test(file.name)) throw new Error('A calculadora lê arquivos STL. Para OBJ, 3MF ou STEP, envie pelo orçamento sob encomenda.');
    if (file.size > 60 * 1024 * 1024) throw new Error('Arquivo maior que 60 MB.');
    return ler(await file.arrayBuffer());
  }

  raiz.MVStl = { ler, lerArquivo };
})(typeof self !== 'undefined' ? self : this);
