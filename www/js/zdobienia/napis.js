// Napisy do wycinania: dowolny tekst, kilka czcionek (SIL OFL), automatyczne mosty w literach
// z „dziurkami” (O, A, B, D, P, R, Q, 0, 4, 6, 8, 9, ą, ę…), które inaczej by wypadły.
// Czcionki szablonowe (stencil) mają mostki w rysunku liter – tam mosty nie są potrzebne.
import opentype from '../vendor/opentype.module.js';
import { shapes, offsetRings, ringArea, subtract } from './silnik.js';

export const CZCIONKI = {
  'Szablon':  { file: 'SairaStencilOne-Regular.ttf', opis: 'Saira Stencil One – szablonowa, mostki w literach' },
  'Gruba':    { file: 'ArchivoBlack-Regular.ttf',    opis: 'Archivo Black – gruba bezszeryfowa' },
  'Szeryf':   { file: 'AlfaSlabOne-Regular.ttf',     opis: 'Alfa Slab One – gruba szeryfowa' },
  'Odręczna': { file: 'Lobster-Regular.ttf',         opis: 'Lobster – pisana, litery połączone' },
  'Western':  { file: 'Sancreek-Regular.ttf',        opis: 'Sancreek – ozdobna' },
  'Gotyk':    { file: 'PirataOne-Regular.ttf',       opis: 'Pirata One – gotycka' },
};

const fonts = {}, loading = {};
let onLoaded = () => {};
export function setFontsBase(base) { FONT_BASE = base; }
let FONT_BASE = 'fonts/';
export function onFontLoaded(fn) { onLoaded = fn; }
function getFont(name) {
  if (fonts[name]) return fonts[name];
  if (!loading[name]) {
    loading[name] = fetch(FONT_BASE + CZCIONKI[name].file).then(r => r.arrayBuffer()).then(buf => {
      fonts[name] = opentype.parse(buf); onLoaded(name);
    }).catch(err => console.warn('Czcionka nie wczytana:', name, err));
  }
  return null;
}
/** Dla testów w node: wczytanie czcionki z bufora. */
export function addFont(name, arrayBuffer) { fonts[name] = opentype.parse(arrayBuffer); }

/** Ścieżka glifu (komendy opentype) → zamknięte łamane, oś y w górę. */
function pathToRings(cmds, tol = 0.25) {
  const rings = []; let cur = null, x = 0, y = 0;
  const push = (px, py) => cur.push([px, -py]);
  for (const c of cmds) {
    if (c.type === 'M') { cur = []; rings.push(cur); x = c.x; y = c.y; push(x, y); }
    else if (c.type === 'L') { x = c.x; y = c.y; push(x, y); }
    else if (c.type === 'Q') {
      const n = Math.max(4, Math.ceil(Math.hypot(c.x - x, c.y - y) / (tol * 8)));
      for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; push(u * u * x + 2 * u * t * c.x1 + t * t * c.x, u * u * y + 2 * u * t * c.y1 + t * t * c.y); }
      x = c.x; y = c.y;
    } else if (c.type === 'C') {
      const n = Math.max(5, Math.ceil(Math.hypot(c.x - x, c.y - y) / (tol * 8)));
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        push(u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y);
      }
      x = c.x; y = c.y;
    }
  }
  return rings.filter(r => r.length > 2);
}

/** Punkt na pewno wewnątrz pierścienia (środek najdłuższego poziomego odcinka przez środek wysokości). */
function inside(ring) {
  let y0 = Infinity, y1 = -Infinity; ring.forEach(q => { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
  let best = null;
  for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const y = y0 + (y1 - y0) * f, xs = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best.l) best = { l: xs[i + 1] - xs[i], p: [(xs[i] + xs[i + 1]) / 2, y] };
  }
  return best ? best.p : ring[0];
}
/** Odległość od punktu c wzdłuż kierunku d do najdalszego przecięcia z pierścieniem. */
function rayExit(c, d, ring) {
  let tMax = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const e = [b[0] - a[0], b[1] - a[1]], den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - c[0]) * e[1] - (a[1] - c[1]) * e[0]) / den;
    const u = ((a[0] - c[0]) * d[1] - (a[1] - c[1]) * d[0]) / den;
    if (t > 0 && u >= 0 && u < 1 && (tMax == null || t > tMax)) tMax = t;
  }
  return tMax;
}

