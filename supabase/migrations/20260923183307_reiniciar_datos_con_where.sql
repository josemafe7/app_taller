-- Con la protección de Supabase (pg_safeupdate), un DELETE necesita WHERE.
create or replace function public.reiniciar_datos(p_datos jsonb)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if privado.rol() <> 'dueno' then
    raise exception 'Solo el dueño puede borrar todos los datos' using errcode = '42501';
  end if;
  delete from public.citas where true;
  delete from public.mensajes where true;
  delete from public.conversaciones where true;
  delete from public.ordenes where true;
  delete from public.coches where true;
  delete from public.clientes where true;
  delete from public.tarifa where true;
  perform privado.cargar_datos(p_datos);
end $$;
revoke all on function public.reiniciar_datos(jsonb) from public, anon;
grant execute on function public.reiniciar_datos(jsonb) to authenticated;
