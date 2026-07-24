-- 연합뉴스 재난기사 축적 테이블 (행안부 재난안전데이터 DSSP-IF-00051 → 수집 적재)
-- Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 실행하세요 (1회).
create table if not exists public.yna_news (
  no bigint primary key,          -- YNA_NO (기사 고유번호)
  ttl text not null,              -- 제목
  cn text,                        -- 본문
  ymd timestamptz,                -- 송고 일시
  crt date,                       -- 수집 기준일
  inserted_at timestamptz default now()
);

alter table public.yna_news enable row level security;

-- 플랫폼(anon)에서 읽기 + 수집기(anon)에서 쓰기 허용
drop policy if exists yna_read on public.yna_news;
create policy yna_read on public.yna_news for select using (true);
drop policy if exists yna_write on public.yna_news;
create policy yna_write on public.yna_news for insert with check (true);

-- Realtime(선택): 새 기사 실시간 반영을 원하면 주석 해제
-- alter publication supabase_realtime add table public.yna_news;
