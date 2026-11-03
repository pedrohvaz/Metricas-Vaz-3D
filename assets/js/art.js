/* Desenhos das peças (SVG 200×200; a cor vem de --fil).
   Usado pelo gerador (Node) e pelo navegador. */
(function(root){
let CORES={};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const K='#22252C';
const ART={
  dragon(){
    const s=[[34,152,9],[50,147,11],[67,141,13],[86,137,15],[106,135,16],[126,130,16],[142,116,15]];
    let seg='';for(const [x,y,r] of s){seg+=`<path class="d" d="M${x-5} ${y-r+3}l5-10 5 10z"/><circle class="m" cx="${x}" cy="${y}" r="${r}"/><circle class="d" cx="${x}" cy="${y}" r="${(r*.42).toFixed(1)}"/>`;}
    return `<ellipse class="sh" cx="100" cy="176" rx="80" ry="6"/><path class="d" d="M92 128q-14-52 30-76q-6 30 12 36q-22 4-20 38z"/><path class="m" d="M80 146l-7 24h13l5-21z"/><path class="m" d="M117 140l-3 26h13l2-24z"/>${seg}<path class="m" d="M134 106q3-36 36-36q18 0 22 14l-3 11h-13l6 8q-9 14-30 15z"/><path class="d" d="M148 76l-5-24 18 19z"/><path class="d" d="M162 72l2-22 11 20z"/><circle class="w" cx="166" cy="88" r="6"/><circle class="k" cx="167.5" cy="88" r="3"/>`;
  },
  vase(){return `<ellipse class="sh" cx="100" cy="176" rx="46" ry="5"/><path class="m" d="M72 36h56l-4 10c26 26 30 64 18 96-8 20-26 30-42 30s-34-10-42-30c-12-32-8-70 18-96z"/><path d="M66 72q36 14 70-6M58 98q42 16 84-6M58 124q42 16 84-6M66 150q34 14 68-6" stroke="#000" stroke-opacity=".12" stroke-width="5" fill="none"/><path class="l" d="M70 82q-7 30 4 60l7-2q-9-28-3-56z"/><rect class="d" x="72" y="36" width="56" height="7" rx="3"/>`;},
  knight(){return `<ellipse class="sh" cx="100" cy="180" rx="54" ry="6"/><rect class="m" x="50" y="160" width="100" height="18" rx="9"/><rect class="d" x="50" y="170" width="100" height="8" rx="4"/><path class="d" d="M78 70l-16 88h76l-16-88z"/><rect class="m" x="84" y="120" width="13" height="42" rx="3"/><rect class="m" x="103" y="120" width="13" height="42" rx="3"/><path class="m" d="M80 66h40l6 60H74z"/><rect class="d" x="75" y="104" width="50" height="7"/><path class="m" d="M120 74l20 30-8 6-18-22z"/><rect class="m" x="134" y="20" width="7" height="86" rx="2"/><rect class="d" x="124" y="102" width="27" height="7" rx="3"/><rect class="m" x="134" y="109" width="7" height="16"/><path class="m" d="M100 33q14-20 28-6q-14 0-21 11z"/><circle class="m" cx="100" cy="50" r="17"/><rect class="d" x="87" y="46" width="26" height="6" rx="3"/><path class="m" d="M56 78h32v26q0 20-16 28q-16-8-16-28z"/><path class="d" d="M69 80h6v48h-6zM58 96h28v6H58z"/><path class="l" d="M84 70h6l-3 30h-5z"/>`;},
  moon(){return `<circle class="m" cx="100" cy="86" r="78" opacity=".2"/><circle class="m" cx="100" cy="86" r="62"/><circle class="d" cx="78" cy="68" r="13"/><circle class="d" cx="120" cy="58" r="8"/><circle class="d" cx="122" cy="102" r="15"/><circle class="d" cx="82" cy="112" r="8"/><circle class="d" cx="100" cy="86" r="5"/><path class="l" d="M60 70a44 44 0 0 1 30-34l2 6a38 38 0 0 0-26 30z"/><rect x="95" y="146" width="10" height="16" fill="#7A5232"/><rect x="58" y="158" width="84" height="20" rx="4" fill="#A9774C"/><rect x="58" y="171" width="84" height="7" rx="3" fill="#7A5232"/>`;},
  octopus(){const t=['M66 108q-26 26-12 52q8 12 18 2','M84 112q-12 34-4 56q6 10 14 2','M116 112q12 34 4 56q-6 10-14 2','M134 108q26 26 12 52q-8 12-18 2','M100 112q-2 32 0 58'];
    return `<ellipse class="sh" cx="100" cy="180" rx="56" ry="5"/>${t.map(d=>`<path class="t" stroke-width="14" d="${d}"/>`).join('')}<path class="m" d="M54 114q0-78 46-78t46 78z"/><ellipse class="l" cx="80" cy="64" rx="10" ry="16"/><circle class="w" cx="84" cy="94" r="10"/><circle class="w" cx="116" cy="94" r="10"/><circle class="k" cx="86" cy="96" r="4.5"/><circle class="k" cx="118" cy="96" r="4.5"/>`;},
  tower(){return `<ellipse class="sh" cx="100" cy="182" rx="70" ry="5"/><rect x="98" y="12" width="3" height="34" fill="${K}"/><path d="M101 14l24 8-24 8z" class="m"/><rect class="m" x="62" y="54" width="76" height="114"/><rect class="m" x="56" y="40" width="16" height="18"/><rect class="m" x="80" y="40" width="16" height="18"/><rect class="m" x="104" y="40" width="16" height="18"/><rect class="m" x="128" y="40" width="16" height="18"/><rect class="m" x="56" y="54" width="88" height="10"/><rect class="d" x="56" y="60" width="88" height="4"/><rect class="d" x="70" y="78" width="16" height="7"/><rect class="d" x="112" y="92" width="18" height="7"/><rect class="d" x="70" y="118" width="14" height="7"/><rect class="d" x="114" y="128" width="16" height="7"/><rect class="k" x="93" y="76" width="14" height="22" rx="7" opacity=".6"/><path class="d" d="M82 168v-26q18-22 36 0v26z"/><rect class="m" x="34" y="158" width="132" height="22" rx="6"/><rect class="d" x="34" y="171" width="132" height="9" rx="4"/><g transform="rotate(14 150 150)"><rect x="140" y="132" width="22" height="22" rx="5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="146" cy="138" r="2.3" fill="${K}"/><circle cx="151" cy="143" r="2.3" fill="${K}"/><circle cx="156" cy="148" r="2.3" fill="${K}"/></g>`;},
  cat(){return `<ellipse class="sh" cx="100" cy="180" rx="50" ry="5"/><ellipse cx="86" cy="78" rx="10" ry="26" fill="#3E9A62" transform="rotate(-22 86 78)"/><ellipse cx="116" cy="74" rx="10" ry="28" fill="#4BAE73" transform="rotate(18 116 74)"/><ellipse cx="100" cy="66" rx="11" ry="32" fill="#338A55"/><path class="m" d="M50 104l12-38 28 32z"/><path class="m" d="M150 104l-12-38-28 32z"/><path class="d" d="M60 98l5-20 12 16z"/><path class="d" d="M140 98l-5-20-12 16z"/><path class="m" d="M44 96h112l-13 80H57z"/><path class="d" d="M128 96h28l-13 80h-22z"/><rect class="m" x="40" y="92" width="120" height="12" rx="6"/><path d="M74 132q8-9 16 0M110 132q8-9 16 0" stroke="${K}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M96 143h8l-4 5z" fill="${K}" opacity=".6"/>`;},
  keychain(o={}){const nome=(o.nome||'VAZ 3D').toUpperCase();const fs=Math.min(32,Math.round(150/(Math.max(nome.length,3)*0.74)));
    return `<g transform="rotate(-10 110 110)"><rect class="m" x="40" y="80" width="140" height="64" rx="18"/><rect class="d" x="40" y="132" width="140" height="12" rx="6"/><circle cx="64" cy="112" r="8" fill="#fff" stroke="#000" stroke-opacity=".15"/><text x="126" y="${124+fs*0.05}" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="${fs}" fill="#fff" opacity=".45" dy="-1.5">${esc(nome)}</text><text x="126" y="${124+fs*0.05}" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="${fs}" class="d" style="fill-opacity:.35">${esc(nome)}</text></g><circle cx="44" cy="96" r="22" fill="none" stroke="#B4B9C4" stroke-width="6"/>`;},
  hex(){return `<ellipse class="sh" cx="104" cy="182" rx="74" ry="5"/><rect x="62" y="36" width="10" height="70" fill="#E3B341"/><path d="M62 36l5-13 5 13z" fill="#E9CFA6"/><rect x="102" y="20" width="10" height="70" fill="#3E8FD9"/><path d="M102 20l5-13 5 13z" fill="#E9CFA6"/><rect class="m" x="38" y="96" width="46" height="80"/><rect class="d" x="38" y="96" width="11" height="80"/><path class="l" d="M38 96l10-9h26l10 9z"/><rect class="m" x="130" y="112" width="38" height="64"/><rect class="d" x="158" y="112" width="10" height="64"/><path class="l" d="M130 112l8-8h22l8 8z"/><rect class="m" x="82" y="72" width="50" height="104"/><rect class="d" x="82" y="72" width="11" height="104"/><rect class="d" x="121" y="72" width="11" height="104"/><path class="l" d="M82 72l10-10h30l10 10z"/>`;},
  pig(){return `<ellipse class="sh" cx="104" cy="178" rx="62" ry="5"/><path class="t" stroke-width="5" d="M38 104q-16-4-12-16q6-8 10 2q2 10-10 10"/><rect class="m" x="62" y="136" width="18" height="38" rx="7"/><rect class="m" x="86" y="136" width="18" height="38" rx="7"/><rect class="m" x="112" y="136" width="18" height="38" rx="7"/><rect class="m" x="136" y="136" width="18" height="38" rx="7"/><rect class="d" x="86" y="136" width="18" height="38" rx="7"/><rect class="d" x="136" y="136" width="18" height="38" rx="7"/><ellipse class="m" cx="100" cy="112" rx="64" ry="47"/><path class="m" d="M116 76l10-32 20 32z"/><path class="d" d="M123 72l5-17 10 17z"/><ellipse class="m" cx="162" cy="116" rx="15" ry="18"/><ellipse class="d" cx="166" cy="116" rx="9" ry="12.5"/><ellipse class="k" cx="164" cy="110" rx="2.2" ry="3.2"/><ellipse class="k" cx="164" cy="122" rx="2.2" ry="3.2"/><circle class="k" cx="140" cy="98" r="4.5"/><rect class="k" x="84" y="68" width="34" height="6" rx="3" opacity=".7"/><ellipse class="l" cx="74" cy="92" rx="18" ry="9"/>`;},
  phone(){return `<path class="m" d="M58 160l42-104h20l-36 104z"/><path class="d" d="M100 56h20l-4 10h-20z"/><g transform="rotate(-22 112 104)"><rect x="90" y="36" width="52" height="104" rx="10" fill="${K}"/><rect x="95" y="44" width="42" height="86" rx="5" fill="#9DB7D6"/><rect x="99" y="52" width="22" height="4" rx="2" fill="#fff" opacity=".7"/><rect x="99" y="62" width="32" height="18" rx="3" fill="#fff" opacity=".45"/><rect x="99" y="85" width="32" height="18" rx="3" fill="#fff" opacity=".3"/></g><rect class="m" x="40" y="156" width="124" height="20" rx="6"/><rect class="d" x="40" y="168" width="124" height="8" rx="4"/><rect class="m" x="140" y="138" width="12" height="22" rx="4"/>`;},
};


ART.gear=function(){
  const cx=100,cy=84,n=12,pts=[];
  for(let i=0;i<n*4;i++){const a=i/(n*4)*Math.PI*2,r=(i%4<2)?62:50;pts.push((cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1));}
  return `<rect class="m" x="88" y="118" width="24" height="46"/><rect class="d" x="104" y="118" width="8" height="46"/>
    <rect class="m" x="28" y="158" width="144" height="24" rx="3"/><rect class="d" x="28" y="174" width="144" height="8" rx="3"/>
    <circle class="d" cx="50" cy="170" r="5.5"/><circle class="d" cx="150" cy="170" r="5.5"/>
    <polygon class="m" points="${pts.join(' ')}"/><circle class="d" cx="${cx}" cy="${cy}" r="38"/><circle class="m" cx="${cx}" cy="${cy}" r="31"/>
    <circle class="d" cx="${cx}" cy="${cy}" r="13"/><rect class="d" x="${cx-3}" y="${cy-20}" width="6" height="8"/>
    <path class="l" d="M64 62a44 44 0 0 1 30-20v8a36 36 0 0 0-24 18z"/>`;
};

function cenaProcesso(acc){
  const sub=(key,cor,x,y,w,extra='')=>`<svg x="${x}" y="${y}" width="${w}" height="${w}" viewBox="0 0 200 200" class="art ${extra}" style="--fil:${(CORES[cor]||{}).hex||cor}">${ART[key]({})}</svg>`;
  const hand='font-family="Caveat, Comic Sans MS, cursive" font-weight="700"';
  return `<svg viewBox="0 0 760 480" role="img" aria-labelledby="cenaT">
  <title id="cenaT">Etapas de produção: rascunho no caderno, modelagem 3D no computador, impressão na impressora 3D e peça pronta</title>
  <defs>
    <radialGradient id="lamp" cx="0.16" cy="0.05" r="0.75"><stop offset="0" stop-color="#FFD58A" stop-opacity=".38"/><stop offset="1" stop-color="#FFD58A" stop-opacity="0"/></radialGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2640"/><stop offset="1" stop-color="#1A1729"/></linearGradient>
    <clipPath id="printClip"><rect x="560" y="297" width="160" height="52"/></clipPath>
    <marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#fff"/></marker>
    <pattern id="scrgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#fff" stroke-opacity=".07"/></pattern>
  </defs>
  <rect width="760" height="480" fill="url(#wall)"/>
  <rect width="760" height="480" fill="url(#lamp)"/>
  <rect y="372" width="760" height="108" fill="#3A3452"/><rect y="372" width="760" height="4" fill="#4C4566"/>

  <!-- 1 caderno com rascunho -->
  <g transform="rotate(-6 125 270)">
    <rect x="35" y="160" width="185" height="225" rx="6" fill="#FAF8F2"/>
    <rect x="35" y="160" width="185" height="225" rx="6" fill="none" stroke="#000" stroke-opacity=".15"/>
    ${[0,1,2,3,4,5,6,7].map(i=>`<circle cx="${52+i*22}" cy="160" r="5" fill="none" stroke="#9AA0AE" stroke-width="3"/>`).join('')}
    ${sub('dragon','#555','45','185','165','sketch')}
    <text x="62" y="352" ${hand} font-size="18" fill="#6B6F7B">dragão articulado</text>
    <text x="62" y="372" ${hand} font-size="16" fill="#9AA0AE">~30 cm · 9 segmentos</text>
  </g>
  <rect x="150" y="392" width="88" height="7" rx="3" fill="#FFC83D" transform="rotate(-14 194 395)"/>

  <!-- 2 monitor com modelagem -->
  <rect x="368" y="300" width="36" height="58" fill="#A9ADB8"/><ellipse cx="386" cy="362" rx="62" ry="9" fill="#B9BDC7"/>
  <rect x="242" y="64" width="290" height="240" rx="12" fill="#C9CCD3"/>
  <rect x="252" y="74" width="270" height="206" rx="4" fill="#25262E"/>
  <rect x="252" y="74" width="270" height="206" fill="url(#scrgrid)"/>
  <rect x="252" y="74" width="270" height="14" fill="#33353F"/>
  <circle cx="260" cy="81" r="2.5" fill="#FF5F57"/><circle cx="268" cy="81" r="2.5" fill="#FEBC2E"/><circle cx="276" cy="81" r="2.5" fill="#28C840"/>
  <rect x="252" y="88" width="18" height="192" fill="#2E3039"/>
  ${[0,1,2,3,4,5].map(i=>`<rect x="256" y="${96+i*16}" width="10" height="10" rx="2" fill="#fff" fill-opacity="${i===2?.5:.15}"/>`).join('')}
  <rect x="470" y="88" width="52" height="192" fill="#2E3039"/>
  ${[0,1,2,3,4,5,6].map(i=>`<rect x="476" y="${98+i*14}" width="${20+((i*13)%20)}" height="5" rx="2" fill="#fff" fill-opacity=".18"/>`).join('')}
  <path d="M276 250 L460 250 M290 266 L446 266" stroke="#fff" stroke-opacity=".12"/>
  ${sub('dragon','roxo','285','92','176')}
  ${sub('dragon','#fff','285','92','176','wire')}
  <text x="300" y="274" font-family="IBM Plex Mono, JetBrains Mono, monospace" font-size="8" fill="#fff" fill-opacity=".45">300.0 × 120.0 × 86.0 mm</text>
  <rect x="270" y="388" width="200" height="24" rx="5" fill="#ECEDF1"/>
  ${[0,1,2].map(r=>[...Array(12)].map((_,c)=>`<rect x="${276+c*16}" y="${392+r*7}" width="12" height="4" rx="1" fill="#C6C9D2"/>`).join('')).join('')}

  <!-- 3 impressora -->
  <circle cx="610" cy="44" r="27" fill="${CORES.roxo.hex}"/><circle cx="610" cy="44" r="27" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/>
  <circle cx="610" cy="44" r="9" fill="#1B1B22"/><rect x="606" y="44" width="8" height="30" fill="#1B1B22"/>
  <path d="M630 60 Q680 120 648 262" fill="none" stroke="${CORES.roxo.hex}" stroke-width="2.5"/>
  <rect x="568" y="72" width="14" height="300" fill="#16161C"/><rect x="702" y="72" width="14" height="300" fill="#16161C"/>
  <rect x="568" y="72" width="148" height="12" fill="#16161C"/>
  <rect x="582" y="348" width="120" height="9" rx="2" fill="#3B3D47"/>
  <rect x="560" y="356" width="164" height="22" rx="4" fill="#16161C"/>
  <rect x="660" y="362" width="40" height="10" rx="2" fill="#2E3039"/><rect x="664" y="364" width="18" height="6" rx="1" fill="#5EEAD4" fill-opacity=".7"/>
  <g clip-path="url(#printClip)">${sub('dragon','roxo','586','254','112')}</g>
  <rect x="582" y="262" width="120" height="7" rx="3" fill="#2A2C36"/>
  <g class="scene-head">
    <rect x="618" y="254" width="38" height="28" rx="5" fill="${acc}" stroke="#16161C" stroke-width="2"/>
    <path d="M630 282h14l-4 9h-6z" fill="#16161C"/><path d="M635 291h4l-2 6z" fill="#FF8A3D"/>
  </g>

  <!-- 4 peça pronta -->
  <ellipse cx="610" cy="452" rx="66" ry="7" fill="#000" fill-opacity=".3"/>
  ${sub('dragon','roxo','538','330','140')}
  ${sub('octopus','rosa','484','392','68')}
  ${sub('vase','menta','60','392','70')}

  <!-- setas e etiquetas -->
  <path d="M190 132 Q222 96 246 112" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" marker-end="url(#ah)"/>
  <path d="M528 120 Q556 100 572 128" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" marker-end="url(#ah)"/>
  <path d="M728 300 Q752 360 700 392" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" marker-end="url(#ah)"/>
  <text x="40" y="126" ${hand} font-size="30" fill="#fff">1. Esboço</text>
  <text x="286" y="50" ${hand} font-size="30" fill="#fff">2. Modelagem 3D</text>
  <text x="596" y="140" ${hand} font-size="28" fill="#fff">3. Impressão</text>
  <text x="596" y="168" ${hand} font-size="18" fill="#fff" fill-opacity=".7">camada de 0,2 mm</text>
  <text x="430" y="470" ${hand} font-size="28" fill="#fff">4. Peça pronta</text>
</svg>`;
}

function art(key,cor,opts={}){
  const hex=(CORES[cor]||{}).hex||cor;
  if(!ART[key]) key='gear';
  return `<svg class="art" viewBox="0 0 200 200" style="--fil:${hex}" aria-hidden="true" focusable="false">${ART[key](opts)}</svg>`;
}
const api={ART,art,cenaProcesso,setCores(c){CORES=c;}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MV=api;
})(typeof window!=='undefined'?window:globalThis);
