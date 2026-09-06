-- ══════════════════════════════════════════════════════════════
--  화성특례시 당직 업무 플랫폼 — 부서 간 전달을 위한 추가 스키마
--  적용: Supabase SQL Editor 에 통째로 붙여 실행 (여러 번 실행해도 안전)
--
--  왜 필요한가
--   지금까지 조치지시·현장 결과보고·처리부서 지정은 브라우저 저장소에만 남았다.
--   시장 PC 에서 내린 지시가 부서 PC 에 닿지 않는다. 한 대에서만 도는 시연이었다.
--   아래를 적용하면 같은 건을 여러 자리에서 함께 본다.
--
--  안전 원칙
--   앱은 서버에 없는 칸을 만나면 그 칸만 빼고 저장한다(3.13).
--   그러므로 이 파일을 적용하기 전에도 앱은 그대로 돌아가고,
--   적용한 뒤부터 부서 간 전달이 살아난다.
-- ══════════════════════════════════════════════════════════════

-- ── 1. complaints 보강 ────────────────────────────────────────
--    한 민원에 딸린 값은 새 표로 흩지 않고 그 민원 줄에 둔다.
alter table public.complaints
  -- 용역업체 사진(사진_출처구분.sql 미적용분 포함)
  add column if not exists photo_vendor_before text,
  add column if not exists photo_vendor_after  text,
  -- 처리부서 지정 결과 (C-6b) — 주관 1곳 + 협조 여러 곳
  add column if not exists assigned_dept  text,
  add column if not exists assigned_co    text[],
  add column if not exists assigned_basis text,
  -- 부서 재지정 요청 (C-6c)
  add column if not exists reassign_by  text,
  add column if not exists reassign_at  timestamptz,
  add column if not exists reassign_why text,
  add column if not exists reassign_to  text,
  -- 중장기 진행 단계 (S-04) · 종결 시각 (B-11b 평균 종결 계산)
  add column if not exists long_stage int,
  add column if not exists done_at    timestamptz;

comment on column public.complaints.assigned_dept  is '처리부서 지정 — 주관 부서';
comment on column public.complaints.assigned_co    is '처리부서 지정 — 협조 부서';
comment on column public.complaints.reassign_by    is '부서 재지정을 요청한 부서';
comment on column public.complaints.long_stage     is '중장기 진행 단계 0~4';
comment on column public.complaints.done_at        is '종결 시각 — 접수→종결 소요 계산';

create index if not exists complaints_reassign_idx on public.complaints (reassign_at)
  where reassign_at is not null;

-- ── 2. orders — 시장 조치지시 (I-4 ~ I-8) ─────────────────────
--    지시는 민원 한 건이 아니라 '지역에 몰린 여러 건'에 내린다. 그래서 별도 표다.
create table if not exists public.orders (
  id          text primary key,              -- 앱이 만드는 O<timestamp>
  at          timestamptz not null default now(),
  hm          text,                          -- 하달 시각 표시용 HH:MM
  type        text,                          -- 긴급대응 / 예방점검 …
  emd         text,                          -- 이상징후 지역
  cnt         int,                            -- 근거 민원 수
  mult        numeric,                        -- 평소 대비 배수
  total       int,                            -- 투입 총원
  depts       jsonb not null default '{}'::jsonb,  -- {부서: 인원}
  ack         jsonb not null default '{}'::jsonb,  -- {부서: 수신확인 HH:MM | null}
  reports     jsonb not null default '{}'::jsonb,  -- {부서: {hm, memo}} 처리완료 의견
  memo        text,                           -- 시장 지시 의견
  notes       jsonb not null default '[]'::jsonb,  -- 추가 지시 이력 [{hm, who, memo}]
  ids         int[]  not null default '{}',   -- 근거 민원 접수번호
  retry       int    not null default 0,      -- 미수신 자동 재통보 횟수
  closed_at   timestamptz,                    -- 시장 확인 종결
  closed_hm   text,
  miss_at_close text[],                       -- 종결 시점의 미제출 부서
  updated_at  timestamptz not null default now()
);
create index if not exists orders_open_idx on public.orders (at desc) where closed_at is null;

