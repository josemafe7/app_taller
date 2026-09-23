'use client';

// Pantalla "Revisa antes de guardar": los cambios propuestos, resaltados.
// Confirmar guarda; Corregir deja editarlos antes; Descartar no guarda nada.

import { useState } from 'react';
import { EstadoPill, Numero } from '@/components/ui';
import { ESTADOS, ESTADOS_PIEZA, ESTADOS_TABLERO } from '@/lib/constantes';
import { aNumero, eur, fkm, precioEditable } from '@/lib/formato';
import type { EstadoId, EstadoOrden, EstadoPieza, PropObservacion, PropPieza, PropTrabajo, Propuesta, ServicioTarifa } from '@/lib/tipos';

export interface OrdenMovil {
  id: string;
  matricula: string;
  modelo: string;
  estado: EstadoOrden;
  km: number;
  trabajos: { id: string; descripcion: string; precio: number | null; cantidad: number }[];
  piezas: { id: string; descripcion: string }[];
}

export const nuevaClave = () => Math.random().toString(36).slice(2, 10);

export function contarCambios(p: Propuesta): number {
  return p.trabajos.length + p.piezas.length + p.observaciones.length + (p.km ? 1 : 0) + (p.estado ? 1 : 0);
}

/** Si hay una línea a medias que no se puede guardar, lo dice (para no perderla sin avisar). */
export function problemaEdicion(p: Propuesta, tarifa: ServicioTarifa[]): string | null {
  if (p.trabajos.some((t) => !t.descripcion.trim() && !tarifa.some((s) => s.id === t.tarifaId) && t.precioManual !== null)) {
    return 'Hay un trabajo con precio pero sin descripción: escríbela o quítalo.';
  }
  if (p.piezas.some((x) => !x.descripcion.trim() && !x.piezaId && x.nota.trim())) {
    return 'Hay una pieza con nota pero sin decir qué pieza es: escríbelo o quítala.';
  }
  return null;
}

/** Quita líneas vacías antes de guardar. */
export function limpiarPropuesta(p: Propuesta, tarifa: ServicioTarifa[]): Propuesta {
  return {
    ...p,
    trabajos: p.trabajos
      .filter((t) => t.descripcion.trim() || t.tarifaId)
      .map((t) => {
        const s = tarifa.find((x) => x.id === t.tarifaId);
        return { ...t, descripcion: t.descripcion.trim() || s?.nombre || '', cantidad: s?.porUnidad ? Math.max(1, t.cantidad) : 1, precioManual: s ? null : t.precioManual };
      }),
    piezas: p.piezas.filter((x) => x.descripcion.trim() || x.piezaId),
    observaciones: p.observaciones.filter((x) => x.texto.trim()),
  };
}

function precioDe(t: PropTrabajo, tarifa: ServicioTarifa[]): number | null {
  const s = tarifa.find((x) => x.id === t.tarifaId);
  if (s) return s.precio * (s.porUnidad ? Math.max(1, t.cantidad) : 1);
  return t.precioManual;
}

interface Props {
  orden: OrdenMovil;
  tarifa: ServicioTarifa[];
  yoNombre: string;
  hora: string;
  propuesta: Propuesta;
  editando: boolean;
  guardando: boolean;
  aviso?: string;
  cambiar: (p: Propuesta) => void;
  corregir: () => void;
  terminarEdicion: () => void;
  cancelarEdicion: () => void;
  confirmar: () => void;
  descartar: () => void;
}

const CAJA_BASE = 'bg-rojo-50 border border-rojo-300 rounded-lg px-3 py-2.5 flex';
const CAJA = `${CAJA_BASE} flex-col gap-1`;
const CAJA_EDICION = `${CAJA_BASE} flex-col gap-2`;

