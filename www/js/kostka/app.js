// OGIMORA – kostka do nauki spawania: strona (panel, podgląd 3D, rozkrój, pobieranie DXF).
// Geometria: ./geo.js · treść ścianek: ./tresc.js · zapis DXF: ../dxf.js (wspólny z paleniskiem).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { zbuduj, ogranicz, sciecieMin, zamekDomyslny, ZAMEK_MIN, GESTOSC, LIM, w3 } from './geo.js';
import { tresc, gdyCzcionka, NAPIS_MAX, FONTY, FONT_DOM, wiersze } from './tresc.js';
import { buildPdf, planPrint } from '../print.js';
import { tessellate, polygonArea, perimeter, bbox } from '../geometry.js';
import { buildDxf } from '../dxf.js';
import { makeMaterial } from '../textures.js';
import { ICONS } from '../icons.js';
import { LANG } from '../i18n.js';
import { CAL, liczba, preferencja, ustawPreferencje } from '../jednostki.js';
import { track, trackDebounced, setCodeSource, setProjektSource } from '../track.js';
import { WERSJA } from '../wersja.js';

const EN = LANG === 'en';
const T = (pl, en) => (EN ? en : pl);
const $ = id => document.getElementById(id);
const r4 = v => +(+v).toFixed(4);

// ---------------------------------------------------------------- jednostki i blachy
const BLACHY = {
  mm: [2, 3, 4, 5].map(t => ({ t, n: String(t), opis: `${t} mm`, kod: String(t) })),
  in: [
    { t: 1.897, n: '14 ga', opis: '14 ga = 0.075 in (1.9 mm)', kod: '14ga' },
    { t: 3.048, n: '11 ga', opis: '11 ga = 0.120 in (3.0 mm)', kod: '11ga' },
    { t: 3.429, n: '10 ga', opis: '10 ga = 0.135 in (3.4 mm)', kod: '10ga' },
    { t: 4.7625, n: '3/16"', opis: '3/16" = 0.188 in (4.8 mm)', kod: '3-16' },
    { t: 6.35, n: '1/4"', opis: '1/4" = 0.250 in (6.4 mm)', kod: '1-4' },
  ],
};
const NA_IN = { 2: 0, 3: 1, 4: 2, 5: 3 }, NA_MM = [2, 3, 4, 5, 5];
const SIATKA = { mm: { a: 10, c: 5, g: 0.1, zw: 1 }, in: { a: 0.5 * CAL, c: 0.25 * CAL, g: 0.005 * CAL, zw: 0.0625 * CAL } };
const ZW_MAX = { mm: 100, in: 4 * CAL };          // szerokość zamka: od zera (bez zamków) do 100 mm / 4 cali
const ZAKRES = { mm: { a: [100, 700], g: [0.1, 1.5] }, in: { a: [4 * CAL, 28 * CAL], g: [0.005 * CAL, 0.06 * CAL] } };
const LUZY = { mm: [['Laser', 0.3], [T('Plazma', 'Plasma'), 0.8], [T('Stara plazma', 'Old plasma'), 1.2]],
               in: [['Laser', 0.010 * CAL], [T('Plazma', 'Plasma'), 0.030 * CAL], [T('Stara plazma', 'Old plasma'), 0.050 * CAL]] };
const blacha = t => [...BLACHY.mm, ...BLACHY.in].find(b => Math.abs(b.t - t) < 1e-3) || BLACHY.mm[1];
const jednStanu = s => (BLACHY.in.some(b => Math.abs(b.t - s.t) < 1e-3) ? 'in' : 'mm');
const naSiatke = (v, k) => r4(Math.round(r4(v) / k) * k);
const dl = (mm, j = J) => (j === 'in' ? `${liczba(mm / CAL, 2, true)} in` : `${liczba(mm, 0)} mm`);
const dlL = (mm, j = J, dec) => (j === 'in' ? liczba(mm / CAL, dec ?? 2, true) : liczba(mm, dec ?? 0, true));
const luzL = (mm, j = J) => (j === 'in' ? liczba(mm / CAL, 3) : liczba(mm, 1));

// ---------------------------------------------------------------- stan
const KLUCZ = 'ogik_stan';
const kropki = () => Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [n, { typ: 'kropki', n, tekst: String(n), t1: '', t3: '', font: FONT_DOM, ksztalt: 'kolo', skala: 0.7 }]));
function startowy(j) {
  const s = { a: 250, t: 3, c: 0, g: 0.3, zw: zamekDomyslny(3), sc: kropki() };
  return j === 'in' ? przelicz(s, 'in') : s;
}
function przelicz(s, j) {
  const z = jednStanu(s); if (z === j) return s;
  const q = { ...s, sc: s.sc };
  if (j === 'in') q.t = BLACHY.in[NA_IN[Math.round(s.t)] ?? 1].t;
  else q.t = NA_MM[Math.max(0, BLACHY.in.findIndex(b => Math.abs(b.t - s.t) < 1e-3))];
  q.a = Math.min(ZAKRES[j].a[1], Math.max(ZAKRES[j].a[0], naSiatke(s.a, SIATKA[j].a)));
  q.c = s.c > 0 ? naSiatke(s.c, SIATKA[j].c) : 0;
  q.g = Math.min(ZAKRES[j].g[1], Math.max(ZAKRES[j].g[0], naSiatke(s.g, SIATKA[j].g)));
  q.zw = s.zw > 0 ? (Math.abs(s.zw - zamekDomyslny(s.t)) < 0.6 ? zamekDomyslny(q.t) : Math.min(ZW_MAX[j], naSiatke(s.zw, SIATKA[j].zw))) : 0;
  return q;
}
function popraw(s) {            // dane z linku albo z pamięci: tylko znane pola, w granicach
  const d = startowy('mm'), q = { ...d };
  if (!s || typeof s !== 'object') return d;
  for (const k of ['a', 't', 'c', 'g']) if (Number.isFinite(+s[k])) q[k] = +s[k];
  if (![...BLACHY.mm, ...BLACHY.in].some(b => Math.abs(b.t - q.t) < 1e-3)) q.t = 3;
  q.zw = s.zamki === false || s.zamki === 0 ? 0 : Number.isFinite(+s.zw) ? +s.zw : zamekDomyslny(q.t);   // stare linki: zamki tak / nie
  q.sc = {};
  for (let n = 1; n <= 6; n++) {
    const x = (s.sc && s.sc[n]) || {}, typ = ['brak', 'kropki', 'napis', 'otwor'].includes(x.typ) ? x.typ : 'brak';
    q.sc[n] = { typ, n: Math.min(6, Math.max(1, Math.round(+x.n || n))), tekst: String(x.tekst ?? n).slice(0, NAPIS_MAX),
      t1: String(x.t1 ?? '').slice(0, NAPIS_MAX), t3: String(x.t3 ?? '').slice(0, NAPIS_MAX),            // wiersz górny i dolny (od 0.3.1)
      font: FONTY.some(f => f.id === x.font) ? x.font : FONT_DOM,
      ksztalt: ['kwadrat', 'sciety'].includes(x.ksztalt) ? x.ksztalt : 'kolo', skala: Math.min(1, Math.max(0.2, +x.skala || 0.7)) };
  }
  return { ...q, ...wGranicach(q) };
}
function wGranicach(q) { const o = ogranicz(q); return { a: o.a, t: o.t, c: o.c, g: o.g, zw: o.zw }; }

