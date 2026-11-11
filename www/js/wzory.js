// Widok „Wzory” – edytor 3 (od nowa, 2026-11-04).
// Zasada: wzór powstaje i jest sprawdzany w pracowni (gotowy rysunek w kilku wielkościach, mostki 3 mm),
// prototyp tylko go UKŁADA: przesuwa, powiększa, obraca, odbija, kopiuje. Nic nie jest „poprawiane” po cichu –
// kolizje i wyjście poza strefę cięcia są pokazywane na czerwono.
//   • nad podglądem – działania na zaznaczonym elemencie,
//   • pod podglądem – wielkość i obrót zaznaczonego + komunikaty,
//   • po prawej – zakładki: Elementy (lista, kolejność, brzeg, napis, powtórz) · Wzory · Kompozycje.
// Poprzednie edytory: 2_PALENISKO_STRONA/stare_wersje/{pierwszy_edytor,drugi_edytor}.
import { elements, elementHoles, rules, DECOR_DEF, pole, polozenie, elementPlaced, BRZEGI, KONCE, FILL_DEF } from './zdobienie.js';
import { onPracReady, szkic } from './prac.js';
import { ustaw } from './zdobienie.js';
import { svgPath, bounds } from './zdobienia/silnik.js';
import { CZCIONKI, onFontLoaded } from './zdobienia/napis.js';
import { wczytajIndeks, wczytajMini, Indeks, Mini, wzor as wzorInfo, onDane } from './wzory_dane.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const h = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
const $ = id => document.getElementById(id);
const linePath = lines => lines.map(l => 'M' + l.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L')).join('');
const fmt = v => Math.abs(v) >= 10 || Number.isInteger(v) ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
const kopia = o => JSON.parse(JSON.stringify(o));
const uid = () => 'e' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = a => ((a % 360) + 540) % 360 - 180;
export const FONT_FAMILY = Object.fromEntries(Object.keys(CZCIONKI).map((k, i) => [k, `ogiFont${i}`]));

// ---------------------------------------------------------------- stan
const STORE = 'ogip_decor';   // PROSTY: osobna pamięć
const TYPY = ['wzor', 'napisE', 'brzeg', 'kropki'];
const NAPIS_DEF = { tekst: 'OGIMORA', font: 'Gruba', odstep: 0.06, luk: 0, pogrub: 0, mosty: 'pionowe', ile: '2', efekt: 'pełne' };
const KOMP_DOMYSLNA = 'rozeta-w-jodelce';
function startowe() {
  return { ...kopia(DECOR_DEF), maxOtwor: 0, el: { 1: { items: [], komp: KOMP_DOMYSLNA }, 5: { items: [{ id: 'kropki', uid: uid(), n: 4, d: 5, rozstaw: 0.2 }] } } };
}
function czysc(d) {
  const el = {};
  for (const [k, v] of Object.entries((d && d.el) || {})) {
    const items = (v.items || []).filter(it => TYPY.includes(it.id)).map(it => ({ ...it, uid: it.uid || uid() }));
    if (v.link) el[k] = { link: String(v.link), items: [] };
    else if (items.length || v.komp) el[k] = { items, ...(v.komp ? { komp: v.komp } : {}), ...(v.logo ? { logo: true } : {}) };
  }
  for (const [k, v] of Object.entries(el)) if (v.link && (!el[v.link] || el[v.link].link)) delete el[k];
  return el;
}
function loadDecor() {
  try { const d = JSON.parse(localStorage.getItem(STORE) || 'null'); if (d && d.el) return { ...DECOR_DEF, ...d, maxOtwor: 0, el: czysc(d) }; } catch {}
  return startowe();
}
const decor = loadDecor();
decor.tech = 'laser';
let saveT = 0;
const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(decor)); } catch {} }, 300); };

const ui = { key: '1', sel: [], tab: 'el', kat: null, katK: null, els: [], model: null, box: {} };
let hooks = { changed: () => {}, select: () => {} };
const zrodlo = key => { const v = decor.el[key]; return v && v.link && decor.el[v.link] && !decor.el[v.link].link ? v.link : key; };
const sciana = key => (decor.el[zrodlo(key)] ||= { items: [] });
const itemsOf = key => sciana(key).items;
const curEl = () => ui.els.find(e => e.key === ui.key) || ui.els[0];
const R = () => rules(decor, curEl() ? curEl().t : 3);
const byUid = u => itemsOf(ui.key).find(it => it.uid === u);
const selItems = () => ui.sel.map(byUid).filter(Boolean);
const ruchome = () => selItems().filter(q => 'u' in q);

// ---------------------------------------------------------------- historia
const hist = { back: [], fwd: [] };
let histLast = JSON.stringify(decor.el);
function zapamietaj() { const c = JSON.stringify(decor.el); if (c === histLast) return; hist.back.push(histLast); if (hist.back.length > 80) hist.back.shift(); hist.fwd = []; histLast = c; }
function cofnij(dir) { if (dir < 0 && hooks.undo) hooks.undo(); else if (dir > 0 && hooks.redo) hooks.redo(); }   // jedna historia: kształt + wzory (app.js)
let listT = 0;
/** Powtórzone elementy (wspólne „grp”): zmiana na tej ściance przechodzi na wszystkie kopie. */
function synchronizuj() {
  for (const it of itemsOf(ui.key)) {
    if (!it.grp) continue;
    for (const [k, v] of Object.entries(decor.el)) {
      if (k === zrodlo(ui.key) || !v.items) continue;
      v.items.forEach((q, i) => { if (q.grp === it.grp && q !== it) v.items[i] = { ...kopia(it), uid: q.uid }; });
    }
  }
}
function changed() { synchronizuj(); zapamietaj(); persist(); hooks.changed(true); clearTimeout(listT); listT = setTimeout(renderList, 200); }
const wszystko = () => { renderList(); render(); panel(); };
let renT = 0;
const potem = (ms = 120) => { clearTimeout(renT); renT = setTimeout(() => { render(); changed(); }, ms); };
const teraz = () => { render(); panel(); changed(); };

// ---------------------------------------------------------------- ikony
const IK = {
  srodek: 'M8 1.5v13M1.5 8h4M3.5 6l2 2-2 2M14.5 8h-4M12.5 6l-2 2 2 2',
  obrot: 'M12.5 5.5A5 5 0 1 0 13 9M12.5 1.5v4h-4',
  lustro: 'M8 1.5v13M6 4 2 12h4zM10 4l4 8h-4z',
  kopiaX: 'M8 1v14M2 5h4v6H2zM10 5h4v6h-4z',
  kopiaY: 'M1 8h14M5 2v4h6V2zM5 10v4h6v-4z',
  kopia4: 'M8 1v14M1 8h14M2 2h4v4H2zM10 2h4v4h-4zM2 10h4v4H2zM10 10h4v4h-4z',
  pion: 'M8 14V2M4.5 5.5 8 2l3.5 3.5M3 14h10',
  zewn: 'M8 8m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M8 6V1M5.5 3.5 8 1l2.5 2.5M3 12l-2 2M13 12l2 2',
  wewn: 'M8 8m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M8 1v4M5.5 2.5 8 5l2.5-2.5M2 14l2-2M14 14l-2-2',
  wierzch: 'M3 9h10M3 12h10M8 7V1M5 4l3-3 3 3',
  spod: 'M3 4h10M3 7h10M8 9v6M5 12l3 3 3-3',
  oko: 'M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zM8 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  usun: 'M3 4h10M6 4V2h4v2M4.5 4l.8 10h5.4l.8-10',
  cofnij: 'M5 3 2 6l3 3M2 6h8a4 4 0 0 1 0 8H7',
  ponow: 'M11 3l3 3-3 3M14 6H6a4 4 0 0 0 0 8h3',
  brak: 'M2.5 2.5h11v11h-11zM2 14 14 2',
};
const ikona = (n, parent) => { const s = sv('svg', { viewBox: '0 0 16 16', class: 'ik' }, parent); sv('path', { d: IK[n] }, s); return s; };
function przycisk(parent, { ik, txt, title, on, off, fn, cls = '' }) {
  const b = h('button', (on ? 'on ' : '') + cls, parent); b.type = 'button'; b.title = title || ''; b.disabled = !!off;
  if (ik) ikona(ik, b); if (txt) h('span', '', b, txt);
  b.onclick = fn; return b;
}
function slider(parent, label, val, min, max, step, onInput, unit = '', disabled = false, onDone = null) {
  const row = h('label', 'd-row' + (disabled ? ' off' : ''), parent, `<span class="lab">${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}"${disabled ? ' disabled' : ''}><output>${disabled ? '' : fmt(val) + unit}</output>`);
  const inp = row.querySelector('input'), out = row.querySelector('output');
  inp.oninput = () => { out.textContent = fmt(+inp.value) + unit; onInput(+inp.value); };
  if (onDone) inp.onchange = () => onDone(+inp.value);
  return row;
}
const NAZWA_BRZEGU = { linia: 'linia', 'linia podwójna': 'podwójna linia', kropki: 'kropki', 'kropki 2': 'kropki ×2', 'ząbki': 'ząbki', kreski: 'kreski', romby: 'romby', recica: 'recica', 'liście': 'liście na przemian' };
const IKONA_BRZEGU = { linia: '▭', 'linia podwójna': '⧈', kropki: '•••', 'kropki 2': '⁚⁚⁚', 'ząbki': '▼▼', kreski: '— —', romby: '◆◆', recica: '////', 'liście': '❦❦' };
const IKONA_KONCA = { brak: '–', 'koło': '●', romb: '◆', 'krzyż': '✚', rozetka: '✿', 'liść': '❧' };
function nazwa(it) {
  if (it.id === 'wzor') return (wzorInfo(it.w) || {}).nazwa || it.nazwa || 'wzór';
  if (it.id === 'napisE') return `Napis „${(it.p || {}).tekst || ''}”`;
  if (it.id === 'brzeg') return 'Brzeg – ' + (NAZWA_BRZEGU[(it.p || {}).typ] || '');
  if (it.id === 'kropki') return `Odpływ ${it.n} × Ø${it.d}`;
  return it.id;
}
const IKONA = { wzor: '✿', napisE: 'T', brzeg: '▭', kropki: '⁘' };

