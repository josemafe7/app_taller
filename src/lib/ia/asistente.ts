// Asistente de las conversaciones. Solo puede:
//  1) contar el estado de un coche, lo hecho y cuánto va (si el cliente da matrícula Y código de orden),
//  2) dar precios de la tarifa,
//  3) proponer citas en huecos libres y reservarlas.
// No cambia nada de las órdenes. Si no sabe, hay queja o piden una persona,
// deja de contestar y marca la conversación "Necesita una persona".
//
// Trabaja con la cuenta del asistente en la base de datos: no puede leer
// órdenes ni coches; solo recibe una orden si el cliente ha escrito su código
// y su matrícula y coinciden (función asistente_orden).

import 'server-only';
import { z } from 'zod';
import type { Conversacion, EstadoOrden, Orden, PersonaId, Pieza, ServicioTarifa, Trabajo } from '../tipos';
import type { Db } from '../supabase/servidor';
import { cabeceraConversacion, leerConversacion, leerTarifa } from '../datos';
import { totalOrden } from '../calculos';
import { ESTADOS, ESTADOS_PIEZA, persona, PERSONAS, TALLER } from '../constantes';
import { codigosOrdenEn, eur, formatearMatricula, matriculasEn, primerNombre } from '../formato';
import { fmtCabecera, fmtDiaLargo, fmtDiaMedio, fmtFecha, horaCorta, horaDe } from '../fechas';
import {
  datosDeContacto, huecosLibres, marcarPensando, pasarAPersona, reservarCita, respuestaIA, ErrorNegocio,
} from '../operaciones';
import { conZod, ErrorIA, iaConfigurada, pedirJSON } from './openrouter';
import { importesNoPermitidos, importesPermitidos } from './importes';

const RE_QUEJA = /\b(queja|quejarme|reclamaci[oó]n|reclamar|hoja de reclamaciones|verg[uü]enza|indignad[oa]|estafa|timo|timado|denuncia|denunciar|inaceptable|lamentable|cabread[oa])\b/i;
const RE_PERSONA = /(hablar con|habl[oae] con|p[aá]same con|p[aá]sadme con|p[oó]nme con|ponedme con|que me llame|ll[aá]mame|llamadme|me llam[aá]is|me puede llamar|me pod[eé]is llamar|una persona|un humano|persona real|alguien del taller|con recepci[oó]n|con luc[ií]a|con paco|el encargado|la encargada|responsable del taller)/i;

const TEXTO_QUEJA = 'Siento mucho las molestias. Se lo paso a Lucía, de recepción, para que lo vea contigo. Te contesta por aquí en cuanto pueda.';
const TEXTO_PERSONA = 'Claro. Te paso con Lucía, de recepción, que te contesta por aquí en cuanto pueda.';
const TEXTO_SIN_IA = 'Ahora mismo no puedo contestarte yo. Te contesta una persona del taller por aquí en cuanto pueda.';
const TEXTO_NO_SE = 'Eso no te lo puedo contestar yo. Se lo paso a una persona del taller, que te contesta por aquí en cuanto pueda.';
const TEXTO_MUCHOS_CODIGOS = 'Para darte datos de un coche necesito la matrícula y el código de la orden que aparecen en tu resguardo. Se lo paso a una persona del taller, que te contesta por aquí en cuanto pueda.';

/** Más códigos de orden distintos que esto en una conversación suena a ir probando: lo ve una persona. */
const MAX_CODIGOS = 3;

// Afirmaciones sobre el estado de un coche ("está en reparación"…).
const FRASES_ESTADO: [EstadoOrden, RegExp][] = [
  ['listo', /est[aá] (ya )?listo para (recoger|que lo recojas|pasar a recogerlo)/i],
  ['reparacion', /est[aá] (ya )?en reparaci[oó]n/i],
  ['pieza', /est[aá] (ya )?esperando (la |una |las )?piezas?/i],
  ['diagnostico', /est[aá] (ya )?en diagn[oó]stico/i],
  ['recibido', /est[aá] (ya )?recibido/i],
];

/** Lo que el asistente puede saber de una orden verificada. */
export interface OrdenVerificada extends Pick<Orden, 'id' | 'estado' | 'km' | 'mecanicoId' | 'entrada' | 'cierre' | 'motivo' | 'trabajos' | 'piezas'> {
  coche: { matricula: string; modelo: string };
}

