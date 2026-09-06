/* 행정동 경계 shp → GeoJSON(WGS84)
   원본: 통계청 BND_ADM_DONG_PG (EPSG:5186 · KGD2002 중부원점 / CP949)
   의존성 없이 읽고, 좌표를 WGS84 로 바꾸고, 화면에 필요한 만큼만 간략화한다.
   사용: node scripts/shp2geojson.mjs <shp없는경로prefix> <출력.geojson> */
import fs from 'fs';

const base = process.argv[2];
const out  = process.argv[3] || 'data/adm_dong.geojson';
if (!base) { console.error('사용: node scripts/shp2geojson.mjs <경로/이름(확장자 없이)> [출력]'); process.exit(1); }

/* ── 1. DBF — 행정동 코드·이름 ── */
/* .cpg 를 믿지 않고 첫 레코드를 실제로 읽어 인코딩을 정한다 */
function dbfEnc(buf, hLen, rLen, flds) {
  let p = hLen + 1;
  for (const f of flds) {
    const raw = buf.subarray(p, p + f.len);
    const u = new TextDecoder('utf-8', {fatal:false}).decode(raw);
    if (/[가-힣]/.test(u)) return 'utf-8';
    p += f.len;
  }
  return 'euc-kr';
}
function readDbf(buf) {
  const nRec = buf.readUInt32LE(4), hLen = buf.readUInt16LE(8), rLen = buf.readUInt16LE(10);
  const flds = [];
  for (let p = 32; buf[p] !== 0x0D; p += 32) {
    flds.push({
      name: buf.toString('latin1', p, p + 11).replace(/\0.*$/, '').trim(),
      len: buf[p + 16]
    });
  }
  /* .cpg 는 949 라고 적혀 있지만 실제 내용은 UTF-8 이다 — 읽어 보고 정한다 */
  const dec = new TextDecoder(dbfEnc(buf, hLen, rLen, flds));
  const rows = [];
  for (let i = 0; i < nRec; i++) {
    const p0 = hLen + i * rLen;
    if (buf[p0] === 0x2A) continue;        /* 삭제 표시 */
    const row = {};
    let p = p0 + 1;
    for (const f of flds) {
      row[f.name] = dec.decode(buf.subarray(p, p + f.len)).replace(/\0/g, '').trim();
      p += f.len;
    }
    rows.push(row);
  }
  return rows;
}

/* ── 2. SHP — 폴리곤(타입 5)만 ── */
function readShp(buf) {
  const shapes = [];
  let p = 100;
  while (p < buf.length) {
    const len = buf.readInt32BE(p + 4) * 2;      /* 워드 단위 */
    const type = buf.readInt32LE(p + 8);
    if (type === 5) {
      const nParts = buf.readInt32LE(p + 44);
      const nPts   = buf.readInt32LE(p + 48);
      const parts  = [];
      for (let i = 0; i < nParts; i++) parts.push(buf.readInt32LE(p + 52 + i * 4));
      const pBase = p + 52 + nParts * 4;
      const pts = [];
      for (let i = 0; i < nPts; i++) {
        pts.push([buf.readDoubleLE(pBase + i * 16), buf.readDoubleLE(pBase + i * 16 + 8)]);
      }
      const rings = [];
      for (let i = 0; i < nParts; i++) {
        rings.push(pts.slice(parts[i], i + 1 < nParts ? parts[i + 1] : nPts));
      }
      shapes.push(rings);
    } else shapes.push(null);
    p += 8 + len;
  }
  return shapes;
}

/* ── 3. EPSG:5186 → WGS84 (횡축 메르카토르 역변환, GRS80) ── */
const A = 6378137.0, F = 1 / 298.257222101;
const E2 = 2 * F - F * F, K0 = 1.0, FE = 200000.0, FN = 600000.0;
const LAT0 = 38 * Math.PI / 180, LON0 = 127 * Math.PI / 180;
function mArc(phi) {
  const e2 = E2, e4 = e2 * e2, e6 = e4 * e2;
  return A * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi));
}
const M0 = mArc(LAT0);
function toWgs(x, y) {
  const M = M0 + (y - FN) / K0;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256));
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1), cos1 = Math.cos(phi1), tan1 = Math.tan(phi1);
  const ep2 = E2 / (1 - E2);
  const C1 = ep2 * cos1 * cos1, T1 = tan1 * tan1;
  const N1 = A / Math.sqrt(1 - E2 * sin1 * sin1);
  const R1 = A * (1 - E2) / Math.pow(1 - E2 * sin1 * sin1, 1.5);
  const D = (x - FE) / (N1 * K0);
  const lat = phi1 - (N1 * tan1 / R1) * (D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = LON0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / cos1;
  return [lon * 180 / Math.PI, lat * 180 / Math.PI];
}

/* ── 4. 간략화 — 화면에서 구분되지 않는 점은 뺀다 ── */
function simplify(ring, tol) {
  if (ring.length <= 4) return ring;
  const keep = new Array(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1, fd = tol;
    const [ax, ay] = ring[a], [bx, by] = ring[b];
    const dx = bx - ax, dy = by - ay;
    const dd = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i];
      let d;
      if (dd === 0) d = Math.hypot(px - ax, py - ay);
      else {
        let t = ((px - ax) * dx + (py - ay) * dy) / dd;
        t = Math.max(0, Math.min(1, t));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = true; stack.push([a, far], [far, b]); }
  }
  const o = ring.filter((_, i) => keep[i]);
  if (o.length < 4) return ring;
  return o;
}

/* ── 5. 변환 ── */
const rows = readDbf(fs.readFileSync(base + '.dbf'));
const shapes = readShp(fs.readFileSync(base + '.shp'));
if (rows.length !== shapes.length) console.warn('주의: 속성 ' + rows.length + '개 · 도형 ' + shapes.length + '개');

const TOL = 0.00012;   /* 약 12m — 시·군 경계 표시에 충분하다 */
const feats = [];
let ptsIn = 0, ptsOut = 0;
for (let i = 0; i < shapes.length; i++) {
  const rings = shapes[i];
  if (!rings) continue;
  const conv = rings.map(r => {
    ptsIn += r.length;
    const w = r.map(([x, y]) => toWgs(x, y)).map(([lon, lat]) => [Number(lon.toFixed(6)), Number(lat.toFixed(6))]);
    const sm = simplify(w, TOL);
    if (sm[0][0] !== sm[sm.length - 1][0] || sm[0][1] !== sm[sm.length - 1][1]) sm.push(sm[0]);
    ptsOut += sm.length;
    return sm;
  }).filter(r => r.length >= 4);
  if (!conv.length) continue;
  const a = rows[i] || {};
  feats.push({
    type: 'Feature',
    properties: { code: a.ADM_CD || '', name: a.ADM_NM || '', date: a.BASE_DATE || '' },
    geometry: conv.length === 1
      ? { type: 'Polygon', coordinates: conv }
      : { type: 'MultiPolygon', coordinates: conv.map(r => [r]) }
  });
}
const gj = { type: 'FeatureCollection', features: feats };
fs.writeFileSync(out, JSON.stringify(gj));
const kb = Math.round(fs.statSync(out).size / 1024);
console.log('행정동 ' + feats.length + '개 · 점 ' + ptsIn + ' → ' + ptsOut +
  ' (' + Math.round(100 - ptsOut / ptsIn * 100) + '% 감축) · ' + kb + 'KB');
console.log('이름: ' + feats.map(f => f.properties.name).join(' '));
