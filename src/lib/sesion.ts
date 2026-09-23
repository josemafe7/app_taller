// Quién ha entrado. La sesión es de Supabase Auth (cookies httpOnly); aquí se
// comprueba su firma y se saca la persona y el rol, que van en app_metadata
// (solo se pueden cambiar desde la base de datos, nunca desde la app).

import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { PERSONAS } from './constantes';
import { inicioDe, puedeVer } from './permisos';
import { clienteSesion, supabaseConfigurado, type Db } from './supabase/servidor';
import type { Persona, VistaId } from './tipos';

export const personaActual = cache(async (): Promise<Persona | null> => {
  if (!supabaseConfigurado()) return null;
  const db = await clienteSesion();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims) return null;
  const app = (data.claims.app_metadata ?? {}) as { persona?: unknown; rol?: unknown };
  const p = PERSONAS.find((x) => x.id === app.persona);
  // La persona y el rol tienen que cuadrar con los de la app.
  if (!p || p.rol !== app.rol) return null;
  return p;
});

/** Cliente de Supabase con la sesión de quien ha entrado. */
export const dbSesion = (): Promise<Db> => clienteSesion();

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Acepta "paco", "Paco", "Lucía", "lucia", "Rubén Ortega"… */
export function usuarioDe(texto: string): Persona | undefined {
  const t = sinAcentos(texto);
  if (!t) return undefined;
  return PERSONAS.find((p) => p.id === t || sinAcentos(p.nombre) === t || sinAcentos(p.nombreCompleto) === t);
}

/** Para páginas: sin sesión, a la pantalla de entrar. */
export async function personaObligatoria(): Promise<Persona> {
  const p = await personaActual();
  if (!p) redirect('/entrar');
  return p;
}

/** Para páginas: si la persona no puede ver esta sección, la manda a su inicio. */
export async function exigirVista(vista: VistaId): Promise<Persona> {
  const p = await personaObligatoria();
  if (!puedeVer(p, vista)) redirect(inicioDe(p));
  return p;
}
