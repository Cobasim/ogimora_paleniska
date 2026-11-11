// Geometria paleniska — jedno źródło prawdy dla podglądu 3D, rozkroju i DXF.
// Jednostki: mm. Układ 3D: x, y poziomo, z w górę.
// Kontur 2D to lista wierzchołków {x, y, b}; b = bulge (DXF) łuku do następnego wierzchołka.
//
// Model bryły: zewnętrzne powierzchnie misy to „obrys nominalny” (dno od spodu na wysokości
// stopek, ścianki od zewnątrz). Grubość blach narasta do środka. Na styku dwóch blach obie
// sięgają wspólnej krawędzi zewnętrznej, a nakładanie rozwiązują ząbki (połączenie palcowe):
// na przemian jedna blacha sięga krawędzi, druga jest cofnięta o tyle, by jej nie dotknąć.
import pc from './vendor/polygon-clipping.js';

export const STEEL_DENSITY = 7.85e-6; // kg / mm³

export const PARAMS = [
  { id: 'base',        section: 'body', label: 'Bok dna',                    min: 150, max: 900, step: 25, value: 350, unit: 'mm' },
  { id: 'height',      section: 'body', label: 'Wysokość ścianek',           min: 100, max: 450, step: 10, value: 160, unit: 'mm' },
  { id: 'angle',       section: 'body', label: 'Odchylenie ścianek',         min: -45, max: 45,  step: 1,  value: 16,  unit: '°',
    hint: 'Kąt od pionu. Dodatni = misa rozszerza się ku górze.' },
  { id: 'notchDepth',  section: 'body', label: 'Głębokość podcięcia',        min: 0,   max: 210, step: 5,  value: 15,  unit: 'mm',
    hint: 'Wycięcie w górnej krawędzi każdej ścianki (np. pod ruszt). 0 = bez podcięcia.' },
  { id: 'notchWidth',  section: 'body', label: 'Szerokość podcięcia',  min: 20, max: 1800, step: 10, value: 240, unit: 'mm',
    hint: 'Szerokość wycięcia u góry ścianki, mierzona na górnej krawędzi.' },
  { id: 'legHeight',   section: 'legs', label: 'Wysokość stopek',            min: 0,   max: 500, step: 10, value: 70,  unit: 'mm',
    hint: 'Od ziemi do spodu dna. 0 = bez stopek (misa stoi bezpośrednio na ziemi lub na własnej podstawie).' },
  { id: 'footTop',     section: 'legs', label: 'Szerokość u góry',  min: 40,  max: 180, step: 5,  value: 130, unit: 'mm' },
  { id: 'footBottom',  section: 'legs', label: 'Szerokość u dołu',  min: 40,  max: 200, step: 5,  value: 70, unit: 'mm' },
  { id: 'footAngle',   section: 'legs', label: 'Odchylenie stopek', min: -20, max: 45,  step: 1,  value: 30,  unit: '°',
    hint: 'Liczone jak odchylenie ścianek. Ten sam kąt = stopki przedłużają linię narożników misy.' },
  { id: 'footInset',   section: 'legs', label: 'Cofnięcie od narożnika',     min: 0,   max: 140, step: 5,  value: 15,   unit: 'mm',
    hint: 'Gdy stopka jest cofnięta pod dno dalej niż ścianki, dostaje ząbki wchodzące w otwory w dnie.' },
  { id: 'gap',         section: 'joint', label: 'Luz ząbków (na stronę)', min: 0.1, max: 1.5, step: 0.1, value: 0.3, unit: 'mm',
    hint: 'Szczelina między ząbkiem a wycięciem, z każdej strony. Laser zwykle 0,2–0,3 mm, plazma 0,8–1,0 mm.' },
];

export const THICKNESSES = [3, 4, 5, 8, 10];
/** Gęstość nacięć na linii gięcia: f = udział szczelin w długości linii. */
export const PERF_LEVELS = [
  { name: 'Brak', f: 0 },
  { name: 'Rzadkie', f: 0.5 },
  { name: 'Średnie', f: 0.67 },
  { name: 'Gęste', f: 0.8 },
];
export const DEFAULTS = {
  ...Object.fromEntries(PARAMS.map(p => [p.id, p.value])),
  tBowl: 5, tLeg: 5, mat: 0, // mat: 0 = S235, 1 = stal patynująca (weathering steel)
  bowlBent: 0, legBent: 0,   // 0 = spawane z osobnych blach, 1 = gięte (misa: dno + 2 ścianki), 2 = misa gięta w całości (dno + 4 ścianki, „krzyż”)
  skirt: 0, skirtArch: 1,    // „nogi z boków”: stopki są przedłużeniem ścianek (fartuch); wycięcie między nogami: 0 = proste, 1 = łuk
  perfBowl: 0, perfLeg: 0,   // indeks PERF_LEVELS
  legCut: 0,                 // PROSTY: wysokość nóżek (wycięcia między nogami) przy „nogach z boków” [mm]; 0 = najwyższe możliwe
};

const rad = d => d * Math.PI / 180;
// kolejność ścianek w build(): [−y, +x, +y, −x] → numery widoczne dla klienta (1 = przód, 2 = prawy, 3 = tył, 4 = lewy)
const WALL_NUM = [1, 2, 3, 4];
// stopki w kolejności narożników [(−,−), (+,−), (+,+), (−,+)]
const FOOT_NUM = [9, 6, 7, 8];
const round5 = v => Math.floor(v / 5) * 5;

