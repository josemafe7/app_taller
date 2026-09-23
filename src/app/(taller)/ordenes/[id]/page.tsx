import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { conversacionDe, datosDeOrden, leerOrden, leerTarifa } from '@/lib/datos';
import { totalOrden, trabajosSinPrecio } from '@/lib/calculos';
import { MECANICOS, PERSONAS, persona } from '@/lib/constantes';
import { diasEnTaller, etiquetaDias, fmtFecha, fmtSello } from '@/lib/fechas';
import { eur, fkm } from '@/lib/formato';
import { vistaObservacion, vistaPieza, vistaTrabajo } from '@/lib/vistas';
import { EstadoPill, Matricula, TituloSeccion } from '@/components/ui';
import { Trabajos } from '@/components/orden/trabajos';
import { Piezas } from '@/components/orden/piezas';
import { Observaciones } from '@/components/orden/observaciones';
import { CerrarOrden, DatosOrden, Motivo, ReabrirOrden, SelectorEstado } from '@/components/orden/ficha';
import type { EstadoId } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export default async function PaginaOrden({ params }: { params: Promise<{ id: string }> }) {
  await exigirVista('tablero');
  const { id } = await params;
  const db = await dbSesion();
  const o = await leerOrden(db, decodeURIComponent(id));
  if (!o) notFound();
  const [{ coche, cliente }, tarifa] = await Promise.all([datosDeOrden(db, o), leerTarifa(db)]);
  const conversacion = await conversacionDe(db, cliente.id);
  const cerrada = o.estado === 'entregado';
  const sinPrecio = trabajosSinPrecio(o);
  const mecanico = persona(o.mecanicoId);
  const personas = PERSONAS.map((p) => ({ id: p.id, nombre: p.nombre }));
  const mecanicos = MECANICOS.map((p) => ({ id: p.id, nombre: p.nombre }));
  const diasTexto = cerrada ? `Entregado el ${fmtFecha(o.cierre ?? o.entrada)}` : etiquetaDias(diasEnTaller(o.entrada));
  const historial = [...o.historial].reverse();

  return (
    <main key={o.id} className="px-4 sm:px-7 pt-5 pb-12 flex flex-col gap-4 max-w-[1320px] w-full mx-auto">
      <Link href="/tablero" className="self-start text-t2 text-sm font-semibold py-1 hover:text-tinta">‹ Volver al tablero</Link>

      {cerrada && (
        <div className="bg-white border border-borde-2 rounded-[10px] px-5 py-3 flex items-center gap-3 flex-wrap text-sm">
          <span className="font-semibold">Orden cerrada: el coche se entregó el {fmtFecha(o.cierre ?? o.entrada)}.</span>
          <span className="text-t2">Se puede consultar y sacar el informe. Para cambiarla, reábrela.</span>
          <span className="ml-auto"><ReabrirOrden ordenId={o.id} /></span>
        </div>
      )}

      <div className="bg-white border border-borde rounded-xl px-6 py-5 flex items-center gap-[22px] flex-wrap">
        <Matricula valor={coche.matricula} tam="xl" />
        <div className="flex flex-col gap-1 min-w-[220px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-sm font-semibold text-t2">{o.id}</span>
            <EstadoPill estado={o.estado} />
          </div>
          <div className="text-[22px] font-bold">{coche.modelo}</div>
          <div className="text-sm text-t2">{coche.anio ?? 'Año sin apuntar'} · {coche.combustible} · {fkm(o.km)}</div>
        </div>
        <div className="ml-auto flex gap-2.5 items-end flex-wrap">
          {!cerrada && <SelectorEstado ordenId={o.id} estado={o.estado as EstadoId} />}
          <Link href={`/ordenes/${o.id}/informe`} className="btn btn-rojo h-[42px] px-5 text-[15px]">Generar informe</Link>
        </div>
      </div>

      <div className="flex gap-4 items-start flex-wrap">
        <div className="flex-[2_1_560px] min-w-0 flex flex-col gap-3.5">
          <Motivo ordenId={o.id} motivo={o.motivo} soloLectura={cerrada} />
          <Trabajos
            ordenId={o.id}
            trabajos={o.trabajos.map(vistaTrabajo)}
            tarifa={tarifa}
            personas={personas}
            mecanicoId={o.mecanicoId}
            soloLectura={cerrada}
          />
          <Piezas ordenId={o.id} piezas={o.piezas.map(vistaPieza)} soloLectura={cerrada} />
          <Observaciones ordenId={o.id} observaciones={o.observaciones.map((x) => vistaObservacion(x, tarifa))} soloLectura={cerrada} />
        </div>

        <aside className="flex-[1_1_300px] min-w-[280px] flex flex-col gap-3.5">
          <div className="tarjeta px-5 py-[18px] flex flex-col gap-1.5">
            <TituloSeccion className="mb-1">Cliente</TituloSeccion>
            <div className="text-[17px] font-bold">{cliente.nombre}</div>
            {cliente.contacto && <div className="text-sm text-t2">Contacto: {cliente.contacto}</div>}
            <div className="text-[15px] font-mono font-medium">{cliente.telefono}</div>
            <div className="text-sm text-t2 break-all">{cliente.email}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Link href={`/clientes/${cliente.id}`} className="btn btn-borde h-9 px-3 text-sm">Ver ficha</Link>
              {conversacion && <Link href={`/conversaciones/${conversacion.id}`} className="btn btn-borde h-9 px-3 text-sm">Conversación</Link>}
            </div>
          </div>

          <DatosOrden
            ordenId={o.id}
            km={o.km}
            mecanicoId={o.mecanicoId}
            mecanicoNombre={mecanico?.nombreCompleto ?? '—'}
            diasTexto={diasTexto}
            mecanicos={mecanicos}
            soloLectura={cerrada}
          />

          <div className="bg-tinta text-white rounded-[10px] px-5 py-[18px] flex flex-col gap-1">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold">{cerrada ? 'Total' : 'Total hasta ahora'}</span>
              <span className="text-[28px] font-bold tabular-nums">{eur(totalOrden(o))}</span>
            </div>
            {sinPrecio > 0 && (
              <span className="text-[13px] text-t6">
                Sin contar {sinPrecio === 1 ? '1 trabajo con precio a poner' : `${sinPrecio} trabajos con precio a poner`}.
              </span>
            )}
            <span className="text-xs text-t5">IVA incluido</span>
          </div>

          {!cerrada && <CerrarOrden ordenId={o.id} listo={o.estado === 'listo'} sinPrecio={sinPrecio} />}

          <div className="tarjeta px-5 py-[18px] flex flex-col gap-3">
            <TituloSeccion>Historial</TituloSeccion>
            {historial.map((h) => (
              <div key={h.id} className="grid grid-cols-[12px_1fr] gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full mt-[5px]" style={{ background: h.ia || /IA|voz/.test(h.quien) ? '#B91C1C' : '#A8A29E' }} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-t2"><b className="text-tinta">{h.quien}</b> · {fmtSello(h.cuando)}</span>
                  <span className="text-sm leading-[1.4]">{h.texto}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
