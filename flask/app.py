# -*- coding: utf-8 -*-
"""
FpvFinder — Flask web app do analizy logów EdgeTX i wizualizacji tras GPS.
Wersja przeznaczona do uruchamiania lokalnie u pilota.
"""

import json
import os
import string
import sys

from flask import Flask, jsonify, render_template, request, Response, stream_with_context

import parser as log_parser
import ballistics


PALETTE = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
    "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
    "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080",
]


app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


def _normalize_path(raw):
    if raw is None:
        return None
    if "\x00" in raw:
        return None
    s = raw.strip()
    if not s:
        return None
    return os.path.abspath(os.path.expanduser(s))


def _windows_drives():
    if os.name != "nt":
        return []
    out = []
    for letter in string.ascii_uppercase:
        d = f"{letter}:\\"
        if os.path.exists(d):
            out.append(d)
    return out


@app.route("/api/list-dir")
def list_dir():
    raw = request.args.get("path")
    path = _normalize_path(raw) if raw else os.path.expanduser("~")
    if path is None:
        return jsonify({"error": "Pusta lub niepoprawna ścieżka."}), 400

    if not os.path.exists(path):
        return jsonify({"error": f"Ścieżka nie istnieje: {path}"}), 404
    if not os.path.isdir(path):
        return jsonify({"error": f"To nie jest folder: {path}"}), 400

    try:
        entries = os.listdir(path)
    except PermissionError:
        return jsonify({"error": f"Brak uprawnień do {path}"}), 403
    except OSError as e:
        return jsonify({"error": f"Błąd odczytu folderu: {e}"}), 500

    dirs = []
    csv_count = 0
    for name in entries:
        full = os.path.join(path, name)
        try:
            if os.path.isdir(full):
                dirs.append(name)
            elif log_parser.is_log_file(full):
                csv_count += 1
        except OSError:
            continue
    dirs.sort(key=lambda s: s.lower())

    parent = os.path.dirname(path)
    if parent == path:
        parent = None

    return jsonify({
        "cwd": path,
        "parent": parent,
        "dirs": dirs,
        "csv_count": csv_count,
        "drives": _windows_drives(),
        "sep": os.sep,
    })


def _sse(event, payload):
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.route("/api/analyze")
def analyze():
    raw = request.args.get("path")
    path = _normalize_path(raw)

    @stream_with_context
    def generate():
        if not path or not os.path.isdir(path):
            yield _sse("error", {"message": f"Niepoprawny folder: {raw!r}"})
            yield _sse("done", {"files_with_gps": 0, "total_points": 0})
            return

        files = log_parser.iter_log_paths(path)
        yield _sse("start", {"folder": path, "total": len(files)})

        files_with_gps = 0
        total_points = 0
        track_index = 0

        for i, full in enumerate(files, start=1):
            rel = os.path.relpath(full, path)
            try:
                pts = log_parser.parse_file(full)
            except Exception as e:
                yield _sse("error", {"file": rel, "message": str(e)})
                yield _sse("progress", {"done": i, "total": len(files)})
                continue

            if pts:
                color = PALETTE[track_index % len(PALETTE)]
                track_index += 1
                files_with_gps += 1
                total_points += len(pts)
                yield _sse("track", {
                    "file": rel,
                    "color": color,
                    "points": pts,
                })
            yield _sse("progress", {"done": i, "total": len(files)})

        yield _sse("done", {
            "files_with_gps": files_with_gps,
            "total_points": total_points,
            "total_files": len(files),
        })

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return Response(generate(), headers=headers)


@app.route("/api/ballistics", methods=["POST"])
def run_ballistics():
    data = request.get_json(silent=True) or {}
    try:
        lat = float(data["lat"])
        lon = float(data["lon"])
        alt = float(data.get("alt", 0))
        hdg = float(data.get("hdg", 0))
        gspd = float(data.get("gspd_kmh", 0))
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Wymagane: lat, lon, alt, hdg, gspd_kmh (liczby)."}), 400

    mass = float(data.get("mass", 0.7))
    area = float(data.get("area", 0.03))
    cd = float(data.get("cd", 0.8))

    result = ballistics.simulate_disarmed(
        lat0=lat, lon0=lon, alt=alt, hdg_deg=hdg, gspd_kmh=gspd,
        mass_kg=mass, area_m2=area, cd=cd,
    )
    return jsonify(result)


if __name__ == "__main__":
    host = os.environ.get("FPVFINDER_HOST", "127.0.0.1")
    port = int(os.environ.get("FPVFINDER_PORT", "5000"))
    debug = os.environ.get("FPVFINDER_DEBUG", "0") == "1"
    print(f"FpvFinder uruchomiony: http://{host}:{port}", file=sys.stderr)
    app.run(host=host, port=port, debug=debug, threaded=True)
