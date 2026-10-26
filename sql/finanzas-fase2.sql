-- Sistema Tecnigráficas V9.09 · Venta rápida, comprobantes y niveles de acceso
-- Supabase → SQL Editor → pega TODO → Run. Se puede correr dos veces sin problema.
-- Al final muestra quién quedó en cada nivel.

-- ───────────────── 1) Permisos nuevos ─────────────────
insert into public.permission_catalog (code, module, name, description, sort_order, active)
select v.code, 'Finanzas', v.name, v.description, v.sort_order, true
from (values
  ('finance.view', 'Ver Finanzas completas', 'Saldos de las cuentas, créditos, nómina, gastos, cierres de caja y reportes de dinero.', 600),
  ('finance.register', 'Registrar ventas rápidas y abonos con plata', 'Puede hacer ventas rápidas y registrar el dinero que entra, sin ver los saldos del negocio.', 610)
) as v(code, name, description, sort_order)
where not exists (select 1 from public.permission_catalog pc where pc.code = v.code);

insert into public.role_permission_defaults (role, permission_code, allowed)
select r.role::app_role, c.code, r.role in ('owner','admin')
from (values ('owner'),('admin'),('sales'),('production'),('inventory'),('viewer')) as r(role)
cross join (values ('finance.view'),('finance.register')) as c(code)
where not exists (select 1 from public.role_permission_defaults d where d.role::text = r.role and d.permission_code = c.code);

-- Finanzas deja de depender del rol y pasa a depender del permiso "Ver Finanzas completas"
create or replace function public.finance_can_view() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('finance.view');
$$;

create or replace function public.finance_can_register() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('finance.view') or public.has_permission('finance.register');
$$;

create or replace function public.finance_payment_accounts()
returns table(id uuid, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.finance_can_register() or public.has_permission('payments.create')) then
    raise exception 'No tienes permiso para consultar cuentas de recaudo';
  end if;
  return query select a.id, a.name from public.finance_accounts a where a.active = true order by a.sort_order, a.name;
end $$;

-- ───────────────── 2) Comprobantes ─────────────────
alter table public.work_order_payments add column if not exists support_path text;
alter table public.finance_movements   add column if not exists support_path text;
alter table public.quotes              add column if not exists sale_origin text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "comprobantes_subir" on storage.objects;
drop policy if exists "comprobantes_ver" on storage.objects;
create policy "comprobantes_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (public.finance_can_register() or public.has_permission('payments.create')));
create policy "comprobantes_ver" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (public.finance_can_register() or public.has_permission('payments.create')));

create or replace function public.attach_payment_support(p_payment_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.finance_can_register() or public.has_permission('payments.create')) then
    raise exception 'No tienes permiso para adjuntar comprobantes';
  end if;
  if p_path is null or p_path not like 'abonos/%' and p_path not like 'ventas/%' then
    raise exception 'Ruta de comprobante no válida';
  end if;
  update public.work_order_payments set support_path = p_path where id = p_payment_id;
  update public.finance_movements  set support_path = p_path where payment_id = p_payment_id;
end $$;
revoke all on function public.attach_payment_support(uuid, text) from public, anon;
grant execute on function public.attach_payment_support(uuid, text) to authenticated;

