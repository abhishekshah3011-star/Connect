-- ============================================================
--  ZIU Connect — Supabase schema
--  Paste this whole file into the Supabase SQL Editor and Run.
--  Safe to run more than once.
-- ============================================================

-- ---------- 1. Tables ----------

-- The 7 people. Kept in the database so "Manage team" edits stick.
create table if not exists public.people (
  id          text primary key,
  name        text not null,
  email       text not null,
  role        text not null default 'member',   -- owner | member | viewer
  initials    text not null default '??',
  sort_order  int  not null default 100
);

-- One row per task. Nested lists (comments, attachments, links, history)
-- are stored as jsonb, matching the shape the app already uses.
create table if not exists public.tasks (
  id             text primary key,
  no             int  not null,
  title          text not null default '',
  descr          text not null default '',
  status         text not null default 'assigned',
  blocked        jsonb,
  priority       text not null default 'medium',
  deadline       date,
  effort_days    text,
  start_at       timestamptz,
  closed_at      timestamptz,
  created_by     text,
  owner          text,
  poc            text default '',
  requirements   text default '',
  reference      text default '',
  tech_stack     text default '',
  remarks        text default '',
  product_url    text default '',   -- live URL the Products menu opens
  assignees      jsonb not null default '[]'::jsonb,
  stage_history  jsonb not null default '[]'::jsonb,
  attachments    jsonb not null default '[]'::jsonb,
  links          jsonb not null default '[]'::jsonb,
  comments       jsonb not null default '[]'::jsonb,
  queries        jsonb not null default '[]'::jsonb,
  history        jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);

-- if you created these tables before the Product link feature existed
alter table public.tasks add column if not exists product_url text default '';
alter table public.tasks add column if not exists remarks     text default '';

create table if not exists public.notifications (
  id         bigserial primary key,
  recipient  text not null,
  body       text not null,
  task_id    text,
  read       boolean not null default false,
  at         timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient, at desc);

create table if not exists public.chat_messages (
  id     bigserial primary key,
  by_id  text not null,
  body   text not null,
  at     timestamptz not null default now()
);
create index if not exists chat_messages_at_idx on public.chat_messages (at);

-- "last time this person opened team chat", for the unread badge
create table if not exists public.chat_reads (
  person_id text primary key,
  at        timestamptz not null default now()
);

-- log of progress emails the app has sent
create table if not exists public.email_log (
  id       bigserial primary key,
  sender   text,
  send_to  jsonb not null default '[]'::jsonb,
  subject  text not null,
  task_id  text,
  at       timestamptz not null default now()
);
create index if not exists email_log_at_idx on public.email_log (at desc);

