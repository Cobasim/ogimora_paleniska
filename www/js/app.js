import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { PARAMS, THICKNESSES, PERF_LEVELS, DEFAULTS, build, tessellate, layout, bbox } from './geometry.js';
import { buildDxf } from './dxf.js';
import { MATERIALS, estimate, RYNEK, USA_SERIA, usaCena } from './pricing.js';
import { buildPdf, planPrint } from './print.js';
import { FINISHES, makeMaterial, isDark } from './textures.js';
import { encode, decode, CODE_LENGTH } from './code.js';
import { ICONS, perfIcon } from './icons.js';
import { track, trackDebounced, setCodeSource } from './track.js';
import { decorate, decorCost, elements, itemsFor, przygotujSciane, elementHoles } from './zdobienie.js';
import { initWzory } from './wzory.js';
import { wczytajIndeks } from './wzory_dane.js';
import { createFire } from './ogien.js';
import * as B from './biblioteka.js';
import { LANG } from './i18n.js';
import { LIM, START, ogranicz, initProsty } from './prosty.js';   // PROSTY: wersja uproszczona
const MAT_KEYS = ['s235', 'weather'];

const $ = id => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString(LANG === 'en' ? 'en-US' : 'pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });   // wersja angielska: kropka dziesiętna
const dz = v => (LANG === 'en' ? String(v) : String(v).replace('.', ','));

// ---------------- stan ----------------
let state = ogranicz({ ...DEFAULTS, ...START, ...readHash() });   // PROSTY
let model = null, baseModel = null;   // baseModel – sam kształt; model – ze zdobieniami (3D, DXF)
let view = 'model';

// Adres: #kod=13APR-300PT-9KRRP (stare linki z parametrami też działają).
// Wzory i napisy w linku: #kod=…&wzory=… (spakowane, żeby link był krótki). Kod sam opisuje tylko kształt.
const hashWzory = new URLSearchParams(location.hash.slice(1)).get('wzory');
const hadCode = /(^|[#&])(kod|base)=/.test(location.hash);   // adres przy otwarciu (zanim strona dopisze kod)
async function pack(obj) {
  const s = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const b = new Uint8Array(await new Response(s).arrayBuffer());
  let bin = ''; b.forEach(x => { bin += String.fromCharCode(x); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpack(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const b = Uint8Array.from(bin, c => c.charCodeAt(0));
  const s = new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(s).text());
}
let wzoryParam = '', packedFor = '';
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.get('kod')) return decode(q.get('kod')) || {};
  const out = {};
  for (const [k, v] of q) if (k in DEFAULTS && Number.isFinite(+v)) out[k] = +v;
  return out;
}
let code = '';
function writeHash() {
  code = encode(state);
  history.replaceState(null, '', location.pathname + location.search + '#kod=' + code + (wzoryParam ? '&wzory=' + wzoryParam : ''));
  if (typeof autosave === 'function') autosave();
  if (document.activeElement !== $('codeInput')) { $('codeInput').value = code; $('codeInput').parentElement.classList.remove('bad'); }
}
setCodeSource(() => code);

// ---------------- kontrolki ----------------
const ctl = {};
for (const p of PARAMS) {
  const wrap = document.createElement('div');
  // jeden wiersz: ikona · suwak · liczba — pełna nazwa w podpowiedzi
  wrap.className = 'row ctl' + (p.id === 'footAngle' ? ' extra' : '');
  wrap.title = p.label + (p.hint ? ` — ${p.hint}` : '');
  wrap.innerHTML = `<label for="r-${p.id}" class="ctl-ic">${ICONS[p.id] || ''}</label>
    <input type="range" id="r-${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" aria-label="${p.label}">
    <span class="num"><input type="number" id="n-${p.id}" step="${p.step}" aria-label="${p.label}"><em>${p.unit}</em></span>` +
    (p.id === 'footAngle' ? `<button type="button" class="mini" id="matchAngle" title="Stopki w linii narożników misy (kąt stopek = kąt ścianek)">${ICONS.match}</button>` : '');
  $({ body: 'ctl-body', legs: 'ctl-legs', joint: 'ctl-joint' }[p.section]).appendChild(wrap);
  const range = wrap.querySelector('input[type=range]'), num = wrap.querySelector('input[type=number]');
  range.addEventListener('input', () => { set(p.id, +range.value); trackDebounced(p.id, 'slider', { param: p.id, value: state[p.id] }); interacted(); });
  num.addEventListener('change', () => { if (num.value === '') { num.value = state[p.id]; return; }   // puste / nie-liczba: wraca poprzednia wartość
    if (num.value !== '') { set(p.id, +(Math.round(+num.value / p.step) * p.step).toFixed(2)); track('slider', { param: p.id, value: state[p.id], typed: true }); interacted(); } });
  num.addEventListener('keydown', e => { if (e.key === 'Enter') num.blur(); });
  ctl[p.id] = { p, range, num };
}
// ---------------- luz ząbków: widoczny podpis, rysunek w dymku, szybki wybór laser / plazma ----------------
const GAP_PRE = [{ v: 0.3, n: 'Laser', d: 'Laser: wąskie, dokładne cięcie' }, { v: 0.8, n: 'Plazma', d: 'Plazma CNC: szersze cięcie' }, { v: 1.2, n: 'Stara plazma', d: 'Starsza / mniej dokładna plazma' }];
{
  const box = $('ctl-joint'); box.classList.add('gap-box');
  ctl.gap.range.closest('.ctl').removeAttribute('title');
  box.insertAdjacentHTML('afterbegin', `<div class="gap-head"><span>Luz na ząbkach</span><span class="gap-q" tabindex="0" aria-label="Co to jest luz na ząbkach?">?</span></div>`);
  box.insertAdjacentHTML('beforeend', `<div class="gap-pre">${GAP_PRE.map(g => `<button type="button" class="chip" data-g="${g.v}">${g.n} <small>${dz(g.v)}</small></button>`).join('')}</div>`);
  const pop = document.createElement('div'); pop.className = 'gap-pop'; pop.setAttribute('role', 'tooltip'); pop.id = 'gapPop';
  pop.innerHTML = `<b>Luz na ząbkach</b><svg viewBox="0 0 240 118" id="gapSvg" aria-hidden="true"></svg>
    <p>Odstęp między ząbkiem jednej blachy a wycięciem w drugiej – <b>z każdej strony</b>. Dzięki niemu elementy wchodzą w siebie bez szlifowania.</p>
    <p class="gap-tab"><span>Laser</span><b>0,2–0,3 mm</b><span>Plazma CNC</span><b>0,8–1,0 mm</b><span>Stara / niedokładna plazma</span><b>1,2–1,5 mm</b></p>
    <p class="gap-note">Za mały – ząbki nie wejdą. Za duży – luźno, więcej spawania.</p>`;
  document.body.appendChild(pop);
  let hideT = 0;
  const show = () => { clearTimeout(hideT); const r = box.getBoundingClientRect(); pop.classList.add('on');
    pop.style.top = Math.max(8, Math.min(innerHeight - pop.offsetHeight - 8, r.top - 20)) + 'px';
    pop.style.left = Math.max(8, r.left - pop.offsetWidth - 12) + 'px'; };
  const hide = () => { hideT = setTimeout(() => pop.classList.remove('on'), 120); };
  box.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') show(); });
  box.addEventListener('pointerleave', hide);
  box.querySelector('.gap-q').addEventListener('focus', show); box.querySelector('.gap-q').addEventListener('blur', hide);
  box.querySelector('.gap-q').addEventListener('click', () => (pop.classList.contains('on') ? pop.classList.remove('on') : show()));
  box.querySelector('.gap-pre').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; set('gap', +b.dataset.g); track('slider', { param: 'gap', value: +b.dataset.g, preset: true }); interacted(); });
}
/** Rysunek luzu: ząbek w wycięciu, szczeliny (czerwone) rosną razem z ustawieniem. */
function syncGap() {
  const g = state.gap, gp = 2 + g * 9, tw = 34, cx = 120, L = cx - tw / 2 - gp, R = cx + tw / 2 + gp;
  const f = v => v.toFixed(1);
  document.querySelectorAll('.gap-pre button').forEach(b => b.classList.toggle('active', Math.abs(+b.dataset.g - g) < 0.05));
  const s = $('gapSvg'); if (!s) return;
  s.innerHTML = `<rect x="8" y="62" width="${f(L - 8)}" height="26" fill="#cfc8bd" stroke="#16130f" stroke-width="1.2"/>
    <rect x="${f(R)}" y="62" width="${f(232 - R)}" height="26" fill="#cfc8bd" stroke="#16130f" stroke-width="1.2"/>
    <rect x="${cx - tw / 2}" y="14" width="${tw}" height="74" fill="#6f665c" stroke="#16130f" stroke-width="1.2"/>
    <rect x="${f(L)}" y="62" width="${f(gp)}" height="26" fill="#df3434" opacity=".85"/><rect x="${cx + tw / 2}" y="62" width="${f(gp)}" height="26" fill="#df3434" opacity=".85"/>
    <path d="M${f(L)} 98V108M${f(L + gp)} 98V108M${f(R - gp)} 98V108M${f(R)} 98V108" stroke="#df3434" stroke-width="1.2"/>
    <text x="${f(L - 4)}" y="110" text-anchor="end" font-size="12" fill="#df3434" font-weight="700">${dz(g)} mm</text>
    <text x="${f(R + 4)}" y="110" font-size="12" fill="#df3434" font-weight="700">${dz(g)} mm</text>
    <text x="${cx}" y="10" text-anchor="middle" font-size="11" fill="#4a443e">ząbek</text>
    <text x="10" y="56" font-size="11" fill="#4a443e">blacha z wycięciem</text>`;
}

document.querySelectorAll('[data-thk]').forEach(box => {
  const key = box.dataset.thk;
  box.innerHTML = THICKNESSES.filter(t => t <= 5).map(t => `<button type="button" class="chip" data-v="${t}" title="${t} mm">${t}</button>`).join('');
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { set(key, +b.dataset.v); track('thickness', { part: key, value: +b.dataset.v }); interacted(); } });
});

// Wykonanie (spawane / gięte) i gęstość nacięć na linii gięcia
document.querySelectorAll('[data-perf]').forEach(box => {
  box.innerHTML = PERF_LEVELS.map((l, i) => `<button type="button" data-v="${i}" title="Nacięcia: ${l.name.toLowerCase()}">${perfIcon(i)}</button>`).join('');
});
document.querySelectorAll('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', ICONS[el.dataset.icon] || ''));
// Każda ikona wyśrodkowana na swoim rysunku (a nie na siatce 24×24) — równo w przyciskach.
function centerIcons() {
  document.querySelectorAll('svg.ic:not(.wide):not([data-c])').forEach(s => {
    let b; try { b = s.getBBox(); } catch { return; }
    if (!b || !b.width) return; // jeszcze niewidoczna — spróbujemy przy następnym odświeżeniu
    const sz = Math.max(24, b.width + 3, b.height + 3);
    s.setAttribute('viewBox', `${(b.x + b.width / 2 - sz / 2).toFixed(2)} ${(b.y + b.height / 2 - sz / 2).toFixed(2)} ${sz.toFixed(2)} ${sz.toFixed(2)}`);
    s.dataset.c = '1';
  });
}
document.querySelectorAll('[data-opt]').forEach(box => box.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const key = box.dataset.opt;
  // nogi z boków wymagają ścianek schodzących się ku górze i stopek – ustaw rozsądny start
  if (key === 'skirt' && +b.dataset.v === 1 && state.legHeight < 30) state.legHeight = 100;
  if (key === 'skirt' && +b.dataset.v === 1 && state.bowlBent === 2) state.bowlBent = 1;   // przy nogach z boków nie ma misy giętej w całości
  set(key, +b.dataset.v); track('option', { key, value: +b.dataset.v }); interacted();
}));

document.getElementById('matChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.mat = +b.dataset.v;
  shading = 'real'; setFinish(MATERIALS[MAT_KEYS[state.mat]].finish); syncLook(); update();
  track('material', { value: MAT_KEYS[state.mat] }); interacted();
});
function set(key, value) { state[key] = value; update(); }
let didInteract = false;
function interacted() { if (!didInteract) { didInteract = true; track('interact'); } }

function syncControls() {
  for (const id in ctl) {
    const { p, range, num } = ctl[id];
    let lim = model.limits[id] || p;
    if (LIM[id]) lim = { min: Math.max(lim.min, LIM[id].min), max: Math.min(lim.max, LIM[id].max) };   // PROSTY
    range.min = lim.min; range.max = lim.max; range.value = state[id];
    if (document.activeElement !== num) num.value = state[id];
    range.style.setProperty('--p', `${lim.max > lim.min ? (state[id] - lim.min) / (lim.max - lim.min) * 100 : 0}%`);
  }
  // bez stopek: pozostałe suwaki stopek nic nie zmieniają — wyszarzone, ale na swoim miejscu
  for (const id of ['footTop', 'footBottom', 'footAngle', 'footInset']) { ctl[id].range.disabled = ctl[id].num.disabled = state.legHeight === 0; ctl[id].range.closest('.ctl').classList.toggle('off', state.legHeight === 0); }
  $('matchAngle').disabled = state.legHeight === 0;
  document.querySelectorAll('[data-opt]').forEach(box => box.querySelectorAll('button')
    .forEach(b => b.classList.toggle('active', +b.dataset.v === state[box.dataset.opt])));
  // nic nie znika ani się nie przesuwa — niedostępne opcje są tylko wyszarzone
  document.querySelectorAll('[data-opt=perfBowl] button').forEach(b => { b.disabled = !state.bowlBent; });
  // nogi z boków: kąt i cofnięcie stopek wynikają ze ścianek, grubość stopek = grubość misy;
  // w wersji giętej nacięcia gięcia narożników ustawia się w karcie Misa
  const sk = !!state.skirt;
  document.querySelectorAll('[data-opt=perfLeg] button').forEach(b => { b.disabled = sk || !state.legBent || state.legHeight === 0; });
  document.querySelectorAll('#legOpts button').forEach(b => { b.disabled = sk || state.legHeight === 0; });
  document.querySelectorAll('#archOpts button').forEach(b => { b.disabled = !sk; });
  $('bowlAll').disabled = sk;   // nogi z boków: dna nie da się zgiąć razem z bokami
  for (const id of ['footAngle', 'footInset']) if (sk) { ctl[id].range.disabled = ctl[id].num.disabled = true; ctl[id].range.closest('.ctl').classList.add('off'); }
  if (sk && state.skirtArch) { ctl.footTop.range.disabled = ctl.footTop.num.disabled = true; ctl.footTop.range.closest('.ctl').classList.add('off'); }
  $('matchAngle').disabled = $('matchAngle').disabled || sk;
  document.querySelectorAll('[data-thk=tLeg] button').forEach(b => { b.disabled = sk; });
  document.querySelectorAll('#matChips button').forEach(b => b.classList.toggle('active', +b.dataset.v === state.mat));
  syncGap();
  if (typeof wz !== 'undefined') $('clearDecor').disabled = !wz.decorCount();
  document.querySelectorAll('[data-thk]').forEach(box => box.querySelectorAll('button')
    .forEach(b => b.classList.toggle('active', +b.dataset.v === state[box.dataset.thk])));
}

