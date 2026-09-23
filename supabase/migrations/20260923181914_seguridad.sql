-- Talleres Ruiz · quién puede ver y cambiar qué (Row Level Security).
--
-- Cada usuario lleva en su sesión (app_metadata, que solo se cambia desde la
-- base de datos) su persona y su rol:
--   dueno / recepcion → todo el taller (la tarifa solo la cambia el dueño)
--   mecanico          → solo sus coches mientras están en el taller
--   asistente         → la cuenta con la que la app atiende el chat público:
--                       solo conversaciones de la web, la tarifa y reservar citas.
-- Un usuario sin rol (por ejemplo, alguien que consiguiera darse de alta) no ve nada.

create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

create function privado.rol() returns text
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'rol', '')
$$;

create function privado.persona() returns text
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'persona', '')
$$;

create function privado.es_taller() returns boolean
language sql stable set search_path = '' as $$
  select privado.rol() in ('dueno', 'recepcion')
$$;

-- Solo lo activa privado.cargar_datos (no se puede activar desde la API).
create function privado.cargando() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('taller.cargando', true), '') = 'si'
$$;

revoke all on all functions in schema privado from public;
grant execute on function privado.rol(), privado.persona(), privado.es_taller(), privado.cargando() to authenticated;

-- ——— Permisos básicos: nada para anon; lo justo para los usuarios con sesión ———

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.personas to authenticated;
grant select, insert, update on public.clientes to authenticated;
grant select, insert, update on public.coches to authenticated;
grant select, insert, update, delete on public.tarifa to authenticated;
grant select, insert, update on public.ordenes to authenticated;
grant select, insert, update on public.conversaciones to authenticated;
grant select, insert on public.mensajes to authenticated;
grant select, insert, update, delete on public.citas to authenticated;
grant usage on sequence public.orden_numero to authenticated;

alter table public.personas enable row level security;
alter table public.clientes enable row level security;
alter table public.coches enable row level security;
alter table public.tarifa enable row level security;
alter table public.ordenes enable row level security;
alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;
alter table public.citas enable row level security;

-- ——— Personas ———

create policy "personas: las ve el equipo" on public.personas for select to authenticated
  using ((select privado.rol()) in ('dueno', 'recepcion', 'mecanico'));

-- ——— Clientes ———

create policy "clientes: taller ve" on public.clientes for select to authenticated
  using ((select privado.es_taller()));
create policy "clientes: mecanico ve los de sus coches" on public.clientes for select to authenticated
  using (
    (select privado.rol()) = 'mecanico'
    and exists (
      select 1 from public.coches c join public.ordenes o on o.coche_id = c.id
      where c.cliente_id = clientes.id and o.mecanico_id = (select privado.persona()) and o.estado <> 'entregado'
    )
  );
create policy "clientes: taller crea" on public.clientes for insert to authenticated
  with check ((select privado.es_taller()));
create policy "clientes: taller cambia" on public.clientes for update to authenticated
  using ((select privado.es_taller())) with check ((select privado.es_taller()));

-- ——— Coches ———

create policy "coches: taller ve" on public.coches for select to authenticated
  using ((select privado.es_taller()));
create policy "coches: mecanico ve los suyos" on public.coches for select to authenticated
  using (
    (select privado.rol()) = 'mecanico'
    and exists (
      select 1 from public.ordenes o
      where o.coche_id = coches.id and o.mecanico_id = (select privado.persona()) and o.estado <> 'entregado'
    )
  );
create policy "coches: taller crea" on public.coches for insert to authenticated
  with check ((select privado.es_taller()));
create policy "coches: taller cambia" on public.coches for update to authenticated
  using ((select privado.es_taller())) with check ((select privado.es_taller()));

-- ——— Tarifa ———

create policy "tarifa: la ven todos los usuarios con rol" on public.tarifa for select to authenticated
  using ((select privado.rol()) in ('dueno', 'recepcion', 'mecanico', 'asistente'));
create policy "tarifa: el dueno crea" on public.tarifa for insert to authenticated
  with check ((select privado.rol()) = 'dueno');
create policy "tarifa: el dueno cambia" on public.tarifa for update to authenticated
  using ((select privado.rol()) = 'dueno') with check ((select privado.rol()) = 'dueno');
create policy "tarifa: el dueno borra" on public.tarifa for delete to authenticated
  using ((select privado.rol()) = 'dueno');

-- ——— Órdenes ———

create policy "ordenes: taller y mecanico ven" on public.ordenes for select to authenticated
  using (
    (select privado.es_taller())
    or ((select privado.rol()) = 'mecanico' and mecanico_id = (select privado.persona()) and estado <> 'entregado')
  );
create policy "ordenes: taller abre" on public.ordenes for insert to authenticated
  with check ((select privado.es_taller()));
create policy "ordenes: taller y mecanico cambian" on public.ordenes for update to authenticated
  using (
    (select privado.es_taller())
    or ((select privado.rol()) = 'mecanico' and mecanico_id = (select privado.persona()) and estado <> 'entregado')
  )
  with check (
    (select privado.es_taller())
    or ((select privado.rol()) = 'mecanico' and mecanico_id = (select privado.persona()) and estado <> 'entregado')
  );

-- ——— Conversaciones y mensajes ———

create policy "conversaciones: taller y asistente (web) ven" on public.conversaciones for select to authenticated
  using ((select privado.es_taller()) or ((select privado.rol()) = 'asistente' and canal = 'Web'));
create policy "conversaciones: el asistente abre chats de la web" on public.conversaciones for insert to authenticated
  with check ((select privado.rol()) = 'asistente' and canal = 'Web' and cliente_id is null);
