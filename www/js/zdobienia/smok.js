// Smok OGIMORA – kontur z logo marki (4_MARKA_OGIMORA/logo/ogimora-dragon.svg, viewBox 3034×1822).
// Oko (ostatni fragment ścieżki) w sylwetce byłoby wyspą – pomijane; w trybie „kontur” jest wycinane.
import { circle, mul, dist, band, grow, merge, subtract } from './silnik.js';

const D = 'm 1374.1526,1637.0248 c 43.5032,-152.4028 183.6059,-64.7798 180.8919,64.7813 62.3029,-19.931 104.5126,-123.2918 96.5278,-143.2637 85.3532,-1.8879 103.4528,97.1844 92.4,128.35 115.6411,-46.0952 64.4198,-181.3057 49.5875,-217.475 91.8257,5.1024 102.2359,154.3226 93.7,191.55 52.6475,-61.2493 141.4863,-192.2206 52.5,-257.8875 -87.6825,-62.9653 -218.2664,-68.05 -310.9904,-8.617 -99.6834,63.8937 -185.7006,-19.7149 -242.341,44.3603 -56.6404,64.0752 -43.0808,220.8408 -15.4687,266.3068 5.7842,9.5243 -7.7682,-24.8452 3.1929,-68.1052 z m 479.2072,-365.5449 c 146.1321,9.4231 219.6597,47.2461 230.025,163.3375 25.0522,127.6383 118.5965,-129.7603 58.221,-186.471 -140.4858,-131.9582 -270.7394,6.7309 -288.246,23.1335 z m 152,-1176.700013 c 436.6718,278.548623 529.3303,435.552163 252.1799,608.544193 -910.7207,568.45462 -1078.5847,67.24462 -789.6674,18.65581 146.1889,-24.58539 239.5781,11.73527 358.0875,15.6 C 1928.3622,542.31319 1722.8293,319.20547 1487.8561,250.86513 908.15856,82.264042 1157.2475,151.27855 1269.3598,318.77989 1111.0632,279.56163 1057.2715,282.09245 981.10076,284.37595 635.7265,294.72981 1036.4092,396.40048 1175.4935,440.02068 1048.8764,473.58972 941.83606,522.5574 947.45977,587.55489 c 95.99093,-0.52519 266.20643,48.79371 126.93753,145.5625 -70.6886,67.18677 -203.67399,113.23232 -281.53753,34.8625 -67.30164,-101.63653 -90.34737,-228.21542 -95.1,-348.4 -139.77333,77.31176 -243.76198,448.55277 -181.9,502.6 220.79276,-205.93376 2.10992,176.53421 142.5,223.90001 74.90167,-142.542 210.72469,-12.6298 184.9875,79.7 -33.82881,121.3578 -361.50143,87.6774 -426.43248,27.9386 C 135.37903,994.6961 452.90487,479.36442 614.29727,143.57989 418.29889,325.24014 -108.9095,855.61999 92.167763,1343.0783 c 88.418957,214.3482 185.261077,273.49 374.904507,277.4266 431.62917,8.9597 545.58263,-227.0153 1505.98753,-483.325 117.5336,-31.367 285.7261,3.9064 313.2875,141.6875 30.5169,152.5557 -73.3694,283.9128 -148.1875,406.4125 94.5333,77.0908 340.0711,-364.9591 371.7875,-379.425 64.5498,83.614 -29.7892,220.8627 -11.1125,273.6375 136.6791,-77.9019 179.3663,-246.0165 199.5,-393.75 14.9256,-109.5183 0.2238,-216.25535 -32.175,-318.76251 90.9838,71.19748 140.4593,194.53811 114.35,308.28751 29.0097,73.7603 98.3354,-90.2188 104.45,-141.3875 12.5273,-104.83253 -1.3233,-154.328 -49.6788,-241.93854 -171.8515,-311.36087 87.3243,19.84085 81.5788,-25.28647 -64.2915,-432.63652 -536.7774,-595.82741 -911.5,-671.875003 z m -505.4,292.100003 c 225.5188,98.14647 -167.9211,91.28286 0,0 z';

