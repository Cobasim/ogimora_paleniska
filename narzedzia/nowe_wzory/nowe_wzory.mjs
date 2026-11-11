// OGIMORA – nowe wzory-symbole (2026-11-11). Wszystkie narysowane od zera kodem (proste figury geometryczne),
// bez kopiowania cudzych grafik: krzyż maltański (kształt historyczny), ₿ (znak waluty, własny krój z prostokątów i łuków),
// kalendarz aztecki (własne uproszczenie zabytku), las, jeleń, wilk, ufo.
// Użycie: node nowe_wzory.mjs <strona_prosta> [--podglad plik.svg]   → dopisuje wzory do <strona_prosta>/wzory_dane
import fs from 'node:fs';
import { circle, arc, bezier, spline, band, merge, subtract, intersect, grow, offsetRings, shapes, bounds, mirrorX, rot, shift, scale, ringArea } from './prosta/js/zdobienia/silnik.js';
const ARGI = process.argv.splice(2);                       // mostki.mjs też czyta argumenty – zabieramy je, zanim się wczyta
const { przerob, insc } = await import('./mostki.mjs');
const TAU = Math.PI * 2;
const rad = d => d * Math.PI / 180;
const mx = r => r.map(([x, y]) => [-x, y]);
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** wycinek pierścienia: promienie r0–r1, kąty a0–a1 [°] */
const sektor = (r0, r1, a0, a1) => [...arc([0, 0], r1, rad(a0), rad(a1)), ...arc([0, 0], r0, rad(a1), rad(a0))];
const ccw = h => (ringArea(h) > 0 ? h : h.slice().reverse());
const sym = half => [...half, ...mx(half).reverse()];            // połówka (x ≥ 0, od dołu do góry) → cały kontur

