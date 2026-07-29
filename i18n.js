// Minimal i18n layer — single English string table.
// API: FpvI18n.t(key, vars), FpvI18n.set(lang), FpvI18n.get()
// Static strings in HTML: <element data-i18n="key">fallback</element>
// data-i18n-html — inserts via innerHTML (for keys containing <kbd>, <strong>)
// data-i18n-placeholder, data-i18n-title — set the matching attribute.

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
      "modal.filterAccuracy": "Only points with GPS accuracy ≤ 50 m",
      "popup.accuracy": "Accuracy",
      "status.accuracyNote": ", low-accuracy points skipped: {n}",
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
      "nav.section": "Navigation",
      "nav.locate": "📍 Locate me",
      "nav.locateStop": "📍 Stop tracking",
      "nav.pickTarget": "🎯 Pick target on map",
      "nav.pickTargetActive": "🎯 Click on map…",
      "nav.clearTarget": "✕ Clear target",
      "nav.popup.navigate": "🎯 Navigate here",
      "nav.popup.myLocation": "Your position",
      "nav.popup.target": "Navigation target",
      "nav.gpsUnavailable": "GPS not available in this browser.",
      "nav.permissionDenied": "Location permission denied. Allow it in browser settings.",
      "nav.gpsError": "GPS error: {msg}",
      "nav.needLocationFirst": "Enable Locate me first.",
      "nav.targetSet": "Target set. Compass shown on map.",
      "nav.targetCleared": "Target cleared.",
      "nav.compassPermissionBtn": "Enable compass",
      "compass.distance": "Distance",
      "compass.bearing": "Bearing",
      "compass.km": "km",
      "compass.m": "m",
      "ui.toggleSidebar": "Show/hide panel",
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
  }

  function set(lang) {
    if (!STRINGS[lang]) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    apply();
    g.dispatchEvent(new CustomEvent("fpv-langchange", { detail: { lang } }));
  }

  current = detect();

  document.addEventListener("DOMContentLoaded", apply);

  g.FpvI18n = { t, set, get: () => current };
})(window);
