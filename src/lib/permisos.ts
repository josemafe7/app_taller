// Qué puede hacer cada rol en la app. La base de datos aplica las mismas
// reglas por su cuenta (RLS, en supabase/migrations).

import type { Orden, Persona, VistaId } from './tipos';

const VISTAS: Record<Persona['rol'], VistaId[]> = {
  dueno: ['tablero', 'conversaciones', 'clientes', 'citas', 'tarifa', 'probar'],
  recepcion: ['tablero', 'conversaciones', 'clientes', 'citas'],
  mecanico: [],
};

export function vistasDe(p: Persona): VistaId[] {
  return VISTAS[p.rol];
}

export function puedeVer(p: Persona, vista: VistaId): boolean {
  return VISTAS[p.rol].includes(vista);
}

/** Dueño y recepción trabajan con todas las órdenes; cada mecánico, con las suyas. */
export function puedeTocarOrden(p: Persona, o: Orden): boolean {
  if (p.rol === 'mecanico') return o.mecanicoId === p.id;
  return true;
}

export function puedeEditarTarifa(p: Persona): boolean {
  return p.rol === 'dueno';
}

export function inicioDe(p: Persona): string {
  if (p.rol === 'mecanico') return '/movil';
  if (p.rol === 'recepcion') return '/conversaciones';
  return '/tablero';
}
