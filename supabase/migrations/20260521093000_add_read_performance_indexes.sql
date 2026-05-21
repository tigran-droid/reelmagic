CREATE INDEX IF NOT EXISTS idx_photoshop_sections_position_created_at
ON public.photoshop_sections (position, created_at);

CREATE INDEX IF NOT EXISTS idx_photoshop_items_position_created_at
ON public.photoshop_items (position, created_at);

CREATE INDEX IF NOT EXISTS idx_photoshop_items_created_at_desc
ON public.photoshop_items (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_photoshop_items_section_position_created_at
ON public.photoshop_items (section_id, position, created_at);

CREATE INDEX IF NOT EXISTS idx_video_items_position_created_at
ON public.video_items (position, created_at);
