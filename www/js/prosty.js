// OGIMORA – generator UPROSZCZONY (wersja publiczna, 2026-11).
// Zasady: ścianki są jednocześnie nogami (dno na wybranej wysokości), ograniczone wymiary i kąty, na ściance najwyżej: jeden wzór na środku + jeden napis
// (każdy: wielkość i wyżej / niżej). Na start: napis OGIMORA na ściance 1 (można usunąć). Logo smoka nie jest dodawane (v7).
// Ten plik trzyma: ograniczenia kształtu, listę wzorów, panel „Wzory” i układanie bez kolizji.
// Silnik (kształt, otwory, DXF) jest ten sam co w pełnym generatorze – tu powstaje tylko prosty opis zdobień.
//
// ZMIANA LISTY WZORÓW: tablica WZORY poniżej (id = nazwa pliku w wzory_dane/ bez .json).
// Po zmianie listy trzeba dograć pliki wzorów – patrz CZYTAJ.md.
import { PARAMS } from './geometry.js';
import { elements, pole, rules, elementPlaced, elementHoles, itemsFor } from './zdobienie.js';
import { wczytajIndeks, wczytajMini, Mini, wzor as wzorInfo } from './wzory_dane.js';
import { LANG } from './i18n.js';
import { track, trackDebounced, setProjektSource } from './track.js';

// ---------------------------------------------------------------- kształt: ograniczenia
export const LIM = {
  base:   { min: 300, max: 600 },   // bok dna [mm]
  height: { min: 120, max: 450 },   // głębokość misy = wysokość paleniska − wysokość dna [mm]
  angle:  { min: -15, max: 25 },    // odchylenie ścianek [°]
  legHeight: { min: 30, max: 250 }, // wysokość dna nad ziemią [mm]
};
export const TOT = { min: 200, max: 600 };   // wysokość paleniska (całkowita) [mm]
// projekt startowy (wybrany przez użytkownika, plik starter_20261111): niskie palenisko zwężone ku górze, blacha 5 mm
export const START = { base: 450, height: 190, angle: -8, legHeight: 55, legCut: 35, skirtArch: 1, footTop: 140, footBottom: 70, tBowl: 5, bowlBent: 0, perfBowl: 0, gap: 0.3, mat: 0 };
for (const p of PARAMS) { if (p.id === 'base') p.step = 5; }
for (const p of PARAMS) if (LIM[p.id]) { Object.assign(p, LIM[p.id]); if (START[p.id] != null) p.value = START[p.id]; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Każdy stan (z linku, z pamięci, z suwaka) przechodzi przez to sito. */
export function ogranicz(s) {
  const o = { ...s };
  for (const k in LIM) o[k] = clamp(Number.isFinite(+o[k]) ? +o[k] : START[k], LIM[k].min, LIM[k].max);
  { const t = clamp(o.height + clamp(+o.legHeight || START.legHeight, LIM.legHeight.min, LIM.legHeight.max), TOT.min, TOT.max);
    o.legHeight = clamp(+o.legHeight || START.legHeight, LIM.legHeight.min, Math.min(LIM.legHeight.max, t - LIM.height.min)); o.height = t - o.legHeight; }
  o.skirt = 1; o.skirtArch = +o.skirtArch ? 1 : 0; o.legBent = 0; o.perfLeg = 0; o.footInset = 0;   // nogi = przedłużenie ścianek
  o.footTop = START.footTop; o.footBottom = START.footBottom;
  o.notchDepth = 0;                                                              // bez podcięć
  o.tBowl = [3, 4, 5].includes(+o.tBowl) ? +o.tBowl : START.tBowl; o.tLeg = o.tBowl;
  o.bowlBent = 0; o.perfBowl = 0;   // tylko spawane
  o.legCut = clamp(Math.round((+o.legCut || 0) / 5) * 5, 0, 300);
  return o;
}

// ---------------------------------------------------------------- wzory do wyboru
export const WZORY = [
  'rozeta-cyrklowa-w-recicy', 'rozeta-cyrklowa-w-zabkach', 'kwiat-zycia-w-podwojnym-otoku', 'gwiazda-w-recicy',
  'slonce', 'slonce-wschodzace-w-luku', 'parzenica-goralska-pelna', 'parzenica-koronkowa',
  'parzenica-cztery-swiaty', 'serce-z-rozeta-zlozona-parzenica', 'dziewieciornik-w-luczkach', 'lilijka-heraldyczna-w-kratce',
  'krzyz-promienisty-w-kropkach', 'wezel-trojpetlowy',
  // symbole (narysowane kodem: _gen/nowe_wzory)
  'krzyz-maltanski', 'kalendarz-aztecki', 'wilk', 'ufo',
  // seria 3 (XI 2026): znane motywy, rysunki własne
  'ksiezyc-gwiazdy', 'gwiazda-w-kole', 'plomienie', 'drzewo-zycia', 'roza-wiatrow', 'kotwica', 'ster', 'lapa', 'podkowa', 'gory',
  'platek-sniegu', 'slonecznik', 'mandala', 'triskelion', 'koniczyna', 'czaszka',   // bitcoin, dolar, las, jelen – odłożone do poprawy (rysunki zostają w _gen/nowe_wzory)
];
export const SMOK = 'smok-pelny';
const SMOK_H = 34;            // wysokość logo [mm]
const NAPIS = { font: 'Gruba', odstep: 0.06, luk: 0, pogrub: 0, mosty: 'pionowe', ile: '2', efekt: 'pełne' };
const NAPIS_MAX = 18;         // znaków
const WZ_MIN = 36, NAPIS_MIN = 16;   // najmniejsza wysokość [mm]
// Bezpiecznik przeciwiskrowy: gdyby mimo mostków w rysunkach (patrz CZYTAJ.md) wyszedł otwór szerszy niż ISKRY.min,
// silnik dzieli go pionowymi paskami. Rysunki wzorów mają otwory do ok. 10 mm, po powiększeniu do ok. 14 mm.
const ISKRY = { typ: 'paski', kier: 'pionowe', neg: false, pas: 5, szcz: 10, min: 14.5 };
const ODSTEP = 6;             // odstęp między wzorem, napisem i logo [mm]
const STORE = 'ogip_stan2';

const EN = LANG === 'en';
const T = EN ? {
  h: 'Patterns', same: 'Same on all sides', side: 'Side', none: 'No pattern', size: 'Size', pos: 'Lower / higher',
  text: 'Lettering', ph: 'e.g. family name', logo: 'Ogimora dragon', logoS: 'small logo on side 1',
  brak: 'no room on this side', long: 'Lettering too long for this side', wysp: 'A loose piece of metal in the pattern – change size or position',
  poza: 'Pattern too close to the edge – made smaller',
  slaba: 'A lot is cut out of this side – it may warp in the fire. Make the pattern smaller or pick thicker sheet.',
  dno: 'Holes in the floor', dnoBrak: 'None', dnoD: 'Hole diameter', dnoR: 'Spacing', floorH: 'Floor plate height above ground', legH: 'Leg height (cut-out between legs)', totH: 'Fire pit height (total)', arch: 'Cut-out between legs',
} : {
  h: 'Wzory', same: 'Wszystkie ścianki takie same', side: 'Ścianka', none: 'Bez wzoru', size: 'Wielkość', pos: 'Niżej / wyżej',
  text: 'Napis', ph: 'np. nazwisko', logo: 'Smok Ogimory', logoS: 'małe logo na ściance 1',
  brak: 'brak miejsca na tej ściance', long: 'Napis za długi na tę ściankę', wysp: 'We wzorze zostaje luźny kawałek blachy – zmień wielkość albo położenie',
  poza: 'Wzór za blisko brzegu – zmniejszony',
  slaba: 'Z tej ścianki wycięto dużo – może się wyginać od ognia. Zmniejsz wzór albo wybierz grubszą blachę.',
  dno: 'Otwory w dnie', dnoBrak: 'Brak', dnoD: 'Średnica otworu', dnoR: 'Rozstaw', floorH: 'Wysokość dolnej płyty (dna) nad ziemią', legH: 'Wysokość nóżek (wycięcia między nogami)', totH: 'Wysokość paleniska (całkowita)', arch: 'Wycięcie między nogami',
};

// ---------------------------------------------------------------- stan prosty
// S.sc[k] = { w: id wzoru | '', s: wysokość / wysokość pola, v: −1…1, t: napis, ts, tv }
const scDef = () => ({ w: WZORY[0], s: 0.78, v: 0, t: '', ts: 0.16, tv: -0.72 });
// na start: projekt startowy użytkownika – serce z napisem OGIMORA na ściance 1, dziewięciornik na 2 i 4, kwiat życia na 3
const stanDef = () => ({ same: false, sel: 1, smok: false, dno: { n: 4, d: 6, r: 0.2 }, sc: {
  1: { ...scDef(), w: 'serce-z-rozeta-zlozona-parzenica', s: 0.5588, v: -0.2971, t: 'OGIMORA', ts: 0.1597, tv: 0.6568 },   // napis u góry, serce pod nim
  2: { ...scDef(), w: 'dziewieciornik-w-luczkach', s: 0.7782, v: 0.0022 },
  3: { ...scDef(), w: 'kwiat-zycia-w-podwojnym-otoku', s: 0.7782, v: 0.0022 },
  4: { ...scDef(), w: 'dziewieciornik-w-luczkach', s: 0.7782, v: 0.0022 } } });
// projekt „czysty”: bez wzorów, sam napis OGIMORA na ściance 1 (otwory w dnie zostają – odpływ wody)
const stanCzysty = () => { const pusta = () => ({ ...scDef(), w: '' }); return { same: false, sel: 1, smok: false, dno: { n: 4, d: 6, r: 0.2 }, sc: { 1: { ...pusta(), t: 'OGIMORA', ts: 0.22, tv: 0 }, 2: pusta(), 3: pusta(), 4: pusta() } }; };
let S = stanDef();
let A = null;                 // { wz, model(), zmiana(), kamera(n) } z app.js
let setDecor0 = null;         // oryginalne wz.setDecor
const kom = { 1: '', 2: '', 3: '', 4: '' };   // komunikat ścianki
let naprawy = 0;
let przedSame = null;       // ścianki sprzed zaznaczenia „wszystkie takie same”

const zapisz = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch {} };
const cfg = k => S.sc[S.same ? 1 : k];

