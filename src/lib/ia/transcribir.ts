import { z } from 'zod';
import { conZod, modeloAudio, pedirJSON } from './openrouter';

const SISTEMA = `Transcribes notas de voz de mecánicos de un taller de coches en España.
Transcribe literalmente lo que se dice, en español. Respeta los términos técnicos, las marcas, las referencias de piezas y los números (los kilómetros con cifras, por ejemplo 84.300 km). No resumas, no corrijas lo que dice y no añadas nada.
Devuelve solo JSON: {"texto": "..."}. Si no se entiende nada, {"texto": ""}.`;

const ESQUEMA = {
  type: 'object',
  properties: { texto: { type: 'string' } },
  required: ['texto'],
  additionalProperties: false,
};

export async function transcribirAudio(base64: string, formato: string): Promise<string> {
  const r = await pedirJSON({
    tarea: 'transcripcion',
    esquema: ESQUEMA,
    modelo: modeloAudio(),
    esfuerzo: 'minimal',
    maxTokens: 4000,
    tiempoMax: 90_000,
    mensajes: [
      { role: 'system', content: SISTEMA },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe esta nota de voz.' },
          { type: 'input_audio', input_audio: { data: base64, format: formato } },
        ],
      },
    ],
    validar: conZod(z.object({ texto: z.string().nullish().transform((s) => (s ?? '').trim()) })),
  });
  return r.texto;
}
