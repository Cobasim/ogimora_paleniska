// „Ręczna robota”: kontrolowany chaos w rysunku motywu – tak, jakby wzór rzeźbił cieśla w belce.
// Zmiany są w RYSUNKU (przed budową otworów), więc silnik dalej pilnuje mostków i najmniejszych otworów.
//   ksztalt  – duże, płynne wygięcie całości: koło lekko jajowate, proste lekko łukowate,
//   drzenie  – drżenie ręki: drobne falowanie krawędzi (ok. 6 mm fali, do 1,5 mm),
//   grubosc  – nierówna grubość: żyłki miejscami grubsze, pola różnie podcięte (metal nigdy cieńszy niż mostek).
// seed – „rzut kośćmi”: inna wersja tej samej niedoskonałości.
import { grow } from './silnik.js';

export const HAND_DEF = { ksztalt: 0, drzenie: 0, grubosc: 0, seed: 1 };
export const handOn = h => !!h && (h.ksztalt > 0 || h.drzenie > 0 || h.grubosc > 0);

// ---------------------------------------------------------------- szum (gładki, powtarzalny dla seed)
function hash(ix, iy, s) {
  let h = (ix * 374761393 + iy * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1;     // −1…1
}
const fade = t => t * t * (3 - 2 * t);
function noise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = fade(x - ix), fy = fade(y - iy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm = (x, y, s) => noise(x, y, s) * 0.7 + noise(x * 2.1 + 5.3, y * 2.1 - 1.7, s + 101) * 0.3;
const rnd = (i, s) => (hash(i, 7, s) + 1) / 2;               // 0…1

// ---------------------------------------------------------------- pomocnicze
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function dense(pts, step, closed) {
  const out = [], n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n], k = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/**
 * Rysunek motywu z niedoskonałością ręki.
 * spec – { regions, lines, keep }; size – rozmiar motywu [mm]; w – mostek [mm].
 */
export function handSpec(spec, h, size, w) {
  if (!handOn(h)) return spec;
  const s = (h.seed | 0) || 1;
  const L1 = Math.max(20, 0.5 * size), A1 = h.ksztalt * 0.09 * size;           // wygięcie całości
  const L2 = 6, A2 = h.drzenie * Math.min(1.5, 0.02 * size + 0.3);              // drżenie ręki (mm)
  const step = Math.max(0.4, Math.min(A2 > 0 ? L2 / 4 : 99, A1 > 0 ? L1 / 12 : 99, size / 30));
  const warp = ([x, y]) => {
    let dx = 0, dy = 0;
    if (A1) { dx += A1 * fbm(x / L1, y / L1, s); dy += A1 * fbm(x / L1 + 31.7, y / L1 - 12.3, s + 7); }
    if (A2) { dx += A2 * noise(x / L2, y / L2, s + 13); dy += A2 * noise(x / L2 - 8.1, y / L2 + 4.4, s + 19); }
    return [x + dx, y + dy];
  };
  const R = r => dense(r, step, true).map(warp);
  let ri = 0;
  const regions = (spec.regions || []).map(reg => {
    const shrinkable = Array.isArray(reg) || reg.shrink !== false;
    let out = Array.isArray(reg) ? R(reg)
      : { ...reg, ...(reg.rings ? { rings: reg.rings.map(R) } : {}), ...(reg.parts ? { parts: reg.parts.map(R) } : {}), ...(reg.ring ? { ring: R(reg.ring) } : {}) };
    // nierówne podcięcie pól: każde pole o los. 0…0,6·mostek mniejsze → metal między polami raz szerszy, raz węższy (≥ mostek)
    let ins = shrinkable && h.grubosc > 0 ? h.grubosc * 0.6 * w * rnd(ri++, s + 3) : 0;
    if (ins > 0) {                                     // małe pola (kropki, ząbki) podcinane proporcjonalnie – nie mogą zniknąć
      for (const r of Array.isArray(reg) ? [reg] : (reg.rings || reg.parts || [reg.ring])) {   // najmniejszy kawałek pola decyduje
        const xs = r.map(q => q[0]), ys = r.map(q => q[1]);
        ins = Math.min(ins, 0.12 * Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
      }
    }
    if (ins > 0.05) {
      const rings = Array.isArray(out) ? [out] : out.parts ? null : out.rings || [out.ring];
      if (rings) {
        const g = grow(rings, -ins);
        if (g.length) out = Array.isArray(out) ? (g.length === 1 ? g[0] : { rings: g }) : { ...out, rings: g, ring: undefined };
      }
    }
    return out;
  });
  // żyłki: wygięte jak reszta, a przy „grubości” – dzielone na odcinki o różnej szerokości (≥ mostek)
  const lines = [];
  (spec.lines || []).forEach((ln, li) => {
    const pts = dense(ln.pts, step, !!ln.closed).map(warp);
    if (!(h.grubosc > 0) || pts.length < 3) { lines.push({ ...ln, pts }); return; }
    const chunk = Math.max(5, 2.5 * w);
    let cur = [pts[0]], len = 0, k = 0;
    const all = ln.closed ? [...pts, pts[0]] : pts;
    for (let i = 1; i < all.length; i++) {
      cur.push(all[i]); len += dist(all[i - 1], all[i]);
      if (len >= chunk || i === all.length - 1) {
        const f = (noise(k * 0.9, li * 3.1, s + 29) + 1) / 2;             // płynnie zmienna grubość wzdłuż żyłki
        lines.push({ pts: cur, closed: false, wk: 1 + h.grubosc * 0.4 * f });
        cur = [all[i]]; len = 0; k++;
      }
    }
  });
  const keep = (spec.keep || []).map(R);
  return { ...spec, regions, lines, keep };
}
