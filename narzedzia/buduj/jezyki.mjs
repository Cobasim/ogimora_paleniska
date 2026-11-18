// OGIMORA – wersje językowe stron dla wyszukiwarek. Każda strona ma trzy adresy:
//   /<strona>      – język według przeglądarki; dla Google adres „domyślny” (x-default)
//   /pl/<strona>   – zawsze po polsku        /en/<strona> – zawsze po angielsku
// Strony: '' (start), 'firepit/' (palenisko), 'cube/' (kostka). Te same pliki strony, inny nagłówek i opis.
// Teksty paleniska i kostki poniżej; teksty strony startowej – www/js/start_teksty.js (wspólne z przeglądarką).
import { TEKSTY, htmlStartu } from '../../www/js/start_teksty.js';
const ADRES = 'https://ogimora.com';
const TXT = {
  pl: { tytul: 'OGIMORA — zaprojektuj stalowe palenisko, pobierz DXF',
        opis: 'Darmowy generator stalowego paleniska: wymiary, wzór, napis – i gotowy plik DXF do cięcia laserem lub plazmą.' },
  en: { tytul: 'OGIMORA — design a steel fire pit, download the DXF',
        opis: 'Free steel fire pit generator: set the size, pick a pattern, add lettering – and download a DXF ready for laser or plasma cutting.',
        blok: `<div class="opis-tekst">
    <h1>OGIMORA – free steel fire pit generator (DXF files)</h1>
    <p>Design a steel fire pit in your browser and download a DXF file ready for CNC cutting – laser or plasma. Set the size, the wall angle and the sheet thickness (3, 4 or 5 mm – or in inches: 11 ga, 10 ga, 3/16" or 1/4"), pick a cut-out pattern for each wall and add your own lettering. The parts go together with tabs and slots, no jigs needed.</p>
    <p>Downloads: a DXF file at 1:1 scale in millimetres or inches, a paper model (PDF, A4 or US Letter) and small test plates for finding the right slot clearance on your own machine. The site also shows a rough cutting price.</p>
    <p>This is a test site: the files are made by a script and come with no warranty – check them before cutting. Licence: free for your own use; commercial use up to 20 finished fire pits per design; do not sell the files. Made by OGI. Contact: info@ogimora.com.</p>
  </div>` },
};
const KOSTKA = {
  pl: { tytul: 'OGIMORA — stalowa kostka do nauki spawania, darmowy DXF',
        opis: 'Darmowa stalowa kostka do nauki spawania: bok 10–70 cm, kropki, liczby, napis, ścinane narożniki – i gotowy plik DXF do cięcia laserem lub plazmą.' },
  en: { tytul: 'OGIMORA — steel welding cube, free DXF',
        opis: 'Free steel cube for welding practice: 4–28 in side, dots, numbers, lettering, cut corners – download a DXF ready for laser or plasma cutting.',
        blok: `<div class="opis-tekst" id="opisK">
    <h1>OGIMORA – steel cube for welding practice (free DXF file)</h1>
    <p>A sheet-steel cube to weld yourself: you practise corner welds and keep the result – a dice, a lantern or a garden piece. Set the side from 4 to 28 in (10–70 cm), sheet from 14 ga (2 mm), dots, numbers or your own lettering on each side, cut corners and an opening in any side.</p>
    <p>The sides meet at their inner edges, which leaves an open groove for the weld on the outside. Locating tabs hold the sides in place while you tack. DXF at 1:1 scale, in millimetres or inches. Free.</p>
  </div>` },
};
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const adres = (j, strona) => `${ADRES}/${j ? j + '/' : ''}${strona}`;

