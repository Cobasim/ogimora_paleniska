// Model papierowy na A4 albo US Letter (projekt calowy) (PDF): rozkrój w skali, tak duży jak się da.
// Reguła: wszystko na 1 kartce w największej skali; jeśli wtedy najmniejszy element
// ma < 3 cm², skala rośnie, aż ma ≥ 3 cm² — i element trafia na kolejne kartki.
import { tessellate, polygonArea } from './geometry.js';

import { akt } from './jednostki.js';
// papier: A4 (210 × 297) albo US Letter (215,9 × 279,4) – według jednostek projektu; ustawiany przed każdym planem
const A4 = { w: 210, h: 297 }, LETTER = { w: 215.9, h: 279.4 };
let PAGE = { ...A4, m: 10, head: 16, foot: 10 };
let AREA = { w: PAGE.w - 2 * PAGE.m, h: PAGE.h - 2 * PAGE.m - PAGE.head - PAGE.foot };
function ustawPapier(j = akt()) {
  PAGE = { ...(j === 'in' ? LETTER : A4), m: 10, head: 16, foot: 10 };
  AREA = { w: PAGE.w - 2 * PAGE.m, h: PAGE.h - 2 * PAGE.m - PAGE.head - PAGE.foot };
}
const GAP = 5, LABEL = 0;                       // bez podpisów przy elementach – rysunki same się tłumaczą
const BOX = { w: 66, h: 44 };                   // mały widok w „pudełku” z gabarytem (mm na papierze)
const MIN_AREA = 300; // mm² na papierze = 3 cm²

function items(model, withBox) {
  const out = withBox ? [{ fixed: true, fw: BOX.w, fh: BOX.h, pts: [{ x: 0, y: 0 }], holes: [], area: Infinity }] : [];
  for (const p of model.parts) {
    const pts = tessellate(p.outline, 16).map(([x, y]) => ({ x, y }));
    const holes = (p.holes || []).map(h => tessellate(h, 8).map(([x, y]) => ({ x, y })));
    const lines = p.lines || [];
    for (let k = 1; k <= p.qty; k++) out.push({ part: p, index: k, pts, holes, lines, area: polygonArea(p.outline) });
  }
  return out;
}

function bounds(pts) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const q of pts) { a = Math.min(a, q.x); b = Math.min(b, q.y); c = Math.max(c, q.x); d = Math.max(d, q.y); }
  return { x: a, y: b, w: c - a, h: d - b };
}

/** Pakowanie pasami na strony A4. Zwraca listę stron lub null, gdy element nie mieści się na stronie. */
function pack(list, s, AW = AREA.w, AH = AREA.h) {
  const pieces = list.map(it => {
    if (it.fixed) return { ...it, w: it.fw, h: it.fh, rot: false };
    const bb = bounds(it.pts);
    let w = bb.w * s, h = bb.h * s, rot = false;
    // obróć, jeśli w poziomie się nie mieści albo obrót zmniejsza wysokość pasa
    if ((w > AW && h <= AW) || (h > w && h <= AW)) { rot = true; [w, h] = [h, w]; }
    return { ...it, bb, w, h: h + LABEL, rot };
  });
  if (pieces.some(p => p.w > AW || p.h > AH)) return null;
  pieces.sort((a, b) => b.h - a.h);
  const pages = [];
  let page = [], x = 0, y = 0, rowH = 0;
  for (const p of pieces) {
    if (x > 0 && x + p.w > AW) { x = 0; y += rowH + GAP; rowH = 0; }
    if (y + p.h > AH) { pages.push(page); page = []; x = 0; y = 0; rowH = 0; }
    page.push({ ...p, px: x, py: y });
    x += p.w + GAP; rowH = Math.max(rowH, p.h);
  }
  pages.push(page);
  return pages;
}

