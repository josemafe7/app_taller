-- Chats de prueba: el dueño hace de cliente para probar el asistente.
-- Van por el mismo camino que el chat de la web, pero marcados: salen en la
-- bandeja con la etiqueta «Prueba», no cuentan como pendientes y las citas
-- que se «reservan» en ellos no se guardan.

alter table public.conversaciones add column prueba boolean not null default false;

-- El asistente abre los chats siempre como reales; solo el dueño los marca.
drop policy "conversaciones: el asistente abre chats de la web" on public.conversaciones;
create policy "conversaciones: el asistente abre chats de la web" on public.conversaciones for insert to authenticated
  with check ((select privado.rol()) = 'asistente' and canal = 'Web' and cliente_id is null and not prueba);

create or replace function privado.proteger_conversacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.canal <> old.canal then
    raise exception 'No se puede cambiar el canal de una conversación' using errcode = '42501';
  end if;
  if privado.rol() = 'asistente' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'El asistente no enlaza clientes' using errcode = '42501';
  end if;
  -- Sin rol = SQL de administración (los usuarios sin rol no pasan las reglas RLS).
  if new.prueba is distinct from old.prueba and privado.rol() not in ('dueno', '') then
    raise exception 'Solo el dueño marca los chats de prueba' using errcode = '42501';
  end if;
  return new;
end $$;