interface Verificacion {
  orden?: OrdenVerificada;
  matriculas: string[];
  codigos: string[];
}

interface FilaVerificada {
  id: string; estado: EstadoOrden; km: number; mecanico_id: string; entrada: string; cierre: string | null; motivo: string;
  trabajos: Trabajo[]; piezas: Pieza[]; coche: { matricula: string; modelo: string };
}

/** La orden solo se verifica si el propio cliente ha escrito la matrícula y el código, y coinciden. */
export async function verificarOrden(db: Db, c: Conversacion): Promise<Verificacion> {
  const textos = c.mensajes.filter((m) => m.de === 'cliente').map((m) => m.texto).join('\n');
  const matriculas = [...new Set(matriculasEn(textos))].slice(-5);
  const codigos = [...new Set(codigosOrdenEn(textos))];
  if (!matriculas.length || codigos.length > MAX_CODIGOS) return { matriculas, codigos };
  for (const codigo of [...codigos].reverse()) {
    const { data, error } = await db.rpc('asistente_orden', { p_codigo: codigo, p_matriculas: matriculas });
    if (error) throw new Error(`[asistente_orden] ${error.message}`);
    const f = data as unknown as FilaVerificada | null;
    if (f) {
      return {
        orden: {
          id: f.id, estado: f.estado, km: f.km, mecanicoId: f.mecanico_id as PersonaId, entrada: f.entrada,
          cierre: f.cierre ?? undefined, motivo: f.motivo, trabajos: f.trabajos ?? [], piezas: f.piezas ?? [], coche: f.coche,
        },
        matriculas,
        codigos,
      };
    }
  }
  return { matriculas, codigos };
}

function textoOrdenVerificada(v: Verificacion): string {
  const o = v.orden;
  if (!o) {
    let detalle = 'El cliente no ha dado la matrícula ni el código de la orden.';
    if (v.matriculas.length && v.codigos.length) detalle = 'La matrícula y el código de orden que ha dado el cliente no coinciden con ninguna orden. Pídele que los revise.';
    else if (v.matriculas.length) detalle = `El cliente ha dado la matrícula ${v.matriculas.at(-1)} pero no el código de la orden.`;
    else if (v.codigos.length) detalle = `El cliente ha dado el código ${v.codigos.at(-1)} pero no la matrícula.`;
    return `ORDEN VERIFICADA: ninguna. ${detalle}\nNo des ningún dato de ningún coche ni de ninguna orden, ni confirmes si un coche está o no en el taller.`;
  }
  const { coche } = o;
  const trabajos = o.trabajos.length
    ? o.trabajos.map((t) => `  · ${t.descripcion}${t.cantidad > 1 ? ` (${t.cantidad} uds.)` : ''}: ${t.precio === null ? 'precio todavía sin poner (no des importe de este trabajo)' : eur(t.precio)}`).join('\n')
    : '  · Todavía no se ha apuntado ningún trabajo.';
  const piezas = o.piezas.length
    ? o.piezas.map((p) => `  · ${p.descripcion}: ${ESTADOS_PIEZA[p.estado]}${p.nota ? ` (${p.nota})` : ''}`).join('\n')
    : '  · Ninguna.';
  const estado = o.estado === 'entregado'
    ? `Entregado al cliente el ${fmtFecha(o.cierre ?? o.entrada)} (orden cerrada)`
    : ESTADOS[o.estado].nombre;
  return [
    `ORDEN VERIFICADA (el cliente ha dado la matrícula ${coche.matricula} y el código ${o.id}, y coinciden):`,
    `- Coche: ${coche.modelo}, matrícula ${coche.matricula}`,
    `- Estado: ${estado}`,
    `- Mecánico que lo lleva: ${persona(o.mecanicoId)?.nombre ?? '—'}`,
    `- Motivo de entrada: ${o.motivo}`,
    `- Trabajos hechos hasta ahora:\n${trabajos}`,
    `- Piezas:\n${piezas}`,
    `- Total hasta ahora (solo lo que ya tiene precio): ${eur(totalOrden(o))}`,
  ].join('\n');
}

