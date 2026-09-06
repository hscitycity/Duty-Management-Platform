/* index.html 을 jsdom 으로 실제 부팅해 모드별 런타임 오류를 잡는다.
   외부 라이브러리(Leaflet 등)와 네트워크는 최소 스텁으로 대신한다 — 목표는 우리 코드의 오류 검출. */
import fs from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const mode = process.argv[2] || 'duty';
const html = fs.readFileSync('index.html', 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  url: 'https://example.test/#' + mode,
  virtualConsole: vc,
  pretendToBeVisual: true
});
const { window } = dom;

/* ── 스텁 ── */
const chain = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (k === 'then') return undefined;            // await 대상이 되지 않게
    if (k === Symbol.toPrimitive) return () => 0;
    if (k === 'length') return 0;
    return chain();
  },
  apply: () => chain(),
  construct: () => chain()
});
const Lstub = chain();
window.L = Lstub;
window.JSZip = chain();
window.Hls = chain();
window.QRCode = chain();
window.supabase = { createClient: () => { throw new Error('offline'); } };
window.fetch = () => Promise.reject(new Error('offline'));
window.matchMedia = q => ({ matches: /max-width:\s*700px/.test(q) ? false : false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
if(!window.performance) Object.defineProperty(window,"performance",{value:{now:()=>Date.now()},configurable:true});
try{ window.scrollTo = () => {}; }catch(e){}
window.alert = () => {};
window.prompt = () => null;
window.confirm = () => true;
window.URL.createObjectURL = () => 'blob:stub';
window.URL.revokeObjectURL = () => {};
window.navigator.geolocation = { getCurrentPosition(){}, watchPosition(){} };
window.onerror = (msg, src, line, col) => { errors.push('window.onerror: ' + msg + ' @' + line + ':' + col); };
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  const m = (r && r.message) || String(r);
  if (/offline/.test(m)) return;                   // 스텁이 만든 네트워크 실패는 무시
  errors.push('unhandledrejection: ' + m);
});

/* ── 실행 ── */
const scripts = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html))) scripts.push(m[1]);

for (const [i, code] of scripts.entries()) {
  try { window.eval(code); }
  catch (e) { errors.push('스크립트 블록 ' + i + ' 실행 오류: ' + e.message + (e.stack ? '\n   ' + e.stack.split('\n')[1] : '')); }
}

await new Promise(r => setTimeout(r, 400));

/* ── 모드 전환도 밟아 본다 ── */
if (window.setMode) {
  for (const m2 of ['duty', 'dash', 'cit', 'track', 'road', 'cmd']) {
    if (m2 === mode) continue;
    try { window.setMode(m2); } catch (e) { errors.push('setMode(' + m2 + ') 오류: ' + e.message); }
  }
}
await new Promise(r => setTimeout(r, 300));

const real = errors.filter(e => !/offline|Not implemented|Could not parse CSS|getContext/i.test(e));
console.log('▶ 모드 ' + mode + ' — 오류 ' + real.length + '건');
for (const e of real.slice(0, 14)) console.log('   ' + e);
process.exit(real.length ? 1 : 0);
