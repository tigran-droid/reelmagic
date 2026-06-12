-- =====================================================================
--  Magic Studio — Credits + Admin setup
--  Run this ENTIRE file once in the Supabase SQL editor
--  (Lovable Cloud → SQL editor → paste → Run).
--  Safe to run more than once.
-- =====================================================================

-- 1) Profiles table: one row per user, holds their credit balance.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  credits     integer not null default 10,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 2) Helper that tells us whether a user is an admin.
--    SECURITY DEFINER so it can read profiles without tripping RLS recursion.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- 3) Turn on Row Level Security.
alter table public.profiles enable row level security;

-- 4) Read policy: a user can read their own row; an admin can read everyone.
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select using ( id = auth.uid() or public.is_admin(auth.uid()) );

-- 5) Update policy: only admins can directly UPDATE rows
--    (regular users change credits ONLY through the deduct_credits function below,
--     so they can never just set their own balance to a million).
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using ( public.is_admin(auth.uid()) );

-- 6) Auto-create a profile whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, credits, is_admin)
  values (
    new.id,
    new.email,
    10,  -- free starting credits
    new.email in ('tigran@aheadofthewave.ai', 'tigrangregoryan@gmail.com')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7) Atomic credit deduction. Called by the app on every successful generation.
--    Raises if the user does not have enough credits.
create or replace function public.deduct_credits(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_credits integer;
begin
  select credits into current_credits
    from public.profiles where id = auth.uid() for update;

  if current_credits is null then
    raise exception 'No profile found';
  end if;
  if current_credits < p_amount then
    raise exception 'Insufficient credits';
  end if;

  update public.profiles
    set credits = credits - p_amount
    where id = auth.uid();

  return current_credits - p_amount;
end;
$$;

-- 8) Admin tops up a user by email. Only admins may call this.
create or replace function public.admin_add_credits(p_email text, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.profiles
    set credits = credits + p_amount
    where lower(email) = lower(p_email)
    returning credits into new_balance;

  if new_balance is null then
    raise exception 'User not found';
  end if;

  return new_balance;
end;
$$;

grant execute on function public.deduct_credits(integer)   to authenticated;
grant execute on function public.admin_add_credits(text, integer) to authenticated;

-- 9) Backfill: give every EXISTING user a profile + mark admins.
insert into public.profiles (id, email, credits, is_admin)
select id, email, 10,
       email in ('tigran@aheadofthewave.ai', 'tigrangregoryan@gmail.com')
from auth.users
on conflict (id) do nothing;

update public.profiles
  set is_admin = true
  where lower(email) in ('tigran@aheadofthewave.ai', 'tigrangregoryan@gmail.com');

-- Done. ✅
