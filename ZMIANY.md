# OGIMORA – strona testowa: zmiany

Jedna linijka na każde wgranie na serwer. Numer wersji jest w `www/js/wersja.js`.

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
