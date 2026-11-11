// OGIMORA – płytka próbna: okno z plikami DXF (blacha 3 / 4 / 5 mm) i obrazkową instrukcją PDF.
// Pliki leżą w folderze proba/ (tworzy je _gen/plytka_probna). Teksty PL / EN są w tym pliku.
import { LANG } from './i18n.js';
import { track } from './track.js';
const EN = LANG === 'en';
const T = EN ? {
  h: 'Test plates', sub: 'Cut them before the fire pit. They show which tab clearance fits your machine.',
  gr: 'Sheet thickness', a: 'Download the plates (DXF)', a2: '2 plates (clearance 0.1–1.2 mm) and a key – one file',
  c: 'Picture guide (PDF)', c2: 'how to test and which slider to set',
  n: 'The file is made by a script. The plates have <b>not yet been cut in steel</b>. You cut at your own risk.', x: 'Close', alt: 'Two hexagonal test plates and a triangular key',
} : {
  h: 'Płytki próbne', sub: 'Wytnij je przed paleniskiem. Pokażą, jaki luz na ząbkach pasuje do Twojej maszyny.',
  gr: 'Grubość blachy', a: 'Pobierz płytki (DXF)', a2: '2 płytki (luz 0,1–1,2 mm) i klucz – w jednym pliku',
  c: 'Instrukcja obrazkowa (PDF)', c2: 'jak przymierzać i który suwak przestawić',
  n: 'Plik tworzy skrypt. Płytki <b>nie były jeszcze wycinane w stali</b>. Tniesz na własną odpowiedzialność.', x: 'Zamknij', alt: 'Dwie sześciokątne płytki próbne i trójkątny klucz',
};
const btn = document.getElementById('probaBtn');
if (btn) {
  const d = document.createElement('dialog'); d.className = 'dl proba-dlg'; d.setAttribute('aria-labelledby', 'probaT');
  d.innerHTML = `<button type="button" class="dl-x" data-close aria-label="${T.x}">✕</button>
    <h2 id="probaT">${T.h}</h2><p class="dl-sub">${T.sub}</p>
    <img id="probaImg" src="proba/plytki_4mm.svg" width="770" height="280" alt="${T.alt}">
    <div class="dl-q"><span>${T.gr}</span><div class="chips" id="probaGr">${[3, 4, 5].map(t => `<button type="button" class="chip" data-v="${t}">${t} mm</button>`).join('')}</div></div>
    <a class="cta" id="probaA" download><span class="cta-icon">↓</span><span><b>${T.a}</b><small>${T.a2}</small></span></a>
    <a class="cta secondary" id="probaC" target="_blank" rel="noopener" href="proba/ogimora-${EN ? 'test-plate-EN' : 'plytka-probna-PL'}.pdf"><span class="cta-icon">?</span><span><b>${T.c}</b><small>${T.c2}</small></span></a>
    <p class="proba-note">${T.n}</p>`;
  document.body.appendChild(d);
  const $ = id => d.querySelector('#' + id);
  let gr = 4;
  const ustaw = t => { gr = t;
    d.querySelectorAll('#probaGr .chip').forEach(b => b.classList.toggle('active', +b.dataset.v === t));
    $('probaImg').src = `proba/plytki_${t}mm.svg`;   // kropki na środku = grubość blachy, więc rysunek zmienia się razem z wyborem
    $('probaA').href = `proba/ogimora-test_${t}mm.dxf`; };
  btn.addEventListener('click', () => {   // na start ta grubość, która jest wybrana w generatorze
    const a = document.querySelector('[data-thk="tBowl"] .chip.active'); ustaw([3, 4, 5].includes(+a?.dataset.v) ? +a.dataset.v : 4);
    track('proba', { value: 'okno' }); d.showModal(); });
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  $('probaGr').addEventListener('click', e => { const b = e.target.closest('button'); if (b) ustaw(+b.dataset.v); });
  $('probaA').addEventListener('click', () => track('proba', { value: 'dxf-' + gr }));
  $('probaC').addEventListener('click', () => track('proba', { value: 'pdf' }));
}
