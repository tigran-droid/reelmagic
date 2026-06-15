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

grant select, insert, update, delete on public.saved_items to authenticated;
grant all on public.saved_items to service_role;

alter table public.saved_items enable row level security;

create index if not exists saved_items_user_created_idx on public.saved_items (user_id, created_at desc);

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_items' and policyname='saved_items_select_own') then
    create policy "saved_items_select_own" on public.saved_items for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_items' and policyname='saved_items_insert_own') then
    create policy "saved_items_insert_own" on public.saved_items for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_items' and policyname='saved_items_delete_own') then
    create policy "saved_items_delete_own" on public.saved_items for delete using (auth.uid() = user_id);
  end if;
end $$;

alter table public.photoshop_items add column if not exists keep_template_outfit boolean not null default false;