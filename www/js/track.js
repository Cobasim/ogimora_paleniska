// OGIMORA – anonimowe statystyki (wersja uproszczona). Co i jak – opisane dla użytkownika w oknie „O stronie” (js/info.js).
//  • bez ciasteczek, bez identyfikatora wizyty czy przeglądarki, bez adresu IP;
//  • przyciski i suwaki: tylko LICZNIKI (ile razy), wysyłane raz – przy wyjściu ze strony;
//  • pobranie pliku: jeden krótki wpis (wymiary, wzory, czy jest napis – bez jego treści);
//  • wyłączone, gdy użytkownik tak wybierze albo przeglądarka wysyła „Do Not Track” / „Global Privacy Control”.
import { WERSJA } from './wersja.js';
export const CONFIG = { api: 'api/zbierz.php?typ=' };
const BEZ = 'ogip_bez_stat';
export const wylaczonePrzezPrzegladarke = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
export const wylaczonePrzezUzytkownika = () => { try { return localStorage.getItem(BEZ) === '1'; } catch { return false; } };
export const statystykiDzialaja = () => !wylaczonePrzezPrzegladarke() && !wylaczonePrzezUzytkownika();
export function ustawStatystyki(on) { try { if (on) localStorage.removeItem(BEZ); else localStorage.setItem(BEZ, '1'); } catch {} if (!on) { for (const k in K) delete K[k]; } }

const q = new URLSearchParams(location.search);
const CONTEXT = {
  v: WERSJA,                                                   // wersja strony – żeby odzew dało się przypisać do wydania
  src: (q.get('src') || q.get('utm_source') || '').slice(0, 30),
  ref: (() => { try { const r = new URL(document.referrer); return r.host === location.host ? '' : r.host; } catch { return ''; } })(),
  lang: (navigator.language || '').slice(0, 2),
  tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })(),   // z niej serwer wylicza kraj (przybliżony)
  dev: matchMedia('(max-width: 760px)').matches ? 'mobile' : matchMedia('(max-width: 1100px)').matches ? 'tablet' : 'desktop',
};
function wyslij(typ, dane) {
  if (!statystykiDzialaja() && (typ === 'wizyta' || typ === 'pobranie')) return;
  try {
    const body = JSON.stringify(dane);
    if (!(navigator.sendBeacon && navigator.sendBeacon(CONFIG.api + typ, new Blob([body], { type: 'application/json' }))))
      fetch(CONFIG.api + typ, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch { /* statystyki nigdy nie mogą zepsuć strony */ }
}

let getCode = () => '', getProjekt = () => ({});
export function setCodeSource(fn) { getCode = fn; }
/** Opis pobieranego projektu: { wym, wz, nap, smok, otw, mat, luz } – buduje js/prosty.js. */
export function setProjektSource(fn) { getProjekt = fn; }

// ---- liczniki przycisków: nazwa = zdarzenie[:co]; wartości suwaków nie są wysyłane
const K = {}; let zmiana = false, pierwsza = true;
const nazwa = (e, d) => { const v = d.param ?? d.key ?? d.k ?? d.part ?? (typeof d.value === 'string' || typeof d.value === 'number' ? d.value : undefined); return String(v === undefined ? e : `${e}:${v}`).replace(/[^A-Za-z0-9_:.\-]/g, '').slice(0, 40); };
const POMIN = new Set(['view', 'interact', 'survey', 'download', 'projekt_nowy', 'save', 'saved_loaded']);
export function track(event, data = {}) {
  if (event === 'download') { K.pobranie = (K.pobranie || 0) + 1; zmiana = true; let p = {}; try { p = getProjekt() || {}; } catch {} wyslij('pobranie', { kod: getCode(), ...CONTEXT, ...p }); return; }
  if (event === 'survey') { wyslij('ankieta', { use: data.use, license: data.license, pay: data.pay, notes: data.notes, tz: CONTEXT.tz, lang: CONTEXT.lang }); return; }
  if (POMIN.has(event)) return;
  const k = nazwa(event, data); if (!k) return;
  if (Object.keys(K).length < 70 || k in K) { K[k] = (K[k] || 0) + 1; zmiana = true; }
}
// Suwaki: liczymy jedno użycie po chwili bezczynności, nie każdy piksel.
const pending = {};
export function trackDebounced(key, event, data, ms = 1200) { clearTimeout(pending[key]); pending[key] = setTimeout(() => track(event, data), ms); }

/** Przy wyjściu ze strony (albo schowaniu karty): jedna paczka liczników. */
function wizyta() {
  if (!pierwsza && !zmiana) return;
  const k = { ...K }; for (const x in K) delete K[x];
  wyslij('wizyta', { nowa: pierwsza ? 1 : 0, ...CONTEXT, k });
  pierwsza = false; zmiana = false;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') wizyta(); });
addEventListener('pagehide', wizyta);
