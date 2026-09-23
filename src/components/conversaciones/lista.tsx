'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams, useSelectedLayoutSegment } from 'next/navigation';
import type { Canal } from '@/lib/tipos';

export interface ConversacionFila {
  id: string;
  nombre: string;
  iniciales: string;
  canal: Canal;
  hora: string;
  modo: 'ia' | 'persona';
  necesita: boolean;
  motivo: string;
  vista: string;
  pensando: boolean;
  prueba: boolean;
}

/** Chat de prueba del dueño (pestaña «Probar asistente»). */
const CHIP = (
  <span className="text-[11px] font-bold rounded px-1.5 py-px uppercase tracking-[.04em] border" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>
    Prueba
  </span>
);

export function ListaConversaciones({ filas }: { filas: ConversacionFila[] }) {
  const seleccionada = useSelectedLayoutSegment();
  const parametros = useSearchParams();
  const [filtro, setFiltro] = useState<'todas' | 'persona'>(parametros.get('filtro') === 'persona' ? 'persona' : 'todas');
  const pendientes = filas.filter((f) => f.necesita).length;
  const visibles = filtro === 'todas' ? filas : filas.filter((f) => f.necesita);

  const pestaña = (id: 'todas' | 'persona', texto: string) => (
    <button
      type="button"
      onClick={() => setFiltro(id)}
      className="flex-1 border-none rounded-md px-2 py-[7px] text-[13px] font-semibold"
      style={{ background: filtro === id ? '#fff' : 'transparent', color: filtro === id ? '#1C1917' : '#57534E' }}
    >
      {texto}
    </button>
  );

  return (
    <aside className="border-r border-borde bg-white flex flex-col min-h-0">
      <div className="px-3.5 pt-3.5 pb-3 flex flex-col gap-2.5 border-b border-borde">
        <h1 className="m-0 text-xl font-bold">Conversaciones</h1>
        <div className="flex gap-1 bg-suave rounded-lg p-[3px]">
          {pestaña('todas', 'Todas')}
          {pestaña('persona', `Necesitan persona (${pendientes})`)}
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {visibles.map((c) => {
          const on = c.id === seleccionada;
          return (
            <Link
              key={c.id}
              href={`/conversaciones/${c.id}${filtro === 'persona' ? '?filtro=persona' : ''}`}
              className="w-full text-left border-b border-linea px-3.5 py-3 flex gap-2.5"
              style={{ background: on ? '#F1EFEC' : '#fff' }}
            >
              <span
                className="w-9 h-9 rounded-full text-[13px] font-bold flex items-center justify-center shrink-0"
                style={{ background: c.necesita ? '#B91C1C' : '#E7E5E4', color: c.necesita ? '#fff' : '#1C1917' }}
              >
                {c.iniciales}
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis">{c.nombre}</span>
                  <span className="text-xs text-t2 shrink-0">{c.hora}</span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <span className="text-[11px] font-bold text-t3 border border-borde-2 rounded px-1.5 py-px uppercase tracking-[.04em]">{c.canal}</span>
                  {c.prueba && CHIP}
                  <span className="text-xs text-t2">{c.modo === 'ia' ? 'Contesta la IA' : 'Contesta una persona'}</span>
                </div>
                <div className="text-[13px] text-t2 leading-[1.35] line-clamp-2">
                  {c.pensando ? 'La IA está escribiendo…' : c.vista}
                </div>
                {c.necesita && (
                  <div className="bg-rojo-50 border border-rojo-200 text-rojo-hover rounded-md px-2 py-[5px] text-xs font-semibold leading-[1.35]">
                    Necesita a una persona{c.motivo ? ` · ${c.motivo}` : ''}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
        {!visibles.length && <div className="text-sm text-t4 px-3.5 py-4">No hay conversaciones pendientes.</div>}
      </div>
    </aside>
  );
}