// ---------------------------------------------------------------- geometria pola ścianki
// FE – pole silnika (największy trapez w strefie cięcia; u, v, s zdobień liczą się względem niego).
// F  – pole wzoru i napisu: ta sama figura, ale tylko NAD linią dna (ząbki dna przechodzą przez ściankę).
// Poniżej dna (noga) może stanąć tylko logo.
let polaPam = { m: null, o: null };
function pola() {
  const m = A.model(); if (!m) return {};
  if (polaPam.m === m) return polaPam.o;
  const o = {};
  for (const e of elements(m, A.wz.decor)) if (e.kind === 'wall') {
    const FE = pole(e);
    const polyE = FE.poly || [[FE.x0, FE.y0], [FE.x0 + FE.w, FE.y0], [FE.x0 + FE.w, FE.y0 + FE.h], [FE.x0, FE.y0 + FE.h]];
    // linia dna: górna krawędź otworów na ząbki dna (tylko te w dolnej połowie pola)
    let yD = -Infinity;
    for (const h of e.old || []) { const ys = h.map(q => q[1]), y1 = Math.max(...ys); if (y1 < FE.y0 + FE.h * 0.6) yD = Math.max(yD, y1); }
    const yCut = yD > -Infinity ? yD + 17 : FE.y0;
    const poly = yCut > FE.y0 + 0.5 ? tnijOdDolu(polyE, yCut) : polyE;
    const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    o[e.key] = { el: e, FE, polyE, poly, F: { x0, y0, w: x1 - x0, h: y1 - y0, cx: FE.cx, cy: (y0 + y1) / 2 }, R: rules(A.wz.decor, e.t) };
  }
  polaPam = { m, o };
  return o;
}
/** Część wielokąta wypukłego powyżej prostej y = yc. */
function tnijOdDolu(poly, yc) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ia = a[1] >= yc, ib = b[1] >= yc;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (yc - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, yc]); }
  }
  return out.length >= 3 ? out : poly;
}
/** Punkt w strefie cięcia silnika (parzystość przecięć po wszystkich pierścieniach). */
function wStrefie(rings, x, y) {
  let a = false;
  for (const P of rings) for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) a = !a; }
  return a;
}
/** Punkt w wielokącie wypukłym (z zapasem z [mm] od brzegu). */
function wSrodku(poly, x, y, z = 0.4) {
  let znak = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;
    const d = (dx * (y - a[1]) - dy * (x - a[0])) / L;       // odległość od boku, ze znakiem
    if (Math.abs(d) < z) return false;
    if (!znak) znak = Math.sign(d); else if (Math.sign(d) !== znak) return false;
  }
  return true;
}
/** Prostokąt w polu: rogi w wielokącie (poly) i siatka punktów w strefie cięcia silnika (omija ząbki i łączenia). */
function prost(P, b, poly = P.poly) {
  if (![[b.x - b.w / 2, b.y - b.h / 2], [b.x + b.w / 2, b.y - b.h / 2], [b.x + b.w / 2, b.y + b.h / 2], [b.x - b.w / 2, b.y + b.h / 2]].every(q => wSrodku(poly, q[0], q[1]))) return false;
  const nx = Math.max(2, Math.ceil(b.w / 12)), ny = Math.max(2, Math.ceil(b.h / 12));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) if (!wStrefie(P.el.safe, b.x - b.w / 2 + b.w * i / nx, b.y - b.h / 2 + b.h * j / ny)) return false;
  return true;
}
const zachodzi = (a, b, g = ODSTEP) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + g && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + g;

