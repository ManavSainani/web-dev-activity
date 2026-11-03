-- Run in the Supabase SQL Editor if setup.sql was already applied.
alter table public.recording_uploads add column if not exists session_id text;
alter table public.recording_uploads add column if not exists started_at timestamptz;
alter table public.recording_uploads add column if not exists saved_at timestamptz;
notify pgrst, 'reload schema';
