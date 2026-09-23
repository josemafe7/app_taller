// Datos ya preparados (y serializables) para los componentes de cliente.

import type { EstadoPieza, Observacion, OrigenIA, PersonaId, Pieza, ServicioTarifa, Trabajo } from './tipos';
import { servicioDe } from './calculos';
import { nombrePersona } from './constantes';
import { fmtSello } from './fechas';

const UN_DIA = 24 * 3600_000;
const reciente = (ia: OrigenIA | undefined, cuando: string) => Boolean(ia) && Date.now() - Date.parse(cuando) < UN_DIA;

export interface TrabajoVista {
  id: string;
  descripcion: string;
  precio: number | null;
  origen: 'tarifa' | 'mano';
  cantidad: number;
  hechoPor: PersonaId;
  hechoPorNombre: string;
  cuando: string;
  ia?: OrigenIA;
  reciente: boolean;
}

export function vistaTrabajo(t: Trabajo): TrabajoVista {
  return {
    id: t.id, descripcion: t.descripcion, precio: t.precio, origen: t.origen, cantidad: t.cantidad, hechoPor: t.hechoPor,
    hechoPorNombre: nombrePersona(t.hechoPor), cuando: fmtSello(t.cuando), ia: t.ia, reciente: reciente(t.ia, t.cuando),
  };
}

export interface PiezaVista {
  id: string;
  descripcion: string;
  estado: EstadoPieza;
  nota: string;
  reciente: boolean;
}

export function vistaPieza(p: Pieza): PiezaVista {
  return { id: p.id, descripcion: p.descripcion, estado: p.estado, nota: p.nota ?? '', reciente: reciente(p.ia, p.cuando) };
}

export interface ObservacionVista {
  id: string;
  texto: string;
  recomendacion: boolean;
  quienNombre: string;
  cuando: string;
  reciente: boolean;
  tarifa?: { nombre: string; precio: number; porUnidad: boolean };
}

export function vistaObservacion(o: Observacion, tarifa: ServicioTarifa[]): ObservacionVista {
  const s = servicioDe(tarifa, o.tarifaId);
  return {
    id: o.id, texto: o.texto, recomendacion: o.recomendacion, quienNombre: nombrePersona(o.quien), cuando: fmtSello(o.cuando),
    reciente: reciente(o.ia, o.cuando), tarifa: s ? { nombre: s.nombre, precio: s.precio, porUnidad: s.porUnidad } : undefined,
  };
}
