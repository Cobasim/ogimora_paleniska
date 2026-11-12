# OGIMORA – strona testowa: zmiany

Jedna linijka na każde wgranie na serwer. Numer wersji jest w `www/js/wersja.js`.

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
