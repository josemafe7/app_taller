// Todas las operaciones que cambian datos. Cada cambio en una orden deja su
// línea en el historial de esa orden.
//
// Las órdenes se cambian así: se lee la orden, se aplica el cambio y se guarda
// de una vez solo si nadie la ha tocado entretanto (columna "version"); si
// alguien la ha tocado, se vuelve a leer y se repite. Así nunca se pisan cambios.

import 'server-only';
import { randomUUID } from 'node:crypto';
import type {
  Cita, Cliente, Coche, Conversacion, EstadoId, EstadoPieza, Mensaje, OrigenIA, Orden, Persona, PersonaId,
  Propuesta, ServicioTarifa, Trabajo,
} from './tipos';
import type { Db } from './supabase/servidor';
import { cochePorMatricula, huecosOcupados, leerCita, leerCliente, leerCoche, leerOrden, leerTarifa, ordenAbiertaDe } from './datos';
import { aCliente, aCoche, aServicio, cambiosDeOrden, deCita, type FilaCliente } from './filas';
import { servicioDe, trabajosSinPrecio } from './calculos';
import { ESTADOS, ESTADOS_PIEZA, ESTADOS_TABLERO, HUECOS, persona } from './constantes';
import { eur, fkm, formatearMatricula, nombreCortoDe } from './formato';
import { esLaborable, hoy, horaDe, instante, sumarDias } from './fechas';
import { datosO, errorDeBd, ErrorNegocio, quizas, sinError } from './errores';

export { ErrorNegocio };

const ahora = () => new Date().toISOString();
const nuevoId = (prefijo: string) => `${prefijo}-${randomUUID().slice(0, 8)}`;
const limpio = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');

function exigirAbierta(o: Orden) {
  if (o.estado === 'entregado') throw new ErrorNegocio(`La orden ${o.id} está cerrada. Reábrela para cambiarla.`);
}

function anotar(o: Orden, quien: string, texto: string, ia = false) {
  o.historial.push({ id: nuevoId('ev'), cuando: ahora(), quien, texto, ia });
}

const precioTexto = (p: number | null) => (p === null ? 'precio a poner' : eur(p));

function validarPrecio(p: number | null | undefined): number | null {
  if (p === null || p === undefined) return null;
  if (!Number.isFinite(p) || p < 0 || p > 100_000) throw new ErrorNegocio('El precio no es válido.');
  return Math.round(p * 100) / 100;
}

/**
 * Lee la orden, aplica el cambio y la guarda de una vez. Si otra persona la ha
 * cambiado mientras tanto, repite con la versión nueva.
 */
async function cambiarOrden<R>(db: Db, id: string, cambio: (o: Orden, tarifa: ServicioTarifa[]) => R,
  opciones: { tarifa?: boolean } = {}): Promise<R> {
  const tarifa = opciones.tarifa ? await leerTarifa(db) : [];
  for (let intento = 0; intento < 4; intento++) {
    const o = await leerOrden(db, id);
    if (!o) throw new ErrorNegocio('No existe esa orden.');
    const antes = JSON.stringify(cambiosDeOrden(o));
    const resultado = cambio(o, tarifa);
    const despues = cambiosDeOrden(o);
    if (JSON.stringify(despues) === antes) return resultado;
    const r = await db.from('ordenes').update(despues).eq('id', o.id).eq('version', o.version ?? 0).select('id');
    if (datosO(r, 'guardar orden').length) return resultado;
  }
  throw new ErrorNegocio('Otra persona está cambiando esta orden ahora mismo. Vuelve a intentarlo.');
}

// ——— Clientes y coches ———

export interface DatosCliente {
  id?: string;
  nombre: string;
  nombreCorto?: string;
  contacto?: string;
  telefono: string;
  email: string;
  conversacionId?: string;
}

