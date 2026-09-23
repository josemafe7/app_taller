// Pestaña «Probar asistente» (solo el dueño): el dueño escribe como si fuera un
// cliente. Va por el mismo camino que el chat de la web (cuenta del asistente,
// mismas reglas y misma IA), pero el chat queda marcado como prueba.

import { cabeceraConversacion } from '@/lib/datos';
import { abrirChatDePrueba, mensajeDelCliente } from '@/lib/operaciones';
import { contestarAlCliente } from '@/lib/chat-servidor';
import { consumir } from '@/lib/limites';
import { dbSesion, personaActual } from '@/lib/sesion';
import { puedeVer } from '@/lib/permisos';
import { ErrorNegocio } from '@/lib/errores';
import { clienteAsistente } from '@/lib/supabase/servidor';

export const maxDuration = 90;

const MINUTO = 60_000;
const ID_VALIDO = /^cv-[0-9a-f-]{36}$/;

export async function POST(req: Request) {
  const yo = await personaActual();
  if (!yo) return Response.json({ error: 'Tu sesión ha caducado. Vuelve a entrar.' }, { status: 401 });
  if (!puedeVer(yo, 'probar')) return Response.json({ error: 'Solo el dueño puede probar el asistente.' }, { status: 403 });

  const cuerpo = (await req.json().catch(() => null)) as { texto?: unknown; conversacionId?: unknown } | null;
  const texto = typeof cuerpo?.texto === 'string' ? cuerpo.texto.trim() : '';
  if (!texto) return Response.json({ error: 'Escribe un mensaje.' }, { status: 400 });
  if (texto.length > 2000) return Response.json({ error: 'El mensaje es demasiado largo.' }, { status: 413 });
  const pedido = typeof cuerpo?.conversacionId === 'string' && ID_VALIDO.test(cuerpo.conversacionId) ? cuerpo.conversacionId : null;

  // Más holgado que el chat público, pero con tope: cada respuesta gasta IA.
  if (!consumir(`probar:${yo.id}`, 60, 5 * MINUTO)) {
    return Response.json({ error: 'Muchos mensajes seguidos. Espera un par de minutos.' }, { status: 429 });
  }

  try {
    const db = await clienteAsistente();
    // Solo se sigue un chat si es de prueba; si no, se abre uno nuevo.
    const existente = pedido ? await cabeceraConversacion(db, pedido) : undefined;
    let id = existente?.prueba ? existente.id : null;
    if (!id) {
      if (!consumir(`probar-nuevo:${yo.id}`, 40, 60 * MINUTO)) {
        return Response.json({ error: 'Has abierto muchos chats de prueba en la última hora. Sigue con el que tienes.' }, { status: 429 });
      }
      id = await abrirChatDePrueba(db, await dbSesion());
    }
    await mensajeDelCliente(db, id, texto);
    return Response.json(await contestarAlCliente(db, id));
  } catch (e) {
    if (e instanceof ErrorNegocio) return Response.json({ error: e.message }, { status: 409 });
    console.error('[probar-asistente]', e instanceof Error ? e.message : e);
    return Response.json({ error: 'No se ha podido enviar. Inténtalo otra vez.' }, { status: 503 });
  }
}
