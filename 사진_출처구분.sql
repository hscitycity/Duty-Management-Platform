-- 용역업체가 올린 현장사진을 담당자 사진과 구분해 담는다 (C-4a3)
-- 없어도 앱은 동작한다(기기 사본으로 남음). 있으면 다른 기기·새로고침 후에도 유지된다.
alter table public.complaints
  add column if not exists photo_vendor_before text,
  add column if not exists photo_vendor_after  text;

comment on column public.complaints.photo_vendor_before is '용역업체가 올린 조치 전 사진 URL';
comment on column public.complaints.photo_vendor_after  is '용역업체가 올린 조치 후 사진 URL';
