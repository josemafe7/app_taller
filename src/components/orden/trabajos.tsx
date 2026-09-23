'use client';

import { useState } from 'react';
import { anadirTrabajoAccion, borrarTrabajoAccion, editarTrabajoAccion } from '@/app/acciones';
import { useAccion, useAvisos } from '@/components/avisos';
import { TituloSeccion, Vacio } from '@/components/ui';
import { eur, precioEditable } from '@/lib/formato';
import type { PersonaId, ServicioTarifa } from '@/lib/tipos';
import type { TrabajoVista } from '@/lib/vistas';

interface Props {
  ordenId: string;
  trabajos: TrabajoVista[];
  tarifa: ServicioTarifa[];
  personas: { id: PersonaId; nombre: string }[];
  mecanicoId: PersonaId;
  soloLectura: boolean;
}

export function Trabajos({ ordenId, trabajos, tarifa, personas, mecanicoId, soloLectura }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  return (
    <div className="tarjeta px-5 py-[18px] flex flex-col gap-1">
      <div className="flex justify-between items-baseline mb-1.5">
        <TituloSeccion>Trabajos hechos</TituloSeccion>
        <span className="text-[13px] text-t2">{trabajos.length === 1 ? '1 trabajo' : `${trabajos.length} trabajos`}</span>
      </div>
      {trabajos.map((t) =>
        editando === t.id ? (
          <EditarTrabajo key={t.id} ordenId={ordenId} t={t} personas={personas} cerrar={() => setEditando(null)} />
        ) : (
          <FilaTrabajo key={t.id} t={t} soloLectura={soloLectura} editar={() => setEditando(t.id)} />
        ),
      )}
      {!trabajos.length && <Vacio>Todavía no hay trabajos apuntados.</Vacio>}
      {!soloLectura && <NuevoTrabajo ordenId={ordenId} tarifa={tarifa} personas={personas} mecanicoId={mecanicoId} />}
    </div>
  );
}

function FilaTrabajo({ t, soloLectura, editar }: { t: TrabajoVista; soloLectura: boolean; editar: () => void }) {
  return (
    <div className="flex justify-between gap-3 px-2.5 py-[11px] border-t border-linea rounded" style={{ background: t.reciente ? '#FEF2F2' : 'transparent' }}>
      <div className="flex flex-col gap-[3px] min-w-0">
        <span className="text-[15px] font-medium flex gap-2 items-center flex-wrap">
          {t.descripcion}{t.cantidad > 1 ? ` (${t.cantidad} uds.)` : ''}
          {t.reciente && (
            <span className="text-[11px] font-bold text-rojo bg-white border border-rojo-200 rounded px-1.5 py-px">
              Nuevo · {t.ia === 'voz' ? 'por voz' : 'con IA'}
            </span>
          )}
        </span>
        <span className="text-xs text-t2">{t.hechoPorNombre} · {t.cuando} · {t.origen === 'tarifa' ? 'Tarifa' : 'Precio a mano'}</span>
      </div>
      <div className="flex items-start gap-3 shrink-0">
        {t.precio === null
          ? <span className="text-sm font-bold text-rojo whitespace-nowrap">Precio a poner</span>
          : <span className="text-[15px] tabular-nums whitespace-nowrap font-semibold">{eur(t.precio)}</span>}
        {!soloLectura && (
          <button type="button" onClick={editar} className="btn-texto text-[13px] underline-offset-2 hover:underline">
            {t.precio === null ? 'Poner precio' : 'Editar'}
          </button>
        )}
      </div>
    </div>
  );
}