/** Efekt pasków: wycięcie (litery albo tło) pocięte paskami metalu – wszystko trzyma się blachy, mosty zbędne. */
function paski(shp, p, size, w) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  shp.forEach(s => s.outer.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
  if (!Number.isFinite(x0)) return { regions: [], lines: [] };
  let cut;
  if (p.efekt === 'negatyw') {
    const m = Math.max(2 * w, size * (p.tlo ?? 0.3));
    const R = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]];
    const pos = r => ringArea(r) > 0 ? r : r.slice().reverse();
    cut = [...subtract([R], shp.map(s => pos(s.outer))), ...shp.flatMap(s => s.holes.map(pos))];
  } else cut = shp.flatMap(s => [s.outer, ...s.holes]);
  // paski metalu: okres = pasek + szczelina, pod kątem
  const pw = Math.max(w, (p.pasek ?? 1.3) * w), gap = Math.max(1, p.szczelina ?? 4), T = pw + gap;
  const a = p.kierPaskow === 'pionowe' ? Math.PI / 2 : p.kierPaskow === 'ukośne' ? Math.PI / 4 : 0;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = Math.hypot(x1 - x0, y1 - y0) / 2 + size;
  const u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]], bars = [];
  for (let k = -Math.ceil(L / T); k <= Math.ceil(L / T); k++) {
    const o = k * T + gap / 2;                     // środek szczeliny wypada na środku napisu
    const P = (s, t) => [cx + u[0] * s + n[0] * t, cy + u[1] * s + n[1] * t];
    bars.push([P(-L, o), P(L, o), P(L, o + pw), P(-L, o + pw)]);
  }
  const res = subtract(cut.map(r => r), bars);
  return { regions: shapes(res).map(s => ({ rings: [s.outer, ...s.holes], shrink: false })), lines: [] };
}

