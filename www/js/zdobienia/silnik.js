// Silnik motywów do wycinania w blasze (laser / plazma).
//
// Zasada: motyw to RYSUNEK, a nie gotowe otwory.
//   • regions – obszary, które mają zostać wycięte (płatki, promienie, pętle…),
//   • lines   – linie, które w tych obszarach ZOSTAJĄ z metalu (żyłki, sznurki, żebra).
// Silnik sam dokłada mostki: każdy obszar jest zwężany o pół mostka (więc między dwoma
// sąsiednimi obszarami zostaje pas metalu o szerokości mostka), a każda linia dostaje
// grubość mostka. Mostki są więc zawsze częścią rysunku, a nie dorobioną kreską.
// Na koniec: zaokrąglenie naroży otworów (r) i usunięcie otworów węższych niż 2r,
// wykrycie „wysp” (metalu, który by wypadł) i kontrola odstępów.
//
// Jednostki: mm, oś y w górę. Pierścień = tablica [x, y].
import ClipperLib from './vendor/clipper.mjs';

const S = 1000;                       // skala całkowitoliczbowa Clippera (0,001 mm)
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- prymitywy rysunku
export const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** liczba odcinków dla łuku: cięciwa ~0,6 mm, minimum 8 */
function segs(r, sweep) { return Math.max(8, Math.ceil(Math.abs(sweep) * r / 1.2)); }

export function arc(c, r, a0, a1, n) {
  n = n || segs(r, a1 - a0);
  const out = [];
  for (let i = 0; i <= n; i++) out.push(add(c, P(r, a0 + (a1 - a0) * i / n)));
  return out;
}
export function circle(c, r) { const a = arc(c, r, 0, TAU); a.pop(); return a; }

/** Łuk przez punkty A i B, wybrzuszony o strzałkę h (h>0 w lewo patrząc z A do B). */
export function arcAB(A, B, h) {
  const c = dist(A, B);
  if (Math.abs(h) < 1e-9) return [A, B];
  const R = (c * c / 4 + h * h) / (2 * Math.abs(h));
  const M = lerp(A, B, 0.5);
  const d = sub(B, A); const nL = [-d[1] / c, d[0] / c];       // normalna w lewo
  const sgn = Math.sign(h);
  const C = add(M, mul(nL, -sgn * (R - Math.abs(h))));
  let a0 = Math.atan2(A[1] - C[1], A[0] - C[0]);
  let a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
  // wybieramy łuk przechodzący przez wierzchołek strzałki
  const top = add(M, mul(nL, h));
  const at = Math.atan2(top[1] - C[1], top[0] - C[0]);
  const norm = x => ((x % TAU) + TAU) % TAU;
  const ccw = norm(at - a0) < norm(a1 - a0);
  if (ccw) { if (a1 < a0) a1 += TAU; } else { if (a1 > a0) a1 -= TAU; }
  return arc(C, R, a0, a1);
}

/** Soczewka (płatek) między A i B; h = strzałka każdego z dwóch łuków. */
export function lens(A, B, h) {
  const r1 = arcAB(A, B, h), r2 = arcAB(B, A, h);
  return r1.slice(0, -1).concat(r2.slice(0, -1));
}

/** Krzywa Béziera 3. stopnia. */
export function bezier(p0, p1, p2, p3, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Gładka krzywa (Catmull-Rom) przez punkty; closed = krzywa zamknięta. */
export function spline(pts, closed = false, per = 16) {
  const n = pts.length, out = [];
  const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t +
        (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

export const rot = (pts, a) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
export const mirrorX = pts => pts.map(([x, y]) => [-x, y]).reverse();
export const shift = (pts, d) => pts.map(p => add(p, d));
export const scale = (pts, s) => pts.map(p => mul(p, s));
/** n kopii obróconych wokół (0,0) */
export const radial = (pts, n, a0 = 0) => Array.from({ length: n }, (_, i) => rot(pts, a0 + i * TAU / n));

/** Linia o zmiennej szerokości (np. „przecinek”, róg parzenicy) jako obszar. */
export function taper(center, wFn) {
  const L = [], R = [], n = center.length;
  for (let i = 0; i < n; i++) {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)];
    const d = sub(b, a), l = Math.hypot(d[0], d[1]) || 1;
    const nn = [-d[1] / l, d[0] / l], w = wFn(i / (n - 1)) / 2;
    L.push(add(center[i], mul(nn, w))); R.push(add(center[i], mul(nn, -w)));
  }
  return L.concat(R.reverse());
}

// ---------------------------------------------------------------- Clipper: konwersje
const toC = ring => ring.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
const fromC = path => path.map(p => [p.X / S, p.Y / S]);

// Dokładność łuków przy odsuwaniu (mm). 0,04 = jakość pliku DXF; podgląd może użyć większej (szybciej).
let ARC_TOL = 0.04;
export function setArcTolerance(mm) { const old = ARC_TOL; ARC_TOL = mm; return old; }
function offset(paths, delta, endType = ClipperLib.EndType.etClosedPolygon, join = ClipperLib.JoinType.jtRound) {
  const co = new ClipperLib.ClipperOffset(2, ARC_TOL * S);
  co.AddPaths(paths, join, endType);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * S);
  return out;
}
function boolOp(type, subj, clip, tree = false) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  if (clip && clip.length) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out = tree ? new ClipperLib.PolyTree() : new ClipperLib.Paths();
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}
const union = (a, b) => boolOp(ClipperLib.ClipType.ctUnion, a, b || []);
const bbC = paths => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; paths.forEach(p => p.forEach(q => { if (q.X < x0) x0 = q.X; if (q.Y < y0) y0 = q.Y; if (q.X > x1) x1 = q.X; if (q.Y > y1) y1 = q.Y; })); return [x0, y0, x1, y1]; };
const diff = (a, b) => boolOp(ClipperLib.ClipType.ctDifference, a, b);
const inter = (a, b) => boolOp(ClipperLib.ClipType.ctIntersection, a, b);
const areaC = paths => paths.reduce((s, p) => s + ClipperLib.Clipper.Area(p), 0) / (S * S);