function renderInfo() {
  const s = model.stats;
  $('topOut').textContent = `${fmt(model.derived.top)} mm`;
  $('stats').innerHTML = [
    ['size', 'Gabaryt (szerokość × wysokość)', `${fmt(s.width)} × ${fmt(s.height)} mm`],
    ['mass', 'Masa stali', `${fmt(s.mass, 1)} kg`],
    ['sheet', 'Blacha netto', `${fmt(s.area / 1e6, 2)} m²`],
    ['cut', 'Długość cięcia', `${fmt(s.cut / 1000, 1)} m`],
  ].map(([ic, k, v]) => `<div class="stat" title="${k}">${ICONS[ic]}<b>${v}</b></div>`).join('');
  const est = estimate(baseModel, MAT_KEYS[state.mat]);
  const dc = decorCost(model, MAT_KEYS[state.mat]);
  const US = RYNEK === 'us';                                 // wersja angielska: osobny szacunek według stawek z USA, w dolarach
  const zl = v => US ? `$${Math.round(v).toLocaleString('en-US')}` : `${fmt(Math.round(v))} zł`;
  // na wierzchu: suma (duża) i pod nią koszt wzorów; szczegóły po kliknięciu
  if (!$('priceHead')) $('price').innerHTML = `<details><summary class="price-head" id="priceHead"></summary>
    <div class="price-pop"><table id="priceTable"></table>
    <p>${US ? 'Rough test prices.' : 'Ceny orientacyjne, testowe.'}</p></div></details>`;
  const L = Object.fromEntries(est.lines.map(l => [l[0], l]));
  const seria = est.net + dc.cost;                           // PL: cena netto; USA: cena sztuki przy dużej serii
  // suma zaokrąglana w górę do 5 (ceny orientacyjne, własne – nie czyjś cennik)
  const K1 = US ? USA_SERIA[0][1] : 1, total = Math.ceil((US ? usaCena(seria, 1) : seria) / 5) * 5;   // USA: jedna sztuka – przeliczenie dopasowane do dwóch prawdziwych wycen
  $('priceHead').innerHTML = (US ? `<span title="Test price for ONE piece – a rough estimate for the USA. Before sales tax. Ask a shop for a real quote.">Test price, rough <u class="rynek">USA · 1 pc</u></span>` : `<span title="Cena testowa za JEDNĄ sztukę – szacunek orientacyjny dla Polski. Netto. Dokładną cenę poda zakład.">Cena testowa, orientacyjna <u class="rynek">PL · 1 szt.</u></span>`) + `<b>≈ ${zl(total)}</b>` +
    `<em class="decor-price${dc.cost > 0.5 ? '' : ' none'}">${dc.cost > 0.5 ? (US ? `incl. patterns ${zl(dc.cost * K1)}` : `w tym wzory ${zl(dc.cost)}`) : (US ? 'no patterns' : 'bez wzorów')}</em><i class="price-more">${US ? 'details' : 'szczegóły'}</i>`;
  // jedna sztuka: w USA pozycje × K1 + stała obsługa zlecenia (razem = cena jednej sztuki); bez cen za serię
  const row = (k, d, v, cls = '') => `<tr class="${cls}"><td>${k}<small>${d}</small></td><td>${zl(v * K1)}</td></tr>`;
  const sec = t => `<tr class="sec"><td colspan="2">${t}</td></tr>`;
  const m = model.stats;
  $('priceTable').innerHTML =
    row('Stal', US ? String(L['Materiał'][1]).replace(/\s*×.*$/, '') : L['Materiał'][1], L['Materiał'][2]) +
    (US ? `<tr><td>Order handling<small>setup, per order</small></td><td>${zl(USA_SERIA[0][2])}</td></tr>` : row('Przygotowanie', L['Przygotowanie'][1], L['Przygotowanie'][2])) +
    sec('Kształt główny') +
    row('Cięcie', L['Cięcie laserem'][1], L['Cięcie laserem'][2]) +
    row('Przebicia', L['Przebicia'][1], L['Przebicia'][2]) +
    (L['Gięcie'] ? row('Gięcie', L['Gięcie'][1], L['Gięcie'][2]) : '') +
    sec('Wzory') +
    row('Cięcie', US ? `${(dc.len / 1000).toFixed(1)} m (${(dc.len / 304.8).toFixed(0)} ft)` : `${fmt(dc.len / 1000, 1)} m`, dc.cut || 0, 'decor-line') +
    row('Przebicia', `${dc.n} szt.`, dc.pierce || 0, 'decor-line') +
    (US ? `<tr class="sum"><td>One piece (USA), before sales tax<small>cut length ${(m.cut / 1000).toFixed(1)} m (${(m.cut / 304.8).toFixed(0)} ft) · ${m.pierces ?? '—'} pierces</small></td><td>${zl(total)}</td></tr>`
    : `<tr class="sum"><td>Razem netto (PL)<small>długość cięcia ${fmt(m.cut / 1000, 1)} m · przebić ${m.pierces ?? '—'}</small></td><td>${zl(total)}</td></tr>` +
      `<tr><td>Brutto (23% VAT)<small>to cena jednej sztuki</small></td><td>${zl(total * 1.23)}</td></tr>`);
  const plan = planPrint(model);           // model ze zdobieniami – wzory też na modelu papierowym
  const np = plan.pages.length + 1;                 // + kartka z widokami
  $('pdfSub').textContent = `skala 1:${plan.N} · ${np} ${np === 1 ? 'kartka' : np < 5 ? 'kartki' : 'kartek'} A4${plan.mode === 'tiles' ? ' do sklejenia' : ''}`;
  const nParts = model.parts.reduce((s, p) => s + p.qty, 0);
  $('ctaSub').textContent = `${nParts} elementów · gotowy do cięcia CNC`;
  maleBlacha(); renderMale();
  // ostrzeżenia w stałym miejscu jednej linii; wszystkie — po najechaniu
  const W = model.warnings;
  $('warnings').innerHTML = W.map(w => `<li>${w}</li>`).join('');
  $('warnLine').innerHTML = W.length ? `${ICONS.warn}<span>${W[0]}</span>${W.length > 1 ? `<b>+${W.length - 1}</b>` : ''}` : '';
  $('warnSlot').classList.toggle('has', W.length > 0);
  $('warnSlot').classList.toggle('many', W.length > 1);
}

// ---- małe otwory (mniejsze niż grubość blachy): info, próg i podświetlenie na modelu / rozkroju
function renderMale() {
  const box = $('maleBox'); if (!box) return;
  const M = model.male || { n: 0, lims: [] }, D = wz.decor, rec = D.minOtw > 0;
  const prog = rec ? D.minOtw : state.tBowl;           // domyślnie grubość blachy
  const mm = v => `${fmt(v, v % 1 ? 1 : 0)} mm`;
  if (!box.firstChild) {
    box.innerHTML = `<div class="male-head"><span class="male-txt"></span><button type="button" class="chip male-btn" title="Zaznacz małe otwory na modelu (czerwone, migające)">pokaż</button></div>
      <label class="male-sl" title="Otwór węższy i krótszy niż ten wymiar jest zgłaszany jako za mały do czystego cięcia (domyślnie grubość blachy)"><span>Próg</span><input type="range" min="1" max="10" step="0.5"><output></output></label>
      <div class="male-fix"><button type="button" class="chip" data-m="powieksz" title="Powiększ wszystkie małe otwory do progu">Powiększ wszystkie</button><button type="button" class="chip" data-m="usun" title="Usuń wszystkie małe otwory">Usuń wszystkie</button></div>`;
    box.querySelector('.male-btn').onclick = () => { setShowMale(!showMale); };
    const r = box.querySelector('input');
    r.oninput = () => { box.querySelector('output').textContent = mm(+r.value); };
    r.onchange = () => { wz.ustawMinOtw(+r.value === state.tBowl ? 0 : +r.value); };
    box.querySelectorAll('.male-fix button').forEach(b => { b.onclick = () => wz.naprawMale(b.dataset.m); });
  }
  if (!M.n && showMale) setShowMale(false);
  const r = box.querySelector('input');
  if (document.activeElement !== r) { r.value = prog; box.querySelector('output').textContent = mm(prog); }
  box.classList.toggle('has', M.n > 0);
  box.classList.toggle('open', M.n > 0 && showMale);   // próg i naprawa dopiero po „pokaż” – na start jedna spokojna linijka
  box.querySelector('.male-txt').innerHTML = M.n ? `${ICONS.warn}<b>${M.n}</b>&nbsp;${M.n === 1 ? 'mały otwór' : M.n < 5 ? 'małe otwory' : 'małych otworów'} &lt; ${mm(prog)}` : 'Małe otwory: brak';
  const b = box.querySelector('.male-btn'); b.textContent = showMale ? 'ukryj' : 'pokaż'; b.classList.toggle('active', showMale); b.hidden = !M.n;
  box.querySelector('.male-fix').hidden = !M.n;
}
// zmiana grubości blachy: próg wraca do grubości blachy
let tPrev = null;
function maleBlacha() { const t = `${state.tBowl}|${state.tLeg}`; if (tPrev !== null && t !== tPrev && wz.decor.minOtw > 0) wz.ustawMinOtw(0); tPrev = t; }
function setShowMale(on) {
  showMale = on; maleMat.opacity = maleLineMat.opacity = 1;
  if (wz.czyPokazMale() !== on) wz.pokazMale(on);
  renderMale(); cancelAnimationFrame(raf); raf = requestAnimationFrame(rebuildScene);
}
let raf = 0;
// zdobienia: przeliczane po chwili bezczynności (suwaki kształtu zostają płynne)
let decorT = 0;
function applyDecor() { model = decorate(baseModel, wz.decor).model; }
// Wzory przy zmianie kształtu liczone w tle, ścianka po ściance (między ściankami przeglądarka obsługuje suwaki).
// W trakcie przeciągania suwaka nic się nie liczy – widać od razu nowy kształt (bez wzorów), wzory dochodzą po puszczeniu.
let decTok = 0, suwakWDol = false;
function decorSoon(delay = 160) {
  clearTimeout(decorT); const tok = ++decTok;
  if (suwakWDol) { liczeWzory(0, 0); return; }
  decorT = setTimeout(async () => {
    const els = elements(baseModel, wz.decor).filter(e => itemsFor(wz.decor, e.key).length);
    for (let i = 0; i < els.length; i++) {
      if (tok !== decTok) return;                       // nowa zmiana – porzucamy to liczenie
      liczeWzory(i, els.length);
      await new Promise(r => setTimeout(r, 0));
      if (tok !== decTok) return;
      { const t0 = performance.now(); elementHoles(els[i], itemsFor(wz.decor, els[i].key), wz.decor); const t1 = performance.now();
        await new Promise(r => setTimeout(r, 0)); if (tok !== decTok) return;
        przygotujSciane(els[i], wz.decor); if (window.PROF) console.log('EH', els[i].key, (t1 - t0) | 0, (performance.now() - t1) | 0); }   // wynik trafia do pamięci
    }
    if (tok !== decTok) return;
    { const t0 = performance.now(); applyDecor(); const t1 = performance.now(); liczeWzory(-1); renderInfo(); if (PR) PR.poLiczeniu(); const t2 = performance.now(); if (window.PROF) console.log('DEC', (t1 - t0) | 0, 'INFO', (t2 - t1) | 0); }
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const t0 = performance.now(); rebuildScene(); if (window.PROF) console.log('SCENE', (performance.now() - t0) | 0); });
  }, delay);
}
/** Wskaźnik „liczę wzory” na podglądzie (i – gotowe ścianki, n – wszystkie; i < 0 = koniec). */
function liczeWzory(i, n) {
  let b = $('liczeWzory');
  if (!b) { b = document.createElement('div'); b.id = 'liczeWzory'; b.className = 'licze'; b.innerHTML = '<span></span><i><b></b></i>'; stage.appendChild(b); }
  if (i < 0) { b.classList.remove('on'); return; }
  b.classList.add('on');
  b.querySelector('span').textContent = n ? `Liczę wzory… ${i}/${n}` : 'Wzory po puszczeniu suwaka';
  b.querySelector('b').style.width = n ? `${Math.round(i / n * 100)}%` : '0%';
}
document.addEventListener('pointerdown', e => { if (e.target.matches && e.target.matches('input[type=range]') && !e.target.closest('#dPanel, .d-status, #maleBox, #pPanel')) suwakWDol = true; }, true);
document.addEventListener('pointerup', () => { if (suwakWDol && kadr.auto) setTimeout(() => { if (view === 'model') dopasuj(); }, 500);
  if (suwakWDol) { suwakWDol = false; if (hasDecor() && view !== 'decor') decorSoon(80); } }, true);
