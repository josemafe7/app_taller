import { notFound } from 'next/navigation';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { datosDeOrden, leerOrden, leerTarifa } from '@/lib/datos';
import { servicioDe, totalOrden, trabajosSinPrecio } from '@/lib/calculos';
import { ESTADOS, ESTADOS_PIEZA, nombrePersona, persona, TALLER } from '@/lib/constantes';
import { diasEnTaller, etiquetaDias, fmtFecha, fmtFechaNumerica, fmtSello, hoy } from '@/lib/fechas';
import { fkm } from '@/lib/formato';
import { firmaInforme } from '@/lib/ia/informe';
import { iaConfigurada } from '@/lib/ia/openrouter';
import { VistaInforme, type DatosInforme } from '@/components/informe/vista';

export const dynamic = 'force-dynamic';

export default async function PaginaInforme({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }>;
}) {
  await exigirVista('tablero');
  const { id } = await params;
  const { v } = await searchParams;
  const version = v === 'interno' ? 'interno' : 'cliente';
  const db = await dbSesion();
  const o = await leerOrden(db, decodeURIComponent(id));
  if (!o) notFound();
  const [{ coche, cliente }, tarifa] = await Promise.all([datosDeOrden(db, o), leerTarifa(db)]);
  const cerrada = o.estado === 'entregado';

  const datos: DatosInforme = {
    ordenId: o.id,
    fecha: fmtFechaNumerica(cerrada ? (o.cierre ?? hoy()) : hoy()),
    taller: TALLER,
    cliente: { nombre: cliente.nombre, telefono: cliente.telefono, email: cliente.email },
    vehiculo: { modelo: coche.modelo, matricula: coche.matricula, anio: coche.anio, km: fkm(o.km) },
    motivo: o.motivo,
    mecanico: persona(o.mecanicoId)?.nombreCompleto ?? '—',
    estado: ESTADOS[o.estado].nombre,
    entrada: fmtFecha(o.entrada),
    estancia: cerrada ? `Entregado el ${fmtFecha(o.cierre ?? o.entrada)}` : etiquetaDias(diasEnTaller(o.entrada)),
    trabajos: o.trabajos.map((t) => ({
      id: t.id, descripcion: t.descripcion, precio: t.precio, cantidad: t.cantidad, origen: t.origen,
      quien: nombrePersona(t.hechoPor), cuando: fmtSello(t.cuando),
    })),
    total: totalOrden(o),
    sinPrecio: trabajosSinPrecio(o),
    recomendaciones: o.observaciones.filter((x) => x.recomendacion).map((x) => {
      const s = servicioDe(tarifa, x.tarifaId);
      return { id: x.id, texto: x.texto, tarifa: s ? { nombre: s.nombre, precio: s.precio, porUnidad: s.porUnidad } : null };
    }),
    observaciones: o.observaciones.map((x) => ({ id: x.id, texto: x.texto, recomendacion: x.recomendacion, quien: nombrePersona(x.quien) })),
    piezas: o.piezas.map((p) => ({ id: p.id, descripcion: p.descripcion, estado: `${ESTADOS_PIEZA[p.estado]}${p.nota ? ` · ${p.nota}` : ''}` })),
    historial: [...o.historial].reverse().map((e) => ({ id: e.id, quien: e.quien, cuando: fmtSello(e.cuando), texto: e.texto })),
    informeCliente: o.informes.cliente ?? null,
    informeInterno: o.informes.interno ?? null,
    firmaActual: firmaInforme(o),
  };

  return <VistaInforme key={`${o.id}-${version}`} version={version} datos={datos} iaLista={iaConfigurada()} />;
}
