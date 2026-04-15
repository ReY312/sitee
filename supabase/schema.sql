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

create unique index if not exists uq_queue_requests_snils_active
  on public.queue_requests (snils)
  where visited_at is null;

create index if not exists idx_queue_requests_appointment_at
  on public.queue_requests (appointment_at);

alter table public.queue_requests enable row level security;
revoke all on table public.queue_requests from anon, authenticated;

create or replace function public.create_queue_request(
  p_full_name text,
  p_snils text,
  p_visit_date date,
  p_slot_capacity integer,
  p_slot_start_time time,
  p_slot_end_time time,
  p_slot_minutes integer,
  p_ip_hash text default null
)
returns table(ticket_id bigint, appointment_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_ts timestamptz;
  slot_local timestamp;
  slot_count integer;
  selected_slot timestamptz;
  inserted_ticket_id bigint;
  inserted_appointment timestamptz;
  end_local timestamp;
begin
  if p_slot_capacity <= 0 then
    raise exception 'slot_capacity must be > 0';
  end if;

  if p_slot_minutes <= 0 then
    raise exception 'slot_minutes must be > 0';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_visit_date::text));

  slot_local := (p_visit_date::timestamp + p_slot_start_time);
  end_local := (p_visit_date::timestamp + p_slot_end_time);

  while slot_local < end_local loop
    slot_ts := slot_local at time zone 'UTC';

    select count(*)
      into slot_count
    from public.queue_requests qr
    where qr.appointment_at = slot_ts
      and qr.visited_at is null;

    if slot_count < p_slot_capacity then
      selected_slot := slot_ts;
      exit;
    end if;

    slot_local := slot_local + make_interval(mins => p_slot_minutes);
  end loop;

  if selected_slot is null then
    raise exception 'No free slot for selected date';
  end if;

  insert into public.queue_requests (full_name, snils, appointment_at, ip_hash)
  values (trim(p_full_name), p_snils, selected_slot, encode(digest(coalesce(p_ip_hash, ''), 'sha256'), 'hex'))
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

revoke all on function public.create_queue_request(text, text, date, integer, time, time, integer, text) from public;
grant execute on function public.create_queue_request(text, text, date, integer, time, time, integer, text) to service_role;