/** Prosty parser ścieżki SVG (M m L l H h V v C c Z z) → lista zamkniętych łamanych. */
function parsePath(d, per = 20) {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const out = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cur = null;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toLowerCase()) {
      case 'm': {
        const nx = num(), ny = num();
        x = rel ? x + nx : nx; y = rel ? y + ny : ny; sx = x; sy = y;
        cur = [[x, y]]; out.push(cur);
        cmd = rel ? 'l' : 'L';                         // kolejne pary = linie
        break;
      }
      case 'l': { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; cur.push([x, y]); break; }
      case 'h': { const nx = num(); x = rel ? x + nx : nx; cur.push([x, y]); break; }
      case 'v': { const ny = num(); y = rel ? y + ny : ny; cur.push([x, y]); break; }
      case 'c': {
        const a = [num(), num(), num(), num(), num(), num()];
        const p0 = [x, y];
        const p1 = rel ? [x + a[0], y + a[1]] : [a[0], a[1]];
        const p2 = rel ? [x + a[2], y + a[3]] : [a[2], a[3]];
        const p3 = rel ? [x + a[4], y + a[5]] : [a[4], a[5]];
        for (let k = 1; k <= per; k++) {
          const t = k / per, u = 1 - t;
          cur.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
        }
        x = p3[0]; y = p3[1];
        break;
      }
      case 'z': x = sx; y = sy; i += 0; cmd = ''; if (i < tok.length && !/[a-zA-Z]/.test(tok[i])) i++; break;
      default: i++;
    }
  }
  return out.map(r => { const q = r.slice(); if (dist(q[0], q[q.length - 1]) < 1e-6) q.pop(); return q; });
}

const RAW = parsePath(D);                           // [łapa, łokieć, ciało, oko] w jednostkach SVG
const VB = { w: 3034, h: 1822 };

/** Pierścień przerwany w n miejscach równomiernie po obwodzie (mostki w konturze). */
function przerwij(ring, n, gap) {
  const pts = ring.concat([ring[0]]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const L = cum[cum.length - 1];
  if (n < 1 || L < n * gap * 3) return [ring.concat([ring[0]])];
  const pieces = [];
  for (let k = 0; k < n; k++) {
    const s0 = (k / n) * L + gap / 2 + L * 0.03, s1 = ((k + 1) / n) * L - gap / 2 + L * 0.03;
    const piece = [];
    for (let i = 0; i < pts.length * 2; i++) {
      const idx = i % (pts.length - 1), s = cum[idx] + (i >= pts.length - 1 ? L : 0);
      if (s >= s0 && s <= s1) piece.push(pts[idx]);
    }
    if (piece.length > 1) pieces.push(piece);
  }
  return pieces;
}

const smok = {
  id: 'smok', nazwa: 'Smok OGIMORA', grupa: 'Znaki główne',
  zrodlo: 'Logo marki OGIMORA (4_MARKA_OGIMORA/logo/ogimora-dragon.svg)',
  size: { def: 420, min: 200, max: 1400 }, sizeLabel: 'Szerokość',
  params: [
    { key: 'tryb', label: 'Wycięcie', options: ['sylwetka', 'kontur', 'podwójny'], def: 'sylwetka' },
    { key: 'przerwy', label: 'Mostki w konturze', min: 2, max: 10, step: 1, def: 4 },
    { key: 'kontur', label: 'Grubość konturu [× mostek]', min: 1.2, max: 5, step: 0.1, def: 2 },
  ],
  make(p, size, w) {
    const k = size / VB.w;
    const tr = r => r.map(([x, y]) => [(x - VB.w / 2) * k, (VB.h / 2 - y) * k]);   // oś y w górę, środek w (0,0)
    const shapes = RAW.slice(0, 3).map(tr), eye = tr(RAW[3]);
    const regions = [];
    if (p.tryb === 'sylwetka') {
      shapes.forEach(r => regions.push(r));            // oko pominięte – byłoby wyspą
      return { regions };
    }
    const cw = Math.max(p.kontur * w, 2 * w);
    const gap = cw + 1.2 * w;                          // przerwa w konturze → mostek ok. 1,2 w
    // kolejność: ciało, łokieć, łapa – każdy następny element trzyma mostek od wcześniejszych
    const els = [];
    [2, 1, 0].forEach(i => {
      const r = shapes[i];
      const n = i === 2 ? p.przerwy : Math.max(1, Math.round(p.przerwy / 2));
      els.push(merge(przerwij(r, n, gap).flatMap(piece => band(piece, cw, true))));
      if (p.tryb === 'podwójny') {
        const inner = grow([r], -(cw / 2 + w * 1.5));
        if (inner.length) els.push(inner);
      }
    });
    if (p.tryb === 'kontur' && size >= 200) els.push(grow([eye], -w / 2));   // w konturze oko można wyciąć (w małym smoku kontur zalewa głowę – oko byłoby wyspą)
    let shadow = [];
    for (const e of els) {
      const cut = shadow.length ? subtract(e, shadow) : e;
      if (cut.length) regions.push({ rings: cut, shrink: false });
      shadow = merge(shadow.concat(grow(e, w)));
    }
    return { regions };
  },
};

export default smok;
export { RAW, VB, przerwij };