const b64 = { na: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
              z: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))) };
function zLinku() { const m = /[#&]k=([A-Za-z0-9_-]+)/.exec(location.hash); if (!m) return null; try { return JSON.parse(b64.z(m[1])); } catch { return null; } }
function zPamieci() { try { return JSON.parse(localStorage.getItem(KLUCZ) || 'null'); } catch { return null; } }
const doLinku = () => '#k=' + b64.na(JSON.stringify(state));

let state = popraw(zLinku() || zPamieci() || startowy(preferencja()));
let J = jednStanu(state);
let wybrana = 1;                 // ścianka w panelu
let model = null, czesci = [];
let view = 'model', shading = 'draw', spoinyOn = false, dxfJ = J;

function zapisz() {
  try { localStorage.setItem(KLUCZ, JSON.stringify(state)); } catch {}
  try { history.replaceState(null, '', location.pathname + location.search + doLinku()); } catch {}
}

// ---------------------------------------------------------------- model → części do cięcia
const naXY = ring => ring.map(q => (Array.isArray(q) ? { x: q[0], y: q[1] } : q));
let uwagiTresci = [], czekaNaCzcionke = false;
function przelicz3D() {
  model = zbuduj(state);
  uwagiTresci = []; czekaNaCzcionke = false;
  for (const pl of model.plyty) {
    pl.holes = [];
    if (pl.rodzaj !== 'kw') continue;
    const w = tresc(state.sc[pl.nr], pl.pole, state.t);
    pl.holes = w.holes; if (w.pending) czekaNaCzcionke = true;
    w.uwagi.forEach(u => uwagiTresci.push([pl.nr, u]));
  }
  czesci = [];
  const kw = model.plyty.filter(p => p.rodzaj === 'kw');
  kw.forEach(p => czesci.push({ key: p.key, nr: p.nr, name: T('Ścianka', 'Side') + ' ' + p.nr, outline: naXY(p.ring), holes: p.holes, qty: 1, t: p.t }));
  const tr = model.plyty.find(p => p.rodzaj === 'tr');
  if (tr) czesci.push({ key: 't', name: T('Narożnik', 'Corner'), outline: naXY(tr.ring), holes: [], qty: 8, t: tr.t });
  let pole = 0, ciecie = 0, przebicia = 0;
  czesci.forEach(c => {
    const A = polygonArea(c.outline) - c.holes.reduce((s, h) => s + polygonArea(h), 0);
    const P = perimeter(c.outline) + c.holes.reduce((s, h) => s + perimeter(h), 0);
    pole += A * c.qty; ciecie += P * c.qty; przebicia += (1 + c.holes.length) * c.qty;
  });
  model.stat2 = { pole, ciecie, przebicia, masa: pole * state.t * GESTOSC, sztuk: czesci.reduce((s, c) => s + c.qty, 0) };
}
gdyCzcionka(() => { if (czekaNaCzcionke) odswiez(); });

// ---------------------------------------------------------------- scena 3D
const canvas = $('scene'), stage = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
const orbit = new OrbitControls(camera, canvas);
Object.assign(orbit, { enableDamping: true, dampingFactor: .09, enablePan: false, rotateSpeed: .7, minZoom: .4, maxZoom: 6, minPolarAngle: .01, maxPolarAngle: Math.PI - .01 });
scene.add(new THREE.HemisphereLight(0xf6f0df, 0x3a3c33, 1.9));
const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(-900, 1500, 1100); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -1200, right: 1200, top: 1200, bottom: -1200, near: 10, far: 5000 });
key.shadow.bias = -.0004; key.shadow.normalBias = 1.5; scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xc4ccd4, 1.0); fill.position.set(1000, 600, -900); scene.add(fill);
const head = new THREE.DirectionalLight(0xfff6ea, .9); head.position.set(0, 0, 1); camera.add(head); scene.add(camera);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.ShadowMaterial({ opacity: .12 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const drawMat = new THREE.MeshLambertMaterial({ color: 0xf7f5ef, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const selMat = new THREE.MeshLambertMaterial({ color: 0xf6c9a8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
const lineReal = new THREE.LineBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: .45 });
const spoinaDraw = new THREE.MeshLambertMaterial({ color: 0xe0262f, side: THREE.DoubleSide });
const spoinaReal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: .75, roughness: .38, side: THREE.DoubleSide });
const matCache = {};
const material = () => (matCache[shading] ||= makeMaterial(shading, renderer));
const W = a => new THREE.Vector3(a[0], a[2], -a[1]);       // z-góra → y-góra (obrót, nie lustro)
let group = null, needsRender = true, promien = 300;

function krawedzie(loops, depth) {
  const pos = [];
  for (const raw of loops) {
    const L = raw.filter((p, i) => p.distanceTo(raw[(i + 1) % raw.length]) > 1e-3), n = L.length;
    for (let i = 0; i < n; i++) {
      const a = L[i], b = L[(i + 1) % n], c = L[(i + 2) % n];
      pos.push(a.x, a.y, 0, b.x, b.y, 0, a.x, a.y, depth, b.x, b.y, depth);
      const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
      if (d1.dot(d2) < Math.cos(25 * Math.PI / 180)) pos.push(b.x, b.y, 0, b.x, b.y, depth);
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
}

function scena() {
  if (group) { scene.remove(group); group.traverse(o => o.geometry && o.geometry.dispose()); }
  group = new THREE.Group();
  const real = shading !== 'draw', mat = real ? material() : drawMat;
  for (const pl of model.plyty) {
    const outer = pl.ring.map(([x, y]) => new THREE.Vector2(x, y));
    const holes = (pl.holes || []).map(h => tessellate(h, 14).map(([x, y]) => new THREE.Vector2(x, y)));
    const shape = new THREE.Shape(outer); shape.holes = holes.map(h => new THREE.Path(h));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: pl.t, bevelEnabled: false, curveSegments: 1 });
    const m4 = new THREE.Matrix4().makeBasis(W(pl.u), W(pl.v), W(pl.n)).setPosition(W(pl.o));
    geo.applyMatrix4(m4); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, !real && pl.rodzaj === 'kw' && pl.nr === wybrana ? selMat : mat);
    mesh.userData.nr = pl.rodzaj === 'kw' ? pl.nr : 0; mesh.castShadow = true; mesh.receiveShadow = real;
    group.add(mesh);
    group.add(new THREE.LineSegments(krawedzie([outer, ...holes], pl.t).applyMatrix4(m4), real ? lineReal : lineMat));
  }
  if (spoinyOn) {
    // spoina: graniastosłup wypełniający rowek (krawędź wewnętrzna + zewnętrzne krawędzie obu ścianek)
    const pos = [], t = state.t, add = (p, n, k) => [p[0] + n[0] * k, p[1] + n[1] * k, p[2] + n[2] * k];
    for (const s of model.spoiny) {
      const A = [s.a, add(s.a, s.nA, t), add(s.a, s.nB, t)].map(W), B = [s.b, add(s.b, s.nA, t), add(s.b, s.nB, t)].map(W);
      const tri = (p, q, r) => pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
      tri(A[1], B[1], B[2]); tri(A[1], B[2], A[2]); tri(A[0], A[1], A[2]); tri(B[0], B[2], B[1]);
    }
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, real ? spoinaReal : spoinaDraw); m.castShadow = true; group.add(m);
  }
  scene.add(group);
  ground.position.y = -state.a / 2 - 0.5; ground.material.opacity = real ? .2 : .1;
  key.target.position.set(0, 0, 0); orbit.target.set(0, 0, 0);
  const R = state.a * 0.87;
  if (Math.abs(R - promien) > 1) { promien = R; kadr(); }
  renderer.shadowMap.needsUpdate = true; needsRender = true;
}