// ---------------------------------------------------------------- rysunki (jednostki umowne, wysokość ok. 100)
function krzyzMaltanski() {
  // ramię w górę: wąskie przy środku, szerokie na końcu, boki wklęsłe, koniec lekko wklęsły („motocyklowy”)
  const prawy = bezier([5.5, 13], [7, 30], [14, 43], [29, 50], 24), gora = bezier([29, 50], [14, 45.5], [-14, 45.5], [-29, 50], 24);
  const ramie = [...prawy, ...gora.slice(1), ...mx(prawy).reverse().slice(1)];
  const out = []; for (let i = 0; i < 4; i++) out.push(rot(ramie, i * TAU / 4));
  out.push(circle([0, 0], 5.5));
  return out;
}
/** Low-poly: wierzchołki V (połówka, x ≥ 0), ściany F (indeksy); każda ściana zwężona o g/2 → między ścianami zostaje linia metalu g. Odbicie lustrzane dodawane samo. */
function lowPoly(V, F, g = 2.6) {
  const out = [];
  for (const f of F) { const p = f.map(i => V[i]); for (const q of [p, mx(p)]) out.push(...offsetRings([ccw(q)], -g / 2)); }
  return out;
}
/** Moneta: ząbkowany brzeg (karbowanie), pierścień perełek, w środku znak. */
function moneta(znak) {
  const out = [...znak];
  for (let i = 0; i < 40; i++) out.push(sektor(51, 56.5, i * 9 + 2.5, i * 9 + 6.5));          // karbowany rant
  for (let i = 0; i < 24; i++) out.push(circle(rotP([45.5, 0], i * 15 + 7.5), 2.5));          // perełki
  return out;
}
const rotP = ([x, y], deg) => { const a = rad(deg); return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };
function bitcoin() {
  const s = 10, out = [];
  out.push(rect(-19, -27, -9, 27));                                            // pień litery
  const brzuch = (yb, yt, xr) => { const r = (yt - yb) / 2, yc = (yb + yt) / 2, xc = xr - r, ri = r - s;
    const zew = [[-4.5, yb], ...arc([xc, yc], r, -Math.PI / 2, Math.PI / 2), [-4.5, yt]];
    const wew = [[-7, yb + s], ...arc([xc, yc], ri, -Math.PI / 2, Math.PI / 2), [-7, yt - s]];
    return subtract([zew], [wew]); };
  out.push(...brzuch(2.5, 27, 17), ...brzuch(-27, -2.5, 21));                  // dwa brzuszki, osobno (szablon – nic nie wypada)
  for (const x of [-10.5, 3.5]) out.push(rect(x, 31, x + 6.5, 38.5), rect(x, -38.5, x + 6.5, -31));   // kreski u góry i u dołu
  return moneta(out);
}
function dolar() {
  const os = spline([[12.5, 15], [8, 21], [0, 23], [-9, 20.5], [-13, 13.5], [-10, 6], [0, 0.5], [10, -5], [13.5, -12.5], [10, -20], [0, -23], [-8.5, -21], [-13, -15]], false, 10);
  const out = [...band(os, 10)];                                               // litera S jednym pociągnięciem – otwarta, nic nie wypada
  for (const x of [-7.5, 1.5]) out.push(rect(x, 31.5, x + 6, 39), rect(x, -39, x + 6, -31.5));     // dwie kreski: nad i pod literą
  return moneta(out);
}
function kalendarzAztecki() {
  const out = [];
  // maska w środku: prostokątna twarz – opaska, wąskie oczy, nos, usta z zębami, ozdoby uszu
  for (const [a, b] of [[-8, -4.5], [-1.75, 1.75], [4.5, 8]]) out.push(rect(a, 8.7, b, 11.1));
  out.push(rect(3.2, 3.4, 8.6, 5.8), rect(-8.6, 3.4, -3.2, 5.8));
  out.push([[-1.4, 1], [1.4, 1], [2.5, -2.8], [-2.5, -2.8]]);
  for (const [a, b] of [[-8, -4.5], [-1.75, 1.75], [4.5, 8]]) out.push(rect(a, -9.8, b, -5.6));
  out.push(rect(10.8, -5, 12.9, 1), rect(-12.9, -5, -10.8, 1));
  for (let i = 0; i < 4; i++) out.push(sektor(16.5, 19, 8 + i * 90, 82 + i * 90));               // obwódka twarzy
  // cztery „słońca” (pola na przekątnych) i cztery strzałki na osiach
  for (let i = 0; i < 4; i++) { out.push(sektor(22, 28.5, 45 - 20 + i * 90, 45 + 20 + i * 90));
    out.push(rot([[22, -3.2], [28.5, 0], [22, 3.2]], i * TAU / 4)); }
  for (let i = 0; i < 20; i++) out.push(sektor(31.5, 38.5, i * 18 + 3, i * 18 + 15));               // pierścień 20 znaków dni
  for (let i = 0; i < 8; i++) { const duzy = i % 2 === 0; out.push(rot([[42, -6.2], [duzy ? 55 : 50.5, 0], [42, 6.2]], i * TAU / 8));
    out.push(sektor(42, 46.5, i * 45 + 12.5, i * 45 + 32.5)); }
  for (let i = 0; i < 16; i++) { const a = i * 22.5 + 11.25; out.push(sektor(51, 55, a - 5, a + 5)); }   // zewnętrzny pas
  return out;
}
/** Krajobraz: okrągłe okno, niskie słońce z promieniami, a na ich tle ciemna (z metalu) linia świerków. */
function las() {
  // Krajobraz: wschód słońca nad wodą (wachlarz promieni), po bokach ściana świerków o nierównych gałęziach.
  const okno = circle([0, 0], 50), HOR = -14, S = [4, HOR], out = [];
  let ziarno = 5; const los = () => (ziarno = (ziarno * 16807) % 2147483647) / 2147483647;
  const swierk = (xc, H, n) => { const W = H * 0.4, bok = () => { const p = [];
      for (let k = 0; k < n; k++) { const f = (k + 1) / n, yt = HOR + H * (1 - 0.94 * k / n), yb = HOR + H * (1 - 0.94 * f) - H * 0.03 * los(), w = W / 2 * (0.16 + 0.84 * Math.pow(f, 0.85)) * (0.82 + 0.36 * los());
        if (!k) p.push([0, HOR + H]); p.push([w, yb]); if (k < n - 1) p.push([w * (0.3 + 0.15 * los()), yb + (yt - yb) * 0.35]); }
      p.push([W * 0.07, HOR + H * 0.06], [W * 0.07, HOR - 1]); return p; };
    const P = bok(), L = bok().map(([x, y]) => [-x, y]).reverse();           // lewa i prawa strona losowane osobno – drzewo nie jest symetryczne
    return shift([...P, ...L], [xc, 0]); };
  const drzewa = merge([[-45, 32, 5], [-35, 52, 8], [-24, 40, 6], [27, 36, 6], [37, 54, 8], [46, 34, 5]].map(t => ccw(swierk(...t))));
  out.push(...intersect(drzewa, [okno]));
  // promienie: wachlarz 60°–120° pocięty liniami metalu stałej szerokości (3), obcięty oknem
  const linie = []; for (let a = 60; a <= 120; a += 10) linie.push(...band([S, [S[0] + 90 * Math.cos(rad(a)), S[1] + 90 * Math.sin(rad(a))]], 3.2));
  out.push(...intersect(subtract([[...arc(S, 70, rad(60), rad(120)), ...arc(S, 17, rad(120), rad(60))]], linie), [okno]));
  out.push([...arc(S, 11.5, 0, Math.PI)]);                                     // słońce (połowa tarczy nad horyzontem)
  for (const [y, w] of [[-20.5, 34], [-27, 23], [-33.5, 12]]) out.push(rect(S[0] - w, y - 1.7, S[0] + w, y + 1.7));   // odbicie w wodzie
  return out;
}
function jelen() {
  //            0          1          2           3          4          5         6          7         8        9        10        11        12        13
  const V = [[0, -50], [5.5, -46.5], [0, -41], [8.5, -35], [0, -24], [11.5, -21], [9, -6], [15.5, -8], [0, -3], [13.5, 5], [0, 9], [7, 11], [16, -1.5], [36, 9], [15.5, 10], [26, 2]];
  const F = [[0, 1, 2], [1, 3, 2], [2, 3, 4], [3, 5, 4], [4, 5, 6], [4, 6, 8], [5, 7, 6], [6, 7, 9], [6, 9, 11], [8, 6, 11], [8, 11, 10], [12, 15, 14], [15, 13, 14]];
  const out = lowPoly(V, F);
  // poroże: belka z odcinków (ściany) i ostre odnogi
  const odc = (a, b, wa, wb) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d), n = [-d[1] / L, d[0] / L]; return [[a[0] + n[0] * wa, a[1] + n[1] * wa], [a[0] - n[0] * wa, a[1] - n[1] * wa], [b[0] - n[0] * wb, b[1] - n[1] * wb], [b[0] + n[0] * wb, b[1] + n[1] * wb]]; };
  const B = [[8, 13.5], [13, 23], [21.5, 31], [27, 40], [27.5, 50]];
  const por = [odc(B[0], B[1], 3.3, 3.1), odc(B[1], B[2], 3.1, 2.8), odc(B[2], B[3], 2.8, 2.4), odc(B[3], B[4], 2.4, 0.3),
    odc([11.5, 21], [8, 36], 2.7, 0.3), odc([19.5, 29.5], [16, 46], 2.6, 0.3), odc([25.5, 37.5], [39, 48], 2.5, 0.3), odc([15.5, 25.5], [31, 23.5], 2.5, 0.3)];
  const prawe = merge(por.map(ccw));
  return [...out, ...prawe, ...prawe.map(r => mx(r))];
}
function wilk() {
  //            0 A       1 B        2 C        3 D        4 E'       5 G        6 H        7 I        8 K       9 L        10 Co     11 S     12 Sm      13 F1      14 F2       15 J        16 Ns      17 Nt      18 Nb      19 Cs      20 Ch
  const V = [[0, 27], [13, 31], [27, 50], [31, 24], [22, 27], [10, 15], [0, 12], [22.5, 12], [8.5, 6], [16, 4.5], [35, 6], [0, -1], [6, -13], [30, -9], [24, -23], [13, -33], [6, -33], [0, -29.5], [0, -38], [6, -46], [0, -50]];
  const F = [[1, 2, 4], [4, 2, 3], [0, 1, 5], [0, 5, 6], [1, 4, 5], [4, 3, 7], [5, 4, 7], [5, 7, 8], [6, 5, 8], [6, 8, 11], [3, 10, 7], [7, 10, 9], [9, 10, 13], [8, 9, 12], [11, 8, 12], [9, 13, 12], [12, 13, 14], [12, 14, 15], [12, 15, 16], [11, 12, 17], [17, 12, 16], [16, 15, 19], [18, 16, 19], [18, 19, 20]];
  return lowPoly(V, F);                                                        // oko (8, 7, 9) i nos (17, 16, 18) zostają z metalu
}
function ufo() {
  const el = scale(circle([0, 0], 1), 1).map(([x, y]) => [x * 50, 12 + y * 16.5]);              // korpus: elipsa
  const out = [...intersect([el], [rect(-60, 17.5, 60, 40)]), ...intersect([el], [rect(-60, -20, 60, 6.5)])];
  for (const x of [-30, -15, 0, 15, 30]) out.push(circle([x, 12], 2.7));                         // światła w pasie z metalu
  out.push([[-15, 32], ...arc([0, 32], 15, 0, Math.PI).reverse().slice(1, -1), [15, 32]].reverse());   // kopuła
  out.push([[-4, -10], [4, -10], [8.5, -50], [-8.5, -50]]);                                      // wiązka: trzy promienie
  const bok = [[9, -10], [15.5, -10], [33, -50], [15, -50]]; out.push(bok, mx(bok));
  return out;
}
// ---------------------------------------------------------------- wersje na małe rozmiary (mniej szczegółów, grubsze kształty)
const czteryLuki = (r0, r1) => [0, 1, 2, 3].map(i => sektor(r0, r1, 45 + 7 + i * 90, 135 - 7 + i * 90));
function bitcoinMaly() {
  const s = 10.5, out = [rect(-19, -27, -9.5, 27)];
  const brzuch = (yb, yt, xr) => { const r = (yt - yb) / 2, yc = (yb + yt) / 2, xc = xr - r, ri = r - s;
    return subtract([[[-4, yb], ...arc([xc, yc], r, -Math.PI / 2, Math.PI / 2), [-4, yt]]], [[[-7, yb + s], ...arc([xc, yc], ri, -Math.PI / 2, Math.PI / 2), [-7, yt - s]]]); };
  out.push(...brzuch(3, 27, 17), ...brzuch(-27, -3, 21));
  for (const x of [-11, 3.5]) out.push(rect(x, 32, x + 7.5, 40), rect(x, -40, x + 7.5, -32));
  return [...out, ...czteryLuki(47, 54)];
}
function dolarMaly() {
  const os = spline([[12.5, 15], [8, 21], [0, 23], [-9, 20.5], [-13, 13.5], [-10, 6], [0, 0.5], [10, -5], [13.5, -12.5], [10, -20], [0, -23], [-8.5, -21], [-13, -15]], false, 10);
  const out = [...band(os, 10.5)];
  out.push(rect(-3.75, 32.5, 3.75, 40), rect(-3.75, -40, 3.75, -32.5));
  return [...out, ...czteryLuki(47, 54)];
}
function kalendarzMaly() {
  const out = [rect(-8, 3, -2.5, 7.5), rect(2.5, 3, 8, 7.5), rect(-8, -8, 8, -3.5)];           // maska: oczy i usta
  for (let i = 0; i < 4; i++) out.push(sektor(16, 22, 9 + i * 90, 81 + i * 90));
  for (let i = 0; i < 8; i++) { out.push(rot([[28, -8], [i % 2 ? 44 : 50, 0], [28, 8]], i * TAU / 8)); }
  for (let i = 0; i < 8; i++) out.push(sektor(46, 52, i * 45 + 13, i * 45 + 32));
  return out;
}
function jelenMaly() {
  const glowa = sym([[0, -50], [4.5, -49.5], [7.5, -45], [8.5, -37], [11, -24], [14.5, -12], [15, -3], [12.5, 5], [7.5, 9.5], [0, 10.5]]);
  const ucho = [[11, 3], [19, 0.5], [32, 6], [35, 10], [24, 11.5], [13, 8]];
  const belka = spline([[6, 8], [11, 19], [20, 28], [27, 38], [28.5, 50]], false, 10);
  const odn = [[[9.5, 16], [7.5, 24], [8.5, 33]], [[17.5, 25.5], [15.5, 35], [17, 45]], [[25.5, 35], [33, 40], [39, 48]], [[14, 22], [23, 20], [31, 23]]];
  const prawa = [glowa, ucho, ...band(belka, 5.6, true), ...odn.flatMap(o => band(spline(o, false, 8), 4.6, true))];
  return merge([...prawa, ...prawa.slice(1).map(r => mx(r))].map(ccw));
}
function wilkMaly() {
  const syl = sym([[0, -50], [5.5, -48.5], [9.5, -41], [13, -31], [24, -24], [19.5, -15.5], [30.5, -9], [25.5, 0], [35, 7], [28.5, 13.5], [30, 24], [33, 50], [17.5, 33], [9, 29.5], [0, 27]]);
  const oko = [[6.5, 5], [12, 11.5], [22.5, 13.5], [16.5, 5.5]];
  const metalP = [oko, ...band([[19, 10.5], [42, 21]], 4.6), ...band([[10.5, 8], [4.6, -31]], 4.6)];
  const metal = [...metalP, ...metalP.map(r => mx(r)), [[-7.5, -29], [7.5, -29], [0, -40]], ...band([[0, -37], [0, -60]], 4.6)];
  return subtract([syl], metal);
}
// ---------------------------------------------------------------- seria 3 (XI 2026): 17 motywów powszechnych, narysowanych od zera
// Motywy (gwiazda, kotwica, róża wiatrów, płatek śniegu…) to znane symbole – niczyja własność; rysunki są własne, z figur geometrycznych.
const el = (cx, cy, rx, ry, deg = 0, n = 40) => { const a = rad(deg); return Array.from({ length: n }, (_, i) => { const t = i / n * TAU, x = rx * Math.cos(t), y = ry * Math.sin(t); return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]; }); };
const gwiazda5 = (c, R, obr = 90, r = 0.4) => Array.from({ length: 10 }, (_, i) => { const a = rad(obr + i * 36), q = i % 2 ? R * r : R; return [c[0] + q * Math.cos(a), c[1] + q * Math.sin(a)]; });
const zwez = (p, d) => offsetRings([ccw(p)], -d);
const luki = (r0, r1, ile, przerwa, a0 = 0) => Array.from({ length: ile }, (_, i) => sektor(r0, r1, a0 + i * 360 / ile + przerwa / 2, a0 + (i + 1) * 360 / ile - przerwa / 2));
function ksiezycGwiazdy() {
  const sierp = subtract([circle([-10, 0], 38)], [circle([6, 7], 33)]);
  return [...sierp, gwiazda5([14, 12], 12), gwiazda5([34, -18], 6.5, 100), gwiazda5([38, 20], 5, 80), gwiazda5([8, -14], 5, 95)];
}
function gwiazdaWKole() {
  // gwiazda z dziesięciu ścianek (grzbiet na każdym ramieniu) w kole z pięciu łuków
  const out = [], R = 40, r = R * 0.47;
  for (let i = 0; i < 5; i++) { const a = 90 + i * 72, T = rotP([R, 0], a);
    out.push(...zwez([[0, 0], T, rotP([r, 0], a + 36)], 1.3), ...zwez([[0, 0], rotP([r, 0], a - 36), T], 1.3)); }
  return [...out, ...luki(46, 52, 5, 12, 90 - 36)];
}
function plomienie() {
  const jezyk = (x, h, w, lean) => spline([[x - w * 0.55, -50], [x - w, -50 + h * 0.2], [x - w * 0.8, -50 + h * 0.42], [x - w * 0.15, -50 + h * 0.7], [x + lean, -50 + h], [x + w * 0.3 + lean * 0.4, -50 + h * 0.72], [x + w * 0.85, -50 + h * 0.45], [x + w, -50 + h * 0.2], [x + w * 0.55, -50]], true, 8);
  return [jezyk(-42, 50, 8.6, -5), jezyk(-21, 78, 8.6, 6), jezyk(0, 100, 8.6, -5), jezyk(21, 72, 8.6, 6), jezyk(42, 54, 8.6, -5)];
}
function drzewoZycia() {
  let z = 3; const los = () => (z = (z * 16807) % 2147483647) / 2147483647;
  const cz = [];
  const galaz = (p, kat, dl, w, gl) => { const q = [p[0] + dl * Math.cos(rad(kat)), p[1] + dl * Math.sin(rad(kat))];
    cz.push(...band([p, q], Math.max(2.7, w), true));
    if (gl > 0) { galaz(q, kat + 30 + 8 * los(), dl * 0.7, w * 0.85, gl - 1); galaz(q, kat - 30 - 8 * los(), dl * 0.7, w * 0.85, gl - 1); }
    else if (gl === 0) cz.push(el(q[0] + 3 * Math.cos(rad(kat)), q[1] + 3 * Math.sin(rad(kat)), 5.2, 3, kat)); };
  cz.push([[-6.5, -32], [6.5, -32], [3.6, -14], [3.4, -6], [-3.4, -6], [-3.6, -14]]);   // pień
  galaz([0, -8], 90, 8, 6.4, -1); galaz([0, -2], 38, 17, 4.4, 2); galaz([0, -2], 142, 17, 4.4, 2); galaz([0, -2], 90, 16, 4.4, 2);
  for (const [k, d] of [[232, 13], [308, 13], [258, 9], [282, 9]]) { const q = [d * Math.cos(rad(k)) * 1.25, -30 + d * Math.sin(rad(k)) * 0.75]; cz.push(...band([[0, -29], q], 3.2, true)); }   // korzenie
  const okno = circle([0, 0], 42.5);
  return [...intersect(merge(cz.map(ccw)), [okno]), ...luki(46.5, 52, 4, 14, 45)];
}
function rozaWiatrow() {
  const out = [];
  // cztery główne ramiona: wycięta jedna połowa każdego (róża „dwubarwna”); cztery małe ramiona między nimi
  for (let k = 0; k < 4; k++) { const a = 90 - k * 90;
    out.push(...zwez([[0, 0], rotP([47, 0], a), rotP([15, 0], a - 45)], 1.3));
    out.push([rotP([18.5, 0], a - 45), rotP([23, 0], a - 45 - 11), rotP([32, 0], a - 45), rotP([23, 0], a - 45 + 11)]); }
  for (let k = 0; k < 8; k++) out.push(sektor(35.5, 39, k * 45 + 7, k * 45 + 38));
  out.push(...luki(50.5, 54.5, 4, 9, 0));
  return out;
}
function kotwica() {
  const cz = [rect(-3.4, -34, 3.4, 27), rect(-19, 15.5, 19, 21.5), circle([-19, 18.5], 4.4), circle([19, 18.5], 4.4)];
  cz.push([...arc([0, -6], 34, rad(205), rad(335)), ...arc([0, -6], 26.5, rad(335), rad(205))]);                 // ramiona
  const lapa = [[-39, -8], [-25.5, -14.5], [-33.5, -27]]; cz.push(lapa, mx(lapa));                                // łapy
  const out = merge(cz.map(ccw));
  out.push(...[0, 1].map(i => [...arc([0, 38], 11.5, rad(-60 + i * 180), rad(60 + i * 180)), ...arc([0, 38], 6.5, rad(60 + i * 180), rad(-60 + i * 180))]));   // ucho (dwa łuki)
  return out;
}
function ster() {
  const out = [];
  for (let i = 0; i < 8; i++) { const a = i * 45;
    out.push(sektor(11, 26, a + 22.5 - 14, a + 22.5 + 14));                    // okna między szprychami
    out.push(sektor(31.5, 36.5, a + 22.5 - 12, a + 22.5 + 12));            // obręcz z zewnątrz
    out.push(rot([[32.5, -3.1], [46, -2.5], ...arc([46, 0], 3.6, -Math.PI / 2, Math.PI / 2).slice(1, -1), [46, 2.5], [32.5, 3.1]], rad(a))); }   // rękojeści
  out.push(circle([0, 0], 4.6));
  return out;
}
function lapa() {
  const duza = merge([el(0, -14, 19, 14), el(-11, -21, 9.5, 8.5), el(11, -21, 9.5, 8.5), el(0, -8, 12, 12)].map(ccw));
  return [...duza, el(-25, 6, 7.6, 10.5, 22), el(-9.5, 23, 7.8, 11.5, 7), el(9.5, 23, 7.8, 11.5, -7), el(25, 6, 7.6, 10.5, -22)];
}
function podkowa() {
  const out = [], kat = [[-52, -18], [-12, 22], [28, 62], [68, 112], [118, 152], [158, 192], [198, 232]];
  for (const [a0, a1] of kat) out.push(sektor(25, 42, a0, a1));
  return out;
}
function gory() {
  const A = [[-50, -32], [-27, 14], [-16, -4], [3, 44], [22, 2], [31, 14], [50, -32]];             // grań trzech szczytów
  const metal = [...band([[-39, -4], [-33, 2], [-27, -5], [-21, 1], [-14, -10]], 3), ...band([[-13, 10], [-6, 18], [1, 9], [8, 18], [16, 8]], 3.2), ...band([[21, -3], [27, 4], [32, -3], [38, 3], [43, -7]], 3)];
  const out = subtract([A], metal);
  out.push(circle([-33, 37], 8.5));                                                              // słońce
  out.push(rect(-46, -41, 46, -37.2), rect(-30, -49, 30, -45.2));                                 // dwie linie podnóża
  return out;
}
function platekSniegu() {
  const out = [];
  for (let i = 0; i < 6; i++) { const cz = [...band([[9, 0], [43, 0]], 5.2), [[41, -4.6], [51, 0], [41, 4.6]]];
    for (const [r, d] of [[22, 12], [33, 9]]) for (const s of [1, -1]) cz.push(...band([[r, 0], [r + d * 0.5, s * d * 0.866]], 4.2, true));
    out.push(...merge(cz.map(ccw)).map(q => rot(q, rad(90 + i * 60)))); }
  out.push(circle([0, 0], 4.4));
  return out;
}
function slonecznik() {
  const out = [];
  for (let i = 0; i < 16; i++) { const a = i * 22.5; out.push(rot([[23, 0], ...arc([34, 14.5], 15.5, rad(250), rad(310), 6).map(([x, y]) => [x, y - 14.5 + 4.2 - 15.5 + 15.5]).slice(0, 0), [31, 4.3], [40, 3.6], [49, 0], [40, -3.6], [31, -4.3]], rad(a))); }
  for (let k = 1; k <= 26; k++) { const r = 3.9 * Math.sqrt(k), a = k * 137.508; if (r > 18.5) break; out.push(circle(rotP([r, 0], a), 1.75)); }   // ziarna w spirali
  return out;
}
function mandala() {
  const out = [], platek = (r0, r1, w) => [[r0, 0], [(r0 + r1) / 2 - 1, w], [r1, 0], [(r0 + r1) / 2 - 1, -w]];
  for (let i = 0; i < 8; i++) out.push(rot(spline(platek(8, 21.5, 3.3), true, 6), rad(i * 45)));
  out.push(circle([0, 0], 3.2));
  for (let i = 0; i < 16; i++) out.push(circle(rotP([26.5, 0], i * 22.5 + 11.25), 2.5));
  for (let i = 0; i < 16; i++) out.push(rot(platek(32, 46.5, 4.3), rad(i * 22.5)));
  out.push(...luki(50, 54, 16, 7, 11.25));
  return out;
}
function triskelion() {
  const out = [];
  for (let k = 0; k < 3; k++) { const linia = []; for (let t = 0; t <= 1.0001; t += 0.02) { const th = t * 1.22 * TAU, r = 7.5 + 37 * t; linia.push([r * Math.cos(th + k * TAU / 3), r * Math.sin(th + k * TAU / 3)]); }
    out.push(...band(linia, 6.2, true)); }
  return out;
}
function niedzwiedz() {
  //           0 a      1 b       2 c        3 d        4 e        5 f        6 g        7 h       8 i        9 j         10 k        11 l       12 m      13 n      14 o      15 p      16 q        17 r      18 s       19 t       20 u
  const V = [[0, 30], [14, 33], [22, 45], [33, 46], [39, 35], [31, 25], [20, 28], [37, 9], [38, -9], [30, -27], [15, -41], [0, -45], [9, 9], [18, 11], [14, 3], [9, -6], [14, -23], [0, -8], [6.5, -15], [0, -13.5], [0, -22]];
  const F = [[1, 2, 6], [2, 3, 6], [3, 4, 5], [3, 5, 6], [0, 1, 12], [0, 12, 17], [1, 6, 13], [1, 13, 12], [6, 5, 7], [6, 7, 13], [13, 7, 14], [14, 7, 8], [12, 14, 15], [12, 15, 17], [14, 8, 16], [14, 16, 15], [8, 9, 16], [15, 16, 18], [15, 18, 19], [17, 15, 19], [20, 18, 16], [20, 16, 10], [16, 9, 10], [20, 10, 11]];
  return lowPoly(V, F);                                                        // oko (12, 13, 14) i nos (19, 18, 20) zostają z metalu
}
function koniczyna() {
  const lisc = merge([circle([-6.3, 27], 9.2), circle([6.3, 27], 9.2), [[-14.3, 23], [14.3, 23], [0, 6.5]]].map(ccw));
  const out = []; for (let i = 0; i < 4; i++) out.push(...lisc.map(q => rot(q, rad(45 + i * 90))));
  out.push(...band(spline([[0, -9], [0, -20], [0, -30], [3, -40], [10, -48]], false, 8), 4, true));
  return out.map((q, i) => i === out.length - 1 ? q : q);
}
function ryba() {
  const gora = spline([[-44, 0], [-34, 9], [-18, 15.5], [2, 15], [20, 8], [30, 2]], false, 8), dol = gora.map(([x, y]) => [x, -y]).reverse();
  const cialo = [...gora, ...dol.slice(1, -1)];
  const metal = [];
  for (const x of [-25, -12, 1, 13]) metal.push(...band(arc([x - 22, 0], 24, rad(-50), rad(50)), 2.8));     // łuki łusek / skrzeli
  metal.push(circle([-34, 4], 2.9), ...band([[-34, 4], [-34, 14]], 2.6));                                  // oko (z mostkiem do grzbietu)
  const out = subtract([cialo], metal);
  out.push([[31, 0], [47, 15], [43, 0], [47, -15]]);                                                     // ogon
  out.push([[-12, 19], [4, 27], [10, 18.5]], [[-6, -19], [6, -26], [8, -18.5]]);                            // płetwy
  return out;
}
function czaszka() {
  const out = [el(-11, 6, 8.5, 9.5, 12), el(11, 6, 8.5, 9.5, -12), [[0, -3], [-4.2, -12], [4.2, -12]]];      // oczodoły, nos
  for (const x of [-11.4, -3.8, 3.8, 11.4]) out.push(rect(x - 2.1, -31, x + 2.1, -20));                      // zęby (szczeliny)
  // obrys: łuki czaszki i szczęki
  out.push([...arc([0, 8], 31, rad(18), rad(162)), ...arc([0, 8], 26.5, rad(162), rad(18))]);
  for (const s of [1, -1]) out.push([[s * 29.5, 2], [s * 25, 2], [s * 22.5, -14], [s * 17.8, -16.5], [s * 19, -20.5], [s * 26, -17]]);
  for (const s of [1, -1]) out.push([[s * 21, -25], [s * 17, -25], [s * 17, -35], [s * 10, -38.5], [s * 10, -42.5], [s * 21, -37.5]]);
  out.push(rect(-6, -42.5, 6, -38.5));
  return out;
}
export const SERIA3 = [
  ['ksiezyc-gwiazdy', 'Księżyc i gwiazdy', ksiezycGwiazdy], ['gwiazda-w-kole', 'Gwiazda w kole', gwiazdaWKole], ['plomienie', 'Płomienie', plomienie], ['drzewo-zycia', 'Drzewo życia', drzewoZycia],
  ['roza-wiatrow', 'Róża wiatrów', rozaWiatrow], ['kotwica', 'Kotwica', kotwica], ['ster', 'Koło sterowe', ster], ['lapa', 'Łapa', lapa], ['podkowa', 'Podkowa', podkowa], ['gory', 'Góry', gory],
  ['platek-sniegu', 'Płatek śniegu', platekSniegu], ['slonecznik', 'Słonecznik', slonecznik], ['mandala', 'Mandala', mandala], ['triskelion', 'Triskelion', triskelion],
  ['koniczyna', 'Koniczyna', koniczyna], ['czaszka', 'Czaszka', czaszka],
];
// narysowane, ale słabe – nie na stronę: niedźwiedź (low-poly), ryba
export const SERIA3_SLABE = [['niedzwiedz', 'Niedźwiedź', niedzwiedz], ['ryba', 'Ryba', ryba]];
// Na stronie: krzyż, kalendarz, wilk, ufo. ODLOZONE (użytkownik: „kiepsko wyglądają, popracuję nad nimi później”) – rysunki zostają w tym pliku,
// ale nie trafiają do wzory_dane: bitcoin, dolar, las, jeleń. Żeby wróciły: przenieś wpis z ODLOZONE do NOWE i dopisz id w js/prosty.js → WZORY.
export const NOWE = [
  ['krzyz-maltanski', 'Krzyż maltański', krzyzMaltanski], ['kalendarz-aztecki', 'Kalendarz aztecki', kalendarzAztecki, kalendarzMaly],
  ['wilk', 'Wilk', wilk, wilkMaly], ['ufo', 'UFO', ufo],
];
export const ODLOZONE = [['bitcoin', 'Bitcoin ₿', bitcoin, bitcoinMaly], ['dolar', 'Dolar $', dolar, dolarMaly], ['las', 'Las', las], ['jelen', 'Jeleń', jelen, jelenMaly]];
/** Rysunek w skali: wysokość = H mm, środek w (0, 0). */
function wSkali(holes, H, org) { const b = bounds(holes), k = H / b.h, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  let w = holes.map(h => ccw(h.map(([x, y]) => [(x - cx) * k, (y - cy) * k])));
  // rysunek „organiczny” (las): metal cieńszy niż 3 mm znika (otwory się łączą), potem znikają szczeliny węższe niż 3 mm
  if (org) { w = grow(grow(grow(grow(w, 1.5), -1.5), -1.5), 1.5).map(ccw); const q = w.slice(); q.strata = 0; q.ubylo = 0; q.org = true; return q; }
  const ok = w.filter(h => offsetRings([h], -1.5).length);                      // otwory węższe niż 3 mm odpadają (i tak nie do wycięcia)
  ok.strata = 1 - ok.reduce((s2, h) => s2 + Math.abs(ringArea(h)), 0) / w.reduce((s2, h) => s2 + Math.abs(ringArea(h)), 0); ok.ubylo = w.length - ok.length;
  return ok; }
