// Parzenica podhalańska – model z części, tak jak opisał ją T. Seweryn („Parzenice góralskie”, 1930):
//   • ozdoba wykroju przypora (pas U, podwójny, z kluczkami-„rakami”, z mirwą),
//   • OGNIWKA (kluczki, kule) – po bokach środka, wachlarzem, zwykle po 4 z każdej strony,
//     zwinięte w ślimaki; krawiec „przerywał pętlę w miejscach zgrubień” – to jest nasz mostek,
//   • środkowa GWIAZDA / RÓŻA (koło pełne, dzielone, krzyż, gwiazdy 6- i 8-ramienne, ośmina),
//   • dolne KRZESIWKO w trójkątnej „kotwicy” obramionej kółkami, mirwą lub pasem, z dziobem.
// Krawcy wytyczali kontury drewnianą formą (ryc. 17) – stąd stały szkielet i zmienne wypełnienia.
import {
  P, add, sub, mul, lerp, dist, arc, circle, arcAB, lens, bezier, taper, band, grow, merge, subtract, mirrorX,
} from './silnik.js';

const TAU = Math.PI * 2, D = Math.PI / 180;

// ---------------------------------------------------------------- ogniwko (kluczek)
/**
 * Kształt ogniwka: od nasady przy środku (cienkiej) przez zgrubienie do końca zwiniętego
 * w ślimak. heading – kierunek startu; turn = +1 zwija w lewo (CCW), -1 w prawo.
 * bend – ogólne wygięcie, curl – siła zawinięcia końca; wh – największa grubość.
 */
export function ogniwkoKsztalt(p0, heading, L, bend, curl, turn, wh, wb = 0.55, we = 0.6) {
  // ogniwko = wydłużona pętla wzdłuż wygiętej osi; koniec może się zawijać (kluczek)
  const N = 120, c = [p0];
  let pos = p0, hd = heading;
  for (let i = 1; i <= N; i++) {
    const t = i / N, ds = L / N;
    hd += turn * (bend + curl * 7 * t ** 3) / L * ds;
    pos = add(pos, [ds * Math.cos(hd), ds * Math.sin(hd)]);
    c.push(pos);
  }
  const wFn = t => {
    const grow = wb + (1 - wb) * Math.sin(Math.PI / 2 * Math.min(1, t / 0.35));
    const end = t < 0.7 ? 1 : 1 - (1 - we) * ((t - 0.7) / 0.3);
    return wh * grow * end;
  };
  const body = taper(c, wFn);
  const shape = merge([body, circle(p0, wh * wb / 2), circle(c[N], wh * we / 2)]);
  shape.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  return { ring: shape[0], base: p0, end: c[N], center: c };
}
/** Odcinek przycięty do wielokąta wypukłego (Cyrus–Beck). */
function clipSeg(a, b, poly) {
  let t0 = 0, t1 = 1;
  const d = sub(b, a);
  const sgn = Math.sign(area(poly)) || 1;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const e = sub(q, p), nIn = [-e[1] * sgn, e[0] * sgn];
    const num = (a[0] - p[0]) * nIn[0] + (a[1] - p[1]) * nIn[1];
    const den = d[0] * nIn[0] + d[1] * nIn[1];
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue; }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [lerp(a, b, t0), lerp(a, b, t1)];
}
function area(r) { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }

/** Obrys kształtu jako sznur przerwany u nasady (kluczek). */
function petlaPrzerwana(ring, base, gap) {
  let k = 0, best = Infinity;
  ring.forEach((q, i) => { const d = dist(q, base); if (d < best) { best = d; k = i; } });
  const rot = ring.slice(k).concat(ring.slice(0, k));
  return rot.filter(q => dist(q, base) > gap);
}