export async function guardarCliente(db: Db, d: DatosCliente): Promise<Cliente> {
  const nombre = limpio(d.nombre);
  const telefono = limpio(d.telefono);
  if (!nombre) throw new ErrorNegocio('Falta el nombre del cliente.');
  if (!telefono && !limpio(d.email)) throw new ErrorNegocio('Pon al menos un teléfono o un email.');
  const datos = {
    nombre,
    nombre_corto: limpio(d.nombreCorto) || nombreCortoDe(nombre),
    contacto: limpio(d.contacto) || null,
    telefono,
    email: limpio(d.email).toLowerCase(),
  };
  if (d.id) {
    const filas = datosO(await db.from('clientes').update(datos).eq('id', d.id).select('*'), 'guardar cliente');
    if (!filas.length) throw new ErrorNegocio('No existe ese cliente.');
    return aCliente(filas[0]);
  }
  const fila = datosO<FilaCliente>(
    await db.from('clientes').insert({ id: nuevoId('c'), desde: new Date().getFullYear(), ...datos }).select('*').single(),
    'nuevo cliente',
  );
  const nuevo = aCliente(fila);
  if (d.conversacionId) {
    // Enlaza la conversación de la que venía (si todavía no tenía cliente).
    sinError(
      await db.from('conversaciones').update({ cliente_id: nuevo.id, nombre: nuevo.nombreCorto })
        .eq('id', d.conversacionId).is('cliente_id', null),
      'enlazar conversación',
    );
  }
  return nuevo;
}

export interface DatosCoche {
  id?: string;
  clienteId: string;
  matricula: string;
  modelo: string;
  anio?: number | null;
  combustible: string;
}

export async function guardarCoche(db: Db, d: DatosCoche): Promise<Coche> {
  const matricula = formatearMatricula(d.matricula ?? '');
  const modelo = limpio(d.modelo);
  if (!(await leerCliente(db, d.clienteId))) throw new ErrorNegocio('No existe ese cliente.');
  if (matricula.replace(/\s/g, '').length < 4) throw new ErrorNegocio('La matrícula no es válida.');
  if (!modelo) throw new ErrorNegocio('Falta la marca y el modelo.');
  const repetido = await cochePorMatricula(db, matricula);
  if (repetido && repetido.id !== d.id) throw new ErrorNegocio(`La matrícula ${matricula} ya está dada de alta.`);
  const anio = d.anio && d.anio > 1950 && d.anio <= new Date().getFullYear() + 1 ? Math.round(d.anio) : null;
  const datos = { cliente_id: d.clienteId, matricula, modelo, anio, combustible: limpio(d.combustible) || 'Gasolina' };
  if (d.id) {
    if (!(await leerCoche(db, d.id))) throw new ErrorNegocio('No existe ese coche.');
    const filas = datosO(await db.from('coches').update(datos).eq('id', d.id).select('*'), 'guardar coche');
    if (!filas.length) throw new ErrorNegocio('No existe ese coche.');
    return aCoche(filas[0]);
  }
  return aCoche(datosO(await db.from('coches').insert({ id: nuevoId('v'), ...datos }).select('*').single(), 'nuevo coche'));
}

// ——— Órdenes de trabajo ———

export interface DatosNuevaOrden {
  cocheId: string;
  motivo: string;
  km: number;
  mecanicoId: PersonaId;
  citaId?: string;
}

export async function abrirOrden(db: Db, d: DatosNuevaOrden, actor: Persona): Promise<Orden> {
  const coche = await leerCoche(db, d.cocheId);
  if (!coche) throw new ErrorNegocio('Elige el coche.');
  const yaDentro = await ordenAbiertaDe(db, coche.id);
  if (yaDentro) throw new ErrorNegocio(`El ${coche.matricula} ya está en el taller con la orden ${yaDentro.id}.`);
  const motivo = limpio(d.motivo);
  if (!motivo) throw new ErrorNegocio('Escribe el motivo de entrada.');
  if (!Number.isFinite(d.km) || d.km < 0 || d.km > 3_000_000) throw new ErrorNegocio('Los kilómetros no son válidos.');
  const mec = persona(d.mecanicoId);
  if (!mec || mec.rol !== 'mecanico') throw new ErrorNegocio('Elige el mecánico.');
  const cita = d.citaId ? await leerCita(db, d.citaId) : undefined;

  const historial = [{
    id: nuevoId('ev'), cuando: ahora(), quien: actor.nombre, ia: false,
    texto: `Orden abierta. Coche recibido.${cita ? ' Venía con cita.' : ''} Lo lleva ${mec.nombre}.`,
  }];
  const fila = datosO<{ id: string }>(
    await db.from('ordenes')
      .insert({ coche_id: coche.id, estado: 'recibido', km: Math.round(d.km), mecanico_id: mec.id, motivo, historial })
      .select('id')
      .single(),
    'abrir orden',
  );
  if (cita) sinError(await db.from('citas').update({ orden_id: fila.id }).eq('id', cita.id), 'enlazar cita');
  const o = await leerOrden(db, fila.id);
  if (!o) throw new Error(`La orden ${fila.id} no se puede leer después de abrirla`);
  return o;
}

