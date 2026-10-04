import { useId } from 'react';

export default function IconoCarrito({ tamano = 32, conMas = false }) {
  const cestaId = useId();

  return (
    <svg className="icono-carrito" viewBox="0 0 64 64" width={tamano} height={tamano} fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={cestaId} x1="25" y1="19" x2="45" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff6dc" />
          <stop offset="1" stopColor="#ffc65d" />
        </linearGradient>
      </defs>
      <ellipse cx="36" cy="57" rx="23" ry="3" fill="#20333f" opacity=".12" />
      <path d="M7 11h9l7.5 32a4 4 0 0 0 4 3H51" stroke="var(--carrito-trazo, #c95415)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 20h37a3 3 0 0 1 3 3.7l-3.3 12.8a5 5 0 0 1-4.8 3.8H25Z" fill={'url(#' + cestaId + ')'} />
      <path d="M53 20h3a3 3 0 0 1 3 3.7l-3.3 12.8a5 5 0 0 1-4.8 3.8H47Z" fill="#efa637" />
      <path d="m27 25 1.5 9M37 25v9m10-9-1.5 9" stroke="#c97916" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 21h26" stroke="#fffaf0" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="51" r="6" fill="#20333f" />
      <circle cx="50" cy="51" r="6" fill="#20333f" />
      <circle cx="28" cy="51" r="2.4" fill="#fff6dc" />
      <circle cx="50" cy="51" r="2.4" fill="#fff6dc" />
      {conMas && <g>
        <circle cx="53" cy="12" r="10" fill="#167c46" stroke="#fff6dc" strokeWidth="2" />
        <path d="M53 8v8m-4-4h8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </g>}
    </svg>
  );
}
