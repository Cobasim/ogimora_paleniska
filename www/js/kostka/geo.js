// OGIMORA – kostka (sześcian do nauki spawania): geometria. Jednostki: mm.
//
// Zasada „styk 1” (złącze narożne otwarte): każda ścianka to WEWNĘTRZNA ściana bryły (bryła pomniejszona o grubość
// blachy z każdej strony), a grubość narasta na zewnątrz. Sąsiednie ścianki stykają się więc wewnętrznymi krawędziami,
// a na zewnątrz zostaje rowek na spoinę (90° między kwadratami, ok. 55° między kwadratem a trójkątem narożnika).
//
// Zamki ustalające – w parach: ząbek tej ścianki, obok ząbek sąsiadki. Ząbek leży w płaszczyźnie swojej ścianki,
// wychodzi za wewnętrzną krawędź i wypełnia rowek do lica sąsiadki. Reguła „najpierw mój ząbek, potem sąsiadki”
// (idąc po obrysie przeciwnie do wskazówek zegara, patrząc z zewnątrz) daje identyczne wszystkie kwadraty
// i identyczne wszystkie trójkąty.
//  • kąt 90° (kwadrat–kwadrat): ząbek opiera się o krawędź sąsiadki, długość = grubość blachy;
//  • kąt rozwarty (kwadrat–trójkąt, 125,26°): ząbek ma długość t·ctg(θ/2), a sąsiadka ma pod nim wcięcie
//    t·|cos θ|/sin θ + luz – inaczej blachy cięte prostopadle weszłyby w siebie.

export const GESTOSC = 7.85e-6;                      // kg / mm³
const S3 = Math.sqrt(3);
export const KAT_TROJKAT = Math.acos(-1 / S3);       // kąt wewnętrzny kwadrat–trójkąt (125,26°)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const snap = v => Math.round(v * 1e4) / 1e4 || 0;

/** Najmniejsze ścięcie narożnika, przy którym trójkąt ma jeszcze sensowną wielkość (bok wewnętrzny ≥ 14 mm). */
export const sciecieMin = t => Math.ceil((3 - S3) * t + 10);
/** Granice parametrów (mm). */
export const LIM = { a: [100, 712], g: [0.1, 1.55] };   // 712 = 28 cali

export function ogranicz(p) {
  const q = { ...p };
  q.a = Math.min(LIM.a[1], Math.max(LIM.a[0], +q.a || 250));
  q.t = +q.t || 3;
  q.g = Math.min(LIM.g[1], Math.max(0.05, +q.g || 0.3));
  q.c = Math.max(0, +q.c || 0);
  if (q.c > 0) q.c = Math.min(q.a / 2, Math.max(sciecieMin(q.t), q.c));
  q.zamki = q.zamki !== false;
  return q;
}

/** Pary zamków na krawędzi o długości L: początki par (od początku krawędzi), szerokość ząbka w. */
function pary(L, t, g, eMax) {
  const w = Math.min(14, Math.max(6, 2.5 * t));
  const para = 2 * w + g, m = eMax + t + 3, wolne = L - 2 * m;
  if (wolne < para) return { w, starty: [] };
  let n = Math.min(6, Math.max(2, Math.round(L / 120)));
  while (n > 1 && n * para + (n - 1) * 12 > wolne) n--;
  const starty = [];
  for (let k = 0; k < n; k++) starty.push(Math.min(L - m - para, Math.max(m, L * (k + 0.5) / n - para / 2)));
  return { w, starty };
}

const pole2 = r => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

/**
 * Obrys z zamkami: wielokąt bazowy (CCW) z ząbkami i wcięciami wpisanymi wprost w każdą krawędź
 * (bez działań na wielokątach – same proste odcinki). krawedzie[i] = { kat } dla krawędzi i → i+1.
 */
