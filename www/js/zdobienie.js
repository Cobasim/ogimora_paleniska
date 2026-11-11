// Zdobienia elementów paleniska: motywy tatrzańskie, smok, napisy.
//
// STRONY. Każdy element oglądamy i rysujemy OD ZEWNĄTRZ (dno – od spodu):
//   • w edytorze wzorów – tak, jak zobaczy go ktoś stojący przy palenisku,
//   • w DXF – tak samo, z opisem „strona zewnetrzna do gory”: wierzch arkusza przy cięciu
//     (ładniejsza krawędź lasera) to strona zewnętrzna, a napis czyta się normalnie.
// Układ edytora E = (sx·x − ox, sy·y − oy) w mm: x w prawo, y w górę, początek w środku dołu elementu.
//
// Otwory zdobień trafiają do brył 3D, do DXF i do wyceny (osobna pozycja „Zdobienia”).
import { build as buildMotif, place, limitGaps, repair, grow, offsetRings, intersect, subtract, bounds, ringArea, ringLength, clipOpen, lineLength, band, cleanHoles, spikesIn, przerwyDlugich } from './zdobienia/silnik.js';
import { breakLoops } from './zdobienia/linia.js';
import { handSpec, handOn, HAND_DEF } from './zdobienia/reka.js';
export { HAND_DEF, handOn };
import { MOTYWY, byId, defaults } from './zdobienia/motywy.js';
import { tessellate, polygonArea, perimeter, STEEL_DENSITY } from './geometry.js';
import { CUT_RATES, MATERIALS } from './pricing.js';
import { wariant, wzor as wzorInfo } from './wzory_dane.js';
import { wzorParam } from './prac.js';

export { MOTYWY, byId, defaults };

// Każdy motyw można zmniejszyć do 1 cm (drobne szczegóły wtedy znikają – to zamierzone).
export const SIZE_MIN = 10;
MOTYWY.forEach(m => { if (!m.linia) m.size.min = SIZE_MIN; });   // podpis (sama linia cięcia) ma własne minimum
// Rozciągnięcie motywu w poziomie / pionie (kx, ky) – przed budową otworów, więc mostki zostają pełnej szerokości.
export const STRETCH = { min: 0.2, max: 5 };
const kOf = it => [it.kx || 1, it.ky || 1];
function stretchSpec(spec, kx, ky) {
  if (kx === 1 && ky === 1) return spec;
  const S = r => r.map(([x, y]) => [x * kx, y * ky]);
  const reg = r => Array.isArray(r) ? S(r)
    : { ...r, ...(r.rings ? { rings: r.rings.map(S) } : {}), ...(r.parts ? { parts: r.parts.map(S) } : {}), ...(r.ring ? { ring: S(r.ring) } : {}) };
  return { ...spec, regions: (spec.regions || []).map(reg), lines: (spec.lines || []).map(l => ({ ...l, pts: S(l.pts) })), keep: (spec.keep || []).map(S), ...(spec.cuts ? { cuts: spec.cuts.map(S) } : {}) };
}

// ---------------------------------------------------------------- reguły CNC
// Mostek ≥ grubość blachy (laser: najmniej 3 mm). Plazma: także otwór rośnie z grubością.
export const TECH = {
  // mostek nigdy cieńszy niż grubość blachy (cieńszy się przegrzewa i odkształca), najmniej 3 mm
  // ps – podpis (sama linia cięcia): najmniejszy pas metalu między liniami i przerwa w pętli
  // wzory: mostek 3 mm także w blasze 5 mm (decyzja 2026-11-04); grubsza blacha – 0,6·t
  laser:  { w: t => Math.max(3, 0.6 * t),  hole: () => 3,                    ps: t => Math.max(1.5, 0.5 * t), label: 'Laser' },
};
export const GAP_DEF = { on: false, max: 10, zakres: 100, fill: 'pionowe', angle: 0, obrys: false };
// wMin / holeMin: ręcznie ustawiony najmniejszy mostek / otwór [mm]; 0 = automatycznie z grubości blachy
export const DECOR_DEF = { tech: 'laser', margin: 15, wMin: 0, holeMin: 0, Lmax: 120, maxOtwor: 14, wypelnienie: 'pionowe', el: {} };
// maxOtwor: największy otwór [mm] (iskry, żar) – szersze miejsca dostają wypełnienie (0 = bez ograniczenia)
/** Elementy ścianki; ścianka powiązana ({link}) pokazuje elementy innej (kopia na żywo). */
export function itemsFor(decor, key) { let v = decor.el[key]; if (v && v.link && decor.el[v.link] && !decor.el[v.link].link) v = decor.el[v.link]; return (v && v.items) || []; }
// przerwy w długich szczelinach: co najwyżej Lmax mm szczeliny bez mostka (0 = wyłączone)

const NAMES = { 1: 'Bok przedni', 2: 'Bok prawy', 3: 'Bok tylny', 4: 'Bok lewy', 5: 'Dno' };
export const elName = key => NAMES[key] || `Stopka ${String(key).replace(/[AB]$/, '')}${/[AB]$/.test(key) ? ' · ' + key.slice(-1) : ''}`;

const sgn = v => (v < 0 ? -1 : 1);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const at = (s, x, y) => [s.o[0] + s.u[0] * x + s.v[0] * y, s.o[1] + s.u[1] * x + s.v[1] * y, s.o[2] + s.u[2] * x + s.v[2] * y];

/** Układ „od zewnątrz” bryły: sx, sy oraz przesunięcie (środek dołu = 0,0). */
function frameOf(s) {
  const ring = tessellate(s.outline, 8);
  let outward;
  if (s.kind === 'floor') outward = [0, 0, -1];
  else {
    let cx = 0, cy = 0; ring.forEach(([x, y]) => { const P = at(s, x, y); cx += P[0]; cy += P[1]; });
    outward = [cx, cy, 0];
  }
  const n = cross(s.u, s.v);
  const sy = s.kind === 'floor' ? 1 : sgn(s.v[2]);
  const sx = sy * sgn(dot(n, outward));
  const e = ring.map(([x, y]) => [sx * x, sy * y]);
  const b = bounds([e]);
  return { sx, sy, ox: (b.x0 + b.x1) / 2, oy: b.y0 };
}
export const toE = (f, [x, y]) => [f.sx * x - f.ox, f.sy * y - f.oy];
export const fromE = (f, [X, Y]) => [f.sx * (X + f.ox), f.sy * (Y + f.oy)];

/**
 * Elementy do zdobienia: [{ key, num, name, kind, t, frame, ring, keep, safe, area }]
 * ring – obrys w układzie E; safe – gdzie wolno ciąć (pierścienie E); keep – strefy zakazane (do kreskowania).
 */
export function elements(model, decor) {
  const p = model.params, g = p.gap, m = decor.margin;
  return model.solids.filter(s => s.key).map(s => {
    const f = frameOf(s);
    const ring = tessellate(s.outline, 10).map(q => toE(f, q));
    // przy łączeniach (ząbki, spaw, gięcie) – szerszy pas bez otworów
    const J = Math.max(m, 2 * s.t + g + 8);
    const bands = (s.joints || []).map(([a, b]) => {
      const A = toE(f, [a.x, a.y]), B = toE(f, [b.x, b.y]);
      const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * J, ny = dx / L * J;
      const ex = dx / L * J, ey = dy / L * J;
      return [[A[0] - ex + nx, A[1] - ey + ny], [B[0] + ex + nx, B[1] + ey + ny], [B[0] + ex - nx, B[1] + ey - ny], [A[0] - ex - nx, A[1] - ey - ny]];
    });
    const old = (s.holes || []).map(h => tessellate(h, 8).map(q => toE(f, q)));
    let safe = grow([ring], -m);
    const keepOut = [...bands, ...(old.length ? grow(old, m) : [])];
    if (keepOut.length) safe = subtract(safe, keepOut);
    const keep = subtract([ring], safe);
    const kind = s.kind;
    return { key: s.key, num: s.num, name: elName(s.key), kind, t: s.t, frame: f, ring, safe, keep, old,
      bb: bounds([ring]), sbb: bounds(safe.length ? safe : [ring]) };
  }).sort((a, b) => a.num - b.num || String(a.key).localeCompare(String(b.key)));
}

