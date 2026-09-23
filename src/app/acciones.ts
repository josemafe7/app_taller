'use server';

// Acciones que cambian datos desde la interfaz. Todas comprueban quién ha entrado
// y su rol antes de tocar nada; además, la base de datos vuelve a comprobarlo
// con sus propias reglas (RLS) usando la sesión de esa persona.

import { refresh } from 'next/cache';
import { z } from 'zod';
import type { EstadoId, EstadoPieza, InformeCliente, InformeInterno, Persona, PersonaId, Propuesta, Resultado } from '@/lib/tipos';
import { PERSONAS } from '@/lib/constantes';
import { dbSesion, personaActual } from '@/lib/sesion';
import { puedeEditarTarifa, puedeTocarOrden } from '@/lib/permisos';
import { cochePorMatricula, leerOrden, leerTarifa, ordenAbiertaDe } from '@/lib/datos';
import { servicioDe } from '@/lib/calculos';
import { aNumero } from '@/lib/formato';
import { firmaInforme } from '@/lib/ia/informe';
import type { Db } from '@/lib/supabase/servidor';
import * as op from '@/lib/operaciones';

type Permiso = (actor: Persona, db: Db) => boolean | Promise<boolean>;

const esEscritorio: Permiso = (a) => a.rol !== 'mecanico';
const esDueno: Permiso = (a) => puedeEditarTarifa(a);
const sobreOrden = (id: string): Permiso => async (a, db) => {
  const o = await leerOrden(db, id);
  return Boolean(o && puedeTocarOrden(a, o));
};

async function ejecutar(permiso: Permiso, fn: (actor: Persona, db: Db) => Promise<Resultado | string | void>): Promise<Resultado> {
  const actor = await personaActual();
  if (!actor) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };
  try {
    const db = await dbSesion();
    if (!(await permiso(actor, db))) return { ok: false, error: 'Con este perfil no puedes hacer esto.' };
    const r = await fn(actor, db);
    refresh();
    if (typeof r === 'string') return { ok: true, mensaje: r };
    return r ?? { ok: true };
  } catch (e) {
    if (e instanceof op.ErrorNegocio) return { ok: false, error: e.message };
    console.error('[accion]', e);
    return { ok: false, error: 'Algo ha fallado. Inténtalo otra vez.' };
  }
}

// ——— Clientes y coches ———

export async function guardarClienteAccion(d: op.DatosCliente): Promise<Resultado> {
  return ejecutar(esEscritorio, async (_a, db) => {
    const c = await op.guardarCliente(db, d);
    return { ok: true, id: c.id, mensaje: d.id ? 'Cliente guardado.' : `${c.nombreCorto} ya tiene ficha.` };
  });
}

export async function guardarCocheAccion(d: op.DatosCoche): Promise<Resultado> {
  return ejecutar(esEscritorio, async (_a, db) => {
    const c = await op.guardarCoche(db, d);
    return { ok: true, id: c.id, mensaje: d.id ? 'Coche guardado.' : `${c.matricula} añadido.` };
  });
}

// ——— Órdenes ———

export interface DatosAbrirOrden {
  cocheId?: string;
  nuevoCliente?: op.DatosCliente;
  clienteId?: string;
  nuevoCoche?: Omit<op.DatosCoche, 'clienteId'>;
  motivo: string;
  km: string;
  mecanicoId: PersonaId;
  citaId?: string;
}

export async function abrirOrdenAccion(d: DatosAbrirOrden): Promise<Resultado> {
  return ejecutar(esEscritorio, async (actor, db) => {
    const km = aNumero(d.km);
    if (km === null) throw new op.ErrorNegocio('Pon los kilómetros del coche.');
    if (!d.motivo?.trim()) throw new op.ErrorNegocio('Escribe el motivo de entrada.');
    if (!PERSONAS.some((p) => p.id === d.mecanicoId && p.rol === 'mecanico')) throw new op.ErrorNegocio('Elige el mecánico.');
    let cocheId = d.cocheId;
    if (!cocheId) {
      if (!d.nuevoCoche) throw new op.ErrorNegocio('Elige el coche o da de alta uno nuevo.');
      const repetido = await cochePorMatricula(db, d.nuevoCoche.matricula ?? '');
      if (repetido) throw new op.ErrorNegocio(`La matrícula ${repetido.matricula} ya está dada de alta. Elígela en la lista.`);
      if (!d.nuevoCoche.modelo?.trim()) throw new op.ErrorNegocio('Falta la marca y el modelo del coche.');
      let clienteId = d.clienteId;
      if (!clienteId) {
        if (!d.nuevoCliente) throw new op.ErrorNegocio('Elige el cliente o da de alta uno nuevo.');
        clienteId = (await op.guardarCliente(db, d.nuevoCliente)).id;
      }
      cocheId = (await op.guardarCoche(db, { ...d.nuevoCoche, clienteId })).id;
    }
    const dentro = await ordenAbiertaDe(db, cocheId);
    if (dentro) throw new op.ErrorNegocio(`Ese coche ya está en el taller con la orden ${dentro.id}.`);
    const o = await op.abrirOrden(db, { cocheId, motivo: d.motivo, km, mecanicoId: d.mecanicoId, citaId: d.citaId }, actor);
    return { ok: true, id: o.id, mensaje: `Orden ${o.id} abierta.` };
  });
}

