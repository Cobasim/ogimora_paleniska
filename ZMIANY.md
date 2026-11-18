# OGIMORA – strona testowa: zmiany

Jedna linijka na każde wgranie na serwer. Numer wersji jest w `www/js/wersja.js`.

## 0.4.0 – 2026-11-18
Strona startowa i projekty kostki. (1) Adres główny ogimora.com to teraz strona startowa: dwa modele (palenisko, kostka) i „Twoje ostatnie” – projekty z tej przeglądarki, osobno dla każdego modelu. Palenisko przeniesione pod ogimora.com/firepit/ (stare linki z kodem kształtu i projektem przechodzą tam same). (2) Górny pasek: smok / OGIMORA → strona startowa; obok nazwa modelu (Palenisko / Kostka) → model startowy, z przyciskiem „Wróć do mojego”. (3) Kostka: projekty jak w palenisku – zapisują się same po pierwszej zmianie, menu z nazwą, listą moich kostek, „Od nowa” (kostka OGIMORA, kostka do gry, z otworami, czysta), duplikowaniem, zapisem do pliku i wczytaniem. Cudzy link otwiera się jako osobny podgląd i nie nadpisuje mojego projektu. (4) Nowy projekt startowy kostki (200 mm, ścięcie 40, napis OGI / MORA, otwór u góry) i widok startowy: surowa stal ze spoinami. (5) Każda strona ma adresy /pl/… i /en/…; mapa strony ma 9 adresów.

## 0.3.11 – 2026-11-18
Przegląd kodu. (1) Usunięta nazwa zastrzeżona z wersji angielskiej („Corten-type” → „weather-resistant”). (2) Kostka dla wyszukiwarek: osobne adresy /pl/cube/ i /en/cube/ (stały język, własny tytuł i opis), /cube/ jako adres domyślny; znaczniki języków, adres kanoniczny, opis schema.org i obrazek podglądu linku; kostka dopisana do sitemap.xml. (3) llms.txt opisuje oba generatory. (4) Z plików na serwerze znikają komentarze HTML (zostaje podpis ©). (5) W „O stronie” dopisane, że biblioteka PDF pobiera się z cdnjs (Cloudflare).

## 0.3.10 – 2026-11-18
Wycena kostki poprawiona według prawdziwych wycen pliku ze strony (kostka 120 mm). Polska (profservice): 3 mm – pozycja 28,82 zł, 5 mm – pozycja 47,70 zł, w obu przygotowanie 63 zł i minimum 120 zł netto. Strona pokazywała ok. 175 zł, bo liczyła stałe 150 zł przygotowania i nie znała minimalnego zamówienia. Teraz: przygotowanie 63 zł, suma nie mniej niż 120 zł, z dopiskiem „minimalne zamówienie w zakładzie”. USA (SendCutSend): 76,50 $ za sztukę – współczynniki przeliczenia na jedną sztukę dopasowane do trzech wycen (kostka i dwie wyceny paleniska); dotyczy też ceny paleniska w wersji angielskiej (zmiana do kilku procent). Wycena paleniska w Polsce bez zmian.

## 0.3.9 – 2026-11-18
Kostka, zamki od strony przypadków brzegowych. (1) Zamki przy trójkątach są dłuższe (1,22 grubości blachy zamiast 0,52): dochodzą do lica sąsiedniej ścianki na całej grubości i trochę wystają – do zeszlifowania, nic nie trzeba dospawywać. (2) Nowy układ dla trójkątów: sam zamek trójkąta w gnieździe ścianki (trójkąt bez wcięć) – wybierany też automatycznie, gdy trójkąt jest za mały na inne układy. (3) Program pilnuje, żeby w trójkącie nie zostawało miejsce węższe niż 2 grubości blachy (min. 6 mm), a w ściance – niż 1,5 grubości (min. 4 mm); układ, który by to złamał albo się nie mieści, jest wygaszony. (4) Układ „na końcach” przy trójkątach nie zostawia już ostrza w rogu. (5) Suwak szerokości zamka kończy się tam, gdzie kończy się miejsce – każdy ruch coś zmienia; gdy zamki w ogóle się nie mieszczą, suwak jest wygaszony. (6) Najwęższy zamek = grubość blachy (min. 3 mm). (7) Przy dużym ścięciu krótkie krawędzie kostki dostają zamki do samych końców zamiast żadnych.

