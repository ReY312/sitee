-- Enable extension for UUID generation
create extension if not exists pgcrypto;

create table if not exists public.queue_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id bigserial unique not null,
  full_name text not null,
  snils text not null,
  appointment_at timestamptz not null,
  visited_at timestamptz null,
  ip_hash text null,
  created_at timestamptz not null default timezone('utc', now())
);

-- One active (not visited) appointment per SNILS.
create unique index if not exists uq_queue_requests_snils_active
  on public.queue_requests (snils)
  where visited_at is null;

alter table public.queue_requests enable row level security;

-- No anonymous direct access.
revoke all on table public.queue_requests from anon, authenticated;

create or replace function public.create_queue_request(
  p_full_name text,
  p_snils text,
  p_appointment_at timestamptz,
  p_ip_hash text default null
)
returns table(ticket_id bigint, appointment_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_ticket_id bigint;
  inserted_appointment timestamptz;
begin
  insert into public.queue_requests (full_name, snils, appointment_at, ip_hash)
  values (trim(p_full_name), p_snils, p_appointment_at, encode(digest(coalesce(p_ip_hash, ''), 'sha256'), 'hex'))
  returning queue_requests.ticket_id, queue_requests.appointment_at
  into inserted_ticket_id, inserted_appointment;

  return query
  select inserted_ticket_id, inserted_appointment;
exception
  when unique_violation then
    raise exception 'Active appointment already exists for SNILS'
      using errcode = '23505';
end;
$$;

revoke all on function public.create_queue_request(text, text, timestamptz, text) from public;
grant execute on function public.create_queue_request(text, text, timestamptz, text) to service_role;
