/* 모든 화면을 실제로 부팅해 런타임 오류를 잡는다.
   새 PC: npm i  →  npm run verify
   화면은 jsdom 이 그리므로 레이아웃(겹침·줄바꿈)은 잡지 못한다 — 그건 브라우저에서 본다. */
import { execFileSync } from 'child_process';
import fs from 'fs';

const MODES = ['duty', 'info', 'dash', 'cit', 'track', 'road', 'cmd', 'done'];
let bad = 0;

/* 1. 문법 — 스크립트 블록을 통째로 검사한다 */
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
blocks.forEach((code, i) => {
  fs.writeFileSync('.verify_tmp.cjs', code);
  try { execFileSync(process.execPath, ['--check', '.verify_tmp.cjs'], { stdio: 'pipe' }); }
  catch (e) { bad++; console.log('  [ ] 문법 블록 ' + i + ' — ' + String(e.stderr || e).split('\n')[2]); }
});
fs.rmSync('.verify_tmp.cjs', { force: true });
if (!bad) console.log('  [x] 문법 — 스크립트 블록 ' + blocks.length + '개 통과');

/* 2. 크기 — 통짜 재작성 사고를 잡는 최소 방어선 */
const mb = fs.statSync('index.html').size / 1048576;
if (mb < 0.4 || mb > 9) { bad++; console.log('  [ ] 크기 ' + mb.toFixed(2) + 'MB — 범위 밖'); }
else console.log('  [x] 크기 ' + mb.toFixed(2) + 'MB');

/* 3. 핵심 앵커 */
const ANCHORS = ['sbInit', 'dlDaily', 'openManual', 'citPick', 'renderCmd', 'renderRoad', 'pager'];
const miss = ANCHORS.filter(a => html.indexOf('function ' + a) < 0);
if (miss.length) { bad++; console.log('  [ ] 앵커 없음: ' + miss.join(', ')); }
else console.log('  [x] 핵심 앵커 ' + ANCHORS.length + '개');

/* 4. 항목번호 — 문서와 코드가 어긋나면 안 된다 */
try {
  const doc = fs.readFileSync('docs/항목번호.md', 'utf8');
  const inCode = new Set([...html.matchAll(/["'`]([A-I]-[0-9][0-9a-z]*)["'`]/g)].map(m => m[1]));
  const inDoc = new Set([...doc.matchAll(/\|\s*\*\*([A-I]-[0-9][0-9a-z]*)\*\*/g)].map(m => m[1]));
  const gap = [...inDoc].filter(x => !inCode.has(x)).concat([...inCode].filter(x => !inDoc.has(x)));
  if (gap.length) { bad++; console.log('  [ ] 항목번호 어긋남: ' + gap.join(' ')); }
  else console.log('  [x] 항목번호 문서 ' + inDoc.size + ' ↔ 코드 ' + inCode.size);
} catch (e) { console.log('  [-] 항목번호 문서를 읽지 못함'); }

/* 5. 화면별 부팅 */
for (const m of MODES) {
  const out = execFileSync(process.execPath, ['scripts/verify/smoke.mjs', m], { encoding: 'utf8' });
  const line = out.trim().split('\n').pop();
  if (line.indexOf('오류 0건') < 0) { bad++; console.log('  [ ] ' + line); }
  else console.log('  [x] ' + line);
}
console.log('\n' + (bad ? '실패 ' + bad + '건' : '전부 통과'));
process.exit(bad ? 1 : 0);