comment on table  public.orders        is '시장 조치지시 — 하달·수신확인·부서 의견·종결 확인';
comment on column public.orders.reports is '부서별 처리완료 의견 {부서: {hm, memo}}';
comment on column public.orders.notes   is '시장 지시 의견 이력 [{hm, who, memo}]';

-- ── 3. order_holds — 조치지시 보류·재상신 (S-09) ──────────────
create table if not exists public.order_holds (
  key       text primary key,                 -- 급증 키(지역|유형)
  at        timestamptz not null default now(),
  hm        text,
  emd       text,
  why       text,                             -- 보류 사유
  until     timestamptz,                      -- 재검토 시점
  by        text,
  closed    boolean not null default false,
  closed_at timestamptz,
  close_why text
);
comment on table public.order_holds is '조치지시 보류 — 사유·재검토 시점·재상신 이력';

-- ── 4. field_reports — 현장 결과보고 (C-4d) ───────────────────
--    사진 URL 은 complaints 에도 있지만, 누가 언제 어디서 올렸는지는 보고서 단위로 남는다.
create table if not exists public.field_reports (
  id         bigserial primary key,
  cid        bigint not null references public.complaints(id) on delete cascade,
  at         timestamptz not null default now(),
  hm         text,
  org        text,                            -- 보고한 부서
  result     text,                            -- 조치 완료 / 처리 중 / 타 기관 이관 필요 / 현장 이상 없음
  memo       text,
  pub        boolean not null default true,   -- 사진 시민 공개 여부
  before_url text,
  after_url  text,
  before_at  timestamptz,
  after_at   timestamptz,
  gps        double precision[],              -- [lat, lng] 촬영 위치
  arrive     text,                            -- 현장 도착 시각 HH:MM
  mins       int                              -- 접수→도착 소요(분)
);
create index if not exists field_reports_cid_idx on public.field_reports (cid, at desc);
comment on table public.field_reports is '현장 결과보고 — 사진·판정·촬영 위치. 한 민원에 여러 번 쌓인다';

-- ── 5. rules — 급증 탐지 규칙과 개정 이력 (S-08) ──────────────
--    규칙은 코드가 아니라 데이터다. 화면에서 고치고 협의체 심의를 거친다.
create table if not exists public.rules (
  id         int primary key default 1,       -- 시행 중 규칙은 한 벌
  body       jsonb not null,                  -- {반경_m, 시간창_시간, 최소_건수, 상신_건수, …}
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint rules_single check (id = 1)
);
create table if not exists public.rule_history (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  body       jsonb not null,
  by         text,
  why        text
);
comment on table public.rules is '시행 중 급증 탐지 규칙 한 벌 — 개정 이력은 rule_history';

-- ── 6. journals — 재난상황일지 (재난안전상황실 전용) ───────────
create table if not exists public.journals (
  ymd        date primary key,                -- 하루 한 장
  body       jsonb not null,                  -- 화면 입력값 그대로
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.journals is '재난상황일지 — 하루 한 장. 작성 권한은 재난안전상황실(권한 ④)';

-- ── 7. 권한·실시간 ────────────────────────────────────────────
--    현재 운영과 같은 방식(anon 전면 허용)을 따른다.
--    행정망 이관 시 부서 계정 기반 RLS 로 바꾼다(로드맵).
alter table public.orders        enable row level security;
alter table public.order_holds   enable row level security;
alter table public.field_reports enable row level security;
alter table public.rules         enable row level security;
alter table public.rule_history  enable row level security;
alter table public.journals      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['orders','order_holds','field_reports','rules','rule_history','journals'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='anon_all') then
      execute format('create policy anon_all on public.%I for all using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- 실시간 — 하달·의견이 다른 자리에서 곧바로 보이게
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='field_reports') then
    alter publication supabase_realtime add table public.field_reports;
  end if;
end $$;

-- ── 확인 ──────────────────────────────────────────────────────
-- select table_name from information_schema.tables
--  where table_schema='public' order by 1;
