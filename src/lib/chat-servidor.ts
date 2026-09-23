// Lo que pasa después de que un cliente escribe en el chat de la web (o el
// dueño, en la pestaña «Probar asistente»): contesta la IA o avisa a una persona.

import 'server-only';
import type { Db } from './supabase/servidor';
import { cabeceraConversacion, leerConversacion } from './datos';
import { pasarAPersona } from './operaciones';
import { atenderConversacion } from './ia/asistente';
import { vistaPublica, type VistaChatPublico } from './chat-publico';
import { consumir } from './limites';

const HORA = 3600_000;

export async function contestarAlCliente(db: Db, id: string): Promise<VistaChatPublico> {
  const c = await cabeceraConversacion(db, id);
  if (c?.modo === 'ia') {
    // Tope general de respuestas de la IA por hora: protege el gasto en OpenRouter.
    if (consumir('chat-ia-global', 400, HORA)) {
      await atenderConversacion(db, id);
    } else {
      await pasarAPersona(db, id, 'Mucho volumen en el chat: la IA está en pausa',
        'Ahora mismo hay mucha gente escribiendo. Te contesta una persona del taller por aquí en cuanto pueda.');
    }
  } else if (c && !c.necesitaPersona) {
    // La lleva una persona: se marca para que la vea en la bandeja.
    await db.from('conversaciones').update({ necesita_persona: true, motivo: c.motivo ?? 'Mensaje nuevo sin contestar' }).eq('id', id);
  }
  const final = await leerConversacion(db, id);
  if (!final) throw new Error('El chat no se puede leer después de escribir');
  return vistaPublica(final);
}