/** Pas o szerokości w wzdłuż linii (obszar). round = zaokrąglone końce. */
/** Pogrubienie (d>0) lub zwężenie (d<0) obszaru złożonego z pierścieni. */
export function grow(rings, d) {
  return offset(union(rings.map(r => { const q = toC(r); return ClipperLib.Clipper.Orientation(q) ? q : q.reverse(); })), d).map(fromC);
}
/** Różnica obszarów A − B (listy pierścieni; orientacja dowolna dla prostych kształtów). */
export function subtract(A, B) {
  const norm = r => { const q = toC(r); return ClipperLib.Clipper.Orientation(q) ? q : q.reverse(); };
  if (!B.length) return A;
  return diff(A.map(toC), union(B.map(norm))).map(fromC);
}
/** Suma kształtów → lista pierścieni (zewnętrzne kontury). */
export function merge(rings) {
  return union(rings.map(r => { const q = toC(r); return ClipperLib.Clipper.Orientation(q) ? q : q.reverse(); })).map(fromC);
}

/** Zwraca listę pierścieni jednego obszaru (z ewentualnymi dziurami) – używać jako {rings}. */
export function band(line, w, round = false, closed = false) {
  const et = closed ? ClipperLib.EndType.etClosedLine
    : round ? ClipperLib.EndType.etOpenRound : ClipperLib.EndType.etOpenButt;
  return offset([toC(line)], w / 2, et).map(fromC);
}

// ---------------------------------------------------------------- sznur skręcony w pętelki
/** Krzywa przepróbkowana co ~step mm, z wektorami stycznymi i normalnymi. */
export function resample(line, step = 0.8) {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + dist(line[i - 1], line[i]));
  const L = cum[cum.length - 1], n = Math.max(2, Math.ceil(L / step));
  const out = [];
  let j = 1;
  for (let k = 0; k <= n; k++) {
    const s = L * k / n;
    while (j < line.length - 1 && cum[j] < s) j++;
    const t = (s - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    const pnt = lerp(line[j - 1], line[j], t);
    const d = sub(line[j], line[j - 1]), l = Math.hypot(d[0], d[1]) || 1;
    out.push({ p: pnt, t: [d[0] / l, d[1] / l], n: [-d[1] / l, d[0] / l], s: k / n });
  }
  return { pts: out, L };
}

/**
 * Sznur ułożony w pętelki wzdłuż krzywej (jak przyszyty gruby sznurek, który skręca się
 * w kolejne pętle). loops – liczba pętelek; b0, b1 – promień pierwszej i ostatniej pętelki;
 * side = 1 / -1 – w którą stronę obracają się pętelki. Zwraca ścieżkę (do interlace).
 */
export function coil(spine, loops, b0, b1, side = 1) {
  const { pts } = resample(spine, 0.6);
  const out = [];
  for (const q of pts) {
    const ph = 2 * Math.PI * loops * q.s;
    const b = b0 + (b1 - b0) * q.s;
    const ramp = Math.min(1, q.s * loops * 4, (1 - q.s) * loops * 4);   // łagodny początek i koniec
    const dx = -b * Math.sin(ph) * ramp, dy = side * b * (1 - Math.cos(ph)) * ramp;
    out.push([q.p[0] + q.t[0] * dx + q.n[0] * dy, q.p[1] + q.t[1] * dx + q.n[1] * dy]);
  }
  return out;
}

// ---------------------------------------------------------------- przeplot (sznur)
/**
 * Sznur, który sam się krzyżuje, wycięty jako szczelina. Na każdym skrzyżowaniu pasmo
 * „spodnie” jest przerwane (jak w plecionce), dzięki czemu wnętrza pętli zostają
 * połączone z resztą blachy. To jest mostek, który wygląda jak przeplot sznurka.
 * Zwraca listę obszarów (bez zwężania – szerokość sznura = cw).
 */
export function interlace(path, cw, w, closed = true) {
  return interlaceMany([{ pts: path, closed }], cw, w);
}

/**
 * Kilka sznurów naraz: przeplot liczony także tam, gdzie sznury krzyżują się ze sobą
 * (np. piętra pętli parzenicy zachodzą na siebie). paths = [{pts, closed}].
 */
