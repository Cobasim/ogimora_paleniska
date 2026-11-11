// Ogień w palenisku – podgląd wieczorny: żar na dnie, płomienie i światło z cieniami.
// Światło wychodzi na zewnątrz tylko przez to, co naprawdę jest wycięte (wzory, szczeliny gięcia, podcięcia),
// bo ścianki rzucają cień – blaski na ziemi i w otworach to wynik geometrii, a nie dorysowany efekt.
import * as THREE from 'three';

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// płomień: trzy warstwy „kropli” (czerwona, pomarańczowa, jasny rdzeń), rozmyte
const flameTex = () => canvasTex(128, 256, (g, w, h) => {
  g.filter = 'blur(6px)';
  const drop = (sx, sy, c0, c1) => {
    const cx = w / 2, base = h * 0.9, top = h * (0.96 - sy * 0.86), r = w * 0.34 * sx;
    const gr = g.createLinearGradient(0, base, 0, top); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx, top);
    g.bezierCurveTo(cx + r * 0.3, base - (base - top) * 0.55, cx + r * 1.15, base - r * 0.95, cx + r * 0.8, base - r * 0.25);
    g.quadraticCurveTo(cx, base + r * 0.4, cx - r * 0.8, base - r * 0.25);
    g.bezierCurveTo(cx - r * 1.15, base - r * 0.95, cx - r * 0.3, base - (base - top) * 0.55, cx, top);
    g.fill();
  };
  drop(1, 1, 'rgba(255,80,15,.85)', 'rgba(170,25,0,0)');
  drop(.7, .7, 'rgba(255,160,45,.95)', 'rgba(255,90,15,0)');
  drop(.42, .42, 'rgba(255,240,185,1)', 'rgba(255,190,80,0)');
});
// poświata przy ściankach: jasna przy żarze, wygasa ku górze (u = wysokość)
const hazeTex = () => canvasTex(4, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, h, 0, 0);
  gr.addColorStop(0, 'rgba(255,175,75,1)'); gr.addColorStop(.45, 'rgba(255,115,35,.85)'); gr.addColorStop(1, 'rgba(210,55,10,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const glowTex = () => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,150,60,1)'); gr.addColorStop(.4, 'rgba(255,90,25,.45)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
// żar na dnie: ciemnoczerwone tło, jasne węgielki, kilka polan
const emberTex = () => canvasTex(256, 256, (g, w) => {
  seed = 11;
  g.fillStyle = '#3a0a02'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w, y = rnd() * w, r = 3 + rnd() * 11, d = Math.hypot(x - w / 2, y - w / 2) / (w / 2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `hsla(${18 + rnd() * 22},100%,${48 + rnd() * 18 - d * 18}%,.95)`); gr.addColorStop(1, 'hsla(10,100%,20%,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 4; i++) {
    g.save(); g.translate(w * (.3 + rnd() * .4), w * (.3 + rnd() * .4)); g.rotate(rnd() * Math.PI);
    const L = w * (.35 + rnd() * .2), T = w * (.03 + rnd() * .02);
    g.filter = 'blur(1.5px)'; g.fillStyle = 'rgba(40,14,6,.85)'; g.fillRect(-L / 2, -T / 2, L, T);
    g.fillStyle = 'rgba(255,110,30,.5)'; g.fillRect(-L / 2, -T * .1, L, T * .2); g.filter = 'none';
    g.restore();
  }
  // brzegi ciemniejsze (przy ściankach żar słabszy)
  const v = g.createRadialGradient(w / 2, w / 2, w * .2, w / 2, w / 2, w * .72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,4,0,.75)');
  g.fillStyle = v; g.fillRect(0, 0, w, w);
});

export const FIRE_POWER = 40;   // jasność ognia (współczynnik; skalowany z wielkością dna)

export function createFire(scene) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const light = new THREE.PointLight(0xff8a3a, 0, 0, 1);
  light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.003; light.shadow.normalBias = 1;
  light.shadow.camera.near = 5; light.shadow.camera.far = 8000;
  light.visible = false; scene.add(light);
  const tex = { flame: flameTex(), glow: glowTex(), ember: emberTex(), haze: hazeTex() };
  // Poświata tuż za ściankami (od środka), widoczna tylko przez otwory: ściany zasłaniają resztę.
  // Ściany poświaty są skierowane na zewnątrz – patrząc do środka misy od góry, ich nie widać (odrzucone tyły).
  const haze = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: tex.haze, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, toneMapped: false, opacity: .9 }));
  group.add(haze);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex.ember, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  bed.rotation.x = -Math.PI / 2; group.add(bed);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: .5 }));
  group.add(glow);
  let flames = [], I0 = 0;

  /** floor – Box3 dna (współrzędne sceny, y w górę); d – wymiary misy: base, height, angle (°), t, legHeight;
   *  power – mnożnik jasności (Rysunek ma białe blachy, więc słabiej). */
  function place(floor, d, power = 1) {
    const wallH = d.height;
    const sx = floor.max.x - floor.min.x, sz = floor.max.z - floor.min.z, s = Math.min(sx, sz);
    const c = floor.getCenter(new THREE.Vector3()), y0 = floor.max.y;
    bed.scale.set(sx * .88, sz * .88, 1); bed.position.set(c.x, y0 + .5, c.z);
    flames.forEach(f => { group.remove(f); f.material.dispose(); }); flames = [];
    seed = 7;
    const n = Math.max(3, Math.min(9, Math.round(s / 100)));
    const H = Math.min(wallH * 1.05, s * .62);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rnd(), r = (i === 0 ? 0 : .14 + rnd() * .16) * s;
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flame, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      f.center.set(.5, .1);   // podstawa płomienia na żarze
      const h = H * (i === 0 ? 1 : .45 + rnd() * .4);
      f.userData = { h, w: h * .5, ph: rnd() * 10, sp: 5 + rnd() * 4 };
      f.position.set(c.x + Math.cos(a) * r, y0 + 1, c.z + Math.sin(a) * r);
      f.scale.set(f.userData.w, h, 1); group.add(f); flames.push(f);
    }
    // poświata: 4 trapezy wzdłuż ścianek, cofnięte do środka o grubość blachy + 2 mm
    {
      const ta = Math.tan(d.angle * Math.PI / 180), ins = d.t / Math.cos(d.angle * Math.PI / 180) + 2;
      const yA = y0 + 1, yB = d.legHeight + d.height * .9, half = y => d.base / 2 + (y - d.legHeight) * ta - ins;
      const hA = half(yA), hB = half(yB), pos = [], uv = [];
      const corners = (h, y) => [[h, y, h], [-h, y, h], [-h, y, -h], [h, y, -h]];
      const A = corners(hA, yA), B = corners(hB, yB);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4, P = [A[i], A[j], B[j], B[i]].map(p => [p[0] + c.x, p[1], p[2] + c.z]);
        // kolejność tak, żeby przód był na zewnątrz misy
        const mx = (P[0][0] + P[1][0]) / 2 - c.x, mz = (P[0][2] + P[1][2]) / 2 - c.z;
        const e1 = P[1].map((v, k) => v - P[0][k]), e2 = P[2].map((v, k) => v - P[0][k]);
        const nx = e1[1] * e2[2] - e1[2] * e2[1], nz = e1[0] * e2[1] - e1[1] * e2[0];
        const q = nx * mx + nz * mz > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        const U = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (const k of q) { pos.push(...P[k]); uv.push(...U[k]); }
      }
      haze.geometry.dispose();
      haze.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    glow.scale.set(s * 1.15, s * 1.15, 1); glow.position.set(c.x, y0 + H * .3, c.z);
    light.position.set(c.x, y0 + wallH * .8, c.z);   // źródło światła wysoko (płomienie zostają nisko) – ładniejsze cienie wzorów
    I0 = FIRE_POWER * power * s / 2;
    flicker(performance.now() / 1000);
  }
  function flicker(t0) {
    // spokojny żar: wolne, małe wahania (wcześniej migało za szybko i za mocno)
    const t = t0 * .45;
    const k = .93 + .035 * Math.sin(t * 7.1) + .022 * Math.sin(t * 12.7 + 1.3) + .012 * Math.sin(t * 23.3 + .4);
    light.intensity = I0 * k;
    for (const f of flames) {
      const u = f.userData, q = .9 + .07 * Math.sin(t * u.sp + u.ph) + .03 * Math.sin(t * u.sp * 2.3 + u.ph * 1.7);
      f.scale.set(u.w * (1.04 - .06 * q), u.h * q, 1);
      f.material.rotation = .04 * Math.sin(t * u.sp * .6 + u.ph);
    }
    glow.material.opacity = .5 * k;
    haze.material.opacity = .85 + .15 * k;
  }
  // PROSTY: bez płomieni i żaru na dnie – zostaje samo światło (widać dno i jego otwory)
  function show(on) { group.visible = false; light.visible = on; }
  return { place, flicker, show, light };
}