// ---------------------------------------------------------------- motywy → otwory (z pamięcią)
const cache = new Map();
function remember(key, fn) {
  if (!cache.has(key)) { cache.set(key, fn()); if (cache.size > 400) cache.delete(cache.keys().next().value); }
  return cache.get(key);
}
export function rules(decor, t) {
  const T = TECH[decor.tech] || TECH.laser;
  // ręczne ustawienie może tylko podnieść minimum – mostek nigdy nie będzie cieńszy niż blacha
  return { w: Math.max(T.w(t), decor.wMin || 0), hole: Math.max(T.hole(t), decor.holeMin || 0), ps: T.ps(t) };
}
/** Otwory jednego motywu w jego własnym układzie (przed ustawieniem na płycie). */
export function itemBase(it, R) {
  const m = byId(it.id);
  const [kx, ky] = kOf(it);
  const hand = !m.linia && handOn(it.hand) ? it.hand : null;            // ręczna robota (podpis – bez, ma pilnować minimum)
  const key = JSON.stringify(['b', it.id, it.size, kx, ky, it.p, R.w, R.hole, m.linia ? R.ps : 0, hand]);
  if (!cache.has(key)) {
    let spec;
    try { spec = m.make({ ...defaults(m), ...it.p }, it.size, m.linia ? R.ps : R.w); }
    catch (err) { console.warn('Motyw nie powstał:', it.id, it.size, err); spec = { regions: [] }; }
    if (spec.pending) return { holes: [], islands: [], lost: 0, pending: true, bb: bounds([[[0, 0]]]) };   // czcionka jeszcze się wczytuje – bez zapamiętania
    if (m.linia) return remember(key, () => {
      // podpis: same linie cięcia; każda pętla dostaje przerwę (mostek) – nic nie wypada
      const cuts = breakLoops(stretchSpec(spec, kx, ky).cuts || [], R.ps);
      return { holes: [], cuts, islands: [], lost: 0, small: it.size < m.minSize({ ...defaults(m), ...it.p }, R.ps) - 0.5,
        bb: bounds(cuts.length ? cuts : [[[0, 0]]]) };
    });
    return remember(key, () => buildBase(handSpec(stretchSpec(spec, kx, ky), hand, it.size, R.w), R, it.id !== 'napis'));
  }
  return cache.get(key);
}
function hull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function buildBase(spec, R, silOk = true) {
  let r;
  try { r = buildMotif(spec, { w: R.w, r: R.hole / 2 }); }
  catch (err) { console.warn('Budowa motywu nie powiodła się:', err); r = { holes: [], islands: [], lost: 1, fixed: 0, area: 0 }; }
  // Mały motyw: żyłki (linie z metalu, każda szeroka na mostek) potrafią zjeść całe pola.
  // Wtedy tniemy te same pola bez żyłek – znika szczegół, którego fizycznie nie da się wyciąć,
  // a kształt motywu zostaje (pola nadal rozdzielone mostkami).
  if (silOk && (spec.lines || []).length && r.lost > 0.3) {
    try {
      const r2 = buildMotif({ ...spec, lines: [] }, { w: R.w, r: R.hole / 2 });
      // bez żyłek nie może powstać sama „plamka” (np. rozeta → koło): kształt musi zostać rozpoznawalny
      const solid = r2.holes.reduce((a, h) => a + Math.abs(ringArea(h)), 0) / (r2.holes.reduce((a, h) => a + Math.abs(ringArea(hull(h))), 0) || 1);
      if (!r2.islands.length && r2.area > 1.5 * (r.area || 0) && (r2.holes.length >= 3 || solid < 0.8)) { r = r2; r.noLines = true; }
    } catch (err) { /* zostaje wersja z żyłkami */ }
  }
  r.bb = bounds(r.holes.length ? r.holes : [[[0, 0]]]);
  return r;
}
function itemGap(it, R, r, g, detectOnly) {
  return remember(JSON.stringify(['g', it.id, it.size, kOf(it), it.p, it.hand || 0, R.w, R.hole, g, detectOnly, !!r.pending]), () =>
    limitGaps(r.holes, { max: g.max, fill: g.fill, angle: g.angle, obrys: g.obrys, w: R.w, r: R.hole / 2, detectOnly,
      yMax: r.bb.y0 + r.bb.h * g.zakres / 100 }));
}
/** Otwory motywu ustawione na elemencie (układ E). */
export function itemPlaced(it, R) {
  const r = itemBase(it, R);
  const g = { ...GAP_DEF, ...(it.gap || {}) };
  let holes = r.holes, gapFixed = 0;
  if (g.on && holes.length) { const lg = itemGap(it, R, r, g, false); holes = lg.holes; gapFixed = lg.fixed; }
  return { holes: place(holes, it), cuts: r.cuts ? place(r.cuts, it) : [], small: r.small, islands: place([r.islands], it)[0] || [], lost: r.lost, gapFixed, pending: r.pending };
}
/** Miejsca szersze niż max (podgląd w zakładce Szczeliny). */
export function itemWide(it, R) {
  const r = itemBase(it, R), g = { ...GAP_DEF, ...(it.gap || {}) };
  if (!r.holes || !r.holes.length) return [];
  return place(itemGap(it, R, r, { max: g.max, zakres: 100 }, true).wide, it);
}

