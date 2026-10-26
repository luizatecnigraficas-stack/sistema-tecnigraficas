-- Sistema Tecnigráficas V9.22 · La foto del comprobante pasa a ser OPCIONAL en la venta rápida
-- Supabase → SQL Editor → pega TODO → Run. Se puede correr dos veces sin problema.
do $$
declare d text;
begin
  select pg_get_functiondef('public.quick_sale(uuid,text,text,jsonb,boolean,date,text,numeric,uuid,date,text,text)'::regprocedure) into d;
  d := replace(d, $x$raise exception 'Adjunta la foto del comprobante: el pago no fue en efectivo.';$x$, $x$null; -- comprobante opcional desde V9.22$x$);
  execute d;
end $$;
select case when pg_get_functiondef('public.quick_sale(uuid,text,text,jsonb,boolean,date,text,numeric,uuid,date,text,text)'::regprocedure) like '%Adjunta la foto%'
  then 'Algo falló: avísale a Claude' else 'Listo ✓ El comprobante ya es opcional' end as resultado;