## 0.3.8 – 2026-11-18
Kostka: nic nie skacze przy zmianie ustawień. Karta „Kształt”: suwak i układ zamków na trójkątach są widoczne cały czas, bez ścięcia tylko wygaszone (karta ma stałą wysokość). Panel „Ścianki”: suwak wielkości zawsze w tym samym miejscu (przy „Brak” wygaszony), komunikat ma stałe miejsce na jedną linijkę, opcje rodzaju (liczba kropek, wiersze napisu, kształt otworu) są na samym dole – pod nimi nic już nie ma, więc nic się nie przesuwa. „Blacha” przeniesiona nad „Ścianki”. Stopka: skala PDF i link do projektu w jednym wierszu, potwierdzenie skopiowania w linijce komunikatów.

## 0.3.7 – 2026-11-18
Kostka, układ zamków „na końcach”: zamki ścianki A zaczynają się teraz dokładnie w narożnikach ścianki (wcześniej zostawał odstęp od końca krawędzi). Przy trójkątach narożników zostaje mały odstęp 0,6 grubości blachy – bliżej zamek wchodziłby w trzecią ściankę.

## 0.3.6 – 2026-11-18
Kostka: zamki przemyślane od nowa. Na każdej krawędzi jedna ścianka jest „A”, druga „B”. Trzy układy: (1) jeden zamek A i jeden zamek B obok siebie na środku; (2) na końcach – A ma zamek przy każdym końcu krawędzi na zewnątrz, B ma zamki dotykające ich od środka, a między zamkami B zostaje długa szczelina na jedną ciągłą spoinę; (3) jeden zamek A na środku, obejmowany przez dwa zamki B. Suwak ustawia szerokość zamka. Dawny układ „kilka par rozłożonych” usunięty (blokował przesuw tylko w jedną stronę); zapisane projekty z tym układem otwierają się z układem „na końcach”. Nowy projekt: krawędzie „na końcach”, trójkąty „jeden i jeden”. Rozkrój nie chowa się już pod kartą „Kształt”.

## 0.3.5 – 2026-11-18
Kostka: układ zamków wybiera się osobno dla krawędzi kostki i osobno dla trójkątów narożników (tak jak szerokość). Zamiast napisów trzy obrazki pod każdym suwakiem: zamki rozłożone, na końcach, jeden w środku (pełny prostokąt = zamek tej ścianki, pusty = sąsiadki); karta „Kształt” już się nie rozjeżdża.

## 0.3.4 – 2026-11-18
Kostka. Układ zamków do wyboru: „rozłożone” (jak dotąd), „na końcach” (zamki tylko przy początku i końcu krawędzi – środek wolny na jedną ciągłą spoinę) i „jeden w środku” (jeden zamek łapany przez dwa zamki drugiej ścianki). Cofnij / ponów (przyciski ↶ ↷ i Ctrl+Z / Ctrl+Shift+Z). Cena testowa jak w palenisku, bez szczegółów: suma za jedną sztukę i pod nią „w tym wycięcia w ściankach”. Model papierowy w skali „1 kartka”: wszystko na jednej stronie – logo i nagłówek, dwa widoki (jeden z wymiarami) i cały rozkrój; skale 1:2 i 1:1 jak dotąd (kartka tytułowa + rozkrój). Palenisko: bez zmian.

## 0.3.3 – 2026-11-18
Kostka: podgląd przeniesiony na rozwiązania z paleniska. Przesuwanie (Shift + przeciągnięcie, prawy albo środkowy przycisk) przesuwa kadr, a obrót zostaje zawsze wokół środka kostki (w 0.3.2 po przesunięciu obracało się wokół złego punktu). Model sam wypełnia wolne miejsce do pierwszego ręcznego obrotu, przybliżenia albo przesunięcia; potem nic samo nie zmienia skali, a przyciski widoku dopasowują od nowa. Rozkrój: przeciągnięcie przesuwa, kółko przybliża, dwuklik pokazuje całość. Wąskie ekrany: podgląd przypina się u góry przy przewijaniu. Lista uwag z nagłówkiem i ✕, rozwijana kliknięciem. Palenisko: bez zmian.

