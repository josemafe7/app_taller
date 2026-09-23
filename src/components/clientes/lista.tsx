'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';

interface ClienteFila {
  id: string;
  nombre: string;
  telefono: string;
  matriculas: string[];
  enTaller: boolean;
}

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');

export function ListaClientes({ clientes }: { clientes: ClienteFila[] }) {
  const seleccionado = useSelectedLayoutSegment();
  const [busqueda, setBusqueda] = useState('');
  const q = normal(busqueda);
  const visibles = q ? clientes.filter((c) => normal(`${c.nombre} ${c.telefono} ${c.matriculas.join(' ')}`).includes(q)) : clientes;

  return (
    <aside className="flex-[0_1_320px] min-w-[260px] w-full sm:w-auto bg-white border border-borde rounded-xl overflow-hidden">
      <div className="p-3.5 border-b border-borde flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <h1 className="m-0 text-xl font-bold">Clientes</h1>
          <span className="text-[13px] text-t2">{clientes.length}</span>
        </div>
        <input className="campo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, teléfono o matrícula" />
        <Link href="/clientes/nuevo" className="btn btn-borde h-9 text-sm">+ Nuevo cliente</Link>
      </div>
      <div className="max-h-[calc(100dvh-300px)] overflow-y-auto">
        {visibles.map((c) => {
          const on = c.id === seleccionado;
          return (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="w-full text-left px-3.5 py-3 border-b border-linea flex flex-col gap-[3px]"
              style={{ background: on ? '#FEF2F2' : '#fff' }}
            >
              <span className="text-[15px] font-semibold" style={{ color: on ? '#B91C1C' : '#1C1917' }}>{c.nombre}</span>
              <span className="text-[13px] text-t2 font-mono">{c.matriculas.join(' · ') || 'Sin coches'}</span>
              {c.enTaller && <span className="text-xs font-semibold text-t2">Coche en el taller</span>}
            </Link>
          );
        })}
        {!visibles.length && <div className="text-sm text-t4 px-3.5 py-4">Ningún cliente coincide.</div>}
      </div>
    </aside>
  );
}
