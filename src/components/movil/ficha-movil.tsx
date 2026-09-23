'use client';

// Ficha de un coche en el móvil del mecánico, con "Rellenar con IA":
// escribe o graba lo que ha hecho → (si es audio, se transcribe y se le enseña)
// → la IA propone cambios → el mecánico confirma, corrige o descarta.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { confirmarPropuestaAccion } from '@/app/acciones';
import { errorAlGuardar, useAvisos } from '@/components/avisos';
import { EstadoPiezaChip, EstadoPill, Matricula } from '@/components/ui';
import { eur } from '@/lib/formato';
import type { OrigenIA, Propuesta, ServicioTarifa } from '@/lib/tipos';
import type { ObservacionVista, PiezaVista, TrabajoVista } from '@/lib/vistas';
import { aWav, mensajeMicrofono, useGrabadora } from './audio';
import { contarCambios, limpiarPropuesta, nuevaClave, problemaEdicion, Revision, type OrdenMovil } from './revision';

export interface DatosFichaMovil extends Omit<OrdenMovil, 'trabajos' | 'piezas'> {
  dias: string;
  kmTexto: string;
  cliente: string;
  motivo: string;
  total: number;
  trabajos: TrabajoVista[];
  piezas: PiezaVista[];
  observaciones: ObservacionVista[];
}

type Fase =
  | { tipo: 'ficha' }
  | { tipo: 'grabando' }
  | { tipo: 'procesando'; via: OrigenIA; paso: number; texto: string }
  | { tipo: 'revision'; propuesta: Propuesta; editando: boolean; aviso?: string; copia?: Propuesta }
  | { tipo: 'error'; titulo: string; detalle: string; texto: string; via: OrigenIA };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const horaAhora = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });

export function FichaMovil({ yo, orden, tarifa, iaLista }: {
  yo: { nombre: string }; orden: DatosFichaMovil; tarifa: ServicioTarifa[]; iaLista: boolean;
}) {
  const avisar = useAvisos();
  const [fase, setFase] = useState<Fase>({ tipo: 'ficha' });
  const [texto, setTexto] = useState('');
  const [guardando, iniciarGuardado] = useTransition();
  const turno = useRef(0);
  const preparando = useRef(false);
  const grabando = useRef(false);
  const [preparandoMic, setPreparandoMic] = useState(false);
  const terminarRef = useRef<() => void>(() => {});
  const grabadora = useGrabadora(useCallback(() => terminarRef.current(), []));

  const ordenRevision: OrdenMovil = {
    id: orden.id, matricula: orden.matricula, modelo: orden.modelo, estado: orden.estado, km: orden.km,
    trabajos: orden.trabajos.map((t) => ({ id: t.id, descripcion: t.descripcion, precio: t.precio, cantidad: t.cantidad })),
    piezas: orden.piezas.map((p) => ({ id: p.id, descripcion: p.descripcion })),
  };

  const abrirManual = (textoInicial = '', aviso?: string) => {
    turno.current++;
    setFase({
      tipo: 'revision',
      editando: true,
      aviso,
      propuesta: {
        via: 'mano', texto: '', segmentos: [], trabajos: [], piezas: [], km: null, estado: null,
        observaciones: textoInicial ? [{ clave: nuevaClave(), texto: textoInicial, recomendacion: false, tarifaId: null }] : [],
      },
    });
  };

  const proponer = async (fuente: string, via: OrigenIA, t: number) => {
    const pasoEntender = via === 'voz' ? 1 : 0;
    setFase({ tipo: 'procesando', via, paso: pasoEntender, texto: fuente });
    try {
      const r = await fetch(`/api/ordenes/${orden.id}/ia/proponer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: fuente, via }),
      });
      const j = (await r.json().catch(() => ({}))) as { propuesta?: Propuesta; error?: string };
      if (t !== turno.current) return;
      if (!r.ok || !j.propuesta) {
        setFase({ tipo: 'error', titulo: 'La IA no ha podido rellenar la ficha', detalle: j.error ?? 'Ha fallado la IA.', texto: fuente, via });
        return;
      }
      setFase({ tipo: 'procesando', via, paso: pasoEntender + 1, texto: fuente });
      await esperar(500);
      if (t !== turno.current) return;
      if (!contarCambios(j.propuesta)) {
        setFase({
          tipo: 'error', titulo: 'No he encontrado cambios para la ficha',
          detalle: 'Cuéntalo con un poco más de detalle: qué has hecho, qué piezas hacen falta, los kilómetros o lo que le recomiendas al cliente.',
          texto: fuente, via,
        });
        return;
      }
      setFase({ tipo: 'revision', propuesta: j.propuesta, editando: false });
    } catch {
      if (t !== turno.current) return;
      setFase({ tipo: 'error', titulo: 'No se ha podido hablar con el servidor', detalle: 'Revisa la conexión y vuelve a intentarlo.', texto: fuente, via });
    }
  };

  const enviarTexto = () => {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    if (!iaLista) {
      abrirManual(t, 'La IA no está configurada. Tu texto está como observación: apunta los trabajos, piezas y kilómetros a mano.');
      return;
    }
    void proponer(t, 'texto', ++turno.current);
  };

  const empezarGrabacion = async () => {
    if (!iaLista) {
      avisar('La IA no está configurada: escribe lo que has hecho o pulsa «Apuntar a mano».');
      return;
    }
    // Un segundo toque mientras se abre el micrófono no hace nada.
    if (preparando.current || grabando.current) return;
    preparando.current = true;
    setPreparandoMic(true);
    try {
      if (await grabadora.empezar()) {
        turno.current++;
        grabando.current = true;
        setFase({ tipo: 'grabando' });
      }
    } catch (e) {
      avisar(mensajeMicrofono(e));
    } finally {
      preparando.current = false;
      setPreparandoMic(false);
    }
  };

  const terminarGrabacion = async () => {
    if (!grabando.current) return;
    grabando.current = false;
    const t = ++turno.current;
    setFase({ tipo: 'procesando', via: 'voz', paso: 0, texto: '' });
    const bruto = await grabadora.parar();
    if (t !== turno.current) return;
    if (bruto.size < 1500) {
      setFase({ tipo: 'error', titulo: 'No se ha grabado nada', detalle: 'Mantén el móvil cerca y habla con normalidad.', texto: '', via: 'voz' });
      return;
    }
    let audio: Blob = bruto;
    try {
      audio = await aWav(bruto);
    } catch {
      // Si el navegador no sabe convertirlo, se manda tal cual.
    }
    try {
      const datos = new FormData();
      datos.append('audio', audio, audio.type.includes('wav') ? 'nota.wav' : 'nota');
      const r = await fetch(`/api/ordenes/${orden.id}/ia/transcribir`, { method: 'POST', body: datos });
      const j = (await r.json().catch(() => ({}))) as { texto?: string; error?: string };
      if (t !== turno.current) return;
      if (!r.ok || !j.texto) {
        setFase({ tipo: 'error', titulo: 'No he podido pasar el audio a texto', detalle: j.error ?? 'Ha fallado la transcripción.', texto: '', via: 'voz' });
        return;
      }
      setFase({ tipo: 'procesando', via: 'voz', paso: 1, texto: j.texto });
      await esperar(700);
      if (t !== turno.current) return;
      await proponer(j.texto, 'voz', t);
    } catch {
      if (t !== turno.current) return;
      setFase({ tipo: 'error', titulo: 'No se ha podido enviar el audio', detalle: 'Revisa la conexión y vuelve a intentarlo.', texto: '', via: 'voz' });
    }
  };
  useEffect(() => {
    terminarRef.current = () => void terminarGrabacion();
  });

  const cancelar = () => {
    turno.current++;
    grabando.current = false;
    grabadora.cancelar();
    // Si ya había texto (escrito o transcrito), se devuelve a la caja para no perderlo.
    if (fase.tipo === 'procesando' && fase.texto) setTexto(fase.texto);
    setFase({ tipo: 'ficha' });
  };

  const corregir = () => setFase((f) => (f.tipo === 'revision' ? { ...f, editando: true, copia: f.propuesta } : f));

  const terminarEdicion = () => {
    if (fase.tipo !== 'revision') return;
    const problema = problemaEdicion(fase.propuesta, tarifa);
    if (problema) {
      avisar(problema);
      return;
    }
    setFase({ ...fase, propuesta: limpiarPropuesta(fase.propuesta, tarifa), editando: false, copia: undefined });
  };

  const cancelarEdicion = () => {
    if (fase.tipo !== 'revision') return;
    if (fase.copia) {
      setFase({ ...fase, propuesta: fase.copia, editando: false, copia: undefined });
    } else {
      setFase({ tipo: 'ficha' });
      avisar('No se ha guardado nada.');
    }
  };

  const confirmar = (p: Propuesta) => {
    const limpia = limpiarPropuesta(p, tarifa);
    if (!contarCambios(limpia)) {
      avisar('No hay cambios que guardar.');
      return;
    }
    iniciarGuardado(async () => {
      try {
        const r = await confirmarPropuestaAccion(orden.id, limpia);
        if (r.ok) {
          avisar(r.mensaje ?? 'Ficha guardada.');
          setFase({ tipo: 'ficha' });
        } else {
          avisar(r.error);
        }
      } catch (e) {
        console.error('[guardar ficha]', e);
        avisar(errorAlGuardar());
      }
    });
  };

  const pasos = (via: OrigenIA) => [
    ...(via === 'voz' ? ['Transcribiendo el audio'] : []),
    'Entendiendo lo que has hecho',
    `Rellenando la ficha ${orden.id}`,
  ];

  return (
    <>
      <div className="px-4 pb-[150px] flex flex-col gap-3">
        <div className="sticky top-0 bg-fondo py-1 z-[2] flex items-center justify-between">
          <Link href="/movil" className="h-12 pr-3.5 pl-1 flex items-center text-[17px] font-semibold text-rojo">‹ Mis coches</Link>
          <span className="font-mono text-sm text-t2">{orden.id}</span>
        </div>

        <div className="bg-white border border-borde rounded-[14px] p-[18px] flex flex-col gap-2.5">
          <Matricula valor={orden.matricula} tam="xlm" className="self-start" />
          <div className="text-xl font-bold">{orden.modelo}</div>
          <span className="self-start"><EstadoPill estado={orden.estado} tam="lg" /></span>
          <div className="text-[15px] text-t3">{orden.kmTexto} · {orden.dias}</div>
          <div className="text-[15px] text-t3">Cliente: {orden.cliente}</div>
        </div>

        <div className="bg-white border border-borde rounded-[14px] px-[18px] py-4 flex flex-col gap-1.5">
          <span className="titulo-seccion">Motivo de entrada</span>
          <span className="text-base leading-[1.45]">{orden.motivo}</span>
        </div>

        <div className="bg-white border border-borde rounded-[14px] px-[18px] py-4 flex flex-col gap-0.5">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="titulo-seccion">Hecho</span>
            <span className="text-[15px] font-bold">{eur(orden.total)}</span>
          </div>
          {orden.trabajos.map((t) => (
            <div key={t.id} className="flex justify-between gap-2.5 px-2 py-2.5 border-t border-linea rounded" style={{ background: t.reciente ? '#FEF2F2' : 'transparent' }}>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-medium">{t.descripcion}{t.cantidad > 1 ? ` (${t.cantidad} uds.)` : ''}</span>
                <span className="text-xs text-t2">{t.hechoPorNombre} · {t.cuando}</span>
              </div>
              {t.precio === null
                ? <span className="text-sm font-bold text-rojo whitespace-nowrap">Precio a poner</span>
                : <span className="text-[15px] font-semibold whitespace-nowrap">{eur(t.precio)}</span>}
            </div>
          ))}
          {!orden.trabajos.length && <span className="text-[15px] text-t4 py-2 border-t border-linea">Todavía nada. Pulsa el micro y cuéntalo.</span>}
        </div>

        {orden.piezas.length > 0 && (
          <div className="bg-white border border-borde rounded-[14px] px-[18px] py-4 flex flex-col gap-0.5">
            <span className="titulo-seccion mb-1.5">Piezas</span>
            {orden.piezas.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 py-2.5 border-t border-linea">
                <span className="text-[15px]">{p.descripcion}</span>
                <span className="self-start"><EstadoPiezaChip estado={p.estado} nota={p.nota} /></span>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border border-borde rounded-[14px] px-[18px] py-4 flex flex-col gap-0.5">
          <span className="titulo-seccion mb-1.5">Observaciones</span>
          {orden.observaciones.map((o) => (
            <div key={o.id} className="flex flex-col gap-[3px] px-2 py-2.5 border-t border-linea rounded" style={{ background: o.reciente ? '#FEF2F2' : 'transparent' }}>
              {o.recomendacion && <span className="text-[11px] font-bold text-rojo uppercase tracking-[.05em]">Recomendación</span>}
              <span className="text-[15px] leading-[1.4]">{o.texto}</span>
            </div>
          ))}
          {!orden.observaciones.length && <span className="text-[15px] text-t4 py-2 border-t border-linea">Sin observaciones.</span>}
        </div>

        <button type="button" onClick={() => abrirManual()} className="self-center text-[15px] font-semibold text-t2 underline underline-offset-4 py-2">
          Apuntar a mano, sin IA
        </button>
      </div>

      <div className="barra-movil fixed inset-x-0 bottom-0 bg-white border-t border-borde z-10">
        <div className="max-w-[520px] mx-auto px-3.5 pt-3 pb-[max(22px,env(safe-area-inset-bottom))] flex items-center gap-2.5">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviarTexto()}
          placeholder="Cuéntale a la IA qué has hecho…"
          className="flex-1 min-w-0 h-14 border border-borde-2 rounded-[28px] px-[18px] text-base bg-fondo focus:outline-2 focus:outline-rojo/20"
        />
        {texto.trim() ? (
          <button type="button" onClick={enviarTexto} className="h-14 px-5 rounded-[28px] bg-rojo text-white text-base font-bold shrink-0">Enviar</button>
        ) : (
          <button
            type="button"
            onClick={() => void empezarGrabacion()}
            disabled={preparandoMic}
            aria-label="Hablar"
            className="w-[72px] h-[72px] rounded-full bg-rojo flex items-center justify-center shadow-[0_4px_14px_rgba(185,28,28,.4)] shrink-0 disabled:opacity-70"
          >
            {preparandoMic ? (
              <span className="w-7 h-7 rounded-full border-[3px] border-white/40 border-t-white inline-block animate-[trspin_.8s_linear_infinite]" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </svg>
            )}
          </button>
        )}
        </div>
      </div>

      {(fase.tipo === 'grabando' || fase.tipo === 'procesando' || fase.tipo === 'error') && (
        <div className="fixed inset-0 bg-[rgba(28,25,23,.55)] z-[25] flex items-end justify-center">
          <div className="bg-white w-full max-w-[520px] max-h-dvh overflow-y-auto rounded-t-3xl px-[22px] pt-6 pb-[max(32px,env(safe-area-inset-bottom))] flex flex-col gap-[18px] min-h-[500px]">
            {fase.tipo === 'grabando' && (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-rojo inline-block animate-[trpulse_1.2s_ease-out_infinite]" />
                  <span className="text-[17px] font-bold">Grabando</span>
                  <span className="ml-auto font-mono text-[17px] font-semibold">
                    {Math.floor(grabadora.segundos / 60)}:{String(grabadora.segundos % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="text-[13px] text-t2 -mt-2.5">{orden.id} · {orden.matricula} · {orden.modelo}</div>
                <div className="flex items-center justify-center gap-1 h-16">
                  {grabadora.niveles.map((nivel, i) => (
                    <span key={i} className="w-[5px] rounded-[3px] bg-rojo transition-[height] duration-100" style={{ height: `${Math.round(nivel * 64)}px` }} />
                  ))}
                </div>
                <div className="text-[21px] leading-[1.45] min-h-[150px] font-medium text-t5">
                  Habla con normalidad… Cuenta qué has hecho, las piezas que hacen falta, los kilómetros y lo que le recomiendas al cliente.
                  <span className="inline-block w-0.5 h-[22px] bg-rojo ml-[3px] align-[-3px] animate-[trblink_1s_step-end_infinite]" />
                </div>
                <div className="flex flex-col items-center gap-2.5">
                  <button type="button" onClick={() => void terminarGrabacion()} aria-label="Terminar" className="w-[84px] h-[84px] rounded-full bg-rojo flex items-center justify-center">
                    <span className="w-7 h-7 bg-white rounded-[5px]" />
                  </button>
                  <span className="text-[15px] font-semibold">Terminar</span>
                  <button type="button" onClick={cancelar} className="h-11 px-5 text-base text-t2">Cancelar</button>
                </div>
              </>
            )}

            {fase.tipo === 'procesando' && (
              <>
                <span className="text-xl font-bold">Procesando…</span>
                {fase.texto
                  ? <div className="text-[17px] leading-normal text-t2">“{fase.texto}”</div>
                  : <div className="text-[15px] text-t4">Pasando tu nota de voz a texto…</div>}
                <div className="flex flex-col gap-3.5 border-t border-linea pt-[18px]">
                  {pasos(fase.via).map((l, i) => {
                    const hecho = fase.paso > i;
                    const activo = fase.paso === i;
                    return (
                      <div key={l} className="flex items-center gap-3 min-h-7">
                        <span className="w-[26px] h-[26px] flex items-center justify-center">
                          {hecho && <span className="w-6 h-6 rounded-full bg-tinta text-white text-sm font-bold flex items-center justify-center">✓</span>}
                          {activo && <span className="w-[22px] h-[22px] rounded-full border-[3px] border-gris border-t-rojo inline-block animate-[trspin_.8s_linear_infinite]" />}
                          {!hecho && !activo && <span className="w-[22px] h-[22px] rounded-full border-2 border-borde" />}
                        </span>
                        <span className="text-base font-semibold" style={{ color: !hecho && !activo ? '#A8A29E' : '#1C1917' }}>{l}</span>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={cancelar} className="mt-auto self-center h-11 px-5 text-base text-t2">Cancelar</button>
              </>
            )}

            {fase.tipo === 'error' && (
              <>
                <span className="text-xl font-bold">{fase.titulo}</span>
                <span className="text-base text-t3 leading-normal">{fase.detalle}</span>
                {fase.texto && <div className="text-[15px] leading-normal text-t2 border-t border-linea pt-3">“{fase.texto}”</div>}
                <div className="mt-auto flex flex-col gap-2.5">
                  {fase.texto && (
                    <button type="button" className="btn btn-rojo h-14 rounded-[14px] text-[17px]" onClick={() => void proponer(fase.texto, fase.via, ++turno.current)}>
                      Volver a intentarlo
                    </button>
                  )}
                  {!fase.texto && fase.via === 'voz' && (
                    <button type="button" className="btn btn-rojo h-14 rounded-[14px] text-[17px]" onClick={() => { setFase({ tipo: 'ficha' }); void empezarGrabacion(); }}>
                      Grabar otra vez
                    </button>
                  )}
                  <button type="button" className="h-[54px] rounded-[14px] bg-white border-[1.5px] border-tinta text-[17px] font-semibold"
                    onClick={() => abrirManual(fase.texto, fase.texto ? 'Tu texto está como observación. Añade los trabajos, piezas y kilómetros a mano.' : undefined)}>
                    Apuntar a mano
                  </button>
                  <button type="button" className="h-11 text-base text-t2" onClick={() => { setTexto(fase.texto); setFase({ tipo: 'ficha' }); }}>
                    {fase.texto ? 'Volver y cambiar el texto' : 'Volver'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {fase.tipo === 'revision' && (
        <Revision
          orden={ordenRevision}
          tarifa={tarifa}
          yoNombre={yo.nombre}
          hora={horaAhora()}
          propuesta={fase.propuesta}
          editando={fase.editando}
          guardando={guardando}
          aviso={fase.aviso}
          cambiar={(p) => setFase((f) => (f.tipo === 'revision' ? { ...f, propuesta: p } : f))}
          corregir={corregir}
          terminarEdicion={terminarEdicion}
          cancelarEdicion={cancelarEdicion}
          confirmar={() => confirmar(fase.propuesta)}
          descartar={() => {
            setFase({ tipo: 'ficha' });
            avisar('Descartado. La ficha no ha cambiado.');
          }}
        />
      )}
    </>
  );
}
