-- Las contraseñas solo se cambian desde la base de datos (SQL Editor de
-- Supabase), nunca desde la app ni desde la API de Supabase Auth:
--
--   select privado.poner_clave('lucia', 'una-contraseña-larga');
--
-- Cierra las sesiones abiertas de esa persona.

-- La app ya no puede cambiar contraseñas: fuera la función que usaba el dueño.
drop function public.poner_clave(text, text);

create function privado.poner_clave(p_persona text, p_clave text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid;
begin
  if p_clave is null or char_length(p_clave) < 10 or octet_length(p_clave) > 72 then
    raise exception 'La contraseña tiene que tener entre 10 y 72 caracteres' using errcode = '22023';
  end if;
  select u.id into v_uid from auth.users u
  where u.raw_app_meta_data ->> 'persona' = p_persona
    and u.raw_app_meta_data ->> 'rol' in ('dueno', 'recepcion', 'mecanico', 'asistente');
  if v_uid is null then
    raise exception 'No existe esa persona' using errcode = '22023';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf', 10)), updated_at = now()
  where id = v_uid;
  delete from auth.sessions where user_id = v_uid;
end $$;

-- Solo para quien administra la base de datos.
revoke all on function privado.poner_clave(text, text) from public, anon, authenticated;

-- Aunque alguien sacara su token de sesión y llamara a Supabase Auth
-- directamente (cambiar contraseña, recuperarla por email…), la base de datos
-- no deja que Auth toque la contraseña. Desde el SQL Editor sí se puede.
create function privado.bloquear_cambio_clave() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and current_user in ('supabase_auth_admin', 'authenticator', 'authenticated', 'anon', 'service_role') then
    raise exception 'Las contraseñas solo se cambian desde la base de datos' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger bloquear_cambio_clave before update of encrypted_password on auth.users
  for each row execute function privado.bloquear_cambio_clave();
