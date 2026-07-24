// Vercel 서버리스 프록시 — 행안부 건축물기본정보(재난안전데이터공유플랫폼 DSSP-IF-10662)
// CORS 미지원 + 지역 필터 없음 → 서버에서 여러 페이지 수집 후 화성 bbox 필터, 1일 CDN 캐시로
// 일일 호출량(100~1000)을 보호한다. 사용: /api/safety?q=어린이
const SD_KEY = 'Q2XPL0647GZ6C2BZ';
const BBOX = { minY: 36.95, maxY: 37.42, minX: 126.45, maxX: 127.32 };  // 화성 근방
const PAGES = 4, ROWS = 500;

module.exports = async (req, res) => {
  const q = ((req.query && req.query.q) || '어린이').slice(0, 30);
  try {
    const reqs = [];
    for (let p = 1; p <= PAGES; p++) {
      const u = 'https://www.safetydata.go.kr/V2/api/DSSP-IF-10662?serviceKey=' + SD_KEY +
        '&returnType=json&pageNo=' + p + '&numOfRows=' + ROWS + '&fclts_nm=' + encodeURIComponent(q);
      reqs.push(fetch(u).then(r => r.json()).catch(() => null));
    }
    const pages = await Promise.all(reqs);
    const items = [];
    let total = 0;
    for (const d of pages) {
      const b = d && d.response && d.response.body;
      if (!b) continue;
      total = b.totalCount || total;
      for (const x of (b.item || [])) {
        const la = parseFloat(x.latitude), lo = parseFloat(x.longitude);
        if (!(la > BBOX.minY && la < BBOX.maxY && lo > BBOX.minX && lo < BBOX.maxX)) continue;
        items.push({ seCd: x.seCd, fcltyNm: x.fcltyNm, lnmadr: x.lnmadr, latitude: la, longitude: lo });
      }
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
    res.status(200).json({ q, scanned: PAGES * ROWS, totalNationwide: total, count: items.length, items });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
};