const hasDecor = () => Object.values(wz.decor.el).some(e => e.items && e.items.length);
function update() {
  state = ogranicz(state);   // PROSTY
  baseModel = build(state);
  { // PROSTY: wysokość paleniska stała – gdy silnik obniży dno (nogi zbiegają się pod misą), misa odpowiednio rośnie
    const chcial = state.height + state.legHeight, q = baseModel.params, h = chcial - q.legHeight;
    if (q.height + q.legHeight !== chcial && h >= LIM.height.min && h <= LIM.height.max) baseModel = build({ ...state, legHeight: q.legHeight, height: h }); }
  state = { ...state, ...baseModel.params };
  if (typeof PR !== 'undefined' && PR) PR.ksztalt();   // PROSTY: pola ścianek mają nowe wymiary – wzory układane od nowa
  if (hasDecor()) { if (!model || view === 'decor') applyDecor(); else { model = { ...baseModel, parts: model.parts }; decorSoon(350); } }
  else applyDecor();
  if (view === 'decor') wz.refresh(baseModel);
  syncControls();
  renderInfo();
  writeHash();
  if (typeof renderSaved === 'function') renderSaved();
  if (typeof histZapisz === 'function') histZapisz();
  $('note').textContent = ''; $('note').className = 'note';
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { rebuildScene(); centerIcons(); });
}

// ---------------- scena 3D ----------------
const canvas = $('scene'), stage = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;   // światła stoją w miejscu – cienie liczone tylko po przebudowie sceny

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
const orbit = new OrbitControls(camera, canvas);
Object.assign(orbit, { enableDamping: true, dampingFactor: .09, enablePan: false, screenSpacePanning: true, rotateSpeed: .7, minZoom: .4, maxZoom: 4, minPolarAngle: .01, maxPolarAngle: Math.PI - .01 });

const hemi = new THREE.HemisphereLight(0xf6f0df, 0x3a3c33, 1.9); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
key.position.set(-900, 1500, 1100); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1200, right: 1200, top: 1200, bottom: -1200, near: 10, far: 5000 });
key.shadow.bias = -.0004; key.shadow.normalBias = 1.5;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xc4ccd4, 1.0); fill.position.set(1000, 600, -900); scene.add(fill);
const head = new THREE.DirectionalLight(0xfff6ea, .9); head.position.set(0, 0, 1); camera.add(head); scene.add(camera);
const ember = new THREE.PointLight(0xff8a3d, 0, 900, 1.6); scene.add(ember);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.ShadowMaterial({ opacity: .16 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// ---------------- ogień w misie ----------------
// Przycisk „Ogień”: w misie pali się ogień, blask widać przez wycięcia, oświetlenie z zewnątrz bez zmian
// (widać jednocześnie wykończenie stali i ogień). Przycisk „Wieczór” (tylko przy ogniu): przyciemnia scenę,
// światło ognia rzuca cienie, więc wychodzi tylko przez wycięcia i rysuje plamy na ziemi.
const fire = createFire(scene);
let fireOn = false, fireNight = false;
const groundDay = ground.material;
const groundNight = new THREE.MeshLambertMaterial({ color: 0x55504a, transparent: true, depthWrite: false,
  alphaMap: (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(.28, '#fff'); gr.addColorStop(.6, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })() });
const DAY = { hemi: [1.9, 0xf6f0df, 0x3a3c33], key: [2.6, 0xfff0dc], fill: 1.0, head: .9, exp: 1.1 };
const NIGHT = { hemi: [.7, 0x8796bd, 0x2a2420], key: [.6, 0xa9b8e0], fill: .18, head: .2, exp: 1.0 };   // blady księżyc: stopki i ich wzory ledwo widoczne
const isFire = () => fireOn && view === 'model';
const isNight = () => isFire() && fireNight;
function applyNight(floorBox) {
  const n = isNight(), L = n ? NIGHT : DAY;
  hemi.intensity = L.hemi[0]; hemi.color.set(L.hemi[1]); hemi.groundColor.set(L.hemi[2]);
  key.intensity = L.key[0]; key.color.set(L.key[1]); fill.intensity = L.fill; head.intensity = L.head;
  renderer.toneMappingExposure = L.exp;
  // przy ogniu krawędzie ciemne: jasne obwódki otworów zlewałyby się z blaskiem (a nocą świeciłyby jak neon)
  edgeMat.color.set(isFire() ? 0x24211e : 0xfff6e8); edgeMat.opacity = n ? .75 : isFire() ? .6 : .9;
  ground.material = n ? groundNight : groundDay;
  stage.classList.toggle('night', n);
  const f = isFire();
  fire.show(f);
  // w dzień ziemia ma tylko cienie (ShadowMaterial) – cień od ognia zaciemniłby wszystko wokół misy
  fire.light.castShadow = n;
  if (f && floorBox) fire.place(floorBox, { base: state.base, height: state.height, angle: state.angle, t: state.tBowl, legHeight: state.legHeight }, shading === 'draw' ? .3 : 1);
  renderer.shadowMap.needsUpdate = true; needsRender = true;
}

let finish = MATERIALS[MAT_KEYS[state.mat] || 's235'].finish;
let shading = 'draw', xray = false, showEdges = false; // start: rysunek, bez X-ray
let modelLook = null; // ustawienie kamery modelu na czas oglądania rozkroju
const matCache = {};
const material = () => (matCache[finish] ||= makeMaterial(finish, renderer));
// krawędzie w trybie realistycznym — jasne na ciemnych powierzchniach, ciemne na jasnych
// Grube linie (2 px) — zwykłe linie WebGL mają zawsze 1 px i giną na teksturze nalotu.
const edgeMat = new LineMaterial({ color: 0xfff6e8, linewidth: 2, transparent: true, opacity: .9, worldUnits: false });
// linie spawów (czerwone) i gięć (niebieskie) — grube, żeby było je widać na każdym wykończeniu
const weldMat = new LineMaterial({ color: 0xe0262f, linewidth: 4, worldUnits: false });
const bendMat = new LineMaterial({ color: 0x2f6fe0, linewidth: 4, worldUnits: false });
let showWeld = false, showBend = false;
const fatLines = edges => { const g = new LineSegmentsGeometry().setPositions(edges.attributes.position.array); return new LineSegments2(g, edgeMat); };
const drawMat = new THREE.MeshLambertMaterial({ color: 0xf7f5ef, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
const selMat = new THREE.MeshLambertMaterial({ color: 0xf2b38a, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const cutLineMat = new THREE.LineBasicMaterial({ color: 0x14130f });
// ogień: ścianki wycięć (krawędzie szczelin) świecą żarem – widać ogień także pod ostrym kątem
const zarMat = new THREE.MeshBasicMaterial({ color: 0xd2621f, side: THREE.DoubleSide, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
// małe otwory: czerwone migające punkty (stała wielkość na ekranie – widać je przy każdym przybliżeniu) i kontury
const kropkaTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.globalAlpha = 0.5; g.stroke();
  return new THREE.CanvasTexture(c); })();
const maleMat = new THREE.PointsMaterial({ color: 0xe0201b, size: 11, map: kropkaTex, alphaTest: 0.1, sizeAttenuation: false, depthTest: false, transparent: true });
const maleLineMat = new THREE.LineBasicMaterial({ color: 0xe0201b, depthTest: false, transparent: true });
let showMale = false;   // podpis: szczelina po laserze, bez otworu
const foldMat = new THREE.LineDashedMaterial({ color: 0x3b6fd6, dashSize: 12, gapSize: 8 });
const hiddenMat = new THREE.LineDashedMaterial({ color: 0x7d8174, dashSize: 9, gapSize: 7, transparent: true, opacity: .75,
  depthFunc: THREE.GreaterDepth, depthWrite: false });
function renderFinishChips() {
  const list = FINISHES[MAT_KEYS[state.mat]];
  if (!list.some(f => f.id === finish)) finish = MATERIALS[MAT_KEYS[state.mat]].finish;
  $('finish').innerHTML = list.map(f => `<button class="chip sw f-${f.id}${f.id === finish && shading === 'real' ? ' active' : ''}" data-finish="${f.id}" title="${f.name}: ${f.hint}"${view === 'flat' ? ' disabled' : ''}></button>`).join('');
}
function setFinish(f) { finish = f; renderFinishChips(); }

// z-góra → y-góra (three). Obrót, a nie zamiana osi: zamiana y↔z byłaby lustrem (napisy czytane wspak).
const W = a => new THREE.Vector3(a[0], a[2], -a[1]);
let group = null, fitted = false, modelCenter = null;

// Rozkrój dopasowany do okna: szukamy szerokości pasa, przy której elementy wypełniają widok najlepiej.
let flatBox = { w: 1000, h: 600 };
// PROSTY: kadr – własne przesuwanie (obrót zawsze wokół środka modelu) i dopasowanie do wolnego miejsca.
// kadr.x / kadr.y – przesunięcie kadru [mm], wpp – mm na piksel przy zoom = 1, auto – model sam wypełnia podgląd
// (do pierwszego ręcznego przybliżenia albo przesunięcia; przyciski widoku włączają auto z powrotem).
const kadr = { x: 0, y: 0, wpp: 1, auto: true };
/** Wolny prostokąt podglądu [px]: bez karty „Kształt” (gdy leży na podglądzie) i z marginesem na przyciski. */
function wolne() {
  const w = stage.clientWidth, H = canvas.clientHeight || stage.clientHeight;
  const karta = stage.querySelector('.card-left');
  const naPodgladzie = matchMedia('(min-width: 1101px)').matches && !document.body.classList.contains('cards-off') && karta && karta.offsetWidth;
  const x0 = naPodgladzie ? karta.getBoundingClientRect().right - stage.getBoundingClientRect().left + 14 : 10;
  return { w, H, x0, x1: w - 10, y0: 44, y1: H - 40 };
}
/** Kadr tak, żeby to, co jest w scenie, było jak największe w wolnym miejscu (dla bieżącego kierunku patrzenia). */
function dopasuj() {
  if (!group || view === 'decor') return;
  const F = wolne(); if (!F.w || !F.H) return;
  const box = new THREE.Box3().setFromObject(group); if (box.isEmpty()) return;
  orbit.update(); camera.updateMatrixWorld();
  const R = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), U = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const q = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(camera.position);
    const px = q.dot(R), py = q.dot(U);
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  const fw = Math.max(120, F.x1 - F.x0), fh = Math.max(120, F.y1 - F.y0);
  kadr.wpp = Math.max((x1 - x0) / fw, (y1 - y0) / fh) * 1.04;
  kadr.x = (x0 + x1) / 2 - ((F.x0 + F.x1) / 2 - F.w / 2) * kadr.wpp;
  kadr.y = (y0 + y1) / 2 - (F.H / 2 - (F.y0 + F.y1) / 2) * kadr.wpp;
  camera.zoom = 1; kadr.auto = true;
  ustawKadr();
}
function ustawKadr() {
  const w = stage.clientWidth, H = canvas.clientHeight || stage.clientHeight, k = kadr.wpp;
  camera.left = kadr.x - w / 2 * k; camera.right = kadr.x + w / 2 * k; camera.top = kadr.y + H / 2 * k; camera.bottom = kadr.y - H / 2 * k;
  camera.updateProjectionMatrix(); needsRender = true;
}
function viewArea() { const F = wolne(); return { w: F.w, canvasH: Math.max(120, F.y1 - F.y0), centerW: Math.max(160, F.x1 - F.x0) }; }
/** Rozkrój: elementy w rzędach; szukamy takiego układu (kolejność + szerokość rzędu), przy którym całość jest największa na ekranie. */
function packToView(parts) {
  const items0 = [];
  parts.forEach(p => { for (let k = 0; k < p.qty; k++) { const b = bbox(p.outline); items0.push({ part: p, key: (p.keys && (p.keys[k] || p.keys[0])) || '', b, w: b.maxX - b.minX, h: b.maxY - b.minY }); } });
  const { centerW, canvasH } = viewArea();
  const gap = Math.max(14, Math.sqrt(items0.reduce((s, i) => s + i.w * i.h, 0)) * .018);
  let best = null;
  const kolejnosci = [(a, b) => b.h - a.h, (a, b) => b.w - a.w, (a, b) => b.w * b.h - a.w * a.h, (a, b) => a.h - b.h];
  for (const por of kolejnosci) {
    const items = items0.slice().sort(por);
    const total = items.reduce((s, i) => s + i.w, 0), maxW = Math.max(...items.map(i => i.w));
    for (let k = 0; k <= 80; k++) {
      const rowW = maxW + (total - maxW + gap * items.length) * k / 80;
      let x = 0, y = 0, rowH = 0, W = 0; const pl = [];
      for (const it of items) {
        if (x > 0 && x + it.w > rowW + 1e-6) { x = 0; y += rowH + gap; rowH = 0; }
        pl.push({ ...it, x, y }); x += it.w + gap; rowH = Math.max(rowH, it.h); W = Math.max(W, x - gap);
      }
      const H = y + rowH, score = Math.min(centerW / W, canvasH / H);
      if (!best || score > best.score * 1.001) best = { score, pl, W, H };
    }
  }
  // każdy rząd wyśrodkowany w pionie względem najwyższego elementu rzędu
  return best;
}

/**
 * Krawędzie płyty liczone z jej konturu (a nie z siatki trójkątów): obrys góry i dołu każdej pętli
 * + pionowe krawędzie tylko w prawdziwych narożnikach. Siatka trójkątów z otworami zawiera
 * „mostki” do otworów, które EdgesGeometry rysowało jako zbędne linie.
 */
function plateEdges(loops, depth) {
  const pos = [];
  for (const raw of loops) {
    const L = raw.filter((p, i) => p.distanceTo(raw[(i + 1) % raw.length]) > 1e-3);
    const n = L.length;
    for (let i = 0; i < n; i++) {
      const a = L[i], b = L[(i + 1) % n], c = L[(i + 2) % n];
      pos.push(a.x, a.y, 0, b.x, b.y, 0, a.x, a.y, depth, b.x, b.y, depth);
      const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
      if (d1.dot(d2) < Math.cos(25 * Math.PI / 180)) pos.push(b.x, b.y, 0, b.x, b.y, depth);
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
}

function rebuildScene() {
  if (group) { scene.remove(group); group.traverse(o => o.geometry && o.geometry.dispose()); }
  group = new THREE.Group();
  if (view === 'flat') return rebuildFlat();
  const mat = shading === 'draw' ? drawMat : material();
  const selKey = view === 'decor' ? wz.selectedKey() : null;
  for (const s of model.solids) {
    const outer = tessellate(s.outline, 10).map(([x, y]) => new THREE.Vector2(x, y));
    const holes = (s.holes || []).map(h => tessellate(h, 8).map(([x, y]) => new THREE.Vector2(x, y)));
    const shape = new THREE.Shape(outer);
    shape.holes = holes.map(h => new THREE.Path(h));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: s.t, bevelEnabled: false, curveSegments: 1 });
    const u = W(s.u).normalize(), v = W(s.v).normalize(), n = new THREE.Vector3().crossVectors(u, v).normalize();
    const o = W(s.o);
    if (s.toward === 'center') o.addScaledVector(n, -s.t / 2);
    else if (n.dot(W(s.toward)) < 0) o.addScaledVector(n, -s.t);
    const m4 = new THREE.Matrix4().makeBasis(u, v, n).setPosition(o);
    geo.applyMatrix4(m4); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, selKey && s.key === selKey ? selMat : mat);
    mesh.userData.key = s.key;
    mesh.castShadow = true; mesh.receiveShadow = shading === 'real' || isNight();
    group.add(mesh);
    {
      const edges = plateEdges([outer, ...holes], s.t).applyMatrix4(m4);
      if (shading === 'draw') group.add(new THREE.LineSegments(edges, lineMat));
      else if (showEdges) {
        group.add(fatLines(edges));
      }
      if (xray) { const h = new THREE.LineSegments(edges, hiddenMat); h.computeLineDistances(); h.renderOrder = 2; group.add(h); }
    }
    if (isFire() && s.holes && s.holes.length) {
      // ścianki otworów (grubość blachy) jako świecący pas; wnętrze od strony ognia jaśniejsze
      const pos = [];
      for (const h of holes) for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length];
        pos.push(a.x, a.y, 0, b.x, b.y, 0, b.x, b.y, s.t, a.x, a.y, 0, b.x, b.y, s.t, a.x, a.y, s.t); }
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).applyMatrix4(m4);
      const z = new THREE.Mesh(g, zarMat); z.renderOrder = 4; group.add(z);
    }
    if (s.signLines && s.signLines.length) {
      // podpis: linia cięcia widoczna na obu powierzchniach blachy
      const pos = [];
      for (const z of [-0.05, s.t + 0.05]) for (const l of s.signLines) for (let i = 1; i < l.length; i++) pos.push(l[i - 1][0], l[i - 1][1], z, l[i][0], l[i][1], z);
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).applyMatrix4(m4);
      group.add(new THREE.LineSegments(g, shading === 'draw' ? lineMat : cutLineMat));
    }
    if (showMale && s.male && s.male.length) {
      const pts = [], seg = [];
      for (const h of s.male) {
        let cx = 0, cy = 0; h.forEach(q => { cx += q.x; cy += q.y; }); cx /= h.length; cy /= h.length;
        for (const z of [-0.2, s.t + 0.2]) { pts.push(cx, cy, z); for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; seg.push(a.x, a.y, z, b.x, b.y, z); } }
      }
      const pg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)).applyMatrix4(m4);
      const P = new THREE.Points(pg, maleMat); P.renderOrder = 5; group.add(P);
      const lg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)).applyMatrix4(m4);
      const L = new THREE.LineSegments(lg, maleLineMat); L.renderOrder = 5; group.add(L);
    }
  }
  for (const [on, list, m] of [[showWeld, model.seams.weld, weldMat], [showBend, model.seams.bend, bendMat]]) {
    if (!on || !list.length) continue;
    const g = new LineSegmentsGeometry().setPositions(list.flatMap(([a, b]) => [...W(a).toArray(), ...W(b).toArray()]));
    const l = new LineSegments2(g, m); l.renderOrder = 3; group.add(l);
  }
  scene.add(group);
  const box = new THREE.Box3().setFromObject(group), c = box.getCenter(new THREE.Vector3());
  orbit.target.copy(c); key.target.position.copy(c); modelCenter = c.clone();
  ember.position.set(0, state.legHeight + state.height * .45, 0);
  ember.intensity = shading === 'draw' || isFire() ? 0 : 35;
  groundDay.opacity = shading === 'draw' ? .07 : .16;
  const floorMesh = group.children.find(o => o.isMesh && o.userData.key === '5');
  applyNight(floorMesh ? new THREE.Box3().setFromObject(floorMesh) : box);
  const size = box.getSize(new THREE.Vector3()).length();
  if (!fitted || (kadr.auto && (size > fitSize * 1.12 || size < fitSize * .7))) { fitSize = size; fitted = true; if (!kadr.auto) kadr.auto = true; dopasuj(); }
  needsRender = true;
}

