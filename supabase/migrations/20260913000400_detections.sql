-- Galena AI · historial de detecciones (página Historial).
-- Una fila por petición a la API de modelos. Nunca se guarda el audio en base64:
-- si se conserva el WAV, va al bucket privado call-audio y aquí solo su ruta.

create table public.detections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  detector_id text not null references public.detectors (id),
  -- Header X-Detection-ID que devuelve la API galena-live.
  api_detection_id uuid unique,
  call_id text not null check (length(trim(call_id)) > 0),
  input_type public.detection_input_type not null,
  source text,
  file_name text,
  audio_path text,
  audio_sha256 text check (audio_sha256 ~ '^[0-9a-f]{64}$'),
  audio_bytes integer check (audio_bytes >= 0),
  duration_sec numeric(8, 3) check (duration_sec >= 0),
  sample_rate integer check (sample_rate > 0),
  channels smallint check (channels > 0),
  status public.detection_status not null default 'completed',
  is_synthetic boolean,
  -- P(sintético) según el detector, entre 0 y 1.
  confidence numeric(7, 6) check (confidence between 0 and 1),
  threshold numeric(4, 3) check (threshold between 0 and 1),
  http_status smallint,
  error_message text,
  latency_ms integer check (latency_ms >= 0),
  processing_seconds numeric(10, 4) check (processing_seconds >= 0),
  request_metadata jsonb not null default '{}'::jsonb,
  response_json jsonb,
  created_at timestamptz not null default now(),
  constraint detections_completed_has_result check (
    status <> 'completed' or (is_synthetic is not null and confidence is not null)
  ),
  constraint detections_no_audio_payload check (not (request_metadata ? 'audio_base64'))
);

comment on table public.detections is 'Historial de análisis de llamadas; no contiene audio.';

create index detections_user_created_idx on public.detections (user_id, created_at desc);
create index detections_created_idx on public.detections (created_at desc);
create index detections_detector_created_idx on public.detections (detector_id, created_at desc);
create index detections_call_id_idx on public.detections (call_id);
