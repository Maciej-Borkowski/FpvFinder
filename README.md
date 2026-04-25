# FpvFinder

Analiza logów telemetrycznych z radia EdgeTX (i podobnych OpenTX-pochodnych) i wizualizacja tras GPS na mapie. Pokazuje gdzie był dron i gdzie jest jego ostatni znany punkt — pomaga go znaleźć po crashu. Dodatkowo prosta symulacja balistyczna upadku rozbrojonego drona.

W repo są **dwie wersje** robiące dokładnie to samo:

| Wersja | Lokalizacja | Wymaga | Hosting | Pliki idą na serwer? |
|--------|-------------|--------|---------|----------------------|
| **A — webowa (czysty JS)** | katalog główny | tylko przeglądarka | **GitHub Pages** za darmo | **NIE** — wszystko liczy się lokalnie |
| **B — Flask (Python)** | `flask/` | Python 3 + `pip install flask` | tylko lokalnie u siebie | n/d (działa na localhoście) |

Jeśli chcesz tylko otworzyć stronę i wrzucić folder z logami → wersja A. Jeśli wolisz coś co ma dostęp do całego dysku przez ścieżki (bez wybierania w przeglądarce) → wersja B.

---

## Wersja A — webowa (GitHub Pages)

### Uruchomienie lokalne (szybki test)

Otwórz `index.html` w przeglądarce. **Nie** przez `file:///` — przeglądarki blokują wtedy część rzeczy. Zamiast tego w katalogu repo uruchom prosty serwer i wejdź na `http://localhost:8000`:

```bash
# wbudowany serwer Pythona — wystarczy
python -m http.server 8000
```

Albo dowolny inny statyczny serwer (np. `npx serve`, Live Server w VS Code itp.).

### Hosting jako strona na GitHubie — krok po kroku

#### Wariant 1 — strona „użytkownika” (`https://NAZWA.github.io`)

To jest to czego chciałeś — adres typu `fpvfinder.github.io`. Tylko **uwaga**: ten adres dostaje konto GitHubowe o nazwie `fpvfinder`, nie da się zrobić sobie subdomeny pod swoim kontem. Czyli musisz albo:
- mieć/założyć konto GitHub o nazwie `fpvfinder` (jeśli wolne), albo
- użyć swojego konta — wtedy adres będzie `TWOJ-LOGIN.github.io` (zob. wariant 2 jeśli nie chcesz takiego zalewania całego konta).

Kroki:

1. Załóż konto na github.com (jeśli nie masz). Login = nazwa w adresie.
2. Stwórz **publiczne** repozytorium o nazwie **dokładnie** `LOGIN.github.io` (np. `fpvfinder.github.io`). Ważne — bez literówki, w tej formie GitHub rozpoznaje że to ma być strona użytkownika.
3. W katalogu projektu na komputerze (czyli tutaj) odpal:

   ```bash
   git init
   git add index.html parser.js ballistics.js app.js style.css README.md
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/LOGIN/LOGIN.github.io.git
   git push -u origin main
   ```

4. Wejdź na `https://LOGIN.github.io` — strona powinna być widoczna w 1–3 minuty.
5. (opcjonalnie) W repo: **Settings → Pages** — sprawdź że źródłem jest `main` i `/ (root)`.

#### Wariant 2 — strona „projektu” (`https://LOGIN.github.io/fpvfinder`)

Prościej, działa pod każdym loginem, nie zajmuje całego konta.

1. Stwórz publiczne repo o **dowolnej** nazwie, np. `fpvfinder`.
2. Wypchnij pliki (jak w wariancie 1, tylko zmień `origin` na `https://github.com/LOGIN/fpvfinder.git`).
3. W repo: **Settings → Pages**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`, folder `/ (root)`
   - kliknij **Save**.
4. Po kilku minutach strona pojawi się pod `https://LOGIN.github.io/fpvfinder/`.

#### Co wrzucać na GitHuba (a co nie)

Wystarczą te pliki w katalogu głównym:

```
index.html
parser.js
ballistics.js
app.js
style.css
README.md
```

**Folder `flask/` nie jest potrzebny dla GitHub Pages** — możesz go wrzucić razem (nie zaszkodzi, GitHub Pages go zignoruje), albo dodać do `.gitignore`. Tak samo `Stara wersja/`.

#### Własna domena (opcjonalne)

Jeśli masz własną domenę (np. `fpvfinder.pl`) i chcesz pod nią postawić tę stronę: w repo zrób plik `CNAME` z domeną w środku, dodaj rekord `CNAME` u rejestratora wskazujący na `LOGIN.github.io`, i włącz **Enforce HTTPS** w Settings → Pages.

---

## Wersja B — Flask (lokalna)

```bash
cd flask
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # Linux/macOS
pip install -r requirements.txt
python app.py
```

Otwórz `http://127.0.0.1:5000`. Wpisz lub wybierz ścieżkę do folderu z logami i kliknij **Analizuj**. Wyniki streamują się na żywo (Server-Sent Events).

Zmienne środowiskowe:
- `FPVFINDER_HOST` (domyślnie `127.0.0.1`)
- `FPVFINDER_PORT` (domyślnie `5000`)
- `FPVFINDER_DEBUG=1` aby włączyć tryb debug Flaska

---

## Format logów

Aplikacja akceptuje pliki **`.csv`** z radia EdgeTX/OpenTX. Parser jest tolerancyjny:

- **Pozycja kolumn** dowolna — szukamy po nazwie nagłówka, nie po indeksie.
- **Nazwa kolumny GPS** dowolna z fragmentem `gps`/`pos`/`coord`. Wartość: `"lat lon"` rozdzielone spacją (klasyczny EdgeTX), przecinkiem albo średnikiem.
- **Alternatywa**: dwie osobne kolumny, jedna z `lat`, druga z `lon`/`lng`.
- **Kodowanie pliku**: próbujemy UTF-8 → CP1250 → Latin-1 (po stronie wersji A: TextDecoder; wersji B: jak w `parser.py`).
- **Filtr regionu** — żaden. Pokazujemy każdy poprawny punkt (lat ∈ [-90, 90], lon ∈ [-180, 180], różny od (0, 0) — które oznacza brak fixa GPS).

Pliki z niesparowaną kolumną GPS, puste albo bez fixa są po prostu pomijane bez crasha.

---

## Symulacja upadku

Dla **rozbrojonego** drona (silniki OFF). Druga zakładka. Wpisujesz lat/lon/alt/heading/prędkość ostatnio znaną z telemetrii (albo klikasz „Wczytaj jako start symulacji" w popupie ostatniego punktu trasy), opcjonalnie modyfikujesz parametry drona (masa / Cd / powierzchnia czołowa). Symulacja całkuje ruch z oporem powietrza i pokazuje przewidziane miejsce upadku oraz okrąg ~40 m wokół niego.

---

## Stara wersja

W folderze `Stara wersja/` jest oryginalny zip ze skryptami `find_drone.py` i `analiza_upadku.py` — zostawiony jako referencja, do niczego nie potrzebny.
