import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { cochesDe, conversacionDe, leerCliente, ordenesDeCoches } from '@/lib/datos';
import { cerradasRecientes, totalOrden } from '@/lib/calculos';
import { fmtFecha } from '@/lib/fechas';
import { eur, fkm } from '@/lib/formato';
import { EstadoPill, Matricula } from '@/components/ui';
import { DatosCliente, EditarCoche, NuevoCoche } from '@/components/clientes/ficha';

export const dynamic = 'force-dynamic';

export default async function PaginaCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirVista('clientes');
  const { id } = await params;
  const db = await dbSesion();
  const cliente = await leerCliente(db, decodeURIComponent(id));
  if (!cliente) notFound();
  const [coches, conversacion] = await Promise.all([cochesDe(db, cliente.id), conversacionDe(db, cliente.id)]);
  const ordenes = await ordenesDeCoches(db, coches.map((v) => v.id));
  const ordenAbiertaDe = (cocheId: string) => ordenes.find((o) => o.cocheId === cocheId && o.estado !== 'entregado');
  const historialDe = (cocheId: string) => cerradasRecientes(ordenes.filter((o) => o.cocheId === cocheId));
  const reparaciones = coches.reduce((n, v) => n + historialDe(v.id).length, 0);

  return (
    <>
      <DatosCliente
        key={cliente.id}
        cliente={cliente}
        resumen={`Cliente desde ${cliente.desde} · ${reparaciones === 1 ? '1 reparación anterior' : `${reparaciones} reparaciones anteriores`}`}
        conversacionId={conversacion?.id}
      />

      {coches.map((v) => {
        const orden = ordenAbiertaDe(v.id);
        const historial = historialDe(v.id);
        return (
          <div key={v.id} className="bg-white border border-borde rounded-xl px-6 py-5 flex flex-col gap-3.5">
            <div className="flex items-center gap-4 flex-wrap">
              <Matricula valor={v.matricula} tam="lg" />
              <div>
                <div className="text-[17px] font-bold">{v.modelo}</div>
                <div className="text-[13px] text-t2">{v.anio ?? 'Año sin apuntar'} · {v.combustible}</div>
              </div>
              <div className="ml-auto flex gap-2.5 items-center flex-wrap">
                {orden ? (
                  <>
                    <EstadoPill estado={orden.estado} />
                    <Link href={`/ordenes/${orden.id}`} className="btn btn-rojo h-9 px-3.5 text-sm">Abrir {orden.id}</Link>
                  </>
                ) : (
                  <Link href={`/ordenes/nueva?coche=${v.id}`} className="btn btn-borde h-9 px-3.5 text-sm">Abrir orden nueva</Link>
                )}
                <EditarCoche coche={v} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[620px] flex flex-col">
                <div className="grid grid-cols-[110px_90px_110px_minmax(0,1fr)_100px] gap-3 py-2 text-xs font-bold text-t2 uppercase tracking-[.05em] border-b border-borde">
                  <span>Fecha</span><span>Orden</span><span>Km</span><span>Trabajos</span><span className="text-right">Importe</span>
                </div>
                {historial.map((h) => (
                  <Link
                    key={h.id}
                    href={`/ordenes/${h.id}`}
                    className="grid grid-cols-[110px_90px_110px_minmax(0,1fr)_100px] gap-3 py-2.5 text-sm border-b border-linea hover:bg-papel"
                  >
                    <span>{fmtFecha(h.cierre ?? h.entrada)}</span>
                    <span className="font-mono text-t2">{h.id}</span>
                    <span>{fkm(h.km)}</span>
                    <span>{h.trabajos.map((t) => `${t.descripcion}${t.cantidad > 1 ? ` (${t.cantidad})` : ''}`).join(', ') || '—'}</span>
                    <span className="text-right tabular-nums font-semibold">{eur(totalOrden(h))}</span>
                  </Link>
                ))}
                {!historial.length && <div className="text-sm text-t4 py-3">Primera visita al taller.</div>}
              </div>
            </div>
          </div>
        );
      })}

      <NuevoCoche key={`nuevo-${cliente.id}`} clienteId={cliente.id} />
    </>
  );
}
