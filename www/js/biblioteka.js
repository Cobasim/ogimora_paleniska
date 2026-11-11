// Twoje projekty – biblioteka w przeglądarce (localStorage), wspólna dla strony startowej i generatora.
// Projekt zapisuje się sam: powstaje przy pierwszej zmianie w generatorze, potem każda zmiana go aktualizuje.
// Wpis: { id, nazwa, t (ostatnia zmiana), utw (utworzony), kod (kształt), zdobienia (wzory), thumb (miniatura JPEG), zrodlo }
const KEY = 'ogip_biblioteka', MAX = 40;   // PROSTY: własna lista (osobna od pełnego generatora)

function czytaj() {
  let l = null;
  try { l = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  if (!Array.isArray(l)) l = [];   // PROSTY: bez przenoszenia starych projektów
  return l;
}
function pisz(l) {
  l.sort((a, b) => (b.t || 0) - (a.t || 0));
  if (l.length > MAX) l.length = MAX;
  for (let i = l.length - 1; i >= 0; i--) {          // brak miejsca: najpierw miniatury najstarszych
    try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch {}
    if (l[i].thumb) l[i].thumb = '';
  }
  try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch { return false; }
}
// pierwsze uruchomienie: ostatni (i poprzedni) projekt z wcześniejszej wersji strony trafiają do biblioteki
function migracja() {
  const out = [];
  const z = (k, nazwa) => { try { const o = JSON.parse(localStorage.getItem(k) || 'null'); if (o && o.kod) out.push({ id: nowyId(), nazwa, t: o.t || Date.now(), utw: o.t || Date.now(), kod: o.kod, zdobienia: o.zdobienia || null, thumb: '', zrodlo: 'migracja' }); } catch {} };
  let en = false; try { const l = JSON.parse(localStorage.getItem('ogi_lang') || 'null'); en = l ? l === 'en' : !(navigator.language || '').toLowerCase().startsWith('pl'); } catch {}
  z('ogi_last', en ? 'My design' : 'Mój projekt'); z('ogi_poprzedni', en ? 'Previous design' : 'Poprzedni projekt');
  try { const p = JSON.parse(localStorage.getItem('ogi_powrot') || 'null'); if (p && p.thumb && out[0]) out[0].thumb = p.thumb; } catch {}
  return out;
}

export const nowyId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const lista = () => czytaj().slice();
export const pobierz = id => czytaj().find(p => p.id === id) || null;
export const ostatni = () => czytaj()[0] || null;
/** Dopisuje albo aktualizuje projekt (po id). */
export function zapisz(p) {
  const l = czytaj(), i = l.findIndex(q => q.id === p.id);
  if (i >= 0) l[i] = { ...l[i], ...p }; else l.push({ utw: Date.now(), ...p });
  return pisz(l);
}
export function usun(id) { const l = czytaj(), i = l.findIndex(q => q.id === id); if (i < 0) return null; const [p] = l.splice(i, 1); pisz(l); return p; }
export function przywroc(p) { const l = czytaj(); if (!l.some(q => q.id === p.id)) l.push(p); pisz(l); }
export function zmienNazwe(id, nazwa) { const p = pobierz(id); if (!p || !nazwa.trim()) return; zapisz({ ...p, nazwa: nazwa.trim().slice(0, 40) }); }
/** Wolna nazwa: „Klasyczne”, „Klasyczne 2”, „Klasyczne 3”… */
export function wolnaNazwa(baza) {
  const zajete = new Set(czytaj().map(p => p.nazwa));
  if (!zajete.has(baza)) return baza;
  for (let n = 2; ; n++) if (!zajete.has(`${baza} ${n}`)) return `${baza} ${n}`;
}
export function duplikuj(id, dopisek = 'kopia') {
  const p = pobierz(id); if (!p) return null;
  const q = { ...p, id: nowyId(), nazwa: wolnaNazwa(`${p.nazwa} (${dopisek})`), t: Date.now(), utw: Date.now() };
  zapisz(q); return q;
}
/** „przed chwilą”, „5 min temu”, „wczoraj”, „3 dni temu”, data. */
export function kiedy(t, L = 'pl') {
  const s = (Date.now() - t) / 1000, en = L === 'en';
  if (s < 60) return en ? 'just now' : 'przed chwilą';
  if (s < 3600) return en ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 60)} min temu`;
  if (s < 86400) { const h = Math.floor(s / 3600); return en ? `${h} h ago` : `${h} godz. temu`; }
  const d = Math.floor(s / 86400);
  if (d === 1) return en ? 'yesterday' : 'wczoraj';
  if (d < 7) return en ? `${d} days ago` : `${d} dni temu`;
  return new Date(t).toLocaleDateString(en ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short' });
}