-- ───────────────── 3) Venta rápida (todo de un solo golpe) ─────────────────
create or replace function public.quick_sale(
  p_client_id uuid, p_client_name text, p_client_phone text, p_items jsonb,
  p_produce boolean, p_promised_date date, p_notes text,
  p_amount numeric, p_account_id uuid, p_payment_date date, p_reference text, p_support_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotes%rowtype;
  v_order_id uuid; v_order_number text; v_total numeric(14,2);
  v_payment_id uuid; v_receipt text; v_method text; v_acc public.finance_accounts%rowtype;
  v_category uuid; v_item jsonb; v_i int := 0; v_date date := coalesce(p_payment_date, current_date);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.finance_can_register() then raise exception 'No tienes permiso para registrar ventas rápidas.'; end if;
  if coalesce(trim(p_client_name),'') = '' then raise exception 'Escribe el nombre del cliente.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;
  if coalesce(p_amount,0) < 0 then raise exception 'El valor pagado no puede ser negativo.'; end if;

  insert into public.quotes (client_id, client_name, client_phone, person_name, person_phone, recipient_mode,
    issue_date, status, notes, tax_enabled, created_by, updated_by, sale_origin)
  values (p_client_id, trim(p_client_name), nullif(trim(p_client_phone),''), trim(p_client_name), nullif(trim(p_client_phone),''),
    case when p_client_id is null then 'generic' else 'person' end,
    v_date, 'approved', coalesce(nullif(trim(p_notes),''), 'Venta rápida'), false, auth.uid(), auth.uid(), 'quick_sale')
  returning * into v_quote;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'quantity')::numeric,0) <= 0 then raise exception 'Revisa las cantidades: deben ser mayores que cero.'; end if;
    if coalesce((v_item->>'unit_price')::numeric,0) < 0 then raise exception 'Revisa los precios.'; end if;
    insert into public.quote_items (quote_id, sort_order, quantity, product_id, unit, product_name, description,
      unit_price, pricing_source, line_role)
    values (v_quote.id, v_i, (v_item->>'quantity')::numeric, nullif(v_item->>'product_id','')::uuid,
      coalesce(nullif(v_item->>'unit',''),'Unidad'), nullif(trim(v_item->>'product_name'),''),
      coalesce(nullif(trim(v_item->>'description'),''), nullif(trim(v_item->>'product_name'),''), 'Producto'),
      coalesce((v_item->>'unit_price')::numeric,0), 'manual', 'included');
    v_i := v_i + 1;
  end loop;

  select * into v_quote from public.quotes where id = v_quote.id;
  v_total := v_quote.total;
  if coalesce(p_amount,0) > v_total + 0.01 then raise exception 'Lo que paga es más que el total de la venta.'; end if;

  v_order_number := public.next_work_order_number();
  insert into public.work_orders (order_number, quote_id, quote_number, client_id, client_name, contact_name, recipient_mode,
    status, priority, promised_date, source_quote_total, notes, created_by, updated_by)
  values (v_order_number, v_quote.id, v_quote.quote_number, v_quote.client_id, v_quote.client_name, null, v_quote.recipient_mode,
    'pending_design', 'normal', p_promised_date, v_total,
    'Venta rápida' || coalesce(' · ' || nullif(trim(p_notes),''), ''), auth.uid(), auth.uid())
  returning id into v_order_id;

  if not p_produce then
    update public.work_orders set status = 'delivered' where id = v_order_id;
  end if;

  insert into public.work_order_items (work_order_id, quote_item_id, product_id, sort_order, quantity, unit, description)
  select v_order_id, qi.id, qi.product_id, qi.sort_order, qi.quantity, qi.unit, coalesce(qi.description, qi.product_name)
  from public.quote_items qi where qi.quote_id = v_quote.id order by qi.sort_order;

  if coalesce(p_amount,0) > 0 then
    select * into v_acc from public.finance_accounts where id = p_account_id and active = true;
    if not found then raise exception 'Elige la cuenta donde entró el dinero.'; end if;
    v_method := case v_acc.account_type when 'cash' then 'cash' when 'wallet' then 'nequi'
                  else case when v_acc.name ilike '%nequi%' then 'nequi' when v_acc.name ilike '%bancolombia%' then 'bancolombia' else 'bank_transfer' end end;
    if v_method <> 'cash' and coalesce(p_support_path,'') = '' then
      raise exception 'Adjunta la foto del comprobante: el pago no fue en efectivo.';
    end if;
    v_receipt := public.next_payment_receipt_number(extract(year from v_date)::integer);
    insert into public.work_order_payments (work_order_id, quote_id, amount, payment_date, method, reference, notes, status, created_by,
      receipt_number, receipt_issued_at, order_number_snapshot, quote_number_snapshot, client_name_snapshot, contact_name_snapshot,
      order_total_snapshot, balance_before, balance_after, support_path)
    values (v_order_id, v_quote.id, p_amount, v_date, v_method, nullif(trim(p_reference),''), 'Venta rápida', 'active', auth.uid(),
      v_receipt, now(), v_order_number, v_quote.quote_number, v_quote.client_name, null,
      v_total, v_total, greatest(v_total - p_amount, 0), nullif(p_support_path,''))
    returning id into v_payment_id;

    select id into v_category from public.finance_categories
     where name = 'Ventas y trabajos' and movement_type = 'income' and active = true limit 1;
    if v_category is null then raise exception 'No existe la categoría Ventas y trabajos'; end if;

    insert into public.finance_movements (movement_date, movement_type, concept, category_id, account_id, amount, notes,
      source_type, source_id, work_order_id, quote_id, payment_id, created_by, support_path)
    values (v_date, 'income', 'Venta ' || v_order_number || ' · ' || v_quote.client_name, v_category, v_acc.id, p_amount,
      concat_ws(' · ', nullif(trim(p_reference),''), 'Venta rápida'), 'work_order_payment', v_payment_id,
      v_order_id, v_quote.id, v_payment_id, auth.uid(), nullif(p_support_path,''));
  end if;

  return jsonb_build_object('quote_id', v_quote.id, 'order_id', v_order_id, 'order_number', v_order_number,
    'payment_id', v_payment_id, 'total', v_total, 'balance', v_total - coalesce(p_amount,0));