const SISTEMA = (canal: string) => `Eres el asistente de ${TALLER.nombre}, un taller de mecánica y electricidad del automóvil en Getafe (Madrid). Contestas a clientes por ${canal}. Escribe en español de España, con frases cortas y tono cercano y profesional. Tutea, salvo que el cliente trate de usted. No uses emojis ni formato markdown.

SOLO puedes hacer estas tres cosas:
1. Contar cómo va un coche (su estado, lo que se le ha hecho y cuánto va), usando únicamente los datos de «ORDEN VERIFICADA». Si no hay orden verificada, no das ningún dato de ningún coche (ni estado, ni trabajos, ni importes, ni si está o no en el taller) y pides la matrícula y el código de la orden (empieza por OT, por ejemplo OT-1041, y viene en el resguardo que se le dio al dejar el coche).
2. Dar precios de la «TARIFA», tal cual aparecen (todos llevan el IVA incluido).
3. Proponer citas en los «HUECOS LIBRES» (como mucho tres) y reservarlas. Para reservar necesitas nombre, teléfono, matrícula y qué hay que hacerle; el modelo del coche si lo dice. Cuando el cliente haya elegido un hueco de la lista y tengas esos datos, usa la acción "reservar_cita".

Nunca cambias nada de una orden, nunca prometes fechas de entrega ni plazos, nunca inventas precios ni estados y no haces descuentos ni presupuestos fuera de la tarifa. No escribas ningún importe que no aparezca tal cual en la tarifa o en la orden verificada. Los precios se escriben así: 89,00 €.

Usa la acción "pasar_a_persona" cuando no sepas contestar o te pidan algo fuera de esas tres cosas, cuando haya una queja o el cliente esté molesto, o cuando pida hablar con una persona. En ese caso, en "respuesta" di en una frase que le contestará una persona del taller por aquí, sin prometer nada más.

Devuelve solo un objeto JSON con estas claves:
- "accion": "responder", "reservar_cita" o "pasar_a_persona"
- "respuesta": el texto para el cliente
- "motivo_persona": si pasas a persona, el motivo en pocas palabras (por ejemplo "Pregunta por la fecha de entrega"); si no, ""
- "cita": {"fecha": "AAAA-MM-DD", "hora": "HH:MM", "nombre": "", "telefono": "", "matricula": "", "coche": "", "motivo": ""}; si no reservas, deja sus campos vacíos.`;

const ESQUEMA = {
  type: 'object',
  properties: {
    accion: { type: 'string', enum: ['responder', 'reservar_cita', 'pasar_a_persona'] },
    respuesta: { type: 'string' },
    motivo_persona: { type: 'string' },
    cita: {
      type: 'object',
      properties: {
        fecha: { type: 'string' },
        hora: { type: 'string' },
        nombre: { type: 'string' },
        telefono: { type: 'string' },
        matricula: { type: 'string' },
        coche: { type: 'string' },
        motivo: { type: 'string' },
      },
      required: ['fecha', 'hora', 'nombre', 'telefono', 'matricula', 'coche', 'motivo'],
      additionalProperties: false,
    },
  },
  required: ['accion', 'respuesta', 'motivo_persona', 'cita'],
  additionalProperties: false,
};

const texto = z.string().nullish().transform((s) => (s ?? '').trim());
const Respuesta = z.object({
  accion: z.enum(['responder', 'reservar_cita', 'pasar_a_persona']),
  respuesta: texto,
  motivo_persona: texto,
  cita: z.object({ fecha: texto, hora: texto, nombre: texto, telefono: texto, matricula: texto, coche: texto, motivo: texto })
    .partial().nullish(),
});
type Respuesta = z.infer<typeof Respuesta>;

function quienHabla(de: string, autor?: string): string {
  if (de === 'cliente') return 'Cliente';
  if (de === 'ia') return 'Asistente';
  const p = PERSONAS.find((x) => x.nombre === autor);
  return p ? `${p.nombre} (${p.rolEtiqueta.toLowerCase()}, persona del taller)` : 'Persona del taller';
}

