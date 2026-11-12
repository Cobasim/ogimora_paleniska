// Eksport DXF w formacie R12 (AC1009) — czytają go wszystkie programy CAM/CAD.
// Same rysunki: bez tekstów, opisów i wymiarów. Skala 1:1, jednostki: milimetry albo cale (opcja { jedn: 'in' }).
// R12 nie ma pewnego pola jednostek – program do cięcia pyta przy imporcie albo przyjmuje swoje ustawienie;
// dlatego jednostka jest też w nazwie pliku i w komentarzu na początku.
//  • kontur bez łuków → zamknięta polilinia,
//  • podpis (linia cięcia bez otworu) → otwarta polilinia,
//  • kontur z łukami → odcinki (LINE) i prawdziwe łuki (ARC) – część przeglądarek i programów
//    pomija łuki zapisane w polilinii R12 („bulge”), a LINE/ARC czyta każdy program.
// Tylko to, co laser ma wyciąć: jedna warstwa CIECIE. Bez linii gięcia.
import { layout } from './geometry.js';
import { WERSJA, LIMIT_SZTUK } from './wersja.js';

const LAYERS = [
  ['CIECIE', 7, 'CONTINUOUS'],
];

// precyzja zapisu: mm – 3 miejsca (0,001 mm), cale – 5 miejsc (0,00001" = 0,00025 mm); ustawiane w buildDxf
let DEC = 3;
const f = n => (Math.abs(n) < 0.5 * 10 ** -DEC ? 0 : n).toFixed(DEC);

function polyline(points, layer, dx, dy) {
  let s = `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n1\n10\n0\n20\n0\n30\n0\n`;
  for (const q of points) s += `0\nVERTEX\n8\n${layer}\n10\n${f(q.x + dx)}\n20\n${f(q.y + dy)}\n30\n0\n`;
  return s + `0\nSEQEND\n8\n${layer}\n`;
}
function openPolyline(points, layer, dx, dy) {
  let s = `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n0\n10\n0\n20\n0\n30\n0\n`;
  for (const q of points) s += `0\nVERTEX\n8\n${layer}\n10\n${f(q.x + dx)}\n20\n${f(q.y + dy)}\n30\n0\n`;
  return s + `0\nSEQEND\n8\n${layer}\n`;
}
function line(a, b, layer, dx, dy) {
  return `0\nLINE\n8\n${layer}\n10\n${f(a.x + dx)}\n20\n${f(a.y + dy)}\n30\n0\n11\n${f(b.x + dx)}\n21\n${f(b.y + dy)}\n31\n0\n`;
}
/** Łuk od a do b o wypukłości bulge (DXF): b > 0 – przeciwnie do wskazówek zegara. */
function arc(a0, b0, bulge, layer, dx, dy) {
  const R3 = v => Math.round(v * 10 ** DEC) / 10 ** DEC;
  const a = { x: R3(a0.x + dx) - dx, y: R3(a0.y + dy) - dy }, b = { x: R3(b0.x + dx) - dx, y: R3(b0.y + dy) - dy };   // te same punkty co w LINE
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, cx = b.x - a.x, cy = b.y - a.y, c = Math.hypot(cx, cy);
  if (c < 1e-9) return '';
  const k = (1 - bulge * bulge) / (4 * bulge);                 // przesunięcie środka wzdłuż prostopadłej (w długościach cięciwy)
  const ox = mx - cy * k, oy = my + cx * k;
  const r = Math.hypot(a.x - ox, a.y - oy);
  const ang = (p) => Math.atan2(p.y - oy, p.x - ox) * 180 / Math.PI;
  let s0 = ang(a), s1 = ang(b);
  if (bulge < 0) [s0, s1] = [s1, s0];                           // ARC w DXF zawsze przeciwnie do wskazówek zegara
  const n = v => ((v % 360) + 360) % 360;
  // środek i promień z 3 miejscami więcej niż punkty – końce łuku trafiają w końce odcinków
  const D6 = DEC + 3, f6 = v => (Math.abs(v) < 0.5 * 10 ** -D6 ? 0 : v).toFixed(D6);
  return `0\nARC\n8\n${layer}\n10\n${f6(ox + dx)}\n20\n${f6(oy + dy)}\n30\n0\n40\n${f6(r)}\n50\n${n(s0).toFixed(8)}\n51\n${n(s1).toFixed(8)}\n`;
}
/** Zamknięty kontur: polilinia albo odcinki + łuki. */
function contour(points0, layer, dx, dy) {
  // Punkty leżące bliżej niż 0,01 mm zlewają się w zapisie w jeden – powstawały z nich odcinki o zerowej długości
  // („zdublowane linie” w programach do wyceny). Usuwamy punkt, którego odcinek do następnego jest krótszy niż 0,01 mm.
  let points = points0;
  for (let zm = true; zm && points.length > 3;) { zm = false;
    points = points.filter((q, i) => { const nx = points[(i + 1) % points.length]; if (!zm && Math.hypot(nx.x - q.x, nx.y - q.y) < 0.01 * SK) { zm = true; return false; } return true; }); }
  if (!points.some(q => q.b)) return polyline(points, layer, dx, dy);
  let s = '';
  points.forEach((q, i) => {
    const nx = points[(i + 1) % points.length];
    if (Math.hypot(nx.x - q.x, nx.y - q.y) < 1e-6) return;
    s += q.b ? arc(q, nx, q.b, layer, dx, dy) : line(q, nx, layer, dx, dy);
  });
  return s;
}