function obrysZamki(baza, krawedzie, t, g, zamki) {
  const ring = []; let ile = 0;
  baza.forEach((P0, i) => {
    const P1 = baza[(i + 1) % baza.length], dx = P1[0] - P0[0], dy = P1[1] - P0[1], L = Math.hypot(dx, dy);
    const E = [dx / L, dy / L], N = [E[1], -E[0]];            // N – na zewnątrz obrysu (obrys przeciwnie do wskazówek zegara)
    const P = (s, d) => ring.push([snap(P0[0] + E[0] * s + N[0] * d), snap(P0[1] + E[1] * s + N[1] * d)]);
    P(0, 0);
    krawedzie[i].L = L; krawedzie[i].pary = 0;
    if (!zamki) return;
    const th = krawedzie[i].kat, e = t / Math.tan(th / 2), r = th > Math.PI / 2 + 1e-6 ? t * Math.abs(Math.cos(th)) / Math.sin(th) : 0;
    const { w, starty } = pary(L, t, g, e);
    krawedzie[i].pary = starty.length;
    for (const s of starty) {
      P(s, 0); P(s, e); P(s + w, e); ile++;                                    // mój ząbek
      if (r > 0) { P(s + w, -(r + g)); P(s + 2 * w + 2 * g, -(r + g)); P(s + 2 * w + 2 * g, 0); }   // wcięcie pod ząbek sąsiadki
      else P(s + w, 0);
    }
  });
  return { ring, ile };
}

// ścianki kwadratowe: numer 1–6, normalna i „góra” (kierunek, w którym czyta się napis)
export const SCIANY = [
  { nr: 1, N: [0, 0, 1],  V: [0, 1, 0] },    // góra
  { nr: 2, N: [0, -1, 0], V: [0, 0, 1] },    // przód
  { nr: 3, N: [1, 0, 0],  V: [0, 0, 1] },    // prawa
  { nr: 4, N: [-1, 0, 0], V: [0, 0, 1] },    // lewa
  { nr: 5, N: [0, 1, 0],  V: [0, 0, 1] },    // tył
  { nr: 6, N: [0, 0, -1], V: [0, 1, 0] },    // spód
];

/**
 * Model kostki. p = { a: bok zewnętrzny, t: blacha, c: ścięcie narożnika (0 = brak; mierzone wzdłuż krawędzi od wierzchołka),
 *                     g: luz zamków na stronę, zamki: true/false }
 * Zwraca { p, plyty: [{ key, rodzaj: 'kw'|'tr', nr, ring (obrys z zamkami, CCW, [x,y]), baza (bez zamków), o, u, v, n, t,
 *                       pole: { s (pół boku kwadratu na treść) } }], spoiny: [{ a, b, nA, nB, kat }], ... }
 */
