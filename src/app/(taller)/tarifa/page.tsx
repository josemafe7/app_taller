import { dbSesion, exigirVista } from '@/lib/sesion';
import { leerTarifa } from '@/lib/datos';
import { TablaTarifa } from '@/components/tarifa/tabla';

export const dynamic = 'force-dynamic';

export default async function PaginaTarifa() {
  await exigirVista('tarifa');
  return (
    <main className="px-4 sm:px-7 pt-6 pb-10 max-w-[1040px] w-full mx-auto flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-[26px] font-bold">Tarifa</h1>
        <div className="text-t2 text-sm mt-1">
          Precios en euros, IVA incluido. Se usan al apuntar trabajos (a mano o con la IA) y los consulta el asistente cuando un cliente pregunta.
        </div>
      </div>
      <TablaTarifa servicios={await leerTarifa(await dbSesion())} />
    </main>
  );
}
