// Podpis: sama linia cięcia (szczelina szerokości lasera), bez otworu.
//  • napis czcionką jednokreskową (Hershey Sans 1-stroke, EMS / Hershey – wolne do użytku),
//  • smok OGIMORA: sam obrys sylwetki z przerwami.
// Każda zamknięta pętla dostaje przerwę (mostek ≥ grubość blachy), więc nic nie wypada.
// Najmniejszy rozmiar: metal między dwiema sąsiednimi liniami cięcia ≥ mostek.
import { enclosed, dist, lineLength, grow, shapes, ringArea } from './silnik.js';
import { HERSHEY_SANS } from './vendor/hershey_sans.js';
import { RAW, VB } from './smok.js';

const KERF = 0.3;                                    // szerokość szczeliny do kontroli zamknięć [mm]
const CAP = 21;                                      // wysokość wielkiej litery w jednostkach czcionki

// ---------------------------------------------------------------- czcionka jednokreskowa
const parseD = d => d.split('M').filter(s => s.trim()).map(s => s.replace('L', ' ').trim().split(/\s+/).map(p => p.split(',').map(Number)));
const GL = {};
function glyph(ch) {
  if (GL[ch]) return GL[ch];
  const g = HERSHEY_SANS[ch.charCodeAt(0) - 33];
  if (!g) return null;
  let strokes = parseD(g.d);
  // kropki (i, j, ?, !, :) w czcionce to malutkie pętle – wycięte dałyby otworek; zamiast nich krótka kreska
  strokes = strokes.map(s => {
    const xs = s.map(q => q[0]), ys = s.map(q => q[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    if (s.length > 3 && w < 3 && h < 3 && dist(s[0], s[s.length - 1]) < 0.01) {
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      return [[cx, cy - 0.7], [cx, cy + 0.7]];
    }
    return s;
  });
  return (GL[ch] = { strokes, adv: 2 * g.o });
}
// polskie litery: litera bazowa + znak (współrzędne czcionki: y w dół, góra wielkich liter 1, linia pisma 22)
const PL = { 'ą': ['a', 'og'], 'ć': ['c', 'ac'], 'ę': ['e', 'og'], 'ł': ['l', 'sl'], 'ń': ['n', 'ac'], 'ó': ['o', 'ac'], 'ś': ['s', 'ac'], 'ź': ['z', 'ac'], 'ż': ['z', 'dt'],
  'Ą': ['A', 'og'], 'Ć': ['C', 'ac'], 'Ę': ['E', 'og'], 'Ł': ['L', 'sl'], 'Ń': ['N', 'ac'], 'Ó': ['O', 'ac'], 'Ś': ['S', 'ac'], 'Ź': ['Z', 'ac'], 'Ż': ['Z', 'dt'] };
function letter(ch) {
  const pl = PL[ch];
  if (!pl) return glyph(ch);
  const b = glyph(pl[0]); if (!b) return null;
  const up = pl[0] === pl[0].toUpperCase();
  const all = b.strokes.flat(), cx = (Math.min(...all.map(q => q[0])) + Math.max(...all.map(q => q[0]))) / 2;
  const top = up ? 1 : 8;
  const extra = [];
  if (pl[1] === 'ac') extra.push([[cx - 1, top - 2.5], [cx + 2, top - 5.5]]);
  if (pl[1] === 'dt') extra.push([[cx, top - 4.2], [cx, top - 2.8]]);
  if (pl[1] === 'sl') { const x0 = b.strokes[0][0][0]; extra.push(up ? [[x0 - 2.5, 14], [x0 + 4, 9]] : [[x0 - 2.5, 16], [x0 + 2.5, 11]]); }
  if (pl[1] === 'og') {
    const low = all.filter(q => q[1] >= 21.5).sort((p, q) => q[0] - p[0])[0] || [cx, 22];
    const x = up ? low[0] - 2 : low[0];
    extra.push([[x, 22], [x - 1.6, 24], [x - 1.6, 25.6], [x - 0.4, 26.6], [x + 1.4, 26.6]]);
  }
  return { strokes: [...b.strokes, ...extra], adv: b.adv };
}
/** Tekst → kreski w jednostkach czcionki (y w górę, linia pisma y = 0, środek tekstu x = 0). */
export function textStrokes(text, odstepU = 0) {
  const out = []; let x = 0;
  for (const ch of text) {
    const g = ch === ' ' ? null : letter(ch);
    if (!g) { x += 12 + odstepU; continue; }
    g.strokes.forEach(s => out.push(s.map(([a, b]) => [a + x, 22 - b])));
    x += g.adv + odstepU;
  }
  const total = x - odstepU;
  return { strokes: out.map(s => s.map(([a, b]) => [a - total / 2, b])), total };
}

// ---------------------------------------------------------------- geometria linii
function resample(pl, step) {
  const out = [pl[0]];
  for (let i = 1; i < pl.length; i++) {
    const a = pl[i - 1], b = pl[i], n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
const crosses = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };

/** Końce kresek bliżej niż tol od innej kreski – dociągnięte do niej (bez włosowatych mostków). */
export function snap(polys, tol) {
  const near = (p, k0, i0) => {
    let best = null;
    polys.forEach((pl, k) => { for (let i = 1; i < pl.length; i++) {
      if (k === k0 && Math.abs(i - i0) <= 2) continue;
      const a = pl[i - 1], b = pl[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
      const q = [a[0] + t * dx, a[1] + t * dy], d = dist(p, q);
      if (d > 1e-9 && d < tol && (!best || d < best.d)) best = { d, q };
    } });
    return best;
  };
  return polys.map((pl, k) => {
    const out = pl.slice();
    const s = near(pl[0], k, 0); if (s) out[0] = s.q;
    const e = near(pl[pl.length - 1], k, pl.length - 1); if (e) out[out.length - 1] = e.q;
    return out;
  });
}

/**
 * Najwęższy pas metalu między dwiema liniami cięcia (te same jednostki co linie).
 * Liczą się tylko „równoległe” sąsiedztwa: odcinek łączący jest prostopadły do obu linii, a po liniach
 * jest daleko (ratio × odległość) – styki i klinowe narożniki liter się nie liczą.
 */
export function minGap(polys, step, ratio = 2.2, perp = 0.12) {
  const P = [], adj = [], T = [];
  const S = polys.map(pl => resample(pl, step)), base = [];
  S.forEach(pl => { base.push(P.length); pl.forEach((q, i) => { P.push(q); adj.push([]); if (i) { const a = P.length - 2, b = P.length - 1, d = dist(P[a], P[b]); adj[a].push([b, d]); adj[b].push([a, d]); } }); });
  S.forEach((pl, k) => pl.forEach((q, i) => { const a = pl[Math.max(0, i - 1)], b = pl[Math.min(pl.length - 1, i + 1)], l = dist(a, b) || 1; T[base[k] + i] = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }));
  const link = (a, b) => { const d = dist(P[a], P[b]); adj[a].push([b, d]); adj[b].push([a, d]); };
  const segs = []; S.forEach((pl, k) => pl.forEach((q, i) => { if (i) segs.push([base[k] + i - 1, base[k] + i]); }));
  const tol = step * 0.3;
  for (let i = 0; i < segs.length; i++) for (let j = i + 2; j < segs.length; j++) {
    const [a, b] = segs[i], [c, d] = segs[j];
    if (b === c || a === d) continue;
    const A = P[a], B = P[b], C = P[c], D = P[d];
    if (Math.min(A[0], B[0]) > Math.max(C[0], D[0]) + tol || Math.min(C[0], D[0]) > Math.max(A[0], B[0]) + tol ||
        Math.min(A[1], B[1]) > Math.max(C[1], D[1]) + tol || Math.min(C[1], D[1]) > Math.max(A[1], B[1]) + tol) continue;
    if (crosses(A, B, C, D) || segDist(A, C, D) < tol || segDist(B, C, D) < tol || segDist(C, A, B) < tol || segDist(D, A, B) < tol) { link(a, c); link(a, d); link(b, c); link(b, d); }
  }
  let best = Infinity;
  const R = 40 * step;
  for (let s = 0; s < P.length; s++) {
    const g = new Map([[s, 0]]), todo = [[0, s]];
    while (todo.length) {
      let mi = 0; for (let i = 1; i < todo.length; i++) if (todo[i][0] < todo[mi][0]) mi = i;
      const [dd, u] = todo.splice(mi, 1)[0];
      if (dd > g.get(u)) continue; if (dd > R) break;
      for (const [v, w] of adj[u]) { const nd = dd + w; if (nd < (g.get(v) ?? Infinity)) { g.set(v, nd); todo.push([nd, v]); } }
    }
    for (let q = 0; q < P.length; q++) {
      if (q === s) continue;
      const d = dist(P[s], P[q]); if (d >= best || d < 1e-9) continue;
      if ((g.get(q) ?? Infinity) <= ratio * d + 2 * step) continue;
      const ux = (P[q][0] - P[s][0]) / d, uy = (P[q][1] - P[s][1]) / d;
      if (Math.abs(ux * T[s][0] + uy * T[s][1]) > perp || Math.abs(ux * T[q][0] + uy * T[q][1]) > perp) continue;
      best = d;
    }
  }
  return best;
}

/** Przerwa długości gap w linii pl na odcinku [s0, s1] (długość po linii) → 0–2 kawałki. */
function cutGap(pl, sMid, gap) {
  const cum = [0]; for (let i = 1; i < pl.length; i++) cum.push(cum[i - 1] + dist(pl[i - 1], pl[i]));
  const L = cum[cum.length - 1], a = sMid - gap / 2, b = sMid + gap / 2;
  const at = s => { let i = 1; while (i < pl.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [pl[i - 1][0] + (pl[i][0] - pl[i - 1][0]) * t, pl[i - 1][1] + (pl[i][1] - pl[i - 1][1]) * t]; };
  const out = [];
  if (a > 0.3) out.push([...pl.filter((q, i) => cum[i] < a), at(a)]);
  if (b < L - 0.3) out.push([at(b), ...pl.filter((q, i) => cum[i] > b)]);
  return out.filter(p => p.length > 1 && lineLength(p) > 0.5);
}
function inRing(p, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
const ringDist = (p, r) => { let m = Infinity; for (let i = 0; i < r.length; i++) m = Math.min(m, segDist(p, r[i], r[(i + 1) % r.length])); return m; };

/**
 * Bez wysp: każdy obszar zamknięty liniami cięcia dostaje przerwę (mostek) długości gap,
 * na kresce, która oddziela go od reszty blachy (po jej drugiej stronie nie ma innego zamknięcia).
 */
export function breakLoops(lines, gap) {
  let L = lines.map(l => resample(l, 0.5));
  for (let iter = 0; iter < 40; iter++) {
    const holes = enclosed(L, KERF);
    if (!holes.length) break;
    const H = holes[0];
    let best = null;
    L.forEach((pl, k) => {
      const cum = [0]; for (let i = 1; i < pl.length; i++) cum.push(cum[i - 1] + dist(pl[i - 1], pl[i]));
      let run = null;
      const flush = () => { if (run && run.len > 0) {
        const mid = (run.s0 + run.s1) / 2;
        // druga strona kreski w połowie przebiegu: blacha na zewnątrz (nie inne zamknięcie)?
        let i = 1; while (i < pl.length - 1 && cum[i] < mid) i++;
        const d = [pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]], dl = Math.hypot(d[0], d[1]) || 1, n = [-d[1] / dl, d[0] / dl];
        const o = KERF + 0.6, P1 = [pl[i][0] + n[0] * o, pl[i][1] + n[1] * o], P2 = [pl[i][0] - n[0] * o, pl[i][1] - n[1] * o];
        const other = inRing(P1, H) ? P2 : P1;
        const outside = !holes.some(h => inRing(other, h));
        const score = run.len + (outside ? 1e4 : 0);
        if (!best || score > best.score) best = { score, k, mid };
      } run = null; };
      for (let i = 0; i < pl.length; i++) {
        if (ringDist(pl[i], H) < KERF / 2 + 0.35) { if (!run) run = { s0: cum[i], s1: cum[i], len: 0 }; run.s1 = cum[i]; run.len = run.s1 - run.s0; }
        else flush();
      }
      flush();
    });
    if (!best) break;
    L = [...L.slice(0, best.k), ...cutGap(L[best.k], best.mid, gap), ...L.slice(best.k + 1)];
  }
  return L;
}

// ---------------------------------------------------------------- najmniejsze rozmiary
const gapCache = new Map();
/** Najwęższy pas metalu w napisie (jednostki czcionki). */
export function textGapU(text, odstepU) {
  const key = text + '|' + odstepU.toFixed(2);
  if (!gapCache.has(key)) {
    const s = snap(textStrokes(text, odstepU).strokes, 0.9);
    gapCache.set(key, s.length ? minGap(s, 0.5) : Infinity);
    if (gapCache.size > 200) gapCache.delete(gapCache.keys().next().value);
  }
  return gapCache.get(key);
}
/** Najmniejsza wysokość liter [mm], przy której metal między liniami ma ≥ w. */
export function podpisMin(text, odstep, w) {
  const g = textGapU(text || 'A', odstep * CAP);
  return Math.max(5, Math.ceil(3 * w), Math.ceil(CAP * w / Math.max(g, 0.5)));
}
export const smokLiniaMin = w => Math.ceil(22 * w);

// ---------------------------------------------------------------- smok jedną linią
// To ma zostać logo: sam obrys sylwetki (bez dodatkowych kresek). Uproszczenia tylko tam, gdzie metal
// między liniami byłby węższy niż s (wąskie szpice ścięte, wąskie szczeliny zalane). Pazury – dwa zaokrąglone kształty
// (łapa i łokieć bez przerw między pazurami), oko – mała kropka (jeśli mieści się z odstępem s).
const segD = (p, a, b) => segDist(p, a, b);
const ringsDist = (p, rings) => { let m = Infinity; for (const r of rings) for (let i = 0; i < r.length; i++) m = Math.min(m, segD(p, r[i], r[(i + 1) % r.length])); return m; };
const bbOf = r => { const xs = r.map(q => q[0]), ys = r.map(q => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
const oval = (cx, cy, rx, ry, n = 40) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos(i / n * 2 * Math.PI), cy + ry * Math.sin(i / n * 2 * Math.PI)]);
export function smokLines(paw, elbow, body, eye, s, przerwy) {
  const B = shapes(grow(grow(grow(grow([body], s / 2), -s / 2), -s / 2), s / 2)).map(x => x.outer)
    .sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)));
  const main = B[0];
  if (!main) return [];
  const others = [main];
  // pazury: same linie dolnej części łapy i łokcia (jak w logo, bez górnego obrysu) – otwarte, nic nie zamykają;
  // punkty bliżej niż s od reszty są pomijane
  const lower = (r, f) => {
    const ys = r.map(q => q[1]), y0 = Math.min(...ys), lim = y0 + f * (Math.max(...ys) - y0);
    const n = r.length, ok = r.map(q => q[1] < lim);
    const st = ok.findIndex(v => !v); if (st < 0) return [...r, r[0]];
    let best = [], cur = [];
    for (let m = 1; m <= n; m++) { const i = (st + m) % n; if (ok[i]) cur.push(r[i]); else { if (cur.length > best.length) best = cur; cur = []; } }
    return cur.length > best.length ? cur : best;
  };
  const claws = [];
  for (const [r, f] of [[paw, 0.62], [elbow, 0.62]]) {
    const pts = resample(lower(r, f), 0.25);
    const keep = pts.map(p => ringsDist(p, [main]) >= s && claws.every(c => c.every(q => dist(p, q) >= s)));
    let best = [], cur = [];
    pts.forEach((p, i) => { if (keep[i]) cur.push(p); else { if (lineLength(cur) > lineLength(best)) best = cur; cur = []; } });
    if (lineLength(cur) > lineLength(best)) best = cur;
    if (best.length > 1 && lineLength(best) > 2 * s) claws.push(best);
  }
  const loops = [];
  const eb = bbOf(eye), ec = [(eb.x0 + eb.x1) / 2, (eb.y0 + eb.y1) / 2];
  const rx = Math.max((eb.x1 - eb.x0) / 2, 0.6 * s), ry = Math.max((eb.y1 - eb.y0) / 2, 0.4 * s);
  if (ringsDist(ec, [main]) - rx >= s) loops.push(oval(ec[0], ec[1], rx, ry, 24));
  // obrys z przerwami (mostkami) w spokojnych miejscach logo (brzuch, zewnętrzny łuk ogona, dolna krawędź skrzydła) – nie na głowie
  const R = resample([...main, main[0]], 0.3).slice(0, -1), n = R.length;
  const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + dist(R[i - 1], R[i]));
  const L = cum[n - 1] + dist(R[n - 1], R[0]);
  const W = bbOf(body).x1 - bbOf(body).x0;
  const near = ([ax, ay]) => R.reduce((bi, p, i) => (Math.hypot(p[0] - ax * W, p[1] - ay * W) < Math.hypot(R[bi][0] - ax * W, R[bi][1] - ay * W) ? i : bi), 0);
  const centers = [[-0.12, -0.26], [-0.5, 0.02], [0.47, 0.08], [0.3, -0.15]].slice(0, Math.max(1, Math.min(4, przerwy))).map(near);
  const inGap = i => centers.some(c => { const d = Math.abs(cum[i] - cum[c]); return Math.min(d, L - d) < s / 2; });
  const start = R.findIndex((p, i) => inGap(i));
  const pieces = []; let cur = [];
  for (let m = 1; m <= n; m++) { const i = (start + m) % n; if (inGap(i)) { if (cur.length > 1) pieces.push(cur); cur = []; } else cur.push(R[i]); }
  if (cur.length > 1) pieces.push(cur);
  return [...pieces, ...claws, ...loops.map(o => [...o, o[0]])];
}

// ---------------------------------------------------------------- motywy
export const podpis = {
  id: 'podpis', nazwa: 'Podpis – napis', grupa: 'Podpis', linia: true,
  zrodlo: 'Sama linia cięcia, bez otworu. Czcionka jednokreskowa Hershey Sans. Litery z pętlą (O, A, B…) mają przerwę – nic nie wypada.',
  size: { def: 25, min: 6, max: 200 }, sizeLabel: 'Wys. liter',
  params: [
    { key: 'tekst', label: 'Tekst', text: true, def: 'OGIMORA' },
    { key: 'odstep', label: 'Odstęp liter', min: 0, max: 0.6, step: 0.01, def: 0.08 },
    { key: 'luk', label: 'Łuk', min: -180, max: 180, step: 1, def: 0, unit: '°' },
  ],
  minSize: (p, w) => podpisMin(p.tekst, p.odstep, w),
  make(p, size, w) {
    if (!p.tekst || !p.tekst.trim()) return { regions: [], cuts: [] };
    const k = size / CAP;
    const { strokes, total } = textStrokes(p.tekst, p.odstep * CAP);
    let L = snap(strokes, 0.9).map(s => resample(s, 0.6).map(([x, y]) => [x * k, y * k]));
    const arc = p.luk * Math.PI / 180, T = total * k, R = Math.abs(arc) > 0.01 ? T / Math.abs(arc) : 0;
    if (R) L = L.map(s => s.map(([x, y]) => arc > 0
      ? [(R + y) * Math.sin(x / R), (R + y) * Math.cos(x / R) - R]
      : [(R - y) * Math.sin(x / R), R - (R - y) * Math.cos(x / R)]));
    return { regions: [], cuts: L };
  },
};

export const podpisSmok = {
  id: 'podpisSmok', nazwa: 'Podpis – smok', grupa: 'Podpis', linia: true,
  zrodlo: 'Logo OGIMORA jako sama linia cięcia, bez otworu: obrys sylwetki, pazury samą linią (dół łapy i łokcia), oko jako kropka (gdy się mieści).',
  size: { def: 40, min: 15, max: 600 }, sizeLabel: 'Szerokość',
  params: [
    { key: 'przerwy', label: 'Mostki', min: 1, max: 4, step: 1, def: 2 },
  ],
  minSize: (p, w) => smokLiniaMin(w),
  make(p, size, w) {
    const k = size / VB.w;
    const tr = r => r.map(([x, y]) => [(x - VB.w / 2) * k, (VB.h / 2 - y) * k]);
    const [paw, elbow, body, eye] = RAW.map(tr);
    return { regions: [], cuts: smokLines(paw, elbow, body, eye, w, p.przerwy) };
  },
};
