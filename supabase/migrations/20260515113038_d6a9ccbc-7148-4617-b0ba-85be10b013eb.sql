
create table public.reels (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  hashtags text[] not null default '{}',
  song text,
  image_url text not null,
  audio_url text,
  created_at timestamptz not null default now()
);

alter table public.reels enable row level security;

create policy "Reels are viewable by everyone"
  on public.reels for select
  using (true);

create policy "Anyone can insert reels"
  on public.reels for insert
  with check (true);

create policy "Anyone can delete reels"
  on public.reels for delete
  using (true);

insert into storage.buckets (id, name, public)
values ('reel-images', 'reel-images', true),
       ('reel-audio', 'reel-audio', true);

create policy "Public read reel-images"
  on storage.objects for select
  using (bucket_id = 'reel-images');

create policy "Public upload reel-images"
  on storage.objects for insert
  with check (bucket_id = 'reel-images');

create policy "Public read reel-audio"
  on storage.objects for select
  using (bucket_id = 'reel-audio');

create policy "Public upload reel-audio"
  on storage.objects for insert
  with check (bucket_id = 'reel-audio');
