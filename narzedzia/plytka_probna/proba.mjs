// OGIMORA – płytki próbne (2026-11-11):
//  ogimora-test_Xmm.dxf – sześciokąt 0,1–0,6 + klucz + sześciokąt 0,7–1,2: na każdym boku trzy wcięcia z jednym luzem, przy nich trzy otwory z tym samym luzem.
//  (Płytka do próby ognia została usunięta – niepotrzebna.)
// Oznaczenia: wycięte kropki (liczy się ich liczba, najwyżej 5 w rzędzie); trójkąt na środku wskazuje bok z najmniejszym luzem. Użycie: node proba.mjs <strona_prosta> <folder wynikowy>
import fs from 'node:fs';
const [SP, OUT] = process.argv.slice(2);
const { buildDxf } = await import(`${SP}/js/dxf.js`);

// luz na stronę [mm]; cyfra przy boku = dziesiąte części mm. Dwa sześciokąty: 0,1–0,6 i 0,7–1,2 (co 0,1 mm, bez dziur w skali)
const ZESTAWY = { '01-06': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], '07-12': [0.7, 0.8, 0.9, 1.0, 1.1, 1.2] };
const ZAB = 20;                                // szerokość ząbka klucza [mm]
const BOK = 150;                               // bok sześciokąta [mm]
const ROZ = 35;                                // rozstaw ząbków (trzy w rzędzie) [mm]

const P = (x, y) => ({ x, y });
const prost = (x0, y0, w, h) => [P(x0, y0), P(x0 + w, y0), P(x0 + w, y0 + h), P(x0, y0 + h)];
const kolo = (cx, cy, d, n = 24) => Array.from({ length: n }, (_, i) => P(cx + d / 2 * Math.cos(2 * Math.PI * i / n), cy + d / 2 * Math.sin(2 * Math.PI * i / n)));
// ---- cyfry 7-segmentowe.
// LINIA = true: każdy segment to jedno przejście palnika (otwarta linia cięcia, widać samą szczelinę po cięciu).
// LINIA = false: każdy segment to osobna szczelina SW × SL wycięta na wylot.
// W obu wersjach między segmentami zostaje SG metalu, więc nigdy nie powstaje zamknięty kształt i nic nie wypada.
const LINIA = true;
const SW = 4, SL = 12, SV = 11, SG = 2.5, SD = SV + SW + 2 * SG;          // SD – odstęp poziomych segmentów
export const CYFRA = { w: SL + 2 * SW, h: 2 * SD + SW };
const SEG = { a: [0, SD, 0], g: [0, 0, 0], d: [0, -SD, 0], f: [-(SL + SW) / 2, SD / 2, 1], b: [(SL + SW) / 2, SD / 2, 1], e: [-(SL + SW) / 2, -SD / 2, 1], c: [(SL + SW) / 2, -SD / 2, 1] };
const ZNAK = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
/** Liczba n jako szczeliny; środek w (cx, cy), obrót kat [rad] (0 = cyfra pionowo, góra w +y). */
function cyfry(n, cx, cy, kat = 0) {
  const zn = String(n).split('').map(Number), odst = CYFRA.w + 5, out = [], co = Math.cos(kat), si = Math.sin(kat);
  const T = (px, py, ox) => P(cx + (px + ox) * co - py * si, cy + (px + ox) * si + py * co);
  zn.forEach((z, i) => { const ox = (i - (zn.length - 1) / 2) * odst;
    for (const s of ZNAK[z]) { const [x, y, pion] = SEG[s], hw = (pion ? SW : SL) / 2, hh = (pion ? SV : SW) / 2;
      if (LINIA) out.push(pion ? [T(x, y - hh, ox), T(x, y + hh, ox)] : [T(x - hw, y, ox), T(x + hw, y, ox)]);
      else out.push([[x - hw, y - hh], [x + hw, y - hh], [x + hw, y + hh], [x - hw, y + hh]].map(([px, py]) => T(px, py, ox))); } });
  return out;
}
/** Oznaczenie liczbą kropek: najwyżej 5 w rzędzie (np. 12 = 5 + 5 + 2). Środek pierwszego rzędu w (cx, cy);
 *  rzędy równoległe do kierunku T, kolejne rzędy w stronę −N (od krawędzi do środka). Średnica d ≥ grubość blachy. */