let SK = 1;   // skala zapisu: 1 (mm) albo 1/25,4 (cale)
/** model – części w mm; opcje.jedn: 'mm' (domyślnie) albo 'in' – ta sama geometria zapisana w calach. */
export function buildDxf(model, opcje = {}) {
  const cale = opcje.jedn === 'in';
  SK = cale ? 1 / 25.4 : 1; DEC = cale ? 5 : 3;
  const sk = r => r.map(q => ({ ...q, x: q.x * SK, y: q.y * SK }));   // bulge (wypukłość łuku) nie zależy od skali
  const { placed, width: w0, height: h0 } = layout(model.parts);
  const width = w0 * SK, height = h0 * SK;
  let ents = '';
  for (const it of placed) {
    const { part } = it, dx = it.dx * SK, dy = it.dy * SK;
    ents += contour(sk(part.outline), 'CIECIE', dx, dy);
    (part.holes || []).forEach(h => { ents += contour(sk(h), 'CIECIE', dx, dy); });
    // podpis: otwarte linie cięcia (szczelina bez otworu)
    (part.lines || []).forEach(l => { ents += openPolyline(sk(l), 'CIECIE', dx, dy); });
  }

  let tables = `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n` +
    `0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n` +
    `0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n${LAYERS.length}\n`;
  for (const [name, color, lt] of LAYERS) tables += `0\nLAYER\n2\n${name}\n70\n0\n62\n${color}\n6\n${lt}\n`;
  tables += `0\nENDTAB\n0\nENDSEC\n`;

  // $INSUNITS 4 = milimetry, 1 = cale; $MEASUREMENT 1 = metryczne, 0 = calowe
  const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n${cale ? 1 : 4}\n9\n$MEASUREMENT\n70\n${cale ? 0 : 1}\n` +
    `9\n$EXTMIN\n10\n0\n20\n0\n30\n0\n9\n$EXTMAX\n10\n${f(width)}\n20\n${f(height)}\n30\n0\n0\nENDSEC\n`;
  // komentarze (kod 999 – programy je pomijają): skąd plik, wersja strony, licencja w skrócie; same znaki ASCII
  const uwagi = [`OGIMORA fire pit generator - ogimora.com - test site v${WERSJA}`,
    `License: free for personal use; commercial use up to ${LIMIT_SZTUK} finished fire pits per design; do not sell or share this file`,
    `No warranty: generated by a script, check before cutting. Units: ${cale ? 'inches' : 'mm'}, scale 1:1`].map(u => `999\n${u}\n`).join('');
  return uwagi + header + tables + `0\nSECTION\n2\nENTITIES\n${ents}0\nENDSEC\n0\nEOF\n`;
}
