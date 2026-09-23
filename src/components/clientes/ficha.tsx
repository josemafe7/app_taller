'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { guardarClienteAccion, guardarCocheAccion } from '@/app/acciones';
import { useAccion } from '@/components/avisos';
import { TituloSeccion } from '@/components/ui';
import { COMBUSTIBLES } from '@/lib/constantes';
import type { Cliente, Coche } from '@/lib/tipos';

export function DatosCliente({ cliente, resumen, conversacionId }: { cliente: Cliente; resumen: string; conversacionId?: string }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <div className="bg-white border border-borde rounded-xl px-6 py-5">
        <FormCliente cliente={cliente} alGuardar={() => setEditando(false)} alCancelar={() => setEditando(false)} />
      </div>
    );
  }
  return (
    <div className="bg-white border border-borde rounded-xl px-6 py-5 flex justify-between gap-4 flex-wrap items-start">
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 text-2xl font-bold">{cliente.nombre}</h2>
        {cliente.contacto && <span className="text-sm text-t2">Contacto: {cliente.contacto}</span>}
        <div className="flex gap-4 flex-wrap text-[15px]">
          <span className="font-mono font-medium">{cliente.telefono || 'Sin teléfono'}</span>
          <span className="text-t2">{cliente.email}</span>
        </div>
        <span className="text-[13px] text-t2">{resumen}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-borde h-10 px-4 text-sm" onClick={() => setEditando(true)}>Editar datos</button>
        {conversacionId && <Link href={`/conversaciones/${conversacionId}`} className="btn btn-borde h-10 px-4 text-sm">Ver conversación</Link>}
      </div>
    </div>
  );
}

export function FormCliente({ cliente, conversacionId, alGuardar, alCancelar, nombreInicial = '', contactoInicial = '' }: {
  cliente?: Cliente; conversacionId?: string; alGuardar?: (id: string) => void; alCancelar?: () => void;
  nombreInicial?: string; contactoInicial?: string;
}) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? nombreInicial);
  const [nombreCorto, setNombreCorto] = useState(cliente?.nombreCorto ?? '');
  const [contacto, setContacto] = useState(cliente?.contacto ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? (/@/.test(contactoInicial) ? '' : contactoInicial));
  const [email, setEmail] = useState(cliente?.email ?? (/@/.test(contactoInicial) ? contactoInicial : ''));
  const { pendiente, ejecutar } = useAccion();

  const guardar = () => ejecutar(
    () => guardarClienteAccion({ id: cliente?.id, nombre, nombreCorto, contacto, telefono, email, conversacionId }),
    (r) => { if (r.ok) alGuardar?.(r.id ?? cliente?.id ?? ''); },
  );

  return (
    <div className="flex flex-col gap-3">
      <TituloSeccion>{cliente ? 'Editar cliente' : 'Nuevo cliente'}</TituloSeccion>
      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2">
        <label className="etiqueta sm:col-span-2">Nombre y apellidos o empresa
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="etiqueta">Cómo le llamamos
          <input className="campo" value={nombreCorto} onChange={(e) => setNombreCorto(e.target.value)} placeholder="Se rellena solo si lo dejas vacío" />
        </label>
        <label className="etiqueta">Persona de contacto (empresas)
          <input className="campo" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Opcional" />
        </label>
        <label className="etiqueta">Teléfono
          <input className="campo" value={telefono} inputMode="tel" onChange={(e) => setTelefono(e.target.value)} placeholder="600 000 000" />
        </label>
        <label className="etiqueta">Email
          <input className="campo" value={email} inputMode="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-rojo h-10 px-5 text-sm" disabled={pendiente} onClick={guardar}>
          {cliente ? 'Guardar cambios' : 'Dar de alta'}
        </button>
        {alCancelar && <button type="button" className="btn btn-borde h-10 px-4 text-sm" onClick={alCancelar}>Cancelar</button>}
      </div>
    </div>
  );
}

