import { redirect } from 'next/navigation';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { conversacionesBandeja } from '@/lib/datos';

export const dynamic = 'force-dynamic';

export default async function PaginaConversaciones({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await exigirVista('conversaciones');
  const { filtro } = await searchParams;
  const lista = await conversacionesBandeja(await dbSesion());
  const primera = (filtro === 'persona' ? lista.find((c) => c.necesitaPersona) : undefined) ?? lista[0];
  if (!primera) {
    return (
      <section className="col-span-2 flex items-center justify-center text-t2 text-sm">Todavía no hay conversaciones.</section>
    );
  }
  redirect(`/conversaciones/${primera.id}${filtro === 'persona' ? '?filtro=persona' : ''}`);
}
