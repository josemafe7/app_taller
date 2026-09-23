import { dbSesion, exigirVista } from '@/lib/sesion';
import { leerClientes, leerCoches, ordenesAbiertas } from '@/lib/datos';
import { ListaClientes } from '@/components/clientes/lista';

export const dynamic = 'force-dynamic';

export default async function LayoutClientes({ children }: { children: React.ReactNode }) {
  await exigirVista('clientes');
  const db = await dbSesion();
  const [todos, coches, abiertas] = await Promise.all([leerClientes(db), leerCoches(db), ordenesAbiertas(db)]);
  const dentro = new Set(abiertas.map((o) => o.cocheId));
  const clientes = todos.map((c) => {
    const suyos = coches.filter((v) => v.clienteId === c.id);
    return {
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      matriculas: suyos.map((v) => v.matricula),
      enTaller: suyos.some((v) => dentro.has(v.id)),
    };
  });
  return (
    <main className="px-4 sm:px-7 pt-6 pb-10 flex gap-4 items-start flex-wrap">
      <ListaClientes clientes={clientes} />
      <section className="flex-[1_1_560px] min-w-0 flex flex-col gap-3.5">{children}</section>
    </main>
  );
}
