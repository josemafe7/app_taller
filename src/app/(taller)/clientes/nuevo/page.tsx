import { cabeceraConversacion } from '@/lib/datos';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { NuevoClienteFormulario } from '@/components/clientes/ficha';

export const dynamic = 'force-dynamic';

export default async function PaginaNuevoCliente({ searchParams }: { searchParams: Promise<{ conversacion?: string }> }) {
  await exigirVista('clientes');
  const { conversacion } = await searchParams;
  const cv = conversacion ? await cabeceraConversacion(await dbSesion(), conversacion) : undefined;
  const desdeConversacion = cv && !cv.clienteId ? cv : undefined;
  return (
    <>
      {desdeConversacion && (
        <div className="text-sm text-t3 bg-white border border-borde rounded-xl px-6 py-3">
          Ficha para la conversación con <b>{desdeConversacion.nombre}</b> ({desdeConversacion.canal}). Al darla de alta quedan enlazadas.
        </div>
      )}
      <NuevoClienteFormulario
        conversacionId={desdeConversacion?.id}
        nombreInicial={desdeConversacion && !desdeConversacion.nombre.startsWith('Visitante web') ? desdeConversacion.nombre : ''}
        contactoInicial={desdeConversacion?.contacto ?? ''}
      />
    </>
  );
}