// ---------------------------------------------------------------- wymiary elementów
/** Szerokość / wysokość wzoru o wysokości H [mm] – jak w silniku: największy gotowy rysunek nie wyższy niż H. */
function aspWz(id, H) {
  const w = wzorInfo(id); if (!w) return 1;
  let v = null; for (const q of w.rozmiary || []) if (q.bh <= H * 1.001) v = q;
  v = v || (w.rozmiary || [])[0];
  return v ? v.bw / v.bh : (w.asp || 1);
}
const miary = new Map();      // tekst → { a: szer/wys, k: wys. obrysu / wys. nominalna } (po wczytaniu czcionki)
function miaraNapisu(P, t) {
  if (miary.has(t)) return miary.get(t);
  const H = 40;
  const r = elementPlaced(P.el, { id: 'napisE', uid: 'pm', p: { ...NAPIS, tekst: t }, s: H / P.FE.h, u: 0, v: 0, rot: 0 }, P.R);
  if (r.pending || !r.lb) return { a: 0.74 * Math.max(1, t.length), k: 1, szac: true };
  const m = { a: r.lb.w / r.lb.h, k: r.lb.h / H }; miary.set(t, m); return m;
}
const boxWz = (P, c) => { const h = c.s * P.F.h; return { x: P.F.cx, y: P.F.cy + c.v * P.F.h / 2, w: h * aspWz(c.w, h), h }; };
const boxNapis = (P, c) => { const m = miaraNapisu(P, c.t), h = c.ts * P.F.h * m.k; return { x: P.F.cx, y: P.F.cy + c.tv * P.F.h / 2, w: h * m.a, h }; };
/** Logo: prawy górny róg ścianki. Zwraca { box } albo null. */
const smokPam = new WeakMap();
function smokNa(P) {
  if (!P) return null;
  if (smokPam.has(P)) return smokPam.get(P);
  const F = P.FE, h = SMOK_H, w = h * aspWz(SMOK, h), pad = 3;
  let wynik = null;
  // prawy górny róg pola: od góry w dół, od prawej do środka
  szukaj: for (let y = F.y0 + F.h - 1 - pad - h / 2; y > F.y0 + F.h * 0.45; y -= 5) {
    for (let x = F.x0 + F.w - w / 2; x > F.cx + F.w * 0.08; x -= 4) {
      if (prost(P, { x, y, w: w + 2 * pad, h: h + 2 * pad }, P.polyE)) { wynik = { box: { x, y, w, h } }; break szukaj; }
    }
  }
  smokPam.set(P, wynik); return wynik;
}
/** Położenie i wielkość z pola F → u, v, s silnika (względem FE). */
const naSilnik = (P, x, y, H) => ({ u: +((x - P.FE.cx) / (P.FE.w / 2)).toFixed(4), v: +((y - P.FE.cy) / (P.FE.h / 2)).toFixed(4), s: +(H / P.FE.h).toFixed(4) });

// ---------------------------------------------------------------- układanie bez kolizji
/** Czy element (rodzaj 'w' wzór / 't' napis) w ustawieniu c mieści się na wszystkich ściankach z listy. */
function miesci(Ps, c, rodzaj, zDrugim = true) {
  for (const [k, P] of Ps) {
    const b = rodzaj === 'w' ? boxWz(P, c) : boxNapis(P, c);
    if (!prost(P, b)) return false;
    if (S.smok && k === '1') { const sm = smokNa(P); if (sm && zachodzi(b, sm.box)) return false; }
    if (zDrugim) {
      const jestDrugi = rodzaj === 'w' ? !!c.t && !c.tBrak : !!c.w && !c.wBrak;
      if (jestDrugi && zachodzi(b, rodzaj === 'w' ? boxNapis(P, c) : boxWz(P, c))) return false;
    }
  }
  return true;
}
const minWz = id => { const w = wzorInfo(id); return Math.max(WZ_MIN, ((w && w.minH) || 0) + 1); };   // najmniejszy sprawdzony rysunek wzoru
const minS = (Ps, rodzaj, c) => Math.max(...Ps.map(([, P]) => (rodzaj === 'w' ? minWz(c.w) : NAPIS_MIN / miaraNapisu(P, c.t).k) / P.F.h));
const KS = { w: 's', t: 'ts' }, KV = { w: 'v', t: 'tv' };
/** Zmniejsza element w miejscu, aż się zmieści; potem próbuje go przesunąć. false = nie ma miejsca. */
function wcisnij(Ps, c, rodzaj, zDrugim = true) {
  const ks = KS[rodzaj], kv = KV[rodzaj], lo = minS(Ps, rodzaj, c);
  if (lo > 1) return false;                                    // najmniejszy rysunek wzoru jest wyższy niż pole ścianki
  c[ks] = clamp(c[ks], lo, 1); c[kv] = clamp(c[kv], -1, 1);
  const s0 = c[ks], v0 = c[kv];
  for (let s = s0; s >= lo - 1e-6; s = s > lo && s * 0.95 < lo ? lo : s * 0.95) { c[ks] = s; if (miesci(Ps, c, rodzaj, zDrugim)) return true; }
  // nie mieści się w tym miejscu nawet najmniejszy – szukamy miejsca (od obecnego położenia w obie strony)
  for (let s = Math.min(s0, lo * 1.6); s >= lo - 1e-6; s = s > lo && s * 0.9 < lo ? lo : s * 0.9) {
    c[ks] = s;
    for (let d = 0.04; d <= 2; d += 0.04) for (const z of [-1, 1]) { const v = v0 + z * d; if (Math.abs(v) > 1) continue; c[kv] = v; if (miesci(Ps, c, rodzaj, zDrugim)) return true; }
  }
  c[ks] = s0; c[kv] = v0; return false;
}
/**
 * Poprawia ustawienie ścianki po zmianie. kto: 'w' | 't' (co ruszył użytkownik) albo null (zmiana kształtu / start),
 * co: 's' | 'v' | 'nowy'. Zwraca poprawione ustawienie albo null (zmiana niemożliwa – zostaje poprzednie).
 */