/** Dynamiczne granice suwaków zależne od innych parametrów + przycięcie wartości. */
export function constrain(input) {
  const p = { ...input };
  const limits = {};
  // Górny obrys nie może być węższy niż 100 mm.
  const minAngle = Math.max(-45, Math.ceil(Math.atan((100 - p.base) / (2 * p.height)) * 180 / Math.PI));
  // „Nogi z boków”: stopka jest przedłużeniem ścianki w dół. Przy ściankach rozchylonych ku górze
  // (kąt dodatni) nogi zbiegają się pod misą – wysokość nóg jest wtedy ograniczona tak, by w narożnikach
  // zostało miejsce na nogi i wycięcie między nimi.
  p.skirt = p.skirt ? 1 : 0; p.skirtArch = p.skirtArch ? 1 : 0;
  limits.angle = { min: minAngle, max: 45 };
  p.angle = clamp(p.angle, minAngle, 45);
  if (p.skirt) {
    const ta = Math.tan(rad(p.angle));
    const maxLeg = ta > 0.01 ? Math.max(30, Math.min(500, Math.floor((p.base / 2 - 70) / ta / 10) * 10)) : 500;
    limits.legHeight = { min: 30, max: maxLeg };
    p.legHeight = clamp(p.legHeight, 30, maxLeg);
    p.footAngle = -p.angle; p.footInset = 0;            // wynikają z kąta ścianek
    // PROSTY: nóżki (wycięcie) niższe niż dno – pod dnem zawsze zostaje pas blachy
    { const pas = (Math.max(15, 2.5 * p.tBowl) + p.gap) * Math.cos(rad(p.angle));
      const mx = Math.max(15, Math.floor((p.legHeight - pas) / 5) * 5);
      limits.legCut = { min: 15, max: mx };
      p.legCut = clamp(+p.legCut > 0 ? +p.legCut : mx, 15, mx); }
    limits.footAngle = { min: -45, max: 45 };
  }

  const d = derive(p);
  const maxDepth = Math.max(0, round5(Math.min(d.slant * 0.6, (d.top - 90) / 2)));
  limits.notchDepth = { min: 0, max: maxDepth };
  p.notchDepth = clamp(p.notchDepth, 0, maxDepth);

  // Podcięcie musi zostawić ≥15 mm stali przy skośnej krawędzi i mieć szerokość ≥ 2r.
  const side = Math.max(0, d.flare * p.notchDepth / d.slant);
  const minOff = Math.max(20, Math.ceil((side + 15) / 5) * 5);
  const maxOff = Math.max(minOff, round5((d.top - 2 * Math.max(p.notchDepth, 15)) / 2));
  // suwak = szerokość wycięcia; odległość od narożnika wynika z niej
  const minW = Math.max(20, Math.ceil((d.top - 2 * maxOff) / 10) * 10);
  const maxW = Math.max(minW, Math.floor((d.top - 2 * minOff) / 10) * 10);
  limits.notchWidth = { min: minW, max: maxW };
  p.notchWidth = clamp(p.notchWidth, minW, maxW);
  p.notchOffset = (d.top - p.notchWidth) / 2;

  const maxTop = p.skirt ? Math.max(40, round5(p.base / 2 - 20)) : Math.min(180, round5(p.base / 2 - 10));
  limits.footTop = { min: 40, max: maxTop };
  p.footTop = clamp(p.footTop, 40, maxTop);
  const maxInset = Math.max(0, Math.min(140, round5((p.base / 2 - p.footTop) * Math.SQRT2)));
  limits.footInset = { min: 0, max: maxInset };
  p.footInset = clamp(p.footInset, 0, maxInset);
  // dolne skrzydła sąsiednich stopek nie mogą na siebie zachodzić
  const hb = p.base / 2 - p.footInset / Math.SQRT2 + p.legHeight * Math.tan(rad(p.footAngle));
  const maxBottom = p.skirt ? Math.max(40, round5(hb - 20)) : clamp(round5(hb - 10), 40, 200);
  limits.footBottom = { min: 40, max: maxBottom };
  p.footBottom = clamp(p.footBottom, 40, maxBottom);

  p.gap = Math.round(clamp(+p.gap || 0.3, 0.1, 1.5) * 10) / 10;
  p.bowlBent = clamp(Math.round(+p.bowlBent) || 0, 0, 2); p.legBent = p.legBent ? 1 : 0;
  if (p.skirt && p.bowlBent === 2) p.bowlBent = 1;   // nogi z boków: dna nie da się zgiąć z bokami – zostają gięte narożniki
  p.perfBowl = clamp(Math.round(p.perfBowl) || 0, 0, 3); p.perfLeg = clamp(Math.round(p.perfLeg) || 0, 0, 3);
  return { params: p, limits };
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

export function derive(p) {
  const top = p.base + 2 * p.height * Math.tan(rad(p.angle));
  const flare = (top - p.base) / 2;
  const slant = Math.hypot(p.height, flare);
  return { top, flare, slant };
}

// ---------- wektory ----------
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { return mul(a, 1 / len(a)); }

// ---------- 2D: kontury i operacje logiczne ----------
const BULGE_90 = Math.tan(Math.PI / 8);
const ARC_SEG = 16;

function wallOutline(p, d) {
  const { top, flare, slant } = d;
  const pts = [{ x: flare, y: 0 }, { x: flare + p.base, y: 0 }, { x: top, y: slant }];
  const dep = p.notchDepth, off = p.notchOffset, w = top - 2 * off;
  if (dep > 0 && w > 0) {
    const r = Math.min(dep, w / 2);
    const yB = slant - dep;
    pts.push({ x: top - off, y: slant });
    if (dep - r > 0.01) pts.push({ x: top - off, y: yB + r });
    pts[pts.length - 1].b = -BULGE_90;
    pts.push({ x: top - off - r, y: yB });
    if (w - 2 * r > 0.01) pts.push({ x: off + r, y: yB });
    pts[pts.length - 1].b = -BULGE_90;
    pts.push({ x: off, y: yB + r });
    if (dep - r > 0.01) pts.push({ x: off, y: slant });
  }
  pts.push({ x: 0, y: slant });
  return pts;
}

/** Kontur → pierścień punktów (łuki rozbite) + lista łuków do odtworzenia po operacjach. */
function toRing(outline) {
  const ring = tessellate(outline, ARC_SEG);
  const arcs = [];
  outline.forEach((a, i) => { if (a.b) { const e = outline[(i + 1) % outline.length]; arcs.push({ s: [a.x, a.y], e: [e.x, e.y], b: a.b }); } });
  return { ring, arcs };
}

const near = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;

/** Po operacji na wielokątach: tam, gdzie łuk przetrwał w całości, wraca jako prawdziwy łuk (bulge). */
function restoreArcs(ring, arcs) {
  const N = ring.length;
  const out = ring.map(([x, y]) => ({ x, y }));
  const drop = new Set();
  for (const a of arcs) {
    const i = ring.findIndex(q => near(q, a.s)), j = ring.findIndex(q => near(q, a.e));
    if (i < 0 || j < 0) continue;
    const fwd = (j - i + N) % N, back = (i - j + N) % N;
    if (fwd <= ARC_SEG) { for (let k = 1; k < fwd; k++) drop.add((i + k) % N); out[i].b = a.b; }
    else if (back <= ARC_SEG) { for (let k = 1; k < back; k++) drop.add((j + k) % N); out[j].b = -a.b; }
  }
  return out.filter((_, k) => !drop.has(k));
}

/** Suma konturów `bases` (z łukami) minus wielokąty `cuts` → jeden kontur (największy kawałek). */
const snap = v => Math.round(v * 1e5) / 1e5 || 0; // biblioteka nie lubi współrzędnych typu 1e-15
const snapRing = r => r.map(([x, y]) => [snap(x), snap(y)]);
function shape(bases, cuts = []) {
  let arcs = [], geoms = [];
  for (const o of bases) {
    const r = toRing(o);
    arcs = arcs.concat(r.arcs.map(a => ({ ...a, s: a.s.map(snap), e: a.e.map(snap) })));
    geoms.push([snapRing(r.ring)]);
  }
  let g;
  try {
    g = geoms.length > 1 ? pc.union(...geoms) : [geoms[0]];
    if (cuts.length) g = pc.difference(g, ...cuts.map(c => [snapRing(c)]));
  } catch (err) {
    console.warn('Operacja na konturze nie powiodła się:', err.message);
    return bases[0];
  }
  let best = null, bestA = -1;
  for (const poly of g) { const A = Math.abs(ringArea(poly[0])); if (A > bestA) { bestA = A; best = poly[0]; } }
  if (!best) return bases[0];
  const ring = best.slice(0, -1);
  if (ringArea(ring) < 0) ring.reverse();
  return restoreArcs(ring, arcs);
}

function ringArea(r) { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }

/** Prostokąt (pierścień) w układzie: punkt p0, kierunek e (wzdłuż), n (w poprzek); zakresy s i t. */
function rect2(p0, e, n, s0, s1, t0, t1) {
  const P = (s, t) => [p0[0] + e[0] * s + n[0] * t, p0[1] + e[1] * s + n[1] * t];
  return [P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1)];
}

/** Owalna szczelina (do konturu otworu) od a do b, szerokość w. */
function slot2(a, b, w) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ex = dx / L, ey = dy / L;
  const h = w / 2, nx = -ey * h, ny = ex * h;
  const A = [a[0] + ex * h, a[1] + ey * h], B = [b[0] - ex * h, b[1] - ey * h];
  return [
    { x: A[0] + nx, y: A[1] + ny }, { x: B[0] + nx, y: B[1] + ny, b: -1 },
    { x: B[0] - nx, y: B[1] - ny }, { x: A[0] - nx, y: A[1] - ny, b: -1 },
  ];
}

// ---------- blachy w 3D ----------
/**
 * Płyta: kontur 2D w układzie (o, u, v); grubość t narasta w kierunku `toward`
 * (wektor — do środka bryły) albo symetrycznie ('center').
 */
function plate(kind, outline, o, u, v, t, toward) {
  return { kind, outline, holes: [], o, u, v, t, toward, cuts: [], adds: [] };
}
const at = (pl, q) => add(add(pl.o, mul(pl.u, q.x ?? q[0])), mul(pl.v, q.y ?? q[1]));
const loc = (pl, P) => { const s = sub(P, pl.o); return [dot(s, pl.u), dot(s, pl.v)]; };
const vec2 = (pl, V) => [dot(V, pl.u), dot(V, pl.v)];
function inward(pl) { const n = cross(pl.u, pl.v); return pl.toward === 'center' ? n : dot(n, pl.toward) >= 0 ? n : mul(n, -1); }
function centroid3(pl) { let c = [0, 0, 0]; pl.outline.forEach(q => { c = add(c, at(pl, q)); }); return mul(c, 1 / pl.outline.length); }
function finish(pl) {
  if (pl.cuts.length || pl.adds.length) pl.outline = shape([pl.outline, ...pl.adds.map(r => r.map(([x, y]) => ({ x, y })))], pl.cuts);
  return pl;
}

/** Ile przedziałów ząbków na połączeniu długości L: zawsze nieparzyście (symetrycznie: oba końce i środek). */
function fingerCount(L, minSeg) {
  const target = clamp(L / 5, 25, 80);
  let n = Math.max(1, Math.round(L / target));
  if (n % 2 === 0) n += Math.abs(L / (n + 1) - target) < Math.abs(L / (n - 1) - target) ? 1 : -1;
  n = Math.max(3, n);
  while (n > 3 && L / n < minSeg) n -= 2;
  return n;
}

/**
 * Połączenie palcowe A–B wzdłuż wspólnej krawędzi zewnętrznej P0→P1.
 * A ma ząbki na przedziałach parzystych (w tym oba końce), B na nieparzystych.
 * Cofnięcie płyty X tam, gdzie ząbek ma druga płyta Y: c = (tY + tX·max(0, cos θ)) / sin θ,
 * θ = kąt wewnętrzny między płytami — wtedy X na całej grubości omija Y.
 */
