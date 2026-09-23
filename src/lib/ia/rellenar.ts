// "Rellenar con IA": a partir de lo que cuenta el mecánico, la IA PROPONE
// cambios para la ficha. El precio de cada trabajo sale de la tarifa (por su
// id), nunca de la IA. Nada se guarda aquí: lo guarda el mecánico al confirmar.

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Coche, EstadoId, Orden, OrigenIA, Persona, PropObservacion, PropPieza, PropTrabajo, Propuesta, Segmento, ServicioTarifa } from '../tipos';
import { servicioDe } from '../calculos';
import { ESTADOS, ESTADOS_PIEZA } from '../constantes';
import { aNumero, fkm } from '../formato';
import { conZod, pedirJSON } from './openrouter';
import { tieneImportes } from './importes';

const SISTEMA = `Ayudas a los mecánicos de Talleres Ruiz a rellenar la ficha de una orden de trabajo a partir de lo que cuentan (dictado o escrito; si es dictado puede traer errores de transcripción). Tu trabajo es PROPONER cambios: el mecánico los revisa antes de guardar.

Reglas:
- Propón solo lo que el mecánico dice o se deduce con claridad. No inventes trabajos, piezas, kilómetros ni estados.
- "trabajos": trabajos YA HECHOS en esta visita. Si coincide con un servicio de la TARIFA, pon su id en "tarifa_id"; si no está en la tarifa, "tarifa_id": "". Nunca pongas precios: los pone la aplicación. "cantidad": unidades (1, salvo servicios por unidad como los neumáticos).
- No repitas trabajos que ya están apuntados en la ficha.
- "piezas": piezas que hay que pedir o cuyo estado cambia. Estados: "pendiente" (hay que pedirla), "pedida", "recibida" o "stock" (la hay en el taller). Si es una pieza que ya está en la ficha, pon su id en "pieza_id"; si es nueva, "pieza_id": "". "nota": detalle breve opcional (por ejemplo "llega el jueves").
- "observaciones": lo que ha visto en el coche. "recomendacion": true si es algo que el cliente debería hacer más adelante (sale en el informe); si esa recomendación es un servicio de la tarifa, pon su id en "tarifa_id". Redacta frases cortas y claras, sin precios.
- "km": los kilómetros del cuentakilómetros si los dice, como número entero (84.300 km → 84300); si no, 0.
- "estado": el nuevo estado si lo dice o se deduce claramente (si ha terminado lo que pedía el motivo de entrada → "listo"; si se queda esperando una pieza → "pieza"; si empieza a repararlo → "reparacion"); si no hay cambio, "sin_cambio". "estado_motivo": explicación muy breve (por ejemplo "Lo que pedía el motivo de entrada está hecho").
- "cita", "km_cita" y "estado_cita": copia LITERALMENTE el trozo del texto del mecánico en el que te basas (las mismas palabras, sin cambiar nada) para poder resaltarlo. Si no hay un trozo concreto, "".

Devuelve solo JSON con esta forma:
{"trabajos":[{"descripcion":"","tarifa_id":"","cantidad":1,"cita":""}],"piezas":[{"pieza_id":"","descripcion":"","estado":"pendiente","nota":"","cita":""}],"observaciones":[{"texto":"","recomendacion":false,"tarifa_id":"","cita":""}],"km":0,"km_cita":"","estado":"sin_cambio","estado_motivo":"","estado_cita":""}`;

