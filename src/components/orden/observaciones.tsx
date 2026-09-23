'use client';

import { useState } from 'react';
import { anadirObservacionAccion, borrarObservacionAccion, editarObservacionAccion } from '@/app/acciones';
import { useAccion, useAvisos } from '@/components/avisos';
import { TituloSeccion, Vacio } from '@/components/ui';
import { eur } from '@/lib/formato';
import type { ObservacionVista } from '@/lib/vistas';

export function Observaciones({ ordenId, observaciones, soloLectura }: { ordenId: string; observaciones: ObservacionVista[]; soloLectura: boolean }) {
  const [editando, setEditando] = useState<string | null>(null);
  return (
    <div className="tarjeta px-5 py-[18px] flex flex-col gap-1">
      <TituloSeccion className="mb-1.5">Observaciones</TituloSeccion>
      {observaciones.map((o) =>
        editando === o.id ? (
          <EditarObservacion key={o.id} ordenId={ordenId} o={o} cerrar={() => setEditando(null)} />
        ) : (
          <div key={o.id} className="flex flex-col gap-1 px-2.5 py-[11px] border-t border-linea rounded" style={{ background: o.reciente ? '#FEF2F2' : 'transparent' }}>
            {o.recomendacion && (
              <span className="self-start text-[11px] font-bold text-rojo uppercase tracking-[.05em]">Recomendación · sale en el informe</span>
            )}
            <span className="text-[15px] leading-[1.45]">{o.texto}</span>
            {o.tarifa && (
              <span className="text-[13px] text-t3">Según tarifa: {o.tarifa.nombre} · {eur(o.tarifa.precio)}{o.tarifa.porUnidad ? ' / ud.' : ''}</span>
            )}
            <span className="text-xs text-t2 flex gap-3 items-center">
              <span>{o.quienNombre} · {o.cuando}</span>
              {!soloLectura && (
                <button type="button" className="btn-texto text-xs hover:underline" onClick={() => setEditando(o.id)}>Editar</button>
              )}
            </span>
          </div>
        ),
      )}
      {!observaciones.length && <Vacio>Sin observaciones.</Vacio>}
      {!soloLectura && <NuevaObservacion ordenId={ordenId} />}
    </div>
  );
}

function EditarObservacion({ ordenId, o, cerrar }: { ordenId: string; o: ObservacionVista; cerrar: () => void }) {
  const [texto, setTexto] = useState(o.texto);
  const [recomendacion, setRecomendacion] = useState(o.recomendacion);
  const { pendiente, ejecutar } = useAccion();
  return (
    <div className="border-t border-linea py-3 px-2 flex flex-col gap-2 bg-papel rounded">
      <textarea className="campo" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-t3">
        <input type="checkbox" checked={recomendacion} onChange={(e) => setRecomendacion(e.target.checked)} className="w-4 h-4 accent-rojo" />
        Es una recomendación (sale en el informe)
      </label>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-negro h-9 px-4 text-sm" disabled={pendiente}
          onClick={() => ejecutar(() => editarObservacionAccion(ordenId, o.id, { texto, recomendacion }), (r) => r.ok && cerrar())}>Guardar</button>
        <button type="button" className="btn btn-borde h-9 px-3 text-sm" disabled={pendiente} onClick={cerrar}>Cancelar</button>
        <button type="button" className="btn btn-texto h-9 px-2 text-sm text-rojo ml-auto" disabled={pendiente}
          onClick={() => ejecutar(() => borrarObservacionAccion(ordenId, o.id), (r) => r.ok && cerrar())}>Quitar</button>
      </div>
    </div>
  );
}

function NuevaObservacion({ ordenId }: { ordenId: string }) {
  const [texto, setTexto] = useState('');
  const [recomendacion, setRecomendacion] = useState(false);
  const { pendiente, ejecutar } = useAccion();
  const avisar = useAvisos();
  const anadir = () => {
    if (pendiente) return;
    if (!texto.trim()) {
      avisar('Escribe la observación.');
      return;
    }
    ejecutar(() => anadirObservacionAccion(ordenId, { texto, recomendacion }), (r) => {
      if (r.ok) {
        setTexto('');
        setRecomendacion(false);
      }
    });
  };
  return (
    <div className="flex flex-col gap-2 border-t border-borde pt-3 mt-1.5">
      <textarea className="campo" rows={2} value={texto} placeholder="Qué se ha visto en el coche o qué se le recomienda al cliente" onChange={(e) => setTexto(e.target.value)} />
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-t3">
          <input type="checkbox" checked={recomendacion} onChange={(e) => setRecomendacion(e.target.checked)} className="w-4 h-4 accent-rojo" />
          Es una recomendación (sale en el informe)
        </label>
        <button type="button" className="btn btn-negro h-10 px-4 text-sm ml-auto" disabled={pendiente} onClick={anadir}>Añadir observación</button>
      </div>
    </div>
  );
}