function joint(A, B, P0, P1, g, opt = {}) {
  const Ev = sub(P1, P0), L = len(Ev), E = mul(Ev, 1 / L);
  const side = X => { const w = sub(centroid3(X), P0); return norm(sub(w, mul(E, dot(w, E)))); };
  const eA = side(A), eB = side(B);
  const cos = clamp(dot(eA, eB), -1, 1), sin = Math.sqrt(1 - cos * cos);
  const cA = (B.t + A.t * Math.max(0, cos)) / sin, cB = (A.t + B.t * Math.max(0, cos)) / sin;
  const n = fingerCount(L, 2 * Math.max(cA, cB) + 2 * g + 6), seg = L / n, BIG = 1000;
  const recess = (X, eX, c, parity) => {
    const p0 = loc(X, P0), e2 = vec2(X, E), n2 = vec2(X, eX);
    for (let k = parity; k < n; k += 2) {
      const s0 = k === 0 ? (opt.noExt0 ? -g : -BIG) : k * seg - g / 2, s1 = k === n - 1 ? L + BIG : (k + 1) * seg + g / 2;
      X.cuts.push(rect2(p0, e2, n2, s0, s1, -50, c + g));
    }
  };
  // ząbek wystaje poza zewnętrzną powierzchnię drugiej płyty na całej grubości (do zeszlifowania na płasko):
  // blacha cięta prostopadle, więc przy kącie rozwartym (ścianki odchylone od pionu) wewnętrzny róg ząbka
  // chowałby się pod powierzchnię – wydłużenie o tX·(−cos θ)/sin θ to wyrównuje, + WYSTAJE zapasu.
  const extend = (X, eX, parity) => {
    const p0 = loc(X, P0), e2 = vec2(X, E), n2 = vec2(X, eX);
    const ext = X.t * Math.max(0, -cos) / sin + Math.max(WYSTAJE, 0.2 * X.t);
    for (let k = parity; k < n; k += 2) X.adds.push(rect2(p0, e2, n2, Math.max(0, k * seg), Math.min(L, (k + 1) * seg), -ext, 0.5));
    return ext;
  };
  const xA = extend(A, eA, 0), xB = extend(B, eB, 1);
  recess(A, eA, cA, 1);
  recess(B, eB, cB, 0);
  return { n, seg, cA, cB, xA, xB, theta: Math.acos(cos) * 180 / Math.PI };
}

/**
 * Zakładka bez ząbków: A sięga wspólnej krawędzi zewnętrznej, B jest cofnięta na całej długości tak,
 * by na całej grubości ominąć A (+ luz). Do misy giętej w całości – ząbki nie przeszłyby przy gięciu.
 */
function lap(A, B, P0, P1, g) {
  const Ev = sub(P1, P0), L = len(Ev), E = mul(Ev, 1 / L);
  const side = X => { const w = sub(centroid3(X), P0); return norm(sub(w, mul(E, dot(w, E)))); };
  const eA = side(A), eB = side(B);
  const cos = clamp(dot(eA, eB), -1, 1), sin = Math.sqrt(1 - cos * cos);
  const cB = (A.t + B.t * Math.max(0, cos)) / sin;
  const p0 = loc(B, P0), e2 = vec2(B, E), n2 = vec2(B, eB);
  B.cuts.push(rect2(p0, e2, n2, -1000, L + 1000, -50, cB + g));
  return { cB };
}

/**
 * Linia styku płyt A i B po obu stronach materiału: na zewnętrznym narożniku (odsunięta o `off` mm na zewnątrz)
 * i w narożniku wewnętrznym — tam, gdzie spotykają się wewnętrzne powierzchnie blach (odsunięta 1,5 mm do środka).
 */
function seam(A, B, P0, P1, off) {
  const E = norm(sub(P1, P0));
  const side = X => { const w = sub(centroid3(X), P0); return norm(sub(w, mul(E, dot(w, E)))); };
  const eA = side(A), eB = side(B);
  const o = norm(mul(add(eA, eB), -1));
  const outer = [add(P0, mul(o, off)), add(P1, mul(o, off))];
  // normalne skierowane ku drugiej płycie; głębokość = grubość (albo połowa przy blasze symetrycznej)
  const nTo = (X, eOther) => { const n = cross(X.u, X.v); return dot(n, eOther) >= 0 ? n : mul(n, -1); };
  const nA = nTo(A, eB), nB = nTo(B, eA);
  const sA = A.toward === 'center' ? A.t / 2 : A.t, sB = B.toward === 'center' ? B.t / 2 : B.t;
  // punkt q (w przekroju) z dot(q, nA) = sA i dot(q, nB) = sB; q = a·nA + b·nB
  const c = dot(nA, nB), det = 1 - c * c;
  if (det < 1e-6) return [outer];
  const a = (sA - c * sB) / det, b = (sB - c * sA) / det;
  const q = add(add(mul(nA, a), mul(nB, b)), mul(norm(add(nA, nB)), 1.5));
  // (blacha symetryczna: P0 leży w osi, więc powierzchnie są o ±t/2 — sA, sB to już uwzględniają)
  return [outer, [add(P0, q), add(P1, q)]];
}

// ---------- gięcie ----------
/** Rozwinięcie gięcia dla promienia wewnętrznego r ≈ t i współczynnika K = 0,4. */
function bendInfo(t, bendDeg) {
  const r = t, K = 0.4, b = rad(bendDeg);
  const ossb = (r + t) * Math.tan(b / 2), ba = b * (r + K * t);
  return { r, ossb, ba, bd: 2 * ossb - ba };
}
const relief = t => ({ w: Math.max(2, 0.6 * t), d: Math.max(3, t) });

/** Szczeliny na linii gięcia od a do b (2D), grubość t, poziom gęstości. */
function perforation(a, b, t, level) {
  const f = PERF_LEVELS[level]?.f || 0;
  if (!f) return [];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const P = clamp(8 * t, 30, 80);
  const br = Math.max((1 - f) * P, 0.75 * t), s = br * f / (1 - f), w = clamp(t, 2, 8);
  const k = Math.floor((L - br) / (s + br));
  if (k < 1 || s <= w) return [];
  const total = k * s + (k - 1) * br, start = (L - total) / 2;
  const ex = (b[0] - a[0]) / L, ey = (b[1] - a[1]) / L;
  const out = [];
  for (let i = 0; i < k; i++) {
    const s0 = start + i * (s + br);
    out.push(slot2([a[0] + ex * s0, a[1] + ey * s0], [a[0] + ex * (s0 + s), a[1] + ey * (s0 + s)], w));
  }
  return out;
}

/**
 * Podgląd 3D gięcia: nacięcia ułatwiające gięcie (szczeliny) i podcięcia na końcach linii gięcia,
 * pokazane na krawędzi narożnika obu blach (każda traci pół szerokości szczeliny). Tylko bryły 3D –
 * elementy do cięcia mają te otwory już w rozwinięciu. Wycięcia trafiają do pl.viewCuts.
 */
function bendView(A, B, P0, P1, t, level, ends) {
  const E = norm(sub(P1, P0)), L = len(sub(P1, P0)), rf = relief(t), sl = Math.max(0.75 * t, 4);
  const m = ends ? rf.d + sl : sl;
  const segs = perforation([m, 0], [L - m, 0], t, level).map(r => { const xs = r.map(q => q.x); return [Math.min(...xs), Math.max(...xs), clamp(t, 2, 8)]; });
  if (ends) segs.push([-10, rf.d, rf.w], [L - rf.d, L + 10, rf.w]);
  // szczelina przechodzi przez całą strefę gięcia: w ostrym narożniku sięga w każdą blachę aż za wewnętrzną
  // powierzchnię drugiej blachy (jak cofnięcie przy ząbkach) + pół szerokości – widać ją z obu stron
  const side = X => { const w = sub(centroid3(X), P0); return norm(sub(w, mul(E, dot(w, E)))); };
  const eA = side(A), eB = side(B), cos = clamp(dot(eA, eB), -1, 1), sin = Math.max(0.2, Math.sqrt(1 - cos * cos));
  const th = X => (X.toward === 'center' ? X.t / 2 : X.t);
  for (const [X, eX, Y] of [[A, eA, B], [B, eB, A]]) {
    const c = (th(Y) + th(X) * Math.max(0, cos)) / sin;
    const p0 = loc(X, P0), e2 = vec2(X, E), n2 = vec2(X, eX);
    X.viewCuts = (X.viewCuts || []).concat(segs.map(([s0, s1, w]) => rect2(p0, e2, n2, s0, s1, -50, c + w / 2)));
  }
}
/** Bryły 3D z wycięciami podglądu gięcia (kopie – kontury elementów do cięcia bez zmian). */
const viewSolids = solids => solids.map(s => s.viewCuts && s.viewCuts.length ? { ...s, outline: shape([s.outline], s.viewCuts) } : s);

/** Przecięcie konturu z poziomą linią y = Y → [minX, maxX]. */
function spanAtY(outline, Y) {
  const pts = tessellate(outline, 12); let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    if ((y1 - Y) * (y2 - Y) <= 0 && y1 !== y2) { const x = x1 + (Y - y1) / (y2 - y1) * (x2 - x1); lo = Math.min(lo, x); hi = Math.max(hi, x); }
  }
  return [lo, hi];
}