export function planPrint(model, withBox = true, j = akt(), wymusN = 0) {   // wymusN > 0: skala 1:N narzucona (kostka)
  ustawPapier(j);
  const list = items(model, withBox);
  // największa skala mieszcząca wszystko na 1 stronie (bisekcja)
  let lo = 1e-4, hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; const r = pack(list, mid); if (r && r.length === 1) lo = mid; else hi = mid; }
  let N = Math.ceil(1 / lo); // ładna skala 1:N
  const minArea = Math.min(...list.map(i => i.area));
  if (wymusN !== -1 && minArea / (N * N) < MIN_AREA) N = Math.floor(Math.sqrt(minArea / MIN_AREA)); // powiększ do ≥3 cm²  (wymusN = −1: zawsze jedna kartka – kostka)
  N = Math.max(1, N);
  if (wymusN > 0) N = wymusN;
  const minAreaCm2 = minArea / (N * N) / 100;
  const pages = pack(list, 1 / N);
  if (pages) return { N, mode: 'pages', pages, minAreaCm2 };
  // Największy element nie mieści się na kartce → plakat: układ na dużym arkuszu
  // pociętym na kartki A4 (do sklejenia, z oznaczeniami kolumn/wierszy).
  const maxSide = Math.max(...list.filter(i => !i.fixed).map(i => { const b = bounds(i.pts); return Math.min(b.w, b.h); })) / N;
  const cols = Math.max(1, Math.ceil((maxSide + GAP) / AREA.w));
  const big = pack(list, 1 / N, cols * AREA.w, Infinity)[0];
  const rows = Math.ceil(Math.max(...big.map(p => p.py + p.h)) / AREA.h);
  const tiles = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = c * AREA.w, y0 = r * AREA.h;
    const hit = big.filter(p => p.px < x0 + AREA.w && p.px + p.w > x0 && p.py < y0 + AREA.h && p.py + p.h > y0);
    if (hit.length) tiles.push({ c, r, x0, y0, items: hit });
  }
  return { N, mode: 'tiles', cols, rows, pages: tiles, minAreaCm2 };
}

