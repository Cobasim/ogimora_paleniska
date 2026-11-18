// OGIMORA – płytka próbna: okno z plikami DXF i obrazkową instrukcją PDF.
// Blachy: projekt w mm – 3 / 4 / 5 mm (luz 0,1–1,2 mm); projekt calowy – 11 ga, 10 ga, 3/16", 1/4" (luz 0,005–0,060").
// Każdy plik w dwóch jednostkach zapisu (mm albo cale). Pliki leżą w folderze proba/ (tworzy je narzedzia/plytka_probna).
import { LANG } from './i18n.js';
import { track } from './track.js';
import { akt, BLACHY_IN, opisBlachy } from './jednostki.js';
const EN = LANG === 'en';
const T = EN ? {
  h: 'Test plates', sub: 'Cut them before the fire pit. They show which tab clearance fits your machine.',
  gr: 'Sheet thickness', a: 'Download the plates (DXF)', a2: '2 plates (clearance 0.1–1.2 mm) and a key – one file', a2in: '2 plates (clearance 0.005–0.060 in) and a key – one file',
  u: 'File units', uin: 'inches (in)',
  c: 'Picture guide (PDF)', c2: 'how to test and which slider to set',
  n: 'The file is made by a script. The plates have <b>not yet been cut in steel</b>. You cut at your own risk.', x: 'Close', alt: 'Two hexagonal test plates and a triangular key',
} : {
  h: 'Płytki próbne', sub: 'Wytnij je przed paleniskiem. Pokażą, jaki luz na ząbkach pasuje do Twojej maszyny.',
  gr: 'Grubość blachy', a: 'Pobierz płytki (DXF)', a2: '2 płytki (luz 0,1–1,2 mm) i klucz – w jednym pliku', a2in: '2 płytki (luz 0,005–0,060 in) i klucz – w jednym pliku',
  u: 'Jednostki pliku', uin: 'cale (in)',
  c: 'Instrukcja obrazkowa (PDF)', c2: 'jak przymierzać i który suwak przestawić',
  n: 'Plik tworzy skrypt. Płytki <b>nie były jeszcze wycinane w stali</b>. Tniesz na własną odpowiedzialność.', x: 'Zamknij', alt: 'Dwie sześciokątne płytki próbne i trójkątny klucz',
};
// grubości: { v – grubość w mm (jak w generatorze), n – napis na przycisku, k – część nazwy pliku }
const LISTA = {
  mm: [3, 4, 5].map(t => ({ v: t, n: `${t} mm`, k: `${t}mm` })),
  in: BLACHY_IN.map(b => ({ v: b.t, n: b.n, k: b.kod, tt: opisBlachy(b.t) })),
};
if (document.documentElement.dataset.model === 'kostka') T.sub = EN ? 'Cut them before the cube. They show which tab clearance fits your machine.' : 'Wytnij je przed kostką. Pokażą, jaki luz na zamkach pasuje do Twojej maszyny.';
const btn = document.getElementById('probaBtn');
if (btn) {
  const d = document.createElement('dialog'); d.className = 'dl proba-dlg'; d.setAttribute('aria-labelledby', 'probaT');
  d.innerHTML = `<button type="button" class="dl-x" data-close aria-label="${T.x}">✕</button>
    <h2 id="probaT">${T.h}</h2><p class="dl-sub">${T.sub}</p>
    <img id="probaImg" src="proba/plytki_4mm.svg" width="770" height="280" alt="${T.alt}">
    <div class="dl-q"><span>${T.gr}</span><div class="chips" id="probaGr"></div></div>
    <div class="dl-q"><span>${T.u}</span><div class="chips" id="probaU"><button type="button" class="chip" data-u="mm">mm</button><button type="button" class="chip" data-u="in">${T.uin}</button></div></div>
    <a class="cta" id="probaA" download><span class="cta-icon">↓</span><span><b>${T.a}</b><small id="probaA2">${T.a2}</small></span></a>
    <a class="cta secondary" id="probaC" target="_blank" rel="noopener"><span class="cta-icon">?</span><span><b>${T.c}</b><small>${T.c2}</small></span></a>
    <p class="proba-note">${T.n}</p>`;
  document.body.appendChild(d);
  const $ = id => d.querySelector('#' + id);
  let J = 'mm', gr = LISTA.mm[1], U = 'mm';
  const plik = () => J === 'mm' ? `proba/ogimora-test_${gr.k}${U === 'in' ? '_in' : ''}.dxf` : `proba/ogimora-test_${gr.k}_${U}.dxf`;
  const ustaw = g => { gr = g;
    d.querySelectorAll('#probaGr .chip').forEach(b => b.classList.toggle('active', b.dataset.k === g.k));
    d.querySelectorAll('#probaU .chip').forEach(b => b.classList.toggle('active', b.dataset.u === U));
    $('probaImg').src = `proba/plytki_${g.k}.svg`;   // oznaczenie grubości na środku płytek, więc rysunek zmienia się razem z wyborem
    $('probaA').href = plik(); $('probaA').setAttribute('download', plik().replace('proba/', '')); };
  btn.addEventListener('click', () => {   // na start: jednostki i grubość z generatora
    J = akt(); U = J;
    $('probaGr').innerHTML = LISTA[J].map(g => `<button type="button" class="chip" data-k="${g.k}"${g.tt ? ` title="${g.tt.replace(/"/g, '&quot;')}"` : ''}>${g.n}</button>`).join('');
    $('probaA2').textContent = J === 'in' ? T.a2in : T.a2;
    $('probaC').href = J === 'in' ? `proba/ogimora-${EN ? 'test-plate-EN-inch' : 'plytka-probna-PL-cale'}.pdf` : `proba/ogimora-${EN ? 'test-plate-EN' : 'plytka-probna-PL'}.pdf`;
    const a = document.querySelector('[data-thk="tBowl"] .chip.active, #kThk .chip.active'), v = a ? +(a.dataset.v ?? a.dataset.t) : NaN;   // palenisko: blacha misy; kostka: jedyna blacha
    ustaw(LISTA[J].find(g => Math.abs(g.v - v) < 1e-3) || LISTA[J][J === 'in' ? 2 : 1]);
    track('proba', { value: 'okno' }); d.showModal(); });
  d.addEventListener('click', e => { if ((e.target === d && ((r => e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)(d.getBoundingClientRect()))) || e.target.closest('[data-close]')) d.close(); });
  $('probaGr').addEventListener('click', e => { const b = e.target.closest('button'); if (b) ustaw(LISTA[J].find(g => g.k === b.dataset.k)); });
  $('probaU').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { U = b.dataset.u; ustaw(gr); } });
  $('probaA').addEventListener('click', () => track('proba', { value: 'dxf-' + gr.k + (U === 'in' ? '-in' : '') }));
  $('probaC').addEventListener('click', () => track('proba', { value: 'pdf' + (J === 'in' ? '-in' : '') }));
}
