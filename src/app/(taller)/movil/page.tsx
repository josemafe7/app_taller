import Link from 'next/link';
import { dbSesion, personaObligatoria } from '@/lib/sesion';
import { conCocheYCliente, ordenesAbiertas } from '@/lib/datos';
import { diasEnTaller, etiquetaDias, fmtDiaLargo, hoy } from '@/lib/fechas';
import { EstadoPill, Matricula } from '@/components/ui';
import type { EstadoOrden } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

const PRIORIDAD: Record<EstadoOrden, number> = { reparacion: 0, diagnostico: 1, recibido: 2, pieza: 3, listo: 4, entregado: 5 };

export default async function MisCoches() {
  const yo = await personaObligatoria();
  const db = await dbSesion();
  const mias = (await conCocheYCliente(db, (await ordenesAbiertas(db)).filter((o) => o.mecanicoId === yo.id)))
    .sort((a, b) => PRIORIDAD[a.orden.estado] - PRIORIDAD[b.orden.estado] || a.orden.entrada.localeCompare(b.orden.entrada));
  const fecha = fmtDiaLargo(hoy());

  return (
    <div className="px-4 pt-3 pb-8 flex flex-col gap-3">
      <div className="px-1 pt-2 pb-1">
        <div className="text-sm text-t2">{fecha[0].toUpperCase() + fecha.slice(1)}</div>
        <div className="text-[32px] font-bold leading-[1.15]">Mis coches</div>
        <div className="text-[15px] text-t2 mt-0.5">{mias.length === 1 ? '1 coche asignado' : `${mias.length} coches asignados`}</div>
      </div>
      {mias.map(({ orden: o, coche }) => {
        return (
          <Link key={o.id} href={`/movil/${o.id}`} className="text-left bg-white border border-borde rounded-[14px] p-4 flex flex-col gap-2.5 w-full">
            <div className="flex justify-between items-center">
              <Matricula valor={coche.matricula} tam="movil" />
              <span className="text-[30px] text-t5 leading-none">›</span>
            </div>
            <div className="text-[17px] font-bold">{coche.modelo}</div>
            <div className="text-[15px] text-t3 leading-[1.4]">{o.motivo}</div>
            <div className="flex justify-between items-center">
              <EstadoPill estado={o.estado} tam="movil" />
              <span className="text-sm text-t2">{etiquetaDias(diasEnTaller(o.entrada))}</span>
            </div>
          </Link>
        );
      })}
      {!mias.length && (
        <div className="bg-white border border-borde rounded-[14px] p-4 text-[15px] text-t2">Ahora mismo no tienes coches asignados.</div>
      )}
    </div>
  );
}
