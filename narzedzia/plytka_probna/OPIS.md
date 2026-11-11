# OGIMORA – pliki próbne

Jeden plik na każdą grubość blachy (3, 4, 5 mm). Milimetry, skala 1:1, same zamknięte kontury cięcia, bez grawerowania.
Grubość blachy jest w nazwie pliku i w kropkach na częściach.

## Jak czytać oznaczenia
- **Liczy się liczba kropek.** W rzędzie jest najwyżej 5, więc np. 7 = rząd pięciu + rząd dwóch, 12 = 5 + 5 + 2.
  Pierwszy (pełny) rząd jest zawsze bliżej krawędzi / szczelin.
- **Kropki przy boku sześciokąta** = luz na stronę w dziesiątych milimetra (4 kropki = 0,4 mm).
- **Trójkąt na środku sześciokąta** – wierzchołkiem wskazuje bok z **najmniejszym** luzem. Kolejne boki (coraz większy luz) idą od niego
  w lewo, przeciwnie do wskazówek zegara.
- **Cyfry nad trójkątem** (`0.1` na pierwszej płytce, `0.7` na drugiej) – luz na stronę w mm dla boku, który wskazuje trójkąt.
  To jedyne cyfry w plikach; są z osobnych szczelin wyciętych na wylot (zamknięte kontury, nic nie wypada).
  Każda szczelina ma szerokość równą grubości blachy (nie mniej niż 4 mm), między szczelinami zostaje 3 mm metalu.
- **Duże kropki pod trójkątem** (na sześciokącie) i na środku klucza = grubość blachy: 3, 4 albo 5 sztuk.
- Średnica kropek nigdy nie jest mniejsza niż grubość blachy (oznaczenia: 5 mm; kropki grubości: 7 mm) – wyjdą też na plazmie.

## `ogimora-test_Xmm.dxf` – dwa sześciokąty i klucz w jednym pliku (podgląd: `plytki_Xmm.svg`)
Dwa sześciokąty (bok 150 mm, ok. 300 × 260 mm) i jeden klucz – wszystko w jednym pliku na daną grubość blachy. Każdy bok to jeden luz – ten sam dla trzech wcięć
na krawędzi i trzech otworów obok.

| Płytka | Kropki na bokach | Luz na stronę | Trójkąt wskazuje |
|---|---|---|---|
| pierwsza | 1, 2, 3, 4, 5, 6 | 0,1 – 0,6 mm | bok 0,1 mm |
| druga | 7, 8, 9, 10, 11, 12 | 0,7 – 1,2 mm | bok 0,7 mm |

Laser zwykle zmieści się na pierwszej płytce; plazma może potrzebować drugiej.

Czego się spodziewać (z poradników i forów, nie z własnej próby):
- laser, blacha 3–6 mm: zwykle 0,05–0,2 mm na stronę; do spawania podaje się 0,1–0,15 mm;
- plazma: w wątkach forów padają wartości ok. 0,25 mm na stronę (blacha ok. 2,7 mm) i 0,5 mm na stronę (blacha 6 mm);
- dokładność plazmy wg Hypertherm: stoły podstawowe ok. ±0,77 mm, lekko-przemysłowe ±0,38–0,64 mm, ciężkie ±0,25–0,51 mm;
  do tego skos krawędzi (ok. 0,15 mm na blasze 3 mm, 0,25 mm na 6 mm). W najgorszym razie wychodzi ok. 1 mm na stronę,
  więc **skala do 1,2 mm wystarcza**; powyżej tego połączenie i tak jest za luźne, żeby cokolwiek trzymało;
- blacha bywa grubsza niż nominał – dlatego próba, a nie tabelka.
Generator ma dziś ustawione 0,3 (laser), 0,8 (plazma) i 1,2 (stara plazma) – próba pokaże, czy to nie za dużo.

- **Trzy wcięcia na krawędzi** (rozstaw 35 mm) – jak łączenie ścianki ze ścianką (głębokość = grubość blachy).
- **Trzy otwory 26 mm od krawędzi** (rozstaw 35 mm) – jak łączenie dolnej płyty ze ścianką (20 mm + 2 × luz na grubość blachy + 2 × luz).

**Klucz B** – trójkąt o boku 135 mm, ząbki 20 mm, wystają na grubość blachy + 3 mm:
- **bok z trzema ząbkami** – wchodzą naraz w trzy otwory albo trzy wcięcia jednego boku sześciokąta;
- **bok z dwoma ząbkami o ściętych rogach** (1,5 mm) – pasują do dowolnych dwóch sąsiednich otworów; pokazują, czy ścięcie ułatwia wkładanie;
- **bok z jednym ząbkiem** – do pojedynczego otworu.

**Próba:** zacznij od jednego ząbka i boku, który wskazuje trójkąt; idź po kolei w stronę większego luzu i znajdź najmniejszy, przy którym
ząbek wchodzi ręką, bez młotka i szlifowania. Potem sprawdź ten sam bok trzema ząbkami naraz. Jeśli jeden wchodzi, a trzy nie – maszyna gubi
wymiar na długości i trzeba wziąć większy luz. Porównaj dwa ząbki ścięte z trzema prostymi. Wynik (luz dla trzech ząbków) wpisujesz
w generatorze jako „luz na ząbkach”. Zanotuj maszynę i grubość.
Boki naprzeciw siebie są równoległe, a sąsiednie obrócone o 60° – jeśli maszyna tnie inaczej w różnych kierunkach, zobaczysz to jako „skok” między bokami.

## Uwagi
- Pliki powstały skryptem `proba.mjs` z tych samych rysunków i tego samego zapisu DXF co generator. Nie były jeszcze wycinane.
- Ząbek klucza ma zawsze 20 mm; luz jest tylko w wycięciach – tak jak w generatorze.
- W plikach nie ma otwartych linii – zakład nie powinien zgłaszać „otwartych konturów”.

## Na stronie (strona_prosta)
- Przycisk **„Płytki próbne”** pod suwakiem „Luz na ząbkach” otwiera okno: wybór grubości (3 / 4 / 5 mm – obrazek zmienia się razem z wyborem,
  bo kropki na środku to grubość blachy), jeden plik DXF z obiema płytkami i kluczem oraz instrukcja PDF.
- Pliki leżą w `strona_prosta/proba/`: `ogimora-test_Xmm.dxf`, `plytki_Xmm.svg` (obrazek w oknie), `ogimora-plytka-probna-PL.pdf`, `ogimora-test-plate-EN.pdf`.
- Po każdej zmianie płytki (z folderu `_gen/plytka_probna`, strona uruchomiona przez `uruchom_prosta.command`, port 8792):
  1. `node proba.mjs ../../strona_prosta ../../strona_prosta/proba` – pliki DXF i `_czesci.json`
  2. `node instrukcja.js ../../strona_prosta/proba http://localhost:8792 ../../strona_prosta/proba` – PDF-y i obrazki (wymaga `playwright`)
  3. z `strona_prosta/proba/` usuń pliki zaczynające się od `_` (robocze).
- Smok OGIMORY jest w nagłówku instrukcji (`smok.svg`) – ma być na każdym dokumencie.
- Płytka do próby ognia została wycofana (stare pliki: `_stare_ogien/`).