// ---------------------------------------------------------------- wzory z rycin
// Pełne opisy wzorów (podpowiedź na przycisku)
export const OPISY = {
  'Zakopane VI': 'Parzenica z Zakopanego – Seweryn, tabl. VI',
  'Poronin VIII': 'Parzenica z Poronina, 1901 – tabl. VIII',
  'Kościelisko 24': 'Stara, czerwono wyszywana parzenica z Kościelisk – ryc. 24',
  'Kościelisko 25': 'Parzenica krawca Jana Pitonia z Kościelisk, 1910 – ryc. 25',
  'Zakopane 26': 'Parzenica zakopiańska z 1909 – ryc. 26',
  'Bukowina VII': 'Parzenica z Bukowiny, 1911 – tabl. VII',
  'Podhale X': 'Parzenica podhalańska – tabl. X',
};
// Wzory odczytane z rycin Seweryna – punkt wyjścia do dalszej regulacji suwakami.
export const WZORY = {
  'Zakopane VI': { ogn: 3, fanTop: 30, fanBot: -40, rozchyl: 0.45, dl: 0.40, szer: 0.075, zag: 0.7, zaw: 0.9, kula: 0.5, kier: 'w dół', zmn: 0.15, ogniwka: 'pętla', przypor: 'podwójny', przyOzd: 'kółka', srodek: 'gwiazda 6', osmina: 'tak', obram: 'kratka', krzes: 'romb', dziob: 'tak' },
  'Poronin VIII': { ogn: 4, fanTop: 55, fanBot: -45, rozchyl: 0.6, dl: 0.34, szer: 0.085, zag: 0.4, zaw: 1.1, kula: 0.7, kier: 'od osi', zmn: 0.15, ogniwka: 'podwójne', przypor: 'potrójny', przyOzd: 'nic', srodek: 'gwiazda 8', osmina: 'nie', obram: 'mirwa', krzes: 'ślimaki', dziob: 'tak' },
  'Kościelisko 24': { ogn: 2, fanTop: 40, fanBot: -15, rozchyl: 0.8, dl: 0.42, szer: 0.08, zag: 1.1, zaw: 0.8, kula: 0.6, kier: 'w dół', zmn: 0.0, ogniwka: 'pętla', przypor: 'podwójny', przyOzd: 'kółka', srodek: 'pełne', osmina: 'nie', obram: 'pas z kółkami', krzes: 'półksiężyce', dziob: 'tak' },
  'Kościelisko 25': { ogn: 3, fanTop: 55, fanBot: -40, rozchyl: 0.7, dl: 0.36, szer: 0.075, zag: 1.0, zaw: 0.9, kula: 0.6, kier: 'w dół', zmn: 0.25, ogniwka: 'pełne', przypor: 'pas', przyOzd: 'kółka', srodek: 'słońce', osmina: 'nie', obram: 'mirwa', krzes: 'ślimaki', dziob: 'tak' },
  'Zakopane 26': { ogn: 3, fanTop: 60, fanBot: -40, rozchyl: 0.75, dl: 0.34, szer: 0.08, zag: 0.6, zaw: 1.5, kula: 0.35, kier: 'w dół', zmn: 0.2, ogniwka: 'pełne', przypor: 'pas', przyOzd: 'nic', srodek: 'gwiazda 6', osmina: 'nie', obram: 'kółka', krzes: 'kropla', dziob: 'tak' },
  'Bukowina VII': { ogn: 4, fanTop: 50, fanBot: -60, rozchyl: 0.9, dl: 0.30, szer: 0.075, zag: 0.3, zaw: 0.6, kula: 1.1, kier: 'od osi', zmn: 0.2, ogniwka: 'podwójne', przypor: 'pas', przyOzd: 'nic', srodek: 'gwiazda 8', osmina: 'tak', obram: 'brak', krzes: 'serce', dziob: 'tak' },
  'Podhale X': { ogn: 4, fanTop: 75, fanBot: -20, rozchyl: 0.85, dl: 0.30, szer: 0.08, zag: 0.35, zaw: 1.7, kula: 0.3, kier: 'w dół', zmn: 0.15, ogniwka: 'pełne', przypor: 'potrójny', przyOzd: 'nic', srodek: 'gwiazda 6', osmina: 'tak', obram: 'pas', krzes: 'ślimaki', dziob: 'tak' },
};

