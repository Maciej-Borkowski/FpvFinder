// Symulacja balistyczna upadku rozbrojonego drona (silniki OFF).
// Port z analiza_upadku.py — wszystkie parametry jako argumenty (zero hardkodów).

(function (global) {
  "use strict";

  const G = 9.81;
  const RHO = 1.225;
  const DT = 0.02;
  const T_MAX = 120.0;
  const TRACE_EVERY = 10;

  function simulateDisarmed(opts) {
    const lat0 = +opts.lat;
    const lon0 = +opts.lon;
    const alt = +opts.alt;
    const hdgDeg = +opts.hdg;
    const gspdKmh = +opts.gspd;
    const massKg = opts.mass != null ? +opts.mass : 0.7;
    const areaM2 = opts.area != null ? +opts.area : 0.03;
    const cd = opts.cd != null ? +opts.cd : 0.8;

    if (alt <= 0) {
      return {
        landing: { lat: lat0, lon: lon0 },
        path: [[lat0, lon0, 0]],
        t: 0, dist: 0, vh: 0, vv: 0,
        params: { lat0, lon0, alt, hdgDeg, gspdKmh, massKg, areaM2, cd },
      };
    }

    const degLatPerM = 1.0 / 111320.0;
    const degLonPerM = 1.0 / (111320.0 * Math.max(Math.cos(lat0 * Math.PI / 180), 1e-6));

    const hdgRad = hdgDeg * Math.PI / 180;
    const dirN = Math.cos(hdgRad);
    const dirE = Math.sin(hdgRad);

    const gspdMs = gspdKmh / 3.6;
    const k = 0.5 * RHO * areaM2 * cd / massKg;

    let x = 0;
    let z = alt;
    let vx = gspdMs;
    let vz = 0;
    let t = 0;
    let step = 0;

    const path = [[lat0, lon0, z]];

    while (z > 0 && t < T_MAX) {
      const v = Math.sqrt(vx * vx + vz * vz);
      let ax = 0, azDrag = 0;
      if (v > 0) {
        const aDrag = k * v * v;
        ax = -aDrag * (vx / v);
        azDrag = -aDrag * (vz / v);
      }
      const az = -G + azDrag;

      vx += ax * DT;
      vz += az * DT;
      x += vx * DT;
      z += vz * DT;
      t += DT;
      step++;

      if (step % TRACE_EVERY === 0) {
        const dnM = dirN * x;
        const deM = dirE * x;
        path.push([
          lat0 + dnM * degLatPerM,
          lon0 + deM * degLonPerM,
          Math.max(z, 0),
        ]);
      }
    }

    const dnM = dirN * x;
    const deM = dirE * x;
    const lat = lat0 + dnM * degLatPerM;
    const lon = lon0 + deM * degLonPerM;
    if (path[path.length - 1][0] !== lat || path[path.length - 1][1] !== lon) {
      path.push([lat, lon, 0]);
    }

    return {
      landing: { lat, lon },
      path,
      t, dist: x, vh: vx, vv: -vz,
      params: { lat0, lon0, alt, hdgDeg, gspdKmh, massKg, areaM2, cd },
    };
  }

  global.FpvBallistics = { simulateDisarmed };
})(window);
