export default function IconoCarrito({ tamano = 32 }) {
  return (
    <svg className="icono-carrito" viewBox="0 0 64 64" width={tamano} height={tamano} fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 8h10l7 29h29l6-21H18" />
      <path d="m23 37-2.7 5a4.5 4.5 0 0 0 4 6.6H52" />
      <circle cx="27" cy="57" r="4.8" />
      <circle cx="48" cy="57" r="4.8" />
    </svg>
  );
}
