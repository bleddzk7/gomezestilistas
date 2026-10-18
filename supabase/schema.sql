-- IRUÑARTEA · esquema de Supabase. Ejecutar completo en SQL Editor (es idempotente).

create extension if not exists pgcrypto;

-- ───────────── Administradores ─────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins leen su fila" on public.admins;
create policy "admins leen su fila" on public.admins for select to authenticated using (user_id = auth.uid());

-- ───────────── Contenido de la web ─────────────
create table if not exists public.site_content (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  slug text primary key check (slug ~ '^[a-zA-Z0-9_-]{1,30}$'),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  price numeric(6,2) not null check (price >= 0 and price <= 999),
  featured boolean not null default false,
  tag text not null default '' check (char_length(tag) <= 30),
  sort integer not null default 0,
  active boolean not null default true
);

create table if not exists public.schedule (
  day smallint primary key check (day between 1 and 7),
  slots jsonb not null default '[]'::jsonb check (jsonb_typeof(slots) = 'array')
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  role text not null default '' check (char_length(role) <= 80),
  photo text not null default '' check (photo = '' or photo ~ '^(assets|uploads)/[A-Za-z0-9._-]{1,120}$'),
  sort integer not null default 0,
  active boolean not null default true
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image text not null check (image ~ '^(assets|uploads)/[A-Za-z0-9._-]{1,120}$'),
  alt text not null default '' check (char_length(alt) <= 160),
  caption text not null default '' check (char_length(caption) <= 40),
  contain boolean not null default false,
  sort integer not null default 0,
  active boolean not null default true
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author text not null check (char_length(author) between 1 and 60),
  text text not null check (char_length(text) between 1 and 600),
  rating smallint not null default 5 check (rating between 1 and 5),
  sort integer not null default 0,
  active boolean not null default true
);

-- ───────────── Reservas ─────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  service_slug text not null,
  service_name text not null,
  price numeric(6,2) not null,
  booking_date date not null,
  booking_time time not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'confirmada', 'completada', 'cancelada')),
  notes text not null default '' check (char_length(notes) <= 500)
);
create index if not exists bookings_date_idx on public.bookings (booking_date, booking_time);
create index if not exists bookings_created_idx on public.bookings (created_at desc);

