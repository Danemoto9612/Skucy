-- ============================================================================
-- Skucy · esquema de base de datos para Supabase (plan gratuito)
-- Pégalo completo en  Supabase → SQL Editor → New query → Run.  Es seguro ejecutarlo varias veces.
--
-- Diseño: cada entidad del dominio es una tabla con la forma
--     id text (clave primaria) · data jsonb (el objeto) · created_at · updated_at
-- Solo la Edge Function `api` (rol de servicio, que se salta RLS) habla con estas tablas.
-- RLS queda ACTIVADO sin políticas y se revocan los permisos de anon/authenticated:
-- nadie puede leer ni escribir con la clave pública (publishable/anon), ni desde la app.
-- ============================================================================

create or replace function public.skucy_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table if not exists public.institutions (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.institutions enable row level security;
revoke all on table public.institutions from anon, authenticated;
drop trigger if exists institutions_touch on public.institutions;
create trigger institutions_touch before update on public.institutions
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.faculties (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.faculties enable row level security;
revoke all on table public.faculties from anon, authenticated;
drop trigger if exists faculties_touch on public.faculties;
create trigger faculties_touch before update on public.faculties
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.degrees (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.degrees enable row level security;
revoke all on table public.degrees from anon, authenticated;
drop trigger if exists degrees_touch on public.degrees;
create trigger degrees_touch before update on public.degrees
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.subjects (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subjects enable row level security;
revoke all on table public.subjects from anon, authenticated;
drop trigger if exists subjects_touch on public.subjects;
create trigger subjects_touch before update on public.subjects
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.communities (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.communities enable row level security;
revoke all on table public.communities from anon, authenticated;
drop trigger if exists communities_touch on public.communities;
create trigger communities_touch before update on public.communities
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.users (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;
drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.follows (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.follows enable row level security;
revoke all on table public.follows from anon, authenticated;
drop trigger if exists follows_touch on public.follows;
create trigger follows_touch before update on public.follows
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.contents (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contents enable row level security;
revoke all on table public.contents from anon, authenticated;
drop trigger if exists contents_touch on public.contents;
create trigger contents_touch before update on public.contents
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.ratings (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ratings enable row level security;
revoke all on table public.ratings from anon, authenticated;
drop trigger if exists ratings_touch on public.ratings;
create trigger ratings_touch before update on public.ratings
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.saved (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.saved enable row level security;
revoke all on table public.saved from anon, authenticated;
drop trigger if exists saved_touch on public.saved;
create trigger saved_touch before update on public.saved
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.views (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.views enable row level security;
revoke all on table public.views from anon, authenticated;
drop trigger if exists views_touch on public.views;
create trigger views_touch before update on public.views
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.reports (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;
drop trigger if exists reports_touch on public.reports;
create trigger reports_touch before update on public.reports
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.notifications (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
drop trigger if exists notifications_touch on public.notifications;
create trigger notifications_touch before update on public.notifications
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.applications (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.applications enable row level security;
revoke all on table public.applications from anon, authenticated;
drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.institution_requests (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.institution_requests enable row level security;
revoke all on table public.institution_requests from anon, authenticated;
drop trigger if exists institution_requests_touch on public.institution_requests;
create trigger institution_requests_touch before update on public.institution_requests
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.audit_logs (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on table public.audit_logs from anon, authenticated;
drop trigger if exists audit_logs_touch on public.audit_logs;
create trigger audit_logs_touch before update on public.audit_logs
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.refresh_tokens (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.refresh_tokens enable row level security;
revoke all on table public.refresh_tokens from anon, authenticated;
drop trigger if exists refresh_tokens_touch on public.refresh_tokens;
create trigger refresh_tokens_touch before update on public.refresh_tokens
  for each row execute function public.skucy_touch_updated_at();

create table if not exists public.app_settings (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;
drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.skucy_touch_updated_at();

-- ── Índices y restricciones útiles ──────────────────────────────────────────
create unique index if not exists users_email_uidx  on public.users ((lower(data->>'email')));
create unique index if not exists users_handle_uidx on public.users ((data->>'handle'));
create index if not exists contents_status_idx   on public.contents ((data->>'status'));
create index if not exists contents_creator_idx  on public.contents ((data->>'creatorId'));
create index if not exists contents_subject_idx  on public.contents ((data->>'subjectId'));
create index if not exists notifications_user_idx on public.notifications ((data->>'userId'));
create index if not exists refresh_tokens_hash_idx on public.refresh_tokens ((data->>'hash'));

-- ── Funciones que usa la Edge Function `api` ────────────────────────────────
-- Cada tabla tiene un número de versión (skucy_versions) que sube en 1 con cada escritura.
--   skucy_load_changed(known): devuelve las versiones actuales y SOLO las tablas cuya versión cambió respecto
--                              a la que la función ya tiene en caché (si nada cambió, no se descarga ningún dato).
--   skucy_apply(changes, expected): aplica los cambios en UNA transacción SOLO si las tablas siguen en la versión
--                              esperada (si otra petición escribió antes, falla con SKUCY_CONFLICT y la función repite).
-- Solo las puede ejecutar el rol de servicio (la función de Supabase); anon/authenticated no.
drop function if exists public.skucy_load_all();
drop function if exists public.skucy_apply(jsonb);

create table if not exists public.skucy_versions (
  name    text primary key,
  version bigint not null default 0
);
alter table public.skucy_versions enable row level security;
revoke all on table public.skucy_versions from anon, authenticated;
insert into public.skucy_versions (name)
  select unnest(array['institutions', 'faculties', 'degrees', 'subjects', 'communities', 'users', 'follows', 'contents', 'ratings', 'saved', 'views', 'reports', 'notifications', 'applications', 'institution_requests', 'audit_logs', 'refresh_tokens', 'app_settings'])
  on conflict (name) do nothing;

create or replace function public.skucy_load_changed(known jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable as $$
declare
  v record;
  out_versions jsonb := '{}'::jsonb;
  out_tables   jsonb := '{}'::jsonb;
  rows         jsonb;
begin
  for v in select name, version from public.skucy_versions loop
    out_versions := out_versions || jsonb_build_object(v.name, v.version);
    if (known ->> v.name) is distinct from v.version::text then
      execute format('select coalesce(jsonb_agg(data order by id), ''[]''::jsonb) from public.%I', v.name) into rows;
      out_tables := out_tables || jsonb_build_object(v.name, rows);
    end if;
  end loop;
  return jsonb_build_object('versions', out_versions, 'tables', out_tables);
end $$;

create or replace function public.skucy_apply(changes jsonb, expected jsonb default '{}'::jsonb)
returns jsonb language plpgsql as $$
declare
  c jsonb;
  t text;
  cur bigint;
  result jsonb := '{}'::jsonb;
begin
  -- 1) Bloquea y verifica la versión de cada tabla a modificar (en orden alfabético: evita interbloqueos).
  for t in select distinct x ->> 'table' from jsonb_array_elements(changes) x order by 1 loop
    if t not in ('institutions', 'faculties', 'degrees', 'subjects', 'communities', 'users', 'follows', 'contents', 'ratings', 'saved', 'views', 'reports', 'notifications', 'applications', 'institution_requests', 'audit_logs', 'refresh_tokens', 'app_settings') then
      raise exception 'Tabla no permitida: %', t;
    end if;
    select version into cur from public.skucy_versions where name = t for update;
    if cur is distinct from (expected ->> t)::bigint then
      raise exception 'SKUCY_CONFLICT: %', t using errcode = '40001';
    end if;
  end loop;
  -- 2) Aplica los cambios.
  for c in select * from jsonb_array_elements(changes) loop
    t := c ->> 'table';
    if jsonb_array_length(coalesce(c -> 'upserts', '[]'::jsonb)) > 0 then
      execute format(
        'insert into public.%I (id, data) select r ->> ''id'', r -> ''data'' from jsonb_array_elements($1) as r '
        'on conflict (id) do update set data = excluded.data', t)
      using c -> 'upserts';
    end if;
    if jsonb_array_length(coalesce(c -> 'deletes', '[]'::jsonb)) > 0 then
      execute format('delete from public.%I where id in (select jsonb_array_elements_text($1))', t)
      using c -> 'deletes';
    end if;
  end loop;
  -- 3) Sube la versión de las tablas modificadas y devuelve las nuevas.
  for t in select distinct x ->> 'table' from jsonb_array_elements(changes) x order by 1 loop
    update public.skucy_versions set version = version + 1 where name = t returning version into cur;
    result := result || jsonb_build_object(t, cur);
  end loop;
  return result;
end $$;

revoke all on function public.skucy_load_changed(jsonb) from public, anon, authenticated;
revoke all on function public.skucy_apply(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.skucy_load_changed(jsonb) to service_role;
grant execute on function public.skucy_apply(jsonb, jsonb) to service_role;

-- ── Storage: buckets para foto de perfil, portadas y videos ────────────────
-- avatars y thumbnails son públicos (solo lectura por URL); videos es PRIVADO:
-- el backend entrega una URL firmada de 1 hora solo a quien tiene acceso al contenido.
-- 52428800 bytes = 50 MB, el máximo por archivo del plan gratuito.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',    'avatars',    true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('thumbnails', 'thumbnails', true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('videos',     'videos',     false, 52428800, array['video/mp4','video/quicktime','video/webm','video/x-m4v','video/3gpp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
