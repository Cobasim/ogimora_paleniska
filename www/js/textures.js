// Proceduralne powierzchnie stali: zgorzelina, nalot, rdza, patyna stali patynującej, farba.
// Szum wartości z okresowymi siatkami → tekstura kafelkuje się bez szwów.
import * as THREE from 'three';

// Wykończenia dostępne dla gatunku stali (kolejność = kolejność przycisków).
export const FINISHES = {
  // Ten sam układ trzech przycisków dla obu gatunków — przełączenie materiału nie przesuwa przycisków.
  s235: [
    { id: 'mill',  name: 'Surowa',     hint: 'zgorzelina walcownicza, prosto z huty' },
    { id: 'flash', name: 'Nalot',      hint: 'pierwsza rdza po kilku tygodniach na deszczu' },
    { id: 'paint', name: 'Czarny mat', hint: 'farba żaroodporna' },
  ],
  weather: [
    { id: 'mill',   name: 'Surowa',     hint: 'stal patynująca prosto z huty, zanim zrobi patynę' },
    { id: 'c_ripe', name: 'Nalot',      hint: 'ciepła, rdzawa patyna stali patynującej (po kilku miesiącach)' },
    { id: 'paint',  name: 'Czarny mat', hint: 'farba żaroodporna' },
  ],
};

// Parametry: base = metal pod spodem, rust = paleta tlenków, cover = pokrycie rdzą (0–1),
// streak = zacieki, pits = wżery, flake = łuszczenie, scale = mm na kafel.
const LOOKS = {
  mill:    { base: [[0, [56, 58, 61]], [.5, [72, 74, 77]], [1, [88, 89, 91]]], rust: [[0, [96, 58, 36]], [1, [140, 82, 46]]],
             cover: .04, streak: .15, pits: .1, flake: 0, metal: .55, rough: [.45, .85], scale: 385 },
  flash:   { base: [[0, [55, 58, 62]], [.6, [78, 80, 84]], [1, [98, 98, 98]]], rust: [[0, [118, 62, 32]], [.5, [160, 88, 44]], [1, [186, 120, 70]]],
             cover: .38, streak: .35, pits: .25, flake: 0, metal: .45, rough: [.5, .9], scale: 330 },
  rusty:   { base: [[0, [50, 46, 44]], [1, [76, 70, 66]]], rust: [[0, [58, 32, 22]], [.3, [96, 48, 26]], [.6, [138, 70, 34]], [.85, [168, 98, 52]], [1, [120, 92, 70]]],
             cover: .86, streak: .7, pits: .7, flake: .6, metal: .15, rough: [.6, .96], scale: 286 },
  paint:   { base: [[0, [30, 31, 32]], [1, [40, 40, 41]]], rust: [[0, [84, 46, 30]], [1, [110, 62, 38]]],
             cover: .015, streak: .1, pits: .05, flake: 0, metal: .1, rough: [.78, .9], scale: 440 },
  c_fresh: { base: [[0, [74, 62, 56]], [1, [96, 80, 70]]], rust: [[0, [150, 70, 30]], [.4, [186, 96, 44]], [.75, [206, 124, 64]], [1, [176, 112, 72]]],
             cover: .9, streak: .45, pits: .2, flake: .1, metal: .1, rough: [.6, .9], scale: 357 },
  // stal patynująca: aksamitna, ciepła patyna — drobne ziarno, łagodne przejścia czekolada → palona pomarańcz → bursztyn
  c_ripe:  { base: [[0, [86, 40, 22]], [1, [110, 52, 28]]],
             rust: [[0, [70, 30, 17]], [.3, [102, 42, 21]], [.5, [128, 56, 26]], [.7, [154, 74, 34]], [.88, [178, 98, 50]], [1, [170, 108, 70]]],
             cover: 1, streak: .22, pits: .06, flake: 0, metal: .04, rough: [.82, .95], scale: 300, contrast: .38, grain: .55, bump: .5 },
  c_old:   { base: [[0, [52, 38, 36]], [1, [70, 52, 46]]], rust: [[0, [48, 28, 26]], [.4, [74, 40, 32]], [.75, [98, 54, 38]], [1, [112, 74, 58]]],
             cover: .98, streak: .35, pits: .3, flake: 0, metal: .08, rough: [.75, .95], scale: 357 },
};

