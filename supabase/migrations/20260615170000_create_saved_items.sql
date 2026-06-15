-- Templates a user bookmarks ("Save") from the feed, shown in the account's
-- Saved tab. Covers come from public buckets, so we store the cover url for
-- instant display without re-signing.
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  source text not null default 'photoshop',
  title text,
  image_url text,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

alter table public.saved_items enable row level security;

create index if not exists saved_items_user_created_idx
  on public.saved_items (user_id, created_at desc);

drop policy if exists "saved_items_select_own" on public.saved_items;
create policy "saved_items_select_own" on public.saved_items
  for select using (auth.uid() = user_id);

drop policy if exists "saved_items_insert_own" on public.saved_items;
create policy "saved_items_insert_own" on public.saved_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_items_delete_own" on public.saved_items;
create policy "saved_items_delete_own" on public.saved_items
  for delete using (auth.uid() = user_id);
