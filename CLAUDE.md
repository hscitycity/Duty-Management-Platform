# CLAUDE.md — 화성특례시 당직 업무 플랫폼 (AI공모전) · v3
> 2026-07-25, GitHub 저장소 전수 + Supabase 인트로스펙션 + 배포본 3원 분석 기반 재작성.
> **이 파일 하나가 전체 맥락의 유일한 인수인계본이다. 수정 전 반드시 전체 숙지.**

## 0. 주소·계정
| 항목 | 값 |
|---|---|
| GitHub | https://github.com/hscitycity/Duty-Management-Platform (main = 배포 브랜치) |
| 배포 | https://duty-management-platform.vercel.app (Vercel 서울 리전 icn1 고정 — vercel.json) |
| Supabase | https://olyczpgmvuzvpmaabiow.supabase.co — anon key는 index.html `SB_KEY` |
| Actions Secrets | SUPABASE_URL / SUPABASE_ANON_KEY 등록됨 |

새 PC 시작: `git clone <repo> && cd Duty-Management-Platform && claude`
배포 루프: index.html 수정 → 검증(§7) → **BUILD_VER 갱신** → push(main) → Vercel 자동 재배포(~1분) → 헤더 스탬프 확인.

## 1. 개요·운영 현황
- 화성특례시 당직 2원 체계(5층 재난안전상황실+1층 당직실) 통합 상황판. "사람이 받고, AI가 쓰고, 시스템이 처리한다."
- **실운영 중**: pg_cron 5분 자동유입 전 회차 성공, complaints 누적 431건+(07-25 기준), 시나리오 46종 무작위·소진 시 재순환. Realtime + 20초 폴링 이중화.
- 출품 서류: `공모전_출품작_설명서.md` 작성 완료(개요/배경/기능/URL/효과, 명사형 종결).

## 2. 최근 변경 요약 (07-24 PC 세션, 커밋 25건 — 웹 대화 v0723 대비 diff)
### 아키텍처 진화
| 항목 | 이전 | 현재 |
|---|---|---|
| CORS 우회 | allorigins 공개 프록시 | **자체 Vercel 서버리스 5종(api/)** — 범용 proxy.js + 전용 4종 |
| 지적 전역 | VWorld WMS(3변형 폴백) | **자체 벡터타일**(tiles/, 51만 필지, pbf 2,304개·119MB, Leaflet.VectorGrid) + 지번 라벨 타일 |
| 건축물대장 | 건축HUB API 단독 | API + **로컬 원본DB 폴백**(bldg_db/ 동리별 JSON 36MB) + 건축HUB 3종 확장 |
| 배포 | 기본 리전 | 서울 리전 고정, API 응답 CDN 캐시("저장-후-표출" 원칙 전면화) |
### 신규 기능
- 레이어: CCTV(ITS 국도/고속+UTIC 경찰청 병합, hls.js 인라인 영상), 교통 돌발상황, 💊 공공심야약국(경기81·화성8 강조), 생활안전지도 5종(물놀이·공사현장·비상벨·응급의료·CPTED), 어린이 안전시설(정적 data/), 지번 자동표시
- UX: ✋탐색 모드(접수 클릭과 분리), 🧭 당직자 조치 안내 팝업, 레이어 바 5개/줄 그리드+설명 토글, 전체화면, 민원 선택 포커스(디밍)·재클릭 해제, 레이어 상시 정보 라벨
- 상황판: 당직 편성 시간대 자동 전환+편성표 토글, 실시간 이슈(네이버 뉴스 100건 스크롤), 대시보드 그래프 개선, PM10 연동
### 수리
- **outOfCity 미정의 복구 — 모바일 지도클릭 전면 불능 버그의 진범이었음(해결)**, Supabase 연동 복구, '미확인' 스탯 제거, base 타일 VWorld 전환

## 3. Supabase 실태 (인트로스펙션 확정, 07-25)
- 테이블 3개: complaints(17컬럼)·scenarios·emd_cent — **PC 작업으로 인한 DB 스키마 변경 없음**
- cron: `hs-inflow` `*/5 * * * *` active, 최근 실행 전부 succeeded. 함수 `inflow_once()` 설계 원본 그대로
- RLS anon-all 2건, Realtime publication=complaints, 확장: pg_cron 등 정상
- `yna_news` 테이블 생성 완료(07-25) — 수집기 가동은 §8-1

