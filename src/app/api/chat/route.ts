// Chat público de la web: cada chat nuevo entra en la bandeja con el canal "Web".
// Tiene límites para que nadie pueda llenar la bandeja ni gastar la IA a lo loco.
// Usa la cuenta del asistente, que solo puede tocar chats de la web.

import { cabeceraConversacion } from '@/lib/datos';
import { mensajeDelCliente } from '@/lib/operaciones';
import { contestarAlCliente } from '@/lib/chat-servidor';
import { consumir, ipDe } from '@/lib/limites';
import { clienteAsistente } from '@/lib/supabase/servidor';
import { TALLER } from '@/lib/constantes';

export const maxDuration = 90;

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const ID_VALIDO = /^cv-[0-9a-f-]{36}$/;

const demasiados = (error: string) => Response.json({ error }, { status: 429 });

export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as { texto?: unknown; conversacionId?: unknown } | null;
  const texto = typeof cuerpo?.texto === 'string' ? cuerpo.texto.trim() : '';
  if (!texto) return Response.json({ error: 'Escribe un mensaje.' }, { status: 400 });
  if (texto.length > 2000) return Response.json({ error: 'El mensaje es demasiado largo.' }, { status: 413 });
  const pedido = typeof cuerpo?.conversacionId === 'string' && ID_VALIDO.test(cuerpo.conversacionId) ? cuerpo.conversacionId : null;

  const ip = ipDe(req.headers);
  if (!consumir(`chat-ip:${ip}`, 20, 5 * MINUTO)) {
    return demasiados('Has enviado muchos mensajes seguidos. Espera un par de minutos y vuelve a escribir.');
  }

  try {
    const db = await clienteAsistente();
    const existente = pedido ? await cabeceraConversacion(db, pedido) : undefined;
    if (!existente && (!consumir(`chat-nuevo-ip:${ip}`, 6, HORA) || !consumir('chat-nuevo-global', 80, HORA))) {
      return demasiados(`Ahora mismo no podemos abrir más chats. Llámanos al ${TALLER.telefono}.`);
    }

    const id = await mensajeDelCliente(db, existente?.id ?? null, texto);
    return Response.json(await contestarAlCliente(db, id));
  } catch (e) {
    console.error('[chat]', e instanceof Error ? e.message : e);
    return Response.json({ error: `Ahora mismo no podemos atenderte por aquí. Llámanos al ${TALLER.telefono}.` }, { status: 503 });
  }
}
