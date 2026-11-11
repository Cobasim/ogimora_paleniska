// Biblioteka motywów tatrzańskich do wycinania w blasze.
// Każdy motyw jest odtworzony geometrycznie (cyrkiel + linijka, jak u cieśli i krawców),
// a nie obrysowany ze skanu: dzięki temu skaluje się bez utraty jakości, a mostki
// zawsze mają zadaną szerokość niezależnie od rozmiaru motywu.
//
// Motyw: { id, nazwa, grupa, zrodlo, size: {def,min,max}, params: [...], make(p, size) → spec }
// spec – patrz silnik.js (regions / lines / keep).
import {
  P, add, sub, mul, lerp, dist, arc, circle, arcAB, lens, bezier, spline,
  rot, mirrorX, shift, scale, radial, taper, band, interlace, interlaceMany, coil, resample, subtract,
} from './silnik.js';
import parzenicaPodhalanska from './parzenica.js';
import smok from './smok.js';
import napis from './napis.js';
import { podpis, podpisSmok } from './linia.js';

const TAU = Math.PI * 2, D = Math.PI / 180;

// ---------------------------------------------------------------- pomocnicze: obrys i przesunięcie rysunku
function specRings(spec) {
  const out = [];
  (spec.regions || []).forEach(r => { if (Array.isArray(r)) out.push(r); else (r.parts || r.rings || [r.ring]).forEach(q => out.push(q)); });
  (spec.lines || []).forEach(l => out.push(l.pts));
  return out;
}
function specBounds(spec, w = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  specRings(spec).forEach(r => r.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
function shiftSpec(spec, dx, dy) {
  const sh = r => r.map(([x, y]) => [x + dx, y + dy]);
  return {
    regions: (spec.regions || []).map(r => Array.isArray(r) ? sh(r) : r.parts ? { ...r, parts: r.parts.map(sh) } : r.rings ? { ...r, rings: r.rings.map(sh) } : { ...r, ring: sh(r.ring) }),
    lines: (spec.lines || []).map(l => ({ ...l, pts: sh(l.pts) })),
    keep: (spec.keep || []).map(sh),
  };
}

// ---------------------------------------------------------------- obwódki (do motywów okrągłych)
export const OBWODKI = ['brak', 'zęby', 'łuczki', 'kropki'];

/** Zwraca { regions, inner } – obszary obwódki i promień, który zostaje na środek motywu. */
function obwodka(type, R, n, w) {
  if (type === 'brak' || !type) return { regions: [], inner: R };
  const depth = Math.max(R * 0.13, 2.2 * w);
  const r0 = R - depth;                          // podstawa obwódki (łuk koła, nie cięciwa)
  const regions = [];
  const da = TAU / n;
  const base = (a0, a1) => arc([0, 0], r0, a0, a1, 12);
  if (type === 'zęby') {                         // „wilcze zęby” – trójkąty ostrzem na zewnątrz
    for (let i = 0; i < n; i++) {
      const a = i * da;
      regions.push([...base(a - da / 2, a + da / 2), P(R, a)]);
    }
  } else if (type === 'łuczki') {                // półkola na obwodzie
    for (let i = 0; i < n; i++) {
      const a = i * da;
      const A = P(r0, a - da / 2), B = P(r0, a + da / 2);
      const h = Math.min(depth, dist(A, B) / 2);
      regions.push([...base(a - da / 2, a + da / 2), ...arcAB(B, A, h).slice(1, -1)]);
    }
  } else if (type === 'kropki') {
    const rr = Math.min(depth / 2, Math.PI * (R - depth / 2) / n * 0.5);
    for (let i = 0; i < n; i++) regions.push(circle(P(R - depth / 2, (i + 0.5) * da), rr));
  }
  return { regions, inner: r0 };
}

const obwParams = [
  { key: 'obw', label: 'Obwódka', options: OBWODKI, def: 'zęby' },
  { key: 'obwN', label: 'Ząbków w obwódce', min: 12, max: 48, step: 2, def: 24 },
];

// ---------------------------------------------------------------- ROZETY / SŁOŃCA
const rozeta = {
  id: 'rozeta', nazwa: 'Rozeta (słońce) listkowa', grupa: 'Słońca',
  zrodlo: 'Sosręby, odrzwia, skrzynie – Matlakowski tabl. VIII, XVII; „Łowcy Sosrębów”',
  size: { def: 200, min: 80, max: 600 },
  params: [
    { key: 'n', label: 'Listki', min: 4, max: 16, step: 1, def: 6 },
    { key: 'pelnosc', label: 'Pełność listka', min: 0.06, max: 0.3, step: 0.01, def: 0.134 },
    { key: 'tryb', label: 'Wycięte', options: ['ażur', 'listki'], def: 'ażur' },
    ...obwParams,
  ],
  make(p, size, w) {
    const R0 = size / 2;
    const o = obwodka(p.obw, R0, p.obwN, w);
    const R = o.inner;
    const petals = [];
    // w trybie „listki” płatki mogą się najwyżej stykać w środku (inaczej środek wypadnie)
    const h = p.tryb === 'listki' ? Math.min(p.pelnosc * R, (R / 2) * Math.tan(Math.PI / (2 * p.n)) * 0.98) : p.pelnosc * R;
    for (let i = 0; i < p.n; i++) petals.push(lens([0, 0], P(R, i * TAU / p.n + TAU / 4), h));
    if (p.tryb === 'listki') return { regions: [...o.regions, ...petals] };
    return { regions: [...o.regions, circle([0, 0], R)], lines: petals.map(pts => ({ pts, closed: true })) };
  },
};

/** Pierścień (otok) podzielony liniami – bez wysp, bo linie łączą środek z obwodem. */
function otok(r1, r2, typ, n) {
  const outer = circle([0, 0], r2), inner = circle([0, 0], r1).reverse();
  const regions = [{ rings: [outer, inner] }], lines = [];
  const da = TAU / n;
  for (let i = 0; i < n; i++) {
    const a = i * da;
    if (typ === 'jodełka') lines.push({ pts: [P(r1 * 0.98, a), P(r2 * 1.02, a + da * 0.9)] });
    else if (typ === 'łuski') lines.push({ pts: arcAB(P(r1 * 0.98, a), P(r2 * 1.02, a), (r2 - r1) * 0.25) });
    else lines.push({ pts: [P(r1 * 0.98, a), P(r2 * 1.02, a)] });
  }
  return { regions, lines };
}

/**
 * Rozeta cyrklowa – rysowana jak na sosrębie: koło, płatki z łuków o promieniu koła,
 * a w wersjach gęstszych także cięciwy między końcami płatków (trójkąty), płatki
 * drugiego rzędu, oczko w środku, łuki zewnętrzne i otok.
 */
const cyrklowa = {
  id: 'cyrklowa', nazwa: 'Rozeta cyrklowa (gęsta lub prosta)', grupa: 'Słońca',
  zrodlo: 'Sosrąb: „otok z gwiazdą wpisaną w koła spółśrodkowe” – Matlakowski, Budownictwo s. 45–50; rozety z folderu (1–21)',
  size: { def: 260, min: 100, max: 800 },
  params: [
    { key: 'n', label: 'Płatki', min: 4, max: 16, step: 1, def: 6 },
    { key: 'gestosc', label: 'Gęstość', min: 1, max: 5, step: 1, def: 3 },
    { key: 'otok', label: 'Otok', options: ['brak', 'kreski', 'jodełka', 'łuski'], def: 'jodełka' },
    { key: 'otokN', label: 'Podziałów otoku', min: 12, max: 72, step: 2, def: 36 },
    ...obwParams,
  ],
  make(p, size, w) {
    const R0 = size / 2;
    const o = obwodka(p.obw, R0, p.obwN, w);
    let R = o.inner;
    const regions = [...o.regions], lines = [];
    if (p.otok !== 'brak') {
      const t = Math.max(R * 0.1, 3 * w);
      const ot = otok(R - t, R, p.otok, p.otokN);
      regions.push(...ot.regions); lines.push(...ot.lines);
      R = R - t;
    }
    regions.push(circle([0, 0], R));
    const n = p.n, g = p.gestosc, a0 = TAU / 4;
    const tips = Array.from({ length: n }, (_, i) => P(R, a0 + i * TAU / n));
    const h = (R / 2) * Math.tan(Math.PI / (2 * n));          // płatki stykają się w środku (konstrukcja cyrklowa)
    tips.forEach(T => lines.push({ pts: lens([0, 0], T, h), closed: true }));
    if (g >= 2) tips.forEach((T, i) => lines.push({ pts: [T, tips[(i + 1) % n]] }));                  // cięciwy → trójkąty
    if (g >= 3) {
      const r2 = R * Math.cos(Math.PI / n) * 0.62;
      for (let i = 0; i < n; i++) {                                                                        // płatki drugiego rzędu
        const T = P(r2, a0 + (i + 0.5) * TAU / n);
        lines.push({ pts: lens([0, 0], T, r2 / 2 * Math.tan(Math.PI / (2 * n)) * 1.4), closed: true });
      }
      lines.push({ pts: circle([0, 0], R * 0.14), closed: true });
    }
    if (g >= 4) tips.forEach((T, i) => {                                                                   // łuk w każdym trójkącie
      const U = tips[(i + 1) % n];
      lines.push({ pts: arcAB(U, T, dist(T, U) * 0.2) });
    });
    if (g >= 5) tips.forEach(T => lines.push({ pts: [[0, 0], T] }));                                       // żyłki w płatkach
    return { regions, lines };
  },
};

const kwiatZycia = {
  id: 'kwiat', nazwa: 'Rozeta wielokrotna (kwiat z koła)', grupa: 'Słońca',
  zrodlo: 'Rozety cyrklowe na sosrębach i tragarzach; zestaw rozet z folderu (nr 14, 15, 19)',
  size: { def: 240, min: 120, max: 700 },
  params: [
    { key: 'rzedy', label: 'Rzędy kół', min: 1, max: 2, step: 1, def: 1 },
    ...obwParams,
  ],
  make(p, size, w) {
    const R0 = size / 2;
    const o = obwodka(p.obw, R0, p.obwN, w);
    const R = o.inner;
    const k = p.rzedy;
    const rho = R / (k + 1);
    const centers = [[0, 0]];
    for (let i = 0; i < 6; i++) centers.push(P(rho, i * TAU / 6 + TAU / 4));
    if (k >= 2) for (let i = 0; i < 6; i++) { centers.push(P(2 * rho, i * TAU / 6 + TAU / 4)); centers.push(P(Math.sqrt(3) * rho, i * TAU / 6 + TAU / 4 + TAU / 12)); }
    return {
      regions: [...o.regions, circle([0, 0], R)],
      lines: [...centers.map(c => ({ pts: circle(c, rho), closed: true }))],
    };
  },
};

const slonce = {
  id: 'slonce', nazwa: 'Słońce promieniste', grupa: 'Słońca',
  zrodlo: 'Gwiazdy wyhaftowane w środku parzenic – Seweryn 1930, ryc. 28',
  size: { def: 220, min: 80, max: 600 },
  params: [
    { key: 'n', label: 'Promienie', min: 8, max: 32, step: 1, def: 16 },
    { key: 'wew', label: 'Tarcza środkowa', min: 0.3, max: 0.7, step: 0.01, def: 0.48 },
    { key: 'naprzem', label: 'Promienie', options: ['równe', 'na przemian'], def: 'na przemian' },
    { key: 'srodek', label: 'Środek', options: ['krzyż', 'rozeta', 'koło', 'pełny'], def: 'krzyż' },
  ],
  make(p, size) {
    const R = size / 2, r1 = R * p.wew;
    const regions = [], lines = [];
    const da = TAU / p.n;
    for (let i = 0; i < p.n; i++) {
      const a = i * da + TAU / 4;
      const L = p.naprzem === 'na przemian' && i % 2 ? r1 + (R - r1) * 0.62 : R;
      regions.push([...arc([0, 0], r1, a - da / 2, a + da / 2, 12), P(L, a)]);
    }
    const rc = r1;
    if (p.srodek !== 'pełny') {
      regions.push(circle([0, 0], rc));
      if (p.srodek === 'krzyż') { lines.push({ pts: [[-rc, 0], [rc, 0]] }); lines.push({ pts: [[0, -rc], [0, rc]] }); }
      if (p.srodek === 'rozeta') for (let i = 0; i < 6; i++) lines.push({ pts: lens([0, 0], P(rc, i * TAU / 6 + TAU / 4), 0.134 * rc), closed: true });
    }
    return { regions, lines };
  },
};

const gwiazda = {
  id: 'gwiazda', nazwa: 'Gwiazda żebrowana (wycinanka trójkątna)', grupa: 'Słońca',
  zrodlo: 'Gwiazdy i krzyżyki rzeźbione „w trójkątną jamkę” – Matlakowski, Zdobienie s. 125–144',
  size: { def: 180, min: 60, max: 600 },
  params: [
    { key: 'n', label: 'Ramiona', min: 4, max: 12, step: 1, def: 8 },
    { key: 'wciecie', label: 'Wcięcie', min: 0.25, max: 0.7, step: 0.01, def: 0.45 },
    { key: 'zebra', label: 'Żebra', options: ['tak', 'nie'], def: 'tak' },
  ],
  make(p, size) {
    const R = size / 2, ri = R * p.wciecie, n = p.n;
    const star = [];
    for (let i = 0; i < n; i++) { const a = i * TAU / n + TAU / 4; star.push(P(R, a), P(ri, a + TAU / n / 2)); }
    const lines = [];
    if (p.zebra === 'tak') star.forEach(q => lines.push({ pts: [[0, 0], mul(q, 1.02)] }));
    return { regions: [star], lines };
  },
};

const wirujaca = {
  id: 'wirujaca', nazwa: 'Rozeta wirująca (kołowrót)', grupa: 'Słońca',
  zrodlo: 'Rozety wirujące na sosrębach i skrzyniach – Matlakowski; „Łowcy Sosrębów”',
  size: { def: 200, min: 80, max: 600 },
  params: [
    { key: 'n', label: 'Łopatki', min: 4, max: 16, step: 1, def: 8 },
    { key: 'tryb', label: 'Wycięte', options: ['wszystkie', 'co druga'], def: 'co druga' },
    ...obwParams,
  ],
  make(p, size, w) {
    const R0 = size / 2;
    const o = obwodka(p.obw, R0, p.obwN, w);
    const R = o.inner;
    // łuk półkolisty od środka do obwodu (klasyczna konstrukcja cyrklem)
    const blade = a => { const C = P(R / 2, a); const b0 = a + Math.PI; return arc(C, R / 2, b0, b0 - Math.PI); };
    const arcs = Array.from({ length: p.n }, (_, i) => blade(i * TAU / p.n));
    if (p.tryb === 'wszystkie') return { regions: [...o.regions, circle([0, 0], R)], lines: arcs.map(pts => ({ pts })) };
    const regions = [...o.regions];
    for (let i = 0; i < p.n; i += 2) {
      const a1 = arcs[i], a2 = arcs[(i + 1) % p.n];
      const ang1 = i * TAU / p.n, ang2 = (i + 1) * TAU / p.n;
      const rim = arc([0, 0], R, ang1, ang2, 24).slice(1, -1);
      regions.push(a1.concat(rim, a2.slice().reverse()));
    }
    return { regions };
  },
};

// ---------------------------------------------------------------- KRZYŻE
const krzyz = {
  id: 'krzyz', nazwa: 'Krzyż maltański / rycerski', grupa: 'Krzyże i drobne',
  zrodlo: 'Krzyżyki na sosrębach, krzyż w rozecie – Matlakowski tabl. XVII (3); forma maltańska',
  size: { def: 180, min: 60, max: 600 },
  params: [
    { key: 'typ', label: 'Rodzaj', options: ['maltański', 'rycerski', 'łapowy'], def: 'maltański' },
    { key: 'kat', label: 'Rozwarcie ramion', min: 14, max: 40, step: 1, def: 28 },
    { key: 'wciecie', label: 'Wcięcie końców', min: 0, max: 0.45, step: 0.01, def: 0.3 },
    { key: 'srodek', label: 'Środek', options: ['punkt', 'oczko'], def: 'punkt' },
    { key: 'obw', label: 'Obwódka', options: ['brak', 'łuki'], def: 'brak' },
  ],
  make(p, size, w) {
    const R = p.obw === 'łuki' ? size / 2 * 0.80 * Math.cos(p.kat * D) : size / 2;
    const th = p.kat * D, rc = p.srodek === 'oczko' ? R * 0.14 : 0;
    const regions = [];
    const arm = [];
    const x0 = rc > 0 ? rc + w : 0;
    const half0 = rc > 0 ? Math.tan(th) * x0 * 0.4 : 0;
    const tipY = R * Math.tan(th);
    if (p.typ === 'maltański') {
      arm.push([x0, -half0], [R, -tipY], [R * (1 - p.wciecie), 0], [R, tipY], [x0, half0]);
    } else if (p.typ === 'rycerski') {                 // płaski koniec, wklęsłe boki
      const side1 = arcAB([x0, -half0], [R, -tipY], 0.08 * R);
      const side2 = arcAB([R, tipY], [x0, half0], 0.08 * R);
      arm.push(...side1, ...side2);
    } else {                                            // łapowy: koniec łukiem
      const side1 = arcAB([x0, -half0], [R * 0.9, -tipY], 0.06 * R);
      const end = arcAB([R * 0.9, -tipY], [R * 0.9, tipY], -(1 - p.wciecie) * 0.25 * R);   // koniec wypukły na zewnątrz
      const side2 = arcAB([R * 0.9, tipY], [x0, half0], 0.06 * R);
      arm.push(...side1, ...end.slice(1), ...side2.slice(1));
    }
    const clean = arm.filter((q, i) => i === 0 || dist(q, arm[i - 1]) > 1e-6);
    radial(clean, 4, TAU / 4).forEach(a => regions.push(a));
    if (rc > 0) regions.push(circle([0, 0], rc));
    if (p.obw === 'łuki') {                            // pierścień przerwany na osiach ramion
      const R1 = size / 2 * 0.86, R2 = size / 2;
      for (let i = 0; i < 4; i++) {
        const a0 = i * TAU / 4 + TAU / 8 - (TAU / 8 - th * 0.7), a1 = i * TAU / 4 + TAU / 8 + (TAU / 8 - th * 0.7);
        regions.push(arc([0, 0], R2, a0, a1).concat(arc([0, 0], R1, a1, a0)));
      }
    }
    return { regions };
  },
};

// ---------------------------------------------------------------- PARZENICE
/**
 * Róg parzenicy: gruba główka przy kole środkowym, ogon wygięty łukiem (Bézier),
 * zakończony ślimakiem zwijającym się do środka. turn = +1 w lewo, -1 w prawo.
 */
function rog(p0, c1, c2, p1, turn, curlR, wHead, wEnd = 0.22) {
  const center = bezier(p0, c1, c2, p1, 60);
  // ślimak: kierunek obraca się coraz szybciej (promień maleje liniowo)
  let pos = p1, d = sub(p1, c2); let hd = Math.atan2(d[1], d[0]);
  const sweep = 1.5 * Math.PI, steps = 40;
  let turned = 0;
  while (turned < sweep) {
    const k = turned / sweep;
    const r = curlR * (1 - 0.55 * k);
    const ds = r * (sweep / steps);
    hd += turn * ds / r; turned += ds / r;
    pos = add(pos, [ds * Math.cos(hd), ds * Math.sin(hd)]);
    center.push(pos);
  }
  const nMain = 61, N = center.length;
  const head = circle(p0, wHead * 0.5);
  return { parts: [head, taper(center, s => {
    const i = s * (N - 1);
    const m = Math.min(1, i / (nMain - 1));                 // 0..1 wzdłuż głównej części
    const base = wHead * (1 - (1 - wEnd) * Math.pow(m, 0.8));
    if (i <= nMain - 1) return base;
    const k = (i - nMain + 1) / (N - nMain);                // w ślimaku zwęża się do ok. połowy
    return base * (1 - 0.45 * k);
  })] };
}

const parzenica = {
  id: 'parzenica', nazwa: 'Parzenica haftowana (rogi, koło, krzesiwko)', grupa: 'Parzenice',
  zrodlo: 'Seweryn 1930: ryc. 24 (Kościelisko), 25 (J. Piton 1910), 26 (Zakopane 1909)',
  size: { def: 300, min: 140, max: 800 },
  params: [
    { key: 'przypor', label: 'Przypór (pas U)', options: ['tak', 'nie'], def: 'tak' },
    { key: 'rogi', label: 'Rogi na stronę', min: 1, max: 3, step: 1, def: 3 },
    { key: 'srodek', label: 'Koło środkowe', options: ['rozeta', 'gwiazda', 'krzyż', 'pełne'], def: 'rozeta' },
    { key: 'kulki', label: 'Kulki', options: ['tak', 'nie'], def: 'tak' },
    { key: 'krzesiwko', label: 'Krzesiwko (dół)', options: ['romb', 'serce', 'brak'], def: 'romb' },
  ],
  make(p, size, w) {
    const u = size;                              // jednostka = wysokość motywu
    const s = q => mul(q, u);
    const regions = [], lines = [];
    const sym = ring => [ring, mirrorX(ring)];
    // koło środkowe
    const cc = s([0, 0.03]), rc = 0.1 * u;
    regions.push(circle(cc, rc));
    if (p.srodek === 'rozeta') for (let i = 0; i < 6; i++) lines.push({ pts: lens(cc, add(cc, P(rc, i * TAU / 6 + TAU / 4)), 0.134 * rc), closed: true });
    if (p.srodek === 'gwiazda') for (let i = 0; i < 8; i++) lines.push({ pts: [cc, add(cc, P(rc * 1.05, i * TAU / 8))] });
    if (p.srodek === 'krzyż') { lines.push({ pts: [add(cc, [-rc, 0]), add(cc, [rc, 0])] }); lines.push({ pts: [add(cc, [0, -rc]), add(cc, [0, rc])] }); }
    // przypór: pas U schodzący z góry i obejmujący koło od góry
    if (p.przypor === 'tak') {
      const right = bezier(s([0.15, 0.5]), s([0.15, 0.30]), s([0.13, 0.19]), s([0, 0.19]), 40);
      const cl = right.map(([x, y]) => [-x, y]).concat(right.slice(0, -1).reverse());
      regions.push({ rings: band(cl, 0.045 * u, false) });
    }
    // rogi: górny wznosi się i opada na zewnątrz, dolne schodzą w dół – wszystkie zwijają się do środka
    const R = [];
    R.push(rog(s([0.15, 0.12]), s([0.18, 0.30]), s([0.40, 0.40]), s([0.43, 0.20]), -1, 0.065 * u, 0.12 * u, 0.5));
    if (p.rogi >= 2) R.push(rog(s([0.16, -0.04]), s([0.27, -0.02]), s([0.42, -0.07]), s([0.39, -0.24]), -1, 0.05 * u, 0.10 * u, 0.5));
    if (p.rogi >= 3) R.push(rog(s([0.11, -0.15]), s([0.15, -0.19]), s([0.24, -0.22]), s([0.21, -0.34]), -1, 0.035 * u, 0.07 * u, 0.5));
    R.forEach(r => { regions.push(r, { parts: r.parts.map(mirrorX) }); });
    // kulki: wzdłuż przyporu i wzdłuż dolnych boków
    if (p.kulki === 'tak') {
      const rk = 0.022 * u;
      const kk = [[0.24, 0.47], [0.29, 0.42], [0.30, -0.40], [0.22, -0.45]];
      kk.forEach(q => regions.push(...sym(circle(s(q), rk + w / 2))));
    }
    // krzesiwko
    if (p.krzesiwko === 'romb') {
      regions.push([s([0, -0.13]), s([0.07, -0.27]), s([0, -0.41]), s([-0.07, -0.27])]);
      lines.push({ pts: [s([0, -0.10]), s([0, -0.44])] });
      regions.push([s([0, -0.44]), s([0.03, -0.48]), s([0, -0.52]), s([-0.03, -0.48])]);
    } else if (p.krzesiwko === 'serce') {
      const half = bezier(s([0, -0.48]), s([0.05, -0.38]), s([0.13, -0.28]), s([0.08, -0.17]), 30)
        .concat(arcAB(s([0.08, -0.17]), s([0, -0.20]), 0.03 * u).slice(1));
      regions.push(half.concat(mirrorX(half).slice(1)));
    }
    return { regions, lines };
  },
};

/**
 * Parzenica pętlowa – najbliższa pochodzeniu motywu: gruby sznur przyszyty w pętle.
 * Pod przyporem (U) sznur tworzy piętra par pętli (jak leżąca ósemka), coraz mniejszych
 * ku dołowi, zakończonych szpicem (krzesiwkiem). Pętla wycięta w blasze świeci jak sznur;
 * w miejscu skrzyżowania sznur „pod spodem” jest przerwany (przeplot) – to jest mostek.
 */
function osemka(cx, cy, a, h, droop, koloR = 0, trim = 0) {
  // leżąca ósemka (lemniskata) o pół-szerokości a i wysokości pętli h, ramiona opadają o droop
  const pts = [];
  const N = 220;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.37) / N * TAU, d = 1 + Math.sin(t) ** 2;   // przesunięcie: skrzyżowanie nie wypada w wierzchołku
    const x = a * Math.cos(t) / d, y = h * Math.sin(t) * Math.cos(t) / d * 1.9;
    pts.push([cx + x, cy + y - droop * (x / a) ** 2]);
  }
  if (!koloR) return [{ path: pts, closed: true }];
  // z kołem w środku: dwie osobne łezki odsunięte od środka
  const half = side => {
    const q = [];
    for (let i = 0; i <= 110; i++) {
      const t = -Math.PI / 2 + i / 110 * Math.PI, d = 1 + Math.sin(t) ** 2;
      const x = a * Math.cos(t) / d, y = h * Math.sin(t) * Math.cos(t) / d * 1.9;
      const xx = koloR + x * (a - koloR) / a;
      q.push([cx + side * xx, cy + y - droop * (x / a) ** 2]);
    }
    // końce pętli przy kole zostają rozsunięte (sznur „chowa się” za środek) – inaczej
    // wnętrze pętli byłoby wyspą
    const tip = q[0], cut = trim;
    return { path: q.filter(pt => dist(pt, tip) > cut), closed: false };
  };
  return [half(1), half(-1)];
}