let fitSize = 1000;
function fit(size) {
  fitSize = size; fitted = true; resize();
}
function resize() {
  if (view === 'decor') {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    const wpp = fitSize * 1.02 / Math.min(w, h);
    renderer.setSize(w, h, false);
    edgeMat.resolution.set(w, h); weldMat.resolution.set(w, h); bendMat.resolution.set(w, h);
    camera.left = -w / 2 * wpp; camera.right = w / 2 * wpp; camera.top = h / 2 * wpp; camera.bottom = -h / 2 * wpp;
    camera.updateProjectionMatrix(); needsRender = true; return;
  }
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  const canvasH = canvas.clientHeight || h;
  renderer.setSize(w, canvasH, false);
  edgeMat.resolution.set(w, canvasH); weldMat.resolution.set(w, canvasH); bendMat.resolution.set(w, canvasH);
  if (kadr.auto) { if (view === 'flat' && group && model) { rebuildScene(); return; } dopasuj(); }   // rozkrój układa się od nowa do nowego okna
  ustawKadr();
}
function setCam(kind) {
  const dirs = { iso: [1, .75, 1.15], front: [0, .12, 1], top: [0, 1, .001], bottom: [0, -1, .001], start: [1, .37, 1.12] };   // start: niski widok na narożnik (projekt startowy)
  const d = new THREE.Vector3(...dirs[kind]).normalize();
  camera.position.copy(orbit.target).addScaledVector(d, 5000); camera.zoom = 1; camera.updateProjectionMatrix();
  orbit.update(); kadr.auto = true; dopasuj(); needsRender = true;
}

var needsRender = true; let flickT = 0;
orbit.addEventListener('change', () => { needsRender = true; });
// PROSTY: po obrocie model znów wypełnia podgląd (dopóki nikt ręcznie nie przybliżał ani nie przesuwał)
// (v5) po pierwszym obrocie / przybliżeniu / przesunięciu widok należy do użytkownika – nic samo nie zmienia skali
orbit.addEventListener('start', () => { kadr.auto = false; });
canvas.addEventListener('wheel', () => { kadr.auto = false; }, { passive: true, capture: true });
// przesuwanie kadru: Shift + przeciągnięcie, prawy / środkowy przycisk; w rozkroju zwykłe przeciągnięcie
{
  let pr = null;
  canvas.addEventListener('pointerdown', e => {
    if (view === 'decor') return;
    if (!(e.shiftKey || e.button === 1 || e.button === 2 || (view === 'flat' && e.button === 0))) return;
    pr = { x: e.clientX, y: e.clientY, kx: kadr.x, ky: kadr.y, ruch: false };
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (!pr) return;
    const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
    if (!pr.ruch && Math.hypot(dx, dy) < 4) return;
    pr.ruch = true; kadr.auto = false;
    const k = kadr.wpp / camera.zoom;
    kadr.x = pr.kx - dx * k; kadr.y = pr.ky + dy * k; ustawKadr();
  });
  const koniec = () => { pr = null; };
  canvas.addEventListener('pointerup', koniec); canvas.addEventListener('pointercancel', koniec);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}
(function loop() {
  requestAnimationFrame(loop);
  orbit.update();
  // z dołu cień na podłodze zasłaniałby model — podłoga tylko, gdy patrzymy z góry
  ground.visible = view !== 'flat' && camera.position.y > 0;
  // ogień migocze ok. 25 razy na sekundę (cienie się nie przeliczają – tylko jasność i płomienie)
  if (isFire()) { const t = performance.now() / 1000; if (t - flickT > .04) { flickT = t; fire.flicker(t); zarMat.opacity = (isNight() ? .42 : .26) * (0.9 + 0.1 * Math.sin(t * 2.3) * Math.sin(t * 0.9)); needsRender = true; } }
  if (showMale && view !== 'decor') { const o = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(performance.now() / 160)); if (Math.abs(o - maleMat.opacity) > 0.04) { maleMat.opacity = maleLineMat.opacity = o; needsRender = true; } }
  if (needsRender) { renderer.render(scene, camera); needsRender = false; }
})();
new ResizeObserver(resize).observe(stage);
new ResizeObserver(() => { if (view === 'decor') resize(); }).observe(canvas);

function rebuildFlat() {
  const mat = drawMat; // rozkrój zawsze jako rysunek
  const P = packToView(model.parts);
  for (const it of P.pl) {
    // y w dół jak na arkuszu: odbijamy, żeby rozkrój wyglądał tak jak w DXF
    const toV = ([x, y]) => new THREE.Vector2(x - it.b.minX + it.x, (it.b.maxY - y) + it.y);
    const outer = tessellate(it.part.outline, 12).map(toV);
    const holes = (it.part.holes || []).map(h => tessellate(h, 8).map(toV));
    const shp = new THREE.Shape(outer);
    shp.holes = holes.map(h => new THREE.Path(h));
    const geo = new THREE.ExtrudeGeometry(shp, { depth: it.part.t, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(Math.PI / 2);           // płasko na „stole”, grubość w dół
    geo.translate(-P.W / 2, 0, -P.H / 2);
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.userData.key = String(it.key).split('+')[0]; group.add(mesh);
    const eg = plateEdges([outer, ...holes], it.part.t); eg.rotateX(Math.PI / 2); eg.translate(-P.W / 2, 0, -P.H / 2);
    group.add(new THREE.LineSegments(eg, lineMat));
    // podpis: otwarte linie cięcia na wierzchu
    if ((it.part.lines || []).length) {
      const pos = [];
      for (const l of it.part.lines) for (let i = 1; i < l.length; i++) {
        const A = toV([l[i - 1].x, l[i - 1].y]), B = toV([l[i].x, l[i].y]);
        pos.push(A.x - P.W / 2, 0.3, A.y - P.H / 2, B.x - P.W / 2, 0.3, B.y - P.H / 2);
      }
      group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), lineMat));
    }
    if (showMale && (it.part.male || []).length) {
      const pts = [], seg = [];
      for (const h of it.part.male) {
        let cx = 0, cy = 0; h.forEach(q => { cx += q.x; cy += q.y; }); const c = toV([cx / h.length, cy / h.length]);
        pts.push(c.x - P.W / 2, 1, c.y - P.H / 2);
        for (let i = 0; i < h.length; i++) { const A = toV([h[i].x, h[i].y]), B = toV([h[(i + 1) % h.length].x, h[(i + 1) % h.length].y]); seg.push(A.x - P.W / 2, 1, A.y - P.H / 2, B.x - P.W / 2, 1, B.y - P.H / 2); }
      }
      const Pp = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), maleMat); Pp.renderOrder = 5; group.add(Pp);
      const Ll = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)), maleLineMat); Ll.renderOrder = 5; group.add(Ll);
    }
    // linie gięcia — przerywane, na wierzchu
    for (const [a, b] of it.part.folds || []) {
      const A = toV([a.x, a.y]), B = toV([b.x, b.y]);
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(A.x - P.W / 2, 0.5, A.y - P.H / 2), new THREE.Vector3(B.x - P.W / 2, 0.5, B.y - P.H / 2)]);
      const l = new THREE.Line(g, foldMat); l.computeLineDistances(); group.add(l);
    }
  }
  scene.add(group);
  flatBox = { w: P.W, h: P.H };
  orbit.target.set(0, 0, 0); key.target.position.set(0, 0, 0);
  ember.intensity = 0;
  applyNight();
  camera.position.set(0, 5000, .001); orbit.update();
  if (kadr.auto) dopasuj(); else ustawKadr();
  needsRender = true;
}

