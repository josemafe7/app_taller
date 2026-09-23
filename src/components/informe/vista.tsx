'use client';

// Informe de la orden: versión para el cliente (sin jerga) e interna.
// Los textos los redacta la IA; los importes salen siempre de la ficha.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { guardarInformeAccion } from '@/app/acciones';
import { useAccion, useAvisos } from '@/components/avisos';
import { eur } from '@/lib/formato';
import type { InformeCliente, InformeInterno } from '@/lib/tipos';

export interface DatosInforme {
  ordenId: string;
  fecha: string;
  taller: { nombre: string; lema: string; direccion: string; cp: string; telefono: string; email: string; garantia: string };
  cliente: { nombre: string; telefono: string; email: string };
  vehiculo: { modelo: string; matricula: string; anio: number | null; km: string };
  motivo: string;
  mecanico: string;
  estado: string;
  entrada: string;
  estancia: string;
  trabajos: { id: string; descripcion: string; precio: number | null; cantidad: number; origen: 'tarifa' | 'mano'; quien: string; cuando: string }[];
  total: number;
  sinPrecio: number;
  recomendaciones: { id: string; texto: string; tarifa: { nombre: string; precio: number; porUnidad: boolean } | null }[];
  observaciones: { id: string; texto: string; recomendacion: boolean; quien: string }[];
  piezas: { id: string; descripcion: string; estado: string }[];
  historial: { id: string; quien: string; cuando: string; texto: string }[];
  informeCliente: InformeCliente | null;
  informeInterno: InformeInterno | null;
  firmaActual: string;
}

const Etiqueta = ({ children, roja = false }: { children: ReactNode; roja?: boolean }) => (
  <span className={`text-[11px] font-bold tracking-[.08em] uppercase ${roja ? 'text-rojo' : 'text-t2'}`}>{children}</span>
);

