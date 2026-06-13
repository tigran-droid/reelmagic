
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  template_title text,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_images TO authenticated;
GRANT ALL ON public.user_images TO service_role;

ALTER TABLE public.user_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_images_select_own ON public.user_images
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_images_insert_own ON public.user_images
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY user_images_delete_own ON public.user_images
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS user_images_user_id_created_at_idx
  ON public.user_images (user_id, created_at DESC);

DROP POLICY IF EXISTS "avatars read" ON storage.objects;
CREATE POLICY "avatars read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars write own" ON storage.objects;
CREATE POLICY "avatars write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user-images read" ON storage.objects;
CREATE POLICY "user-images read" ON storage.objects FOR SELECT
  USING (bucket_id = 'user-images');
DROP POLICY IF EXISTS "user-images write own" ON storage.objects;
CREATE POLICY "user-images write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-images' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "user-images delete own" ON storage.objects;
CREATE POLICY "user-images delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-images' AND (storage.foldername(name))[1] = auth.uid()::text);