-- ───────────── Seguridad por filas ─────────────
do $$
declare t text;
begin
  foreach t in array array['site_content', 'services', 'schedule', 'team_members', 'gallery_items', 'reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('create policy "lectura publica" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin escribe" on public.%I', t);
    execute format('create policy "admin escribe" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.bookings enable row level security;
drop policy if exists "admin gestiona reservas" on public.bookings;
create policy "admin gestiona reservas" on public.bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Sin política para anon: las reservas públicas entran solo por submit_booking().

-- ───────────── Alta de reservas desde la web (validada en servidor) ─────────────
create or replace function public.submit_booking(
  p_name text, p_phone text, p_service text, p_date date, p_time text, p_elapsed integer, p_website text default ''
) returns text
language plpgsql security definer set search_path = public as
$$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_phone text := btrim(coalesce(p_phone, ''));
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_service public.services%rowtype;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_slots jsonb;
  v_slot jsonb;
  v_min integer;
  v_open integer;
  v_close integer;
  v_ok boolean := false;
begin
  if coalesce(p_website, '') <> '' or coalesce(p_elapsed, 0) < 2500 then return 'rejected'; end if;
  if v_name !~ '^[[:alpha:]][[:alpha:] .''-]{1,79}$' then return 'rejected'; end if;
  if v_phone !~ '^\+?[0-9 ]{9,15}$' then return 'rejected'; end if;
  if p_date is null or p_date < v_today or p_date > v_today + 90 then return 'rejected'; end if;
  if coalesce(p_time, '') !~ '^[0-2][0-9]:[0-5][0-9]$' then return 'rejected'; end if;

  select * into v_service from public.services where slug = p_service and active;
  if not found then return 'rejected'; end if;

  select slots into v_slots from public.schedule where day = extract(isodow from p_date)::int;
  v_min := split_part(p_time, ':', 1)::int * 60 + split_part(p_time, ':', 2)::int;
  for v_slot in select * from jsonb_array_elements(coalesce(v_slots, '[]'::jsonb)) loop
    v_open := split_part(v_slot ->> 'opening', ':', 1)::int * 60 + split_part(v_slot ->> 'opening', ':', 2)::int;
    v_close := split_part(v_slot ->> 'closing', ':', 1)::int * 60 + split_part(v_slot ->> 'closing', ':', 2)::int;
    if v_min >= v_open and v_min + 30 <= v_close and (v_min - v_open) % 30 = 0 then v_ok := true; end if;
  end loop;
  if not v_ok then return 'rejected'; end if;

  if exists (
    select 1 from public.bookings where booking_date = p_date and booking_time = p_time::time and status <> 'cancelada'
  ) then return 'taken'; end if;
  if (select count(*) from public.bookings where created_at > now() - interval '1 hour') >= 60 then return 'rate'; end if;
  if exists (
    select 1 from public.bookings
    where regexp_replace(phone, '\D', '', 'g') = v_digits and booking_date = p_date
      and booking_time = p_time::time and status <> 'cancelada'
  ) then return 'duplicate'; end if;
  if (select count(*) from public.bookings
      where regexp_replace(phone, '\D', '', 'g') = v_digits and created_at > now() - interval '1 day') >= 3 then
    return 'limit';
  end if;

  insert into public.bookings (name, phone, service_slug, service_name, price, booking_date, booking_time)
  values (v_name, v_phone, v_service.slug, v_service.name, v_service.price, p_date, p_time::time);
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;
revoke all on function public.submit_booking(text, text, text, date, text, integer, text) from public;
grant execute on function public.submit_booking(text, text, text, date, text, integer, text) to anon, authenticated;

-- Una sola reserva activa por hueco (evita dobles reservas simultáneas)
create unique index if not exists bookings_one_per_slot on public.bookings (booking_date, booking_time) where status <> 'cancelada';

-- Horas ya ocupadas de un día (solo devuelve horas, ningún dato personal)
create or replace function public.booked_times(p_date date)
returns text[]
language sql stable security definer set search_path = public as

  select coalesce(array_agg(to_char(booking_time, 'HH24:MI')), '{}')
  from public.bookings where booking_date = p_date and status <> 'cancelada';
;
revoke all on function public.booked_times(date) from public;
grant execute on function public.booked_times(date) to anon, authenticated;

-- ───────────── Almacenamiento de imágenes ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "admin gestiona imagenes" on storage.objects;
create policy "admin gestiona imagenes" on storage.objects for all to authenticated
  using (bucket_id = 'site-media' and public.is_admin())
  with check (bucket_id = 'site-media' and public.is_admin());

-- ───────────── Contenido inicial (igual que la web actual) ─────────────
insert into public.site_content (key, value) values
('texts', $j${
  "hero_eyebrow": "Ongi etorri · Iruñea",
  "hero_claim": "El arte de renacer cada corte",
  "hero_sub": "Barbería artesanal en Pamplona. Oficio, navaja y carácter.",
  "about_title": "Del fuego,\nun oficio.",
  "about_p1": "IRUÑARTEA nace en el corazón de Iruñea con una idea sencilla: que salir de la barbería sea volver a empezar. Como el fénix que da nombre a la casa, cada corte es una pequeña renovación.",
  "about_p2": "Trabajamos con tijera, máquina y navaja, sin prisas y sin fórmulas. Escuchamos, aconsejamos y firmamos cada trabajo. Barrio, conversación y mano firme: así entendemos el oficio.",
  "about_note": "El símbolo ⵣ (yaz) que acompaña a nuestro fénix recuerda el carácter libre y las raíces de quien lo lleva.",
  "fact1_value": "5,0", "fact1_label": "valoración en Google",
  "fact2_value": "19", "fact2_label": "reseñas de clientes",
  "fact3_value": "6", "fact3_label": "días a la semana",
  "services_title": "La carta",
  "services_sub": "Precios orientativos. Confirmamos el importe final al reservar.",
  "gallery_title": "Trabajos",
  "team_title": "Manos de oficio",
  "team_sub": "Quien te atiende, te conoce por tu nombre.",
  "reviews_title": "Lo que dicen en Google",
  "rating_score": "5,0",
  "rating_count": "19 reseñas en Google",
  "booking_title": "Reserva\ntu cita",
  "booking_text": "Rellena los datos y se abrirá WhatsApp con tu mensaje preparado. Te confirmamos la hora por ahí. Guardamos tu solicitud (nombre, teléfono y cita) para gestionar la reserva.",
  "location_title": "Ven a\nvernos",
  "address": "C. Bernardino Tirapu, 31\n31014 Pamplona · Iruñea\nNavarra"
}$j$::jsonb),
('contact', $j${
  "phone": "604 97 85 34",
  "whatsapp": "34604978534",
  "map_query": "IRUÑARTEA, C. Bernardino Tirapu 31, 31014 Pamplona"
}$j$::jsonb),
('links', $j${
  "review_url": "https://search.google.com/local/writereview?placeid=ChIJ2U23ZwmTUA0RUODbXBFwLLU",
  "maps_url": "",
  "google_url": "https://www.google.com/search?q=IRU%C3%91ARTEA+Pamplona",
  "instagram": "", "facebook": "", "tiktok": ""
}$j$::jsonb),
('images', $j${
  "hero_logo": "assets/logo-irunartea.png",
  "about_photo": "assets/barbero-local.png",
  "compare_before": "assets/Corteantes.png",
  "compare_after": "assets/Cortedespues.png"
}$j$::jsonb)
on conflict (key) do nothing;

insert into public.services (slug, name, description, price, featured, tag, sort) values
('corte', 'Corte', 'Tijera y máquina, a tu medida y con el acabado limpio de siempre.', 15, false, '', 1),
('degradado', 'Degradado', 'Fade bien trabajado, de la piel al largo que elijas.', 17, false, '', 2),
('barba', 'Barba', 'Perfilado, recorte y cuidado con toalla caliente.', 10, false, '', 3),
('corteBarba', 'Corte + barba', 'El servicio completo para salir como nuevo.', 22, true, 'El favorito', 4),
('afeitado', 'Afeitado clásico', 'Navaja, espuma y toalla caliente. El ritual de siempre.', 15, false, '', 5),
('cejas', 'Cejas', 'Diseño y perfilado con precisión.', 5, false, '', 6)
on conflict (slug) do nothing;

insert into public.schedule (day, slots) values
(1, '[{"opening":"09:30","closing":"14:00"},{"opening":"16:00","closing":"20:30"}]'),
(2, '[{"opening":"09:30","closing":"14:00"},{"opening":"16:30","closing":"20:30"}]'),
(3, '[{"opening":"09:30","closing":"14:00"},{"opening":"16:30","closing":"20:30"}]'),
(4, '[{"opening":"09:30","closing":"14:00"},{"opening":"16:30","closing":"20:30"}]'),
(5, '[{"opening":"09:30","closing":"13:00"},{"opening":"16:30","closing":"20:30"}]'),
(6, '[{"opening":"09:30","closing":"14:30"},{"opening":"16:30","closing":"20:30"}]'),
(7, '[]')
on conflict (day) do nothing;

insert into public.team_members (name, role, photo, sort)
select 'Mohamed Amziane Goua', 'Barbero y dueño', 'assets/propietario.png', 1
where not exists (select 1 from public.team_members);

insert into public.gallery_items (image, alt, caption, contain, sort)
select * from (values
  ('assets/barbero-local.png', 'Barbero de IRUÑARTEA en su barbería', 'Oficio', false, 1),
  ('assets/local-interior.png', 'Interior de la barbería IRUÑARTEA con dos sillones y espejos', 'El local', false, 2),
  ('assets/logo-irunartea.png', 'Logotipo de IRUÑARTEA', 'IRUÑARTEA', true, 3)
) as v(image, alt, caption, contain, sort)
where not exists (select 1 from public.gallery_items);

-- ───────────── Dar acceso de administrador (cambiar el correo y ejecutar una vez) ─────────────
-- insert into public.admins (user_id) select id from auth.users where email = 'tu-correo@ejemplo.com';
