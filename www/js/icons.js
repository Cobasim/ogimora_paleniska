// Ikony opisujące suwaki i opcje — zamiast tekstu (mniej miejsca, mniej do tłumaczenia).
// Czarne = kształt, czerwone = to, co zmienia dana opcja. Pełna nazwa jest w podpowiedzi (title).
// Atrybuty wpisane wprost w SVG: ikona wygląda dobrze nawet bez arkusza stylów (np. stara wersja w pamięci przeglądarki).
const RED = '#df3434';
const attrs = body => body
  .replace(/class="r( [^"]*)?"/g, (m, x) => `class="r${x || ''}" stroke="${RED}" stroke-width="${x && x.includes('thin') ? 1.2 : 2.4}"`)
  .replace(/class="rf( [^"]*)?"/g, (m, x) => `class="rf${x || ''}" fill="${RED}" stroke="none"${x && x.includes('soft') ? ' opacity=".5"' : ''}`)
  .replace(/class="b"/g, 'class="b" stroke="#2f6fe0" stroke-width="2.6"')
  .replace(/class="kf"/g, 'class="kf" fill="currentColor" stroke="none"')
  .replace(/class="k thin"/g, 'class="k thin" stroke-width="1.2"');
const svg = (body, vb = '0 0 24 24', w = 22, h = 22) => `<svg class="ic" viewBox="${vb}" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${attrs(body)}</svg>`;

// kostka izometryczna do przycisków kamery
const T = '12 3', R = '20 7.5', L = '4 7.5', C = '12 12', B = '12 21', LL = '4 16.5', LR = '20 16.5';
const cube = `<path class="k" d="M${T}L${R}V16.5L${B}L${LL}V7.5Z"/><path class="k" d="M${L}L${C}L${R}M${C}V21"/>`;

