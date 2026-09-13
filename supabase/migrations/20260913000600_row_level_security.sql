-- Galena AI · Row Level Security.
-- Mientras la autenticación del sitio sea simulada, el servidor usa la service role key
-- (que ignora RLS). Estas políticas quedan listas para cuando se active Supabase Auth.

alter table public.detectors enable row level security;
alter table public.detector_evaluations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.detections enable row level security;
alter table public.app_settings enable row level security;

-- ── Catálogo de detectores: lectura pública, escritura solo admins ─────────────
create policy "detectors are readable by everyone"
  on public.detectors for select
  to anon, authenticated
  using (true);

create policy "admins insert detectors"
  on public.detectors for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "admins update detectors"
  on public.detectors for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "admins delete detectors"
  on public.detectors for delete
  to authenticated
  using ((select public.is_admin()));

create policy "evaluations are readable by everyone"
  on public.detector_evaluations for select
  to anon, authenticated
  using (true);

create policy "admins insert evaluations"
  on public.detector_evaluations for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "admins update evaluations"
  on public.detector_evaluations for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "admins delete evaluations"
  on public.detector_evaluations for delete
  to authenticated
  using ((select public.is_admin()));

-- ── Perfiles: cada quien ve y edita el suyo ─────────────────────────────────────
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Un usuario solo puede cambiar nombre y avatar; rol, correo y fechas los gestiona el servidor.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ── Preferencias ────────────────────────────────────────────────────────────────
create policy "users read own preferences"
  on public.user_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users insert own preferences"
  on public.user_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users update own preferences"
  on public.user_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Historial: propio (o todo, si es admin). Es inmutable: no hay política de update ──
create policy "users read own detections"
  on public.detections for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "users insert own detections"
  on public.detections for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users delete own detections"
  on public.detections for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ── Configuración de la API: lectura para usuarios, cambios solo admins ─────────
create policy "authenticated users read app settings"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "admins update app settings"
  on public.app_settings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
