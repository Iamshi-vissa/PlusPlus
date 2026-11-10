-- Private document storage: clinic registration certificates (phase 5) and responder
-- licence / RC / photos (phase 6). People upload into their own folder (<user id>/...);
-- only platform admins can read them. Nothing here is ever public.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('clinic-docs', 'clinic-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
           ('responder-docs', 'responder-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;

    execute $p$
      create policy "private docs: upload into own folder" on storage.objects for insert to authenticated
      with check (bucket_id in ('clinic-docs', 'responder-docs')
                  and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
    execute $p$
      create policy "private docs: only platform admins read" on storage.objects for select to authenticated
      using (bucket_id in ('clinic-docs', 'responder-docs') and public.is_platform_admin())
    $p$;
  end if;
end
$$;
