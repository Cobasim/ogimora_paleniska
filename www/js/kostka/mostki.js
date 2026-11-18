// OGIMORA – kostka: mostki w literach i cyfrach, liczone tak, żeby blacha się nie wyginała.
// (Palenisko ma własne mostki w zdobienia/napis.js – tam nic się nie zmienia.)
//  1. „Wyspa” (środek 0, 4, 6, 8, A…): dwa mostki w kierunkach, w których kreska litery jest NAJKRÓTSZA do przejścia,
//     drugi co najmniej 110° od pierwszego. Bez długich pasków blachy biegnących przez pół litery.
//  2. „Półwysep” (język blachy wchodzący w literę: 5, 2, 3, G, C, E, S…): gdy jest długi i wąski, jego czubek
//     dostaje mostek przez najbliższą kreskę – język jest wtedy trzymany z dwóch stron.
import { subtract, ringArea } from '../zdobienia/silnik.js';

const KIER = 8;                                // kierunki mostków: co 45°; przy podobnej długości wygrywa pion / poziom (wygląda porządniej)
const KARA = i => (i % 2 ? 1.18 : 1);
function przeciecia(o, d, ring) {           // parametry t > 0, w których półprosta o + t·d przecina kontur
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den, u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
    if (t > 1e-6 && u >= 0 && u < 1) out.push(t);
  }
  return out;
}
const wSrodku = (q, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
function punktWewnatrz(ring) {              // punkt na pewno w środku: środek najdłuższego poziomego odcinka
  let y0 = Infinity, y1 = -Infinity; ring.forEach(q => { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
  let best = null;
  for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const y = y0 + (y1 - y0) * f, xs = [];
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])); }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best.w) best = { w: xs[i + 1] - xs[i], p: [(xs[i] + xs[i + 1]) / 2, y] };
    if (best && best.w > 0) break;
  }
  return best ? best.p : ring[0];
}
function otoczka(pts) {                      // otoczka wypukła (łańcuch monotoniczny), przeciwnie do wskazówek zegara
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const odlOdc = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let s = L2 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2 : 0; s = Math.max(0, Math.min(1, s)); return Math.hypot(q[0] - a[0] - s * dx, q[1] - a[1] - s * dy); };

/**
 * regions – z napis.make(): [{ rings: [obrys, ...dziurki] }]; w – szerokość mostka [mm]; szablon – czcionka szablonowa
 * (ma przerwy w rysunku – półwyspów nie ruszamy). Zwraca { lines: [{ pts }], wyspy, polwyspy } – „lines” to paski metalu.
 */
export function mostkiLiter(regions, w, szablon = false) {
  const lines = []; let wyspy = 0, polwyspy = 0;
  const D = Array.from({ length: KIER }, (_, i) => { const a = i * 2 * Math.PI / KIER; return [Math.cos(a), Math.sin(a)]; });
  for (const reg of regions) {
    const [outer, ...holes] = reg.rings, wszystkie = reg.rings;
    // 1. wyspy
    for (const h of holes) {
      if (Math.abs(ringArea(h)) < 2 * w * w) continue;
      const c = punktWewnatrz(h), kand = [];
      D.forEach((d, i) => {
        const t1 = Math.min(...przeciecia(c, d, h)); if (!Number.isFinite(t1)) return;
        let t2 = Infinity; for (const r of wszystkie) for (const t of przeciecia(c, d, r)) if (t > t1 + 1e-4 && t < t2) t2 = t;
        if (Number.isFinite(t2)) kand.push({ i, d, t1, t2, dl: (t2 - t1) * KARA(i) });
      });
      if (!kand.length) continue;
      kand.sort((a, b) => a.dl - b.dl);
      const k1 = kand[0], k2 = kand.find(k => { const r = Math.abs(k.i - k1.i); return Math.min(r, KIER - r) >= 3; });
      for (const k of [k1, k2]) if (k) lines.push({ pts: [[c[0] + k.d[0] * Math.max(0, k.t1 - w), c[1] + k.d[1] * Math.max(0, k.t1 - w)], [c[0] + k.d[0] * (k.t2 + w), c[1] + k.d[1] * (k.t2 + w)]] });
      wyspy++;
    }
    if (szablon || outer.length < 6) continue;
    // 2. półwyspy: zatoki = otoczka wypukła litery − litera
    const hull = otoczka(outer); let zatoki = [];
    try { zatoki = subtract([hull], [outer]); } catch { zatoki = []; }
    for (const z of zatoki) {
      const A = Math.abs(ringArea(z)); if (A < 6 * w * w) continue;
      // ujście zatoki: jej odcinki leżące na otoczce
      const ujscie = [];
      for (let i = 0; i < z.length; i++) { const a = z[i], b = z[(i + 1) % z.length], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (hull.some((p, j) => odlOdc(m, p, hull[(j + 1) % hull.length]) < 0.05 && odlOdc(a, p, hull[(j + 1) % hull.length]) < 0.05)) ujscie.push([a, b]); }
      if (!ujscie.length) continue;
      const szerUjscia = ujscie.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
      let czubek = null, gl = 0;
      for (const q of z) { const d = Math.min(...ujscie.map(([a, b]) => odlOdc(q, a, b))); if (d > gl) { gl = d; czubek = q; } }
      const szer = Math.min(szerUjscia, 2 * A / gl);          // zatoka w kształcie języka: szerokość ≈ ujście; trójkątna: 2A / głębokość
      const trojkat = A < 0.62 * szerUjscia * gl;             // zatoka zwężająca się do czubka – język sztywniejszy u nasady
      if (!czubek || gl < 5 * w || gl < (trojkat ? 2.2 : 1.25) * szer) continue; // krótki albo szeroki (sztywny) – zostaje
      let best = null;
      D.forEach((d, i) => {
        const start = [czubek[0] + d[0] * 0.05, czubek[1] + d[1] * 0.05];
        if (!wSrodku(start, outer) || holes.some(h => wSrodku(start, h))) return;       // promień musi wejść w kreskę litery
        let t = Infinity; for (const r of wszystkie) for (const x of przeciecia(czubek, d, r)) if (x > 0.1 && x < t) t = x;
        if (!Number.isFinite(t)) return;
        const za = [czubek[0] + d[0] * (t + 0.3), czubek[1] + d[1] * (t + 0.3)];
        if (wSrodku(za, z)) return;                                                      // wyszedł z powrotem w tę samą zatokę
        if (!best || t * KARA(i) < best.k) best = { t, d, k: t * KARA(i) };
      });
      if (!best || best.t > 0.9 * gl + 4 * w) continue;
      lines.push({ pts: [[czubek[0] - best.d[0] * w, czubek[1] - best.d[1] * w], [czubek[0] + best.d[0] * (best.t + w), czubek[1] + best.d[1] * (best.t + w)]] });
      polwyspy++;
    }
  }
  return { lines, wyspy, polwyspy };
}
