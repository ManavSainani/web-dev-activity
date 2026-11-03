-- Private storage for recordings. Keep this bucket private.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,
  524288000,
  array['video/webm', 'audio/webm', 'video/mp4', 'audio/mp4']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Researchers upload their own recordings" on storage.objects;
create policy "Researchers upload their own recordings"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Researchers read their own recordings" on storage.objects;
create policy "Researchers read their own recordings"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('audio', 'video')),
  object_path text not null unique,
  duration_seconds integer not null check (duration_seconds >= 0),
  content_type text not null,
  created_at timestamptz not null default now()
);

alter table public.recordings enable row level security;
grant usage on schema public to authenticated;
grant select, insert on public.recordings to authenticated;

drop policy if exists "Researchers insert their own recording details" on public.recordings;
create policy "Researchers insert their own recording details"
on public.recordings
for insert
to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Researchers read their own recording details" on public.recordings;
create policy "Researchers read their own recording details"
on public.recordings
for select
to authenticated
using (owner_id = (select auth.uid()));
