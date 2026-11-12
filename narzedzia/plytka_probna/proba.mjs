// OGIMORA – płytki próbne (2026-11-11):
//  ogimora-test_Xmm.dxf – sześciokąt 0,1–0,6 + klucz + sześciokąt 0,7–1,2: na każdym boku trzy wcięcia z jednym luzem, przy nich trzy otwory z tym samym luzem.
//  (Płytka do próby ognia została usunięta – niepotrzebna.)
// Oznaczenia: wycięte kropki (liczy się ich liczba, najwyżej 5 w rzędzie); trójkąt na środku wskazuje bok z najmniejszym luzem. Użycie: node proba.mjs <strona_prosta> <folder wynikowy>
import fs from 'node:fs';
const [SP, OUT] = process.argv.slice(2);
const { buildDxf } = await import(`${SP}/js/dxf.js`);

// luz na stronę [mm]; cyfra przy boku = dziesiąte części mm. Dwa sześciokąty: 0,1–0,6 i 0,7–1,2 (co 0,1 mm, bez dziur w skali)
const ZESTAWY = { '01-06': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], '07-12': [0.7, 0.8, 0.9, 1.0, 1.1, 1.2] };
// płytki calowe: luz co 0,005" (0,127 mm) – 0,005…0,030" i 0,035…0,060"; liczba kropek = luz / 0,005"
const ZESTAWY_IN = [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]].map(a => a.map(n => +(n * 0.127).toFixed(4)));
const ZAB = 20;                                // szerokość ząbka klucza [mm]
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

/** Sześciokąt A i klucz B dla blachy t. cal = { luz: '.005', gr: '.135' } – płytka calowa: kropki = kroki po 0,005",
 *  nad trójkątem luz cyframi, pod trójkątem grubość blachy cyframi (zamiast kropek grubości); bok sześciokąta i klucza
 *  rośnie, gdy napisy nie mieszczą się między kropkami (gruba blacha = większe cyfry). */