function napraw(Ps, c0, kto, co, stare) {
  const c = { ...c0 }; delete c.wBrak; delete c.tBrak;
  const jest = { w: !!c.w, t: !!c.t };
  if (!Ps.length) return c;
  const kolej = kto === 't' ? ['t', 'w'] : ['w', 't'];
  const [a, b] = kolej;
  // 1) element ruszony: sam (bez drugiego) musi się mieścić
  if (jest[a]) {
    if (kto && co === 'v' && stare) {
      // przesuwanie: zatrzymuje się na przeszkodzie (wielkość bez zmian)
      const cel = clamp(c[KV[a]], -1, 1), od = stare[KV[a]]; let ok = od;
      for (let i = 1; i <= 40; i++) { c[KV[a]] = od + (cel - od) * i / 40; if (miesci(Ps, c, a, false)) ok = c[KV[a]]; else break; }
      c[KV[a]] = ok;
      if (!miesci(Ps, c, a, false) && !wcisnij(Ps, c, a, false)) return null;
    } else if (!wcisnij(Ps, c, a, false)) { if (kto) return null; c[a + 'Brak'] = true; }
  }
  // 2) drugi element ustępuje: zostaje, gdy nie koliduje; inaczej odsuwa się (po swojej stronie, potem po drugiej), w razie potrzeby maleje
  if (jest[b]) {
    if (!jest[a] || c[a + 'Brak']) { if (!wcisnij(Ps, c, b, false)) c[b + 'Brak'] = true; }
    else if (!miesci(Ps, c, b, true)) {
      const P = Ps[0][1], hA = () => (a === 'w' ? boxWz(P, c) : boxNapis(P, c)).h / P.F.h, lo = minS(Ps, b, c);
      const strona0 = c[KV[b]] < c[KV[a]] ? -1 : 1, s0 = c[KS[b]];
      let ok = false;
      proba: for (let s = s0; s >= lo - 1e-6; s = s > lo && s * 0.93 < lo ? lo : s * 0.93) {
        c[KS[b]] = s;
        const hB = (b === 'w' ? boxWz(P, c) : boxNapis(P, c)).h / P.F.h;
        for (const z of [strona0, -strona0]) {
          for (let dod = 0; dod <= 0.5; dod += 0.05) {
            c[KV[b]] = c[KV[a]] + z * (hA() + hB + 2 * ODSTEP / P.F.h + dod);
            if (Math.abs(c[KV[b]]) <= 1 && miesci(Ps, c, b, true)) { ok = true; break proba; }
          }
        }
      }
      if (!ok) { if (kto) return null; c[b + 'Brak'] = true; }
    }
  }
  return c;
}
const listaPol = k => { const p = pola(); return (S.same ? ['1', '2', '3', '4'] : [String(k)]).filter(q => p[q]).map(q => [q, p[q]]); };
/** Wszystkie ścianki od nowa (zmiana kształtu, start, dane dotarły). */
function ulozWszystko() {
  for (const k of (S.same ? [1] : [1, 2, 3, 4])) {
    const c = napraw(listaPol(k), S.sc[k], null, 'nowy', null);
    if (c) S.sc[k] = c;
    kom[k] = c && (c.wBrak || c.tBrak) ? (c.tBrak ? T.long : T.brak) : '';
  }
  if (S.same) for (const k of [2, 3, 4]) kom[k] = kom[1];
}

