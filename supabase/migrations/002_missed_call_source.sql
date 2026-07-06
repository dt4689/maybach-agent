-- Missed-call follow-up feature: track where each conversation originated.
-- source = 'whatsapp' (customer messaged first) | 'missed_call_followup'
-- (we reached out after a missed call).

alter table public.conversations
  add column if not exists source text not null default 'whatsapp';

create index if not exists conversations_source_idx on public.conversations (source);
