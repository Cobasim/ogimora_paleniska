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
  q.zt = Number.isFinite(+q.zt) && +q.zt >= 0 ? Math.min(120, +q.zt) : zamekTrojkat(q.t);     // szerokość ząbka na krawędziach trójkątów narożnych
  if (q.zamki === false) q.zw = q.zt = 0;
  q.zamki = q.zw > 0 || q.zt > 0;
  q.km = q.km || null;                                                   // tylko do testów: własne odstępy ząbków od końca krawędzi
  q.uklad = q.uklad == null ? 'konce' : ukladZe(q.uklad);               // układ zamków na krawędziach kostki
  q.ukladT = q.ukladT == null ? 'para' : ukladZe(q.ukladT, UKLADY_T);            // …i osobno na krawędziach trójkątów narożnych
  return q;
}

/** Domyślna szerokość ząbka dla blachy t i najmniejsza, jaką robimy [mm]. */
export const zamekDomyslny = t => Math.min(14, Math.max(6, 2.5 * t));
export const ZAMEK_MIN = 3;
/** Najwęższy ząbek dla blachy t: nie węższy niż grubość blachy (cieńszy by się wypalił albo ułamał). */
export const zamekMin = t => Math.max(ZAMEK_MIN, t);
/** Domyślna szerokość ząbka na krawędziach trójkątów (krótsze krawędzie → węższy ząbek). */
export const zamekTrojkat = t => Math.min(10, Math.max(4, 2 * t));
export const UKLADY = ['para', 'konce', 'srodek'];
/** Układy przy trójkątach: dodatkowo 'jeden' – sam ząbek trójkąta w gnieździe kwadratu (trójkąt bez żadnych wcięć). */
export const UKLADY_T = ['jeden', 'para', 'konce', 'srodek'];
/** Stare nazwy układów (0.3.4–0.3.5: 'pary' = kilka par rozłożonych) → najbliższy obecny. */
export const ukladZe = (u, lista = UKLADY) => (lista.includes(u) ? u : u === 'pary' ? 'konce' : 'para');

// ---- długość ząbka i gniazdo -------------------------------------------------------------------------------------
// Ząbek leży w płaszczyźnie swojej ścianki i wychodzi za wewnętrzną krawędź. Ma sięgać CO NAJMNIEJ do lica sąsiadki
// na całej swojej grubości – wtedy nic nie trzeba dospawywać, a to, co wystaje, zeszlifowuje się po spawaniu.
//  • 90° (kwadrat–kwadrat): długość = grubość blachy, ząbek licuje się dokładnie;
//  • kąt rozwarty (kwadrat–trójkąt, 125,26°): długość = t / sin θ (1,22 t) – wewnętrzna krawędź ząbka dochodzi do lica
//    sąsiadki, zewnętrzna wystaje ponad nie o t·|cos θ| (0,58 t). Do 0.3.8 było t·ctg(θ/2) – ząbek nie dochodził do lica.
//    Sąsiadka ma pod ząbkiem gniazdo głębokie t·|cos θ|/sin θ + luz (blachy cięte prostopadle inaczej weszłyby w siebie).
const dlugoscZabka = (t, th) => t / Math.sin(th);
const gniazdo = (t, th) => (th > Math.PI / 2 + 1e-6 ? t * Math.abs(Math.cos(th)) / Math.sin(th) : 0);
// Najmniejsza odległość ząbka od końca krawędzi przy trójkącie (× grubość blachy): bliżej ząbek wchodzi w trzecią
// ściankę stykającą się w tym wierzchołku. Wyznaczone testem kolizji (test/kolizje.mjs).
const KONIEC_A = 0.8;      // ząbek trójkąta
const KONIEC_B = 0.8;      // ząbek kwadratu na skośnej krawędzi
/** Najwęższe miejsce, jakie może zostać w trójkącie między wcięciami (i między wcięciem a sąsiednią krawędzią). */
const szyjkaTr = t => Math.max(6, 2 * t);
/** …i w kwadracie (tam rogi są rozwarte – wystarczy tyle, co najwęższy ząbek). */
const szyjkaKw = t => Math.max(4, 1.5 * t);
/** Wolny środek krawędzi w układzie „na końcach” – miejsce na ciągłą spoinę. */
const przerwaKonce = t => Math.max(12, 2 * t);

