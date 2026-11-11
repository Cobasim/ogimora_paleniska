// OGIMORA – instrukcja obrazkowa do płytki próbnej (PDF, PL i EN) + miniatura do okna na stronie.
// Użycie: node instrukcja.js <folder z _czesci.json> <adres działającej strony> <folder wyjściowy>
const fs = require('fs'), { chromium } = require('playwright');
const [, , SRC, URL0, OUT] = process.argv;
const CZ = JSON.parse(fs.readFileSync(`${SRC}/_czesci.json`, 'utf8'));
const A = CZ[4][0], B = CZ[4][1];
const bb = p => { const xs = p.outline.map(q => q.x), ys = p.outline.map(q => q.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
/** Część jako ścieżka SVG; (ox, oy) – gdzie ma trafić środek obrysu części; oś y odwrócona. */
function czesc(p, ox, oy, fill = '#d9d3c8') {
  const b = bb(p), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const d = r => 'M' + r.map(q => `${(ox + q.x - cx).toFixed(2)} ${(oy - (q.y - cy)).toFixed(2)}`).join('L') + 'Z';
  return `<path d="${[p.outline, ...p.holes].map(d).join('')}" fill="${fill}" fill-rule="evenodd" stroke="#16130f" stroke-width=".9" stroke-linejoin="round"/>`;
}
const RED = '#d0342c';
// smok OGIMORY – na każdym dokumencie (znak marki)
const SMOK = 'data:image/svg+xml;base64,' + fs.readFileSync(`${__dirname}/smok.svg`).toString('base64');
const TX = {
  pl: { tyt: 'Płytki próbne', pod: 'Jaki luz na ząbkach pasuje do Twojej maszyny?', test: 'STRONA TESTOWA',
    k1: 'Wytnij', k2: 'Przymierz', k3: 'Policz kropki', k4: 'Przestaw suwak',
    mm: v => v.toFixed(1).replace('.', ',') + ' mm', luzniej: 'coraz luźniej', start: 'tu zacznij (najmniejszy luz)',
    kropLuz: 'kropki przy boku = luz', kropLuz2: '4 kropki = 0,4 mm', kropGr: 'duże kropki = grubość blachy', kropGr2: '4 kropki = 4 mm',
    plyt: 'w pliku: 2 płytki (0,1–0,6 i 0,7–1,2 mm) i klucz', klucz: 'klucz', z1: '1 ząbek', z3: '3 ząbki', z2: '2 ścięte',
    ciasno: 'nie wchodzi', ciasno2: 'następny bok →', ok: 'wchodzi ręką', ok2: 'bez młotka i szlifowania', trzy: 'potem 3 ząbki naraz', trzy2: 'nie wchodzą? weź następny bok',
    wynik: 'pierwszy bok, w który wchodzą 3 ząbki', wynik2: 'liczba kropek ÷ 10 = luz w mm', 
    suw1: 'Suwak „Luz na ząbkach”', suw2: 'prawy panel, pod grubością blachy. Ustaw wynik z płytki, potem pobierz plik paleniska.',
    plazma: 'Przy 0,6 nadal za ciasno (zwykle plazma)? Przymierzaj dalej na drugiej płytce: 0,7 – 1,2 mm.',
    uw: 'Pliki tworzy skrypt. Płytki nie były jeszcze wycinane w stali – mogą zawierać błędy. Tniesz na własną odpowiedzialność.' },
  en: { tyt: 'Test plates', pod: 'Which tab clearance fits your machine?', test: 'TEST SITE',
    k1: 'Cut', k2: 'Try the key', k3: 'Count the dots', k4: 'Set the slider',
    mm: v => v.toFixed(1) + ' mm', luzniej: 'looser', start: 'start here (smallest clearance)',
    kropLuz: 'dots by a side = clearance', kropLuz2: '4 dots = 0.4 mm', kropGr: 'big dots = sheet thickness', kropGr2: '4 dots = 4 mm',
    plyt: 'in the file: 2 plates (0.1–0.6 and 0.7–1.2 mm) and a key', klucz: 'key', z1: '1 tab', z3: '3 tabs', z2: '2 chamfered',
    ciasno: 'does not go in', ciasno2: 'next side →', ok: 'goes in by hand', ok2: 'no hammer, no grinding', trzy: 'then 3 tabs at once', trzy2: 'no? take the next side',
    wynik: 'first side that takes all 3 tabs', wynik2: 'number of dots ÷ 10 = clearance in mm',
    suw1: 'The “Tab clearance” slider', suw2: 'right panel, below sheet thickness. Set the result from the plate, then download the fire pit file.',
    plazma: 'Still too tight at 0.6 (usually plasma)? Carry on with the second plate: 0.7 – 1.2 mm.',
    uw: 'The files are made by a script. The plates have not yet been cut in steel – they may contain errors. You cut at your own risk.' },
};
/** Krok 1: płytka z podpisami luzu przy bokach + klucz + legenda (bez linii odnoszących). */
function rysPlytka(t) {
  const W = 610, H = 322, hx = 172, hy = 163, kx = 425, ky = 92; let s = czesc(A, hx, hy) + czesc(B, kx, ky);
  for (let i = 0; i < 6; i++) { const a = (90 + 60 * i) * Math.PI / 180, r = 145, x = hx + Math.cos(a) * r * (i % 3 ? 1.06 : 1), y = hy - Math.sin(a) * r;
    s += `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${RED}">${t.mm((i + 1) / 10)}</text>`; }
  // łuk „coraz luźniej” przeciwnie do zegara (na rysunku: od góry w lewo)
  const arc = (a0, a1, r) => { const p = a => `${(hx + Math.cos(a * Math.PI / 180) * r).toFixed(1)} ${(hy - Math.sin(a * Math.PI / 180) * r).toFixed(1)}`; return `M${p(a0)}A${r} ${r} 0 0 0 ${p(a1)}`; };
  s += `<path d="${arc(101, 138, 158)}" fill="none" stroke="${RED}" stroke-width="1.4" marker-end="url(#gr)"/>`;
  s += `<text x="${hx - 112}" y="${hy - 140}" text-anchor="end" font-size="9.5" fill="${RED}">${t.luzniej}</text>`;
  // klucz: podpisy boków
  s += `<text x="${kx}" y="${ky - 66}" text-anchor="middle" font-size="10" font-weight="700">${t.z3}</text><text x="${kx - 40}" y="${ky + 48}" text-anchor="end" font-size="10" font-weight="700">${t.z2}</text><text x="${kx + 40}" y="${ky + 48}" font-size="10" font-weight="700">${t.z1}</text>`;
  s += `<text x="${kx}" y="${ky + 82}" text-anchor="middle" font-size="9.5" fill="#6f665c">${t.klucz}</text><text x="345" y="${H - 6}" font-size="9.5" fill="#6f665c">${t.plyt}</text>`;
  // legenda
  const k = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#16130f" stroke-width="1"/>`;
  const lx = 345; let y = 212;
  s += `<path d="M${lx + 9} ${y - 9}l8 15h-16z" fill="#fff" stroke="#16130f" stroke-width="1"/><text x="${lx + 62}" y="${y + 4}" font-size="10"><tspan font-weight="700">${t.mm(0.1)}</tspan> – ${t.start}</text>`; y += 34;
  for (let i = 0; i < 4; i++) s += k(lx + 5 + i * 13, y, 4.6);
  s += `<text x="${lx + 62}" y="${y - 3}" font-size="10" font-weight="700">${t.kropGr}</text><text x="${lx + 62}" y="${y + 10}" font-size="10" fill="#4a443e">${t.kropGr2}</text>`; y += 34;
  for (let i = 0; i < 4; i++) s += k(lx + 4 + i * 9.5, y, 3.2);
  s += `<text x="${lx + 62}" y="${y - 3}" font-size="10" font-weight="700">${t.kropLuz}</text><text x="${lx + 62}" y="${y + 10}" font-size="10" fill="#4a443e">${t.kropLuz2}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans, sans-serif"><defs><marker id="gr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${RED}"/></marker></defs>${s}</svg>`;
}
/** Krok 2: przekroje – ząbek nad za ciasnym wycięciem, ząbek w wycięciu, trzy ząbki naraz. */
function rysProba(t) {
  const blacha = (x, w) => `<rect x="${x}" y="70" width="${w}" height="22" fill="#d9d3c8" stroke="#16130f" stroke-width="1"/>`;
  const zab = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#6f665c" stroke="#16130f" stroke-width="1"/>`;
  const znak = (x, ok) => `<circle cx="${x}" cy="16" r="11" fill="${ok ? '#1d7a3c' : RED}"/><path d="${ok ? `M${x - 5} 16l4 4 7-8` : `M${x - 4.5} 11.5l9 9m0-9l-9 9`}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const pod = (x, a, b) => `<text x="${x}" y="112" text-anchor="middle" font-size="11" font-weight="700">${a}</text><text x="${x}" y="126" text-anchor="middle" font-size="10" fill="#4a443e">${b}</text>`;
  let s = '';
  // 1) za ciasno
  s += blacha(10, 50) + blacha(84, 50) + zab(55, 30, 34, 36) + `<rect x="37" y="22" width="70" height="8" fill="#6f665c" stroke="#16130f" stroke-width="1"/>` + znak(24, false) + pod(72, t.ciasno, t.ciasno2);
  // 2) wchodzi
  s += blacha(170, 44) + blacha(256, 44) + zab(218, 52, 34, 46) + `<rect x="200" y="44" width="70" height="8" fill="#6f665c" stroke="#16130f" stroke-width="1"/>`
    + `<rect x="214" y="70" width="4" height="22" fill="${RED}"/><rect x="252" y="70" width="4" height="22" fill="${RED}"/>` + znak(184, true) + pod(235, t.ok, t.ok2);
  // 3) trzy naraz
  const x0 = 330; s += blacha(x0, 16); for (let k = 0; k < 3; k++) { const x = x0 + 16 + k * 50; s += `<rect x="${x}" y="70" width="3" height="22" fill="${RED}"/><rect x="${x + 31}" y="70" width="3" height="22" fill="${RED}"/>` + zab(x + 3, 52, 28, 46) + blacha(x + 34, 16); }
  s += `<rect x="${x0 + 8}" y="44" width="150" height="8" fill="#6f665c" stroke="#16130f" stroke-width="1"/>` + znak(x0 + 14, true) + pod(x0 + 86, t.trzy, t.trzy2);
  return `<svg viewBox="0 0 520 130" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans, sans-serif">${s}</svg>`;
}
/** Krok 3: kropki → liczba. */
function rysKropki(t) {
  const k = (x, y) => `<circle cx="${x}" cy="${y}" r="5.5" fill="#fff" stroke="#16130f" stroke-width="1.2"/>`;
  let s = `<rect x="2" y="6" width="150" height="58" rx="6" fill="#d9d3c8" stroke="#16130f" stroke-width="1"/><rect x="22" y="14" width="34" height="9" fill="#fff" stroke="#16130f"/><rect x="62" y="14" width="34" height="9" fill="#fff" stroke="#16130f"/><rect x="102" y="14" width="34" height="9" fill="#fff" stroke="#16130f"/>`;
  for (let i = 0; i < 4; i++) s += k(52 + i * 18, 44);
  s += `<path d="M166 35h34" stroke="#16130f" stroke-width="1.6" marker-end="url(#cz)"/><text x="216" y="45" font-size="30" font-weight="800" fill="${RED}">${t.mm(0.4)}</text>`;
  s += `<text x="345" y="30" font-size="11" font-weight="700">${t.wynik}</text><text x="345" y="46" font-size="10.5" fill="#4a443e">${t.wynik2}</text>`;
  return `<svg viewBox="0 0 560 70" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans, sans-serif"><defs><marker id="cz" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#16130f"/></marker></defs>${s}</svg>`;
}
const strona = (t, lang, zrzutMaly, zrzutSuwak) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>OGIMORA – ${t.tyt}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Manrope:wght@700;800&display=swap" rel="stylesheet">
<style>@page { size: A4; margin: 0 } * { box-sizing: border-box } body { margin: 0; font: 10pt/1.35 'DM Sans', sans-serif; color: #16130f; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.p { width: 210mm; height: 297mm; padding: 11mm 13mm 9mm; display: flex; flex-direction: column; }
header img.smok { height: 9mm; width: auto; align-self: center; margin-right: -2mm }
header { display: flex; align-items: baseline; gap: 3.5mm; padding-bottom: 3mm; border-bottom: .5mm solid #16130f; }
header b { font: 800 13pt Manrope, sans-serif; letter-spacing: .14em } header h1 { margin: 0; font: 800 14pt Manrope, sans-serif; white-space: nowrap } header span { color: #4a443e; font-size: 9pt; white-space: nowrap }
header i { margin-left: auto; font: 700 7.5pt 'DM Sans'; letter-spacing: .12em; font-style: normal; border: .3mm solid ${RED}; color: ${RED}; border-radius: 1.5mm; padding: .6mm 2mm; white-space: nowrap }
section { display: grid; grid-template-columns: 12mm 1fr; gap: 0 3mm; padding: 3.5mm 0 3mm; border-bottom: .2mm solid #cfc8bd; }
section:last-of-type { border: 0 }
.n { width: 10mm; height: 10mm; border-radius: 50%; background: #16130f; color: #fff; font: 800 13pt/10mm Manrope, sans-serif; text-align: center; }
h2 { margin: 1.2mm 0 2mm; font: 800 13pt Manrope, sans-serif; } svg { display: block; width: 100%; height: auto }
.s4 { display: grid; grid-template-columns: 62mm 56mm 1fr; gap: 6mm; align-items: center; }
.s4 img { display: block; width: 100%; border: .3mm solid #cfc8bd; border-radius: 2mm; }
.s4 figure { margin: 0; position: relative; } .s4 figcaption { margin-top: 1.5mm; font-size: 9pt; color: #4a443e; }
.s4 .duzy img { border: .7mm solid ${RED}; }
footer { margin-top: auto; padding-top: 2.5mm; border-top: .2mm solid #cfc8bd; font-size: 8.3pt; color: #4a443e; display: grid; gap: 1mm } footer b { color: #16130f }
footer div { display: flex; justify-content: space-between; gap: 6mm }
</style></head><body><div class="p">
<header><img class="smok" src="${SMOK}" alt=""><b>OGIMORA</b><h1>${t.tyt}</h1><span>${t.pod}</span><i>${t.test}</i></header>
<section><div class="n">1</div><div><h2>${t.k1}</h2><div style="width:155mm">${rysPlytka(t)}</div></div></section>
<section><div class="n">2</div><div><h2>${t.k2}</h2><div style="width:150mm">${rysProba(t)}</div></div></section>
<section><div class="n">3</div><div><h2>${t.k3}</h2><div style="width:160mm">${rysKropki(t)}</div></div></section>
<section><div class="n">4</div><div><h2>${t.k4}</h2><div class="s4"><figure><img src="${zrzutMaly}"></figure><figure class="duzy"><img src="${zrzutSuwak}"></figure><p style="margin:0;font-size:9.5pt"><b>${t.suw1}</b><br>${t.suw2}</p></div></div></section>
<footer><div><span>${t.uw}</span><span>ogimora.com</span></div></footer>
</div></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // obrazki do okna na stronie: obie płytki i klucz, osobno dla blachy 3, 4 i 5 mm (różnią się kropkami grubości)
  for (const g of [3, 4, 5]) fs.writeFileSync(`${OUT}/plytki_${g}mm.svg`, `<svg viewBox="0 0 770 280" xmlns="http://www.w3.org/2000/svg">${czesc(CZ[g][0], 155, 140)}${czesc(CZ[g][1], 385, 140)}${czesc(CZ[g][2], 615, 140)}</svg>`);
  const b = await chromium.launch();
  for (const lang of ['pl', 'en']) {
    const t = TX[lang];
    // zrzuty prawdziwej strony: suwak luzu ustawiony na 0,4
    const p = await b.newPage({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 2 });
    await p.goto(`${URL0}/?lang=${lang}`); await p.waitForTimeout(3500);
    await p.evaluate(() => { document.querySelectorAll('.info-bar').forEach(e => e.remove()); const n = document.getElementById('n-gap'); n.value = '0.4'; n.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('ctl-joint').scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const q = document.getElementById('ctl-joint').getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; });
    await p.evaluate(q => { const d = document.createElement('div'); d.id = 'ramkaP'; d.style.cssText = `position:fixed;z-index:999;left:${q.x - 8}px;top:${q.y - 8}px;width:${q.w + 16}px;height:${q.h + 16}px;border:6px solid #d0342c;border-radius:16px;pointer-events:none`; document.body.appendChild(d); }, r);
    const maly = (await p.screenshot({ type: 'jpeg', quality: 80 })).toString('base64');
    await p.evaluate(() => document.getElementById('ramkaP').remove());
    const suw = (await p.screenshot({ type: 'png', clip: { x: r.x - 10, y: r.y - 100, width: r.w + 20, height: r.h + 108 } })).toString('base64');
    await p.close();
    const d = await b.newPage(); await d.setContent(strona(t, lang, 'data:image/jpeg;base64,' + maly, 'data:image/png;base64,' + suw), { waitUntil: 'networkidle' });
    await d.evaluate(() => document.fonts.ready);
    const nazwa = lang === 'pl' ? 'ogimora-plytka-probna-PL' : 'ogimora-test-plate-EN';
    await d.pdf({ path: `${OUT}/${nazwa}.pdf`, format: 'A4', printBackground: true });
    await d.setViewportSize({ width: 794, height: 1123 }); await d.screenshot({ path: `${OUT}/_${lang}.png` });
    await d.close();
  }
  await b.close(); console.log('gotowe');
})();
