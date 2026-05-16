ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS audio_start_sec numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_end_sec numeric;