// ---------------------------------------------------------------- ścianka: napis (sam się ustawia), kropki, kompozycja
const ringA = r => Math.abs(ringArea(r));
const largest = rings => rings.reduce((a, q) => (ringA(q) > ringA(a) ? q : a), rings[0]);
/** Szerokość i środek strefy cięcia w pasie y0…y1. */
function span(rings, y0, y1) {
  const s = bounds(rings), q = intersect(rings, [[[s.x0 - 1, y0], [s.x1 + 1, y0], [s.x1 + 1, y1], [s.x0 - 1, y1]]]);
  if (!q.length) return { w: 0, cx: (s.x0 + s.x1) / 2 };
  // najwęższe miejsce pasa (trapez): przekrój na górze i na dole
  const at = y => { const r = intersect(rings, [[[s.x0 - 1, y - 0.5], [s.x1 + 1, y - 0.5], [s.x1 + 1, y + 0.5], [s.x0 - 1, y + 0.5]]]); return r.length ? bounds(r) : null; };
  const a = at(y0 + 1), b = at(y1 - 1);
  if (!a || !b) { const B = bounds(q); return { w: B.w, cx: (B.x0 + B.x1) / 2 }; }
  const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1);
  return { w: Math.max(0, x1 - x0), cx: (x0 + x1) / 2 };
}
/** Napis z „poz” (góra / dół / środek): położenie i wielkość dobierane do ścianki; zwraca też zajęty pas. */
function napisPoz(el, it0, R) {
  const big = el.safe.length ? [largest(el.safe)] : [el.ring];      // główne pole ścianki (bez kawałków przy stopkach)
  const s = bounds(big), pad = Math.max(2 * R.w, 6);
  let it = { ...it0, rot: 0, mirror: false };
  for (let k = 0; k < 3; k++) {
    const b = itemBase(it, R);
    if (b.pending || !b.holes.length) return { it: { ...it, x: (s.x0 + s.x1) / 2, y: s.y0 + pad }, pas: null };
    const bb = b.bb;
    const y = it.poz === 'góra' ? s.y1 - pad - bb.y1 : it.poz === 'środek' ? (s.y0 + s.y1) / 2 - (bb.y0 + bb.y1) / 2 : s.y0 + pad - bb.y0;
    const sp = span(big, y + bb.y0 - 1, y + bb.y1 + 1);
    const room = sp.w - 2 * pad;
    if (bb.w > room + 0.5 && k < 2 && room > 0) { it = { ...it, size: Math.max(10, Math.floor(it.size * room / bb.w * 0.98)) }; continue; }
    it = { ...it, x: Math.round((sp.cx - (bb.x0 + bb.x1) / 2) * 10) / 10, y: Math.round(y * 10) / 10 };
    const pas = it.poz === 'środek' ? null : { y0: y + bb.y0, y1: y + bb.y1, poz: it.poz };
    return { it, pas };
  }
  return { it, pas: null };
}
/** Pole robocze kompozycji: strefa cięcia bez pasów napisów, uproszczona do wypukłego wielokąta. */
function poleKompozycji(el, pasy, R) {
  if (!el.safe.length) return null;
  let rings = el.safe;
  const s = el.sbb, odst = Math.max(3 * R.w, 0.035 * s.h);
  for (const p of pasy) {
    const cut = p.poz === 'góra' ? [[s.x0 - 1, p.y0 - odst], [s.x1 + 1, p.y0 - odst], [s.x1 + 1, s.y1 + 1], [s.x0 - 1, s.y1 + 1]]
      : [[s.x0 - 1, s.y0 - 1], [s.x1 + 1, s.y0 - 1], [s.x1 + 1, p.y1 + odst], [s.x0 - 1, p.y1 + odst]];
    rings = subtract(rings, [cut]);
    if (!rings.length) return null;
  }
  return trapezW(rings);
}
/** Zapas, gdy trapez się nie mieści (skośne stopki): największy prostokąt wokół środka ciężkości. */
function prostokatW(rings) {
  const big = largest(rings); if (!big || ringA(big) < 200) return null;
  const inside = ([x, y]) => wStrefie([x, y], [big]), bb = bounds([big]);
  let best = null;
  for (let gx = 1; gx < 8; gx++) for (let gy = 1; gy < 8; gy++) {
  const cx = bb.x0 + bb.w * gx / 8, cy = bb.y0 + bb.h * gy / 8;
  if (!inside([cx, cy])) continue;
  for (const asp of [0.6, 1, 1.6]) {
    let lo = 0, hi = 2000;
    for (let k = 0; k < 22; k++) {
      const m = (lo + hi) / 2, w = m * Math.sqrt(asp), hgt = m / Math.sqrt(asp);
      const pts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push([cx - w / 2 + w * t, cy - hgt / 2], [cx - w / 2 + w * t, cy + hgt / 2], [cx - w / 2, cy - hgt / 2 + hgt * t], [cx + w / 2, cy - hgt / 2 + hgt * t]); }
      if (pts.every(inside)) lo = m; else hi = m;
    }
    const w = lo * Math.sqrt(asp), hgt = lo / Math.sqrt(asp);
    if (!best || Math.min(w, hgt) > best.a) best = { a: Math.min(w, hgt), P: [[cx - w / 2, cy - hgt / 2], [cx + w / 2, cy - hgt / 2], [cx + w / 2, cy + hgt / 2], [cx - w / 2, cy + hgt / 2]] };
  } }
  return best && best.a > 10 ? best.P : null;
}
/** Największy trapez (dół i góra poziome) wpisany w strefę – kompozytor potrzebuje wielokąta wypukłego. */
function trapezW(rings) {
  const big = largest(rings);
  if (!big || ringA(big) < 400) return null;
  rings = [big];
  const s = bounds(rings), N = 48;
  const strip = (x0, y0, x1, y1) => { const q = intersect(rings, [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]]); return q.length ? bounds(q) : null; };
  let ya = -Infinity, yb = Infinity;
  for (let i = 0; i <= 12; i++) {                    // kolumny w środkowej części: dół i góra
    const x = s.x0 + s.w * (0.25 + 0.5 * i / 12), B = strip(x - 0.4, s.y0 - 1, x + 0.4, s.y1 + 1);
    if (B) { ya = Math.max(ya, B.y0); yb = Math.min(yb, B.y1); }
  }
  if (!(yb - ya > 20)) return null;
  const Lp = [], Rp = [];
  for (let i = 0; i <= N; i++) {
    const y = ya + 0.5 + (yb - ya - 1) * i / N, B = strip(s.x0 - 1, y - 0.4, s.x1 + 1, y + 0.4);
    if (B) { Lp.push([B.x0, y]); Rp.push([B.x1, y]); }
  }
  if (Lp.length < 3) return null;
  // bok: prosta x = m·y + c po właściwej stronie wszystkich próbek, najbliżej nich (para próbek)
  const bok = (P, sg) => {
    let best = null;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const m = (P[j][0] - P[i][0]) / (P[j][1] - P[i][1]), c = P[i][0] - m * P[i][1];
      let ok = true, cost = 0;
      for (const [x, y] of P) { const d = sg * (m * y + c - x); if (d < -1e-6) { ok = false; break; } cost += d; }
      if (ok && (!best || cost < best.cost)) best = { m, c, cost };
    }
    return best || { m: 0, c: sg > 0 ? Math.max(...P.map(q => q[0])) : Math.min(...P.map(q => q[0])) };
  };
  const L = bok(Lp, 1), R = bok(Rp, -1), y0 = ya + 0.5, y1 = yb - 0.5;
  const X = (l, y) => l.m * y + l.c;
  if (X(R, y0) - X(L, y0) < 20 || X(R, y1) - X(L, y1) < 2) return null;
  return [[X(L, y0) + 0.5, y0], [X(R, y0) - 0.5, y0], [X(R, y1) - 0.5, y1], [X(L, y1) + 0.5, y1]];
}
/** Dno: kropki na ściekanie wody (domyślnie 4 × Ø5 mm wokół środka). */
function kropki(el, it, R) {
  const s = el.sbb, d = Math.max(it.d || 5, R.hole), n = it.n || 4;
  const a = Math.min(s.w, s.h) * (it.rozstaw ?? 0.2), cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
  const pts = n === 1 ? [[cx, cy]] : n === 4 ? [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [cx + x * a, cy + y * a])
    : Array.from({ length: n }, (_, i) => [cx + a * Math.cos(2 * Math.PI * i / n + Math.PI / 4), cy + a * Math.sin(2 * Math.PI * i / n + Math.PI / 4)]);
  return pts.map(([x, y]) => Array.from({ length: 24 }, (_, i) => [x + d / 2 * Math.cos(-2 * Math.PI * i / 24), y + d / 2 * Math.sin(-2 * Math.PI * i / 24)]).reverse());
}

