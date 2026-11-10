begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000bb001', '919877700001', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000bb002', '919877700002', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000bb009', '919877700009', now(), 'authenticated', 'authenticated');
insert into public.platform_admins values ('00000000-0000-0000-0000-0000000bb009');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
insert into public.emergency_contacts (user_id, name, phone) values ('00000000-0000-0000-0000-0000000bb001', 'Amma', '+919845000011');
delete from public.sos_requests;
update public.responders set is_available = false;

-- Download my data
select pg_temp.login('00000000-0000-0000-0000-0000000bb001');
set local role authenticated;
select is(jsonb_array_length((public.export_my_data()) -> 'emergency_contacts'), 1, 'export includes my emergency contacts');
select is((public.export_my_data()) #>> '{profile,phone}', '+919877700001', 'and my profile');
-- an active SOS blocks deletion
create temp table s as select public.sos_create(12.9716, 77.5946) id;
reset role;
update public.sos_requests set status = 'searching' where id = (select id from s);   -- still looking for help
select pg_temp.login('00000000-0000-0000-0000-0000000bb001');
set local role authenticated;
select throws_ok($$ select public.delete_my_account() $$, 'P0001', 'active_sos', 'cannot delete the account during an active SOS');
select public.sos_cancel((select id from s));
select lives_ok($$ select public.delete_my_account() $$, 'delete my account');
reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000bb001'), 0, 'account removed');
select is((select count(*)::int from public.emergency_contacts where user_id = '00000000-0000-0000-0000-0000000bb001'), 0, 'contacts removed');
select is((select count(*)::int from public.sos_requests where id = (select id from s)), 0, 'their SOS history removed');

-- Retention: a 100-day-old SOS gets its trail deleted and its point blurred
insert into public.sos_requests (id, raised_by, location, note, accuracy_m, status, created_at)
values ('00000000-0000-0000-0000-0000000cc001', '00000000-0000-0000-0000-0000000bb002',
        extensions.st_setsrid(extensions.st_point(77.594612, 12.971634), 4326)::extensions.geography, 'near the bakery', 12, 'closed', now() - interval '100 days');
insert into public.sos_events (sos_id, kind, location, created_at) values
  ('00000000-0000-0000-0000-0000000cc001', 'location', extensions.st_setsrid(extensions.st_point(77.6, 12.97), 4326)::extensions.geography, now() - interval '100 days');
select ok((public.purge_old_data() ->> 'location_points_deleted')::int >= 1, 'old location trail deleted');
select is((select note from public.sos_requests where id = '00000000-0000-0000-0000-0000000cc001'), null, 'free-text note removed');
select is((select round(extensions.st_x(location::extensions.geometry)::numeric, 6) from public.sos_requests where id = '00000000-0000-0000-0000-0000000cc001'),
          77.590000, 'point blurred to ~1 km');

-- Audit log
update public.profiles set full_name = 'X' where id = '00000000-0000-0000-0000-0000000bb002';
select pg_temp.login('00000000-0000-0000-0000-0000000bb009');
set local role authenticated;
select public.admin_flag_fake_sos('00000000-0000-0000-0000-0000000bb002', 'prank');
select is((select actor from public.admin_audit where target_id = '00000000-0000-0000-0000-0000000bb002' order by id desc limit 1),
          '00000000-0000-0000-0000-0000000bb009'::uuid, 'admin actions are logged with who did them');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000bb002');
set local role authenticated;
select is((select count(*)::int from public.admin_audit), 0, 'ordinary users cannot read the audit log');
select throws_ok($$ select public.purge_old_data() $$, '42501', null, 'only the server can run the clean-up');
reset role;

select * from finish();
rollback;
