ALTER TABLE public.image_generation_jobs
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_request_hash_created_at
  ON public.image_generation_jobs (request_hash, created_at DESC)
  WHERE request_hash IS NOT NULL;
