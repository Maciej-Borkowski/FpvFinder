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
    areaStartDraw: document.getElementById("area-start-draw"),
    areaConfirm: document.getElementById("area-confirm"),
    areaRedraw: document.getElementById("area-redraw"),
    areaCancel: document.getElementById("area-cancel"),
    locateBtn: document.getElementById("locate-btn"),
    pickTargetBtn: document.getElementById("pick-target-btn"),
    clearTargetBtn: document.getElementById("clear-target-btn"),
    compass: document.getElementById("compass"),
    compassArrow: document.querySelector("#compass .compass-arrow"),
    compassRing: document.querySelector("#compass .compass-ring"),
    compassDistance: document.querySelector("#compass .compass-distance"),
    compassBearing: document.querySelector("#compass .compass-bearing"),
    compassPermission: document.getElementById("compass-permission"),
    sidebarToggle: document.getElementById("sidebar-toggle"),
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

  const t = (k, vars) => (window.FpvI18n ? window.FpvI18n.t(k, vars) : k);

  function popupHtml(file, p, isLast) {
    const gmaps = `https://www.google.com/maps?q=${p.lat},${p.lon}`;
    const last = isLast ? `<div class="last-marker">${escapeHtml(t("popup.lastPoint"))}</div>` : "";
    return `
      <div class="popup">
        ${last}
        <div class="popup-name">${escapeHtml(file)}</div>
        <div>${escapeHtml(t("ballistics.label.lat"))}: <code>${p.lat.toFixed(6)}</code></div>
        <div>${escapeHtml(t("ballistics.label.lon"))}: <code>${p.lon.toFixed(6)}</code></div>
        <div>${escapeHtml(t("popup.time"))}: ${escapeHtml(p.time || "-")}</div>
        <div>${escapeHtml(t("popup.alt"))}: ${escapeHtml(p.alt || "-")} m, ${escapeHtml(t("popup.sats"))}: ${escapeHtml(p.sats || "-")}, ${escapeHtml(t("popup.gspd"))}: ${escapeHtml(p.gspd || "-")}, ${escapeHtml(t("popup.hdg"))}: ${escapeHtml(p.hdg || "-")}</div>
        ${p.accuracy != null ? `<div>${escapeHtml(t("popup.accuracy"))}: ~${p.accuracy.toFixed(0)} m${p.hdop ? ` (Hdop ${escapeHtml(p.hdop)})` : ""}</div>` : ""}
        <div class="popup-actions">
          <a href="${gmaps}" target="_blank" rel="noopener">${escapeHtml(t("popup.openMaps"))}</a>
          <button class="link-like" data-nav-target="${p.lat},${p.lon}">${escapeHtml(t("nav.popup.navigate"))}</button>
          ${isLast ? `<button class="link-like" data-load-ballistics='${JSON.stringify(p).replace(/'/g, "&apos;")}'>${escapeHtml(t("popup.loadBallistics"))}</button>` : ""}
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
      <div class="meta">${escapeHtml(t("fileRow.meta", { n: points.length, lat: last.lat.toFixed(6), lon: last.lon.toFixed(6) }))}</div>
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

  const ACC_THRESHOLD = 50;
  function isAccurate(p) {
    return p.accuracy != null && p.accuracy <= ACC_THRESHOLD;
  }

  async function processFolder(fileList, bbox, opts) {
    opts = opts || {};
    resetMap();
    if (bbox) drawBboxOverlay(bbox);

    const csvFiles = Array.from(fileList).filter(isCsvFile);
    if (csvFiles.length === 0) {
      els.status.textContent = t("status.noCsv");
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
    const scope = bbox ? t("status.scope.area") : t("status.scope.all");
    els.status.textContent = t("status.parsing", { count: csvFiles.length, scope });

    let filesWithGps = 0;
    let totalPoints = 0;
    let trackIndex = 0;
    let filesSkippedBbox = 0;
    let pointsSkippedAccuracy = 0;

    for (let i = 0; i < csvFiles.length; i++) {
      const f = csvFiles[i];
      const display = f.webkitRelativePath || f.name;
      try {
        let pts = await FpvParser.parseLogFile(f);
        if (opts.filterAccuracy) {
          const before = pts.length;
          pts = pts.filter(isAccurate);
          pointsSkippedAccuracy += before - pts.length;
        }
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
        console.warn("Parse error " + display, e);
      }
      els.progress.value = i + 1;
      let skip = filesSkippedBbox > 0 ? t("status.skipFragment", { n: filesSkippedBbox }) : "";
      if (pointsSkippedAccuracy > 0) skip += t("status.accuracyNote", { n: pointsSkippedAccuracy });
      els.status.textContent = t("status.progress", {
        done: i + 1, total: csvFiles.length, ok: filesWithGps, pts: totalPoints, skip,
      });
      await nextFrame();
    }

    if (filesWithGps === 0) {
      els.status.textContent = bbox
        ? t("status.noneInArea", { count: csvFiles.length })
        : t("status.noneAtAll", { count: csvFiles.length });
    } else {
      let skip = filesSkippedBbox > 0 ? t("status.doneSkip", { n: filesSkippedBbox }) : "";
      if (pointsSkippedAccuracy > 0) skip += t("status.accuracyNote", { n: pointsSkippedAccuracy });
      els.status.textContent = t("status.done", { ok: filesWithGps, pts: totalPoints, skip });
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

  let lastModalCount = 0;
  function refreshModalTitle() {
    const titleEl = document.getElementById("modal-title");
    if (titleEl) titleEl.textContent = t("modal.title", { count: lastModalCount });
  }
  function showModal(count) {
    lastModalCount = count;
    refreshModalTitle();
    els.modal.hidden = false;
  }
  function hideModal() {
    els.modal.hidden = true;
  }

  // Reset value przed otwarciem dialogu, żeby zdarzenie 'change'
  // odpaliło się też przy ponownym wyborze tego samego folderu/pliku.
  els.folder.addEventListener("click", () => { els.folder.value = ""; });
  els.single.addEventListener("click", () => { els.single.value = ""; });

  els.folder.addEventListener("change", (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    pendingFiles = e.target.files;
    const n = countCsv(pendingFiles);
    if (n === 0) {
      els.status.textContent = t("status.noCsv");
      pendingFiles = null;
      return;
    }
    showModal(n);
  });

  els.single.addEventListener("change", (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    pendingFiles = e.target.files;
    if (countCsv(pendingFiles) === 0) {
      els.status.textContent = t("status.notCsv");
      pendingFiles = null;
      return;
    }
    showModal(1);
  });

  let pendingFilterAccuracy = false;

  els.modal.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-modal-action]");
    if (!btn) return;
    const action = btn.dataset.modalAction;
    const filterAccuracy = !!document.getElementById("filter-accuracy")?.checked;
    hideModal();
    if (action === "all") {
      processFolder(pendingFiles, null, { filterAccuracy });
      pendingFiles = null;
    } else if (action === "area") {
      pendingFilterAccuracy = filterAccuracy;
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
    els.areaStartDraw.classList.remove("active");
    armedDraw = false;
    lastBbox = null;
    bboxLayer.clearLayers();
    // Wyłączamy boxZoom (domyślnie Shift+drag = zoom do prostokąta) — przejmujemy ten gest.
    map.boxZoom.disable();
    map.on("mousedown", onDrawStart);
  }

  function exitDrawMode() {
    els.areaBar.hidden = true;
    document.body.classList.remove("draw-mode");
    armedDraw = false;
    els.areaStartDraw.classList.remove("active");
    map.boxZoom.enable();
    map.dragging.enable();
    map.off("mousedown", onDrawStart);
    map.off("mousemove", onDrawMove);
    map.off("mouseup", onDrawEnd);
    drawState = null;
  }

  // Czy "armed" tryb rysowania (po kliknięciu w przycisk "Rysuj prostokąt").
  // Wtedy następny mousedown rysuje od razu, bez Shifta. Dla touch / pojedynczego gestu.
  let armedDraw = false;

  function onDrawStart(e) {
    const oe = e.originalEvent;
    const useShift = oe && oe.shiftKey;
    if (!useShift && !armedDraw) return; // pozwól mapie panować normalnie
    if (oe && oe.preventDefault) oe.preventDefault();
    // Wyłącz pan mapy podczas rysowania, żeby nie konfliktował.
    map.dragging.disable();
    // Wyczyść poprzedni prostokąt (jeśli rysujemy drugi raz w tej samej sesji).
    bboxLayer.clearLayers();
    lastBbox = null;
    els.areaConfirm.disabled = true;
    els.areaRedraw.disabled = true;
    drawState = { start: e.latlng, rect: null };
    map.on("mousemove", onDrawMove);
    map.on("mouseup", onDrawEnd);
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
    // Po zakończeniu rysowania przywróć normalny pan i zdejmij "armed".
    map.dragging.enable();
    armedDraw = false;
    els.areaStartDraw.classList.remove("active");
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

  els.areaStartDraw.addEventListener("click", () => {
    armedDraw = true;
    els.areaStartDraw.classList.add("active");
    document.body.classList.add("draw-mode");
  });

  els.areaConfirm.addEventListener("click", () => {
    if (!lastBbox || !pendingFiles) return;
    const bbox = lastBbox;
    const files = pendingFiles;
    const filterAccuracy = pendingFilterAccuracy;
    pendingFiles = null;
    pendingFilterAccuracy = false;
    exitDrawMode();
    processFolder(files, bbox, { filterAccuracy });
  });

  els.areaRedraw.addEventListener("click", () => {
    // Handler mousedown jest już zarejestrowany w enterDrawMode i nigdy nie był zdjęty.
    // Wystarczy wyczyścić stan; kolejny mousedown odpali nowe rysowanie (onDrawStart też czyści).
    bboxLayer.clearLayers();
    lastBbox = null;
    els.areaConfirm.disabled = true;
    els.areaRedraw.disabled = true;
  });

  els.areaCancel.addEventListener("click", () => {
    exitDrawMode();
    bboxLayer.clearLayers();
    pendingFiles = null;
    els.folder.value = "";
    els.status.textContent = t("status.cancelled");
  });

  els.reset.addEventListener("click", () => {
    if (!els.areaBar.hidden) exitDrawMode();
    resetMap();
    els.folder.value = "";
    els.single.value = "";
    pendingFiles = null;
    els.status.textContent = t("status.initial");
  });

  // ---- Zakładki --------------------------------------------------------------

  function switchTab(name) {
    els.tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    els.panes.forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
  }
  els.tabs.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // Po zmianie języka odśwież dynamiczne fragmenty (modal title, popupy, status startowy).
  window.addEventListener("fpv-langchange", () => {
    if (lastModalCount) refreshModalTitle();
    // Statusu w trakcie analizy nie ruszamy (i tak za chwilę zostanie nadpisany).
    // Jeśli to stan początkowy lub po reset — uaktualnij.
    const isPending = currentSourceLikeState();
    if (!isPending) {
      els.status.textContent = t("status.initial");
    }
  });
  function currentSourceLikeState() {
    return !els.progress.hidden;
  }

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
    }).addTo(ballisticsLayer).bindPopup(`<b>${escapeHtml(t("ballistics.result.start"))}</b><br>${start[0].toFixed(6)}, ${start[1].toFixed(6)}`);

    L.circle(land, { radius: 40, color: "#3cb44b", fillColor: "#3cb44b", fillOpacity: 0.15, weight: 2 })
      .addTo(ballisticsLayer)
      .bindTooltip(t("ballistics.result.tooltip"));

    L.circleMarker(land, {
      radius: 12, color: "#000", fillColor: "#e6194b", fillOpacity: 1, weight: 2,
    }).addTo(ballisticsLayer).bindPopup(
      `<b>${escapeHtml(t("ballistics.result.predicted"))}</b><br>` +
      `${land[0].toFixed(6)}, ${land[1].toFixed(6)}<br>` +
      `<a href="https://www.google.com/maps?q=${land[0].toFixed(6)},${land[1].toFixed(6)}" target="_blank" rel="noopener">Google Maps</a>`
    ).openPopup();

    map.fitBounds([start, land], { padding: [60, 60] });

    const gmaps = `https://www.google.com/maps?q=${land[0].toFixed(6)},${land[1].toFixed(6)}`;
    els.bResult.hidden = false;
    els.bResult.innerHTML = `
      <h3>${escapeHtml(t("ballistics.result.title"))}</h3>
      <div>${escapeHtml(t("ballistics.result.t"))}: <strong>${res.t.toFixed(1)} s</strong></div>
      <div>${escapeHtml(t("ballistics.result.dist"))}: <strong>${res.dist.toFixed(0)} m</strong></div>
      <div>${escapeHtml(t("ballistics.result.vh"))}: ${res.vh.toFixed(2)} m/s</div>
      <div>${escapeHtml(t("ballistics.result.vv"))}: ${res.vv.toFixed(2)} m/s</div>
      <div class="landing">${escapeHtml(t("ballistics.result.landing"))}:<br><code>${land[0].toFixed(6)}, ${land[1].toFixed(6)}</code></div>
      <div><a href="${gmaps}" target="_blank" rel="noopener">${escapeHtml(t("ballistics.result.openMaps"))}</a></div>
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
      els.bResult.innerHTML = `<div class="error">${escapeHtml(t("ballistics.error"))}</div>`;
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

  // ===== NAVIGATION (Geolocation + compass + target picker) ==================

  const nav = {
    watchId: null,
    myPos: null,
    myMarker: null,
    accuracyCircle: null,
    target: null,
    targetMarker: null,
    deviceHeading: null,
    pickingTarget: false,
    deviceOrientationListening: false,
  };

  const navLayer = L.layerGroup().addTo(map);

  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function bearingDeg(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function bearingCardinal(b) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(b / 45) % 8];
  }

  function formatDistance(m) {
    if (m < 1000) return `${m.toFixed(0)} ${t("compass.m")}`;
    return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} ${t("compass.km")}`;
  }

  function showCompass() { els.compass.hidden = false; }
  function hideCompass() { els.compass.hidden = true; }

  function updateCompass() {
    if (!nav.myPos || !nav.target) {
      hideCompass();
      return;
    }
    const dist = haversine(nav.myPos.lat, nav.myPos.lon, nav.target.lat, nav.target.lon);
    const brg = bearingDeg(nav.myPos.lat, nav.myPos.lon, nav.target.lat, nav.target.lon);
    const heading = nav.deviceHeading || 0;
    const arrowRotation = brg - heading;
    if (els.compassArrow) {
      els.compassArrow.style.transform = `translate(-50%, -100%) rotate(${arrowRotation}deg)`;
    }
    if (els.compassRing) {
      els.compassRing.style.transform = `rotate(${-heading}deg)`;
    }
    els.compassDistance.textContent = formatDistance(dist);
    els.compassBearing.textContent = `${brg.toFixed(0)}° ${bearingCardinal(brg)}`;
    showCompass();
  }

  function userIconHtml() {
    return '<div style="width:14px;height:14px;border-radius:50%;background:#4363d8;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>';
  }

  function updateMyPosition(pos) {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const acc = pos.coords.accuracy || 30;
    const first = !nav.myPos;
    nav.myPos = { lat, lon, accuracy: acc };

    if (!nav.myMarker) {
      nav.myMarker = L.marker([lat, lon], {
        icon: L.divIcon({ html: userIconHtml(), className: "user-loc-icon", iconSize: [20, 20] }),
        interactive: true,
        keyboard: false,
      }).addTo(navLayer).bindPopup(`<b>${escapeHtml(t("nav.popup.myLocation"))}</b><br>${lat.toFixed(6)}, ${lon.toFixed(6)}<br>±${acc.toFixed(0)} m`);
      nav.accuracyCircle = L.circle([lat, lon], {
        radius: acc, color: "#4363d8", fillColor: "#4363d8", fillOpacity: 0.12, weight: 1,
      }).addTo(navLayer);
    } else {
      nav.myMarker.setLatLng([lat, lon]);
      nav.myMarker.setPopupContent(`<b>${escapeHtml(t("nav.popup.myLocation"))}</b><br>${lat.toFixed(6)}, ${lon.toFixed(6)}<br>±${acc.toFixed(0)} m`);
      nav.accuracyCircle.setLatLng([lat, lon]).setRadius(acc);
    }
    if (first) {
      map.setView([lat, lon], Math.max(map.getZoom(), 15));
    }
    updateCompass();
  }

  function onGeolocationError(err) {
    let msg = err.message || "Unknown";
    if (err.code === 1) msg = t("nav.permissionDenied");
    els.status.textContent = t("nav.gpsError", { msg });
    stopLocation();
  }

  function startLocation() {
    if (!navigator.geolocation) {
      els.status.textContent = t("nav.gpsUnavailable");
      return;
    }
    nav.watchId = navigator.geolocation.watchPosition(
      updateMyPosition,
      onGeolocationError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    els.locateBtn.classList.add("active");
    els.locateBtn.textContent = t("nav.locateStop");
    requestDeviceOrientation();
  }

  function stopLocation() {
    if (nav.watchId != null) {
      navigator.geolocation.clearWatch(nav.watchId);
      nav.watchId = null;
    }
    if (nav.myMarker) { nav.myMarker.remove(); nav.myMarker = null; }
    if (nav.accuracyCircle) { nav.accuracyCircle.remove(); nav.accuracyCircle = null; }
    nav.myPos = null;
    els.locateBtn.classList.remove("active");
    els.locateBtn.textContent = t("nav.locate");
    hideCompass();
  }

  function setTarget(lat, lon) {
    nav.target = { lat, lon };
    if (nav.targetMarker) nav.targetMarker.remove();
    nav.targetMarker = L.marker([lat, lon], {
      icon: L.divIcon({ html: "🎯", className: "target-marker-icon", iconSize: [30, 30] }),
    }).addTo(navLayer).bindPopup(`<b>${escapeHtml(t("nav.popup.target"))}</b><br>${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    els.clearTargetBtn.hidden = false;
    els.status.textContent = t("nav.targetSet");
    updateCompass();
  }

  function clearTarget() {
    nav.target = null;
    if (nav.targetMarker) { nav.targetMarker.remove(); nav.targetMarker = null; }
    els.clearTargetBtn.hidden = true;
    hideCompass();
    els.status.textContent = t("nav.targetCleared");
  }

  function onDeviceOrientation(e) {
    let heading = null;
    if (e.webkitCompassHeading != null && !Number.isNaN(e.webkitCompassHeading)) {
      heading = e.webkitCompassHeading;
    } else if (e.alpha != null && !Number.isNaN(e.alpha)) {
      heading = (360 - e.alpha) % 360;
    }
    if (heading == null || Number.isNaN(heading)) return;
    // Throttle do ~30fps przez requestAnimationFrame — wystarczy dla płynnego oka,
    // ale unikamy 60+ updateow CSS na sekunde.
    nav.deviceHeading = heading;
    if (!nav._compassFrameQueued) {
      nav._compassFrameQueued = true;
      requestAnimationFrame(() => {
        nav._compassFrameQueued = false;
        updateCompass();
      });
    }
  }

  function requestDeviceOrientation() {
    if (nav.deviceOrientationListening) return;
    if (typeof DeviceOrientationEvent !== "undefined"
        && typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS 13+ requires user gesture
      els.compassPermission.hidden = false;
      els.compassPermission.onclick = () => {
        DeviceOrientationEvent.requestPermission().then((state) => {
          if (state === "granted") {
            window.addEventListener("deviceorientation", onDeviceOrientation);
            nav.deviceOrientationListening = true;
            els.compassPermission.hidden = true;
          }
        }).catch(() => {});
      };
    } else {
      // Tylko jeden listener — preferujemy absolutny. Dwa naraz powodowały
      // alternowanie wartości (alpha vs absolute alpha) i wizualne migotanie.
      const eventName = "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation";
      window.addEventListener(eventName, onDeviceOrientation);
      nav.deviceOrientationListening = true;
    }
  }

  function ensureLocation() {
    if (nav.watchId == null) startLocation();
  }

  els.locateBtn.addEventListener("click", () => {
    if (nav.watchId != null) stopLocation();
    else startLocation();
  });

  els.pickTargetBtn.addEventListener("click", () => {
    nav.pickingTarget = !nav.pickingTarget;
    if (nav.pickingTarget) {
      ensureLocation();
      els.pickTargetBtn.classList.add("active");
      els.pickTargetBtn.textContent = t("nav.pickTargetActive");
      map.getContainer().style.cursor = "crosshair";
    } else {
      els.pickTargetBtn.classList.remove("active");
      els.pickTargetBtn.textContent = t("nav.pickTarget");
      map.getContainer().style.cursor = "";
    }
  });

  els.clearTargetBtn.addEventListener("click", clearTarget);

  map.on("click", (e) => {
    if (!nav.pickingTarget) return;
    setTarget(e.latlng.lat, e.latlng.lng);
    nav.pickingTarget = false;
    els.pickTargetBtn.classList.remove("active");
    els.pickTargetBtn.textContent = t("nav.pickTarget");
    map.getContainer().style.cursor = "";
  });

  // Set target from popup "Navigate here" button (delegation)
  document.body.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-nav-target]");
    if (!btn) return;
    const parts = btn.getAttribute("data-nav-target").split(",");
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      ensureLocation();
      setTarget(lat, lon);
      map.closePopup();
    }
  });

  // Sidebar toggle (mobile)
  els.sidebarToggle.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
    map.invalidateSize();
  });

  // Re-translate Locate button label on language change
  window.addEventListener("fpv-langchange", () => {
    if (nav.watchId != null) els.locateBtn.textContent = t("nav.locateStop");
    else els.locateBtn.textContent = t("nav.locate");
    els.pickTargetBtn.textContent = nav.pickingTarget ? t("nav.pickTargetActive") : t("nav.pickTarget");
    els.clearTargetBtn.textContent = t("nav.clearTarget");
    if (nav.target) updateCompass();
  });
})();
