import { leerConversacion } from '@/lib/datos';
import { vistaPublica } from '@/lib/chat-publico';
import { consumir, ipDe } from '@/lib/limites';
import { clienteAsistente } from '@/lib/supabase/servidor';

const ID_VALIDO = /^cv-[0-9a-f-]{36}$/;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID_VALIDO.test(id)) return Response.json({ error: 'Chat no encontrado.' }, { status: 404 });
  // El chat se consulta cada pocos segundos; esto frena a quien pruebe ids a lo loco.
  if (!consumir(`chat-leer-ip:${ipDe(req.headers)}`, 300, 5 * 60_000)) {
    return Response.json({ error: 'Demasiadas consultas seguidas.' }, { status: 429 });
  }
  try {
    const c = await leerConversacion(await clienteAsistente(), id);
    if (!c || c.canal !== 'Web') return Response.json({ error: 'Chat no encontrado.' }, { status: 404 });
    return Response.json(vistaPublica(c));
  } catch (e) {
    console.error('[chat]', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Ahora mismo no se puede cargar el chat.' }, { status: 503 });
  }
}