// ---------------------------------------------------------------- stan prosty → zdobienia silnika
const DNO_N = [0, 1, 4, 8];
function dnoItems() {
  const d = S.dno || {}; if (!d.n) return [];
  let D = clamp(+d.d || 6, 5, 30), r = clamp(+d.r || 0.2, 0.08, 0.4);
  // otwory nie mogą się zetknąć (pierścień otworów wyciąłby środek dna) ani wyjść poza pole dna
  const m = A.model(), fl = m && elements(m, A.wz.decor).find(e => e.kind === 'floor');
  if (fl && d.n > 1) {
    const M = Math.min(fl.sbb.w, fl.sbb.h), odst = 8, k = d.n === 4 ? 1 : Math.sin(Math.PI / d.n);
    for (; D >= 5; D -= 1) {
      const rMin = (D + odst) / (2 * k) / M, rMax = (M / 2 - D / 2 - 2) / M;
      if (rMin <= rMax) { r = clamp(r, rMin, rMax); break; }
    }
  }
  return [{ id: 'kropki', uid: 'pdno', n: d.n, d: D, rozstaw: +r.toFixed(3) }];
}
function itemsSc(k, p) {
  const c = cfg(k), items = [], P = p[k]; if (!P) return items;
  if (c.w && !c.wBrak) items.push({ id: 'wzor', uid: `p${k}w`, w: c.w, ...naSilnik(P, P.F.cx, P.F.cy + c.v * P.F.h / 2, c.s * P.F.h), rot: 0, mir: false, male: 'powieksz', fill: { ...ISKRY } });
  if (c.t && !c.tBrak) items.push({ id: 'napisE', uid: `p${k}t`, p: { ...NAPIS, tekst: c.t }, ...naSilnik(P, P.F.cx, P.F.cy + c.tv * P.F.h / 2, c.ts * P.F.h), rot: 0, male: 'powieksz', fill: { ...ISKRY } });
  if (S.smok && k === 1) { const sm = smokNa(P); if (sm) items.push({ id: 'wzor', uid: 'psmok', w: SMOK, ...naSilnik(P, sm.box.x, sm.box.y, sm.box.h), rot: 0, mir: false }); }
  return items;
}
let pelne = null;             // ostatnie pełne zdobienia (wszystkie ścianki)
/** tylko = numer ścianki liczonej na bieżąco (ruch suwaka): pozostałe zostają takie, jak przy ostatnim pełnym przeliczeniu. */
function zbuduj(tylko = 0) {
  const el = {}, p = pola();
  const dno = dnoItems(); if (dno.length) el[5] = { items: dno };
  for (const k of [1, 2, 3, 4]) {
    const items = tylko && k !== tylko && pelne ? ((pelne.el[k] || {}).items || []) : itemsSc(k, p);
    if (items.length) el[k] = { items };
  }
  return { tech: 'laser', margin: 15, el };
}
let ostatni = '';
/** Zapisuje zdobienia w silniku; true = coś się zmieniło. */
function wyslij(powiadom = true, szybko = false) {
  const tylko = szybko ? (S.same ? A.frontowa() : S.sel) : 0;
  const d = zbuduj(tylko), sig = JSON.stringify(d.el);
  if (!szybko) { zapisz(); pelne = d; }
  if (sig === ostatni) return false;
  ostatni = sig; setDecor0(d);
  if (powiadom) A.zmiana(szybko);
  return true;
}
/** Zdobienia silnika (link, cofnij, plik) → stan prosty. Wszystko spoza wersji prostej jest pomijane. */
function czytaj(d) {
  const N = stanDef(), pp = pola(); N.sel = S.sel; N.smok = false;
  for (const k of [1, 2, 3, 4]) {
    const items = itemsFor({ el: (d && d.el) || {} }, String(k)), c = { ...scDef(), w: '', t: '' };
    for (const it of items) {
      if (it.id === 'wzor' && String(it.w).startsWith('smok')) continue;
      const zS = it2 => { const P = pp[k]; if (!P) return [clamp(+it2.s || 0.3, 0.03, 1), clamp(+it2.v || 0, -1, 1)]; const H = (+it2.s || 0.3) * P.FE.h, y = P.FE.cy + (+it2.v || 0) * P.FE.h / 2; return [clamp(H / P.F.h, 0.03, 1), clamp((y - P.F.cy) / (P.F.h / 2), -1, 1)]; };
      if (it.id === 'wzor' && !c.w && WZORY.includes(it.w)) { c.w = it.w; [c.s, c.v] = zS(it); }
      if (it.id === 'napisE' && !c.t && it.p && it.p.tekst) { c.t = String(it.p.tekst).slice(0, NAPIS_MAX); [c.ts, c.tv] = zS(it); }
    }
    N.sc[k] = c;
  }
  { const kr = itemsFor({ el: (d && d.el) || {} }, '5').find(it => it.id === 'kropki'); N.dno = kr ? { n: DNO_N.includes(+kr.n) ? +kr.n : 4, d: clamp(+kr.d || 6, 5, 30), r: clamp(+kr.rozstaw || 0.2, 0.08, 0.4) } : { ...S.dno, n: 0 }; }
  const kl = c => JSON.stringify([c.w, c.t, c.w && [c.s, c.v], c.t && [c.ts, c.tv]]);
  N.same = [2, 3, 4].every(k => kl(N.sc[k]) === kl(N.sc[1]));
  S = N;
}