/** Nagłówek dla wyszukiwarek i podglądu linku: canonical, hreflang, og:*, schema.org. */
function glowa(j, strona, t, og, wersja, nazwa) {
  const url = adres(j, strona);
  const ld = { '@context': 'https://schema.org', '@type': strona ? 'WebApplication' : 'WebSite', name: nazwa, url, description: t.opis, inLanguage: j || ['pl', 'en'],
    ...(strona ? { applicationCategory: 'DesignApplication', operatingSystem: 'Any (web browser)', softwareVersion: wersja, isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: j === 'pl' ? 'PLN' : 'USD' } } : {}),
    author: { '@type': 'Person', name: 'OGI' }, publisher: { '@type': 'Organization', name: 'OGIMORA', url: ADRES + '/', logo: ADRES + '/img/logo.svg' } };
  return `  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="pl" href="${adres('pl', strona)}">
  <link rel="alternate" hreflang="en" href="${adres('en', strona)}">
  <link rel="alternate" hreflang="x-default" href="${adres('', strona)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="OGIMORA">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(og.tytul)}">
  <meta property="og:description" content="${esc(og.opis)}">
  <meta property="og:image" content="${ADRES}/img/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="${j === 'pl' ? 'pl_PL' : 'en_US'}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
`;
}
/** Wspólne: język, tytuł, opis, <base>, nagłówek. podmien(h, j) wstawia tekst strony w danym języku. */
function wersje(html, strona, T, wersja, nazwy, podmien) {
  const wynik = {};
  for (const j of ['', 'pl', 'en']) {
    const t = T[j || 'pl'], og = j === 'pl' ? T.pl : T.en;               // podgląd linku z adresu domyślnego: po angielsku (posty idą głównie za granicę)
    let h = html.replace(/\s*<link rel="canonical"[^>]*>/, '').replace(/\s*<meta property="og:[^>]*>/g, '');
    if (j === 'en') h = h.replace(/<html lang="pl"/, '<html lang="en"').replace(/<title>[\s\S]*?<\/title>/, `<title>${t.tytul}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(t.opis)}">`);
    h = podmien(h, j);
    // <base>: strony językowe leżą głębiej – wszystkie adresy względne liczą się od katalogu głównego
    if (j) h = /<base href="[^"]*">/.test(h) ? h.replace(/<base href="[^"]*">/, '<base href="/">') : h.replace(/(<meta charset="utf-8">\n)/, '$1  <base href="/">\n');
    const g = glowa(j, strona, t, og, wersja, nazwy[j === 'pl' ? 'pl' : 'en']);
    h = /<base href="[^"]*">\n/.test(h) ? h.replace(/(<base href="[^"]*">\n)/, `$1${g}`) : h.replace(/(<meta charset="utf-8">\n)/, `$1${g}`);
    wynik[(j ? j + '/' : '') + strona] = h;
  }
  return wynik;
}

/** Palenisko: html = gotowy firepit/index.html (polski). Zwraca { 'firepit/': …, 'pl/firepit/': …, 'en/firepit/': … }. */
export function wersjeJezykowe(html, wersja) {
  const blokPL = /<!--OPIS-->([\s\S]*?)<!--\/OPIS-->/.exec(html);
  if (!blokPL) throw new Error('firepit/index.html: brak bloku <!--OPIS-->');
  return wersje(html, 'firepit/', TXT, wersja, { pl: 'OGIMORA – generator palenisk', en: 'OGIMORA – fire pit generator' },
    (h, j) => h.replace(blokPL[0], j === 'en' ? TXT.en.blok : j === 'pl' ? blokPL[1] : blokPL[1] + '\n  ' + TXT.en.blok.replace('<div class="opis-tekst">', '<div class="opis-tekst" lang="en">')));
}
/** Kostka: html = gotowy cube/index.html (polski). */
export function wersjeKostki(html, wersja) {
  const blok = /<div class="opis-tekst" id="opisK">[\s\S]*?<\/div>/.exec(html);
  if (!blok) throw new Error('cube/index.html: brak bloku opisu (#opisK)');
  return wersje(html, 'cube/', KOSTKA, wersja, { pl: 'OGIMORA – kostka do nauki spawania', en: 'OGIMORA – welding cube' },
    (h, j) => (j === 'en' ? h.replace(blok[0], KOSTKA.en.blok) : !j ? h.replace(blok[0], blok[0] + '\n  ' + KOSTKA.en.blok.replace(' id="opisK"', ' lang="en"')) : h));
}
/** Strona startowa: html = gotowy index.html. Treść (widoczna) wstawiana na stałe w języku strony – skrypt dopisuje tylko „Twoje ostatnie”. */
export function wersjeStartu(html, wersja) {
  if (!/<!--START--><!--\/START-->/.test(html)) throw new Error('index.html: brak miejsca <!--START-->');
  return wersje(html, '', TEKSTY, wersja, { pl: 'OGIMORA', en: 'OGIMORA' }, (h, j) => h.replace('<!--START--><!--/START-->', htmlStartu(j || 'pl', j ? j + '/' : '')));
}

/** Komentarze HTML nie idą na serwer (zostaje tylko podpis ©); komentarze w osadzonym <style> też. */
export const bezKomentarzy = h => h.replace(/<!--(?!\s*\(c\))[\s\S]*?-->/g, '').replace(/(<style>)\s*\/\*[\s\S]*?\*\/\s*/g, '$1').replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');