const N = 768;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function grid(rand, nx, ny) { return { nx, ny, v: Float32Array.from({ length: nx * ny }, rand) }; }
const sm = t => t * t * (3 - 2 * t);
function noise(g, x, y) { // x, y w pikselach tekstury
  const gx = x / N * g.nx, gy = y / N * g.ny, ix = Math.floor(gx), iy = Math.floor(gy), fx = sm(gx - ix), fy = sm(gy - iy);
  const at = (a, b) => g.v[(((b % g.ny) + g.ny) % g.ny) * g.nx + (((a % g.nx) + g.nx) % g.nx)];
  const t = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx, u = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
  return t + (u - t) * fy;
}
function fbm(gs, x, y) { let s = 0, a = .5, n = 0; for (const g of gs) { s += noise(g, x, y) * a; n += a; a *= .5; } return s / n; }
function ramp(stops, v) {
  let i = 0; while (i < stops.length - 2 && v > stops[i + 1][0]) i++;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1], t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return [0, 1, 2].map(k => ca[k] + (cb[k] - ca[k]) * t);
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeMaterial(id, renderer) {
  const L = LOOKS[id], rand = rng(9157 + id.length * 31);
  const big = [4, 8, 16, 32, 64].map(n => grid(rand, n, n));
  const mid = [12, 24, 48, 96].map(n => grid(rand, n, n));
  const fine = [128, 256, 384].map(n => grid(rand, n, n));
  const streakG = [grid(rand, 96, 6), grid(rand, 192, 12)];
  const warp = [grid(rand, 6, 6), grid(rand, 6, 6)];

  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const cC = mk(), cB = mk(), cR = mk();
  const dC = cC.getContext('2d').createImageData(N, N), dB = cB.getContext('2d').createImageData(N, N), dR = cR.getContext('2d').createImageData(N, N);

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const wx = x + (noise(warp[0], x, y) - .5) * 120, wy = y + (noise(warp[1], x, y) - .5) * 120;
    const b = fbm(big, wx, wy), m = fbm(mid, wx, wy), f = fbm(fine, x, y);
    const st = fbm(streakG, x, y);
    // maska rdzy: duże plamy + zacieki w pionie
    const field = b * .45 + m * .33 + (st - .5) * L.streak * .5 + f * .22;
    const thr = 1 - L.cover;
    const mask = smoothstep(thr - .06, thr + .06, field + (L.cover > .5 ? (L.cover - .5) * .5 : 0));
    // kolor metalu i tlenków
    const base = ramp(L.base, Math.min(1, Math.max(0, (m - .5) * 1.5 + .5 + (f - .5) * .4)));
    const C = L.contrast ?? 1;
    const rv = Math.min(1, Math.max(0, ((fbm(mid, wx * 1.3 + 200, wy * 1.3) - .5) * 1.5 + (f - .5) * .9 + (st - .5) * .3) * C + .5 + (b - .5) * (1 - C) * .9));
    const rust = ramp(L.rust, rv);
    // łuszczenie: ostre krawędzie płatów odsłaniające ciemniejszą warstwę
    const flakeN = noise(mid[2], wx * 1.7, wy * 1.7);
    const flake = L.flake * smoothstep(.62, .66, flakeN) * mask;
    // wżery
    const pit = smoothstep(.78 - L.pits * .12, .84, noise(fine[1], x, y) * .7 + noise(fine[2], x, y) * .3) * (.4 + .6 * mask) * Math.min(1, L.pits * 1.6);
    const grain = ((noise(fine[2], x * 1.5, y * 1.5) - .5) * 22 + (noise(fine[0], x, y) - .5) * 14) * (L.grain ?? 1);
    const i = (y * N + x) * 4;
    for (let k = 0; k < 3; k++) {
      let v = base[k] + (rust[k] - base[k]) * mask;
      v *= 1 - flake * .35 - pit * .45;
      dC.data[i + k] = Math.max(0, Math.min(255, v + grain));
    }
    dC.data[i + 3] = 255;
    const h = 128 + (mask * 40 * (1 + L.flake) + (f - .5) * 50 * (.3 + mask) - pit * 70 - flake * 30) * (L.bump ?? 1);
    dB.data[i] = dB.data[i + 1] = dB.data[i + 2] = Math.max(0, Math.min(255, h)); dB.data[i + 3] = 255;
    if (L.scaleTex) {}
    const r = (L.rough[0] + (L.rough[1] - L.rough[0]) * mask + (f - .5) * .08) * 255;
    dR.data[i] = dR.data[i + 1] = dR.data[i + 2] = Math.max(0, Math.min(255, r)); dR.data[i + 3] = 255;
  }
  cC.getContext('2d').putImageData(dC, 0, 0); cB.getContext('2d').putImageData(dB, 0, 0); cR.getContext('2d').putImageData(dR, 0, 0);
  const tex = [cC, cB, cR].map(c => {
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / L.scale, 1 / L.scale); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  });
  tex[0].colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex[0], bumpMap: tex[1], bumpScale: 2.2, roughnessMap: tex[2], roughness: 1, metalness: L.metal, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
}

// Wszystkie wykończenia są ciemne lub średnie → krawędzie zawsze jasne (czytelne także na nalocie).
export function isDark() { return true; }
