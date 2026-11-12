// OGIMORA – jednostki: milimetry albo cale (USA). Silnik zawsze liczy w milimetrach; tu jest tylko przeliczanie,
// siatki suwaków i wyświetlanie.
// Projekt jest „calowy”, gdy ma blachę z listy calowej (numer gauge albo ułamek cala). Decyduje blacha, bo od jej
// prawdziwej grubości zależą szczeliny zamków. Przełącznik „mm | in” zamienia blachę na najbliższą z drugiej listy
// i zaokrągla wymiary do siatki drugiej jednostki (mm co 5, cale co 1/4").
import { LANG } from './i18n.js';

export const CAL = 25.4;
const r4 = v => +(+v).toFixed(4);
// Blachy w USA (sprawdzone 2026-11-12, OSH Cut / SendCutSend): grubość dziesiętna w calach; t – w mm (dokładnie)
export const BLACHY_IN = [
  { t: 3.048, n: '11 ga', d: '0.120', kod: '11ga' },
  { t: 3.429, n: '10 ga', d: '0.135', kod: '10ga' },
  { t: 4.7625, n: '3/16"', d: '0.188', kod: '3-16' },   // sprzedawana też jako 7 ga (0,179") – projekt na 0,188" przy 7 ga jest tylko trochę luźniejszy
  { t: 6.35, n: '1/4"', d: '0.250', kod: '1-4' },
];
export const BLACHY_MM = [3, 4, 5];
const MM_NA_IN = { 3: 0, 4: 1, 5: 2 };        // 3 mm → 11 ga, 4 mm → 10 ga, 5 mm → 3/16"
const IN_NA_MM = [3, 4, 5, 5];                // i z powrotem (1/4" → 5 mm – w mm nie ma grubszej)
const blachaIn = t => BLACHY_IN.find(b => Math.abs(b.t - +t) < 1e-3);
export const calowa = t => !!blachaIn(t);
export const jednostkaStanu = s => (s && calowa(s.tBowl) ? 'in' : 'mm');
/** Dokładna wartość z listy (bez szumu po przeliczeniach) albo null. */
export const blachaCalowa = t => { const b = blachaIn(t); return b ? b.t : null; };
/** Krótki opis blachy: '5 mm' albo '3/16"'; kod do statystyk: '5' albo '3-16'. */
export const nazwaBlachy = t => { const b = blachaIn(t); return b ? b.n : `${+t} mm`; };
export const kodBlachy = t => { const b = blachaIn(t); return b ? b.kod : String(Math.round(+t)); };
export const opisBlachy = t => { const b = blachaIn(t); return b ? `${b.n} = ${b.d} in (${liczba(b.t, 2)} mm)` : `${+t} mm`; };

// ---------------------------------------------------------------- siatki
export const SIATKA = { mm: 5, in: 0.25 * CAL };          // wymiary: mm co 5, cale co 1/4" (6,35 mm)
export const LUZ = { mm: 0.1, in: 0.005 * CAL };          // luz na stronę: 0,1 mm albo 0,005" (0,127 mm)
export const LUZ_ZAKRES = { mm: [0.1, 1.5], in: [0.005 * CAL, 0.06 * CAL] };
export const naSiatke = (mm, j, krok = SIATKA[j]) => r4(Math.round(r4(mm) / krok) * krok);
export const wDol = (mm, j, krok = SIATKA[j]) => r4(Math.floor(r4(mm) / krok + 1e-6) * krok);
export function luzNaSiatke(mm, j) {
  const [a, b] = LUZ_ZAKRES[j], k = LUZ[j];
  return r4(Math.min(b, Math.max(a, Math.round(mm / k) * k)));
}

// ---------------------------------------------------------------- jednostka wyświetlana teraz (ustawia app.js przy każdej zmianie)
let AKT = 'mm';
export const akt = () => AKT;
export function ustawAkt(j) { AKT = j === 'in' ? 'in' : 'mm'; document.documentElement.dataset.jedn = AKT; }

