// 시나리오 큐에서 1건 꺼내 민원으로 접수 (PC 꺼져 있어도 GitHub이 실행)
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
const H = {apikey:KEY, Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json'};
const CENT = {"향남":[37.133,126.923],"봉담":[37.217,126.951],"병점":[37.207,127.033],"동탄":[37.201,127.096],
 "남양":[37.213,126.822],"우정":[37.083,126.815],"팔탄":[37.180,126.888],"마도":[37.190,126.750],
 "정남":[37.157,126.972],"매송":[37.259,126.918],"송산":[37.212,126.727],"서신":[37.163,126.678],"장안":[37.075,126.855]};
const now = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Seoul'}));
const hm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');

const q = await fetch(`${URL}/rest/v1/scenarios?used=eq.false&order=id&limit=1`, {headers:H}).then(r=>r.json());
if(!Array.isArray(q) || !q.length){ console.log('큐 비어있음 — Cowork 시나리오를 채워주세요'); process.exit(0); }
const s = q[0];
const c = CENT[Object.keys(CENT).find(k=>(s.emd||'').includes(k))] || [37.19,126.92];
const lat = c[0]+(Math.random()-0.5)*0.02, lng = c[1]+(Math.random()-0.5)*0.02;
const row = {time:hm, gu:s.gu||'미상', loc:s.loc||((s.gu||'')+' '+(s.emd||'관내')+' 일원'),
  field:s.field, sub:s.sub, sum:s.sum, req:'현장 확인 및 조치 요청', urg:s.urg||'일반',
  st:'신규접수', src:s.src||'전화', lat, lng,
  log:[hm+' '+((s.src==='시민접수')?'24시간 민원접수창구 등록':'전화 접수(AI 서기)')+' [자동유입]']};
const ins = await fetch(`${URL}/rest/v1/complaints`, {method:'POST', headers:H, body:JSON.stringify(row)});
console.log('접수:', ins.status, s.field, s.sub, s.gu);
await fetch(`${URL}/rest/v1/scenarios?id=eq.${s.id}`, {method:'PATCH', headers:H, body:JSON.stringify({used:true})});