const wyspy = holes => shapes(holes).reduce((s, q) => s + q.holes.length, 0);
/** Najcieńszy metal między otworami ≥ w? (pogrubienie o w/2 nie może skleić otworów) */
const mostekOk = (holes, w) => holes.org || merge(offsetRings(holes, w / 2)).length >= holes.length;

/**
 * Wariant na daną wysokość. Gdy rysunek w tej skali ma metal cieńszy niż 3 mm albo szczeliny węższe niż 3 mm,
 * powstaje wersja UPROSZCZONA: każdy otwór jest zwężany tylko o tyle, żeby między otworami zostały 3 mm,
 * a otwory, które przez to znikają albo robią się węższe niż 3 mm, odpadają. null = z rysunku zostało za mało.
 */
function wariant(fn, H, maly) { const w = wariant1(fn, H, 0.42); if (w || !maly) return w; const m = wariant1(maly, H, 0.5); if (m) m.upr = true; return m; }
function wariant1(fn, H, minPole) {
  const A0 = wSkaliSurowe(fn(), H), pole0 = A0.reduce((s2, h) => s2 + Math.abs(ringArea(h)), 0);
  for (let d = 0; d <= 1.76; d += 0.125) {
    const A = A0.flatMap(h => (d ? offsetRings([h], -d) : [h])).map(ccw).filter(h => offsetRings([h], -1.5).length);
    if (!A.length || !mostekOk(A, 3)) continue;
    const pole = A.reduce((s2, h) => s2 + Math.abs(ringArea(h)), 0);
    if (pole < minPole * pole0 || A.length < 0.3 * A0.length) return null;
    A.upr = d > 0 || A.length < A0.length; A.zach = +(pole / pole0).toFixed(2); return A;
  }
  return null;
}
function wSkaliSurowe(holes, H) { const b = bounds(holes), k = H / b.h, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; return holes.map(h => ccw(h.map(([x, y]) => [(x - cx) * k, (y - cy) * k]))); }
const [SP, flaga, plik] = ARGI;
const LISTA = flaga && flaga.endsWith('3') ? SERIA3 : NOWE;