function wolne() {
  const w = stage.clientWidth, H = canvas.clientHeight || stage.clientHeight, karta = $('kKsztalt');
  const obok = matchMedia('(min-width: 1101px)').matches && karta.offsetWidth;
  const x0 = obok ? karta.getBoundingClientRect().right - stage.getBoundingClientRect().left + 14 : 10;
  return { w, H, x0, x1: w - 10, y0: 16, y1: H - 40 };
}
function kadr() {
  const F = wolne(); if (!F.w || !F.H) return;
  renderer.setSize(F.w, F.H, false);
  const fw = Math.max(120, F.x1 - F.x0), fh = Math.max(120, F.y1 - F.y0);
  const wpp = 2 * promien * 1.06 / Math.min(fw, fh);
  const dx = ((F.x0 + F.x1) / 2 - F.w / 2) * wpp, dy = (F.H / 2 - (F.y0 + F.y1) / 2) * wpp;
  camera.left = -F.w / 2 * wpp - dx; camera.right = F.w / 2 * wpp - dx; camera.top = F.H / 2 * wpp - dy; camera.bottom = -F.H / 2 * wpp - dy;
  camera.updateProjectionMatrix(); needsRender = true;
}
function kamera(rodzaj) {
  const dirs = { iso: [1, .62, 1.25], front: [0, .0001, 1], top: [0, 1, .001], bottom: [.3, -1, .6] };
  camera.position.copy(new THREE.Vector3(...dirs[rodzaj]).normalize().multiplyScalar(5000)); camera.zoom = 1; camera.updateProjectionMatrix();
  orbit.update(); needsRender = true;
}
orbit.addEventListener('change', () => { needsRender = true; });
new ResizeObserver(() => { kadr(); if (view === 'flat') rozkroj(); }).observe(stage);
(function petla() { requestAnimationFrame(petla); if (view !== 'model') return; orbit.update(); if (needsRender) { needsRender = false; renderer.render(scene, camera); } })();

// kliknięcie ścianki na modelu → wybór w panelu
{ let d0 = null; const ray = new THREE.Raycaster(), v = new THREE.Vector2();
  canvas.addEventListener('pointerdown', e => { d0 = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!d0 || Math.hypot(e.clientX - d0[0], e.clientY - d0[1]) > 5 || !group) return;
    const r = canvas.getBoundingClientRect(); v.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, camera);
    const hit = ray.intersectObjects(group.children.filter(o => o.isMesh && o.userData.nr), false)[0];
    if (hit) { wybrana = hit.object.userData.nr; track('k_scianka_klik'); panelScianki(); scena(); }
  }); }