// ---------------------------------------------------------------- lista ścianek (lewa kolumna)
function renderList() {
  const box = $('dList'); if (!box) return; box.innerHTML = '';
  const groups = [['Boki', e => e.kind === 'wall'], ['Dno', e => e.kind === 'floor'], ['Stopki', e => e.kind === 'foot']];
  for (const [title, f] of groups) {
    const list = ui.els.filter(f); if (!list.length) continue;
    h('div', 'd-lh', box, title);
    const row = h('div', 'd-tiles ' + title.toLowerCase(), box);
    for (const e of list) {
      const items = itemsOf(e.key);
      const b = h('button', 'd-tile' + (e.key === ui.key ? ' on' : '') + (items.length ? ' has' : ''), row);
      b.type = 'button'; b.title = `${e.key} · ${e.name}`;
      const pad = Math.max(e.bb.w, e.bb.h) * 0.06;
      const s = sv('svg', { viewBox: `${e.bb.x0 - pad} ${-e.bb.y1 - pad} ${e.bb.w + 2 * pad} ${e.bb.h + 2 * pad}` }, b);
      sv('path', { d: svgPath([e.ring, ...e.old]), class: 'pl' }, s);
      if (items.length) {
        const r = elementHoles(e, items, decor);
        if (r.holes.length) sv('path', { d: svgPath(r.holes), class: 'ho' }, s);
        if (r.cuts.length) sv('path', { d: linePath(r.cuts), class: 'cutl' }, s);
      }
      h('span', 'num', b, e.key + (decor.el[e.key] && decor.el[e.key].link ? '=' : ''));
      b.onclick = () => select(e.key);
    }
  }
}
function select(key) {
  if (!ui.els.some(e => e.key === key)) return;
  ui.key = key; ui.sel = [];
  zastosujOczekujace(); wszystko(); hooks.select(key);
}

// ---------------------------------------------------------------- kompozycje
/** Kompozycja na ściankę: jej wzory zastępują wzory ścianki (napis, kropki i logo zostają). */
function zastosujKompozycje(key, kid, zLogo = false) {
  const I = Indeks(); const k = I && I.kompozycje.find(c => c.id === kid); if (!k) return false;
  const W = sciana(key), stare = W.items;
  const logo = stare.filter(q => q.id === 'wzor' && (wzorInfo(q.w) || {}).kategoria === 'Logo');
  const nowe = k.elementy.filter(e => (wzorInfo(e.wzor) || {}).kategoria !== 'Logo').map(e => ({ id: 'wzor', uid: uid(), w: e.wzor, u: e.u, v: e.v, s: e.s, rot: e.rot || 0, mir: !!e.mir }));
  const br = k.brzeg ? [{ id: 'brzeg', uid: uid(), p: { typ: k.brzeg, wlk: 1, gest: 1, odsun: 0 } }] : [];
  if (zLogo && !logo.length) { const L = I.wzory.find(w => w.id === 'smok-pelny') || I.wzory.find(w => w.kategoria === 'Logo'); if (L) logo.push({ id: 'wzor', uid: uid(), w: L.id, u: 0.72, v: -0.72, s: 0.16, rot: 0, mir: false, fill: { ...FILL_DEF, typ: 'paski', kier: 'poziome', pas: 3, szcz: 3 } }); }
  W.items = [...stare.filter(q => q.id === 'napisE'), ...logo, ...br, ...nowe, ...stare.filter(q => q.id === 'kropki')];
  W.komp = kid; delete W.logo;
  return true;
}
function zastosujOczekujace() {
  if (!Indeks()) return;
  let zm = false;
  for (const [k, v] of Object.entries(decor.el)) if (v.komp && !v.items.some(q => q.id === 'wzor')) { if (zastosujKompozycje(k, v.komp, v.logo)) zm = true; }
  if (zm) { histLast = JSON.stringify(decor.el); persist(); hooks.changed(true); }
}

