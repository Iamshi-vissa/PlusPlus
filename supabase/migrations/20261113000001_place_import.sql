-- Import a place from an outside source (OpenStreetMap, HFR, Google) with de-duplication:
--   same source id            → update that place
--   within 75 m + similar name (similarity > 0.6) → same place: just record the extra source
--   otherwise                 → new place
-- Field priority when sources disagree: hfr > plusplus > google > osm (only fills empty fields from
-- lower-priority sources). Service role only (run by import scripts, never by the app).
create function public.import_place(p_source text, p_source_id text, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pt extensions.geography := extensions.st_setsrid(
    extensions.st_point((p ->> 'lng')::double precision, (p ->> 'lat')::double precision), 4326)::extensions.geography;
  norm text := btrim(regexp_replace(lower(p ->> 'name_en'), '[^a-z0-9]+', ' ', 'g'));
  existing uuid;
  rank_new int := array_position(array['osm', 'google', 'plusplus', 'hfr'], p_source);
begin
  if rank_new is null then raise exception 'unknown source %', p_source; end if;
  if not public.is_in_karnataka(extensions.st_y(pt::extensions.geometry), extensions.st_x(pt::extensions.geometry)) then
    return null;   -- skip quietly; OSM extracts include neighbouring states
  end if;

  select place_id into existing from public.place_sources where source = p_source and source_id = p_source_id;

  if existing is null then
    select pl.id into existing
    from public.places pl
    where extensions.st_dwithin(pl.location, pt, 75)
      and extensions.similarity(pl.normalized_name, norm) > 0.6
    order by pl.location operator(extensions.<->) pt
    limit 1;
  end if;

  if existing is null then
    insert into public.places (name_en, name_kn, type, ownership, location, address, pincode, phone,
                               opening_hours, is_24x7, has_emergency, specialities, source)
    values (p ->> 'name_en', p ->> 'name_kn', p ->> 'type', p ->> 'ownership', pt, p ->> 'address',
            p ->> 'pincode', p ->> 'phone', p -> 'opening_hours', coalesce((p ->> 'is_24x7')::boolean, false),
            coalesce((p ->> 'has_emergency')::boolean, false),
            coalesce(array(select jsonb_array_elements_text(p -> 'specialities')), '{}'), p_source)
    returning id into existing;
  else
    update public.places pl set
      name_kn = coalesce(pl.name_kn, p ->> 'name_kn'),
      ownership = coalesce(pl.ownership, p ->> 'ownership'),
      address = coalesce(pl.address, p ->> 'address'),
      pincode = coalesce(pl.pincode, p ->> 'pincode'),
      phone = coalesce(pl.phone, p ->> 'phone'),
      opening_hours = coalesce(pl.opening_hours, p -> 'opening_hours'),
      is_24x7 = pl.is_24x7 or coalesce((p ->> 'is_24x7')::boolean, false),
      has_emergency = pl.has_emergency or coalesce((p ->> 'has_emergency')::boolean, false),
      specialities = (select coalesce(array_agg(distinct s), '{}') from unnest(
        pl.specialities || coalesce(array(select jsonb_array_elements_text(p -> 'specialities')), '{}')) s)
    where pl.id = existing
      -- never let a lower-priority source overwrite a place owned by a higher one
      and array_position(array['demo', 'osm', 'google', 'plusplus', 'hfr'], pl.source) <= rank_new + 1;
  end if;

  insert into public.place_sources (place_id, source, source_id) values (existing, p_source, p_source_id)
  on conflict (source, source_id) do update set place_id = excluded.place_id, fetched_at = now();
  return existing;
end;
$$;

revoke execute on function public.import_place(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_place(text, text, jsonb) to service_role;
