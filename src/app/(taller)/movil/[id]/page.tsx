import { redirect } from 'next/navigation';
import { dbSesion, personaObligatoria } from '@/lib/sesion';
import { datosDeOrden, leerOrden, leerTarifa } from '@/lib/datos';
import { totalOrden } from '@/lib/calculos';
import { diasEnTaller, etiquetaDias } from '@/lib/fechas';
import { fkm } from '@/lib/formato';
import { vistaObservacion, vistaPieza, vistaTrabajo } from '@/lib/vistas';
import { iaConfigurada } from '@/lib/ia/openrouter';
import { FichaMovil } from '@/components/movil/ficha-movil';

export const dynamic = 'force-dynamic';

export default async function PaginaFichaMovil({ params }: { params: Promise<{ id: string }> }) {
  const yo = await personaObligatoria();
  const { id } = await params;
  const db = await dbSesion();
  const o = await leerOrden(db, decodeURIComponent(id));
  // Cada mecánico solo ve sus coches (la base de datos tampoco le deja ver otros).
  if (!o || o.mecanicoId !== yo.id || o.estado === 'entregado') redirect('/movil');
  const [{ coche, cliente }, tarifa] = await Promise.all([datosDeOrden(db, o), leerTarifa(db)]);

  return (
    <FichaMovil
      key={o.id}
      yo={{ nombre: yo.nombre }}
      tarifa={tarifa}
      iaLista={iaConfigurada()}
      orden={{
        id: o.id,
        matricula: coche.matricula,
        modelo: coche.modelo,
        estado: o.estado,
        km: o.km,
        kmTexto: fkm(o.km),
        dias: etiquetaDias(diasEnTaller(o.entrada)),
        cliente: cliente.nombreCorto,
        motivo: o.motivo,
        total: totalOrden(o),
        trabajos: o.trabajos.map(vistaTrabajo),
        piezas: o.piezas.map(vistaPieza),
        observaciones: o.observaciones.map((x) => vistaObservacion(x, tarifa)),
      }}
    />
  );
}