// Cambios sobre una orden ya leída (se guardan con cambiarOrden).
const cambio = {
  estado(o: Orden, estado: EstadoId, quien: string, ia = false): boolean {
    exigirAbierta(o);
    if (!ESTADOS_TABLERO.includes(estado)) throw new ErrorNegocio('Ese estado no existe.');
    if (o.estado === estado) return false;
    anotar(o, quien, `Estado: ${ESTADOS[o.estado].nombre} → ${ESTADOS[estado].nombre}.`, ia);
    o.estado = estado;
    return true;
  },

  datos(o: Orden, d: DatosOrden, quien: string, ia = false): number {
    exigirAbierta(o);
    let cambios = 0;
    if (d.motivo !== undefined) {
      const motivo = limpio(d.motivo);
      if (!motivo) throw new ErrorNegocio('El motivo de entrada no puede quedar vacío.');
      if (motivo !== o.motivo) {
        anotar(o, quien, `Motivo de entrada cambiado: «${motivo}».`, ia);
        o.motivo = motivo;
        cambios++;
      }
    }
    if (d.km !== undefined) {
      if (!Number.isFinite(d.km) || d.km < 0 || d.km > 3_000_000) throw new ErrorNegocio('Los kilómetros no son válidos.');
      const km = Math.round(d.km);
      if (km !== o.km) {
        anotar(o, quien, `Kilómetros: ${fkm(o.km)} → ${fkm(km)}.`, ia);
        o.km = km;
        cambios++;
      }
    }
    if (d.mecanicoId !== undefined && d.mecanicoId !== o.mecanicoId) {
      const mec = persona(d.mecanicoId);
      if (!mec || mec.rol !== 'mecanico') throw new ErrorNegocio('Ese mecánico no existe.');
      anotar(o, quien, `Mecánico: ${persona(o.mecanicoId)?.nombre} → ${mec.nombre}.`, ia);
      o.mecanicoId = mec.id;
      cambios++;
    }
    return cambios;
  },

  /** Si el trabajo es de la tarifa, el precio sale de la tarifa y nunca de fuera. */
  anadirTrabajo(o: Orden, d: DatosTrabajo, tarifa: ServicioTarifa[], quien: string, ia?: OrigenIA): Trabajo {
    exigirAbierta(o);
    const servicio = servicioDe(tarifa, d.tarifaId);
    const cantidad = Math.min(50, Math.max(1, Math.round(d.cantidad ?? 1)));
    const descripcion = limpio(d.descripcion) || servicio?.nombre || '';
    if (!descripcion) throw new ErrorNegocio('Escribe qué se ha hecho.');
    if (!persona(d.hechoPor)) throw new ErrorNegocio('Indica quién ha hecho el trabajo.');
    const t: Trabajo = servicio
      ? { id: nuevoId('tr'), descripcion, precio: servicio.precio * (servicio.porUnidad ? cantidad : 1), origen: 'tarifa',
        tarifaId: servicio.id, cantidad: servicio.porUnidad ? cantidad : 1, hechoPor: d.hechoPor, cuando: ahora(), ia }
      : { id: nuevoId('tr'), descripcion, precio: validarPrecio(d.precio), origen: 'mano', cantidad: 1, hechoPor: d.hechoPor,
        cuando: ahora(), ia };
    o.trabajos.push(t);
    const uds = t.cantidad > 1 ? ` (${t.cantidad} uds.)` : '';
    anotar(o, quien, `Trabajo apuntado: ${t.descripcion}${uds} · ${precioTexto(t.precio)}.`, Boolean(ia));
    return t;
  },

  anadirPieza(o: Orden, d: { descripcion: string; estado: EstadoPieza; nota?: string }, quien: string, ia?: OrigenIA): void {
    exigirAbierta(o);
    const descripcion = limpio(d.descripcion);
    if (!descripcion) throw new ErrorNegocio('Escribe qué pieza es.');
    if (!(d.estado in ESTADOS_PIEZA)) throw new ErrorNegocio('Estado de pieza no válido.');
    const nota = limpio(d.nota) || undefined;
    o.piezas.push({ id: nuevoId('pz'), descripcion, estado: d.estado, nota, cuando: ahora(), ia });
    anotar(o, quien, `Pieza añadida: ${descripcion} (${textoPieza(d.estado, nota)}).`, Boolean(ia));
  },

  editarPieza(o: Orden, piezaId: string, d: { descripcion?: string; estado?: EstadoPieza; nota?: string }, quien: string,
    ia?: OrigenIA): void {
    exigirAbierta(o);
    const p = o.piezas.find((x) => x.id === piezaId);
    if (!p) throw new ErrorNegocio('Esa pieza ya no está en la orden.');
    const antes = textoPieza(p.estado, p.nota);
    if (d.descripcion !== undefined && limpio(d.descripcion)) p.descripcion = limpio(d.descripcion);
    if (d.estado !== undefined) {
      if (!(d.estado in ESTADOS_PIEZA)) throw new ErrorNegocio('Estado de pieza no válido.');
      p.estado = d.estado;
    }
    if (d.nota !== undefined) p.nota = limpio(d.nota) || undefined;
    const despues = textoPieza(p.estado, p.nota);
    if (despues !== antes) {
      if (ia) p.ia = ia;
      anotar(o, quien, `Pieza: ${p.descripcion} → ${despues}.`, Boolean(ia));
    }
  },

  anadirObservacion(o: Orden, d: { texto: string; recomendacion: boolean; tarifaId?: string | null }, tarifa: ServicioTarifa[],
    actor: Persona, quien: string, ia?: OrigenIA): void {
    exigirAbierta(o);
    const texto = limpio(d.texto);
    if (!texto) throw new ErrorNegocio('Escribe la observación.');
    o.observaciones.push({
      id: nuevoId('ob'), texto, recomendacion: Boolean(d.recomendacion), tarifaId: servicioDe(tarifa, d.tarifaId)?.id,
      quien: actor.id, cuando: ahora(), ia,
    });
    anotar(o, quien, `${d.recomendacion ? 'Recomendación para el informe' : 'Observación añadida'}: ${texto}`, Boolean(ia));
  },
};

