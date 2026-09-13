-- Galena AI · Storage: fotos de perfil y audios de llamadas.
-- Estructura de rutas: <user_id>/<archivo>. Cada usuario solo escribe en su carpeta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('call-audio', 'call-audio', false, 26214400, array['audio/wav', 'audio/x-wav', 'audio/wave'])
on conflict (id) do nothing;

-- Avatares: lectura pública, escritura en la carpeta propia.
create policy "avatars are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy "users upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users update own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Audios de llamadas: privados, solo su dueño.
create policy "users read own call audio"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'call-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users upload own call audio"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'call-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete own call audio"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'call-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
