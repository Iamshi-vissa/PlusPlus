begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
-- start from an empty directory (all rolled back at the end)
delete from public.sos_requests; delete from public.reviews; delete from public.appointments; delete from public.places;

select ok(public.import_place('osm', 'node/1', '{"name_en":"Victoria Hospital","type":"hospital","lat":12.9550,"lng":77.5730,"has_emergency":true}') is not null, 'new place is added');
select is((select count(*)::int from public.places), 1, 'one place');
select ok(public.import_place('osm', 'node/1', '{"name_en":"Victoria Hospital","type":"hospital","lat":12.9550,"lng":77.5730,"phone":"+918026701150"}') is not null, 're-import by same id');
select is((select count(*)::int from public.places), 1, 'same id → updated, not duplicated');
select ok(public.import_place('google', 'ChIJabc', '{"name_en":"Victoria Hospital Bangalore","type":"hospital","lat":12.9553,"lng":77.5732}') is not null, 'same hospital from Google');
select is((select count(*)::int from public.places), 1, 'within 75 m + similar name → merged');
select is(public.import_place('osm', 'node/9', '{"name_en":"Chennai Clinic","type":"clinic","lat":13.08,"lng":80.27}'), null, 'outside Karnataka is skipped');
select * from finish();
rollback;
