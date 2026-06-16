drop policy if exists "saved_items_insert_own" on public.saved_items;
create policy "saved_items_insert_own" on public.saved_items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "saved_items_delete_own" on public.saved_items;
create policy "saved_items_delete_own" on public.saved_items
  for delete to authenticated using (auth.uid() = user_id);