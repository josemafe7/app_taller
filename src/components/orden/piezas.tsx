'use client';

import { useState } from 'react';
import { anadirPiezaAccion, borrarPiezaAccion, editarPiezaAccion } from '@/app/acciones';
import { useAccion, useAvisos } from '@/components/avisos';
import { EstadoPiezaChip, TituloSeccion, Vacio } from '@/components/ui';
import { ESTADOS_PIEZA } from '@/lib/constantes';
import type { EstadoPieza } from '@/lib/tipos';
import type { PiezaVista } from '@/lib/vistas';

const OPCIONES = Object.entries(ESTADOS_PIEZA) as [EstadoPieza, string][];

export function Piezas({ ordenId, piezas, soloLectura }: { ordenId: string; piezas: PiezaVista[]; soloLectura: boolean }) {
  const [editando, setEditando] = useState<string | null>(null);
  return (
    <div className="tarjeta px-5 py-[18px] flex flex-col gap-1">
      <TituloSeccion className="mb-1.5">Piezas a pedir</TituloSeccion>
      {piezas.map((p) =>
        editando === p.id ? (
          <EditarPieza key={p.id} ordenId={ordenId} p={p} cerrar={() => setEditando(null)} />
        ) : (
          <div key={p.id} className="flex justify-between gap-3 py-2.5 px-1 border-t border-linea text-[15px] items-center flex-wrap rounded"
            style={{ background: p.reciente ? '#FEF2F2' : 'transparent' }}>
            <span>{p.descripcion}</span>
            <span className="flex items-center gap-3">
              <EstadoPiezaChip estado={p.estado} nota={p.nota} />
              {!soloLectura && (
                <button type="button" className="btn-texto text-[13px] hover:underline" onClick={() => setEditando(p.id)}>Cambiar</button>
              )}
            </span>
          </div>
        ),
      )}
      {!piezas.length && <Vacio>No hay piezas pendientes.</Vacio>}
      {!soloLectura && <NuevaPieza ordenId={ordenId} />}
    </div>
  );
}

function EditarPieza({ ordenId, p, cerrar }: { ordenId: string; p: PiezaVista; cerrar: () => void }) {
  const [estado, setEstado] = useState<EstadoPieza>(p.estado);
  const [nota, setNota] = useState(p.nota);
  const { pendiente, ejecutar } = useAccion();
  return (
    <div className="border-t border-linea py-3 px-2 flex flex-col gap-2 bg-papel rounded">
      <span className="text-[15px] font-medium">{p.descripcion}</span>
      <div className="flex gap-2 flex-wrap items-end">
        <label className="etiqueta w-[170px]">Estado
          <select className="campo" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPieza)}>
            {OPCIONES.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </label>
        <label className="etiqueta flex-[1_1_200px]">Nota
          <input className="campo" value={nota} placeholder="Por ejemplo: llega el jueves" onChange={(e) => setNota(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-negro h-9 px-4 text-sm" disabled={pendiente}
          onClick={() => ejecutar(() => editarPiezaAccion(ordenId, p.id, { estado, nota }), (r) => r.ok && cerrar())}>Guardar</button>
        <button type="button" className="btn btn-borde h-9 px-3 text-sm" disabled={pendiente} onClick={cerrar}>Cancelar</button>
        <button type="button" className="btn btn-texto h-9 px-2 text-sm text-rojo ml-auto" disabled={pendiente}
          onClick={() => ejecutar(() => borrarPiezaAccion(ordenId, p.id), (r) => r.ok && cerrar())}>Quitar pieza</button>
      </div>
    </div>
  );
}

function NuevaPieza({ ordenId }: { ordenId: string }) {
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState<EstadoPieza>('pendiente');
  const [nota, setNota] = useState('');
  const { pendiente, ejecutar } = useAccion();
  const avisar = useAvisos();
  const anadir = () => {
    if (pendiente) return;
    if (!descripcion.trim()) {
      avisar('Escribe qué pieza es.');
      return;
    }
    ejecutar(() => anadirPiezaAccion(ordenId, { descripcion, estado, nota }), (r) => {
      if (r.ok) {
        setDescripcion('');
        setNota('');
        setEstado('pendiente');
      }
    });
  };
  return (
    <div className="flex gap-2 flex-wrap items-end border-t border-borde pt-3 mt-1.5">
      <label className="etiqueta flex-[2_1_220px]">Pieza
        <input className="campo" value={descripcion} placeholder="Qué pieza y referencia" onChange={(e) => setDescripcion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && anadir()} />
      </label>
      <label className="etiqueta w-[170px]">Estado
        <select className="campo" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPieza)}>
          {OPCIONES.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
      </label>
      <label className="etiqueta flex-[1_1_150px]">Nota
        <input className="campo" value={nota} placeholder="Opcional" onChange={(e) => setNota(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && anadir()} />
      </label>
      <button type="button" className="btn btn-negro h-10 px-4 text-sm" disabled={pendiente} onClick={anadir}>Añadir pieza</button>
    </div>
  );
}