// ---------- stopki ----------
function footPlates(p, corner, z0) {
  const sx = Math.sign(corner[0]), sy = Math.sign(corner[1]);
  const diag = [sx * Math.SQRT1_2, sy * Math.SQRT1_2, 0];
  const hTop = add([corner[0], corner[1], z0], mul(diag, -p.footInset));
  // ten sam sens co kąt ścianek: przesunięcie w x i w y = wysokość · tan(kąt)
  const k = z0 * Math.tan(rad(p.footAngle));
  const hBot = [hTop[0] + sx * k, hTop[1] + sy * k, 0];
  const wings = [[-sx, 0, 0], [0, -sy, 0]].map(dir => ({
    dir,
    top: add(hTop, mul(dir, p.footTop)),
    bot: add(hBot, mul(dir, p.footBottom)),
  }));
  return { hTop, hBot, wings };
}

/** Skrzydło stopki jako płyta: x = odległość od zawiasu, y = wzdłuż zawiasu (w dół). */
function wingPlate(fp, wg, t, toward) {
  const hdir = norm(sub(fp.hBot, fp.hTop));
  const v = sub(wg.top, fp.hTop);
  const u = norm(sub(v, mul(hdir, dot(v, hdir))));
  const pl = plate('foot', [], fp.hTop, u, hdir, t, toward);
  const l = q => { const [x, y] = loc(pl, q); return { x, y }; };
  pl.outline = [{ x: 0, y: 0 }, l(wg.top), l(wg.bot), l(fp.hBot)];
  pl.joints = [[{ x: 0, y: 0 }, l(wg.top)], [{ x: 0, y: 0 }, l(fp.hBot)]];   // spaw do dna, zawias
  return pl;
}

/**
 * Ząbki na górnej krawędzi skrzydła wchodzące w otwory w dnie.
 * Zwraca { tabs: prostokąty w układzie skrzydła, slots: prostokąty w układzie dna } albo null.
 */