/** Czy punkt leży w strefie cięcia (parzystość przecięć po wszystkich pierścieniach). */
function wStrefie([x, y], rings) {
  let a = false;
  for (const P of rings) for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) a = !a; }
  return a;
}
// ---------------------------------------------------------------- elementy edytora 2 (dowolne położenie)
// Położenie zapisane względem POLA ścianki (największy trapez w strefie cięcia): u, v ∈ −1…1 (środek = 0),
// s = wysokość elementu / wysokość pola. Zmiana wymiarów paleniska → elementy przesuwają się i rosną razem z polem,
// a wzór liczy się od nowa w nowej wielkości (gęstnieje, nie rozciąga się).
const poleCache = new Map();
export function pole(el) {
  const k = JSON.stringify([el.key, el.sbb, el.safe.length, el.ring.length]);
  if (!poleCache.has(k)) {
    const poly = el.safe.length ? (trapezW(el.safe) || prostokatW(el.safe)) : null;
    const b = poly ? bounds([poly]) : el.sbb;
    poleCache.set(k, { poly, x0: b.x0, y0: b.y0, w: b.w, h: b.h, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 });
    if (poleCache.size > 60) poleCache.delete(poleCache.keys().next().value);
  }
  return poleCache.get(k);
}
export const NOWE = ['wzor', 'napisE', 'brzeg', 'kropki'];
// ---------------------------------------------------------------- brzeg: drobny wzór wzdłuż obrysu (z wcięciami)
export const BRZEGI = ['linia', 'linia podwójna', 'kropki', 'kropki 2', 'ząbki', 'kreski', 'romby', 'recica', 'liście'];
export const KONCE = ['brak', 'koło', 'romb', 'krzyż', 'rozetka', 'liść'];
const brzegCache = new Map();
/** Uproszczenie pierścienia (Douglas–Peucker, zamknięty). */
function upr(ring, tol) {
  const P = ring, n = P.length; if (n < 5) return P;
  let far = 0, fd = -1; P.forEach((q, i) => { const d = Math.hypot(q[0] - P[0][0], q[1] - P[0][1]); if (d > fd) { fd = d; far = i; } });
  const dp = (pts) => { if (pts.length < 3) return pts; const A = pts[0], B = pts[pts.length - 1], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1e-9;
    let mi = -1, md = tol; for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / L; if (d > md) { md = d; mi = i; } }
    return mi < 0 ? [A, B] : [...dp(pts.slice(0, mi + 1)).slice(0, -1), ...dp(pts.slice(mi))]; };
  const a = dp(P.slice(0, far + 1)), b = dp([...P.slice(far), P[0]]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
/** Łańcuszek drobnych otworów wzdłuż brzegu strefy cięcia – idzie po wcięciach i skosach ścianki. */
function brzeg(el, it, R) {
  const p = { typ: 'kropki', wlk: 1, gest: 1, odsun: 0, ...(it.p || {}) };
  const key = JSON.stringify([el.key, el.sbb, el.safe.length, p, R.w, R.hole]);
  if (brzegCache.has(key)) return brzegCache.get(key);
  const big = el.safe.length ? largest(el.safe) : null;
  if (!big) return [];
  const d = Math.max(R.hole * 1.6, 2.2 * R.w) * p.wlk;              // wielkość drobinki
  const boki = { gora: true, dol: true, lewa: true, prawa: true, ...(p.boki || {}) };
  const bok = (nx, ny) => boki[ny < -0.7 ? 'gora' : ny > 0.7 ? 'dol' : nx > 0 ? 'lewa' : 'prawa'];   // normalna do środka
  if (p.typ === 'linia' || p.typ === 'linia podwójna') {
    // szczelina wzdłuż obrysu z mostkami (co „co” mm, mostek „most” mm) – długa szczelina osłabia płytę w ogniu
    const out = [], sw = Math.max(R.hole, 1.2 * R.w) * p.wlk, gap = Math.max(R.w, p.most ?? Math.max(R.w * 1.4, 4)), co = Math.max(20, p.co ?? 100);
    for (let k = 0; k < (p.typ === 'linia' ? 1 : 2); k++) {
      const off = sw / 2 + R.w + p.odsun * 12 + k * (sw + R.w * 1.5);
      const ring = offsetRings([ringArea(big) > 0 ? big : big.slice().reverse()], -off).reduce((a, q) => (ringA(q) > ringA(a || [[0, 0]]) ? q : a), null);
      if (!ring) continue;
      // ring uproszczony – zaokrąglone narożniki zwijają się do jednego wierzchołka
      const Q = upr(ring, 1.2), ccw = ringArea(Q) > 0, P = Q.concat([Q[0]]), cum = [0];
      for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const L = cum[cum.length - 1];
      const at = t => { t = ((t % L) + L) % L; let i = 1; while (i < cum.length - 1 && cum[i] < t) i++; const a = P[i - 1], b = P[i], f = (t - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
      // narożniki (zakręt > 25°) – tam linia zostaje ciągła; mostki rozkładane równo w środku każdego odcinka
      const n0 = Q.length, rogi = [];
      for (let i = 0; i < n0; i++) {
        const A = Q[(i - 1 + n0) % n0], B = Q[i], C = Q[(i + 1) % n0];
        const a1 = Math.atan2(B[1] - A[1], B[0] - A[0]), a2 = Math.atan2(C[1] - B[1], C[0] - B[0]);
        let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
        if (d > 25 * Math.PI / 180) rogi.push(cum[i]);
      }
      const odc = [];                                     // odcinki między narożnikami [t0, t1]
      if (!rogi.length) odc.push([0, L]);
      else rogi.forEach((t, i) => { const t1 = i + 1 < rogi.length ? rogi[i + 1] : rogi[0] + L; odc.push([t, t1]); });
      const strona = (t0, t1) => { const m0 = at((t0 + t1) / 2 - 1), m1 = at((t0 + t1) / 2 + 1), tl = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) || 1, tx = (m1[0] - m0[0]) / tl, ty = (m1[1] - m0[1]) / tl; return bok(ccw ? -ty : ty, ccw ? tx : -tx); };
      let mosty = [];
      for (const [t0, t1] of odc) { const Lr = t1 - t0, nb = Math.floor(Lr / co); for (let j = 1; j <= nb; j++) mosty.push(t0 + Lr * j / (nb + 1) + (k ? Lr / (nb + 1) / 2 : 0)); }
      if (mosty.length < 2) {                              // pętla dookoła = środek by wypadł: co najmniej 2 mostki (na najdłuższych odcinkach)
        const dl = [...odc].sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
        for (const [t0, t1] of dl) { if (mosty.length >= 2) break; mosty.push((t0 + t1) / 2); }
        if (mosty.length < 2) mosty.push(mosty[0] + L / 2);
      }
      mosty = mosty.map(t => ((t % L) + L) % L).sort((x, y) => x - y);
      // linie między mostkami, przerwane na wyłączonych bokach
      for (let j = 0; j < mosty.length; j++) {
        const t0 = mosty[j] + gap / 2, t1 = (j + 1 < mosty.length ? mosty[j + 1] : mosty[0] + L) - gap / 2;
        if (t1 - t0 < 2) continue;
        // punkty: początek, wierzchołki pomiędzy (narożniki dokładnie), koniec
        const pts = [t0];
        for (let i = 1; i < cum.length - 1; i++) for (const c of [cum[i], cum[i] + L]) if (c > t0 && c < t1) pts.push(c);
        pts.push(t1); pts.sort((x, y) => x - y);
        let line = [];
        const zapisz = () => { if (line.length > 1) out.push(...band(line, sw, true)); line = []; };
        for (let i = 0; i < pts.length - 1; i++) {
          if (!strona(pts[i], pts[i + 1])) { zapisz(); continue; }
          if (!line.length) line.push(at(pts[i]));
          line.push(at(pts[i + 1]));
        }
        zapisz();
      }
    }
    brzegCache.set(key, out);
    return out;
  }
  // ---- drobinki wzdłuż obrysu: rozkładane osobno na każdym boku (między narożnikami), pierwsza i ostatnia
  // zawsze w narożnikach / na końcach boku – zmiana gęstości dokłada i zabiera tylko te w środku.
  const rzedy = p.typ === 'kropki 2' ? 2 : 1, out = [];
  const nr = Math.max(0, Math.min(1, p.niereg || 0)), los = rng(7 + Math.round((p.ziarno || 0) * 97));
  const szer = p.szer ?? 1;
  const krokBaza = p.typ === 'kreski' ? 1.9 : p.typ === 'liście' ? 0.95 : p.typ === 'recica' ? 0.85 : 1;
  for (let k = 0; k < rzedy; k++) {
    const off = d / 2 + R.w * 0.6 + p.odsun * d * 2 + k * (d + R.w * 1.2) + (p.typ === 'liście' ? d * 0.35 : 0);
    const ring0 = offsetRings([ringArea(big) > 0 ? big : big.slice().reverse()], -off).reduce((a, q) => (ringA(q) > ringA(a || [[0, 0]]) ? q : a), null);
    if (!ring0 || ring0.length < 3) continue;
    const Q = upr(ring0, 1.2), ccw = ringArea(Q) > 0, P = Q.concat([Q[0]]), cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[cum.length - 1];
    const at = t => { t = ((t % L) + L) % L; let i = 1; while (i < cum.length - 1 && cum[i] < t) i++; const a = P[i - 1], b = P[i], f = (t - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / tl, ty = (b[1] - a[1]) / tl; return { c: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], tx, ty, nx: ccw ? -ty : ty, ny: ccw ? tx : -tx }; };
    // narożniki (zakręt > 25°) dzielą obrys na boki
    const n0 = Q.length, rogi = [];
    for (let i = 0; i < n0; i++) {
      const A = Q[(i - 1 + n0) % n0], B = Q[i], C = Q[(i + 1) % n0];
      let dd = Math.abs(Math.atan2(C[1] - B[1], C[0] - B[0]) - Math.atan2(B[1] - A[1], B[0] - A[0])); if (dd > Math.PI) dd = 2 * Math.PI - dd;
      if (dd > 25 * Math.PI / 180) rogi.push(cum[i]);
    }
    const odc = !rogi.length ? [[0, L, true]] : rogi.map((t, i) => [t, i + 1 < rogi.length ? rogi[i + 1] : rogi[0] + L, false]);
    const krok = (d + R.w * 1.3) * krokBaza / p.gest;
    const stawiane = [];
    const wolne = (c, r) => !stawiane.some(q => Math.hypot(q[0] - c[0], q[1] - c[1]) < r);
    const postaw = (A, sh, odst) => { if (!wolne(A.c, odst)) return; stawiane.push(A.c); if (ringArea(sh) < 0) sh.reverse(); out.push(sh); };
    const ksztalt = (A, j, skala = 1, obrot = 0) => {
      const h = d / 2 * skala, ca = Math.cos(obrot), sa = Math.sin(obrot);
      const tx = A.tx * ca - A.ty * sa, ty = A.tx * sa + A.ty * ca, nx = ccw ? -ty : ty, ny = ccw ? tx : -tx, c = A.c;
      const M = pts => pts.map(([u, v]) => [c[0] + (tx * u + nx * v) * h, c[1] + (ty * u + ny * v) * h]);
      if (p.typ === 'ząbki') return M([[-1, 0], [1, 0], [0, 1.3]]);
      if (p.typ === 'kreski') return M([[-1.4, -0.32], [1.4, -0.32], [1.4, 0.32], [-1.4, 0.32]]);
      if (p.typ === 'romby') return M([[1, 0], [0, 0.6], [-1, 0], [0, -0.6]]);
      if (p.typ === 'recica') { const a = 0.32 * szer, sk = 0.55; return M([[-a - sk, -1], [a - sk, -1], [a + sk, 1], [-a + sk, 1]]); }   // skośne nacięcia jak w otoku rozety
      if (p.typ === 'liście') {                                     // liście na przemian po obu stronach (bez gałązki)
        const st = j % 2 ? 1 : -1, ang = st * 0.75, wl = 0.42 * szer, dl = 1.25;
        const c2 = Math.cos(ang), s2 = Math.sin(ang), o = st * 0.55;
        const pts = []; for (let q = 0; q <= 16; q++) { const u = -dl + 2 * dl * q / 16, w0 = wl * Math.sin(Math.PI * q / 16) * (1 - 0.25 * q / 16); pts.push([u, w0]); }
        for (let q = 15; q > 0; q--) { const u = -dl + 2 * dl * q / 16, w0 = wl * Math.sin(Math.PI * q / 16) * (1 - 0.25 * q / 16); pts.push([u, -w0]); }
        return M(pts.map(([u, v]) => [u * c2 - v * s2 + (st > 0 ? 0.3 : -0.3), u * s2 + v * c2 + o]));
      }
      return Array.from({ length: 14 }, (_, q) => [c[0] + h * Math.cos(q * Math.PI / 7), c[1] + h * Math.sin(q * Math.PI / 7)]);
    };
    // zakończenia boków (w narożnikach / na końcach): osobny kształt, nieco większy
    const konc = p.konce || 'brak', capR = d * 0.8 * (konc === 'rozetka' ? 1.25 : 1);
    const cap = (A, kier) => {
      if (konc === 'brak') return false;
      const h = capR, c = A.c, tx = A.tx, ty = A.ty, nx = A.nx, ny = A.ny;
      const M = pts => pts.map(([u, v]) => [c[0] + (tx * u + nx * v) * h, c[1] + (ty * u + ny * v) * h]);
      let shs;
      if (konc === 'koło') shs = [Array.from({ length: 18 }, (_, q) => [c[0] + h * Math.cos(q * Math.PI / 9), c[1] + h * Math.sin(q * Math.PI / 9)])];
      else if (konc === 'romb') shs = [M([[1.15, 0], [0, 0.75], [-1.15, 0], [0, -0.75]])];
      else if (konc === 'krzyż') { const a = Math.max(0.3, (R.hole * 0.55) / h); shs = [M([[-a, -1.15], [a, -1.15], [a, -a], [1.15, -a], [1.15, a], [a, a], [a, 1.15], [-a, 1.15], [-a, a], [-1.15, a], [-1.15, -a], [-a, -a]])]; }
      else if (konc === 'rozetka') {                                   // 4 płatki z mostkami między nimi
        shs = []; const pl = 0.5, r0 = Math.max(R.w * 0.55 / h, 0.18);
        for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a), pts = [];
          for (let z = 0; z <= 12; z++) { const t = z / 12, rr = r0 + (1.1 - r0) * t, w0 = pl * Math.sin(Math.PI * t) * 0.9; pts.push([rr, w0]); }
          for (let z = 11; z > 0; z--) { const t = z / 12, rr = r0 + (1.1 - r0) * t, w0 = pl * Math.sin(Math.PI * t) * 0.9; pts.push([rr, -w0]); }
          shs.push(M(pts.map(([u, v]) => [u * ca - v * sa, u * sa + v * ca]))); }
      } else if (konc === 'liść') {                                    // liść ukośny, stopką do środka boku
        const pts = []; for (let q = 0; q <= 16; q++) { const u = -1.2 + 2.4 * q / 16; pts.push([u, 0.5 * Math.sin(Math.PI * q / 16)]); }
        for (let q = 15; q > 0; q--) { const u = -1.2 + 2.4 * q / 16; pts.push([u, -0.5 * Math.sin(Math.PI * q / 16)]); }
        const a = kier * Math.PI / 4; shs = [M(pts.map(([u, v]) => [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a) + 0.15]))];
      }
      if (!wolne(c, capR * 1.2)) return true;
      stawiane.push(c); shs.forEach(sh => { if (ringArea(sh) < 0) sh.reverse(); out.push(sh); });
      return true;
    };
    for (const [t0, t1, petla] of odc) {
      const Lr = t1 - t0, sr = at((t0 + t1) / 2);
      if (!bok(sr.nx, sr.ny)) continue;
      // końce boku: pierwszy i ostatni element stoją w narożnikach (przesunięte o pół kroku przy zakończeniach)
      const zak = konc !== 'brak' && !petla, m0 = zak ? capR * 1.1 + d * 0.6 : 0;
      if (zak) { cap(at(t0 + 0.01), 1); cap(at(t1 - 0.01), -1); }
      const a0 = t0 + m0, a1 = t1 - m0, Lu = a1 - a0;
      if (Lu < d * 0.5) continue;
      const n = petla ? Math.max(3, Math.round(Lu / krok)) : Math.max(1, Math.round(Lu / krok));
      const ile = petla ? n : n + 1;
      for (let j = 0; j < ile; j++) {
        const kraniec = !petla && (j === 0 || j === ile - 1);
        let t = a0 + Lu * j / n + (k && !kraniec ? Lu / n / 2 : 0);
        if (k && j === ile - 1 && !petla) continue;
        // nieregularność: przesunięcie wzdłuż, wielkość, obrót (krańce zostają na swoim miejscu)
        let skala = 1, obrot = 0;
        if (nr && !kraniec) { t += (los() - 0.5) * 0.45 * nr * Lu / n; skala = 1 + (los() - 0.5) * 0.5 * nr; obrot = (los() - 0.5) * 0.5 * nr; }
        if (nr && kraniec) { skala = 1 + (los() - 0.5) * 0.3 * nr; }
        skala = Math.max(skala, R.hole * 1.05 / d);
        const A = at(t);
        postaw(A, ksztalt(A, j, skala, obrot), krok * 0.7 * Math.min(1, skala));
      }
    }
  }
  brzegCache.set(key, out); if (brzegCache.size > 80) brzegCache.delete(brzegCache.keys().next().value);
  return out;
}
/** Prosty powtarzalny los (ta sama nieregularność przy każdym przeliczeniu). */
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }

