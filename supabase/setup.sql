-- Run once in the Supabase SQL Editor. Tokens are stored only as SHA-256 hashes.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz
);
alter table private.access_tokens enable row level security;
revoke all on table private.access_tokens from public, anon, authenticated, service_role;

-- Run this only from the SQL Editor as the database owner. The raw token is
-- returned once; copy it for the researcher because only its hash is retained.
create or replace function private.issue_access_token(
  p_lifetime interval default interval '24 hours'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if p_lifetime <= interval '0 seconds' or p_lifetime > interval '30 days' then
    raise exception 'Token lifetime must be between 1 second and 30 days';
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.access_tokens (token_hash, expires_at)
  values (
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    pg_catalog.now() + p_lifetime
  );
  return v_token;
end;
$$;
revoke all on function private.issue_access_token(interval) from public, anon, authenticated, service_role;

-- Only the server's Supabase secret/service role can redeem a key. The UPDATE
-- is atomic, so simultaneous attempts cannot both consume the same token.
create or replace function public.redeem_access_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_id uuid;
begin
  if p_token is null or length(p_token) <> 64 then
    return null;
  end if;

  update private.access_tokens as t
  set consumed_at = pg_catalog.now()
  where t.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and t.consumed_at is null
    and t.revoked_at is null
    and t.expires_at > pg_catalog.now()
  returning t.id into v_token_id;

  return v_token_id;
end;
$$;
revoke all on function public.redeem_access_token(text) from public, anon, authenticated;
grant execute on function public.redeem_access_token(text) to service_role;

-- Record metadata is only accessed by server routes using the secret key.
create table if not exists public.recording_uploads (
  id uuid primary key default gen_random_uuid(),
  access_token_id uuid not null references private.access_tokens(id),
  title text not null,
  mode text not null check (mode in ('audio', 'video')),
  object_path text not null unique,
  duration_seconds integer not null check (duration_seconds >= 0),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  content_type text not null,
  status text not null default 'pending' check (status in ('pending', 'saved')),
  created_at timestamptz not null default now()
);
alter table public.recording_uploads enable row level security;
revoke all on table public.recording_uploads from public, anon, authenticated;
grant select, insert, update on table public.recording_uploads to service_role;

-- A private bucket. Signed upload URLs are minted by the server after the
-- one-time key has been redeemed; the browser never receives a secret key.
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

-- Remove the owner-auth policies from the earlier email-login setup, if present.
drop policy if exists "Researchers upload their own recordings" on storage.objects;
drop policy if exists "Researchers read their own recordings" on storage.objects;

notify pgrst, 'reload schema';
