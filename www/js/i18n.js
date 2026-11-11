// Wersja angielska generatora (ogimora.com). Bez zmian w logice: tłumaczy teksty w DOM (także te dodawane
// później – MutationObserver). Klucz = dokładny polski tekst; dla tekstów z liczbami – reguły (WZORY).
// Język: ?lang=en|pl → wybór ze strony głównej (localStorage ogi_lang) → język przeglądarki.
const Z_ADRESU = (/^\/(en|pl)\//.exec(location.pathname) || [])[1];   // ogimora.com/en/ i /pl/ – stały język (dla wyszukiwarek); ogimora.com/ – według przeglądarki
export const LANG = (() => {
  if (Z_ADRESU) return Z_ADRESU;
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'pl') { try { localStorage.setItem('ogi_lang', JSON.stringify(q)); } catch {} return q; }
  try { const s = JSON.parse(localStorage.getItem('ogi_lang') || 'null'); if (s === 'en' || s === 'pl') return s; } catch {}
  return (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';
})();
export function ustawJezyk(l) { try { localStorage.setItem('ogi_lang', JSON.stringify(l)); } catch {} const u = new URL(location.href); u.searchParams.delete('lang');
  if (Z_ADRESU) { u.pathname = u.pathname.replace(/^\/(en|pl)\//, '/' + l + '/'); location.href = u.toString(); return; }
  // adres zwykle ma #kod…, a przypisanie tego samego adresu z kotwicą NIE przeładowuje strony – dlatego replaceState + reload
  history.replaceState(null, '', u.toString()); location.reload(); }

const EN = {
  // PROSTY: wersja uproszczona
  'Przeciągnij – przesuń · kółko – przybliż · kliknij element, aby go zmienić': 'Drag – pan · wheel – zoom · click a part to edit it',
  'Przeciągnij – obrót · Shift + przeciągnij – przesuń · kółko – przybliż · kliknij ściankę, aby ją zmienić': 'Drag – rotate · Shift + drag – pan · wheel – zoom · click a side to edit it',
  'OGIMORA — zaprojektuj stalowe palenisko, pobierz DXF': 'OGIMORA — design a steel fire pit, download the DXF',
  'Płytki próbne': 'Test plates', 'sprawdź luz na swojej maszynie': 'find the tab clearance for your machine',
  'Pytania poniżej są nieobowiązkowe — robię Ogimorę sam, a to moje badanie rynku.': 'The questions below are optional — I build Ogimora on my own, and this is my market research.',
  '0,2–0,3 mm': '0.2–0.3 mm', '0,8–1,0 mm': '0.8–1.0 mm', '1,2–1,5 mm': '1.2–1.5 mm',
  'Napisz, co zmienić': 'Tell me what to change', 'Strona testowa — Twój odzew decyduje, co powstanie dalej.': 'Test site — your feedback decides what gets built next.',
  'Kilka słów': 'A few words', 'E-mail': 'E-mail', '(nieobowiązkowo, jeśli chcesz odpowiedź)': '(optional, if you want a reply)', 'Wyślij': 'Send',
  'trafia prosto do mnie': 'goes straight to me', 'Dziękuję!': 'Thank you!', 'Nie udało się wysłać – napisz na info@ogimora.com': 'Could not send – write to info@ogimora.com',
  'Blacha': 'Sheet', 'Plik DXF — za darmo.': 'DXF file — free.', 'Więcej kształtów i bogatsze wzory wkrótce.': 'More shapes and richer patterns coming.',
  // nagłówek, nawigacja
  'Ogimora — konfigurator paleniska': 'Ogimora — fire pit generator', 'Ogimora – strona główna': 'Ogimora – home', 'Pliki DXF': 'DXF files',
  'Generator': 'Generator', 'Projekty': 'Designs', 'Wersja testowa ·': 'Test version ·', 'napisz': 'tell me', 'Strona testowa – napisz, co poprawić': 'Test site – tell me what to improve',
  'Wczytaj projekt z pliku (.ogimora.json)': 'Open a project file (.ogimora.json)', 'Zapisz projekt do pliku – do przechowania albo wysłania': 'Save the project to a file – to keep or send',
  'Zacznij od nowa': 'Start over', 'Nowy projekt': 'New project', 'Wczytuję…': 'Loading…', 'wczytuję wzory…': 'loading patterns…',
  // widoki i podgląd
  'Model 3D': '3D model', 'Rozkrój do cięcia (DXF)': 'Cutting layout (DXF)', 'Wzory': 'Patterns', 'Podgląd': 'Preview',
  'Wzory: motywy tatrzańskie, smok, napisy wycinane w elementach': 'Patterns cut into the parts',
  'Rysunek: jasny model z czarnymi krawędziami': 'Drawing: light model with black edges', 'Krawędzie: podkreśl krawędzie, gięcia i łączenia': 'Edges: highlight edges, bends and joints',
  'X-ray: pokaż krawędzie zasłonięte': 'X-ray: show hidden edges', 'Pokaż linie spawania (czerwone)': 'Show weld lines (red)', 'Pokaż linie gięcia (niebieskie)': 'Show bend lines (blue)',
  'Ogień w misie: blask widać przez wzory, szczeliny gięcia i podcięcia (oświetlenie z zewnątrz bez zmian)': 'Fire in the bowl: glow through patterns, bend slots and notches',
  'Wieczór (przy włączonym ogniu): ciemna scena, ogień oświetla ziemię przez wycięcia': 'Evening (with fire on): dark scene, fire lights the ground through the cut-outs',
  'Widok izometryczny': 'Isometric view', 'Widok z przodu': 'Front view', 'Widok z góry': 'Top view', 'Widok z dołu': 'Bottom view',
  'Poprzedni widok (sprzed ostatniego przycisku widoku)': 'Previous view', 'poprzedni widok (sprzed ostatniego przycisku)': 'previous view',
  'Interaktywny model 3D paleniska': 'Interactive 3D fire pit model', 'Przeciągnij – obrót · Shift + przeciągnij – przesuń · kółko – przybliż': 'Drag – rotate · Shift + drag – pan · wheel – zoom',
  'Pokaż / schowaj panele Misa i Stopki': 'Show / hide the Bowl and Feet panels', 'Schowaj opcje': 'Hide options', 'Pokaż opcje': 'Show options',
  'Surowa: zgorzelina walcownicza, prosto z huty': 'Raw: mill scale, straight from the mill', 'Nalot: pierwsza rdza po kilku tygodniach na deszczu': 'Patina: first rust after a few weeks of rain',
  'Czarny mat: farba żaroodporna': 'Matt black: heat-resistant paint',
  // misa i stopki
  'Misa': 'Bowl', 'Stopki': 'Feet', 'Spaw': 'Weld', 'Gięcie': 'Bend', 'Osobne': 'Separate', 'Z boków': 'From sides', 'Proste': 'Straight', 'Łuk': 'Arch',
  'Spawana: dno i 4 ścianki osobno, łączone na ząbki': 'Welded: base and 4 walls separate, joined with tabs',
  'Gięta: dno i 2 przeciwległe ścianki z jednej blachy, 2 ścianki dospawane': 'Bent: base and 2 opposite walls from one sheet, 2 walls welded on',
  'Gięcie 2': 'Bend 2', 'Gięcie 4': 'Bend all',
  'Gięcie 2: dno i 2 przeciwległe ścianki z jednej blachy, 2 ścianki dospawane': 'Bend 2: base and 2 opposite walls from one sheet, 2 walls welded on',
  'Gięcie 4 (całość): dno i 4 ścianki z jednej blachy (krzyż), gięte na wszystkich brzegach dna – spawasz tylko 4 narożniki': 'Bend all: base and all 4 walls from one sheet (cross shape), bent on every base edge – you only weld the 4 corners',
  'Misa (dno + 4 ścianki)': 'Bowl (base + 4 walls)', 'Misa (dno + 2 ścianki)': 'Bowl (base + 2 walls)',
  // nawigacja i menu „Projekt” (2026-11-09)
  'Gotowe pliki': 'Ready files',
  'Start': 'Home', 'Start – Twoje projekty, gotowe projekty, kształty': 'Home – your designs, ready designs, shapes', 'Gotowe pliki DXF – strona główna': 'Ready DXF files – home', 'Generator – tu jesteś': 'Generator – you are here',
  'Projekt': 'Project', 'Nowy projekt…': 'New design…', 'Otwórz z pliku…': 'Open from file…', 'Zapisz do pliku': 'Save to file', 'do przechowania albo wysłania': 'to keep or send',
  'Wróć do poprzedniego projektu': 'Back to the previous design', 'Projekt zapisuje się sam w tej przeglądarce.': 'Your design saves itself in this browser.',
  'Zacznij od kształtu. Obecny projekt nie zginie – wrócisz do niego przez „Projekt → Wróć do poprzedniego”.': 'Start from a shape. Your current design is kept – get it back via “Project → Back to the previous design”.',
  'Pusty projekt': 'Blank design', 'Klasyczne': 'Classic', 'Piramida': 'Pyramid', 'Proste ze stopkami': 'Straight with feet', 'Wrócono do poprzedniego projektu': 'Back to the previous design',
  'Rozkrój': 'Cut layout', 'Rozkrój: elementy płasko, tak jak w pliku DXF do cięcia': 'Cut layout: flat parts, as in the DXF file',
  'Zacznij od kształtu. Obecny projekt zostaje w Twoich projektach.': 'Start from a shape. Your current design stays in your designs.',
  // luz na ząbkach
  'Luz na ząbkach': 'Tab clearance', 'Co to jest luz na ząbkach?': 'What is tab clearance?', 'Plazma': 'Plasma', 'Stara plazma': 'Old plasma',
  'Odstęp między ząbkiem jednej blachy a wycięciem w drugiej –': 'The gap between a tab of one sheet and the slot in the other –', 'z każdej strony': 'on each side',
  '. Dzięki niemu elementy wchodzą w siebie bez szlifowania.': '. It lets the parts slide together without grinding.',
  'Plazma CNC': 'CNC plasma', 'Stara / niedokładna plazma': 'Old / less accurate plasma',
  'Za mały – ząbki nie wejdą. Za duży – luźno, więcej spawania.': 'Too small – tabs won’t fit. Too large – loose, more welding.',
  'ząbek': 'tab', 'blacha z wycięciem': 'sheet with slot',
  'Spawane: dwa skrzydła łączone na ząbki': 'Welded: two wings joined with tabs', 'Gięte: jedna blacha zgięta wzdłuż narożnika': 'Bent: one sheet bent along the corner',
  'Osobne stopki pod narożnikami': 'Separate feet under the corners',
  'Nogi z boków: każdy bok przedłużony w dół do ziemi, nogi w narożnikach (kąt stopek = odwrotność kąta ścianek). Spawane: 4 boki + dno. Gięte: boki 1+2 i 3+4 jako dwa kątowniki (po jednym gięciu) + dno.': 'Legs from the sides: each wall extended down to the ground, legs at the corners.',
  'Wycięcie między nogami: proste (trapez)': 'Cut-out between legs: straight', 'Wycięcie między nogami: łuk': 'Cut-out between legs: arch',
  'Nacięcia na linii gięcia: wąskie szczeliny, żeby łatwiej zgiąć grubą blachę albo na słabszej giętarce': 'Relief slots on the bend line – easier bending of thick sheet',
  'Nacięcia na linii gięcia stopek': 'Relief slots on the feet bend line', 'Nacięcia: brak': 'Slots: none', 'Nacięcia: rzadkie': 'Slots: sparse', 'Nacięcia: średnie': 'Slots: medium', 'Nacięcia: gęste': 'Slots: dense',
  'Bok dna': 'Base side', 'Wysokość ścianek': 'Wall height', 'Odchylenie ścianek': 'Wall angle', 'Odchylenie ścianek — Kąt od pionu. Dodatni = misa rozszerza się ku górze.': 'Wall angle — from vertical. Positive = bowl widens upwards.',
  'Głębokość podcięcia': 'Notch depth', 'Głębokość podcięcia — Wycięcie w górnej krawędzi każdej ścianki (np. pod ruszt). 0 = bez podcięcia.': 'Notch depth — cut-out in the top edge of each wall (e.g. for a grate). 0 = none.',
  'Szerokość podcięcia': 'Notch width', 'Szerokość podcięcia — Szerokość wycięcia u góry ścianki, mierzona na górnej krawędzi.': 'Notch width — measured on the top edge.',
  'Górny obrys misy (wynika z boku dna, wysokości i odchylenia)': 'Top outline of the bowl (from base, height and angle)',
  'Wysokość stopek': 'Feet height', 'Wysokość stopek — Od ziemi do spodu dna. 0 = bez stopek (misa stoi bezpośrednio na ziemi lub na własnej podstawie).': 'Feet height — from the ground to the base. 0 = no feet.',
  'Szerokość u góry': 'Top width', 'Szerokość u dołu': 'Bottom width', 'Odchylenie stopek': 'Feet angle', 'Odchylenie stopek — Liczone jak odchylenie ścianek. Ten sam kąt = stopki przedłużają linię narożników misy.': 'Feet angle — like the wall angle. Same angle = feet continue the bowl corners.',
  'Stopki w linii narożników misy (kąt stopek = kąt ścianek)': 'Feet in line with the bowl corners', 'Cofnięcie od narożnika': 'Inset from corner',
  'Cofnięcie od narożnika — Gdy stopka jest cofnięta pod dno dalej niż ścianki, dostaje ząbki wchodzące w otwory w dnie.': 'Inset from corner — a foot set further under the base gets tabs into the base.',
  'Luz ząbków (na stronę)': 'Tab clearance (per side)', 'Luz ząbków (na stronę) — Szczelina między ząbkiem a wycięciem, z każdej strony. Laser zwykle 0,2–0,3 mm, plazma 0,8–1,0 mm.': 'Tab clearance — gap per side. Laser 0.2–0.3 mm, plasma 0.8–1.0 mm.',
  // materiał, cena, pobieranie
  'Materiał': 'Material', 'Materiał i pobieranie': 'Material and download', 'Stal czarna S235': 'Mild steel S235', 'Stal patynująca S355J2W (odporna na warunki atmosferyczne)': 'Weathering steel S355J2W (Corten-type)',
  'Grubość blachy w milimetrach': 'Sheet thickness in mm', 'Grubość blachy misy (ścianki + dno), mm': 'Bowl sheet thickness (walls + base), mm', 'Grubość blachy stopek, mm': 'Feet sheet thickness, mm',
  'Małe otwory: brak': 'Small holes: none', 'Próg': 'Limit', 'Otwór węższy i krótszy niż ten wymiar jest zgłaszany jako za mały do czystego cięcia (domyślnie grubość blachy)': 'Holes smaller than this are flagged as too small for a clean cut',
  'Cena testowa (orientacyjna)': 'Test price (rough)', 'Ceny testowe, orientacyjne: materiał i cięcie laserem, netto. Dokładna cena po zapytaniu.': 'Test prices, rough: material and laser cutting, net, in USD at KURS. Exact price on request.',
  'szczegóły': 'details', 'bez wzorów': 'no patterns', 'Stal': 'Steel', 'Cięcie': 'Cutting', 'Przebicia': 'Pierces', 'Przygotowanie': 'Setup', 'Masa stali': 'Steel weight', 'Długość cięcia': 'Cut length',
  'Blacha netto': 'Sheet net', 'Razem netto': 'Total net', 'Brutto (23% VAT)': 'Gross (23% VAT)', 'program + ustawienie': 'program + setup', 'Gabaryt (szerokość × wysokość)': 'Size (width × height)',
  'Ceny testowe, orientacyjne (Polska, 2026). Bez spawania, malowania i transportu. Minimum zamówienia w firmach często 250–400 zł.': 'Test prices, rough (Polish workshops, 2026), converted at KURS. Excludes welding, painting and shipping.',
  'Model i plik DXF — za darmo.': 'Model and DXF file — free.', 'Płatne dodatki wkrótce: edycja elementów, wzory, napisy.': 'Paid extras coming: part editing, patterns, lettering.',
  'Pobierz plik DXF': 'Download DXF file', 'Pobierz DXF': 'Download DXF', 'Model papierowy A4 (PDF)': 'A4 paper model (PDF)',
  'Nieobowiązkowe — robię Ogimorę sam, a to moje badanie rynku. Możesz od razu kliknąć „Pobierz”.': 'Optional — I build Ogimora alone and this is my market research. You can click “Download” right away.',
  'Do czego?': 'What for?', 'Dla siebie': 'For myself', 'Na sprzedaż': 'To sell', 'Zlecę wykonanie': 'I’ll have it made', 'Tylko oglądam': 'Just looking',
  'Licencja na nielimitowaną sprzedaż?': 'Licence for unlimited sales?', 'Tak': 'Yes', 'Nie': 'No', 'Może, zależy od ceny': 'Maybe, depends on price',
  'Za co zapłaciłbyś najchętniej?': 'What would you pay for?', 'Edycja elementów': 'Part editing', 'Wzory i napisy': 'Patterns and lettering', 'Więcej modeli': 'More models', 'Wycięty zestaw': 'Cut kit', 'Za nic': 'Nothing',
  'Uwagi i życzenia': 'Comments and wishes', 'Czego brakuje? Co zmienić?': 'What is missing? What to change?', 'Twoje kształty': 'Your shapes', '(ten i zapisane — możesz usunąć)': '(this one and saved — you may remove)',
  'Zaznacz coś powyżej albo napisz słowo': 'Pick something above or write a word', 'Zamknij': 'Close',
  'Cofnij (Ctrl+Z) – kształt i wzory': 'Undo (Ctrl+Z)', 'Ponów (Ctrl+Shift+Z)': 'Redo (Ctrl+Shift+Z)', 'Wyczyść wzory': 'Clear patterns', 'Usuń wszystkie wzory ze wszystkich elementów (można cofnąć)': 'Remove all patterns from all parts (undo possible)',
  'Gotowe do cięcia': 'Ready to cut', 'sztywność': 'stiffness', 'dobra': 'good', 'średnia': 'medium', 'słaba': 'weak',
  // edytor wzorów
  'Ścianka': 'Panel', 'Wyczyść': 'Clear', 'Usuń wszystko z tej ścianki (Ctrl+Z cofa)': 'Remove everything from this panel (Ctrl+Z undoes)', 'Laser · mostek 3 mm': 'Laser · 3 mm bridges',
  'Boki': 'Walls', 'Dno': 'Base', 'Bok przedni': 'Front', 'Bok prawy': 'Right', 'Bok tylny': 'Back', 'Bok lewy': 'Left', 'Stopka': 'Foot',
  'Elementy': 'Parts', 'Kompozycje': 'Layouts', 'Element widziany od zewnątrz': 'Part seen from outside', 'Kliknij element na modelu, aby go wybrać': 'Click a part on the model to select it',
  '+ Napis': '+ Text', '+ Wzór': '+ Pattern', '+ Brzeg': '+ Edge', 'galeria wzorów': 'pattern gallery', 'napis': 'text',
  'Pusta ścianka – wybierz kompozycję albo dodaj wzór': 'Empty panel – choose a layout or add a pattern', 'Pusto – wybierz kompozycję albo wzór (zakładki u góry).': 'Empty – choose a layout or a pattern (tabs above).',
  'Kształt główny': 'Main shape', 'Wielkość': 'Size', 'Obrót': 'Rotation', 'Paski': 'Stripes', '↳ metal': '↳ metal', '↳ szczelina': '↳ gap', '↳ od': '↳ from', 'bez pasków': 'no stripes', 'paski pionowe': 'vertical stripes',
  '▸ Więcej': '▸ More', '▾ Więcej': '▾ More', 'zmienione': 'changed', 'przywróć ustawienia z galerii': 'restore gallery settings',
  'Wzór z gotowego projektu – możesz go przesuwać, zmieniać wielkość, obracać i usunąć. Ustawień wzoru nie można zmieniać.': 'Pattern from a ready design – you can move, resize, rotate and delete it, but not change its settings.',
  'ukryj': 'hide', 'pokaż': 'show', 'wyżej (ważniejszy)': 'up (more important)', 'niżej': 'down', 'usuń': 'delete', 'usuń (Delete)': 'delete (Delete)', 'powtórzony na innych ściankach': 'repeated on other panels',
  'odbij': 'mirror', 'obróć o 90°': 'rotate 90°', 'na środek (lewo–prawo)': 'centre (left–right)', 'kopia lustrzana lewo ↔ prawo': 'mirror copy left ↔ right', 'kopia lustrzana góra ↔ dół': 'mirror copy top ↔ bottom',
  'cztery w narożnikach': 'four in the corners', 'pionowo': 'upright', 'od środka': 'from centre', 'do środka': 'to centre', 'na wierzch listy': 'to the top', 'na spód listy': 'to the bottom',
  'cofnij (Ctrl+Z)': 'undo (Ctrl+Z)', 'ponów (Ctrl+Shift+Z)': 'redo (Ctrl+Shift+Z)', 'przybliż do zaznaczonego': 'zoom to selection', 'cała ścianka (widok domyślny)': 'whole panel',
  'Rodzaj': 'Type', 'Grubość': 'Thickness', 'Gęstość': 'Density', 'Końce': 'Ends', 'Odstęp': 'Offset', 'Tekst': 'Text', 'Czcionka': 'Font',
  'małe otwory < 5 mm': 'small holes < 5 mm', 'małych otworów < 5 mm': 'small holes < 5 mm', 'małych otworów < 5 mm – mogą się nie wyciąć czysto': 'small holes < 5 mm – may not cut cleanly',
  'zostaw': 'keep', 'powiększ': 'enlarge', 'usuń wszystkie': 'delete all', 'Powiększ wszystkie': 'Enlarge all', 'Usuń wszystkie': 'Delete all', 'powiększ wszystkie': 'enlarge all',
  'Powiększ wszystkie małe otwory do progu': 'Enlarge all small holes to the limit', 'Usuń wszystkie małe otwory': 'Delete all small holes', 'Zaznacz małe otwory na modelu (czerwone, migające)': 'Highlight small holes on the model',
  'zaznacz małe otwory na czerwono': 'highlight small holes in red', 'bez zmian (mogą się nie wyciąć czysto)': 'unchanged (may not cut cleanly)', 'usuń małe otwory z tego elementu': 'delete small holes in this part',
  'usuń wszystkie małe otwory na tej ściance': 'delete all small holes on this panel', 'wszystkie małe otwory na tej ściance do 5 mm': 'all small holes on this panel to 5 mm', 'powiększ do 5 mm': 'enlarge to 5 mm',
  // ustawienia wzorów (krótkie)
  'Listki': 'Petals', 'Klapki': 'Lobes', 'Promienie': 'Rays', 'Ramiona': 'Arms', 'Szerokość': 'Width', 'Kręgi': 'Rings', 'Wycięcie': 'Cut', 'Oczko': 'Eye', 'Otok': 'Border',
  '↳ szerokość': '↳ width', '↳ gęstość': '↳ density', '↳ odstęp': '↳ gap', '↳ długość': '↳ length', '↳ zwinięcie': '↳ curl', '↳ wzór': '↳ fill', '↳ wielkość': '↳ size', '↳ wysokość': '↳ height',
  'Kształt': 'Shape', 'Sznury': 'Cords', 'Zawijasy': 'Curls', 'Między': 'Between', 'Środek': 'Centre', 'Liście': 'Leaves', 'Wygięcie': 'Bend', 'Krótkie': 'Short',
  'Falowanie': 'Waviness', 'Kwiat': 'Flower', 'Łodyga': 'Stem', 'Długość': 'Length', 'Motywy': 'Motifs', 'Odstępy': 'Spacing', 'Przedziałka': 'Divider', 'Ramka': 'Frame', 'Kreski': 'Lines',
  'Fale': 'Waves', 'Ogon': 'Tail', 'Wzór': 'Pattern', 'Zawinięcie': 'Curl', 'Wywinięcie': 'Curl', 'Rozpiętość': 'Spread', 'Kąt': 'Angle', 'Dolne': 'Lower', 'Zwężenie': 'Taper', 'Koniec': 'End',
  'Odmiana': 'Variant', 'Płatki': 'Petals', 'Rozchylenie': 'Opening', 'Opaska': 'Band', 'Dół': 'Base', 'Wąsy': 'Tendrils',
  // opcje (podpisy w dymkach)
  'brak': 'none', 'tak': 'yes', 'nie': 'no', 'kropki': 'dots', 'ząbki': 'teeth', 'łuski': 'scales', 'recica': 'hatching', 'linia': 'line', 'kulka': 'ball', 'ostry': 'pointed', 'romb': 'diamond', 'koło': 'circle',
  'rozeta': 'rosette', 'słońce': 'sun', 'liść': 'leaf', 'łezka': 'teardrop', 'kreski': 'lines', 'listki': 'leaves', 'tło': 'background', 'serce': 'heart', 'otwór': 'hole', 'obrys': 'outline',
  'rozszerzone': 'flared', 'liściaste': 'leafy', 'proste': 'straight', 'rozwidlone': 'forked', 'promienie': 'rays', 'tulipan': 'tulip', 'pąk': 'bud', 'zawinięty': 'curled', 'prosty': 'straight', 'zygzak': 'zigzag',
  'heraldyczna': 'heraldic', 'leluja': 'folk lily', 'pełne': 'solid', 'krokiewki': 'chevrons', 'trójlistna': 'trefoil', 'łodyga': 'stem',
  // wzory i kompozycje (nazwy w dymkach)
  'Rozeta': 'Rosette', 'Wir': 'Swirl', 'Słońce': 'Sun', 'Kwiat życia': 'Flower of life', 'Serce': 'Heart', 'Krzyż listkowy': 'Leaf cross', 'Krzyż promienisty': 'Ray cross',
  'Dziewięciornik': 'Carline thistle', 'Wić': 'Vine', 'Jodełka': 'Herringbone', 'Pas rozet': 'Rosette band', 'Wąż': 'Snake', 'Ślimaki': 'Scrolls', 'Gwiazdka 12': 'Star 12', 'Gwiazdka 6': 'Star 6',
  'Rozeta ząbkowana': 'Toothed rosette', 'Lilia': 'Lily', 'Lilijka w łuskach': 'Lily in scales', 'Dziewięciornik z sercami': 'Thistle with hearts', 'Rozeta w jodełce': 'Rosette in herringbone',
  'Brzeg – romby': 'Edge – diamonds', 'Brzeg – kropki': 'Edge – dots', 'Brzeg – ząbki': 'Edge – teeth', 'Napis „OGIMORA”': 'Text “OGIMORA”',
  // czcionki
  'Gruba': 'Bold', 'Szeryf': 'Serif', 'Szablon': 'Stencil', 'Gotyk': 'Gothic', 'Odręczna': 'Script',
  'Archivo Black – gruba bezszeryfowa': 'Archivo Black – bold sans', 'Alfa Slab One – gruba szeryfowa': 'Alfa Slab One – bold serif', 'Saira Stencil One – szablonowa, mostki w literach': 'Saira Stencil One – stencil, bridged letters',
  'Pirata One – gotycka': 'Pirata One – gothic', 'Lobster – pisana, litery połączone': 'Lobster – script, joined letters', 'Sancreek – ozdobna': 'Sancreek – decorative',
};
const WZORY = [
  [/^(\d+) elementów · gotowy do cięcia CNC$/, '$1 parts · ready for CNC cutting'],
  [/^(\d+) (?:kawałki metalu wypadną|kawałków metalu wypadnie|kawałek metalu wypadnie) \(czerwone\) – cięcie otacza go dookoła$/, '$1 metal piece(s) would fall out (red) – the cut goes all around'],
  [/^(.+): (\d+) wysp w zdobieniu – metal by wypadł$/, (m, a, n) => `${tr(a)}: ${n} islands in the pattern – metal would fall out`],
  [/^Słaba ścianka: wycięte (\d+)% – w ogniu może się wygiąć$/, 'Weak panel: $1% cut out – may warp in the fire'],
  [/^Liczę wzory… (\d+)\/(\d+)$/, 'Computing patterns… $1/$2'],
  // PROSTY: stabilność (js/geometry.js → stabilnosc)
  [/^(Łatwo wywrotne|Mało stabilne): przewróci je ok\. (\d+) kg opartych o krawędź \(nogi przy ziemi (\d+) mm, góra (\d+) mm\)\. Zmniejsz rozchylenie, poszerz dół albo obniż palenisko\.$/, (m, k, a, b, c) => `${k[0] === 'Ł' ? 'Tips over easily' : 'Not very stable'}: about ${a} kg resting on the rim tips it over (legs at ground ${b} mm, top ${c} mm). Reduce the flare, widen the base or make it lower.`],
  [/^(Łatwo wywrotne|Mało stabilne): przewróci się przy przechyle ok\. (\d+)° \(nogi przy ziemi (\d+) mm, góra (\d+) mm\)\. Zmniejsz rozchylenie, poszerz dół albo obniż palenisko\.$/, (m, k, a, b, c) => `${k[0] === 'Ł' ? 'Tips over easily' : 'Not very stable'}: it falls over when tilted about ${a}° (legs at ground ${b} mm, top ${c} mm). Reduce the flare, widen the base or make it lower.`],
  [/^Małe otwory \((\d+)\) < (\d+) mm:$/, 'Small holes ($1) < $2 mm:'],
  [/^długość cięcia ([\d,]+) m · przebić (\d+)$/, 'cut length $1 m · $2 pierces'],
  [/^rozrzut ofert (.+)$/, 'offer range $1'], [/^w tym wzory (.+)$/, 'incl. patterns $1'],
  [/^skala 1:(\d+) · (\d+) kart(?:ki|ek|ka) A4$/, 'scale 1:$1 · $2 A4 sheets'],
  [/^(\d+[AB]?) · (.+?) · widok od zewnątrz · (.+) · blacha (\d+) mm$/, (m, n, e, w, t) => `${n} · ${tr(e)} · outside view · ${w} · ${t} mm sheet`],
  [/^(\d+[AB]?) · (.+)$/, (m, n, e) => `${n} · ${tr(e)}`],
  [/^Wczytano „(.+)” v(\d+)$/, 'Loaded “$1” v$2'],
  [/^(.+): wychodzi poza strefę cięcia – przycięty$/, (m, a) => `${tr(a)}: outside the cutting zone – trimmed`],
  [/^(.+): najmniejsza wielkość tego wzoru to (\d+) mm$/, (m, a, n) => `${tr(a)}: smallest size of this pattern is ${n} mm`],
  [/^(.+): duże otwory – żar może wypadać$/, (m, a) => `${tr(a)}: large holes – embers may fall through`],
  [/^(\d+) szt\.$/, '$1 pcs'],
  [/^„(.*)”$/, '“$1”'],
];
function tr(s) {
  if (EN[s] != null) return EN[s];
  for (const [re, to] of WZORY) if (re.test(s)) return s.replace(re, to);
  return s;
}
// ---- kurs USD: z NBP raz dziennie (pamiętany w przeglądarce), zapas gdy brak sieci
const KURS0 = { usd: 3.7, data: '', zrodlo: 'stały' };
let KURS = (() => { try { return JSON.parse(localStorage.getItem('ogi_kurs')) || KURS0; } catch { return KURS0; } })();
const dzis = () => new Date().toISOString().slice(0, 10);
// Kurs z NBP nie jest już pobierany: wersja angielska liczy ceny osobno, w dolarach (js/pricing.js). Zostaje stały przelicznik zapasowy.
const kursGotowy = Promise.resolve();
const naUSD = txt => txt.replace(/([\d]+,\d+) zł\/kg/g, (m, n) => '$' + (parseFloat(n.replace(',', '.')) / KURS.usd).toFixed(2) + '/kg')
  .replace(/(\d(?:[\d\u00a0 ]*\d)?) zł(?![\p{L}])/gu, (m, n) => '$' + Math.round(+n.replace(/[\s\u00a0]/g, '') / KURS.usd).toLocaleString('en-US'));
export const kursOpis = () => `1 USD = ${KURS.usd.toFixed(2).replace('.', ',')} PLN${KURS.data ? ` (${KURS.zrodlo}, ${KURS.data})` : ''}`;
function przetlumacz(s) {
  const t = s.trim(); if (!t || !/[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(t)) return naUSD(s);
  let o = tr(t);
  o = naUSD(o).replace(/ odpadu /g, ' scrap ').replace(/\bKURS\b/, kursOpis().replace(',', '.'));
  return o === t ? s : s.replace(t, o);
}
const ATR = ['title', 'placeholder', 'aria-label'];
function wezel(n) {
  if (n.nodeType === 3) { if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) return; const v = przetlumacz(n.textContent); if (v !== n.textContent) n.textContent = v; return; }
  if (n.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(n.nodeName)) return;
  for (const a of ATR) { const v0 = n.getAttribute(a); if (v0) { const v = przetlumacz(v0); if (v !== v0) n.setAttribute(a, v); } }
  n.childNodes.forEach(wezel);
}
if (LANG === 'en') {
  document.documentElement.lang = 'en';
  document.title = tr(document.title);
  const start = () => {
    wezel(document.body);
    new MutationObserver(ms => { for (const m of ms) {
      if (m.type === 'childList') m.addedNodes.forEach(wezel);
      else if (m.type === 'characterData') wezel(m.target);
      else if (m.type === 'attributes') { const v0 = m.target.getAttribute(m.attributeName); if (v0) { const v = przetlumacz(v0); if (v !== v0) m.target.setAttribute(m.attributeName, v); } }
    } }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATR });
  };
  const go = () => kursGotowy.then(start);
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
}
// przełącznik PL / EN w pasku (jak na stronie głównej)
const przelacznik = () => document.querySelectorAll('.ob-lang button').forEach(b => {
  b.classList.toggle('on', b.dataset.l === LANG);
  b.onclick = () => { if (b.dataset.l !== LANG) ustawJezyk(b.dataset.l); };
});
if (document.body) przelacznik(); else document.addEventListener('DOMContentLoaded', przelacznik);