// ---------------------------------------------------------------- wypełnienie paskami / negatyw (dowolny element)
const fillCache = new Map();
export const FILL_DEF = { typ: '', kier: 'poziome', neg: false, pas: 4, szcz: 4, min: 0 };
function wypelnij(holes, f0, R, key, syl = null) {
  if (fillCache.has(key)) return fillCache.get(key);
  const f = { ...FILL_DEF, ...f0 }, pw = Math.max(R.w, f.pas), gap = Math.max(R.hole, f.szcz), T = pw + gap;
  const b = bounds(syl || holes), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, Lh = Math.hypot(b.w, b.h) / 2 + 20;
  const a = f.kier === 'pionowe' ? Math.PI / 2 : f.kier === 'ukośne' ? Math.PI / 4 : 0;
  const u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]], bars = [];
  for (let k = -Math.ceil(Lh / T); k <= Math.ceil(Lh / T); k++) {
    const o = k * T + gap / 2, P = (s, t) => [cx + u[0] * s + n[0] * t, cy + u[1] * s + n[1] * t];
    bars.push([P(-Lh, o), P(Lh, o), P(Lh, o + pw), P(-Lh, o + pw)]);
  }
  let pole = holes;
  if (syl) {
    // wnętrze sylwetki odsunięte od linii cięcia o mostek; oko zostaje, jeśli nie wpada w wycięcie
    const wn = grow(syl.map(q => ringArea(q) > 0 ? q : q.slice().reverse()), -(R.w + R.hole / 2));
    let out = (f.neg ? intersect(wn, bars) : subtract(wn, bars)).filter(q => ringA(q) > R.hole * R.hole * 0.8);
    if (!out.length) out = [];
    const oko = holes.length ? subtract(holes, grow(out, R.w)) : [];
    out = [...out, ...oko];
    fillCache.set(key, out); if (fillCache.size > 60) fillCache.delete(fillCache.keys().next().value);
    return out;
  }
  if (f.neg) {
    // negatyw: tło (obrys wzoru powiększony o margines) wycięte paskami, rysunek zostaje z metalu
    const m = Math.max(2 * R.w, pw + gap);
    const obrys = grow([hullRing(holes.flat())], m);
    pole = subtract(obrys, holes.map(h => (ringArea(h) > 0 ? h : h.slice().reverse())));
  }
  // paski tylko na otworach szerszych niż f.min (np. duże łezki rozety tak, wąski otok nie)
  let male = [];
  if (!f.neg && f.min > 0) {
    const duzy = h => offsetRings([ringArea(h) > 0 ? h : h.slice().reverse()], -f.min / 2).length > 0;
    male = holes.filter(h => !duzy(h)); pole = holes.filter(duzy);
  }
  let out = [...(pole.length ? subtract(pole, bars).filter(q => ringA(q) > R.hole * R.hole * 0.8) : []), ...male];
  if (!out.length) out = holes;                 // za mały na paski – zostaje sam rysunek (nie znika)
  fillCache.set(key, out); if (fillCache.size > 60) fillCache.delete(fillCache.keys().next().value);
  return out;
}
function hullRing(pts) { const H = hull(pts); return ringArea(H) > 0 ? H : H.reverse(); }

