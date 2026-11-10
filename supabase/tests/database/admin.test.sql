begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-00000000aa01', '919866600001', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000aa02', '919866600002', now(), 'authenticated', 'authenticated');
insert into public.platform_admins values ('00000000-0000-0000-0000-00000000aa01');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- An ordinary user
select pg_temp.login('00000000-0000-0000-0000-00000000aa02');
set local role authenticated;
select throws_ok($$ select public.admin_dashboard() $$, '42501', 'not_allowed', 'ordinary users cannot open the admin dashboard');
select throws_ok($$ select * from public.admin_responders(null) $$, '42501', 'not_allowed', 'or list responders');
select throws_ok($$ select public.admin_flag_fake_sos('00000000-0000-0000-0000-00000000aa02') $$, '42501', 'not_allowed', 'or suspend anyone');
select lives_ok($$ insert into public.reports (subject_type, subject_id, reason, details) values ('place', 'x', 'wrong_info', 'Phone number is wrong') $$,
  'anyone signed in can report a problem');
select is((select count(*)::int from public.reports), 1, 'and sees only their own reports');
select throws_ok($$ insert into public.reports (subject_type, reason, status) values ('other', 'other', 'resolved') $$,
  '42501', null, 'reporters cannot mark their report resolved');
reset role;

-- The admin
select pg_temp.login('00000000-0000-0000-0000-00000000aa01');
set local role authenticated;
select ok((public.admin_dashboard()) ? 'responders_pending', 'admin sees the dashboard');
select ok(exists (select 1 from public.admin_reports() where details = 'Phone number is wrong'), 'admin sees reports');
select is(public.admin_flag_fake_sos('00000000-0000-0000-0000-00000000aa02', 'prank'), 'warned', 'first fake SOS → warning');
select is(public.admin_flag_fake_sos('00000000-0000-0000-0000-00000000aa02', 'again'), 'suspended', 'second → suspended');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000aa02');
set local role authenticated;
select throws_ok($$ select public.sos_create(12.9716, 77.5946) $$, 'P0001', 'sos_suspended', 'a suspended user cannot raise SOS alerts');
reset role;
select ok((select sos_suspended_until > now() + interval '80 days' from public.profiles where id = '00000000-0000-0000-0000-00000000aa02'),
  'suspension lasts 90 days');

select * from finish();
rollback;
