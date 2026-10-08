import './EstadoDisponibilidad.css';

export default function EstadoDisponibilidad({ cerrado = false, fecha, compacto = false }) {
  const valor = fecha && String(fecha).trim();
  const fechaDisponible = valor ? new Date(Number.isFinite(Number(valor)) ? Number(valor) : valor) : null;
  const tieneFecha = fechaDisponible && !Number.isNaN(fechaDisponible.getTime());
  const tipo = cerrado ? 'cerrado' : tieneFecha ? 'pausado' : 'agotado';
  const titulo = cerrado ? 'Cerrado' : tieneFecha ? 'No disponible' : 'Agotado';
  const detalle = tieneFecha
    ? (cerrado ? 'Vuelve a abrir: ' : 'Disponible de nuevo: ') + fechaDisponible.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
    : cerrado ? 'No acepta pedidos ahora' : 'No disponible por el momento';

  return <div className={'estado-disponibilidad estado-disponibilidad-' + tipo + (compacto ? ' estado-disponibilidad-compacto' : '')}>
    <span className="estado-disponibilidad-icono" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {cerrado ? <><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M8 3v18M16 12h.01" /><path d="m11 6 6 3" /></>
          : tieneFecha ? <><circle cx="12" cy="12" r="9" /><path d="M9 8v8M15 8v8" /></>
          : <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>}
      </svg>
    </span>
    <span className="estado-disponibilidad-texto"><strong>{titulo}</strong><span>{detalle}</span></span>
  </div>;
}
