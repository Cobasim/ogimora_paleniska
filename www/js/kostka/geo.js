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
  q.zw = Number.isFinite(+q.zw) && +q.zw >= 0 ? Math.min(120, +q.zw) : zamekDomyslny(q.t);   // szerokość ząbka; 0 = bez zamków
  if (q.zw > 0 && q.zw < ZAMEK_MIN) q.zw = ZAMEK_MIN;
  q.zt = Number.isFinite(+q.zt) && +q.zt >= 0 ? Math.min(120, +q.zt) : zamekTrojkat(q.t);     // szerokość ząbka na krawędziach trójkątów narożnych
  if (q.zt > 0 && q.zt < ZAMEK_MIN) q.zt = ZAMEK_MIN;
  if (q.zamki === false) q.zw = q.zt = 0;
  q.zamki = q.zw > 0 || q.zt > 0;
  q.uklad = q.uklad == null ? 'konce' : ukladZe(q.uklad);               // układ zamków na krawędziach kostki
  q.ukladT = q.ukladT == null ? 'para' : ukladZe(q.ukladT);             // …i osobno na krawędziach trójkątów narożnych
  return q;
}

/** Domyślna szerokość ząbka dla blachy t i najmniejsza, jaką robimy [mm]. */
export const zamekDomyslny = t => Math.min(14, Math.max(6, 2.5 * t));
export const ZAMEK_MIN = 3;
/** Domyślna szerokość ząbka na krawędziach trójkątów (krótsze krawędzie → węższy ząbek). */
export const zamekTrojkat = t => Math.min(10, Math.max(4, 2 * t));
export const UKLADY = ['para', 'konce', 'srodek'];
/** Stare nazwy układów (0.3.4–0.3.5: 'pary' = kilka par rozłożonych) → najbliższy obecny. */
export const ukladZe = u => (UKLADY.includes(u) ? u : u === 'pary' ? 'konce' : 'para');
/**
 * Zamki na jednej krawędzi o długości L (współrzędna s od początku krawędzi, obrys przeciwnie do wskazówek zegara).
 * Zwraca { moje: [[s0, s1]], sasiada: [[s0, s1]] } – przedziały ząbków tej ścianki i ząbków sąsiadki.
 * Na każdej krawędzi jedna ścianka jest „A” (rola 'S'), druga „B” (rola 'D').
 *  'para'   – jeden ząbek A i jeden ząbek B obok siebie, na środku krawędzi;
 *  'konce'  – A ma ząbek przy każdym końcu krawędzi (na zewnątrz), B ma ząbki dotykające ich od środka;
 *             między ząbkami B zostaje długa wolna szczelina na jedną ciągłą spoinę;
 *  'srodek' – A ma jeden ząbek na środku, B dwa ząbki obejmujące go z obu stron.
 * Wszystkie trzy układy są lustrzane względem środka krawędzi poza 'para' – dlatego blokują przesuw w obie strony.
 * Regulowana jest szerokość ząbka; za szeroki na tę krawędź zwęża się, a gdy 'konce' się nie mieszczą – zostaje 'para'.
 */
function zamkiKrawedzi(L, t, g, eMax, zw, uklad, rola) {
  const m = eMax + t + 3, wolne = L - 2 * m, puste = { moje: [], sasiada: [] }, c = L / 2;
  if (!(zw > 0)) return puste;
  const role = (A, B) => (rola === 'S' ? { moje: A, sasiada: B } : { moje: B, sasiada: A });
  if (uklad === 'srodek') {
    const w = Math.min(zw, (wolne - 2 * g) / 3);
    if (w >= ZAMEK_MIN - 1e-9) return role([[c - w / 2, c + w / 2]], [[c - w / 2 - g - w, c - w / 2 - g], [c + w / 2 + g, c + w / 2 + g + w]]);
  }
  if (uklad === 'konce') {
    const w = Math.min(zw, (wolne - 2 * g - Math.max(12, 2 * t)) / 4);      // w środku zostaje co najmniej kawałek szczeliny
    if (w >= ZAMEK_MIN - 1e-9) return role([[m, m + w], [L - m - w, L - m]], [[m + w + g, m + 2 * w + g], [L - m - 2 * w - g, L - m - w - g]]);
  }
  // 'para' (i zapas, gdy inny układ się nie mieści): ząbek tej ścianki, zaraz za nim ząbek sąsiadki – z obu stron wygląda tak samo
  const w = Math.min(zw, (wolne - g) / 2);
  if (w < ZAMEK_MIN - 1e-9) return puste;
  return { moje: [[c - g / 2 - w, c - g / 2]], sasiada: [[c + g / 2, c + g / 2 + w]] };
}

