// Vercel 서버리스 프록시 — 경찰청 UTIC 돌발상황(imsOpenData)
// http 전용 + CORS 미지원이라 브라우저에서 직접 못 부름 → 서버에서 XML을 받아
// 화성 광역(인접 시군 포함) bbox로 필터한 JSON을 반환. 60초 CDN 캐시.
const UTIC_KEY = 'biLA6uQHddkUF7mIT1YY2DWFnRrRwbbwwCZ3K68A';
const BBOX = { minY: 36.90, maxY: 37.45, minX: 126.40, maxX: 127.35 };  // 화성+인접(수원·오산·평택·안산권)

module.exports = async (req, res) => {
  try {
    const r = await fetch('http://www.utic.go.kr/guide/imsOpenData.do?key=' + UTIC_KEY);
    const xml = await r.text();
    const items = [];
    for (const m of xml.matchAll(/<record>([\s\S]*?)<\/record>/g)) {
      const g = t => { const mm = m[1].match(new RegExp('<' + t + '>([^<]*)</' + t + '>')); return mm ? mm[1].trim() : ''; };
      const x = parseFloat(g('locationDataX')), y = parseFloat(g('locationDataY'));
      if (!(y > BBOX.minY && y < BBOX.maxY && x > BBOX.minX && x < BBOX.maxX)) continue;
      items.push({
        id: g('incidentId'), title: g('incidentTitle'), addr: g('addressJibun'),
        road: g('roadName'), lat: y, lng: x,
        start: g('startDate'), end: g('endDate'), grade: g('incidenteGradeCd'), type: g('incidenteTypeCd')
      });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');
    res.status(200).json({ count: items.length, items });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
};