// ---------------------------------------------------------------- preferencja (dla nowych projektów): ?j=in|mm → wybór z przełącznika → strefa czasowa
const KLUCZ = 'ogi_jedn';
const STREFY_USA = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu|US\/.+)$/;
export const preferencja = (() => {
  const q = new URLSearchParams(location.search).get('j');
  if (q === 'in' || q === 'mm') { try { localStorage.setItem(KLUCZ, q); } catch {} return () => pamiec() || q; }
  return () => pamiec() || (strefaUSA() ? 'in' : 'mm');
})();
function pamiec() { try { const s = localStorage.getItem(KLUCZ); return s === 'in' || s === 'mm' ? s : ''; } catch { return ''; } }
function strefaUSA() { try { return STREFY_USA.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch { return false; } }
export function ustawPreferencje(j) { try { localStorage.setItem(KLUCZ, j); } catch {} }

// ---------------------------------------------------------------- przeliczenie projektu na drugą jednostkę
/** Stan w jednostce j: blacha z drugiej listy, wymiary na siatce j (wysokość całkowita zostaje możliwie ta sama), luz na siatce j. */
export function przelicz(s, j) {
  const o = { ...s };
  if (jednostkaStanu(s) === j) return o;
  if (j === 'in') o.tBowl = BLACHY_IN[MM_NA_IN[Math.round(+s.tBowl)] ?? 2].t;
  else o.tBowl = IN_NA_MM[BLACHY_IN.findIndex(b => Math.abs(b.t - s.tBowl) < 1e-3)] ?? 5;
  o.tLeg = o.tBowl;
  const tot = naSiatke((+s.height || 0) + (+s.legHeight || 0), j), leg = naSiatke(+s.legHeight || 0, j);
  o.legHeight = leg; o.height = r4(tot - leg);
  o.base = naSiatke(+s.base || 0, j);
  o.legCut = +s.legCut > 0 ? naSiatke(+s.legCut, j) : 0;
  o.gap = luzNaSiatke(+s.gap || 0.3, j);
  return o;
}

// ---------------------------------------------------------------- wyświetlanie
const EN = LANG === 'en';
/** Liczba z przecinkiem (PL) albo kropką (EN); dec – miejsca po przecinku, obcinane zera gdy trim. */
export function liczba(v, dec = 0, trim = false) {
  let s = (+v).toLocaleString(EN ? 'en-US' : 'pl-PL', { minimumFractionDigits: trim ? 0 : dec, maximumFractionDigits: dec });
  return s;
}
/** Wartość suwaka (mm) w jednostce wyświetlania. */
export const naWysw = (mm, j = AKT) => (j === 'in' ? mm / CAL : mm);
export const zWysw = (v, j = AKT) => (j === 'in' ? r4(v * CAL) : v);
/** Długość z jednostką: '450 mm' albo '17.75 in' (cale: do 2 miejsc, bez zbędnych zer). */
export function dl(mm, j = AKT, dec) {
  if (j !== 'in') return `${liczba(mm, dec ?? 0)} mm`;
  const v = mm / CAL;
  return `${liczba(v, dec ?? (Math.abs(v) >= 10 ? 1 : 2), dec == null)} in`;
}
/** Luz: '0,3 mm' albo '0.010 in'. */
export const luzTxt = (mm, j = AKT) => (j === 'in' ? `${liczba(mm / CAL, 3)} in` : `${liczba(mm, 1)} mm`);
export const luzLiczba = (mm, j = AKT) => (j === 'in' ? liczba(mm / CAL, 3) : liczba(mm, 1));
export const masa = (kg, j = AKT) => (j === 'in' ? `${liczba(kg * 2.20462, 0)} lb` : `${liczba(kg, 1)} kg`);
export const pole = (m2, j = AKT) => (j === 'in' ? `${liczba(m2 * 10.7639, 1)} ft²` : `${liczba(m2, 2)} m²`);
export const dlugosc = (mm, j = AKT) => (j === 'in' ? `${liczba(mm / 304.8, 0)} ft` : `${liczba(mm / 1000, 1)} m`);
/** Teksty silnika (ostrzeżenia) w calach: „120 mm” → „4.7 in”, „12 kg” → „26 lb”. */
export function tekstJ(s, j = AKT) {
  if (j !== 'in' || !s) return s;
  return String(s).replace(/(\d+(?:[.,]\d+)?)\s?mm\b/g, (m, n) => dl(+n.replace(',', '.'), 'in', 1))
    .replace(/(\d+(?:[.,]\d+)?)\s?kg\b/g, (m, n) => masa(+n.replace(',', '.'), 'in'));
}