function zamki(t, LUZY, cal = null, BOK = 150, TB = 135) {
  const Rw = BOK * Math.sqrt(3) / 2, C = Rw + 5, holes = [], lines = [], outline = [];   // Rw – promień wpisany; środek w (C, C)
  const etyk = [];   // otwory napisów (do sprawdzenia kolizji)
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
    { const c = pkt(0, r0 - w - 9 - dZnak(t) / 2); holes.push(...kropkiN(cal ? i + 1 + (LUZY === ZESTAWY_IN[1] ? 6 : 0) : Math.round(g * 10), c.x, c.y, dZnak(t), T, N)); }
  });
  const A = { id: 'A', name: 'Sześciokąt A', code: 'A', qty: 1, t, outline, holes, lines };
  if (!cal) {
  // trójkąt nad kropkami grubości: wierzchołek wskazuje bok z najmniejszym luzem (bok 1, u góry)
  holes.push([P(C, C), P(C - 9, C - 18), P(C + 9, C - 18)]);
  // nad trójkątem wartość najmniejszego luzu cyframi (0.1 albo 0.7) – resztę boków czyta się z kropek
  { const w = Math.max(4, t), l = Math.max(9, 2.2 * t); holes.push(...napis(LUZY[0].toFixed(1), C, C + 7 + (l + w + 6) + w / 2, t)); }
  // grubość blachy: tyle kropek na środku sześciokąta, ile milimetrów (3, 4 albo 5)
  for (let k = 0; k < t; k++) holes.push(kolo(C + (k - (t - 1) / 2) * (dKropki(t) + 6), C - 30, dKropki(t)));
  } else {
    // płytka calowa: od góry – luz boku 1 cyframi, trójkąt (wskazuje bok 1), grubość blachy cyframi
    const w = Math.max(4, t), l = Math.max(9, 2.2 * t), sd = l + w + 2 * 3, Hd = 2 * sd + w;   // wysokość cyfr (jak w napis())
    const rzTop = Math.ceil((cal.n0) / 5), d = dZnak(t), r1 = Rw - 26 - (t + 2 * LUZY[0]) - 9 - d / 2;
    const gora = C + r1 - (rzTop - 1) * (d + 4) - d / 2 - 6;           // dolna krawędź kropek boku 1 minus 6 mm metalu
    const cyA = gora - sd - w / 2;                                       // środek cyfr luzu
    const yT = gora - Hd - 5;                                            // wierzchołek trójkąta
    const A1 = napis(cal.luz, C, cyA, t), A2 = napis(cal.gr, C, yT - 18 - 5 - sd - w / 2, t);
    holes.push(...A1, [P(C, yT), P(C - 9, yT - 18), P(C + 9, yT - 18)], ...A2);
    etyk.push(...A1, ...A2);
  }
  // klucz B: trójkąt równoboczny (bok 135); bok 1 – trzy ząbki, bok 2 – dwa ząbki ze ściętymi rogami, bok 3 – jeden ząbek.
  // Ząbki wystają na grubość blachy + 3 mm (jak ząbek dna).
  const Rt = TB / (2 * Math.sqrt(3)), d = t + 3, z = ZAB / 2, f = 1.5, outB = [];
  const UKLAD = [[[-ROZ, 0, ROZ], 0], [[-ROZ / 2, ROZ / 2], f], [[0], 0]];
  UKLAD.forEach(([srodki, sciecie], i) => {
    const a = (90 + 120 * i) * Math.PI / 180, N = [Math.cos(a), Math.sin(a)], T = [-N[1], N[0]];
    const pkt = (s2, r) => P(Rt + d + 5 + T[0] * s2 + N[0] * r, 2 * Rt + d + 5 + T[1] * s2 + N[1] * r);
    outB.push(pkt(-TB / 2, Rt));
    for (const dx of srodki) outB.push(pkt(dx - z, Rt), pkt(dx - z + sciecie, Rt + d), pkt(dx + z - sciecie, Rt + d), pkt(dx + z, Rt));
  });
  // te same kropki grubości na środku klucza (żeby kluczy z różnych blach nie pomylić); klucz calowy – grubość cyframi
  const hB = [], KC = P(Rt + d + 5, 2 * Rt + d + 5); let etykB = [];
  if (!cal) for (let k = 0; k < t; k++) hB.push(kolo(Rt + d + 5 + (k - (t - 1) / 2) * (dKropki(t) + 6), 2 * Rt + d + 5, dKropki(t)));
  else { etykB = napis(cal.gr, KC.x, KC.y + Rt * 0.3, t); hB.push(...etykB); }
  return { parts: [A, { id: 'B', name: 'Klucz B', code: 'B', qty: 1, t, outline: outB, holes: hB }], etyk, etykB, KC, Rt };
}
// ---- kontrola miejsca na płytkach calowych: między napisem a innymi otworami / brzegiem zostaje co najmniej ODST mm metalu
const ODST = 4;
const pud = r => { const xs = r.map(q => q.x), ys = r.map(q => q.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
const odl = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
function miejsceA(A, etyk) {
  const E = new Set(etyk), inne = A.holes.filter(h => !E.has(h)).map(pud), ob = pud(A.outline);
  for (const h of etyk) { const b = pud(h); if (inne.some(q => odl(b, q) < ODST)) return false; if (b.x0 < ob.x0 + 10 || b.x1 > ob.x1 - 10 || b.y0 < ob.y0 + 10 || b.y1 > ob.y1 - 10) return false; }
  return true;
}
function miejsceB(r, cal) {
  if (!cal) return true;
  const { etykB, KC, Rt } = r, m = 6;
  for (const h of etykB) for (const q of h) for (let i = 0; i < 3; i++) {
    const a = (90 + 120 * i) * Math.PI / 180;
    if ((q.x - KC.x) * Math.cos(a) + (q.y - KC.y) * Math.sin(a) > Rt - m) return false;
  }
  return true;
}
/** Płytka calowa: najmniejszy bok sześciokąta (od 150 mm) i klucza (od 135 mm), przy których napisy się mieszczą. */
function zamkiCal(t, LUZY, cal) {
  let BOK = 150, TB = 135, r;
  for (; BOK < 260; BOK += 5) { r = zamki(t, LUZY, cal, BOK, TB); if (miejsceA(r.parts[0], r.etyk)) break; }
  for (; TB < 260; TB += 5) { r = zamki(t, LUZY, cal, BOK, TB); if (miejsceB(r, cal)) break; }
  return { ...r, BOK, TB };
}
// Jeden plik na grubość blachy: płytka 0,1–0,6 + klucz + płytka 0,7–1,2. (Płytka do próby ognia nie jest już generowana.)
// Od 0.2.0 każdy plik także w calach (…_in.dxf) – ta sama geometria, inne jednostki zapisu.
const CZESCI = {};
for (const t of [3, 4, 5]) {
  const [A1, B] = zamki(t, ZESTAWY['01-06']).parts, A2 = { ...zamki(t, ZESTAWY['07-12']).parts[0], id: 'A2', code: 'A2', name: 'Sześciokąt A2' };
  CZESCI[t] = [A1, B, A2];
  fs.writeFileSync(`${OUT}/ogimora-test_${t}mm.dxf`, buildDxf({ parts: CZESCI[t] }));
  fs.writeFileSync(`${OUT}/ogimora-test_${t}mm_in.dxf`, buildDxf({ parts: CZESCI[t] }, { jedn: 'in' }));
}
// Płytki calowe (USA): blachy 11 ga, 10 ga, 3/16", 1/4"; luz 0,005–0,030" i 0,035–0,060" (kropki = kroki po 0,005").
const BLACHY_IN = [[3.048, '11ga', '.120'], [3.429, '10ga', '.135'], [4.7625, '3-16', '.188'], [6.35, '1-4', '.250']];
const ROZMIARY = {};
for (const [t, kod, gr] of BLACHY_IN) {
  const r1 = zamkiCal(t, ZESTAWY_IN[0], { luz: '.005', gr, n0: 1 }), r2 = zamkiCal(t, ZESTAWY_IN[1], { luz: '.035', gr, n0: 7 });
  // obie płytki tej samej wielkości (większa z dwóch)
  const BOK = Math.max(r1.BOK, r2.BOK), TB = Math.max(r1.TB, r2.TB);
  const [A1, B] = zamki(t, ZESTAWY_IN[0], { luz: '.005', gr, n0: 1 }, BOK, TB).parts, A2 = { ...zamki(t, ZESTAWY_IN[1], { luz: '.035', gr, n0: 7 }, BOK, TB).parts[0], id: 'A2', code: 'A2', name: 'Sześciokąt A2' };
  CZESCI[kod] = [A1, B, A2]; ROZMIARY[kod] = { BOK, TB };
  fs.writeFileSync(`${OUT}/ogimora-test_${kod}_in.dxf`, buildDxf({ parts: CZESCI[kod] }, { jedn: 'in' }));
  fs.writeFileSync(`${OUT}/ogimora-test_${kod}_mm.dxf`, buildDxf({ parts: CZESCI[kod] }));
}
console.log('płytki calowe – bok sześciokąta / klucza [mm]:', JSON.stringify(ROZMIARY));
fs.writeFileSync(`${OUT}/_czesci.json`, JSON.stringify(CZESCI));   // do rysunków w instrukcji PDF i w oknie na stronie
console.log('gotowe');