// ---------------------------------------------------------------- panel
const $ = id => document.getElementById(id);
const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function budujPanel() {
  const box = $('pPanel');
  box.innerHTML = `<h2>${T.h}</h2>
    <label class="p-same"><input type="checkbox" id="pSame"><span>${T.same}</span></label>
    <div class="p-sc" id="pSc"><span>${T.side}</span>${[1, 2, 3, 4].map(k => `<button type="button" class="chip" data-k="${k}">${k}</button>`).join('')}</div>
    <div class="p-gal" id="pGal"></div>
    <div class="p-row"><span class="p-ic" title="${T.size}">${IK.size}</span><input type="range" id="pWs" min="0" max="100" step="1" aria-label="${T.size}"></div>
    <div class="p-row"><span class="p-ic" title="${T.pos}">${IK.pos}</span><input type="range" id="pWv" min="-100" max="100" step="1" aria-label="${T.pos}"></div>
    <div class="p-sub">${T.text}</div>
    <input type="text" id="pT" class="p-text" maxlength="${NAPIS_MAX}" placeholder="${T.ph}" spellcheck="false" autocomplete="off" aria-label="${T.text}">
    <div class="p-row"><span class="p-ic" title="${T.size}">${IK.size}</span><input type="range" id="pTs" min="0" max="100" step="1" aria-label="${T.size}"></div>
    <div class="p-row"><span class="p-ic" title="${T.pos}">${IK.pos}</span><input type="range" id="pTv" min="-100" max="100" step="1" aria-label="${T.pos}"></div>
    <p class="p-kom" id="pKom" role="status" aria-live="polite"></p>
    <div class="p-dno" id="pDno"><div class="p-sub">${T.dno}</div>
      <div class="p-sc" id="pDn">${DNO_N.map(n => `<button type="button" class="chip" data-n="${n}">${n || T.dnoBrak}</button>`).join('')}</div>
      <div class="p-row"><span class="p-ic" title="${T.dnoD}">${IK.dia}</span><input type="range" id="pDd" min="5" max="30" step="1" aria-label="${T.dnoD}"><output id="pDdO"></output></div>
      <div class="p-row"><span class="p-ic" title="${T.dnoR}">${IK.roz}</span><input type="range" id="pDr" min="8" max="40" step="1" aria-label="${T.dnoR}"><output></output></div></div>`;
  $('pDn').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; track('dno_otwory', { k: b.dataset.n }); S.dno.n = +b.dataset.n; odswiez(); wyslij(); });
  $('pDd').addEventListener('input', e => { S.dno.d = +e.target.value; odswiez(); wyslij(true, false); });
  $('pDr').addEventListener('input', e => { S.dno.r = +e.target.value / 100; odswiez(); wyslij(true, false); });
  $('pSame').addEventListener('change', e => {
    if (e.target.checked) { const c = { ...S.sc[S.sel] };
      przedSame = { sc: JSON.parse(JSON.stringify(S.sc)), wspolna: JSON.stringify(c) };          // zapamiętane ustawienia osobnych ścianek
      for (const k of [1, 2, 3, 4]) S.sc[k] = { ...c }; S.same = true; }
    else {
      // odznaczenie bez żadnej zmiany po drodze = pomyłka: wracają poprzednie, osobne ścianki; po zmianie – wszystkie dostają wspólny wzór
      if (przedSame && JSON.stringify(S.sc[1]) === przedSame.wspolna) S.sc = przedSame.sc; else for (const k of [2, 3, 4]) S.sc[k] = { ...S.sc[1] };
      przedSame = null; S.same = false; }
    track('scianki', { k: S.same ? 'takie_same' : 'osobno' });
    ulozWszystko(); odswiez(); wyslij(); if (!S.same) A.kamera(S.sel);
  });
  $('pSc').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || S.same) return; S.sel = +b.dataset.k; odswiez(); zapisz(); A.kamera(S.sel); });
  $('pGal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    zmien('w', 'nowy', c => { c.w = b.dataset.w; if (c.w && !(c.s > 0)) c.s = 0.6; });
    track('wzor', { k: b.dataset.w || 'brak' });
  });
  const suwak = (id, kto, co, ustaw) => {
    $(id).addEventListener('input', e => { zmien(kto, co, c => ustaw(c, +e.target.value), true); trackDebounced(id, 'suwak', { k: id }); });
    $(id).addEventListener('change', () => { ulozWszystko(); odswiez(); if (!wyslij()) A.zmiana(false); });   // puszczenie suwaka: wszystkie ścianki, dokładnie
  };
  suwak('pWs', 'w', 's', (c, v) => { c.s = zProc(v, 'w'); });
  suwak('pWv', 'w', 'v', (c, v) => { c.v = v / 100; });
  suwak('pTs', 't', 's', (c, v) => { c.ts = zProc(v, 't'); });
  suwak('pTv', 't', 'v', (c, v) => { c.tv = v / 100; });
  let tT = 0;
  $('pT').addEventListener('input', e => { clearTimeout(tT); const v = e.target.value; tT = setTimeout(() => zmien('t', 'nowy', c => { c.t = v.replace(/\s+/g, ' ').trimStart().slice(0, NAPIS_MAX); }), 250); trackDebounced('napis', 'napis', {}, 3000); });
  wczytajMini().then(galeria).catch(() => {});
}
const IK = {
  size: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="8" height="8" rx="1"/><path d="M9 3h8v8M17 3l-6 6"/></svg>',
  dnoH: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16" stroke="#df3434" stroke-width="2.2"/><path d="M3 20h18M12 19v-8M9.5 13.5 12 11l2.5 2.5"/></svg>',
  nogi: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v14h-3.5v-7a4.5 4.5 0 0 0-9 0v7H4z"/><path d="M12 19v-9" stroke="#df3434"/></svg>',
  dia: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="6"/><path d="M4 16 16 4"/></svg>',
  roz: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="4" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><path d="M8 10h4"/></svg>',
  pos: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v16M6 6l4-4 4 4M6 14l4 4 4-4"/></svg>',
};
// suwak wielkości: 0…100 → od najmniejszej do całej wysokości pola
const zakres = rodzaj => { const Ps = listaPol(S.sel); return [Ps.length ? minS(Ps, rodzaj, cfg(S.sel)) : 0.1, 1]; };
const zProc = (v, rodzaj) => { const [a, b] = zakres(rodzaj); return a + (b - a) * v / 100; };
const naProc = (s, rodzaj) => { const [a, b] = zakres(rodzaj); return Math.round(clamp((s - a) / (b - a || 1), 0, 1) * 100); };

function galeria() {
  const M = Mini() || {}, c = cfg(S.sel);
  $('pGal').innerHTML = `<button type="button" class="p-wz${c.w ? '' : ' on'}" data-w="" title="${T.none}" aria-label="${T.none}"><svg viewBox="0 0 20 20" class="p-x"><circle cx="10" cy="10" r="6.5"/><path d="M5.4 14.6 14.6 5.4"/></svg></button>` +
    WZORY.map(id => `<button type="button" class="p-wz${c.w === id ? ' on' : ''}" data-w="${esc(id)}"><svg viewBox="-52 -52 104 104"><path d="${M[id] || ''}"/></svg></button>`).join('');
}
function odswiez() {
  if (!$('pSame')) return;
  const c = cfg(S.sel), wOk = !!c.w && !c.wBrak, tOk = !!c.t && !c.tBrak;
  $('pSame').checked = S.same;
  $('pSc').classList.toggle('off', S.same);
  $('pSc').querySelectorAll('button').forEach(b => { b.disabled = S.same; b.classList.toggle('active', !S.same && +b.dataset.k === S.sel); });
  $('pGal').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.w === (c.w || '')));
  const ust = (id, v, on) => { const e = $(id); if (document.activeElement !== e || !on) e.value = v; e.disabled = !on; e.style.setProperty('--p', `${(v - e.min) / (e.max - e.min) * 100}%`); e.closest('.p-row').classList.toggle('off', !on); };
  ust('pWs', naProc(c.s, 'w'), wOk); ust('pWv', Math.round(c.v * 100), wOk);
  ust('pTs', naProc(c.ts, 't'), tOk); ust('pTv', Math.round(c.tv * 100), tOk);
  if (document.activeElement !== $('pT')) $('pT').value = c.t || '';
  $('pKom').textContent = kom[S.same ? 1 : S.sel] || '';
  const d = S.dno;
  $('pDn').querySelectorAll('button').forEach(b => b.classList.toggle('active', +b.dataset.n === d.n));
  ust('pDd', d.d, d.n > 0); ust('pDr', Math.round(d.r * 100), d.n > 1);
  $('pDdO').textContent = d.n ? `${d.d} mm` : '';
}
/** Zmiana z panelu: kto ('w' | 't'), co ('s' | 'v' | 'nowy'), fn zmienia kopię ustawienia. */
function zmien(kto, co, fn, szybko = false) {
  const k = S.same ? 1 : S.sel, stare = S.sc[k], c = { ...stare };
  fn(c); naprawy = 0;
  let n = napraw(listaPol(k), c, kto, co === 'nowy' ? 'nowy' : co, stare);
  if (!n && co === 'nowy') n = napraw(listaPol(k), c, null, 'nowy', stare);   // nowy wzór / napis: gdy ciasno, może ustąpić sam
  // nowy wzór obok napisu (albo napis obok wzoru) i jedno by wypadło: układ jak na starcie – wzór wyżej i mniejszy, napis na dole
  if (co === 'nowy' && c.w && c.t && (!n || n.wBrak || n.tBrak)) {
    for (const s of [0.56, 0.46, 0.38, 0.3, 0.24, 0.18]) { const n2 = napraw(listaPol(k), { ...c, s: Math.min(c.s, s), v: 0.24, ts: Math.min(c.ts, 0.16), tv: -0.72 }, null, 'nowy', stare);
      if (n2 && !n2.wBrak && !n2.tBrak) { n = n2; break; } }
  }
  if (n) { S.sc[k] = n; kom[k] = n.wBrak || n.tBrak ? (n.tBrak ? T.long : T.brak) : ''; if (S.same) for (const q of [2, 3, 4]) kom[q] = kom[1]; }
  odswiez();
  if (n) wyslij(true, szybko);
}