const cadena = { type: 'string' };
const ESQUEMA = {
  type: 'object',
  properties: {
    trabajos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { descripcion: cadena, tarifa_id: cadena, cantidad: { type: 'integer' }, cita: cadena },
        required: ['descripcion', 'tarifa_id', 'cantidad', 'cita'],
        additionalProperties: false,
      },
    },
    piezas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pieza_id: cadena, descripcion: cadena, estado: { type: 'string', enum: ['pendiente', 'pedida', 'recibida', 'stock'] },
          nota: cadena, cita: cadena,
        },
        required: ['pieza_id', 'descripcion', 'estado', 'nota', 'cita'],
        additionalProperties: false,
      },
    },
    observaciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: { texto: cadena, recomendacion: { type: 'boolean' }, tarifa_id: cadena, cita: cadena },
        required: ['texto', 'recomendacion', 'tarifa_id', 'cita'],
        additionalProperties: false,
      },
    },
    km: { type: 'integer' },
    km_cita: cadena,
    estado: { type: 'string', enum: ['sin_cambio', 'recibido', 'diagnostico', 'pieza', 'reparacion', 'listo'] },
    estado_motivo: cadena,
    estado_cita: cadena,
  },
  required: ['trabajos', 'piezas', 'observaciones', 'km', 'km_cita', 'estado', 'estado_motivo', 'estado_cita'],
  additionalProperties: false,
};

const t = z.string().nullish().transform((s) => (s ?? '').trim());
const numero = z.preprocess((v) => (typeof v === 'string' ? aNumero(v) ?? 0 : v ?? 0), z.number().min(0));
const Relleno = z.object({
  trabajos: z.array(z.object({ descripcion: t, tarifa_id: t, cantidad: numero, cita: t })).default([]),
  piezas: z.array(z.object({
    pieza_id: t, descripcion: t, estado: z.enum(['pendiente', 'pedida', 'recibida', 'stock']).catch('pendiente'), nota: t, cita: t,
  })).default([]),
  observaciones: z.array(z.object({ texto: t, recomendacion: z.boolean().catch(false), tarifa_id: t, cita: t })).default([]),
  km: numero,
  km_cita: t,
  estado: z.enum(['sin_cambio', 'recibido', 'diagnostico', 'pieza', 'reparacion', 'listo']).catch('sin_cambio'),
  estado_motivo: t,
  estado_cita: t,
});
type Relleno = z.infer<typeof Relleno>;

function sinPrecios(r: Relleno): string | null {
  const textos = [
    ...r.trabajos.map((x) => x.descripcion), ...r.piezas.map((x) => `${x.descripcion} ${x.nota}`),
    ...r.observaciones.map((x) => x.texto), r.estado_motivo,
  ];
  return textos.some(tieneImportes) ? 'has escrito precios; los precios nunca los pones tú, quítalos' : null;
}

function contexto(o: Orden, coche: Coche, tarifa: ServicioTarifa[], texto: string, autor: Persona): string {
  const trabajos = o.trabajos.length ? o.trabajos.map((x) => `- ${x.descripcion}`).join('\n') : '- Ninguno todavía.';
  const piezas = o.piezas.length
    ? o.piezas.map((p) => `- [${p.id}] ${p.descripcion} (${ESTADOS_PIEZA[p.estado]}${p.nota ? ` · ${p.nota}` : ''})`).join('\n')
    : '- Ninguna.';
  const observaciones = o.observaciones.length ? o.observaciones.map((x) => `- ${x.texto}`).join('\n') : '- Ninguna.';
  const lineasTarifa = tarifa.map((s) => `${s.id}: ${s.nombre}${s.porUnidad ? ' (por unidad)' : ''}`).join('\n');
  const estados = (['recibido', 'diagnostico', 'pieza', 'reparacion', 'listo'] as EstadoId[])
    .map((e) => `${e} = ${ESTADOS[e].nombre}`).join(', ');
  return [
    `FICHA ${o.id} · ${coche.modelo} (${coche.matricula})`,
    `Estado actual: ${ESTADOS[o.estado].nombre}`,
    `Kilómetros apuntados: ${fkm(o.km)}`,
    `Motivo de entrada: ${o.motivo}`,
    `Trabajos ya apuntados:\n${trabajos}`,
    `Piezas en la ficha:\n${piezas}`,
    `Observaciones:\n${observaciones}`,
    `TARIFA (id: servicio):\n${lineasTarifa}`,
    `ESTADOS: ${estados}`,
    `LO QUE CUENTA ${autor.nombre.toUpperCase()}:\n"""\n${texto}\n"""`,
  ].join('\n\n');
}

