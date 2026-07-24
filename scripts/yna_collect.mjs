// 연합뉴스 재난기사 수집기 — 행안부 재난안전데이터(DSSP-IF-00051) → Supabase yna_news 적재
// ⚠️ safetydata는 등록 IP(110.15.112.0/24)에서만 응답하므로 이 스크립트는 그 회선의 PC에서 실행.
//    실행: node scripts/yna_collect.mjs   (작업 스케줄러로 1시간 주기 등록 권장)
const SD_KEY = '864H2WIQ839ZE63J';
const SB_URL = 'https://olyczpgmvuzvpmaabiow.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9seWN6cGdtdnV6dnBtYWFiaW93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTI3MTQsImV4cCI6MjEwMDM4ODcxNH0.izhokguIH7xXgC8XTweHDkyufWL0ECdTuHbV5zs4hIM';
const ROWS = 100, BACK_PAGES = 6;   // 최신에서 뒤로 6페이지(600건) 훑기

async function page(p){
  const u = `https://www.safetydata.go.kr/V2/api/DSSP-IF-00051?serviceKey=${SD_KEY}&returnType=json&pageNo=${p}&numOfRows=${ROWS}`;
  const d = await (await fetch(u)).json();
  return d;
}
const first = await page(1);
const total = first.totalCount || (first.body ? 99999 : 0);
if(!total){ console.error('연합뉴스 API 응답 이상(등록 IP에서 실행했는지 확인):', JSON.stringify(first.header||first).slice(0,200)); process.exit(1); }
const lastPage = Math.ceil(total / ROWS);
console.log('총', total, '건 · 마지막 페이지', lastPage, '부터 역방향', BACK_PAGES, '페이지 수집');

const picked = [];
for(let p = lastPage; p > Math.max(0, lastPage - BACK_PAGES); p--){
  try{
    const d = await page(p);
    for(const r of (d.body || [])){
      const txt = (r.YNA_TTL || '') + ' ' + (r.YNA_CN || '');
      if(!/화성/.test(txt)) continue;                       // '화성' 관련 기사만
      picked.push({ no: r.YNA_NO, ttl: r.YNA_TTL, cn: (r.YNA_CN || '').slice(0, 2000), ymd: r.YNA_YMD || null, crt: r.CRT_DT || null });
    }
    process.stdout.write('.');
  }catch(e){ console.error('p'+p, e.message); }
}
console.log('\n화성 관련', picked.length, '건');
if(!picked.length) process.exit(0);

const res = await fetch(SB_URL + '/rest/v1/yna_news?on_conflict=no', {
  method: 'POST',
  headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json',
             'Prefer': 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(picked)
});
console.log('Supabase 적재:', res.status, res.ok ? 'OK' : await res.text());