export async function cambiarEstado(db: Db, id: string, estado: EstadoId, actor: Persona): Promise<boolean> {
  return cambiarOrden(db, id, (o) => cambio.estado(o, estado, actor.nombre));
}

export interface DatosOrden {
  motivo?: string;
  km?: number;
  mecanicoId?: PersonaId;
}

export async function editarDatosOrden(db: Db, id: string, d: DatosOrden, actor: Persona): Promise<number> {
  return cambiarOrden(db, id, (o) => cambio.datos(o, d, actor.nombre));
}

export interface DatosTrabajo {
  descripcion?: string;
  tarifaId?: string | null;
  cantidad?: number;
  precio?: number | null;
  hechoPor: PersonaId;
}

export async function anadirTrabajo(db: Db, id: string, d: DatosTrabajo, actor: Persona): Promise<Trabajo> {
  return cambiarOrden(db, id, (o, tarifa) => cambio.anadirTrabajo(o, d, tarifa, actor.nombre), { tarifa: true });
}

export async function editarTrabajo(db: Db, id: string, trabajoId: string,
  d: { descripcion?: string; precio?: number | null; hechoPor?: PersonaId }, actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o) => {
    exigirAbierta(o);
    const t = o.trabajos.find((x) => x.id === trabajoId);
    if (!t) throw new ErrorNegocio('Ese trabajo ya no está en la orden.');
    const cambios: string[] = [];
    if (d.descripcion !== undefined) {
      const desc = limpio(d.descripcion);
      if (!desc) throw new ErrorNegocio('La descripción no puede quedar vacía.');
      if (desc !== t.descripcion) {
        cambios.push(`«${t.descripcion}» → «${desc}»`);
        t.descripcion = desc;
      }
    }
    if (d.precio !== undefined) {
      const p = validarPrecio(d.precio);
      if (p !== t.precio) {
        cambios.push(`precio ${precioTexto(t.precio)} → ${precioTexto(p)}`);
        t.precio = p;
        t.origen = 'mano';
      }
    }
    if (d.hechoPor !== undefined && d.hechoPor !== t.hechoPor) {
      if (!persona(d.hechoPor)) throw new ErrorNegocio('Esa persona no existe.');
      cambios.push(`hecho por ${persona(d.hechoPor)?.nombre}`);
      t.hechoPor = d.hechoPor;
    }
    if (cambios.length) anotar(o, actor.nombre, `Trabajo cambiado: ${t.descripcion} (${cambios.join('; ')}).`);
  });
}