end $$;
revoke all on function public.quick_sale(uuid,text,text,jsonb,boolean,date,text,numeric,uuid,date,text,text) from public, anon;
grant execute on function public.quick_sale(uuid,text,text,jsonb,boolean,date,text,numeric,uuid,date,text,text) to authenticated;

-- ───────────────── 4) Niveles iniciales ─────────────────
-- Equipo = todo menos Finanzas, pagos, usuarios y configuración. Caja = Equipo + ventas y abonos.
do $$
declare v_equipo text[]; v_caja text[]; v_all text[]; v_lu uuid;
begin
  select array_agg(code) into v_all from public.permission_catalog where active;
  select array_agg(code) into v_equipo from public.permission_catalog where active
    and code not like 'finance.%' and code not like 'payments.%' and code not like 'users.%'
    and code not in ('settings.manage','reports.view','quotes.approve_below_minimum');
  select id into v_lu from public.profiles where email = 'luiza.tecnigraficas@gmail.com';
  v_caja := v_equipo || array['finance.register','payments.view','payments.create'];

  -- Eduard Paul → Caja
  insert into public.profile_permission_overrides (profile_id, permission_code, allowed, updated_by)
  select p.id, c, c = any(v_caja), v_lu from public.profiles p, unnest(v_all) c
  where p.email = 'dazdor2011@gmail.com'
  on conflict (profile_id, permission_code) do update set allowed = excluded.allowed, updated_at = now();

  -- Fernando → Equipo
  insert into public.profile_permission_overrides (profile_id, permission_code, allowed, updated_by)
  select p.id, c, c = any(v_equipo), v_lu from public.profiles p, unnest(v_all) c
  where p.email = 'fercho417@hotmail.com'
  on conflict (profile_id, permission_code) do update set allowed = excluded.allowed, updated_at = now();
end $$;

-- ───────────────── Resultado ─────────────────
select p.full_name as persona,
  case when coalesce(o1.allowed, d1.allowed, false) then 'Dueña (todo)'
       when coalesce(o2.allowed, d2.allowed, false) then 'Caja (ventas y abonos)'
       else 'Equipo (sin Finanzas)' end as nivel
from public.profiles p
left join public.profile_permission_overrides o1 on o1.profile_id = p.id and o1.permission_code = 'finance.view'
left join public.role_permission_defaults d1 on d1.role = p.role and d1.permission_code = 'finance.view'
left join public.profile_permission_overrides o2 on o2.profile_id = p.id and o2.permission_code = 'finance.register'
left join public.role_permission_defaults d2 on d2.role = p.role and d2.permission_code = 'finance.register'
where p.active
order by 2, 1;
