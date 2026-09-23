'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MensajePublico, VistaChatPublico } from '@/lib/chat-publico';

const CLAVE = 'talleres-ruiz-chat';
const SUGERENCIAS = ['Pedir cita', '¿Cómo va mi coche?', 'Precios', 'Hablar con una persona'];

function leerId(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardarId(clave: string, id: string | null) {
  try {
    if (id) window.localStorage.setItem(clave, id);
    else window.localStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento local: el chat sigue funcionando mientras no se recargue.
  }
}

/**
 * El chat que ve el cliente. Con `prueba`, es el de la pestaña «Probar
 * asistente»: escribe en su propia ruta, guarda su chat aparte y cabe dentro
 * de la pantalla del taller.
 */
export function ChatPublico({ prueba = false }: { prueba?: boolean }) {
  const clave = prueba ? `${CLAVE}-prueba` : CLAVE;
  const [chat, setChat] = useState<VistaChatPublico | null>(null);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pendiente, setPendiente] = useState<MensajePublico | null>(null);
  const [error, setError] = useState('');
  const lista = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  // Cambia con cada "Nuevo chat": las respuestas del chat anterior se ignoran.
  const generacion = useRef(0);

  const cargar = useCallback(async (id: string) => {
    const gen = generacion.current;
    try {
      const r = await fetch(`/api/chat/${id}`, { cache: 'no-store' });
      if (gen !== generacion.current || idRef.current !== id) return;
      if (r.status === 404) {
        guardarId(clave, null);
        idRef.current = null;
        setChat(null);
        return;
      }
      if (r.ok) {
        const datos = (await r.json()) as VistaChatPublico;
        if (gen === generacion.current && idRef.current === id) setChat(datos);
      }
    } catch {
      // Se reintenta en la siguiente vuelta.
    }
  }, [clave]);

  // Al abrir, recupera el chat de antes.
  useEffect(() => {
    const id = leerId(clave);
    if (!id) return;
    idRef.current = id;
    let vigente = true;
    fetch(`/api/chat/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!vigente) return;
        if (r.status === 404) {
          guardarId(clave, null);
          idRef.current = null;
          return;
        }
        if (r.ok) setChat((await r.json()) as VistaChatPublico);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [clave]);

  // Mensajes nuevos del taller (cuando contesta una persona).
  useEffect(() => {
    const t = window.setInterval(() => {
      if (idRef.current && !enviando && document.visibilityState === 'visible') void cargar(idRef.current);
    }, 3000);
    return () => window.clearInterval(t);
  }, [cargar, enviando]);

  useEffect(() => {
    if (lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [chat?.mensajes.length, pendiente, enviando]);

  const enviar = async (textoCrudo: string) => {
    const texto = textoCrudo.trim();
    if (!texto || enviando) return;
    const gen = generacion.current;
    setBorrador('');
    setError('');
    setEnviando(true);
    setPendiente({ id: 'pendiente', de: 'cliente', texto, hora: 'Ahora' });
    try {
      const r = await fetch(prueba ? '/api/probar-asistente' : '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, conversacionId: idRef.current }),
      });
      const j = (await r.json().catch(() => ({}))) as Partial<VistaChatPublico> & { error?: string };
      if (gen !== generacion.current) return;
      if (!r.ok || !j.id) {
        setError(j.error ?? 'No se ha podido enviar. Inténtalo otra vez.');
        setBorrador(texto);
        return;
      }
      idRef.current = j.id;
      guardarId(clave, j.id);
      setChat(j as VistaChatPublico);
    } catch {
      setError('No se ha podido enviar. Revisa la conexión e inténtalo otra vez.');
      setBorrador(texto);
    } finally {
      setPendiente(null);
      setEnviando(false);
    }
  };

  const nuevoChat = () => {
    generacion.current++;
    guardarId(clave, null);
    idRef.current = null;
    setChat(null);
    setError('');
  };

  const mensajes = [...(chat?.mensajes ?? []), ...(pendiente ? [pendiente] : [])];
  const escribiendo = enviando && (chat?.modo ?? 'ia') === 'ia';

  return (
    <div className={`${prueba
      ? 'w-full sm:w-[460px] h-[min(720px,calc(100dvh-150px))] min-h-[420px] rounded-2xl border border-borde'
      : 'w-full h-dvh sm:w-[460px] sm:h-[min(780px,calc(100dvh-48px))] sm:rounded-2xl sm:border sm:border-borde'
    } bg-fondo overflow-hidden sm:shadow-[0_12px_40px_rgba(28,25,23,.18)] shrink-0 flex flex-col`}>
      <div className="bg-rojo text-white px-[18px] pt-[max(14px,env(safe-area-inset-top))] pb-4 flex items-center gap-3 shrink-0">
        <div className="w-[42px] h-[42px] bg-white rounded-md text-rojo font-bold text-base flex items-center justify-center">TR</div>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-bold">
            Talleres Ruiz
            {prueba && <span className="ml-2 align-middle text-[11px] font-bold uppercase tracking-[.04em] bg-white/20 rounded px-1.5 py-px">Prueba</span>}
          </div>
          <div className="text-[13px]">{chat?.atiende ?? 'Asistente del taller · contesta al momento'}</div>
        </div>
        {chat && (
          <button type="button" onClick={nuevoChat} disabled={enviando} className="text-xs font-semibold border border-white/60 rounded-full px-2.5 py-1 shrink-0 disabled:opacity-50">
            Nuevo chat
          </button>
        )}
      </div>

      <div ref={lista} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="self-start max-w-[85%] bg-white border border-borde rounded-[14px] px-3.5 py-[11px] text-base leading-[1.45]">
          Hola, soy el asistente de Talleres Ruiz. Te cuento cómo va tu coche (dime la matrícula y el código de la orden), te doy precios y te reservo cita. Si hace falta, te paso con Lucía, de recepción.
        </div>
        {mensajes.map((m) => {
          const mio = m.de === 'cliente';
          return (
            <div key={m.id} className="flex flex-col gap-[3px]" style={{ alignItems: mio ? 'flex-end' : 'flex-start' }}>
              <span className="text-xs text-t2">
                {mio ? `Tú · ${m.hora}` : m.de === 'ia' ? `Asistente · ${m.hora}` : `${m.autor ?? 'Taller'} · Talleres Ruiz · ${m.hora}`}
              </span>
              <div
                className="max-w-[85%] rounded-[14px] px-3.5 py-[11px] text-base leading-[1.45] whitespace-pre-wrap"
                style={{ background: mio ? '#B91C1C' : '#fff', color: mio ? '#fff' : '#1C1917', border: `1px solid ${mio ? '#B91C1C' : '#E4E1DC'}` }}
              >
                {m.texto}
              </div>
            </div>
          );
        })}
        {(escribiendo || chat?.escribiendo) && <span className="text-sm text-t2">El asistente está escribiendo…</span>}
        {error && <span className="text-sm text-rojo">{error}</span>}
        {prueba && chat && (
          <Link href={`/conversaciones/${chat.id}`} className="self-center text-[13px] font-semibold text-t2 underline underline-offset-2 hover:text-tinta">
            Ver este chat en Conversaciones (como lo ve el taller)
          </Link>
        )}
        {!chat && !enviando && (
          <div className="flex flex-wrap gap-2 mt-1">
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" onClick={() => void enviar(s)}
                className="h-11 px-4 rounded-[22px] border-[1.5px] border-rojo bg-white text-rojo text-[15px] font-semibold">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border-t border-borde px-3.5 pt-3 pb-[max(18px,env(safe-area-inset-bottom))] flex gap-2.5 shrink-0">
        <input
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void enviar(borrador)}
          placeholder="Escribe tu mensaje…"
          maxLength={2000}
          className="flex-1 min-w-0 h-[52px] border border-borde-2 rounded-[26px] px-[18px] text-base bg-fondo focus:outline-2 focus:outline-rojo/20"
        />
        <button type="button" onClick={() => void enviar(borrador)} disabled={enviando || !borrador.trim()}
          className="h-[52px] px-5 rounded-[26px] bg-rojo text-white text-base font-bold disabled:opacity-60">
          Enviar
        </button>
      </div>
    </div>
  );
}
