// Modelo de datos del taller. Se guarda en Supabase (ver supabase/migrations y lib/filas.ts).

export type EstadoId = 'recibido' | 'diagnostico' | 'pieza' | 'reparacion' | 'listo';
export type EstadoOrden = EstadoId | 'entregado';
export type PersonaId = 'paco' | 'lucia' | 'javi' | 'ruben' | 'marta';
export type Rol = 'dueno' | 'recepcion' | 'mecanico';
export type VistaId = 'tablero' | 'conversaciones' | 'clientes' | 'citas' | 'tarifa' | 'probar';
export type OrigenIA = 'voz' | 'texto';

export interface Persona {
  id: PersonaId;
  nombre: string;
  nombreCompleto: string;
  rol: Rol;
  rolEtiqueta: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  nombreCorto: string;
  contacto?: string;
  telefono: string;
  email: string;
  desde: number;
}

export interface Coche {
  id: string;
  clienteId: string;
  matricula: string;
  modelo: string;
  anio: number | null;
  combustible: string;
}

export interface ServicioTarifa {
  id: string;
  categoria: string;
  nombre: string;
  tiempo: string;
  precio: number;
  porUnidad: boolean;
}

export interface Trabajo {
  id: string;
  descripcion: string;
  /** null = "precio a poner" */
  precio: number | null;
  origen: 'tarifa' | 'mano';
  tarifaId?: string;
  cantidad: number;
  hechoPor: PersonaId;
  cuando: string;
  ia?: OrigenIA;
}

export type EstadoPieza = 'pendiente' | 'pedida' | 'recibida' | 'stock';

export interface Pieza {
  id: string;
  descripcion: string;
  estado: EstadoPieza;
  nota?: string;
  cuando: string;
  ia?: OrigenIA;
}

export interface Observacion {
  id: string;
  texto: string;
  recomendacion: boolean;
  tarifaId?: string;
  quien: PersonaId;
  cuando: string;
  ia?: OrigenIA;
}

export interface Evento {
  id: string;
  cuando: string;
  quien: string;
  texto: string;
  ia?: boolean;
}

export interface InformeCliente {
  resumen: string;
  trabajos: Record<string, string>;
  recomendaciones: Record<string, string>;
  generado: string;
  porIA: boolean;
  firma: string;
  aviso?: string;
}

export interface InformeInterno {
  resumen: string;
  puntos: string[];
  generado: string;
  porIA: boolean;
  firma: string;
  aviso?: string;
}

export interface Orden {
  id: string;
  cocheId: string;
  estado: EstadoOrden;
  km: number;
  mecanicoId: PersonaId;
  entrada: string;
  cierre?: string;
  motivo: string;
  trabajos: Trabajo[];
  piezas: Pieza[];
  observaciones: Observacion[];
  historial: Evento[];
  ultimaIA?: { cuando: string; via: OrigenIA };
  informes: { cliente?: InformeCliente; interno?: InformeInterno };
  /** Versión en la base de datos: evita que dos personas se pisen los cambios. */
  version?: number;
}

export interface Cita {
  id: string;
  fecha: string; // AAAA-MM-DD
  hora: string; // HH:MM
  nombre: string;
  telefono: string;
  matricula: string;
  coche: string;
  motivo: string;
  clienteId?: string;
  ordenId?: string;
  conversacionId?: string;
  origen: 'taller' | 'ia';
  creada: string;
}

export type Canal = 'WhatsApp' | 'Email' | 'Web';

export interface Mensaje {
  id: string;
  de: 'cliente' | 'ia' | 'persona';
  texto: string;
  cuando: string;
  autor?: string;
}

export interface Conversacion {
  id: string;
  clienteId?: string;
  nombre: string;
  canal: Canal;
  contacto?: string;
  modo: 'ia' | 'persona';
  necesitaPersona: boolean;
  motivo?: string;
  mensajes: Mensaje[];
  actualizada: string;
  creada: string;
  iaPensando?: boolean;
  /** Chat de prueba del dueño (pestaña «Probar asistente»). */
  prueba?: boolean;
}

/** Todos los datos de golpe: datos de ejemplo y cargas completas. */
export interface BaseDatos {
  clientes: Cliente[];
  coches: Coche[];
  ordenes: Orden[];
  tarifa: ServicioTarifa[];
  citas: Cita[];
  conversaciones: Conversacion[];
  siguienteOrden: number;
  visitantesWeb: number;
  creada: string;
}

// ——— Propuesta de cambios que prepara la IA (o el mecánico a mano) ———

export interface PropTrabajo {
  clave: string;
  n?: number;
  descripcion: string;
  tarifaId: string | null;
  cantidad: number;
  /** Solo cuando no hay servicio de tarifa. null = "precio a poner". */
  precioManual: number | null;
}

export interface PropPieza {
  clave: string;
  n?: number;
  piezaId: string | null;
  descripcion: string;
  estado: EstadoPieza;
  nota: string;
}

export interface PropObservacion {
  clave: string;
  n?: number;
  texto: string;
  recomendacion: boolean;
  tarifaId: string | null;
}

export interface Segmento {
  t: string;
  n: number | null;
}

export interface Propuesta {
  via: OrigenIA | 'mano';
  texto: string;
  segmentos: Segmento[];
  trabajos: PropTrabajo[];
  piezas: PropPieza[];
  observaciones: PropObservacion[];
  km: number | null;
  kmN?: number;
  estado: EstadoId | null;
  estadoN?: number;
  estadoMotivo?: string;
}

export type Resultado = { ok: true; id?: string; mensaje?: string } | { ok: false; error: string };