## 0.3.2 – 2026-11-18
Kostka. Naprawione: suwaki szerokości zamka i luzu nie dawały się przeciągać (panel przebudowywał się pod palcem). Zamki przeniesione do karty „Kształt”: osobny suwak dla krawędzi kostki i osobny dla trójkątów narożników (widoczny, gdy jest ścięcie; domyślnie węższy). Kartę „Kształt” można schować przyciskiem „Schowaj opcje” (jak w palenisku). Podgląd: Shift + przeciągnięcie przesuwa model (przyciski widoku cofają przesunięcie); stal surowa jaśniejsza i z połyskiem (odbicia otoczenia), wnętrze widoczne przez wycięcia ciemniejsze; spoiny szersze, wypukłe, w kolorach nalotowych (słomkowy, złoty, purpura, niebieski). Model papierowy PDF jak w palenisku: pierwsza kartka z logo smoka, nagłówkiem OGIMORA, opisem i adresem generatora, widokiem w pudełku z wymiarami całej kostki i drugim widokiem z przeciwnej strony; smok i adres w stopce każdej kartki. Palenisko: bez zmian.

## 0.3.1 – 2026-11-18
Kostka, poprawki po pierwszym obejrzeniu. Panel blachy w calach: pięć grubości zawija się do drugiego wiersza bez rozjeżdżania układu. Otwór: trzeci kształt „ścięte rogi” – kwadrat, którego rogi ścinają się tak samo jak narożniki kostki (suwak ścięcia). Napis: trzy osobne wiersze (górny, środkowy, dolny; domyślnie tylko środkowy), każdy sam dopasowuje się do szerokości. Sześć czcionek do wyboru (Black Ops One – domyślna, Saira Stencil One, Plaster, Emblema One, Bungee, Russo One; wszystkie SIL OFL, z polskimi znakami). Mostki w literach liczone na nowo: w najwęższym miejscu kreski, a długie „półwyspy” blachy (np. w 5, 3, G) dostają podparcie na czubku – koniec z długimi paskami przez pół cyfry. Zamki: zamiast pola „tak / nie” suwak szerokości zamka – od zera (bez zamków) do 100 mm (4"); za szeroki zamek na krótkiej krawędzi sam się zwęża. Nowy przycisk „Model papierowy (PDF)” ze skalą: auto, 1:2 albo 1:1 (kartki do sklejenia). Link do projektu przeniesiony pod przyciski. Palenisko: bez zmian.

## 0.3.0 – 2026-11-18
Nowy model: **kostka do nauki spawania** pod adresem `ogimora.com/cube` (także `/kostka`). Strona główna bez zmian – dalej otwiera palenisko, do kostki nie prowadzi jeszcze żaden link. Kostka: bok 100–700 mm (4–28"), blacha 2 / 3 / 4 / 5 mm (cale: 14 ga, 11 ga, 10 ga, 3/16", 1/4"), ścianki stykają się wewnętrznymi krawędziami (rowek na spoinę na zewnątrz), zamki ustalające w parach z ustawianym luzem, ścinane narożniki (trójkąty) aż do połowy boku, na każdej ściance kropki, napis / liczba albo duży otwór (okrągły, kwadratowy), zestawy „kostka do gry” i „liczby”, podgląd 3D ze spoinami, rozkrój, plik DXF w mm albo calach, link odtwarzający projekt. Darmowa bez limitu sztuk (osobny tekst licencji w „O stronie”). Statystyki: w rejestrze pobrań nowa kolumna `model`, liczniki kostki z przedrostkiem `kostka_`, kliknięcia z przedrostkiem `k_`. Palenisko: bez zmian w działaniu.

## 0.2.1 – 2026-11-18
Okienka: szczegóły ceny, wyjaśnienie „Luz na ząbkach” i lista uwag mają wyraźną ramkę i przycisk ✕. Na telefonie i tablecie (do 1100 px) rozwijają się w miejscu, pod swoim przyciskiem, zamiast zasłaniać ekran; przy cenie „szczegóły ▾” zmienia się w „zwiń ▴”. Poprawione: „?” przy luzie nie otwierał się na telefonie. Okna (pobieranie, płytki, O stronie, Napisz) – ✕ zostaje widoczny przy przewijaniu; zamykają się kliknięciem w tło, ale już nie przypadkowym kliknięciem przy brzegu okna. Stopka: liczniki opisane samymi literami V · D · P. Wersja angielska: przetłumaczone ostrzeżenie o pionowych nogach.

## 0.2.0 – 2026-11-12
Cale (USA). Przełącznik `mm | in` w pasku obok PL / EN. W calach: blachy 11 ga (0,120"), 10 ga (0,135"), 3/16" (0,188") i 1/4" (0,250") – zamki liczone z prawdziwej grubości; wymiary co 1/4"; luz na ząbkach 0,005–0,060" co 0,005" (podpowiedzi: laser 0,010", plazma 0,030", stara plazma 0,050"); masa w funtach, długość cięcia w stopach; model papierowy na US Letter. W oknie pobierania wybór jednostek pliku DXF (mm albo cale; domyślnie jak na stronie; jednostka w nazwie pliku i w komentarzu). Płytki próbne calowe (4 grubości, luz cyframi i kropkami po 0,005", grubość cyframi, np. „.135”) i instrukcja PDF po angielsku i po polsku (Letter); płytki mm także w calach. Projekt calowy ma własny kod kształtu (wersja „A”); stare linki i projekty w mm działają jak dotąd (ten sam kod i ten sam plik DXF). Powrót mm → cale → mm bez zmian po drodze przywraca dokładnie poprzedni projekt. Na start: cale, gdy przeglądarka jest w strefie czasowej USA (albo `?j=in` w adresie). Statystyki: jednostki projektu i pliku DXF, blacha jako kod (`5`, `10ga`, `3-16`…). Poprawione przy okazji: kilka komunikatów bez tłumaczenia w wersji angielskiej (PDF gotowy, „Gotowe: mm…”), skala w PDF po angielsku.

## 0.1.7 – 2026-11-11
Wycena: tylko jedna sztuka. Usunięte ceny „za sztukę przy większym zamówieniu” (PL i USA) i wzmianki, że szacunek jest dopasowany do prawdziwych wycen. W USA pozycje tabeli sumują się teraz do ceny jednej sztuki. Pod tabelą zostało tylko „Ceny orientacyjne, testowe.”

## 0.1.6 – 2026-11-11
Wąskie ekrany (małe okno, tablet, telefon): przy przewijaniu podgląd 3D przypina się u góry, więc widać zmiany podczas ruszania suwaków i wybierania wzorów. Z ankiety (USA): „annoying to have to scroll to see the changes”.

## 0.1.5 – 2026-11-11
Pod wyszukiwarki: osobne adresy `/pl/` i `/en/` (adres główny dalej według przeglądarki), `robots.txt`, `sitemap.xml`, `llms.txt`, obrazek i opis do podglądu linku (`img/og.jpg`), opis strony tekstem, opis strukturalny dla Google.

## 0.1.4 – 2026-11-11
Stopka na dole strony: © ogimora.com, podpis „autor: OGI”, wersja i trzy liczniki szesnastkowo (wizyty, DXF, PDF – liczone od tej wersji; `api/licznik.php`). W „O stronie” dopisek, że autorem strony jest jedna osoba – OGI.

## 0.1.3 – 2026-11-11
Statystyki: liczniki także tygodniowe (pon.–niedz.), na stronie statystyk wybór tygodnia i plik CSV ze wszystkimi licznikami tygodnia albo miesiąca.

## 0.1.2 – 2026-11-11
Na serwer idzie teraz folder `wydanie/` (skrypty sklejone i zaciemnione, podpis © OGIMORA w plikach); w „O stronie” dopisek, że strony nie wolno kopiować.

## 0.1.1 – 2026-11-11
Poprawka po pierwszym wgraniu: serwer OVH podawał plik `clipper.mjs` bez typu i przeglądarka nie uruchamiała strony (rozmyty podgląd). Dopisany typ w `.htaccess`.

## 0.1.0 – 2026-11-11
Pierwsze publiczne wydanie strony testowej: uproszczony generator (ścianki-nogi, 34 wzory, napis, otwory w dnie), projekty w przeglądarce, wycena orientacyjna PL / USA, płytki próbne z instrukcją, anonimowe statystyki, licencja testowa (własny użytek + 20 sztuk komercyjnie), wersja polska i angielska.