export function VistaInforme({ version, datos, iaLista }: { version: 'cliente' | 'interno'; datos: DatosInforme; iaLista: boolean }) {
  const router = useRouter();
  const avisar = useAvisos();
  const { pendiente: guardando, ejecutar } = useAccion();
  const informe = version === 'cliente' ? datos.informeCliente : datos.informeInterno;
  const [pidiendo, setPidiendo] = useState(false);
  const [refrescando, iniciarRefresco] = useTransition();
  const redactando = pidiendo || refrescando;
  const [editando, setEditando] = useState(false);
  const pedido = useRef(false);

  // Borradores de edición a mano
  const [resumen, setResumen] = useState('');
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [recs, setRecs] = useState<Record<string, string>>({});
  const [puntos, setPuntos] = useState('');

  const redactar = useCallback(async () => {
    setPidiendo(true);
    try {
      const r = await fetch(`/api/ordenes/${datos.ordenId}/informe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) avisar(j.error ?? 'No se ha podido redactar el informe.');
      iniciarRefresco(() => router.refresh());
    } catch {
      avisar('No se ha podido redactar el informe. Revisa la conexión.');
    } finally {
      setPidiendo(false);
    }
  }, [avisar, datos.ordenId, router, version]);

  useEffect(() => {
    if (!informe && !pedido.current) {
      pedido.current = true;
      void redactar();
    }
  }, [informe, redactar]);

  const empezarEdicion = () => {
    if (version === 'cliente') {
      const inf = datos.informeCliente;
      setResumen(inf?.resumen ?? '');
      setTextos(Object.fromEntries(datos.trabajos.map((t) => [t.id, inf?.trabajos[t.id] ?? t.descripcion])));
      setRecs(Object.fromEntries(datos.recomendaciones.map((r) => [r.id, inf?.recomendaciones[r.id] ?? r.texto])));
    } else {
      const inf = datos.informeInterno;
      setResumen(inf?.resumen ?? '');
      setPuntos((inf?.puntos ?? []).join('\n'));
    }
    setEditando(true);
  };

  const guardarEdicion = () => ejecutar(
    () => guardarInformeAccion(datos.ordenId, version, version === 'cliente'
      ? { resumen, trabajos: textos, recomendaciones: recs }
      : { resumen, puntos: puntos.split('\n') }),
    (r) => r.ok && setEditando(false),
  );

  const imprimir = (pdf: boolean) => {
    if (pdf) avisar('En la ventana que se abre, elige «Guardar como PDF» como impresora.');
    const titulo = document.title;
    document.title = `Informe ${datos.ordenId}${version === 'interno' ? ' (interno)' : ''} - ${datos.cliente.nombre}`;
    window.addEventListener('afterprint', () => { document.title = titulo; }, { once: true });
    window.setTimeout(() => window.print(), pdf ? 400 : 50);
  };

  const viejo = Boolean(informe && informe.firma !== datos.firmaActual);
  const segmento = (v: 'cliente' | 'interno', texto: string) => (
    <Link
      href={`/ordenes/${datos.ordenId}/informe${v === 'interno' ? '?v=interno' : ''}`}
      replace
      className="px-3.5 py-[7px] rounded-md text-sm font-semibold"
      style={{ background: version === v ? '#fff' : 'transparent', color: version === v ? '#1C1917' : '#57534E' }}
    >
      {texto}
    </Link>
  );

  return (
    <main className="fondo-informe px-4 sm:px-7 pt-6 pb-14 flex flex-col items-center gap-4 bg-gris flex-1">
      <div className="no-imprimir w-full max-w-[820px] flex gap-2.5 items-center flex-wrap">
        <Link href={`/ordenes/${datos.ordenId}`} className="text-t3 text-sm font-semibold py-1 hover:text-tinta">‹ Volver a la orden</Link>
        <div className="flex gap-1 bg-suave rounded-lg p-[3px] border border-borde-3 ml-2">
          {segmento('cliente', 'Para el cliente')}
          {segmento('interno', 'Interno')}
        </div>
        <span className="ml-auto" />
        {editando ? (
          <>
            <button type="button" className="btn btn-borde h-10 px-4 text-sm border-borde-3" onClick={() => setEditando(false)}>Cancelar</button>
            <button type="button" className="btn btn-negro h-10 px-4 text-sm" disabled={guardando} onClick={guardarEdicion}>Guardar texto</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-borde h-10 px-4 text-sm border-borde-3" disabled={redactando} onClick={() => void redactar()}>
              {redactando ? 'Redactando…' : iaLista ? 'Volver a redactar con IA' : 'Volver a preparar'}
            </button>
            <button type="button" className="btn btn-borde h-10 px-4 text-sm border-borde-3" disabled={redactando || !informe} onClick={empezarEdicion}>Editar texto</button>
            <button type="button" className="btn btn-borde h-10 px-4 text-sm border-borde-3" onClick={() => imprimir(false)}>Imprimir</button>
            <button type="button" className="btn btn-rojo h-10 px-4 text-sm" onClick={() => imprimir(true)}>Guardar en PDF</button>
          </>
        )}
      </div>

      {(informe?.aviso || viejo || datos.sinPrecio > 0) && (
        <div className="no-imprimir w-full max-w-[820px] flex flex-col gap-1.5">
          {informe?.aviso && <Nota>{informe.aviso}</Nota>}
          {viejo && <Nota>La orden ha cambiado desde que se redactó este texto. Pulsa «Volver a redactar» para ponerlo al día.</Nota>}
          {datos.sinPrecio > 0 && (
            <Nota>
              {datos.sinPrecio === 1 ? 'Hay un trabajo' : `Hay ${datos.sinPrecio} trabajos`} con el precio sin poner: no {datos.sinPrecio === 1 ? 'suma' : 'suman'} en el total. Ponlo en la ficha de la orden.
            </Nota>
          )}
        </div>
      )}

      <article className="hoja-informe w-full max-w-[820px] bg-white shadow-[0_1px_3px_rgba(0,0,0,.08),0_12px_32px_rgba(0,0,0,.08)] px-6 py-10 sm:px-[60px] sm:py-[52px] flex flex-col gap-7">
        <div className="flex justify-between gap-6 flex-wrap border-b-[3px] border-rojo pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-[52px] h-[52px] bg-rojo rounded-md text-white font-bold text-xl flex items-center justify-center">TR</div>
            <div>
              <div className="text-[22px] font-bold">{datos.taller.nombre}</div>
              <div className="text-[13px] text-t2">{datos.taller.lema}</div>
            </div>
          </div>
          <div className="text-xs text-t3 leading-[1.6] text-right">
            {datos.taller.direccion}<br />{datos.taller.cp}<br />{datos.taller.telefono} · {datos.taller.email}
          </div>
        </div>

        <div className="flex justify-between items-end gap-4 flex-wrap">
          <h1 className="m-0 text-[28px] font-bold">{version === 'cliente' ? 'Informe de reparación' : 'Informe interno'}</h1>
          <div className="text-[13px] text-t3 text-right leading-[1.6]">
            Orden <b className="font-mono">{datos.ordenId}</b><br />Fecha {datos.fecha}
          </div>
        </div>

        {version === 'interno' && (
          <span className="self-start -mt-3 text-[11px] font-bold uppercase tracking-[.08em] text-rojo border border-rojo-200 bg-rojo-50 rounded px-2 py-1">
            Uso interno · no entregar al cliente
          </span>
        )}

        <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          <div className="flex flex-col gap-1">
            <Etiqueta>Cliente</Etiqueta>
            <span className="text-base font-bold">{datos.cliente.nombre}</span>
            <span className="text-sm">{datos.cliente.telefono}</span>
            <span className="text-sm text-t3">{datos.cliente.email}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Etiqueta>Vehículo</Etiqueta>
            <span className="text-base font-bold">{datos.vehiculo.modelo}</span>
            <span className="text-sm">Matrícula <b className="font-mono">{datos.vehiculo.matricula}</b>{datos.vehiculo.anio ? ` · ${datos.vehiculo.anio}` : ''}</span>
            <span className="text-sm text-t3">{datos.vehiculo.km}</span>
          </div>
          {version === 'interno' && (
            <div className="flex flex-col gap-1">
              <Etiqueta>Orden</Etiqueta>
              <span className="text-base font-bold">{datos.estado}</span>
              <span className="text-sm">Entrada: {datos.entrada} · {datos.estancia}</span>
              <span className="text-sm text-t3">Mecánico: {datos.mecanico}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Etiqueta>Motivo de entrada</Etiqueta>
          <span className="text-[15px] leading-normal">{datos.motivo}</span>
        </div>

        <Resumen
          titulo={version === 'cliente' ? 'Qué le hemos hecho a tu coche' : 'Resumen técnico'}
          texto={informe?.resumen ?? ''}
          redactando={redactando}
          editando={editando}
          valor={resumen}
          cambiar={setResumen}
        />

        <div className="flex flex-col">
          <div className="flex justify-between pb-2 border-b-[1.5px] border-tinta text-[11px] font-bold tracking-[.08em] uppercase text-t2">
            <span>Trabajos realizados</span><span>Importe</span>
          </div>
          {datos.trabajos.map((t) => {
            const textoCliente = datos.informeCliente?.trabajos[t.id];
            return (
              <div key={t.id} className="flex justify-between gap-4 py-2.5 border-b border-gris text-[15px]">
                <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                  {version === 'cliente' ? (
                    editando ? (
                      <input className="campo" value={textos[t.id] ?? ''} onChange={(e) => setTextos((x) => ({ ...x, [t.id]: e.target.value }))} />
                    ) : (
                      <span>{textoCliente ?? `${t.descripcion}${t.cantidad > 1 ? ` (${t.cantidad} uds.)` : ''}`}</span>
                    )
                  ) : (
                    <>
                      <span>{t.descripcion}{t.cantidad > 1 ? ` (${t.cantidad} uds.)` : ''}</span>
                      <span className="text-xs text-t2">{t.quien} · {t.cuando} · {t.origen === 'tarifa' ? 'Tarifa' : 'Precio a mano'}</span>
                    </>
                  )}
                </span>
                <span className="tabular-nums whitespace-nowrap">
                  {t.precio === null ? <span className="text-rojo font-semibold">{version === 'cliente' ? 'Pendiente' : 'Precio a poner'}</span> : eur(t.precio)}
                </span>
              </div>
            );
          })}
          {!datos.trabajos.length && <div className="py-2.5 text-sm text-t2 border-b border-gris">Sin trabajos realizados todavía.</div>}
          <div className="flex justify-end gap-8 pt-3.5 items-baseline">
            <span className="text-[15px] font-semibold">Total</span>
            <span className="text-2xl font-bold tabular-nums">{eur(datos.total)}</span>
          </div>
          <div className="text-right text-xs text-t2 mt-0.5">IVA incluido{datos.sinPrecio > 0 ? ` · sin contar ${datos.sinPrecio === 1 ? '1 trabajo pendiente' : `${datos.sinPrecio} trabajos pendientes`} de precio` : ''}</div>
        </div>

        {version === 'cliente' && datos.recomendaciones.length > 0 && (
          <div className="flex flex-col gap-2 bg-papel border border-gris rounded-md px-[18px] py-4">
            <Etiqueta roja>Recomendaciones del taller</Etiqueta>
            {datos.recomendaciones.map((r) => (
              <div key={r.id} className="flex flex-col gap-0.5">
                {editando ? (
                  <textarea className="campo" rows={2} value={recs[r.id] ?? ''} onChange={(e) => setRecs((x) => ({ ...x, [r.id]: e.target.value }))} />
                ) : (
                  <span className="text-[15px] leading-normal">{datos.informeCliente?.recomendaciones[r.id] ?? r.texto}</span>
                )}
                {r.tarifa && (
                  <span className="text-[13px] text-t3">Precio según nuestra tarifa: {eur(r.tarifa.precio)}{r.tarifa.porUnidad ? ' por unidad' : ''} ({r.tarifa.nombre.toLowerCase()}).</span>
                )}
              </div>
            ))}
          </div>
        )}

        {version === 'interno' && (
          <>
            <Bloque titulo="Piezas">
              {datos.piezas.length ? datos.piezas.map((p) => (
                <div key={p.id} className="flex justify-between gap-4 py-2 border-b border-gris text-sm"><span>{p.descripcion}</span><span className="text-t3">{p.estado}</span></div>
              )) : <span className="text-sm text-t2">Ninguna.</span>}
            </Bloque>
            <Bloque titulo="Observaciones">
              {datos.observaciones.length ? datos.observaciones.map((o) => (
                <div key={o.id} className="py-2 border-b border-gris text-sm flex flex-col gap-0.5">
                  {o.recomendacion && <span className="text-[11px] font-bold text-rojo uppercase tracking-[.05em]">Recomendación · sale en el informe del cliente</span>}
                  <span>{o.texto}</span>
                  <span className="text-xs text-t2">{o.quien}</span>
                </div>
              )) : <span className="text-sm text-t2">Ninguna.</span>}
            </Bloque>
            <Bloque titulo="Puntos a vigilar">
              {editando ? (
                <textarea className="campo" rows={4} value={puntos} onChange={(e) => setPuntos(e.target.value)} placeholder="Un punto por línea" />
              ) : datos.informeInterno?.puntos.length ? (
                <ul className="m-0 pl-5 flex flex-col gap-1 text-sm">{datos.informeInterno.puntos.map((p, i) => <li key={i}>{p}</li>)}</ul>
              ) : (
                <span className="text-sm text-t2">{redactando ? 'Redactando…' : 'Nada pendiente.'}</span>
              )}
            </Bloque>
            <Bloque titulo="Historial">
              {datos.historial.map((h) => (
                <div key={h.id} className="text-[13px] py-1 border-b border-gris"><b>{h.quien}</b> · <span className="text-t2">{h.cuando}</span> — {h.texto}</div>
              ))}
            </Bloque>
          </>
        )}

        <div className="flex justify-between gap-6 flex-wrap border-t border-gris pt-[18px] text-xs text-t3 leading-[1.6]">
          <span>Mecánico responsable: <b>{datos.mecanico}</b></span>
          <span className="max-w-[420px] text-right">
            {version === 'cliente'
              ? `${datos.taller.garantia} Gracias por confiar en ${datos.taller.nombre}.`
              : 'Documento interno del taller. Importes con IVA incluido.'}
          </span>
        </div>
      </article>
    </main>
  );
}

function Resumen({ titulo, texto, redactando, editando, valor, cambiar }: {
  titulo: string; texto: string; redactando: boolean; editando: boolean; valor: string; cambiar: (v: string) => void;
}) {
  if (!editando && !redactando && !texto) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Etiqueta>{titulo}</Etiqueta>
      {editando ? (
        <textarea className="campo" rows={3} value={valor} onChange={(e) => cambiar(e.target.value)} placeholder="Opcional" />
      ) : redactando && !texto ? (
        <span className="no-imprimir text-[15px] text-t4 flex items-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-gris border-t-rojo inline-block animate-[trspin_.8s_linear_infinite]" />
          Redactando con IA…
        </span>
      ) : (
        <span className="text-[15px] leading-normal">{texto}</span>
      )}
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Etiqueta>{titulo}</Etiqueta>
      {children}
    </div>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <div className="text-[13px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">{children}</div>;
}
