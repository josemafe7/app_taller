import { Suspense } from 'react';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { conversacionesBandeja } from '@/lib/datos';
import { fmtLista } from '@/lib/fechas';
import { iniciales } from '@/lib/formato';
import { ListaConversaciones, type ConversacionFila } from '@/components/conversaciones/lista';

export const dynamic = 'force-dynamic';

export default async function LayoutConversaciones({ children }: { children: React.ReactNode }) {
  await exigirVista('conversaciones');
  const filas: ConversacionFila[] = (await conversacionesBandeja(await dbSesion())).map((c) => {
    const ultimo = c.mensajes.at(-1);
    const prefijo = ultimo?.de === 'ia' ? 'IA: ' : ultimo?.de === 'persona' ? `${ultimo.autor ?? 'Taller'}: ` : '';
    return {
      id: c.id,
      nombre: c.nombre,
      iniciales: iniciales(c.nombre),
      canal: c.canal,
      hora: fmtLista(c.actualizada),
      modo: c.modo,
      necesita: c.necesitaPersona,
      motivo: c.motivo ?? '',
      vista: `${prefijo}${ultimo?.texto ?? ''}`,
      pensando: Boolean(c.iaPensando),
      prueba: Boolean(c.prueba),
    };
  });
  return (
    <main className="pantalla-completa grid grid-cols-[minmax(220px,320px)_minmax(340px,1fr)_minmax(220px,300px)] flex-1 min-h-[560px] overflow-x-auto">
      <Suspense>
        <ListaConversaciones filas={filas} />
      </Suspense>
      {children}
    </main>
  );
}
