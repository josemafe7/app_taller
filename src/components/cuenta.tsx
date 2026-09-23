'use client';

import { useActionState } from 'react';
import { cambiarMiClave, ponerClaveA, type EstadoClave } from '@/app/acceso';

function Aviso({ estado }: { estado: EstadoClave }) {
  if (estado.error) {
    return (
      <div role="alert" className="text-sm font-semibold text-rojo bg-rojo-50 border border-rojo-200 rounded-lg px-3 py-2">
        {estado.error}
      </div>
    );
  }
  if (estado.ok) {
    return (
      <div role="status" className="text-sm font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-2">
        {estado.ok}
      </div>
    );
  }
  return null;
}

const INICIAL: EstadoClave = { error: '', ok: '' };

export function FormMiClave() {
  const [estado, accion, pendiente] = useActionState<EstadoClave, FormData>(cambiarMiClave, INICIAL);
  return (
    <form action={accion} className="tarjeta p-6 flex flex-col gap-4" key={estado.ok || 'form'}>
      <h2 className="m-0 text-lg font-bold">Mi contraseña</h2>
      <label className="etiqueta">
        Contraseña actual
        <input name="actual" type="password" autoComplete="current-password" required className="campo h-12 text-base" />
      </label>
      <label className="etiqueta">
        Contraseña nueva (mínimo 10 caracteres)
        <input name="nueva" type="password" autoComplete="new-password" minLength={10} maxLength={72} required className="campo h-12 text-base" />
      </label>
      <label className="etiqueta">
        Repite la contraseña nueva
        <input name="repetida" type="password" autoComplete="new-password" minLength={10} maxLength={72} required className="campo h-12 text-base" />
      </label>
      <Aviso estado={estado} />
      <button type="submit" disabled={pendiente} className="btn btn-rojo h-12 text-base">
        {pendiente ? 'Cambiando…' : 'Cambiar mi contraseña'}
      </button>
    </form>
  );
}

export function FormClaveEquipo({ personas }: { personas: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoClave, FormData>(ponerClaveA, INICIAL);
  return (
    <form action={accion} className="tarjeta p-6 flex flex-col gap-4" key={estado.ok || 'form'}>
      <div>
        <h2 className="m-0 text-lg font-bold">Contraseña de otra persona del taller</h2>
        <p className="m-0 mt-1 text-sm text-t2">Por si alguien la olvida. Se le cierran las sesiones abiertas y entra con la nueva.</p>
      </div>
      <label className="etiqueta">
        Persona
        <select name="persona" required defaultValue="" className="campo h-12 text-base">
          <option value="" disabled>Elige…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </label>
      <label className="etiqueta">
        Contraseña nueva (mínimo 10 caracteres)
        <input name="nueva" type="password" autoComplete="new-password" minLength={10} maxLength={72} required className="campo h-12 text-base" />
      </label>
      <label className="etiqueta">
        Repite la contraseña nueva
        <input name="repetida" type="password" autoComplete="new-password" minLength={10} maxLength={72} required className="campo h-12 text-base" />
      </label>
      <Aviso estado={estado} />
      <button type="submit" disabled={pendiente} className="btn btn-borde h-12 text-base">
        {pendiente ? 'Guardando…' : 'Poner contraseña nueva'}
      </button>
    </form>
  );
}