export async function borrarTrabajo(db: Db, id: string, trabajoId: string, actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o) => {
    exigirAbierta(o);
    const t = o.trabajos.find((x) => x.id === trabajoId);
    if (!t) return;
    o.trabajos = o.trabajos.filter((x) => x.id !== trabajoId);
    anotar(o, actor.nombre, `Trabajo quitado: ${t.descripcion} · ${precioTexto(t.precio)}.`);
  });
}

const textoPieza = (estado: EstadoPieza, nota?: string) => `${ESTADOS_PIEZA[estado]}${nota ? ` · ${nota}` : ''}`;

export async function anadirPieza(db: Db, id: string, d: { descripcion: string; estado: EstadoPieza; nota?: string },
  actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o) => cambio.anadirPieza(o, d, actor.nombre));
}

export async function editarPieza(db: Db, id: string, piezaId: string, d: { descripcion?: string; estado?: EstadoPieza; nota?: string },
  actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o) => cambio.editarPieza(o, piezaId, d, actor.nombre));
}

export async function borrarPieza(db: Db, id: string, piezaId: string, actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o) => {
    exigirAbierta(o);
    const p = o.piezas.find((x) => x.id === piezaId);
    if (!p) return;
    o.piezas = o.piezas.filter((x) => x.id !== piezaId);
    anotar(o, actor.nombre, `Pieza quitada: ${p.descripcion}.`);
  });
}

export async function anadirObservacion(db: Db, id: string, d: { texto: string; recomendacion: boolean; tarifaId?: string | null },
  actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o, tarifa) => cambio.anadirObservacion(o, d, tarifa, actor, actor.nombre), { tarifa: true });
}

export async function editarObservacion(db: Db, id: string, obsId: string, d: { texto?: string; recomendacion?: boolean },
  actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o) => {
    exigirAbierta(o);
    const ob = o.observaciones.find((x) => x.id === obsId);
    if (!ob) throw new ErrorNegocio('Esa observación ya no está en la orden.');
    const cambios: string[] = [];
    if (d.texto !== undefined) {
      const texto = limpio(d.texto);
      if (!texto) throw new ErrorNegocio('La observación no puede quedar vacía.');
      if (texto !== ob.texto) {
        ob.texto = texto;
        cambios.push('texto');
      }
    }
    if (d.recomendacion !== undefined && d.recomendacion !== ob.recomendacion) {
      ob.recomendacion = d.recomendacion;
      cambios.push(d.recomendacion ? 'ahora sale en el informe' : 'ya no sale en el informe');
    }
    if (cambios.length) anotar(o, actor.nombre, `Observación cambiada (${cambios.join(', ')}): ${ob.texto}`);
  });
}

export async function borrarObservacion(db: Db, id: string, obsId: string, actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o) => {
    exigirAbierta(o);
    const ob = o.observaciones.find((x) => x.id === obsId);
    if (!ob) return;
    o.observaciones = o.observaciones.filter((x) => x.id !== obsId);
    anotar(o, actor.nombre, `Observación quitada: ${ob.texto}`);
  });
}

export async function cerrarOrden(db: Db, id: string, actor: Persona): Promise<void> {
  await cambiarOrden(db, id, (o) => {
    exigirAbierta(o);
    const pendientes = trabajosSinPrecio(o);
    if (pendientes) {
      throw new ErrorNegocio(pendientes === 1
        ? 'Hay un trabajo con el precio sin poner. Pónselo antes de entregar el coche.'
        : `Hay ${pendientes} trabajos con el precio sin poner. Pónselos antes de entregar el coche.`);
    }
    anotar(o, actor.nombre, 'Coche entregado al cliente. Orden cerrada.');
    o.estado = 'entregado';
    o.cierre = ahora();
  });
}

