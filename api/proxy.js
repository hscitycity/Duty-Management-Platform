// Vercel 서버리스 범용 프록시 — 공공 API CORS 우회 (allorigins 등 외부 프록시 불안정 대체)
// 화이트리스트 도메인만 통과. 사용: /api/proxy?url=<encodeURIComponent(원본URL)>
const ALLOW = [
  'apis.data.go.kr',
  'api.vworld.kr',
  'www.safetydata.go.kr',
  'www.safemap.go.kr',
  'safemap.go.kr',
  'www.utic.go.kr',
  'openapi.its.go.kr',
  'api.allorigins.win',
  'tour.hscity.go.kr'
];

module.exports = async (req, res) => {
  const raw = (req.query && req.query.url) || '';
  let u;
  try { u = new URL(raw); } catch (e) { res.status(400).json({ error: 'bad url' }); return; }
  if (!ALLOW.includes(u.hostname)) { res.status(403).json({ error: 'host not allowed: ' + u.hostname }); return; }
  try {
    const r = await fetch(u.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': u.origin, 'Accept': '*/*' }
    });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    res.status(r.status).send(buf);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
};