const parzenica = {
  id: 'parzenica', nazwa: 'Parzenica podhalańska', grupa: 'Znaki główne',
  zrodlo: 'T. Seweryn, Parzenice góralskie (1930): ryc. 17, 24–27, tabl. VI–X; budowa: przypór, ogniwka, gwiazda, krzesiwko',
  size: { def: 340, min: 160, max: 900 },
  params: [
    { key: 'wzor', label: 'Wzór', options: ['własny', ...Object.keys(WZORY)], def: 'Zakopane VI', preset: true, titles: OPISY },
    { key: 'ogn', label: 'Ogniwka', min: 1, max: 6, step: 1, def: 3 },
    { key: 'fanTop', label: 'Najwyższe', min: -10, max: 100, step: 1, def: 30, unit: '°' },
    { key: 'fanBot', label: 'Najniższe', min: -80, max: 20, step: 1, def: -40, unit: '°' },
    { key: 'rozchyl', label: 'Rozchylenie', min: 0.2, max: 1.2, step: 0.01, def: 0.45 },
    { key: 'dl', label: 'Długość', min: 0.15, max: 0.5, step: 0.01, def: 0.40 },
    { key: 'szer', label: 'Szerokość', min: 0.035, max: 0.13, step: 0.005, def: 0.075 },
    { key: 'zag', label: 'Wygięcie', min: -1, max: 2, step: 0.05, def: 0.7 },
    { key: 'zaw', label: 'Zawinięcie', min: 0, max: 2.5, step: 0.05, def: 0.9 },
    { key: 'kula', label: 'Koniec (kula)', min: 0.2, max: 1.3, step: 0.01, def: 0.5 },
    { key: 'zmn', label: 'Mniejsze w dół', min: 0, max: 0.6, step: 0.01, def: 0.15 },
    { key: 'kier', label: 'Kierunek', options: ['w dół', 'w górę', 'od osi'], def: 'w dół' },
    { key: 'ogniwka', label: 'Ogniwko', options: ['pętla', 'podwójne', 'pełne'], def: 'pętla' },
    { key: 'przypor', label: 'Przypór', options: ['brak', 'pas', 'podwójny', 'potrójny'], def: 'podwójny' },
    { key: 'przyOzd', label: 'Przy przyporze', options: ['nic', 'kółka', 'kluczki'], def: 'kółka' },
    { key: 'srodek', label: 'Gwiazda', options: ['pełne', '4 części', '8 części', 'krzyż', 'gwiazda 6', 'gwiazda 8', 'słońce'], def: 'gwiazda 6' },
    { key: 'osmina', label: 'Ośmina', options: ['tak', 'nie'], def: 'tak' },
    { key: 'obram', label: 'Kotwica', options: ['brak', 'pas', 'pas z kółkami', 'kółka', 'mirwa', 'kratka'], def: 'kratka' },
    { key: 'krzes', label: 'Krzesiwko', options: ['brak', 'romb', 'ślimaki', 'półksiężyce', 'serce', 'kropla'], def: 'romb' },
    { key: 'dziob', label: 'Dziób', options: ['tak', 'nie'], def: 'tak' },
  ],
  presets: WZORY,
  make(p, size, w) {
    let u = size, spec;
    for (let k = 0; k < 3; k++) {                       // dopasowanie wysokości na szybkiej wersji
      const b = bounds(build1(p, u, w, false));
      if (b.h <= size * 1.01 && b.h >= size * 0.98) break;
      u *= size / b.h;
    }
    spec = build1(p, u, w, true);
    const b = bounds(spec);
    const dx = -(b.x0 + b.x1) / 2, dy = -(b.y0 + b.y1) / 2;
    const sh = r => r.map(([x, y]) => [x + dx, y + dy]);
    return {
      regions: spec.regions.map(r => Array.isArray(r) ? sh(r) : { ...r, rings: r.rings.map(sh) }),
      lines: spec.lines.map(l => ({ ...l, pts: sh(l.pts) })),
    };
  },
};