export async function reabrirOrden(db: Db, id: string, actor: Persona): Promise<void> {
  const actual = await leerOrden(db, id);
  if (!actual) throw new ErrorNegocio('No existe esa orden.');
  if (actual.estado !== 'entregado') return;
  const otra = await ordenAbiertaDe(db, actual.cocheId);
  if (otra) throw new ErrorNegocio(`Ese coche ya tiene otra orden abierta (${otra.id}).`);
  await cambiarOrden(db, id, (o) => {
    if (o.estado !== 'entregado') return;
    o.estado = 'reparacion';
    o.cierre = undefined;
    anotar(o, actor.nombre, 'Orden reabierta. Estado: En reparación.');
  });
}

/** Guarda el texto (a mano o de la IA) de uno de los dos informes. */
export async function guardarInforme(db: Db, id: string, version: 'cliente' | 'interno',
  poner: (o: Orden) => Orden['informes']['cliente'] | Orden['informes']['interno']): Promise<void> {
  await cambiarOrden(db, id, (o) => {
    const informe = poner(o);
    o.informes = { ...o.informes, [version]: informe };
  });
}

// ——— Cambios que llegan desde "Rellenar con IA" (o a mano desde el móvil) ———

/** Todo lo confirmado se guarda de una vez: o entra todo o no entra nada. */
export async function aplicarPropuesta(db: Db, id: string, p: Propuesta, actor: Persona): Promise<number> {
  return cambiarOrden(db, id, (o, tarifa) => {
    exigirAbierta(o);
    const ia: OrigenIA | undefined = p.via === 'mano' ? undefined : p.via;
    const quien = p.via === 'voz' ? `${actor.nombre} (voz)` : p.via === 'texto' ? `${actor.nombre} (IA)` : actor.nombre;
    const hechoPor: PersonaId = actor.rol === 'mecanico' ? actor.id : o.mecanicoId;
    let cambios = 0;

    for (const t of p.trabajos) {
      if (!limpio(t.descripcion) && !servicioDe(tarifa, t.tarifaId)) continue;
      cambio.anadirTrabajo(o, { descripcion: t.descripcion, tarifaId: t.tarifaId, cantidad: t.cantidad, precio: t.precioManual, hechoPor },
        tarifa, quien, ia);
      cambios++;
    }
    for (const pz of p.piezas) {
      if (!limpio(pz.descripcion) && !pz.piezaId) continue;
      const existente = pz.piezaId ? o.piezas.find((x) => x.id === pz.piezaId) : undefined;
      if (existente) cambio.editarPieza(o, existente.id, { estado: pz.estado, nota: pz.nota }, quien, ia);
      else cambio.anadirPieza(o, { descripcion: pz.descripcion, estado: pz.estado, nota: pz.nota }, quien, ia);
      cambios++;
    }
    for (const ob of p.observaciones) {
      if (!limpio(ob.texto)) continue;
      cambio.anadirObservacion(o, { texto: ob.texto, recomendacion: ob.recomendacion, tarifaId: ob.tarifaId }, tarifa, actor, quien, ia);
      cambios++;
    }
    if (p.km !== null && p.km !== undefined && p.km > 0) {
      cambios += cambio.datos(o, { km: p.km }, quien, Boolean(ia));
    }
    if (p.estado) {
      if (cambio.estado(o, p.estado, quien, Boolean(ia))) cambios++;
    }
    if (cambios && ia) o.ultimaIA = { cuando: ahora(), via: ia };
    return cambios;
  }, { tarifa: true });
}

// ——— Citas ———

export interface DatosCita {
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  matricula: string;
  coche: string;
  motivo: string;
  conversacionId?: string;
}

/**
 * Reserva un hueco. Si dos personas cogen el mismo hueco a la vez, la base de
 * datos solo deja pasar a una. El cliente y el modelo del coche se completan
 * en la base de datos a partir de la matrícula.
 */
