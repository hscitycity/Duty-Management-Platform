-- 화성특례시 당직 플랫폼 DB (Supabase SQL Editor에 붙여넣고 Run)
create table if not exists complaints (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  time text, gu text, loc text, field text, sub text,
  sum text, req text, urg text default '일반',
  st text default '신규접수', src text default '전화',
  sms boolean default false, disp_n int default 0,
  lat double precision, lng double precision,
  log jsonb default '[]'::jsonb
);
create table if not exists scenarios (
  id bigserial primary key,
  created_at timestamptz default now(),
  gap int default 1800,
  field text, sub text, gu text, emd text, loc text,
  sum text, urg text default '일반', src text default '전화',
  hash text unique, used boolean default false
);
alter table complaints enable row level security;
alter table scenarios enable row level security;
create policy "anon all complaints" on complaints for all using (true) with check (true);
create policy "anon all scenarios" on scenarios for all using (true) with check (true);
alter publication supabase_realtime add table complaints;
