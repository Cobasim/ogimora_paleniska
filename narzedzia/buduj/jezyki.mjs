// OGIMORA – wersje językowe pliku index.html dla wyszukiwarek:
//   /      – język według przeglądarki (jak dotąd); dla Google to adres „domyślny” (x-default)
//   /pl/   – zawsze po polsku      /en/ – zawsze po angielsku   (te same pliki strony, tylko inny nagłówek i opis)
// Teksty poniżej to JEDYNE miejsce, gdzie zmienia się tytuł, opis i tekst dla wyszukiwarek w wersji angielskiej.
const ADRES = 'https://ogimora.com';
const TXT = {
  pl: { tytul: 'OGIMORA — zaprojektuj stalowe palenisko, pobierz DXF',
        opis: 'Darmowy generator stalowego paleniska: wymiary, wzór, napis – i gotowy plik DXF do cięcia laserem lub plazmą.' },
  en: { tytul: 'OGIMORA — design a steel fire pit, download the DXF',
        opis: 'Free steel fire pit generator: set the size, pick a pattern, add lettering – and download a DXF ready for laser or plasma cutting.',
        blok: `<div class="opis-tekst">
    <h1>OGIMORA – free steel fire pit generator (DXF files)</h1>
    <p>Design a steel fire pit in your browser and download a DXF file ready for CNC cutting – laser or plasma. Set the size, the wall angle and the sheet thickness (3, 4 or 5 mm), pick a cut-out pattern for each wall and add your own lettering. The parts go together with tabs and slots, no jigs needed.</p>
    <p>Downloads: a DXF file in millimetres at 1:1 scale, an A4 paper model (PDF) and small test plates for finding the right slot clearance on your own machine. The site also shows a rough cutting price.</p>
    <p>This is a test site: the files are made by a script and come with no warranty – check them before cutting. Licence: free for your own use; commercial use up to 20 finished fire pits per design; do not sell the files. Made by OGI. Contact: info@ogimora.com.</p>
  </div>` },
};
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** html = gotowy index.html (polski). Zwraca { '': html dla /, pl: …, en: … }. */
export function wersjeJezykowe(html, wersja) {
  const blokPL = /<!--OPIS-->([\s\S]*?)<!--\/OPIS-->/.exec(html);
  if (!blokPL) throw new Error('index.html: brak bloku <!--OPIS-->');
  const wynik = {};
  for (const j of ['', 'pl', 'en']) {
    const t = TXT[j || 'pl'], url = `${ADRES}/${j ? j + '/' : ''}`;
    const og = j === 'pl' ? TXT.pl : TXT.en;                       // podgląd linku z adresu głównego: po angielsku (posty idą głównie za granicę)
    let h = html;
    if (j === 'en') h = h.replace('<html lang="pl">', '<html lang="en">').replace(/<title>[\s\S]*?<\/title>/, `<title>${t.tytul}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(t.opis)}">`);
    h = h.replace(blokPL[0], j === 'en' ? TXT.en.blok : j === 'pl' ? blokPL[1] : blokPL[1] + '\n  ' + TXT.en.blok.replace('<div class="opis-tekst">', '<div class="opis-tekst" lang="en">'));
    const ld = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'OGIMORA', url, description: t.opis, inLanguage: j || ['pl', 'en'],
      applicationCategory: 'DesignApplication', operatingSystem: 'Any (web browser)', softwareVersion: wersja, isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: j === 'pl' ? 'PLN' : 'USD' },
      author: { '@type': 'Person', name: 'OGI' }, publisher: { '@type': 'Organization', name: 'OGIMORA', url: ADRES + '/', logo: ADRES + '/img/logo.svg' } };
    const glowa = `${j ? '  <base href="/">\n' : ''}  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="pl" href="${ADRES}/pl/">
  <link rel="alternate" hreflang="en" href="${ADRES}/en/">
  <link rel="alternate" hreflang="x-default" href="${ADRES}/">
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
    // <base> musi stać przed pierwszym adresem względnym – wstawiamy zaraz po <meta charset>
    h = h.replace(/(<meta charset="utf-8">\n)/, `$1${glowa}`);
    wynik[j] = h;
  }
  return wynik;
}
