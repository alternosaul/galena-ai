-- Galena AI · configuración de conexión con la API de modelos (página API).
-- Fila única. Los secretos (MODEL_API_KEY, service role, etc.) NUNCA se guardan aquí:
-- viven como variables de entorno del servidor.

create table public.app_settings (
  id boolean primary key default true check (id),
  model_api_url text,
  timeout_seconds smallint not null default 30 check (timeout_seconds between 1 and 120),
  retries smallint not null default 1 check (retries between 0 and 5),
  default_detector_id text references public.detectors (id) on delete set null,
  input_format text not null default 'json' check (input_format in ('json', 'multipart')),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();
