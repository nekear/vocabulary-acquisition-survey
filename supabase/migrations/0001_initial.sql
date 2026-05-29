create extension if not exists pgcrypto;

create table if not exists public.submitters (
  id uuid primary key default gen_random_uuid(),
  withdrawal_token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists submitters_token_hash_idx
  on public.submitters (withdrawal_token_hash);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references public.submitters(id) on delete restrict,
  schema_version text not null,
  storage_path text not null,
  size_bytes bigint,
  status text not null check (status in ('pending', 'uploaded', 'withdrawn', 'failed')),
  consent_publish_revlogs boolean not null,
  consent_publish_userinfo boolean not null,
  user_profile jsonb,
  client_user_agent text,
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  withdrawn_at timestamptz
);

create index if not exists submissions_status_idx
  on public.submissions (status);

create index if not exists submissions_submitter_idx
  on public.submissions (submitter_id);

create index if not exists submissions_submitted_at_idx
  on public.submissions (submitted_at desc);

alter table public.submitters enable row level security;
alter table public.submissions enable row level security;