export function interlaceMany(paths, cw, w) {
  const P = paths.map(({ pts: path, closed }) => {
    const pts = closed ? path.concat([path[0]]) : path.slice();
    const n = pts.length - 1, cum = [0];
    for (let i = 0; i < n; i++) cum.push(cum[i] + dist(pts[i], pts[i + 1]));
    const at = s => { const L = cum[n]; s = closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s)); let i = 1; while (i < n && cum[i] < s) i++; const t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return lerp(pts[i - 1], pts[i], t); };
    return { path, pts, n, cum, closed, at, L: cum[n] };
  });
  // skrzyżowania (także między różnymi sznurami); przycinanie po prostokątach odcinków
  const segs = [];
  P.forEach((q, pi) => { for (let i = 0; i < q.n; i++) { const a = q.pts[i], b = q.pts[i + 1]; segs.push({ pi, i, a, b, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) }); } });
  segs.sort((A, B) => A.x0 - B.x0);
  const X = [];
  for (let I = 0; I < segs.length; I++) {
    const A = segs[I];
    for (let J = I + 1; J < segs.length && segs[J].x0 <= A.x1; J++) {
      const B = segs[J];
      if (B.y0 > A.y1 || A.y0 > B.y1) continue;
      if (A.pi === B.pi) {
        const q = P[A.pi], d = Math.abs(A.i - B.i);
        if (d < 2 || (q.closed && d === q.n - 1)) continue;
      }
      const r = sub(A.b, A.a), sv = sub(B.b, B.a), den = r[0] * sv[1] - r[1] * sv[0];
      if (Math.abs(den) < 1e-12) continue;
      const t = ((B.a[0] - A.a[0]) * sv[1] - (B.a[1] - A.a[1]) * sv[0]) / den;
      const u = ((B.a[0] - A.a[0]) * r[1] - (B.a[1] - A.a[1]) * r[0]) / den;
      if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
      const sin = Math.abs(den) / (Math.hypot(...r) * Math.hypot(...sv));
      const qa = P[A.pi], qb = P[B.pi];
      X.push({ e: [{ pi: A.pi, s: qa.cum[A.i] + t * (qa.cum[A.i + 1] - qa.cum[A.i]) }, { pi: B.pi, s: qb.cum[B.i] + u * (qb.cum[B.i + 1] - qb.cum[B.i]) }], sin });
    }
  }
  // naprzemiennie góra / dół wzdłuż każdego sznura
  const over = new Map();                    // k -> indeks zdarzenia (0/1), które idzie górą
  P.forEach((q, pi) => {
    const ev = [];
    X.forEach((x, k) => x.e.forEach((e, j) => { if (e.pi === pi) ev.push({ k, j, s: e.s }); }));
    ev.sort((a, b) => a.s - b.s);
    let state = true;
    for (const e of ev) {
      let mine;
      if (!over.has(e.k)) { mine = state; over.set(e.k, mine ? e.j : 1 - e.j); }
      else mine = over.get(e.k) === e.j;
      state = !mine;
    }
  });
  // Przeplot: wokół pasma „górnego” wycinamy pas o szerokości cw + 2w, potem przywracamy
  // samo pasmo górne. Pasmo dolne kończy się dokładnie w odległości w od górnego.
  let full = [];
  P.forEach(q => offset([toC(q.path)], cw / 2, q.closed ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenRound).forEach(r => full.push(r)));
  full = union(full);
  const clear = [], back = [];
  for (const [k, j] of over) {
    const x = X[k], e = x.e[j], q = P[e.pi];
    const sn = Math.max(0.2, x.sin), cs = Math.sqrt(1 - sn * sn);
    const half = ((cw / 2 + w) * cs + cw / 2) / sn + 1;
    const pts = []; for (let s = e.s - half; s < e.s + half; s += 0.5) pts.push(q.at(s)); pts.push(q.at(e.s + half));
    const seg = toC(pts);
    offset([seg], cw / 2 + w, ClipperLib.EndType.etOpenButt).forEach(r => clear.push(r));
    offset([seg], cw / 2, ClipperLib.EndType.etOpenButt).forEach(r => back.push(r));
  }
  if (clear.length) full = union(diff(full, union(clear)), back);
  return [{ rings: full.map(fromC), shrink: false }];
}

// ---------------------------------------------------------------- budowa otworów
/**
 * Otwory bliżej siebie niż w: z jednego z pary (późniejszego) odejmujemy drugi poszerzony o w.
 * Daje dokładnie mostek w i nie tworzy nowych styków. Zwraca { holes, count }.
 */
function nearFix(holes, w, r) {
  const k = w / 2 * 0.985;
  const outer = holes.filter(h => ClipperLib.Clipper.Orientation(h));
  if (outer.length < 2) return { holes, count: 0 };
  const bb = outer.map(h => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; h.forEach(q => { x0 = Math.min(x0, q.X); y0 = Math.min(y0, q.Y); x1 = Math.max(x1, q.X); y1 = Math.max(y1, q.Y); }); return [x0, y0, x1, y1]; });
  const grown = [];
  const g = i => grown[i] || (grown[i] = offset([outer[i]], k));
  const kk = 2 * k * S, cut = new Map();
  let count = 0;
  for (let i = 0; i < outer.length; i++) for (let j = i + 1; j < outer.length; j++) {
    const A = bb[i], B = bb[j];
    if (A[0] > B[2] + kk || B[0] > A[2] + kk || A[1] > B[3] + kk || B[1] > A[3] + kk) continue;
    if (!inter(g(i), g(j)).some(q => Math.abs(ClipperLib.Clipper.Area(q)) > 0.001 * S * S)) continue;
    const small = Math.abs(ClipperLib.Clipper.Area(outer[i])) < Math.abs(ClipperLib.Clipper.Area(outer[j])) ? i : j;
    const big = small === i ? j : i;
    (cut.get(small) || cut.set(small, []).get(small)).push(big);
    count++;
  }
  if (!count) return { holes, count: 0 };
  const res = [];
  outer.forEach((h, i) => {
    if (!cut.has(i)) { res.push(h); return; }
    let piece = diff([h], offset(cut.get(i).map(j => outer[j]), w));
    piece = offset(offset(piece, -r), r);
    res.push(...piece);
  });
  holes.filter(h => !ClipperLib.Clipper.Orientation(h)).forEach(h => res.push(h));   // wnętrza (wyspy) zostają do kontroli
  return { holes: res, count };
}

/**
 * spec = { regions: [ring | {rings, shrink} | {parts}], lines: [{pts, closed}], keep: [ring] }
 *   ring  – prosty obszar; rings – obszar z dziurami (np. z band()); parts – kształty do zlania
 * opt  = { w: mostek [mm], r: promień zaokrąglenia / pół najmniejszego otworu [mm] }
 * Zwraca { holes: [ring], islands: [[x,y]], lost: udział powierzchni odrzuconej }.
 */
