'use client';

// Trozos pequeños y editables de la ficha de una orden.

import { useState } from 'react';
import { cambiarEstadoAccion, cerrarOrdenAccion, guardarDatosOrdenAccion, reabrirOrdenAccion } from '@/app/acciones';
import { useAccion } from '@/components/avisos';
import { TituloSeccion } from '@/components/ui';
import { ESTADOS, ESTADOS_TABLERO } from '@/lib/constantes';
import { fkm } from '@/lib/formato';
import type { EstadoId, PersonaId } from '@/lib/tipos';

export function SelectorEstado({ ordenId, estado }: { ordenId: string; estado: EstadoId }) {
  const { pendiente, ejecutar } = useAccion();
  const [valor, setValor] = useState(estado);
  const [delServidor, setDelServidor] = useState(estado);
  if (estado !== delServidor) {
    setDelServidor(estado);
    setValor(estado);
  }
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-t2">
      Cambiar estado
      <select
        value={valor}
        disabled={pendiente}
        onChange={(e) => {
          const nuevo = e.target.value as EstadoId;
          setValor(nuevo);
          ejecutar(() => cambiarEstadoAccion(ordenId, nuevo), (r) => !r.ok && setValor(estado));
        }}
        className="h-[42px] border border-borde-2 rounded-lg px-2.5 text-sm bg-white text-tinta font-normal"
      >
        {ESTADOS_TABLERO.map((id) => <option key={id} value={id}>{ESTADOS[id].nombre}</option>)}
      </select>
    </label>
  );
}

export function Motivo({ ordenId, motivo, soloLectura }: { ordenId: string; motivo: string; soloLectura: boolean }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(motivo);
  const { pendiente, ejecutar } = useAccion();
  return (
    <div className="tarjeta px-5 py-[18px] flex flex-col gap-2">
      <div className="flex justify-between items-baseline gap-3">
        <TituloSeccion>Motivo de entrada</TituloSeccion>
        {!soloLectura && !editando && (
          <button type="button" className="btn-texto text-[13px] hover:underline" onClick={() => { setTexto(motivo); setEditando(true); }}>Editar</button>
        )}
      </div>
      {editando ? (
        <div className="flex flex-col gap-2">
          <textarea className="campo" rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-negro h-9 px-4 text-sm" disabled={pendiente}
              onClick={() => ejecutar(() => guardarDatosOrdenAccion(ordenId, { motivo: texto }), (r) => r.ok && setEditando(false))}>Guardar</button>
            <button type="button" className="btn btn-borde h-9 px-3 text-sm" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="text-base leading-normal">{motivo}</div>
      )}
    </div>
  );
}

export function DatosOrden({ ordenId, km, mecanicoId, mecanicoNombre, diasTexto, mecanicos, soloLectura }: {
  ordenId: string; km: number; mecanicoId: PersonaId; mecanicoNombre: string; diasTexto: string;
  mecanicos: { id: PersonaId; nombre: string }[]; soloLectura: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [kmTexto, setKmTexto] = useState(String(km));
  const [mec, setMec] = useState<PersonaId>(mecanicoId);
  const { pendiente, ejecutar } = useAccion();

  if (editando) {
    return (
      <div className="tarjeta px-5 py-[18px] flex flex-col gap-3">
        <label className="etiqueta">Kilómetros
          <input className="campo" value={kmTexto} inputMode="numeric" onChange={(e) => setKmTexto(e.target.value)} />
        </label>
        <label className="etiqueta">Mecánico
          <select className="campo" value={mec} onChange={(e) => setMec(e.target.value as PersonaId)}>
            {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn btn-negro h-9 px-4 text-sm" disabled={pendiente}
            onClick={() => ejecutar(() => guardarDatosOrdenAccion(ordenId, { km: kmTexto, mecanicoId: mec }), (r) => r.ok && setEditando(false))}>Guardar</button>
          <button type="button" className="btn btn-borde h-9 px-3 text-sm" onClick={() => setEditando(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tarjeta px-5 py-[18px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
      <span className="text-t2">Orden</span><span className="font-semibold font-mono text-right">{ordenId}</span>
      <span className="text-t2">Kilómetros</span><span className="font-semibold text-right">{fkm(km)}</span>
      <span className="text-t2">Mecánico</span><span className="font-semibold text-right">{mecanicoNombre}</span>
      <span className="text-t2">En el taller</span><span className="font-semibold text-right">{diasTexto}</span>
      {!soloLectura && (
        <button type="button" className="col-span-2 justify-self-end btn-texto text-[13px] hover:underline"
          onClick={() => { setKmTexto(String(km)); setMec(mecanicoId); setEditando(true); }}>
          Cambiar kilómetros o mecánico
        </button>
      )}
    </div>
  );
}

export function CerrarOrden({ ordenId, listo, sinPrecio }: { ordenId: string; listo: boolean; sinPrecio: number }) {
  const [seguro, setSeguro] = useState(false);
  const { pendiente, ejecutar } = useAccion();
  if (!seguro) {
    return (
      <button type="button" className={`btn h-11 text-[15px] ${listo ? 'btn-rojo' : 'btn-borde'}`} onClick={() => setSeguro(true)}>
        Entregar al cliente y cerrar la orden
      </button>
    );
  }
  return (
    <div className="tarjeta px-5 py-4 flex flex-col gap-2.5">
      <span className="text-sm leading-snug">
        {sinPrecio
          ? `Antes de cerrar, pon precio a ${sinPrecio === 1 ? 'el trabajo que falta' : `los ${sinPrecio} trabajos que faltan`}.`
          : '¿Se ha entregado el coche? La orden pasará al historial del coche.'}
      </span>
      <div className="flex gap-2">
        <button type="button" className="btn btn-rojo h-9 px-4 text-sm" disabled={pendiente || sinPrecio > 0}
          onClick={() => ejecutar(() => cerrarOrdenAccion(ordenId), (r) => r.ok && setSeguro(false))}>Sí, cerrar orden</button>
        <button type="button" className="btn btn-borde h-9 px-3 text-sm" onClick={() => setSeguro(false)}>Cancelar</button>
      </div>
    </div>
  );
}

export function ReabrirOrden({ ordenId }: { ordenId: string }) {
  const { pendiente, ejecutar } = useAccion();
  return (
    <button type="button" className="btn btn-borde h-9 px-3.5 text-sm" disabled={pendiente} onClick={() => ejecutar(() => reabrirOrdenAccion(ordenId))}>
      Reabrir orden
    </button>
  );
}
