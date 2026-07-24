// Vercel 서버리스 프록시 — ITS 국가교통정보센터 CCTV (openapi.its.go.kr:9443)
// 공개 CORS 프록시는 :9443 포트를 못 뚫어(52x) 브라우저 직접호출/allorigins가 실패하므로,
// 동일 출처(/api/cctv)로 서버에서 대신 호출해 JSON을 그대로 전달한다.
const UTIC_KEY = 'biLA6uQHddkUF7mIT1YY2DWFnRrRwbbwwCZ3K68A';

module.exports = async (req, res) => {
  const q = req.query || {};
  const type = q.type || 'its';                       // ex=고속도로, its=국도, utic=경찰청 UTIC(시내 교차로)
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (type === 'utic') {
      /* UTIC 전국 CCTV 목록 — Referer 필요, 화성 순수 bbox + 영상제공(MOVIE=Y)만,
         국가교통정보센터 소속은 ITS와 중복이라 제외. 목록은 정적이라 1시간 캐시 */
      const r = await fetch('http://www.utic.go.kr/map/mapcctv.do?key=' + UTIC_KEY, {
        headers: { 'Referer': 'http://www.utic.go.kr/guide/cctvOpenData.do', 'User-Agent': 'Mozilla/5.0' }
      });
      const all = await r.json();
      const data = all.filter(c => c.MOVIE === 'Y'
          && c.YCOORD > 36.98 && c.YCOORD < 37.32 && c.XCOORD > 126.50 && c.XCOORD < 127.135
          && !/국가교통정보센터/.test(c.CENTERNAME || ''))
        .map(c => ({
          cctvname: c.CCTVNAME + ' [' + (c.CENTERNAME || 'UTIC') + ']',
          coordx: c.XCOORD, coordy: c.YCOORD, cctvformat: 'POPUP',
          cctvurl: 'https://www.utic.go.kr/map/mapcctvinfo.do?cctvid=' + encodeURIComponent(c.CCTVID)
        }));
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      res.status(200).json({ response: { data } });
      return;
    }

    const p = new URLSearchParams({
      apiKey: '97854a7d83bb47789b3130a9a243ef93', type: type === 'ex' ? 'ex' : 'its', cctvType: '1',
      minX: q.minX || '126.55', maxX: q.maxX || '127.20',
      minY: q.minY || '37.00',  maxY: q.maxY || '37.35',
      getType: 'json'
    });
    const r = await fetch('https://openapi.its.go.kr:9443/cctvInfo?' + p.toString());
    const text = await r.text();
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
};
