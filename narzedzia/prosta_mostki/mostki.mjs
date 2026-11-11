// Mostki przeciwiskrowe w gotowych rysunkach wzorów (wersja uproszczona).
// Każdy otwór, w którym mieści się koło większe niż LIM, dostaje mostek dopasowany do kształtu:
//  • otwór w środku wzoru (tarcza słońca) – krzyż, potem promienie i poprzeczki („koło ze szprychami”),
//  • otwór wydłużony (płatek, ramię krzyża, promień, liść) – żyłka wzdłuż jego osi, potem poprzeczki,
//  • pozostałe – mostek wzdłuż promienia od środka wzoru (dla otworów na osi pionowej: pionowy).
// Użycie (z folderu _gen/prosta_mostki): node mostki.mjs oryginaly ../../strona_prosta/wzory_dane [id…]
import fs from 'node:fs';
import { subtract, offsetRings, ringArea, ringLength, bounds, przerwyDlugich, grow, areaOf } from '../../strona_prosta/js/zdobienia/silnik.js';
const [SRC, DST, ...IDS] = process.argv.slice(2);
// LIM – największe koło mieszczące się w otworze; BW – szerokość dodawanych mostków; GRUBIEJ – o ile z każdej strony zwężane są otwory
// (istniejące mostki 3 mm robią się ok. 4,5 mm); LMAX – najdłuższa szczelina bez poprzeczki.
export const LIM = 10, BW = 5, MAXD = 6, GRUBIEJ = 0.8, LMAX = 70;
const unpack = f => { const r = []; for (let i = 0; i < f.length; i += 2) r.push([f[i] / 20, f[i + 1] / 20]); return r; };
const pack = r => r.flatMap(([x, y]) => [Math.round(x * 20), Math.round(y * 20)]);
const ccw = h => (ringArea(h) > 0 ? h : h.slice().reverse());
const A = h => Math.abs(ringArea(h));
export function insc(h) { const p = [ccw(h)]; if (!offsetRings(p, -LIM / 2).length) return 0; let lo = LIM, hi = 400; for (let k = 0; k < 9; k++) { const m = (lo + hi) / 2; if (offsetRings(p, -m / 2).length) lo = m; else hi = m; } return lo; }
function centroid(h) { let a = 0, cx = 0, cy = 0; for (let i = 0; i < h.length; i++) { const p = h[i], q = h[(i + 1) % h.length], c = p[0] * q[1] - q[0] * p[1]; a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; } return [cx / (3 * a), cy / (3 * a)]; }
/** Oś główna (kierunek) i wydłużenie – z momentów bezwładności wielokąta. */
function os(h) {
  const c = centroid(h); let sxx = 0, syy = 0, sxy = 0, a = 0;
  for (let i = 0; i < h.length; i++) { const p = [h[i][0] - c[0], h[i][1] - c[1]], q = [h[(i + 1) % h.length][0] - c[0], h[(i + 1) % h.length][1] - c[1]], w = p[0] * q[1] - q[0] * p[1];
    a += w; sxx += w * (p[0] * p[0] + p[0] * q[0] + q[0] * q[0]); syy += w * (p[1] * p[1] + p[1] * q[1] + q[1] * q[1]); sxy += w * (p[0] * q[1] + 2 * p[0] * p[1] + 2 * q[0] * q[1] + q[0] * p[1]); }
  sxx /= 12; syy /= 12; sxy /= 24; if (a < 0) { sxx = -sxx; syy = -syy; sxy = -sxy; }
  const t = 0.5 * Math.atan2(2 * sxy, sxx - syy), l1 = (sxx + syy) / 2 + Math.hypot((sxx - syy) / 2, sxy), l2 = (sxx + syy) / 2 - Math.hypot((sxx - syy) / 2, sxy);
  return { c, u: [Math.cos(t), Math.sin(t)], wyd: Math.sqrt(Math.max(l1, 1e-9) / Math.max(l2, 1e-9)) };
}
const bar = (c, u, L = 2000) => { const n = [-u[1] * BW / 2, u[0] * BW / 2]; return [[c[0] - u[0] * L + n[0], c[1] - u[1] * L + n[1]], [c[0] + u[0] * L + n[0], c[1] + u[1] * L + n[1]], [c[0] + u[0] * L - n[0], c[1] + u[1] * L - n[1]], [c[0] - u[0] * L - n[0], c[1] - u[1] * L - n[1]]]; };
const tnij = (h, bars) => subtract([ccw(h)], bars).filter(q => A(q) > BW * BW * 0.8);
const snap = u => { // kierunki bardzo bliskie pionu / poziomu / 45° – dokładnie takie (równo wygląda)
  const a = Math.atan2(u[1], u[0]), k = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); return Math.abs(a - k) < 0.035 ? [Math.cos(k), Math.sin(k)] : u; };
