// Vercel 서버리스 프록시 — 네이버 검색 API (뉴스/블로그, CORS 미지원이라 서버 경유)
const CID = 'oF1CxzA1JY6oOmOAoOZT';
const CSEC = 'M79X39xyiN';

module.exports = async (req, res) => {
  const q = ((req.query && req.query.q) || '화성시').slice(0, 40);
  const kind = (req.query && req.query.kind) === 'blog' ? 'blog' : 'news';
  try {
    const r = await fetch('https://openapi.naver.com/v1/search/' + kind + '.json?query=' + encodeURIComponent(q) + '&display=12&sort=date', {
      headers: { 'X-Naver-Client-Id': CID, 'X-Naver-Client-Secret': CSEC }
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
};
