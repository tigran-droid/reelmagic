
CREATE TABLE public.photoshop_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.photoshop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.photoshop_sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  hashtags text[] NOT NULL DEFAULT '{}',
  song text,
  image_url text NOT NULL,
  image_urls text[] NOT NULL DEFAULT '{}',
  audio_url text,
  audio_start_sec numeric NOT NULL DEFAULT 0,
  audio_end_sec numeric,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_photoshop_items_section ON public.photoshop_items(section_id);

ALTER TABLE public.photoshop_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photoshop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photoshop sections viewable by everyone" ON public.photoshop_sections FOR SELECT USING (true);
CREATE POLICY "Anyone can insert photoshop sections" ON public.photoshop_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update photoshop sections" ON public.photoshop_sections FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete photoshop sections" ON public.photoshop_sections FOR DELETE USING (true);

CREATE POLICY "Photoshop items viewable by everyone" ON public.photoshop_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert photoshop items" ON public.photoshop_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update photoshop items" ON public.photoshop_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete photoshop items" ON public.photoshop_items FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('photoshop-audio', 'photoshop-audio', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Photoshop audio is publicly accessible"
ON storage.objects FOR SELECT USING (bucket_id = 'photoshop-audio');
CREATE POLICY "Anyone can upload photoshop audio"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photoshop-audio');
CREATE POLICY "Anyone can update photoshop audio"
ON storage.objects FOR UPDATE USING (bucket_id = 'photoshop-audio');
CREATE POLICY "Anyone can delete photoshop audio"
ON storage.objects FOR DELETE USING (bucket_id = 'photoshop-audio');
