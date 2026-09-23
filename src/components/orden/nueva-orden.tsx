'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { abrirOrdenAccion } from '@/app/acciones';
import { useAccion } from '@/components/avisos';
import { TituloSeccion } from '@/components/ui';
import { COMBUSTIBLES } from '@/lib/constantes';
import type { PersonaId } from '@/lib/tipos';

interface ClienteOpcion {
  id: string;
  nombre: string;
  coches: { id: string; matricula: string; modelo: string; dentro: string | null }[];
}

export interface Prerrelleno {
  clienteId?: string;
  cocheId?: string;
  nuevoCliente?: { nombre: string; telefono: string };
  nuevoCoche?: { matricula: string; modelo: string };
  motivo?: string;
  citaId?: string;
}

export function FormNuevaOrden({ clientes, mecanicos, pre }: {
  clientes: ClienteOpcion[]; mecanicos: { id: PersonaId; nombre: string }[]; pre: Prerrelleno;
}) {
  const router = useRouter();
  const { pendiente, ejecutar } = useAccion();

  const [clienteNuevo, setClienteNuevo] = useState(Boolean(pre.nuevoCliente));
  const [clienteId, setClienteId] = useState(pre.clienteId ?? '');
  const [nombre, setNombre] = useState(pre.nuevoCliente?.nombre ?? '');
  const [telefono, setTelefono] = useState(pre.nuevoCliente?.telefono ?? '');
  const [email, setEmail] = useState('');

  const [cocheNuevo, setCocheNuevo] = useState(Boolean(pre.nuevoCoche) || Boolean(pre.nuevoCliente));
  const [cocheId, setCocheId] = useState(pre.cocheId ?? '');
  const [matricula, setMatricula] = useState(pre.nuevoCoche?.matricula ?? '');
  const [modelo, setModelo] = useState(pre.nuevoCoche?.modelo ?? '');
  const [anio, setAnio] = useState('');
  const [combustible, setCombustible] = useState('Gasolina');

  const [motivo, setMotivo] = useState(pre.motivo ?? '');
  const [km, setKm] = useState('');
  const [mecanicoId, setMecanicoId] = useState<PersonaId>(mecanicos[0]?.id ?? 'javi');

  const cliente = clientes.find((c) => c.id === clienteId);
  const coches = cliente?.coches ?? [];

  const elegirCliente = (id: string) => {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    const libre = c?.coches.find((v) => !v.dentro);
    setCocheId(libre?.id ?? '');
    setCocheNuevo(!c?.coches.length);
  };

  const enviar = () => {
    ejecutar(
      () => abrirOrdenAccion({
        cocheId: !clienteNuevo && !cocheNuevo ? cocheId || undefined : undefined,
        clienteId: clienteNuevo ? undefined : clienteId || undefined,
        nuevoCliente: clienteNuevo ? { nombre, telefono, email } : undefined,
        nuevoCoche: clienteNuevo || cocheNuevo ? { matricula, modelo, anio: Number.parseInt(anio, 10) || null, combustible } : undefined,
        motivo,
        km,
        mecanicoId,
        citaId: pre.citaId,
      }),
      (r) => {
        if (r.ok && r.id) router.push(`/ordenes/${r.id}`);
      },
    );
  };

  const pestaña = (activa: boolean) =>
    `flex-1 border-none rounded-md px-2 py-[7px] text-[13px] font-semibold ${activa ? 'bg-white text-tinta shadow-sm' : 'bg-transparent text-t2'}`;

  return (
    <div className="flex flex-col gap-3.5">
      <section className="tarjeta px-5 py-[18px] flex flex-col gap-3">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <TituloSeccion>Cliente</TituloSeccion>
          <div className="flex gap-1 bg-suave rounded-lg p-[3px] min-w-[260px]">
            <button type="button" className={pestaña(!clienteNuevo)} onClick={() => setClienteNuevo(false)}>Ya es cliente</button>
            <button type="button" className={pestaña(clienteNuevo)} onClick={() => { setClienteNuevo(true); setCocheNuevo(true); }}>Cliente nuevo</button>
          </div>
        </div>
        {clienteNuevo ? (
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
            <label className="etiqueta sm:col-span-3">Nombre y apellidos o empresa
              <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="etiqueta">Teléfono
              <input className="campo" value={telefono} inputMode="tel" onChange={(e) => setTelefono(e.target.value)} placeholder="600 000 000" />
            </label>
            <label className="etiqueta sm:col-span-2">Email
              <input className="campo" value={email} inputMode="email" onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" />
            </label>
          </div>
        ) : (
          <label className="etiqueta">Cliente
            <select className="campo" value={clienteId} onChange={(e) => elegirCliente(e.target.value)}>
              <option value="">Elegir cliente…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
      </section>

      <section className="tarjeta px-5 py-[18px] flex flex-col gap-3">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <TituloSeccion>Coche</TituloSeccion>
          {!clienteNuevo && (
            <div className="flex gap-1 bg-suave rounded-lg p-[3px] min-w-[260px]">
              <button type="button" className={pestaña(!cocheNuevo)} onClick={() => setCocheNuevo(false)} disabled={!coches.length}>De su ficha</button>
              <button type="button" className={pestaña(cocheNuevo)} onClick={() => setCocheNuevo(true)}>Coche nuevo</button>
            </div>
          )}
        </div>
        {!clienteNuevo && !cocheNuevo ? (
          <div className="flex flex-col gap-2">
            {!cliente && <span className="text-sm text-t4">Elige primero el cliente.</span>}
            {coches.map((v) => (
              <label key={v.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 ${v.dentro ? 'opacity-60' : ''}`}
                style={{ borderColor: cocheId === v.id ? '#B91C1C' : '#E4E1DC', background: cocheId === v.id ? '#FEF2F2' : '#fff' }}>
                <input type="radio" name="coche" className="accent-rojo" checked={cocheId === v.id} disabled={Boolean(v.dentro)} onChange={() => setCocheId(v.id)} />
                <span className="font-mono font-bold">{v.matricula}</span>
                <span className="text-sm">{v.modelo}</span>
                {v.dentro && <span className="ml-auto text-xs font-semibold text-t2">Ya está en el taller ({v.dentro})</span>}
              </label>
            ))}
          </div>
        ) : (
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
            <label className="etiqueta">Matrícula
              <input className="campo font-mono uppercase" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="1234 ABC" />
            </label>
            <label className="etiqueta col-span-2 sm:col-span-3">Marca y modelo
              <input className="campo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Seat León 1.5 TSI" />
            </label>
            <label className="etiqueta">Año
              <input className="campo" value={anio} inputMode="numeric" onChange={(e) => setAnio(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2019" />
            </label>
            <label className="etiqueta">Combustible
              <select className="campo" value={combustible} onChange={(e) => setCombustible(e.target.value)}>
                {COMBUSTIBLES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="tarjeta px-5 py-[18px] flex flex-col gap-3">
        <TituloSeccion>Entrada en el taller</TituloSeccion>
        <label className="etiqueta">Motivo de entrada
          <textarea className="campo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Qué le pasa o qué quiere el cliente" />
        </label>
        <div className="grid gap-2.5 grid-cols-2">
          <label className="etiqueta">Kilómetros
            <input className="campo" value={km} inputMode="numeric" onChange={(e) => setKm(e.target.value)} placeholder="84.120" />
          </label>
          <label className="etiqueta">Mecánico
            <select className="campo" value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value as PersonaId)}>
              {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link href="/tablero" className="btn btn-borde h-[46px] px-5 text-[15px]">Cancelar</Link>
        <button type="button" className="btn btn-rojo h-[46px] px-6 text-[15px]" disabled={pendiente} onClick={enviar}>
          {pendiente ? 'Abriendo…' : 'Abrir orden'}
        </button>
      </div>
    </div>
  );
}