const pole2 = r => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
/** Usuwa punkty powtórzone i leżące na prostej między sąsiadami. */
function uprosc(ring) {
  let r = ring.filter((q, i) => { const n = ring[(i + 1) % ring.length]; return Math.hypot(n[0] - q[0], n[1] - q[1]) > 1e-6; });
  for (let zm = true; zm && r.length > 3;) { zm = false;
    r = r.filter((q, i) => { const a = r[(i + r.length - 1) % r.length], b = r[(i + 1) % r.length];
      const pr = (q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0]), sk = (q[0] - a[0]) * (b[0] - q[0]) + (q[1] - a[1]) * (b[1] - q[1]);
      if (!zm && Math.abs(pr) < 1e-7 && sk > 0) { zm = true; return false; } return true; }); }
  return r;
}

/**
 * Obrys z zamkami: wielokąt bazowy (CCW) z ząbkami i wcięciami wpisanymi wprost w każdą krawędź
 * (bez działań na wielokątach – same proste odcinki). krawedzie[i] = { kat, zw, uklad, rola } dla krawędzi i → i+1.
 */
function obrysZamki(baza, krawedzie, t, g) {
  const ring = []; let ile = 0;
  baza.forEach((P0, i) => {
    const P1 = baza[(i + 1) % baza.length], dx = P1[0] - P0[0], dy = P1[1] - P0[1], L = Math.hypot(dx, dy);
    const E = [dx / L, dy / L], N = [E[1], -E[0]];            // N – na zewnątrz obrysu (obrys przeciwnie do wskazówek zegara)
    const P = (s, d) => ring.push([snap(P0[0] + E[0] * s + N[0] * d), snap(P0[1] + E[1] * s + N[1] * d)]);
    P(0, 0);
    const kr = krawedzie[i]; kr.L = L;
    const th = kr.kat, e = t / Math.tan(th / 2), r = th > Math.PI / 2 + 1e-6 ? t * Math.abs(Math.cos(th)) / Math.sin(th) : 0;
    const z = zamkiKrawedzi(L, t, g, e, kr.zw, kr.uklad, kr.rola);
    // ząbek: wychodzi na zewnątrz o e; ząbek sąsiadki przy kącie rozwartym: wcięcie r + luz, szersze o luz z każdej strony
    const cechy = z.moje.map(([a, b]) => ({ a, b, d: e }));
    if (r > 0) z.sasiada.forEach(([a, b]) => cechy.push({ a: a - g, b: b + g, d: -(r + g) }));
    cechy.sort((x, y) => x.a - y.a);
    for (const c of cechy) { P(c.a, 0); P(c.a, c.d); P(c.b, c.d); P(c.b, 0); }
    ile += z.moje.length;
  });
  return { ring: uprosc(ring), ile };
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
 *                     g: luz zamków na stronę, zw: szerokość ząbka (0 = bez zamków; brak = domyślna dla blachy) }
 * Zwraca { p, plyty: [{ key, rodzaj: 'kw'|'tr', nr, ring (obrys z zamkami, CCW, [x,y]), baza (bez zamków), o, u, v, n, t,
 *                       pole: { s (pół boku kwadratu na treść) } }], spoiny: [{ a, b, nA, nB, kat }], ... }
 */