// ---------------- widok, wykończenie, kamera ----------------
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  if (t.dataset.view === view) return;
  if (t.dataset.view !== 'model' && view === 'model') modelLook = { cam: camera.position.clone(), zoom: camera.zoom, kadr: { ...kadr } };
  const was = view;
  view = t.dataset.view;
  setDecorView(view === 'decor');
  document.querySelectorAll('.tab').forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
  // rozkrój: tylko przybliżanie i przesuwanie, bez obracania; przyciski kamery wyłączone, ale na swoim miejscu
  // rozkrój: stały widok z góry, zawsze jako rysunek — przyciski wyglądu i kamery wyłączone, ale na swoich miejscach
  const flat = view === 'flat';
  orbit.enableRotate = !flat; orbit.enableZoom = true; orbit.enablePan = false;
  kadr.auto = true; camera.zoom = 1;
  document.querySelectorAll('[data-cam], #look button, #shading button').forEach(b => b.disabled = flat);
  $('stageHint').textContent = flat ? 'Przeciągnij – przesuń · kółko – przybliż · kliknij element, aby go zmienić' : 'Przeciągnij – obrót · Shift + przeciągnij – przesuń · kółko – przybliż · kliknij ściankę, aby ją zmienić';
  renderFinishChips(); syncLook(); rebuildScene();
  if (view === 'decor' && was !== 'decor') { resize(); setCam('iso'); }
  if (view === 'model' && modelLook && modelLook.cam) {
    camera.position.copy(modelLook.cam); orbit.update();
    if (modelLook.kadr && !modelLook.kadr.auto) { Object.assign(kadr, modelLook.kadr); camera.zoom = modelLook.zoom; ustawKadr(); } else dopasuj();
  }
  track('tab', { value: view });
}));
$('finish').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  shading = 'real'; setFinish(b.dataset.finish); syncLook(); rebuildScene();
  track('finish', { value: finish });
});
// Jeden rząd „wyglądu”: Rysunek / Surowa / Nalot / Czarny mat (wyklucza się), obok przełączniki Krawędzie i X-ray.
function syncLook() {
  $('look').querySelector('[data-shade=draw]').classList.toggle('active', shading === 'draw');
  $('finish').querySelectorAll('button').forEach(x => x.classList.toggle('active', shading === 'real' && x.dataset.finish === finish));
  $('shading').querySelector('[data-shade=edges]').classList.toggle('active', showEdges);
  $('shading').querySelector('[data-shade=xray]').classList.toggle('active', xray);
  $('shading').querySelector('[data-shade=weld]').classList.toggle('active', showWeld);
  $('shading').querySelector('[data-shade=bend]').classList.toggle('active', showBend);
  $('shading').querySelector('[data-shade=fire]').classList.toggle('active', fireOn);
  $('shading').querySelector('[data-shade=night]').classList.toggle('active', fireOn && fireNight);
  $('shading').querySelector('[data-shade=night]').disabled = !fireOn || view === 'flat';
  // w trybie Rysunek krawędzie są zawsze — przycisk wyłączony, ale zostaje na miejscu
  $('shading').querySelector('[data-shade=edges]').disabled = shading === 'draw' || view === 'flat';
}
$('look').querySelector('[data-shade=draw]').addEventListener('click', () => { shading = 'draw'; syncLook(); rebuildScene(); track('shading', { value: 'draw' }); });
$('shading').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.shade;
  if (k === 'xray') xray = !xray; else if (k === 'fire') fireOn = !fireOn; else if (k === 'night') fireNight = !fireNight; else if (k === 'weld') showWeld = !showWeld; else if (k === 'bend') showBend = !showBend; else showEdges = !showEdges;
  syncLook(); rebuildScene();
  track('shading', { value: b.dataset.shade });
});
// widok użytkownika: zapamiętany przed każdym przyciskiem widoku – „↩” do niego wraca (i z powrotem)
let camPrev = null;
const camStan = () => ({ p: camera.position.clone(), t: orbit.target.clone(), z: camera.zoom, k: { ...kadr } });
function camWroc() {
  if (!camPrev) return; const now = camStan(), c = camPrev; camPrev = now;
  camera.position.copy(c.p); orbit.target.copy(c.t); camera.zoom = c.z; if (c.k) Object.assign(kadr, c.k); orbit.update(); ustawKadr();
}
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => { track('widok', { k: b.dataset.cam }); camPrev = camStan(); $('camBack').disabled = false; setCam(b.dataset.cam); }));
$('camBack').addEventListener('click', camWroc);

// ---------------- akcje ----------------
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
$('reset').addEventListener('click', () => { state = ogranicz({ ...DEFAULTS, ...START }); setFinish('mill'); fitted = false; update(); setCam('iso'); toast('Przywrócono ustawienia początkowe'); });
$('copyLink').addEventListener('click', async () => {
  track('copy_link');
  try { await navigator.clipboard.writeText(location.href); toast('Link z Twoją konfiguracją skopiowany'); }
  catch { toast('Skopiuj adres z paska przeglądarki'); }
});
function saveDxf() {
  try {
    const dxf = buildDxf(model);
    const url = URL.createObjectURL(new Blob([dxf], { type: 'application/dxf' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `ogimora-palenisko-${code}.dxf` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('note').textContent = 'Gotowe: mm, skala 1:1, tylko kontury do cięcia. Strona zewnętrzna do góry.';
    $('note').className = 'note ok';
  } catch (err) {
    console.error(err);
    $('note').textContent = 'Nie udało się wygenerować pliku. Odśwież stronę i spróbuj ponownie.';
  }
}

// ---------------- projekty ----------------
// Dwa miejsca zapisu, jedna logika:
//   • PRZEGLĄDARKA – projekt = nazwa + wersje (v1, v2…). „☆ Zapisz wersję” (Ctrl+S) dopisuje wersję.
//     Bieżąca praca i tak zapisuje się sama (po ponownym otwarciu strony wraca), wersje to punkty kontrolne.
//   • PLIK – „Pobierz projekt” = cały projekt (wszystkie wersje) w pliku <nazwa>_v<N>_<data>.ogimora.json;
//     „Wczytaj projekt” dokłada go do listy (te same wersje się nie dublują) i otwiera ostatnią wersję.
// Zmiana nazwy projektu z wersjami = nowy projekt (kopia bieżącego stanu jako v1).
const PROJ = 'ogi_projekty', PROJ_CUR = 'ogi_projekt_cur';
const nowyId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const loadProj = () => {
  let list = null; try { list = JSON.parse(localStorage.getItem(PROJ) || 'null'); } catch {}
  if (!list) {                                             // przeniesienie starej listy „Zapisane”
    let old = []; try { old = JSON.parse(localStorage.getItem('ogi_saved') || '[]'); } catch {}
    list = old.length ? [{ id: nowyId(), nazwa: 'Zapisane wcześniej', wersje: old.map(x => typeof x === 'string' ? { code: x, decor: null } : x).map((x, i) => ({ t: Date.now() - i * 1000, code: x.code, decor: x.decor })) }] : [];
  }
  // numery wersji (starsze zapisy ich nie miały): najstarsza = v1
  list.forEach(p => { const n = p.wersje.length; p.wersje.forEach((w, i) => { if (!w.nr) w.nr = n - i; }); });
  return list;
};
const storeProj = list => { try { localStorage.setItem(PROJ, JSON.stringify(list)); } catch { toast('Pamięć przeglądarki pełna – pobierz projekt do pliku'); } renderSaved(); };
let projCur = (() => { try { return localStorage.getItem(PROJ_CUR) || null; } catch { return null; } })();
let nazwaRobocza = (() => { try { return localStorage.getItem('ogi_projekt_nazwa') || ''; } catch { return ''; } })();   // nazwa przed pierwszym zapisem
const setCur = id => { projCur = id; try { localStorage.setItem(PROJ_CUR, id || ''); } catch {} };
const decorSig = d => (d && wz.decorCount(d) ? JSON.stringify(d.el) : '');
const currentEntry = () => { const d = wz.decorData(); return { code, decor: wz.decorCount(d) ? d : null }; };
const sameEntry = (a, b) => a && b && a.code === b.code && decorSig(a.decor) === decorSig(b.decor);
const kiedy = t => { const d = new Date(t), n = new Date(); const hm = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === n.toDateString() ? 'dziś ' + hm : d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) + ' ' + hm; };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const curProj = (list = loadProj()) => list.find(p => p.id === projCur);
let projOtwarty = null;
function renderSaved() {
  const list = loadProj(), cur = curProj(list);
  $('savedCount').textContent = list.length;
  const ost = cur && cur.wersje[0], zapisane = ost && sameEntry(ost, currentEntry());
  $('saveFav').textContent = zapisane ? '★ Zapisano' : '☆ Zapisz wersję';
  // nagłówek: nazwa + wersja (gwiazdka = zmiany od ostatniej zapisanej wersji)
  if ($('pjNameIn').hidden) $('pjNameBtn').textContent = cur ? cur.nazwa : (nazwaRobocza || 'Nowy projekt');
  $('pjVer').textContent = ost ? `v${ost.nr}${zapisane ? '' : ' •'}` : 'niezapisany';
  $('pjVer').title = ost ? (zapisane ? `Wersja ${ost.nr} z ${kiedy(ost.t)}` : `Zmiany od wersji ${ost.nr} (${kiedy(ost.t)}) – niezapisane`) : 'Projekt nie ma jeszcze zapisanej wersji';
  $('pjVer').classList.toggle('dirty', !zapisane);
  const pop = $('savedPop');
  pop.innerHTML = `<div class="pj-head"><span>Projekty w tej przeglądarce</span><button type="button" class="pj-new" title="Zacznij nowy projekt (obecny zostaje na liście)">+ Nowy</button></div>` +
    (list.length ? list.map(p => {
      const on = p.id === projCur, otw = projOtwarty === p.id;
      return `<div class="pj${on ? ' on' : ''}"><button class="pj-load" data-p="${p.id}" title="Wczytaj ostatnią wersję">${esc(p.nazwa)} <small>v${p.wersje[0] ? p.wersje[0].nr : 0} · ${kiedy(p.wersje[0] ? p.wersje[0].t : 0)}</small></button>` +
        `<button class="pj-v" data-p="${p.id}" title="Wersje">${p.wersje.length} ${otw ? '▾' : '▸'}</button><button class="pj-del" data-p="${p.id}" title="Usuń projekt">✕</button></div>` +
        (otw ? `<div class="pj-ws">${p.wersje.map((w, i) => `<div class="pj-w"><button class="pj-wl" data-p="${p.id}" data-i="${i}">v${w.nr} · ${kiedy(w.t)}${w.decor ? ' · wzory' : ''}</button><button class="pj-wd" data-p="${p.id}" data-i="${i}" title="Usuń wersję">✕</button></div>`).join('')}</div>` : '');
    }).join('') : '<div class="empty">Brak zapisanych projektów. „☆ Zapisz wersję” zapisuje kształt i wzory jako kolejną wersję.</div>') +
    '<p class="pj-hint">Wersje są tylko w tej przeglądarce. Żeby mieć je w pliku (kopia, inny komputer) – „Pobierz projekt”.</p>';
}
let isLocal = false;
/** Nowa wersja bieżącego projektu (cicho = bez komunikatu; zwraca projekt). */
async function zapiszWersje(cicho = false) {
  const list = loadProj(), cur = currentEntry();
  let p = curProj(list);
  if (!p) { p = { id: nowyId(), nazwa: nazwaRobocza || `Projekt ${list.length + 1}`, wersje: [] }; list.unshift(p); setCur(p.id); }
  if (p.wersje[0] && sameEntry(p.wersje[0], cur)) { if (!cicho) toast(`Bez zmian od v${p.wersje[0].nr}`); return p; }
  const nr = (p.wersje[0] ? p.wersje[0].nr : 0) + 1;
  p.wersje.unshift({ nr, t: Date.now(), ...cur, parametry: { ...state } }); p.wersje = p.wersje.slice(0, 30);
  list.splice(list.indexOf(p), 1); list.unshift(p);
  storeProj(list);
  track('save', { saved: list.length, decor: cur.decor ? wz.decorCount(cur.decor) : 0 });
  if (!cicho) toast(`Zapisano „${p.nazwa}” v${nr}`);
  if (isLocal) fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name: p.nazwa, summary: '', wzory: cur.decor ? await pack(cur.decor).catch(() => '') : '' }) }).catch(() => {});
  return p;
}
$('saveFav').addEventListener('click', () => zapiszWersje());
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); zapiszWersje(); } });
// nazwa projektu w nagłówku: klik → pole tekstowe; Enter/wyjście zatwierdza, Esc anuluje
$('pjNameBtn').addEventListener('click', () => { const i = $('pjNameIn'); i.value = $('pjNameBtn').textContent === 'Nowy projekt' && !curProj() ? '' : $('pjNameBtn').textContent; i.placeholder = 'nazwa projektu'; i.hidden = false; $('pjNameBtn').hidden = true; i.focus(); i.select(); });
function nazwaKoniec(ok) {
  const i = $('pjNameIn'); if (i.hidden) return;
  i.hidden = true; $('pjNameBtn').hidden = false;
  const v = i.value.trim().slice(0, 40); if (!ok || !v) { renderSaved(); return; }
  const list = loadProj(), p = curProj(list);
  if (!p) { nazwaRobocza = v; try { localStorage.setItem('ogi_projekt_nazwa', v); } catch {} renderSaved(); return; }
  if (v === p.nazwa) { renderSaved(); return; }
  if (!p.wersje.length) { p.nazwa = v; storeProj(list); return; }
  // projekt ma wersje: nowa nazwa = nowy projekt, bieżący stan jako v1 (stary zostaje bez zmian)
  const q = { id: nowyId(), nazwa: v, wersje: [{ nr: 1, t: Date.now(), ...currentEntry(), parametry: { ...state } }] };
  list.unshift(q); setCur(q.id); storeProj(list);
  toast(`Nowy projekt „${v}” (v1) – „${p.nazwa}” zostaje na liście`);
}
$('pjNameIn').addEventListener('keydown', e => { if (e.key === 'Enter') nazwaKoniec(true); else if (e.key === 'Escape') nazwaKoniec(false); });
$('pjNameIn').addEventListener('blur', () => nazwaKoniec(true));
$('savedBtn').addEventListener('click', e => { e.stopPropagation(); renderSaved(); const p = $('savedPop'); p.classList.toggle('hidden'); $('savedBtn').setAttribute('aria-expanded', !p.classList.contains('hidden')); });
document.addEventListener('click', e => { if (!e.target.closest('#savedPop')) $('savedPop').classList.add('hidden'); });
$('saveFileBtn').addEventListener('click', saveFile);
$('loadFile').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  f.text().then(t => { try { sessionStorage.setItem('ogi_plik', JSON.stringify({ nazwa: f.name, tekst: t })); } catch {} idzDo('?plik=1'); });
  e.target.value = '';
});
$('savedPop').addEventListener('click', e => {
  e.stopPropagation();
  const b = e.target.closest('button'); if (!b) return;
  const list = loadProj(), p = list.find(q => q.id === b.dataset.p);
  if (b.classList.contains('pj-new')) { setCur(null); nazwaRobocza = ''; try { localStorage.removeItem('ogi_projekt_nazwa'); } catch {} renderSaved(); $('savedPop').classList.add('hidden'); $('pjNameBtn').click(); return; }
  if (!p) return;
  if (b.classList.contains('pj-v')) { projOtwarty = projOtwarty === p.id ? null : p.id; renderSaved(); return; }
  if (b.classList.contains('pj-del')) { if (!confirm(`Usunąć projekt „${p.nazwa}” (${p.wersje.length} wersji) z tej przeglądarki?`)) return; list.splice(list.indexOf(p), 1); if (projCur === p.id) setCur(null); storeProj(list); return; }
  if (b.classList.contains('pj-wd')) { p.wersje.splice(+b.dataset.i, 1); if (!p.wersje.length) list.splice(list.indexOf(p), 1); storeProj(list); return; }
  const w = b.classList.contains('pj-wl') ? p.wersje[+b.dataset.i] : p.wersje[0]; if (!w) return;
  applyProject({ kod: w.code, parametry: w.parametry, zdobienia: w.decor || { el: {} } }); setCur(p.id); track('saved_loaded');
  renderSaved(); $('savedPop').classList.add('hidden'); toast(`Wczytano „${p.nazwa}” v${w.nr}`);
});

