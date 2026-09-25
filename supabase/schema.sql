create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text not null,
  service_id text not null,
  service_name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10, 2) not null check (price >= 0),
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create unique index if not exists appointments_active_slot_idx
  on public.appointments (appointment_date, appointment_time)
  where status = 'confirmed';

alter table public.appointments enable row level security;

create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null,
  blocked_time time not null,
  reason text not null default 'Bloqueo manual',
  created_at timestamptz not null default now()
);

create unique index if not exists blocked_slots_date_time_idx
  on public.blocked_slots (blocked_date, blocked_time);

alter table public.blocked_slots enable row level security;