export function zbuduj(p0) {
  const p = ogranicz(p0), { a, t, g } = p;
  const h = a / 2 - t;                                   // pół boku bryły wewnętrznej
  const cp = p.c > 0 ? p.c - (3 - S3) * t : 0;           // ścięcie na bryle wewnętrznej
  const k = h - cp;                                       // pół długości krawędzi kwadrat–kwadrat
  const plyty = [], spoiny = [];
  const dlugosc = r => { let d = 0; for (let i = 0; i < r.length; i++) d += Math.hypot(r[(i + 1) % r.length][0] - r[i][0], r[(i + 1) % r.length][1] - r[i][1]); return d; };

  // kwadraty (po ścięciu ośmiokąty)
  const baza = cp > 0
    ? [[-k, -h], [k, -h], [h, -k], [h, k], [k, h], [-k, h], [-h, k], [-h, -k]]
    : [[-h, -h], [h, -h], [h, h], [-h, h]];
  const margines = Math.max(8, 2 * t + 4);
  const s = cp > 0 ? Math.min(h - margines, h - cp / 2 - 0.71 * margines) : h - margines;
  const wpisPelny = cp > 0 ? Math.min(h, (2 * h - cp) / Math.SQRT2) : h;      // środek ścianki → najbliższa krawędź
  const os = N => N.findIndex(v => v !== 0);
  let ileKw = 0, obwodKw = 0, poleKw = 0;
  for (const f of SCIANY) {
    const u = cross(f.V, f.N);
    // sąsiadki kolejnych prostych krawędzi (dół, prawa, góra, lewa) i rola przy układzie „jeden na środku”:
    // z dwóch stykających się ścianek jeden ząbek ma ta, której oś jest „o jeden wcześniej” (x przed y, y przed z, z przed x)
    const sas = [mul(f.V, -1), u, f.V, mul(u, -1)];
    const prosta = k => ({ kat: Math.PI / 2, zw: p.zw, uklad: p.uklad, rola: (os(sas[k]) - os(f.N) + 3) % 3 === 1 ? 'S' : 'D' });
    const kraw = baza.map((_, i) => (cp > 0 ? (i % 2 ? { kat: KAT_TROJKAT, zw: p.zt, uklad: p.ukladT, rola: 'D' } : prosta(i / 2)) : prosta(i)));
    const kw = obrysZamki(baza, kraw, t, g);
    ileKw += kw.ile; obwodKw += dlugosc(kw.ring); poleKw += Math.abs(pole2(kw.ring));
    plyty.push({ key: 's' + f.nr, rodzaj: 'kw', nr: f.nr, ring: kw.ring, baza, o: mul(f.N, h), u, v: f.V, n: f.N, t, pole: { s: Math.max(0, s), baza, wpisPelny, wpis: Math.max(0, wpisPelny - margines) } });
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
    tr = obrysZamki(bazaT, bazaT.map(() => ({ kat: KAT_TROJKAT, zw: p.zt, uklad: p.ukladT, rola: 'S' })), t, g);
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
  const poleTr = tr ? Math.abs(pole2(tr.ring)) : 0;
  const ostrz = [];
  if (p0.c > 0 && p.c !== +p0.c) ostrz.push('sciecie');
  return {
    p, plyty, spoiny, h, cp,
    wym: { kw: 2 * h, tr: cp > 0 ? cp * Math.SQRT2 : 0, krawedz: 2 * k },
    zamki: { kw: ileKw, tr: tr ? tr.ile : 0, razem: ileKw + (tr ? tr.ile * 8 : 0) },
    stat: {
      pole: poleKw + poleTr * 8,
      obrys: obwodKw + (tr ? dlugosc(tr.ring) * 8 : 0),
      spoiny: spoiny.reduce((d, sp) => d + Math.hypot(...sub(sp.b, sp.a)), 0),
      nSpoin: spoiny.length,
    },
    ostrz,
  };
}

/** Punkt 2D płyty → 3D (na wewnętrznej powierzchni; + n·z na grubości). */
export const w3 = (pl, q, z = 0) => add(add(add(pl.o, mul(pl.u, q[0])), mul(pl.v, q[1])), mul(pl.n, z));
export const wek = { sub, add, mul, dot, cross, norm };