// ---- kostka: wszystko na JEDNEJ kartce – nagłówek z logo, dwa widoki (jeden z wymiarami) i cały rozkrój pod spodem
const JEDNA = { naglowek: 20, opis: 18, widoki: 58, skala: 9 };          // wysokości bloków [mm]
const jednaObszar = (opisy = 3) => { const top = PAGE.m + JEDNA.naglowek + (opisy ? 6.5 + (opisy - 1) * 5 + 2 : 0) + JEDNA.widoki + JEDNA.skala; return { top, w: PAGE.w - 2 * PAGE.m, h: PAGE.h - PAGE.m - PAGE.foot - top }; };
/** Plan jednej kartki: największa „ładna” skala 1:N, przy której cały rozkrój mieści się pod widokami. */
export function planJedna(model, j = akt(), opisy = 3) {
  ustawPapier(j);
  const list = items(model, false), A = jednaObszar(opisy);
  let lo = 1e-4, hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, r = pack(list, mid, A.w, A.h); if (r && r.length === 1) lo = mid; else hi = mid; }
  let N = Math.max(1, Math.ceil(1 / lo - 1e-9)), pages = pack(list, 1 / N, A.w, A.h);
  while (!pages || pages.length > 1) { N++; pages = pack(list, 1 / N, A.w, A.h); }
  return { N, mode: 'jedna', pages, obszar: A };
}
function rysujElement(doc, it, s, ox, oy) {
  const map = q => { let x = (q.x - it.bb.x) * s, y = (it.bb.y + it.bb.h - q.y) * s; if (it.rot) [x, y] = [it.bb.h * s - y, x]; return [ox + it.px + x, oy + it.py + y]; };
  doc.setDrawColor(27, 29, 25); doc.setLineWidth(0.25); doc.setLineDashPattern([], 0);
  for (const ring of [it.pts, ...it.holes]) { const R = ring.map(map); for (let i = 0; i < R.length; i++) { const a = R[i], b = R[(i + 1) % R.length]; doc.line(a[0], a[1], b[0], b[1]); } }
}
function stronaJedna(doc, model, extras, EN) {
  const opisy = (extras.opis || []).length, plan = planJedna(model, CALE ? 'in' : 'mm', opisy), A = plan.obszar, AW = A.w;
  const lg = extras.logo; let tx = PAGE.m;
  if (lg) { const h = 15, w = h * lg.w / lg.h; doc.addImage(lg.img, 'PNG', PAGE.m, PAGE.m - 1, w, h, 'logo', 'MEDIUM'); tx += w + 4; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(27, 29, 25); doc.text('OGIMORA', tx, PAGE.m + 9);
  if (extras.code) { doc.setFont('courier', 'bold'); doc.setFontSize(11); doc.text(extras.code, PAGE.w - PAGE.m, PAGE.m + 8, { align: 'right' }); }
  let y = PAGE.m + JEDNA.naglowek;
  (extras.opis || []).forEach((l, i) => { doc.setFont('helvetica', i ? 'normal' : 'bold'); doc.setFontSize(i ? 9.5 : 12); doc.setTextColor(i ? 70 : 27); doc.text(ascii(l), PAGE.m, y + 2); y += i ? 5 : 6.5; });
  if (opisy) y += 2;
  // dwa widoki obok siebie: z wymiarami całości i z przeciwnej strony
  const gap = 6, sw = (AW - gap) / 2, sh = JEDNA.widoki - 3;
  if (extras.box) boxView(doc, extras.box, PAGE.m, y, sw, sh);
  const v = (extras.views || [])[1] || (extras.views || [])[0];
  if (v) { const k = Math.min(sw / v.w, sh / v.h), w = v.w * k, h = v.h * k; doc.addImage(v.img, 'PNG', PAGE.m + sw + gap + (sw - w) / 2, y + (sh - h) / 2, w, h, undefined, 'MEDIUM'); }
  y += JEDNA.widoki;
  const L = CALE ? 50.8 : 50;
  doc.setLineDashPattern([], 0); doc.setDrawColor(27, 29, 25); doc.setLineWidth(0.3);
  doc.line(PAGE.m, y, PAGE.m + L, y); doc.line(PAGE.m, y - 1.5, PAGE.m, y + 1.5); doc.line(PAGE.m + L, y - 1.5, PAGE.m + L, y + 1.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60);
  doc.text(`${CALE ? `2 in = ${2 * plan.N} in` : `5 cm = ${Math.round(5 * plan.N)} cm`}  ·  ${EN ? 'scale' : 'skala'} 1:${plan.N}  ·  ${EN ? 'print at 100%, cut out, tape together' : 'drukuj w 100%, wytnij, sklej'}`, PAGE.m + L + 4, y + 1);
  // rozkrój wyśrodkowany w poziomie w wolnym polu
  const szer = Math.max(...plan.pages[0].map(it => it.px + it.w)), ox = PAGE.m + (AW - szer) / 2;
  for (const it of plan.pages[0]) rysujElement(doc, it, 1 / plan.N, ox, A.top);
  brandFooter(doc, extras);
  return plan;
}

const ascii = s => s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ×·]/g, c => ({ ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z', Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z', '×': 'x', '·': '-' }[c]));

async function loadJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF;
  await new Promise((ok, err) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = ok; s.onerror = () => err(new Error('Nie udało się wczytać biblioteki PDF'));
    document.head.appendChild(s);
  });
  return window.jspdf.jsPDF;
}

/** Stopka każdej kartki: logo smoka i adres strony (prawy dół). */
function brandFooter(doc, extras) {
  const url = (extras && extras.url) || 'ogimora.com', fy = PAGE.h - PAGE.m - 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(27, 29, 25);
  doc.text(url, PAGE.w - PAGE.m, fy + 1, { align: 'right' });
  const lg = extras && extras.logo;
  if (lg) { const h = 6, w = h * lg.w / lg.h; doc.addImage(lg.img, 'PNG', PAGE.w - PAGE.m - doc.getTextWidth(url) - w - 2, fy - h / 2 - 0.5, w, h, 'logo', 'MEDIUM'); }
}