export async function reservarCita(db: Db, d: DatosCita, origen: Cita['origen']): Promise<Cita> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || !esLaborable(d.fecha)) throw new ErrorNegocio('Las citas son de lunes a viernes.');
  if (!HUECOS.includes(d.hora)) throw new ErrorNegocio(`Las entradas son a las ${HUECOS.join(', ')}.`);
  if (d.fecha < hoy()) throw new ErrorNegocio('Ese día ya ha pasado.');
  const ocupados = await huecosOcupados(db, d.fecha, d.fecha);
  if (ocupados.has(`${d.fecha} ${d.hora}`)) throw new ErrorNegocio('Ese hueco ya está cogido.');
  const nombre = limpio(d.nombre);
  const matricula = limpio(d.matricula) ? formatearMatricula(d.matricula) : '';
  if (!nombre) throw new ErrorNegocio('Falta el nombre.');
  if (!matricula) throw new ErrorNegocio('Falta la matrícula.');
  const c: Cita = {
    id: nuevoId('ci'),
    fecha: d.fecha,
    hora: d.hora,
    nombre,
    telefono: limpio(d.telefono),
    matricula,
    coche: limpio(d.coche) || '—',
    motivo: limpio(d.motivo) || 'Sin especificar',
    conversacionId: d.conversacionId,
    origen,
    creada: ahora(),
  };
  // Sin .select(): el asistente puede reservar pero no leer las citas.
  const r = await db.from('citas').insert(deCita(c));
  if (r.error) throw errorDeBd(r.error, 'reservar cita');
  return c;
}

export async function anularCita(db: Db, id: string): Promise<Cita> {
  const c = await leerCita(db, id);
  if (!c) throw new ErrorNegocio('Esa cita ya no existe.');
  if (c.ordenId) throw new ErrorNegocio(`Esa cita ya tiene la orden ${c.ordenId} abierta.`);
  sinError(await db.from('citas').delete().eq('id', id).is('orden_id', null), 'anular cita');
  return c;
}

/** Próximos huecos libres (no se ofrecen los de hoy que ya han pasado o están a punto). */
export async function huecosLibres(db: Db, maximo = 12, diasVista = 12): Promise<{ fecha: string; hora: string }[]> {
  const desde = hoy();
  const ocupados = await huecosOcupados(db, desde, sumarDias(desde, diasVista));
  const libres: { fecha: string; hora: string }[] = [];
  const margen = Date.now() + 60 * 60_000;
  let dia = desde;
  for (let i = 0; i < diasVista && libres.length < maximo; i++) {
    if (esLaborable(dia)) {
      for (const hora of HUECOS) {
        if (instante(dia, hora).getTime() < margen) continue;
        if (!ocupados.has(`${dia} ${hora}`)) libres.push({ fecha: dia, hora });
        if (libres.length >= maximo) break;
      }
    }
    dia = sumarDias(dia, 1);
  }
  return libres;
}

// ——— Tarifa ———

export interface DatosServicio {
  id?: string;
  categoria: string;
  nombre: string;
  tiempo: string;
  precio: number;
  porUnidad: boolean;
}

export async function guardarServicio(db: Db, d: DatosServicio): Promise<ServicioTarifa> {
  const nombre = limpio(d.nombre);
  const categoria = limpio(d.categoria);
  if (!nombre) throw new ErrorNegocio('Falta el nombre del servicio.');
  if (!categoria) throw new ErrorNegocio('Falta la categoría.');
  if (!Number.isFinite(d.precio) || d.precio < 0 || d.precio > 100_000) throw new ErrorNegocio('El precio no es válido.');
  const datos = { nombre, categoria, tiempo: limpio(d.tiempo), precio: Math.round(d.precio * 100) / 100, por_unidad: Boolean(d.porUnidad) };
  if (d.id) {
    const filas = datosO(await db.from('tarifa').update(datos).eq('id', d.id).select('*'), 'guardar tarifa');
    if (!filas.length) throw new ErrorNegocio('Ese servicio ya no existe.');
    return aServicio(filas[0]);
  }
  return aServicio(datosO(await db.from('tarifa').insert({ id: nuevoId('t'), ...datos }).select('*').single(), 'nuevo servicio'));
}

export async function borrarServicio(db: Db, id: string): Promise<void> {
  sinError(await db.from('tarifa').delete().eq('id', id), 'borrar servicio');
}

// ——— Conversaciones ———

