// Vercel 서버리스 프록시 — ITS 국가교통정보센터 CCTV (openapi.its.go.kr:9443)
// 공개 CORS 프록시는 :9443 포트를 못 뚫어(52x) 브라우저 직접호출/allorigins가 실패하므로,
// 동일 출처(/api/cctv)로 서버에서 대신 호출해 JSON을 그대로 전달한다.
module.exports = async (req, res) => {
  const q = req.query || {};
  const type = q.type === 'ex' ? 'ex' : 'its';        // ex=고속도로, its=국도
  const key = '97854a7d83bb47789b3130a9a243ef93';
  const p = new URLSearchParams({
    apiKey: key, type, cctvType: '1',
    minX: q.minX || '126.55', maxX: q.maxX || '127.20',
    minY: q.minY || '37.00',  maxY: q.maxY || '37.35',
    getType: 'json'
  });
  try {
    const r = await fetch('https://openapi.its.go.kr:9443/cctvInfo?' + p.toString());
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
};