function kropkiN(n, cx, cy, d, T = [1, 0], N = [0, 1]) {
  const out = [], odst = d + 4;
  for (let r = 0, zost = n; zost > 0; r++, zost -= 5) { const ile = Math.min(5, zost);
    for (let i = 0; i < ile; i++) { const s2 = (i - (ile - 1) / 2) * odst; out.push(kolo(cx + T[0] * s2 - N[0] * r * odst, cy + T[1] * s2 - N[1] * r * odst, d)); } }
  return out;
}
/** Mały napis cyframi z osobnych szczelin wyciętych na wylot (zamknięte kontury, nic nie wypada), np. '0.1'.
 *  Środek napisu w (cx, cy); kropka dziesiętna to okrągły otwór na linii dołu cyfr. */
function napis(txt, cx, cy, t = 4) {
  const w = Math.max(4, t), l = Math.max(9, 2.2 * t), v = l, g = 3,   // szerokość każdej szczeliny = grubość blachy (nie mniej niż 4 mm)
   sd = v + w + 2 * g, cw = l + 2 * w, kd = Math.max(5, t), odst = 5, out = [];
  const seg = { a: [0, sd, 0], g: [0, 0, 0], d: [0, -sd, 0], f: [-(l + w) / 2, sd / 2, 1], b: [(l + w) / 2, sd / 2, 1], e: [-(l + w) / 2, -sd / 2, 1], c: [(l + w) / 2, -sd / 2, 1] };
  const zn = txt.split(''), szer = zn.map(z => z === '.' ? kd : z === '1' ? w : cw), cal = szer.reduce((a, b) => a + b, 0) + odst * (zn.length - 1);
  let x = cx - cal / 2;
  zn.forEach((z, i) => { const xc = x + szer[i] / 2; x += szer[i] + odst;
    if (z === '.') { out.push(kolo(xc, cy - sd - w / 2 + kd / 2, kd)); return; }
    for (const k of ZNAK[+z]) { const [sx0, sy, pion] = seg[k], sx = z === '1' ? 0 : sx0, hw = (pion ? w : l) / 2, hh = (pion ? v : w) / 2; out.push(prost(xc + sx - hw, cy + sy - hh, 2 * hw, 2 * hh)); } });
  return out;
}
/** Kropka oznaczenia luzu / mostka: średnica = grubość blachy, nie mniej niż 5 mm. */
const dZnak = t => Math.max(5, t);
/** Dokłada cyfry do części: jako otwarte linie cięcia albo jako otwory. */
const dodaj = (cz, c) => { if (LINIA) cz.lines.push(...c); else cz.holes.push(...c); };
/** Kropka oznaczenia grubości: średnica nie mniejsza niż grubość blachy + 2 mm. */
const dKropki = t => Math.max(7, t + 2);