// ---------------------------------------------------------------- podgląd ścianki
let drag = null;
function toSvg(ev) { const svg = $('dPlate'); const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, -q.y]; }
function obrys(e, it, Rr) {
  if (it.id === 'brzeg' || it.id === 'kropki') return null;
  const q = elementPlaced(e, it, Rr);
  const shp = [...q.holes, ...(q.cuts || [])];
  if (shp.length) return { ...bounds(shp), ghost: q.holes, cuts: q.cuts, lb: q.lb };
  const L = polozenie(e, it), d = L.H / 2;
  return { x0: L.x - d, x1: L.x + d, y0: L.y - d, y1: L.y + d, w: 2 * d, h: 2 * d, ghost: [] };
}
function render() {
  const svg = $('dPlate'); if (!svg) return;
  svg.innerHTML = '';
  const e = curEl(); if (!e) return;
  const pad = Math.max(e.bb.w, e.bb.h) * 0.05 + 20;
  ui.vb0 = [e.bb.x0 - pad, -e.bb.y1 - pad, e.bb.w + 2 * pad, e.bb.h + 2 * pad + 18];   // cała ścianka
  if (ui.vbKey !== e.key) { ui.vb = null; ui.vbPrev = null; ui.vbKey = e.key; }
  svg.setAttribute('viewBox', (ui.vb || ui.vb0).join(' '));
  const defs = sv('defs', {}, svg);
  const pat = sv('pattern', { id: 'dHatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  sv('line', { x1: 0, y1: 0, x2: 0, y2: 8, class: 'hatch' }, pat);
  sv('path', { d: svgPath([e.ring, ...e.old]), class: 'plate' }, svg);
  if (e.keep.length) sv('path', { d: svgPath(e.keep), class: 'keep' }, svg);
  sv('path', { d: svgPath(e.safe), class: 'safe' }, svg);
  const txt = `${e.key} · ${e.name} · widok od ${e.kind === 'floor' ? 'spodu' : 'zewnątrz'} · ${Math.round(e.bb.w)} × ${Math.round(e.bb.h)} mm · blacha ${e.t} mm`;
  const lab = sv('text', { x: e.bb.x0 - pad * 0.8, y: -e.bb.y0 + pad * 0.55, class: 'dim', 'font-size': Math.min(pad * 0.32, (e.bb.w + 1.6 * pad) / (txt.length * 0.55)) }, svg);
  lab.textContent = txt;
  const items = itemsOf(e.key), Rr = R();
  const res = elementHoles(e, items, decor);
  if (res.holes.length) sv('path', { d: svgPath(res.holes), class: 'hole' }, svg);
  if (res.cuts.length) sv('path', { d: linePath(res.cuts), class: 'cutl' }, svg);
  if (res.kolizje.length) sv('path', { d: svgPath(res.kolizje), class: 'kolizja' }, svg);
  if (res.wyspy && res.wyspy.length) sv('path', { d: svgPath(res.wyspy), class: 'wyspa' }, svg);
  if (ui.pokazMale && res.male && res.male.length) {
    // małe otwory: czerwone, migające kółka (widać je nawet na dużej ściance)
    const g = sv('g', { class: 'male-g' }, svg), rr = Math.max(e.bb.w, e.bb.h) * 0.012 + 3;
    sv('path', { d: svgPath(res.male), class: 'male-h' }, g);
    for (const q of res.male) { const b = bounds([q]); sv('circle', { cx: (b.x0 + b.x1) / 2, cy: -(b.y0 + b.y1) / 2, r: Math.max(rr, b.w, b.h), class: 'male-c' }, g); }
  }
  ui.box = {};
  const hits = sv('g', {}, svg);
  [...items].reverse().forEach(it => {
    if (it.off) return;
    const b = obrys(e, it, Rr); if (!b) return;
    ui.box[it.uid] = b;
    const r = sv('rect', { x: b.x0 - 2, y: -b.y1 - 2, width: b.w + 4, height: b.h + 4, class: 'hit' }, hits);
    r.addEventListener('pointerdown', ev => { ev.stopPropagation(); chwyc(ev, it.uid); });
  });
  rysujZaznaczenie(svg);
  if (res.pending) { const t = sv('text', { x: e.bb.x1, y: -e.bb.y1 - pad * 0.35, class: 'busy', 'font-size': Math.max(11, pad * 0.3), 'text-anchor': 'end' }, svg); t.textContent = 'wczytuję wzory…'; }
  ui.res = res;
  narzedzia(); dolny();
}
function rysujZaznaczenie(svg) {
  ui.selB = null; ui.selg = null;
  const sel = selItems(); if (!sel.length) return;
  const bs = sel.map(it => ui.box[it.uid]).filter(Boolean); if (!bs.length) return;
  const B = { x0: Math.min(...bs.map(b => b.x0)), y0: Math.min(...bs.map(b => b.y0)), x1: Math.max(...bs.map(b => b.x1)), y1: Math.max(...bs.map(b => b.y1)) };
  const g = sv('g', { class: 'selg' }, svg); ui.selg = g; ui.selB = B;
  // jeden element: ramka obrócona razem z nim
  const jeden = sel.length === 1 && 'u' in sel[0] && bs[0].lb ? sel[0] : null;
  bs.forEach(b => { if (b.ghost && b.ghost.length) sv('path', { d: svgPath(b.ghost), class: 'ghost' }, g); if (b.cuts && b.cuts.length) sv('path', { d: linePath(b.cuts), class: 'ghostl' }, g); });
  const ctm = svg.getScreenCTM(); const hs = 10 / (ctm ? ctm.a : 1);
  let rogi, gora;
  if (jeden) {
    const lb = bs[0].lb, L = polozenie(curEl(), jeden), a = (jeden.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), p = hs * 0.4;
    const T = ([x, y]) => [L.x + x * c - y * sn, L.y + x * sn + y * c];
    rogi = [[lb.x0 - p, lb.y0 - p], [lb.x1 + p, lb.y0 - p], [lb.x1 + p, lb.y1 + p], [lb.x0 - p, lb.y1 + p]].map(T);
    gora = [T([(lb.x0 + lb.x1) / 2, lb.y1 + p]), T([(lb.x0 + lb.x1) / 2, lb.y1 + hs * 2.4])];
  } else {
    rogi = [[B.x0 - hs * 0.4, B.y0 - hs * 0.4], [B.x1 + hs * 0.4, B.y0 - hs * 0.4], [B.x1 + hs * 0.4, B.y1 + hs * 0.4], [B.x0 - hs * 0.4, B.y1 + hs * 0.4]];
    gora = [[(B.x0 + B.x1) / 2, B.y1 + hs * 0.4], [(B.x0 + B.x1) / 2, B.y1 + hs * 2.4]];
  }
  sv('path', { d: svgPath([rogi]), class: 'frame' }, g);
  const mv = sv('path', { d: svgPath([rogi]), class: 'mvhit' }, g);
  mv.addEventListener('pointerdown', ev => { ev.stopPropagation(); if (ev.shiftKey) { const u = trafiony(toSvg(ev)); if (u) { przelacz(u); return; } } start(ev, 'move'); });
  for (const [x, y] of rogi) {
    const r = sv('rect', { x: x - hs / 2, y: -y - hs / 2, width: hs, height: hs, class: 'handle h-c', style: 'cursor:nwse-resize' }, g);
    r.addEventListener('pointerdown', ev => { ev.stopPropagation(); start(ev, 'scale'); });
  }
  sv('line', { x1: gora[0][0], y1: -gora[0][1], x2: gora[1][0], y2: -gora[1][1], class: 'rotl' }, g);
  const k = sv('circle', { cx: gora[1][0], cy: -gora[1][1], r: hs * 0.6, class: 'handle rot', style: 'cursor:grab' }, g);
  k.addEventListener('pointerdown', ev => { ev.stopPropagation(); start(ev, 'rot'); });
}
// ---- przybliżanie i przesuwanie podglądu ścianki
let pan = null;
function zoomW(ev) {
  const svg = $('dPlate'), v = [...(ui.vb || ui.vb0)], p = toSvg(ev), f = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
  const w = clamp(v[2] * f, ui.vb0[2] * 0.04, ui.vb0[2] * 3), k = w / v[2], X = p[0], Y = -p[1];
  ui.vb = [X - (X - v[0]) * k, Y - (Y - v[1]) * k, w, v[3] * k]; svg.setAttribute('viewBox', ui.vb.join(' '));
}
/** Widok: 'caly' (domyślny), 'element' (zaznaczone), 'wstecz' (widok sprzed ostatniego przycisku). */
function widok(tryb) {
  const svg = $('dPlate'); if (!svg || !ui.vb0) return;
  const teraz = ui.vb ? [...ui.vb] : null;
  if (tryb === 'wstecz') { if (ui.vbPrev === undefined) return; ui.vb = ui.vbPrev; ui.vbPrev = teraz; }
  else {
    ui.vbPrev = teraz;
    if (tryb === 'caly') ui.vb = null;
    else { const B = ui.selB; if (!B) return; const m = Math.max(B.x1 - B.x0, B.y1 - B.y0) * 0.25 + 6, w = B.x1 - B.x0 + 2 * m, h = B.y1 - B.y0 + 2 * m, r = ui.vb0[3] / ui.vb0[2];
      const W = Math.max(w, h / r), H = W * r; ui.vb = [(B.x0 + B.x1) / 2 - W / 2, -(B.y0 + B.y1) / 2 - H / 2, W, H]; }
  }
  svg.setAttribute('viewBox', (ui.vb || ui.vb0).join(' ')); narzedzia();
}
// ---- dymek z pełną treścią (znika po wyjechaniu myszą, kliknięciu w nim albo gdzie indziej)
function dymek(anchor, html) {
  zamknijDymek();
  const d = h('div', 'd-dymek', document.body, html), r = anchor.getBoundingClientRect();
  d.style.left = Math.max(8, Math.min(innerWidth - d.offsetWidth - 8, r.left)) + 'px';
  d.style.top = Math.max(8, r.top - d.offsetHeight - 6) + 'px';
  let wJ = false;
  d.addEventListener('mouseenter', () => { wJ = true; });
  d.addEventListener('mouseleave', zamknijDymek);
  anchor.addEventListener('mouseleave', () => setTimeout(() => { if (!wJ) zamknijDymek(); }, 250), { once: true });
  d.addEventListener('click', zamknijDymek);
  setTimeout(() => document.addEventListener('pointerdown', poza, true));
}
function poza(ev) { if (!ev.target.closest('.d-dymek')) zamknijDymek(); }
function zamknijDymek() { document.querySelectorAll('.d-dymek').forEach(x => x.remove()); document.removeEventListener('pointerdown', poza, true); }
function trafiony(pt) {
  for (const it of itemsOf(ui.key)) { const b = ui.box[it.uid]; if (b && pt[0] >= b.x0 - 2 && pt[0] <= b.x1 + 2 && pt[1] >= b.y0 - 2 && pt[1] <= b.y1 + 2) return it.uid; }
  return null;
}
function przelacz(u) { ui.sel = ui.sel.includes(u) ? ui.sel.filter(q => q !== u) : [...ui.sel, u]; render(); panel(); }
function chwyc(ev, u) {
  if (ev.shiftKey) { przelacz(u); return; }
  if (!ui.sel.includes(u)) { ui.sel = [u]; if (ui.tab !== 'el') ui.tab = 'el'; render(); panel(); }
  start(ev, 'move');
}
function start(ev, mode) {
  const B = ui.selB; if (!B) return;
  drag = { mode, p0: toSvg(ev), C: [(B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2], d: [0, 0], f: 1, a: 0, moved: false };
  $('dPlate').setPointerCapture(ev.pointerId);
}
function dragMove(ev) {
  if (!drag || !ui.selg) return;
  const p = toSvg(ev), { C, p0 } = drag;
  if (drag.mode === 'move') {
    let dx = p[0] - p0[0], dy = p[1] - p0[1];
    const F = pole(curEl()), tol = F.w * 0.015;
    if (Math.abs(C[0] + dx - F.cx) < tol) dx = F.cx - C[0];          // przyciąganie do osi
    if (Math.abs(C[1] + dy - F.cy) < tol) dy = F.cy - C[1];
    drag.d = [dx, dy]; ui.selg.setAttribute('transform', `translate(${dx} ${-dy})`);
  } else if (drag.mode === 'scale') {
    const f = clamp(Math.hypot(p[0] - C[0], p[1] - C[1]) / (Math.hypot(p0[0] - C[0], p0[1] - C[1]) || 1), 0.1, 6);
    { const it0 = ruchome()[0], b = it0 && ui.box[it0.uid]; if (b) naZywo('Wielkość', Math.round((b.y1 - b.y0) * f)); }
    drag.f = f; ui.selg.setAttribute('transform', `translate(${C[0]} ${-C[1]}) scale(${f}) translate(${-C[0]} ${C[1]})`);
  } else {
    let a = (Math.atan2(p[1] - C[1], p[0] - C[0]) - Math.atan2(p0[1] - C[1], p0[0] - C[0])) * 180 / Math.PI;
    a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
    drag.a = a; ui.selg.setAttribute('transform', `rotate(${-a} ${C[0]} ${-C[1]})`);
    { const it0 = ruchome()[0]; if (it0) naZywo('Obrót', norm((it0.rot || 0) + a)); }
  }
  drag.moved = true;
}
/** Wartość suwaka pod podglądem (Wielkość / Obrót) aktualizowana w trakcie przeciągania na rysunku. */
function naZywo(lab, v) {
  const row = [...document.querySelectorAll('#dStatus .d-row')].find(x => x.querySelector('.lab') && x.querySelector('.lab').textContent === lab); if (!row) return;
  const inp = row.querySelector('input'), out = row.querySelector('output');
  inp.value = v; out.textContent = fmt(Math.round(v)) + (lab === 'Obrót' ? '°' : ' mm');
}
function dragEnd() {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.moved) return;
  const e = curEl(), F = pole(e);
  for (const it of ruchome()) {
    const L = polozenie(e, it); let x = L.x, y = L.y;
    if (d.mode === 'move') { x += d.d[0]; y += d.d[1]; }
    else if (d.mode === 'scale') { x = d.C[0] + (x - d.C[0]) * d.f; y = d.C[1] + (y - d.C[1]) * d.f; it.s = clamp(it.s * d.f, 0.01, 3); }
    else { const a = d.a * Math.PI / 180, dx = x - d.C[0], dy = y - d.C[1]; x = d.C[0] + dx * Math.cos(a) - dy * Math.sin(a); y = d.C[1] + dx * Math.sin(a) + dy * Math.cos(a); it.rot = norm((it.rot || 0) + d.a); delete it.orient; }
    it.u = (x - F.cx) / (F.w / 2); it.v = (y - F.cy) / (F.h / 2);
    if (d.mode !== 'rot' && it.orient && it.orient !== 'pion') orientuj(it, it.orient);
  }
  teraz();
}

// ---------------------------------------------------------------- działania na zaznaczonych
function srodekObrysu(it) { const e = curEl(), L = polozenie(e, it), b = ui.box[it.uid]; return b ? [(b.x0 + b.x1) / 2 - L.x, (b.y0 + b.y1) / 2 - L.y] : [0, 0]; }
function wysrodkuj(it) { const F = pole(curEl()), o = srodekObrysu(it); it.u = -o[0] / (F.w / 2); }
function orientuj(it, tryb) {
  it.orient = tryb;
  if (tryb === 'pion') { it.rot = 0; return; }
  const F = pole(curEl()), L = polozenie(curEl(), it), dx = L.x - F.cx, dy = L.y - F.cy;
  if (Math.hypot(dx, dy) < 1e-6) { it.rot = 0; return; }
  const a = Math.atan2(dy, dx) * 180 / Math.PI - 90;
  it.rot = norm(tryb === 'zewn' ? a : a + 180);
}
function lustroKopia(list, os) {
  const F = pole(curEl()), items = itemsOf(ui.key), nowe = [];
  for (const q of list) {
    const o = srodekObrysu(q), cx = q.u * F.w / 2 + o[0], cy = q.v * F.h / 2 + o[1];
    for (const [ox, oy] of os === 'x' ? [[1, 0]] : os === 'y' ? [[0, 1]] : [[1, 0], [0, 1], [1, 1]]) {
      const c = { ...kopia(q), uid: uid() };
      if (ox !== oy && q.id !== 'napisE') c.mir = !q.mir;
      c.rot = norm(ox && oy ? (q.rot || 0) + 180 : ox ? -(q.rot || 0) : 180 - (q.rot || 0));
      if (q.id === 'napisE') c.rot = q.rot || 0;                 // napis nie do góry nogami
      const oo = [ox ? -o[0] : o[0], oy ? -o[1] : o[1]];
      c.u = ((ox ? -cx : cx) - oo[0]) / (F.w / 2); c.v = ((oy ? -cy : cy) - oo[1]) / (F.h / 2);
      nowe.push(c); items.splice(items.indexOf(q) + 1, 0, c);
    }
  }
  if (nowe.length) { ui.sel = [...ui.sel, ...nowe.map(q => q.uid)]; teraz(); }
}
function usun(uids) { const W = sciana(ui.key); W.items = W.items.filter(it => !uids.includes(it.uid)); ui.sel = ui.sel.filter(u => !uids.includes(u)); teraz(); }
function przenies(list, kier) {
  const L = itemsOf(ui.key);
  const zaz = L.filter(q => list.includes(q)), reszta = L.filter(q => !list.includes(q));
  sciana(ui.key).items = kier < 0 ? [...zaz, ...reszta] : [...reszta, ...zaz];
  teraz();
}
function krok(it, d) { const L = itemsOf(ui.key), i = L.indexOf(it), j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; teraz(); }

// ---------------------------------------------------------------- nad podglądem: narzędzia
function narzedzia() {
  const t = $('dTools'); if (!t) return;
  const e = curEl(), sel = selItems(), r = ruchome(), nic = !sel.length, nr = !r.length;
  t.className = 'd-tools n3'; t.innerHTML = '';
  h('div', 'tname', t, `${e.key} · ${e.name}${sel.length ? ` <small>${sel.length > 1 ? sel.length + ' zaznaczone' : nazwa(sel[0])}</small>` : ''}`);
  const row = h('div', 'd-tb', t);
  const go = fn => () => { fn(); teraz(); };
  const ori = r.length && r.every(q => q.orient === r[0].orient) ? r[0].orient : null;
  przycisk(row, { ik: 'lustro', title: 'odbij', off: nr, fn: go(() => r.forEach(q => { if (q.id !== 'napisE') q.mir = !q.mir; })) });
  przycisk(row, { ik: 'obrot', title: 'obróć o 90°', off: nr, fn: go(() => r.forEach(q => { q.rot = norm((q.rot || 0) + 90); delete q.orient; })) });
  przycisk(row, { ik: 'srodek', title: 'na środek (lewo–prawo)', off: nr, fn: go(() => r.forEach(wysrodkuj)) });
  h('span', 'sep', row);
  przycisk(row, { ik: 'kopiaX', title: 'kopia lustrzana lewo ↔ prawo', off: nr, fn: () => lustroKopia(r, 'x') });
  przycisk(row, { ik: 'kopiaY', title: 'kopia lustrzana góra ↔ dół', off: nr, fn: () => lustroKopia(r, 'y') });
  przycisk(row, { ik: 'kopia4', title: 'cztery w narożnikach', off: nr, fn: () => lustroKopia(r, '4') });
  h('span', 'sep', row);
  przycisk(row, { ik: 'pion', title: 'pionowo', on: ori === 'pion', off: nr, fn: go(() => r.forEach(q => orientuj(q, 'pion'))) });
  przycisk(row, { ik: 'zewn', title: 'od środka', on: ori === 'zewn', off: nr, fn: go(() => r.forEach(q => orientuj(q, 'zewn'))) });
  przycisk(row, { ik: 'wewn', title: 'do środka', on: ori === 'wewn', off: nr, fn: go(() => r.forEach(q => orientuj(q, 'wewn'))) });
  h('span', 'sep', row);
  przycisk(row, { ik: 'wierzch', title: 'na wierzch listy', off: nic, fn: () => przenies(sel, -1) });
  przycisk(row, { ik: 'spod', title: 'na spód listy', off: nic, fn: () => przenies(sel, 1) });
  przycisk(row, { ik: 'usun', title: 'usuń (Delete)', off: nic, fn: () => usun(ui.sel) });
  h('span', 'sep', row);
  const hs = hooks.histStan ? hooks.histStan() : { back: 1, fwd: 1 };
  przycisk(row, { ik: 'cofnij', title: 'cofnij (Ctrl+Z)', off: !hs.back, fn: () => cofnij(-1) });
  przycisk(row, { ik: 'ponow', title: 'ponów (Ctrl+Shift+Z)', off: !hs.fwd, fn: () => cofnij(1) });
  h('span', 'sep', row);
  przycisk(row, { txt: '⛶', title: 'cała ścianka (widok domyślny)', on: !ui.vb, fn: () => widok('caly') });
  przycisk(row, { txt: '⊕', title: 'przybliż do zaznaczonego', off: nic, fn: () => widok('element') });
  przycisk(row, { txt: '↩', title: 'poprzedni widok (sprzed ostatniego przycisku)', off: ui.vbPrev === undefined || (ui.vbPrev === null && !ui.vb), fn: () => widok('wstecz') });
  // małe otwory w zaznaczonych elementach: zostaw / powiększ do progu / usuń
  const res = ui.res || { per: [] }, items = itemsOf(e.key);
  const zM = sel.filter(q => { const c = res.per[items.indexOf(q)]; return (c && c.male) || q.male; });
  const mr0 = h('div', 'd-tb d-male-fix' + (zM.length ? '' : ' pusty'), t);
  if (zM.length) {
    mr0.remove();
    const n = zM.reduce((a, q) => a + ((res.per[items.indexOf(q)] || {}).male || 0), 0), tryb = zM.every(q => q.male === zM[0].male) ? zM[0].male || '' : null;
    const mr = h('div', 'd-tb d-male-fix', t);
    h('span', 'lab', mr, `Małe otwory (${n}) &lt; ${fmt(res.lim)} mm:`);
    const ust = v => () => { zM.forEach(q => { if (v) q.male = v; else delete q.male; }); teraz(); };
    przycisk(mr, { txt: 'zostaw', on: tryb === '', title: 'bez zmian (mogą się nie wyciąć czysto)', fn: ust('') });
    przycisk(mr, { txt: 'powiększ', on: tryb === 'powieksz', title: `powiększ do ${fmt(res.lim)} mm`, fn: ust('powieksz') });
    przycisk(mr, { txt: 'usuń', on: tryb === 'usun', title: 'usuń małe otwory z tego elementu', fn: ust('usun') });
  }
}

// ---------------------------------------------------------------- pod podglądem: wielkość, obrót, komunikat
function dolny() {
  const s = $('dStatus'); if (!s) return;
  s.className = 'd-status n3'; s.innerHTML = '';
  const e = curEl(), r = ruchome(), it = r[0], F = pole(e);
  const sl = h('div', 'd-sl', s);
  const wys = it ? (() => { const b = ui.box[it.uid]; return b ? b.y1 - b.y0 : polozenie(e, it).H; })() : 0;
  const s0 = r.map(q => q.s), w0 = wys || 1;
  slider(sl, 'Wielkość', Math.round(wys), 10, Math.round(F.h * 1.2), 1, v => { const f = v / w0; r.forEach((q, i) => { q.s = clamp(s0[i] * f, 0.01, 3); }); szybko(); }, ' mm', !it, () => potem(0));
  slider(sl, 'Obrót', Math.round(it ? it.rot || 0 : 0), -180, 180, 1, v => { const d = v - (it.rot || 0); r.forEach(q => { q.rot = norm((q.rot || 0) + d); delete q.orient; }); szybko(); }, '°', !it, () => potem(0));
  const res = ui.res || { per: [], kolizje: [] }, items = itemsOf(e.key), lines = [];
  if (res.wyspy && res.wyspy.length) lines.push(['err', `${res.wyspy.length} ${res.wyspy.length === 1 ? 'kawałek metalu wypadnie' : 'kawałki metalu wypadną'} (czerwone) – cięcie otacza go dookoła`]);
  if (res.kolizje.length) lines.push(['info', 'Elementy bardzo blisko siebie (pomarańczowe) – mostek cieńszy niż 3 mm']);
  items.forEach((q, i) => { const c = res.per[i]; if (!c) return;
    if (c.poza) lines.push(['info', `${nazwa(q)}: wychodzi poza strefę cięcia – przycięty`]);
    if (c.maly) lines.push(['info', `${nazwa(q)}: najmniejsza wielkość tego wzoru to ${Math.round(c.minH)} mm`]);
    if (c.duze) lines.push(['info', `${nazwa(q)}: duże otwory – żar może wypadać`]); });
  const S = res.sztywnosc;
  if (S && S.ocena === 'słaba') lines.unshift(['err', `Słaba ścianka: wycięte ${Math.round(S.proc * 100)}% – w ogniu może się wygiąć`]);
  // małe otwory (mniejsze niż grubość blachy) – osobny wiersz z przyciskiem „pokaż”
  const nm = (res.male || []).length;
  if (!nm && ui.pokazMale) { ui.pokazMale = false; if (hooks.male) setTimeout(() => hooks.male(false)); }
  const info = h('div', 'd-info', s);                     // stała wysokość: wiersz małych otworów + wiersz komunikatu
  if (nm) {
    const mr = h('div', 'd-male', info);
    h('span', 'd-txt', mr, `<b>${nm}</b> ${nm === 1 ? 'mały otwór' : nm < 5 ? 'małe otwory' : 'małych otworów'} &lt; ${fmt(res.lim)} mm – mogą się nie wyciąć czysto`);
    const bx = h('span', 'd-male-b', mr);
    // kilka elementów z problemem – naprawa całej ścianki jednym kliknięciem
    if (items.filter((q, i) => res.per[i] && res.per[i].male && !q.male).length > 1) {
      przycisk(bx, { txt: 'powiększ wszystkie', title: `wszystkie małe otwory na tej ściance do ${fmt(res.lim)} mm`, fn: () => naprawMale('powieksz', e.key) });
      przycisk(bx, { txt: 'usuń wszystkie', title: 'usuń wszystkie małe otwory na tej ściance', fn: () => naprawMale('usun', e.key) });
    }
    przycisk(bx, { txt: ui.pokazMale ? 'ukryj' : 'pokaż', on: !!ui.pokazMale, title: 'zaznacz małe otwory na czerwono', fn: () => { ui.pokazMale = !ui.pokazMale; render(); if (hooks.male) hooks.male(ui.pokazMale); } });
  }
  if (!nm) h('div', 'd-male pusty', info);
  const m = h('div', 'd-msg ' + (lines.length ? lines[0][0] : 'ok'), info);
  if (lines.length > 1 || (lines[0] && lines[0][1].length > 50)) {
    m.classList.add('wiecej');
    m.onclick = () => dymek(m, lines.map(l => `<p class="${l[0]}">${l[1]}</p>`).join(''));
  }
  m.innerHTML = (S && items.length ? `<span class="sz">sztywność <b class="sz-${S.ocena === 'dobra' ? 'ok' : S.ocena === 'średnia' ? 'mid' : 'bad'}">${S.ocena}</b> · ${Math.round(S.proc * 100)}%</span> ` : '') +
    (lines.length ? lines[0][1] + (lines.length > 1 ? ` <b>+${lines.length - 1}</b>` : '') : items.length ? 'Gotowe do cięcia' : 'Pusta ścianka – wybierz kompozycję albo dodaj wzór');
}
let szT = 0;
function szybko() { clearTimeout(szT); szT = setTimeout(() => { render(); }, 25); clearTimeout(renT); renT = setTimeout(() => changed(), 400); }

// ---------------------------------------------------------------- prawa kolumna: zakładki
function panel() {
  const p = $('dPanel'); if (!p) return;
  const bd = p.querySelector('.d-body'), keep = bd ? bd.scrollTop : 0, byla = ui._tab;
  p.innerHTML = '';
  const tabs = h('div', 'd-tabs', p);
  for (const [k, l] of [['el', 'Elementy'], ['wz', 'Wzory'], ['ko', 'Kompozycje']]) {
    const b = h('button', ui.tab === k ? 'on' : '', tabs, l); b.type = 'button'; b.onclick = () => { ui.tab = k; panel(); };
  }
  const box = h('div', 'd-body', p);
  if (ui.tab === 'el') tabElementy(box); else if (ui.tab === 'wz') tabWzory(box); else tabKompozycje(box);
  if (byla === ui.tab) box.scrollTop = keep;
  ui._tab = ui.tab;
}
function tabElementy(box) {
  const e = curEl(), items = itemsOf(ui.key), src = zrodlo(ui.key);
  if (src !== ui.key) przycisk(box, { txt: 'Ta ścianka powtarza ściankę ' + src + ' – odłącz', cls: 'd-mini-btn', fn: () => { decor.el[ui.key] = { ...kopia(decor.el[src]), link: undefined, items: kopia(decor.el[src].items).map(q => ({ ...q, uid: uid() })) }; delete decor.el[ui.key].link; wszystko(); changed(); } });
  const lay = h('div', 'd-lay', box);
  if (!items.length) h('div', 'd-lay-empty', lay, 'Pusto – wybierz kompozycję albo wzór (zakładki u góry).');
  items.forEach((it, i) => {
    const on = ui.sel.includes(it.uid);
    const r = h('div', 'd-li' + (on ? ' on' : '') + (it.off ? ' ukryty' : ''), lay);
    h('span', 'ic', r, it.grp ? '⧉' : IKONA[it.id] || '•').title = it.grp ? 'powtórzony na innych ściankach' : '';
    const n = h('span', 'nm', r, ''); n.title = nazwa(it);
    if (it.id === 'wzor' && Mini() && Mini()[it.w]) { const s0 = sv('svg', { viewBox: '-50 -50 100 100', class: 'mi' }, n); sv('path', { d: Mini()[it.w], class: 'ho' }, s0); }
    else if (it.id === 'brzeg') n.textContent = IKONA_BRZEGU[it.p.typ] || '▭';
    else if (it.id === 'napisE') n.textContent = '„' + ((it.p && it.p.tekst) || '') + '”';
    else n.textContent = nazwa(it);
    const b = (ik, title, fn, dis) => przycisk(r, { ik, title, off: dis, fn: ev => { ev.stopPropagation(); fn(); } });
    b('oko', it.off ? 'pokaż' : 'ukryj', () => { it.off = !it.off; teraz(); }).classList.toggle('on', !!it.off);
    b('wierzch', 'wyżej (ważniejszy)', () => krok(it, -1), i === 0);
    b('spod', 'niżej', () => krok(it, 1), i === items.length - 1);
    b('usun', 'usuń', () => usun([it.uid]));
    r.onclick = ev => { if (ev.shiftKey) przelacz(it.uid); else { ui.sel = on && ui.sel.length === 1 ? [] : [it.uid]; render(); panel(); } };
  });
  // dodaj elementy ścianki
  const add = h('div', 'd-add', box);
  const dodajEl = (it, gora = true) => { const L = itemsOf(ui.key); if (gora) L.unshift(it); else L.push(it); ui.sel = [it.uid]; teraz(); };
  if (!items.some(q => q.id === 'brzeg')) przycisk(add, { txt: '+ Brzeg', title: 'drobny wzór albo linia wzdłuż obrysu', fn: () => dodajEl({ id: 'brzeg', uid: uid(), p: { typ: 'kropki', wlk: 1, gest: 1, odsun: 0 } }, false) });
  if (e.kind !== 'foot' && !items.some(q => q.id === 'napisE')) przycisk(add, { txt: '+ Napis', title: 'napis', fn: () => dodajEl({ id: 'napisE', uid: uid(), p: { ...NAPIS_DEF }, s: 0.08, u: 0, v: -0.8, rot: 0 }) });
  if (e.kind === 'floor' && !items.some(q => q.id === 'kropki')) przycisk(add, { txt: '+ Odpływ', title: '4 otwory Ø5 mm', fn: () => dodajEl({ id: 'kropki', uid: uid(), n: 4, d: 5, rozstaw: 0.2 }, false) });
  przycisk(add, { txt: '+ Wzór', title: 'galeria wzorów', fn: () => { ui.tab = 'wz'; panel(); } });
  // ustawienia zaznaczonego elementu
  const sel = selItems();
  if (sel.length === 1) ustawienia(box, sel[0]);
  else if (sel.length > 1) h('p', 'd-hint', box, `Zaznaczone: ${sel.length} – wielkość, obrót i kopie pod / nad podglądem.`);
}
// wersja publiczna: uproszczony brzeg
const BRZEGI_PUB = ['ząbki', 'romby', 'kropki'], KONCE_PUB = ['brak', 'koło', 'romb'];
const bokSvg = d => `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor"><rect x="3" y="3" width="14" height="14" stroke-width="1" opacity=".35"/><path d="${d}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
const IKONA_BOKU = { gora: bokSvg('M3 3H17'), dol: bokSvg('M3 17H17'), lewa: bokSvg('M3 3V17'), prawa: bokSvg('M17 3V17') };
const KR = { poziome: '☰', pionowe: '⦀', 'ukośne': '⫽' };
/** Na których ściankach jest ten element (kopie na żywo). Klik: dodaj / usuń kopię – także tutaj. */
function powtorzenia(box, it) {
  const e = curEl(), peers = ui.els.filter(q => q.kind === e.kind);
  if (peers.length < 2) return;
  const row = h('div', 'd-row d-choice', box, '<span class="lab">Na ściankach</span>'), seg = h('div', 'd-ikony', row);
  const gdzie = k => k === ui.key ? itemsOf(k).includes(it) : !!(it.grp && zrodlo(k) === k && itemsOf(k).some(x => x.grp === it.grp));
  for (const q of peers) {
    const ma = gdzie(q.key);
    przycisk(seg, { txt: q.key, title: ma ? 'jest tutaj – kliknij, by usunąć z tej ścianki' : 'powtórz tutaj', on: ma, cls: q.key === ui.key ? 'cur' : '', fn: () => {
      if (ma) {
        const W = sciana(q.key); W.items = W.items.filter(x => (q.key === ui.key ? x !== it : x.grp !== it.grp));
        if (q.key === ui.key) ui.sel = [];
      } else {
        if (!it.grp) it.grp = uid();
        const L = itemsOf(q.key), i = Math.min(itemsOf(ui.key).indexOf(it), L.length);
        L.splice(i < 0 ? L.length : i, 0, { ...kopia(it), uid: uid() });
      }
      // jedna kopia została – już nie jest powtórzeniem
      const kopie = Object.values(decor.el).flatMap(v => (v.items || []).filter(x => x.grp === it.grp));
      if (kopie.length < 2) kopie.forEach(x => delete x.grp);
      renderList(); render(); panel(); zapamietaj(); persist(); hooks.changed(true);
    } });
  }
}
function ustawienia(box, it) {
  { const hd = h('div', 'd-h', box, it.id === 'wzor' && Mini() && Mini()[it.w] ? '' : nazwa(it)); hd.title = nazwa(it);
    if (it.id === 'wzor' && Mini() && Mini()[it.w]) { const s0 = sv('svg', { viewBox: '-50 -50 100 100', class: 'mi' }, hd); sv('path', { d: Mini()[it.w], class: 'ho' }, s0); } }
  // wersja publiczna: wzór spoza dostępnej listy (z gotowego projektu) – tylko położenie, wielkość, obrót i usuwanie
  if (it.id === 'wzor' && (!wzorInfo(it.w) || wzorInfo(it.w).ukryty)) {
    h('p', 'd-hint', box, 'Wzór z gotowego projektu – możesz go przesuwać, zmieniać wielkość, obracać i usunąć. Ustawień wzoru nie można zmieniać.');
    return;
  }
  if (it.id === 'brzeg') return ustBrzeg(box, it);
  if (it.id === 'kropki') {
    const r = h('div', 'd-row d-choice', box, '<span class="lab">Ile</span>'), sg = h('div', 'd-ikony', r);
    for (const n of [1, 3, 4, 5, 6]) przycisk(sg, { txt: String(n), on: it.n === n, fn: () => { it.n = n; teraz(); } });
    slider(box, 'Średnica', it.d, 5, 16, 0.5, v => { it.d = v; szybko(); }, ' mm');
    slider(box, 'Rozstaw', it.rozstaw, 0.05, 0.4, 0.01, v => { it.rozstaw = v; szybko(); });
    return;
  }
  if (it.id === 'napisE') {
    const tr = h('label', 'd-row d-text', box, '<span class="lab">Tekst</span><input type="text" maxlength="40">');
    const inp = tr.querySelector('input'); inp.value = it.p.tekst; inp.oninput = () => { it.p.tekst = inp.value; potem(300); };
    const fr = h('div', 'd-row d-choice fonts', box, '<span class="lab">Czcionka</span>'), fs = h('div', 'd-ikony', fr);
    for (const f of Object.keys(CZCIONKI)) { const b = przycisk(fs, { txt: f, title: CZCIONKI[f].opis, on: it.p.font === f, fn: () => { it.p.font = f; teraz(); } }); b.style.fontFamily = FONT_FAMILY[f]; }
  }
  // wypełnienie paskami / negatyw – każdy wzór i napis
  const f = { ...FILL_DEF, ...(it.fill || {}) }, wl = !!(it.fill && it.fill.typ);
  const fr = h('div', 'd-row d-choice', box, '<span class="lab">Paski</span>'), fsg = h('div', 'd-ikony', fr);
  przycisk(fsg, { ik: 'brak', title: 'bez pasków', on: !wl, fn: () => { delete it.fill; teraz(); } });
  for (const k of ['pionowe']) przycisk(fsg, { txt: KR[k], title: 'paski ' + k, on: wl && f.kier === k, fn: () => { it.fill = { ...f, typ: 'paski', kier: k }; teraz(); } });
  if (wl) slider(box, '↳ metal', f.pas, 3, 15, 0.5, v => { it.fill = { ...f, ...(it.fill || {}), typ: 'paski', pas: v }; szybko(); }, ' mm', !wl);
  if (wl) slider(box, '↳ szczelina', f.szcz, 3, 20, 0.5, v => { it.fill = { ...f, ...(it.fill || {}), typ: 'paski', szcz: v }; szybko(); }, ' mm', !wl);
  if (wl) slider(box, '↳ od', f.min || 0, 0, 60, 1, v => { it.fill = { ...f, ...(it.fill || {}), typ: 'paski', min: v }; szybko(); }, ' mm', !wl || f.neg);
  if (it.id === 'wzor') ustWzoru(box, it);
}
/** Podgląd w trakcie przesuwania suwaka: szkic rysunku (bez mostków) od razu, dokładny wzór po chwili. */
function szkicuj(it, W) {
  const e = curEl(), L = polozenie(e, it);
  szkic(W.gen, { ...W.p, ...(it.p || {}) }, W.Hc, L.H, d => {
    const svg = $('dPlate'); if (!svg || curEl() !== e) return;
    let g = svg.querySelector('#szkicG'); if (g) g.remove();
    g = sv('g', { id: 'szkicG' }, svg);
    const P = ustaw(d.rings, { ...polozenie(e, it), mir: !!it.mir, k: 1 });
    sv('path', { d: svgPath(P), class: 'szkic' }, g);
    if (d.linie.length) sv('path', { d: linePath(ustaw(d.linie, { ...polozenie(e, it), mir: !!it.mir, k: 1 })), class: 'szkicl' }, g);
  });
}
function ustBrzeg(box, it) {
  const p = it.p, linia = p.typ === 'linia' || p.typ === 'linia podwójna';
  const r = h('div', 'd-row d-choice', box, '<span class="lab">Rodzaj</span>'), sg = h('div', 'd-ikony', r);
  for (const t of BRZEGI_PUB) przycisk(sg, { txt: IKONA_BRZEGU[t], title: NAZWA_BRZEGU[t], on: p.typ === t, fn: () => { p.typ = t; teraz(); } });
  const boki = { gora: true, dol: true, lewa: true, prawa: true, ...(p.boki || {}) };
  const br = h('div', 'd-row d-choice', box, '<span class="lab">Boki</span>'), bs = h('div', 'd-ikony', br);
  for (const [k, l] of [['gora', 'góra'], ['dol', 'dół'], ['lewa', 'lewo'], ['prawa', 'prawo']]) przycisk(bs, { txt: IKONA_BOKU[k], title: l, on: boki[k], fn: () => { p.boki = { ...boki, [k]: !boki[k] }; teraz(); } });
  slider(box, 'Grubość', p.wlk, 0.6, 2.5, 0.05, v => { p.wlk = v; szybko(); }, '×');
  if (linia) {
    slider(box, 'Mostek', p.most ?? 5, 3, 20, 0.5, v => { p.most = v; szybko(); }, ' mm');
    slider(box, 'Mostek co', p.co ?? 100, 30, 250, 5, v => { p.co = v; szybko(); }, ' mm');
  } else {
    slider(box, 'Gęstość', p.gest, 0.5, 1.6, 0.05, v => { p.gest = v; szybko(); }, '×');
    if (p.typ === 'recica' || p.typ === 'liście') slider(box, 'Szerokość', p.szer ?? 1, 0.6, 1.8, 0.05, v => { p.szer = v; szybko(); }, '×');
    // zakończenia boków (w narożnikach i tam, gdzie bok się kończy) – zostają przy każdej gęstości
    const kr = h('div', 'd-row d-choice', box, '<span class="lab">Końce</span>'), ks = h('div', 'd-ikony', kr);
    for (const t of KONCE_PUB) przycisk(ks, { txt: IKONA_KONCA[t], title: t, on: (p.konce || 'brak') === t, fn: () => { p.konce = t; teraz(); } });
  }
  slider(box, 'Odstęp', p.odsun, 0, 3, 0.05, v => { p.odsun = v; szybko(); });
}
// ustawienia generatora (wzór liczony od nowa w wątku – kilka sekund przy dużych wzorach)
const POMIN = new Set(['wersja', 'zmienn', 'chaos', 'asym', 'odstepy']);
// logo: paski / negatyw / kontur robi się wspólną opcją „Paski” elementu – w ustawieniach wzoru tylko to, co dotyczy rysunku
const SMOK_POMIN = new Set(['tryb', 'kier', 'pas', 'odstep', 'kontur', 'mostkiCo']);
// wersja publiczna: fixed = ustawione na stałe i ukryte, def = start przy dodaniu, lim = zakres suwaka, opt = dozwolone opcje
const PUB_UST = {
  parzenica_sercowa: { fixed: { przypor: 'brak', wciecie: 1, konce: 'zawijasy', srodek: 'brak' }, def: { obrzeze: 'kropki' }, lim: { sznury: [1, 2] } },
  // rozety: każdy rdzeń to osobny wzór – rdzeń ukryty
  'kolo:cyrklowa': { fixed: { rdzen: 'cyrklowa', otok2: 'brak' }, opt: { otok1: ['brak', 'ząbki', 'kropki', 'łuski', 'recica'] } },
  'kolo:listkowa': { fixed: { rdzen: 'listkowa', otok2: 'brak' }, opt: { otok1: ['brak', 'ząbki', 'kropki', 'łuski', 'recica'] } },
  'kolo:wirująca': { fixed: { rdzen: 'wirująca', otok2: 'brak' }, opt: { otok1: ['brak', 'ząbki', 'kropki', 'łuski', 'recica'] } },
  'kolo:słońce': { fixed: { rdzen: 'słońce', otok2: 'brak' }, opt: { otok1: ['brak', 'ząbki', 'kropki', 'łuski', 'recica'] } },
  'kolo:złożona': { fixed: { rdzen: 'złożona', otok2: 'brak' }, lim: { krag: [1, 2] }, opt: { otok1: ['brak', 'łuski', 'kropki'] } },
  dziewieciornik_dziki: { fixed: { styl: 'naturalny', grub: 1, kolce: 'nie', okrywa: 0, obrot: 0 }, lim: { n: [5, 9] }, opt: { srodek: ['kropki', 'łuski'], otok: ['brak', 'ząbki', 'kropki'] } },
  galazka: { fixed: { typ: 'wić', wezly: 3, lisc: 'liść', kat: 35, wygiecie: 0, zmienn: 0 }, lim: { dlLisc: [0.3, 1] }, opt: { kwiat: ['tulipan', 'rozeta', 'pąk', 'liść'] } },
  fryz: { fixed: { wzor: 'jodełka' } },
  lyznik: { fixed: { motywA: 'rozeta', motywB: 'krzyż', kapliczki: 'nie', rytm: 'z odstępu', glowny: 'jak rytm' }, def: { odstep: 0.45 }, opt: { przedzial: ['brak', 'kreski', 'łezka'], ramka: ['ząbki', 'brak'] } },
  gadzik: { fixed: { poza: 'esowaty', leb: 1.6, krzywizna: 0, zmienn: 0 }, def: { dlugosc: 6 }, lim: { dlugosc: [3, 12] }, opt: { cialo: ['łuski', 'zygzak', 'brak'] } },
  parzenica_slimakowa: { fixed: { pary: 2, kierunek: 'naprzemiennie', echo: 'nie', zmienn: 0 }, def: { zawin: 0.6, srodekW: 0.075, srodek: 'rozeta' }, opt: { koniec: ['kulka', 'ostry'], os: ['łodyga', 'brak'], srodek: ['brak', 'rozeta', 'słońce', 'romb'] } },
  lilijka: { def: { wyp: 'otwór' }, opt: { wyp: ['otwór', 'krokiewki'], stopka: ['trójlistna', 'łodyga'] }, lim: { luk: [-1, 1] } },
  krzyz: { fixed: { typ: 'równoramienny' }, opt: { ramiona: ['rozszerzone', 'liściaste'], styl: ['otwór', 'obrys'], konce: ['proste', 'rozwidlone'], srodek: ['koło', 'romb'], miedzy: ['promienie', 'listki'], otok: ['linia', 'brak'] } },
};
// Wspólne, krótkie nazwy ustawień (wersja publiczna). Klucz: 'gen.klucz' albo sam klucz (dla wszystkich).
const LAB = {
  n: 'Listki', 'kolo:słońce.n': 'Promienie', 'kolo:wirująca.n': 'Ramiona', pelnosc: 'Szerokość', krag: 'Kręgi',
  tryb: 'Wycięcie', oczko: 'Oczko', otok1: 'Otok', otok: 'Otok', obrzeze: 'Otok', szer: '↳ szerokość', gest: '↳ gęstość',
  otokSzer: '↳ szerokość', otokOdst: '↳ odstęp',
  'parzenica_sercowa.ksztalt': 'Kształt', sznury: 'Sznury', 'parzenica_sercowa.grubosc': 'Grubość', smukl: 'Szerokość',
  dlKonca: 'Zawijasy', 'parzenica_sercowa.zwin': '↳ zwinięcie',
  ramiona: 'Ramiona', 'krzyz.konce': 'Końce', 'krzyz.szer': 'Szerokość', styl: 'Wycięcie', 'krzyz.srodek': 'Środek', miedzy: 'Między',
  'dziewieciornik_dziki.n': 'Liście', klapy: 'Klapki', glebia: '↳ długość', wygiecie: 'Wygięcie', krotkie: 'Krótkie',
  tarcza: 'Środek', 'dziewieciornik_dziki.srodek': '↳ wzór',
  dlLisc: 'Liście', rozlozystosc: 'Falowanie', kwiat: 'Kwiat', 'galazka.grubosc': 'Łodyga',
  proporcje: 'Długość', gestosc: 'Gęstość', 'fryz.szer': 'Szerokość',
  'lyznik.wielkosc': 'Motywy', odstep: 'Odstępy', przedzial: 'Przedziałka', ramka: 'Ramka', 'lyznik.grubosc': 'Kreski',
  dlugosc: 'Długość', fale: 'Fale', wysokosc: '↳ wysokość', 'gadzik.grubosc': 'Grubość', ogon: 'Ogon', cialo: 'Wzór',
  zawin: 'Zawinięcie', 'lilijka.zawin': 'Wywinięcie', rozpietosc: 'Rozpiętość', kat: 'Kąt', malenie: 'Dolne', 'parzenica_slimakowa.grubosc': 'Grubość',
  zbieg: 'Zwężenie', koniec: 'Koniec', os: 'Łodyga', 'parzenica_slimakowa.srodek': 'Środek', srodekW: '↳ wielkość',
  typ: 'Odmiana', 'lilijka.styl': 'Płatki', boczne: 'Rozchylenie', srodkowy: 'Środek', 'lilijka.grubosc': 'Grubość', wyp: '↳ wzór',
  opaska: 'Opaska', stopka: 'Dół', liscie: 'Listki', luk: 'Łodyga', wasy: 'Wąsy',
};
const etykieta = (W, q) => LAB[W.gen + ':' + ((W.p || {}).rdzen || '') + '.' + q.key] || LAB[W.gen + '.' + q.key] || LAB[q.key] || q.label;
// Opcje jako znaki (podpis w dymku) – mniej słów, mniej tłumaczenia. Bez znaku zostaje słowo.
const OPT_ZNAK = { brak: '∅', 'tak': '✓', 'nie': '∅', kropki: '•••', 'ząbki': '▼▼', 'łuski': '◡◡', recica: '////', linia: '──', kulka: '●', ostry: '◣',
  romb: '◆', 'koło': '●', rozeta: '✿', 'słońce': '☀', 'liść': '❦', 'łezka': '◖', kreski: '‖' };
/** Parametry startowe wzoru w wersji publicznej (null = jak w galerii). */
const pubCfg = W => W && (PUB_UST[W.gen + ':' + ((W.p || {}).rdzen || '')] || PUB_UST[W.gen]);
function startP(W) {
  const c = pubCfg(W); if (!c) return null;
  const p = { ...(c.fixed || {}), ...(c.def || {}) };
  for (const [k, [a, b]] of Object.entries(c.lim || {})) { const v = (W.p || {})[k]; if (v != null && (v < a || v > b)) p[k] = Math.max(a, Math.min(b, v)); }
  return p;
}
function ustWzoru(box, it) {
  const W = wzorInfo(it.w); if (!W || !W.gen || W.gen.startsWith('rozetka_')) return;
  const hb = h('button', 'd-sek' + (ui.zaaw ? ' on' : ''), box, `${ui.zaaw ? '▾' : '▸'} Więcej${it.p && Object.keys(it.p).length ? ' <small>zmienione</small>' : ''}`); hb.type = 'button';
  hb.onclick = () => { ui.zaaw = !ui.zaaw; panel(); };
  if (!ui.zaaw) return;
  if (!ui.gen) { h('p', 'd-hint', box, 'Wczytuję…'); import('./pracownia/generatory.js').then(m => { ui.gen = m; panel(); }); return; }
  const g = ui.gen.byId(W.gen); if (!g) return;
  const pp = { ...ui.gen.defaults(g), ...W.p, ...(it.p || {}) };
  const dis = typeof g.disabled === 'function' ? g.disabled(pp) || {} : {};
  const set = (k, v) => { it.p = { ...(it.p || {}), [k]: v }; };
  const cfg = pubCfg(W) || {};
  for (const q0 of g.params) {
    if (POMIN.has(q0.key) || (W.gen === 'smok' && SMOK_POMIN.has(q0.key)) || (cfg.fixed && q0.key in cfg.fixed)) continue;
    if (dis[q0.key]) continue;   // wersja publiczna: nieaktywne ustawienia znikają
    const q = { ...q0 };
    if (cfg.opt && cfg.opt[q.key]) q.options = cfg.opt[q.key];
    if (cfg.lim && cfg.lim[q.key]) [q.min, q.max] = cfg.lim[q.key];
    const off = !!dis[q.key], lab = etykieta(W, q);
    if (q.options) { const r = h('div', 'd-row d-choice' + (off ? ' off' : ''), box, `<span class="lab">${lab}</span>`), sg = h('div', 'd-ikony', r);
      for (const o of q.options) przycisk(sg, { txt: (q.key === 'os' && o === 'łodyga') ? '✓' : (OPT_ZNAK[o] || o), title: o, on: !off && pp[q.key] === o, off, fn: () => { set(q.key, o); teraz(); } }); }
    else if (q.min != null) slider(box, lab, pp[q.key], q.min, q.max, q.step || 0.01, v => { set(q.key, v); szkicuj(it, W); potem(450); }, '', off, () => potem(0));
  }
  if (it.p && Object.keys(it.p).length) przycisk(box, { txt: '↺', title: 'przywróć ustawienia z galerii', cls: 'd-mini-btn', fn: () => { const p0 = startP(W); if (p0) it.p = p0; else delete it.p; teraz(); } });
}
function galeria(box, lista, katKey, opis, klik) {
  const I = Indeks();
  if (!I) { h('p', 'd-hint', box, 'Wczytuję…'); wczytajIndeks().then(panel); return; }
  const M = Mini(); if (!M) wczytajMini().then(panel);
  const kats = [...new Set(lista.map(q => q.kategoria))];
  if (ui[katKey] && !kats.includes(ui[katKey])) ui[katKey] = null;
  ui[katKey] = null;   // wersja publiczna: jedna lista, bez kategorii
  const gal = h('div', 'd-gal3', box);
  for (const q of lista) {
    if (ui[katKey] && q.kategoria !== ui[katKey]) continue;
    const b = h('button', 'd-got', gal); b.type = 'button'; b.title = q.nazwa;
    const s = sv('svg', { viewBox: opis.vb }, b);
    const d = M && M[opis.klucz(q)];
    if (d) sv('path', { d, class: 'ho' }, s);
    const dc = M && M[opis.klucz(q) + '|c']; if (dc) sv('path', { d: dc, class: 'cl' }, s);
    h('span', 'nm', b, q.nazwa);
    b.onclick = () => klik(q);
  }
}
function tabWzory(box) {
  const I = Indeks();
  galeria(box, I ? I.wzory.filter(w => !w.ukryty && !w.bezGalerii) : [], 'kat', { vb: '-50 -50 100 100', klucz: q => q.id }, w => {
    const e = curEl(), F = pole(e);
    // domyślnie: najmniejsza wielkość z pełnym rysunkiem (jak na miniaturze), ale nie większa niż pole
    const R0 = w.rozmiary || [], pelny = R0.find(r => !r.upr) || R0[R0.length - 1] || { bh: 60 };
    const maxH = Math.min(F.h * 0.85, F.w * 0.85 / Math.max(0.3, w.asp || 1));
    const H = Math.max(R0.length ? R0[0].bh : 10, Math.min(maxH, Math.max(pelny.bh, Math.min(F.h * 0.4, F.w * 0.4 / Math.max(0.3, w.asp || 1)))));
    const it = { id: 'wzor', uid: uid(), w: w.id, u: 0, v: 0, s: H / F.h, rot: 0, mir: false };
    const p0 = startP(w); if (p0) it.p = p0;
    itemsOf(ui.key).unshift(it); ui.sel = [it.uid]; teraz();
  });
}
function tabKompozycje(box) {
  const I = Indeks();
  galeria(box, I ? I.kompozycje.filter(k => !k.ukryty) : [], 'katK', { vb: '-50 -40 100 80', klucz: q => 'k:' + q.id }, k => {
    zastosujKompozycje(zrodlo(ui.key), k.id); ui.sel = []; ui.tab = 'el'; wszystko(); changed();
  });
}

// ---------------------------------------------------------------- pasek górny
function buildBar() {
  const bar = $('dBar');
  bar.innerHTML = `<div class="d-acts">
      <span class="d-cap">Ścianka</span>
      <button type="button" id="dClr" class="danger" title="Usuń wszystko z tej ścianki (Ctrl+Z cofa)">Wyczyść</button>
    </div>
    <div class="d-acts">
      <span class="d-cap">Laser · mostek 3 mm</span>
    </div>`;
  $('dClr').onclick = () => { delete decor.el[zrodlo(ui.key)]; delete decor.el[ui.key]; ui.sel = []; wszystko(); changed(); };

}

// ---------------------------------------------------------------- API dla app.js
export function refresh(model) {
  if (!model) return;
  ui.model = model;
  ui.els = elements(model, decor);
  if (!ui.els.some(e => e.key === ui.key)) ui.key = ui.els[0] ? ui.els[0].key : '1';
  if (!$('dPlate')) return;
  zastosujOczekujace();
  wszystko();
}
export function selectedKey() { return ui.key; }
export function decorData() {
  const el = {};
  for (const [k, v] of Object.entries(decor.el)) { if (v.link) el[k] = { link: v.link, items: [] }; else if (v.items && v.items.length) el[k] = { items: kopia(v.items), ...(v.komp ? { komp: v.komp } : {}) }; }
  return { tech: 'laser', margin: decor.margin, ...(decor.minOtw > 0 ? { minOtw: decor.minOtw } : {}), el };
}
export function setDecor(d) {
  d = d || {};
  decor.margin = d.margin ?? DECOR_DEF.margin;
  decor.minOtw = d.minOtw > 0 ? +d.minOtw : 0;
  const el = czysc(d);
  decor.el = d.el ? el : startowe().el;
  ui.sel = []; histLast = JSON.stringify(decor.el);
  persist();
  if (ui.model) refresh(ui.model);
}
/** Próg „małych otworów” [mm]; 0 = grubość blachy elementu. */
export function ustawMinOtw(v) { decor.minOtw = v > 0 ? v : 0; if (ui.model && $('dPlate')) render(); changed(); }
/** Małe otwory naraz: tryb 'powieksz' | 'usun' dla wszystkich elementów (key = jedna ścianka albo wszystkie). */
export function naprawMale(tryb, key = null) {
  const keys = key ? [zrodlo(key)] : Object.keys(decor.el).filter(k => !decor.el[k].link);
  keys.forEach(k => (decor.el[k].items || []).forEach(it => { if (tryb) it.male = tryb; else delete it.male; }));
  if (ui.model && $('dPlate')) render(); changed();
}
export const pokazMale = on => { ui.pokazMale = on; if (ui.model && $('dPlate')) render(); };
export const decorCount = d => Object.values((d || decor).el || {}).reduce((a, e) => a + ((e.items || []).length) + (e.link ? 1 : 0), 0);
export { select, decor };

export function initWzory(h0) {
  hooks = { ...hooks, ...h0 };
  const st = document.createElement('style');
  st.textContent = Object.entries(CZCIONKI).map(([k, v]) => `@font-face{font-family:${FONT_FAMILY[k]};src:url(fonts/${v.file});font-display:swap}`).join('');
  document.head.appendChild(st);
  onFontLoaded(() => { if (ui.model && $('dPlate')) { render(); renderList(); } hooks.changed(true); });
  let rT = 0;
  onDane(() => { zastosujOczekujace(); clearTimeout(rT); rT = setTimeout(() => { if (ui.model && $('dPlate') && !drag) { render(); renderList(); if (ui.tab !== 'el') panel(); } hooks.changed(true); }, 30); });
  onPracReady(() => { if (ui.model && $('dPlate') && !drag) { render(); renderList(); } hooks.changed(true); });
  wczytajIndeks().catch(() => {});
  buildBar();
  const svg = $('dPlate');
  svg.addEventListener('pointermove', dragMove);
  svg.addEventListener('pointerup', dragEnd);
  svg.addEventListener('pointerdown', ev => { pan = { x: ev.clientX, y: ev.clientY, vb: [...(ui.vb || ui.vb0)], moved: false, id: ev.pointerId }; });
  svg.addEventListener('pointermove', ev => {
    if (!pan || drag) return;
    const dx = ev.clientX - pan.x, dy = ev.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 4) return;
    if (!pan.moved) { pan.moved = true; svg.setPointerCapture(pan.id); svg.classList.add('pan'); }
    const k = pan.vb[2] / svg.clientWidth * Math.max(1, (pan.vb[3] / pan.vb[2]) / (svg.clientHeight / svg.clientWidth));
    ui.vb = [pan.vb[0] - dx * k, pan.vb[1] - dy * k, pan.vb[2], pan.vb[3]]; svg.setAttribute('viewBox', ui.vb.join(' '));
  });
  svg.addEventListener('pointerup', () => { const p = pan; pan = null; svg.classList.remove('pan'); if (p && !p.moved && ui.sel.length) { ui.sel = []; render(); panel(); } });
  svg.addEventListener('wheel', ev => { const r = ruchome(); if (!r.length || ev.ctrlKey || ev.metaKey) { ev.preventDefault(); zoomW(ev); return; } ev.preventDefault(); const f = ev.deltaY < 0 ? 1.04 : 1 / 1.04; r.forEach(q => { q.s = clamp(q.s * f, 0.01, 3); }); szybko(); }, { passive: false });
  document.addEventListener('keydown', ev => {
    if (!document.body.classList.contains('v-decor')) return;
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    const sel = selItems(); if (!sel.length) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); usun(ui.sel); return; }
    if (ev.key === 'Escape') { ui.sel = []; render(); panel(); return; }
    const m = ruchome(), k = ev.shiftKey ? 0.05 : 0.01; if (!m.length) return;
    if (ev.key === 'ArrowLeft') m.forEach(q => { q.u -= k; }); else if (ev.key === 'ArrowRight') m.forEach(q => { q.u += k; });
    else if (ev.key === 'ArrowUp') m.forEach(q => { q.v += k; }); else if (ev.key === 'ArrowDown') m.forEach(q => { q.v -= k; });
    else return;
    ev.preventDefault(); szybko();
  });
  return { decor, refresh, select, selectedKey, decorData, setDecor, decorCount, ustawMinOtw, naprawMale, pokazMale, czyPokazMale: () => !!ui.pokazMale };
}
