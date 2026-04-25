// FpvFinder — frontend (czysty JS, działa lokalnie w przeglądarce).
// Czyta wybrany folder z logami EdgeTX i rysuje trasy GPS na mapie Leaflet,
// na bieżąco — w miarę jak parser przerabia kolejne pliki.

(function () {
  "use strict";

  const PALETTE = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
    "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
    "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080",
  ];

  const els = {
    folder: document.getElementById("folder-input"),
    single: document.getElementById("single-input"),
    reset: document.getElementById("reset-btn"),
    status: document.getElementById("status"),
    progress: document.getElementById("progress"),
    fileList: document.getElementById("file-list"),
    tabs: document.querySelectorAll(".tab-btn"),
    panes: document.querySelectorAll(".tab-pane"),
    bLat: document.getElementById("b-lat"),
    bLon: document.getElementById("b-lon"),
    bAlt: document.getElementById("b-alt"),
    bHdg: document.getElementById("b-hdg"),
    bGspd: document.getElementById("b-gspd"),
    bMass: document.getElementById("b-mass"),
    bArea: document.getElementById("b-area"),
    bCd: document.getElementById("b-cd"),
    bRun: document.getElementById("b-run"),
    bClear: document.getElementById("b-clear"),
    bResult: document.getElementById("b-result"),
    modal: document.getElementById("folder-modal"),
    modalCount: document.getElementById("modal-count"),
    areaBar: document.getElementById("area-bar"),
    areaConfirm: document.getElementById("area-confirm"),
    areaRedraw: document.getElementById("area-redraw"),
    areaCancel: document.getElementById("area-cancel"),
  };

  // ---- Mapa ------------------------------------------------------------------

  const map = L.map("map").setView([52.0, 19.0], 6); // domyślnie centralnie nad Polską
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const trackLayer = L.layerGroup().addTo(map);
  const ballisticsLayer = L.layerGroup().addTo(map);
  const bboxLayer = L.layerGroup().addTo(map);

  let allBoundsLatLngs = [];
  let trackCount = 0;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function popupHtml(file, p, isLast) {
    const gmaps = `https://www.google.com/maps?q=${p.lat},${p.lon}`;
    const last = isLast ? `<div class="last-marker">OSTATNI PUNKT</div>` : "";
    return `
      <div class="popup">
        ${last}
        <div class="popup-name">${escapeHtml(file)}</div>
        <div>Lat: <code>${p.lat.toFixed(6)}</code></div>
        <div>Lon: <code>${p.lon.toFixed(6)}</code></div>
        <div>Czas: ${escapeHtml(p.time || "-")}</div>
        <div>Alt: ${escapeHtml(p.alt || "-")} m, Sats: ${escapeHtml(p.sats || "-")}, GSpd: ${escapeHtml(p.gspd || "-")}, Hdg: ${escapeHtml(p.hdg || "-")}</div>
        <div class="popup-actions">
          <a href="${gmaps}" target="_blank" rel="noopener">Otwórz w Google Maps</a>
          ${isLast ? `<button class="link-like" data-load-ballistics='${JSON.stringify(p).replace(/'/g, "&apos;")}'>Wczytaj jako start symulacji upadku</button>` : ""}
        </div>
      </div>
    `;
  }

  function renderTrack(file, color, points) {
    if (!points || points.length === 0) return;

    const latlngs = points.map((p) => [p.lat, p.lon]);
    latlngs.forEach((ll) => allBoundsLatLngs.push(ll));

    if (latlngs.length > 1) {
      L.polyline(latlngs, { color, weight: 2, opacity: 0.7 }).addTo(trackLayer);
    }

    points.forEach((p, i) => {
      const isLast = i === points.length - 1;
      if (isLast) return;
      const m = L.circleMarker([p.lat, p.lon], {
        radius: 3, color, fillColor: color, fillOpacity: 0.8, weight: 1,
      }).addTo(trackLayer);
      m.bindPopup(popupHtml(file, p, false));
    });

    const last = points[points.length - 1];
    if (last) {
      const m = L.circleMarker([last.lat, last.lon], {
        radius: 10, color: "#000", fillColor: "#e6194b", fillOpacity: 1, weight: 2,
      }).addTo(trackLayer);
      m.bindPopup(popupHtml(file, last, true));
    }

    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `
      <div><span class="swatch" style="background:${color}"></span><span class="name">${escapeHtml(file)}</span></div>
      <div class="meta">${points.length} punktów. Ostatni: ${last.lat.toFixed(6)}, ${last.lon.toFixed(6)}</div>
    `;
    row.onclick = () => map.setView([last.lat, last.lon], 17);
    els.fileList.appendChild(row);

    trackCount++;
    if (allBoundsLatLngs.length > 0) {
      map.fitBounds(allBoundsLatLngs, { padding: [30, 30] });
    }
  }

  // Delegacja kliknięcia w przycisk popupa "Wczytaj jako start symulacji"
  document.body.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-load-ballistics]");
    if (!btn) return;
    let p;
    try { p = JSON.parse(btn.getAttribute("data-load-ballistics").replace(/&apos;/g, "'")); }
    catch (_) { return; }
    fillBallisticsForm(p);
    switchTab("ballistics");
  });

  // ---- Czytanie folderu ------------------------------------------------------

  function isCsvFile(file) {
    return FpvParser.isLogFile(file);
  }

  // Małe opóźnienie, żeby UI zdążył odrysować pomiędzy plikami (mapa "na bieżąco")
  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function inBbox(p, bbox) {
    if (!bbox) return true;
    return p.lat >= bbox.south && p.lat <= bbox.north
        && p.lon >= bbox.west && p.lon <= bbox.east;
  }

  async function processFolder(fileList, bbox) {
    resetMap();
    if (bbox) drawBboxOverlay(bbox);

    const csvFiles = Array.from(fileList).filter(isCsvFile);
    if (csvFiles.length === 0) {
      els.status.textContent = "W tym folderze nie ma plików .csv.";
      return;
    }

    csvFiles.sort((a, b) => {
      const an = a.webkitRelativePath || a.name;
      const bn = b.webkitRelativePath || b.name;
      return an.localeCompare(bn);
    });

    els.progress.hidden = false;
    els.progress.max = csvFiles.length;
    els.progress.value = 0;
    const scope = bbox ? "w zaznaczonym obszarze" : "wszystkie";
    els.status.textContent = `Parsuję ${csvFiles.length} plików (${scope})…`;

    let filesWithGps = 0;
    let totalPoints = 0;
    let trackIndex = 0;
    let filesSkippedBbox = 0;

    for (let i = 0; i < csvFiles.length; i++) {
      const f = csvFiles[i];
      const display = f.webkitRelativePath || f.name;
      try {
        let pts = await FpvParser.parseLogFile(f);
        if (bbox) pts = pts.filter((p) => inBbox(p, bbox));
        if (pts.length > 0) {
          const color = PALETTE[trackIndex % PALETTE.length];
          trackIndex++;
          renderTrack(display, color, pts);
          filesWithGps++;
          totalPoints += pts.length;
        } else if (bbox) {
          filesSkippedBbox++;
        }
      } catch (e) {
        console.warn("Błąd przy " + display, e);
      }
      els.progress.value = i + 1;
      const skipNote = filesSkippedBbox > 0 ? `, poza obszarem: ${filesSkippedBbox}` : "";
      els.status.textContent = `Przetworzono ${i + 1}/${csvFiles.length}. Plików z GPS: ${filesWithGps}, punktów: ${totalPoints}${skipNote}.`;
      await nextFrame();
    }

    if (filesWithGps === 0) {
      els.status.textContent = bbox
        ? `Żaden z ${csvFiles.length} plików nie zawiera punktów w zaznaczonym obszarze.`
        : `Sprawdzono ${csvFiles.length} plików — żaden nie zawierał poprawnych koordynat GPS.`;
    } else {
      const skipNote = filesSkippedBbox > 0 ? ` (pominięto ${filesSkippedBbox} plików spoza obszaru)` : "";
      els.status.textContent = `Gotowe: ${filesWithGps} plików z GPS, łącznie ${totalPoints} punktów${skipNote}.`;
    }
    els.progress.hidden = true;
  }

  function resetMap() {
    trackLayer.clearLayers();
    ballisticsLayer.clearLayers();
    bboxLayer.clearLayers();
    allBoundsLatLngs = [];
    trackCount = 0;
    els.fileList.innerHTML = "";
    els.bResult.hidden = true;
    els.bResult.innerHTML = "";
  }

  // ---- Modal po wyborze folderu ----------------------------------------------

  let pendingFiles = null;

  function countCsv(files) {
    return Array.from(files).filter(isCsvFile).length;
  }

  function showModal(count) {
    els.modalCount.textContent = String(count);
    els.modal.hidden = false;
  }
  function hideModal() {
    els.modal.hidden = true;
  }

  els.folder.addEventListener("change", (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    pendingFiles = e.target.files;
    const n = countCsv(pendingFiles);
    if (n === 0) {
      els.status.textContent = "W tym folderze nie ma plików .csv.";
      pendingFiles = null;
      return;
    }
    showModal(n);
  });

  els.single.addEventListener("change", (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    pendingFiles = e.target.files;
    if (countCsv(pendingFiles) === 0) {
      els.status.textContent = "Wybrany plik nie jest .csv.";
      pendingFiles = null;
      return;
    }
    showModal(1);
  });

  els.modal.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-modal-action]");
    if (!btn) return;
    const action = btn.dataset.modalAction;
    hideModal();
    if (action === "all") {
      processFolder(pendingFiles, null);
      pendingFiles = null;
    } else if (action === "area") {
      enterDrawMode();
    } else {
      pendingFiles = null;
      els.folder.value = "";
      els.single.value = "";
    }
  });

  // ---- Rysowanie prostokąta na mapie -----------------------------------------

  let drawState = null;
  let lastBbox = null;

  function drawBboxOverlay(bbox) {
    bboxLayer.clearLayers();
    L.rectangle(
      [[bbox.south, bbox.west], [bbox.north, bbox.east]],
      { color: "#3cb44b", weight: 2, fillOpacity: 0.05, dashArray: "4,4" }
    ).addTo(bboxLayer);
  }

  function enterDrawMode() {
    els.areaBar.hidden = false;
    els.areaConfirm.disabled = true;
    els.areaRedraw.disabled = true;
    lastBbox = null;
    bboxLayer.clearLayers();
    document.body.classList.add("draw-mode");
    map.getContainer().classList.add("draw-mode");
    map.dragging.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();

    map.on("mousedown", onDrawStart);
    map.on("touchstart", onDrawStart);
  }

  function exitDrawMode() {
    els.areaBar.hidden = true;
    document.body.classList.remove("draw-mode");
    map.getContainer().classList.remove("draw-mode");
    map.dragging.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.off("mousedown", onDrawStart);
    map.off("touchstart", onDrawStart);
    map.off("mousemove", onDrawMove);
    map.off("mouseup", onDrawEnd);
    drawState = null;
  }

  function onDrawStart(e) {
    if (e.originalEvent && e.originalEvent.preventDefault) e.originalEvent.preventDefault();
    drawState = { start: e.latlng, rect: null };
    map.on("mousemove", onDrawMove);
    map.on("mouseup", onDrawEnd);
    map.on("touchmove", onDrawMove);
    map.on("touchend", onDrawEnd);
  }

  function onDrawMove(e) {
    if (!drawState) return;
    if (drawState.rect) drawState.rect.remove();
    drawState.rect = L.rectangle(
      [drawState.start, e.latlng],
      { color: "#3cb44b", weight: 2, fillOpacity: 0.1 }
    ).addTo(bboxLayer);
  }

  function onDrawEnd(e) {
    if (!drawState) return;
    map.off("mousemove", onDrawMove);
    map.off("mouseup", onDrawEnd);
    map.off("touchmove", onDrawMove);
    map.off("touchend", onDrawEnd);
    const end = e.latlng || drawState.start;
    const a = drawState.start;
    const b = end;
    if (a.lat === b.lat || a.lng === b.lng) {
      // zbyt mały prostokąt — anuluj rysowanie tej próby
      if (drawState.rect) drawState.rect.remove();
      drawState = null;
      return;
    }
    lastBbox = {
      south: Math.min(a.lat, b.lat),
      north: Math.max(a.lat, b.lat),
      west: Math.min(a.lng, b.lng),
      east: Math.max(a.lng, b.lng),
    };
    drawState = null;
    els.areaConfirm.disabled = false;
    els.areaRedraw.disabled = false;
  }

  els.areaConfirm.addEventListener("click", () => {
    if (!lastBbox || !pendingFiles) return;
    const bbox = lastBbox;
    const files = pendingFiles;
    pendingFiles = null;
    exitDrawMode();
    processFolder(files, bbox);
  });

  els.areaRedraw.addEventListener("click", () => {
    bboxLayer.clearLayers();
    lastBbox = null;
    els.areaConfirm.disabled = true;
    els.areaRedraw.disabled = true;
    // ponownie nasłuchujemy mousedown
    map.on("mousedown", onDrawStart);
    map.on("touchstart", onDrawStart);
  });

  els.areaCancel.addEventListener("click", () => {
    exitDrawMode();
    bboxLayer.clearLayers();
    pendingFiles = null;
    els.folder.value = "";
    els.status.textContent = "Anulowano. Wybierz folder z logami EdgeTX (.csv).";
  });

  els.reset.addEventListener("click", () => {
    if (!els.areaBar.hidden) exitDrawMode();
    resetMap();
    els.folder.value = "";
    els.single.value = "";
    pendingFiles = null;
    els.status.textContent = "Wybierz folder lub pojedynczy log .csv.";
  });

  // ---- Zakładki --------------------------------------------------------------

  function switchTab(name) {
    els.tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    els.panes.forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
  }
  els.tabs.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // ---- Symulacja upadku ------------------------------------------------------

  function fillBallisticsForm(p) {
    if (p.lat != null) els.bLat.value = p.lat;
    if (p.lon != null) els.bLon.value = p.lon;
    if (p.alt) els.bAlt.value = parseFloat(p.alt);
    if (p.hdg) els.bHdg.value = parseFloat(p.hdg);
    if (p.gspd) els.bGspd.value = parseFloat(p.gspd);
  }

  function renderBallistics(res) {
    ballisticsLayer.clearLayers();

    const start = [res.params.lat0, res.params.lon0];
    const land = [res.landing.lat, res.landing.lon];

    L.polyline(res.path.map((p) => [p[0], p[1]]), {
      color: "#911eb4", weight: 3, opacity: 0.8, dashArray: "4,4",
    }).addTo(ballisticsLayer);

    L.circleMarker(start, {
      radius: 9, color: "#000", fillColor: "#000080", fillOpacity: 0.9, weight: 2,
    }).addTo(ballisticsLayer).bindPopup(`<b>Punkt utraty sygnału / start symulacji</b><br>${start[0].toFixed(6)}, ${start[1].toFixed(6)}`);

    L.circle(land, { radius: 40, color: "#3cb44b", fillColor: "#3cb44b", fillOpacity: 0.15, weight: 2 })
      .addTo(ballisticsLayer)
      .bindTooltip("Promień ~40 m wokół przewidzianego miejsca");

    L.circleMarker(land, {
      radius: 12, color: "#000", fillColor: "#e6194b", fillOpacity: 1, weight: 2,
    }).addTo(ballisticsLayer).bindPopup(
      `<b>Przewidziane miejsce upadku</b><br>` +
      `${land[0].toFixed(6)}, ${land[1].toFixed(6)}<br>` +
      `<a href="https://www.google.com/maps?q=${land[0].toFixed(6)},${land[1].toFixed(6)}" target="_blank" rel="noopener">Google Maps</a>`
    ).openPopup();

    map.fitBounds([start, land], { padding: [60, 60] });

    const gmaps = `https://www.google.com/maps?q=${land[0].toFixed(6)},${land[1].toFixed(6)}`;
    els.bResult.hidden = false;
    els.bResult.innerHTML = `
      <h3>Wynik symulacji</h3>
      <div>Czas upadku: <strong>${res.t.toFixed(1)} s</strong></div>
      <div>Droga pozioma: <strong>${res.dist.toFixed(0)} m</strong></div>
      <div>Prędkość pozioma końcowa: ${res.vh.toFixed(2)} m/s (start ${(res.params.gspdKmh / 3.6).toFixed(2)})</div>
      <div>Prędkość pionowa końcowa: ${res.vv.toFixed(2)} m/s w dół</div>
      <div class="landing">Miejsce upadku:<br><code>${land[0].toFixed(6)}, ${land[1].toFixed(6)}</code></div>
      <div><a href="${gmaps}" target="_blank" rel="noopener">Otwórz w Google Maps</a></div>
    `;
  }

  function readBallisticsForm() {
    const need = ["bLat", "bLon", "bAlt", "bHdg", "bGspd"];
    for (const k of need) {
      const v = els[k].value;
      if (v === "" || Number.isNaN(parseFloat(v))) {
        return null;
      }
    }
    return {
      lat: +els.bLat.value,
      lon: +els.bLon.value,
      alt: +els.bAlt.value,
      hdg: +els.bHdg.value,
      gspd: +els.bGspd.value,
      mass: +els.bMass.value || 0.7,
      area: +els.bArea.value || 0.03,
      cd: +els.bCd.value || 0.8,
    };
  }

  els.bRun.addEventListener("click", () => {
    const opts = readBallisticsForm();
    if (!opts) {
      els.bResult.hidden = false;
      els.bResult.innerHTML = `<div class="error">Uzupełnij wszystkie pola (lat, lon, alt, heading, prędkość).</div>`;
      return;
    }
    const res = FpvBallistics.simulateDisarmed(opts);
    renderBallistics(res);
  });

  els.bClear.addEventListener("click", () => {
    ballisticsLayer.clearLayers();
    els.bResult.hidden = true;
    els.bResult.innerHTML = "";
  });
})();
