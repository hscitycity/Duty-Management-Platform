// Vercel 서버리스 프록시 — 교통 돌발상황 (경찰청 UTIC + 국토부 ITS 병합)
// UTIC은 http 전용 + CORS 미지원 → 서버에서 XML 수집. ITS eventInfo(JSON)와 병합해
// 화성 관할 중심 bbox로 필터한 JSON을 반환. 60초 CDN 캐시.
const UTIC_KEY = 'biLA6uQHddkUF7mIT1YY2DWFnRrRwbbwwCZ3K68A';
const ITS_KEY = '97854a7d83bb47789b3130a9a243ef93';
const BBOX = { minY: 36.98, maxY: 37.32, minX: 126.50, maxX: 127.135 };  // 화성 순수 경계 bbox

const inBox = (y, x) => y > BBOX.minY && y < BBOX.maxY && x > BBOX.minX && x < BBOX.maxX;

async function fromUtic() {
  const r = await fetch('http://www.utic.go.kr/guide/imsOpenData.do?key=' + UTIC_KEY);
  const xml = await r.text();
  const items = [];
  for (const m of xml.matchAll(/<record>([\s\S]*?)<\/record>/g)) {
    const g = t => { const mm = m[1].match(new RegExp('<' + t + '>([^<]*)</' + t + '>')); return mm ? mm[1].trim() : ''; };
    const x = parseFloat(g('locationDataX')), y = parseFloat(g('locationDataY'));
    if (!inBox(y, x)) continue;
    items.push({
      src: 'UTIC(경찰청)', id: g('incidentId'), title: g('incidentTitle'), addr: g('addressJibun'),
      road: g('roadName'), lat: y, lng: x, start: g('startDate'), end: g('endDate')
    });
  }
  return items;
}

async function fromIts() {
  const u = 'https://openapi.its.go.kr:9443/eventInfo?apiKey=' + ITS_KEY +
    '&type=all&eventType=all&minX=' + BBOX.minX + '&maxX=' + BBOX.maxX +
    '&minY=' + BBOX.minY + '&maxY=' + BBOX.maxY + '&getType=json';
  const d = await (await fetch(u)).json();
  const list = (d.body && d.body.items) || [];
  const fmt = s => s && s.length >= 12 ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8) + ' ' + s.slice(8, 10) + ':' + s.slice(10, 12) : (s || '');
  return list.filter(o => inBox(parseFloat(o.coordY), parseFloat(o.coordX))).map(o => ({
    src: 'ITS(국토부)', id: 'its-' + o.linkId + o.startDate,
    title: '[' + (o.eventDetailType || o.eventType || '돌발') + '] ' + (o.roadName || '') + ' ' + (o.message || ''),
    addr: o.type || '', road: o.roadName || '', lat: parseFloat(o.coordY), lng: parseFloat(o.coordX),
    start: fmt(o.startDate), end: fmt(o.endDate)
  }));
}

module.exports = async (req, res) => {
  try {
    const [a, b] = await Promise.all([fromUtic().catch(() => []), fromIts().catch(() => [])]);
    /* 같은 지점(±150m)·유사 시각 중복 제거 — UTIC 우선 */
    const items = [...a];
    for (const o of b) {
      if (!items.some(p => Math.abs(p.lat - o.lat) < 0.0014 && Math.abs(p.lng - o.lng) < 0.0017)) items.push(o);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');
    res.status(200).json({ count: items.length, items });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
};
