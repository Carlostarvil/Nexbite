import { useId } from 'react';

const PALETAS = {
  ubicacion: ['#ffac52', '#ee5424', '#c7471c'],
  telefono: ['#60b2ff', '#2675d9', '#1c5db3'],
  horario: ['#63d49a', '#2c9e6c', '#247c55'],
  'horario-cerrado': ['#ff939e', '#dd5064', '#b9394b'],
  entrega: ['#b396ff', '#7954dd', '#6441bb'],
};

export default function IconoInfoRestaurante({ tipo, className }) {
  const idGradiente = useId();
  const paleta = PALETAS[tipo];
  const relleno = 'url(#' + idGradiente + ')';
  let dibujo;

  switch (tipo) {
    case 'ubicacion':
      dibujo = <>
        <ellipse cx="32" cy="58" rx="25" ry="3" fill="#27516b" opacity=".1" />
        <path d="m7 30 17-7 16 7 17-7v29l-17 7-16-7-17 7Z" fill="#d8e9ff" stroke="#8bb7e6" strokeWidth="1.5" />
        <path d="M24 23v29l16 7V30Z" fill="#b9d7fa" />
        <path d="m8 42 16-7 16 7 16-7M16 27v28m32-28v28" stroke="#fff" strokeWidth="2.5" />
        <path d="M32 6a15 15 0 0 0-15 15c0 11 15 24 15 24s15-13 15-24A15 15 0 0 0 32 6Z" fill={relleno} stroke={paleta[2]} strokeWidth="1.5" />
        <circle cx="32" cy="21" r="6" fill="#fff" />
        <path d="M22 16a11 11 0 0 1 7-6" stroke="#fff" strokeWidth="2.5" opacity=".55" />
      </>;
      break;
    case 'telefono':
      dibujo = <>
        <ellipse cx="32" cy="58" rx="24" ry="3" fill="#254e85" opacity=".1" />
        <path d="M18 8c-2-1-4-.5-5.5 1L9 12.5c-2 2-2.5 4.8-1.8 7.5c4.4 17.9 18.4 31.9 36.3 36.3c2.7.7 5.5.2 7.5-1.8l3.5-3.5c1.5-1.5 2-3.5 1-5.5l-10-7c-1.8-1.3-4.2-1-5.7.6l-3.6 4.3c-8.2-3.5-14.7-10-18.2-18.2l4.3-3.6c1.6-1.5 1.9-3.9.6-5.7Z" fill={relleno} stroke={paleta[2]} strokeWidth="1.5" />
        <path d="m11 15 7 9m22 19 11 8" stroke="#d6edff" strokeWidth="2.5" />
        <path d="M36 9a20 20 0 0 1 19 19M36 17a12 12 0 0 1 11 11" stroke="#4194e9" strokeWidth="3" />
      </>;
      break;
    case 'horario':
    case 'horario-cerrado':
      dibujo = <>
        <ellipse cx="32" cy="58" rx="23" ry="3" fill={paleta[2]} opacity=".12" />
        <circle cx="32" cy="31" r="25" fill={relleno} stroke={paleta[2]} strokeWidth="1.5" />
        <circle cx="32" cy="31" r="19.5" fill="#fff" />
        <path d="M32 15v3m16 13h-3M32 47v-3M16 31h3" stroke={paleta[2]} strokeWidth="2" />
        <path d="M32 21v10l9 6" stroke={paleta[2]} strokeWidth="3.5" />
        <circle cx="32" cy="31" r="2.8" fill={paleta[2]} />
        <path d="M15 20a20 20 0 0 1 12-10" stroke="#fff" strokeWidth="2.5" opacity=".5" />
      </>;
      break;
    case 'entrega':
      dibujo = <>
        <ellipse cx="32" cy="59" rx="27" ry="3" fill="#48377b" opacity=".12" />
        <rect x="7" y="21" width="25" height="20" rx="4" fill={relleno} stroke={paleta[2]} strokeWidth="1.5" />
        <path d="M19 22v19" stroke="#dbcaff" strokeWidth="2" />
        <rect x="12" y="17" width="15" height="4" rx="2" fill="#ffb05e" />
        <path d="M17 40h18l9-16h5l6 24H16Z" fill={relleno} stroke={paleta[2]} strokeWidth="1.5" />
        <path d="M42 24h9M47 24l-2-10h10M30 35h9" stroke="#59468b" strokeWidth="3.5" />
        <path d="M7 45H3m6-6H3" stroke="#c3adf4" strokeWidth="2.5" />
        <circle cx="18" cy="50" r="9" fill="#394454" />
        <circle cx="50" cy="50" r="9" fill="#394454" />
        <circle cx="18" cy="50" r="4" fill="#f5f1ff" />
        <circle cx="50" cy="50" r="4" fill="#f5f1ff" />
      </>;
      break;
    case 'copiar':
      dibujo = <>
        <rect x="23" y="10" width="30" height="37" rx="5" stroke="currentColor" strokeWidth="4" />
        <path d="M17 20h-1a5 5 0 0 0-5 5v24a5 5 0 0 0 5 5h20a5 5 0 0 0 5-5v-1" stroke="currentColor" strokeWidth="4" />
      </>;
      break;
    case 'copiado':
      dibujo = <path d="m13 33 12 12 27-28" stroke="#237247" strokeWidth="6" />;
      break;
    case 'externo':
      dibujo = <path d="M17 47 47 17M23 17h24v24" stroke="currentColor" strokeWidth="4.5" />;
      break;
    case 'cerrar':
      dibujo = <path d="m17 17 30 30m0-30L17 47" stroke="currentColor" strokeWidth="5" />;
      break;
    default:
      return null;
  }

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paleta && <defs><linearGradient id={idGradiente} x1="12" y1="8" x2="49" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor={paleta[0]} /><stop offset="1" stopColor={paleta[1]} /></linearGradient></defs>}
      {dibujo}
    </svg>
  );
}