// ---------------------------------------------------------------- rozkrój (SVG)
function rozkroj() {
  const box = $('kFlat'), items = [];
  czesci.forEach(c => { const b = bbox(c.outline); for (let k = 0; k < c.qty; k++) items.push({ c, b, w: b.maxX - b.minX, h: b.maxY - b.minY }); });
  const Wd = Math.max(200, box.clientWidth - 24), Hd = Math.max(160, box.clientHeight - 24), gap = Math.max(10, state.a * .05);
  let best = null; const total = items.reduce((s, i) => s + i.w + gap, 0), maxW = Math.max(...items.map(i => i.w));
  for (let k = 0; k <= 60; k++) {
    const rowW = maxW + (total - maxW) * k / 60; let x = 0, y = 0, rowH = 0, Wm = 0; const pl = [];
    for (const it of items) { if (x > 0 && x + it.w > rowW + 1e-6) { x = 0; y += rowH + gap; rowH = 0; } pl.push({ ...it, x, y }); x += it.w + gap; rowH = Math.max(rowH, it.h); Wm = Math.max(Wm, x - gap); }
    const Hm = y + rowH, sc = Math.min(Wd / Wm, Hd / Hm);
    if (!best || sc > best.sc * 1.001) best = { sc, pl, Wm, Hm };
  }
  const d = r => tessellate(r, 16).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(-y).toFixed(2)}`).join('') + 'Z';
  const sw = 1.3 / best.sc;
  box.innerHTML = `<svg viewBox="${-gap / 2} ${-gap / 2} ${best.Wm + gap} ${best.Hm + gap}" preserveAspectRatio="xMidYMid meet">` + best.pl.map(it => {
    const ox = it.x - it.b.minX, oy = it.y + it.b.maxY, wyb = it.c.nr === wybrana;
    return `<g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)})" data-nr="${it.c.nr || ''}"><path d="${d(it.c.outline)}${it.c.holes.map(d).join('')}" fill-rule="evenodd" fill="${wyb ? '#f6c9a8' : '#f7f5ef'}" stroke="#14130f" stroke-width="${sw}" stroke-linejoin="round"/>` +
      (it.c.nr ? `<text x="${(it.b.minX + sw * 9).toFixed(1)}" y="${(-it.b.maxY + sw * 16).toFixed(1)}" font-size="${sw * 9}" font-weight="700" fill="#8a857c" font-family="DM Sans, sans-serif">${it.c.nr}</text>` : '') + '</g>';
  }).join('') + '</svg>';
}
$('kFlat').addEventListener('click', e => { const g = e.target.closest('g[data-nr]'); if (g && g.dataset.nr) { wybrana = +g.dataset.nr; panelScianki(); rozkroj(); } });

