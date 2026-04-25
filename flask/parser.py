# -*- coding: utf-8 -*-
"""
Parsowanie CSV-ów telemetrycznych z EdgeTX (i innych radii OpenTX-pochodnych).
Elastyczne wykrywanie kolumn — pozycja kolumny GPS może się różnić u różnych
użytkowników (zależnie od skonfigurowanych sensorów), nazewnictwo również.
"""

import csv
import os
import re


ENCODINGS = ("utf-8-sig", "utf-8", "cp1250", "latin-1")

_PAIR_SEP = re.compile(r"[\s,;]+")


def open_csv(path):
    for enc in ENCODINGS:
        try:
            with open(path, "r", encoding=enc, newline="") as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    with open(path, "r", encoding="utf-8", errors="replace", newline="") as f:
        return f.read()


def _is_valid_pair(lat, lon):
    if lat is None or lon is None:
        return False
    if not (-90.0 <= lat <= 90.0):
        return False
    if not (-180.0 <= lon <= 180.0):
        return False
    if abs(lat) < 1e-9 and abs(lon) < 1e-9:
        return False
    return True


def _try_parse_pair(text):
    if text is None:
        return None
    s = text.strip()
    if not s:
        return None
    parts = [p for p in _PAIR_SEP.split(s) if p]
    if len(parts) != 2:
        return None
    try:
        lat = float(parts[0])
        lon = float(parts[1])
    except ValueError:
        return None
    return (lat, lon)


def _try_parse_float(text):
    if text is None:
        return None
    s = text.strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _name_score_gps(name):
    n = (name or "").lower()
    if not n:
        return 0
    score = 0
    if "gps" in n:
        score += 10
    if "pos" in n and "position" not in n:
        score += 3
    if "coord" in n:
        score += 4
    return score


def _is_lat_name(name):
    n = (name or "").lower()
    if not n:
        return False
    if "long" in n or "lng" in n:
        return False
    if "alt" in n or "late" in n or "later" in n:
        return False
    return "lat" in n


def _is_lon_name(name):
    n = (name or "").lower()
    if not n:
        return False
    if "long" in n or "lng" in n:
        return True
    if "lon" in n and "long" not in n:
        return True
    return False


def _peek_first_value(rows, col):
    for row in rows:
        v = (row.get(col) or "").strip()
        if v:
            return v
    return ""


def _detect_helper(fieldnames, *needles):
    for n in fieldnames or ():
        low = (n or "").lower()
        for needle in needles:
            if needle in low:
                return n
    return None


def _detect_columns(fieldnames, sample_rows):
    info = {"mode": None}
    if not fieldnames:
        return info

    pair_candidates = sorted(
        ((_name_score_gps(n), n) for n in fieldnames),
        key=lambda x: -x[0],
    )
    chosen_pair = None
    for score, name in pair_candidates:
        if score <= 0:
            break
        sample = _peek_first_value(sample_rows, name)
        if sample and _try_parse_pair(sample):
            chosen_pair = name
            break

    lat_col = next((n for n in fieldnames if _is_lat_name(n)), None)
    lon_col = next((n for n in fieldnames if _is_lon_name(n)), None)
    chosen_split = (lat_col, lon_col) if (lat_col and lon_col) else None

    if chosen_pair:
        info["mode"] = "pair"
        info["gps_col"] = chosen_pair
    elif chosen_split:
        info["mode"] = "split"
        info["lat_col"], info["lon_col"] = chosen_split

    info["time_col"] = _detect_helper(fieldnames, "time")
    info["date_col"] = _detect_helper(fieldnames, "date")
    info["alt_col"] = _detect_helper(fieldnames, "galt", "alt(m)", "altitude") or _detect_helper(fieldnames, "alt")
    info["sats_col"] = _detect_helper(fieldnames, "sats", "satellites")
    info["gspd_col"] = _detect_helper(fieldnames, "gspd", "groundspeed", "gs(", "speed")
    info["hdg_col"] = _detect_helper(fieldnames, "hdg", "heading", "course", "yaw")
    return info


def parse_file(path):
    """
    Czyta CSV i zwraca listę punktów GPS:
      [{"time", "date", "lat", "lon", "alt", "sats", "gspd", "hdg"}, ...]
    """
    text = open_csv(path)
    if not text.strip():
        return []

    reader = csv.DictReader(text.splitlines())
    fieldnames = reader.fieldnames or []
    rows = list(reader)
    if not rows:
        return []

    info = _detect_columns(fieldnames, rows[:50])
    if info["mode"] is None:
        return []

    points = []
    for row in rows:
        if info["mode"] == "pair":
            pair = _try_parse_pair(row.get(info["gps_col"]))
            if not pair:
                continue
            lat, lon = pair
        else:
            lat = _try_parse_float(row.get(info["lat_col"]))
            lon = _try_parse_float(row.get(info["lon_col"]))

        if not _is_valid_pair(lat, lon):
            continue

        def _val(col):
            if not col:
                return ""
            return (row.get(col) or "").strip()

        points.append({
            "time": _val(info.get("time_col")),
            "date": _val(info.get("date_col")),
            "lat": lat,
            "lon": lon,
            "alt": _val(info.get("alt_col")),
            "sats": _val(info.get("sats_col")),
            "gspd": _val(info.get("gspd_col")),
            "hdg": _val(info.get("hdg_col")),
        })
    return points


def is_log_file(path):
    name = os.path.basename(path)
    if name.startswith(".~lock."):
        return False
    if name.endswith(".csv#"):
        return False
    return name.lower().endswith(".csv")


def iter_log_paths(folder):
    out = []
    for root, _dirs, files in os.walk(folder):
        for f in files:
            full = os.path.join(root, f)
            if is_log_file(full):
                out.append(full)
    out.sort()
    return out