/** Pierwsza kartka: duży smok + OGIMORA, kod paleniska, dwa widoki od góry z przeciwległych stron. */
function viewsPage(doc, model, extras) {
  const lg = extras.logo;
  let tx = PAGE.m;
  if (lg) { const h = 18, w = h * lg.w / lg.h; doc.addImage(lg.img, 'PNG', PAGE.m, PAGE.m - 2, w, h, 'logo', 'MEDIUM'); tx += w + 4; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(27, 29, 25);
  doc.text('OGIMORA', tx, PAGE.m + 10);
  if (extras.code) { doc.setFont('courier', 'bold'); doc.setFontSize(12); doc.text(extras.code, PAGE.w - PAGE.m, PAGE.m + 9, { align: 'right' }); }
  let top = PAGE.m + 22; const bottom = PAGE.h - PAGE.m - 10, gap = 4, AW = PAGE.w - 2 * PAGE.m;
  // kostka: pod nagłówkiem kilka linijek opisu (co to jest, wymiary, adres generatora)
  (extras.opis || []).forEach((l, i) => { doc.setFont('helvetica', i ? 'normal' : 'bold'); doc.setFontSize(i ? 10 : 12); doc.setTextColor(i ? 70 : 27); doc.text(ascii(l), PAGE.m, top + 2); top += i ? 5 : 6.5; });
  if ((extras.opis || []).length) top += 3;
  const slotH = (bottom - top - gap) / 2;
  // kostka: na pierwszej kartce, u góry, widok w pudełku z wymiarami całości (extras.boxTop)
  const przes = extras.boxTop && extras.box ? 1 : 0, obrazy = (extras.views || []).slice(przes && (extras.views || []).length > 1 ? 1 : 0, 2);   // z pudełkiem: drugi widok (z przeciwnej strony)
  if (przes) boxView(doc, extras.box, PAGE.m, top, AW, slotH);
  obrazy.forEach((v, n) => {
    const i = n + przes;
    const y0 = top + i * (slotH + gap), k = Math.min(AW / v.w, slotH / v.h), w = v.w * k, h = v.h * k;
    doc.addImage(v.img, 'PNG', PAGE.m + (AW - w) / 2, y0 + (slotH - h) / 2, w, h, undefined, 'MEDIUM');
  });
  brandFooter(doc, extras);
}

/** Widok w pudełku: krawędzie gabarytu i wymiary (cm albo cale), wpisany jak największy w prostokąt W×H i wyśrodkowany. */
let CALE = false;
const wym = (bx, k) => (CALE && bx.mm ? `${(bx.mm[k] / 25.4).toFixed(1)} in` : `${bx.cm[k]} cm`);
function boxView(doc, bx, x, y, W = BOX.w, H = BOX.h) {
  // obrazek przycinany do rzutu pudełka; wokół miejsce na wymiary
  const fs = Math.max(6.5, Math.min(10, Math.min(W, H) / 9));
  const padL = fs * 1.9, padR = fs * 0.6, padT = fs * 0.6, padB = fs * 0.9;
  const xs = bx.px.map(q => q[0]), ys = bx.px.map(q => q[1]);
  const u0 = Math.min(...xs), u1 = Math.max(...xs), v0 = Math.min(...ys), v1 = Math.max(...ys);
  const k = Math.min((W - padL - padR) / (u1 - u0), (H - padT - padB) / (v1 - v0));
  const ox = x + padL + (W - padL - padR - (u1 - u0) * k) / 2 - u0 * k;
  const oy = y + padT + (H - padT - padB - (v1 - v0) * k) / 2 - v0 * k;
  // obrazek tylko w obrębie rzutu pudełka (bez pustych marginesów renderu)
  doc.saveGraphicsState(); doc.rect(ox + u0 * k, oy + v0 * k, (u1 - u0) * k, (v1 - v0) * k, null); doc.clip(); doc.discardPath();
  doc.addImage(bx.img, 'PNG', ox, oy, bx.w * k, bx.h * k, undefined, 'MEDIUM');   // obrazy kompresowane bezstratnie (Flate)
  doc.restoreGraphicsState();
  const P = bx.px.map(([u, v]) => [ox + u * k, oy + v * k]);
  doc.setDrawColor(120); doc.setLineWidth(0.2); doc.setLineDashPattern([1, 0.8], 0);
  for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (!(i & b)) doc.line(P[i][0], P[i][1], P[i | b][0], P[i | b][1]);
  doc.setLineDashPattern([], 0);
  // szerokość i głębokość przy dolnych krawędziach, na zewnątrz pudełka
  const c = P.reduce((s, q) => [s[0] + q[0] / 8, s[1] + q[1] / 8], [0, 0]);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(fs); doc.setTextColor(60);
  const off = fs * 0.45;
  for (const [i, j, k] of [[5, 4, 'x'], [5, 1, 'z']]) {
    const m = [(P[i][0] + P[j][0]) / 2, (P[i][1] + P[j][1]) / 2], d = [m[0] - c[0], m[1] - c[1]], l = Math.hypot(...d) || 1;
    doc.text(wym(bx, k), m[0] + d[0] / l * off, m[1] + d[1] / l * off + fs * 0.15, { align: 'center' });
  }
  // wysokość przy lewej pionowej krawędzi pudełka, po jej zewnętrznej stronie
  const mh = (P[4][1] + P[6][1]) / 2;
  doc.text(wym(bx, 'y'), Math.min(P[4][0], P[6][0]) - fs * 0.25, mh + fs * 0.15, { align: 'right' });
}

/** Największy wolny prostokąt wokół miejsca na pudełko (rozszerzanie w 4 strony, najlepsza kolejność). */
function freeRect(slot, others, AW, AH) {
  const obs = others.map(o => ({ l: o.px - GAP, t: o.py - GAP, r: o.px + o.w + GAP, b: o.py + o.h + GAP }));
  const grow = (R, dir) => {
    const R2 = { ...R };
    const vo = o => o.t < R.b && o.b > R.t, ho = o => o.l < R.r && o.r > R.l;
    if (dir === 0) R2.l = Math.max(0, ...obs.filter(o => vo(o) && o.r <= R.l).map(o => o.r));
    if (dir === 1) R2.r = Math.min(AW, ...obs.filter(o => vo(o) && o.l >= R.r).map(o => o.l));
    if (dir === 2) R2.t = Math.max(0, ...obs.filter(o => ho(o) && o.b <= R.t).map(o => o.b));
    if (dir === 3) R2.b = Math.min(AH, ...obs.filter(o => ho(o) && o.t >= R.b).map(o => o.t));
    return R2;
  };
  const perms = [[0, 1, 2, 3]];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let m = 0; m < 4; m++) for (let n = 0; n < 4; n++)
    if (new Set([i, j, m, n]).size === 4) perms.push([i, j, m, n]);
  let best = null;
  for (const pm of perms) {
    let R = { l: slot.px, t: slot.py, r: slot.px + slot.w, b: slot.py + slot.h };
    for (let it = 0; it < 2; it++) for (const d of pm) R = grow(R, d);
    const score = Math.min((R.r - R.l) / BOX.w, (R.b - R.t) / BOX.h);
    if (!best || score > best.score) best = { ...R, score };
  }
  return { x: best.l, y: best.t, w: best.r - best.l, h: best.b - best.t };
}

