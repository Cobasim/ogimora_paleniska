// OGIMORA – górny pasek, wspólny dla strony startowej i obu generatorów:
//   smok / OGIMORA → strona startowa;   nazwa modelu (Palenisko / Kostka) → model startowy tego generatora.
// Adresy trzymają język strony: z /en/cube/ idzie się do /en/ i /en/firepit/, z /cube/ – do / i /firepit/.
import { LANG } from './i18n.js';
const JEZ = (/^\/(en|pl)\//.exec(location.pathname) || [])[1] || '';
/** Adres podstrony ('' = start, 'firepit/', 'cube/') w języku bieżącej strony. */
export const adres = (strona = '') => new URL((JEZ ? JEZ + '/' : '') + strona, document.baseURI).href;
export const MODELE = {
  palenisko: { strona: 'firepit/', pl: 'Palenisko', en: 'Fire pit', biez: 'ogip_biez' },
  kostka: { strona: 'cube/', pl: 'Kostka', en: 'Cube', biez: 'ogik_biez' },
};
export const nazwaModelu = m => MODELE[m][LANG === 'en' ? 'en' : 'pl'];

const hdr = document.querySelector('header.ob'), marka = hdr && hdr.querySelector('.ob-brand');
if (marka) { marka.href = adres(''); marka.title = LANG === 'en' ? 'OGIMORA – home' : 'OGIMORA – strona startowa'; }
const model = document.documentElement.dataset.model;
if (marka && MODELE[model]) {
  const a = document.createElement('a'); a.className = 'ob-model'; a.id = 'obModel';
  a.textContent = nazwaModelu(model);
  a.title = LANG === 'en' ? 'Starter model – your design stays in “My designs”' : 'Model startowy – Twój projekt zostaje w „Moich projektach”';
  // model startowy; „z” = projekt, z którego wychodzimy (po załadowaniu pojawia się „Wróć do mojego”)
  const cel = () => { let z = ''; try { z = localStorage.getItem(MODELE[model].biez) || ''; } catch {} return adres(MODELE[model].strona) + '?nowy=start' + (z ? '&z=' + encodeURIComponent(z) : ''); };
  a.href = cel(); a.addEventListener('click', () => { document.dispatchEvent(new CustomEvent('ogi-przed-wyjsciem')); a.href = cel(); });
  marka.after(a);
}
/** Powiadomienie z jednym przyciskiem (np. „Wróć do mojego”). Znika samo. */
export function toastAkcja(tekst, przycisk, akcja, ms = 9000) {
  let t = document.querySelector('.toast-akcja');
  if (!t) { t = document.createElement('div'); t.className = 'toast-akcja'; document.body.appendChild(t); }
  t.innerHTML = ''; const s = document.createElement('span'); s.textContent = tekst; t.appendChild(s);
  if (przycisk) { const b = document.createElement('button'); b.type = 'button'; b.textContent = przycisk; b.addEventListener('click', () => { t.classList.remove('show'); akcja(); }); t.appendChild(b); }
  const x = document.createElement('button'); x.type = 'button'; x.className = 'ta-x'; x.textContent = '✕'; x.setAttribute('aria-label', LANG === 'en' ? 'Close' : 'Zamknij'); x.addEventListener('click', () => t.classList.remove('show')); t.appendChild(x);
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}