/** Ocena sztywności ścianki w ogniu: ile metalu wycięto i jak długie są szczeliny bez podparcia. */
function sztywnosc(el, holes, przerw, najdl, Lmax = 0) {
  const A = el.safe.reduce((a, q) => a + ringA(q), 0) || 1;
  const cut = holes.reduce((a, q) => a + ringA(q), 0), proc = cut / A;
  const t = el.t || 3, lim = t >= 5 ? [0.32, 0.45] : t >= 4 ? [0.28, 0.4] : [0.24, 0.36];
  let ocena = proc < lim[0] ? 'dobra' : proc < lim[1] ? 'średnia' : 'słaba';
  if (!Lmax && najdl > 200 && ocena === 'dobra') ocena = 'średnia';
  return { proc, przerw, najdl, ocena };
}
/** Gdzie stoi element (układ E): środek x, y, wysokość H [mm], obrót [°], lustro. */
export function polozenie(el, it) {
  const F = pole(el);
  return { x: F.cx + (it.u || 0) * F.w / 2, y: F.cy + (it.v || 0) * F.h / 2, H: Math.max(5, (it.s || 0.3) * F.h), rot: it.rot || 0, mir: !!it.mir };
}
/** Przekształcenie: skala k, lustro, obrót, przesunięcie. */
export function ustaw(rings, { x, y, rot = 0, mir = false, k = 1 }) {
  const a = rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  return rings.map(r => { const q = r.map(([px, py]) => { const X = (mir ? -px : px) * k, Y = py * k; return [x + X * c - Y * sn, y + X * sn + Y * c]; }); return mir ? q.reverse() : q; });
}
/** Element w swoim układzie (wyśrodkowany, wysokość H): { holes, cuts, H, pending, stale }. */
export function baza(el, it, R) {
  const L = polozenie(el, it);
  if (it.id === 'wzor') {
    const W = it.p && wzorInfo(it.w);
    if (W && W.gen && Object.keys(it.p).length) {                   // zmienione ustawienia – liczone w wątku
      const r = wzorParam(W.gen, { ...W.p, ...it.p }, W.Hc, L.H, R, it.uid);
      return { ...r, k: r.k || 1, H: L.H };
    }
    const r = wariant(it.w, L.H); return { ...r, H: L.H };
  }
  if (it.id === 'napisE') {
    const b = itemBase({ id: 'napis', size: L.H, p: { ...it.p } }, R);
    if (b.pending) return { holes: [], cuts: [], H: L.H, pending: true };
    const cx = (b.bb.x0 + b.bb.x1) / 2, cy = (b.bb.y0 + b.bb.y1) / 2;
    return { holes: b.holes.map(h => h.map(([x, y]) => [x - cx, y - cy])), cuts: [], H: L.H, k: 1 };
  }
  return { holes: [], cuts: [], H: L.H, k: 1 };
}
/** Otwory elementu na ściance (E). */
export function elementPlaced(el, it, R) {
  if (it.id === 'brzeg') return { holes: brzeg(el, it, R), cuts: [], pending: false };
  if (it.id === 'kropki') return { holes: kropki(el, it, R), cuts: [], pending: false };
  const L = polozenie(el, it), b = baza(el, it, R), k = b.k || 1;
  // wypełnienie paskami (albo negatyw) – w układzie elementu, więc obraca się razem z nim
  let loc = ustaw(b.holes, { x: 0, y: 0, rot: 0, mir: !!it.mir, k });
  // logo-podpis (same linie cięcia): paski wypełniają wnętrze sylwetki, linia cięcia zostaje
  const syl = b.syl && b.syl.length && (b.cuts || []).length ? ustaw(b.syl, { x: 0, y: 0, rot: 0, mir: !!it.mir, k }) : null;
  if (it.fill && it.fill.typ && (loc.length || syl)) loc = wypelnij(loc, it.fill, R, JSON.stringify([it.w, it.p, L.H, it.mir, it.fill, R.w, !!syl, loc.length, loc[0] && loc[0][0], loc.reduce((a, q) => a + q.length, 0)]), syl);
  const lb = loc.length ? bounds(loc) : null;
  return { holes: ustaw(loc, { ...L, mir: false, k: 1 }), cuts: ustaw(b.cuts || [], { ...L, k }), lb, pending: b.pending, maly: b.maly, duze: b.duze, upr: !!(b.v && b.v.upr), minH: b.v && b.maly ? b.v.bh : 0, L, k };
}

/**
 * Otwory ścianki (edytor 3): elementy wycinane DOKŁADNIE tak, jak przyszły z pracowni – bez poprawiania.
 * Sprawdzane: wyjście poza strefę cięcia (przycięte), kolizje między elementami (zgłaszane na czerwono),
 * sztywność. Kolejność listy = rysowanie od góry; ukryte (off) pomijane.
 * Zwraca { holes, cuts, kolizje (pierścienie), per: [{ n, poza, kolizja, maly, duze }], pending, sztywnosc }.
 */