create policy "conversaciones: taller y asistente (web) cambian" on public.conversaciones for update to authenticated
  using ((select privado.es_taller()) or ((select privado.rol()) = 'asistente' and canal = 'Web'))
  with check ((select privado.es_taller()) or ((select privado.rol()) = 'asistente' and canal = 'Web'));

-- Los mensajes se ven si se ve su conversación.
create policy "mensajes: se ven con su conversacion" on public.mensajes for select to authenticated
  using (exists (select 1 from public.conversaciones c where c.id = mensajes.conversacion_id));
create policy "mensajes: taller escribe como persona, asistente como cliente o IA" on public.mensajes for insert to authenticated
  with check (
    (((select privado.es_taller()) and de = 'persona') or ((select privado.rol()) = 'asistente' and de in ('cliente', 'ia')))
    and exists (select 1 from public.conversaciones c where c.id = mensajes.conversacion_id)
  );

-- ——— Citas ———

create policy "citas: taller ve" on public.citas for select to authenticated
  using ((select privado.es_taller()));
create policy "citas: taller y asistente reservan" on public.citas for insert to authenticated
  with check ((select privado.es_taller()) or ((select privado.rol()) = 'asistente' and origen = 'ia' and orden_id is null));
create policy "citas: taller cambia" on public.citas for update to authenticated
  using ((select privado.es_taller())) with check ((select privado.es_taller()));
create policy "citas: taller anula" on public.citas for delete to authenticated
  using ((select privado.es_taller()));

-- ——— Reglas que no dependen de la app ———

-- Órdenes: el historial solo crece; un mecánico no reasigna, no cierra ni reabre.
create function privado.proteger_orden() returns trigger
language plpgsql set search_path = '' as $$
declare
  r text := privado.rol();
  n int := jsonb_array_length(old.historial);
begin
  if privado.cargando() then
    return new;
  end if;
  if new.id <> old.id then
    raise exception 'No se puede cambiar el código de una orden' using errcode = '42501';
  end if;
  if jsonb_array_length(new.historial) < n
     or (n > 0 and (select jsonb_agg(e order by i) from jsonb_array_elements(new.historial) with ordinality as h(e, i) where i <= n) <> old.historial)
  then
    raise exception 'El historial de una orden no se puede borrar ni cambiar' using errcode = '42501';
  end if;
  if r = 'mecanico' and (
    new.mecanico_id <> old.mecanico_id or new.coche_id <> old.coche_id or new.entrada <> old.entrada
    or new.cierre is distinct from old.cierre or new.estado = 'entregado' or new.informes <> old.informes
  ) then
    raise exception 'Con este perfil no puedes hacer este cambio' using errcode = '42501';
  end if;
  new.version := old.version + 1;
  return new;
end $$;
create trigger proteger_orden before update on public.ordenes
  for each row execute function privado.proteger_orden();

create function privado.nueva_orden() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.cargando() then
    return new;
  end if;
  new.version := 1;
  if privado.rol() <> '' then
    new.entrada := now();
  end if;
  return new;
end $$;
create trigger nueva_orden before insert on public.ordenes
  for each row execute function privado.nueva_orden();

-- Mensajes: la hora la pone el servidor y el autor sale de la sesión.
create function privado.nuevo_mensaje() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.cargando() and privado.rol() <> '' then
    new.cuando := now();
    if new.de = 'persona' then
      new.autor := (select p.nombre from public.personas p where p.id = privado.persona());
    else
      new.autor := null;
    end if;
  end if;
  return new;
end $$;
create trigger nuevo_mensaje before insert on public.mensajes
  for each row execute function privado.nuevo_mensaje();

create function privado.mensaje_guardado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversaciones set actualizada = greatest(actualizada, new.cuando) where id = new.conversacion_id;
  return null;
end $$;
create trigger mensaje_guardado after insert on public.mensajes
  for each row execute function privado.mensaje_guardado();

-- Conversaciones: los chats nuevos de la web se numeran solos.
create function privado.nueva_conversacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if privado.cargando() then
    return new;
  end if;
  if new.canal = 'Web' and btrim(new.nombre) = '' then
    new.nombre := 'Visitante web ' || nextval('public.visitante_web');
  end if;
  if privado.rol() <> '' then
    new.creada := now();
    new.actualizada := now();
  end if;
  return new;
end $$;
create trigger nueva_conversacion before insert on public.conversaciones
  for each row execute function privado.nueva_conversacion();

create function privado.proteger_conversacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.canal <> old.canal then
    raise exception 'No se puede cambiar el canal de una conversación' using errcode = '42501';
  end if;
  if privado.rol() = 'asistente' and new.cliente_id is distinct from old.cliente_id then
    raise exception 'El asistente no enlaza clientes' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_conversacion before update on public.conversaciones
  for each row execute function privado.proteger_conversacion();

-- Citas: el cliente y el modelo salen de la matrícula (el asistente no puede leer coches).
create function privado.nueva_cita() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cliente text;
  v_modelo text;
begin
  if privado.cargando() then
    return new;
  end if;
  select c.cliente_id, c.modelo into v_cliente, v_modelo
  from public.coches c
  where c.matricula_clave = upper(regexp_replace(new.matricula, '[\s-]', '', 'g'));
  if privado.rol() = 'asistente' or new.cliente_id is null then
    new.cliente_id := v_cliente;
  end if;
  if btrim(coalesce(new.coche, '')) in ('', '—') then
    new.coche := coalesce(v_modelo, '—');
  end if;
  if privado.rol() <> '' then
    new.creada := now();
  end if;
  return new;
end $$;
create trigger nueva_cita before insert on public.citas
  for each row execute function privado.nueva_cita();

revoke all on all functions in schema privado from public;
grant execute on function privado.rol(), privado.persona(), privado.es_taller(), privado.cargando() to authenticated;
