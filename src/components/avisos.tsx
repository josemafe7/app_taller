'use client';

// Avisos cortos abajo en el centro (el "toast" del diseño) y una ayuda para
// lanzar acciones del servidor y avisar del resultado.

import { createContext, useCallback, useContext, useRef, useState, useTransition, type ReactNode } from 'react';
import type { Resultado } from '@/lib/tipos';

const Contexto = createContext<(mensaje: string) => void>(() => {});

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  const avisar = useCallback((m: string) => {
    setMensaje(m);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setMensaje(null), 3800);
  }, []);
  return (
    <Contexto.Provider value={avisar}>
      {children}
      {mensaje && (
        <div
          role="status"
          className="aviso-flotante no-imprimir fixed left-1/2 bottom-7 -translate-x-1/2 bg-tinta text-white px-5 py-[13px] rounded-[10px] text-[15px] font-medium shadow-[0_8px_24px_rgba(0,0,0,.25)] z-[100] max-w-[90vw]"
        >
          {mensaje}
        </div>
      )}
    </Contexto.Provider>
  );
}

export const useAvisos = () => useContext(Contexto);

/**
 * La acción ni siquiera ha llegado a contestar. Sin red, es la conexión; con
 * red, casi siempre es que la app se ha actualizado y esta pestaña tiene la
 * versión anterior: recargando se arregla.
 */
export function errorAlGuardar(): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'No hay conexión. Revisa el wifi o los datos y vuelve a intentarlo.';
  }
  return 'No se ha podido guardar. Recarga la página (F5) y vuelve a intentarlo.';
}

/** Ejecuta una acción del servidor, avisa del resultado y devuelve si fue bien. */
export function useAccion() {
  const avisar = useAvisos();
  const [pendiente, iniciar] = useTransition();
  const ejecutar = useCallback(
    (fn: () => Promise<Resultado>, alTerminar?: (r: Resultado) => void) => {
      iniciar(async () => {
        let r: Resultado;
        try {
          r = await fn();
        } catch (e) {
          console.error('[acción]', e);
          r = { ok: false, error: errorAlGuardar() };
        }
        if (r.ok) {
          if (r.mensaje) avisar(r.mensaje);
        } else {
          avisar(r.error);
        }
        alTerminar?.(r);
      });
    },
    [avisar],
  );
  return { pendiente, ejecutar };
}
