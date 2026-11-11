// Gotowe wzory z pracowni (edytor 3): każdy wzór w kilku wielkościach, już z mostkami 3 mm (laser),
// przerwami w długich szczelinach i sprawdzony (wyspy, duże otwory). Prototyp niczego nie generuje:
// wybiera wielkość nie większą od żądanej i powiększa ją (najwyżej do następnej wielkości).
// Dane: wzory_dane/indeks.json (lista, kompozycje), wzory_dane/<id>.json (wielkości), miniatury.json.
const BAZA = 'wzory_dane/';
let indeks = null, mini = null, sluch = [];
const pliki = new Map();          // id → { warianty } | 'wczytuję'
export const onDane = fn => sluch.push(fn);
const daj = () => sluch.forEach(f => f());

export function wczytajIndeks() {
  if (indeks) return Promise.resolve(indeks);
  return fetch(BAZA + 'indeks.json').then(r => r.json()).then(d => { indeks = d; daj(); return d; });
}
export function wczytajMini() {
  if (mini) return Promise.resolve(mini);
  return fetch(BAZA + 'miniatury.json').then(r => r.json()).then(d => { mini = d; daj(); return d; });
}
export const Indeks = () => indeks;
export const Mini = () => mini;
export const wzor = id => indeks && indeks.wzory.find(w => w.id === id);

const rozpakuj = rings => rings.map(f => { const r = []; for (let i = 0; i < f.length; i += 2) r.push([f[i] / 20, f[i + 1] / 20]); return r; });
function plik(id) {
  const p = pliki.get(id);
  if (p && p !== 'wczytuję') return p;
  if (!p) {
    pliki.set(id, 'wczytuję');
    fetch(BAZA + encodeURIComponent(id) + '.json').then(r => r.json()).then(d => {
      d.warianty = d.warianty.filter(v => !v.wyspy).map(v => ({ ...v, holes: rozpakuj(v.holes), cuts: rozpakuj(v.cuts || []), syl: rozpakuj(v.syl || []) }));
      pliki.set(id, d); daj();
    }).catch(() => { pliki.set(id, { warianty: [] }); daj(); });
  }
  return null;
}
/**
 * Wzór o widocznej wysokości H [mm] (wyśrodkowany): { holes, cuts, k (powiększenie wariantu), v (wariant), maly, pending }.
 * Bierzemy największy wariant nie wyższy niż H i powiększamy (mostki rosną – nigdy cieńsze niż 3 mm).
 */
export function wariant(id, H) {
  const d = plik(id);
  if (!d) return { holes: [], cuts: [], pending: true };
  const W = d.warianty; if (!W.length) return { holes: [], cuts: [], brak: true };
  let v = null;
  for (const q of W) if (q.bh <= H * 1.001) v = q;
  const maly = !v;                                // mniejszy niż najmniejszy wariant – tylko pomniejszenie (ostrzeżenie)
  if (!v) v = W[0];
  // mniejszy niż najmniejsza wielkość: zostaje najmniejsza (nigdy nie pomniejszamy – mostki byłyby cieńsze niż 3 mm)
  return { holes: v.holes, cuts: v.cuts, syl: v.syl, k: maly ? 1 : H / v.bh, v, maly, duze: v.duze, pending: false };
}