// ---------------- okno pobierania = moje badanie rynku ----------------
// Jedno małe okno: 2–3 pytania jednym kliknięciem, uwagi, lista kształtów (ten + zapisane).
// „Pobierz” jest aktywne po zaznaczeniu czegokolwiek albo wpisaniu uwagi.
// Odpowiedzi pamiętamy w tej przeglądarce — przy kolejnym pobraniu są już zaznaczone (jedno kliknięcie).
// Kanał (skąd przyszedł) i ruchy suwaków zbierają się same, bez pytania.
const answers = (() => { try { return JSON.parse(localStorage.getItem('ogi_answers') || '{}'); } catch { return {}; } })();
const baseInfo = () => ({ mat: MAT_KEYS[state.mat], price: Math.round(estimate(baseModel, MAT_KEYS[state.mat]).net), decor: Math.round(decorCost(model, MAT_KEYS[state.mat]).cost) });
function dlSync() {
  document.querySelectorAll('#dl [data-q]').forEach(box => box.querySelectorAll('button')
    .forEach(b => b.classList.toggle('active', answers[box.dataset.q] === b.dataset.a)));
  // pytanie o licencję zawsze na miejscu (bez skakania okna) — aktywne tylko przy „Na sprzedaż”
  $('dlLic').classList.toggle('off', answers.use !== 'sell');
  $('dlLic').querySelectorAll('button').forEach(b => { b.disabled = answers.use !== 'sell'; });
  $('dlGo').disabled = !($('dlZgoda') && $('dlZgoda').checked);   // PROSTY: bez potwierdzenia ostrzeżenia nie ma pobrania
  $('dlHint').textContent = $('dlGo').disabled ? (LANG === 'en' ? 'First tick the box above' : 'Najpierw zaznacz pole powyżej') : `${model.parts.reduce((s, p) => s + p.qty, 0)} elementów · gotowy do cięcia CNC`;
}
document.querySelectorAll('#dl [data-q]').forEach(box => box.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const q = box.dataset.q;
  answers[q] = answers[q] === b.dataset.a ? undefined : b.dataset.a;
  if (q === 'use' && answers.use !== 'sell') delete answers.license;
  dlSync();
}));
$('dlNotes').addEventListener('input', dlSync);
$('dl').addEventListener('change', e => { if (e.target.id === 'dlZgoda') dlSync(); });
$('download').addEventListener('click', () => {
  { const b = PR && PR.blokada(); if (b) { $('note').textContent = b; $('note').className = 'note'; toast(b); return; } }   // PROSTY
  const codes = [code, ...loadProj().map(p => p.wersje[0] && p.wersje[0].code).filter(Boolean).filter(c => c !== code)];
  $('dlCodes').value = codes.join('\n');
  const dzis = new Date().toISOString().slice(0, 10);
  let byl = ''; try { byl = localStorage.getItem('ogi_ankieta_dzien') || ''; } catch {}
  // PROSTY: okno z ostrzeżeniem otwiera się zawsze; pytania ankiety tylko raz dziennie
  $('dl').classList.toggle('bez-ankiety', byl === dzis);
  try { localStorage.setItem('ogi_ankieta_dzien', dzis); } catch {}
  dlSync(); track('download_open');
  $('dl').showModal();
});
$('dlX').addEventListener('click', () => { track('download_cancel'); $('dl').close(); });
$('dlGo').addEventListener('click', () => {
  const notes = $('dlNotes').value.trim().slice(0, 2000);
  const codes = $('dlCodes').value.split(/\s+/).filter(Boolean).slice(0, 50);
  if (!$('dl').classList.contains('bez-ankiety') && (answers.use || answers.pay || answers.license || notes)) track('survey', { use: answers.use, license: answers.license, pay: answers.pay, notes });
  try { localStorage.setItem('ogi_answers', JSON.stringify(answers)); } catch {}
  $('dlNotes').value = '';
  $('dl').close();
  track('download', baseInfo());
  saveDxf();
});

// Dwa widoki izometryczne do PDF: z przodu-z prawej od góry oraz z tyłu-z lewej od dołu – razem widać
// wszystkie boki z zewnątrz, dno z obu stron i nogi. Zawsze jako rysunek (biały + czarne krawędzie).
function isoSnapshots() {
  const keep = { view, shading, xray, fireOn, cam: camera.position.clone(), zoom: camera.zoom, target: orbit.target.clone() };
  view = 'model'; shading = 'draw'; xray = false; fireOn = false;
  rebuildScene();
  const groundWas = ground.visible; ground.visible = false;
  const W = 1600, H = 1100, out = [];
  renderer.setSize(W, H, false);
  const box = new THREE.Box3().setFromObject(group), c = box.getCenter(new THREE.Vector3());
  const pts = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
  // 2 duże widoki od góry z przeciwległych stron + mały widok w „pudełku” (gabaryt) na kartkę z rozkrojem
  const shots = [{ dir: [1, 0.7, 1.15] }, { dir: [-1, 0.7, -1.15] }, { dir: [1, 0.75, 1.15], box: true, W: 1400, H: 1100 }];
  const corner = i => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
  let boxShot = null;
  for (const sh of shots) {
    const dir = sh.dir, Wi = sh.W || W, Hi = sh.H || H;
    renderer.setSize(Wi, Hi, false);
    const d = new THREE.Vector3(...dir).normalize();
    camera.position.copy(c).addScaledVector(d, 5000); camera.up.set(0, 1, 0); camera.lookAt(c); camera.zoom = 1;
    camera.updateMatrixWorld();
    // dopasowanie kadru do rzutu bryły
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const inv = camera.matrixWorldInverse;
    for (const p of pts) { const q = p.clone().applyMatrix4(inv); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const k = Math.max((x1 - x0) / Wi, (y1 - y0) / Hi) * (sh.box ? 1.03 : 1.06), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    camera.left = cx - Wi / 2 * k; camera.right = cx + Wi / 2 * k; camera.top = cy + Hi / 2 * k; camera.bottom = cy - Hi / 2 * k;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const img = renderer.domElement.toDataURL('image/png');
    if (!sh.box) { out.push({ img, w: Wi, h: Hi }); continue; }
    // narożniki gabarytu na obrazku (piksele) + wymiary w cm (three: x, y = wysokość, z)
    const px = [...Array(8).keys()].map(i => { const q = corner(i).project(camera); return [(q.x + 1) / 2 * Wi, (1 - q.y) / 2 * Hi]; });
    const sz = box.getSize(new THREE.Vector3());
    boxShot = { img, w: Wi, h: Hi, px, cm: { x: Math.round(sz.x / 10), y: Math.round(sz.y / 10), z: Math.round(sz.z / 10) } };
  }
  ground.visible = groundWas;
  ({ view, shading, xray, fireOn } = keep);
  camera.position.copy(keep.cam); camera.zoom = keep.zoom; orbit.target.copy(keep.target);
  rebuildScene(); resize(); orbit.update(); needsRender = true;
  return { views: out, box: boxShot };
}
/** Logo smoka (z nagłówka strony) jako PNG do PDF. */
function logoPng() {
  return new Promise(ok => {
    const svgEl = document.querySelector('.brand svg');
    if (!svgEl) return ok(null);
    const src = svgEl.outerHTML.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" fill="#ad1724"');
    const img = new Image();
    img.onload = () => {
      const vb = svgEl.viewBox.baseVal, w = 600, h = Math.round(600 * vb.height / vb.width);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      ok({ img: cv.toDataURL('image/png'), w, h });
    };
    img.onerror = () => ok(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  });
}
$('pdf').addEventListener('click', async () => {
  try {
    $('note').textContent = 'Przygotowuję PDF…';
    track('pdf');
    const { views, box } = isoSnapshots();
    const logo = await logoPng();
    const plan = await buildPdf(model, { views, box, logo, url: 'ogimora.com', code });
    $('note').textContent = `PDF gotowy: skala 1:${plan.N}, ${plan.pages.length + 1} str. A4. Drukuj w skali 100%.`;
    $('note').className = 'note ok';
  } catch (err) { console.error(err); $('note').textContent = 'Nie udało się zrobić PDF (sprawdź internet — biblioteka ładuje się z sieci).'; }
});

$('matchAngle').addEventListener('click', () => { set('footAngle', state.angle); track('match_angle'); interacted(); });
$('price').addEventListener('toggle', e => { if (e.target.open) track('price_details'); }, true);

// Kod: wpisanie / wklejenie kodu od razu ustawia suwaki.
$('codeInput').addEventListener('input', e => {
  const v = e.target.value, d = decode(v), box = e.target.parentElement;
  const clean = v.replace(/[^0-9a-z]/gi, '');
  box.classList.toggle('bad', !d && clean.length >= CODE_LENGTH);
  if (d && encode({ ...state, ...d }) !== code) { state = { ...state, ...d }; setFinish(MATERIALS[MAT_KEYS[state.mat]].finish); update(); track('code_entered'); }
});
$('codeInput').addEventListener('blur', e => { e.target.value = code; e.target.parentElement.classList.remove('bad'); });
$('codeInput').addEventListener('focus', e => e.target.select());

// PROSTY: bez sprawdzania /api/ping (to adres pełnego generatora na komputerze autora – na stronie dawał błąd 404 w konsoli)

// ---------------- widok „Wzory” ----------------
// ---------------- plik projektu ----------------
// Format (schemat 3): { format:'ogimora-projekt', schemat, zapisano, aplikacja, id, nazwa, wersje:[{ nr, t, kod, parametry, zdobienia }] }.
// Zgodność wstecz: zapisujemy PRZEPIS, nie wynik – kod kształtu + te same wartości nazwanymi parametrami
// (gdyby kodowanie kodu się zmieniło, liczą się parametry), wzory jako odwołania do galerii (id) z ustawieniami.
// Starsze pliki przechodzą przez migruj(): schemat 1 = same zdobienia, 2 = { kod, zdobienia }.
// Nieznane pola nowszych plików są ignorowane, brakujące uzupełniają wartości domyślne.
const SCHEMAT = 3, APLIKACJA = '2026-11';
function migruj(o) {
  if (!o || typeof o !== 'object') return null;
  if (o.format === 'ogimora-projekt' && Array.isArray(o.wersje)) return o;                      // schemat 3+
  if (o.kod || o.zdobienia) return { format: 'ogimora-projekt', schemat: 2, nazwa: '', wersje: [{ nr: 1, t: Date.now(), kod: o.kod, parametry: o.parametry, zdobienia: o.zdobienia }] };
  if (o.el) return { format: 'ogimora-projekt', schemat: 1, nazwa: '', wersje: [{ nr: 1, t: Date.now(), kod: null, zdobienia: o }] };
  return null;
}
function projectData() { return { wersja: 2, opis: 'OGIMORA palenisko – projekt (kształt + wzory)', kod: code, parametry: { ...state }, zdobienia: wz.decorData() }; }
function applyProject(obj) {
  if (!obj) { toast('Nie udało się odczytać projektu'); return false; }
  const zd = obj.zdobienia || (obj.el ? obj : null);          // stary plik: same zdobienia
  let ksz = obj.kod ? decode(obj.kod) : null;
  if (!ksz && obj.parametry) ksz = Object.fromEntries(Object.entries(obj.parametry).filter(([k, v]) => k in DEFAULTS && Number.isFinite(+v)).map(([k, v]) => [k, +v]));
  if (obj.kod && !ksz) { toast('Kod kształtu w projekcie jest nieprawidłowy'); return false; }
  if (ksz) { state = { ...state, ...ksz }; setFinish(MATERIALS[MAT_KEYS[state.mat]].finish); }
  if (zd) wz.setDecor(zd);
  model = null; update(); syncLinkDecor();
  return true;
}
const slug = t => (t || 'projekt').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'projekt';
async function saveFile() {
  const p = await zapiszWersje(true);                       // plik zawsze odpowiada zapisanej wersji
  const d = new Date(), z = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  const v = p.wersje[0];
  const plik = { format: 'ogimora-projekt', schemat: SCHEMAT, zapisano: d.toISOString(), aplikacja: APLIKACJA, id: p.id, nazwa: p.nazwa,
    wersje: p.wersje.map(w => ({ nr: w.nr, t: w.t, kod: w.code, parametry: w.parametry || decode(w.code) || null, zdobienia: w.decor || null })) };
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([JSON.stringify(plik, null, 1)], { type: 'application/json' })),
    download: `${slug(p.nazwa)}_v${v.nr}_${stamp}.ogimora.json`,
  });
  document.body.appendChild(a); a.click(); a.remove();
  toast(`Pobrano „${p.nazwa}” v${v.nr} (${p.wersje.length} ${p.wersje.length === 1 ? 'wersja' : p.wersje.length < 5 ? 'wersje' : 'wersji'})`);
}
function wczytajPlik(o, nazwaPliku = '', cicho = false) {
  const P = migruj(o);
  if (!P || !P.wersje.length) { toast('To nie jest plik projektu OGIMORA'); return; }
  if (P.schemat > SCHEMAT) toast('Plik z nowszej wersji strony – wczytuję to, co rozumiem');
  const list = loadProj();
  const nazwa = P.nazwa || nazwaPliku.replace(/(_v\d+)?(_\d{8}-\d{4})?(\.ogimora)?\.json$/i, '') || 'Wczytany projekt';
  let p = P.id && list.find(q => q.id === P.id);
  if (!p) { p = { id: P.id || nowyId(), nazwa, wersje: [] }; list.unshift(p); }
  // dokładamy wersje, których jeszcze nie ma (po czasie zapisu) – bez dublowania
  const byly = new Set(p.wersje.map(w => w.t));
  P.wersje.forEach(w => { if (!byly.has(w.t)) p.wersje.push({ nr: w.nr, t: w.t, code: w.kod || encode({ ...DEFAULTS, ...(w.parametry || {}) }), parametry: w.parametry || null, decor: w.zdobienia || null }); });
  p.wersje.sort((a, b) => b.t - a.t);
  list.splice(list.indexOf(p), 1); list.unshift(p);
  setCur(p.id); storeProj(list);
  const w = p.wersje[0];
  if (applyProject({ kod: w.code, parametry: w.parametry, zdobienia: w.decor || { el: {} } })) {
    if (!cicho) toast(`Wczytano „${p.nazwa}” v${w.nr}`);
    sprawdzWzory(w.decor);
  }
}
/** Wzory z projektu, których nie ma w obecnej galerii (zmieniona strona) – ostrzeżenie zamiast cichego zniknięcia. */
function sprawdzWzory(d) {
  if (!d || !d.el) return;
  wczytajIndeks().then(I => {
    const ids = new Set(I.wzory.map(w => w.id)), brak = new Set();
    Object.values(d.el).forEach(e => (e.items || []).forEach(it => { if (it.id === 'wzor' && it.w && !ids.has(it.w)) brak.add(it.w); }));
    if (brak.size) toast(`Brak w galerii: ${[...brak].slice(0, 3).join(', ')}${brak.size > 3 ? '…' : ''} – te wzory się nie pokażą`);
  }).catch(() => {});
}
// link: wzory dopisywane do adresu po każdej zmianie (spakowane)
let linkT = 0;
function syncLinkDecor() {
  clearTimeout(linkT);
  linkT = setTimeout(async () => {
    const d = wz.decorData(), sig = JSON.stringify(d);
    if (sig === packedFor) return;
    packedFor = sig;
    wzoryParam = wz.decorCount(d) ? await pack(d).catch(() => '') : '';
    writeHash(); renderSaved();
  }, 400);
}
// Twoje projekty (biblioteka w przeglądarce, js/biblioteka.js): bieżący projekt zapisuje się sam.
// Projekt powstaje dopiero przy pierwszej zmianie (samo oglądanie kształtu czy gotowca nie zaśmieca listy).
var autoT = 0, autoReady = false;   // var: writeHash woła autosave już przy starcie
const EN_UI = LANG === 'en';
const cur = { id: null, baza: EN_UI ? 'My design' : 'Mój projekt', zrodlo: '' };
let pierwszyZapis = '';
let BL = null, ZAP = null;          // migawka przy otwarciu (BL) i przy ostatnim zapisie (ZAP)
const nazwaBiez = () => (cur.id && B.pobierz(cur.id)?.nazwa) || cur.podglad || cur.baza;   // podgląd gotowca: „Lucky Stone”; po pierwszej zmianie projekt „Lucky Stone (moja wersja)”
function autosave() {
  if (!autoReady) return;
  clearTimeout(autoT);
  autoT = setTimeout(zapiszTeraz, 800);
}
function zapiszTeraz() {
  clearTimeout(autoT); if (!autoReady) return;
  const p = { ...projectData(), t: Date.now() };
  try { localStorage.setItem('ogip_last', JSON.stringify(p)); } catch {}
  const m = migawka();
  if (!cur.id && m === BL) return;                         // nic nie zmieniono – to jeszcze nie projekt
  let wpis = cur.id && B.pobierz(cur.id);
  if (!wpis) {                                               // pierwsza zmiana: nowy projekt w bibliotece
    cur.id = B.nowyId(); wpis = { id: cur.id, nazwa: B.wolnaNazwa(cur.baza), zrodlo: cur.zrodlo, t: Date.now() };
    const q = new URLSearchParams(location.search); ['projekt', 'nowy', 'plik'].forEach(k => q.delete(k)); q.set('p', cur.id);
    history.replaceState(null, '', location.pathname + '?' + q + location.hash);
    track('projekt_nowy', { z: cur.zrodlo });
    cur.podglad = ''; try { localStorage.removeItem('ogip_rodzaj'); } catch {}
    pierwszyZapis = wpis.nazwa;                             // PROSTY: pierwsza zmiana – projekt dostaje nazwę i trafia na listę
  }
  if (m === ZAP && wpis.thumb) { ustawBiez(); return; }
  B.zapisz({ ...wpis, t: m === ZAP ? wpis.t : Date.now(), kod: code, zdobienia: wz.decorData(), thumb: miniatura() || wpis.thumb || '' });
  ZAP = m; ustawBiez(); pokazNazwe(true);
  if (pierwszyZapis) { toast(EN_UI ? `Saved in this browser as “${pierwszyZapis}” – rename it in the top bar` : `Zapisano w tej przeglądarce jako „${pierwszyZapis}” – nazwę zmienisz na górnym pasku`); pierwszyZapis = ''; }
}
const ustawBiez = () => { try { localStorage.setItem('ogip_biez', cur.id || ''); } catch {} };
/** Mała miniatura z widoku 3D (tylko gdy widać model). */
function miniatura() {
  if (view !== 'model' || document.body.classList.contains('v-decor')) return '';
  try {
    renderer.render(scene, camera);                       // obraz musi być świeży w tej samej chwili co kopia
    const W = 240, c = document.createElement('canvas'); c.width = W; c.height = W;
    const x = c.getContext('2d'); x.fillStyle = '#f3f1ed'; x.fillRect(0, 0, W, W);
    const sw = Math.min(canvas.width, canvas.height * 0.8);   // środek kadru (model jest na środku)
    x.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sw) / 2, sw, sw, 0, 0, W, W);
    const t = c.toDataURL('image/jpeg', 0.8);
    return t.length < 3000 ? '' : t;                         // pusty obraz (np. widok niewidoczny)
  } catch { return ''; }
}
// „Generator” w nawigacji to ta strona – nie wyprowadza na stronę główną
$('obGen').addEventListener('click', e => e.preventDefault());
addEventListener('pagehide', () => { if (autoReady) zapiszTeraz(); });
async function restoreLast() {
  let best = null;
  try { best = JSON.parse(localStorage.getItem('ogi_last') || 'null'); } catch {}
  try { const r = await fetch('/api/autosave'); if (r.ok) { const s = await r.json(); if (s && s.kod && (!best || (s.t || 0) > (best.t || 0))) best = s; } } catch {}
  if (best && best.kod && (best.kod !== code || wz.decorCount(best.zdobienia || {}) !== wz.decorCount())) {
    applyProject(best);
    if (wz.decorCount()) toast(`Przywrócono ostatni projekt (${wz.decorCount()} ${wz.decorCount() === 1 ? 'wzór' : wz.decorCount() < 5 ? 'wzory' : 'wzorów'})`);
  }
}