function contexto(c: Conversacion, v: Verificacion, tarifa: ServicioTarifa[], huecos: { fecha: string; hora: string }[]): string {
  const lineasTarifa = tarifa.map((s) => `- ${s.nombre}: ${eur(s.precio)}${s.porUnidad ? ' cada unidad' : ''}`).join('\n');
  const libres = huecos
    .map((h) => `- ${fmtDiaLargo(h.fecha)} a las ${horaCorta(h.hora)} → fecha ${h.fecha}, hora ${h.hora}`)
    .join('\n') || '- No quedan huecos libres en los próximos días.';
  const conversacion = c.mensajes.slice(-24).map((m) => `${quienHabla(m.de, m.autor)}: ${m.texto}`).join('\n');
  return [
    `FECHA Y HORA ACTUAL: ${fmtCabecera()}, ${horaDe(new Date())} (hora de Madrid)`,
    `TARIFA (IVA incluido):\n${lineasTarifa}`,
    `HUECOS LIBRES PARA DEJAR EL COCHE (entradas por la mañana, de lunes a viernes):\n${libres}`,
    textoOrdenVerificada(v),
    `CONVERSACIÓN (lo más reciente al final):\n${conversacion}`,
    'Contesta al último mensaje del cliente.',
  ].join('\n\n');
}

function comprobarRespuesta(r: Respuesta, v: Verificacion, tarifa: ServicioTarifa[]): string | null {
  if (r.accion !== 'reservar_cita' && !r.respuesta) return 'la respuesta está vacía';
  if (r.respuesta.length > 1500) return 'la respuesta es demasiado larga';
  const noPermitidos = importesNoPermitidos(r.respuesta, importesPermitidos(tarifa, v.orden));
  if (noPermitidos.length) {
    return `has escrito importes que no están ni en la tarifa ni en la orden verificada (${noPermitidos.map((c) => eur(c / 100)).join(', ')}). Usa solo importes que aparezcan tal cual`;
  }
  for (const [estado, re] of FRASES_ESTADO) {
    if (!re.test(r.respuesta)) continue;
    if (!v.orden) return 'has dado el estado de un coche sin orden verificada; no des datos de ningún coche';
    if (v.orden.estado !== estado) return `has dicho que el coche está «${ESTADOS[estado].nombre}», pero su estado es «${ESTADOS[v.orden.estado].nombre}»`;
  }
  return null;
}

const telefonoValido = (t: string) => t.replace(/\D/g, '').length >= 9;
const matriculaValida = (m: string) => /^[0-9A-Z]{4,}/.test(m.replace(/[\s-]/g, '').toUpperCase());

