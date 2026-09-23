import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { cochesDe, leerCliente, leerConversacion, ordenesDeCoches } from '@/lib/datos';
import { totalOrden } from '@/lib/calculos';
import { nombrePersona } from '@/lib/constantes';
import { fmtMensaje } from '@/lib/fechas';
import { eur } from '@/lib/formato';
import { EstadoPill, Matricula, TituloSeccion } from '@/components/ui';
import { PanelConversacion } from '@/components/conversaciones/panel';

export const dynamic = 'force-dynamic';

export default async function PaginaConversacion({ params }: { params: Promise<{ id: string }> }) {
  const yo = await exigirVista('conversaciones');
  const { id } = await params;
  const db = await dbSesion();
  const c = await leerConversacion(db, decodeURIComponent(id));
  if (!c) notFound();
  const cliente = c.clienteId ? await leerCliente(db, c.clienteId) : undefined;
  const coches = cliente ? await cochesDe(db, cliente.id) : [];
  const abiertas = (await ordenesDeCoches(db, coches.map((v) => v.id))).filter((o) => o.estado !== 'entregado');
  const ordenAbiertaDe = (cocheId: string) => abiertas.find((o) => o.cocheId === cocheId);

  return (
    <>
      <PanelConversacion
        key={c.id}
        yo={yo.nombre}
        conversacion={{
          id: c.id,
          nombre: c.nombre,
          canal: c.canal,
          contacto: cliente?.telefono ?? c.contacto ?? 'Sin ficha de cliente',
          modo: c.modo,
          necesita: c.necesitaPersona,
          motivo: c.motivo ?? '',
          pensando: Boolean(c.iaPensando),
          prueba: Boolean(c.prueba),
          mensajes: c.mensajes.map((m) => ({
            id: m.id,
            de: m.de,
            texto: m.texto,
            hora: fmtMensaje(m.cuando),
            quien: m.de === 'cliente' ? c.nombre : m.de === 'ia' ? 'IA · asistente' : (m.autor ?? 'Taller'),
          })),
        }}
      />

      <aside className="border-l border-borde bg-white overflow-y-auto p-[18px] flex flex-col gap-3.5">
        {cliente ? (
          <>
            <div className="flex flex-col gap-[5px]">
              <TituloSeccion className="mb-1">Cliente</TituloSeccion>
              <div className="text-[17px] font-bold">{cliente.nombre}</div>
              <div className="text-[15px] font-mono font-medium">{cliente.telefono}</div>
              <div className="text-[13px] text-t2 break-all">{cliente.email}</div>
              <Link href={`/clientes/${cliente.id}`} className="self-start mt-1.5 btn btn-borde h-[34px] px-3 text-[13px]">Ver ficha</Link>
            </div>
            {coches.map((v) => {
              const o = ordenAbiertaDe(v.id);
              return (
                <div key={v.id} className="border border-borde rounded-[10px] p-3.5 flex flex-col gap-2">
                  <Matricula valor={v.matricula} tam="sm" className="self-start" />
                  <div className="text-sm font-semibold">{v.modelo}</div>
                  {o ? (
                    <>
                      <span className="self-start"><EstadoPill estado={o.estado} tam="sm" /></span>
                      <div className="text-[13px] text-t3 leading-[1.4]">{o.id} · {nombrePersona(o.mecanicoId)} · {eur(totalOrden(o))} hasta ahora</div>
                      <Link href={`/ordenes/${o.id}`} className="btn btn-rojo h-9 text-sm">Abrir orden</Link>
                    </>
                  ) : (
                    <div className="text-[13px] text-t2">No está en el taller</div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <>
            <TituloSeccion>Contacto nuevo</TituloSeccion>
            <div className="text-sm leading-normal text-t3">
              Todavía no tiene ficha de cliente. La IA le pide nombre, teléfono y matrícula al reservar la cita.
            </div>
            {c.contacto && <div className="text-sm font-mono">{c.contacto}</div>}
            <Link href={`/clientes/nuevo?conversacion=${c.id}`} className="self-start btn btn-borde h-9 px-3 text-sm">Crear ficha de cliente</Link>
          </>
        )}
      </aside>
    </>
  );
}
