import { redirect } from 'next/navigation';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { leerClientes } from '@/lib/datos';

export const dynamic = 'force-dynamic';

export default async function PaginaClientes() {
  await exigirVista('clientes');
  const [primero] = await leerClientes(await dbSesion());
  if (primero) redirect(`/clientes/${primero.id}`);
  redirect('/clientes/nuevo');
}
