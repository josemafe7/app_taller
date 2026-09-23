'use client';

import { useEffect, useRef, useState } from 'react';
import { cambiarModoAccion, enviarMensajeAccion } from '@/app/acciones';
import { useAccion } from '@/components/avisos';
import type { Canal } from '@/lib/tipos';

interface MensajeVista {
  id: string;
  de: 'cliente' | 'ia' | 'persona';
  texto: string;
  hora: string;
  quien: string;
}

interface Props {
  yo: string;
  conversacion: {
    id: string;
    nombre: string;
    canal: Canal;
    contacto: string;
    modo: 'ia' | 'persona';
    necesita: boolean;
    motivo: string;
    pensando: boolean;
    prueba: boolean;
    mensajes: MensajeVista[];
  };
}

/** Chat de prueba del dueño (pestaña «Probar asistente»). */
const CHIP = (
  <span className="text-[11px] font-bold rounded px-1.5 py-px uppercase tracking-[.04em] border" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>
    Prueba
  </span>
);

const ESTILO_BURBUJA = {
  cliente: { align: 'flex-start', bg: '#fff', fg: '#1C1917', bd: '#E4E1DC' },
  ia: { align: 'flex-end', bg: '#EDEBE8', fg: '#1C1917', bd: '#E4E1DC' },
  persona: { align: 'flex-end', bg: '#B91C1C', fg: '#fff', bd: '#B91C1C' },
} as const;

export function PanelConversacion({ yo, conversacion: cv }: Props) {
  const [borrador, setBorrador] = useState('');
  const { pendiente, ejecutar } = useAccion();
  const lista = useRef<HTMLDivElement>(null);
  const esIA = cv.modo === 'ia';

  useEffect(() => {
    if (lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [cv.id, cv.mensajes.length, cv.pensando]);

  const enviar = () => {
    const texto = borrador.trim();
    if (!texto || pendiente) return;
    setBorrador('');
    // Si no se ha podido enviar, el texto vuelve a la caja.
    ejecutar(() => enviarMensajeAccion(cv.id, texto), (r) => !r.ok && setBorrador((actual) => actual || texto));
  };
  const cambiarModo = (modo: 'ia' | 'persona') => {
    if (modo !== cv.modo) ejecutar(() => cambiarModoAccion(cv.id, modo));
  };

  return (
    <section className="flex flex-col min-h-0 min-w-0">
      <div className="bg-white border-b border-borde px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[17px] font-bold flex items-center gap-2">{cv.nombre}{cv.prueba && CHIP}</div>
          <div className="text-[13px] text-t2">{cv.canal} · {cv.contacto}</div>
        </div>
        <div className="ml-auto flex flex-wrap flex-[0_1_auto] min-w-0 max-w-full p-1 bg-suave rounded-[10px] border border-borde gap-1">
          <button
            type="button"
            disabled={pendiente}
            onClick={() => cambiarModo('ia')}
            className="flex-[1_1_auto] min-w-0 border-none rounded-[7px] px-4 py-2.5 text-[15px] font-bold flex items-center justify-center gap-2"
            style={{ background: esIA ? '#1C1917' : 'transparent', color: esIA ? '#fff' : '#57534E' }}
          >
            <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: esIA ? '#fff' : '#A8A29E' }} />
            Contesta la IA
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => cambiarModo('persona')}
            className="flex-[1_1_auto] min-w-0 border-none rounded-[7px] px-4 py-2.5 text-[15px] font-bold flex items-center justify-center gap-2"
            style={{ background: !esIA ? '#B91C1C' : 'transparent', color: !esIA ? '#fff' : '#57534E' }}
          >
            <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: !esIA ? '#fff' : '#A8A29E' }} />
            Contesta una persona
          </button>
        </div>
      </div>

      {cv.necesita && (
        <div className="bg-rojo text-white px-5 py-2.5 text-sm font-semibold flex gap-2.5 items-center flex-wrap">
          Necesita a una persona{cv.motivo ? `: ${cv.motivo}` : ''}
          <span className="ml-auto font-medium">Contesta para marcarla como atendida</span>
        </div>
      )}

      <div ref={lista} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        {cv.mensajes.map((m) => {
          const e = ESTILO_BURBUJA[m.de];
          return (
            <div key={m.id} className="flex flex-col gap-1" style={{ alignItems: e.align }}>
              <span className="text-xs text-t2 font-semibold">{m.quien} · {m.hora}</span>
              <div
                className="max-w-[560px] rounded-xl px-3.5 py-2.5 text-[15px] leading-[1.45] whitespace-pre-wrap"
                style={{ background: e.bg, color: e.fg, border: `1px solid ${e.bd}` }}
              >
                {m.texto}
              </div>
            </div>
          );
        })}
        {cv.pensando && <span className="self-end text-sm text-t2">La IA está escribiendo…</span>}
      </div>

      <div className="bg-white border-t border-borde px-5 py-3 flex flex-col gap-2">
        {esIA && (
          <span className="text-sm text-t3 max-w-[640px]">
            La IA informa del estado del coche, lo que se le ha hecho y cuánto va, da precios de la tarifa y reserva citas. No cambia nada de las órdenes. Puedes escribir tú igualmente.
          </span>
        )}
        <div className="flex gap-2.5 items-end">
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder={`Escribe como ${yo}…`}
            rows={2}
            className="flex-1 resize-none border border-borde-2 rounded-[10px] px-3 py-2.5 text-[15px] leading-[1.4] focus:outline-2 focus:outline-rojo/20 focus:border-rojo"
          />
          <button type="button" className="btn btn-rojo h-[46px] px-[22px] text-[15px] rounded-[10px]" disabled={pendiente || !borrador.trim()} onClick={enviar}>
            Enviar
          </button>
        </div>
      </div>
    </section>
  );
}
