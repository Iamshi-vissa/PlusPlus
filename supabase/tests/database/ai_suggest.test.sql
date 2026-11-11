begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000dd001', '919877700101', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000dd002', '919877700102', now(), 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- signed out: no access
set local role anon;
select throws_ok($$ select public.ai_suggest_allow() $$, '42501', null, 'anonymous callers cannot use the matcher');
reset role;

-- 20 calls an hour, then refused
select pg_temp.login('00000000-0000-0000-0000-0000000dd001');
set local role authenticated;
select is((select bool_and(public.ai_suggest_allow()) from generate_series(1, 20)), true, 'first 20 calls in an hour are allowed');
select is(public.ai_suggest_allow(), false, 'the 21st call is refused');
select is((select count(*)::int from public.ai_suggest_calls), 0, 'users cannot read the call log');
reset role;

-- the limit is per user
select pg_temp.login('00000000-0000-0000-0000-0000000dd002');
set local role authenticated;
select is(public.ai_suggest_allow(), true, 'another user is not affected');
reset role;

-- old calls stop counting
update public.ai_suggest_calls set created_at = now() - interval '2 hours'
  where user_id = '00000000-0000-0000-0000-0000000dd001';
select pg_temp.login('00000000-0000-0000-0000-0000000dd001');
set local role authenticated;
select is(public.ai_suggest_allow(), true, 'calls older than an hour no longer count');
reset role;

select * from finish();
rollback;