function lista(xs: string[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}

async function ofrecerHuecos(db: Db): Promise<string> {
  const libres = await huecosLibres(db, 3);
  if (!libres.length) return 'Ahora mismo no me quedan huecos libres en los próximos días.';
  return `Te puedo ofrecer ${lista(libres.map((h) => `el ${fmtDiaMedio(h.fecha)} a las ${horaCorta(h.hora)}`))}. ¿Cuál te viene bien?`;
}

function simularCita(d: { matricula: string; coche: string }): { matricula: string; coche: string } {
  return { matricula: formatearMatricula(d.matricula), coche: d.coche.trim() || '—' };
}

async function intentarReserva(db: Db, c: Conversacion, r: Respuesta): Promise<void> {
  const cita = r.cita ?? {};
  const nombre = cita.nombre ?? '';
  const telefono = cita.telefono ?? '';
  const matricula = cita.matricula ?? '';
  const faltan: string[] = [];
  if (!nombre) faltan.push('tu nombre');
  if (!telefonoValido(telefono)) faltan.push('un teléfono');
  if (!matriculaValida(matricula)) faltan.push('la matrícula');
  if (faltan.length) {
    await respuestaIA(db, c.id, `Para reservarte la cita necesito ${lista(faltan)}.`);
    return;
  }
  const fecha = (cita.fecha ?? '').slice(0, 10);
  const hora = (cita.hora ?? '').replace(/^(\d):/, '0$1:').slice(0, 5);
  const libre = (await huecosLibres(db, 60, 30)).some((h) => h.fecha === fecha && h.hora === hora);
  if (!libre) {
    await respuestaIA(db, c.id, `Ese hueco no lo tengo libre. ${await ofrecerHuecos(db)}`);
    return;
  }
  try {
    const datos = { fecha, hora, nombre, telefono, matricula, coche: cita.coche ?? '', motivo: cita.motivo ?? '', conversacionId: c.id };
    // En los chats de prueba la cita no se guarda: no ocupa huecos de clientes de verdad.
    const nueva = c.prueba ? simularCita(datos) : await reservarCita(db, datos, 'ia');
    await datosDeContacto(db, c.id, {
      nombre: !c.clienteId && c.nombre.startsWith('Visitante web') ? nombre : undefined,
      contacto: c.contacto ? undefined : telefono,
    });
    const coche = nueva.coche && nueva.coche !== '—' ? `el ${nueva.coche} (${nueva.matricula})` : `el coche ${nueva.matricula}`;
    await respuestaIA(db, c.id,
      `Hecho, ${primerNombre(nombre)}. Te he reservado cita el ${fmtDiaLargo(fecha)} a las ${horaCorta(hora)} para ${coche}. Si necesitas cambiarla, escríbenos por aquí.`
      + (c.prueba ? '\n\n(Chat de prueba: esta cita no se ha guardado en Citas.)' : ''));
  } catch (e) {
    if (e instanceof ErrorNegocio) await respuestaIA(db, c.id, `No he podido reservarla: ${e.message} ${await ofrecerHuecos(db)}`);
    else throw e;
  }
}

/** Contesta el último mensaje del cliente si la conversación la lleva la IA. */
export async function atenderConversacion(db: Db, id: string): Promise<void> {
  const c = await leerConversacion(db, id);
  if (!c || c.modo !== 'ia') return;
  const ultimo = [...c.mensajes].reverse().find((m) => m.de === 'cliente');
  if (!ultimo || c.mensajes.at(-1)?.de !== 'cliente') return;

  if (RE_QUEJA.test(ultimo.texto)) return pasarAPersona(db, c.id, 'Queja del cliente', TEXTO_QUEJA);
  if (RE_PERSONA.test(ultimo.texto)) return pasarAPersona(db, c.id, 'Pide hablar con una persona', TEXTO_PERSONA);
  if (!iaConfigurada()) return pasarAPersona(db, c.id, 'La IA no está disponible', TEXTO_SIN_IA);

  const v = await verificarOrden(db, c);
  if (v.codigos.length > MAX_CODIGOS) return pasarAPersona(db, c.id, 'Ha dado muchos códigos de orden distintos', TEXTO_MUCHOS_CODIGOS);

  const [tarifa, huecos] = await Promise.all([leerTarifa(db), huecosLibres(db, 12)]);
  await marcarPensando(db, c.id, true);
  let r: Respuesta;
  try {
    r = await pedirJSON({
      tarea: 'respuesta_cliente',
      esquema: ESQUEMA,
      esfuerzo: 'low',
      maxTokens: 3000,
      mensajes: [
        { role: 'system', content: SISTEMA(c.canal === 'Web' ? 'el chat de la web' : c.canal) },
        { role: 'user', content: contexto(c, v, tarifa, huecos) },
      ],
      validar: conZod(Respuesta, (x) => comprobarRespuesta(x, v, tarifa)),
    });
  } catch (e) {
    await marcarPensando(db, c.id, false);
    const ahora = await cabeceraConversacion(db, c.id);
    if (ahora?.modo === 'ia') {
      const motivo = e instanceof ErrorIA && e.motivo === 'respuesta' ? 'La IA no ha sabido responder' : 'La IA no ha podido contestar';
      await pasarAPersona(db, c.id, motivo, TEXTO_NO_SE);
    }
    console.error('[asistente]', e instanceof Error ? e.message : e);
    return;
  }
  await marcarPensando(db, c.id, false);
  // Si mientras pensaba alguien del taller ha cogido la conversación, no contesta.
  const ahora = await cabeceraConversacion(db, c.id);
  if (ahora?.modo !== 'ia') return;

  if (r.accion === 'pasar_a_persona') {
    return pasarAPersona(db, c.id, r.motivo_persona || 'La IA no ha sabido responder', r.respuesta || TEXTO_NO_SE);
  }
  if (r.accion === 'reservar_cita') return intentarReserva(db, c, r);
  await respuestaIA(db, c.id, r.respuesta);
}
