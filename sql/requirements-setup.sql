-- ============================================================
--  ZIU Connect — requirement intake form
--  Run this in the Supabase SQL Editor after supabase-schema.sql.
--  Safe to run more than once.
-- ============================================================

create table if not exists public.requirements (
  id            bigserial primary key,
  public_id     text not null unique,          -- REQ-2026-A1B2C3D4, shown to the submitter
  title         text not null,
  department    text not null,
  requestor     text not null,
  email         text not null,
  payload       jsonb not null default '{}'::jsonb,   -- every field on the form
  files         jsonb not null default '[]'::jsonb,   -- [{name,size,type,url,path}]
  priority_score int,                             -- 0-100 weighted score from the form
  priority_band  text,                            -- Critical | High | Medium | Low
  status        text not null default 'submitted',    -- submitted | approved | rejected
  reject_reason text default '',
  decided_by    text,                          -- people.id of whoever approved or rejected
  decided_at    timestamptz,
  task_id       text,                          -- the task created on approval
  created_at    timestamptz not null default now()
);
create index if not exists requirements_status_idx on public.requirements (status, created_at desc);

-- if the table was created before priority scoring existed
alter table public.requirements add column if not exists priority_score int;
alter table public.requirements add column if not exists priority_band  text;

-- Anyone with the form link can submit; the app decides who may read and
-- decide. (No accounts yet — see the note in supabase-schema.sql.)
alter table public.requirements enable row level security;
drop policy if exists "ziu_all" on public.requirements;
create policy "ziu_all" on public.requirements
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.requirements to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- where the intake form is published, so ZIU Connect can offer the link.
-- Shared, so changing it in Settings changes it for everyone.
alter table public.app_settings add column if not exists form_url text default '';
update public.app_settings
   set form_url = 'https://dapper-kelpie-fbd4f3.netlify.app/'
 where id = 1 and coalesce(form_url, '') = '';

-- live updates, so a submission appears without anyone refreshing
do $$
begin
  begin
    alter publication supabase_realtime add table public.requirements;
  exception when duplicate_object then null;
  end;
end $$;
alter table public.requirements replica identity full;

-- Check it worked:
--   select public_id, title, status, created_at from public.requirements order by created_at desc;
