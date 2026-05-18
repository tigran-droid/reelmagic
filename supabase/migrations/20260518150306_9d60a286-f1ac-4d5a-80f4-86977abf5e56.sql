CREATE TABLE public.video_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  hashtags text[] NOT NULL DEFAULT '{}',
  song text,
  cover_image_url text NOT NULL,
  sample_video_url text,
  prompt text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Video items viewable by everyone" ON public.video_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert video items" ON public.video_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update video items" ON public.video_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete video items" ON public.video_items FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('video-files', 'video-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read video-files" ON storage.objects FOR SELECT USING (bucket_id = 'video-files');
CREATE POLICY "Anyone upload video-files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'video-files');
CREATE POLICY "Anyone update video-files" ON storage.objects FOR UPDATE USING (bucket_id = 'video-files');
CREATE POLICY "Anyone delete video-files" ON storage.objects FOR DELETE USING (bucket_id = 'video-files');