# -*- coding: utf-8 -*-
"""
Symulacja balistyczna upadku rozbrojonego drona (silniki OFF).
Wszystkie parametry przyjmowane jako argumenty — zero hardkodów.
"""

import math


G = 9.81
RHO = 1.225
DT = 0.02
T_MAX = 120.0
TRACE_EVERY = 10


def simulate_disarmed(lat0, lon0, alt, hdg_deg, gspd_kmh,
                      mass_kg=0.7, area_m2=0.03, cd=0.8):
    if alt <= 0:
        return {
            "landing": {"lat": lat0, "lon": lon0},
            "path": [[lat0, lon0, 0.0]],
            "t": 0.0, "dist": 0.0, "vh": 0.0, "vv": 0.0,
            "params": {
                "lat0": lat0, "lon0": lon0, "alt": alt, "hdg_deg": hdg_deg,
                "gspd_kmh": gspd_kmh, "mass_kg": mass_kg,
                "area_m2": area_m2, "cd": cd,
            },
        }

    deg_lat_per_m = 1.0 / 111320.0
    deg_lon_per_m = 1.0 / (111320.0 * max(math.cos(math.radians(lat0)), 1e-6))

    hdg_rad = math.radians(hdg_deg)
    dir_n = math.cos(hdg_rad)
    dir_e = math.sin(hdg_rad)

    gspd_ms = gspd_kmh / 3.6
    k = 0.5 * RHO * area_m2 * cd / mass_kg

    x = 0.0
    z = float(alt)
    vx = gspd_ms
    vz = 0.0
    t = 0.0
    step = 0
    path = [[lat0, lon0, z]]

    while z > 0 and t < T_MAX:
        v = math.sqrt(vx * vx + vz * vz)
        if v > 0:
            a_drag = k * v * v
            ax = -a_drag * (vx / v)
            az_drag = -a_drag * (vz / v)
        else:
            ax = 0.0
            az_drag = 0.0
        az = -G + az_drag

        vx += ax * DT
        vz += az * DT
        x += vx * DT
        z += vz * DT
        t += DT
        step += 1

        if step % TRACE_EVERY == 0:
            dn_m = dir_n * x
            de_m = dir_e * x
            path.append([
                lat0 + dn_m * deg_lat_per_m,
                lon0 + de_m * deg_lon_per_m,
                max(z, 0.0),
            ])

    dn_m = dir_n * x
    de_m = dir_e * x
    lat = lat0 + dn_m * deg_lat_per_m
    lon = lon0 + de_m * deg_lon_per_m
    if not path or path[-1][:2] != [lat, lon]:
        path.append([lat, lon, 0.0])

    return {
        "landing": {"lat": lat, "lon": lon},
        "path": path,
        "t": t,
        "dist": x,
        "vh": vx,
        "vv": -vz,
        "params": {
            "lat0": lat0, "lon0": lon0, "alt": float(alt),
            "hdg_deg": float(hdg_deg), "gspd_kmh": float(gspd_kmh),
            "mass_kg": float(mass_kg), "area_m2": float(area_m2),
            "cd": float(cd),
        },
    }
