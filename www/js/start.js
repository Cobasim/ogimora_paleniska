// OGIMORA – strona startowa: dwa modele i „Twoje ostatnie” (projekty z tej przeglądarki, osobno dla paleniska i kostki).
import { LANG } from './i18n.js';
import { TEKSTY, htmlStartu } from './start_teksty.js';
import { listaModelu, kiedy } from './biblioteka.js';
import { adres, MODELE } from './pasek.js';
import { track } from './track.js';

const J = LANG === 'en' ? 'en' : 'pl', t = TEKSTY[J], el = document.getElementById('start');
const JEZ = (/^\/(en|pl)\//.exec(location.pathname) || [])[1] || '';
document.documentElement.lang = J; document.title = t.tytul;
el.innerHTML = htmlStartu(J, JEZ ? JEZ + '/' : '');
const esc = x => String(x || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
for (const m of Object.keys(MODELE)) {
  // adresy bezwzględne (strona /pl/ ma <base href="/">, strona / – nie)
  el.querySelectorAll(`[data-model="${m}"] a`).forEach(a => { a.href = adres(MODELE[m].strona) + '?nowy=start'; a.addEventListener('click', () => track('start_model', { value: m })); });
  const l = listaModelu(m).filter(p => (m === 'kostka' ? p.stan : p.kod)).slice(0, 3), box = el.querySelector(`[data-twoje="${m}"]`);
  if (!l.length) continue;
  box.hidden = false;
  box.innerHTML = `<p class="st-tw-t" title="${t.twojeT}">${t.twoje}</p>` + l.map(p => `<a class="st-proj" href="${adres(MODELE[m].strona)}?p=${encodeURIComponent(p.id)}">${p.thumb ? `<img src="${p.thumb}" alt="">` : '<span class="st-noimg"></span>'}<span><b>${esc(p.nazwa)}</b><small>${kiedy(p.t, J)}</small></span></a>`).join('');
  box.querySelectorAll('a').forEach(a => a.addEventListener('click', () => track('start_projekt', { value: m })));
}
// stare adresy paleniska (do 0.3.x generator był pod adresem głównym): ogimora.com/#kod=…, ?p=…, ?nowy=… → /firepit/
track('strona', { value: 'start' });