const parzenicaPetlowa = {
  id: 'petlowa', nazwa: 'Parzenica pętlowa (sznur w pętle)', grupa: 'Parzenice',
  zrodlo: 'Seweryn 1930: parzenice sznurowe, pętlowe i jabłonkowskie (ryc. 11, 12, 23); szamerunek',
  size: { def: 320, min: 160, max: 900 },
  params: [
    { key: 'pietra', label: 'Piętra pętli', min: 1, max: 4, step: 1, def: 3 },
    { key: 'szer', label: 'Rozpiętość', min: 0.6, max: 1.0, step: 0.01, def: 0.86 },
    { key: 'zwis', label: 'Opadanie pętli', min: -0.4, max: 0.8, step: 0.01, def: 0.35 },
    { key: 'pelnosc', label: 'Pełność pętli', min: 0.5, max: 1.3, step: 0.01, def: 0.9 },
    { key: 'srodek', label: 'Środek', options: ['węzeł', 'rozeta', 'gwiazda', 'oczko'], def: 'węzeł' },
    { key: 'przypor', label: 'Przypór', options: ['pojedynczy', 'podwójny', 'brak'], def: 'pojedynczy' },
    { key: 'dol', label: 'Dół', options: ['krzesiwko', 'szpic', 'kropla', 'brak'], def: 'krzesiwko' },
    { key: 'kulki', label: 'Kulki', options: ['tak', 'nie'], def: 'tak' },
    { key: 'sznur', label: 'Grubość sznura [× mostek]', min: 1.2, max: 4, step: 0.1, def: 1.8 },
  ],
  make(p, size, w) {
    // piętra zsuwają się, gdy pętle by na siebie zachodziły – wtedy całość pomniejszamy,
    // żeby motyw miał dokładnie zadaną wysokość, i ustawiamy go na środku
    let u = size, spec;
    for (let k = 0; k < 4; k++) {
      spec = this.make0(p, u, w, size);
      const b = specBounds(spec, w);
      if (b.h <= size * 1.01) break;
      u *= size / b.h * 0.995;
    }
    const b = specBounds(spec, w);
    return shiftSpec(spec, -(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
  },
  make0(p, size, w, nominal) {
    const u = size, s = q => mul(q, u);
    const cw = Math.min(p.sznur * w, nominal / 24);
    const regions = [], lines = [];
    const cords = [];
    const cord = (pts, closed) => cords.push({ pts, closed });
    const both = path => [path, path.map(([x, y]) => [-x, y])];
    const n = p.pietra;
    const yTop = 0.10, yBot = -0.30;                         // pas, w którym leżą piętra
    const rc = p.srodek === 'węzeł' ? 0 : 0.095 * u;
    // piętra układane od góry; każde kolejne zsuwane w dół, aż sznury nie zachodzą na siebie
    const gapMin = cw + 1.3 * w;
    const placed = [];
    const minD = (A, B) => { let m = Infinity; for (let i = 0; i < A.length; i += 2) for (let j = 0; j < B.length; j += 2) { const d = (A[i][0] - B[j][0]) ** 2 + (A[i][1] - B[j][1]) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
    const push = (make, cy0) => {
      let cy = cy0, c = make(cy);
      for (let it = 0; it < 400 && placed.some(P => c.some(q => minD(q.path, P) < gapMin)); it++) { cy -= 1; c = make(cy); }
      c.forEach(q => { placed.push(q.path); cord(q.path, q.closed); });
      return cy;
    };
    let lastY = 0;
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0 : i / (n - 1);
      const a = (0.5 * p.szer) * (1 - 0.45 * k) * u;
      const h = (0.62 / (n + 0.6)) * p.pelnosc * (1 - 0.3 * k) * u;
      const droop = p.zwis * h * 0.9;
      lastY = push(cy => osemka(0, cy, a, h, droop, i === 0 ? rc : 0, cw + 1.5 * w), (yTop + (yBot - yTop) * k) * u);
    }
    if (rc) {
      const cc = [0, yTop * u];
      regions.push(circle(cc, rc - cw / 2));
      if (p.srodek === 'rozeta') for (let i = 0; i < 6; i++) lines.push({ pts: lens(cc, add(cc, P(rc - cw / 2, i * TAU / 6 + TAU / 4)), 0.134 * (rc - cw / 2)), closed: true });
      if (p.srodek === 'gwiazda') for (let i = 0; i < 8; i++) lines.push({ pts: [cc, add(cc, P(rc, i * TAU / 8))] });
    }
    // przypór: sznur w kształcie U schodzący z góry do pierwszego piętra
    const U = (x, yb) => {
      const half = bezier(s([x, 0.5]), s([x, (0.5 + yb) / 2]), s([x * 0.85, yb + 0.02]), s([0, yb]), 40);
      return half.map(([X, Y]) => [-X, Y]).concat(half.slice(0, -1).reverse());
    };
    // dno przyporu tuż nad środkiem pierwszego piętra (sznur „obejmuje” środek)
    let topMid = rc ? yTop * u + rc : -Infinity;
    placed.forEach(P => P.forEach(([x, y]) => { if (Math.abs(x) < 0.17 * u) topMid = Math.max(topMid, y); }));
    const yU = (topMid + gapMin + cw / 2) / u;
    if (p.przypor !== 'brak') {
      regions.push({ rings: band(U(0.15, yU), cw, true), shrink: false });
      if (p.przypor === 'podwójny') regions.push({ rings: band(U(0.15 - (2 * cw + 1.2 * w) / u, yU + (2 * cw + 1.2 * w) / u), cw, true), shrink: false });
    }
    // dół
    let yEnd = lastY - 0.62 / (n + 0.6) * 0.45 * u;
    if (p.dol === 'krzesiwko') {
      // sznur schodzi, zawraca szpicem i krzyżuje się nad nim (litera alfa)
      const pts = [[-0.07, 0], [0.025, -0.05], [0.05, -0.11], [0, -0.20], [-0.05, -0.11], [-0.025, -0.05], [0.07, 0]];
      yEnd = push(cy => [{ path: spline(pts.map(([x, y]) => [x * u, y * u + cy]), false, 14), closed: false }], yEnd);
    } else {
      const probe = cy => [{ path: [[0, cy], [0, cy - 0.19 * u], [0.04 * u, cy - 0.06 * u], [-0.04 * u, cy - 0.06 * u]], closed: false }];
      let cy = yEnd; while (placed.some(P => probe(cy).some(q => minD(q.path, P) < gapMin + w)) && cy > -u) cy -= 1; yEnd = cy;
    }
    if (p.dol === 'krzesiwko') {} else if (p.dol === 'szpic') {
      regions.push([[0, yEnd], [0.04 * u, yEnd - 0.06 * u], [0, yEnd - 0.19 * u], [-0.04 * u, yEnd - 0.06 * u]]);
    } else if (p.dol === 'kropla') {
      const half = bezier([0, yEnd - 0.19 * u], [0.03 * u, yEnd - 0.12 * u], [0.06 * u, yEnd - 0.05 * u], [0, yEnd], 30);
      regions.push(half.concat(mirrorX(half).slice(1)));
    }
    if (p.kulki === 'tak') {
      const rk = Math.max(0.016 * u, cw * 0.8) + w / 2;
      [[0.26, 0.46], [0.33, 0.40]].forEach(q => both(circle(s(q), rk)).forEach(c => regions.push(c)));
      if (p.dol !== 'brak') both(circle([0.08 * u, yEnd - 0.17 * u], rk)).forEach(c => regions.push(c));
    }
    interlaceMany(cords, cw, w).forEach(r => regions.push(r));
    return { regions, lines };
  },
};

/** Parzenica sznurowa: jeden sznur z pętlami; przeplot na skrzyżowaniach daje mostki. */
const KRZYWE = {
  'trójpętlowa': t => { const x = Math.sin(t) + 2 * Math.sin(2 * t), y = Math.cos(t) - 2 * Math.cos(2 * t); return [x, y < 0 ? y * 1.25 : y]; },
  'czteropętlowa': t => { const x = Math.cos(t) + 0.9 * Math.cos(3 * t), y = Math.sin(t) - 0.9 * Math.sin(3 * t); return [x * 0.85, y < 0 ? y * 1.3 : y]; },
  'pięciopętlowa': t => { const a = t; const x = Math.cos(a) + 0.7 * Math.cos(-4 * a), y = Math.sin(a) + 0.7 * Math.sin(-4 * a); return rot([[x, y]], -Math.PI / 2)[0]; },
  'plecionka': t => [Math.sin(2 * t) * 0.8, Math.sin(3 * t)],
};
const sznurowa = {
  id: 'sznurowa', nazwa: 'Węzeł sznurowy (przeplot)', grupa: 'Krzyże i drobne',
  zrodlo: 'Parzenice sznurowe i szamerunki – Seweryn 1930, ryc. 11, 12, 23',
  size: { def: 280, min: 120, max: 800 },
  params: [
    { key: 'uklad', label: 'Układ', options: ['trójpętlowa', 'czteropętlowa', 'pięciopętlowa', 'serce', 'plecionka'], def: 'trójpętlowa' },
    { key: 'sznur', label: 'Grubość sznura [× mostek]', min: 1.5, max: 5, step: 0.1, def: 2.6 },
  ],
  make(p, size, w) {
    let path;
    if (p.uklad === 'serce') {
      const pts = [[0, 0.14], [0.18, 0.34], [0.38, 0.26], [0.34, 0.02], [0.12, -0.20], [0, -0.44],
        [-0.12, -0.20], [-0.34, 0.02], [-0.38, 0.26], [-0.18, 0.34], [0, 0.14], [0.14, -0.02], [0, -0.16], [-0.14, -0.02]];
      path = spline(scale(pts, size), true, 20);
    } else {
      const f = KRZYWE[p.uklad], raw = [];
      for (let i = 0; i < 480; i++) raw.push(f((i + 0.37) / 480 * TAU));
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      raw.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      const k = (size - Math.min(p.sznur * w, size / 16)) / Math.max(x1 - x0, y1 - y0);
      path = raw.map(([x, y]) => [(x - (x0 + x1) / 2) * k, (y - (y0 + y1) / 2) * k]);
    }
    return { regions: interlace(path, Math.min(p.sznur * w, size / 16), w, true) };
  },
};

// ---------------------------------------------------------------- DROBNE / NAROŻNE
const piatka = {
  id: 'piatka', nazwa: 'Kółeczka (piątka, krzyżyk)', grupa: 'Krzyże i drobne',
  zrodlo: 'Zdziar: „kółeczka, kombinacje po pięć (jedno środkowe + cztery), kropki, gwiazdki” – Matlakowski, Budownictwo s. 60; kółeczka w narożnikach sosrębu',
  size: { def: 60, min: 30, max: 200 },
  params: [
    { key: 'uklad', label: 'Układ', options: ['piątka', 'krzyżyk', 'trójka', 'gwiazdka'], def: 'piątka' },
    { key: 'wielk', label: 'Wielkość kółek', min: 0.2, max: 0.45, step: 0.01, def: 0.3 },
  ],
  make(p, size, w) {
    const R = size / 2, r = R * p.wielk, regions = [];
    if (p.uklad === 'gwiazdka') {
      for (let i = 0; i < 6; i++) regions.push(lens([0, 0], P(R, i * TAU / 6 + TAU / 4), (R / 2) * Math.tan(Math.PI / 12)));
      return { regions };
    }
    const pts = p.uklad === 'trójka' ? [0, 1, 2].map(i => P(R - r, TAU / 4 + i * TAU / 3))
      : [[0, 0], ...[0, 1, 2, 3].map(i => P(R - r, (p.uklad === 'piątka' ? TAU / 8 : 0) + i * TAU / 4))];
    pts.forEach(c => regions.push(circle(c, r)));
    return { regions };
  },
};

const wschodzace = {
  id: 'wschodzace', nazwa: 'Słońce wschodzące (wachlarz)', grupa: 'Słońca',
  zrodlo: 'Szczyty i drzwi „szalowane w wschodzące słońce”, promienie wachlarzowo z kółeczka – Matlakowski, Budownictwo s. 49–55',
  size: { def: 400, min: 120, max: 1200 }, sizeLabel: 'Szerokość',
  params: [
    { key: 'n', label: 'Promienie', min: 5, max: 25, step: 1, def: 11 },
    { key: 'wew', label: 'Kółeczko', min: 0.12, max: 0.4, step: 0.01, def: 0.22 },
    { key: 'naprzem', label: 'Promienie', options: ['kliny', 'kliny na przemian', 'ostre'], def: 'kliny na przemian' },
    { key: 'luk', label: 'Łuk zewnętrzny', options: ['tak', 'nie'], def: 'tak' },
  ],
  make(p, size, w) {
    const R = size / 2, r1 = R * p.wew, regions = [], lines = [];
    const y0 = -R / 2;                                        // środek motywu w połowie wysokości
    const c = [0, y0];
    regions.push(arc(c, r1, 0, Math.PI, 32));                 // półkole – kółeczko u podstawy
    const Rr = p.luk === 'tak' ? R * 0.86 : R;
    const da = Math.PI / p.n;
    for (let i = 0; i < p.n; i++) {
      const a0 = i * da, a1 = a0 + da, am = a0 + da / 2;
      const L = p.naprzem === 'kliny na przemian' && i % 2 ? r1 + (Rr - r1) * 0.72 : Rr;
      if (p.naprzem !== 'ostre') regions.push([...arc(c, r1, a0, a1, 6).map(q => q), add(c, P(L, a1)), add(c, P(L, a0))]);
      else regions.push([add(c, P(r1, a0)), add(c, P(L, am)), add(c, P(r1, a1)), ...arc(c, r1, a1, a0, 6).slice(1, -1)]);
    }
    if (p.luk === 'tak') {
      const ring = arc(c, R, 0, Math.PI, 64).concat(arc(c, R * 0.91, Math.PI, 0, 64));
      regions.push(ring);
      for (let i = 1; i < 6; i++) lines.push({ pts: [add(c, P(R * 0.9, i * Math.PI / 6)), add(c, P(R * 1.01, i * Math.PI / 6))] });
    }
    return { regions, lines };
  },
};

// ---------------------------------------------------------------- FRYZY (pasy)
// ---------------------------------------------------------------- pasy (fryzy) do wypełniania linii
// Wzory z sosrębów, szczytów i oblamówek (Matlakowski, Zdobienie i sprzęt, tabl. XVII, XXIV, XXV;
// Seweryn – ozdoby przyporu): ząbki i „piłka”, wilcze zęby, kropki i kółeczka, „sfalowana woda”,
// krzyżujące się wężyki, sznur, jodełka, krokiewki, półkola („wole oczy”), łuski („janiki”),
// rombiki, recica, krzyżyki, kreski, wężyk z listkami („ogóreczki”), gadzik, łańcuszek.
// Rozmiar = długość pasa, „h” = wysokość. Moduł powtarza się tyle razy, ile mieści się w długości.
const PASY = {
  'piłka':           { k: 1.0, mw: 6,  opis: 'Ząbce w obie strony – pas „piłki” z sosrębów' },
  'ząbki':           { k: 0.8, mw: 5,  opis: 'Linia zębata – jeden rząd ząbków na listwie' },
  'wilcze zęby':     { k: 1.1, mw: 6,  opis: 'Trójkąty na przemian w górę i w dół, rozdzielone metalem' },
  'kropki':          { k: 1.5,  opis: 'Rząd kółeczek' },
  'kropki w dwóch rzędach': { k: 1.4, opis: 'Kółeczka w dwóch rzędach, przesunięte' },
  'fala':            { k: 2.2, mw: 6,  opis: '„Sfalowana woda” – fala przerywana mostkami' },
  'wężyki':          { k: 2.4, mw: 8,  opis: 'Dwa krzyżujące się wężyki z przeplotem (ozdoba przyporu)' },
  'wężyk z listkami':{ k: 2.0, mw: 8,  opis: 'Fala z listkami – „wężyk z ogóreczkami”' },
  'sznur':           { k: 0.55, mw: 3.4, opis: 'Sznur skręcany – ukośne ogniwka' },
  'jodełka':         { k: 0.9, mw: 7,  opis: 'Jodełka – ukośne kreski w dwóch rzędach' },
  'krokiewki':       { k: 0.8, mw: 4,  opis: 'Krokiewki – rząd jodełek (V)' },
  'półkola':         { k: 1.4,  opis: 'Półkola – „wole oczy” wzdłuż listwy' },
  'łuski':           { k: 1.2, mw: 4,  opis: 'Łuski („janiki”) w dwóch rzędach' },
  'rombiki':         { k: 1.3,  opis: 'Rząd rombików' },
  'recica (romby)':  { k: 1.0, mw: 6,  opis: 'Recica – romby stykające się rogami, z żyłką' },
  'krzyżyki':        { k: 1.4,  opis: 'Rząd krzyżyków' },
  'kreski':          { k: 3.4,  opis: 'Linia przerywana' },
  'łuczki z kółkami':{ k: 1.0, mw: 5,  opis: 'Łuczki z kółkami nad listwą' },
  'gadzik':          { k: 1.0, mw: 5,  opis: 'Gadzik – wężyk przerywany' },
  'łańcuszek':       { k: 1.5, mw: 4,  opis: 'Łańcuszek – owalne ogniwka na przemian z kółkami' },
};
const fryz = {
  id: 'fryz', nazwa: 'Pas zdobniczy', grupa: 'Pasy',
  zrodlo: 'Pasy z sosrębów i oblamówek – Matlakowski tabl. XVII, XXIV, XXV; Seweryn (ozdoba przyporu)',
  pas: true,                                           // uchwyty: bok = długość, góra/dół = wysokość pasa
  size: { def: 400, min: 30, max: 1500 }, sizeLabel: 'Długość',
  params: [
    { key: 'wzor', label: 'Wzór', options: Object.keys(PASY), def: 'piłka', titles: Object.fromEntries(Object.entries(PASY).map(([k, v]) => [k, v.opis])) },
    { key: 'h', label: 'Wysokość pasa', min: 6, max: 120, step: 1, def: 30, unit: ' mm' },
    { key: 'gestosc', label: 'Gęstość', min: 0.5, max: 2.5, step: 0.05, def: 1 },
  ],
  warianty: Object.keys(PASY),
  make(p, size, w) {
    const L = size, h = p.h, def = PASY[p.wzor] || PASY['piłka'];
    // moduł: proporcjonalny do wysokości pasa, ale nie węższy niż pozwala mostek (wąski pas = rzadszy wzór)
    const n = Math.max(1, Math.round(L / Math.max(h * def.k / p.gestosc, (def.mw || 0) * w)));
    const step = L / n, x0 = -L / 2, y0 = -h / 2, y1 = h / 2;
    const regions = [], lines = [];
    const cx = i => x0 + (i + 0.5) * step;
    const wave = (ph, amp, a, b, per) => { const pts = []; const N = Math.max(8, Math.ceil((b - a) / 1.2)); for (let k = 0; k <= N; k++) { const x = a + (b - a) * k / N; pts.push([x, amp * Math.sin(2 * Math.PI * (x - x0) / per + ph)]); } return pts; };
    switch (p.wzor) {
      case 'piłka':
        for (let i = 0; i < n; i++) {
          const a = x0 + i * step;
          regions.push([[a, y0], [a + step, y0], [a + step / 2, y1]]);
          if (i < n - 1) regions.push([[a + step / 2, y1], [a + step * 1.5, y1], [a + step, y0]]);
        }
        break;
      case 'ząbki':
        for (let i = 0; i < n; i++) { const a = x0 + i * step; regions.push([[a, y0], [a + step, y0], [a + step / 2, y1]]); }
        break;
      case 'wilcze zęby': {
        const g = Math.min(step * 0.18, h * 0.15);
        for (let i = 0; i < n; i++) {
          const a = x0 + i * step, up = i % 2 === 0;
          regions.push(up ? [[a + g, y0], [a + step - g, y0], [a + step / 2, y1]] : [[a + g, y1], [a + step / 2, y0], [a + step - g, y1]]);
        }
        break;
      }
      case 'kropki':
        for (let i = 0; i < n; i++) regions.push(circle([cx(i), 0], Math.min(h, step * 0.75) / 2));
        break;
      case 'kropki w dwóch rzędach': {
        const r = Math.min(h / 4.2, step * 0.36);
        for (let i = 0; i < n; i++) { regions.push(circle([cx(i), h / 4], r)); if (i < n - 1) regions.push(circle([cx(i) + step / 2, -h / 4], r)); }
        break;
      }
      case 'fala': {
        const cw = Math.max(h * 0.32, w + 1), amp = (h - cw) / 2, per = step;
        const gap = cw / 2 + w * 0.8;
        for (let i = 0; i < n; i++) {
          const a = x0 + i * step + gap / 2, b = x0 + (i + 1) * step - gap / 2;
          regions.push({ rings: band(wave(0, amp, a, b, per), cw, true), shrink: false });
        }
        break;
      }
      case 'wężyki': {
        const cw = Math.max(h * 0.2, w + 1), amp = (h - cw) / 2;
        const A = wave(0, amp, x0, x0 + L, step), B = wave(Math.PI, amp, x0, x0 + L, step);
        interlaceMany([{ pts: A, closed: false }, { pts: B, closed: false }], cw, w).forEach(r => regions.push(r));
        break;
      }
      case 'wężyk z listkami': {
        const cw = Math.max(h * 0.16, w + 0.5), amp = h * 0.18;
        const W = wave(0, amp, x0, x0 + L, step);
        regions.push({ rings: band(W, cw, true), shrink: false });
        for (let i = 0; i < n; i++) {
          // listek nad grzbietem fali / pod doliną, oddzielony od fali mostkiem
          const xm = x0 + (i + 0.25) * step, up = 1, base = [xm, amp + cw / 2 + w];
          const tip = [xm + step * 0.18, y1];
          regions.push({ rings: [lens(base, tip, Math.min(step, h) * 0.12)], shrink: false });
          const xn = x0 + (i + 0.75) * step, b2 = [xn, -amp - cw / 2 - w], t2 = [xn + step * 0.18, y0];
          regions.push({ rings: [lens(b2, t2, Math.min(step, h) * 0.12)], shrink: false });
        }
        break;
      }
      case 'sznur': {                                             // ukośne ogniwka stykające się bokami – mostki między nimi daje silnik
        const sl = Math.min(h * 0.9, step * 1.3);
        for (let i = 0; i < n; i++) { const a = x0 + i * step; regions.push([[a, y0], [a + step, y0], [a + step + sl, y1], [a + sl, y1]].map(([x, y]) => [Math.min(x, x0 + L), y])); }
        break;
      }
      case 'jodełka':
        for (let i = 0; i < n; i++) {
          const a = x0 + i * step, t = step * 0.48;
          regions.push([[a, 0], [a + t, 0], [a + t + step * 0.55, y1], [a + step * 0.55, y1]]);
          regions.push([[a, 0], [a + step * 0.55, y0], [a + t + step * 0.55, y0], [a + t, 0]]);
        }
        break;
      case 'krokiewki':
        for (let i = 0; i < n; i++) {
          const a = x0 + i * step, t = Math.max(step * 0.35, w + 2);
          regions.push([[a, y1], [a + t, y1], [a + step * 0.5 + t, 0], [a + t, y0], [a, y0], [a + step * 0.5, 0]]);
        }
        break;
      case 'półkola':
        for (let i = 0; i < n; i++) { const rr = Math.min(step * 0.45, h); regions.push(arc([cx(i), y0], rr, 0, Math.PI, 28)); }
        break;
      case 'łuski': {                                             // „janiki” – sierpy jak łuski, jeden rząd
        const rr = Math.min(step * 0.48, h / 2);
        for (let i = 0; i < n; i++) {
          const c = [cx(i), y0 + rr];
          const moon = subtract([circle(c, rr)], [circle([c[0], c[1] + rr * 0.55], rr * 0.92)]);
          moon.forEach(r => regions.push(r));
        }
        break;
      }
      case 'rombiki':
        for (let i = 0; i < n; i++) { const c = cx(i), dx = Math.min(step * 0.42, h * 0.6); regions.push([[c - dx, 0], [c, y1], [c + dx, 0], [c, y0]]); }
        break;
      case 'recica (romby)':
        for (let i = 0; i < n; i++) {
          const c = cx(i);
          regions.push([[c - step / 2, 0], [c, y1], [c + step / 2, 0], [c, y0]]);
          lines.push({ pts: [[c - step / 4, -h / 4], [c + step / 4, h / 4]] });
        }
        break;
      case 'krzyżyki':
        for (let i = 0; i < n; i++) {
          const c = cx(i), r = Math.max(Math.min(h, step * 0.8) / 2, 4), t = Math.min(r, Math.max(r * 0.4, 3.4));
          regions.push({ parts: [[[c - r, -t / 2], [c + r, -t / 2], [c + r, t / 2], [c - r, t / 2]], [[c - t / 2, -r], [c + t / 2, -r], [c + t / 2, r], [c - t / 2, r]]] });
        }
        break;
      case 'kreski':
        for (let i = 0; i < n; i++) { const a = x0 + i * step + step * 0.12; regions.push([[a, -h / 2], [a + step * 0.76, -h / 2], [a + step * 0.76, h / 2], [a, h / 2]]); }
        break;
      case 'łuczki z kółkami':
        for (let i = 0; i < n; i++) {
          const a = x0 + i * step, c = [a + step / 2, y0];
          const rr = Math.min(step / 2, h * 0.75);
          regions.push(arc(c, rr, 0, Math.PI, 32));
          const k = Math.min(h * 0.12, step * 0.12) + w / 2;
          regions.push(circle([a + step, y0 + h - k * 1.1], k));
        }
        lines.push({ pts: [[x0 - 1, y0 + h * 0.18], [x0 + L + 1, y0 + h * 0.18]] });
        break;
      case 'łańcuszek':
        for (let i = 0; i < n; i++) {
          const c = cx(i);
          regions.push(lens([c - step * 0.42, 0], [c + step * 0.12, 0], Math.min(h, step) * 0.42));
          regions.push(circle([c + step * 0.32, 0], Math.min(h * 0.22, step * 0.12)));
        }
        break;
      default: {                                                  // gadzik – wężyk przerywany
        const amp = h * 0.3, cw = Math.max(h * 0.28, 2.2 * w);
        for (let i = 0; i < n; i++) {
          const a = x0 + i * step, seg = [];
          const g = Math.min(0.3, ((cw + w) / 2 + 0.5) / step);
          for (let k = 0; k <= 30; k++) { const t = g + (1 - 2 * g) * k / 30; seg.push([a + step * t, amp * Math.sin(Math.PI * t) * (i % 2 ? -1 : 1)]); }
          regions.push({ rings: band(seg, cw, true), shrink: false });
        }
      }
    }
    return { regions, lines };
  },
};

export const MOTYWY = [parzenicaPodhalanska, smok, cyrklowa, rozeta, kwiatZycia, slonce, wschodzace, gwiazda, wirujaca, krzyz, piatka, sznurowa, fryz, napis, podpis, podpisSmok];

export function defaults(m) { return Object.fromEntries(m.params.map(q => [q.key, q.def])); }
export const byId = id => MOTYWY.find(m => m.id === id);
