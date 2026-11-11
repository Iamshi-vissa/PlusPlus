-- "Describe your problem" matcher: per-user rate limit for the suggest-problems Edge Function.
-- Only a timestamp per call is kept (never the text), and only for a day.

create table public.ai_suggest_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_suggest_calls_user_time on public.ai_suggest_calls (user_id, created_at desc);
alter table public.ai_suggest_calls enable row level security;
-- no policies: only the function below touches this table

-- Returns true and records the call if the signed-in user has made fewer than 20 calls in the last hour.
create function public.ai_suggest_allow() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  recent int;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from public.ai_suggest_calls where user_id = uid and created_at < now() - interval '1 day';
  select count(*) into recent from public.ai_suggest_calls
    where user_id = uid and created_at > now() - interval '1 hour';
  if recent >= 20 then
    return false;
  end if;
  insert into public.ai_suggest_calls (user_id) values (uid);
  return true;
end;
$$;

revoke execute on function public.ai_suggest_allow() from public, anon;
grant execute on function public.ai_suggest_allow() to authenticated;