export async function cambiarEstadoAccion(ordenId: string, estado: EstadoId): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    await op.cambiarEstado(db, ordenId, estado, actor);
    return 'Estado cambiado.';
  });
}

export async function guardarDatosOrdenAccion(ordenId: string, d: { motivo?: string; km?: string; mecanicoId?: PersonaId }): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    const km = d.km === undefined ? undefined : aNumero(d.km);
    if (d.km !== undefined && km === null) throw new op.ErrorNegocio('Los kilómetros no son válidos.');
    const n = await op.editarDatosOrden(db, ordenId, { motivo: d.motivo, km: km ?? undefined, mecanicoId: d.mecanicoId }, actor);
    return n ? 'Orden guardada.' : 'No había cambios.';
  });
}

export async function anadirTrabajoAccion(ordenId: string, d: { descripcion: string; tarifaId: string | null; cantidad: number; precio: string; hechoPor: PersonaId }): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    const precio = d.precio?.trim() ? aNumero(d.precio) : null;
    if (d.precio?.trim() && precio === null) throw new op.ErrorNegocio('El precio no es válido.');
    const tarifa = await leerTarifa(db);
    await op.anadirTrabajo(db, ordenId, { descripcion: d.descripcion, tarifaId: servicioDe(tarifa, d.tarifaId)?.id ?? null, cantidad: d.cantidad, precio, hechoPor: d.hechoPor }, actor);
    return `Trabajo añadido a ${ordenId}.`;
  });
}

export async function editarTrabajoAccion(ordenId: string, trabajoId: string, d: { descripcion?: string; precio?: string; hechoPor?: PersonaId }): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    let precio: number | null | undefined;
    if (d.precio !== undefined) {
      precio = d.precio.trim() ? aNumero(d.precio) : null;
      if (d.precio.trim() && precio === null) throw new op.ErrorNegocio('El precio no es válido.');
    }
    await op.editarTrabajo(db, ordenId, trabajoId, { descripcion: d.descripcion, precio, hechoPor: d.hechoPor }, actor);
    return 'Trabajo guardado.';
  });
}

export async function borrarTrabajoAccion(ordenId: string, trabajoId: string): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    await op.borrarTrabajo(db, ordenId, trabajoId, actor);
    return 'Trabajo quitado.';
  });
}

export async function anadirPiezaAccion(ordenId: string, d: { descripcion: string; estado: EstadoPieza; nota: string }): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    await op.anadirPieza(db, ordenId, d, actor);
    return 'Pieza añadida.';
  });
}

export async function editarPiezaAccion(ordenId: string, piezaId: string, d: { descripcion?: string; estado?: EstadoPieza; nota?: string }): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    await op.editarPieza(db, ordenId, piezaId, d, actor);
    return 'Pieza guardada.';
  });
}

export async function borrarPiezaAccion(ordenId: string, piezaId: string): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    await op.borrarPieza(db, ordenId, piezaId, actor);
    return 'Pieza quitada.';
  });
}

export async function anadirObservacionAccion(ordenId: string, d: { texto: string; recomendacion: boolean }): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    await op.anadirObservacion(db, ordenId, d, actor);
    return d.recomendacion ? 'Recomendación añadida. Saldrá en el informe.' : 'Observación añadida.';
  });
}

export async function editarObservacionAccion(ordenId: string, obsId: string, d: { texto?: string; recomendacion?: boolean }): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    await op.editarObservacion(db, ordenId, obsId, d, actor);
    return 'Observación guardada.';
  });
}

export async function borrarObservacionAccion(ordenId: string, obsId: string): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    await op.borrarObservacion(db, ordenId, obsId, actor);
    return 'Observación quitada.';
  });
}

export async function cerrarOrdenAccion(ordenId: string): Promise<Resultado> {
  return ejecutar(esEscritorio, async (actor, db) => {
    await op.cerrarOrden(db, ordenId, actor);
    return `Orden ${ordenId} cerrada. Pasa al historial del coche.`;
  });
}

export async function reabrirOrdenAccion(ordenId: string): Promise<Resultado> {
  return ejecutar(esEscritorio, async (actor, db) => {
    await op.reabrirOrden(db, ordenId, actor);
    return `Orden ${ordenId} reabierta.`;
  });
}

// ——— Rellenar con IA: guardar lo que el mecánico ha confirmado ———