function bounds(spec) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const f = r => r.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  spec.regions.forEach(r => Array.isArray(r) ? f(r) : r.rings.forEach(f));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

function build1(p, u, w, final = true) {
  const s = q => mul(q, u);
  const lines = [];
  const cw = Math.max(1.6 * w, 0.02 * u);              // grubość „sznura” (wycięty pas)
  // Elementy w kolejności ważności. Każdy następny jest przycinany tak, by od wcześniejszych
  // dzielił go mostek – jak w hafcie, gdzie późniejszy ścieg „chowa się” za wcześniejszy.
  const els = [];
  // pełny kształt w całym rozmiarze – mostki między elementami daje przycinanie niżej (cień o szer. mostka),
  // więc przy zmniejszaniu wąskie ogniwka nie znikają, dopóki same mają ≥ najmniejszy otwór
  const fill = rings => merge(rings);
  const add2 = (rings, mirror = true) => { els.push(rings); if (mirror) els.push(rings.map(mirrorX)); };

  // --- gwiazda / róża
  const C = s([0, 0.06]), rc = 0.085 * u;
  els.push(fill([circle(C, rc)]));
  let rIn = rc;
  if (p.osmina === 'tak') {                               // ośmina: ząbki wokół gwiazdy
    const n = 18, r1 = rc * 0.78, zz = [];
    for (let i = 0; i < 2 * n; i++) zz.push(add(C, P(i % 2 ? r1 : rc * 1.02, i * Math.PI / n)));
    lines.push({ pts: zz, closed: true });
    rIn = r1;
  }
  const L = (a, b) => lines.push({ pts: [add(C, a), add(C, b)] });
  if (p.srodek === '4 części' || p.srodek === '8 części' || p.srodek === 'krzyż') {
    const k = p.srodek === '8 części' ? 8 : 4;
    for (let i = 0; i < k / 2; i++) { const a = i * TAU / k + (p.srodek === 'krzyż' ? 0 : TAU / 8); L(P(rIn, a), P(rIn, a + Math.PI)); }
    if (p.srodek === 'krzyż') lines.push({ pts: circle(C, rIn * 0.35), closed: true });
  } else if (p.srodek === 'gwiazda 6') {
    for (let i = 0; i < 6; i++) lines.push({ pts: lens(C, add(C, P(rIn, i * TAU / 6 + TAU / 4)), (rIn / 2) * Math.tan(Math.PI / 12)), closed: true });
  } else if (p.srodek === 'gwiazda 8') {
    const st = [];
    for (let i = 0; i < 16; i++) st.push(add(C, P(i % 2 ? rIn * 0.45 : rIn * 1.01, i * TAU / 16 + TAU / 4)));
    lines.push({ pts: st, closed: true });
    for (let i = 0; i < 8; i++) L([0, 0], P(rIn * 0.45, i * TAU / 8 + TAU / 4 + TAU / 16));
  } else if (p.srodek === 'słońce') {
    for (let i = 0; i < 12; i++) L(P(rIn * 0.3, i * TAU / 12), P(rIn * 1.01, i * TAU / 12));
    lines.push({ pts: circle(C, rIn * 0.3), closed: true });
  }

  // --- przypór (ozdoba wykroju)
  const yU = 0.06 + 0.085 + 0.045;
  const U = (x, yb) => {
    const half = bezier(s([x, 0.5]), s([x, (0.5 + yb) / 2]), s([x * 0.9, yb]), s([0, yb]), 40);
    return half.map(([X, Y]) => [-X, Y]).concat(half.slice(0, -1).reverse());
  };
  if (p.przypor !== 'brak') {
    const pasy = p.przypor === 'podwójny' ? 2 : p.przypor === 'potrójny' ? 3 : 1;
    const xu = 0.13;
    const step = (cw + 1.3 * w) / u;
    for (let k = 0; k < pasy; k++) els.push(band(U(0.13 - k * step, yU + k * step), cw, true));
    if (p.przyOzd === 'kluczki') {                    // „raki” – kluczki na zewnątrz przyporu
      for (let k = 0; k < 4; k++) {
        const og = ogniwkoKsztalt(s([0.13 + cw / u / 2 + 0.025, 0.47 - k * 0.07]), -10 * D, 0.08 * u, 0.6, 1.2, -1, 0.034 * u, 0.5, 0.7);
        add2(fill([og.ring]));
      }
    }
    if (p.przyOzd === 'kółka') for (let k = 0; k < 5; k++) add2([circle(s([0.13 + cw / u / 2 + 0.03, 0.47 - k * 0.055]), 0.016 * u)]);
  }

  // --- kotwica (trójkąt ku dołowi) i krzesiwko
  const yT = 0.06 - 0.085 - 0.045, xT = 0.17, yA = -0.40;
  const A = s([0, yA]), TR = s([xT, yT]), TL = s([-xT, yT]);
  let inset = 0.03;
  if (p.obram === 'kółka') {
    const m = 6;
    for (let k = 0; k < m; k++) add2([circle(lerp(TR, A, (k + 0.5) / m), 0.017 * u)]);
    inset = 0.05;
  } else if (p.obram === 'kratka') {                     // cały trójkąt w kratkę (mirwa w polu)
    els.push(fill([[TL, A, TR]]));
    const c0 = lerp(lerp(TL, TR, 0.5), A, 0.5), R = 0.4 * u;
    const d = Math.max(0.045 * u, 3.2 * w);                 // oczko kratki
    const tri = [TL, A, TR].map((q, i, arr) => q);
    const big = grow([tri], w * 0.5)[0] || tri;             // linie sięgają tuż za krawędź pola
    for (let k = -14; k <= 14; k++) {
      const o = k * d;
      [[add(c0, [o - R, -R]), add(c0, [o + R, R])], [add(c0, [o - R, R]), add(c0, [o + R, -R])]].forEach(([a, b]) => {
        const c = clipSeg(a, b, big); if (c) lines.push({ pts: c });
      });
    }
    inset = 0.0;
  } else if (p.obram === 'pas' || p.obram === 'mirwa' || p.obram === 'pas z kółkami') {
    const bw = p.obram === 'mirwa' ? Math.max(0.045 * u, 3 * w) : cw;
    els.push(band([TL, A, TR], bw, false));
    if (p.obram === 'pas z kółkami') {
      const d = sub(A, TR), l = Math.hypot(...d), nn = [d[1] / l, -d[0] / l];
      for (let k = 0; k < 6; k++) add2([circle(add(lerp(TR, A, (k + 0.5) / 6), mul(nn, -(bw / 2 + 0.03 * u))), 0.014 * u)]);
    }
    if (p.obram === 'mirwa') {                            // mirwa: skośne nitki krzyżujące się w pasie
      const m = 9;
      [[TR, A], [TL, A]].forEach(([a, b]) => {
        const d = sub(b, a), l = Math.hypot(...d), t = mul(d, 1 / l), nn = [-t[1], t[0]];
        for (let k = 0; k <= m; k++) {
          const q = lerp(a, b, k / m);
          lines.push({ pts: [add(add(q, mul(t, -bw * 0.6)), mul(nn, -bw * 0.6)), add(add(q, mul(t, bw * 0.6)), mul(nn, bw * 0.6))] });
          lines.push({ pts: [add(add(q, mul(t, bw * 0.6)), mul(nn, -bw * 0.6)), add(add(q, mul(t, -bw * 0.6)), mul(nn, bw * 0.6))] });
        }
      });
    }
    inset = 0.03 + bw / u;
  }
  const cy = (yT + yA) / 2 + 0.02;
  if (p.krzes === 'romb') {
    els.push(fill([[s([0, yT - inset]), s([0.06, cy]), s([0, yA + inset * 2]), s([-0.06, cy])]]));
  } else if (p.krzes === 'ślimaki') {                      // dwa ślimaki zwinięte ku sobie
    const og = ogniwkoKsztalt(s([0.035, yT - inset]), -55 * D, 0.17 * u, 0.2, 2.3, -1, 0.055 * u, 0.5, 0.35);
    add2(fill([og.ring]));
    els.push(fill([[s([0, cy - 0.07]), s([0.028, cy - 0.11]), s([0, yA + inset * 1.6]), s([-0.028, cy - 0.11])]]));
  } else if (p.krzes === 'półksiężyce') {                  // dawna forma: dwa półksiężyce i romb
    const r = 0.055 * u, c0 = s([0.07, cy + 0.03]);
    add2(fill(merge([arc(c0, r, -Math.PI * 0.75, Math.PI * 0.75, 30).concat(arc(add(c0, [-0.025 * u, 0]), r * 0.85, Math.PI * 0.7, -Math.PI * 0.7, 30))])));
    els.push(fill([[s([0, cy + 0.02]), s([0.03, cy - 0.04]), s([0, yA + inset * 1.6]), s([-0.03, cy - 0.04])]]));
  } else if (p.krzes === 'serce') {
    const half = bezier(s([0, yA + inset * 1.5]), s([0.04, cy - 0.06]), s([0.11, cy]), s([0.06, yT - inset]), 30)
      .concat(arcAB(s([0.06, yT - inset]), s([0, yT - inset - 0.03]), 0.025 * u).slice(1));
    els.push(fill(merge([half.concat(mirrorX(half).slice(1))])));
  } else if (p.krzes === 'kropla') {
    const half = bezier(s([0, yA + inset * 1.5]), s([0.03, cy - 0.05]), s([0.07, cy + 0.02]), s([0, yT - inset]), 30);
    els.push(fill(merge([half.concat(mirrorX(half).slice(1))])));
  }
  if (p.dziob === 'tak') els.push(fill([[s([0, yA - 0.025]), s([0.03, yA - 0.06]), s([0, yA - 0.1]), s([-0.03, yA - 0.06])]]));

  // --- ogniwka (prawa strona + odbicie), od góry: nasady na łuku wokół gwiazdy,
  //     kierunek startu = rozchylenie × kąt położenia (mniej niż 1 → pętle bardziej równoległe)
  const n = p.ogn;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const phi = (p.fanTop + (p.fanBot - p.fanTop) * t) * D;
    const sc = 1 - p.zmn * t;
    const turn = p.kier === 'w dół' ? -1 : p.kier === 'w górę' ? 1 : (phi >= 0 ? 1 : -1);
    const W = p.szer * u * sc;
    const p0 = add(C, P(rc + W * 0.3 + 0.015 * u, phi));
    const og = ogniwkoKsztalt(p0, phi * p.rozchyl, p.dl * u * sc, p.zag, p.zaw, turn, W, 0.55, p.kula);
    if (p.ogniwka === 'pełne' || W < 2 * cw + 3 * w) add2(fill([og.ring]));
    else {
      const loop = petlaPrzerwana(og.ring, og.base, cw * 0.6 + w * 1.2);
      const bd = band(loop, cw, true);
      // zawinięty koniec może dotknąć własnej pętli i zamknąć jej wnętrze – wtedy ogniwko pełne
      if (bd.some(r => area(r) < 0) || grow(bd, -cw * 0.45).length > 1) { add2(fill([og.ring])); continue; }
      add2(bd);
      if (p.ogniwka === 'podwójne') {
        const inner = grow([og.ring], -(cw + 1.5 * w));
        if (inner.length) add2([inner.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0]]);
      }
    }
  }

  // --- przycinanie kolejnych elementów do wcześniejszych (mostek między nimi)
  if (!final) return { regions: els.map(rings => ({ rings, shrink: false })), lines };
  const regions = [];
  let shadow = [];                                        // wcześniejsze elementy poszerzone o mostek
  for (const e of els) {
    const cut = shadow.length ? subtract(e, shadow) : e;
    if (cut.length) { regions.push({ rings: cut, shrink: false }); shadow = merge(shadow.concat(grow(e, w))); }
  }
  return { regions, lines };
}

export default parzenica;
