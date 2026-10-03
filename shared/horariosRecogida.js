export const ZONA_RECOGIDA = 'Europe/Madrid';
export const DIAS_RECOGIDA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MINUTO = 60_000;
const SEMANA = 7 * 1440;
const formatoLocal = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_RECOGIDA, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const dias = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const formatoDia = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONA_RECOGIDA, weekday: 'short', day: 'numeric', month: 'short',
});

const minutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
const duracion = (franja) => (minutos(franja.fin) - minutos(franja.inicio) + 1440) % 1440;

export function validarHorariosRecogida(horarios) {
  if (!Array.isArray(horarios) || horarios.length === 0 || horarios.length > 28) {
    throw new Error('Selecciona al menos una franja de recogida (máximo 28).');
  }
  const ocupados = new Set();
  const normalizados = horarios.map(({ dia, inicio, fin }) => {
    const patron = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!Number.isInteger(dia) || dia < 0 || dia > 6 || !patron.test(inicio) || !patron.test(fin)) {
      throw new Error('Los días y horas de recogida no son válidos.');
    }
    const franja = { dia, inicio, fin };
    const longitud = duracion(franja);
    if (longitud < 30) throw new Error('Cada franja de recogida debe durar al menos 30 minutos.');
    const desde = dia * 1440 + minutos(inicio);
    for (let i = 0; i < longitud; i++) {
      const minuto = (desde + i) % SEMANA;
      if (ocupados.has(minuto)) throw new Error('Las franjas de recogida no pueden solaparse.');
      ocupados.add(minuto);
    }
    return franja;
  });
  return normalizados.sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
}

function datosLocales(fecha) {
  const partes = Object.fromEntries(formatoLocal.formatToParts(fecha).map(p => [p.type, p.value]));
  return {
    dia: dias.indexOf(partes.weekday),
    minuto: Number(partes.hour) * 60 + Number(partes.minute),
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

function minutosRestantes(horarios, fecha) {
  const local = datosLocales(fecha);
  const actual = local.dia * 1440 + local.minuto;
  return Math.max(0, ...horarios.map(franja => {
    const desde = franja.dia * 1440 + minutos(franja.inicio);
    const transcurridos = (actual - desde + SEMANA) % SEMANA;
    return Math.max(0, duracion(franja) - transcurridos);
  }));
}

// NULL conserva el comportamiento de los restaurantes registrados antes de esta función.
export function recogidaDisponible(horarios, fecha = new Date(), margenMinutos = 0) {
  if (Number.isNaN(fecha.getTime())) return false;
  if (horarios == null) return true;
  const restantes = minutosRestantes(horarios, fecha);
  const fraccion = (fecha.getSeconds() * 1000 + fecha.getMilliseconds()) / MINUTO;
  if (!(restantes > 0 && restantes - fraccion >= margenMinutos)) return false;
  // Un cambio de hora puede saltar por encima del cierre en una franja nocturna.
  if (margenMinutos > 0) {
    const ultimoInstante = new Date(fecha.getTime() + margenMinutos * MINUTO - 1);
    return minutosRestantes(horarios, ultimoInstante) > 0;
  }
  return true;
}

export function validarFechaRecogida(horarios, fechaProgramada, ahora = new Date()) {
  if (!fechaProgramada) {
    if (!recogidaDisponible(horarios, ahora, 15)) {
      throw new Error('La recogida inmediata no está disponible. Selecciona una hora dentro del horario del local.');
    }
    return null;
  }
  const fecha = new Date(/^\d+$/.test(String(fechaProgramada)) ? Number(fechaProgramada) : fechaProgramada);
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() < ahora.getTime() + 15 * MINUTO) {
    throw new Error('La recogida debe programarse con al menos 15 minutos de antelación.');
  }
  if (!recogidaDisponible(horarios, fecha, 30)) {
    throw new Error('La hora elegida está fuera del horario de recogida del local.');
  }
  return fecha.toISOString();
}

export function generarOpcionesRecogida(horarios, ahora = new Date()) {
  // Los locales antiguos conservan las franjas habituales mientras no tengan un horario configurado.
  const franjas = horarios ?? DIAS_RECOGIDA.map((_, dia) => ({ dia, inicio: '12:00', fin: '23:30' }));
  const inicio = Math.ceil((ahora.getTime() + 15 * MINUTO) / MINUTO) * MINUTO;
  const minutosInicio = new Set(franjas.map(franja => minutos(franja.inicio) % 15));
  const fechaHoy = datosLocales(ahora).fecha;
  const fechaLimite = new Date(`${fechaHoy}T12:00:00Z`);
  fechaLimite.setUTCDate(fechaLimite.getUTCDate() + 6);
  const ultimaFecha = fechaLimite.toISOString().slice(0, 10);
  const grupos = new Map();
  for (let instante = inicio; instante < inicio + 8 * 1440 * MINUTO; instante += MINUTO) {
    if (!minutosInicio.has(Math.floor(instante / MINUTO) % 15)) continue;
    const fecha = new Date(instante);
    const local = datosLocales(fecha);
    if (local.fecha > ultimaFecha) break;
    const minutoSemana = local.dia * 1440 + local.minuto;
    const empiezaEnFranja = franjas.some(franja => {
      const desde = franja.dia * 1440 + minutos(franja.inicio);
      const transcurridos = (minutoSemana - desde + SEMANA) % SEMANA;
      return transcurridos < duracion(franja) && transcurridos % 15 === 0;
    });
    if (!empiezaEnFranja) continue;
    if (!recogidaDisponible(franjas, fecha, 30)) continue;
    if (!grupos.has(local.fecha)) {
      const etiqueta = formatoDia.format(fecha);
      grupos.set(local.fecha, { valor: local.fecha, etiqueta: local.fecha === fechaHoy ? `Hoy, ${etiqueta}` : etiqueta, horas: [] });
    }
    const fin = datosLocales(new Date(instante + 30 * MINUTO));
    grupos.get(local.fecha).horas.push({ valor: fecha.toISOString(), etiqueta: `${local.hora} - ${fin.hora}` });
  }
  return [...grupos.values()];
}
