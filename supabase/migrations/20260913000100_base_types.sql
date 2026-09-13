-- Galena AI · tipos compartidos y utilidades comunes.

create type public.detector_status as enum ('active', 'beta', 'deprecated');
create type public.evaluation_split as enum ('train', 'val', 'test', 'alternate');
create type public.detection_input_type as enum ('json', 'audio_upload', 'api');
create type public.detection_status as enum ('completed', 'failed');
create type public.auth_provider as enum ('email', 'google', 'github');
create type public.app_role as enum ('admin', 'analyst', 'viewer');
create type public.theme_preference as enum ('light', 'dark', 'system');
create type public.language_preference as enum ('es', 'en');

-- Mantiene updated_at al día en cualquier tabla que la tenga.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
