// OGIMORA – teksty strony startowej. Jedno źródło: przeglądarka (js/start.js) i budowanie wersji /pl/ i /en/ (narzedzia/buduj/jezyki.mjs).
export const TEKSTY = {
  pl: {
    tytul: 'OGIMORA — darmowe projekty ze stali: palenisko i kostka do spawania (DXF)',
    opis: 'Darmowe generatory projektów z blachy: stalowe palenisko ogrodowe i kostka do nauki spawania. Ustawiasz wymiary i wzór, pobierasz plik DXF do cięcia laserem lub plazmą.',
    h1: 'Zaprojektuj coś ze stali. Pobierz plik do cięcia.',
    wstep: 'Dwa darmowe generatory. Ustawiasz wymiary, wzory i napis w przeglądarce, a strona tworzy plik DXF w skali 1:1 – gotowy dla zakładu z laserem albo plazmą.',
    modele: {
      palenisko: { nazwa: 'Palenisko', haslo: 'Stalowe palenisko ogrodowe', opis: 'Cztery ścianki i dno na zamki, bez spawania. Wymiary, pochylenie ścianek, wzór na każdej ściance, własny napis.', przycisk: 'Zaprojektuj palenisko', alt: 'Stalowe palenisko z wyciętymi wzorami – model startowy' },
      kostka: { nazwa: 'Kostka', haslo: 'Kostka do nauki spawania', opis: 'Sześć ścianek do zespawania: ćwiczysz spoiny narożne, zostaje kostka do gry, lampion albo ozdoba. Bok 10–70 cm, kropki, liczby, napis, ścięte narożniki.', przycisk: 'Zaprojektuj kostkę', alt: 'Stalowa kostka ze ściętymi narożnikami i napisem – model startowy' },
    },
    twoje: 'Twoje ostatnie', twojeT: 'Projekty zapisują się same w tej przeglądarce',
    jak: 'Jak to działa',
    kroki: [['Ustaw', 'Wymiary, grubość blachy, wzory i napis. Podgląd 3D zmienia się od razu.'], ['Pobierz', 'Plik DXF w milimetrach albo calach i papierowy model PDF do sprawdzenia wymiarów.'], ['Wytnij', 'Wyślij plik do zakładu z laserem lub plazmą. Strona pokazuje orientacyjną cenę cięcia.']],
    stopka: 'Strona testowa: pliki tworzy skrypt, bez gwarancji – sprawdź je przed cięciem. Bez kont i ciasteczek. Kontakt: info@ogimora.com',
  },
  en: {
    tytul: 'OGIMORA — free steel designs: fire pit and welding cube (DXF)',
    opis: 'Free generators of sheet-steel projects: a garden fire pit and a cube for welding practice. Set the size and pattern, download a DXF ready for laser or plasma cutting.',
    h1: 'Design something in steel. Download the cutting file.',
    wstep: 'Two free generators. Set the size, patterns and lettering in your browser and the site makes a DXF file at 1:1 scale – ready for a laser or plasma shop.',
    modele: {
      palenisko: { nazwa: 'Fire pit', haslo: 'Steel garden fire pit', opis: 'Four walls and a floor that slot together, no welding. Size, wall angle, a pattern on every wall, your own lettering.', przycisk: 'Design a fire pit', alt: 'Steel fire pit with cut-out patterns – starter model' },
      kostka: { nazwa: 'Cube', haslo: 'Cube for welding practice', opis: 'Six sides to weld: you practise corner welds and keep a dice, a lantern or a garden piece. Side 4–28 in, dots, numbers, lettering, cut corners.', przycisk: 'Design a cube', alt: 'Steel cube with cut corners and lettering – starter model' },
    },
    twoje: 'Your recent designs', twojeT: 'Designs save themselves in this browser',
    jak: 'How it works',
    kroki: [['Set it up', 'Size, sheet thickness, patterns and lettering. The 3D preview updates as you go.'], ['Download', 'A DXF file in millimetres or inches and a paper model (PDF) to check the size.'], ['Get it cut', 'Send the file to a laser or plasma shop. The site shows a rough cutting price.']],
    stopka: 'Test site: files are made by a script, no warranty – check them before cutting. No accounts, no cookies. Contact: info@ogimora.com',
  },
};
const STRONY = { palenisko: 'firepit/', kostka: 'cube/' }, OBRAZ = { palenisko: 'img/start-firepit.jpg', kostka: 'img/start-cube.jpg' };
/** HTML treści strony startowej. prefiks = '' albo 'pl/' / 'en/' (adresy względem katalogu głównego). */
export function htmlStartu(j, prefiks = '') {
  const t = TEKSTY[j];
  const karta = m => { const x = t.modele[m]; return `<article class="st-karta" data-model="${m}">
      <a class="st-obraz" href="${prefiks}${STRONY[m]}?nowy=start"><img src="${OBRAZ[m]}" alt="${x.alt}" width="800" height="560" loading="lazy"></a>
      <div class="st-tresc"><p class="st-nad">${x.nazwa}</p><h2>${x.haslo}</h2><p>${x.opis}</p>
        <a class="st-btn" href="${prefiks}${STRONY[m]}?nowy=start">${x.przycisk} <span aria-hidden="true">→</span></a>
        <div class="st-twoje" data-twoje="${m}" hidden></div></div>
    </article>`; };
  return `<section class="st-hero"><h1>${t.h1}</h1><p>${t.wstep}</p></section>
    <section class="st-modele">${karta('palenisko')}${karta('kostka')}</section>
    <section class="st-jak"><h2>${t.jak}</h2><ol>${t.kroki.map(([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`).join('')}</ol></section>
    <p class="st-stopka">${t.stopka}</p>`;
}