export async function buildPdf(model, extras = {}) {
  const jsPDF = await loadJsPDF();
  CALE = extras.jedn === 'in';
  const EN = extras.lang === 'en';
  if (extras.jedna) {   // kostka, skala „auto”: jedna kartka ze wszystkim
    ustawPapier(CALE ? 'in' : 'mm');
    const doc1 = new jsPDF({ unit: 'mm', format: CALE ? 'letter' : 'a4', compress: true });
    const plan1 = stronaJedna(doc1, model, extras, EN);
    doc1.save(`ogimora-model-${CALE ? 'Letter' : 'A4'}-${extras.code || '1do' + plan1.N}.pdf`);
    return plan1;
  }
  const plan = planPrint(model, !!extras.box && !extras.boxTop, CALE ? 'in' : 'mm', extras.N || 0);
  // compress: strumienie (linie rozkroju) skompresowane – plik kilka razy mniejszy, rysunek bez zmian
  const doc = new jsPDF({ unit: 'mm', format: CALE ? 'letter' : 'a4', compress: true });
  const s = 1 / plan.N;
  const tileName = t => `${String.fromCharCode(65 + t.r)}${t.c + 1}`;
  const first = extras.views && extras.views.length ? 1 : 0;
  if (first) viewsPage(doc, model, extras);
  plan.pages.forEach((pg, pi) => {
    const tiled = plan.mode === 'tiles';
    const page = tiled ? pg.items : pg, sx = tiled ? pg.x0 : 0, sy = tiled ? pg.y0 : 0;
    if (pi || first) doc.addPage();
    // u góry tylko skala: odcinek 5 cm (cale: 2 in) i ile to w palenisku
    const ty = PAGE.m + 4, L = CALE ? 50.8 : 50;
    doc.setLineDashPattern([], 0); doc.setDrawColor(27, 29, 25); doc.setLineWidth(0.3);
    doc.line(PAGE.m, ty, PAGE.m + L, ty); doc.line(PAGE.m, ty - 1.5, PAGE.m, ty + 1.5); doc.line(PAGE.m + L, ty - 1.5, PAGE.m + L, ty + 1.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60);
    doc.text(`${CALE ? `2 in = ${2 * plan.N} in` : `5 cm = ${Math.round(5 * plan.N)} cm`}  ·  ${EN ? 'scale' : 'skala'} 1:${plan.N}`, PAGE.m + L + 4, ty + 1);
    if (tiled) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(27, 29, 25);
      doc.text(tileName(pg), PAGE.w - PAGE.m, PAGE.m + 6, { align: 'right' });
      doc.setDrawColor(170); doc.setLineWidth(0.15); doc.setLineDashPattern([0.8, 0.8], 0);
      doc.rect(PAGE.m, PAGE.m + PAGE.head, AREA.w, AREA.h);
      doc.saveGraphicsState(); doc.rect(PAGE.m, PAGE.m + PAGE.head, AREA.w, AREA.h, null); doc.clip(); doc.discardPath();
    }
    const ox = PAGE.m - sx, oy = PAGE.m + PAGE.head - sy;
    for (const it of page) {
      if (it.fixed) {
        if (!extras.box) continue;
        if (tiled) { boxView(doc, extras.box, ox + it.px, oy + it.py); continue; }
        const R = freeRect(it, page.filter(o => o !== it), AREA.w, AREA.h);
        boxView(doc, extras.box, ox + R.x, oy + R.y, R.w, R.h);
        continue;
      }
      const map = q => {
        let x = (q.x - it.bb.x) * s, y = (it.bb.y + it.bb.h - q.y) * s; // y w dół
        if (it.rot) [x, y] = [it.bb.h * s - y, x];
        return [ox + it.px + x, oy + it.py + LABEL + y];
      };
      doc.setDrawColor(27, 29, 25); doc.setLineWidth(0.25); doc.setLineDashPattern([], 0);
      for (const ring of [it.pts, ...it.holes]) {
        const R = ring.map(map);
        for (let i = 0; i < R.length; i++) { const a = R[i], b = R[(i + 1) % R.length]; doc.line(a[0], a[1], b[0], b[1]); }
      }
      doc.setLineWidth(0.15);
      for (const l of it.lines || []) { const R = l.map(map); for (let i = 1; i < R.length; i++) doc.line(R[i - 1][0], R[i - 1][1], R[i][0], R[i][1]); }
      doc.setDrawColor(59, 111, 214); doc.setLineDashPattern([1.6, 1.2], 0);
      for (const [a, b] of it.part.folds || []) { const A = map(a), B = map(b); doc.line(A[0], A[1], B[0], B[1]); }
    }
    if (tiled) doc.restoreGraphicsState();
    brandFooter(doc, extras);
  });
  doc.save(`ogimora-model-${CALE ? 'Letter' : 'A4'}-${extras.code || '1do' + plan.N}.pdf`);
  return plan;
}
