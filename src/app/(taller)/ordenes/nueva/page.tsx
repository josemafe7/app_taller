import Link from 'next/link';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { leerCita, leerClientes, leerCoches, ordenesAbiertas } from '@/lib/datos';
import { claveMatricula } from '@/lib/formato';
import { MECANICOS } from '@/lib/constantes';
import { fmtDiaLargo, horaCorta } from '@/lib/fechas';
import { FormNuevaOrden, type Prerrelleno } from '@/components/orden/nueva-orden';

export const dynamic = 'force-dynamic';

export default async function PaginaNuevaOrden({ searchParams }: { searchParams: Promise<{ coche?: string; cita?: string }> }) {
  await exigirVista('tablero');
  const { coche: cocheId, cita: citaId } = await searchParams;
  const db = await dbSesion();
  const [todos, coches, abiertas] = await Promise.all([leerClientes(db), leerCoches(db), ordenesAbiertas(db)]);
  const ordenAbiertaDe = (cocheId: string) => abiertas.find((o) => o.cocheId === cocheId);
  const cochePorMatricula = (m: string) => coches.find((v) => claveMatricula(v.matricula) === claveMatricula(m));

  const clientes = todos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    coches: coches.filter((v) => v.clienteId === c.id).map((v) => ({
      id: v.id, matricula: v.matricula, modelo: v.modelo, dentro: ordenAbiertaDe(v.id)?.id ?? null,
    })),
  }));

  let pre: Prerrelleno = {};
  let titulo = 'Nueva orden de trabajo';
  const cita = citaId ? await leerCita(db, citaId) : undefined;
  if (cita) {
    titulo = `Recibir coche de la cita del ${fmtDiaLargo(cita.fecha)} · ${horaCorta(cita.hora)}`;
    const existente = cochePorMatricula(cita.matricula);
    pre = existente
      ? { clienteId: existente.clienteId, cocheId: existente.id, motivo: cita.motivo, citaId: cita.id }
      : cita.clienteId
        ? { clienteId: cita.clienteId, nuevoCoche: { matricula: cita.matricula, modelo: cita.coche === '—' ? '' : cita.coche }, motivo: cita.motivo, citaId: cita.id }
        : {
          nuevoCliente: { nombre: cita.nombre, telefono: cita.telefono },
          nuevoCoche: { matricula: cita.matricula, modelo: cita.coche === '—' ? '' : cita.coche },
          motivo: cita.motivo, citaId: cita.id,
        };
  } else if (cocheId) {
    const v = coches.find((x) => x.id === cocheId);
    if (v) pre = { clienteId: v.clienteId, cocheId: v.id };
  }

  return (
    <main className="px-4 sm:px-7 pt-5 pb-12 flex flex-col gap-4 max-w-[860px] w-full mx-auto">
      <Link href="/tablero" className="self-start text-t2 text-sm font-semibold py-1 hover:text-tinta">‹ Volver al tablero</Link>
      <div>
        <h1 className="m-0 text-[26px] font-bold">{titulo}</h1>
        <div className="text-t2 text-sm mt-1">El coche entra en el tablero como «Recibido». Todo lo que se haga después queda en su historial.</div>
      </div>
      <FormNuevaOrden
        key={`${cocheId ?? ""}-${citaId ?? ""}`}
        clientes={clientes}
        mecanicos={MECANICOS.map((m) => ({ id: m.id, nombre: m.nombreCompleto }))}
        pre={pre}
      />
    </main>
  );
}