const wz = initWzory({
  saveFile, loadFile: obj => wczytajPlik(obj),
  male: on => setShowMale(on),
  changed: () => { if (PR) PR.dane(); decorSoon(view === 'decor' ? 60 : 160); syncLinkDecor(); histZapisz(); renderSaved(); },
  undo: () => histKrok(-1), redo: () => histKrok(1), histStan: () => ({ back: H.back.length, fwd: H.fwd.length }),
  select: () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(rebuildScene); },
});
// PROSTY: panel „Wzory” wersji uproszczonej (js/prosty.js) – jeden wzór i napis na ściankę, bez kolizji
function kameraNaScianke(n) {
  if (view !== 'model') return;
  const d = new THREE.Vector3(.42, .5, 1).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (n - 1) * Math.PI / 2);
  camera.position.copy(orbit.target).addScaledVector(d, 5000); orbit.update(); if (kadr.auto) dopasuj(); else needsRender = true;
}
/** Ścianka zwrócona do patrzącego (1 = przód, 2 = prawa, 3 = tył, 4 = lewa). */
function frontowa() {
  const d = camera.position.clone().sub(orbit.target);
  const a = [d.z, d.x, -d.z, -d.x]; return a.indexOf(Math.max(...a)) + 1;
}
var PR = null;
const BYL_STAN = (() => { try { return !!localStorage.getItem('ogip_stan2'); } catch { return false; } })();   // czy ta przeglądarka ma już zapisany stan
PR = initProsty({ wz, model: () => baseModel, set, stan: () => state, ustaw: o => { Object.assign(state, o); update(); interacted(); }, kamera: kameraNaScianke, frontowa, widok: () => view,
  // szybko = w trakcie ruchu suwaka: od razu, bez czekania (liczy się tylko zmieniana ścianka)
  zmiana: (szybko = false) => {
    if (!szybko) { decorSoon(60); syncLinkDecor(); histZapisz(); return; }
    clearTimeout(decorT); ++decTok; liczeWzory(-1);
    applyDecor(); cancelAnimationFrame(raf); raf = requestAnimationFrame(rebuildScene);
  } });
function setDecorView(on) {
  document.body.classList.toggle('v-decor', on);
  ['decor', 'dBar', 'dPanel'].forEach(id => $(id).classList.toggle('hidden', !on));
  $('viewTools').classList.toggle('hidden', on);
  if (on) { $('dMini').appendChild(canvas); wz.refresh(baseModel); }
  else if (canvas.parentElement !== stage) stage.insertBefore(canvas, stage.firstChild);
}
// klik w element na małym modelu = wybór elementu
{
  const ray = new THREE.Raycaster(); let down = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || !group) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const hit = ray.intersectObjects(group.children.filter(o => o.isMesh), false).find(x => x.object.userData.key);
    if (hit && view === 'decor') wz.select(hit.object.userData.key);
    else if (hit && PR) { PR.wybierz(hit.object.userData.key); track('klik_element', { k: view === 'flat' ? 'rozkroj' : '3d' }); }   // PROSTY: klik w ściankę / dno = edycja tego elementu
  });
}

// ---------------- widok: panele Misa/Stopki zwijane, reset do ISO ----------------
try { if (localStorage.getItem('ogi_cards') === 'off') document.body.classList.add('cards-off'); } catch {}
const cardsTxt = () => { $('cardsTgl').textContent = document.body.classList.contains('cards-off') ? 'Pokaż opcje' : 'Schowaj opcje'; };
cardsTxt();
$('cardsTgl').addEventListener('click', () => {
  const off = document.body.classList.toggle('cards-off'); cardsTxt(); track('schowaj_opcje');
  try { localStorage.setItem('ogi_cards', off ? 'off' : 'on'); } catch {}
  resize(); needsRender = true;
});


// ---------------- historia (cofnij / ponów) – kształt i wzory razem ----------------
const H = { back: [], fwd: [], last: null, blokada: false };
const migawka = () => JSON.stringify({ state, decor: wz.decorData() });
let histT = 0;
function histZapisz() {
  if (H.blokada) return;
  clearTimeout(histT);
  histT = setTimeout(() => {
    const m = migawka(); if (m === H.last) return;
    if (H.last) { H.back.push(H.last); if (H.back.length > 30) H.back.shift(); H.fwd = []; }
    H.last = m; histPrzyciski();
  }, 350);
}
function histKrok(dir) {
  clearTimeout(histT); clearTimeout(histUst);
  const cur = migawka(); if (!H.blokada && cur !== H.last && H.last) { H.back.push(H.last); H.fwd = []; H.last = cur; }
  const from = dir < 0 ? H.back : H.fwd, to = dir < 0 ? H.fwd : H.back;
  if (!from.length) return;
  to.push(H.last); H.last = from.pop();
  const o = JSON.parse(H.last);
  H.blokada = true;
  state = { ...state, ...o.state }; setFinish(MATERIALS[MAT_KEYS[state.mat]].finish);
  wz.setDecor(o.decor); model = null; update(); syncLinkDecor();
  histPrzyciski();
  // PROSTY: po cofnięciu wzory układają się od nowa (drobne różnice w liczbach). Dopiero ustalony stan staje się „ostatnim”,
  // inaczej następne cofnięcie wracało w to samo miejsce, a „ponów” znikało.
  histUst = setTimeout(() => { H.last = migawka(); H.blokada = false; histPrzyciski(); }, 1100);
}
var histUst = 0;
function histPrzyciski() { $('histUndo').disabled = !H.back.length; $('histRedo').disabled = !H.fwd.length; }
$('histUndo').addEventListener('click', () => histKrok(-1));
$('histRedo').addEventListener('click', () => histKrok(1));
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); histKrok(e.shiftKey ? 1 : -1); }
});
$('clearDecor').addEventListener('click', () => { wz.setDecor({ el: {}, puste: true }); model = null; update(); syncLinkDecor(); histZapisz(); toast('Usunięto wszystkie wzory (↶ cofa)'); });