## 4. 저장소 구조
```
index.html            # 앱 전체(5.4MB 단일 파일) — 유일한 소스 오브 트루스. BUILD_VER 상수(현재 v0724-1310)
api/                  # Vercel 서버리스 프록시층
  proxy.js            #  범용 CORS 프록시(화이트리스트: apis.data.go.kr, api.vworld.kr 등)
  cctv.js             #  ITS(국도/고속 ex)+UTIC CCTV, 화성 bbox 필터, 1h 캐시 [UTIC_KEY 내장]
  utic.js             #  교통 돌발 UTIC(XML http전용)+ITS 병합, 60s 캐시 [UTIC_KEY, ITS_KEY]
  naver.js            #  네이버 뉴스/블로그 검색 100건 [CID/CSEC 내장]
  safety.js           #  행안부 재난안전데이터 시설(어린이 등) 다페이지 수집+bbox, 1일 캐시 [SD_KEY]
tiles/jijeok/, jjlbl/ # 지적 벡터타일(필지+지번라벨) — 재생성 스크립트 없이 수정 금지
bldg_db/{dj,ph}/      # 건축물대장 원본 동리별 JSON — API 실패 시 로컬 폴백
data/safety_children.json
scenarios/*.json      # Cowork 시나리오 투입구 → seed.yml → scenarios 테이블
scripts/              # inflow.mjs(백업) · seed_scenarios.mjs · yna_collect.mjs(연합뉴스 §6-4)
.github/workflows/    # seed.yml(scenarios 푸시 시 적재) · inflow.yml(백업 유입+Supabase keep-alive)
supabase_schema.sql   # DB 적용 완료
연합뉴스_테이블.sql    # DB 적용 완료(07-25)
vercel.json           # {"regions":["icn1"]}
```

## 5. index.html 내부 지도 (함수 191개 — 주요 앵커)
| 구획 | 앵커 |
|---|---|
| 버전·진단 | `BUILD_VER`(수정마다 갱신 필수) / `window.onerror` 빨간 오류 배너 |
| Supabase | `sbInit / sbPush / sbMerge / sbPoll`(20s 폴링 백업) / 채널 'rt-complaints' |
| 지도 | `initMap / setBase / toggleSat(항공) / toggleNight(야간, 21~02시 자동)` — 배경 전부 VWorld WMTS |
| 접수·처리 | `mapPlace / setStatus(완료→대시보드 이관+인력0 가드) / dispatchCrew / smsSend(수신번호 자동) / notifyNew(대형 팝업) / outOfCity(경계 차단+읍면동 2.5km 허용)` |
| AI | `aiStructure(접수) / parseJournal(재난일지)` + 규칙기반 폴백 — api.anthropic.com, claude-sonnet-4-6 |
| HWPX | `TPL_DAILY/TPL_FORM(base64) / dlDaily / formChooser / dlShift / buildHwpxMulti`(일직 09-18/숙직 분류, 1건=1페이지) |
| 매뉴얼 | `MANUAL(123청크) / openManual / manSearch / manFmt`(번호배지·전화칩·주의박스) |
| 지적 | 벡터타일 렌더(VectorGrid)+지번 라벨+토지정보 로컬조회 / `jjQuery`(팝업에 접수 버튼) |
| 건물 | `BLDGF(표본)` + bldg_db 폴백 / `pnuToJ`(PNU 19자리→건축HUB 3종 직결) |
| 신규 레이어 | `toggleCctv / togglePharm / toggleSafe*` / 돌발 / 어린이시설 |
| UX | ✋탐색 모드 / 🧭 조치 안내 팝업 / 레이어 그리드·설명 토글 / 전체화면 / 선택 포커스·해제 / 실시간 이슈 |
| 시민창구 | `citPick(드래그 핀) / citMyLoc(GPS→줌17) / pickJusoCit(좌표 실패 시 관할중심 폴백)` |
| 대시보드 | `renderDash / dashClick(차트 클릭 필터) / initDashMap / HIST(시드 18건)` |
- 라이브러리: Leaflet + leaflet.vectorgrid@1.3.0 + hls.js@1 + supabase-js@2 + JSZip

