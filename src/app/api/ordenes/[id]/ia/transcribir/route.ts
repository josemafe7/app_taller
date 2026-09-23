// Audio del mecánico → texto. El texto se le enseña antes de rellenar nada.

import { leerOrden } from '@/lib/datos';
import { dbSesion, personaActual } from '@/lib/sesion';
import { puedeTocarOrden } from '@/lib/permisos';
import { iaConfigurada, mensajeDeError } from '@/lib/ia/openrouter';
import { transcribirAudio } from '@/lib/ia/transcribir';

export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024;

function formatoDe(tipo: string): string {
  if (tipo.includes('wav')) return 'wav';
  if (tipo.includes('mpeg') || tipo.includes('mp3')) return 'mp3';
  if (tipo.includes('ogg')) return 'ogg';
  if (tipo.includes('flac')) return 'flac';
  if (tipo.includes('aac')) return 'aac';
  if (tipo.includes('mp4') || tipo.includes('m4a')) return 'm4a';
  return 'wav';
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await personaActual();
  if (!actor) return Response.json({ error: 'Tu sesión ha caducado. Vuelve a entrar.' }, { status: 401 });
  const orden = await leerOrden(await dbSesion(), id);
  if (!orden) return Response.json({ error: 'No existe esa orden.' }, { status: 404 });
  if (!puedeTocarOrden(actor, orden)) return Response.json({ error: 'Esta orden no es tuya.' }, { status: 403 });
  if (!iaConfigurada()) {
    return Response.json({ error: 'La IA no está configurada. Escríbelo o apúntalo a mano.', codigo: 'sin_clave' }, { status: 503 });
  }

  let audio: FormDataEntryValue | null;
  try {
    audio = (await req.formData()).get('audio');
  } catch {
    return Response.json({ error: 'No ha llegado el audio.' }, { status: 400 });
  }
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: 'No ha llegado el audio.' }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: 'El audio es demasiado largo. Graba notas más cortas.' }, { status: 413 });

  try {
    const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64');
    const texto = await transcribirAudio(base64, formatoDe(audio.type));
    if (!texto) return Response.json({ error: 'No se ha entendido nada en el audio. Prueba otra vez o escríbelo.' }, { status: 422 });
    return Response.json({ texto });
  } catch (e) {
    console.error('[transcribir]', e instanceof Error ? e.message : e);
    return Response.json({ error: mensajeDeError(e) }, { status: 502 });
  }
}