const texto = (max: number) => z.string().max(max);
const PropuestaEntrada = z.object({
  via: z.enum(['voz', 'texto', 'mano']),
  texto: texto(20000).default(''),
  segmentos: z.array(z.object({ t: z.string(), n: z.number().nullable() })).default([]),
  trabajos: z.array(z.object({
    clave: z.string(), n: z.number().optional(), descripcion: texto(300), tarifaId: z.string().nullable(),
    cantidad: z.number().int().min(1).max(50), precioManual: z.number().min(0).max(100_000).nullable(),
  })).max(40),
  piezas: z.array(z.object({
    clave: z.string(), n: z.number().optional(), piezaId: z.string().nullable(), descripcion: texto(300),
    estado: z.enum(['pendiente', 'pedida', 'recibida', 'stock']), nota: texto(200),
  })).max(40),
  observaciones: z.array(z.object({
    clave: z.string(), n: z.number().optional(), texto: texto(2000), recomendacion: z.boolean(), tarifaId: z.string().nullable(),
  })).max(40),
  km: z.number().int().min(0).max(3_000_000).nullable(),
  kmN: z.number().optional(),
  estado: z.enum(['recibido', 'diagnostico', 'pieza', 'reparacion', 'listo']).nullable(),
  estadoN: z.number().optional(),
  estadoMotivo: z.string().optional(),
});

export async function confirmarPropuestaAccion(ordenId: string, propuesta: Propuesta): Promise<Resultado> {
  return ejecutar(sobreOrden(ordenId), async (actor, db) => {
    const p = PropuestaEntrada.safeParse(propuesta);
    if (!p.success) throw new op.ErrorNegocio('Los cambios no son válidos. Revísalos.');
    const n = await op.aplicarPropuesta(db, ordenId, p.data, actor);
    if (!n) throw new op.ErrorNegocio('No hay nada que guardar.');
    return n === 1 ? 'Ficha guardada: 1 cambio.' : `Ficha guardada: ${n} cambios.`;
  });
}

// ——— Citas ———

export async function reservarCitaAccion(d: op.DatosCita): Promise<Resultado> {
  return ejecutar(esEscritorio, async (_a, db) => {
    const c = await op.reservarCita(db, d, 'taller');
    return { ok: true, id: c.id, mensaje: 'Cita reservada.' };
  });
}

export async function anularCitaAccion(id: string): Promise<Resultado> {
  return ejecutar(esEscritorio, async (_a, db) => {
    await op.anularCita(db, id);
    return 'Cita anulada. El hueco queda libre.';
  });
}

// ——— Tarifa (solo el dueño) ———

export async function guardarServicioAccion(d: Omit<op.DatosServicio, 'precio'> & { precio: string }): Promise<Resultado> {
  return ejecutar(esDueno, async (_a, db) => {
    const precio = aNumero(d.precio);
    if (precio === null) throw new op.ErrorNegocio('Pon el precio.');
    const s = await op.guardarServicio(db, { ...d, precio });
    return { ok: true, id: s.id, mensaje: d.id ? 'Tarifa actualizada.' : `${s.nombre} añadido a la tarifa.` };
  });
}

export async function borrarServicioAccion(id: string): Promise<Resultado> {
  return ejecutar(esDueno, async (_a, db) => {
    await op.borrarServicio(db, id);
    return 'Servicio quitado de la tarifa.';
  });
}

// ——— Conversaciones ———

export async function enviarMensajeAccion(conversacionId: string, textoMensaje: string): Promise<Resultado> {
  return ejecutar(esEscritorio, async (_a, db) => {
    await op.mensajeDelTaller(db, conversacionId, textoMensaje);
  });
}

export async function cambiarModoAccion(conversacionId: string, modo: 'ia' | 'persona'): Promise<Resultado> {
  return ejecutar(esEscritorio, async (_a, db) => {
    await op.cambiarModo(db, conversacionId, modo);
    return modo === 'ia' ? 'Ahora contesta la IA.' : 'Ahora contesta una persona.';
  });
}

// ——— Informe: retoques a mano del texto ———

export async function guardarInformeAccion(ordenId: string, version: 'cliente' | 'interno',
  d: { resumen: string; trabajos?: Record<string, string>; recomendaciones?: Record<string, string>; puntos?: string[] }): Promise<Resultado> {
  return ejecutar(esEscritorio, async (_a, db) => {
    await op.guardarInforme(db, ordenId, version, (o) => {
      const comun = { generado: new Date().toISOString(), firma: firmaInforme(o), resumen: d.resumen.trim() };
      if (version === 'cliente') {
        const nuevo: InformeCliente = {
          ...comun, porIA: o.informes.cliente?.porIA ?? false,
          trabajos: limpiarMapa(d.trabajos ?? {}), recomendaciones: limpiarMapa(d.recomendaciones ?? {}),
        };
        return nuevo;
      }
      const nuevo: InformeInterno = {
        ...comun, porIA: o.informes.interno?.porIA ?? false, puntos: (d.puntos ?? []).map((x) => x.trim()).filter(Boolean),
      };
      return nuevo;
    });
    return 'Texto del informe guardado.';
  });
}

function limpiarMapa(m: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v));
}