async function nuevoMensaje(db: Db, conversacionId: string, m: Pick<Mensaje, 'de' | 'texto'>): Promise<void> {
  const r = await db.from('mensajes').insert({ id: nuevoId('m'), conversacion_id: conversacionId, de: m.de, texto: m.texto });
  if (r.error) throw errorDeBd(r.error, 'mensaje');
}

async function cambiarConversacion(db: Db, id: string, cambios: {
  modo?: Conversacion['modo']; necesita_persona?: boolean; motivo?: string | null; nombre?: string; contacto?: string | null;
  ia_pensando_desde?: string | null;
}): Promise<void> {
  const filas = datosO(await db.from('conversaciones').update(cambios).eq('id', id).select('id'), 'conversación');
  if (!filas.length) throw new ErrorNegocio('Esa conversación no existe.');
}

export async function mensajeDelTaller(db: Db, id: string, texto: string): Promise<void> {
  const t = texto.trim();
  if (!t) throw new ErrorNegocio('Escribe el mensaje.');
  if (t.length > 4000) throw new ErrorNegocio('El mensaje es demasiado largo.');
  // El autor lo pone la base de datos a partir de la sesión.
  await nuevoMensaje(db, id, { de: 'persona', texto: t });
  await cambiarConversacion(db, id, { necesita_persona: false, motivo: null });
}

export async function cambiarModo(db: Db, id: string, modo: Conversacion['modo']): Promise<void> {
  await cambiarConversacion(db, id, modo === 'ia' ? { modo, necesita_persona: false, motivo: null } : { modo });
}

/** Mensaje de un cliente en el chat de la web. Si no hay chat (o no es de la web), abre uno nuevo. Devuelve su id. */
export async function mensajeDelCliente(db: Db, id: string | null, texto: string): Promise<string> {
  let conversacionId: string | null = null;
  if (id) {
    const r = await db.from('conversaciones').select('id').eq('id', id).eq('canal', 'Web').maybeSingle();
    conversacionId = quizas(r, 'chat')?.id ?? null;
  }
  if (!conversacionId) {
    conversacionId = `cv-${randomUUID()}`;
    // El nombre ("Visitante web N") lo pone la base de datos.
    const r = await db.from('conversaciones').insert({ id: conversacionId, canal: 'Web', modo: 'ia' });
    if (r.error) throw errorDeBd(r.error, 'nuevo chat');
  }
  await nuevoMensaje(db, conversacionId, { de: 'cliente', texto: texto.trim() });
  return conversacionId;
}

/**
 * Chat nuevo de la pestaña «Probar asistente»: lo abre el asistente, como uno
 * de la web, y lo marca como prueba el dueño con su propia sesión (el
 * asistente no puede marcarlo).
 */
export async function abrirChatDePrueba(asistente: Db, dueno: Db): Promise<string> {
  const id = `cv-${randomUUID()}`;
  sinError(await asistente.from('conversaciones').insert({ id, canal: 'Web', modo: 'ia' }), 'nuevo chat de prueba');
  const r = await dueno.from('conversaciones').update({ prueba: true }).eq('id', id).select('id');
  if (r.error || !r.data?.length) {
    throw r.error ? errorDeBd(r.error, 'marcar chat de prueba') : new ErrorNegocio('No se ha podido marcar el chat como prueba.');
  }
  return id;
}

export async function respuestaIA(db: Db, id: string, texto: string): Promise<void> {
  await nuevoMensaje(db, id, { de: 'ia', texto });
}

export async function pasarAPersona(db: Db, id: string, motivo: string, texto: string): Promise<void> {
  await nuevoMensaje(db, id, { de: 'ia', texto });
  await cambiarConversacion(db, id, { modo: 'persona', necesita_persona: true, motivo });
}

export async function marcarPensando(db: Db, id: string, pensando: boolean): Promise<void> {
  await cambiarConversacion(db, id, { ia_pensando_desde: pensando ? ahora() : null });
}

export async function datosDeContacto(db: Db, id: string, d: { nombre?: string; contacto?: string }): Promise<void> {
  const cambios: { nombre?: string; contacto?: string } = {};
  if (d.nombre) cambios.nombre = d.nombre.slice(0, 200);
  if (d.contacto) cambios.contacto = d.contacto.slice(0, 200);
  if (Object.keys(cambios).length) await cambiarConversacion(db, id, cambios);
}

export const horaActual = () => horaDe(new Date());