## 6. 외부 연동·데이터 흐름
### 연동 전체(키는 코드 내 실키)
공공데이터포털 `KMA_KEY`(기상·특보/에어코리아/병원/건축HUB/RWIS) · VWorld `VWORLD_KEY`(WMTS 3종·getcoord·getAddress) · juso 검색키(**90일, 07-24 발급 → 10월 하순 만료**) · `ITS_KEY` · `UTIC_KEY` · 네이버 `CID/CSEC` · 행안부 `SD_KEY` 2종(safety.js / yna_collect.mjs) · 심평원(승인 대기) · Windy 임베드 · OSRM · Open-Meteo · safemap WMS · 화성시 포털(tour/reserve/botanic) 크롤링
**CORS 원칙**: 자체 `/api/proxy?url=` 우선(화이트리스트 확장으로 대응), allorigins는 잔존 예비.
### 데이터 흐름
1. 유입: pg_cron `inflow_once()` 5분(좌표=읍면동 중심±난수, 매회 신규) / 시민창구 / AI 서기 / Actions(백업)
2. 표시: sbInit 전체 로드 → Realtime+폴링 → sbMerge 병합 → 신규 🚨 팝업. **완료=어느 경로든 상황판 제거+대시보드 이관(renderMap·List·Dash 3렌더 세트)**
3. Cowork: JSON `{gap,field,sub,gu,emd,loc,sum,urg,src}` 배열(field/sub는 FIELDS 조합만) → scenarios/ 커밋 → seed → DB → cron 소비
4. 연합뉴스: 행안부 DSSP-IF-00051은 **등록 IP(110.15.112.0/24 사무실 회선) 전용** — 그 PC에서 `node scripts/yna_collect.mjs`(작업 스케줄러 1h 권장) → yna_news 적재 → 플랫폼 표출
5. 오프라인: DB 실패 시 localStorage 폴백(경고 토스트 필수)

## 7. 수정 규칙 (실사고 이력 기반 — 어기면 재발)
1. 치환 전 앵커 grep 실존 확인(앵커 불일치로 조용한 누락 사고 2회)
2. **빈 문자열 치환 금지**(295MB 파손 전례) — 슬라이스 교체는 start<end 확인
3. 커밋 전 3종: JS 문법 체크 · index.html 4~9MB 범위 · 핵심 앵커(sbInit,dlDaily,openManual,citPick) 존재
4. 실패는 assert로 시끄럽게, 조용한 실패 금지
5. **BUILD_VER 갱신 의무**(현재 v0724-1310 — 마지막 PC 커밋들에서 갱신 누락됐음)
6. hwpx 치환 키 ↔ 생성 코드 1:1 대조(누락/잉여 0)
7. 5MB 파일 통짜 재작성 금지 — 국소 치환만
8. api/ 수정 시 캐시 헤더·화성 bbox 필터·화이트리스트 유지
9. tiles/·bldg_db/ 대용량 산출물은 재생성 수단 없이 수정 금지

## 8. 미해결·후속 (우선순위)
1. **연합뉴스 수집기 가동** — 테이블은 생성 완료(07-25). 남은 것: 사무실 PC(등록 IP 회선)에서 `node scripts/yna_collect.mjs` 실행·적재 확인 → 작업 스케줄러 1시간 주기 등록
2. 심평원 약국 API 승인 확인(승인 시 일반약국 레이어 자동 활성 설계)
3. CLAUDE.md(본 문서)·공모전_출품작_설명서.md 저장소 루트 커밋 유지
4. 한글(HWP)에서 일일보고 표·다페이지 접수서 실물 최종 확인
5. juso 개발키 만료(10월 하순) 추적
6. 모바일 시민창구 — outOfCity 수리로 해결 추정, 실기기 재검증 1회

## 9. 로드맵(문서화만, 구현 금지)
알림톡 발송 · 통화 STT · Windy Map Forecast API 자체 관제지도(민원 핀 중첩) · RWIS 동절기 · 매뉴얼 hwpx 자동 재색인 · E-Gen 응급 · VWorld 운영키 전환 · 행정망 DB 이관