export const ICONS = {
  base: svg('<rect class="k" x="5" y="5" width="14" height="14"/><path class="r" d="M5 19H19"/>'),
  height: svg('<path class="k" d="M3 5H21L17 19H7Z"/><path class="r" d="M12 5V19M10 5H14M10 19H14"/>'),
  angle: svg('<path class="k" d="M3 19H21"/><path class="r" d="M7 19L15 5"/><path class="r thin" d="M13 19A6 6 0 0 0 10 13.8"/>'),
  notchDepth: svg('<path class="k" d="M3 7H8V14H16V7H21L19 20H5Z"/><path class="r" d="M12 7V14M10.5 7H13.5"/>'),
  notchWidth: svg('<path class="k" d="M3 7H8V14H16V7H21L19 20H5Z"/><path class="r" d="M8 10.5H16M8 8.8V12.2M16 8.8V12.2"/>'),
  thk: svg('<path class="k" d="M3 9H21M3 15H21"/><path class="r" d="M12 3V9M12 15V21M10.3 7.2L12 9L13.7 7.2M10.3 16.8L12 15L13.7 16.8"/>'),
  top: svg('<path class="k" d="M3 5H21L17 19H7Z"/><path class="r" d="M3 5H21"/>'),
  legHeight: svg('<path class="k" d="M3 5H21M8 5L5 20M16 5L19 20"/><path class="r" d="M12 5V20M10 20H14M10 5H14"/>'),
  footTop: svg('<path class="k" d="M5 5H19L15 20H9Z"/><path class="r" d="M5 5H19"/>'),
  footBottom: svg('<path class="k" d="M5 5H19L15 20H9Z"/><path class="r" d="M9 20H15"/>'),
  footAngle: svg('<path class="k" d="M3 5H21"/><path class="r" d="M8 5L13 20"/><path class="r thin" d="M14 5A6 6 0 0 1 9.9 10.7"/>'),
  footInset: svg('<path class="k" d="M21 4H4V21"/><path class="k" d="M17 10H10V17"/><path class="r" d="M4 4L10 10"/>'),
  gap: svg('<path class="k" d="M2 12H8.5V21M15.5 21V12H22"/><rect class="k" x="10.5" y="3" width="3" height="18"/><path class="rf" d="M8.9 12H10.1V21H8.9ZM13.9 12H15.1V21H13.9Z"/>'),
  match: svg('<path class="k" d="M3 4L7 14H17L21 4"/><path class="r" d="M7 14L5 21M17 14L19 21"/><path class="r thin" stroke-dasharray="1.5 2" d="M3 4L7 14M21 4L17 14"/>'),
  // wykonanie
  weld: svg('<path class="k" d="M5 3V19H21"/><path class="rf" d="M6 18V12.5L11.5 18Z"/>'),
  bend: svg('<path class="k" d="M5 3V13M11 19H21"/><path class="r" d="M5 13A6 6 0 0 0 11 19"/>'),
  bendAll: svg('<path class="k" d="M8.5 2.5H15.5V8.5H21.5V15.5H15.5V21.5H8.5V15.5H2.5V8.5H8.5Z"/><path class="r" stroke-dasharray="2.2 1.8" d="M8.5 8.5H15.5V15.5H8.5Z"/>'),
  bendLine: svg('<rect class="k" x="3" y="5" width="18" height="14"/><path class="r" stroke-dasharray="2.5 2" d="M3 12H21"/>'),
  // grubość blach: misa / stopki
  bowl: svg('<path class="k" d="M3 6L6 18H18L21 6"/>'),
  leg: svg('<path class="k" d="M4 6H20M8 6L5 19M16 6L19 19"/>'),
  // widok
  edges: svg(cube),
  xray: svg(`<path class="k" d="M${T}L${R}V16.5L${B}L${LL}V7.5Z"/><path class="k" d="M${L}L${C}L${R}M${C}V21"/><path class="r thin" stroke-dasharray="1.6 1.8" d="M${LL}L12 12.6L${LR}M12 12.6V3"/>`),
  iso: svg(cube),
  seamWeld: svg(`${cube}<path class="r" stroke-width="3" d="M${C}V21M${L}L${C}"/>`),
  fire: svg('<path class="k" d="M3 14H21L18 21H6Z"/><path class="r" d="M12 13C9.2 13 8 11.4 8 9.6C8 7.6 9.6 6.6 10 4C11.4 4.9 12.2 6.2 12.2 7.6C12.9 7 13.3 6.2 13.3 5.2C15 6.5 16 8 16 9.6C16 11.6 14.6 13 12 13Z"/>'),
  night: svg('<path class="k" d="M3 14H21L18 21H6Z"/><path class="kf" d="M14.5 3.5A5 5 0 1 0 19.5 10.2A4 4 0 0 1 14.5 3.5Z"/>'),
  seamBend: svg(`${cube}<path class="b" d="M${LL}L${B}L${LR}"/>`),
  front: svg(`<path class="rf soft" d="M${L}L${C}L${B}L${LL}Z"/>${cube}`),
  topView: svg(`<path class="rf soft" d="M${T}L${R}L${C}L${L}Z"/>${cube}`),
  bottom: svg(`${cube}<path class="r" d="M12 23.5V21.5M10.5 22.8L12 21.3L13.5 22.8"/>`, '0 0 24 25'),
  // statystyki
  size: svg('<rect class="k" x="4" y="8" width="16" height="12"/><path class="r" d="M4 4H20M4 2.5V5.5M20 2.5V5.5"/>'),
  mass: svg('<circle class="k" cx="12" cy="6" r="2.6"/><path class="k" d="M7 9H17L19.5 20H4.5Z"/>'),
  sheet: svg('<path class="k" d="M3 9L9 5H21L15 9Z"/><path class="k" d="M3 9V11H15L21 7V5M15 9V11"/>'),
  cut: svg('<path class="r" stroke-dasharray="3 2.2" d="M3 18C8 18 9 6 14 6S20 13 21 13"/><path class="k" d="M3 18H4"/>'),
  warn: svg('<path class="k" d="M12 3L22 20H2Z"/><path class="r" d="M12 9V14M12 17V17.2"/>'),
};

/** Gęstość nacięć: linia gięcia z 0 / 2 / 3 / 5 szczelinami. */
export function perfIcon(level) {
  const n = [0, 2, 3, 5][level];
  let s = `<path class="${n ? 'k thin' : 'r'}" ${n ? '' : 'stroke-dasharray="3 2"'} d="M2 6H34"/>`;
  for (let i = 0; i < n; i++) {
    const w = 26 / n * 0.62, x = 5 + (26 / n) * i + (26 / n - w) / 2;
    s += `<rect class="kf" x="${x.toFixed(2)}" y="4" width="${w.toFixed(2)}" height="4" rx="2"/>`;
  }
  return svg(s, '0 0 36 12', 30, 10).replace('class="ic"', 'class="ic wide"');
}
