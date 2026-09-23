// Texto del mecánico → propuesta de cambios. No guarda nada.

import { datosDeOrden, leerOrden, leerTarifa } from '@/lib/datos';
import { dbSesion, personaActual } from '@/lib/sesion';
import { puedeTocarOrden } from '@/lib/permisos';
import { iaConfigurada, mensajeDeError } from '@/lib/ia/openrouter';
import { proponerCambios } from '@/lib/ia/rellenar';

export const maxDuration = 90;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await personaActual();
  if (!actor) return Response.json({ error: 'Tu sesión ha caducado. Vuelve a entrar.' }, { status: 401 });
  const db = await dbSesion();
  const orden = await leerOrden(db, id);
  if (!orden) return Response.json({ error: 'No existe esa orden.' }, { status: 404 });
  if (!puedeTocarOrden(actor, orden)) return Response.json({ error: 'Esta orden no es tuya.' }, { status: 403 });
  if (orden.estado === 'entregado') return Response.json({ error: 'La orden está cerrada.' }, { status: 409 });

  const cuerpo = (await req.json().catch(() => null)) as { texto?: unknown; via?: unknown } | null;
  const texto = typeof cuerpo?.texto === 'string' ? cuerpo.texto.trim() : '';
  const via = cuerpo?.via === 'voz' ? 'voz' : 'texto';
  if (!texto) return Response.json({ error: 'Cuenta qué has hecho.' }, { status: 400 });
  if (texto.length > 6000) return Response.json({ error: 'El texto es demasiado largo.' }, { status: 413 });
  if (!iaConfigurada()) {
    return Response.json({ error: 'La IA no está configurada. Puedes apuntarlo a mano.', codigo: 'sin_clave' }, { status: 503 });
  }

  try {
    const [{ coche }, tarifa] = await Promise.all([datosDeOrden(db, orden), leerTarifa(db)]);
    const propuesta = await proponerCambios(orden, coche, tarifa, texto, via, actor);
    return Response.json({ propuesta });
  } catch (e) {
    console.error('[proponer]', e instanceof Error ? e.message : e);
    return Response.json({ error: mensajeDeError(e) }, { status: 502 });
  }
}