/**
 * Ząbki na jednej krawędzi długości L, we współrzędnej s ścianki A (od początku krawędzi, obrys przeciwnie do wskazówek zegara).
 * Zwraca { A: [[s0, s1]], B: [[s0, s1]] } albo null, gdy układ z ząbkiem szerokości w się nie mieści.
 *  'jeden'  – tylko ząbek A na środku (ma sens przy kącie rozwartym: siedzi w gnieździe B i ustala w obie strony);
 *  'para'   – ząbek A i ząbek B obok siebie na środku;
 *  'konce'  – A ma ząbek przy każdym końcu, B ma ząbki dotykające ich od środka, między nimi długa szczelina;
 *  'srodek' – A ma jeden ząbek na środku, B dwa obejmujące go.
 * mA, mB – najmniejsza odległość ząbka A / B od końca krawędzi.
 */
function zabki(L, g, w, uklad, mA, mB, przerwa) {
  const c = L / 2, e = 1e-9;
  if (uklad === 'jeden') return c - w / 2 >= mA - e ? { A: [[c - w / 2, c + w / 2]], B: [] } : null;
  if (uklad === 'para') return c - g / 2 - w >= Math.max(mA, mB) - e ? { A: [[c - g / 2 - w, c - g / 2]], B: [[c + g / 2, c + g / 2 + w]] } : null;
  if (uklad === 'srodek') return c - w / 2 - g - w >= mB - e ? { A: [[c - w / 2, c + w / 2]], B: [[c - w / 2 - g - w, c - w / 2 - g], [c + w / 2 + g, c + w / 2 + g + w]] } : null;
  if (uklad === 'konce') return L - 2 * (mA + 2 * w + g) >= przerwa - e ? { A: [[mA, mA + w], [L - mA - w, L - mA]], B: [[mA + w + g, mA + 2 * w + g], [L - mA - 2 * w - g, L - mA - w - g]] } : null;
  return null;
}
const odwroc = (lista, L) => lista.map(([a, b]) => [L - b, L - a]).reverse();
/** Ząbki widziane z danej ścianki: { moje, sasiada } we współrzędnej tej ścianki. */
const zRoli = (z, L, rola) => (!z ? { moje: [], sasiada: [] } : rola === 'S' ? { moje: z.A, sasiada: z.B } : { moje: odwroc(z.B, L), sasiada: odwroc(z.A, L) });

// ---- odległości 2D (do sprawdzania zwężeń) ------------------------------------------------------------------------
const odlPS = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let s = L2 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2 : 0; s = Math.max(0, Math.min(1, s)); return Math.hypot(q[0] - a[0] - s * dx, q[1] - a[1] - s * dy); };
const przecina = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const odlSS = (a, b, c, d) => (przecina(a, b, c, d) ? 0 : Math.min(odlPS(a, c, d), odlPS(b, c, d), odlPS(c, a, b), odlPS(d, a, b)));
/**
 * Najwęższe miejsce, jakie wcięcia zostawiają w wielokącie: najmniejsza odległość wcięcia od krawędzi innej niż własna
 * i od wcięć na innych krawędziach. wciecia[i] = [[s0, s1]] na krawędzi i → i+1, wszystkie głębokie na d.
 */
