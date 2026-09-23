-- Talleres Ruiz · funciones que la app llama por la API.

-- El asistente del chat no puede leer órdenes ni coches. Solo recibe una orden
-- si el código Y alguna de las matrículas que ha escrito el cliente coinciden.
create function public.asistente_orden(p_codigo text, p_matriculas text[])
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if privado.rol() not in ('asistente', 'dueno', 'recepcion') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if coalesce(array_length(p_matriculas, 1), 0) = 0 or array_length(p_matriculas, 1) > 5 then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'id', o.id, 'estado', o.estado, 'km', o.km, 'mecanico_id', o.mecanico_id, 'entrada', o.entrada,
      'cierre', o.cierre, 'motivo', o.motivo, 'trabajos', o.trabajos, 'piezas', o.piezas,
      'coche', jsonb_build_object('matricula', c.matricula, 'modelo', c.modelo)
    )
    from public.ordenes o
    join public.coches c on c.id = o.coche_id
    where o.id = upper(btrim(p_codigo))
      and c.matricula_clave in (select upper(regexp_replace(m, '[\s-]', '', 'g')) from unnest(p_matriculas) as m)
  );
end $$;

-- Huecos cogidos (solo fecha y hora; nada de quién ha reservado).
create function public.huecos_ocupados(p_desde date, p_hasta date)
returns table (fecha date, hora text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if privado.rol() not in ('asistente', 'dueno', 'recepcion') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_hasta < p_desde or p_hasta - p_desde > 92 then
    raise exception 'Rango de fechas no válido' using errcode = '22023';
  end if;
  return query select c.fecha, c.hora from public.citas c where c.fecha between p_desde and p_hasta;
end $$;

-- El dueño pone una contraseña nueva a otra persona del taller y le cierra las sesiones.
create function public.poner_clave(p_persona text, p_clave text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid;
begin
  if privado.rol() <> 'dueno' then
    raise exception 'Solo el dueño puede cambiar la contraseña de otra persona' using errcode = '42501';
  end if;
  if p_persona = privado.persona() then
    raise exception 'Tu propia contraseña se cambia desde «Mi contraseña»' using errcode = '22023';
  end if;
  if p_clave is null or char_length(p_clave) < 10 or octet_length(p_clave) > 72 then
    raise exception 'La contraseña tiene que tener entre 10 y 72 caracteres' using errcode = '22023';
  end if;
  select u.id into v_uid from auth.users u
  where u.raw_app_meta_data ->> 'persona' = p_persona
    and u.raw_app_meta_data ->> 'rol' in ('dueno', 'recepcion', 'mecanico');
  if v_uid is null then
    raise exception 'No existe esa persona' using errcode = '22023';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf', 10)), updated_at = now()
  where id = v_uid;
  delete from auth.sessions where user_id = v_uid;
end $$;

-- Carga completa de datos (lo usan la migración inicial y «npm run reset»).
create function privado.cargar_datos(p jsonb)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform set_config('taller.cargando', 'si', true);

  insert into public.clientes (id, nombre, nombre_corto, contacto, telefono, email, desde)
  select x.id, x.nombre, x.nombre_corto, x.contacto, x.telefono, x.email, x.desde
  from jsonb_to_recordset(p -> 'clientes') as x (id text, nombre text, nombre_corto text, contacto text, telefono text, email text, desde int);

  insert into public.coches (id, cliente_id, matricula, modelo, anio, combustible)
  select x.id, x.cliente_id, x.matricula, x.modelo, x.anio, x.combustible
  from jsonb_to_recordset(p -> 'coches') as x (id text, cliente_id text, matricula text, modelo text, anio int, combustible text);

  insert into public.tarifa (id, categoria, nombre, tiempo, precio, por_unidad, posicion)
  select x.id, x.categoria, x.nombre, x.tiempo, x.precio, x.por_unidad, t.i
  from jsonb_array_elements(p -> 'tarifa') with ordinality as t (e, i),
       jsonb_to_record(t.e) as x (id text, categoria text, nombre text, tiempo text, precio numeric, por_unidad boolean);
  perform setval(pg_get_serial_sequence('public.tarifa', 'posicion'), greatest((select max(posicion) from public.tarifa), 1));

  insert into public.conversaciones (id, cliente_id, nombre, canal, contacto, modo, necesita_persona, motivo, actualizada, creada)
  select x.id, x.cliente_id, x.nombre, x.canal, x.contacto, x.modo, x.necesita_persona, x.motivo, x.actualizada, x.creada
  from jsonb_to_recordset(p -> 'conversaciones') as x (
    id text, cliente_id text, nombre text, canal text, contacto text, modo text, necesita_persona boolean, motivo text,
    actualizada timestamptz, creada timestamptz
  );

  insert into public.mensajes (id, conversacion_id, de, texto, cuando, autor)
  select x.id, x.conversacion_id, x.de, x.texto, x.cuando, x.autor
  from jsonb_array_elements(p -> 'mensajes') with ordinality as t (e, i),
       jsonb_to_record(t.e) as x (id text, conversacion_id text, de text, texto text, cuando timestamptz, autor text)
  order by t.i;

  insert into public.ordenes (id, coche_id, estado, km, mecanico_id, entrada, cierre, motivo, trabajos, piezas, observaciones, historial, ultima_ia, informes)
  select x.id, x.coche_id, x.estado, x.km, x.mecanico_id, x.entrada, x.cierre, x.motivo,
         x.trabajos, x.piezas, x.observaciones, x.historial, x.ultima_ia, coalesce(x.informes, '{}')
  from jsonb_to_recordset(p -> 'ordenes') as x (
    id text, coche_id text, estado text, km int, mecanico_id text, entrada timestamptz, cierre timestamptz, motivo text,
    trabajos jsonb, piezas jsonb, observaciones jsonb, historial jsonb, ultima_ia jsonb, informes jsonb
  );

  insert into public.citas (id, fecha, hora, nombre, telefono, matricula, coche, motivo, cliente_id, orden_id, conversacion_id, origen, creada)
  select x.id, x.fecha, x.hora, x.nombre, x.telefono, x.matricula, x.coche, x.motivo, x.cliente_id, x.orden_id, x.conversacion_id, x.origen, x.creada
  from jsonb_to_recordset(p -> 'citas') as x (
    id text, fecha date, hora text, nombre text, telefono text, matricula text, coche text, motivo text,
    cliente_id text, orden_id text, conversacion_id text, origen text, creada timestamptz
  );

  perform setval('public.orden_numero', greatest((p ->> 'siguiente_orden')::bigint, 1000), false);
  perform setval('public.visitante_web', greatest(coalesce((p ->> 'visitantes_web')::bigint, 0) + 1, 1), false);

  perform set_config('taller.cargando', '', true);
end $$;

-- «npm run reset»: borra todo y carga los datos de ejemplo. Solo el dueño.
create function public.reiniciar_datos(p_datos jsonb)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if privado.rol() <> 'dueno' then
    raise exception 'Solo el dueño puede borrar todos los datos' using errcode = '42501';
  end if;
  delete from public.citas;
  delete from public.mensajes;
  delete from public.conversaciones;
  delete from public.ordenes;
  delete from public.coches;
  delete from public.clientes;
  delete from public.tarifa;
  perform privado.cargar_datos(p_datos);
end $$;

revoke all on function public.asistente_orden(text, text[]) from public, anon;
revoke all on function public.huecos_ocupados(date, date) from public, anon;
revoke all on function public.poner_clave(text, text) from public, anon;
revoke all on function public.reiniciar_datos(jsonb) from public, anon;
revoke all on function privado.cargar_datos(jsonb) from public, anon, authenticated;
grant execute on function public.asistente_orden(text, text[]) to authenticated;
grant execute on function public.huecos_ocupados(date, date) to authenticated;
grant execute on function public.poner_clave(text, text) to authenticated;
grant execute on function public.reiniciar_datos(jsonb) to authenticated;

-- Nadie puede darse de alta por su cuenta: los usuarios del taller los crea la
-- migración (y quien administre la base de datos con taller.alta = 'permitida').
create function privado.bloquear_altas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('taller.alta', true), '') <> 'permitida' then
    raise exception 'Las altas de usuarios están cerradas' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function privado.bloquear_altas() from public, anon, authenticated;
create trigger bloquear_altas before insert on auth.users
  for each row execute function privado.bloquear_altas();
