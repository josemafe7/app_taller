// Lecturas de la base de datos. Cada función recibe el cliente de Supabase de
// quien pregunta: la base de datos solo devuelve lo que esa persona puede ver.

import 'server-only';
import type { Cita, Cliente, Coche, Conversacion, Orden, ServicioTarifa } from './tipos';
import type { Db } from './supabase/servidor';
import { aCita, aCliente, aCoche, aConversacion, aMensaje, aOrden, aServicio, type FilaConversacion, type FilaMensaje } from './filas';
import { claveMatricula } from './formato';
import { datosO, quizas } from './errores';

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

// ——— Tarifa ———

export async function leerTarifa(db: Db): Promise<ServicioTarifa[]> {
  return datosO(await db.from('tarifa').select('*').order('posicion'), 'tarifa').map(aServicio);
}

// ——— Clientes y coches ———

export async function leerClientes(db: Db): Promise<Cliente[]> {
  return datosO(await db.from('clientes').select('*'), 'clientes').map(aCliente).sort(porNombre);
}

export async function leerCliente(db: Db, id: string): Promise<Cliente | undefined> {
  const f = quizas(await db.from('clientes').select('*').eq('id', id).maybeSingle(), 'cliente');
  return f ? aCliente(f) : undefined;
}

export async function clientesPorIds(db: Db, ids: string[]): Promise<Cliente[]> {
  if (!ids.length) return [];
  return datosO(await db.from('clientes').select('*').in('id', [...new Set(ids)]), 'clientes').map(aCliente);
}

export async function leerCoches(db: Db): Promise<Coche[]> {
  return datosO(await db.from('coches').select('*').order('creado'), 'coches').map(aCoche);
}

export async function cochesDe(db: Db, clienteId: string): Promise<Coche[]> {
  return datosO(await db.from('coches').select('*').eq('cliente_id', clienteId).order('creado'), 'coches').map(aCoche);
}

export async function leerCoche(db: Db, id: string): Promise<Coche | undefined> {
  const f = quizas(await db.from('coches').select('*').eq('id', id).maybeSingle(), 'coche');
  return f ? aCoche(f) : undefined;
}

export async function cochesPorIds(db: Db, ids: string[]): Promise<Coche[]> {
  if (!ids.length) return [];
  return datosO(await db.from('coches').select('*').in('id', [...new Set(ids)]), 'coches').map(aCoche);
}

export async function cochePorMatricula(db: Db, matricula: string): Promise<Coche | undefined> {
  const clave = claveMatricula(matricula);
  if (!clave) return undefined;
  const f = quizas(await db.from('coches').select('*').eq('matricula_clave', clave).maybeSingle(), 'coche');
  return f ? aCoche(f) : undefined;
}

// ——— Órdenes ———

export async function leerOrden(db: Db, id: string): Promise<Orden | undefined> {
  const f = quizas(await db.from('ordenes').select('*').eq('id', id.trim().toUpperCase()).maybeSingle(), 'orden');
  return f ? aOrden(f) : undefined;
}

export async function ordenesAbiertas(db: Db): Promise<Orden[]> {
  return datosO(await db.from('ordenes').select('*').neq('estado', 'entregado'), 'ordenes').map(aOrden);
}

export async function ordenAbiertaDe(db: Db, cocheId: string): Promise<Orden | undefined> {
  const f = quizas(await db.from('ordenes').select('*').eq('coche_id', cocheId).neq('estado', 'entregado').maybeSingle(), 'orden');
  return f ? aOrden(f) : undefined;
}

/** Todas las órdenes (abiertas y cerradas) de unos coches. */
export async function ordenesDeCoches(db: Db, cocheIds: string[]): Promise<Orden[]> {
  if (!cocheIds.length) return [];
  return datosO(await db.from('ordenes').select('*').in('coche_id', [...new Set(cocheIds)]), 'ordenes').map(aOrden);
}

export interface OrdenCompleta {
  orden: Orden;
  coche: Coche;
  cliente: Cliente;
}

