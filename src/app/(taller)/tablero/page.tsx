import Link from 'next/link';
import { dbSesion, exigirVista } from '@/lib/sesion';
import { conCocheYCliente, ordenesAbiertas, pendientesDePersona } from '@/lib/datos';
import { DIAS_ALERTA, ESTADOS, ESTADOS_TABLERO, MECANICOS, nombrePersona } from '@/lib/constantes';
import { diasEnTaller, etiquetaDias, saludo } from '@/lib/fechas';
import { Iniciales, Matricula } from '@/components/ui';
import type { EstadoId, Orden } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

const esReciente = (o: Orden) => Boolean(o.ultimaIA && Date.now() - Date.parse(o.ultimaIA.cuando) < 24 * 3600_000);

export default async function PaginaTablero({ searchParams }: { searchParams: Promise<{ mecanico?: string }> }) {
  const yo = await exigirVista('tablero');
  const { mecanico } = await searchParams;
  const filtro = MECANICOS.some((m) => m.id === mecanico) ? mecanico! : 'todos';

  const db = await dbSesion();
  const [completas, pendientes] = await Promise.all([ordenesAbiertas(db).then((o) => conCocheYCliente(db, o)), pendientesDePersona(db)]);
  const abiertas = completas.map((c) => c.orden);
  const datos = new Map(completas.map((c) => [c.orden.id, c]));
  const datosDeOrden = (o: Orden) => datos.get(o.id)!;
  const visibles = filtro === 'todos' ? abiertas : abiertas.filter((o) => o.mecanicoId === filtro);
  const matriculas = (estado: EstadoId) =>
    abiertas.filter((o) => o.estado === estado).map((o) => datosDeOrden(o).coche.matricula).join(' · ') || 'Ninguno';

  const cifras = [
    { etiqueta: 'Coches dentro', valor: abiertas.length, color: '#1C1917', sub: MECANICOS.map((m) => `${m.nombre} ${abiertas.filter((o) => o.mecanicoId === m.id).length}`).join(' · '), href: '/tablero' },
    { etiqueta: 'Esperando pieza', valor: abiertas.filter((o) => o.estado === 'pieza').length, color: ESTADOS.pieza.c, sub: matriculas('pieza') },
    { etiqueta: 'Listos para recoger', valor: abiertas.filter((o) => o.estado === 'listo').length, color: ESTADOS.listo.c, sub: matriculas('listo') },
    { etiqueta: 'Necesitan a una persona', valor: pendientes, color: '#B91C1C', sub: 'conversaciones · abrir', href: '/conversaciones?filtro=persona' },
  ];

  const filtros = [{ id: 'todos', nombre: 'Todos' }, ...MECANICOS.map((m) => ({ id: m.id, nombre: m.nombre }))];

  return (
    <main className="px-4 sm:px-7 pt-6 pb-10 flex flex-col gap-5">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-[-.01em]">Tablero del taller</h1>
          <div className="text-t2 text-sm mt-1">{saludo()}, {yo.nombre}. {abiertas.length} coches en el taller.</div>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          <span className="text-[13px] text-t2 mr-1">Mecánico</span>
          {filtros.map((f) => {
            const on = f.id === filtro;
            return (
              <Link
                key={f.id}
                href={f.id === 'todos' ? '/tablero' : `/tablero?mecanico=${f.id}`}
                className="px-3.5 py-[7px] rounded-full border text-sm font-semibold"
                style={{ background: on ? '#1C1917' : '#fff', color: on ? '#fff' : '#1C1917', borderColor: on ? '#1C1917' : '#D6D3CE' }}
              >
                {f.nombre}
              </Link>
            );
          })}
          <Link href="/ordenes/nueva" className="btn btn-rojo h-[38px] px-4 text-sm ml-2">+ Nueva orden</Link>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
        {cifras.map((k) => {
          const contenido = (
            <>
              <span className="text-[13px] font-semibold text-t2">{k.etiqueta}</span>
              <span className="text-[40px] font-bold leading-[1.1] tabular-nums" style={{ color: k.color }}>{k.valor}</span>
              <span className="text-[13px] text-t2">{k.sub}</span>
            </>
          );
          const clases = 'text-left bg-white border border-borde rounded-[10px] px-[18px] py-3.5 flex flex-col gap-0.5';
          return k.href ? (
            <Link key={k.etiqueta} href={k.href} className={`${clases} hover:shadow-[0_3px_12px_rgba(28,25,23,.08)]`} style={{ borderTop: `4px solid ${k.color}` }}>
              {contenido}
            </Link>
          ) : (
            <div key={k.etiqueta} className={clases} style={{ borderTop: `4px solid ${k.color}` }}>{contenido}</div>
          );
        })}
      </div>

      <div className="overflow-x-auto pb-1.5">
        <div className="grid grid-cols-[repeat(5,minmax(240px,1fr))] gap-3 min-w-[1240px]">
          {ESTADOS_TABLERO.map((estado) => {
            const st = ESTADOS[estado];
            const tarjetas = visibles.filter((o) => o.estado === estado).sort((a, b) => a.entrada.localeCompare(b.entrada));
            return (
              <section key={estado} className="rounded-[10px] flex flex-col min-h-[440px]" style={{ background: st.bg, border: `1px solid ${st.bd}` }}>
                <div className="px-3.5 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${st.bd}` }}>
                  <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: st.c }} />
                  <span className="text-sm font-bold" style={{ color: st.c }}>{st.nombre}</span>
                  <span className="ml-auto text-[13px] font-bold bg-white rounded-full px-[9px] py-px" style={{ color: st.c, border: `1px solid ${st.bd}` }}>
                    {tarjetas.length}
                  </span>
                </div>
                <div className="p-2.5 flex flex-col gap-2">
                  {tarjetas.map((o) => {
                    const { coche, cliente } = datosDeOrden(o);
                    const dias = diasEnTaller(o.entrada);
                    const alerta = dias >= DIAS_ALERTA;
                    const mec = nombrePersona(o.mecanicoId);
                    return (
                      <Link
                        key={o.id}
                        href={`/ordenes/${o.id}`}
                        className="text-left bg-white border border-borde rounded-lg p-3 flex flex-col gap-[9px] w-full hover:border-t4 hover:shadow-[0_3px_10px_rgba(28,25,23,.08)]"
                      >
                        <div className="flex justify-between items-center gap-1.5">
                          <Matricula valor={coche.matricula} tam="md" />
                          {esReciente(o) && (
                            <span className="text-[11px] font-bold text-rojo bg-rojo-50 border border-rojo-200 rounded px-1.5 py-0.5">
                              {o.ultimaIA?.via === 'voz' ? 'Por voz' : 'Con IA'}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold leading-[1.3]">{coche.modelo}</div>
                          <div className="text-[13px] text-t2 mt-0.5">{cliente.nombreCorto}</div>
                        </div>
                        <div className="flex justify-between items-center border-t border-linea pt-2">
                          <span className="flex items-center gap-1.5 text-[13px] text-t3">
                            <Iniciales texto={mec[0]} />
                            {mec}
                          </span>
                          <span className="text-[13px]" style={{ color: alerta ? '#B91C1C' : '#57534E', fontWeight: alerta ? 700 : 500 }}>
                            {etiquetaDias(dias)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                  {!tarjetas.length && <div className="text-[13px] text-t4 py-3.5 px-1 text-center">Sin coches</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