// ---------------------------------------------------------------- małe otwory (mniejsze niż grubość blachy)
// Problemem przy cięciu są SAMODZIELNE małe otworki (przebicie + najazd nie mają miejsca, żużel, stożek).
// Długie wąskie linie i zwężenia szerszych kształtów są w porządku – ich nie liczymy.
/** Próg [mm]: ręczny (decor.minOtw) albo grubość blachy elementu. */
export const limitMale = (decor, t) => decor && decor.minOtw > 0 ? decor.minOtw : t;
const dodatni = h => (ringArea(h) > 0 ? h : h.slice().reverse());
/** Mały otwór: cały węższy niż lim i krótszy niż 2·lim (kropka, oczko, krótka kreska). */
const maleMemo = new Map();
export function malyOtwor(h, lim) {
  const b = bounds([h]); if (Math.max(b.w, b.h) >= 2 * lim) return false;
  // pamięć po kształcie (pole, obwód, liczba punktów – niezależne od położenia i obrotu): kropki się powtarzają
  const k = `${h.length}|${ringA(h).toFixed(2)}|${ringLength(h).toFixed(2)}|${lim}`;
  let v = maleMemo.get(k);
  if (v === undefined) { v = offsetRings([dodatni(h)], -lim / 2).length === 0; maleMemo.set(k, v); if (maleMemo.size > 20000) maleMemo.clear(); }
  return v;
}
/** Powiększenie małego otworu tak, by miał co najmniej lim szerokości (kształt zachowany, zaokrąglony). */
function powieksz(h, lim) {
  let lo = 0, hi = lim;
  for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (offsetRings([dodatni(h)], -m / 2).length) lo = m; else hi = m; }
  const g = grow([dodatni(h)], (lim - lo) / 2 + 0.05);
  return g.length ? g : [h];
}
/** Kawałki otworu przyciętego strefą cięcia węższe niż najmniejszy otwór – do wyrzucenia (okruchy). */
const okruch = (h, R) => offsetRings([dodatni(h)], -R.hole * 0.45).length === 0;

export function elementHoles(el, items, decor) {
  const R = rules(decor, el.t);
  const lim = limitMale(decor, el.t);
  const sig = JSON.stringify(['e3', el.key, el.safe.length, el.sbb, items, R, lim]);
  if (cache.has(sig)) return cache.get(sig);
  let pending = false;
  const per = [], acc = [], cuts = [], kolizje = [], bylo = [], male = [];
  items.forEach((it, idx) => {
    if (it.off || !NOWE.includes(it.id)) { per[idx] = { n: 0, off: !!it.off }; return; }
    const P = elementPlaced(el, it, R);
    pending ||= !!P.pending;
    let h = P.holes, poza = false;
    if (h.length) {
      const out = h.map(q => q.some(p => !wStrefie(p, el.safe)));
      if (out.some(Boolean)) { poza = true; h = [...h.filter((_, i) => !out[i]), ...intersect(h.filter((_, i) => out[i]), el.safe).filter(q => !okruch(q, R))]; }
    }
    // okruchy (węższe niż najmniejszy otwór lasera, np. szczeliny między stykającymi się płatkami albo resztki po paskach) – zawsze precz
    if (h.length) h = h.filter(q => !okruch(q, R));
    // małe otwory: liczone, a na życzenie powiększane albo usuwane (it.male)
    let nMale = 0;
    if (h.length) {
      const m = h.map(q => malyOtwor(q, lim)); nMale = m.filter(Boolean).length;
      if (nMale && it.male === 'usun') h = h.filter((_, i) => !m[i]);
      else if (nMale && it.male === 'powieksz') h = h.flatMap((q, i) => (m[i] ? powieksz(q, lim) : [q]));
      else h.forEach((q, i) => { if (m[i]) male.push(q); });
    }
    let c = P.cuts || [];
    if (c.length) c = clipOpen(c, el.safe, true).filter(l => lineLength(l) > 0.8);
    // kolizja: za blisko (mniej niż mostek) otworów elementów wyżej na liście
    let kol = false;
    if (h.length && bylo.length) {
      const hb = bounds(h);
      for (const B of bylo) {
        if (hb.x0 > B.b.x1 + R.w || B.b.x0 > hb.x1 + R.w || hb.y0 > B.b.y1 + R.w || B.b.y0 > hb.y1 + R.w) continue;
        // każdy otwór osobno (suma zrośniętych otworów miałaby „dziury”, które intersect by wypełnił)
        for (const q of B.h) {
          const qb = bounds([q]);
          if (hb.x0 > qb.x1 + R.w || qb.x0 > hb.x1 + R.w || hb.y0 > qb.y1 + R.w || qb.y0 > hb.y1 + R.w) continue;
          // tylko otwory tego elementu w pobliżu q (bez tego: każdy z każdym)
          const hn = h.filter(z => { const zb = bounds([z]); return !(zb.x0 > qb.x1 + R.w || qb.x0 > zb.x1 + R.w || zb.y0 > qb.y1 + R.w || qb.y0 > zb.y1 + R.w); });
          if (!hn.length) continue;
          const x = intersect(grow([q], R.w * 0.98), hn);
          if (x.length && x.some(z => ringA(z) > 0.5)) { kol = true; kolizje.push(...x); }
        }
      }
    }
    if (h.length) bylo.push({ h, b: bounds(h) });
    acc.push(...h); cuts.push(...c);
    per[idx] = { n: h.length + c.length, male: nMale, poza, kolizja: kol, maly: !!P.maly, minH: P.minH || 0, upr: !!P.upr, duze: P.duze || 0 };
  });
  // wyspy: kawałek metalu otoczony cięciem ze wszystkich stron wypadnie po wycięciu
  let wyspy = [];
  if (acc.length) {
    const metal = subtract([el.ring], acc.map(h => (ringArea(h) > 0 ? h : h.slice().reverse())));
    const zew = metal.filter(q => ringArea(q) > 0).sort((p, q) => ringA(q) - ringA(p));
    wyspy = zew.slice(1).filter(q => ringA(q) > 1);
  }
  const res = { holes: acc, cuts, islands: wyspy.map(q => { const b = bounds([q]); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; }), wyspy, kolizje, per, male, lim, pending, clean: false, sztywnosc: sztywnosc(el, acc, 0, 0) };
  if (!pending) remember(sig, () => res);
  return res;
}

// ---------------------------------------------------------------- uproszczenie konturów
// Bez punktów bliższych niż ~0,1 mm i bez punktów na prostej (Douglas–Peucker, tol w mm):
// mniejszy DXF, płynniejsza praca maszyny i bez „okruchów” w siatce 3D.
function simplify(ring, tol) {
  const pts = [];
  ring.forEach(q => { const l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.1) pts.push(q); });
  if (pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.1) pts.pop();
  if (pts.length < 5) return pts;
  // zamknięty: dzielimy w punkcie najdalszym od pierwszego
  let far = 0, fd = -1;
  pts.forEach((q, i) => { const d = Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]); if (d > fd) { fd = d; far = i; } });
  const dp = (a, b) => {
    const A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1e-9;
    let mi = -1, md = tol;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / L; if (d > md) { md = d; mi = i; } }
    return mi < 0 ? [A] : [...dp(a, mi), ...dp(mi, b)];
  };
  pts.push(pts[0]);
  const out = [...dp(0, far), ...dp(far, pts.length - 1)];
  return out;
}

/** Uproszczenie otwartej linii (Douglas–Peucker). */
function simplifyOpen(pts, tol) {
  if (pts.length < 3) return pts;
  const dp = (a, b) => {
    const A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1e-9;
    let mi = -1, md = tol;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / L; if (d > md) { md = d; mi = i; } }
    return mi < 0 ? [A] : [...dp(a, mi), ...dp(mi, b)];
  };
  return [...dp(0, pts.length - 1), pts[pts.length - 1]];
}
const openLength = l => { let s = 0; for (let i = 1; i < l.length; i++) s += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y); return s; };

