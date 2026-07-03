-- Maybach Rentals WhatsApp AI agent — initial schema
-- Run in the Supabase SQL editor (or via supabase db push).
-- RLS is ENABLED on both tables with no policies: only the service role
-- key (used server-side) can read/write. Never expose that key client-side.

create extension if not exists "pgcrypto";

-- ── conversations ────────────────────────────────────────────────────
create table if not exists public.conversations (
  id           uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  messages     jsonb not null default '[]'::jsonb,  -- [{role, content, ts}]
  stage        text not null default 'new',          -- new | qualified | confirmed | lost
  lead_data    jsonb not null default '{}'::jsonb,   -- rolling extracted lead fields
  language     text not null default 'en',           -- en | hi | hinglish
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists conversations_phone_idx on public.conversations (phone_number);
create index if not exists conversations_updated_idx on public.conversations (updated_at desc);

-- ── leads ────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  phone_number    text not null unique,
  name            text,
  email           text,
  occasion        text,
  vehicle         text,
  booking_date    text,           -- free text as captured ("14 Feb 2026", "2026-02-14")
  duration_hours  integer,        -- base package is 8 hrs; extra hours noted here
  pickup_location text,
  quoted_total    numeric,        -- package price quoted, INR
  status          text not null default 'new'
                  check (status in ('new', 'qualified', 'confirmed', 'lost')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists leads_status_idx  on public.leads (status);
create index if not exists leads_created_idx on public.leads (created_at desc);

-- ── updated_at triggers ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists conversations_touch on public.conversations;
create trigger conversations_touch
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────
-- Enabled with NO policies: anon/authenticated roles get nothing;
-- the server-side service role bypasses RLS.
alter table public.conversations enable row level security;
alter table public.leads         enable row level security;
