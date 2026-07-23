import {readdirSync, readFileSync, existsSync} from 'fs';
import {createHash} from 'crypto';
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
if(!URL || !KEY){ console.error('Secrets 미설정: SUPABASE_URL / SUPABASE_ANON_KEY'); process.exit(1); }
const H = {apikey:KEY, Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json', Prefer:'resolution=ignore-duplicates'};
if(!existsSync('scenarios')){ console.log('scenarios 폴더 없음 — 건너뜀'); process.exit(0); }
let rows = [];
for(const f of readdirSync('scenarios').filter(f=>f.endsWith('.json'))){
  try{
    const arr = JSON.parse(readFileSync('scenarios/'+f, 'utf8'));
    for(const s of (Array.isArray(arr)?arr:arr.scenarios||[])){
      const hash = createHash('md5').update(JSON.stringify(s)).digest('hex');
      rows.push({gap:s.gap?s.gap*60:1800, field:s.field, sub:s.sub, gu:s.gu, emd:s.emd||'', loc:s.loc||'', sum:s.sum, urg:s.urg||'일반', src:s.src||'전화', hash});
    }
  }catch(e){ console.error(f, '파싱 실패:', e.message); }
}
if(!rows.length){ console.log('적재할 시나리오 없음'); process.exit(0); }
const r = await fetch(`${URL}/rest/v1/scenarios?on_conflict=hash`, {method:'POST', headers:H, body:JSON.stringify(rows)});
console.log('적재:', rows.length, '건 → HTTP', r.status);
if(!r.ok){ console.error(await r.text()); process.exit(1); }
