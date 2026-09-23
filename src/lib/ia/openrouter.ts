// Cliente mínimo de OpenRouter. Todas las respuestas se piden en JSON; si
// llegan mal (no es JSON o no cumple las reglas), se reintenta una vez.
// La clave solo se lee aquí, en el servidor, y nunca se devuelve ni se muestra.

import type { z } from 'zod';

const URL_BASE = () => (process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

/** El que pidió el taller: "Gemini 3 Flash". En OpenRouter se llama así. */
export const MODELO_POR_DEFECTO = 'google/gemini-3-flash-preview';

export const modeloTexto = () => process.env.OPENROUTER_MODEL?.trim() || MODELO_POR_DEFECTO;
export const modeloAudio = () => process.env.OPENROUTER_AUDIO_MODEL?.trim() || modeloTexto();
export const iaConfigurada = () => Boolean(process.env.OPENROUTER_API_KEY?.trim());

export type MotivoErrorIA = 'sin_clave' | 'clave' | 'saldo' | 'limite' | 'red' | 'respuesta';

export class ErrorIA extends Error {
  constructor(message: string, readonly motivo: MotivoErrorIA = 'respuesta') {
    super(message);
  }
}

export type ParteMensaje =
  | { type: 'text'; text: string }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

export interface MensajeIA {
  role: 'system' | 'user' | 'assistant';
  content: string | ParteMensaje[];
}

export type Validacion<T> = { ok: true; valor: T } | { ok: false; error: string };

export interface PeticionJSON<T> {
  tarea: string;
  esquema: Record<string, unknown>;
  mensajes: MensajeIA[];
  validar: (datos: unknown) => Validacion<T>;
  modelo?: string;
  esfuerzo?: 'minimal' | 'low' | 'medium';
  maxTokens?: number;
  temperatura?: number;
  tiempoMax?: number;
}

// Si el proveedor rechaza el formato estricto, se baja un escalón y se recuerda:
// 0 = json_schema estricto · 1 = json_object · 2 = solo instrucciones.
let nivelFormato = 0;

export async function pedirJSON<T>(p: PeticionJSON<T>): Promise<T> {
  if (!iaConfigurada()) {
    throw new ErrorIA('La IA no está configurada: falta OPENROUTER_API_KEY en .env.local.', 'sin_clave');
  }
  let mensajes = p.mensajes;
  let ultimoError = '';
  for (let intento = 1; intento <= 2; intento++) {
    let texto: string;
    try {
      texto = await completar(p, mensajes);
    } catch (e) {
      if (e instanceof ErrorIA && ['sin_clave', 'clave', 'saldo'].includes(e.motivo)) throw e;
      ultimoError = e instanceof Error ? e.message : String(e);
      continue;
    }
    const datos = extraerJSON(texto);
    if (datos === undefined) {
      ultimoError = 'la respuesta no era JSON';
      mensajes = [
        ...p.mensajes,
        { role: 'assistant', content: texto.slice(0, 3000) },
        { role: 'user', content: 'Tu respuesta no era JSON válido. Devuelve solo el objeto JSON pedido, sin texto antes ni después.' },
      ];
      continue;
    }
    const v = p.validar(datos);
    if (v.ok) return v.valor;
    ultimoError = v.error;
    mensajes = [
      ...p.mensajes,
      { role: 'assistant', content: JSON.stringify(datos).slice(0, 6000) },
      { role: 'user', content: `Tu respuesta no es válida: ${v.error}. Corrígela y devuelve solo el JSON.` },
    ];
  }
  throw new ErrorIA(`La IA no ha dado una respuesta válida (${ultimoError}).`, 'respuesta');
}

async function completar<T>(p: PeticionJSON<T>, mensajes: MensajeIA[]): Promise<string> {
  for (;;) {
    const nivel = nivelFormato;
    const cuerpo: Record<string, unknown> = {
      model: p.modelo ?? modeloTexto(),
      messages: nivel === 0 ? mensajes : conEsquema(mensajes, p.esquema),
      max_tokens: p.maxTokens ?? 4000,
    };
    // Gemini 3 funciona mejor con su temperatura por defecto; solo se manda si se pide.
    if (p.temperatura !== undefined) cuerpo.temperature = p.temperatura;
    if (nivel === 0) {
      cuerpo.response_format = { type: 'json_schema', json_schema: { name: p.tarea, strict: true, schema: p.esquema } };
      cuerpo.provider = { require_parameters: true };
      if (p.esfuerzo) cuerpo.reasoning = { effort: p.esfuerzo };
    } else if (nivel === 1) {
      cuerpo.response_format = { type: 'json_object' };
    }

    let r: Response;
    try {
      r = await fetch(`${URL_BASE()}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY?.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5678',
          'X-Title': 'Talleres Ruiz',
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(p.tiempoMax ?? 45_000),
        cache: 'no-store',
      });
    } catch {
      throw new ErrorIA('No se ha podido hablar con OpenRouter (sin conexión o ha tardado demasiado).', 'red');
    }

    if (r.status === 401 || r.status === 403) throw new ErrorIA('OpenRouter no acepta la clave. Revisa OPENROUTER_API_KEY en .env.local.', 'clave');
    if (r.status === 402) throw new ErrorIA('La cuenta de OpenRouter se ha quedado sin saldo.', 'saldo');
    if (r.status === 429) throw new ErrorIA('OpenRouter pide esperar un momento (demasiadas peticiones).', 'limite');

    const json = (await r.json().catch(() => null)) as RespuestaOpenRouter | null;
    if (!r.ok || json?.error) {
      const msg = String(json?.error?.message ?? r.statusText ?? 'error desconocido');
      const deFormato = /response_format|json|schema|structured|parameter|reasoning|endpoint|support/i.test(msg);
      if ((r.status === 400 || r.status === 404 || r.status === 422) && deFormato && nivelFormato < 2) {
        nivelFormato = nivel + 1;
        continue;
      }
      throw new ErrorIA(`OpenRouter ha devuelto un error (${r.status}): ${msg.slice(0, 180)}`, 'red');
    }
    const contenido = json?.choices?.[0]?.message?.content;
    const texto = typeof contenido === 'string'
      ? contenido
      : Array.isArray(contenido) ? contenido.map((x) => (typeof x?.text === 'string' ? x.text : '')).join('') : '';
    if (!texto.trim()) throw new ErrorIA('OpenRouter ha devuelto una respuesta vacía.', 'respuesta');
    return texto;
  }
}

interface RespuestaOpenRouter {
  error?: { message?: string };
  choices?: { message?: { content?: string | { text?: string }[] | null } }[];
}

function conEsquema(mensajes: MensajeIA[], esquema: Record<string, unknown>): MensajeIA[] {
  const nota = `\n\nResponde SOLO con un objeto JSON que cumpla este JSON Schema:\n${JSON.stringify(esquema)}`;
  const [primero, ...resto] = mensajes;
  if (primero?.role === 'system' && typeof primero.content === 'string') {
    return [{ role: 'system', content: primero.content + nota }, ...resto];
  }
  return [{ role: 'system', content: nota.trim() }, ...mensajes];
}

export function extraerJSON(texto: string): unknown | undefined {
  let s = texto.trim();
  const valla = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (valla) s = valla[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    const i = s.indexOf('{');
    const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(s.slice(i, j + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

/** Valida con zod y, si pasa, con una comprobación extra opcional. */
export function conZod<T>(esquema: z.ZodType<T>, extra?: (valor: T) => string | null): (datos: unknown) => Validacion<T> {
  return (datos) => {
    const r = esquema.safeParse(datos);
    if (!r.success) {
      const detalle = r.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'raíz'}: ${i.message}`).join('; ');
      return { ok: false, error: `no cumple el formato (${detalle})` };
    }
    const problema = extra?.(r.data);
    return problema ? { ok: false, error: problema } : { ok: true, valor: r.data };
  };
}

export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorIA) return e.message;
  return 'La IA ha fallado. Puedes seguir a mano.';
}
