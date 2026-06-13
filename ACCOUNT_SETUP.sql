-- =====================================================================
--  Account features: profile name/avatar + generated images gallery
--  Run once in Supabase SQL editor.
-- =====================================================================

-- 1) Add display_name and avatar_url to profiles
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url   text;

-- 2) Generated images table
create table if not exists public.user_images (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  image_url      text        not null,
  template_title text,
  created_at     timestamptz not null default now()
);

alter table public.user_images enable row level security;

drop policy if exists "user_images_own" on public.user_images;
create policy "user_images_own" on public.user_images
  for all using (user_id = auth.uid());

-- 3) Storage bucket for avatars (public read)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4) Storage bucket for generated images (public read)
insert into storage.buckets (id, name, public)
values ('user-images', 'user-images', true)
on conflict (id) do nothing;

drop policy if exists "user_images_insert" on storage.objects;
create policy "user_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'user-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "user_images_select" on storage.objects;
create policy "user_images_select" on storage.objects
  for select using (bucket_id = 'user-images');

-- Done. ✅
