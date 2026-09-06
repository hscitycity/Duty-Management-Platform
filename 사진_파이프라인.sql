-- ══════════════════════════════════════════════════════════════
-- 사진 파이프라인 — Supabase Storage 버킷 + complaints 컬럼
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.
-- 여러 번 실행해도 안전하다(if not exists / on conflict).
-- ══════════════════════════════════════════════════════════════

-- ── 1. complaints 컬럼 추가 ────────────────────────────────────
alter table complaints add column if not exists photo_report  jsonb   default '[]'::jsonb; -- 시민 신고 사진 url 배열(최대 3)
alter table complaints add column if not exists photo_before  text;                        -- 조치 전
alter table complaints add column if not exists photo_after   text;                        -- 조치 후
alter table complaints add column if not exists photo_public  boolean default true;        -- 시민 화면 공개 여부
alter table complaints add column if not exists result_type   text;                        -- 조치 완료 / 임시 조치 / 타 부서 이관 / 현장 이상 없음
alter table complaints add column if not exists result_memo   text;
alter table complaints add column if not exists reported_by   text;                        -- 결과보고 제출 조직
alter table complaints add column if not exists reported_at   timestamptz;
alter table complaints add column if not exists report_lat    double precision;            -- 결과보고 촬영 위치
alter table complaints add column if not exists report_lng    double precision;

comment on column complaints.photo_report is '시민 신고 사진 공개 URL 배열 (photos/{id}/report_{n}.jpg)';
comment on column complaints.photo_public is 'false 면 시민 화면에서만 가린다. 내부(상황판·기동단)에서는 보인다';

-- ── 2. Storage 버킷 ───────────────────────────────────────────
-- 공개 버킷: 시민 추적 화면이 로그인 없이 사진을 봐야 한다.
-- 비공개로 바꾸려면 public 을 false 로 두고 클라이언트에서 createSignedUrl 을 쓰도록 바꿔야 한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 3. Storage 접근 정책 ──────────────────────────────────────
-- anon 키로 올리고 읽는다(플랫폼이 anon 키만 쓰는 구조라 complaints 정책과 같은 수준).
drop policy if exists "photos anon read"   on storage.objects;
drop policy if exists "photos anon insert" on storage.objects;
drop policy if exists "photos anon update" on storage.objects;
drop policy if exists "photos anon delete" on storage.objects;

create policy "photos anon read"
  on storage.objects for select
  using (bucket_id = 'photos');

create policy "photos anon insert"
  on storage.objects for insert
  with check (bucket_id = 'photos');

create policy "photos anon update"
  on storage.objects for update
  using (bucket_id = 'photos') with check (bucket_id = 'photos');

-- 삭제는 보존 기간 정리에만 쓴다
create policy "photos anon delete"
  on storage.objects for delete
  using (bucket_id = 'photos');

-- ── 4. 보존 기간 정리 ─────────────────────────────────────────
-- 완료 후 PHOTO_KEEP_DAYS(기본 180일)가 지난 건의 사진을 지운다.
-- 화면의 PHOTO_KEEP_DAYS 상수와 같은 값을 쓴다.
create or replace function photo_prune(keep_days int default 180)
returns int language plpgsql as $$
declare
  n int := 0;
  r record;
begin
  for r in
    select id from complaints
    where st = '완료'
      and coalesce(reported_at, created_at) < now() - (keep_days || ' days')::interval
      and (photo_report <> '[]'::jsonb or photo_before is not null or photo_after is not null)
  loop
    delete from storage.objects
      where bucket_id = 'photos' and name like r.id || '/%';
    update complaints
      set photo_report = '[]'::jsonb, photo_before = null, photo_after = null
      where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

comment on function photo_prune is '완료 후 보존 기간이 지난 민원의 사진을 지운다. select photo_prune(180);';

-- 월 1회 정리 (pg_cron 이 이미 설치돼 있다)
-- select cron.schedule('photo-prune', '0 4 1 * *', $$select photo_prune(180)$$);

-- ── 5. 확인 ───────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'complaints' and column_name like 'photo%';
-- select id, public, file_size_limit from storage.buckets where id = 'photos';
