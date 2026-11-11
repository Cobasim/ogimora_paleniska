# OGIMORA – strona testowa (repozytorium)

- `www/` – czytelne źródła strony. Tu się robi zmiany i tu działa podgląd (`uruchom.command`). **Tego folderu nie wgrywamy na serwer.**
- `wydanie/` – **to idzie na serwer.** Powstaje z `www/` skryptem `narzedzia/buduj/buduj.mjs`: skrypty sklejone w jeden nieczytelny plik, ściśnięty CSS, podpis © OGIMORA. Nie poprawiaj tu nic ręcznie – przy następnym budowaniu zniknie.
- `narzedzia/` – skrypty, które tworzą pliki do `www/` (płytki próbne, instrukcja PDF, nowe wzory, mostki). Nie idą na serwer.
- `ZMIANY.md` – jedna linijka na każde wgranie.
- `LICENCJA.md` – licencja testowa dla użytkowników.
- `dane_z_serwera/` – tu ściągasz statystyki; folder jest poza gitem.

Uwaga do `narzedzia/`: skrypty powstały w starym układzie folderów – w komendach z ich opisów zamiast `../../strona_prosta` wpisuj `../../www`. Foldery `_stare…` to kopie robocze (poza gitem), można je skasować.

## Podgląd na swoim komputerze
Dwuklik w `uruchom.command` → strona pod adresem http://localhost:8793 (potrzebne PHP).

## Każda zmiana – zawsze w tej kolejności
1. Zmiana w `www/` (albo w `narzedzia/` + wygenerowanie plików).
2. Sprawdzenie na swoim komputerze (`uruchom.command`).
3. Nowy numer w `www/js/wersja.js` (poprawka: 0.1.0 → 0.1.1; coś widocznego dla ludzi: 0.1.x → 0.2.0) i data.
4. Linijka w `ZMIANY.md`.
5. Git: `git add -A` → `git commit -m "0.1.1: krótko co"` → `git tag v0.1.1` → `git push --follow-tags`.
6. Zbuduj wydanie: `node narzedzia/buduj/buduj.mjs` (pierwszy raz: `cd narzedzia/buduj && npm install`; potrzebny Node.js – albo poproś Claude, zbuduje i wgra do `wydanie/`). Po zbudowaniu zrób commit, żeby `wydanie/` było w repozytorium.
7. FileZilla: wgraj zawartość `wydanie/` na serwer (nadpisz). W folderze `js/` na serwerze mają zostać tylko dwa pliki z `wydanie/js/` – stary plik o innej nazwie skasuj. **Nie wgrywaj i nie kasuj folderu `api/dane` na serwerze** – tam są statystyki.
7. Wejdź na stronę, otwórz „O stronie” – na dole ma być nowy numer wersji.

Zasada: na serwerze jest zawsze to, co w gałęzi `main` z ostatnim znacznikiem.

## Czego nie wolno psuć w trakcie testu
- **Nazwy wzorów** (pliki w `www/wzory_dane/` i lista `WZORY` w `www/js/prosty.js`) – ludzie mają zapisane projekty i linki; usunięty albo przemianowany wzór zniknie z ich projektu.
- **Kod kształtu** (`www/js/code.js`) – stare wersje kodu muszą się dalej wczytywać; nową wersję dopisuje się obok, nie zamiast.
- **Klucze w pamięci przeglądarki** (`ogip_…`).

## Dane o wizytach
- Podgląd: `https://ADRES/api/statystyki.php?k=KLUCZ` (klucz jest w pliku `api/dane/klucz.txt` na serwerze – nikomu go nie podawaj).
- Raz w tygodniu: FileZillą ściągnij cały folder `api/dane/` z serwera do `dane_z_serwera/RRRR-MM-DD/`. Są tam liczniki miesiąca (`licznik-RRRR-MM.json`), rejestr pobrań (`pobrania-RRRR-MM.csv`), ankiety i wiadomości (`*.jsonl`). Na serwerze nie ma kopii zapasowej.
- Na stronie statystyk: wybór miesiąca albo tygodnia (tygodnie liczone od wersji 0.1.3) i link „wszystkie liczniki … (CSV)” – jeden plik z kliknięciami, wizytami i pobraniami za wybrany okres.
- Liczniki i rejestr mają pole `wersja` – widać, z którego wydania pochodzi odzew.

## Pierwsze uruchomienie repozytorium (raz)
```
cd ~/Documents/PYTHON_PROJECTS/FIVE_YEARS/3_OGIMORA_STRONA
git init -b main
git add -A
git commit -m "0.1.0: pierwsze wydanie strony testowej"
git tag v0.1.0
```
Na github.com: New repository → nazwa `ogimora_paleniska` (już założone) → **Private** → bez README. Potem (adres skopiuj z GitHuba):
```
git remote add origin git@github.com:Cobasim/ogimora_paleniska.git
git push -u origin main --follow-tags
```

## Do sprawdzenia po pierwszym wgraniu na OVH
- [ ] `https://ADRES/api/dane/klucz.txt` ma dawać błąd 403 (nie pokazywać klucza).
- [ ] „Napisz, co zmienić” – czy wiadomość przychodzi e-mailem.
- [ ] Po wgraniu poprawki strona od razu pokazuje nowy numer wersji (plik `.htaccess` każe przeglądarce sprawdzać świeżość plików).
- [ ] Wersja angielska: dopisz `?lang=en` do adresu albo kliknij EN.