export function NuevoClienteFormulario({ conversacionId, nombreInicial, contactoInicial }: {
  conversacionId?: string; nombreInicial?: string; contactoInicial?: string;
}) {
  const router = useRouter();
  return (
    <div className="bg-white border border-borde rounded-xl px-6 py-5">
      <FormCliente
        conversacionId={conversacionId}
        nombreInicial={nombreInicial}
        contactoInicial={contactoInicial}
        alGuardar={(id) => id && router.push(`/clientes/${id}`)}
      />
    </div>
  );
}

function CamposCoche({ matricula, setMatricula, modelo, setModelo, anio, setAnio, combustible, setCombustible }: {
  matricula: string; setMatricula: (v: string) => void; modelo: string; setModelo: (v: string) => void;
  anio: string; setAnio: (v: string) => void; combustible: string; setCombustible: (v: string) => void;
}) {
  return (
    <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
      <label className="etiqueta">Matrícula
        <input className="campo font-mono uppercase" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="1234 ABC" />
      </label>
      <label className="etiqueta col-span-2 sm:col-span-3">Marca y modelo
        <input className="campo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Seat León 1.5 TSI" />
      </label>
      <label className="etiqueta">Año
        <input className="campo" value={anio} inputMode="numeric" onChange={(e) => setAnio(e.target.value.replace(/\D/g, '').slice(0, 4))} />
      </label>
      <label className="etiqueta">Combustible
        <select className="campo" value={combustible} onChange={(e) => setCombustible(e.target.value)}>
          {COMBUSTIBLES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
    </div>
  );
}

export function EditarCoche({ coche }: { coche: Coche }) {
  const [abierto, setAbierto] = useState(false);
  const [matricula, setMatricula] = useState(coche.matricula);
  const [modelo, setModelo] = useState(coche.modelo);
  const [anio, setAnio] = useState(coche.anio ? String(coche.anio) : '');
  const [combustible, setCombustible] = useState(coche.combustible);
  const { pendiente, ejecutar } = useAccion();

  const abrir = () => {
    setMatricula(coche.matricula);
    setModelo(coche.modelo);
    setAnio(coche.anio ? String(coche.anio) : '');
    setCombustible(coche.combustible);
    setAbierto(true);
  };

  if (!abierto) {
    return <button type="button" className="btn-texto text-[13px] hover:underline" onClick={abrir}>Editar coche</button>;
  }
  return (
    <div className="basis-full flex flex-col gap-2.5 bg-papel border border-borde rounded-lg p-3">
      <CamposCoche {...{ matricula, setMatricula, modelo, setModelo, anio, setAnio, combustible, setCombustible }} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-negro h-9 px-4 text-sm" disabled={pendiente}
          onClick={() => ejecutar(
            () => guardarCocheAccion({ id: coche.id, clienteId: coche.clienteId, matricula, modelo, anio: Number.parseInt(anio, 10) || null, combustible }),
            (r) => r.ok && setAbierto(false),
          )}>Guardar</button>
        <button type="button" className="btn btn-borde h-9 px-3 text-sm" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </div>
  );
}

export function NuevoCoche({ clienteId }: { clienteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [matricula, setMatricula] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [combustible, setCombustible] = useState('Gasolina');
  const { pendiente, ejecutar } = useAccion();

  if (!abierto) {
    return (
      <button type="button" className="self-start btn btn-borde h-10 px-4 text-sm" onClick={() => setAbierto(true)}>+ Añadir coche</button>
    );
  }
  return (
    <div className="bg-white border border-borde rounded-xl px-6 py-5 flex flex-col gap-3">
      <TituloSeccion>Añadir coche</TituloSeccion>
      <CamposCoche {...{ matricula, setMatricula, modelo, setModelo, anio, setAnio, combustible, setCombustible }} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-rojo h-10 px-5 text-sm" disabled={pendiente}
          onClick={() => ejecutar(
            () => guardarCocheAccion({ clienteId, matricula, modelo, anio: Number.parseInt(anio, 10) || null, combustible }),
            (r) => {
              if (r.ok) {
                setAbierto(false);
                setMatricula('');
                setModelo('');
                setAnio('');
              }
            },
          )}>Añadir coche</button>
        <button type="button" className="btn btn-borde h-10 px-4 text-sm" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </div>
  );
}
