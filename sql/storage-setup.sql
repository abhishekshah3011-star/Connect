-- ============================================================
--  ZIU Connect — file attachments (Supabase Storage)
--  Run this ONCE in the SQL Editor, after supabase-schema.sql.
--  Safe to run more than once.
-- ============================================================

-- A public bucket: anyone with a file's URL can download it, which is
-- what lets the Download button work without extra plumbing. Files get
-- long random names, so URLs aren't guessable — but treat them the same
-- way you treat the site URL itself: don't post them publicly.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ziu-files', 'ziu-files', true, 26214400)      -- 25 MB per file
on conflict (id) do update
  set public = true, file_size_limit = 26214400;

-- Who may do what with the files in that bucket.
-- Matches the rest of the app: no accounts yet, so the anonymous role
-- needs read + write. Swap `anon, authenticated` for `authenticated`
-- if you later add email sign-in.
do $$
declare p text;
begin
  foreach p in array array['ziu_files_read','ziu_files_insert','ziu_files_update','ziu_files_delete']
  loop
    execute format('drop policy if exists %I on storage.objects', p);
  end loop;
end $$;

create policy "ziu_files_read"   on storage.objects for select
  to anon, authenticated using (bucket_id = 'ziu-files');

create policy "ziu_files_insert" on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'ziu-files');

create policy "ziu_files_update" on storage.objects for update
  to anon, authenticated using (bucket_id = 'ziu-files') with check (bucket_id = 'ziu-files');

create policy "ziu_files_delete" on storage.objects for delete
  to anon, authenticated using (bucket_id = 'ziu-files');

-- Check it worked:
--   select id, public, file_size_limit from storage.buckets where id = 'ziu-files';
