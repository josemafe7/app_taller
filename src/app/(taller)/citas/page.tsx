import Link from 'next/link';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { citasEntre, cochesPorIds, ordenesAbiertas } from '@/lib/datos';
import { claveMatricula } from '@/lib/formato';
import { HUECOS } from '@/lib/constantes';
import { DIAS, diaSemana, esLaborable, fmtDiaCorto, fmtSemana, hoy, lunesDe, sumarDias } from '@/lib/fechas';
import { SemanaCitas, type CitaVista, type DiaVista } from '@/components/citas/semana';

export const dynamic = 'force-dynamic';

export default async function PaginaCitas({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  await exigirVista('citas');
  const { semana } = await searchParams;
  const hoyDia = hoy();
  const base = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : esLaborable(hoyDia) ? hoyDia : sumarDias(hoyDia, 2);
  const lunes = lunesDe(base);
  const lunesActual = lunesDe(esLaborable(hoyDia) ? hoyDia : sumarDias(hoyDia, 2));
  const fechas = [0, 1, 2, 3, 4].map((i) => sumarDias(lunes, i));

  const dias: DiaVista[] = fechas.map((f) => {
    const nombre = DIAS[diaSemana(f)];
    return { fecha: f, nombre: nombre[0].toUpperCase() + nombre.slice(1), corta: fmtDiaCorto(f), esHoy: f === hoyDia, pasado: f < hoyDia };
  });

  const db = await dbSesion();
  const [semanaCitas, abiertas] = await Promise.all([citasEntre(db, fechas[0], fechas[4]), ordenesAbiertas(db)]);
  const cochesDentro = await cochesPorIds(db, abiertas.map((o) => o.cocheId));
  const citas: CitaVista[] = semanaCitas
    .map((c) => {
      const coche = cochesDentro.find((v) => claveMatricula(v.matricula) === claveMatricula(c.matricula));
      const abierta = coche ? abiertas.find((o) => o.cocheId === coche.id) : undefined;
      return {
        id: c.id, fecha: c.fecha, hora: c.hora, nombre: c.nombre, telefono: c.telefono, matricula: c.matricula, coche: c.coche,
        motivo: c.motivo, origen: c.origen, ordenId: abierta?.id ?? null, conversacionId: c.conversacionId ?? null,
      };
    });

  return (
    <main className="px-4 sm:px-7 pt-6 pb-10 flex flex-col gap-[18px]">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="m-0 text-[26px] font-bold">Citas</h1>
          <div className="text-t2 text-sm mt-1">{fmtSemana(lunes)} · {HUECOS.length} huecos de entrada cada mañana</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/citas?semana=${sumarDias(lunes, -7)}`} className="btn btn-borde h-9 px-3 text-sm" aria-label="Semana anterior">‹</Link>
          {lunes !== lunesActual && <Link href="/citas" className="btn btn-borde h-9 px-3 text-sm">Esta semana</Link>}
          <Link href={`/citas?semana=${sumarDias(lunes, 7)}`} className="btn btn-borde h-9 px-3 text-sm" aria-label="Semana siguiente">›</Link>
          <span className="text-[15px] font-semibold ml-2">{citas.length} de {HUECOS.length * 5} huecos ocupados</span>
        </div>
      </div>
      <SemanaCitas key={lunes} dias={dias} huecos={HUECOS} citas={citas} />
    </main>
  );
}