function dziel(h, C, R0, gl, poprz) {
  if (gl >= MAXD || insc(h) <= LIM) return [h];
  const o = os(h), odC = Math.hypot(o.c[0] - C[0], o.c[1] - C[1]);
  let bars, kier;
  if (gl === 0 && odC < 0.06 * R0 && o.wyd < 1.3) { bars = [bar(C, [0, 1]), bar(C, [1, 0])]; kier = null; }           // środek wzoru: krzyż
  else {
    let u;
    if (poprz) u = [-poprz[1], poprz[0]];                                 // po żyłce – poprzeczka
    else if (o.wyd >= 1.3) u = o.u;                                       // wydłużony: żyłka wzdłuż osi
    else if (odC > 0.06 * R0) u = [(o.c[0] - C[0]) / odC, (o.c[1] - C[1]) / odC];   // wzdłuż promienia
    else u = [0, 1];
    u = snap(u); bars = [bar(o.c, u)]; kier = u;
  }
  let cz = tnij(h, bars);
  if (cz.length < 2 && kier) { kier = [-kier[1], kier[0]]; cz = tnij(h, [bar(o.c, kier)]); }   // mostek nie podzielił (otwór wklęsły) – w poprzek
  if (cz.length < 2) return [h];
  return cz.flatMap(q => dziel(q, C, R0, gl + 1, poprz ? null : kier));
}
/** Żyłki: równoległe mostki wzdłuż osi otworu (wydłużony) albo pionowe (pozostałe), równo rozłożone – tyle, żeby każda szczelina była wąska. */
function zylki(h) {
  const o = os(h), u = o.wyd >= 1.3 ? snap(o.u) : [0, 1], n = [-u[1], u[0]];
  let a = Infinity, b = -Infinity; for (const q of h) { const t = q[0] * n[0] + q[1] * n[1]; a = Math.min(a, t); b = Math.max(b, t); }
  const W = b - a, k0 = Math.max(1, Math.ceil((W - LIM) / (LIM + BW)));
  let best = [h];
  for (let k = k0; k <= k0 + 4; k++) {
    const bars = []; for (let i = 1; i <= k; i++) { const t = a + W * i / (k + 1); bars.push(bar([n[0] * t, n[1] * t], u)); }
    const cz = tnij(h, bars); if (cz.length < 2) continue;
    best = cz; if (Math.max(...cz.map(insc)) <= LIM) break;
  }
  return best;
}
export function mostkuj(holes) {
  const b = bounds(holes), C = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], R0 = Math.max(b.w, b.h) / 2;
  return holes.flatMap(h => {
    if (insc(h) <= LIM) return [h];
    const o = os(h), odC = Math.hypot(o.c[0] - C[0], o.c[1] - C[1]);
    if (odC < 0.06 * R0 && o.wyd < 1.3) return dziel(h, C, R0, 0, null);   // tarcza w środku wzoru: krzyż i szprychy
    return zylki(h);
  });
}
/** Logo: trzy pionowe mostki w stałych miejscach sylwetki (ułamki szerokości). */
export function mostkujSmoka(holes, gdzie = [0.27, 0.5, 0.73]) {
  const b = bounds(holes), bars = gdzie.map(f => bar([b.x0 + b.w * f, 0], [0, 1]));
  return holes.flatMap(h => tnij(h, bars));
}
/** Grubsze mostki: każdy otwór zwężony o GRUBIEJ z każdej strony (małe otwory zostają, żeby nie znikły). */
export function pogrub(holes) {
  return holes.flatMap(h => { const q = offsetRings([ccw(h)], -GRUBIEJ).filter(x => A(x) > 6); if (!q.length) return [h];
    return q.every(x => offsetRings([ccw(x)], -1.6).length) ? q : [h]; });
}
/** Cały przepis: grubsze mostki → mostki przeciwiskrowe → poprzeczki w długich szczelinach. */
export function przerob(holes) {
  const a = mostkuj(pogrub(holes));
  return przerwyDlugich(a, { Lmax: LMAX, bw: BW, wMax: 30, hole: 3 }).holes;
}
/** Pomiar rysunku: największy otwór, najdłuższa szczelina, udział wycięcia (w prostokącie wzoru). */
export function pomiar(holes) {
  const b = bounds(holes), maxO = Math.max(...holes.map(insc0));
  let najdl = 0; for (const h of holes) { const a = A(h), P = ringLength(h), sz = 2 * a / P; if (sz <= 30) najdl = Math.max(najdl, P / 2 - sz); }
  const pole = holes.reduce((s, h) => s + A(h), 0), udzial = pole / (b.w * b.h);
  return { maxO, najdl, udzial };
}
function insc0(h) { const p = [ccw(h)]; let lo = 0, hi = 400; if (!offsetRings(p, -0.5).length) return 0; for (let k = 0; k < 11; k++) { const m = (lo + hi) / 2; if (offsetRings(p, -m / 2).length) lo = m; else hi = m; } return lo; }
if (SRC) {
  const I = JSON.parse(fs.readFileSync(`${SRC}/indeks.json`)), M = JSON.parse(fs.readFileSync(`${SRC}/miniatury.json`));
  for (const w of I.wzory) {
    if (IDS.length && !IDS.includes(w.id)) continue;
    const d = JSON.parse(fs.readFileSync(`${SRC}/${w.id}.json`)); const log = [];
    for (const v of d.warianty) {
      if (w.id.startsWith('smok')) continue;
      const H = v.holes.map(unpack), N = przerob(H);
      const m0 = v.bh > 60 && v.bh < 400 ? pomiar(H) : null, m1 = m0 ? pomiar(N) : null;
      v.holes = N.map(pack); v.n = N.length; v.duze = N.filter(h => insc(h) > 14).length;
      if (m0) log.push(`\n   ${String(Math.round(v.bh)).padStart(3)} mm  otwór ${m0.maxO.toFixed(0)}→${m1.maxO.toFixed(0)}  szczelina ${m0.najdl.toFixed(0)}→${m1.najdl.toFixed(0)}  wycięte ${(m0.udzial * 100).toFixed(0)}→${(m1.udzial * 100).toFixed(0)}%`);
    }
    fs.writeFileSync(`${DST}/${w.id}.json`, JSON.stringify(d));
    // miniatura z rysunku ok. 160 mm
    const v = d.warianty.reduce((a, q) => (Math.abs(q.bh - 160) < Math.abs(a.bh - 160) ? q : a)), H = v.holes.map(unpack), b = bounds(H), k = 88 / Math.max(b.w, b.h), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    M[w.id] = H.map(h => 'M' + h.map(([x, y]) => `${Math.round((x - cx) * k * 2) / 2} ${Math.round(-(y - cy) * k * 2) / 2}`).join('L') + 'Z').join('');
    console.log(w.id, log.join(' '));
  }
  fs.writeFileSync(`${DST}/miniatury.json`, JSON.stringify(M));
}
