// FpvFinder (Flask) — frontend rozmawia z lokalnym backendem Pythonowym.
// Folder wybierany jest po stronie serwera (/api/list-dir),
// analiza streamuje wyniki przez Server-Sent Events (/api/analyze).

(function () {
  "use strict";

  const els = {
    path: document.getElementById("path-input"),
    browse: document.getElementById("browse-btn"),
    analyze: document.getElementById("analyze-btn"),
    stop: document.getElementById("stop-btn"),
    reset: document.getElementById("reset-btn"),
    browser: document.getElementById("browser"),
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
    areaBar: document.getElementById("area-bar"),
    areaConfirm: document.getElementById("area-confirm"),
    areaRedraw: document.getElementById("area-redraw"),
    areaCancel: document.getElementById("area-cancel"),
  };

  const map = L.map("map").setView([52.0, 19.0], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const trackLayer = L.layerGroup().addTo(map);
  const ballisticsLayer = L.layerGroup().addTo(map);
  const bboxLayer = L.layerGroup().addTo(map);
  let allBoundsLatLngs = [];
  let currentSource = null;
  let pendingPath = null;
  let lastBbox = null;
  let drawState = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function popupHtml(file, p, isLast) {
    const gmaps = `https://www.google.com/maps?q=${p.lat},${p.lon}`;
    const last = isLast ? `<div class="last-marker">OSTATNI PUNKT</div>` : "";
    return `
      <div class="popup">
        ${last}
        <div class="popup-name">${escapeHtml(file)}</div>
        <div>Lat: <code>${(+p.lat).toFixed(6)}</code></div>
        <div>Lon: <code>${(+p.lon).toFixed(6)}</code></div>
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

    if (allBoundsLatLngs.length > 0) {
      map.fitBounds(allBoundsLatLngs, { padding: [30, 30] });
    }
  }

  function resetMap() {
    trackLayer.clearLayers();
    ballisticsLayer.clearLayers();
    bboxLayer.clearLayers();
    allBoundsLatLngs = [];
    els.fileList.innerHTML = "";
    els.bResult.hidden = true;
    els.bResult.innerHTML = "";
  }

  function drawBboxOverlay(bbox) {
    bboxLayer.clearLayers();
    L.rectangle(
      [[bbox.south, bbox.west], [bbox.north, bbox.east]],
      { color: "#3cb44b", weight: 2, fillOpacity: 0.05, dashArray: "4,4" }
    ).addTo(bboxLayer);
  }

  // ---- Przeglądarka folderów (server-side) ----------------------------------

  async function loadDir(path) {
    const url = "/api/list-dir" + (path ? `?path=${encodeURIComponent(path)}` : "");
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) {
      els.browser.hidden = false;
      els.browser.innerHTML = `<div class="error">${escapeHtml(data.error || "Błąd")}</div>`;
      return;
    }
    els.path.value = data.cwd;
    let html = `<div class="browser-cwd">${escapeHtml(data.cwd)} — <strong>${data.csv_count}</strong> .csv tutaj</div>`;
    if (data.drives && data.drives.length > 0) {
      html += `<div class="browser-drives">`;
      for (const d of data.drives) html += `<button class="link-like" data-go="${escapeHtml(d)}">${escapeHtml(d)}</button>`;
      html += `</div>`;
    }
    if (data.parent) {
      html += `<button class="browser-row" data-go="${escapeHtml(data.parent)}">⬆ ${escapeHtml(data.parent)}</button>`;
    }
    for (const name of data.dirs) {
      const full = data.cwd.endsWith(data.sep) ? data.cwd + name : data.cwd + data.sep + name;
      html += `<button class="browser-row" data-go="${escapeHtml(full)}">📁 ${escapeHtml(name)}</button>`;
    }
    if (data.csv_files && data.csv_files.length > 0) {
      html += `<div class="browser-section">Pojedyncze pliki .csv (kliknij aby wybrać):</div>`;
      for (const name of data.csv_files) {
        const full = data.cwd.endsWith(data.sep) ? data.cwd + name : data.cwd + data.sep + name;
        html += `<button class="browser-row browser-file" data-pick="${escapeHtml(full)}">📄 ${escapeHtml(name)}</button>`;
      }
    }
    els.browser.hidden = false;
    els.browser.innerHTML = html;
  }

  els.browse.addEventListener("click", () => loadDir(els.path.value || ""));
  els.browser.addEventListener("click", (ev) => {
    const pick = ev.target.closest("[data-pick]");
    if (pick) {
      els.path.value = pick.getAttribute("data-pick");
      els.browser.hidden = true;
      return;
    }
    const t = ev.target.closest("[data-go]");
    if (!t) return;
    loadDir(t.getAttribute("data-go"));
  });

  // ---- Analiza (SSE) ---------------------------------------------------------

  function runAnalysis(path, bbox) {
    if (currentSource) currentSource.close();
    resetMap();
    if (bbox) drawBboxOverlay(bbox);
    els.progress.hidden = false;
    els.progress.value = 0;
    els.progress.max = 1;
    els.analyze.disabled = true;
    els.stop.disabled = false;
    els.status.textContent = bbox ? "Łączę… (filtr obszaru aktywny)" : "Łączę…";

    let url = `/api/analyze?path=${encodeURIComponent(path)}`;
    if (bbox) {
      url += `&bbox=${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    }
    const src = new EventSource(url);
    currentSource = src;

    src.addEventListener("start", (e) => {
      const d = JSON.parse(e.data);
      els.progress.max = Math.max(1, d.total);
      const scope = d.bbox ? " (z filtrem obszaru)" : "";
      els.status.textContent = `Folder: ${d.folder}. Plików: ${d.total}${scope}.`;
    });
    src.addEventListener("track", (e) => {
      const d = JSON.parse(e.data);
      renderTrack(d.file, d.color, d.points);
    });
    src.addEventListener("progress", (e) => {
      const d = JSON.parse(e.data);
      els.progress.value = d.done;
      els.status.textContent = `Przetworzono ${d.done}/${d.total}.`;
    });
    src.addEventListener("error", (e) => {
      try {
        const d = JSON.parse(e.data || "{}");
        if (d.message) console.warn("Błąd parsera:", d);
      } catch (_) { /* reconnect */ }
    });
    src.addEventListener("done", (e) => {
      const d = JSON.parse(e.data);
      const skip = d.files_skipped_bbox ? `, pominięto poza obszarem: ${d.files_skipped_bbox}` : "";
      els.status.textContent = `Gotowe: ${d.files_with_gps} plików z GPS, łącznie ${d.total_points} punktów (z ${d.total_files})${skip}.`;
      els.progress.hidden = true;
      els.analyze.disabled = false;
      els.stop.disabled = true;
      src.close();
      currentSource = null;
    });
  }

  function startAnalysis() {
    const path = (els.path.value || "").trim();
    if (!path) {
      els.status.textContent = "Najpierw wpisz ścieżkę do folderu albo pliku .csv.";
      return;
    }
    pendingPath = path;
    showModal();
  }

  function showModal() { els.modal.hidden = false; }
  function hideModal() { els.modal.hidden = true; }

  els.analyze.addEventListener("click", startAnalysis);
  els.path.addEventListener("keydown", (e) => { if (e.key === "Enter") startAnalysis(); });

  els.modal.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-modal-action]");
    if (!btn) return;
    const action = btn.dataset.modalAction;
    hideModal();
    if (action === "all") {
      runAnalysis(pendingPath, null);
      pendingPath = null;
    } else if (action === "area") {
      enterDrawMode();
    } else {
      pendingPath = null;
    }
  });

  els.stop.addEventListener("click", () => {
    if (currentSource) {
      currentSource.close();
      currentSource = null;
    }
    els.analyze.disabled = false;
    els.stop.disabled = true;
    els.progress.hidden = true;
    els.status.textContent = "Zatrzymano.";
  });

  els.reset.addEventListener("click", () => {
    if (!els.areaBar.hidden) exitDrawMode();
    resetMap();
    pendingPath = null;
    els.status.textContent = "Wpisz ścieżkę do folderu z logami i kliknij „Analizuj”.";
  });

  // ---- Rysowanie prostokąta na mapie ----------------------------------------

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
    if (!lastBbox || !pendingPath) return;
    const bbox = lastBbox;
    const path = pendingPath;
    pendingPath = null;
    exitDrawMode();
    runAnalysis(path, bbox);
  });
  els.areaRedraw.addEventListener("click", () => {
    bboxLayer.clearLayers();
    lastBbox = null;
    els.areaConfirm.disabled = true;
    els.areaRedraw.disabled = true;
    map.on("mousedown", onDrawStart);
    map.on("touchstart", onDrawStart);
  });
  els.areaCancel.addEventListener("click", () => {
    exitDrawMode();
    bboxLayer.clearLayers();
    pendingPath = null;
    els.status.textContent = "Anulowano. Wpisz ścieżkę i kliknij „Analizuj”.";
  });

  // ---- Symulacja upadku (POST /api/ballistics) ------------------------------

  document.body.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-load-ballistics]");
    if (!btn) return;
    let p;
    try { p = JSON.parse(btn.getAttribute("data-load-ballistics").replace(/&apos;/g, "'")); }
    catch (_) { return; }
    if (p.lat != null) els.bLat.value = p.lat;
    if (p.lon != null) els.bLon.value = p.lon;
    if (p.alt) els.bAlt.value = parseFloat(p.alt);
    if (p.hdg) els.bHdg.value = parseFloat(p.hdg);
    if (p.gspd) els.bGspd.value = parseFloat(p.gspd);
    switchTab("ballistics");
  });

  function switchTab(name) {
    els.tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    els.panes.forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
  }
  els.tabs.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  function renderBallistics(res) {
    ballisticsLayer.clearLayers();
    const start = [res.params.lat0, res.params.lon0];
    const land = [res.landing.lat, res.landing.lon];

    L.polyline(res.path.map((p) => [p[0], p[1]]), {
      color: "#911eb4", weight: 3, opacity: 0.8, dashArray: "4,4",
    }).addTo(ballisticsLayer);
    L.circleMarker(start, {
      radius: 9, color: "#000", fillColor: "#000080", fillOpacity: 0.9, weight: 2,
    }).addTo(ballisticsLayer).bindPopup(`<b>Punkt utraty sygnału / start</b><br>${start[0].toFixed(6)}, ${start[1].toFixed(6)}`);
    L.circle(land, { radius: 40, color: "#3cb44b", fillColor: "#3cb44b", fillOpacity: 0.15, weight: 2 })
      .addTo(ballisticsLayer);
    L.circleMarker(land, {
      radius: 12, color: "#000", fillColor: "#e6194b", fillOpacity: 1, weight: 2,
    }).addTo(ballisticsLayer).bindPopup(
      `<b>Przewidziane miejsce upadku</b><br>${land[0].toFixed(6)}, ${land[1].toFixed(6)}<br>` +
      `<a href="https://www.google.com/maps?q=${land[0].toFixed(6)},${land[1].toFixed(6)}" target="_blank">Google Maps</a>`
    ).openPopup();
    map.fitBounds([start, land], { padding: [60, 60] });

    const gmaps = `https://www.google.com/maps?q=${land[0].toFixed(6)},${land[1].toFixed(6)}`;
    els.bResult.hidden = false;
    els.bResult.innerHTML = `
      <h3>Wynik symulacji</h3>
      <div>Czas upadku: <strong>${res.t.toFixed(1)} s</strong></div>
      <div>Droga pozioma: <strong>${res.dist.toFixed(0)} m</strong></div>
      <div>v pozioma końcowa: ${res.vh.toFixed(2)} m/s</div>
      <div>v pionowa końcowa: ${res.vv.toFixed(2)} m/s w dół</div>
      <div class="landing">Miejsce upadku:<br><code>${land[0].toFixed(6)}, ${land[1].toFixed(6)}</code></div>
      <div><a href="${gmaps}" target="_blank">Otwórz w Google Maps</a></div>
    `;
  }

  els.bRun.addEventListener("click", async () => {
    const need = ["bLat", "bLon", "bAlt", "bHdg", "bGspd"];
    for (const k of need) {
      if (els[k].value === "" || Number.isNaN(parseFloat(els[k].value))) {
        els.bResult.hidden = false;
        els.bResult.innerHTML = `<div class="error">Uzupełnij wszystkie pola.</div>`;
        return;
      }
    }
    const body = {
      lat: +els.bLat.value, lon: +els.bLon.value,
      alt: +els.bAlt.value, hdg: +els.bHdg.value, gspd_kmh: +els.bGspd.value,
      mass: +els.bMass.value || 0.7,
      area: +els.bArea.value || 0.03,
      cd: +els.bCd.value || 0.8,
    };
    const r = await fetch("/api/ballistics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      els.bResult.hidden = false;
      els.bResult.innerHTML = `<div class="error">${escapeHtml(data.error || "Błąd")}</div>`;
      return;
    }
    renderBallistics(data);
  });

  els.bClear.addEventListener("click", () => {
    ballisticsLayer.clearLayers();
    els.bResult.hidden = true;
    els.bResult.innerHTML = "";
  });
})();
