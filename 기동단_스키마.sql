-- ══════════════════════════════════════════════════════════════
-- 교통·도로민원 신속처리 기동단 — complaints 컬럼 추가
-- 운영 개시 2026. 9. 7. · 대표전화 1833-4088
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전하다.
-- ══════════════════════════════════════════════════════════════

-- ── 분류 ──────────────────────────────────────────────────────
alter table complaints add column if not exists road_category  text;   -- 도로파손 · 교통시설 · 불법주정차 · 버스불편 · 교통체계
alter table complaints add column if not exists road_sla       text;   -- 즉시(24h) · 단기(48h) · 중장기(협의)

-- ── 처리방안 안내 (접수 + 60분 · 기동단의 첫 약속) ─────────────
alter table complaints add column if not exists guide_due      timestamptz;
alter table complaints add column if not exists guide_at       timestamptz;
alter table complaints add column if not exists guide_method   text;   -- 전화 · 문자
alter table complaints add column if not exists guide_memo     text;

-- ── 현장 확인 (기동단이 직접 확인하고 분류를 확정한다) ──────────
alter table complaints add column if not exists field_check_at timestamptz;
alter table complaints add column if not exists field_check_by text;

-- ── 협력 기관 (경찰서 · 운수업체 · 한국도로공사 · 한국전력 등) ──
alter table complaints add column if not exists partner_org      text;
alter table complaints add column if not exists partner_sent_at  timestamptz;
alter table complaints add column if not exists partner_reply_at timestamptz;
alter table complaints add column if not exists partner_reply    text;

-- ── 접수 경로 ─────────────────────────────────────────────────
alter table complaints add column if not exists intake_channel text;   -- 전화(1833-4088) · 시민창구 · 당직이관

comment on column complaints.road_category  is '기동단 5분류 — 접수·분류·통계의 기준 축';
comment on column complaints.road_sla       is '즉시 24시간 / 단기 48시간 / 중장기 관계기관 협의(기한 미정)';
comment on column complaints.guide_due      is '처리방안 안내 마감 — 접수 후 60분. 기동단의 핵심 성과 지표';
comment on column complaints.partner_org    is '버스 민원은 운수업체가 필수. 통보·회신 시각을 함께 기록한다';

-- ── 1시간 준수율 (핵심 성과 지표) ──────────────────────────────
create or replace view road_guide_kpi as
select
  date_trunc('day', created_at)                                        as day,
  count(*)                                                             as 접수,
  count(*) filter (where guide_at is not null)                         as 안내완료,
  count(*) filter (where guide_at is not null and guide_at <= guide_due) as 기한내안내,
  round(100.0 * count(*) filter (where guide_at is not null and guide_at <= guide_due)
        / nullif(count(*) filter (where guide_at is not null), 0), 1)  as 준수율
from complaints
where road_category is not null
group by 1
order by 1 desc;

comment on view road_guide_kpi is '기동단 1시간 안내 준수율 — select * from road_guide_kpi;';

-- ── 확인 ──────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name='complaints' and (column_name like 'road_%' or column_name like 'guide_%'
--      or column_name like 'partner_%' or column_name like 'field_check%' or column_name='intake_channel');

-- ── §1-1 담당 주체 배정 (당직 처리 / 교통·도로 기동단) ──────────
alter table complaints add column if not exists assignee     text;
alter table complaints add column if not exists assigned_at  timestamptz;
alter table complaints add column if not exists assigned_why text;
comment on column complaints.assignee is '당직 처리 / 교통·도로 기동단 — AI 가 유형으로 제안하고 접수자가 확정한다';
