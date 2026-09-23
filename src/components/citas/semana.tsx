'use client';

import Link from 'next/link';
import { useState } from 'react';
import { anularCitaAccion, reservarCitaAccion } from '@/app/acciones';
import { useAccion } from '@/components/avisos';
import { Matricula } from '@/components/ui';

export interface DiaVista {
  fecha: string;
  nombre: string;
  corta: string;
  esHoy: boolean;
  pasado: boolean;
}

export interface CitaVista {
  id: string;
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  matricula: string;
  coche: string;
  motivo: string;
  origen: 'taller' | 'ia';
  ordenId: string | null;
  conversacionId: string | null;
}

const VACIO = { nombre: '', telefono: '', matricula: '', coche: '', motivo: '' };
const CAMPOS: [keyof typeof VACIO, string, string][] = [
  ['nombre', 'Cliente', 'Nombre y apellidos'],
  ['telefono', 'Teléfono', '600 000 000'],
  ['matricula', 'Matrícula', '1234 ABC'],
  ['coche', 'Coche', 'Marca y modelo'],
  ['motivo', 'Motivo', 'Qué le pasa o qué quiere hacer'],
];

const horaCorta = (h: string) => h.replace(/^0/, '');

export function SemanaCitas({ dias, huecos, citas }: { dias: DiaVista[]; huecos: string[]; citas: CitaVista[] }) {
  const [sel, setSel] = useState<{ fecha: string; hora: string } | null>(null);
  const [form, setForm] = useState(VACIO);
  const { pendiente, ejecutar } = useAccion();

  const citaEn = (fecha: string, hora: string) => citas.find((c) => c.fecha === fecha && c.hora === hora);
  const elegida = sel ? citaEn(sel.fecha, sel.hora) : undefined;
  const diaSel = sel ? dias.find((d) => d.fecha === sel.fecha) : undefined;
  const cuando = sel && diaSel ? `${diaSel.nombre} ${diaSel.corta} · ${horaCorta(sel.hora)}` : '';

  const reservar = () => {
    if (!sel) return;
    ejecutar(() => reservarCitaAccion({ fecha: sel.fecha, hora: sel.hora, ...form }), (r) => r.ok && setForm(VACIO));
  };

  return (
    <div className="flex gap-4 items-start flex-wrap">
      <div className="flex-[3_1_720px] min-w-0 overflow-x-auto">
        <div className="grid grid-cols-[repeat(5,minmax(150px,1fr))] gap-2.5 min-w-[780px]">
          {dias.map((d) => (
            <div key={d.fecha} className="flex flex-col gap-2">
              <div className="px-3 py-2.5 rounded-lg flex justify-between items-baseline"
                style={{ background: d.esHoy ? '#1C1917' : '#fff', color: d.esHoy ? '#fff' : '#1C1917' }}>
                <span className="text-[15px] font-bold">{d.nombre}</span>
                <span className="text-[13px]">{d.corta}</span>
              </div>
              {huecos.map((h) => {
                const c = citaEn(d.fecha, h);
                const marcado = sel?.fecha === d.fecha && sel?.hora === h;
                const clicable = Boolean(c) || !d.pasado;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={!clicable}
                    onClick={() => { setSel({ fecha: d.fecha, hora: h }); setForm(VACIO); }}
                    className="text-left min-h-[108px] rounded-lg px-3 py-2.5 flex flex-col gap-[5px] disabled:cursor-default"
                    style={{
                      border: marcado ? '2px solid #B91C1C' : c ? '1px solid #E4E1DC' : '1.5px dashed #C9C5BF',
                      background: c ? '#fff' : d.pasado ? 'transparent' : '#FFFCFB',
                    }}
                  >
                    <span className="font-mono text-[13px] font-semibold text-t2">{h}</span>
                    {c ? (
                      <>
                        <Matricula valor={c.matricula} tam="xs" className="self-start" />
                        <span className="text-sm font-semibold leading-tight">{c.nombre}</span>
                        <span className="text-xs text-t2 leading-[1.3]">{c.motivo}</span>
                      </>
                    ) : (
                      <span className="my-auto text-sm font-semibold" style={{ color: d.pasado ? '#A8A29E' : '#B91C1C' }}>
                        {d.pasado ? 'Sin cita' : 'Libre · reservar'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <aside className="flex-[1_1_300px] min-w-[280px] bg-white border border-borde rounded-xl p-5 flex flex-col gap-3">
        {!sel && <div className="text-[15px] text-t2 leading-normal">Elige un hueco para ver la cita o reservar uno libre.</div>}

        {sel && elegida && (
          <>
            <div className="titulo-seccion">{cuando}</div>
            <Matricula valor={elegida.matricula} tam="lg" className="self-start" />
            <div className="text-lg font-bold">{elegida.nombre}</div>
            <div className="text-sm text-t3">{elegida.coche}</div>
            <div className="text-[15px] font-mono">{elegida.telefono || 'Sin teléfono'}</div>
            <div className="text-[15px] leading-[1.45] border-t border-linea pt-2.5">{elegida.motivo}</div>
            {elegida.origen === 'ia' && (
              <div className="text-xs font-semibold text-t2">
                Reservada por la IA{elegida.conversacionId ? ' · ' : ''}
                {elegida.conversacionId && <Link href={`/conversaciones/${elegida.conversacionId}`} className="text-rojo hover:underline">ver conversación</Link>}
              </div>
            )}
            {elegida.ordenId ? (
              <Link href={`/ordenes/${elegida.ordenId}`} className="btn btn-rojo h-10 text-sm">Abrir {elegida.ordenId}</Link>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href={`/ordenes/nueva?cita=${elegida.id}`} className="btn btn-rojo h-10 text-sm">Ha llegado el coche · abrir orden</Link>
                <button type="button" className="btn btn-borde h-10 text-sm" disabled={pendiente}
                  onClick={() => ejecutar(() => anularCitaAccion(elegida.id), (r) => r.ok && setSel(null))}>Anular cita</button>
              </div>
            )}
          </>
        )}

        {sel && !elegida && (
          <>
            <div className="titulo-seccion">Reservar · {cuando}</div>
            {CAMPOS.map(([k, etiqueta, ph]) => (
              <label key={k} className="flex flex-col gap-1 text-[13px] font-semibold text-t3">
                {etiqueta}
                <input
                  value={form[k]}
                  placeholder={ph}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className={`campo h-[42px] text-[15px] px-3 ${k === 'matricula' ? 'font-mono uppercase' : ''}`}
                />
              </label>
            ))}
            <button type="button" className="btn btn-rojo h-[46px] text-[15px] mt-1" disabled={pendiente} onClick={reservar}>Reservar cita</button>
          </>
        )}
      </aside>
    </div>
  );
}