function najwezsze(baza, wciecia, d) {
  const n = baza.length, prost = [];
  baza.forEach((P0, i) => { const P1 = baza[(i + 1) % n], dx = P1[0] - P0[0], dy = P1[1] - P0[1], L = Math.hypot(dx, dy), E = [dx / L, dy / L], N = [-E[1], E[0]];   // N – do środka
    for (const [a, b] of wciecia[i] || []) { const P = (s, z) => [P0[0] + E[0] * s + N[0] * z, P0[1] + E[1] * s + N[1] * z]; prost.push({ i, r: [P(a, 0), P(a, d), P(b, d), P(b, 0)] }); } });
  let m = Infinity;
  for (const p of prost) {
    for (let k = 0; k < 4; k++) { const a = p.r[k], b = p.r[(k + 1) % 4];
      for (let j = 0; j < n; j++) if (j !== p.i) m = Math.min(m, odlSS(a, b, baza[j], baza[(j + 1) % n]));
      for (const q of prost) if (q.i !== p.i) for (let l = 0; l < 4; l++) m = Math.min(m, odlSS(a, b, q.r[l], q.r[(l + 1) % 4])); }
  }
  return m;
}

/**
 * Dobór zamków dla jednego rodzaju krawędzi. pasuje(uklad, w) → ząbki albo null.
 * Zwraca { uklad (faktyczny albo null = bez zamków), w, lo, hi (zakres szerokości faktycznego układu), z (ząbki),
 *          dostepne: { uklad: true/false }, chciany, zastapiony (true, gdy wybrany układ się nie mieści) }.
 * Gdy wybrany układ się nie mieści, bierze następny z listy zapas; gdy żaden – zamków nie ma.
 */
