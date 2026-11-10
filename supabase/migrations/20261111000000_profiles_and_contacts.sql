-- Phase 2: profiles and emergency contacts.
-- Every table has Row Level Security: a user can only ever see and change their own rows.
-- The medical profile (blood group, allergies, conditions) is NOT here yet; it arrives with
-- column encryption and SOS-time consent in a later migration.

-- ---------------------------------------------------------------------------
-- profiles: one row per signed-in person, created automatically at sign-up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 100),
  phone text unique,                      -- copied from auth.users; users cannot edit it here
  language text not null default 'en' check (language in ('en', 'kn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: rows are created by the sign-up trigger and removed with the account.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, language) on public.profiles to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- auth.users stores phone numbers without the leading '+'; profiles store E.164 (+91...).
create function public.e164(phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when phone is null or phone = '' then null
    when left(phone, 1) = '+' then phone
    else '+' || phone
  end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, public.e164(new.phone));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set phone = public.e164(new.phone) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_phone_changed
  after update of phone on auth.users
  for each row
  when (old.phone is distinct from new.phone)
  execute function public.handle_user_phone_change();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_phone_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- emergency_contacts: up to 5 per user. They get an SMS with a live location
-- link when the user raises an SOS (phase 7).
-- ---------------------------------------------------------------------------
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  phone text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),   -- Indian mobile, E.164
  relation text check (relation is null or char_length(relation) <= 30),
  created_at timestamptz not null default now(),
  unique (user_id, phone)
);

create index emergency_contacts_user_id_idx on public.emergency_contacts (user_id);

alter table public.emergency_contacts enable row level security;

create policy "emergency_contacts: read own" on public.emergency_contacts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "emergency_contacts: add own" on public.emergency_contacts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "emergency_contacts: edit own" on public.emergency_contacts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "emergency_contacts: remove own" on public.emergency_contacts
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.emergency_contacts from anon, authenticated;
grant select, insert, delete on public.emergency_contacts to authenticated;
grant update (name, phone, relation) on public.emergency_contacts to authenticated;

-- Limit of 5 contacts. The profile row is locked first so two inserts at the same
-- moment can't both see "4" and end up with 6.
create function public.enforce_emergency_contact_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles where id = new.user_id for update;
  if (select count(*) from public.emergency_contacts where user_id = new.user_id) >= 5 then
    raise exception 'emergency_contacts_limit' using errcode = 'P0001',
      hint = 'A user can have at most 5 emergency contacts.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_emergency_contact_limit() from public, anon, authenticated;

create trigger emergency_contacts_limit
  before insert on public.emergency_contacts
  for each row execute function public.enforce_emergency_contact_limit();