export function zbuduj(p0) {
  const p = ogranicz(p0), { a, t, g } = p;
  const h = a / 2 - t;                                   // pół boku bryły wewnętrznej
  const cp = p.c > 0 ? p.c - (3 - S3) * t : 0;           // ścięcie na bryle wewnętrznej
  const k = h - cp;                                       // pół długości krawędzi kwadrat–kwadrat
  const plyty = [], spoiny = [];

  // kwadraty (po ścięciu ośmiokąty)
  const baza = cp > 0
    ? [[-k, -h], [k, -h], [h, -k], [h, k], [k, h], [-k, h], [-h, k], [-h, -k]]
    : [[-h, -h], [h, -h], [h, h], [-h, h]];
  const kraw = baza.map((_, i) => ({ kat: cp > 0 && i % 2 === 1 ? KAT_TROJKAT : Math.PI / 2 }));
  const kw = obrysZamki(baza, kraw, t, g, p.zamki);
  const margines = Math.max(8, 2 * t + 4) + (p.zamki ? 0 : 0);
  const s = cp > 0 ? Math.min(h - margines, h - cp / 2 - 0.71 * margines) : h - margines;
  for (const f of SCIANY) {
    const u = cross(f.V, f.N);
    plyty.push({ key: 's' + f.nr, rodzaj: 'kw', nr: f.nr, ring: kw.ring, baza, o: mul(f.N, h), u, v: f.V, n: f.N, t, pole: { s: Math.max(0, s) } });
  }
  // spoiny kwadrat–kwadrat: 12 krawędzi
  if (k > 0.01) for (let i = 0; i < SCIANY.length; i++) for (let j = i + 1; j < SCIANY.length; j++) {
    const A = SCIANY[i].N, B = SCIANY[j].N; if (Math.abs(dot(A, B)) > 0.5) continue;
    const E = cross(A, B), c0 = add(mul(A, h), mul(B, h));
    spoiny.push({ a: add(c0, mul(E, -k)), b: add(c0, mul(E, k)), nA: A, nB: B, kat: Math.PI / 2 });
  }

  // trójkąty narożników
  let tr = null;
  if (cp > 0) {
    const bok = cp * Math.SQRT2, R = bok / S3;            // promień okręgu opisanego
    const bazaT = [0, 1, 2].map(i => { const f = Math.PI / 2 + i * 2 * Math.PI / 3; return [R * Math.cos(f), R * Math.sin(f)]; });
    tr = obrysZamki(bazaT, bazaT.map(() => ({ kat: KAT_TROJKAT })), t, g, p.zamki);
    let nr = 0;
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
      const N = norm([sx, sy, sz]);
      const W = [[sx * (h - cp), sy * h, sz * h], [sx * h, sy * (h - cp), sz * h], [sx * h, sy * h, sz * (h - cp)]];
      const o = mul(add(add(W[0], W[1]), W[2]), 1 / 3);
      // „góra” trójkąta: wierzchołek leżący na osi z (trzeci) – u, v tak, żeby u × v = N
      const v = norm(sub(W[2], o)), u = cross(v, N);
      plyty.push({ key: 't' + (++nr), rodzaj: 'tr', nr, ring: tr.ring, baza: bazaT, o, u, v, n: N, t, pole: { s: 0 } });
      for (let i = 0; i < 3; i++) {
        const P = W[i], Q = W[(i + 1) % 3];
        // sąsiedni kwadrat: ten, na którego płaszczyźnie leżą oba punkty
        const os = [0, 1, 2].find(ax => Math.abs(Math.abs(P[ax]) - h) < 1e-6 && Math.abs(Math.abs(Q[ax]) - h) < 1e-6);
        const NB = [0, 0, 0]; NB[os] = Math.sign(P[os]);
        spoiny.push({ a: P, b: Q, nA: N, nB: NB, kat: KAT_TROJKAT });
      }
    }
  }

  // statystyki
  const dlugosc = r => { let d = 0; for (let i = 0; i < r.length; i++) d += Math.hypot(r[(i + 1) % r.length][0] - r[i][0], r[(i + 1) % r.length][1] - r[i][1]); return d; };
  const poleKw = Math.abs(pole2(kw.ring)), poleTr = tr ? Math.abs(pole2(tr.ring)) : 0;
  const ostrz = [];
  if (p0.c > 0 && p.c !== +p0.c) ostrz.push('sciecie');
  return {
    p, plyty, spoiny, h, cp,
    wym: { kw: 2 * h, tr: cp > 0 ? cp * Math.SQRT2 : 0, krawedz: 2 * k },
    zamki: { kw: kw.ile, tr: tr ? tr.ile : 0, razem: kw.ile * 6 + (tr ? tr.ile * 8 : 0) },
    stat: {
      pole: poleKw * 6 + poleTr * 8,
      obrys: dlugosc(kw.ring) * 6 + (tr ? dlugosc(tr.ring) * 8 : 0),
      spoiny: spoiny.reduce((d, sp) => d + Math.hypot(...sub(sp.b, sp.a)), 0),
      nSpoin: spoiny.length,
    },
    ostrz,
  };
}

/** Punkt 2D płyty → 3D (na wewnętrznej powierzchni; + n·z na grubości). */
export const w3 = (pl, q, z = 0) => add(add(add(pl.o, mul(pl.u, q[0])), mul(pl.v, q[1])), mul(pl.n, z));
export const wek = { sub, add, mul, dot, cross, norm };
