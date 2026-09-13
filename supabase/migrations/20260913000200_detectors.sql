-- Galena AI · catálogo de detectores (modelos) y sus evaluaciones.
-- Los ids coinciden con el parámetro ?detector= de services/model-api.

create table public.detectors (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null,
  -- Archivo ONNX en services/model-api/final_models.
  api_model_name text not null,
  version text not null default '1.0.0',
  description_es text not null default '',
  description_en text not null default '',
  trained_on_es text,
  trained_on_en text,
  status public.detector_status not null default 'active',
  threshold numeric(4, 3) not null check (threshold between 0 and 1),
  sample_rate integer not null default 8000 check (sample_rate > 0),
  channels smallint not null default 2 check (channels > 0),
  is_default boolean not null default false,
  sort_order smallint not null default 0,
  -- 1..3 para los modelos con nombre de montaña (ranking general); null para experimentales.
  display_rank smallint check (display_rank between 1 and 3),
  experimental boolean not null default false,
  family text not null check (family in ('galena', 'acoustic')),
  feature_set text check (feature_set in ('full', 'client_only', 'acoustic-v1-8k')),
  algorithm_es text,
  algorithm_en text,
  features_es text,
  features_en text,
  stereo_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint detectors_rank_not_experimental check (display_rank is null or not experimental)
);

comment on table public.detectors is 'Detectores disponibles en la API de modelos (services/model-api).';

create unique index detectors_unique_rank on public.detectors (display_rank)
  where display_rank is not null;
comment on column public.detectors.threshold is 'Umbral operativo: confidence >= threshold ⇒ is_synthetic.';

-- Solo puede haber un detector predeterminado.
create unique index detectors_single_default on public.detectors (is_default) where is_default;

create trigger detectors_set_updated_at
  before update on public.detectors
  for each row execute function public.set_updated_at();

-- Resultados de evaluación (train/val/test) por detector. La página Modelo
-- calcula precisión, recall, F1, MCC y EER a partir de la matriz de confusión y el AUC.
create table public.detector_evaluations (
  id uuid primary key default gen_random_uuid(),
  detector_id text not null references public.detectors (id) on delete cascade,
  dataset text not null,
  split public.evaluation_split not null,
  evaluated_at timestamptz not null default now(),
  sample_count integer not null check (sample_count > 0),
  threshold numeric(4, 3) not null check (threshold between 0 and 1),
  -- Matriz de confusión (positivo = voz sintética).
  true_positives integer check (true_positives >= 0),
  false_positives integer check (false_positives >= 0),
  true_negatives integer check (true_negatives >= 0),
  false_negatives integer check (false_negatives >= 0),
  accuracy numeric(6, 5) check (accuracy between 0 and 1),
  balanced_accuracy numeric(6, 5) check (balanced_accuracy between 0 and 1),
  precision numeric(6, 5) check (precision between 0 and 1),
  recall numeric(6, 5) check (recall between 0 and 1),
  f1 numeric(6, 5) check (f1 between 0 and 1),
  auc numeric(6, 5) check (auc between 0 and 1),
  brier numeric(6, 5) check (brier between 0 and 1),
  log_loss numeric(8, 5) check (log_loss >= 0),
  r2 numeric(8, 5),
  latency_p50_ms integer check (latency_p50_ms >= 0),
  latency_p95_ms integer check (latency_p95_ms >= 0),
  notes text,
  -- Informe completo del script de entrenamiento/benchmark, sin audio.
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint detector_evaluations_confusion_total check (
    true_positives is null
    or false_positives is null
    or true_negatives is null
    or false_negatives is null
    or true_positives + false_positives + true_negatives + false_negatives = sample_count
  )
);

create index detector_evaluations_detector_split_idx
  on public.detector_evaluations (detector_id, split, evaluated_at desc);

-- Última evaluación de cada detector por dataset (lo que muestra la página Modelo).
create view public.detector_latest_metrics
with (security_invoker = true) as
select distinct on (e.detector_id, e.dataset) e.*
from public.detector_evaluations e
where e.split in ('val', 'test')
order by e.detector_id, e.dataset, e.evaluated_at desc;
