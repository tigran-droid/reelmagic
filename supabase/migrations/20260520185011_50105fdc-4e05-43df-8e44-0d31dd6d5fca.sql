ALTER TABLE public.photoshop_items ADD COLUMN IF NOT EXISTS prompt text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS prompt text;