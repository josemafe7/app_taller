// Clientes de Supabase. Solo se usan en el servidor: ni la URL ni la clave
// llegan al navegador, y todas las consultas pasan por las reglas (RLS) de la
// base de datos con los permisos de quien las hace.
//  - clienteSesion(): con la sesión de la persona que ha entrado (cookies).
//  - clienteAsistente(): la cuenta del asistente del chat público, que solo
//    puede tocar conversaciones de la web, leer la tarifa y reservar citas.

import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './tipos-bd';
import { datosSupabase, esHttps, opcionesCookie } from './cookies';

export type Db = SupabaseClient<Database>;

/** Los usuarios del taller entran con su nombre; en Supabase son <nombre>@taller.invalid. */
export const emailDe = (persona: string) => `${persona}@taller.invalid`;

export const supabaseConfigurado = () => datosSupabase() !== null;

function config() {
  const d = datosSupabase();
  if (!d) throw new Error('Faltan SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en .env.local');
  return d;
}

/** Una por petición: comparten sesión la página, sus datos y las acciones. */
export const clienteSesion = cache(async (): Promise<Db> => {
  const { url, clave } = config();
  const almacen = await cookies();
  const https = esHttps(await headers());
  return createServerClient<Database>(url, clave, {
    cookieOptions: opcionesCookie(https),
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // Desde una página no se pueden escribir cookies: ya las refresca src/proxy.ts.
        }
      },
    },
  });
});

/** Cliente suelto, sin cookies (para comprobar una contraseña sin tocar la sesión). */
export function clienteSuelto(): Db {
  const { url, clave } = config();
  return createClient<Database>(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

declare global {
  var __trAsistente: { cliente: Db; caduca: number } | undefined;
  var __trAsistenteEntrando: Promise<Db> | undefined;
}

async function entrarComoAsistente(): Promise<Db> {
  const clave = process.env.SUPABASE_ASISTENTE_CLAVE?.trim();
  if (!clave) throw new Error('Falta SUPABASE_ASISTENTE_CLAVE en .env.local');
  const previo = globalThis.__trAsistente;
  if (previo) {
    const { data } = await previo.cliente.auth.refreshSession();
    if (data.session) {
      globalThis.__trAsistente = { cliente: previo.cliente, caduca: (data.session.expires_at ?? 0) * 1000 };
      return previo.cliente;
    }
  }
  const cliente = clienteSuelto();
  const { data, error } = await cliente.auth.signInWithPassword({ email: emailDe('asistente'), password: clave });
  if (error || !data.session) throw new Error(`No se ha podido entrar con la cuenta del asistente: ${error?.message ?? 'sin sesión'}`);
  globalThis.__trAsistente = { cliente, caduca: (data.session.expires_at ?? 0) * 1000 };
  return cliente;
}

export async function clienteAsistente(): Promise<Db> {
  const actual = globalThis.__trAsistente;
  if (actual && actual.caduca - Date.now() > 2 * 60_000) return actual.cliente;
  globalThis.__trAsistenteEntrando ??= entrarComoAsistente().finally(() => {
    globalThis.__trAsistenteEntrando = undefined;
  });
  return globalThis.__trAsistenteEntrando;
}