const napis = {
  id: 'napis', nazwa: 'Napis', grupa: 'Napisy',
  zrodlo: 'Dowolny tekst. Czcionki: SIL Open Font License. Litery z dziurkami dostają mosty automatycznie.',
  size: { def: 40, min: 12, max: 300 }, sizeLabel: 'Wys. liter',
  params: [
    { key: 'tekst', label: 'Tekst', text: true, def: 'OGIMORA' },
    { key: 'font', label: 'Czcionka', options: Object.keys(CZCIONKI), def: 'Gruba', titles: Object.fromEntries(Object.entries(CZCIONKI).map(([k, v]) => [k, v.opis])) },
    { key: 'odstep', label: 'Odstęp liter', min: -0.05, max: 0.6, step: 0.01, def: 0.06 },
    { key: 'luk', label: 'Łuk', min: -180, max: 180, step: 1, def: 0, unit: '°' },
    { key: 'pogrub', label: 'Pogrubienie', min: -1, max: 3, step: 0.1, def: 0, unit: ' mm' },
    { key: 'mosty', label: 'Mosty', options: ['pionowe', 'poziome', 'ukośne'], def: 'pionowe' },
    { key: 'ile', label: 'Mostów', options: ['1', '2'], def: '2' },
    // efekt jak w logo: litery z pasków (szczeliny) albo negatyw (tło wycięte paskami, litery z metalu)
    { key: 'efekt', label: 'Efekt', options: ['pełne', 'paski', 'negatyw'], def: 'pełne' },
    { key: 'kierPaskow', label: 'Paski', options: ['poziome', 'pionowe', 'ukośne'], def: 'poziome' },
    { key: 'pasek', label: 'Pasek metalu', min: 1, max: 4, step: 0.1, def: 1.3, unit: ' × mostek' },
    { key: 'szczelina', label: 'Szczelina', min: 2, max: 20, step: 0.5, def: 4, unit: ' mm' },
    { key: 'tlo', label: 'Tło (negatyw)', min: 0.1, max: 1, step: 0.05, def: 0.3, unit: ' × wys.' },
  ],
  make(p, size, w) {
    const font = getFont(p.font);
    if (!font || !p.tekst) return { regions: [], lines: [], pending: !font };
    const upm = font.unitsPerEm;
    const cap = (font.tables.os2 && font.tables.os2.sCapHeight) || 0.7 * upm;
    const em = size * upm / cap;                         // rozmiar czcionki, przy którym wielkie litery mają `size` mm
    const sc = em / upm;
    // układ liter w linii (kerning + odstęp)
    const glyphs = font.stringToGlyphs(p.tekst);
    const pos = []; let x = 0;
    glyphs.forEach((g, i) => {
      pos.push(x);
      x += g.advanceWidth * sc + p.odstep * size;
      if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * sc;
    });
    const total = x - p.odstep * size;
    // łuk: litery na okręgu. luk > 0 – środek okręgu pod napisem (łuk jak brama),
    // luk < 0 – środek nad napisem (napis „uśmiechnięty”), góry liter do środka.
    const arc = p.luk * Math.PI / 180, R = Math.abs(arc) > 0.01 ? total / Math.abs(arc) : 0;
    const allRings = [];
    glyphs.forEach((g, i) => {
      const rings = pathToRings(g.getPath(0, 0, em).commands, Math.max(0.1, size / 200));
      const gw = g.advanceWidth * sc;
      const sMid = pos[i] + gw / 2 - total / 2;              // środek litery wzdłuż linii pisma
      let tf;
      if (!R) tf = ([px, py]) => [px + pos[i] - total / 2, py];
      else if (arc > 0) tf = ([px, py]) => {
        const f = (sMid + px - gw / 2) / R, rr = R + py;
        return [rr * Math.sin(f), rr * Math.cos(f) - R];
      };
      else tf = ([px, py]) => {
        const f = (sMid + px - gw / 2) / R, rr = R - py;
        return [rr * Math.sin(f), R - rr * Math.cos(f)];
      };
      rings.forEach(r => allRings.push(r.map(tf)));
    });
    // kształty liter (z dziurkami) – reguła niezerowa jak w czcionce
    let shp = shapes(allRings);
    if (Math.abs(p.pogrub) > 0.01) shp = shapes(offsetRings(shp.flatMap(s => [s.outer, ...s.holes]), p.pogrub));
    if (p.efekt === 'paski' || p.efekt === 'negatyw') return paski(shp, p, size, w);
    const regions = shp.map(s => ({ rings: [s.outer, ...s.holes], shrink: false }));
    // mosty: z dziurki litery (metal, który by wypadł) w wybranym kierunku przez kreskę litery
    // aż za jej zewnętrzny kontur – metal dziurki zostaje połączony z blachą.
    const lines = [];
    const ang = p.mosty === 'poziome' ? 0 : p.mosty === 'ukośne' ? Math.PI / 4 : Math.PI / 2;
    shp.forEach(s => s.holes.forEach(h => {
      if (Math.abs(ringArea(h)) < 2 * w * w) return;           // drobina – wypadnie razem z literą
      const c = inside(h);
      const ends = [];
      // w napisie na łuku most obraca się razem z literą
      const f = !R ? 0 : arc > 0 ? -Math.atan2(c[0], c[1] + R) : Math.atan2(c[0], R - c[1]);
      for (const sg of p.ile === '2' ? [1, -1] : [1]) {
        const d = [Math.cos(ang + f) * sg, Math.sin(ang + f) * sg];
        const t = rayExit(c, d, s.outer);
        if (t != null) ends.push([c[0] + d[0] * (t + w), c[1] + d[1] * (t + w)]);
      }
      if (ends.length === 2) lines.push({ pts: [ends[1], ends[0]] });
      else if (ends.length === 1) lines.push({ pts: [c, ends[0]] });
    }));
    return { regions, lines };
  },
};

export default napis;