// ---------------------------------------------------------------- model ze zdobieniami
const toOutline = ring => ring.map(([x, y]) => ({ x, y }));
const mirrorPt = (q, sx, sy) => ({ x: sx * q.x, y: sy * q.y, b: q.b ? q.b * sx * sy : undefined });

/**
 * Model ze zdobieniami: otwory w bryłach 3D, części rozdzielone według zdobień,
 * każda część w DXF widziana od zewnątrz, nowe statystyki.
 * Zwraca { model, extra: { cut, pierces, byKey }, issues }.
 */
/** Ścianka gotowa do bryły i DXF (otwory oczyszczone, w układzie płyty) – pamiętana, liczona osobno (także w tle). */
const scCache = new Map();
export function przygotujSciane(el, decor) {
  const items = itemsFor(decor, el.key);
  if (!items.length) return null;
  const r = elementHoles(el, items, decor);
  if (r.pending) return przygotujSciane0(el, items, r);
  const key = JSON.stringify([el.key, el.frame, el.safe.length, el.sbb, items, rules(decor, el.t), limitMale(decor, el.t)]);
  if (scCache.has(key)) return { ...scCache.get(key), el };
  const d = przygotujSciane0(el, items, r);
  scCache.set(key, d); if (scCache.size > 40) scCache.delete(scCache.keys().next().value);
  return d;
}
function przygotujSciane0(el, items, r) {
  if (!r.holes.length && !(r.cuts || []).length) return null;
  // czyszczenie: bez „igieł” i szczelin węższych niż 0,2 mm (z łączenia motywów potrafiła zostać kreska w otworze)
  const holesE = r.clean ? r.holes : cleanHoles(r.holes);
  const local = holesE.map(h => simplify(h.map(q => fromE(el.frame, q)), 0.03)).filter(h => h.length > 2);
  const lines = (r.cuts || []).map(l => simplifyOpen(l.map(q => fromE(el.frame, q)), 0.02)).filter(l => l.length > 1);
  // kontrola gotowych konturów (to, co pójdzie do DXF): linia cięcia nie może zawracać w miejscu
  const spikes = local.reduce((n, h) => n + spikesIn(h).length, 0);
  const maleL = (r.male || []).map(h => toOutline(h.map(q => fromE(el.frame, q))));
  return { el, holesE, local, lines, maleL, lim: r.lim, islands: r.islands, spikes, sig: JSON.stringify(items),
    cut: holesE.reduce((s, h) => s + ringLength(h), 0) + lines.reduce((s, l) => s + lineLength(l), 0), n: holesE.length + lines.length };
}
export function decorate(base, decor) {
  const els = elements(base, decor);
  const byKey = {};
  for (const el of els) { const d = przygotujSciane(el, decor); if (d) byKey[el.key] = d; }
  const frames = Object.fromEntries(els.map(e => [e.key, e.frame]));
  // bryły 3D
  const solids = base.solids.map(s => {
    const d = s.key && byKey[s.key];
    return d ? { ...s, holes: [...(s.holes || []), ...d.local.map(toOutline)], signLines: d.lines, male: d.maleL } : s;
  });
  // części do cięcia: rozdzielone, gdy kopie mają różne zdobienia; każda widziana od zewnątrz
  const parts = [];
  for (const pt of base.parts) {
    const copies = pt.copies || [[]];
    const groups = new Map();
    copies.forEach(members => {
      const sig = members.map(m => (byKey[m.key] ? byKey[m.key].sig : '')).join('|');
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(members);
    });
    const split = groups.size > 1;
    for (const [sig, list] of groups) {
      const members = list[0];
      // każda grupa widziana od zewnątrz według swojego pierwszego elementu
      // (np. stopki gięte w różnych narożnikach są lustrzane względem rysunku części)
      const f = frames[members[0] && members[0].key] || { sx: 1, sy: 1 };
      const mir = q => mirrorPt(q, f.sx, f.sy);
      const extraHoles = [], extraLines = [], extraMale = [];
      members.forEach(m => {
        const d = byKey[m.key]; if (!d) return;
        d.local.forEach(h => extraHoles.push(toOutline(h).map(q => (m.map ? m.map(q) : q))));
        d.lines.forEach(l => extraLines.push(toOutline(l).map(q => (m.map ? m.map(q) : q))));
        d.maleL.forEach(h => extraMale.push(h.map(q => (m.map ? m.map(q) : q))));
      });
      const keys = list.map(ms => ms.map(m => m.key).join('+'));
      const holes = [...(pt.holes || []), ...extraHoles];
      parts.push({
        ...pt,
        code: extraHoles.length || extraLines.length ? `${pt.code}_${keys.join("_")}` : pt.code,
        qty: list.length,
        keys,
        decorated: extraHoles.length + extraLines.length > 0,
        decorCut: extraHoles.reduce((s, h) => s + perimeter(h), 0) + extraLines.reduce((s, l) => s + openLength(l), 0),
        decorPierces: extraHoles.length + extraLines.length,
        outline: pt.outline.map(mir),
        holes: holes.map(h => h.map(mir)),
        lines: extraLines.map(l => l.map(mir)),
        male: extraMale.map(h => h.map(mir)),               // linie cięcia bez otworu (podpis) – otwarte
        folds: (pt.folds || []).map(([a, b]) => [mir(a), mir(b)]),
        side: 'zewn',
      });
    }
  }
  // statystyki
  let mass = 0, area = 0, cut = 0, pierces = 0;
  parts.forEach(pt => {
    const A = polygonArea(pt.outline) - (pt.holes || []).reduce((s, h) => s + polygonArea(h), 0);
    const P = perimeter(pt.outline) + (pt.holes || []).reduce((s, h) => s + perimeter(h), 0) + (pt.lines || []).reduce((s, l) => s + openLength(l), 0);
    pt.area = A; pt.perimeter = P; pt.pierces = 1 + (pt.holes || []).length + (pt.lines || []).length;
    area += A * pt.qty; cut += P * pt.qty; mass += A * pt.t * STEEL_DENSITY * pt.qty; pierces += pt.pierces * pt.qty;
  });
  const extra = { cut: 0, pierces: 0, byKey };
  parts.forEach(pt => { extra.cut += pt.decorCut * pt.qty; extra.pierces += pt.decorPierces * pt.qty; });
  const issues = Object.values(byKey).filter(d => d.islands.length).map(d => `${d.el.name}: ${d.islands.length} wysp w zdobieniu – metal by wypadł`);
  for (const d of Object.values(byKey)) if (d.spikes) issues.push(`${d.el.name}: ${d.spikes} ${d.spikes === 1 ? 'ostra „igła”' : 'ostrych „igieł”'} w konturze wzoru – zgłoś (błąd generatora)`);
  const model = { ...base, solids, parts, stats: { ...base.stats, mass, area, cut, pierces }, warnings: [...base.warnings, ...issues], decorated: Object.keys(byKey).length > 0,
    male: { n: parts.reduce((a, pt) => a + (pt.male || []).length * pt.qty, 0), lims: [...new Set(Object.values(byKey).map(d => d.lim))].sort((a, b) => a - b), reczny: decor.minOtw > 0 ? decor.minOtw : 0 } };
  return { model, extra, els };
}

/** Koszt cięcia zdobień (netto, zł): długość × stawka za metr + przebicia, wg grubości części. */
export function decorCost(model, material) {
  const mat = MATERIALS[material];
  let cut = 0, pierce = 0, len = 0, n = 0;
  for (const p of model.parts) {
    if (!p.decorated) continue;
    const [perM, perPierce] = CUT_RATES[p.t];
    cut += p.decorCut / 1000 * perM * mat.cutFactor * p.qty;
    pierce += p.decorPierces * perPierce * p.qty;
    len += p.decorCut * p.qty; n += p.decorPierces * p.qty;
  }
  return { cost: cut + pierce, cut, pierce, len, n };
}
