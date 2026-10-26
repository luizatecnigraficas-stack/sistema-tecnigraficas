-- Tecnigráficas V9.15 · "Gasto" pasa a llamarse "Egreso" + concepto Domicilios
-- Supabase → SQL Editor → pega TODO → Run. Se puede correr dos veces.

-- 1) Nombres de categorías
update public.finance_categories set name = 'Egresos fijos'      where name = 'Gastos fijos';
update public.finance_categories set name = 'Egresos variables'  where name = 'Gastos variables';
update public.finance_categories set name = 'Egresos especiales' where name = 'Gastos especiales';
update public.finance_categories set name = 'Otros egresos'      where name = 'Otros gastos';

-- 2) Concepto "Domicilios" dentro de Egresos variables (si no existe)
insert into public.finance_variable_expenses (name, active, notes, reporting_category_id)
select 'Domicilios', true, 'Egreso variable recurrente',
  (select id from public.finance_categories where name = 'Transporte y domicilios' and movement_type = 'expense' limit 1)
where not exists (select 1 from public.finance_variable_expenses where lower(name) = 'domicilios');

-- Resultado
select name as categoria from public.finance_categories where movement_type = 'expense' and active order by 1;
