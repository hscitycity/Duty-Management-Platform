#!/usr/bin/env node
/* D-07: BUILD_VER 자동 갱신 — index.html 저장(커밋) 시각을 v월일-시분 형식으로 스탬프.
   수동 갱신 누락으로 구버전 판별이 불가능했던 문제(v0724-1310 정체) 방지.
   사용: node scripts/stamp_ver.mjs   (커밋 훅 .githooks/pre-commit 에서 자동 실행) */
import fs from 'fs';

const FILE = 'index.html';
const p = (n) => String(n).padStart(2, '0');
const d = new Date();
const ver = 'v' + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());

const src = fs.readFileSync(FILE, 'utf8');
const RE = /const BUILD_VER = '(v\d{4}-\d{4})';/;
const m = src.match(RE);
if (!m) {                                   // 앵커 불일치는 조용히 넘기지 않는다
  console.error('[stamp_ver] BUILD_VER 앵커를 찾지 못했습니다 — 스탬프 중단');
  process.exit(1);
}
if (m[1] === ver) {
  console.log('[stamp_ver] 이미 최신 ' + ver);
  process.exit(0);
}
fs.writeFileSync(FILE, src.replace(RE, "const BUILD_VER = '" + ver + "';"));
console.log('[stamp_ver] ' + m[1] + ' → ' + ver);
