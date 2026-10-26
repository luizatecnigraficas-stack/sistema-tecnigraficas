-- Sistema Tecnigráficas V9.02 · Cajón de fotos
-- Supabase → SQL Editor → pega TODO → Run. Se puede correr dos veces sin problema.

-- 1) El cajón "fotos" (las fotos se ven con su enlace, como en el catálogo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- 2) Solo el equipo (con sesión iniciada) puede subir o borrar fotos
drop policy if exists "fotos_subir" on storage.objects;
drop policy if exists "fotos_borrar" on storage.objects;
create policy "fotos_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos');
create policy "fotos_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos');

-- 3) Ayudante para pasar las fotos viejas (solo dueñas/admin)
create or replace function public.set_photo_url(
  p_table text, p_id uuid, p_column text, p_url text, p_gallery jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role in ('owner','admin') and active) then
    raise exception 'Solo las dueñas pueden aligerar fotos';
  end if;
  if p_column = 'catalog_gallery' and p_table = 'products' then
    update products set catalog_gallery = coalesce(p_gallery, '[]'::jsonb) where id = p_id;
    return;
  end if;
  if (p_table, p_column) not in (('products','catalog_image_data'), ('inventory_items','photo_data'),
      ('inventory_variants','photo_data'), ('inventory_units','photo_data')) then
    raise exception 'Tabla no permitida';
  end if;
  if p_url is null or p_url not like 'https://%' then
    raise exception 'Enlace de foto no válido';
  end if;
  execute format('update %I set %I = $1 where id = $2', p_table, p_column) using p_url, p_id;
end $$;
revoke all on function public.set_photo_url(text, uuid, text, text, jsonb) from public, anon;
grant execute on function public.set_photo_url(text, uuid, text, text, jsonb) to authenticated;

-- 4) Revisión: ¿alguna función del sistema exige que la foto venga en el formato viejo?
select p.proname as funcion,
       case when p.prosrc ilike '%data:image%' then '⚠️ revisar' else 'OK' end as estado
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.prosrc ilike '%photo_data%' or p.prosrc ilike '%catalog_image_data%' or p.prosrc ilike '%catalog_gallery%')
union all
select 'regla ' || c.conname, '⚠️ revisar'
from pg_constraint c join pg_namespace n on n.oid = c.connamespace
where n.nspname = 'public' and pg_get_constraintdef(c.oid) ilike '%data:image%'
order by 2 desc, 1;
