// Prosta warstwa i18n — słownik EN/PL, przełącznik w nagłówku.
// API: FpvI18n.t(key, vars), FpvI18n.set(lang), FpvI18n.get()
// Statyczne napisy w HTML: <element data-i18n="key">fallback</element>
// data-i18n-html — wstawi przez innerHTML (gdy klucz zawiera <kbd>, <strong>)
// data-i18n-placeholder, data-i18n-title — atrybuty.

(function (g) {
  "use strict";

  const STRINGS = {
    en: {
      "doc.title": "FpvFinder — GPS log analysis from EdgeTX",
      "app.title": "FpvFinder",
      "app.sub": 'GPS log analysis from EdgeTX radio. Everything is processed locally in your browser — files are <strong>never uploaded anywhere</strong>.',
      "tab.map": "Map",
      "tab.ballistics": "Crash simulation",
      "btn.folder": "📁 Folder of logs",
      "btn.singleLog": "📄 Single log",
      "btn.clear": "Clear",
      "btn.clear.title": "Clear map",
      "status.initial": "Pick a folder of logs or a single .csv file.",
      "status.noCsv": "No .csv files in this folder.",
      "status.notCsv": "The selected file is not .csv.",
      "status.parsing": "Parsing {count} files ({scope})…",
      "status.scope.all": "all",
      "status.scope.area": "in the selected area",
      "status.progress": "Processed {done}/{total}. Files with GPS: {ok}, points: {pts}{skip}.",
      "status.skipFragment": ", outside area: {n}",
      "status.noneInArea": "None of {count} files have points in the selected area.",
      "status.noneAtAll": "Checked {count} files — none contained valid GPS coordinates.",
      "status.done": "Done: {ok} files with GPS, {pts} points{skip}.",
      "status.doneSkip": " (skipped {n} files outside area)",
      "status.cancelled": "Cancelled. Pick a folder or a single .csv file.",
      "legend.last": "Big red pin = <strong>LAST</strong> flight point (potential crash site). Click a pin for filename, time, alt, sats, speed.",
      "side.flights": "Found flights",
      "ballistics.hint": "Assumes a <strong>DISARMED</strong> drone (motors OFF). Falls ballistically with air drag, horizontal velocity decays.",
      "ballistics.label.lat": "Lat",
      "ballistics.label.lon": "Lon",
      "ballistics.label.alt": "Alt [m]",
      "ballistics.label.hdg": "Heading [°]",
      "ballistics.label.gspd": "Ground speed [km/h]",
      "ballistics.params": "Drone parameters",
      "ballistics.label.mass": "Mass [kg]",
      "ballistics.label.area": "Area [m²]",
      "ballistics.label.cd": "Cd",
      "ballistics.btn.run": "Compute crash site",
      "ballistics.btn.clear": "Clear simulation",
      "ballistics.error": "Fill all fields (lat, lon, alt, heading, speed).",
      "ballistics.result.title": "Simulation result",
      "ballistics.result.t": "Fall time",
      "ballistics.result.dist": "Horizontal distance",
      "ballistics.result.vh": "Final horizontal velocity",
      "ballistics.result.vv": "Final vertical velocity (downward)",
      "ballistics.result.start": "Start of simulation / loss of signal",
      "ballistics.result.predicted": "Predicted crash site",
      "ballistics.result.tooltip": "~40 m radius around the predicted site",
      "ballistics.result.landing": "Landing site",
      "ballistics.result.openMaps": "Open in Google Maps",
      "modal.title": ".csv files to analyze: {count}",
      "modal.q": "Load all of them, or mark an area where the drone might be?",
      "modal.btn.all": "Load all",
      "modal.btn.area": "Select area on map",
      "modal.btn.cancel": "Cancel",
      "modal.hint": "Area selection: points outside the rectangle are skipped. Files with no points inside are not shown. Useful when you have many logs and roughly know where to look.",
      "area.instr": 'First center the map, then click <strong>Draw rectangle</strong> — or hold <kbd>Shift</kbd> and drag.',
      "area.btn.draw": "Draw rectangle",
      "area.btn.confirm": "Analyze selected area",
      "area.btn.redraw": "Draw again",
      "area.btn.cancel": "Cancel",
      "popup.lastPoint": "LAST POINT",
      "popup.time": "Time",
      "popup.alt": "Alt",
      "popup.sats": "Sats",
      "popup.gspd": "GSpd",
      "popup.hdg": "Hdg",
      "popup.openMaps": "Open in Google Maps",
      "popup.loadBallistics": "Use as crash simulation start",
      "fileRow.meta": "{n} points. Last: {lat}, {lon}",
      "flask.badge": "Flask",
      "flask.sub": "Server-side version — type a path to a folder or a single .csv file, the server parses and streams results live.",
      "flask.placeholder": "Path to a folder of logs or a single .csv file",
      "flask.btn.analyze": "Analyze",
      "flask.btn.stop": "Stop",
      "flask.modal.title": "Path ready to analyze",
      "flask.modal.hint": "Area selection: the server skips files with no points inside the rectangle.",
      "flask.status.initial": "Type a folder or .csv file path and click Analyze.",
      "flask.status.pickFirst": "Type a path first.",
      "flask.status.connect": "Connecting…",
      "flask.status.connectArea": "Connecting… (area filter active)",
      "flask.status.cancelled": "Cancelled. Type a path and click Analyze.",
      "flask.status.stopped": "Stopped.",
      "flask.status.folder": "Folder: {folder}. Files: {total}{scope}.",
      "flask.status.scopeArea": " (with area filter)",
      "flask.status.processed": "Processed {done}/{total}.",
      "flask.status.done": "Done: {ok} files with GPS, {pts} points (of {total}){skip}.",
      "flask.status.doneSkip": ", skipped outside area: {n}",
      "flask.browser.cwd": "{path} — {n} .csv here",
      "flask.browser.filesSection": "Single .csv files (click to pick):",
      "flask.hint.ballistics": "Assumes a DISARMED drone (motors OFF). Simulation runs server-side.",
    },
    pl: {
      "doc.title": "FpvFinder — analiza logów GPS z EdgeTX",
      "app.title": "FpvFinder",
      "app.sub": "Analiza logów GPS z radia EdgeTX. Wszystko liczone lokalnie w przeglądarce — pliki <strong>nigdzie nie są wysyłane</strong>.",
      "tab.map": "Mapa",
      "tab.ballistics": "Symulacja upadku",
      "btn.folder": "📁 Folder z logami",
      "btn.singleLog": "📄 Jeden log",
      "btn.clear": "Wyczyść",
      "btn.clear.title": "Wyczyść mapę",
      "status.initial": "Wybierz folder z logami albo pojedynczy plik .csv.",
      "status.noCsv": "W tym folderze nie ma plików .csv.",
      "status.notCsv": "Wybrany plik nie jest .csv.",
      "status.parsing": "Parsuję {count} plików ({scope})…",
      "status.scope.all": "wszystkie",
      "status.scope.area": "w zaznaczonym obszarze",
      "status.progress": "Przetworzono {done}/{total}. Plików z GPS: {ok}, punktów: {pts}{skip}.",
      "status.skipFragment": ", poza obszarem: {n}",
      "status.noneInArea": "Żaden z {count} plików nie zawiera punktów w zaznaczonym obszarze.",
      "status.noneAtAll": "Sprawdzono {count} plików — żaden nie zawierał poprawnych koordynat GPS.",
      "status.done": "Gotowe: {ok} plików z GPS, łącznie {pts} punktów{skip}.",
      "status.doneSkip": " (pominięto {n} plików spoza obszaru)",
      "status.cancelled": "Anulowano. Wybierz folder z logami albo pojedynczy plik .csv.",
      "legend.last": "Duży czerwony pin = <strong>OSTATNI</strong> punkt lotu (potencjalne miejsce upadku). Klik w pin pokaże nazwę pliku, czas, alt, sats, prędkość.",
      "side.flights": "Znalezione loty",
      "ballistics.hint": "Zakłada upadek <strong>ROZBROJONEGO</strong> drona (silniki OFF). Spadanie z oporem powietrza, prędkość pozioma wytraca się.",
      "ballistics.label.lat": "Lat",
      "ballistics.label.lon": "Lon",
      "ballistics.label.alt": "Alt [m]",
      "ballistics.label.hdg": "Heading [°]",
      "ballistics.label.gspd": "Prędkość [km/h]",
      "ballistics.params": "Parametry drona",
      "ballistics.label.mass": "Masa [kg]",
      "ballistics.label.area": "Powierzchnia [m²]",
      "ballistics.label.cd": "Cd",
      "ballistics.btn.run": "Policz miejsce upadku",
      "ballistics.btn.clear": "Wyczyść symulację",
      "ballistics.error": "Uzupełnij wszystkie pola (lat, lon, alt, heading, prędkość).",
      "ballistics.result.title": "Wynik symulacji",
      "ballistics.result.t": "Czas upadku",
      "ballistics.result.dist": "Droga pozioma",
      "ballistics.result.vh": "Prędkość pozioma końcowa",
      "ballistics.result.vv": "Prędkość pionowa końcowa (w dół)",
      "ballistics.result.start": "Punkt utraty sygnału / start symulacji",
      "ballistics.result.predicted": "Przewidziane miejsce upadku",
      "ballistics.result.tooltip": "Promień ~40 m wokół przewidzianego miejsca",
      "ballistics.result.landing": "Miejsce upadku",
      "ballistics.result.openMaps": "Otwórz w Google Maps",
      "modal.title": "Pliki .csv do analizy: {count}",
      "modal.q": "Wczytać wszystkie czy zaznaczyć obszar gdzie potencjalnie jest dron?",
      "modal.btn.all": "Wczytaj wszystkie",
      "modal.btn.area": "Wybierz obszar na mapie",
      "modal.btn.cancel": "Anuluj",
      "modal.hint": "Wybór obszaru: pomijamy punkty spoza prostokąta. Pliki bez ani jednego punktu w obszarze nie pokażą się na mapie. Przydatne gdy masz dużo logów ale wiesz mniej‑więcej gdzie szukać.",
      "area.instr": 'Najpierw wycentruj mapę, potem kliknij <strong>Rysuj prostokąt</strong> — albo trzymaj <kbd>Shift</kbd> i przeciągnij.',
      "area.btn.draw": "Rysuj prostokąt",
      "area.btn.confirm": "Analizuj zaznaczony obszar",
      "area.btn.redraw": "Narysuj ponownie",
      "area.btn.cancel": "Anuluj",
      "popup.lastPoint": "OSTATNI PUNKT",
      "popup.time": "Czas",
      "popup.alt": "Alt",
      "popup.sats": "Sats",
      "popup.gspd": "GSpd",
      "popup.hdg": "Hdg",
      "popup.openMaps": "Otwórz w Google Maps",
      "popup.loadBallistics": "Wczytaj jako start symulacji upadku",
      "fileRow.meta": "{n} punktów. Ostatni: {lat}, {lon}",
      "flask.badge": "Flask",
      "flask.sub": "Wersja serwerowa — wpisujesz ścieżkę do folderu lub pliku .csv, serwer parsuje i strumieniuje wyniki na żywo.",
      "flask.placeholder": "Ścieżka do folderu z logami albo do pojedynczego pliku .csv",
      "flask.btn.analyze": "Analizuj",
      "flask.btn.stop": "Stop",
      "flask.modal.title": "Ścieżka gotowa do analizy",
      "flask.modal.hint": "Wybór obszaru: serwer pomija pliki bez ani jednego punktu w prostokącie.",
      "flask.status.initial": "Wpisz ścieżkę do folderu albo pliku .csv i kliknij „Analizuj”.",
      "flask.status.pickFirst": "Najpierw wpisz ścieżkę.",
      "flask.status.connect": "Łączę…",
      "flask.status.connectArea": "Łączę… (filtr obszaru aktywny)",
      "flask.status.cancelled": "Anulowano. Wpisz ścieżkę i kliknij „Analizuj”.",
      "flask.status.stopped": "Zatrzymano.",
      "flask.status.folder": "Folder: {folder}. Plików: {total}{scope}.",
      "flask.status.scopeArea": " (z filtrem obszaru)",
      "flask.status.processed": "Przetworzono {done}/{total}.",
      "flask.status.done": "Gotowe: {ok} plików z GPS, łącznie {pts} punktów (z {total}){skip}.",
      "flask.status.doneSkip": ", pominięto poza obszarem: {n}",
      "flask.browser.cwd": "{path} — {n} .csv tutaj",
      "flask.browser.filesSection": "Pojedyncze pliki .csv (kliknij aby wybrać):",
      "flask.hint.ballistics": "Zakłada upadek ROZBROJONEGO drona (silniki OFF). Symulacja liczona po stronie serwera.",
    },
  };

  const STORAGE_KEY = "fpvfinder.lang";
  const DEFAULT = "en";
  let current = DEFAULT;

  function detect() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && STRINGS[saved]) return saved;
    } catch (_) { /* localStorage may be blocked */ }
    return DEFAULT;
  }

  function t(key, vars) {
    let s = (STRINGS[current] && STRINGS[current][key]);
    if (s == null) s = (STRINGS[DEFAULT] && STRINGS[DEFAULT][key]) || key;
    if (vars) {
      for (const k in vars) {
        s = s.split("{" + k + "}").join(String(vars[k]));
      }
    }
    return s;
  }

  function apply() {
    document.documentElement.lang = current;
    document.title = t("doc.title");

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (el.hasAttribute("data-i18n-html")) el.innerHTML = t(key);
      else el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = t(el.getAttribute("data-i18n-title"));
    });
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === current);
    });
  }

  function set(lang) {
    if (!STRINGS[lang]) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    apply();
    g.dispatchEvent(new CustomEvent("fpv-langchange", { detail: { lang } }));
  }

  current = detect();

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.addEventListener("click", () => set(b.dataset.lang));
    });
  });

  g.FpvI18n = { t, set, get: () => current };
})(window);