function wingTabs(pl, floor, tF, g, m0, lift) {
  const Q0 = [0, 0], q1 = pl.outline[1], Lt = Math.hypot(q1.x, q1.y);
  const e2 = [q1.x / Lt, q1.y / Lt];
  let p2 = [-e2[1], e2[0]];
  const c2 = pl.outline.reduce((s, q) => [s[0] + q.x, s[1] + q.y], [0, 0]);
  if (p2[0] * c2[0] + p2[1] * c2[1] > 0) p2 = [-p2[0], -p2[1]]; // na zewnątrz skrzydła = w górę
  const p3 = norm(add(mul(pl.u, p2[0]), mul(pl.v, p2[1])));
  if (p3[2] < 0.3) return null;
  const m1 = 8, U = Lt - m0 - m1;
  if (U < 15) return null;
  const k = U >= 70 ? 2 : 1;
  const wt = k === 1 ? clamp(U * 0.5, 12, 40) : clamp(U * 0.25, 12, 35);
  const centers = k === 1 ? [m0 + U / 2] : [m0 + U / 4, m0 + 3 * U / 4];
  const h = (lift + tF + WYSTAJE) / p3[2]; // od górnej krawędzi skrzydła przez całe dno + zapas do szlifu
  const nn = inward(pl), [b0, b1] = pl.toward === 'center' ? [-pl.t / 2, pl.t / 2] : [0, pl.t];
  const E3 = norm(sub(at(pl, q1), pl.o)), across = norm(cross([0, 0, 1], E3));
  const tabs = [], slots = [];
  for (const c of centers) {
    const s0 = c - wt / 2, s1 = c + wt / 2;
    tabs.push(rect2(Q0, e2, p2, s0, s1, -1, h));
    let lo = Infinity, hi = -Infinity;
    for (const zz of [lift, lift + tF]) for (const b of [b0, b1]) {
      const a = (zz - b * nn[2]) / p3[2];
      const v = dot(add(mul(p3, a), mul(nn, b)), across);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    const corner = (s, w) => loc(floor, add(add(pl.o, mul(E3, s)), mul(across, w)));
    slots.push([corner(s0 - g, lo - g), corner(s1 + g, lo - g), corner(s1 + g, hi + g), corner(s0 - g, hi + g)]);
  }
  return { tabs, slots };
}

// ---------- tryb „nogi z boków” (fartuch) ----------
// Gdy stopki mają kąt przeciwny do ścianek i stoją w narożnikach, skrzydło stopki leży w płaszczyźnie
// ścianki nad nim. Ścianka przedłuża się więc w dół do ziemi („fartuch”) z wycięciem między nogami,
// a nogi tworzą sąsiednie fartuchy schodzące się w narożniku.
//  • spawana: 4 fartuchy (ząbki na całej wysokości narożnika) + dno wpuszczone ząbkami w szczeliny ścianek;
//  • gięta: 3 blachy – [bok 1 + bok 2] i [bok 3 + bok 4], każda zgięta raz na krawędzi narożnika
//    (na całej wysokości, od czubka nogi do góry), oraz osobne dno. Pozostałe 2 narożniki – spaw na ząbkach.
// Ząbki dna przechodzą na wylot i wystają z boku (widoczne „wczepy”).
const WYSTAJE = 1;                                    // zapas: ząbek wystaje min. tyle ponad powierzchnię (szlif na płasko) [mm]
const TAB_OUT = 3;                                      // ile ząbek dna wystaje na zewnątrz ścianki [mm]
function buildSkirt(p, limits, d) {
  const H = p.legHeight, b2 = p.base / 2, g = p.gap, tB = p.tBowl, B = p.base;
  const bent = !!p.bowlBent;
  const parts = [], solids = [], warnings = [];
  const seams = { weld: [], bend: [] };
  const a = rad(p.angle), vz = Math.cos(a);
  const xL = y => d.flare - d.flare * y / d.slant, xR = y => B + d.flare + d.flare * y / d.slant;
  const yg = (tB * Math.max(0, Math.sin(-a)) - H) / vz; // ziemia: najniższy narożnik blachy (wewnętrzny przy a < 0, zewnętrzny przy a > 0) dotyka podłoża
  const yc0 = -Math.max(15, 2.5 * tB) - g;              // najwyżej: pas pod dnem
  const yc = p.legCut > 0 ? Math.min(yc0, yg + p.legCut / vz) : yc0;   // góra wycięcia między nogami (PROSTY: wysokość nóżek)
  const fT = p.footTop, fB = p.footBottom;

  // kontur fartucha (wycięcie: trapez albo łuk)
  const cutout = () => {
    const A = { x: xL(yg) + fB, y: yg }, Bp = { x: xR(yg) - fB, y: yg };
    if (!p.skirtArch) return [A, { x: xL(yc) + fT, y: yc }, { x: xR(yc) - fT, y: yc }, Bp];
    const c = (Bp.x - A.x) / 2, sag = yc - yg;
    if (sag <= c) return [{ ...A, b: -sag / c }, Bp];                       // łuk koła przez oba końce i wierzchołek
    const yS = yc - c;                                                      // wyższe niż półkole: proste boki + półkole
    return [A, { x: A.x, y: yS, b: -1 }, { x: Bp.x, y: yS }, Bp];
  };
  const skirtOutline = () => {
    const w0 = wallOutline(p, d);
    return [{ x: xL(yg), y: yg }, ...cutout(), { x: xR(yg), y: yg }, ...w0.slice(2)];
  };

  const corners = [[-b2, -b2], [b2, -b2], [b2, b2], [-b2, b2]];
  const isSkirt = () => true;                             // każdy bok ma nogi
  // gięte narożniki (wersja gięta): między bokiem 1 i 2 (narożnik 1) oraz 3 i 4 (narożnik 3)
  const bentCorner = i => bent && i % 2 === 1;
  const walls = corners.map((c, i) => {
    const A3 = [...c, H], B3 = [...corners[(i + 1) % 4], H];
    const t = norm(sub(B3, A3));
    const r = norm([(A3[0] + B3[0]) / 2, (A3[1] + B3[1]) / 2, 0]);
    const w = norm(add(mul(r, d.flare), [0, 0, p.height]));
    const pl = plate('wall', isSkirt(i) ? skirtOutline() : wallOutline(p, d), add(A3, mul(t, -d.flare)), t, w, tB, mul(r, -1));
    pl.num = WALL_NUM[i]; pl.key = String(pl.num); pl.skirt = isSkirt(i);
    return pl;
  });
  const floor = plate('floor', [], [-b2, -b2, H], [1, 0, 0], [0, 1, 0], tB, [0, 0, 1]);
  floor.num = 5; floor.key = '5';

  // --- dno: wpuszczone między ścianki; na krawędziach do fartuchów ząbki przez szczeliny ścianek
  const ins = tB / vz + Math.max(0, -tB * Math.tan(a)) + g;   // od linii krawędzi do wewnętrznej powierzchni ścianki (najgłębiej w grubości dna)
  const tabOut = TAB_OUT + Math.max(0, tB * Math.tan(a));     // ząbek wystaje TAB_OUT także przy górnej krawędzi dna
  const tabEdge = i => isSkirt(i);                       // krawędź dna z ząbkami (pozostałe = gięcie)
  const e0 = i => (tabEdge(i) ? ins : 0);
  // dno: x ∈ [e0(3), B − e0(1)], y ∈ [e0(0), B − e0(2)]  (ścianki: 0 → −y, 1 → +x, 2 → +y, 3 → −x)
  floor.outline = [{ x: e0(3), y: e0(0) }, { x: B - e0(1), y: e0(0) }, { x: B - e0(1), y: B - e0(2) }, { x: e0(3), y: B - e0(2) }];
  floor.joints = [0, 1, 2, 3].map(i => { const P = [[0, 0], [B, 0], [B, B], [0, B]]; const q0 = P[i], q1 = P[(i + 1) % 4]; return [{ x: q0[0], y: q0[1] }, { x: q1[0], y: q1[1] }]; });
  const m0 = Math.max(25, 3 * tB + 12);                  // ząbki z dala od narożników
  const U = B - 2 * m0, k = Math.max(2, Math.min(6, Math.round(U / 110))), wt = clamp(U / (k * 2.2), 15, 45);
  const nn = W => inward(W);
  walls.forEach((W, i) => {
    if (!tabEdge(i)) return;
    const A3 = [...corners[i], H], t = W.u, r = mul(W.toward, -1);           // na zewnątrz
    const yR = [];
    for (const zz of [0, tB]) for (const s of [0, tB]) yR.push((zz - s * nn(W)[2]) / vz);
    const y0 = Math.min(...yR) - g, y1 = Math.max(...yR) + g;
    for (let j = 0; j < k; j++) {
      const c = m0 + U * (j + 0.5) / k, s0 = c - wt / 2, s1 = c + wt / 2;
      const P = (s, o) => loc(floor, add(add(A3, mul(t, s)), mul(r, o)));
      floor.adds.push([P(s0, -ins - 1), P(s1, -ins - 1), P(s1, tabOut), P(s0, tabOut)]);
      W.holes.push([{ x: d.flare + s0 - g, y: y0 }, { x: d.flare + s1 + g, y: y0 }, { x: d.flare + s1 + g, y: y1 }, { x: d.flare + s0 - g, y: y1 }]);
    }
    seams.weld.push(...seam(W, floor, at(W, { x: d.flare, y: 0 }), at(W, { x: d.flare + B, y: 0 }), 1.5).slice(1));
  });

  // --- narożniki: ząbki na całej wysokości (od czubka nogi do góry); w wersji giętej 2 narożniki to gięcia
  for (let i = 0; i < 4; i++) {
    const W = walls[i], prev = walls[(i + 3) % 4];
    const P0 = at(W, { x: xL(yg), y: yg }), P1 = at(W, { x: 0, y: d.slant });
    if (bentCorner(i)) { seams.bend.push(...seam(W, prev, P0, P1, 1.5)); bendView(W, prev, P0, P1, tB, p.perfBowl, false); continue; }
    seams.weld.push(...seam(W, prev, P0, P1, 1.5));
    joint(W, prev, P0, P1, g);
  }
  // strefy przy łączeniach (zdobienia): oba boki na całej wysokości + pas dna
  walls.forEach(W => {
    W.joints = [[{ x: xL(yg), y: yg }, { x: 0, y: d.slant }], [{ x: xR(yg), y: yg }, { x: d.top, y: d.slant }], [{ x: d.flare, y: 0 }, { x: d.flare + B, y: 0 }]];
  });

  walls.forEach(finish); finish(floor);
  walls.forEach(w => solids.push({ kind: 'wall', ...w }));
  solids.push({ kind: 'floor', ...floor });

  const bendF = bendInfo(tB, 90 - p.angle), rf = relief(tB);
  if (!bent) {
    parts.push({ id: 'wall', name: 'Ścianka z nogami', code: 'SCIANKA_NOGI', qty: 4, t: tB, outline: walls[0].outline, holes: walls[0].holes,
      copies: walls.map(w => [{ key: w.key }]) });
    parts.push({ id: 'floor', name: 'Dno', code: 'DNO', qty: 1, t: tB, outline: floor.outline, holes: floor.holes, copies: [[{ key: '5' }]] });
  } else {
    // dwa kątowniki: bok 1 (indeks 0) + bok 2 (indeks 1) zgięte w narożniku 1; drugi taki sam: bok 3 + bok 4
    const S = walls[0], N = walls[1];
    const C0 = at(N, { x: xL(0), y: 0 }), Cg = at(N, { x: xL(yg), y: yg });   // krawędź narożnika (lewy bok N = prawy bok S)
    const Dc = norm(sub(Cg, C0));
    const side = X => { const w = sub(centroid3(X), C0); return norm(sub(w, mul(Dc, dot(w, Dc)))); };
    const dihedral = Math.acos(clamp(dot(side(S), side(N)), -1, 1)) * 180 / Math.PI;
    const bc = bendInfo(tB, 180 - dihedral);
    const c0 = loc(S, C0), dc2 = vec2(S, Dc), dl = Math.hypot(dc2[0], dc2[1]), dc = [dc2[0] / dl, dc2[1] / dl];
    let n2 = [-dc[1], dc[0]];
    const cs = S.outline.reduce((q, v) => [q[0] + v.x, q[1] + v.y], [0, 0]).map(v => v / S.outline.length);
    if ((cs[0] - c0[0]) * n2[0] + (cs[1] - c0[1]) * n2[1] > 0) n2 = [-n2[0], -n2[1]];   // na zewnątrz boku S
    const unf = q => {
      const P3 = at(N, q), s = dot(sub(P3, C0), Dc), dist = len(sub(sub(P3, C0), mul(Dc, s)));
      return [c0[0] + dc[0] * s + n2[0] * (dist - bc.bd), c0[1] + dc[1] * s + n2[1] * (dist - bc.bd)];
    };
    // rozwinięcie jest obrotem (bez lustra)? – od tego zależy znak łuków (bulge)
    const o0 = unf({ x: 0, y: 0 }), ox = unf({ x: 1, y: 0 }), oy = unf({ x: 0, y: 1 });
    const det = (ox[0] - o0[0]) * (oy[1] - o0[1]) - (ox[1] - o0[1]) * (oy[0] - o0[0]);
    const mN = q => { const [x, y] = unf(q); return { x, y, b: q.b ? (det > 0 ? q.b : -q.b) : undefined }; };
    const out = shape([S.outline, N.outline.map(mN)]);
    const holes = [...S.holes, ...N.holes.map(h => h.map(mN))];
    // linia gięcia na całej długości narożnika
    const off = bc.ossb - bc.ba / 2;
    const ends = [at(N, { x: xL(yg), y: yg }), at(N, { x: 0, y: d.slant })].map(P3 => { const s = dot(sub(P3, C0), Dc); return [c0[0] + dc[0] * s - n2[0] * off, c0[1] + dc[1] * s - n2[1] * off]; });
    const sl = Math.max(0.75 * tB, 4), Lb = Math.hypot(ends[1][0] - ends[0][0], ends[1][1] - ends[0][1]);
    const ux = (ends[1][0] - ends[0][0]) / Lb, uy = (ends[1][1] - ends[0][1]) / Lb;
    holes.push(...perforation([ends[0][0] + ux * sl, ends[0][1] + uy * sl], [ends[1][0] - ux * sl, ends[1][1] - uy * sl], tB, p.perfBowl));
    parts.push({ id: 'corner', name: 'Kątownik: 2 boki z nogami', code: 'BOKI_GIETE', qty: 2, t: tB, outline: out, holes,
      folds: [[{ x: ends[0][0], y: ends[0][1] }, { x: ends[1][0], y: ends[1][1] }]],
      note: `1 giecie na krawedzi narozy (od czubka nogi do gory), kat miedzy bokami ${dihedral.toFixed(1)} deg`,
      copies: [[{ key: walls[0].key }, { key: walls[1].key, map: mN }], [{ key: walls[2].key }, { key: walls[3].key, map: mN }]] });
    parts.push({ id: 'floor', name: 'Dno', code: 'DNO', qty: 1, t: tB, outline: floor.outline, holes: floor.holes, copies: [[{ key: '5' }]] });
    const bb = bbox(out), w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
    if (Math.max(w, h) > 3000 || Math.min(w, h) > 1500) warnings.push(`Kątownik ma ${Math.round(w)} × ${Math.round(h)} mm — sprawdź format blachy u wykonawcy.`);
  }
  if (p.angle < -20) warnings.push('Mocno zwężona misa — ogień będzie miał mało powietrza.');
  const foot = B - 2 * H * Math.tan(a);                  // rozstaw nóg przy ziemi
  const stab = stabilnosc(p);                            // PROSTY: stabilność liczona na bieżąco (szerokość dołu, kąt, wysokość)
  if (stab.poziom) warnings.unshift(stab.tekst);
  else if (Math.abs(p.angle) < 3 && H > 150) warnings.push('Prawie pionowe nogi z boków przy wysokich stopkach — palenisko może się chwiać.');
  return finishModel(p, limits, d, parts, solids, warnings, seams, { wingAngle: null, tabs: true, bend: bendF, skirt: true });
}

/**
 * Stabilność paleniska ze ściankami-nogami: czy łatwo je przewrócić. Zależy od rozstawu nóg przy ziemi,
 * rozchylenia ścianek i wysokości. Liczone dwa proste wskaźniki:
 *  • kat – o ile stopni trzeba przechylić palenisko, żeby samo się przewróciło (środek ciężkości nad krawędzią podparcia);
 *          brany gorszy z dwóch przypadków: puste / pełne drewna (drewno podnosi środek ciężkości);
 *  • obc – ile kilogramów opartych o górną krawędź (ktoś się oprze, ciężkie polano, ruszt z garnkiem) przewraca puste palenisko.
 * Progi (PROGI_STAB) to założenia autora, nie norma – do sprawdzenia na prawdziwym palenisku.
 */
export const PROGI_STAB = { zle: { kat: 15, obc: 8 }, slabo: { kat: 22, obc: 15 } };
export function stabilnosc(p) {
  const a = rad(p.angle), tg = Math.tan(a), H = p.legHeight, h = p.height, B = p.base, Ht = H + h;
  const F = Math.max(1, B - 2 * H * tg), top = B + 2 * h * tg;             // rozstaw nóg przy ziemi, górny obrys
  // masa i środek ciężkości stali: 4 ścianki (trapez od ziemi do góry, bez wycięcia między nogami) + dno
  const Aw = (F + top) / 2 * Ht / Math.cos(a), zw = Ht * (F + 2 * top) / (3 * (F + top));
  const wc = Math.max(0, F - 2 * (p.footBottom || 0)), hc = Math.min(p.legCut || 0, H), Ac = 0.8 * wc * hc / Math.cos(a), zc = 0.45 * hc;
  const mW = 4 * (Aw - Ac) * p.tBowl * STEEL_DENSITY, zW = (Aw * zw - Ac * zc) / Math.max(1, Aw - Ac);
  const mD = B * B * p.tBowl * STEEL_DENSITY, M = mW + mD, z0 = (mW * zW + mD * H) / M;
  // drewno do pełna: ok. 200 kg/m³ luźno ułożonych polan; środek ciężkości ostrosłupa ściętego
  const q = B * B + B * top + top * top, mDr = 200e-9 * h / 3 * q, zDr = H + h / 4 * (B * B + 2 * B * top + 3 * top * top) / q;
  const z1 = (M * z0 + mDr * zDr) / (M + mDr);
  const kat = Math.atan2(F / 2, Math.max(z0, z1)) * 180 / Math.PI;
  const wys = (top - F) / 2, obc = wys > 1 ? M * (F / 2) / wys : Infinity;   // wysięg krawędzi poza nogi → ciężar, który przewraca
  const P = PROGI_STAB, poziom = kat < P.zle.kat || obc < P.zle.obc ? 2 : kat < P.slabo.kat || obc < P.slabo.obc ? 1 : 0;
  let tekst = '';
  if (poziom) {
    const powod = obc / P.slabo.obc < kat / P.slabo.kat ? `przewróci je ok. ${Math.max(1, Math.round(obc))} kg opartych o krawędź` : `przewróci się przy przechyle ok. ${Math.round(kat)}°`;
    tekst = `${poziom === 2 ? 'Łatwo wywrotne' : 'Mało stabilne'}: ${powod} (nogi przy ziemi ${Math.round(F)} mm, góra ${Math.round(top)} mm). Zmniejsz rozchylenie, poszerz dół albo obniż palenisko.`;
  }
  return { poziom, kat, obc, rozstaw: F, top, masa: M, tekst };
}

/** Przecięcie konturu z pionową linią x = X → [minY, maxY]. */
function spanAtX(outline, X) {
  const sw = outline.map(q => ({ x: q.y, y: q.x, b: q.b ? -q.b : undefined }));
  return spanAtY(sw, X);
}

/** Statystyki i zwracany model (wspólne dla obu trybów). */
function finishModel(p, limits, d, parts, solids, warnings, seams, extra) {
  let mass = 0, area = 0, cut = 0, pierces = 0;
  parts.forEach(pt => {
    const holes = pt.holes || [];
    const A = polygonArea(pt.outline) - holes.reduce((s, h) => s + polygonArea(h), 0);
    const P = perimeter(pt.outline) + holes.reduce((s, h) => s + perimeter(h), 0);
    pt.area = A; pt.perimeter = P; pt.pierces = 1 + holes.length;
    area += A * pt.qty; cut += P * pt.qty; mass += A * pt.t * STEEL_DENSITY * pt.qty; pierces += pt.pierces * pt.qty;
  });
  let ext = 0;
  solids.forEach(s => s.outline.forEach(q => { const P = at(s, q); ext = Math.max(ext, Math.abs(P[0]), Math.abs(P[1])); }));
  if (d.top > 1000) warnings.push('Górny obrys ponad 1000 mm — sprawdź format blachy u wykonawcy.');
  return {
    params: p, limits, derived: { ...d, ...extra },
    parts, solids: viewSolids(solids), warnings, seams,
    stats: { mass, area, cut, pierces, width: 2 * ext, height: p.legHeight + p.height },
  };
}

// ---------- model ----------
export function build(input) {
  const { params: p, limits } = constrain(input);
  const d = derive(p);
  if (p.skirt) return buildSkirt(p, limits, d);
  const H = p.legHeight, b2 = p.base / 2, g = p.gap, tB = p.tBowl, tL = p.tLeg;
  const bent = !!p.bowlBent, bentAll = p.bowlBent === 2;   // bentAll: dno + 4 ścianki z jednej blachy (krzyż)
  const parts = [], solids = [], warnings = [];

  // --- misa: 4 ścianki + dno (zewnętrzne powierzchnie = obrys nominalny, grubość do środka)
  const corners = [[-b2, -b2], [b2, -b2], [b2, b2], [-b2, b2]];
  const wall0 = wallOutline(p, d);
  const walls = corners.map((c, i) => {
    const a = [...c, H], bb = [...corners[(i + 1) % 4], H];
    const t = norm(sub(bb, a));
    const r = norm([(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2, 0]);
    const w = norm(add(mul(r, d.flare), [0, 0, p.height]));
    return plate('wall', wall0.map(q => ({ ...q })), add(a, mul(t, -d.flare)), t, w, tB, mul(r, -1));
  });
  const floor = plate('floor', [{ x: 0, y: 0 }, { x: p.base, y: 0 }, { x: p.base, y: p.base }, { x: 0, y: p.base }],
    [-b2, -b2, H], [1, 0, 0], [0, 1, 0], tB, [0, 0, 1]);
  // Numery elementów (zdobienia, DXF): 1 – bok z przodu (−y, do widza w widoku „z przodu”), 2 – prawy (+x), 3 – tył, 4 – lewy, 5 – dno, 6–9 – stopki (6 między 1 i 2, dalej w kółko).
  walls.forEach((w, i) => {
    w.num = WALL_NUM[i]; w.key = String(w.num);
    w.joints = [[{ x: d.flare, y: 0 }, { x: 0, y: d.slant }], [{ x: d.flare + p.base, y: 0 }, { x: d.top, y: d.slant }],
      [{ x: d.flare, y: 0 }, { x: d.flare + p.base, y: 0 }]];
  });
  floor.num = 5; floor.key = '5';
  floor.joints = [[{ x: 0, y: 0 }, { x: p.base, y: 0 }], [{ x: p.base, y: 0 }, { x: p.base, y: p.base }],
    [{ x: p.base, y: p.base }, { x: 0, y: p.base }], [{ x: 0, y: p.base }, { x: 0, y: 0 }]];

  // linie spawów i gięć do podglądu 3D (lekko odsunięte na zewnątrz krawędzi, żeby były widoczne)
  const seams = { weld: [], bend: [] };
  // ząbki: ścianka–ścianka w każdym narożniku (lewa krawędź ścianki i ma ząbki na końcach)
  let wf = null;
  for (let i = 0; i < 4; i++) {
    const W = walls[i], prev = walls[(i + 3) % 4];
    const P0 = at(W, { x: d.flare, y: 0 }), P1 = at(W, { x: 0, y: d.slant });
    seams.weld.push(...seam(W, prev, P0, P1, 1.5));
    if (bentAll) { if (i % 2) lap(prev, W, P0, P1, g); else lap(W, prev, P0, P1, g); }   // ścianki 2 i 4 cofnięte, bez ząbków (gięcie ich nie przepuści)
    else joint(W, prev, P0, P1, g);
  }
  // ścianka–dno (w wersji giętej ścianki 0 i 2 są jednym elementem z dnem)
  for (let i = 0; i < 4; i++) {
    const P0 = [...corners[i], H], P1 = [...corners[(i + 1) % 4], H];
    // linia ścianka–dno nieco wyżej i na zewnątrz (na ściance) – stopki pod spodem jej nie zasłaniają; spaw stopek osobno, niżej
    const ex = P1[0] - P0[0], ey = P1[1] - P0[1], el = Math.hypot(ex, ey) || 1; let nx = ey / el, ny = -ex / el;
    if (nx * (P0[0] + P1[0]) + ny * (P0[1] + P1[1]) < 0) { nx = -nx; ny = -ny; }
    const naSciane = L => L.map(q => [q[0] + nx * 2.5, q[1] + ny * 2.5, q[2] + 4]);
    if (bentAll || (bent && i % 2 === 0)) { seams.bend.push(...seam(walls[i], floor, P0, P1, 1.5).map((L, k) => k ? L : naSciane(L))); bendView(walls[i], floor, P0, P1, tB, p.perfBowl, true); continue; }
    seams.weld.push(...seam(walls[i], floor, P0, P1, 1.5).map((L, k) => k ? L : naSciane(L)));
    wf = joint(walls[i], floor, P0, P1, g);
  }
  const bend = bendInfo(tB, 90 - p.angle);
  const floorZone = Math.max(wf ? wf.cB : 0, bent ? 2 * tB : 0) + g + 5;

  // --- stopki
  const hasFeet = H >= 20;
  const feet = [];
  let tabsOn = false, footInfo = null;
  if (hasFeet) {
    const make = z0 => corners.map(c => {
      const fp = footPlates(p, c, z0);
      const pls = fp.wings.map(wg => wingPlate(fp, wg, tL, 'center'));
      if (!p.legBent) pls.forEach((pl, k) => { pl.toward = pls[1 - k].u; });
      return { fp, pls, owner: c[0] * c[1] > 0 ? 0 : 1 }; // ten sam układ w każdym narożniku (obrót o 90°)
    });
    // Pochylona blacha cięta prostopadle: górny róg od środka wychodzi ponad krawędź.
    // Obniżamy stopki tak, by najwyższy punkt skrzydła dotykał spodu dna (szczelinę wypełni spoina).
    const rise = pl => { const nz = inward(pl)[2], [b0, b1] = pl.toward === 'center' ? [-pl.t / 2, pl.t / 2] : [0, pl.t]; return Math.max(0, b0 * nz, b1 * nz); };
    // przy ściankach zwężających się ku górze dolny róg ścianki wystaje pod dno — stopki też go omijają
    const wallDip = Math.max(0, -inward(walls[0])[2] * tB);
    const lift = Math.max(wallDip, ...make(H).flatMap(f => f.pls.map(rise)));
    feet.push(...make(H - lift));
    feet.forEach((f, fi) => {
      f.num = FOOT_NUM[fi];
      const aIdx = f.owner;   // A/B jak w wersji spawanej – wzory zostają na tych samych skrzydłach po zmianie na gięte
      f.pls.forEach((pl, k) => { pl.num = f.num; pl.key = f.num + (k === aIdx ? 'A' : 'B'); });
    });
    feet.forEach(f => {
      // zawias: spaw albo gięcie; góra każdego skrzydła: spaw do dna (po zewnętrznej stronie skrzydła)
      const [w0, w1] = f.pls;
      (p.legBent ? seams.bend : seams.weld).push(...seam(w0, w1, f.fp.hTop, f.fp.hBot, p.legBent ? tL / 2 + 1.5 : 1.5));
      if (p.legBent) bendView(w0, w1, f.fp.hTop, f.fp.hBot, tL, p.perfLeg, true);
      f.pls.forEach((pl, k) => {
        // spaw góry skrzydła z dnem — po obu stronach blachy
        const n = cross(pl.u, pl.v), nIn = dot(n, f.pls[1 - k].u) >= 0 ? n : mul(n, -1), down = [0, 0, -4];   // niżej niż linia gięcia misy – obie widoczne (gięcie wyżej, spaw stopki niżej)
        const [f0, f1] = pl.toward === 'center' ? [-(pl.t / 2 + 1.5), pl.t / 2 + 1.5] : [-1.5, pl.t + 1.5];
        seams.weld.push([add(add(pl.o, mul(nIn, f0 - 1)), down), add(add(at(pl, pl.outline[1]), mul(nIn, f0 - 1)), down)]);   // zewnętrzna strona skrzydła, pod linią misy
      });
    });
    let hinge = null;
    if (!p.legBent) feet.forEach(f => {
      const A = f.pls[f.owner], B = f.pls[1 - f.owner];
      hinge = joint(A, B, f.fp.hTop, f.fp.hBot, g);
    });
    const ref = feet[2]; // narożnik (+,+)
    const between = Math.acos(clamp(dot(ref.pls[0].u, ref.pls[1].u), -1, 1)) * 180 / Math.PI;
    footInfo = { wingAngle: between, hingeLength: len(sub(ref.fp.hBot, ref.fp.hTop)) };
    // ząbki stopka → dno, gdy góra stopki leży pod dnem z dala od połączeń ze ściankami
    const m0 = Math.max(hinge ? Math.max(hinge.cA, hinge.cB) : 0, 2 * tL) + g + 6;
    const res = feet.map(f => f.pls.map(pl => wingTabs(pl, floor, tB, g, m0, lift)));
    const ok = res.every(r => r.every(x => x && x.slots.every(s => s.every(([x0, y0]) =>
      x0 >= floorZone && y0 >= floorZone && x0 <= p.base - floorZone && y0 <= p.base - floorZone))));
    if (ok) {
      tabsOn = true;
      feet.forEach((f, fi) => f.pls.forEach((pl, k) => {
        pl.adds.push(...res[fi][k].tabs);
        floor.holes.push(...res[fi][k].slots.map(r => r.map(([x, y]) => ({ x, y }))));
      }));
    }
  }

  // --- wykończenie konturów
  walls.forEach(finish); finish(floor);
  feet.forEach(f => f.pls.forEach(finish));

  // --- bryły 3D
  walls.forEach(w => solids.push({ kind: 'wall', ...w }));
  solids.push({ kind: 'floor', ...floor });
  feet.forEach(f => f.pls.forEach(pl => solids.push({ kind: 'foot', ...pl })));

  // --- elementy do cięcia
  const rf = relief(tB);
  if (!bent) {
    parts.push({ id: 'wall', name: 'Ścianka', code: 'SCIANKA', qty: 4, t: tB, outline: walls[0].outline,
      copies: walls.map(w => [{ key: w.key }]) });
    parts.push({ id: 'floor', name: 'Dno', code: 'DNO', qty: 1, t: tB, outline: floor.outline, holes: floor.holes,
      copies: [[{ key: '5' }]] });
  } else if (bentAll) {
    // Misa „krzyż”: dno + 4 ścianki rozwinięte wokół 4 linii gięcia (rozwinięcie dla r ≈ t).
    // Narożniki: ścianki 1 i 3 (indeksy 0, 2) sięgają narożnika, 2 i 4 są cofnięte o grubość – spaw w narożniku.
    // W narożnikach dna okrągłe podcięcie na przecięciu linii gięcia (blacha nie pęka, ścianki się nie blokują).
    const BD = bend.bd, f0 = d.flare, B = p.base;
    const flip = q => (q.b ? -q.b : undefined);
    const mp = [
      q => ({ x: q.x - f0, y: BD - q.y, b: flip(q) }),
      q => ({ x: B - BD + q.y, y: q.x - f0, b: flip(q) }),
      q => ({ x: B + f0 - q.x, y: B - BD + q.y, b: flip(q) }),
      q => ({ x: BD - q.y, y: B + f0 - q.x, b: flip(q) }),
    ];
    let X = shape([floor.outline, ...walls.map((w, i) => w.outline.map(mp[i]))]);
    const yF = bend.ossb - bend.ba / 2, Rr = Math.max(rf.d, bend.ba / 2 + 0.6 * tB);
    const circ = (cx, cy, r) => Array.from({ length: 28 }, (_, k) => [cx + r * Math.cos(k * Math.PI / 14), cy + r * Math.sin(k * Math.PI / 14)]);
    const cuts = [[yF, yF], [B - yF, yF], [B - yF, B - yF], [yF, B - yF]].map(([x, y]) => circ(x, y, Rr));
    X = shape([X], cuts);
    const a0 = yF + Rr, a1 = B - yF - Rr, sl = Math.max(0.75 * tB, 4);
    const folds = [
      [{ x: a0, y: yF }, { x: a1, y: yF }], [{ x: B - yF, y: a0 }, { x: B - yF, y: a1 }],
      [{ x: a0, y: B - yF }, { x: a1, y: B - yF }], [{ x: yF, y: a0 }, { x: yF, y: a1 }],
    ];
    const holes = [...floor.holes];
    for (const [A, C] of folds) {
      const dx = Math.sign(C.x - A.x), dy = Math.sign(C.y - A.y);
      holes.push(...perforation([A.x + dx * sl, A.y + dy * sl], [C.x - dx * sl, C.y - dy * sl], tB, p.perfBowl));
    }
    parts.push({ id: 'bowl', name: 'Misa (dno + 4 ścianki)', code: 'MISA_KRZYZ', qty: 1, t: tB, outline: X, holes, folds,
      note: `4 giecia po ${(90 - p.angle).toFixed(0)} deg, rozwiniecie dla promienia ok. ${tB} mm, naroza spawane`,
      copies: [[{ key: '5' }, ...walls.map((w, i) => ({ key: w.key, map: mp[i] }))]] });
    const bb = bbox(X), w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
    if (Math.max(w, h) > 3000 || Math.min(w, h) > 1500) warnings.push(`Element misy ma ${Math.round(w)} × ${Math.round(h)} mm — sprawdź format blachy u wykonawcy.`);
  } else {
    // Misa „U”: dno + ścianki 0 i 2 rozwinięte wokół linii gięcia (rozwinięcie dla r ≈ t).
    const BD = bend.bd, f0 = d.flare, B = p.base;
    const m0 = q => ({ x: q.x - f0, y: BD - q.y, b: q.b ? -q.b : undefined });
    const m2 = q => ({ x: B + f0 - q.x, y: B - BD + q.y, b: q.b ? -q.b : undefined });
    let U = shape([floor.outline, walls[0].outline.map(m0), walls[2].outline.map(m2)]);
    const yF = [bend.ossb - bend.ba / 2, B - (bend.ossb - bend.ba / 2)];
    const cuts = [], holes = [...floor.holes], folds = [];
    for (const Y of yF) {
      const [lo, hi] = spanAtY(U, Y);
      cuts.push(rect2([lo, Y], [1, 0], [0, 1], -10, rf.d, -rf.w / 2, rf.w / 2));
      cuts.push(rect2([hi, Y], [1, 0], [0, 1], -rf.d, 10, -rf.w / 2, rf.w / 2));
      folds.push([{ x: lo, y: Y }, { x: hi, y: Y }]);
      const sl = Math.max(0.75 * tB, 4);
      holes.push(...perforation([lo + rf.d + sl, Y], [hi - rf.d - sl, Y], tB, p.perfBowl));
    }
    U = shape([U], cuts);
    parts.push({ id: 'bowl', name: 'Misa (dno + 2 ścianki)', code: 'MISA_U', qty: 1, t: tB, outline: U, holes, folds,
      note: `2 giecia po ${(90 - p.angle).toFixed(0)} deg, rozwiniecie dla promienia ok. ${tB} mm`,
      copies: [[{ key: '5' }, { key: walls[0].key, map: m0 }, { key: walls[2].key, map: m2 }]] });
    parts.push({ id: 'wall', name: 'Ścianka', code: 'SCIANKA', qty: 2, t: tB, outline: walls[1].outline,
      copies: [[{ key: walls[1].key }], [{ key: walls[3].key }]] });
    const bb = bbox(U), w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
    if (Math.max(w, h) > 3000 || Math.min(w, h) > 1500) warnings.push(`Element misy ma ${Math.round(w)} × ${Math.round(h)} mm — sprawdź format blachy u wykonawcy.`);
  }

  if (hasFeet) {
    const ref = feet[2];
    if (p.legBent) {
      // jedna blacha: skrzydło 0 tak jak w układzie, skrzydło 1 odbite względem zawiasu
      const L = footInfo.hingeLength, rl = relief(tL);
      const w0 = ref.pls[0].outline, w1 = ref.pls[1].outline.map(q => ({ x: -q.x, y: q.y }));
      let out = shape([w0, w1], [
        rect2([0, 0], [0, 1], [1, 0], -10, rl.d, -rl.w / 2, rl.w / 2),
        rect2([0, L], [0, 1], [1, 0], -rl.d, 10, -rl.w / 2, rl.w / 2),
      ]);
      const sl = Math.max(0.75 * tL, 4);
      const mx = q => ({ x: -q.x, y: q.y, b: q.b ? -q.b : undefined });
      parts.push({ id: 'foot', name: 'Stopka', code: 'STOPKA', qty: 4, t: tL, outline: out,
        holes: perforation([0, rl.d + sl], [0, L - rl.d - sl], tL, p.perfLeg),
        folds: [[{ x: 0, y: 0 }, { x: 0, y: L }]],
        copies: feet.map(f => [{ key: f.pls[0].key }, { key: f.pls[1].key, map: mx }]),
        note: `giecie wzdluz linii, kat miedzy skrzydlami ${footInfo.wingAngle.toFixed(1)} deg` });
    } else {
      const A = ref.pls[ref.owner], Bw = ref.pls[1 - ref.owner];
      parts.push({ id: 'footA', name: 'Stopka A', code: 'STOPKA_A', qty: 4, t: tL, outline: A.outline,
        note: `spawana z STOPKA_B, kat miedzy skrzydlami ${footInfo.wingAngle.toFixed(1)} deg`,
        copies: feet.map(f => [{ key: f.num + 'A' }]) });
      parts.push({ id: 'footB', name: 'Stopka B', code: 'STOPKA_B', qty: 4, t: tL, outline: Bw.outline,
        copies: feet.map(f => [{ key: f.num + 'B' }]) });
    }
  }
  if ((p.bowlBent && p.perfBowl === 3) || (hasFeet && p.legBent && p.perfLeg === 3)) warnings.push('Gęste nacięcia wyraźnie osłabiają linię gięcia.');

  // Statystyki
  let mass = 0, area = 0, cut = 0, pierces = 0;
  parts.forEach(pt => {
    const holes = pt.holes || [];
    const A = polygonArea(pt.outline) - holes.reduce((s, h) => s + polygonArea(h), 0);
    const P = perimeter(pt.outline) + holes.reduce((s, h) => s + perimeter(h), 0);
    pt.area = A; pt.perimeter = P; pt.pierces = 1 + holes.length;
    area += A * pt.qty; cut += P * pt.qty; mass += A * pt.t * STEEL_DENSITY * pt.qty; pierces += pt.pierces * pt.qty;
  });
  let ext = 0;
  solids.forEach(s => s.outline.forEach(q => {
    const P = at(s, q);
    ext = Math.max(ext, Math.abs(P[0]), Math.abs(P[1]));
  }));

  if (p.legHeight > 0 && !hasFeet) warnings.push('Stopki niższe niż ok. 2 cm są pomijane — ustaw 0 albo więcej.');
  if (hasFeet && p.footBottom > p.footTop * 1.8) warnings.push('Dolna część stopek dużo szersza niż górna — sprawdź stabilność spoiny.');
  if (hasFeet && p.legHeight > 350 && p.footAngle < 5) warnings.push('Wysokie stopki bez rozstawu — palenisko może być chwiejne.');
  if (p.angle < -20) warnings.push('Mocno zwężona misa — ogień będzie miał mało powietrza.');
  if (d.top > 1000) warnings.push('Górny obrys ponad 1000 mm — sprawdź format blachy u wykonawcy.');

  return {
    params: p, limits, derived: { ...d, wingAngle: footInfo ? footInfo.wingAngle : null, tabs: tabsOn, bend },
    parts, solids: viewSolids(solids), warnings, seams,
    stats: { mass, area, cut, pierces, width: 2 * ext, height: H + p.height },
  };
}

// ---------- narzędzia 2D ----------
/** Rozwija łuki (bulge) na odcinki. */
export function tessellate(outline, seg = 12) {
  const out = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    out.push([a.x, a.y]);
    if (a.b) {
      const theta = 4 * Math.atan(a.b);
      const dx = b.x - a.x, dy = b.y - a.y, c = Math.hypot(dx, dy);
      const r = c / (2 * Math.sin(theta / 2));
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const hgt = r * Math.cos(theta / 2);
      // środek po lewej stronie cięciwy dla bulge > 0
      const cx = mx - dy / c * hgt, cy = my + dx / c * hgt;
      const a0 = Math.atan2(a.y - cy, a.x - cx);
      for (let k = 1; k < seg; k++) {
        const ang = a0 + theta * k / seg;
        out.push([cx + Math.abs(r) * Math.cos(ang), cy + Math.abs(r) * Math.sin(ang)]);
      }
    }
  }
  return out;
}

export function polygonArea(outline) {
  const pts = tessellate(outline, 24);
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function perimeter(outline) {
  const pts = tessellate(outline, 24);
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += Math.hypot(x2 - x1, y2 - y1);
  }
  return s;
}

export function bbox(outline) {
  const pts = tessellate(outline, 8);
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Rozmieszczenie wszystkich sztuk na płaszczyźnie (pasy), odstęp `gap` mm. */
export function layout(parts, gap = 20, rowWidth = 2200) {
  const items = [];
  parts.forEach(pt => { for (let k = 0; k < pt.qty; k++) items.push({ part: pt, index: k + 1 }); });
  let x = 0, y = 0, rowH = 0, maxX = 0;
  const placed = items.map(it => {
    const bb = bbox(it.part.outline), w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
    if (x > 0 && x + w > rowWidth) { x = 0; y += rowH + gap + 30; rowH = 0; }
    const pl = { ...it, dx: x - bb.minX, dy: y - bb.minY, w, h, x, y };
    x += w + gap; rowH = Math.max(rowH, h); maxX = Math.max(maxX, x - gap);
    return pl;
  });
  return { placed, width: maxX, height: y + rowH };
}
