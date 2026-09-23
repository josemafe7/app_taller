// Datos de ejemplo. Las fechas se calculan a partir de hoy para que el taller
// parezca "vivo" cualquier día que se arranque la app.

import type {
  BaseDatos, Cita, Cliente, Coche, Conversacion, EstadoOrden, Evento, Mensaje, Observacion,
  Orden, PersonaId, Pieza, ServicioTarifa, Trabajo,
} from './tipos';
import { DIAS, diaSemana, esLaborable, fmtDiaLargo, fmtDiaMedio, hoy, instante, sumarDias, sumarLaborables } from './fechas';
import { eur } from './formato';
import { nombrePersona } from './constantes';

export function crearDatosEjemplo(): BaseDatos {
  const ahora = Date.now();
  let ref = hoy();
  while (!esLaborable(ref)) ref = sumarDias(ref, -1);
  const atras = (n: number) => sumarLaborables(ref, -n);
  const adelante = (n: number) => sumarLaborables(ref, n);
  const nombreDia = (dia: string) => DIAS[diaSemana(dia)];
  const d1 = adelante(1);
  const d2 = adelante(2);

  // Nunca dejamos un sello en el futuro (si se arranca muy temprano).
  const t = (dia: string, hm: string) => new Date(Math.min(instante(dia, hm).getTime(), ahora - 60_000)).toISOString();

  let contador = 0;
  const id = (prefijo: string) => `${prefijo}-${(++contador).toString(36)}`;

  const tarifa: ServicioTarifa[] = [
    { id: 't-aceite', categoria: 'Mantenimiento', nombre: 'Cambio de aceite y filtros', tiempo: '0,5 h', precio: 89, porUnidad: false },
    { id: 't-preitv', categoria: 'Mantenimiento', nombre: 'Pre-ITV', tiempo: '0,5 h', precio: 35, porUnidad: false },
    { id: 't-pastillas', categoria: 'Frenos', nombre: 'Pastillas delanteras', tiempo: '1 h', precio: 95, porUnidad: false },
    { id: 't-discos-del', categoria: 'Frenos', nombre: 'Discos y pastillas delanteros', tiempo: '1,5 h', precio: 220, porUnidad: false },
    { id: 't-discos-tras', categoria: 'Frenos', nombre: 'Discos traseros', tiempo: '1,5 h', precio: 140, porUnidad: false },
    { id: 't-distribucion', categoria: 'Motor', nombre: 'Kit de distribución', tiempo: '4 h', precio: 480, porUnidad: false },
    { id: 't-embrague', categoria: 'Motor', nombre: 'Embrague', tiempo: '5 h', precio: 650, porUnidad: false },
    { id: 't-aire', categoria: 'Climatización', nombre: 'Carga de aire acondicionado', tiempo: '0,8 h', precio: 75, porUnidad: false },
    { id: 't-diagnosis', categoria: 'Electricidad', nombre: 'Diagnosis electrónica', tiempo: '0,5 h', precio: 45, porUnidad: false },
    { id: 't-bateria', categoria: 'Electricidad', nombre: 'Batería', tiempo: '0,3 h', precio: 120, porUnidad: false },
    { id: 't-alineado', categoria: 'Ruedas', nombre: 'Alineado', tiempo: '0,5 h', precio: 40, porUnidad: false },
    { id: 't-neumatico', categoria: 'Ruedas', nombre: 'Neumático montado', tiempo: '0,3 h', precio: 85, porUnidad: true },
  ];
  const servicio = (tid: string) => {
    const s = tarifa.find((x) => x.id === tid);
    if (!s) throw new Error(`Servicio de tarifa desconocido: ${tid}`);
    return s;
  };

  const clientes: Cliente[] = [
    { id: 'c1', nombre: 'Juan García Pérez', nombreCorto: 'Juan García', telefono: '612 345 781', email: 'juan.garcia.p@gmail.com', desde: 2019 },
    { id: 'c2', nombre: 'Carmen López Ruiz', nombreCorto: 'Carmen López', telefono: '655 902 114', email: 'carmenlopez.r@hotmail.com', desde: 2022 },
    { id: 'c3', nombre: 'Reformas Hidalgo S.L.', nombreCorto: 'Reformas Hidalgo', contacto: 'Antonio Hidalgo', telefono: '916 81 44 27', email: 'administracion@reformashidalgo.es', desde: 2017 },
    { id: 'c4', nombre: 'Alberto Moreno Gil', nombreCorto: 'Alberto Moreno', telefono: '678 230 556', email: 'amoreno78@gmail.com', desde: 2021 },
    { id: 'c5', nombre: 'Pilar Sánchez Vega', nombreCorto: 'Pilar Sánchez', telefono: '620 118 473', email: 'pilar.sanchez.vega@gmail.com', desde: 2024 },
    { id: 'c6', nombre: 'Miguel Ángel Torres', nombreCorto: 'Miguel Ángel Torres', telefono: '699 457 012', email: 'matorres@yahoo.es', desde: 2020 },
    { id: 'c7', nombre: 'Fontanería Ramos', nombreCorto: 'Fontanería Ramos', contacto: 'Luis Ramos', telefono: '916 95 70 38', email: 'info@fontaneriaramos.es', desde: 2018 },
    { id: 'c8', nombre: 'Elena Martín Castro', nombreCorto: 'Elena Martín', telefono: '644 781 330', email: 'elena.martin.c@gmail.com', desde: 2023 },
    { id: 'c9', nombre: 'Sergio Díaz Romero', nombreCorto: 'Sergio Díaz', telefono: '611 204 889', email: 'sdiaz.romero@gmail.com', desde: 2016 },
    { id: 'c10', nombre: 'Rosa Fernández Lara', nombreCorto: 'Rosa Fernández', telefono: '637 552 091', email: 'rosafl@gmail.com', desde: 2025 },
    { id: 'c11', nombre: 'David Navarro Sanz', nombreCorto: 'David Navarro', telefono: '608 913 245', email: 'dnavarro.sanz@outlook.es', desde: 2019 },
    { id: 'c12', nombre: 'Laura Gómez Ibáñez', nombreCorto: 'Laura Gómez', telefono: '662 340 718', email: 'laura.gomez.ib@gmail.com', desde: 2021 },
  ];

  const coches: Coche[] = [
    { id: 'v1', clienteId: 'c1', matricula: '4821 KLM', modelo: 'Seat León 1.5 TSI FR', anio: 2018, combustible: 'Gasolina' },
    { id: 'v2', clienteId: 'c2', matricula: '7390 LBN', modelo: 'Renault Clio V 1.0 TCe 90', anio: 2021, combustible: 'Gasolina' },
    { id: 'v3', clienteId: 'c3', matricula: '2156 KZT', modelo: 'Ford Transit Custom 2.0 TDCi', anio: 2019, combustible: 'Diésel' },
    { id: 'v4', clienteId: 'c3', matricula: '6120 LGH', modelo: 'Ford Transit Connect 1.5 EcoBlue', anio: 2020, combustible: 'Diésel' },
    { id: 'v5', clienteId: 'c4', matricula: '9043 JHX', modelo: 'Volkswagen Golf VII 1.6 TDI', anio: 2016, combustible: 'Diésel' },
    { id: 'v6', clienteId: 'c5', matricula: '3317 MCD', modelo: 'Toyota Corolla 125H', anio: 2023, combustible: 'Híbrido' },
    { id: 'v7', clienteId: 'c6', matricula: '5582 KVB', modelo: 'Peugeot 308 1.2 PureTech', anio: 2019, combustible: 'Gasolina' },
    { id: 'v8', clienteId: 'c7', matricula: '1209 JKS', modelo: 'Citroën Berlingo 1.6 BlueHDi', anio: 2017, combustible: 'Diésel' },
    { id: 'v9', clienteId: 'c7', matricula: '8237 KFD', modelo: 'Peugeot Partner 1.6 HDi', anio: 2018, combustible: 'Diésel' },
    { id: 'v10', clienteId: 'c8', matricula: '6674 LFR', modelo: 'Kia Sportage 1.6 CRDi', anio: 2020, combustible: 'Diésel' },
    { id: 'v11', clienteId: 'c9', matricula: '8820 HBD', modelo: 'Opel Corsa 1.4', anio: 2015, combustible: 'Gasolina' },
    { id: 'v12', clienteId: 'c10', matricula: '4471 KPW', modelo: 'Dacia Sandero 1.0 SCe', anio: 2018, combustible: 'Gasolina' },
    { id: 'v13', clienteId: 'c11', matricula: '0395 JZL', modelo: 'BMW 118d', anio: 2017, combustible: 'Diésel' },
    { id: 'v14', clienteId: 'c12', matricula: '7718 KXM', modelo: 'Hyundai i30 1.4', anio: 2019, combustible: 'Gasolina' },
  ];

  // ——— Ayudas para montar órdenes ———
  const deTarifa = (tid: string, quien: PersonaId, cuando: string, cantidad = 1): Trabajo => {
    const s = servicio(tid);
    return { id: id('tr'), descripcion: s.nombre, precio: s.precio * cantidad, origen: 'tarifa', tarifaId: tid, cantidad, hechoPor: quien, cuando };
  };
  const aMano = (descripcion: string, precio: number, quien: PersonaId, cuando: string): Trabajo =>
    ({ id: id('tr'), descripcion, precio, origen: 'mano', cantidad: 1, hechoPor: quien, cuando });
  const pieza = (descripcion: string, estado: Pieza['estado'], cuando: string, nota?: string): Pieza =>
    ({ id: id('pz'), descripcion, estado, nota, cuando });
  const obs = (texto: string, quien: PersonaId, cuando: string, recomendacion = false): Observacion =>
    ({ id: id('ob'), texto, recomendacion, quien, cuando });
  const ev = (cuando: string, quien: string, texto: string): Evento => ({ id: id('ev'), cuando, quien, texto });

  const orden = (o: Omit<Orden, 'informes'>): Orden => ({ ...o, informes: {} });

  const abiertas: Orden[] = [
    orden({
      id: 'OT-1038', cocheId: 'v13', estado: 'pieza', km: 164300, mecanicoId: 'javi', entrada: t(atras(4), '08:30'),
      motivo: 'Pérdida de potencia y humo negro al acelerar.',
      trabajos: [
        deTarifa('t-diagnosis', 'javi', t(atras(4), '12:40')),
        aMano('Desmontaje y limpieza de la válvula EGR', 60, 'javi', t(atras(3), '10:15')),
      ],
      piezas: [pieza('Válvula EGR Pierburg 7.02246.28', 'pedida', t(atras(3), '10:30'), 'retraso del proveedor')],
      observaciones: [
        obs('La válvula EGR está bloqueada; la limpieza no basta y hay que sustituirla.', 'javi', t(atras(3), '10:15')),
        obs('El cliente pide que le llamen cuando llegue la pieza.', 'paco', t(atras(2), '10:20')),
      ],
      historial: [
        ev(t(atras(4), '08:30'), 'Paco', 'Orden abierta. Coche recibido. Venía con cita.'),
        ev(t(atras(4), '09:10'), 'Javi', 'Estado: Recibido → Diagnóstico.'),
        ev(t(atras(4), '12:40'), 'Javi', 'Trabajo apuntado: Diagnosis electrónica · 45,00 €.'),
        ev(t(atras(3), '10:15'), 'Javi', 'Trabajo apuntado: Desmontaje y limpieza de la válvula EGR · 60,00 €.'),
        ev(t(atras(3), '10:15'), 'Javi', 'Observación añadida: La válvula EGR está bloqueada; la limpieza no basta y hay que sustituirla.'),
        ev(t(atras(3), '10:30'), 'Paco', 'Pieza añadida: Válvula EGR Pierburg 7.02246.28 (Pedida).'),
        ev(t(atras(3), '10:31'), 'Paco', 'Estado: Diagnóstico → Esperando pieza.'),
        ev(t(atras(2), '10:20'), 'Paco', 'Pieza: Válvula EGR Pierburg 7.02246.28 → Pedida · retraso del proveedor.'),
        ev(t(atras(2), '10:21'), 'Paco', 'Observación añadida: El cliente pide que le llamen cuando llegue la pieza.'),
      ],
    }),
    orden({
      id: 'OT-1039', cocheId: 'v7', estado: 'listo', km: 96310, mecanicoId: 'ruben', entrada: t(atras(3), '09:00'),
      motivo: 'Cambio de correa de distribución (aviso en el cuadro).',
      trabajos: [
        deTarifa('t-distribucion', 'ruben', t(atras(2), '17:10')),
        deTarifa('t-aceite', 'ruben', t(atras(1), '11:00')),
      ],
      piezas: [],
      observaciones: [obs('Próximo cambio de correa de distribución a los 196.000 km.', 'ruben', t(atras(1), '17:40'), true)],
      historial: [
        ev(t(atras(3), '09:00'), 'Lucía', 'Orden abierta. Coche recibido. Venía con cita.'),
        ev(t(atras(3), '09:40'), 'Rubén', 'Estado: Recibido → En reparación.'),
        ev(t(atras(2), '17:10'), 'Rubén', 'Trabajo apuntado: Kit de distribución · 480,00 €.'),
        ev(t(atras(1), '11:00'), 'Rubén', 'Trabajo apuntado: Cambio de aceite y filtros · 89,00 €.'),
        ev(t(atras(1), '17:40'), 'Rubén', 'Recomendación para el informe: Próximo cambio de correa de distribución a los 196.000 km.'),
        ev(t(atras(1), '17:41'), 'Rubén', 'Estado: En reparación → Listo para recoger.'),
      ],
    }),
    orden({
      id: 'OT-1040', cocheId: 'v3', estado: 'pieza', km: 187450, mecanicoId: 'javi', entrada: t(atras(3), '08:30'),
      motivo: 'Patina el embrague al subir cuestas con carga.',
      trabajos: [deTarifa('t-diagnosis', 'javi', t(atras(3), '13:00'))],
      piezas: [pieza('Kit de embrague con volante bimasa LuK 600 0335 00', 'pedida', t(atras(2), '09:00'), `llega el ${nombreDia(d1)}`)],
      observaciones: [obs('El volante bimasa está desgastado: se cambia junto al embrague. El bimasa va aparte de la tarifa.', 'javi', t(atras(3), '13:02'))],
      historial: [
        ev(t(atras(3), '08:30'), 'Paco', 'Orden abierta. Coche recibido. Venía con cita.'),
        ev(t(atras(3), '13:00'), 'Javi', 'Estado: Recibido → Diagnóstico.'),
        ev(t(atras(3), '13:00'), 'Javi', 'Trabajo apuntado: Diagnosis electrónica · 45,00 €.'),
        ev(t(atras(3), '13:02'), 'Javi', 'Observación añadida: El volante bimasa está desgastado: se cambia junto al embrague. El bimasa va aparte de la tarifa.'),
        ev(t(atras(2), '09:00'), 'Paco', `Pieza añadida: Kit de embrague con volante bimasa LuK 600 0335 00 (Pedida · llega el ${nombreDia(d1)}).`),
        ev(t(atras(2), '09:01'), 'Paco', 'Estado: Diagnóstico → Esperando pieza.'),
      ],
    }),
    orden({
      id: 'OT-1041', cocheId: 'v1', estado: 'reparacion', km: 84120, mecanicoId: 'javi', entrada: t(atras(2), '08:32'),
      motivo: 'Ruido metálico al frenar y vibración en el volante a partir de 90 km/h.',
      trabajos: [deTarifa('t-diagnosis', 'javi', t(atras(2), '11:10'))],
      piezas: [pieza('Pastillas delanteras Brembo P 85 153', 'recibida', t(atras(2), '11:25'))],
      observaciones: [obs('El cliente pide que se revise el nivel de aceite.', 'lucia', t(atras(2), '08:33'))],
      historial: [
        ev(t(atras(2), '08:32'), 'Lucía', 'Orden abierta. Coche recibido. Venía con cita.'),
        ev(t(atras(2), '08:33'), 'Lucía', 'Observación añadida: El cliente pide que se revise el nivel de aceite.'),
        ev(t(atras(2), '11:10'), 'Javi', 'Estado: Recibido → Diagnóstico.'),
        ev(t(atras(2), '11:10'), 'Javi', 'Trabajo apuntado: Diagnosis electrónica · 45,00 €.'),
        ev(t(atras(2), '11:25'), 'Paco', 'Pieza añadida: Pastillas delanteras Brembo P 85 153 (Pedida).'),
        ev(t(atras(2), '11:26'), 'Paco', 'Estado: Diagnóstico → Esperando pieza.'),
        ev(t(atras(1), '09:15'), 'Javi', 'Pieza: Pastillas delanteras Brembo P 85 153 → Recibida.'),
        ev(t(atras(1), '09:15'), 'Javi', 'Estado: Esperando pieza → En reparación.'),
      ],
    }),
    orden({
      id: 'OT-1042', cocheId: 'v11', estado: 'diagnostico', km: 131500, mecanicoId: 'marta', entrada: t(atras(2), '09:00'),
      motivo: 'El elevalunas del conductor no sube y a veces no arranca a la primera.',
      trabajos: [deTarifa('t-diagnosis', 'marta', t(atras(1), '16:00'))],
      piezas: [],
      observaciones: [obs('Posible fallo de masa. Revisar el conector de la puerta del conductor.', 'marta', t(atras(1), '16:01'))],
      historial: [
        ev(t(atras(2), '09:00'), 'Lucía', 'Orden abierta. Coche recibido. Venía con cita.'),
        ev(t(atras(1), '15:20'), 'Marta', 'Estado: Recibido → Diagnóstico.'),
        ev(t(atras(1), '16:00'), 'Marta', 'Trabajo apuntado: Diagnosis electrónica · 45,00 €.'),
        ev(t(atras(1), '16:01'), 'Marta', 'Observación añadida: Posible fallo de masa. Revisar el conector de la puerta del conductor.'),
      ],
    }),
    orden({
      id: 'OT-1043', cocheId: 'v2', estado: 'diagnostico', km: 41870, mecanicoId: 'ruben', entrada: t(atras(1), '08:40'),
      motivo: 'Testigo de motor encendido y tirones al acelerar en frío.',
      trabajos: [deTarifa('t-diagnosis', 'ruben', t(atras(1), '12:30'))],
      piezas: [],
      observaciones: [
        obs(`Carmen lo necesita el ${nombreDia(d2)} sin falta.`, 'lucia', t(atras(1), '08:41')),
        obs('Fallo de encendido en el cilindro 2. Revisando bobina y bujías.', 'ruben', t(atras(1), '12:31')),
      ],
      historial: [
        ev(t(atras(1), '08:40'), 'Lucía', 'Orden abierta. Coche recibido. Venía con cita.'),
        ev(t(atras(1), '08:41'), 'Lucía', `Observación añadida: Carmen lo necesita el ${nombreDia(d2)} sin falta.`),
        ev(t(atras(1), '12:30'), 'Rubén', 'Estado: Recibido → Diagnóstico.'),
        ev(t(atras(1), '12:30'), 'Rubén', 'Trabajo apuntado: Diagnosis electrónica · 45,00 €.'),
        ev(t(atras(1), '12:31'), 'Rubén', 'Observación añadida: Fallo de encendido en el cilindro 2. Revisando bobina y bujías.'),
      ],
    }),
    orden({
      id: 'OT-1044', cocheId: 'v10', estado: 'reparacion', km: 58200, mecanicoId: 'marta', entrada: t(atras(1), '09:00'),
      motivo: 'El aire acondicionado no enfría.',
      trabajos: [
        deTarifa('t-diagnosis', 'marta', t(atras(1), '13:15')),
        deTarifa('t-aire', 'marta', t(ref, '09:40')),
      ],
      piezas: [],
      observaciones: [obs('Sin fugas visibles. Comprobar la presión después de la carga.', 'marta', t(atras(1), '13:16'))],
      historial: [
        ev(t(atras(1), '09:00'), 'Lucía', 'Orden abierta. Coche recibido. Venía con cita.'),
        ev(t(atras(1), '13:15'), 'Marta', 'Estado: Recibido → Diagnóstico.'),
        ev(t(atras(1), '13:15'), 'Marta', 'Trabajo apuntado: Diagnosis electrónica · 45,00 €.'),
        ev(t(atras(1), '13:16'), 'Marta', 'Observación añadida: Sin fugas visibles. Comprobar la presión después de la carga.'),
        ev(t(ref, '09:30'), 'Marta', 'Estado: Diagnóstico → En reparación.'),
        ev(t(ref, '09:40'), 'Marta', 'Trabajo apuntado: Carga de aire acondicionado · 75,00 €.'),
      ],
    }),
    orden({
      id: 'OT-1045', cocheId: 'v5', estado: 'recibido', km: 118200, mecanicoId: 'ruben', entrada: t(ref, '08:35'),
      motivo: 'Revisión de los 120.000 km y pre-ITV.',
      trabajos: [], piezas: [], observaciones: [],
      historial: [ev(t(ref, '08:35'), 'Lucía', 'Orden abierta. Coche recibido. Venía con cita. Llaves en el buzón.')],
    }),
    orden({
      id: 'OT-1046', cocheId: 'v6', estado: 'recibido', km: 22940, mecanicoId: 'marta', entrada: t(ref, '09:05'),
      motivo: 'Revisión anual y ruido en la rueda trasera derecha.',
      trabajos: [], piezas: [],
      observaciones: [obs('Híbrido: revisar la batería de 12 V.', 'lucia', t(ref, '09:06'))],
      historial: [
        ev(t(ref, '09:05'), 'Lucía', 'Orden abierta. Coche recibido. Venía con cita.'),
        ev(t(ref, '09:06'), 'Lucía', 'Observación añadida: Híbrido: revisar la batería de 12 V.'),
      ],
    }),
  ];

  // ——— 20 órdenes cerradas de los últimos tres meses ———
  type LineaCerrada = [string, number?]; // [servicio de tarifa o descripción, cantidad o precio a mano]
  const cerrada = (num: number, cocheId: string, cierre: number, duracion: number, km: number, mec: PersonaId,
    motivo: string, lineas: LineaCerrada[], recomendacion?: string): Orden => {
    const diaCierre = atras(cierre);
    const diaEntrada = atras(cierre + duracion);
    const trabajos = lineas.map(([que, n]) => (que.startsWith('t-')
      ? deTarifa(que, mec, t(diaCierre, '12:00'), n ?? 1)
      : aMano(que, n ?? 0, mec, t(diaCierre, '12:00'))));
    const quien = nombrePersona(mec);
    const historial: Evento[] = [
      ev(t(diaEntrada, '08:30'), 'Lucía', 'Orden abierta. Coche recibido.'),
      ...trabajos.map((w) => ev(w.cuando, quien, `Trabajo apuntado: ${w.descripcion}${w.cantidad > 1 ? ` (${w.cantidad} uds.)` : ''} · ${eur(w.precio ?? 0)}.`)),
      ev(t(diaCierre, '13:00'), quien, `Estado: Recibido → Listo para recoger.`),
      ev(t(diaCierre, '18:30'), 'Lucía', 'Coche entregado al cliente. Orden cerrada.'),
    ];
    const observaciones = recomendacion ? [obs(recomendacion, mec, t(diaCierre, '12:30'), true)] : [];
    return orden({
      id: `OT-${num}`, cocheId, estado: 'entregado' as EstadoOrden, km, mecanicoId: mec,
      entrada: t(diaEntrada, '08:30'), cierre: t(diaCierre, '18:30'), motivo, trabajos, piezas: [], observaciones, historial,
    });
  };

  const cerradas: Orden[] = [
    cerrada(1018, 'v8', 63, 2, 138600, 'javi', 'Patina el embrague.', [['t-embrague']]),
    cerrada(1019, 'v2', 61, 0, 38900, 'ruben', 'Cambio de aceite y pre-ITV.', [['t-aceite'], ['t-preitv']]),
    cerrada(1020, 'v6', 58, 0, 19200, 'ruben', 'Cambiar los cuatro neumáticos.', [['t-neumatico', 4], ['t-alineado']]),
    cerrada(1021, 'v13', 57, 1, 161900, 'javi', 'Chirrían los frenos.', [['t-discos-tras'], ['t-pastillas']]),
    cerrada(1022, 'v5', 55, 0, 114800, 'marta', 'El aire acondicionado no enfría bien.', [['t-aire']]),
    cerrada(1023, 'v1', 51, 0, 79950, 'javi', 'Cambio de aceite; la dirección tira a la derecha.', [['t-aceite'], ['t-alineado']]),
    cerrada(1024, 'v9', 49, 1, 156300, 'javi', 'Cambio de distribución por kilómetros.', [['t-distribucion'], ['t-aceite']]),
    cerrada(1025, 'v3', 46, 0, 181200, 'javi', 'Vibra al frenar.', [['t-discos-del']]),
    cerrada(1026, 'v7', 42, 0, 93400, 'javi', 'Testigo de frenos encendido.', [['t-diagnosis'], ['t-pastillas']]),
    cerrada(1027, 'v12', 40, 0, 72800, 'ruben', 'Pasar la ITV; neumáticos traseros gastados.', [['t-preitv'], ['t-neumatico', 2]],
      'Neumáticos delanteros al 40 %: cambiarlos antes del invierno.'),
    cerrada(1028, 'v10', 36, 0, 55900, 'marta', 'Cambio de aceite.', [['t-aceite']]),
    cerrada(1029, 'v4', 31, 0, 101300, 'marta', 'Revisión; le cuesta arrancar por las mañanas.', [['t-aceite'], ['t-bateria']]),
    cerrada(1030, 'v11', 25, 0, 130400, 'marta', 'No arranca por las mañanas.', [['t-diagnosis'], ['t-bateria']]),
    cerrada(1031, 'v8', 20, 1, 141900, 'ruben', 'Pierde refrigerante.', [['t-aceite'], ['Sustitución de manguito de refrigeración', 68]]),
    cerrada(1032, 'v14', 15, 0, 65800, 'marta', 'Cambio de aceite y aire acondicionado.', [['t-aceite'], ['t-aire']]),
    cerrada(1033, 'v3', 12, 0, 185900, 'ruben', 'Cambio de aceite y ruedas delanteras.', [['t-aceite'], ['t-neumatico', 2]]),
    cerrada(1034, 'v9', 10, 0, 160050, 'marta', 'Pre-ITV y luces de cruce.', [['t-preitv'], ['Lámparas de cruce (2 uds.)', 24]]),
    cerrada(1035, 'v4', 7, 0, 104100, 'javi', 'Ruido al frenar.', [['t-pastillas']]),
    cerrada(1036, 'v14', 6, 1, 66900, 'ruben', 'Vibración al frenar.', [['t-diagnosis'], ['t-discos-del']],
      'Discos traseros al límite: cambiarlos en la próxima revisión.'),
    cerrada(1037, 'v12', 4, 1, 73900, 'ruben', 'Luces de cruce fundidas y la dirección tira.', [['Lámparas de cruce (2 uds.)', 24], ['t-alineado']]),
  ];

  // ——— Citas ———
  const cita = (fecha: string, hora: string, nombre: string, telefono: string, matricula: string, coche: string,
    motivo: string, extra: Partial<Cita> = {}): Cita => ({
    id: id('ci'), fecha, hora, nombre, telefono, matricula, coche, motivo, origen: 'taller', creada: t(atras(5), '10:00'), ...extra,
  });

  const citas: Cita[] = [
    cita(atras(4), '08:30', 'David Navarro', '608 913 245', '0395 JZL', 'BMW 118d', 'Pérdida de potencia', { clienteId: 'c11', ordenId: 'OT-1038' }),
    cita(atras(3), '08:30', 'Reformas Hidalgo', '916 81 44 27', '2156 KZT', 'Ford Transit Custom', 'Patina el embrague', { clienteId: 'c3', ordenId: 'OT-1040' }),
    cita(atras(3), '09:00', 'Miguel Ángel Torres', '699 457 012', '5582 KVB', 'Peugeot 308', 'Correa de distribución', { clienteId: 'c6', ordenId: 'OT-1039' }),
    cita(atras(2), '08:30', 'Juan García', '612 345 781', '4821 KLM', 'Seat León', 'Ruido al frenar', { clienteId: 'c1', ordenId: 'OT-1041' }),
    cita(atras(2), '09:00', 'Sergio Díaz', '611 204 889', '8820 HBD', 'Opel Corsa', 'Elevalunas y arranque', { clienteId: 'c9', ordenId: 'OT-1042' }),
    cita(atras(1), '08:30', 'Carmen López', '655 902 114', '7390 LBN', 'Renault Clio', 'Testigo de motor', { clienteId: 'c2', ordenId: 'OT-1043' }),
    cita(atras(1), '09:00', 'Elena Martín', '644 781 330', '6674 LFR', 'Kia Sportage', 'Aire acondicionado', { clienteId: 'c8', ordenId: 'OT-1044' }),
    cita(ref, '08:30', 'Alberto Moreno', '678 230 556', '9043 JHX', 'Volkswagen Golf', 'Revisión 120.000 km y pre-ITV', { clienteId: 'c4', ordenId: 'OT-1045' }),
    cita(ref, '09:00', 'Pilar Sánchez', '620 118 473', '3317 MCD', 'Toyota Corolla', 'Revisión anual', { clienteId: 'c5', ordenId: 'OT-1046' }),
    cita(d1, '08:30', 'Marcos Gil', '634 118 902', '5510 LMT', 'Audi A3', 'Cambio de aceite y filtros', { origen: 'ia', conversacionId: 'cv-marcos', creada: t(ref, '08:47') }),
    cita(d1, '09:30', 'Reformas Hidalgo', '916 81 44 27', '6120 LGH', 'Ford Transit Connect', 'Cambio de aceite y filtros', { clienteId: 'c3' }),
    cita(d2, '09:00', 'Beatriz Castro', '649 773 015', '8841 MFZ', 'Mazda CX-5', 'Ruido en el motor en frío'),
    cita(d2, '10:00', 'Antonio Pérez', '615 482 390', '1176 NBC', 'Seat Arona', 'Neumáticos delanteros'),
    cita(adelante(3), '09:00', 'Rosa Fernández', '637 552 091', '4471 KPW', 'Dacia Sandero', 'Pre-ITV', { clienteId: 'c10' }),
  ];

  // ——— Conversaciones ———
  type Linea = [Mensaje['de'], string, string, string?]; // de, cuándo, texto, autor
  const conv = (c: Omit<Conversacion, 'mensajes' | 'actualizada' | 'creada'>, lineas: Linea[]): Conversacion => {
    const mensajes: Mensaje[] = lineas.map(([de, cuando, texto, autor]) => ({ id: id('m'), de, cuando, texto, autor }));
    return { ...c, mensajes, creada: mensajes[0].cuando, actualizada: mensajes[mensajes.length - 1].cuando };
  };

  const conversaciones: Conversacion[] = [
    conv({ id: 'cv-carmen', clienteId: 'c2', nombre: 'Carmen López', canal: 'WhatsApp', contacto: '655 902 114', modo: 'persona',
      necesitaPersona: true, motivo: `Pregunta si estará el ${nombreDia(d2)}` }, [
      ['cliente', t(ref, '09:58'), 'Hola, buenos días. ¿Cómo va el Clio? Es el 7390 LBN, orden OT-1043.'],
      ['ia', t(ref, '09:58'), 'Hola, Carmen. Tu Renault Clio (7390 LBN) está en diagnóstico: Rubén está revisando por qué se enciende el testigo del motor. De momento se ha hecho la diagnosis electrónica, así que van 45,00 €.'],
      ['cliente', t(ref, '10:40'), `Vale. Lo necesito el ${nombreDia(d2)} sin falta, que me voy de viaje. ¿Llegáis?`],
      ['ia', t(ref, '10:41'), 'No te puedo confirmar una fecha de entrega. Se lo paso a Lucía, de recepción, que te contesta por aquí.'],
    ]),
    conv({ id: 'cv-flota', nombre: 'Logística Sur Madrid S.L.', canal: 'Email', contacto: 'flota@logisticasurmadrid.es', modo: 'persona',
      necesitaPersona: true, motivo: 'Pide precio para una flota de 5 furgonetas' }, [
      ['cliente', t(ref, '08:12'), 'Buenos días:\n\nSomos una empresa de reparto de Getafe con cinco furgonetas (tres Renault Kangoo y dos Citroën Berlingo). Querríamos hacerles la revisión y el cambio de aceite a las cinco antes de fin de mes y, si puede ser, llegar a un acuerdo de mantenimiento para todo el año.\n\n¿Qué precio nos haríais?\n\nUn saludo,\nIsabel Romero\nResponsable de flota · Logística Sur Madrid S.L.'],
      ['ia', t(ref, '08:13'), 'Buenos días, Isabel. Según nuestra tarifa, el cambio de aceite y filtros cuesta 89,00 € por vehículo (IVA incluido). El acuerdo de mantenimiento para las cinco furgonetas no lo puedo cerrar yo: se lo paso a Paco, el responsable del taller, que le contestará por este mismo correo.'],
    ]),
    conv({ id: 'cv-david', clienteId: 'c11', nombre: 'David Navarro', canal: 'WhatsApp', contacto: '608 913 245', modo: 'persona',
      necesitaPersona: false }, [
      ['cliente', t(atras(1), '17:20'), 'Llevo casi una semana sin coche y nadie me dice nada. Esto es una vergüenza.'],
      ['ia', t(atras(1), '17:20'), 'Siento mucho las molestias, David. Se lo paso a Lucía, de recepción, para que lo vea contigo. Te contesta por aquí.'],
      ['persona', t(atras(1), '17:34'), 'David, perdona. La válvula EGR la tiene el proveedor y se ha retrasado. En cuanto llegue, Javi la monta ese mismo día. Mañana a primera hora te llamo y te lo cuento.', 'Lucía'],
      ['cliente', t(ref, '09:10'), `Más os vale. Si el ${nombreDia(d2)} no está, me lo llevo a otro taller.`],
      ['persona', t(ref, '09:24'), 'Entendido, David. Te llamo esta mañana y lo vemos con calma.', 'Lucía'],
    ]),
    conv({ id: 'cv-laura', clienteId: 'c12', nombre: 'Laura Gómez', canal: 'WhatsApp', contacto: '662 340 718', modo: 'ia',
      necesitaPersona: false }, [
      ['cliente', t(ref, '08:51'), 'Buenas, ¿cuánto cuesta el cambio de aceite para el i30?'],
      ['ia', t(ref, '08:51'), 'Hola, Laura. El cambio de aceite y filtros cuesta 89,00 € (IVA incluido). Si quieres, te busco hueco para traerlo.'],
      ['cliente', t(ref, '08:53'), 'Vale, lo miro y os digo.'],
    ]),
    conv({ id: 'cv-marcos', nombre: 'Marcos Gil', canal: 'Web', contacto: '634 118 902', modo: 'ia', necesitaPersona: false }, [
      ['cliente', t(ref, '08:44'), 'Hola, quería pedir cita para cambiar el aceite a un Audi A3'],
      ['ia', t(ref, '08:44'), `Hola. Tengo hueco el ${fmtDiaMedio(d1)} a las 8:30 o a las 10:00, o el ${fmtDiaMedio(d2)} a las 9:30. El cambio de aceite y filtros cuesta 89,00 € (IVA incluido). ¿Te va bien alguno? Para reservarlo necesito tu nombre, tu teléfono y la matrícula.`],
      ['cliente', t(ref, '08:46'), `El ${nombreDia(d1)} a las 8:30. Soy Marcos Gil, 634 118 902, matrícula 5510 LMT`],
      ['ia', t(ref, '08:47'), `Hecho, Marcos. Te he reservado cita el ${fmtDiaLargo(d1)} a las 8:30 para el Audi A3 (5510 LMT). Si necesitas cambiarla, escríbenos por aquí.`],
    ]),
    conv({ id: 'cv-juan', clienteId: 'c1', nombre: 'Juan García', canal: 'WhatsApp', contacto: '612 345 781', modo: 'ia', necesitaPersona: false }, [
      ['cliente', t(atras(1), '18:02'), 'Hola, ¿para cuándo estaría el León?'],
      ['ia', t(atras(1), '18:02'), 'Hola. Para contarte cómo va el coche necesito la matrícula y el código de la orden: empieza por OT y viene en el resguardo que te dimos al dejarlo.'],
      ['cliente', t(atras(1), '18:04'), 'Es el 4821 KLM, la orden OT-1041'],
      ['ia', t(atras(1), '18:04'), 'Gracias, Juan. Tu Seat León (4821 KLM) está en reparación: ya han llegado las pastillas delanteras y Javi está con él. Hasta ahora se le ha hecho la diagnosis electrónica, así que van 45,00 €. Fecha de entrega no te puedo dar; si la necesitas, te paso con recepción.'],
      ['cliente', t(atras(1), '18:05'), 'Vale, gracias.'],
    ]),
  ];

  return {
    clientes,
    coches,
    ordenes: [...cerradas, ...abiertas],
    tarifa,
    citas,
    conversaciones,
    siguienteOrden: 1047,
    visitantesWeb: 0,
    creada: new Date(ahora).toISOString(),
  };
}
