// Paso de las filas de Supabase (snake_case) a los tipos de la app y al revés.

import type {
  BaseDatos, Canal, Cita, Cliente, Coche, Conversacion, EstadoOrden, Evento, InformeCliente, InformeInterno, Mensaje,
  Observacion, OrigenIA, Orden, PersonaId, Pieza, ServicioTarifa, Trabajo,
} from './tipos';
import type { Database, Json } from './supabase/tipos-bd';

type T = Database['public']['Tables'];
export type FilaCliente = T['clientes']['Row'];
export type FilaCoche = T['coches']['Row'];
export type FilaServicio = T['tarifa']['Row'];
export type FilaOrden = T['ordenes']['Row'];
export type FilaCita = T['citas']['Row'];
export type FilaConversacion = T['conversaciones']['Row'];
export type FilaMensaje = T['mensajes']['Row'];

/** Mientras la IA piensa se marca la conversación; si algo se cuelga, a los 2 minutos deja de contar. */
export const PENSANDO_MAX_MS = 2 * 60_000;

const iso = (s: string) => new Date(s).toISOString();
const isoOpc = (s: string | null | undefined) => (s ? iso(s) : undefined);
const opc = <X>(v: X | null | undefined): X | undefined => (v === null ? undefined : v);
const lista = <X>(v: Json): X[] => (Array.isArray(v) ? (v as unknown as X[]) : []);
const json = (v: unknown): Json => JSON.parse(JSON.stringify(v ?? null)) as Json;

// ——— Clientes y coches ———

export const aCliente = (f: FilaCliente): Cliente => ({
  id: f.id, nombre: f.nombre, nombreCorto: f.nombre_corto, contacto: opc(f.contacto), telefono: f.telefono, email: f.email, desde: f.desde,
});

export const deCliente = (c: Cliente) => ({
  id: c.id, nombre: c.nombre, nombre_corto: c.nombreCorto, contacto: c.contacto ?? null, telefono: c.telefono, email: c.email, desde: c.desde,
});

export const aCoche = (f: FilaCoche): Coche => ({
  id: f.id, clienteId: f.cliente_id, matricula: f.matricula, modelo: f.modelo, anio: f.anio, combustible: f.combustible,
});

export const deCoche = (c: Coche) => ({
  id: c.id, cliente_id: c.clienteId, matricula: c.matricula, modelo: c.modelo, anio: c.anio, combustible: c.combustible,
});

// ——— Tarifa ———

export const aServicio = (f: FilaServicio): ServicioTarifa => ({
  id: f.id, categoria: f.categoria, nombre: f.nombre, tiempo: f.tiempo, precio: Number(f.precio), porUnidad: f.por_unidad,
});

export const deServicio = (s: ServicioTarifa) => ({
  id: s.id, categoria: s.categoria, nombre: s.nombre, tiempo: s.tiempo, precio: s.precio, por_unidad: s.porUnidad,
});

// ——— Órdenes ———

export const aOrden = (f: FilaOrden): Orden => ({
  id: f.id,
  cocheId: f.coche_id,
  estado: f.estado as EstadoOrden,
  km: f.km,
  mecanicoId: f.mecanico_id as PersonaId,
  entrada: iso(f.entrada),
  cierre: isoOpc(f.cierre),
  motivo: f.motivo,
  trabajos: lista<Trabajo>(f.trabajos),
  piezas: lista<Pieza>(f.piezas),
  observaciones: lista<Observacion>(f.observaciones),
  historial: lista<Evento>(f.historial),
  ultimaIA: (f.ultima_ia as { cuando: string; via: OrigenIA } | null) ?? undefined,
  informes: (f.informes as { cliente?: InformeCliente; interno?: InformeInterno } | null) ?? {},
  version: f.version,
});

/** Lo que se guarda al cambiar una orden (el código, el coche y la entrada no cambian). */
export const cambiosDeOrden = (o: Orden) => ({
  estado: o.estado,
  km: o.km,
  mecanico_id: o.mecanicoId,
  cierre: o.cierre ?? null,
  motivo: o.motivo,
  trabajos: json(o.trabajos),
  piezas: json(o.piezas),
  observaciones: json(o.observaciones),
  historial: json(o.historial),
  ultima_ia: o.ultimaIA ? json(o.ultimaIA) : null,
  informes: json(o.informes),
});

export const deOrden = (o: Orden) => ({ id: o.id, coche_id: o.cocheId, entrada: o.entrada, ...cambiosDeOrden(o) });

// ——— Citas ———

export const aCita = (f: FilaCita): Cita => ({
  id: f.id, fecha: f.fecha, hora: f.hora, nombre: f.nombre, telefono: f.telefono, matricula: f.matricula, coche: f.coche,
  motivo: f.motivo, clienteId: opc(f.cliente_id), ordenId: opc(f.orden_id), conversacionId: opc(f.conversacion_id),
  origen: f.origen as Cita['origen'], creada: iso(f.creada),
});

export const deCita = (c: Cita) => ({
  id: c.id, fecha: c.fecha, hora: c.hora, nombre: c.nombre, telefono: c.telefono, matricula: c.matricula, coche: c.coche,
  motivo: c.motivo, cliente_id: c.clienteId ?? null, orden_id: c.ordenId ?? null, conversacion_id: c.conversacionId ?? null,
  origen: c.origen, creada: c.creada,
});

// ——— Conversaciones ———

export const aMensaje = (f: Pick<FilaMensaje, 'id' | 'de' | 'texto' | 'cuando' | 'autor'>): Mensaje => ({
  id: f.id, de: f.de as Mensaje['de'], texto: f.texto, cuando: iso(f.cuando), autor: opc(f.autor),
});

export function aConversacion(f: FilaConversacion, mensajes: Mensaje[]): Conversacion {
  const pensando = f.ia_pensando_desde ? Date.now() - Date.parse(f.ia_pensando_desde) < PENSANDO_MAX_MS : false;
  return {
    id: f.id, clienteId: opc(f.cliente_id), nombre: f.nombre, canal: f.canal as Canal, contacto: opc(f.contacto),
    modo: f.modo as Conversacion['modo'], necesitaPersona: f.necesita_persona, motivo: opc(f.motivo), mensajes,
    actualizada: iso(f.actualizada), creada: iso(f.creada), iaPensando: pensando, prueba: f.prueba || undefined,
  };
}

// ——— Carga completa (migración y «npm run reset») ———

export function datosParaCargar(base: BaseDatos): Json {
  return json({
    clientes: base.clientes.map(deCliente),
    coches: base.coches.map(deCoche),
    tarifa: base.tarifa.map(deServicio),
    conversaciones: base.conversaciones.map((c) => ({
      id: c.id, cliente_id: c.clienteId ?? null, nombre: c.nombre, canal: c.canal, contacto: c.contacto ?? null, modo: c.modo,
      necesita_persona: c.necesitaPersona, motivo: c.motivo ?? null, actualizada: c.actualizada, creada: c.creada,
    })),
    mensajes: base.conversaciones.flatMap((c) =>
      c.mensajes.map((m) => ({ id: m.id, conversacion_id: c.id, de: m.de, texto: m.texto, cuando: m.cuando, autor: m.autor ?? null }))),
    ordenes: base.ordenes.map(deOrden),
    citas: base.citas.map(deCita),
    siguiente_orden: base.siguienteOrden,
    visitantes_web: base.visitantesWeb,
  });
}
