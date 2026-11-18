// OGIMORA – kostka: co jest wycięte w ściance (kropki, napis / liczba w 1–3 wierszach, duży otwór).
// Układ ścianki: środek w (0, 0), „góra” = +y, widok z zewnątrz. Otwory: listy punktów { x, y, b } (b – łuk jak w DXF).
import napis, { onFontLoaded, CZCIONKI } from '../zdobienia/napis.js';
import { build, bounds } from '../zdobienia/silnik.js';
import { mostkiLiter } from './mostki.js';

export const TYPY = ['brak', 'kropki', 'napis', 'otwor'];
export const NAPIS_MAX = 12;
export const KSZTALTY = ['kolo', 'kwadrat', 'sciety'];
/** Czcionki kostki (SIL OFL). szablon: przerwy są w rysunku liter – nic nie wypada i nie ma długich języków blachy. */
export const FONTY = [
  { id: 'BlackOps', nazwa: 'Black Ops', file: 'BlackOpsOne-Regular.ttf', szablon: true },
  { id: 'Saira', nazwa: 'Saira Stencil', file: 'SairaStencilOne-Regular.ttf', szablon: true },
  { id: 'Plaster', nazwa: 'Plaster', file: 'Plaster-Regular.ttf', szablon: true },
  { id: 'Emblema', nazwa: 'Emblema One', file: 'EmblemaOne-Regular.ttf', szablon: true },
  { id: 'Bungee', nazwa: 'Bungee', file: 'Bungee-Regular.ttf', szablon: false },
  { id: 'Russo', nazwa: 'Russo One', file: 'RussoOne-Regular.ttf', szablon: false },
];
export const FONT_DOM = 'BlackOps';
const font = id => FONTY.find(f => f.id === id) || FONTY[0];
// rejestr czcionek jest wspólny z paleniskiem; czcionki kostki dopisujemy pod własnymi nazwami
FONTY.forEach(f => { if (f.id !== 'Gruba') CZCIONKI['K-' + f.id] = { file: f.file, opis: f.nazwa }; });
const nazwaWRejestrze = id => (id === 'Gruba' ? 'Gruba' : 'K-' + font(id).id);

/** Najmniejszy mostek we wzorze / literze dla blachy t [mm]: nie cieńszy niż blacha, najmniej 3 mm (2 mm: 2,5). */
export const mostek = t => (t < 2.5 ? 2.5 : Math.max(3, 0.6 * t));

const kolo = (cx, cy, r) => [{ x: cx - r, y: cy, b: 1 }, { x: cx + r, y: cy, b: 1 }];   // dwa półokręgi
const UKLAD = {                       // kropki jak na kostce do gry (w ułamkach pola)
  1: [[0, 0]],
  2: [[-1, 1], [1, -1]],
  3: [[-1, 1], [0, 0], [1, -1]],
  4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
  5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
  6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]],
};

let poZaladowaniu = () => {};
onFontLoaded(() => poZaladowaniu());
export function gdyCzcionka(fn) { poZaladowaniu = fn; }

const pamiec = new Map();
function litery(tekst, H, w, fid) {
  const klucz = `${fid}|${tekst}|${H.toFixed(2)}|${w}`;
  if (pamiec.has(klucz)) return pamiec.get(klucz);
  const spec = napis.make({ tekst, font: nazwaWRejestrze(fid), odstep: 0.06, luk: 0, pogrub: 0, mosty: 'pionowe', ile: '2', efekt: 'pełne' }, H, w);
  if (spec.pending) return { pending: true, holes: [] };
  // mostki kostki zamiast mostków paleniska: krótkie, w najwęższym miejscu kreski + podparcie długich języków blachy
  spec.lines = mostkiLiter(spec.regions, w, font(fid).szablon).lines;
  const wyn = build(spec, { w, r: 0.35 });
  wyn.bb = bounds(wyn.holes.length ? wyn.holes : [[[0, 0]]]);
  if (pamiec.size > 300) pamiec.delete(pamiec.keys().next().value);
  pamiec.set(klucz, wyn);
  return wyn;
}
/** Wiersze napisu ścianki: górny, środkowy, dolny – tylko niepuste. */
export const wiersze = sc => [sc.t1, sc.tekst, sc.t3].map(x => String(x || '').slice(0, NAPIS_MAX)).filter(x => x.trim());