/** Parte el texto en trozos y marca con su número los que justifican cada cambio. */
export function segmentar(texto: string, citas: { n: number; cita: string }[]): Segmento[] {
  const bajo = texto.toLowerCase();
  const rangos: { a: number; b: number; n: number }[] = [];
  for (const { n, cita } of citas) {
    const c = cita.trim().replace(/^[\s"'“”«».,;:]+|[\s"'“”«».,;:]+$/g, '').toLowerCase();
    if (c.length < 3) continue;
    let a = bajo.indexOf(c);
    while (a >= 0 && rangos.some((r) => a < r.b && a + c.length > r.a)) a = bajo.indexOf(c, a + 1);
    if (a < 0) continue;
    rangos.push({ a, b: a + c.length, n });
  }
  rangos.sort((x, y) => x.a - y.a);
  const segmentos: Segmento[] = [];
  let pos = 0;
  for (const r of rangos) {
    if (r.a > pos) segmentos.push({ t: texto.slice(pos, r.a), n: null });
    segmentos.push({ t: texto.slice(r.a, r.b), n: r.n });
    pos = r.b;
  }
  if (pos < texto.length) segmentos.push({ t: texto.slice(pos), n: null });
  return segmentos;
}

const clave = () => randomUUID().slice(0, 8);

export async function proponerCambios(o: Orden, coche: Coche, tarifa: ServicioTarifa[], texto: string, via: OrigenIA,
  autor: Persona): Promise<Propuesta> {
  const buscarServicio = (id: string) => servicioDe(tarifa, id);
  const r = await pedirJSON({
    tarea: 'relleno_ficha',
    esquema: ESQUEMA,
    esfuerzo: 'low',
    maxTokens: 4000,
    mensajes: [
      { role: 'system', content: SISTEMA },
      { role: 'user', content: contexto(o, coche, tarifa, texto, autor) },
    ],
    validar: conZod(Relleno, sinPrecios),
  });

  let n = 0;
  const citas: { n: number; cita: string }[] = [];

  const trabajos: PropTrabajo[] = r.trabajos
    .filter((x) => x.descripcion || buscarServicio(x.tarifa_id))
    .map((x) => {
      const s = buscarServicio(x.tarifa_id);
      const num = ++n;
      citas.push({ n: num, cita: x.cita });
      return {
        clave: clave(),
        n: num,
        descripcion: x.descripcion || s?.nombre || '',
        tarifaId: s?.id ?? null,
        cantidad: s?.porUnidad ? Math.min(50, Math.max(1, Math.round(x.cantidad) || 1)) : 1,
        precioManual: null,
      };
    });

  const piezas: PropPieza[] = r.piezas
    .filter((x) => x.descripcion || x.pieza_id)
    .map((x) => {
      const existente = o.piezas.find((p) => p.id === x.pieza_id);
      const num = ++n;
      citas.push({ n: num, cita: x.cita });
      return {
        clave: clave(), n: num, piezaId: existente?.id ?? null, descripcion: existente?.descripcion ?? x.descripcion,
        estado: x.estado, nota: x.nota,
      };
    });

  const observaciones: PropObservacion[] = r.observaciones
    .filter((x) => x.texto)
    .map((x) => {
      const num = ++n;
      citas.push({ n: num, cita: x.cita });
      return { clave: clave(), n: num, texto: x.texto, recomendacion: x.recomendacion, tarifaId: buscarServicio(x.tarifa_id)?.id ?? null };
    });

  const km = Math.round(r.km);
  const propuesta: Propuesta = { via, texto, segmentos: [], trabajos, piezas, observaciones, km: null, estado: null };
  if (km > 0 && km < 3_000_000 && km !== o.km) {
    propuesta.km = km;
    propuesta.kmN = ++n;
    citas.push({ n: propuesta.kmN, cita: r.km_cita });
  }
  if (r.estado !== 'sin_cambio' && r.estado !== o.estado) {
    propuesta.estado = r.estado;
    propuesta.estadoN = ++n;
    propuesta.estadoMotivo = r.estado_motivo;
    citas.push({ n: propuesta.estadoN, cita: r.estado_cita });
  }
  propuesta.segmentos = segmentar(texto, citas);
  return propuesta;
}
