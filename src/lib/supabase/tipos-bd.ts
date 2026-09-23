// Tipos de la base de datos de Supabase (generados a partir del esquema de supabase/migrations).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Tabla<Fila, Alta, Cambio = Partial<Alta>> = { Row: Fila; Insert: Alta; Update: Cambio; Relationships: [] };

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      citas: Tabla<
        {
          cliente_id: string | null; coche: string; conversacion_id: string | null; creada: string; fecha: string; hora: string;
          id: string; matricula: string; motivo: string; nombre: string; orden_id: string | null; origen: string; telefono: string;
        },
        {
          cliente_id?: string | null; coche?: string; conversacion_id?: string | null; creada?: string; fecha: string; hora: string;
          id: string; matricula: string; motivo?: string; nombre: string; orden_id?: string | null; origen: string; telefono?: string;
        }
      >;
      clientes: Tabla<
        { contacto: string | null; creado: string; desde: number; email: string; id: string; nombre: string; nombre_corto: string; telefono: string },
        { contacto?: string | null; creado?: string; desde: number; email?: string; id: string; nombre: string; nombre_corto: string; telefono?: string }
      >;
      coches: Tabla<
        { anio: number | null; cliente_id: string; combustible: string; creado: string; id: string; matricula: string; matricula_clave: string | null; modelo: string },
        { anio?: number | null; cliente_id: string; combustible?: string; creado?: string; id: string; matricula: string; modelo: string }
      >;
      conversaciones: Tabla<
        {
          actualizada: string; canal: string; cliente_id: string | null; contacto: string | null; creada: string;
          ia_pensando_desde: string | null; id: string; modo: string; motivo: string | null; necesita_persona: boolean; nombre: string;
          prueba: boolean;
        },
        {
          actualizada?: string; canal: string; cliente_id?: string | null; contacto?: string | null; creada?: string;
          ia_pensando_desde?: string | null; id: string; modo?: string; motivo?: string | null; necesita_persona?: boolean; nombre?: string;
          prueba?: boolean;
        }
      >;
      mensajes: Tabla<
        { autor: string | null; conversacion_id: string; cuando: string; de: string; id: string; n: number; texto: string },
        { autor?: string | null; conversacion_id: string; cuando?: string; de: string; id: string; texto: string }
      >;
      ordenes: Tabla<
        {
          cierre: string | null; coche_id: string; entrada: string; estado: string; historial: Json; id: string; informes: Json;
          km: number; mecanico_id: string; motivo: string; observaciones: Json; piezas: Json; trabajos: Json; ultima_ia: Json | null;
          version: number;
        },
        {
          cierre?: string | null; coche_id: string; entrada?: string; estado?: string; historial?: Json; id?: string; informes?: Json;
          km: number; mecanico_id: string; motivo: string; observaciones?: Json; piezas?: Json; trabajos?: Json; ultima_ia?: Json | null;
          version?: number;
        }
      >;
      personas: Tabla<
        { id: string; nombre: string; nombre_completo: string; rol: string; rol_etiqueta: string },
        { id: string; nombre: string; nombre_completo: string; rol: string; rol_etiqueta: string }
      >;
      tarifa: Tabla<
        { categoria: string; id: string; nombre: string; por_unidad: boolean; posicion: number; precio: number; tiempo: string },
        { categoria: string; id: string; nombre: string; por_unidad?: boolean; posicion?: number; precio: number; tiempo?: string }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      asistente_orden: { Args: { p_codigo: string; p_matriculas: string[] }; Returns: Json };
      huecos_ocupados: { Args: { p_desde: string; p_hasta: string }; Returns: { fecha: string; hora: string }[] };
      poner_clave: { Args: { p_clave: string; p_persona: string }; Returns: undefined };
      reiniciar_datos: { Args: { p_datos: Json }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
