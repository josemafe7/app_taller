// Cuentas sobre los datos ya cargados (sin ir a la base de datos).

import type { Orden, ServicioTarifa } from './tipos';

export function totalOrden(o: Pick<Orden, 'trabajos'>): number {
  return o.trabajos.reduce((s, t) => s + (t.precio ?? 0), 0);
}

export function trabajosSinPrecio(o: Pick<Orden, 'trabajos'>): number {
  return o.trabajos.filter((t) => t.precio === null).length;
}

export const servicioDe = (tarifa: ServicioTarifa[], id: string | null | undefined): ServicioTarifa | undefined =>
  id ? tarifa.find((s) => s.id === id) : undefined;

/** Órdenes cerradas, de la más reciente a la más antigua. */
export const cerradasRecientes = (ordenes: Orden[]): Orden[] =>
  ordenes
    .filter((o) => o.estado === 'entregado')
    .sort((a, b) => (b.cierre ?? b.entrada).localeCompare(a.cierre ?? a.entrada));
