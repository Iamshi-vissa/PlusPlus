-- LOCAL DEVELOPMENT ONLY: fictional sample doctors and timetables at the registered sample places.
update public.places set verified_at = now() where source = 'demo' and is_registered;

with names(i, name, gender) as (values
  (0,'Dr. Sample Asha Rao','female'), (1,'Dr. Sample Ravi Kumar','male'), (2,'Dr. Sample Meera Hegde','female'),
  (3,'Dr. Sample Prakash Gowda','male'), (4,'Dr. Sample Fatima Khan','female'), (5,'Dr. Sample Suresh Patil','male'),
  (6,'Dr. Sample Lakshmi Iyer','female'), (7,'Dr. Sample Anil Shetty','male'), (8,'Dr. Sample Kavya Naik','female'),
  (9,'Dr. Sample Mohan Reddy','male')),
places as (
  select p.id, p.type, p.specialities, row_number() over (order by p.name_en) - 1 as rn
  from public.places p where p.source = 'demo' and p.is_registered and p.type in ('clinic', 'hospital')
),
doc_rows as (
  -- clinics: one doctor per speciality (max 2); hospitals: a GP plus up to 3 specialists
  select pl.id place_id, sp.code, sp.k, pl.rn
  from places pl
  cross join lateral (
    select code, row_number() over () k from unnest(
      case when pl.type = 'hospital' then array['gp'] || pl.specialities[1:3] else pl.specialities[1:2] end) code
    where code <> 'emergency'
  ) sp
)
insert into public.doctors (place_id, name, gender, specialities, qualifications, years_experience, languages, fee,
                            nmc_registration_no, verified_at, rating_sum, rating_count)
select dr.place_id, n.name, n.gender,
       case when dr.code = 'gp' then array['gp', 'family_medicine'] else array[dr.code] end,
       case when dr.code = 'gp' then 'MBBS' when dr.code = 'dental' then 'BDS, MDS' else 'MBBS, MD/MS' end,
       3 + ((dr.rn * 7 + dr.k * 5) % 25),
       case when (dr.rn + dr.k) % 3 = 0 then array['kn','en','hi'] when (dr.rn + dr.k) % 3 = 1 then array['kn','en'] else array['en','hi'] end,
       (array[200, 300, 400, 500, 600, 800])[1 + ((dr.rn + dr.k) % 6)],
       'KMC-SAMPLE-' || (1000 + dr.rn * 10 + dr.k), now(),
       ((dr.rn * 3 + dr.k) % 4 + 2) * ((dr.rn + dr.k * 2) % 12), (dr.rn + dr.k * 2) % 12
from doc_rows dr join names n on n.i = (dr.rn + dr.k) % 10;

-- 15-minute slots, Mon–Sat 09:30–13:00 and 17:00–20:00 IST, for the next 7 days.
insert into public.slots (doctor_id, starts_at, ends_at)
select d.id, t, t + interval '15 minutes'
from public.doctors d
cross join generate_series(0, 6) day_offset
cross join (values (time '09:30', time '13:00'), (time '17:00', time '20:00')) shift(a, b)
cross join lateral generate_series(
  ((current_date + day_offset) + shift.a) at time zone 'Asia/Kolkata',
  ((current_date + day_offset) + shift.b) at time zone 'Asia/Kolkata' - interval '15 minutes',
  interval '15 minutes') t
where extract(dow from current_date + day_offset) <> 0
  and t > now()
on conflict do nothing;