export function Revision({
  orden, tarifa, yoNombre, hora, propuesta: p, editando, guardando, aviso, cambiar, corregir, terminarEdicion, cancelarEdicion, confirmar, descartar,
}: Props) {
  const n = contarCambios(p);
  const presentes = new Set<number>([
    ...p.trabajos.map((x) => x.n ?? 0), ...p.piezas.map((x) => x.n ?? 0), ...p.observaciones.map((x) => x.n ?? 0),
    ...(p.km && p.kmN ? [p.kmN] : []), ...(p.estado && p.estadoN ? [p.estadoN] : []),
  ]);
  const cambiarTrabajo = (t: PropTrabajo) => cambiar({ ...p, trabajos: p.trabajos.map((x) => (x.clave === t.clave ? t : x)) });
  const cambiarPieza = (x: PropPieza) => cambiar({ ...p, piezas: p.piezas.map((y) => (y.clave === x.clave ? x : y)) });
  const cambiarObs = (x: PropObservacion) => cambiar({ ...p, observaciones: p.observaciones.map((y) => (y.clave === x.clave ? x : y)) });

  return (
    <div className="fixed inset-0 bg-fondo z-30">
      <div className="h-full max-w-[520px] mx-auto flex flex-col sm:border-x sm:border-borde">
      <div className="pt-[max(16px,env(safe-area-inset-top))] px-5 pb-3.5 bg-white border-b border-borde">
        <div className="text-xs font-bold tracking-[.07em] uppercase text-rojo">{p.via === 'mano' ? 'Apuntar a mano' : 'Revisa antes de guardar'}</div>
        <div className="text-[21px] font-bold mt-1">{orden.matricula} · {orden.modelo}</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col gap-3">
        {aviso && <div className="text-[13px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">{aviso}</div>}

        {p.via !== 'mano' && p.texto && (
          <div className="bg-white border border-borde rounded-[14px] px-[18px] py-4 flex flex-col gap-2">
            <span className="titulo-seccion">Lo que he entendido</span>
            <div className="text-[17px] leading-[1.7]">
              {(p.segmentos.length ? p.segmentos : [{ t: p.texto, n: null }]).map((s, i) => {
                const marcado = s.n !== null && presentes.has(s.n);
                return (
                  <span key={i}>
                    <span style={{ background: marcado ? '#FEE2E2' : 'transparent', borderBottom: marcado ? '2px solid #B91C1C' : 'none', padding: '1px 0' }}>{s.t}</span>
                    {marcado && s.n !== null && <span className="inline-flex align-[2px] mx-[3px]"><Numero n={s.n} /></span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white border border-borde rounded-[14px] px-[18px] py-4 flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <span className="titulo-seccion">Ficha {orden.id}</span>
            <span className="text-xs font-bold text-rojo">{n === 1 ? '1 cambio' : `${n} cambios`}</span>
          </div>

          {(p.trabajos.length > 0 || editando) && (
            <Seccion titulo={p.trabajos.length === 1 ? 'Trabajo hecho' : 'Trabajos hechos'}>
              {orden.trabajos.map((t) => (
                <div key={t.id} className="flex justify-between gap-3 text-sm text-t2 px-2.5">
                  <span>{t.descripcion}{t.cantidad > 1 ? ` (${t.cantidad} uds.)` : ''}</span>
                  <span className="whitespace-nowrap">{t.precio === null ? 'Precio a poner' : eur(t.precio)}</span>
                </div>
              ))}
              {p.trabajos.map((t) => editando ? (
                <EditorTrabajo key={t.clave} t={t} tarifa={tarifa} cambiar={cambiarTrabajo} quitar={() => cambiar({ ...p, trabajos: p.trabajos.filter((x) => x.clave !== t.clave) })} />
              ) : (
                <VistaTrabajo key={t.clave} t={t} tarifa={tarifa} meta={`${yoNombre} · hoy ${hora}`} />
              ))}
            </Seccion>
          )}

          {(p.piezas.length > 0 || editando) && (
            <Seccion titulo="Piezas">
              {p.piezas.map((x) => editando ? (
                <EditorPieza key={x.clave} x={x} cambiar={cambiarPieza} quitar={() => cambiar({ ...p, piezas: p.piezas.filter((y) => y.clave !== x.clave) })} />
              ) : (
                <div key={x.clave} className={CAJA}>
                  <span className="text-[15px] font-semibold flex gap-1.5 items-start">{x.n ? <Numero n={x.n} /> : null}{x.descripcion}</span>
                  <span className="text-[13px] text-rojo-oscuro">
                    {x.piezaId ? 'Cambia a: ' : 'Nueva: '}{ESTADOS_PIEZA[x.estado]}{x.nota ? ` · ${x.nota}` : ''}
                  </span>
                </div>
              ))}
            </Seccion>
          )}

          {(p.observaciones.length > 0 || editando) && (
            <Seccion titulo="Observaciones y recomendaciones">
              {p.observaciones.map((x) => editando ? (
                <EditorObservacion key={x.clave} x={x} cambiar={cambiarObs} quitar={() => cambiar({ ...p, observaciones: p.observaciones.filter((y) => y.clave !== x.clave) })} />
              ) : (
                <div key={x.clave} className={CAJA}>
                  {x.recomendacion && <span className="text-[11px] font-bold text-rojo uppercase tracking-[.05em]">Recomendación · sale en el informe</span>}
                  <span className="text-[15px] leading-[1.45] flex gap-1.5 items-start">{x.n ? <Numero n={x.n} /> : null}<span>{x.texto}</span></span>
                  {(() => {
                    const s = tarifa.find((y) => y.id === x.tarifaId);
                    return s ? <span className="text-xs text-rojo-oscuro">Según tarifa: {s.nombre} · {eur(s.precio)}{s.porUnidad ? ' / ud.' : ''}</span> : null;
                  })()}
                </div>
              ))}
            </Seccion>
          )}

          {editando && (
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn btn-borde h-11 px-3 text-sm flex-1"
                onClick={() => cambiar({ ...p, trabajos: [...p.trabajos, { clave: nuevaClave(), descripcion: '', tarifaId: null, cantidad: 1, precioManual: null }] })}>+ Trabajo</button>
              <button type="button" className="btn btn-borde h-11 px-3 text-sm flex-1"
                onClick={() => cambiar({ ...p, piezas: [...p.piezas, { clave: nuevaClave(), piezaId: null, descripcion: '', estado: 'pendiente', nota: '' }] })}>+ Pieza</button>
              <button type="button" className="btn btn-borde h-11 px-3 text-sm flex-1"
                onClick={() => cambiar({ ...p, observaciones: [...p.observaciones, { clave: nuevaClave(), texto: '', recomendacion: false, tarifaId: null }] })}>+ Observación</button>
            </div>
          )}

          {(p.km || editando) && (
            <Seccion titulo="Kilómetros">
              <div className={`${CAJA_BASE} items-center gap-2.5 flex-wrap`}>
                {p.kmN && p.km ? <Numero n={p.kmN} /> : null}
                <span className="text-[15px] text-t2 line-through">{fkm(orden.km)}</span>
                <span className="text-[15px]">→</span>
                {editando
                  ? <EditorKm km={p.km} cambiar={(km) => cambiar({ ...p, km })} />
                  : <span className="text-[17px] font-bold">{p.km ? fkm(p.km) : 'Sin cambio'}</span>}
              </div>
              {p.km !== null && p.km < orden.km && (
                <span className="text-xs text-rojo font-semibold">Son menos kilómetros de los que ya había apuntados. Revísalo.</span>
              )}
            </Seccion>
          )}

          {(p.estado || editando) && (
            <Seccion titulo="Estado nuevo">
              <div className={CAJA_EDICION}>
                <div className="flex items-center gap-2 flex-wrap">
                  {p.estadoN && p.estado ? <Numero n={p.estadoN} /> : null}
                  <EstadoPill estado={orden.estado} />
                  <span>→</span>
                  {editando ? (
                    <select className="campo h-11 w-auto text-base" value={p.estado ?? ''} onChange={(e) => cambiar({ ...p, estado: (e.target.value || null) as EstadoId | null })}>
                      <option value="">Sin cambio</option>
                      {ESTADOS_TABLERO.filter((id) => id !== orden.estado).map((id) => <option key={id} value={id}>{ESTADOS[id].nombre}</option>)}
                    </select>
                  ) : p.estado ? <EstadoPill estado={p.estado} fuerte /> : null}
                </div>
                {!editando && p.estadoMotivo && <span className="text-xs text-rojo-oscuro">{p.estadoMotivo}</span>}
              </div>
            </Seccion>
          )}

          {!n && !editando && <span className="text-sm text-t2">No hay cambios. Pulsa «Corregir» para añadirlos.</span>}
        </div>
      </div>

      <div className="bg-white border-t border-borde px-4 pt-3 pb-[max(22px,env(safe-area-inset-bottom))] flex flex-col gap-2.5">
        {editando ? (
          <>
            <button type="button" className="btn btn-negro h-[60px] rounded-[14px] text-lg font-bold" onClick={terminarEdicion}>
              Listo, revisar de nuevo
            </button>
            <button type="button" className="h-11 text-base text-t2 font-semibold" onClick={cancelarEdicion}>
              {p.via === 'mano' ? 'Cancelar, no apuntar nada' : 'Cancelar los retoques'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-rojo h-[60px] rounded-[14px] text-lg font-bold" disabled={guardando || !n} onClick={confirmar}>
              {guardando ? 'Guardando…' : 'Confirmar'}
            </button>
            <div className="flex gap-2.5">
              <button type="button" className="flex-1 h-[54px] rounded-[14px] bg-white border-[1.5px] border-tinta text-[17px] font-semibold" disabled={guardando} onClick={corregir}>Corregir</button>
              <button type="button" className="flex-1 h-[54px] rounded-[14px] bg-white border-[1.5px] border-borde-2 text-t2 text-[17px] font-semibold" disabled={guardando} onClick={descartar}>Descartar</button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-t3">{titulo}</span>
      {children}
    </div>
  );
}

function VistaTrabajo({ t, tarifa, meta }: { t: PropTrabajo; tarifa: ServicioTarifa[]; meta: string }) {
  const s = tarifa.find((x) => x.id === t.tarifaId);
  const precio = precioDe(t, tarifa);
  return (
    <div className={CAJA}>
      <div className="flex justify-between gap-2.5">
        <span className="text-base font-semibold flex gap-1.5 items-start">
          {t.n ? <Numero n={t.n} /> : null}
          <span>{t.descripcion}{s?.porUnidad && t.cantidad > 1 ? ` (${t.cantidad} uds.)` : ''}</span>
        </span>
        {precio === null
          ? <span className="text-sm font-bold text-rojo whitespace-nowrap">Precio a poner</span>
          : <span className="text-base font-bold whitespace-nowrap">{eur(precio)}</span>}
      </div>
      <span className="text-xs text-rojo-oscuro">
        {meta} · {s ? 'precio de la tarifa' : precio !== null ? 'precio a mano' : 'no está en la tarifa: ponle precio en «Corregir»'}
      </span>
    </div>
  );
}

function EditorTrabajo({ t, tarifa, cambiar, quitar }: { t: PropTrabajo; tarifa: ServicioTarifa[]; cambiar: (t: PropTrabajo) => void; quitar: () => void }) {
  const [precioTexto, setPrecioTexto] = useState(precioEditable(t.precioManual));
  const [udsTexto, setUdsTexto] = useState(String(t.cantidad));
  const s = tarifa.find((x) => x.id === t.tarifaId);
  return (
    <div className={CAJA_EDICION}>
      <input className="campo h-11 text-base" value={t.descripcion} placeholder="Qué has hecho" onChange={(e) => cambiar({ ...t, descripcion: e.target.value })} />
      <div className="flex gap-2 items-end">
        <label className="etiqueta flex-1 min-w-0">Precio
          <select className="campo h-11 text-base" value={t.tarifaId ?? ''} onChange={(e) => {
            const nuevo = tarifa.find((x) => x.id === e.target.value);
            setUdsTexto('1');
            cambiar({ ...t, tarifaId: nuevo?.id ?? null, precioManual: nuevo ? null : aNumero(precioTexto), cantidad: 1, descripcion: t.descripcion || nuevo?.nombre || '' });
          }}>
            <option value="">A mano (no está en la tarifa)</option>
            {tarifa.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {eur(x.precio)}{x.porUnidad ? '/ud.' : ''}</option>)}
          </select>
        </label>
        {s?.porUnidad && (
          <label className="etiqueta w-16">Uds.
            <input className="campo h-11 text-base text-right" inputMode="numeric" value={udsTexto}
              onChange={(e) => {
                const limpio = e.target.value.replace(/\D/g, '').slice(0, 2);
                setUdsTexto(limpio);
                const n = Number.parseInt(limpio, 10);
                if (n > 0) cambiar({ ...t, cantidad: Math.min(50, n) });
              }}
              onBlur={() => setUdsTexto(String(t.cantidad))} />
          </label>
        )}
        {!s && (
          <label className="etiqueta w-[104px]">€
            <input className="campo h-11 text-base text-right" inputMode="decimal" placeholder="A poner" value={precioTexto}
              onChange={(e) => { setPrecioTexto(e.target.value); cambiar({ ...t, precioManual: aNumero(e.target.value) }); }} />
          </label>
        )}
      </div>
      <button type="button" className="self-end btn-texto text-sm text-rojo" onClick={quitar}>Quitar</button>
    </div>
  );
}

function EditorPieza({ x, cambiar, quitar }: { x: PropPieza; cambiar: (x: PropPieza) => void; quitar: () => void }) {
  return (
    <div className={CAJA_EDICION}>
      <input className="campo h-11 text-base" value={x.descripcion} readOnly={Boolean(x.piezaId)} placeholder="Qué pieza" onChange={(e) => cambiar({ ...x, descripcion: e.target.value })} />
      <div className="flex gap-2">
        <select className="campo h-11 flex-1 text-base" value={x.estado} onChange={(e) => cambiar({ ...x, estado: e.target.value as EstadoPieza })}>
          {(Object.entries(ESTADOS_PIEZA) as [EstadoPieza, string][]).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <input className="campo h-11 flex-1 text-base" value={x.nota} placeholder="Nota (opcional)" onChange={(e) => cambiar({ ...x, nota: e.target.value })} />
      </div>
      <button type="button" className="self-end btn-texto text-sm text-rojo" onClick={quitar}>Quitar</button>
    </div>
  );
}

function EditorObservacion({ x, cambiar, quitar }: { x: PropObservacion; cambiar: (x: PropObservacion) => void; quitar: () => void }) {
  return (
    <div className={CAJA_EDICION}>
      <textarea className="campo text-base" rows={3} value={x.texto} placeholder="Qué has visto o qué le recomiendas al cliente" onChange={(e) => cambiar({ ...x, texto: e.target.value })} />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-t3">
          <input type="checkbox" className="w-5 h-5 accent-rojo" checked={x.recomendacion} onChange={(e) => cambiar({ ...x, recomendacion: e.target.checked })} />
          Recomendación (sale en el informe)
        </label>
        <button type="button" className="btn-texto text-sm text-rojo" onClick={quitar}>Quitar</button>
      </div>
    </div>
  );
}

function EditorKm({ km, cambiar }: { km: number | null; cambiar: (km: number | null) => void }) {
  const [texto, setTexto] = useState(km ? String(km) : '');
  return (
    <input className="campo h-11 w-[130px] text-base" inputMode="numeric" placeholder="Sin cambio" value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = aNumero(e.target.value);
        cambiar(n && n > 0 ? Math.round(n) : null);
      }} />
  );
}