## 10. 사용자 소통 스타일
한국어. 실무 공무원식 짧은 지시 → 당직 실무 맥락으로 해석해 구현. 응답은 "무엇이 왜 바뀌었나 + 확인 방법 + 배포 안내(BUILD_VER 확인)". 문서 문체는 명사형 종결. 공모전 심사 어필 포인트 곁들이면 좋아함.

## 11. 개편 작업 (2026-09 착수)
- 작업 지시서: 루트 `ClaudeCode_작업지시서.md` — 4단계 순서·사양·검증·금지사항. **작업 전 반드시 읽을 것.**
- 설계 자료: `docs/` — 시안 4종(개선통합시안 등), 기준 2종(치수체계·설계인스펙터), 현황 2종, `docs/규정자료/`(조례·위임규칙 원문 + 부서배정_근거데이터.json)
- 복구 지점: 태그 `v1-before-redesign` (개편 착수 전 안정 버전)
- **작업 브랜치 `redesign`에서만 수정한다. `main`은 배포 중이므로 직접 수정 금지.**
- 되돌리기: `git checkout v1-before-redesign -- index.html` 또는 Vercel Deployments에서 이전 배포를 Promote to Production

## 12. 개편 진행 상황 (redesign 브랜치, 2026-09-06)
지시서 4단계 + 부수작업 전 항목 구현 완료. `main` 미병합 — 프리뷰 배포로 검증 중.

