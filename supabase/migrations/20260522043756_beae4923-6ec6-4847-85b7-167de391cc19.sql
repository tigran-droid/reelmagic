CREATE TABLE IF NOT EXISTS public.image_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  image_data_url text,
  error text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.image_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_status_created_at
  ON public.image_generation_jobs (status, created_at DESC);