/** Sześciokąt A i klucz B dla blachy t. */
function zamki(t, LUZY) {
  const Rw = BOK * Math.sqrt(3) / 2, C = Rw + 5, holes = [], lines = [], outline = [];   // Rw – promień wpisany; środek w (C, C)
  LUZY.forEach((g, i) => {
    const a = (90 + 60 * i) * Math.PI / 180, N = [Math.cos(a), Math.sin(a)], T = [-N[1], N[0]];   // bok 1 u góry, dalej przeciwnie do zegara
    const pkt = (s, r) => P(C + T[0] * s + N[0] * r, C + T[1] * s + N[1] * r);                    // s – wzdłuż boku, r – od środka
    const pol = ZAB / 2 + g;
    // obrys: narożnik → trzy wcięcia (głębokość = grubość blachy) → dalej
    outline.push(pkt(-BOK / 2, Rw));
    for (const dx of [-ROZ, 0, ROZ]) outline.push(pkt(dx - pol, Rw), pkt(dx - pol, Rw - t), pkt(dx + pol, Rw - t), pkt(dx + pol, Rw));
    // trzy otwory na ząbki, równoległe do boku, 26 mm od krawędzi
    const r0 = Rw - 26, w = t + 2 * g;
    for (const dx of [-ROZ, 0, ROZ]) holes.push([pkt(dx - pol, r0), pkt(dx + pol, r0), pkt(dx + pol, r0 - w), pkt(dx - pol, r0 - w)]);
    // cyfra pod otworem: luz w dziesiątych mm, górą do krawędzi (czyta się z bokiem u góry)
    // liczba kropek pod otworami = luz w dziesiątych mm (rzędy po 5, pierwszy rząd najbliżej krawędzi)
    { const c = pkt(0, r0 - w - 9 - dZnak(t) / 2); holes.push(...kropkiN(Math.round(g * 10), c.x, c.y, dZnak(t), T, N)); }
  });
  const A = { id: 'A', name: 'Sześciokąt A', code: 'A', qty: 1, t, outline, holes, lines };
  // trójkąt nad kropkami grubości: wierzchołek wskazuje bok z najmniejszym luzem (bok 1, u góry)
  holes.push([P(C, C), P(C - 9, C - 18), P(C + 9, C - 18)]);
  // nad trójkątem wartość najmniejszego luzu cyframi (0.1 albo 0.7) – resztę boków czyta się z kropek
  { const w = Math.max(4, t), l = Math.max(9, 2.2 * t); holes.push(...napis(LUZY[0].toFixed(1), C, C + 7 + (l + w + 6) + w / 2, t)); }
  // grubość blachy: tyle kropek na środku sześciokąta, ile milimetrów (3, 4 albo 5)
  for (let k = 0; k < t; k++) holes.push(kolo(C + (k - (t - 1) / 2) * (dKropki(t) + 6), C - 30, dKropki(t)));
  // klucz B: trójkąt równoboczny (bok 135); bok 1 – trzy ząbki, bok 2 – dwa ząbki ze ściętymi rogami, bok 3 – jeden ząbek.
  // Ząbki wystają na grubość blachy + 3 mm (jak ząbek dna).
  const TB = 135, Rt = TB / (2 * Math.sqrt(3)), d = t + 3, z = ZAB / 2, f = 1.5, outB = [];
  const UKLAD = [[[-ROZ, 0, ROZ], 0], [[-ROZ / 2, ROZ / 2], f], [[0], 0]];
  UKLAD.forEach(([srodki, sciecie], i) => {
    const a = (90 + 120 * i) * Math.PI / 180, N = [Math.cos(a), Math.sin(a)], T = [-N[1], N[0]];
    const pkt = (s2, r) => P(Rt + d + 5 + T[0] * s2 + N[0] * r, 2 * Rt + d + 5 + T[1] * s2 + N[1] * r);
    outB.push(pkt(-TB / 2, Rt));
    for (const dx of srodki) outB.push(pkt(dx - z, Rt), pkt(dx - z + sciecie, Rt + d), pkt(dx + z - sciecie, Rt + d), pkt(dx + z, Rt));
  });
  // te same kropki grubości na środku klucza (żeby kluczy z różnych blach nie pomylić)
  const hB = []; for (let k = 0; k < t; k++) hB.push(kolo(Rt + d + 5 + (k - (t - 1) / 2) * (dKropki(t) + 6), 2 * Rt + d + 5, dKropki(t)));
  return { parts: [A, { id: 'B', name: 'Klucz B', code: 'B', qty: 1, t, outline: outB, holes: hB }] };
}
// Jeden plik na grubość blachy: płytka 0,1–0,6 + klucz + płytka 0,7–1,2. (Płytka do próby ognia nie jest już generowana.)
const CZESCI = {};
for (const t of [3, 4, 5]) {
  const [A1, B] = zamki(t, ZESTAWY['01-06']).parts, A2 = { ...zamki(t, ZESTAWY['07-12']).parts[0], id: 'A2', code: 'A2', name: 'Sześciokąt A2' };
  CZESCI[t] = [A1, B, A2];
  fs.writeFileSync(`${OUT}/ogimora-test_${t}mm.dxf`, buildDxf({ parts: CZESCI[t] }));
}
fs.writeFileSync(`${OUT}/_czesci.json`, JSON.stringify(CZESCI));   // do rysunków w instrukcji PDF i w oknie na stronie
console.log('gotowe');