/** Junta a cada orden su coche y su cliente (dos consultas para todas). */
export async function conCocheYCliente(db: Db, ordenes: Orden[]): Promise<OrdenCompleta[]> {
  const coches = await cochesPorIds(db, ordenes.map((o) => o.cocheId));
  const clientes = await clientesPorIds(db, coches.map((c) => c.clienteId));
  const coche = new Map(coches.map((c) => [c.id, c]));
  const cliente = new Map(clientes.map((c) => [c.id, c]));
  return ordenes.flatMap((orden) => {
    const v = coche.get(orden.cocheId);
    const c = v && cliente.get(v.clienteId);
    return v && c ? [{ orden, coche: v, cliente: c }] : [];
  });
}

export async function datosDeOrden(db: Db, o: Orden): Promise<{ coche: Coche; cliente: Cliente }> {
  const [completa] = await conCocheYCliente(db, [o]);
  if (!completa) throw new Error(`La orden ${o.id} apunta a un coche o cliente que no se puede leer`);
  return { coche: completa.coche, cliente: completa.cliente };
}

// ——— Conversaciones ———

type FilaConUltimo = FilaConversacion & { mensajes: Pick<FilaMensaje, 'id' | 'de' | 'texto' | 'cuando' | 'autor'>[] };

/** Bandeja: primero las que necesitan a una persona; luego, las más recientes. Solo con el último mensaje. */
export async function conversacionesBandeja(db: Db): Promise<Conversacion[]> {
  const r = await db
    .from('conversaciones')
    .select('*, mensajes(id, de, texto, cuando, autor)')
    .order('necesita_persona', { ascending: false })
    .order('actualizada', { ascending: false })
    .order('n', { referencedTable: 'mensajes', ascending: false })
    .limit(1, { referencedTable: 'mensajes' });
  const filas = datosO(r, 'conversaciones') as unknown as FilaConUltimo[];
  return filas.map((f) => aConversacion(f, f.mensajes.map(aMensaje)));
}

export async function leerConversacion(db: Db, id: string): Promise<Conversacion | undefined> {
  const [cabecera, mensajes] = await Promise.all([
    db.from('conversaciones').select('*').eq('id', id).maybeSingle(),
    db.from('mensajes').select('id, de, texto, cuando, autor').eq('conversacion_id', id).order('n'),
  ]);
  const f = quizas(cabecera, 'conversación');
  if (!f) return undefined;
  return aConversacion(f, datosO(mensajes, 'mensajes').map(aMensaje));
}

/** Solo la cabecera (modo, si necesita persona…), sin mensajes. */
export async function cabeceraConversacion(db: Db, id: string): Promise<Conversacion | undefined> {
  const f = quizas(await db.from('conversaciones').select('*').eq('id', id).maybeSingle(), 'conversación');
  return f ? aConversacion(f, []) : undefined;
}

/** La conversación más reciente de un cliente (solo el id y el nombre). */
export async function conversacionDe(db: Db, clienteId: string): Promise<{ id: string } | undefined> {
  const f = quizas(
    await db.from('conversaciones').select('id').eq('cliente_id', clienteId).order('actualizada', { ascending: false }).limit(1).maybeSingle(),
    'conversación',
  );
  return f ?? undefined;
}

/** Los chats de prueba del dueño no cuentan: no deben avisar a recepción. */
export async function pendientesDePersona(db: Db): Promise<number> {
  const r = await db.from('conversaciones').select('id', { count: 'exact', head: true }).eq('necesita_persona', true).eq('prueba', false);
  if (r.error) return 0;
  return r.count ?? 0;
}

// ——— Citas ———

export async function citasEntre(db: Db, desde: string, hasta: string): Promise<Cita[]> {
  return datosO(await db.from('citas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('hora'), 'citas').map(aCita);
}

export async function leerCita(db: Db, id: string): Promise<Cita | undefined> {
  const f = quizas(await db.from('citas').select('*').eq('id', id).maybeSingle(), 'cita');
  return f ? aCita(f) : undefined;
}

/** Huecos cogidos entre dos fechas (solo fecha y hora). Lo puede usar el asistente. */
export async function huecosOcupados(db: Db, desde: string, hasta: string): Promise<Set<string>> {
  const filas = datosO(await db.rpc('huecos_ocupados', { p_desde: desde, p_hasta: hasta }), 'huecos');
  return new Set((filas ?? []).map((h) => `${h.fecha} ${h.hora}`));
}