| 단계 | 항목 | 결과 |
|---|---|---|
| 1 | D-01 D-03 D-07 D-04 | index.html 5.36MB→0.86MB · 스플래시 · BUILD_VER 자동 스탬프 · Ctrl+Shift+D 시연 |
| 2 | S-02 S-03 D-02 D-08 | 지도 우선 신고 흐름 · 처리 현황 추적(#track) · 코드 분리(348KB) · 폰 하단 시트 |
| 3 | S-06 S-12 S-11(D-09) | 2층 부서배정 · 신속기동단 작업판(#road) · 소속 범위 분리·CSV |
| 4 | S-07 S-08 S-09 S-10 S-04 | 조치지시(#cmd) · 탐지 규칙 · 보류·재상신 · 결과보고 · 중장기 공개 |
| 부수 | D-05 D-06 D-10 S-05 | 지연 로딩 · 핀 묶음 · 처리시간·상습지점 · 치수 정비 |
| 추가 | D-M1 | 상황판 지도 높이·전체화면 토글(Windy 동반 확대) |

### 구조 변화
- 화면 6종을 주소로 분기: `#duty` `#dash` `#cit` `#track` `#road` `#cmd` (QR은 `#cit`)
- 분리 자산: `data/manual.json` `data/tpl_*.b64` `data/dept_assign.json` `data/*_sample.json` `data/icons/*.png`
  — 매뉴얼·서식·근거데이터는 **당직 경로에서만** fetch(시민 브라우저 미전송)
- 새 상태는 DB 스키마를 건드리지 않고 처리(`localStorage` + `complaints.log` 태그)
  · 시연 표식 `[시연]` · 처리 주체 변경 · 중장기 단계 · 조치지시/보류/결과보고
- 커밋 훅: `.githooks/pre-commit` → `scripts/stamp_ver.mjs`.
  **새 PC에서는 `git config core.hooksPath .githooks` 1회 실행 필요**
### 남은 확인
- 실기기 검증(1920×1080·폰) 미실시 — 정적 검증(문법·크기·앵커·참조)만 통과
- 미입수 입력값: 마을도로 shp(`ROAD_PAT`로 잠정) · 소규모 보수 기준(`SMALL_REPAIR`, ⚙️에서 조정)
  · 처리구분 분류표(`TRIAGE_TABLE`로 잠정)
- 조례 별표 8 발췌본에 '도로 유지·보수', '하수', '가로수' 조문이 없어 해당 건은 조문 인용 대신
  "조례 별표 8 · OO과 분장사무"로 표기 — 전문 입수 시 인용 정확도 상승

---

## 13. 새 PC 에서 이어 가기 (2026-09-07 기준)

```bash
git clone https://github.com/hscitycity/Duty-Management-Platform
cd Duty-Management-Platform
git checkout redesign          # 개편은 이 가지에서만. main 은 배포 중이라 직접 수정 금지
git config core.hooksPath .githooks   # BUILD_VER 자동 스탬프 (1회)
npm i                          # 검증 도구(jsdom) — 앱 자체는 의존성 없음
npm run verify                 # 문법·크기·앵커·항목번호·8개 화면 부팅
claude
```

### 13.1 반드시 먼저 읽을 것
| 파일 | 무엇 |
|---|---|
| `CLAUDE.md` (이 파일) | 전체 맥락 |
| `ClaudeCode_작업지시서.md` | 개편 4단계 지시·금지사항 |
| `docs/상황판_사양서.md` | **화면과 규칙의 근거** — 실사고 기록 포함(3.10~3.16) |
| `docs/기동단_사양서.md` | `#road` 화면 |
| `docs/항목번호.md` | 화면 요소 150개 — 코드와 1:1. 어긋나면 커밋 전에 맞춘다 |

### 13.2 작업 규칙 (지금까지 지켜 온 것)
1. **작업 가지는 `redesign`.** `main` 직접 수정 금지.
2. **화면 구조나 규칙이 바뀌면 `docs/` 사양서도 같이 고친다.** 안 고쳤으면 완료가 아니다.
3. **작업이 끝날 때마다 `docs/항목번호.md` 를 최신화한다.** 문서↔코드 개수가 맞아야 한다.
4. 5MB 파일 통짜 재작성 금지 — 국소 치환만. **빈 문자열 치환 절대 금지.**
5. 치환 전 앵커를 grep 으로 실존 확인. 실패는 assert 로 시끄럽게.
6. 커밋 전 `npm run verify` — 전부 통과해야 한다.

### 13.3 DB — 적용해야 할 것
- **`추가테이블.sql` 을 Supabase SQL Editor 에서 1회 실행.** (여러 번 실행해도 안전)
  `orders`(조치지시) · `order_holds` · `field_reports` · `rules`/`rule_history` · `journals`
  + `complaints` 칸 보강(처리부서 지정·재지정 요청·중장기 단계·종결 시각·용역업체 사진).
  적용 전에도 앱은 돈다(없는 칸은 빼고 저장, 없는 표는 기기 사본) — **적용해야 부서 간 전달이 산다.**
- 옛 파일 `사진_출처구분.sql` 은 위 파일에 흡수됐다.

### 13.4 지금 상태 (redesign)
- `index.html` 0.87MB · 항목번호 150개 · 8개 화면 부팅 오류 0
- 화면: `#duty #info #dash #cit #track #road #cmd #done`
- 이번 세션에서 더한 것 —
  종결처리 네 갈래 · 유사제보 일괄회신 · 기동단 완료민원 · 공통 쪽 넘김(`.pgn`) ·
  조치지시(원형 경계 · 시장 의견 이력 · 처리현황 · 확인 종결 · 처리완료건 · **부서 창구 I-8**) ·
  **권한 체계**(민원배부 부서 · 처리부서 지정 · 부서 재지정 요청 · 화면별 문) · 부서 간 전달 표 6개
- 고친 중대 하자 —
  ① 완료 민원이 폴링에 되살아나던 것(3.10) ② 부서 검색 한글 조합 깨짐(3.11)
  ③ 없는 칸 때문에 저장 전체가 실패하던 것(3.13) ④ 접수번호 재배정 시 지시-민원 끈이 끊기던 것(3.14)

### 13.5 아직 안 한 것
- **실기기 확인** — jsdom 은 레이아웃을 계산하지 않는다. 겹침·줄바꿈·색 대비는 브라우저에서 봐야 한다.
- `redesign` → `main` 병합(배포). 프리뷰로 충분히 본 뒤에 한다.
- 부서 계정 기반 RLS(지금은 anon 전면 허용) — 행정망 이관 시.
- 조치지시 부서 알림은 화면 배지까지다. 알림톡·문자 발송은 로드맵.
