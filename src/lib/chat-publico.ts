// Lo que ve el cliente en /chat: solo sus mensajes, nada interno del taller.

import type { Conversacion } from './tipos';
import { PERSONAS } from './constantes';
import { fmtMensaje } from './fechas';

export interface MensajePublico {
  id: string;
  de: 'cliente' | 'ia' | 'persona';
  texto: string;
  hora: string;
  autor?: string;
}

export interface VistaChatPublico {
  id: string;
  modo: 'ia' | 'persona';
  atiende: string;
  escribiendo: boolean;
  mensajes: MensajePublico[];
}

export function vistaPublica(c: Conversacion): VistaChatPublico {
  const ultimoDelTaller = [...c.mensajes].reverse().find((m) => m.de === 'persona');
  const p = PERSONAS.find((x) => x.nombre === ultimoDelTaller?.autor);
  let atiende = 'Asistente del taller · contesta al momento';
  if (c.modo === 'persona') {
    atiende = p
      ? `Te atiende ${p.nombre}, ${p.rol === 'recepcion' ? 'de recepción' : p.rol === 'dueno' ? 'el responsable del taller' : 'del taller'}`
      : 'Te atiende una persona del taller';
  }
  return {
    id: c.id,
    modo: c.modo,
    atiende,
    escribiendo: Boolean(c.iaPensando),
    mensajes: c.mensajes.map((m) => ({ id: m.id, de: m.de, texto: m.texto, hora: fmtMensaje(m.cuando), autor: m.autor })),
  };
}
