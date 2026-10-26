-- Sistema Tecnigráficas V9.21 · Cartera: cuentas de clientes (lo que antes estaba en el Excel CARTERA)
-- Supabase → SQL Editor → pega TODO → Run. Se puede correr dos veces sin problema.
-- No toca nada de lo que ya existe: solo crea tablas nuevas.

-- ───────────────── 1) Cuentas ─────────────────
create table if not exists public.client_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null check (length(trim(client_name)) > 0),
  label text not null default 'Cuenta 1',
  status text not null default 'open' check (status in ('open','closed')),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  opened_on date not null default current_date,
  closed_on date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_accounts_client_idx on public.client_accounts(client_id);
create index if not exists client_accounts_status_idx on public.client_accounts(status);

-- Lo que se le va entregando al cliente
create table if not exists public.client_account_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.client_accounts(id) on delete cascade,
  item_date date,
  quantity numeric(14,3) not null default 1 check (quantity > 0),
  description text not null check (length(trim(description)) > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  delivered boolean not null default true,
  delivery_place text,
  invoiced boolean not null default false,
  product_id uuid references public.products(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists client_account_items_account_idx on public.client_account_items(account_id);

-- Abonos, retenciones y descuentos
create table if not exists public.client_account_payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.client_accounts(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  kind text not null default 'payment' check (kind in ('payment','retention','discount')),
  finance_account_id uuid references public.finance_accounts(id) on delete set null,
  finance_movement_id uuid,
  reference text,
  notes text,
  support_path text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists client_account_payments_account_idx on public.client_account_payments(account_id);

-- Datos que salen en el estado de cuenta (cómo nos pueden pagar)
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ───────────────── 2) Saldos (se calculan solos) ─────────────────
create or replace view public.client_account_balances with (security_invoker = true) as
select a.id as client_account_id, a.client_id, a.client_name, a.label, a.status, a.tax_rate, a.opened_on, a.closed_on,
  coalesce(i.subtotal,0) as subtotal,
  round(coalesce(i.subtotal,0) * a.tax_rate / 100, 2) as tax,
  round(coalesce(i.subtotal,0) * (1 + a.tax_rate / 100), 2) as total,
  coalesce(p.paid,0) as paid,
  round(coalesce(i.subtotal,0) * (1 + a.tax_rate / 100), 2) - coalesce(p.paid,0) as balance,
  coalesce(i.items,0) as items, i.last_item_date, p.last_payment_date,
  coalesce(i.pending_delivery,0) as pending_delivery, coalesce(i.not_invoiced,0) as not_invoiced
from public.client_accounts a
left join (select account_id, sum(line_total) subtotal, count(*) items, max(item_date) last_item_date,
                  count(*) filter (where not delivered) pending_delivery, count(*) filter (where not invoiced) not_invoiced
           from public.client_account_items group by account_id) i on i.account_id = a.id
left join (select account_id, sum(amount) paid, max(payment_date) last_payment_date
           from public.client_account_payments group by account_id) p on p.account_id = a.id;
grant select on public.client_account_balances to authenticated;

-- ───────────────── 3) Quién puede ver y anotar ─────────────────
-- Ver: quien tenga "Ver pagos". Anotar entregas y abonos: quien tenga "Registrar pagos".
alter table public.client_accounts enable row level security;
alter table public.client_account_items enable row level security;
alter table public.client_account_payments enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists ca_select on public.client_accounts;
drop policy if exists ca_write on public.client_accounts;
create policy ca_select on public.client_accounts for select to authenticated using (public.has_permission('payments.view'));
create policy ca_write on public.client_accounts for all to authenticated
  using (public.has_permission('payments.create')) with check (public.has_permission('payments.create'));

drop policy if exists cai_select on public.client_account_items;
drop policy if exists cai_write on public.client_account_items;
create policy cai_select on public.client_account_items for select to authenticated using (public.has_permission('payments.view'));
create policy cai_write on public.client_account_items for all to authenticated
  using (public.has_permission('payments.create')) with check (public.has_permission('payments.create'));

-- Los abonos solo se crean y borran por las funciones de abajo (para que Finanzas quede igual)
drop policy if exists cap_select on public.client_account_payments;
create policy cap_select on public.client_account_payments for select to authenticated using (public.has_permission('payments.view'));

drop policy if exists settings_select on public.app_settings;
drop policy if exists settings_write on public.app_settings;
create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated
  using (public.has_permission('payments.create')) with check (public.has_permission('payments.create'));

-- ───────────────── 4) Registrar un abono (y meterlo a Finanzas) ─────────────────
create or replace function public.client_account_add_payment(
  p_account_id uuid, p_date date, p_amount numeric, p_kind text,
  p_finance_account_id uuid, p_reference text, p_notes text, p_support_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_acc public.client_accounts%rowtype; v_pay uuid; v_mov uuid; v_cat uuid; v_src text;
  v_date date := coalesce(p_date, current_date); v_kind text := coalesce(nullif(p_kind,''),'payment');
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.has_permission('payments.create') then raise exception 'No tienes permiso para registrar abonos.'; end if;
  select * into v_acc from public.client_accounts where id = p_account_id;
  if not found then raise exception 'La cuenta no existe.'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'Escribe el valor del abono.'; end if;
  if v_kind not in ('payment','retention','discount') then raise exception 'Tipo de abono no válido.'; end if;
  if v_kind = 'payment' and p_finance_account_id is null then raise exception 'Elige en qué cuenta entró la plata.'; end if;

  insert into public.client_account_payments (account_id, payment_date, amount, kind, finance_account_id, reference, notes, support_path)
  values (p_account_id, v_date, p_amount, v_kind, case when v_kind = 'payment' then p_finance_account_id end,
          nullif(trim(p_reference),''), nullif(trim(p_notes),''), nullif(p_support_path,''))
  returning id into v_pay;

  -- Solo la plata que de verdad entra va a Finanzas (la retención y los descuentos no)
  if v_kind = 'payment' then
    select id into v_cat from public.finance_categories
     where name = 'Ventas y trabajos' and movement_type = 'income' and active = true limit 1;
    if v_cat is null then raise exception 'No existe la categoría Ventas y trabajos en Finanzas.'; end if;
    v_src := case when exists (select 1 from pg_constraint where conrelid = 'public.finance_movements'::regclass
                   and contype = 'c' and pg_get_constraintdef(oid) ilike '%source_type%') then 'manual' else 'client_account_payment' end;
    insert into public.finance_movements (movement_date, movement_type, concept, category_id, account_id, amount, notes,
      source_type, source_id, created_by, support_path)
    values (v_date, 'income', 'Abono cartera · ' || v_acc.client_name || ' · ' || v_acc.label, v_cat, p_finance_account_id, p_amount,
      concat_ws(' · ', nullif(trim(p_reference),''), 'Cuenta de cliente'), v_src, v_pay, auth.uid(), nullif(p_support_path,''))
    returning id into v_mov;
    update public.client_account_payments set finance_movement_id = v_mov where id = v_pay;
  end if;
  update public.client_accounts set updated_at = now() where id = p_account_id;
  return v_pay;
end $$;
revoke all on function public.client_account_add_payment(uuid,date,numeric,text,uuid,text,text,text) from public, anon;
grant execute on function public.client_account_add_payment(uuid,date,numeric,text,uuid,text,text,text) to authenticated;

-- Borrar un abono mal anotado: también se anula en Finanzas
create or replace function public.client_account_delete_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_mov uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.has_permission('payments.create') then raise exception 'No tienes permiso para borrar abonos.'; end if;
  select finance_movement_id into v_mov from public.client_account_payments where id = p_payment_id;
  if not found then raise exception 'El abono no existe.'; end if;
  if v_mov is not null then
    update public.finance_movements set is_voided = true, voided_at = now(), voided_by = auth.uid() where id = v_mov;
  end if;
  delete from public.client_account_payments where id = p_payment_id;
end $$;
revoke all on function public.client_account_delete_payment(uuid) from public, anon;
grant execute on function public.client_account_delete_payment(uuid) to authenticated;

-- ───────────────── Resultado ─────────────────
select 'Listo ✓ Cartera de clientes creada' as resultado,
  (select count(*) from public.client_accounts) as cuentas;