// ---------------------------------------------------------------- kontrola wyniku silnika
// Układanie liczy na prostokątach; ostatnie słowo ma silnik: gdy zgłosi wyjście poza strefę albo kolizję,
// element maleje (kilka prób). Wyspy (luźny kawałek blachy) blokują pobranie pliku.
let wyspy = false, czeka = false; const slabe = new Set();
function sprawdz() {
  const m = A.model(); if (!m) return;
  let zmiana = false; wyspy = false; czeka = false; slabe.clear();
  for (const e of elements(m, A.wz.decor)) {
    const items = itemsFor(A.wz.decor, e.key); if (!items.length) continue;
    if (e.kind !== 'wall') { const r0 = elementHoles(e, items, A.wz.decor); if (r0.islands && r0.islands.length) wyspy = true; continue; }
    const r = elementHoles(e, items, A.wz.decor);
    if (r.pending) { czeka = true; continue; }
    if (r.islands && r.islands.length) wyspy = true;
    if (r.sztywnosc && r.sztywnosc.ocena === 'słaba') slabe.add(+e.key);   // ocena silnika: udział wycięcia względem grubości blachy
    const k = S.same ? 1 : +e.key;
    items.forEach((it, i) => {
      const p = r.per[i]; if (!p || !(p.poza || p.kolizja) || it.uid === 'psmok' || naprawy > 12) return;
      const c = S.sc[k];
      if (it.id === 'wzor') c.s *= 0.93; else c.ts *= 0.93;
      zmiana = true;
    });
  }
  if (zmiana) { naprawy++; ulozWszystko(); odswiez(); wyslij(); return; }
  if (wyspy && $('pKom')) $('pKom').textContent = T.wysp;
  else if ($('pKom') && !$('pKom').textContent && (S.same ? slabe.size : slabe.has(S.sel))) $('pKom').textContent = T.slaba;
}

function syncNogi() {
  const st = A.stan(), m = A.model(), L = (m && m.limits) || {};
  const ust = (id, v, min, max) => { const r = document.getElementById('r-' + id), n = document.getElementById('n-' + id); if (!r) return;
    r.min = min; r.max = Math.max(max, min + 5); r.value = v; r.disabled = max <= min;
    if (document.activeElement !== n) n.value = v;
    r.style.setProperty('--p', `${max > min ? (v - min) / (max - min) * 100 : 0}%`); };
  const t = st.height + st.legHeight;
  ust('total', t, TOT.min, TOT.max);
  ust('dno', st.legHeight, LIM.legHeight.min, Math.min(LIM.legHeight.max, t - LIM.height.min, (L.legHeight || {}).max || 999));
  const lc = L.legCut || { min: 15, max: 200 };
  ust('legCut', st.legCut, lc.min, lc.max);
}