function dobierz(L, chciany, wChciane, lista, zapas, wMin, pasuje) {
  const zakres = u => { let lo = null, hi = null; const krok = Math.max(0.25, L / 400);
    for (let w = wMin; w <= Math.min(120, L) + 1e-9; w += krok) if (pasuje(u, w)) { if (lo == null) lo = w; hi = w; } else if (lo != null) break;
    return lo == null ? null : { lo, hi }; };
  const zak = {}, dostepne = {};
  for (const u of lista) { zak[u] = zakres(u); dostepne[u] = !!zak[u]; }
  const u = [chciany, ...zapas].find(x => zak[x]);
  const wynik = { uklad: null, mozliwy: u || null, w: 0, lo: u ? zak[u].lo : 0, hi: u ? zak[u].hi : 0, z: null, dostepne, chciany, zastapiony: u !== chciany };
  if (!u || !(wChciane > 0)) return wynik;
  const w = Math.min(zak[u].hi, Math.max(zak[u].lo, wChciane));
  return { ...wynik, uklad: u, w, z: pasuje(u, w) };
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
 * Obrys z zamkami: wielokąt bazowy (CCW) z ząbkami i gniazdami wpisanymi wprost w każdą krawędź
 * (bez działań na wielokątach – same proste odcinki). krawedzie[i] = { kat, moje, sasiada } dla krawędzi i → i+1.
 */
function obrysZamki(baza, krawedzie, t, g) {
  const ring = []; let ile = 0;
  baza.forEach((P0, i) => {
    const P1 = baza[(i + 1) % baza.length], dx = P1[0] - P0[0], dy = P1[1] - P0[1], L = Math.hypot(dx, dy);
    const E = [dx / L, dy / L], N = [E[1], -E[0]];            // N – na zewnątrz obrysu (obrys przeciwnie do wskazówek zegara)
    const P = (s, d) => ring.push([snap(P0[0] + E[0] * s + N[0] * d), snap(P0[1] + E[1] * s + N[1] * d)]);
    P(0, 0);
    const kr = krawedzie[i], e = dlugoscZabka(t, kr.kat), r = gniazdo(t, kr.kat);
    // ząbek: wychodzi na zewnątrz o e; ząbek sąsiadki przy kącie rozwartym: gniazdo r + luz, szersze o luz z każdej strony
    const cechy = kr.moje.map(([a, b]) => ({ a, b, d: e }));
    if (r > 0) kr.sasiada.forEach(([a, b]) => cechy.push({ a: a - g, b: b + g, d: -(r + g) }));
    cechy.sort((x, y) => x.a - y.a);
    for (const c of cechy) { P(c.a, 0); P(c.a, c.d); P(c.b, c.d); P(c.b, 0); }
    ile += kr.moje.length;
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
  const wMin = zamekMin(t);
  // --- zamki na krawędziach kostki (90°): ząbki mogą dochodzić do samych końców krawędzi
  const Lk = 2 * k;
  const zk = Lk > 0.01 ? dobierz(Lk, p.uklad, p.zw, UKLADY, ['para'], wMin, (u, w) => zabki(Lk, g, w, u, 0, 0, przerwaKonce(t)))
    : { uklad: null, mozliwy: null, w: 0, lo: 0, hi: 0, z: null, dostepne: {}, chciany: p.uklad, zastapiony: true };
  // --- zamki przy trójkątach (125,26°): osobne zasady. Trójkąt = ścianka A, kwadrat = B.
  const bok = cp * Math.SQRT2, R = bok / S3, dT = gniazdo(t, KAT_TROJKAT) + g;
  const bazaT = cp > 0 ? [0, 1, 2].map(i => { const f = Math.PI / 2 + i * 2 * Math.PI / 3; return [R * Math.cos(f), R * Math.sin(f)]; }) : null;
  const mA = (p.km ? p.km[0] : KONIEC_A) * t, mB = (p.km ? p.km[1] : KONIEC_B) * t;
  // „na końcach”: ząbek trójkąta tak blisko wierzchołka, jak się da bez kolizji i bez drzazgi między gniazdem a rogiem kwadratu
  const mKonce = Math.max(mA, szyjkaKw(t) * Math.SQRT2 + g);
  const pasujeT = (u, w) => {
    const z = zabki(bok, g, w, u, u === 'konce' ? mKonce : mA, mB, przerwaKonce(t)); if (!z) return null;
    const posz = l => l.map(([a, b]) => [a - g, b + g]);
    // trójkąt ma gniazda pod ząbki kwadratu (B), kwadrat – pod ząbki trójkąta (A, na skośnych krawędziach, w odwróconej współrzędnej)
    if (z.B.length && najwezsze(bazaT, [0, 1, 2].map(() => posz(z.B)), dT) < szyjkaTr(t) - 1e-6) return null;
    if (z.A.length && najwezsze(baza, baza.map((_, i) => (i % 2 ? posz(odwroc(z.A, bok)) : [])), dT) < szyjkaKw(t) - 1e-6) return null;
    return z;
  };
  const zt = cp > 0 ? dobierz(bok, p.ukladT, p.zt, UKLADY_T, ['para', 'jeden'], wMin, pasujeT)
    : { uklad: null, mozliwy: null, w: 0, lo: 0, hi: 0, z: null, dostepne: {}, chciany: p.ukladT, zastapiony: false };
  let ileKw = 0, obwodKw = 0, poleKw = 0;
  for (const f of SCIANY) {
    const u = cross(f.V, f.N);
    // sąsiadki kolejnych prostych krawędzi (dół, prawa, góra, lewa); z dwóch stykających się ścianek „A” jest ta,
    // której oś jest „o jeden wcześniej” (x przed y, y przed z, z przed x) – każda ścianka ma na przemian krawędź A i B
    const sas = [mul(f.V, -1), u, f.V, mul(u, -1)];
    const prosta = k => ({ kat: Math.PI / 2, ...zRoli(zk.z, Lk, (os(sas[k]) - os(f.N) + 3) % 3 === 1 ? 'S' : 'D') });
    const skos = { kat: KAT_TROJKAT, ...zRoli(zt.z, bok, 'D') };
    const kraw = baza.map((_, i) => (cp > 0 ? (i % 2 ? skos : prosta(i / 2)) : prosta(i)));
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
    tr = obrysZamki(bazaT, bazaT.map(() => ({ kat: KAT_TROJKAT, ...zRoli(zt.z, bok, 'S') })), t, g);
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
    zamki: { kw: ileKw, tr: tr ? tr.ile : 0, razem: ileKw + (tr ? tr.ile * 8 : 0), krawedzie: zk, trojkaty: zt },
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
