
-- 1) Lock down public-write tables to admins only
DROP POLICY IF EXISTS "Anyone can insert photoshop items" ON public.photoshop_items;
DROP POLICY IF EXISTS "Anyone can update photoshop items" ON public.photoshop_items;
DROP POLICY IF EXISTS "Anyone can delete photoshop items" ON public.photoshop_items;
CREATE POLICY "Admins can insert photoshop items" ON public.photoshop_items
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update photoshop items" ON public.photoshop_items
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete photoshop items" ON public.photoshop_items
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can insert photoshop sections" ON public.photoshop_sections;
DROP POLICY IF EXISTS "Anyone can update photoshop sections" ON public.photoshop_sections;
DROP POLICY IF EXISTS "Anyone can delete photoshop sections" ON public.photoshop_sections;
CREATE POLICY "Admins can insert photoshop sections" ON public.photoshop_sections
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update photoshop sections" ON public.photoshop_sections
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete photoshop sections" ON public.photoshop_sections
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can insert reels" ON public.reels;
DROP POLICY IF EXISTS "Anyone can update reels" ON public.reels;
DROP POLICY IF EXISTS "Anyone can delete reels" ON public.reels;
CREATE POLICY "Admins can insert reels" ON public.reels
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update reels" ON public.reels
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete reels" ON public.reels
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can insert video items" ON public.video_items;
DROP POLICY IF EXISTS "Anyone can update video items" ON public.video_items;
DROP POLICY IF EXISTS "Anyone can delete video items" ON public.video_items;
CREATE POLICY "Admins can insert video items" ON public.video_items
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update video items" ON public.video_items
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete video items" ON public.video_items
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 2) Storage buckets: restrict writes to admins only on shared buckets
DROP POLICY IF EXISTS "Anyone can upload photoshop audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update photoshop audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete photoshop audio" ON storage.objects;
CREATE POLICY "Admins upload photoshop audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photoshop-audio' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update photoshop audio" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'photoshop-audio' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete photoshop audio" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'photoshop-audio' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Public upload reel-images" ON storage.objects;
CREATE POLICY "Admins upload reel-images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reel-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update reel-images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'reel-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete reel-images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'reel-images' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Public upload reel-audio" ON storage.objects;
CREATE POLICY "Admins upload reel-audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reel-audio' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update reel-audio" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'reel-audio' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete reel-audio" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'reel-audio' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone upload video-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone update video-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone delete video-files" ON storage.objects;
CREATE POLICY "Admins upload video-files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'video-files' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update video-files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'video-files' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete video-files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'video-files' AND public.is_admin(auth.uid()));

-- 3) Private user-images bucket: only owners can read their files
DROP POLICY IF EXISTS "user-images read" ON storage.objects;
CREATE POLICY "user-images read own" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'user-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- 4) Tighten profiles self-update WITH CHECK (defence in depth alongside existing trigger)
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid())
    AND credits  = (SELECT p.credits  FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 5) image_generation_jobs: add owner-scoped policy (service role bypasses RLS for edge functions)
ALTER TABLE public.image_generation_jobs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "image_generation_jobs_owner_read" ON public.image_generation_jobs;
CREATE POLICY "image_generation_jobs_owner_read" ON public.image_generation_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