// ---------------------------------------------------------------- API dla app.js
export function initProsty(a) {
  A = a; setDecor0 = a.wz.setDecor;
  // każde wczytanie zdobień z zewnątrz (link, cofnij) przechodzi przez sito wersji prostej
  a.wz.setDecor = d => { czytaj(d); ostatni = ''; ulozWszystko(); odswiez(); wyslij(false); };
  let zap = null; try { zap = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch {}
  if (zap && zap.sc && [1, 2, 3, 4].every(k => zap.sc[k])) {
    S = { ...stanDef(), same: !!zap.same, sel: clamp(+zap.sel || 1, 1, 4), smok: false, sc: {} };
    if (zap.dno) S.dno = { n: DNO_N.includes(+zap.dno.n) ? +zap.dno.n : 4, d: clamp(+zap.dno.d || 6, 5, 30), r: clamp(+zap.dno.r || 0.2, 0.08, 0.4) };
    for (const k of [1, 2, 3, 4]) { const c = zap.sc[k]; S.sc[k] = { ...scDef(), w: WZORY.includes(c.w) ? c.w : '', s: +c.s || 0.6, v: +c.v || 0, t: String(c.t || '').slice(0, NAPIS_MAX), ts: +c.ts || 0.16, tv: Number.isFinite(+c.tv) ? +c.tv : -0.72 }; }
  }
  budujPanel();
  // rejestr pobrań: wymiary, wzory, czy jest napis (TYLKO liczba znaków – treść nie jest wysyłana), smok, otwory dna
  setProjektSource(() => { const st = A.stan(), d = dnoItems()[0];
    return { wym: { bok: st.base, wys: st.height + st.legHeight, kat: st.angle, dno: st.legHeight, nogi: st.legCut, blacha: st.tBowl }, mat: st.mat ? 'S355J2W' : 'S235', luz: st.gap,
      wz: [1, 2, 3, 4].map(k => { const c = cfg(k); return c.w && !c.wBrak ? c.w : '-'; }), nap: [1, 2, 3, 4].map(k => { const c = cfg(k); return c.t && !c.tBrak ? c.t.length : 0; }),
      otw: d ? d.n : 0 }; });
  for (const id of ['notchDepth', 'notchWidth']) { const r = document.getElementById('r-' + id); if (r) r.closest('.ctl').style.display = 'none'; }   // bez podcięć
  // karta „Kształt”: wysokość dna i wycięcie między nogami (z ukrytej karty „Stopki”); Gięcie 4 niedostępne przy nogach z boków
  { const body = document.getElementById('ctl-body'), lh = document.getElementById('r-legHeight'), arch = document.getElementById('archOpts');
    // Wysokość paleniska (całkowita), wysokość dna i wysokość nóżek – własne suwaki.
    // Silnik zna „wysokość ścianek nad dnem” (height) i „wysokość dna” (legHeight); tu dno przesuwa się WEWNĄTRZ stałej wysokości.
    const wiersz = (id, ik, tyt, min, max) => { const n = document.createElement('div'); n.className = 'row ctl'; n.title = tyt;
      n.innerHTML = `<label for="r-${id}" class="ctl-ic">${ik}</label><input type="range" id="r-${id}" min="${min}" max="${max}" step="5" aria-label="${tyt}"><span class="num"><input type="number" id="n-${id}" step="5" aria-label="${tyt}"><em>mm</em></span>`;
      return n; };
    const hRow = document.getElementById('r-height').closest('.ctl');
    const tot = wiersz('total', hRow.querySelector('.ctl-ic').innerHTML, T.totH, TOT.min, TOT.max);
    hRow.parentElement.insertBefore(tot, hRow); hRow.style.display = 'none';
    if (lh) lh.closest('.ctl').style.display = 'none';
    const dno = wiersz('dno', IK.dnoH, T.floorH, LIM.legHeight.min, LIM.legHeight.max), nog = wiersz('legCut', IK.nogi, T.legH, 15, 200);
    body.appendChild(dno); body.appendChild(nog);
    const pod = (id, fn) => { const r = document.getElementById('r-' + id), n = document.getElementById('n-' + id);
      r.addEventListener('input', () => fn(+r.value));
      n.addEventListener('change', () => { if (n.value !== '' && Number.isFinite(+n.value)) fn(Math.round(+n.value / 5) * 5); else syncNogi(); });   // puste / nie-liczba: wraca poprzednia wartość
      n.addEventListener('keydown', e => { if (e.key === 'Enter') n.blur(); }); };
    pod('total', v => { const st = A.stan(); v = clamp(v, TOT.min, TOT.max); const leg = clamp(st.legHeight, LIM.legHeight.min, v - LIM.height.min); A.ustaw({ legHeight: leg, height: v - leg }); });
    // dno przesuwa się wewnątrz tej samej bryły: wysokość i obrys paleniska zostają, zmienia się bok dna (ścianki są pochylone)
    pod('dno', v => { const st = A.stan(), t = st.height + st.legHeight; const leg = clamp(v, LIM.legHeight.min, Math.min(LIM.legHeight.max, t - LIM.height.min));
      const base = clamp(Math.round((st.base + 2 * (leg - st.legHeight) * Math.tan(st.angle * Math.PI / 180)) / 5) * 5, LIM.base.min, LIM.base.max);
      A.ustaw({ legHeight: leg, height: t - leg, base }); });
    pod('legCut', v => A.set('legCut', Math.max(15, v)));   // 0 oznacza w silniku „najwyżej jak się da” – z pola liczbowego nie wpuszczamy
    for (const id of ['total', 'dno', 'legCut']) document.getElementById('r-' + id).addEventListener('input', () => trackDebounced('k' + id, 'slider', { param: id }));
    for (const q of ['[data-opt=bowlBent]', '[data-opt=perfBowl]']) { const e = document.querySelector('.card-left ' + q); if (e) e.closest('.opt-row').style.display = 'none'; }   // bez gięcia
    if (arch) { const w = document.createElement('div'); w.className = 'opt-row'; w.title = T.arch; w.appendChild(arch); body.parentElement.insertBefore(w, body.nextSibling); }
    const g4 = document.getElementById('bowlAll'); if (g4) g4.style.display = 'none'; }
  const gotowy = wczytajIndeks().then(() => { ulozWszystko(); odswiez(); wyslij(); }).catch(() => {});
  return {
    /** Po zmianie kształtu (przed liczeniem wzorów): pola ścianek mają nowe wymiary. */
    ksztalt() { syncNogi(); if (!wzorInfo(WZORY[0])) return; naprawy = 0; ulozWszystko(); odswiez(); wyslij(false); },
    /** Dotarły dane (wzór, czcionka): wymiary napisu są już dokładne. */
    dane() { if (!wzorInfo(WZORY[0])) return; ulozWszystko(); odswiez(); wyslij(); },
    /** Po przeliczeniu wzorów przez silnik. */
    poLiczeniu() { sprawdz(); },
    /** Powód, dla którego nie wolno pobrać pliku ('' = wolno). */
    blokada() { return wyspy ? T.wysp : ''; },
    /** Kliknięcie elementu na modelu albo rozkroju. */
    wybierz(key) {
      const k = +key, mig = e => { if (!e) return; e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); e.classList.remove('p-mig'); void e.offsetWidth; e.classList.add('p-mig'); };
      if (k === 5) { mig($('pDno')); return; }
      if (!(k >= 1 && k <= 4)) return;
      if (!S.same) { S.sel = k; zapisz(); odswiez(); }
      mig($('pGal'));
    },
    stan: () => S,
    /** Nowy projekt: 'start' (wzory startowe + napis) albo 'czysty' (sam napis OGIMORA na ściance 1). */
    reset(rodzaj) { S = rodzaj === 'czysty' ? stanCzysty() : stanDef(); naprawy = 0; ostatni = ''; zapisz(); if (wzorInfo(WZORY[0])) { ulozWszystko(); odswiez(); } wyslij(false); },
    /** Spełnia się, gdy wzory są wczytane i ułożone (stan projektu jest już ustalony). */
    gotowy,
  };
}
