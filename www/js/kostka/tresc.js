// OGIMORA – kostka: co jest wycięte w ściance (kropki, napis / liczba, duży otwór).
// Układ ścianki: środek w (0, 0), „góra” = +y, widok z zewnątrz. Otwory: listy punktów { x, y, b } (b – łuk jak w DXF).
import napis, { onFontLoaded } from '../zdobienia/napis.js';
import { build, bounds } from '../zdobienia/silnik.js';

export const TYPY = ['brak', 'kropki', 'napis', 'otwor'];
export const NAPIS_MAX = 12;
/** Najmniejszy mostek we wzorze / literze dla blachy t [mm] – jak w palenisku: nie cieńszy niż blacha, najmniej 3 mm (2 mm: 2,5). */
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
function litery(tekst, H, w) {
  const klucz = `${tekst}|${H.toFixed(2)}|${w}`;
  if (pamiec.has(klucz)) return pamiec.get(klucz);
  const spec = napis.make({ tekst, font: 'Gruba', odstep: 0.06, luk: 0, pogrub: 0, mosty: 'pionowe', ile: '2', efekt: 'pełne' }, H, w);
  if (spec.pending) return { pending: true, holes: [] };
  const wyn = build(spec, { w, r: 0.35 });
  if (pamiec.size > 200) pamiec.delete(pamiec.keys().next().value);
  pamiec.set(klucz, wyn);
  return wyn;
}

/**
 * sc = { typ, n (kropki 1–6), tekst, ksztalt ('kolo' | 'kwadrat'), skala (0,2–1) }
 * s  = pół boku pola na treść [mm], t = blacha [mm]
 * Zwraca { holes: [[{x,y,b}]], uwagi: [kod], pending }.
 */
export function tresc(sc, s, t) {
  const uwagi = [];
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
    const r = s * (0.25 + 0.7 * skala);
    if (sc.ksztalt === 'kwadrat') return { holes: [[{ x: -r, y: -r }, { x: r, y: -r }, { x: r, y: r }, { x: -r, y: r }]], uwagi };
    return { holes: [kolo(0, 0, r)], uwagi };
  }
  if (sc.typ === 'napis') {
    const tekst = String(sc.tekst || '').slice(0, NAPIS_MAX);
    if (!tekst.trim()) return { holes: [], uwagi };
    const w = mostek(t);
    // wysokość liter: krótki napis (liczba) – do 1,5 s; długi – tyle, żeby zmieścił się na szerokość
    let H = s * 1.5 * skala, wyn = litery(tekst, H, w);
    if (wyn.pending) return { holes: [], uwagi, pending: true };
    let bb = bounds(wyn.holes.length ? wyn.holes : [[[0, 0]]]);
    const szer = bb.x1 - bb.x0, maxSzer = 2 * s * 0.96;
    if (szer > maxSzer) { H = Math.floor(H * maxSzer / szer * 10) / 10; wyn = litery(tekst, H, w); bb = bounds(wyn.holes.length ? wyn.holes : [[[0, 0]]]); }
    if (H < 14 || wyn.lost > 0.25) uwagi.push('male');
    if (wyn.islands && wyn.islands.length) uwagi.push('wyspy');
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    return { holes: wyn.holes.map(r => r.map(([x, y]) => ({ x: x - cx, y: y - cy }))), uwagi };
  }
  return { holes: [], uwagi };
}
