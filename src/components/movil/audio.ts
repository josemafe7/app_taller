'use client';

// Grabación con el micrófono del móvil. Se graba con MediaRecorder y, antes de
// enviarlo, se convierte a WAV (16 kHz, mono), un formato que OpenRouter acepta.

import { useCallback, useEffect, useRef, useState } from 'react';

const BARRAS = 30;
const MAX_SEGUNDOS = 120;
const REPOSO = () => Array<number>(BARRAS).fill(0.12);

// Cada grabación tiene su propia sesión: así una grabación vieja nunca se
// mezcla con la nueva ni se queda el micrófono encendido.
interface Sesion {
  recorder: MediaRecorder;
  stream: MediaStream;
  ctx?: AudioContext;
  raf?: number;
  reloj?: number;
  alParar?: (b: Blob) => void;
}

export function mensajeMicrofono(e: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'El micrófono solo funciona con https o en localhost. Escríbelo en la caja de texto.';
  }
  const nombre = e instanceof DOMException ? e.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'El navegador no deja usar el micrófono. Dale permiso o escríbelo.';
  if (nombre === 'NotFoundError') return 'No se encuentra ningún micrófono. Escríbelo en la caja de texto.';
  return 'No se ha podido empezar a grabar. Escríbelo en la caja de texto.';
}

function apagar(s: Sesion) {
  if (s.raf) cancelAnimationFrame(s.raf);
  if (s.reloj) window.clearInterval(s.reloj);
  s.raf = undefined;
  s.reloj = undefined;
  s.stream.getTracks().forEach((t) => t.stop());
  void s.ctx?.close().catch(() => {});
  s.ctx = undefined;
}

export function useGrabadora(alLlegarAlMaximo: () => void) {
  const [niveles, setNiveles] = useState<number[]>(REPOSO);
  const [segundos, setSegundos] = useState(0);
  const sesionRef = useRef<Sesion | null>(null);
  const arrancando = useRef(false);
  const maximo = useRef(alLlegarAlMaximo);
  useEffect(() => {
    maximo.current = alLlegarAlMaximo;
  }, [alLlegarAlMaximo]);

  /** Corta la grabación en curso sin devolver nada. */
  const cancelar = useCallback(() => {
    const s = sesionRef.current;
    sesionRef.current = null;
    if (!s) return;
    s.alParar = undefined;
    if (s.recorder.state !== 'inactive') {
      try {
        s.recorder.stop();
      } catch {
        // ya estaba parado
      }
    }
    apagar(s);
    setNiveles(REPOSO());
  }, []);

  /** Empieza a grabar. Devuelve false si ya había un arranque en marcha. */
  const empezar = useCallback(async (): Promise<boolean> => {
    if (arrancando.current) return false;
    arrancando.current = true;
    try {
      cancelar();
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new DOMException('Sin micrófono', window.isSecureContext ? 'NotFoundError' : 'SecurityError');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const trozos: Blob[] = [];
      let sesion: Sesion;
      try {
        const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported?.(t));
        const recorder = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
        sesion = { recorder, stream };
        recorder.ondataavailable = (e) => {
          if (e.data.size) trozos.push(e.data);
        };
        recorder.onstop = () => {
          const resolver = sesion.alParar;
          sesion.alParar = undefined;
          resolver?.(new Blob(trozos, { type: recorder.mimeType || tipo || 'audio/webm' }));
        };
        recorder.start(250);
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        throw e;
      }
      sesionRef.current = sesion;

      // Barras que se mueven con la voz
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const analizador = ctx.createAnalyser();
        analizador.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analizador);
        const datos = new Uint8Array(analizador.fftSize);
        let ultimo = 0;
        const bucle = (t: number) => {
          if (sesionRef.current !== sesion) return;
          if (t - ultimo > 70) {
            ultimo = t;
            analizador.getByteTimeDomainData(datos);
            let suma = 0;
            for (const v of datos) suma += ((v - 128) / 128) ** 2;
            const nivel = Math.min(1, Math.sqrt(suma / datos.length) * 5);
            setNiveles((prev) => [...prev.slice(1), 0.12 + nivel * 0.88]);
          }
          sesion.raf = requestAnimationFrame(bucle);
        };
        sesion.ctx = ctx;
        sesion.raf = requestAnimationFrame(bucle);
      } catch {
        // Sin analizador las barras se quedan quietas; la grabación sigue.
      }

      const inicio = Date.now();
      setSegundos(0);
      sesion.reloj = window.setInterval(() => {
        const seg = Math.floor((Date.now() - inicio) / 1000);
        setSegundos(seg);
        if (seg >= MAX_SEGUNDOS) {
          window.clearInterval(sesion.reloj);
          sesion.reloj = undefined;
          if (sesionRef.current === sesion) maximo.current();
        }
      }, 250);
      return true;
    } finally {
      arrancando.current = false;
    }
  }, [cancelar]);

  /** Para la grabación y devuelve el audio. */
  const parar = useCallback((): Promise<Blob> => {
    const s = sesionRef.current;
    sesionRef.current = null;
    setNiveles(REPOSO());
    if (!s) return Promise.resolve(new Blob());
    return new Promise((resolver) => {
      if (s.recorder.state === 'inactive') {
        apagar(s);
        resolver(new Blob());
        return;
      }
      s.alParar = resolver;
      try {
        s.recorder.stop();
      } catch {
        s.alParar = undefined;
        resolver(new Blob());
      }
      apagar(s);
    });
  }, []);

  useEffect(() => () => cancelar(), [cancelar]);

  return { niveles, segundos, empezar, parar, cancelar };
}

/** Convierte cualquier audio que sepa leer el navegador a WAV PCM de 16 bits, 16 kHz, mono. */
export async function aWav(blob: Blob): Promise<Blob> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let audio: AudioBuffer;
  try {
    audio = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close().catch(() => {});
  }
  const frecuencia = 16000;
  const muestras = Math.max(1, Math.ceil(audio.duration * frecuencia));
  const offline = new OfflineAudioContext(1, muestras, frecuencia);
  const fuente = offline.createBufferSource();
  fuente.buffer = audio;
  fuente.connect(offline.destination);
  fuente.start();
  const pcm = (await offline.startRendering()).getChannelData(0);

  const vista = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const escribir = (pos: number, texto: string) => {
    for (let i = 0; i < texto.length; i++) vista.setUint8(pos + i, texto.charCodeAt(i));
  };
  escribir(0, 'RIFF');
  vista.setUint32(4, 36 + pcm.length * 2, true);
  escribir(8, 'WAVE');
  escribir(12, 'fmt ');
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);
  vista.setUint16(22, 1, true);
  vista.setUint32(24, frecuencia, true);
  vista.setUint32(28, frecuencia * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  escribir(36, 'data');
  vista.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    vista.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([vista], { type: 'audio/wav' });
}
