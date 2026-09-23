// Informe de la orden en dos versiones: para el cliente (sin jerga) e interno.
// La IA solo redacta textos; los importes los pone la aplicación.

import { z } from 'zod';
import type { Coche, Cliente, InformeCliente, InformeInterno, Orden } from '../tipos';
import { trabajosSinPrecio } from '../calculos';
import { ESTADOS, ESTADOS_PIEZA, persona } from '../constantes';
import { fkm } from '../formato';
import { fmtFecha } from '../fechas';
import { conZod, ErrorIA, iaConfigurada, mensajeDeError, pedirJSON } from './openrouter';
import { tieneImportes } from './importes';

export type VersionInforme = 'cliente' | 'interno';

/** Huella de lo que el informe tiene en cuenta: si cambia, el texto se ha quedado viejo. */
export function firmaInforme(o: Orden): string {
  const base = JSON.stringify([
    o.estado, o.km, o.motivo,
    o.trabajos.map((t) => [t.id, t.descripcion]),
    o.observaciones.map((x) => [x.id, x.texto, x.recomendacion]),
    o.piezas.map((p) => [p.id, p.estado]),
  ]);
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const quitarImportes = (s: string) => s.replace(/\s·\s[\d.,]+\s€/g, '').replace(/[\d.,]+\s?€/g, '');

export interface CocheYCliente {
  coche: Coche;
  cliente: Cliente;
}

function datos(o: Orden, { coche, cliente }: CocheYCliente, version: VersionInforme): string {
  const trabajos = o.trabajos.length
    ? o.trabajos.map((t) => `- [${t.id}] ${t.descripcion}${t.cantidad > 1 ? ` (${t.cantidad} uds.)` : ''}${version === 'interno' ? ` · hecho por ${persona(t.hechoPor)?.nombre}` : ''}`).join('\n')
    : '- Ninguno todavía.';
  const recomendaciones = o.observaciones.filter((x) => x.recomendacion);
  const otras = o.observaciones.filter((x) => !x.recomendacion);
  const lineas = [
    `Orden ${o.id} · estado: ${ESTADOS[o.estado].nombre}`,
    `Cliente: ${cliente.nombreCorto}`,
    `Vehículo: ${coche.modelo} (${coche.matricula}), ${fkm(o.km)}`,
    `Motivo de entrada: ${o.motivo}`,
    `Trabajos realizados (id entre corchetes):\n${trabajos}`,
    `Recomendaciones (id entre corchetes):\n${recomendaciones.length ? recomendaciones.map((x) => `- [${x.id}] ${x.texto}`).join('\n') : '- Ninguna.'}`,
  ];
  if (version === 'interno') {
    lineas.push(
      `Mecánico: ${persona(o.mecanicoId)?.nombreCompleto}`,
      `Entrada: ${fmtFecha(o.entrada)}`,
      `Piezas:\n${o.piezas.length ? o.piezas.map((p) => `- ${p.descripcion} (${ESTADOS_PIEZA[p.estado]}${p.nota ? ` · ${p.nota}` : ''})`).join('\n') : '- Ninguna.'}`,
      `Otras observaciones:\n${otras.length ? otras.map((x) => `- ${x.texto}`).join('\n') : '- Ninguna.'}`,
      `Trabajos con el precio sin poner: ${trabajosSinPrecio(o)}`,
      `Historial:\n${o.historial.slice(-20).map((e) => `- ${e.quien}: ${quitarImportes(e.texto)}`).join('\n')}`,
    );
  }
  return lineas.join('\n\n');
}

const SISTEMA_CLIENTE = `Redactas el informe de reparación que Talleres Ruiz entrega al CLIENTE. Escribe en español de España, en lenguaje sencillo y sin jerga de taller: explica cada trabajo como se lo contarías a alguien que no sabe de coches (qué se ha hecho y para qué sirve), en una frase corta. Tutea al cliente.
- "resumen": 2 o 3 frases: por qué vino el coche y cómo queda.
- "trabajos": un texto por cada trabajo, con el mismo "id" que te doy.
- "recomendaciones": un texto por cada recomendación, con el mismo "id", explicando qué conviene hacer y por qué.
NUNCA escribas importes, precios ni cantidades de dinero: los pone la aplicación. No inventes trabajos ni recomendaciones que no estén en los datos.
Devuelve solo JSON: {"resumen":"","trabajos":[{"id":"","texto":""}],"recomendaciones":[{"id":"","texto":""}]}`;

const SISTEMA_INTERNO = `Redactas el informe INTERNO de una orden de trabajo para el propio taller (no se entrega al cliente). Lenguaje técnico, preciso y breve, en español de España.
- "resumen": de 2 a 4 frases: diagnóstico, qué se ha hecho y cómo queda.
- "puntos": de 0 a 5 puntos a vigilar o pendientes (piezas pendientes, trabajos sin precio, recomendaciones, lo que pidió el cliente). Frases cortas.
NUNCA escribas importes ni precios: los pone la aplicación. No inventes nada que no esté en los datos.
Devuelve solo JSON: {"resumen":"","puntos":[""]}`;

const idTexto = { type: 'object', properties: { id: { type: 'string' }, texto: { type: 'string' } }, required: ['id', 'texto'], additionalProperties: false };
const ESQUEMA_CLIENTE = {
  type: 'object',
  properties: { resumen: { type: 'string' }, trabajos: { type: 'array', items: idTexto }, recomendaciones: { type: 'array', items: idTexto } },
  required: ['resumen', 'trabajos', 'recomendaciones'],
  additionalProperties: false,
};
const ESQUEMA_INTERNO = {
  type: 'object',
  properties: { resumen: { type: 'string' }, puntos: { type: 'array', items: { type: 'string' } } },
  required: ['resumen', 'puntos'],
  additionalProperties: false,
};

const s = z.string().nullish().transform((x) => (x ?? '').trim());
const ParesId = z.array(z.object({ id: s, texto: s })).default([]);
const RespCliente = z.object({ resumen: s, trabajos: ParesId, recomendaciones: ParesId });
const RespInterno = z.object({ resumen: s, puntos: z.array(s).default([]) });

const conImportes = (textos: string[]) =>
  textos.some(tieneImportes) ? 'has escrito importes; los importes los pone la aplicación, quítalos' : null;

function informeClienteSinIA(o: Orden, aviso: string): InformeCliente {
  return { resumen: '', trabajos: {}, recomendaciones: {}, generado: new Date().toISOString(), porIA: false, firma: firmaInforme(o), aviso };
}

function informeInternoSinIA(o: Orden, aviso: string): InformeInterno {
  const puntos: string[] = [];
  for (const p of o.piezas) if (p.estado === 'pendiente' || p.estado === 'pedida') puntos.push(`Pieza ${ESTADOS_PIEZA[p.estado].toLowerCase()}: ${p.descripcion}${p.nota ? ` (${p.nota})` : ''}.`);
  const sinPrecio = trabajosSinPrecio(o);
  if (sinPrecio) puntos.push(sinPrecio === 1 ? 'Hay un trabajo con el precio sin poner.' : `Hay ${sinPrecio} trabajos con el precio sin poner.`);
  for (const r of o.observaciones.filter((x) => x.recomendacion)) puntos.push(`Recomendado: ${r.texto}`);
  return { resumen: '', puntos, generado: new Date().toISOString(), porIA: false, firma: firmaInforme(o), aviso };
}

export async function redactarInforme(o: Orden, cc: CocheYCliente, version: VersionInforme): Promise<InformeCliente | InformeInterno> {
  if (!iaConfigurada()) {
    const aviso = 'La IA no está configurada: el informe usa los textos de la ficha. Puedes editarlos a mano.';
    return version === 'cliente' ? informeClienteSinIA(o, aviso) : informeInternoSinIA(o, aviso);
  }
  try {
    if (version === 'cliente') {
      const r = await pedirJSON({
        tarea: 'informe_cliente',
        esquema: ESQUEMA_CLIENTE,
        esfuerzo: 'low',
        mensajes: [{ role: 'system', content: SISTEMA_CLIENTE }, { role: 'user', content: datos(o, cc, 'cliente') }],
        validar: conZod(RespCliente, (x) => conImportes([x.resumen, ...x.trabajos.map((y) => y.texto), ...x.recomendaciones.map((y) => y.texto)])),
      });
      const idsTrabajos = new Set(o.trabajos.map((t) => t.id));
      const idsRecs = new Set(o.observaciones.filter((x) => x.recomendacion).map((x) => x.id));
      return {
        resumen: r.resumen,
        trabajos: Object.fromEntries(r.trabajos.filter((x) => idsTrabajos.has(x.id) && x.texto).map((x) => [x.id, x.texto])),
        recomendaciones: Object.fromEntries(r.recomendaciones.filter((x) => idsRecs.has(x.id) && x.texto).map((x) => [x.id, x.texto])),
        generado: new Date().toISOString(),
        porIA: true,
        firma: firmaInforme(o),
      };
    }
    const r = await pedirJSON({
      tarea: 'informe_interno',
      esquema: ESQUEMA_INTERNO,
      esfuerzo: 'low',
      mensajes: [{ role: 'system', content: SISTEMA_INTERNO }, { role: 'user', content: datos(o, cc, 'interno') }],
      validar: conZod(RespInterno, (x) => conImportes([x.resumen, ...x.puntos])),
    });
    return { resumen: r.resumen, puntos: r.puntos.filter(Boolean).slice(0, 6), generado: new Date().toISOString(), porIA: true, firma: firmaInforme(o) };
  } catch (e) {
    console.error('[informe]', e instanceof Error ? e.message : e);
    const aviso = `${e instanceof ErrorIA ? mensajeDeError(e) : 'La IA ha fallado.'} El informe usa los textos de la ficha; puedes editarlos a mano.`;
    return version === 'cliente' ? informeClienteSinIA(o, aviso) : informeInternoSinIA(o, aviso);
  }
}