function EditarTrabajo({ ordenId, t, personas, cerrar }: {
  ordenId: string; t: TrabajoVista; personas: Props['personas']; cerrar: () => void;
}) {
  const [descripcion, setDescripcion] = useState(t.descripcion);
  const [precio, setPrecio] = useState(precioEditable(t.precio));
  const [hechoPor, setHechoPor] = useState<PersonaId>(t.hechoPor);
  const { pendiente, ejecutar } = useAccion();
  const cambiaPrecio = precio.trim() !== precioEditable(t.precio);

  const guardar = () => ejecutar(
    () => editarTrabajoAccion(ordenId, t.id, { descripcion, precio: cambiaPrecio ? precio : undefined, hechoPor }),
    (r) => r.ok && cerrar(),
  );
  const quitar = () => ejecutar(() => borrarTrabajoAccion(ordenId, t.id), (r) => r.ok && cerrar());

  return (
    <div className="border-t border-linea px-2.5 py-3 flex flex-col gap-2 bg-papel rounded">
      <div className="flex gap-2 flex-wrap items-end">
        <label className="etiqueta flex-[2_1_220px]">Descripción
          <input className="campo" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
        <label className="etiqueta w-[110px]">Precio (€)
          <input className="campo text-right" value={precio} placeholder="A poner" inputMode="decimal" onChange={(e) => setPrecio(e.target.value)} />
        </label>
        <label className="etiqueta w-[130px]">Hecho por
          <select className="campo" value={hechoPor} onChange={(e) => setHechoPor(e.target.value as PersonaId)}>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      </div>
      {t.origen === 'tarifa' && cambiaPrecio && (
        <span className="text-xs text-t2">Si cambias el precio, este trabajo pasa a «Precio a mano».</span>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-negro h-9 px-4 text-sm" disabled={pendiente} onClick={guardar}>Guardar</button>
        <button type="button" className="btn btn-borde h-9 px-3 text-sm" disabled={pendiente} onClick={cerrar}>Cancelar</button>
        <button type="button" className="btn btn-texto h-9 px-2 text-sm text-rojo ml-auto" disabled={pendiente} onClick={quitar}>Quitar trabajo</button>
      </div>
    </div>
  );
}

function NuevoTrabajo({ ordenId, tarifa, personas, mecanicoId }: {
  ordenId: string; tarifa: ServicioTarifa[]; personas: Props['personas']; mecanicoId: PersonaId;
}) {
  const [sel, setSel] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [uds, setUds] = useState('1');
  const [hechoPor, setHechoPor] = useState<PersonaId>(mecanicoId);
  const { pendiente, ejecutar } = useAccion();
  const avisar = useAvisos();
  const servicio = tarifa.find((s) => s.id === sel);
  const cantidad = Math.max(1, Math.min(50, Number.parseInt(uds, 10) || 1));
  const precioMostrado = servicio ? precioEditable(servicio.precio * (servicio.porUnidad ? cantidad : 1)) : precio;

  const elegir = (valor: string) => {
    setSel(valor);
    const s = tarifa.find((x) => x.id === valor);
    setDescripcion(s ? s.nombre : '');
    setPrecio('');
    setUds('1');
  };

  const anadir = () => {
    if (pendiente) return;
    if (!descripcion.trim() && !servicio) {
      avisar('Escribe qué se ha hecho.');
      return;
    }
    ejecutar(
      () => anadirTrabajoAccion(ordenId, { descripcion, tarifaId: servicio?.id ?? null, cantidad, precio: servicio ? '' : precio, hechoPor }),
      (r) => {
        if (r.ok) {
          setSel('');
          setDescripcion('');
          setPrecio('');
          setUds('1');
        }
      },
    );
  };

  return (
    <div className="flex gap-2 flex-wrap items-end border-t border-borde pt-3 mt-1.5">
      <label className="etiqueta flex-[1_1_200px]">De la tarifa
        <select className="campo" value={sel} onChange={(e) => elegir(e.target.value)}>
          <option value="">Elegir servicio…</option>
          {tarifa.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre} · {eur(s.precio)}{s.porUnidad ? ' / ud.' : ''}</option>
          ))}
          <option value="__mano">Otro trabajo (precio a mano)</option>
        </select>
      </label>
      <label className="etiqueta flex-[2_1_220px]">Descripción
        <input className="campo" value={descripcion} placeholder="Qué se ha hecho" onChange={(e) => setDescripcion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && anadir()} />
      </label>
      {servicio?.porUnidad && (
        <label className="etiqueta w-[70px]">Uds.
          <input className="campo text-right" value={uds} inputMode="numeric" onChange={(e) => setUds(e.target.value.replace(/\D/g, ''))} />
        </label>
      )}
      <label className="etiqueta w-[110px]">Precio (€)
        <input
          className="campo text-right"
          value={precioMostrado}
          readOnly={Boolean(servicio)}
          title={servicio ? 'El precio sale de la tarifa' : 'Déjalo vacío si todavía no tiene precio'}
          placeholder={servicio ? '' : 'A poner'}
          inputMode="decimal"
          onChange={(e) => setPrecio(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && anadir()}
        />
      </label>
      <label className="etiqueta w-[120px]">Hecho por
        <select className="campo" value={hechoPor} onChange={(e) => setHechoPor(e.target.value as PersonaId)}>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>
      <button type="button" className="btn btn-negro h-10 px-4 text-sm" disabled={pendiente} onClick={anadir}>Añadir trabajo</button>
    </div>
  );
}