/**
 * sc   = { typ, n (kropki 1–6), tekst / t1 / t3 (wiersze), font, ksztalt ('kolo' | 'kwadrat' | 'sciety'), skala (0,2–1) }
 * pole = { s: pół boku kwadratu na treść, baza: obrys ścianki bez zamków, wpis / wpisPelny: odległość środka od najbliższej
 *          krawędzi (z marginesem / bez) } [mm];  t = blacha [mm]
 * Zwraca { holes: [[{x,y,b}]], uwagi: [kod], pending }.
 */
export function tresc(sc, pole, t) {
  const uwagi = [], s = pole.s;
  if (!sc || sc.typ === 'brak' || s <= 4) return { holes: [], uwagi };
  const skala = Math.min(1, Math.max(0.2, +sc.skala || 0.7));
  if (sc.typ === 'kropki') {
    const n = Math.min(6, Math.max(1, Math.round(+sc.n || 1)));
    // siatka 3 × 3: rozstaw d, promień r; odstęp między kropkami i od brzegu pola co najmniej mostek
    const d = s * 0.6, rMax = Math.min((d - mostek(t)) / 2, s - d), r = Math.max(1.5, rMax * skala);
    if (2 * r < Math.max(3, t)) uwagi.push('male');
    return { holes: UKLAD[n].map(([i, j]) => kolo(i * d, j * d, r)), uwagi };
  }
  if (sc.typ === 'otwor') {
    const k = 0.25 + 0.7 * skala;
    if (sc.ksztalt === 'sciety' && pole.baza && pole.wpisPelny > 0) {
      // kwadrat ze ściętymi rogami = obrys ścianki pomniejszony do środka (rogi ścięte w tej samej proporcji co narożniki kostki)
      const f = k * pole.wpis / pole.wpisPelny;
      return { holes: [pole.baza.map(([x, y]) => ({ x: x * f, y: y * f }))], uwagi };
    }
    const r = s * k;
    if (sc.ksztalt === 'kwadrat' || sc.ksztalt === 'sciety') return { holes: [[{ x: -r, y: -r }, { x: r, y: -r }, { x: r, y: r }, { x: -r, y: r }]], uwagi };
    return { holes: [kolo(0, 0, r)], uwagi };
  }
  if (sc.typ === 'napis') {
    const W = wiersze(sc), n = W.length; if (!n) return { holes: [], uwagi };
    const w = mostek(t), maxSzer = 2 * s * 0.96, ODST = 0.25;
    // wysokość liter: jeden wiersz – do 1,5 s; kilka – dzielą między siebie 1,9 s (z odstępami); każdy wiersz mieści się na szerokość
    const H0 = n === 1 ? s * 1.5 * skala : s * 1.9 * skala / (n + ODST * (n - 1));
    const gotowe = [];
    for (const tekst of W) {
      let H = H0, wyn = litery(tekst, H, w, sc.font);
      if (wyn.pending) return { holes: [], uwagi, pending: true };
      if (wyn.bb.w > maxSzer) { H = Math.floor(H * maxSzer / wyn.bb.w * 10) / 10; wyn = litery(tekst, H, w, sc.font); }
      if (H < 12 || wyn.lost > 0.25) uwagi.push('male');
      if (wyn.islands && wyn.islands.length) uwagi.push('wyspy');
      gotowe.push({ wyn, H });
    }
    const odst = ODST * H0, razem = gotowe.reduce((a, g) => a + g.wyn.bb.h, 0) + odst * (n - 1);
    const holes = []; let y = razem / 2;
    for (const g of gotowe) {
      const bb = g.wyn.bb, cx = (bb.x0 + bb.x1) / 2, dy = y - bb.y1;       // górna krawędź wiersza na wysokości y
      g.wyn.holes.forEach(r => holes.push(r.map(([px, py]) => ({ x: px - cx, y: py + dy }))));
      y -= bb.h + odst;
    }
    return { holes, uwagi: [...new Set(uwagi)] };
  }
  return { holes: [], uwagi };
}
