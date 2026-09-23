// Redacta (o vuelve a redactar) el texto del informe con la IA.
// Los importes nunca pasan por la IA: los pinta la página a partir de la ficha.

import { datosDeOrden, leerOrden } from '@/lib/datos';
import { guardarInforme, ErrorNegocio } from '@/lib/operaciones';
import { dbSesion, personaActual } from '@/lib/sesion';
import { redactarInforme } from '@/lib/ia/informe';

export const maxDuration = 90;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await personaActual();
  if (!actor) return Response.json({ error: 'Tu sesión ha caducado. Vuelve a entrar.' }, { status: 401 });
  if (actor.rol === 'mecanico') return Response.json({ error: 'Con este perfil no puedes hacer informes.' }, { status: 403 });
  const db = await dbSesion();
  const orden = await leerOrden(db, id);
  if (!orden) return Response.json({ error: 'No existe esa orden.' }, { status: 404 });

  const cuerpo = (await req.json().catch(() => null)) as { version?: unknown } | null;
  const version = cuerpo?.version === 'interno' ? 'interno' : 'cliente';
  const informe = await redactarInforme(orden, await datosDeOrden(db, orden), version);
  try {
    await guardarInforme(db, orden.id, version, () => informe);
  } catch (e) {
    if (e instanceof ErrorNegocio) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
  return Response.json({ informe });
}