if (flaga === '--surowy') { const h = NOWE.find(q => q[0] === plik)[2](); const b = bounds(h); console.log(b, h.length); fs.writeFileSync('surowy.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="${b.x0 - 5} ${-b.y1 - 5} ${b.w + 10} ${b.h + 10}"><rect x="-500" y="-500" width="1000" height="1000" fill="#333"/><path d="${h.map(r => 'M' + r.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L') + 'Z').join('')}" fill="#f6b08c"/></svg>`); }
if (flaga === '--male' || flaga === '--male3') {   // jak wyglądają najmniejsze warianty (48, 65, 88, 120 mm), w tej samej skali rysunku
  let s = '', x = 0; const R = [48, 65, 88, 120];
  for (const [id, , fn, maly] of LISTA) { let y = 0; for (const H of R) { const A = wariant(fn, H, maly), N = A && przerob(A);
      s += `<rect x="${x}" y="${y}" width="150" height="${H + 20}" fill="#3a332c"/>` + (N ? `<path d="${N.map(h => 'M' + h.map(([px, py]) => `${(px + x + 75).toFixed(1)} ${(y + 10 + H / 2 - py).toFixed(1)}`).join('L') + 'Z').join('')}" fill="#f6b08c"/>` : `<text x="${x + 75}" y="${y + H / 2 + 14}" fill="#888" font-size="12" text-anchor="middle">–</text>`);
      y += H + 26; } x += 156; }
  fs.writeFileSync(plik, `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="430" viewBox="0 0 ${x} 430">${s}</svg>`);
}
if (flaga === '--cienkie') {   // gdzie metal między otworami jest cieńszy niż 3 mm (przy wysokości `plik` mm)
  for (const [id, , fn, org] of NOWE) { const A = wSkali(fn(), +plik || 160, org), G = A.map(h => offsetRings([h], 1.5)); const zle = [];
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) if (intersect(G[i], G[j]).length) { const b = bounds([A[i]]); zle.push(`${i}-${j}@(${((b.x0 + b.x1) / 2).toFixed(0)},${((b.y0 + b.y1) / 2).toFixed(0)})`); }
    console.log(id, zle.length, zle.slice(0, 12).join(' ')); }
}
const ROZM = [48, 65, 88, 120, 160, 215, 290, 390, 520], pack = r => r.flatMap(([x, y]) => [Math.round(x * 20), Math.round(y * 20)]);
if (flaga === '--podglad' || flaga === '--podglad3') {   // surowe rysunki i rysunki z mostkami (160 mm) obok siebie
  let s = '', x = 0; const path = (H, dx, dy) => H.map(h => 'M' + h.map(([px, py]) => `${(px + dx).toFixed(1)} ${(dy - py).toFixed(1)}`).join('L') + 'Z').join('');
  for (const [id, , fn, org] of LISTA) { const A = wSkali(fn(), 160, org), B = przerob(A), b = bounds(A), w = b.w + 20;
    s += `<rect x="${x}" y="0" width="${w}" height="180" fill="#d9d3c8"/><path d="${path(A, x + w / 2, 90)}" fill="#fff" stroke="#16130f" stroke-width=".5"/>`;
    s += `<rect x="${x}" y="190" width="${w}" height="180" fill="#3a332c"/><path d="${path(B, x + w / 2, 280)}" fill="#f6b08c" stroke="none"/>`;
    { const C = przerob(wSkali(fn(), 290, org)); s += `<rect x="${x}" y="380" width="${w}" height="180" fill="#3a332c"/><g transform="translate(${x + w / 2} 470) scale(${160 / 290})"><path d="${path(C, 0, 0)}" fill="#f6b08c"/></g>`; }
    console.log(id, 'otwory', A.length, '→', B.length, 'wyspy', wyspy(A), wyspy(B), 'szer', b.w.toFixed(0), 'mostek3', mostekOk(A, 3), 'min', ROZM.find(H => { const q = wSkali(fn(), H, org); return mostekOk(q, 3) && q.strata <= 0.03 && q.ubylo <= 0.1 * q.length; }), 'ubyło', A.ubylo); x += w + 10; }
  fs.writeFileSync(plik, `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="560" viewBox="0 0 ${x} 560">${s}</svg>`);
} else if (SP && !flaga) {
  const D = `${SP}/wzory_dane`, I = JSON.parse(fs.readFileSync(`${D}/indeks.json`)), M = JSON.parse(fs.readFileSync(`${D}/miniatury.json`));
  if (!I.kategorie.includes('Symbole')) I.kategorie.push('Symbole');
  for (const [id, nazwa, fn, maly] of [...NOWE, ...SERIA3]) {
    const warianty = [];
    for (const H of ROZM) { const A = wariant(fn, H, maly); if (!A) continue;                       // za mały: z rysunku zostało za mało
      const N = przerob(A), b = bounds(N); if (wyspy(N)) throw new Error(`${id} ${H}: wyspa`);
      warianty.push({ h: H, upr: !!A.upr, bw: +b.w.toFixed(1), bh: +b.h.toFixed(1), n: N.length, zach: A.zach, wyspy: 0, duze: N.filter(h => insc(h) > 14).length, przerwy: 0, holes: N.map(pack), cuts: [] }); }
    fs.writeFileSync(`${D}/${id}.json`, JSON.stringify({ id, warianty }));
    const wpis = { id, nazwa, kategoria: 'Symbole', Hc: 499.2, asp: +(warianty[0].bw / warianty[0].bh).toFixed(2), rozmiary: warianty.map(v => ({ h: v.h, bh: v.bh, bw: v.bw })), ukryty: true, minH: warianty[0].bh };
    const i = I.wzory.findIndex(w => w.id === id); if (i >= 0) I.wzory[i] = wpis; else I.wzory.push(wpis);
    const v = warianty.reduce((a, q) => (Math.abs(q.bh - 160) < Math.abs(a.bh - 160) ? q : a)), Hh = v.holes.map(f => { const r = []; for (let j = 0; j < f.length; j += 2) r.push([f[j] / 20, f[j + 1] / 20]); return r; }), b = bounds(Hh), k = 88 / Math.max(b.w, b.h);
    M[id] = Hh.map(h => 'M' + h.map(([px, py]) => `${Math.round(px * k * 2) / 2} ${Math.round(-py * k * 2) / 2}`).join('L') + 'Z').join('');
    console.log(id, 'rozmiary', warianty.map(v => v.h + (v.upr ? '*' : '')).join(' '), 'otworów', warianty.map(v => v.n).join(' '), 'zostało', warianty.map(v => v.zach).join(' '));
  }
  for (const [id] of ODLOZONE) { I.wzory = I.wzory.filter(w => w.id !== id); delete M[id]; }   // odłożone wzory znikają ze strony (pliki <id>.json trzeba usunąć ręcznie)
  fs.writeFileSync(`${D}/indeks.json`, JSON.stringify(I)); fs.writeFileSync(`${D}/miniatury.json`, JSON.stringify(M));
}
