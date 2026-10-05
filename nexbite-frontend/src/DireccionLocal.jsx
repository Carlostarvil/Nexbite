import { useEffect, useState } from 'react';
import './DireccionLocal.css';

export default function DireccionLocal({ direccion, urlMapa }) {
  const [estado, setEstado] = useState('');
  useEffect(() => {
    if (estado !== 'copiada') return;
    const timer = setTimeout(() => setEstado(''), 3000);
    return () => clearTimeout(timer);
  }, [estado]);

  const copiar = async () => {
    setEstado('');
    try {
      await navigator.clipboard.writeText(direccion);
      setEstado('copiada');
    } catch {
      const foco = document.activeElement;
      const entrada = document.createElement('textarea');
      entrada.value = direccion;
      entrada.readOnly = true;
      entrada.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(entrada);
      entrada.select();
      let copiada = false;
      try { copiada = document.execCommand('copy'); } catch { /* El navegador puede bloquear el portapapeles. */ }
      entrada.remove();
      foco?.focus({ preventScroll: true });
      setEstado(copiada ? 'copiada' : 'error');
    }
  };

  return <div className="direccion-local">
    <div className="direccion-local-fila">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
      {urlMapa ? <a href={urlMapa} target="_blank" rel="noopener noreferrer" className="direccion-local-enlace" title="Abrir ubicación del local en Google Maps">
        <span>{direccion}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" /></svg>
      </a> : <span>{direccion}</span>}
    </div>
    {urlMapa && <button type="button" className={'direccion-local-copiar' + (estado === 'copiada' ? ' copiada' : '')} onClick={copiar}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{estado === 'copiada' ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>}</svg>
      {estado === 'copiada' ? 'Copiada' : 'Copiar dirección'}
    </button>}
    <span className={'direccion-local-estado' + (estado === 'error' ? ' error' : '')} role="status">{estado === 'copiada' ? 'Dirección copiada' : estado === 'error' ? 'No se pudo copiar. Selecciona el texto de la dirección para copiarlo.' : ''}</span>
  </div>;
}
