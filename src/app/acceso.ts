'use server';

// Entrar y salir (Supabase Auth). Las contraseñas no se cambian desde la app:
// solo desde la base de datos (privado.poner_clave, ver README).

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbSesion, usuarioDe } from '@/lib/sesion';
import { inicioDe } from '@/lib/permisos';
import { apuntar, ipDe, olvidar, quedan } from '@/lib/limites';
import { emailDe, supabaseConfigurado } from '@/lib/supabase/servidor';

export interface EstadoEntrar {
  error: string;
  usuario: string;
}

const CINCO_MIN = 5 * 60_000;
const QUINCE_MIN = 15 * 60_000;
const UNA_HORA = 60 * 60_000;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function iniciarSesion(_previo: EstadoEntrar, datos: FormData): Promise<EstadoEntrar> {
  const usuario = String(datos.get('usuario') ?? '').trim().slice(0, 60);
  const clave = String(datos.get('clave') ?? '').slice(0, 200);
  if (!supabaseConfigurado()) return { error: 'La app no está conectada a la base de datos. Revisa .env.local.', usuario };
  const ip = ipDe(await headers());
  const persona = usuarioDe(usuario);
  const porIp = `entrar-ip:${ip}`;
  const porUsuario = `entrar-usuario:${persona?.id ?? 'desconocido'}`;

  if (!quedan(porIp, 10, QUINCE_MIN) || !quedan(porUsuario, 20, UNA_HORA) || !quedan('entrar-todos', 40, CINCO_MIN)) {
    return { error: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.', usuario };
  }
  if (!usuario || !clave) return { error: 'Escribe tu usuario y tu contraseña.', usuario };

  const fallo = async (): Promise<EstadoEntrar> => {
    apuntar(porIp);
    apuntar(porUsuario);
    apuntar('entrar-todos');
    await esperar(400);
    return { error: 'Usuario o contraseña incorrectos.', usuario };
  };
  if (!persona) return fallo();

  const db = await dbSesion();
  const { data, error } = await db.auth.signInWithPassword({ email: emailDe(persona.id), password: clave });
  if (error) {
    if (error.status === 429) return { error: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.', usuario };
    if (error.status && error.status >= 500) {
      console.error('[entrar]', error.status, error.message);
      return { error: 'No se ha podido conectar con la base de datos. Inténtalo en un momento.', usuario };
    }
    return fallo();
  }
  // La cuenta tiene que ser de esa persona y con su rol (la del asistente no sirve para entrar).
  const app = (data.user?.app_metadata ?? {}) as { persona?: unknown; rol?: unknown };
  if (app.persona !== persona.id || app.rol !== persona.rol) {
    await db.auth.signOut({ scope: 'local' });
    return fallo();
  }

  olvidar(porIp);
  redirect(inicioDe(persona));
}

export async function cerrarSesion(): Promise<void> {
  const db = await dbSesion();
  await db.auth.signOut({ scope: 'local' });
  redirect('/entrar');
}
