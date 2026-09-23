'use client';

import { useState } from 'react';
import { borrarServicioAccion, guardarServicioAccion } from '@/app/acciones';
import { useAccion } from '@/components/avisos';
import { eur, precioEditable } from '@/lib/formato';
import type { ServicioTarifa } from '@/lib/tipos';

const COLUMNAS = 'grid grid-cols-[minmax(0,1fr)_150px_110px_120px_70px] gap-3';

export function TablaTarifa({ servicios }: { servicios: ServicioTarifa[] }) {
  const [categoria, setCategoria] = useState('Todas');
  const [editando, setEditando] = useState<string | null>(null);
  const categorias = ['Todas', ...new Set(servicios.map((s) => s.categoria))];
  const visibles = servicios.filter((s) => categoria === 'Todas' || s.categoria === categoria);

  return (
    <>
      <div className="flex gap-1.5 flex-wrap items-center">
        {categorias.map((c) => {
          const on = c === categoria;
          return (
            <button key={c} type="button" onClick={() => setCategoria(c)} className="px-3.5 py-[7px] rounded-full border text-sm font-semibold"
              style={{ background: on ? '#1C1917' : '#fff', color: on ? '#fff' : '#1C1917', borderColor: on ? '#1C1917' : '#D6D3CE' }}>
              {c}
            </button>
          );
        })}
        <button type="button" className="btn btn-rojo h-9 px-4 text-sm ml-auto" onClick={() => setEditando('nuevo')}>+ Añadir servicio</button>
      </div>

      <div className="overflow-x-auto">
        <div className="bg-white border border-borde rounded-xl overflow-hidden min-w-[640px]">
          <div className={`${COLUMNAS} px-5 py-3 text-xs font-bold text-t2 uppercase tracking-[.05em] border-b border-borde bg-papel`}>
            <span>Servicio</span><span>Categoría</span><span>Tiempo</span><span className="text-right">Precio</span><span />
          </div>
          {editando === 'nuevo' && (
            <FilaEdicion categorias={categorias.slice(1)} categoriaInicial={categoria === 'Todas' ? '' : categoria} cerrar={() => setEditando(null)} />
          )}
          {visibles.map((s) =>
            editando === s.id ? (
              <FilaEdicion key={s.id} servicio={s} categorias={categorias.slice(1)} cerrar={() => setEditando(null)} />
            ) : (
              <div key={s.id} className={`${COLUMNAS} px-5 py-[13px] border-b border-linea text-[15px] items-center`}>
                <span className="font-medium">{s.nombre}</span>
                <span className="text-sm text-t2">{s.categoria}</span>
                <span className="text-sm text-t2">{s.tiempo}</span>
                <span className="text-right font-bold tabular-nums">{eur(s.precio)}{s.porUnidad ? <span className="font-medium text-t2 text-[13px]"> / ud.</span> : null}</span>
                <button type="button" className="btn-texto text-[13px] text-right hover:underline" onClick={() => setEditando(s.id)}>Editar</button>
              </div>
            ),
          )}
          {!visibles.length && <div className="px-5 py-4 text-sm text-t4">No hay servicios en esta categoría.</div>}
        </div>
      </div>
    </>
  );
}

function FilaEdicion({ servicio, categorias, categoriaInicial = '', cerrar }: {
  servicio?: ServicioTarifa; categorias: string[]; categoriaInicial?: string; cerrar: () => void;
}) {
  const [nombre, setNombre] = useState(servicio?.nombre ?? '');
  const [categoria, setCategoria] = useState(servicio?.categoria ?? categoriaInicial);
  const [tiempo, setTiempo] = useState(servicio?.tiempo ?? '');
  const [precio, setPrecio] = useState(precioEditable(servicio?.precio));
  const [porUnidad, setPorUnidad] = useState(servicio?.porUnidad ?? false);
  const { pendiente, ejecutar } = useAccion();

  return (
    <div className="px-5 py-3 border-b border-linea bg-papel flex flex-col gap-2.5">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-[minmax(0,1fr)_150px_110px_120px]">
        <label className="etiqueta col-span-2 sm:col-span-1">Servicio
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="etiqueta">Categoría
          <input className="campo" list="categorias-tarifa" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          <datalist id="categorias-tarifa">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="etiqueta">Tiempo
          <input className="campo" value={tiempo} onChange={(e) => setTiempo(e.target.value)} placeholder="1 h" />
        </label>
        <label className="etiqueta">Precio (€)
          <input className="campo text-right" value={precio} inputMode="decimal" onChange={(e) => setPrecio(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <label className="flex items-center gap-2 text-sm text-t3 mr-auto">
          <input type="checkbox" className="w-4 h-4 accent-rojo" checked={porUnidad} onChange={(e) => setPorUnidad(e.target.checked)} />
          Precio por unidad (por ejemplo, cada neumático)
        </label>
        {servicio && (
          <button type="button" className="btn btn-texto h-9 px-2 text-sm text-rojo" disabled={pendiente}
            onClick={() => ejecutar(() => borrarServicioAccion(servicio.id), (r) => r.ok && cerrar())}>Quitar de la tarifa</button>
        )}
        <button type="button" className="btn btn-borde h-9 px-3 text-sm" onClick={cerrar}>Cancelar</button>
        <button type="button" className="btn btn-negro h-9 px-4 text-sm" disabled={pendiente}
          onClick={() => ejecutar(() => guardarServicioAccion({ id: servicio?.id, nombre, categoria, tiempo, precio, porUnidad }), (r) => r.ok && cerrar())}>
          Guardar
        </button>
      </div>
    </div>
  );
}