-- single shared row holding the Groq + EmailJS settings
create table if not exists public.app_settings (
  id   int primary key default 1 check (id = 1),
  groq jsonb not null default '{}'::jsonb,
  mail jsonb not null default '{}'::jsonb
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;


-- ---------- 2. Access ----------
-- This build uses the name picker, so there are no logged-in users --
-- everyone arrives as the anonymous role. These policies therefore allow
-- anonymous read and write.
--
-- >> Anyone who has your site URL can read and change this data. <<
-- Keep the URL private. If you later switch to email sign-in, replace
-- `to anon, authenticated` with `to authenticated` and the same policies
-- become properly locked down.

do $$
declare t text;
begin
  foreach t in array array['people','tasks','notifications','chat_messages','chat_reads','email_log','app_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "ziu_all" on public.%I', t);
    execute format(
      'create policy "ziu_all" on public.%I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;


-- ---------- 3. Realtime ----------
-- Lets every open browser see changes within about a second.

do $$
declare t text;
begin
  foreach t in array array['people','tasks','notifications','chat_messages','chat_reads','app_settings']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- send the previous row on updates/deletes too, so the app can reconcile
alter table public.tasks         replica identity full;
alter table public.notifications replica identity full;


-- ---------- 4. The 7 people ----------

insert into public.people (id, name, email, role, initials, sort_order) values
  ('u1', 'Krunal Rajput',     'krunalr477@gmail.com', 'owner',  'KR', 1),
  ('u5', 'Vijesh Zinzuwadia', 'vijesh@ziu.team',      'viewer', 'VZ', 2),
  ('u6', 'Ujay Ranpara',      'ujay@ziu.team',        'viewer', 'UR', 3),
  ('u7', 'Jigar Shah',        'jigar@ziu.team',       'viewer', 'JS', 4),
  ('u3', 'Abhishek Shah',     'abhishek@ziu.team',    'member', 'AS', 5),
  ('u2', 'Jaynil Agarwal',    'jaynil@ziu.team',      'member', 'JA', 6),
  ('u4', 'Katha Pawale',      'katha@ziu.team',       'member', 'KP', 7)
on conflict (id) do update
  set name = excluded.name, email = excluded.email,
      role = excluded.role, initials = excluded.initials,
      sort_order = excluded.sort_order;


-- ---------- 5. The 8 tasks ----------
-- Stage history is left empty here; the app fills in a task's timeline as
-- people move it. Deadlines are set relative to the day you run this.

insert into public.tasks (id, no, title, descr, status, priority, deadline, effort_days, created_by, owner, requirements, tech_stack, assignees, start_at)
values
  ('T-1001', 1, 'UG Task Manager',
   'Task and workflow manager for the UG account — assign work, track it through the delivery pipeline, and give the client a single view of progress.',
   'finaldemo', 'high', current_date + 7, '22', 'u1', 'u1',
   'Final demo is done. Collect sign-off notes before moving to deployment.', 'React, Vite, Node',
   '["u2","u3","u4"]'::jsonb, now() - interval '20 days'),

  ('T-1002', 2, '5471 Form',
   'Automate preparation of IRS Form 5471 for foreign-corporation filings — schedule mapping, ownership tracking and validation before export.',
   'build', 'critical', current_date + 12, '18', 'u1', 'u1',
   'Every schedule must reconcile against the source trial balance. No manual overrides.', 'Python, React',
   '["u2","u3","u4"]'::jsonb, now() - interval '17 days'),

  ('T-1003', 3, 'GST Reconciliation',
   'Reconcile GSTR-2B against the purchase register, flag mismatches, and produce a vendor-wise action list each month.',
   'golive', 'high', current_date - 4, '15', 'u1', 'u1',
   'Mismatches above the tolerance limit need a written root-cause note.', 'Python, Postgres',
   '["u2","u3","u4"]'::jsonb, now() - interval '26 days'),

  ('T-1004', 4, 'ZIU HR',
   'In-house HR platform — employee records, leave and attendance, onboarding checklists and the appraisal cycle.',
   'build', 'high', current_date + 21, '28', 'u1', 'u1',
   'Leave policy rules must be configurable, not hard-coded.', 'React, Node, Postgres',
   '["u2","u3","u4"]'::jsonb, now() - interval '17 days'),

  ('T-1005', 5, 'Talent Mining',
   'Source and shortlist candidates from public profiles and inbound applications, scored against the role brief.',
   'finaldemo', 'medium', current_date + 9, '20', 'u1', 'u1',
   'Shortlist must show why each candidate scored the way they did.', 'Python, React',
   '["u2","u3","u4"]'::jsonb, now() - interval '20 days'),

  ('T-1006', 6, 'Lead Mining',
   'Build a qualified lead pipeline from public company data — enrich, score and route leads to the right owner.',
   'feedback', 'medium', current_date + 18, '16', 'u1', 'u1',
   'Feedback from the first review round has to be closed out before Build starts.', 'Python, React',
   '["u2","u3","u4"]'::jsonb, now() - interval '14 days'),

  ('T-1007', 7, 'ZIU Learn',
   'Internal learning platform — course library, structured learning paths, progress tracking and completion certificates.',
   'build', 'medium', current_date + 30, '25', 'u1', 'u1',
   'Content must be authorable by non-developers.', 'React, Node',
   '["u2","u3","u4"]'::jsonb, now() - interval '17 days'),

  ('T-1008', 8, 'OKR',
   'Objectives and key results tracker — set quarterly objectives, cascade them to teams, and check in on progress.',
   'prototype', 'medium', current_date + 35, '14', 'u1', 'u1',
   'Prototype should cover objective creation and check-ins before anything else.', 'React, Node',
   '["u2","u3","u4"]'::jsonb, now() - interval '8 days')
on conflict (id) do nothing;


-- ---------- Done ----------
-- Check it worked:
--   select no, title, status, deadline from public.tasks order by no;
