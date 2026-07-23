// scenarios/ 폴더의 JSON 파일들을 Supabase 큐에 적재 (중복은 해시로 방지)
import {readdirSync, readFileSync} from 'fs';
import {createHash} from 'crypto';
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
const H = {apikey:KEY, Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json', Prefer:'resolution=ignore-duplicates'};
let rows = [];
for(const f of readdirSync('scenarios').filter(f=>f.endsWith('.json'))){
  const arr = JSON.parse(readFileSync('scenarios/'+f, 'utf8'));
  for(const s of (Array.isArray(arr)?arr:arr.scenarios||[])){
    const hash = createHash('md5').update(JSON.stringify(s)).digest('hex');
    rows.push({gap:s.gap?s.gap*60:1800, field:s.field, sub:s.sub, gu:s.gu, emd:s.emd||'', loc:s.loc||'', sum:s.sum, urg:s.urg||'일반', src:s.src||'전화', hash});
  }
}
if(rows.length){
  const r = await fetch(`${URL}/rest/v1/scenarios?on_conflict=hash`, {method:'POST', headers:H, body:JSON.stringify(rows)});
  console.log('적재:', rows.length, '건 →', r.status);
}