// ---------------------------------------------------------------- panele
const ikZamek = `<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="k" d="M2 15H8V8H16V15H22"/><path stroke="#df3434" stroke-width="2.4" d="M8 4.5H16M8 3V6M16 3V6"/></svg>`;
const ik = { bok: ICONS.base, sciecie: `<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="k" d="M4 4H14M20 10V20H4V4"/><path stroke="#df3434" stroke-width="2.4" d="M14 4L20 10"/></svg>`,
  rozmiar: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="8" height="8"/><path d="M11 3h6v6M17 3l-6 6"/></svg>` };
const suwak = (id, tytul, ikona, jedn) => `<div class="row ctl" title="${tytul}"><label for="r-${id}" class="ctl-ic">${ikona}</label>
  <input type="range" id="r-${id}" aria-label="${tytul}"><span class="num"><input type="number" id="n-${id}" aria-label="${tytul}"><em>${jedn}</em></span></div>`;
function ustawSuwak(id, min, max, step, v, wysw) {
  const r = $('r-' + id), n = $('n-' + id);
  r.min = min; r.max = max; r.step = step; r.value = v; r.style.setProperty('--p', `${max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) * 100 : 0}%`);
  if (document.activeElement !== n) n.value = wysw;
}
function panelKsztalt() {
  const u = J === 'in' ? 'in' : 'mm';
  $('kKsztalt').innerHTML = `<h2>${T('Kształt', 'Shape')}</h2>
    ${suwak('a', T('Bok kostki (wymiar zewnętrzny)', 'Cube side (outside size)'), ik.bok, u)}
    ${suwak('c', T('Ścięcie narożników: 0 = brak; największe sięga połowy boku', 'Corner cut: 0 = none; the largest reaches the middle of each edge'), ik.sciecie, u)}
    <div class="row derived" title="${T('Wymiar jednej ścianki do wycięcia (bez zamków)', 'Size of one side plate to cut (without tabs)')}"><span>${ICONS.sheet || ''}</span><output id="kPlyta"></output></div>`;
  const zm = (id, zZdarzenia) => {
    const r = $('r-' + id), n = $('n-' + id);
    r.addEventListener('input', () => { ustaw(id, +r.value); trackDebounced('k_' + id, 'k_suwak', { param: id }); });
    n.addEventListener('change', () => { const v = parseFloat(String(n.value).replace(',', '.')); if (Number.isFinite(v)) ustaw(id, J === 'in' ? v * CAL : v); else odswiez(); track('k_pole', { param: id }); });
  };
  zm('a'); zm('c');
}
function ustaw(id, v) {
  const S = SIATKA[J], Z = ZAKRES[J];
  if (id === 'a') { state.a = Math.min(Z.a[1], Math.max(Z.a[0], naSiatke(v, S.a))); if (state.c > state.a / 2) state.c = state.a / 2; }
  if (id === 'c') { const min = sciecieMin(state.t); v = naSiatke(v, S.c); state.c = v <= 0 ? 0 : v < min ? (v > state.c ? Math.ceil(min / S.c) * S.c : 0) : Math.min(state.a / 2, v); }
  if (id === 'g') state.g = Math.min(Z.g[1], Math.max(Z.g[0], naSiatke(v, S.g)));
  if (id === 'zw') { v = Math.min(ZW_MAX[J], naSiatke(v, S.zw)); state.zw = v <= 0 ? 0 : v < ZAMEK_MIN ? (v > state.zw ? ZAMEK_MIN : 0) : v; }
  odswiez();
}

const TYPN = { brak: T('Brak', 'None'), kropki: T('Kropki', 'Dots'), napis: T('Napis / liczba', 'Text / number'), otwor: T('Otwór', 'Opening') };
function panelScianki() {
  const sc = state.sc[wybrana];
  const chips = (lista, akt, attr) => lista.map(([v, n, tt]) => `<button type="button" class="chip${v === akt ? ' active' : ''}" data-${attr}="${v}"${tt ? ` title="${tt}"` : ''}>${n}</button>`).join('');
  $('kScianki').innerHTML = `<h2>${T('Ścianki', 'Sides')}</h2>
    <div class="k-pre"><span>${T('Zestaw', 'Preset')}</span>${chips([['kropki', T('Kostka do gry', 'Dice dots')], ['liczby', T('Liczby', 'Numbers')], ['czysta', T('Czysta', 'Plain')]], '', 'pre')}</div>
    <div class="p-sc" id="kSc"><span>${T('Ścianka', 'Side')}</span>${chips([1, 2, 3, 4, 5, 6].map(n => [n, n]), wybrana, 'k')}</div>
    <div class="k-typ" id="kTyp">${chips(Object.entries(TYPN), sc.typ, 'typ')}</div>
    <div class="k-opc" id="kOpc">${
      sc.typ === 'kropki' ? `<div class="p-sc"><span>${T('Ile', 'Count')}</span>${chips([1, 2, 3, 4, 5, 6].map(n => [n, n]), sc.n, 'n')}</div>` :
      sc.typ === 'napis' ? `<div class="k-wiersze">${[['t1', T('wiersz górny', 'top line')], ['tekst', T('np. 6 albo imię', 'e.g. 6 or a name')], ['t3', T('wiersz dolny', 'bottom line')]].map(([k, ph]) =>
          `<input type="text" class="p-text${k === 'tekst' ? ' gl' : ''}" data-w="${k}" maxlength="${NAPIS_MAX}" placeholder="${ph}" spellcheck="false" autocomplete="off" aria-label="${ph}">`).join('')}</div>
        <div class="k-fonty" id="kFonty">${FONTY.map(f => `<button type="button" class="chip${f.id === sc.font ? ' active' : ''}" data-font="${f.id}" title="${f.nazwa}${f.szablon ? T(' – szablonowa: przerwy są w rysunku liter', ' – stencil: the breaks are part of the letters') : ''}" style="font-family:'ogik-${f.id}'">${T('Ab12', 'Ab12')}</button>`).join('')}</div>` :
      sc.typ === 'otwor' ? `<div class="p-sc"><span>${T('Kształt', 'Shape')}</span>${chips([['kolo', T('Okrągły', 'Round')], ['kwadrat', T('Kwadrat', 'Square')], ['sciety', T('Ścięte rogi', 'Cut corners'), T('Kwadrat ze ściętymi rogami: rogi otworu ścinają się tak samo jak narożniki kostki (suwak ścięcia w panelu Kształt)', 'Square with cut corners: the opening follows the corner cut of the cube (corner cut slider in the Shape panel)')]], sc.ksztalt, 'ksz')}</div>` : ''}
      ${sc.typ !== 'brak' ? `<div class="p-row"><span class="p-ic" title="${T('Wielkość', 'Size')}">${ik.rozmiar}</span><input type="range" id="kSkala" min="20" max="100" step="1" value="${Math.round(sc.skala * 100)}" aria-label="${T('Wielkość', 'Size')}" style="--p:${(sc.skala * 100 - 20) / 0.8}%"></div>` : ''}
    </div>
    <p class="p-kom" id="kKom" role="status" aria-live="polite"></p>
    <p class="k-wsk">${T('Kliknij ściankę na modelu, żeby ją wybrać. 1 – góra, 6 – spód.', 'Click a side on the model to select it. 1 – top, 6 – bottom.')}</p>`;
  document.querySelectorAll('#kOpc [data-w]').forEach(t => { const k = t.dataset.w; t.value = sc[k] || '';
    t.addEventListener('input', () => { sc[k] = t.value.slice(0, NAPIS_MAX); trackDebounced('k_tekst', 'k_napis', { value: k }); odswiez(false); }); });
  const s = $('kSkala'); if (s) s.addEventListener('input', () => { sc.skala = +s.value / 100; s.style.setProperty('--p', `${(+s.value - 20) / 0.8}%`); trackDebounced('k_skala', 'k_suwak', { param: 'skala' }); odswiez(false); });
  komunikat();
}
$('kScianki').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset, sc = state.sc[wybrana];
  if (d.pre) {
    if (d.pre === 'kropki') state.sc = kropki();
    else for (let n = 1; n <= 6; n++) state.sc[n] = { ...state.sc[n], typ: d.pre === 'liczby' ? 'napis' : 'brak', tekst: String(n), t1: '', t3: '', n, skala: 0.7 };
    track('k_zestaw', { value: d.pre });
  } else if (d.k) { wybrana = +d.k; }
  else if (d.typ) { sc.typ = d.typ; track('k_typ', { value: d.typ }); }
  else if (d.n) sc.n = +d.n;
  else if (d.ksz) { sc.ksztalt = d.ksz; track('k_otwor', { value: d.ksz }); }
  else if (d.font) { sc.font = d.font; track('k_font', { value: d.font }); }
  else return;
  odswiez();
});

function panelBlacha() {
  const lista = BLACHY[J];
  $('kBlacha').innerHTML = `<h2>${T('Blacha', 'Sheet')}</h2>
    <div class="thk-box"><div class="row thk" title="${T('Grubość blachy', 'Sheet thickness')}"><span>${ICONS.thk}</span><div class="chips" id="kThk" data-thk="t">${lista.map(b => `<button type="button" class="chip${Math.abs(b.t - state.t) < 1e-3 ? ' active' : ''}" data-t="${b.t}" title="${b.opis}">${b.n}</button>`).join('')}</div></div></div>
    <div class="gap-head k-zamki"><span>${T('Szerokość zamka', 'Tab width')}</span><small id="kZwOpis"></small></div>
    ${suwak('zw', T('Szerokość zamka ustalającego: 0 = bez zamków', 'Width of a locating tab: 0 = no tabs'), ikZamek, J === 'in' ? 'in' : 'mm')}
    <div id="kLuz"${state.zw > 0 ? '' : ' class="off"'}><div class="gap-head"><span>${T('Luz na zamkach', 'Tab clearance')}</span></div>
    ${suwak('g', T('Luz zamków (na stronę)', 'Tab clearance (per side)'), ICONS.gap, J === 'in' ? 'in' : 'mm')}
    <div class="gap-pre">${LUZY[J].map(([n, g]) => `<button type="button" class="chip${Math.abs(g - state.g) < 1e-3 ? ' active' : ''}" data-g="${g}">${n} <small>${luzL(g)}</small></button>`).join('')}</div></div>`;
  for (const id of ['zw']) { const r2 = $('r-' + id), n2 = $('n-' + id);
    r2.addEventListener('input', () => { ustaw(id, +r2.value); $('kLuz').classList.toggle('off', !(state.zw > 0)); trackDebounced('k_' + id, 'k_suwak', { param: 'zamek' }); });
    n2.addEventListener('change', () => { const v = parseFloat(String(n2.value).replace(',', '.')); if (Number.isFinite(v)) ustaw(id, J === 'in' ? v * CAL : v); else odswiez(); }); }
  const r = $('r-g'), n = $('n-g');
  r.addEventListener('input', () => { ustaw('g', +r.value); trackDebounced('k_g', 'k_suwak', { param: 'luz' }); });
  n.addEventListener('change', () => { const v = parseFloat(String(n.value).replace(',', '.')); if (Number.isFinite(v)) ustaw('g', J === 'in' ? v * CAL : v); else odswiez(); });
}
$('kBlacha').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.t) { if (state.zw > 0 && Math.abs(state.zw - zamekDomyslny(state.t)) < 0.6) state.zw = zamekDomyslny(+b.dataset.t); state.t = +b.dataset.t; if (state.c > 0) state.c = Math.max(state.c, Math.ceil(sciecieMin(state.t) / SIATKA[J].c) * SIATKA[J].c); track('k_blacha', { value: blacha(state.t).kod }); odswiez(); }
  if (b.dataset.g) { state.g = +b.dataset.g; track('k_luz', { value: b.textContent.trim().split(' ')[0] }); odswiez(); }
});

// pasek narzędzi podglądu
function pasek() {
  const sw = (id, tt, kl, ikona = '') => `<button class="chip sw ${kl}${shading === id ? ' active' : ''}" data-shade="${id}" title="${tt}">${ikona}</button>`;
  $('kLook').innerHTML = sw('draw', T('Rysunek: jasny model z czarnymi krawędziami', 'Drawing: light model with black edges'), 'f-draw', ICONS.iso) +
    sw('mill', T('Stal surowa', 'Raw steel'), 'f-mill') + sw('flash', T('Nalot rdzy', 'Flash rust'), 'f-flash') + sw('paint', T('Czarny mat', 'Matt black'), 'f-paint');
  $('kOpcje').innerHTML = `<button class="chip icon${spoinyOn ? ' active' : ''}" data-opc="spoiny" title="${T('Spoiny: pokaż rowki wypełnione spoiną (czerwone na rysunku)', 'Welds: show the grooves filled with weld (red in the drawing)')}">${ICONS.seamWeld}</button>`;
  $('kCams').innerHTML = [['iso', ICONS.iso, T('Widok izometryczny', 'Isometric view')], ['front', ICONS.front, T('Widok z przodu', 'Front view')], ['top', ICONS.topView, T('Widok z góry', 'Top view')], ['bottom', ICONS.bottom, T('Widok od spodu', 'View from below')]]
    .map(([k, i, tt]) => `<button class="chip icon" data-cam="${k}" title="${tt}">${i}</button>`).join('');
}
document.querySelector('.toolbar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.view) { view = d.view; document.querySelectorAll('#kTabs .tab').forEach(t => { const on = t.dataset.view === view; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    $('kFlat').hidden = view !== 'flat'; stage.classList.toggle('plasko', view === 'flat'); canvas.style.visibility = view === 'flat' ? 'hidden' : ''; $('viewTools').classList.toggle('off', view === 'flat'); track('k_widok', { value: view }); odswiez(false); }
  if (d.shade) { shading = d.shade; track('k_wyglad', { value: shading }); pasek(); scena(); }
  if (d.opc === 'spoiny') { spoinyOn = !spoinyOn; track('k_spoiny'); pasek(); scena(); }
  if (d.cam) { kamera(d.cam); kadr(); track('k_kamera', { value: d.cam }); }
});

// jednostki (pasek górny)
function syncJedn() { document.querySelectorAll('.ob-jedn button').forEach(b => { b.classList.toggle('on', b.dataset.j === J); b.setAttribute('aria-pressed', b.dataset.j === J); }); document.documentElement.dataset.jedn = J; }
document.querySelectorAll('.ob-jedn button').forEach(b => b.addEventListener('click', () => {
  const inny = [...document.querySelectorAll('.ob-jedn button')].find(x => x !== b);
  const j = b.dataset.j === J && matchMedia('(max-width: 520px)').matches ? inny.dataset.j : b.dataset.j;
  if (j === J) return;
  state = { ...state, ...przelicz(state, j) }; J = j; dxfJ = j; ustawPreferencje(j); track('jednostki', { value: j });
  panelKsztalt(); odswiez();
}));

// ---------------------------------------------------------------- statystyki, uwagi
function komunikat() {
  const u = uwagiTresci.filter(([nr]) => nr === wybrana).map(([, k]) => k), el = $('kKom'); if (!el) return;
  const sc = state.sc[wybrana];
  el.textContent = sc.typ === 'otwor' && sc.ksztalt === 'sciety' && !(state.c > 0) ? T('Rogi otworu ścinają się razem z narożnikami kostki – ustaw ścięcie w panelu „Kształt”.', 'The corners of the opening follow the corner cut of the cube – set it in the “Shape” panel.')
    : u.includes('wyspy') ? T('W tym napisie zostaje kawałek metalu bez podparcia – zmień wielkość albo tekst.', 'A piece of metal in this text is left unsupported – change the size or the text.')
    : u.includes('male') ? T('Za drobne do wycięcia przy tej blasze – powiększ albo skróć.', 'Too fine to cut in this sheet – make it bigger or shorter.') : '';
}
function statystyki() {
  const s = model.stat2, st = (ikona, tt, w) => `<div class="stat" title="${tt}">${ikona}<b>${w}</b></div>`;
  const masa = J === 'in' ? `${liczba(s.masa * 2.20462, s.masa < 4.5 ? 1 : 0)} lb` : `${liczba(s.masa, 1)} kg`;
  const m = mm => (J === 'in' ? `${liczba(mm / 304.8, 1)} ft` : `${liczba(mm / 1000, 1)} m`);
  $('stats').innerHTML = st(ICONS.size, T('Bok kostki', 'Cube side'), dl(state.a)) + st(ICONS.mass, T('Masa stali', 'Steel weight'), masa) +
    st(ICONS.cut, T('Długość cięcia', 'Cut length'), m(s.ciecie)) + st(ICONS.seamWeld, T('Długość spoin (wszystkie krawędzie)', 'Weld length (all edges)'), m(model.stat.spoiny));
  $('kPlyta').textContent = `${dlL(model.wym.kw)} × ${dl(model.wym.kw)}`;
  const uw = [];
  if (s.masa > 25) uw.push(T(`Kostka waży ${liczba(s.masa, 0)} kg – do przenoszenia potrzebne dwie osoby albo wózek.`, `The cube weighs ${liczba(s.masa * 2.20462, 0)} lb – moving it takes two people or a cart.`));
  if (!(state.zw > 0)) uw.push(T('Bez zamków ścianki trzeba ustawić i przytrzymać samemu (kątownik, magnesy).', 'Without tabs you need to position and hold the sides yourself (angle, magnets).'));
  else if (model.zamki.kw === 0) uw.push(T('Przy tym ścięciu krawędzie są za krótkie na zamki.', 'With this corner cut the edges are too short for tabs.'));
  if (state.c > 0 && model.zamki.tr === 0 && state.zw > 0) uw.push(T('Trójkąty narożników są za małe na zamki – sczep je punktowo.', 'The corner triangles are too small for tabs – tack them in place.'));
  const zle = [...new Set(uwagiTresci.map(([nr]) => nr))];
  if (zle.length) uw.push(T(`Sprawdź ściankę ${zle.join(', ')}: treść jest za drobna albo zostaje wyspa.`, `Check side ${zle.join(', ')}: the content is too fine or leaves an island.`));
  $('warnLine').innerHTML = uw.length ? `${ICONS.warn || ''}<span>${uw[0]}</span>${uw.length > 1 ? `<b>+${uw.length - 1}</b>` : ''}` : '';
  $('warnings').innerHTML = uw.map(x => `<li>${x}</li>`).join('');
  $('warnSlot').classList.toggle('has', uw.length > 0);
  $('ctaSub').textContent = T(`${s.sztuk} elementów · gotowy do cięcia CNC`, `${s.sztuk} parts · ready for CNC cutting`);
}

// ---------------------------------------------------------------- odświeżanie
function odswiez(panel = true) {
  Object.assign(state, wGranicach(state));
  przelicz3D();
  const Z = ZAKRES[J], S = SIATKA[J], d = J === 'in' ? 2 : 0;
  const pole = (mm, dec) => String(+(J === 'in' ? mm / CAL : mm).toFixed(dec));      // pole liczbowe: zawsze kropka dziesiętna
  ustawSuwak('a', Z.a[0], Z.a[1], S.a, state.a, pole(state.a, d));
  ustawSuwak('c', 0, r4(Math.floor(state.a / 2 / S.c) * S.c), S.c, state.c, pole(state.c, d));
  if (panel) { panelScianki(); panelBlacha(); } else komunikat();
  ustawSuwak('g', Z.g[0], Z.g[1], S.g, state.g, pole(state.g, J === 'in' ? 3 : 1));
  ustawSuwak('zw', 0, ZW_MAX[J], S.zw, state.zw, pole(state.zw, J === 'in' ? 3 : 0)); $('n-zw').step = J === 'in' ? 0.0625 : 1;
  $('kZwOpis').textContent = state.zw > 0 ? T(`${model.zamki.razem} szt. na całej kostce`, `${model.zamki.razem} on the whole cube`) : T('bez zamków', 'no tabs');
  $('n-a').step = J === 'in' ? 0.5 : 10; $('n-c').step = J === 'in' ? 0.25 : 5; $('n-g').step = J === 'in' ? 0.005 : 0.1;
  statystyki(); syncJedn(); pdfOpis();
  if (view === 'flat') rozkroj(); else scena();
  zapisz();
}

// ---------------------------------------------------------------- pobieranie
function dlSync() {
  document.querySelectorAll('#dlJedn [data-j]').forEach(b => b.classList.toggle('active', b.dataset.j === dxfJ));
  $('dlGo').disabled = !($('dlZgoda') && $('dlZgoda').checked);
  $('dlHint').textContent = $('dlGo').disabled ? T('Najpierw zaznacz pole powyżej', 'First tick the box above') : T(`${model.stat2.sztuk} elementów · gotowy do cięcia CNC`, `${model.stat2.sztuk} parts · ready for CNC cutting`);
}
$('download').addEventListener('click', () => { dxfJ = J; dlSync(); $('dl').showModal(); $('dl').scrollTop = 0; track('k_okno_pobierania'); });
$('dlX').addEventListener('click', () => $('dl').close());
$('dl').addEventListener('click', e => { const d = $('dl'); if (e.target === d && ((r => e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)(d.getBoundingClientRect()))) d.close(); });
$('dlJedn').addEventListener('click', e => { const b = e.target.closest('[data-j]'); if (!b) return; dxfJ = b.dataset.j; dlSync(); });
$('dl').addEventListener('change', e => { if (e.target.id === 'dlZgoda') dlSync(); });
const nazwaPliku = () => `ogimora-cube-${J === 'in' ? liczba(state.a / CAL, 1, true).replace(/[.,]/, '_') + 'in' : state.a + 'mm'}-${blacha(state.t).kod}-${dxfJ}.dxf`;
$('dlGo').addEventListener('click', () => {
  try {
    const dxf = buildDxf({ parts: czesci }, { jedn: dxfJ, uwagi: [
      `OGIMORA welding cube generator - ogimora.com/cube - test site v${WERSJA}`,
      'License: free, also for selling finished cubes; do not sell or share this file',
      `No warranty: generated by a script, check before cutting. Units: ${dxfJ === 'in' ? 'inches' : 'mm'}, scale 1:1` ] });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([dxf], { type: 'application/dxf' })); a.download = nazwaPliku();
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    track('download', { plik: dxfJ });
    const n = $('dlNotes').value.trim(); if (n) { track('survey', { notes: '[kostka] ' + n.slice(0, 1500) }); $('dlNotes').value = ''; }
    $('dl').close();
    $('note').textContent = dxfJ === 'in' ? T('Gotowe: cale, skala 1:1, tylko kontury do cięcia. Strona zewnętrzna do góry.', 'Done: inches, scale 1:1, cut contours only. Outside face up.')
      : T('Gotowe: mm, skala 1:1, tylko kontury do cięcia. Strona zewnętrzna do góry.', 'Done: millimetres, scale 1:1, cut contours only. Outside face up.');
    $('note').className = 'note ok';
  } catch (err) { console.error(err); $('note').textContent = T('Nie udało się wygenerować pliku. Odśwież stronę i spróbuj ponownie.', 'Could not generate the file. Reload the page and try again.'); $('note').className = 'note'; }
});
$('kLink').addEventListener('click', async () => {
  const url = location.origin + location.pathname + doLinku();
  let ok = false; try { await navigator.clipboard.writeText(url); ok = true; } catch {}
  $('kLinkS').textContent = ok ? T('Skopiowano – wklej, gdzie chcesz', 'Copied – paste it anywhere') : T('Skopiuj adres z paska przeglądarki', 'Copy the address from the browser bar');
  track('k_link'); setTimeout(() => { $('kLinkS').textContent = T('ten adres odtwarza kostkę', 'this address restores the cube'); }, 2600);
});

// ---------------------------------------------------------------- model papierowy (PDF)
let pdfN = 0;                      // 0 = sama dobrana skala (wszystko na jednej kartce), inaczej 1:N
const papier = () => (J === 'in' ? 'Letter' : 'A4');
function pdfPlan() { try { return planPrint({ parts: czesci }, false, J, pdfN || -1); } catch { return null; } }
function pdfOpis() {
  const p = pdfPlan(); if (!p) return;
  $('kPdfB').textContent = T(`Model papierowy ${papier()} (PDF)`, `${papier()} paper model (PDF)`);
  $('pdfSub').textContent = T(`skala 1:${p.N} · ${p.pages.length} ${p.pages.length === 1 ? 'kartka' : p.pages.length < 5 ? 'kartki' : 'kartek'}${p.mode === 'tiles' ? ' do sklejenia' : ''}`,
    `scale 1:${p.N} · ${p.pages.length} ${p.pages.length === 1 ? 'sheet' : 'sheets'}${p.mode === 'tiles' ? ' to tape together' : ''}`);
  $('kPdfSk').innerHTML = `<span>${T('Skala', 'Scale')}</span>` + [[0, 'auto'], [2, '1:2'], [1, '1:1']].map(([n, t]) => `<button type="button" class="chip${n === pdfN ? ' active' : ''}" data-n="${n}">${t}</button>`).join('');
}
$('kPdfSk').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; pdfN = +b.dataset.n; track('k_pdf_skala', { value: pdfN }); pdfOpis(); });
$('pdf').addEventListener('click', async () => {
  try {
    $('note').textContent = T('Przygotowuję PDF…', 'Preparing the PDF…'); $('note').className = 'note';
    track('pdf');
    const plan = await buildPdf({ parts: czesci }, { url: 'ogimora.com/cube', code: `cube-${J === 'in' ? liczba(state.a / CAL, 1, true).replace(/[.,]/, '_') + 'in' : state.a + 'mm'}`, jedn: J, lang: LANG, N: pdfN || -1 });
    $('note').textContent = T(`PDF gotowy: skala 1:${plan.N}, ${plan.pages.length} str. ${papier()}. Drukuj w skali 100%. Sklej z kartonu i sprawdź, czy ścianki pasują.`, `PDF ready: scale 1:${plan.N}, ${plan.pages.length} p. ${papier()}. Print at 100%. Build it from card and check the fit.`);
    $('note').className = 'note ok';
  } catch (err) { console.error(err); $('note').textContent = T('Nie udało się zrobić PDF (sprawdź internet — biblioteka ładuje się z sieci).', 'Could not make the PDF (check your connection – the PDF library loads from the web).'); }
});

// statystyki: kod i opis projektu (bez treści napisów – tylko liczba znaków)
setCodeSource(() => `K${Math.round(state.a)}-${blacha(state.t).kod}-${Math.round(state.c)}`);
setProjektSource(() => ({ model: 'kostka', wym: { bok: Math.round(state.a), wys: Math.round(state.a), kat: 0, dno: Math.round(state.c), nogi: Math.round(state.zw), blacha: blacha(state.t).kod },
  wz: [1, 2, 3, 4, 5, 6].map(n => { const s = state.sc[n]; return 'k-' + (s.typ === 'kropki' ? 'kropki' + s.n : s.typ === 'otwor' ? 'otwor-' + s.ksztalt : s.typ === 'napis' ? 'napis-' + s.font.toLowerCase() : s.typ); }),
  nap: [1, 2, 3, 4, 5, 6].map(n => (state.sc[n].typ === 'napis' ? wiersze(state.sc[n]).join('').length : 0)), otw: 0, mat: 's235', luz: state.g.toFixed(2), jedn: J }));

// ---------------------------------------------------------------- start
$('kPlan').innerHTML = T('<b>Plik DXF — za darmo.</b> Ćwiczysz spoiny, zostaje kostka.', '<b>DXF file — free.</b> Practise your welds, keep the cube.');
$('kDlB').textContent = T('Pobierz plik DXF', 'Download the DXF file');
$('kLinkB').textContent = T('Kopiuj link do projektu', 'Copy a link to this design');
$('kLinkS').textContent = T('ten adres odtwarza kostkę', 'this address restores the cube');
$('kTabFlat').textContent = T('Rozkrój', 'Flat parts');
$('stageHint').textContent = T('Przeciągnij – obrót · kółko – przybliż · kliknij ściankę, aby ją zmienić', 'Drag – rotate · wheel – zoom · click a side to edit it');
if (EN) { document.title = 'OGIMORA — steel welding cube, free DXF'; document.documentElement.lang = 'en';
  $('opisK').innerHTML = `<h1>OGIMORA – steel cube for welding practice (free DXF file)</h1>
    <p>A sheet-steel cube to weld yourself: you practise corner welds and keep the result – a dice, a lantern or a garden piece. Set the side from 4 to 28 in, sheet from 14 ga, dots, numbers or your own lettering on each side, cut corners and an opening in any side.</p>
    <p>The sides meet at their inner edges, which leaves an open groove for the weld on the outside. Locating tabs hold the sides in place while you tack. DXF at 1:1 scale, in millimetres or inches. Free.</p>`; }
pasek(); panelKsztalt(); kamera('iso'); odswiez(); kadr();
track('strona', { value: 'cube' });
