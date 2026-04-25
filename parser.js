// Parser logów EdgeTX (i podobnych OpenTX-pochodnych) działający w przeglądarce.
// Elastyczne wykrywanie kolumny GPS — pozycja kolumny zależy od konfiguracji
// telemetrii u danego pilota, więc szukamy po nazwie a nie po indeksie.
//
// API: parseLogFile(file) -> Promise<Array<Point>>
// Point: { time, date, lat, lon, alt, sats, gspd, hdg }

(function (global) {
  "use strict";

  const ENCODINGS = ["utf-8", "windows-1250", "iso-8859-1"];
  const PAIR_SEP = /[\s,;]+/;

  // ---- Odczyt z fallbackiem kodowania ---------------------------------------

  async function readFileText(file) {
    const buf = await file.arrayBuffer();
    for (const enc of ENCODINGS) {
      try {
        const dec = new TextDecoder(enc, { fatal: true });
        const text = dec.decode(buf);
        // Strip BOM
        return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
      } catch (_) {
        // try next encoding
      }
    }
    // Ostateczność: utf-8 z zamianą błędnych bajtów
    const dec = new TextDecoder("utf-8", { fatal: false });
    const text = dec.decode(buf);
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  }

  // ---- Lekki parser CSV (obsługuje cudzysłowy i przecinki w polach) ---------

  function parseCSVLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQ = false; }
        } else {
          cur += c;
        }
      } else {
        if (c === ",") { out.push(cur); cur = ""; }
        else if (c === '"' && cur.length === 0) { inQ = true; }
        else { cur += c; }
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return { fields: [], rows: [] };
    const fields = parseCSVLine(lines[0]).map((s) => s.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      const row = {};
      for (let k = 0; k < fields.length; k++) {
        row[fields[k]] = cells[k] !== undefined ? cells[k] : "";
      }
      rows.push(row);
    }
    return { fields, rows };
  }

  // ---- Walidacja punktu ------------------------------------------------------

  function isValidPair(lat, lon) {
    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lon < -180 || lon > 180) return false;
    if (Math.abs(lat) < 1e-9 && Math.abs(lon) < 1e-9) return false; // brak fixa
    return true;
  }

  function tryParsePair(text) {
    if (text == null) return null;
    const s = String(text).trim();
    if (!s) return null;
    const parts = s.split(PAIR_SEP).filter(Boolean);
    if (parts.length !== 2) return null;
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return [lat, lon];
  }

  function tryParseFloat(text) {
    if (text == null) return null;
    const s = String(text).trim();
    if (!s) return null;
    const v = parseFloat(s);
    return Number.isNaN(v) ? null : v;
  }

  // ---- Detekcja kolumn -------------------------------------------------------

  function nameScoreGps(name) {
    const n = (name || "").toLowerCase();
    if (!n) return 0;
    let s = 0;
    if (n.includes("gps")) s += 10;
    if (n.includes("pos") && !n.includes("position")) s += 3;
    if (n.includes("coord")) s += 4;
    return s;
  }

  function isLatName(name) {
    const n = (name || "").toLowerCase();
    if (!n) return false;
    if (n.includes("long") || n.includes("lng")) return false;
    if (n.includes("alt") || n.includes("late") || n.includes("later")) return false;
    return n.includes("lat");
  }

  function isLonName(name) {
    const n = (name || "").toLowerCase();
    if (!n) return false;
    if (n.includes("long") || n.includes("lng")) return true;
    if (n.includes("lon") && !n.includes("long")) return true;
    return false;
  }

  function peekFirstValue(rows, col) {
    for (const r of rows) {
      const v = (r[col] || "").trim();
      if (v) return v;
    }
    return "";
  }

  function detectHelper(fields, ...needles) {
    for (const f of fields) {
      const low = (f || "").toLowerCase();
      for (const needle of needles) {
        if (low.includes(needle)) return f;
      }
    }
    return null;
  }

  function detectColumns(fields, sample) {
    const info = { mode: null };
    if (!fields || fields.length === 0) return info;

    // Tryb A: pojedyncza kolumna z 'lat lon'
    const candidates = fields
      .map((n) => ({ score: nameScoreGps(n), name: n }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    let chosenPair = null;
    for (const c of candidates) {
      const sampleVal = peekFirstValue(sample, c.name);
      if (sampleVal && tryParsePair(sampleVal)) {
        chosenPair = c.name;
        break;
      }
    }

    // Tryb B: osobne lat/lon
    const latCol = fields.find(isLatName) || null;
    const lonCol = fields.find(isLonName) || null;
    let chosenSplit = null;
    if (latCol && lonCol) {
      chosenSplit = [latCol, lonCol];
    }

    if (chosenPair) {
      info.mode = "pair";
      info.gpsCol = chosenPair;
    } else if (chosenSplit) {
      info.mode = "split";
      info.latCol = chosenSplit[0];
      info.lonCol = chosenSplit[1];
    }

    info.timeCol = detectHelper(fields, "time");
    info.dateCol = detectHelper(fields, "date");
    info.altCol = detectHelper(fields, "galt", "alt(m)", "altitude") || detectHelper(fields, "alt");
    info.satsCol = detectHelper(fields, "sats", "satellites");
    info.gspdCol = detectHelper(fields, "gspd", "groundspeed", "gs(", "speed");
    info.hdgCol = detectHelper(fields, "hdg", "heading", "course", "yaw");
    return info;
  }

  // ---- Główne API ------------------------------------------------------------

  function isLogFile(file) {
    const name = (file.name || "").toLowerCase();
    if (name.startsWith(".~lock.")) return false;
    if (name.endsWith(".csv#")) return false;
    return name.endsWith(".csv");
  }

  async function parseLogFile(file) {
    const text = await readFileText(file);
    if (!text.trim()) return [];

    const { fields, rows } = parseCSV(text);
    if (rows.length === 0) return [];

    const info = detectColumns(fields, rows.slice(0, 50));
    if (info.mode === null) return [];

    const valOf = (row, col) => (col ? (row[col] || "").trim() : "");

    const points = [];
    for (const row of rows) {
      let lat, lon;
      if (info.mode === "pair") {
        const pair = tryParsePair(row[info.gpsCol]);
        if (!pair) continue;
        [lat, lon] = pair;
      } else {
        lat = tryParseFloat(row[info.latCol]);
        lon = tryParseFloat(row[info.lonCol]);
      }
      if (!isValidPair(lat, lon)) continue;

      points.push({
        time: valOf(row, info.timeCol),
        date: valOf(row, info.dateCol),
        lat,
        lon,
        alt: valOf(row, info.altCol),
        sats: valOf(row, info.satsCol),
        gspd: valOf(row, info.gspdCol),
        hdg: valOf(row, info.hdgCol),
      });
    }
    return points;
  }

  global.FpvParser = { parseLogFile, isLogFile };
})(window);