setFinish(finish);
syncLook();
update();
syncLinkDecor();
// ---------------- start: który projekt otworzyć ----------------
// ?p=<id> – projekt z biblioteki · ?nowy=1 – pusty · ?projekt=… – kształt albo gotowiec · ?plik=1 – plik wczytany na stronie startowej
// #kod=…&wzory=… – link · bez niczego – ostatnio otwarty projekt z biblioteki
const startQ = new URLSearchParams(location.search);
const startProjekt = startQ.get('projekt'), startNowy = startQ.has('nowy'), startPlik = startQ.has('plik');
let startP = startQ.get('p');
const KSZ_NAZWY = EN_UI ? { standard: 'Classic', 'bez-stopek': 'Pyramid', turtle: 'Turtle', proste: 'Box', 'proste-stopki': 'Straight footed' } : { standard: 'Klasyczne', 'bez-stopek': 'Piramida', turtle: 'Turtle', proste: 'Proste', 'proste-stopki': 'Proste ze stopkami' };
function gotowe(nowy = false) {
  autoReady = true; BL = nowy ? '' : migawka(); ZAP = cur.id ? migawka() : null;
  pokazNazwe(); if (cur.id) ustawBiez(); autosave();
}
// PROSTY: projekty w tej przeglądarce (js/biblioteka.js). Kolejność: link (#kod…&wzory…) → plik (?plik=1) → nowy (?nowy=start|czysty)
// → projekt z listy (?p=id albo ostatnio otwarty) → ostatni stan → projekt startowy.
let widokNaStart = '';   // projekt startowy / czysty otwiera się w swoim widoku (zapisane projekty: rysunek, izometria)
const NAZWY_P = EN_UI ? { start: 'Starter design', czysty: 'Blank design' } : { start: 'Projekt startowy', czysty: 'Projekt czysty' };
const czyscAdres = q => history.replaceState(null, '', location.pathname + (q || '') + location.hash);
/** Stan ustalony dopiero po wczytaniu i ułożeniu wzorów – wtedy robimy migawkę „bez zmian”. */
const poUlozeniu = () => Promise.resolve(PR.gotowy).then(() => new Promise(r => setTimeout(r, 1400))).then(() => gotowe());
const zListy = !!(startP && B.pobierz(startP)) || startPlik || startNowy;   // własny projekt, plik albo „od nowa” mają pierwszeństwo przed linkiem w adresie
// adres z kodem jest „swój”, gdy to ten sam kształt, który ta przeglądarka zapisała ostatnio (odświeżenie strony); inaczej to cudzy link
let swojAdres = !hadCode; try { const o = JSON.parse(localStorage.getItem('ogip_last') || 'null'); if (hadCode && o && o.kod === new URLSearchParams(location.hash.slice(1)).get('kod')) swojAdres = true; } catch {}
if (hashWzory && !zListy && !swojAdres) unpack(hashWzory).then(d => { wz.setDecor(d); model = null; update(); syncLinkDecor(); }).catch(() => {}).finally(poUlozeniu);
else {
  let otwarty = false;
  if (startPlik) {
    try {
      const o = JSON.parse(sessionStorage.getItem('ogi_plik') || 'null'); sessionStorage.removeItem('ogi_plik');
      const P = o && migruj(JSON.parse(o.tekst)), w = P && P.wersje.slice().sort((x, y) => (y.t || 0) - (x.t || 0))[0];
      if (w && applyProject({ kod: w.kod, parametry: w.parametry, zdobienia: w.zdobienia || { el: {} } })) {
        cur.id = B.nowyId(); otwarty = true;
        const nazwa = B.wolnaNazwa((P.nazwa || String(o.nazwa || '').replace(/(_v\d+)?(_\d{8}-\d{4})?(\.ogimora)?\.json$/i, '') || (EN_UI ? 'Opened design' : 'Wczytany projekt')).slice(0, 40));
        B.zapisz({ id: cur.id, nazwa, t: Date.now(), kod: code, zdobienia: w.zdobienia || { el: {} }, thumb: '', zrodlo: 'plik' });
        toast((EN_UI ? 'Opened “' : 'Wczytano „') + nazwa + (EN_UI ? '”' : '”'));
      } else toast(EN_UI ? 'This is not an OGIMORA design file' : 'To nie jest plik projektu OGIMORA');
    } catch { toast(EN_UI ? 'Could not read the file' : 'Nie udało się odczytać pliku'); }
    czyscAdres(otwarty ? '?p=' + cur.id : '');
  } else if (startNowy) {
    const rodzaj = startQ.get('nowy') === 'czysty' ? 'czysty' : 'start';
    state = ogranicz({ ...DEFAULTS, ...START }); setFinish('mill'); PR.reset(rodzaj); model = null; update();
    try { localStorage.setItem('ogip_rodzaj', rodzaj); localStorage.setItem('ogip_biez', ''); } catch {}
    cur.podglad = NAZWY_P[rodzaj]; otwarty = true; czyscAdres(''); widokNaStart = rodzaj;
  }
  if (!otwarty) {
    let id = startP; if (!id && swojAdres) { try { id = localStorage.getItem('ogip_biez') || ''; } catch {} }
    const w = id && B.pobierz(id);
    if (w && applyProject({ kod: w.kod, zdobienia: w.zdobienia || { el: {} } })) { cur.id = w.id; if (!startP) czyscAdres('?p=' + w.id); }
    else {
      if (startP) czyscAdres('');
      if (!hadCode) { try { const o = JSON.parse(localStorage.getItem('ogip_last') || 'null'); const k = o && o.kod && decode(o.kod); if (k) { state = ogranicz({ ...state, ...k }); setFinish(MATERIALS[MAT_KEYS[state.mat]].finish); model = null; update(); } } catch {} }
      let rodzaj = ''; if (swojAdres) { try { rodzaj = localStorage.getItem('ogip_rodzaj') || ''; } catch {} }
      if (!rodzaj && !BYL_STAN && !hadCode) { rodzaj = 'start'; try { localStorage.setItem('ogip_rodzaj', 'start'); } catch {} }   // pierwsza wizyta: projekt startowy
      if (NAZWY_P[rodzaj]) { cur.podglad = NAZWY_P[rodzaj]; widokNaStart = rodzaj; }
    }
  }
  pokazNazwe(); poUlozeniu();
}

// ---------------- nazwa projektu ▾: zmiana nazwy, ostatnie projekty, nowy, duplikuj, plik ----------------
function pokazNazwe(zapisano = false) {
  const n = nazwaBiez(), el = $('pjMenuBtn').querySelector('.pj-n');
  el.textContent = n; $('pjMenuBtn').title = n;
  if (zapisano) { const z = $('pjMenuBtn').querySelector('.pj-ok'); z.classList.add('on'); clearTimeout(z._t); z._t = setTimeout(() => z.classList.remove('on'), 1600); }
}
function plikDoPobrania() {
  const nazwa = nazwaBiez(), d = new Date(), z = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  const plik = { format: 'ogimora-projekt', schemat: SCHEMAT, zapisano: d.toISOString(), aplikacja: APLIKACJA, id: cur.id || B.nowyId(), nazwa,
    wersje: [{ nr: 1, t: d.getTime(), kod: code, parametry: { ...state }, zdobienia: wz.decorData() }] };
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(plik, null, 1)], { type: 'application/json' })), download: `${slug(nazwa)}_${stamp}.ogimora.json` });
  document.body.appendChild(a); a.click(); a.remove();
  toast((EN_UI ? 'Saved “' : 'Zapisano „') + nazwa + '”' + (EN_UI ? ' to a file' : ' do pliku'));
}
function idzDo(q) { zapiszTeraz(); location.href = location.pathname + q; }   // z pathname: strony /en/ i /pl/ mają <base href="/">
{
  const btn = $('pjMenuBtn'), menu = $('pjMenu');
  document.body.appendChild(menu);
  const zamknij = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const T = EN_UI
    ? { nazwa: 'Design name', zap: 'Saves itself in this browser', zap0: 'Will be saved after your first change', edyt: 'edited', ost: 'My designs in this browser', nowyS: 'Start over: starter', nowySs: 'starter patterns and the OGIMORA lettering', nowyC: 'Start over: blank', nowyCs: 'only OGIMORA on side 1', usun: 'Delete this design', usunQ: n => `Delete “${n}” from this browser?`, dup: 'Duplicate', wcz: 'Open from file…', pob: 'Save to file', pobS: 'to keep or send', wsz: 'All my designs' }
    : { nazwa: 'Nazwa projektu', zap: 'Zapisuje się sam w tej przeglądarce', zap0: 'Zapisze się po pierwszej zmianie', edyt: 'zmieniony', ost: 'Moje projekty w tej przeglądarce', nowyS: 'Od nowa: startowy', nowySs: 'wzory startowe i napis OGIMORA', nowyC: 'Od nowa: czysty', nowyCs: 'tylko napis OGIMORA na ściance 1', usun: 'Usuń ten projekt', usunQ: n => `Usunąć „${n}” z tej przeglądarki?`, dup: 'Duplikuj', wcz: 'Wczytaj z pliku…', pob: 'Zapisz do pliku', pobS: 'do przechowania albo wysłania', wsz: 'Wszystkie moje projekty' };
  const esc = x => String(x || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = d => `<svg class="i" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  function rysuj() {
    const w = cur.id && B.pobierz(cur.id), inne = B.lista().filter(p => p.id !== cur.id).slice(0, 12);
    menu.innerHTML = `<label class="pm-name"><span>${T.nazwa}</span><input id="pmName" maxlength="40" value="${esc(nazwaBiez())}" spellcheck="false"></label>
      <p class="pm-stan">${w ? `${T.zap} · ${T.edyt} ${B.kiedy(w.t, LANG)}` : T.zap0}</p>` +
      (inne.length ? `<div class="pm-sec">${T.ost}</div><div class="pm-lista">` + inne.map(p => `<button type="button" class="pm-p" data-p="${p.id}">${p.thumb ? `<img src="${p.thumb}" alt="">` : '<span class="pm-noimg"></span>'}<span><b>${esc(p.nazwa)}</b><small>${B.kiedy(p.t, LANG)}</small></span><span class="pm-del" data-del="${p.id}" title="${T.usun}" role="button">✕</span></button>`).join('') + '</div>' : '') +
      `<div class="pm-sep"></div>
      <button type="button" data-pm="nowy-start">${ic('M4 12a8 8 0 1 0 3-6.2M4 4v4h4')}<span>${T.nowyS}</span><small>${T.nowySs}</small></button>
      <button type="button" data-pm="nowy-czysty">${ic('M6 3h9l4 4v14H6zM15 3v4h4')}<span>${T.nowyC}</span><small>${T.nowyCs}</small></button>
      ${w ? `<button type="button" data-pm="dup">${ic('M8 8h11v11H8zM5 16V5h11')}<span>${T.dup}</span></button>` : ''}
      <button type="button" data-pm="otworz">${ic('M4 14v5h16v-5M12 15V4m-4 4 4-4 4 4')}<span>${T.wcz}</span></button>
      <button type="button" data-pm="zapisz">${ic('M4 14v5h16v-5M12 4v11m-4-4 4 4 4-4')}<span>${T.pob}</span><small>${T.pobS}</small></button>
      ${w ? `<div class="pm-sep"></div><button type="button" data-pm="usun">${ic('M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13')}<span>${T.usun}</span></button>` : ''}`;
    const inp = menu.querySelector('#pmName');
    const zmien = () => {
      const v = inp.value.trim(); if (!v || v === nazwaBiez()) return;
      if (cur.id) B.zmienNazwe(cur.id, v); else { cur.baza = v; cur.podglad = ''; BL = ''; zapiszTeraz(); }   // nowa nazwa = zmiana: projekt powstaje
      pokazNazwe(true); track('menu', { k: 'nazwa' });
    };
    inp.addEventListener('change', zmien);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { zmien(); zamknij(); } });
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (!menu.hidden) { zamknij(); return; }
    rysuj(); menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.left)) + 'px';
  });
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) zamknij(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zamknij(); });
  menu.addEventListener('click', e => {
    const dl = e.target.closest('[data-del]');
    if (dl) { e.stopPropagation(); const q = B.pobierz(dl.dataset.del); if (q && confirm(T.usunQ(q.nazwa))) { B.usun(q.id); track('menu', { k: 'usun' }); rysuj(); } return; }
    const p = e.target.closest('[data-p]'); if (p) { track('menu', { k: 'przelacz' }); idzDo('?p=' + p.dataset.p); return; }
    const b = e.target.closest('[data-pm]'); if (!b) return; zamknij();
    const k = b.dataset.pm; track('menu', { k });
    if (k === 'nowy-start' || k === 'nowy-czysty') idzDo('?nowy=' + (k === 'nowy-czysty' ? 'czysty' : 'start'));
    else if (k === 'usun') { const q = cur.id && B.pobierz(cur.id); if (q && confirm(T.usunQ(q.nazwa))) { autoReady = false; B.usun(q.id); try { localStorage.setItem('ogip_biez', ''); } catch {} location.href = location.pathname + '?nowy=start'; } }
    else if (k === 'dup') { zapiszTeraz(); const q = B.duplikuj(cur.id, EN_UI ? 'copy' : 'kopia'); if (q) idzDo('?p=' + q.id); }
    else if (k === 'otworz') $('loadFile').click();
    else if (k === 'zapisz') plikDoPobrania();
  });
  // okno „Nowy projekt”: pusty albo jeden z kształtów
  $('nowyGrid').addEventListener('click', e => { if (e.target.closest('a')) zapiszTeraz(); });
  $('nowyDlg').addEventListener('click', e => { if (e.target === $('nowyDlg') || e.target.closest('[data-close]')) $('nowyDlg').close(); });
}
setCam('iso');
// PROSTY: projekt startowy – czarny mat, ogień w misie, niski widok na narożnik; projekt czysty – rysunek w izometrii
if (widokNaStart === 'start') { shading = 'real'; setFinish('paint'); fireOn = true; fireNight = false; syncLook(); rebuildScene(); setCam('start'); }
else if (widokNaStart === 'czysty') { shading = 'draw'; fireOn = false; syncLook(); rebuildScene(); setCam('iso'); }
track('view', { w: innerWidth });

// ---------------------------------------------------------------- wąskie ekrany: podgląd zostaje na ekranie przy przewijaniu
// Na laptopie z małym oknem, tablecie i telefonie suwaki leżą pod podglądem. Gdy podgląd wyjeżdża poza ekran,
// przypinamy go u góry (mniejszy) – układ strony się nie zmienia, bo płótno i tak leży „nad” swoim polem.
{ const mq = matchMedia('(max-width: 1100px)'); let pin = false, czeka = false;
  const sprawdz = () => { czeka = false;
    const r = stage.getBoundingClientRect(), pole = mq.matches ? (innerWidth <= 760 ? 340 : 420) : 0;
    const wys = Math.round(Math.min(innerWidth <= 760 ? 300 : 360, innerHeight * 0.38));
    const chce = mq.matches && view !== 'decor' && r.top + pole < wys && stage.closest('.workspace').getBoundingClientRect().bottom > wys + 80;   // pole podglądu prawie zniknęło, a strona jeszcze trwa
    if (chce) { const s = document.body.style; s.setProperty('--pin-l', Math.round(r.left) + 'px'); s.setProperty('--pin-w', Math.round(r.width) + 'px'); s.setProperty('--pin-h', wys + 'px'); }
    if (chce !== pin) { pin = chce; document.body.classList.toggle('pin', pin); resize(); needsRender = true; }
  };
  const pytaj = () => { if (!czeka) { czeka = true; requestAnimationFrame(sprawdz); } };
  addEventListener('scroll', pytaj, { passive: true }); addEventListener('resize', pytaj); mq.addEventListener('change', pytaj);
}
