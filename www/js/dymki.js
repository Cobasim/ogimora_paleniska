// Szybkie dymki: po najechaniu na ikonę / opcję po ~0,25 s pojawia się krótka nazwa,
// a po dłuższym przytrzymaniu kursora (~1 s) – pełny opis. Zamiast wolnych, systemowych podpowiedzi (title).
// Tekst bierzemy z atrybutu title (już przetłumaczonego przez i18n.js) i przenosimy do data-tip,
// żeby przeglądarka nie pokazywała drugiego, systemowego dymka.
const tip = document.createElement('div');
tip.className = 'dymek'; tip.setAttribute('role', 'tooltip');
document.body.appendChild(tip);
let cur = null, t1 = 0, t2 = 0;

/** „Nazwa — opis”, „Nazwa: opis”, „Nazwa (opis)” → [nazwa, opis]; krótkie teksty w całości. */
function rozdziel(s) {
  s = s.trim();
  if (s.length <= 34) return [s, ''];
  // najpierw „:” albo myślnik (nazwa może mieć nawias: „Gięcie 4 (całość): …”), potem nawias, potem przecinek
  for (const re of [/^(.{2,44}?)(:\s+|\s+[—–]\s+)/, /^(.{2,40}?)\s+\(/, /^(.{2,40}?),\s+/]) {
    const m = s.match(re); if (!m) continue;
    let rest = s.slice(m[0].length).trim();
    if (re.source.includes('\\(')) rest = rest.replace(/\)\s*$/, '');
    return [m[1], rest];
  }
  return s.length > 60 ? [s.slice(0, 40).replace(/\s+\S*$/, '') + '…', s] : [s, ''];
}
function ustaw(el) {
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
  if (y + h > innerHeight - 6) y = r.top - h - 8;
  x = Math.max(6, Math.min(innerWidth - w - 6, x));
  tip.style.left = x + 'px'; tip.style.top = Math.max(6, y) + 'px';
}
function pokaz(el, pelny) {
  if (el !== cur || !document.contains(el)) return;
  const [nazwa, opis] = rozdziel(el.dataset.tip || '');
  if (!nazwa) return;
  tip.innerHTML = '';
  const b = document.createElement('b'); b.textContent = nazwa; tip.appendChild(b);
  if (pelny && opis) { const s = document.createElement('span'); s.textContent = opis; tip.appendChild(s); }
  tip.classList.toggle('pelny', !!(pelny && opis));
  tip.classList.add('on'); ustaw(el);
}
function schowaj() { clearTimeout(t1); clearTimeout(t2); tip.classList.remove('on'); cur = null; }

document.addEventListener('pointerover', e => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest && e.target.closest('[title], [data-tip]');
  if (el === cur) return;
  schowaj();
  if (!el || el.closest('.gap-box') || el.matches('svg *')) return;
  if (el.hasAttribute('title')) { const t = el.getAttribute('title'); if (t) el.dataset.tip = t; el.removeAttribute('title'); }
  if (!el.dataset.tip) return;
  cur = el;
  t1 = setTimeout(() => pokaz(el, false), 250);
  t2 = setTimeout(() => pokaz(el, true), 1100);
}, true);
document.addEventListener('pointerout', e => { if (cur && !cur.contains(e.relatedTarget)) schowaj(); }, true);
document.addEventListener('pointerdown', schowaj, true);
addEventListener('scroll', schowaj, true);
addEventListener('blur', schowaj);