export function build(spec, opt) {
  const w = opt.w, r = Math.max(0.05, opt.r);
  // Pola: pełny kształt F i zwężony o pół mostka S. Zwężamy TYLKO tam, gdzie obok jest inne pole
  // (bliżej niż mostek) – dalej pole zostaje w pełnym rozmiarze. Dzięki temu po zmniejszeniu motywu
  // wąskie części (ogon smoka, ogniwka parzenicy) nie znikają, dopóki same mają ≥ najmniejszy otwór.
  const regs = [];
  for (const reg of spec.regions || []) {
    const shrink = Array.isArray(reg) ? true : reg.shrink !== false;
    let c;
    if (reg.parts) {                                  // kilka kształtów zlanych w jeden obszar
      c = union(reg.parts.map(r => { const q = toC(r); return ClipperLib.Clipper.Orientation(q) ? q : q.reverse(); }));
    } else c = union((Array.isArray(reg) ? [reg] : reg.rings || [reg.ring]).map(toC));
    if (!c.length) continue;
    regs.push({ F: c, S: shrink ? offset(c, -w / 2) : c, shrink, bb: bbC(c) });
  }
  // grupy: pola, których zwężone wersje się nakładają, były zawsze łączone w jeden otwór
  const par = regs.map((_, i) => i), find = i => (par[i] === i ? i : (par[i] = find(par[i])));
  regs.forEach(r => { r.sb = r.S.length ? bbC(r.S) : null; });
  for (let i = 0; i < regs.length; i++) for (let j = i + 1; j < regs.length; j++) {
    if (!regs[i].shrink || !regs[j].shrink) continue;   // pola bez zwężania – jak dawniej: zwykła suma
    const a = regs[i].sb, b = regs[j].sb;
    if (!a || !b || a[0] > b[2] || b[0] > a[2] || a[1] > b[3] || b[1] > a[3]) continue;
    if (find(i) === find(j)) continue;
    if (inter(regs[i].S, regs[j].S).some(q => Math.abs(ClipperLib.Clipper.Area(q)) > 1e-4 * S * S)) par[find(j)] = find(i);
  }
  const groups = new Map();
  regs.forEach((r, i) => { const k = find(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  const G = [...groups.values()].map(list => {
    const F = list.length > 1 ? union(list.flatMap(r => r.F)) : list[0].F;
    const Sg = list.length > 1 ? union(list.flatMap(r => r.S)) : list[0].S;
    return { F, S: Sg, shrink: list.some(r => r.shrink), bb: bbC(F) };
  });
  let cut = [];
  const kw = w * S;
  G.forEach((g, i) => {
    if (!g.shrink) { cut = cut.concat(g.F); return; }
    const near = G.filter((h, j) => j !== i && !(h.bb[0] > g.bb[2] + kw || g.bb[0] > h.bb[2] + kw || h.bb[1] > g.bb[3] + kw || g.bb[1] > h.bb[3] + kw));
    if (!near.length) { cut = cut.concat(g.F); return; }
    const far = diff(g.F, near.flatMap(h => (h.Fw ||= offset(h.F, w))));   // różnica z wieloma konturami naraz (reguła niezerowa)
    cut = cut.concat(union(g.S, far));
  });
  cut = union(cut);
  const metal = [];
  for (const ln of spec.lines || []) {
    const et = ln.closed ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenRound;
    offset([toC(ln.pts)], (ln.wk || 1) * w / 2, et).forEach(p => metal.push(p));   // wk ≥ 1: żyłka grubsza (ręczna robota)
  }
  for (const k of spec.keep || []) metal.push(toC(k));
  let holes = metal.length ? diff(cut, union(metal)) : cut;
  const before = areaC(holes);
  // „otwarcie”: zwężenie o r i rozszerzenie o r – usuwa otwory węższe niż 2r, zaokrągla naroża
  holes = offset(offset(holes, -r), r);
  // kontrola mostków: dwa otwory bliżej niż w (np. pasma sznura, styk obwódki) –
  // w tym miejscu oba otwory są przycinane, aż mostek ma pełną szerokość.
  let fixed = 0;
  if (opt.check !== false) for (let pass = 0; pass < 8; pass++) {   // powtarzane: poprawka może stworzyć nowe styki
    const n = nearFix(holes, w, r);
    if (!n.count) break;
    holes = n.holes; fixed += n.count;
  }
  holes = ClipperLib.Clipper.CleanPolygons(holes, 0.005 * S);
  const after = areaC(holes);
  // wyspy: kontury dziur w otworach (metal otoczony cięciem)
  const tree = boolOp(ClipperLib.ClipType.ctUnion, holes, [], true);
  const outers = [], islands = [];
  const walk = node => {
    for (const ch of node.Childs()) {
      const path = ch.Contour();
      if (!ch.IsHole()) outers.push(fromC(path));
      else if (Math.abs(ClipperLib.Clipper.Area(path)) / (S * S) < 2.25 * w * w ||
        (node.Contour && Math.abs(ClipperLib.Clipper.Area(path)) < 0.03 * Math.abs(ClipperLib.Clipper.Area(node.Contour())))) {
        /* drobina metalu mniejsza niż ~1,5w × 1,5w – wypada razem z otworem, nie jest problemem */
      } else {
        const pts = fromC(path);
        const c = pts.reduce((s, p) => add(s, p), [0, 0]);
        islands.push(mul(c, 1 / pts.length));
      }
      walk(ch);
    }
  };
  walk(tree);
  return { holes: outers, islands, fixed, lost: before > 0 ? 1 - after / before : 0, area: after };
}

// ---------------------------------------------------------------- ograniczenie szerokości szczelin
// Ścianki paleniska: przez szerokie otwory wylatują iskry. Każdy otwór, w którym mieści się
// koło o średnicy większej niż `max`, dostaje wypełnienie: linie (pionowe, poziome, pod kątem),
// kratkę, trójkąty albo ażur z drobnych otworów (kropki, romby, krzyżyki, gwiazdki...).
// Linie mają szerokość mostka i są rozstawione tak, że szczelina między nimi = max.
export const WYPELNIENIA = ['pionowe', 'poziome', 'skośne', 'kratka', 'kratka ukośna', 'trójkąty', 'romby', 'kropki', 'kwadraty', 'krzyżyki', 'gwiazdki', 'łuski'];

function linesAcross(b, ang, step, off = 0) {
  // równoległe linie pokrywające prostokąt b, pod kątem ang, co step (zakotwiczone w (0,0))
  const c = Math.cos(ang), s = Math.sin(ang);
  const R = Math.hypot(Math.max(Math.abs(b.x0), Math.abs(b.x1)), Math.max(Math.abs(b.y0), Math.abs(b.y1))) + step;
  const out = [];
  for (let k = Math.floor(-R / step); k <= Math.ceil(R / step); k++) {
    const d = k * step + off;
    out.push([[d * -s - R * c, d * c - R * s], [d * -s + R * c, d * c + R * s]]);
  }
  return out;
}
function tile(b, pitchX, pitchY, shape, stagger = true) {
  const out = [];
  for (let j = Math.floor(b.y0 / pitchY) - 1, row = 0; j <= Math.ceil(b.y1 / pitchY) + 1; j++, row++) {
    const dx = stagger && (j & 1) ? pitchX / 2 : 0;
    for (let i = Math.floor(b.x0 / pitchX) - 1; i <= Math.ceil(b.x1 / pitchX) + 1; i++) out.push(shift(shape, [i * pitchX + dx, j * pitchY]));
  }
  return out;
}

/**
 * holes – otwory motywu (współrzędne lokalne), opt = { max, fill, angle, w, r, yMax }
 * yMax – naprawiane są tylko otwory, których szerokie miejsce leży poniżej tej wysokości.
 * Zwraca { holes, fixed: liczba poprawionych otworów, wide: szerokie miejsca przed poprawką }.
 */
export function limitGaps(holes, opt) {
  const { max, fill, w } = opt, r = Math.max(0.05, opt.r);
  const ang = (opt.angle ?? 0) * Math.PI / 180;
  const out = [], wideAll = [];
  let fixed = 0;
  for (const h of holes) {
    const H = [toC(h)];
    if (!ClipperLib.Clipper.Orientation(H[0])) H[0].reverse();
    // szerokie miejsca: to, co zostaje po zwężeniu o max/2 (z małym zapasem), poszerzone z powrotem
    const core = offset(H, -max / 2 * 1.02);
    const coreIn = opt.yMax == null ? core : core.filter(q => Math.min(...q.map(p => p.Y)) / S < opt.yMax);
    if (!coreIn.length) { out.push(...H); continue; }
    wideAll.push(...inter(offset(coreIn, max / 2), H));
    fixed++;
    if (opt.detectOnly) { out.push(...H); continue; }
    const b = bounds([h]);
    let res;
    // „obrys”: wzdłuż krawędzi otworu zostaje wąski wycięty pas (kształt motywu pozostaje czytelny),
    // przerywany co kawałek mostkiem; wypełnienie idzie do środka, mostek od pasa
    let border = [], area = H;
    if (opt.obrys) {
      // pas ≤ max/2: w wąskich końcach otworu pas zajmuje całą szerokość, więc ma wtedy ≤ 2·pas ≤ max
      const bw = Math.min(max / 2, Math.max(2 * r + 0.6, 1.5 * w));
      const inner = offset(H, -bw);
      area = bw >= 2 * r ? offset(H, -(bw + w)) : [];
      if (area.length) {
        border = diff(H, inner);
        const ring = h.concat([h[0]]), cum = [0];
        for (let i = 1; i < ring.length; i++) cum.push(cum[i - 1] + dist(ring[i - 1], ring[i]));
        const L = cum[cum.length - 1], step = Math.max(30, 10 * bw), nB = Math.max(2, Math.round(L / step));
        const bridges = [];
        for (let k = 0; k < nB; k++) {
          const sK = (k + 0.5) * L / nB; let i = 1; while (i < ring.length - 1 && cum[i] < sK) i++;
          const a = ring[i - 1], c = ring[i], t = (sK - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
          const q = lerp(a, c, t), d = sub(c, a), l = Math.hypot(d[0], d[1]) || 1, nn = [-d[1] / l, d[0] / l];
          bridges.push([add(q, mul(nn, -3 * bw)), add(q, mul(nn, 3 * bw))]);
        }
        border = diff(border, offset(bridges.map(toC), w / 2, ClipperLib.EndType.etOpenButt, ClipperLib.JoinType.jtMiter));
      } else area = H;
    }
    const st = max + w;                                    // rozstaw linii: szczelina = max
    const metalFrom = segs => offset(segs.map(toC), w / 2, ClipperLib.EndType.etOpenButt, ClipperLib.JoinType.jtMiter);
    const kind = fill || 'pionowe';
    if (['pionowe', 'poziome', 'skośne', 'kratka', 'kratka ukośna', 'trójkąty'].includes(kind)) {
      let sets;
      if (kind === 'pionowe') sets = [Math.PI / 2 + ang];
      else if (kind === 'poziome') sets = [ang];
      else if (kind === 'skośne') sets = [Math.PI / 4 + ang];
      else if (kind === 'kratka') sets = [ang, Math.PI / 2 + ang];
      else if (kind === 'kratka ukośna') sets = [Math.PI / 4 + ang, -Math.PI / 4 + ang];
      else sets = [ang, ang + Math.PI / 3, ang + 2 * Math.PI / 3];
      const k = kind === 'trójkąty' ? 1.5 : 1;             // trójkąt o wysokości st·1,5 ma wpisane koło ≈ max
      const segsAll = sets.flatMap(a => linesAcross(b, a, st * k));
      res = diff(area, union(metalFrom(segsAll)));
    } else {
      // ażur: otwór zostaje zamknięty metalem, a w nim drobne otwory nie szersze niż max
      const d = max;                                        // największa szerokość drobnego otworu
      let shape, px, py, stagger = true;
      // kafle tak rozstawione, by między sąsiednimi otworami zostawał pełny mostek w
      const c = d + w;
      if (kind === 'kropki') { shape = circle([0, 0], d / 2); px = c; py = c * 0.866; }
      else if (kind === 'kwadraty') { const a = d / 2; shape = [[-a, -a], [a, -a], [a, a], [-a, a]]; px = py = c; stagger = false; }
      else if (kind === 'romby') {                         // romby układają się bez przerw: kafel = romb c × 1,6c, pomniejszony o pół mostka
        const hx = c / 2, hy = c * 0.8, sx = w / 2 * Math.hypot(hx, hy) / hy, sy = w / 2 * Math.hypot(hx, hy) / hx;
        shape = [[0, -(hy - sy)], [hx - sx, 0], [0, hy - sy], [-(hx - sx), 0]]; px = c; py = hy;
      }
      else if (kind === 'krzyżyki') { const a = d / 2, t = Math.max(d / 3, r * 2.2); shape = [[-t / 2, -a], [t / 2, -a], [t / 2, -t / 2], [a, -t / 2], [a, t / 2], [t / 2, t / 2], [t / 2, a], [-t / 2, a], [-t / 2, t / 2], [-a, t / 2], [-a, -t / 2], [-t / 2, -t / 2]]; px = py = c; stagger = false; }
      else if (kind === 'gwiazdki') { shape = []; for (let i = 0; i < 12; i++) shape.push(P(i % 2 ? d * 0.3 : d * 0.6, i * Math.PI / 6 + Math.PI / 2)); px = d * 1.2 + w; py = px * 0.866; }
      else { /* łuski: półkola w przesuniętych rzędach */ shape = arc([0, 0], d / 2, 0, Math.PI, 16); px = c; py = d / 2 + w; }
      const rot = q => q.map(([x, y]) => [x * Math.cos(ang) - y * Math.sin(ang), x * Math.sin(ang) + y * Math.cos(ang)]);
      const bb = { x0: b.x0 - b.w, x1: b.x1 + b.w, y0: b.y0 - b.h, y1: b.y1 + b.h };
      const tiles = tile(bb, px, py, shape, stagger).map(rot).filter(q => {
        const [x, y] = q[0]; return x > b.x0 - 2 * d && x < b.x1 + 2 * d && y > b.y0 - 2 * d && y < b.y1 + 2 * d;
      });
      res = inter(union(tiles.map(toC)), opt.obrys && border.length ? area : offset(H, -w));   // tylko w środku otworu, mostek od krawędzi
    }
    res = offset(offset(res.concat(border), -r), r);        // usuń okruchy węższe niż min. otwór
    out.push(...res);
  }
  let merged = union(out);
  for (let pass = 0; pass < 4; pass++) { const n = nearFix(merged, w, r); if (!n.count) break; merged = n.holes; }
  const clean = ClipperLib.Clipper.CleanPolygons(merged, 0.005 * S);
  // wynik: tylko zewnętrzne kontury (wnętrza – drobiny metalu – i tak wypadają)
  const tree = boolOp(ClipperLib.ClipType.ctUnion, clean, [], true), res = [];
  const walk = n => { for (const ch of n.Childs()) { if (!ch.IsHole()) res.push(fromC(ch.Contour())); walk(ch); } };
  walk(tree);
  return { holes: res, fixed, wide: union(wideAll).map(fromC) };
}

// ---------------------------------------------------------------- naprawa gotowych otworów
/**
 * Otwory z kilku źródeł (motywy, napisy) po złożeniu: suma, mostki ≥ w między otworami,
 * usunięcie okruchów węższych niż 2r, wykrycie wysp. Zwraca { holes, islands, fixed }.
 */
export function repair(rings, { w, r }) {
  let holes = union(rings.map(q => { const c = toC(q); return ClipperLib.Clipper.Orientation(c) ? c : c.reverse(); }));
  let fixed = 0;
  for (let pass = 0; pass < 6; pass++) { const n = nearFix(holes, w, r); if (!n.count) break; holes = n.holes; fixed += n.count; }
  holes = offset(offset(holes, -r), r);
  const tree = boolOp(ClipperLib.ClipType.ctUnion, holes, [], true), outers = [], islands = [];
  const walk = node => { for (const ch of node.Childs()) {
    const path = ch.Contour();
    if (!ch.IsHole()) outers.push(fromC(path));
    else if (Math.abs(ClipperLib.Clipper.Area(path)) / (S * S) >= 2.25 * w * w) { const pts = fromC(path); islands.push(mul(pts.reduce((s, p) => add(s, p), [0, 0]), 1 / pts.length)); }
    walk(ch);
  } };
  walk(tree);
  return { holes: outers, islands, fixed };
}

/** Kształty z konturów (np. liter): [{ outer, holes: [...] }] – reguła „niezerowa” jak w czcionkach. */
export function shapes(rings) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(rings.map(toC), ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out = [];
  const walk = node => { for (const ch of node.Childs()) {
    if (!ch.IsHole()) out.push({ outer: fromC(ch.Contour()), holes: ch.Childs().filter(h => h.IsHole()).map(h => fromC(h.Contour())) });
    walk(ch);
  } };
  walk(tree);
  return out;
}

/**
 * Czyszczenie gotowych otworów przed DXF: domknięcie i otwarcie o e (mm, narożniki ostre – miter).
 * Znika metal węższy niż 2e (np. „igła” wchodząca w otwór) i szczelina węższa niż 2e – lasera i tak tego nie wytnie,
 * a w pliku byłaby „kreska” w otworze. Zwraca same zewnętrzne kontury otworów (jak repair).
 */
export function cleanHoles(rings, e = 0.1) {
  if (!rings.length) return rings;
  const M = ClipperLib.JoinType.jtMiter, C = ClipperLib.EndType.etClosedPolygon;
  let p = union(rings.map(r => { const q = toC(r); return ClipperLib.Clipper.Orientation(q) ? q : q.reverse(); }));
  p = offset(offset(p, e, C, M), -e, C, M);
  p = offset(offset(p, -e, C, M), e, C, M);
  return p.filter(q => ClipperLib.Clipper.Orientation(q)).map(fromC);
}
/**
 * Kontrola konturu: miejsca, gdzie linia cięcia zawraca prawie w miejscu (kąt < ~6°) – „igła”/„kreska”.
 * Punkty bliższe niż 0,02 mm są łączone (dwa prawie te same wierzchołki na czubku igły).
 */
export function spikesIn(ring) {
  const P = [];
  for (const q of ring) { const l = P[P.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.02) P.push(q); }
  if (P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= 0.02) P.pop();
  const out = [], n = P.length;
  for (let k = 0; k < n; k++) {
    const a = P[(k - 1 + n) % n], b = P[k], c = P[(k + 1) % n];
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1], la = Math.hypot(ux, uy), lb = Math.hypot(vx, vy);
    if (la > 1e-9 && lb > 1e-9 && (ux * vx + uy * vy) / (la * lb) < -0.995) out.push(b);
  }
  return out;
}

/** Odsunięcie konturów z zachowaniem ich orientacji (zewnętrzne i dziury, np. litery). */
export function offsetRings(rings, d) { return offset(rings.map(toC), d).map(fromC); }

/** Część wspólna obszarów A ∩ B (listy pierścieni). */
export function intersect(A, B) {
  const norm = r => { const q = toC(r); return ClipperLib.Clipper.Orientation(q) ? q : q.reverse(); };
  if (!A.length || !B.length) return [];
  return inter(A.map(norm), union(B.map(norm))).map(fromC);
}
/** Pole obszaru (mm²). */
export function areaOf(rings) { return Math.abs(areaC(rings.map(toC))); }

// ---------------------------------------------------------------- rozmieszczenie
/** Przekształcenie otworów: skala już wliczona w rozmiar, tu obrót, odbicie, przesunięcie. */
export function place(holes, { x = 0, y = 0, rot: a = 0, mirror = false }) {
  const rad = a * Math.PI / 180;
  return holes.map(h => {
    let q = mirror ? h.map(([px, py]) => [-px, py]).reverse() : h;
    return shift(rot(q, rad), [x, y]);
  });
}

/**
 * Kontrola układu na płycie:
 *  – otwory muszą leżeć w obrysie zwężonym o margines,
 *  – otwory różnych motywów muszą być od siebie co najmniej o mostek.
 */
export function checkLayout(panel, items, { margin, w }) {
  const safe = offset([toC(panel)], -margin, ClipperLib.EndType.etClosedPolygon, ClipperLib.JoinType.jtMiter);
  const res = items.map(() => ({ outside: 0, clash: [] }));
  const C = items.map(it => it.holes.map(toC));
  C.forEach((h, i) => { res[i].outside = areaC(diff(h, safe)); });
  const grown = C.map(h => offset(h, w / 2));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (areaC(inter(grown[i], grown[j])) > 0.01) { res[i].clash.push(j); res[j].clash.push(i); }
  }
  return res;
}

export function bounds(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  rings.forEach(r => r.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function ringArea(r) { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
export function ringLength(r) { let s = 0; for (let i = 0; i < r.length; i++) s += dist(r[i], r[(i + 1) % r.length]); return s; }

// ---------------------------------------------------------------- DXF (R12, jak w generatorze)
const f3 = n => (Math.abs(n) < 5e-4 ? 0 : n).toFixed(3);
function dxfPoly(ring, layer) {
  let s = `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n1\n10\n0\n20\n0\n30\n0\n`;
  for (const [x, y] of ring) s += `0\nVERTEX\n8\n${layer}\n10\n${f3(x)}\n20\n${f3(y)}\n30\n0\n`;
  return s + `0\nSEQEND\n8\n${layer}\n`;
}
/** layers: { CUT: [ring], OPIS: [ring] } */
export function toDxf(layers) {
  const cols = { CUT: 7, OBRYS: 1, MARGINES: 8 };
  let ents = '';
  for (const [name, rings] of Object.entries(layers)) rings.forEach(r => { ents += dxfPoly(r, name); });
  let t = `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n${Object.keys(layers).length}\n`;
  for (const name of Object.keys(layers)) t += `0\nLAYER\n2\n${name}\n70\n0\n62\n${cols[name] || 3}\n6\nCONTINUOUS\n`;
  t += `0\nENDTAB\n0\nENDSEC\n`;
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n` + t +
    `0\nSECTION\n2\nENTITIES\n${ents}0\nENDSEC\n0\nEOF\n`;
}

/** SVG path z pierścieni (y odwrócone). */
export function svgPath(rings) {
  return rings.map(r => 'M' + r.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L') + 'Z').join('');
}

// ---------------------------------------------------------------- linie cięcia (otwarte, bez otworu)
/**
 * Części otwartych linii leżące wewnątrz obszaru (inside = true) albo poza nim.
 * Własne przycinanie (próbki co ≤ 0,3 mm, reguła parzystości) – przycinanie linii otwartych w Clipperze
 * potrafi się zapętlić (np. obrócony podpis na stopce).
 */
export function clipOpen(lines, rings, inside = true) {
  if (!lines.length) return [];
  const norm = r => { const q = toC(r); return ClipperLib.Clipper.Orientation(q) ? q : q.reverse(); };
  const reg = rings.length ? union(rings.map(norm)).map(fromC) : [];
  const bb = reg.map(r => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; r.forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }); return [x0, y0, x1, y1]; });
  const isIn = ([px, py]) => {
    let c = false;
    reg.forEach((r, k) => {
      const b = bb[k]; if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) return;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c;
      }
    });
    return c;
  };
  const out = [];
  for (const l of lines) {
    if (l.length < 2) continue;
    const pts = [l[0]];
    for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], n = Math.max(1, Math.ceil(dist(a, b) / 0.3)); for (let k = 1; k <= n; k++) pts.push(lerp(a, b, k / n)); }
    let cur = [];
    for (const q of pts) { if (isIn(q) === inside) cur.push(q); else { if (cur.length > 1) out.push(cur); cur = []; } }
    if (cur.length > 1) out.push(cur);
  }
  return out;
}
/** Obszary zamknięte przez linie cięcia (szerokość szczeliny kerf) – metal, który by wypadł. */
export function enclosed(lines, kerf) {
  const bands = lines.filter(l => l.length > 1).flatMap(l => offset([toC(l)], kerf / 2, ClipperLib.EndType.etOpenRound).map(fromC));
  if (!bands.length) return [];
  return shapes(bands).flatMap(s => s.holes).filter(h => Math.abs(ringArea(h)) > kerf * kerf);
}
export const lineLength = l => { let s = 0; for (let i = 1; i < l.length; i++) s += dist(l[i - 1], l[i]); return s; };

/**
 * Przerwy w długich szczelinach (wytrzymałość w ogniu).
 * Długi, wąski otwór (np. linia ramki, długa żyłka parzenicy) sprawia, że metal po obu stronach trzyma się
 * tylko na końcach – w temperaturze płyta się wygina i pęka. Każdy wąski otwór dłuższy niż Lmax dostaje
 * mostki (przerwy) rozłożone równo wzdłuż: co najwyżej Lmax szczeliny bez podparcia.
 * opt: { Lmax (mm), bw – szerokość mostka przerwy (mm), wMax – do jakiej szerokości otwór uznajemy za „szczelinę”, hole }
 * Zwraca { holes, n (dodanych mostków), najdluzsza (mm, po poprawce) }.
 */
export function przerwyDlugich(holes, { Lmax = 120, bw = 5, wMax = 30, hole = 3 } = {}) {
  const out = []; let n = 0, najdl = 0;
  for (const h of holes) {
    const A = Math.abs(ringArea(h)), P = ringLength(h);
    if (h.length < 4 || P < 1) { out.push(h); continue; }
    const szer = 2 * A / P, L = P / 2 - szer;                   // przybliżona szerokość i długość szczeliny
    if (szer > wMax || L <= Lmax) { if (szer <= wMax) najdl = Math.max(najdl, L); out.push(h); continue; }
    const k = Math.ceil(L / Lmax) - 1;                          // liczba mostków
    // koniec szczeliny: punkt najdalszy od środka ciężkości; dalej wzdłuż jednego brzegu do drugiego końca
    let cx = 0, cy = 0; h.forEach(([x, y]) => { cx += x; cy += y; }); cx /= h.length; cy /= h.length;
    let i0 = 0, d0 = -1; h.forEach(([x, y], i) => { const d = Math.hypot(x - cx, y - cy); if (d > d0) { d0 = d; i0 = i; } });
    const ring = [...h.slice(i0), ...h.slice(0, i0)];
    const cum = [0]; for (let i = 1; i <= ring.length; i++) cum.push(cum[i - 1] + dist(ring[i - 1], ring[i % ring.length]));
    const at = s => {                                           // punkt i styczna w odległości s po obwodzie
      s = ((s % P) + P) % P;
      let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const a = ring[i - 1], b = ring[i % ring.length], t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
      return lerp(a, b, t);
    };
    const ccw = ringArea(ring) > 0, bars = [];
    const pol = P / 2;                                          // jeden brzeg ≈ pół obwodu
    for (let j = 1; j <= k; j++) {
      const s = szer / 2 + (pol - szer) * j / (k + 1);
      const p = at(s), q1 = at(s - Math.max(1.5, szer)), q2 = at(s + Math.max(1.5, szer));
      let tx = q2[0] - q1[0], ty = q2[1] - q1[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const nx = ccw ? -ty : ty, ny = ccw ? tx : -tx;             // normalna do środka otworu
      const m = [p[0] + nx * szer / 2, p[1] + ny * szer / 2], hl = szer * 1.6 + 2, hb = bw / 2;
      bars.push([[m[0] - tx * hb - nx * hl, m[1] - ty * hb - ny * hl], [m[0] + tx * hb - nx * hl, m[1] + ty * hb - ny * hl],
        [m[0] + tx * hb + nx * hl, m[1] + ty * hb + ny * hl], [m[0] - tx * hb + nx * hl, m[1] - ty * hb + ny * hl]]);
    }
    const parts = subtract([h], bars).filter(q => Math.abs(ringArea(q)) > hole * hole);
    n += k;
    parts.forEach(q => { const a = Math.abs(ringArea(q)), p2 = ringLength(q), s2 = 2 * a / p2; if (s2 <= wMax) najdl = Math.max(najdl, p2 / 2 - s2); });
    out.push(...parts);
  }
  return { holes: out, n, najdluzsza: najdl };
}
