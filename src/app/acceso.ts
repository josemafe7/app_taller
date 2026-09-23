'use server';

// Entrar, salir y cambiar contraseñas (Supabase Auth).

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbSesion, personaActual, usuarioDe } from '@/lib/sesion';
import { inicioDe } from '@/lib/permisos';
import { PERSONAS } from '@/lib/constantes';
import { apuntar, consumir, ipDe, olvidar, quedan } from '@/lib/limites';
import { clienteSuelto, emailDe, supabaseConfigurado } from '@/lib/supabase/servidor';

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

// ——— Contraseñas ———

export interface EstadoClave {
  error: string;
  ok: string;
}

const MIN_CLAVE = 10;

function problemaClave(nueva: string, repetida: string): string | null {
  if (nueva.length < MIN_CLAVE) return `La contraseña nueva tiene que tener al menos ${MIN_CLAVE} caracteres.`;
  if (new TextEncoder().encode(nueva).length > 72) return 'La contraseña nueva es demasiado larga.';
  if (nueva !== repetida) return 'Las dos contraseñas nuevas no coinciden.';
  return null;
}

/** Cada persona cambia su propia contraseña (hay que saber la actual). */
export async function cambiarMiClave(_previo: EstadoClave, datos: FormData): Promise<EstadoClave> {
  const yo = await personaActual();
  if (!yo) return { error: 'Tu sesión ha caducado. Vuelve a entrar.', ok: '' };
  const actual = String(datos.get('actual') ?? '').slice(0, 200);
  const nueva = String(datos.get('nueva') ?? '').slice(0, 200);
  const repetida = String(datos.get('repetida') ?? '').slice(0, 200);
  if (!actual) return { error: 'Escribe tu contraseña actual.', ok: '' };
  const problema = problemaClave(nueva, repetida);
  if (problema) return { error: problema, ok: '' };
  if (nueva === actual) return { error: 'La contraseña nueva tiene que ser distinta de la actual.', ok: '' };

  const clave = `clave-actual:${yo.id}`;
  if (!consumir(clave, 5, QUINCE_MIN)) return { error: 'Demasiados intentos. Espera unos minutos.', ok: '' };

  // Se comprueba la contraseña actual con un cliente aparte, sin tocar la sesión abierta.
  const prueba = clienteSuelto();
  const { error: malActual } = await prueba.auth.signInWithPassword({ email: emailDe(yo.id), password: actual });
  if (malActual) {
    await esperar(400);
    return { error: 'La contraseña actual no es correcta.', ok: '' };
  }
  await prueba.auth.signOut({ scope: 'local' });
  olvidar(clave);

  const db = await dbSesion();
  const { error } = await db.auth.updateUser({ password: nueva });
  if (error) {
    if (error.code === 'weak_password') return { error: 'Esa contraseña es demasiado fácil. Elige otra más larga.', ok: '' };
    if (error.code === 'same_password') return { error: 'La contraseña nueva tiene que ser distinta de la actual.', ok: '' };
    console.error('[cambiar clave]', error.status, error.code, error.message);
    return { error: 'No se ha podido cambiar la contraseña. Inténtalo otra vez.', ok: '' };
  }
  // Cierra las demás sesiones abiertas con la contraseña vieja (este dispositivo sigue dentro).
  await db.auth.signOut({ scope: 'others' });
  return { error: '', ok: 'Contraseña cambiada. Las demás sesiones abiertas se han cerrado.' };
}

/** El dueño pone una contraseña nueva a otra persona del taller (le cierra las sesiones). */
export async function ponerClaveA(_previo: EstadoClave, datos: FormData): Promise<EstadoClave> {
  const yo = await personaActual();
  if (!yo) return { error: 'Tu sesión ha caducado. Vuelve a entrar.', ok: '' };
  if (yo.rol !== 'dueno') return { error: 'Solo el dueño puede cambiar la contraseña de otra persona.', ok: '' };
  const quien = PERSONAS.find((p) => p.id === String(datos.get('persona') ?? ''));
  if (!quien || quien.id === yo.id) return { error: 'Elige a la persona.', ok: '' };
  const nueva = String(datos.get('nueva') ?? '').slice(0, 200);
  const problema = problemaClave(nueva, String(datos.get('repetida') ?? '').slice(0, 200));
  if (problema) return { error: problema, ok: '' };

  const db = await dbSesion();
  const { error } = await db.rpc('poner_clave', { p_persona: quien.id, p_clave: nueva });
  if (error) {
    if (error.code === '22023' || error.code === '42501') return { error: error.message, ok: '' };
    console.error('[poner clave]', error.code, error.message);
    return { error: 'No se ha podido cambiar la contraseña. Inténtalo otra vez.', ok: '' };
  }
  return { error: '', ok: `Contraseña de ${quien.nombre} cambiada. Tendrá que volver a entrar con la nueva.` };
}
