import './CategoriasInicio.css';

const CATEGORIAS = [
  { id: 'Hamburguesas', fondo: '#fff0d7' },
  { id: 'Pizza', fondo: '#fff0e9' },
  { id: 'Desayuno', fondo: '#f2e9df' },
  { id: 'Asiática', fondo: '#e8f1ed' },
  { id: 'Sana', fondo: '#eaf3df' },
  { id: 'Americana', fondo: '#fff0dc' },
  { id: 'Postres', fondo: '#fce8ed' },
  { id: 'Sándwiches', fondo: '#f3eddf' },
  { id: 'Mexicana', fondo: '#fff3d8' },
  { id: 'Pollo', fondo: '#f4eadf' },
];

const ILUSTRACIONES = {
  Hamburguesas: <>
    <ellipse cx="50" cy="83" rx="33" ry="5" fill="#795333" opacity=".12" />
    <rect x="17" y="68" width="66" height="13" rx="6" fill="#e9a44a" />
    <path d="M20 71h60" stroke="#f8cd7b" strokeWidth="3" strokeLinecap="round" />
    <rect x="17" y="58" width="66" height="12" rx="5" fill="#69412b" />
    <path d="m15 52 8 7 8-4 9 6 10-5 10 5 9-6 8 4 8-7-6-5H21Z" fill="#72a64c" />
    <rect x="19" y="43" width="62" height="10" rx="4" fill="#d9573e" />
    <path d="M19 43h62l-9 11-12-7-9 8-13-9-11 7Z" fill="#f7d360" />
    <path d="M17 41c2-18 15-27 33-27s31 9 33 27c-14 6-52 6-66 0Z" fill="#eab15c" />
    <path d="M25 30c9-11 24-14 38-7" fill="none" stroke="#f9d48e" strokeWidth="4" strokeLinecap="round" />
    <path d="m35 25 3 2m13-6 3 2m12 9 3-2m-20 7 3 2" stroke="#fff2cf" strokeWidth="2.5" strokeLinecap="round" />
  </>,
  Pizza: <>
    <ellipse cx="50" cy="86" rx="25" ry="4" fill="#795333" opacity=".12" />
    <path d="M24 27q26-17 52 0L49 84Z" fill="#f8d365" stroke="#e8af4c" strokeWidth="2" strokeLinejoin="round" />
    <path d="M20 23q29-22 60 0l-4 10q-27-16-52 0Z" fill="#d88d45" />
    <path d="M25 23q24-15 50 0" fill="none" stroke="#f4be75" strokeWidth="4" strokeLinecap="round" />
    <circle cx="40" cy="39" r="7" fill="#cc543b" />
    <circle cx="60" cy="43" r="7" fill="#cc543b" />
    <circle cx="49" cy="63" r="6" fill="#cc543b" />
    <path d="m39 37 3-1m17 6 3-1m-15 21 3-1" stroke="#ed8b64" strokeWidth="2" strokeLinecap="round" />
    <path d="M49 34q-7 2-4 7 7-1 4-7ZM58 55q-7-2-8 4 7 3 8-4Z" fill="#698a42" />
  </>,
  Desayuno: <>
    <ellipse cx="49" cy="83" rx="37" ry="5" fill="#795333" opacity=".12" />
    <path d="M52 43h6a12 12 0 0 1 0 24h-6" fill="none" stroke="#d7c6b5" strokeWidth="5" />
    <path d="M15 41h40v26c0 10-8 14-20 14s-20-4-20-14Z" fill="#fffaf2" stroke="#dfd1c2" strokeWidth="1.5" />
    <ellipse cx="35" cy="41" rx="20" ry="7" fill="#e2d0bb" />
    <ellipse cx="35" cy="42" rx="16" ry="4" fill="#76543b" />
    <path d="M25 57v9q0 6 8 7" fill="none" stroke="#ece0d2" strokeWidth="3" strokeLinecap="round" />
    <path d="M27 30c-7-8 6-9 0-17m13 15c-6-7 6-9 0-16" fill="none" stroke="#b9a28a" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M54 70c1-13 13-20 25-14 9 5 12 16 7 22l-7-5c-4 5-12 6-17 0l-8 5Z" fill="#e8ac58" stroke="#cd8b40" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="m66 58-3 13m12-14 4 14" stroke="#f8d18a" strokeWidth="3" strokeLinecap="round" />
  </>,
  Asiática: <>
    <ellipse cx="50" cy="82" rx="36" ry="5" fill="#456557" opacity=".12" />
    <path d="m17 26 65-15M19 34l66-13" stroke="#b17a4e" strokeWidth="3" strokeLinecap="round" />
    <rect x="15" y="46" width="33" height="31" rx="8" fill="#314e44" />
    <ellipse cx="31.5" cy="46" rx="16.5" ry="12" fill="#f8f6e9" stroke="#e5e6d9" strokeWidth="1.5" />
    <ellipse cx="31.5" cy="46" rx="10" ry="7" fill="#547855" />
    <rect x="27" y="41" width="8" height="10" rx="2" fill="#e99565" />
    <path d="M53 58c0-9 8-16 19-16s18 7 18 16v12H53Z" fill="#fffaf0" stroke="#e5e6d9" strokeWidth="1.5" />
    <rect x="51" y="43" width="40" height="16" rx="7" fill="#ed9473" />
    <path d="m60 44 7 13m4-13 7 13m4-13 5 10" stroke="#ffc3a3" strokeWidth="2.5" />
    <path d="M67 43h9v28h-9Z" fill="#395c4b" />
  </>,
  Sana: <>
    <ellipse cx="50" cy="85" rx="29" ry="4" fill="#456557" opacity=".12" />
    <path d="M24 48c-14-18 6-33 18-16 0-27 29-19 25 1 20-12 33 7 17 21Z" fill="#7da94b" />
    <path d="M34 48c-11-14 6-24 16-9 2-18 20-14 21 4Z" fill="#a6c968" />
    <circle cx="29" cy="49" r="9" fill="#e47751" />
    <circle cx="56" cy="48" r="8" fill="#cf6145" />
    <circle cx="71" cy="41" r="11" fill="#679a54" />
    <circle cx="71" cy="41" r="7" fill="#d6e7a2" />
    <path d="m69 38 4 6m-4 0 4-6" stroke="#a9c572" strokeWidth="1.5" strokeLinecap="round" />
    <path d="m41 49 7-3 4 7-8 3Z" fill="#f8d57d" />
    <path d="M14 54h72c-3 22-14 30-36 30S17 76 14 54Z" fill="#91b9a1" stroke="#729c85" strokeWidth="1.5" />
    <path d="M24 62c3 9 11 14 23 15" fill="none" stroke="#c7dfcb" strokeWidth="4" strokeLinecap="round" />
  </>,
  Americana: <>
    <ellipse cx="50" cy="84" rx="34" ry="5" fill="#795333" opacity=".12" />
    <path d="m20 54-2-27m10 27-1-32m9 32 2-27m7 30 3-22" stroke="#efbc58" strokeWidth="7" strokeLinecap="round" />
    <path d="m14 49 36 3-5 27H20Z" fill="#d96649" />
    <path d="m20 57 23 2" stroke="#f3906e" strokeWidth="3" strokeLinecap="round" />
    <g transform="rotate(-18 69 48)">
      <rect x="53" y="16" width="30" height="64" rx="15" fill="#e5ad60" stroke="#cf914b" strokeWidth="1.5" />
      <rect x="60" y="21" width="16" height="53" rx="8" fill="#b95538" />
      <path d="m67 28 5 7-7 7 7 7-7 7 5 7" fill="none" stroke="#f5d463" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </>,
  Postres: <>
    <ellipse cx="50" cy="84" rx="35" ry="5" fill="#916365" opacity=".12" />
    <path d="M20 40h61v38H20Z" fill="#f3debe" />
    <path d="M20 50h61v10H20Zm0 20h61v8H20Z" fill="#df8fa3" />
    <path d="m20 40 34-22 27 22Z" fill="#efb3c0" stroke="#df98a7" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M20 40h61v9c-5 5-9-1-13-1s-7 6-12 3-8-6-12-2-8 3-13-1-7-1-11-1Z" fill="#fff9ed" />
    <path d="M47 26c-7-13 14-17 14-5 0 7-8 12-10 12Z" fill="#cb5360" />
    <path d="m51 17 1-8 4 7 7-4-4 7Z" fill="#65864b" />
    <path d="m51 23 1 2m4-5 1 2" stroke="#f7b5ba" strokeWidth="1.8" strokeLinecap="round" />
  </>,
  Sándwiches: <>
    <ellipse cx="50" cy="84" rx="34" ry="5" fill="#795333" opacity=".12" />
    <path d="m14 68 34-48 38 48-5 13H19Z" fill="#dba45d" stroke="#c58d4b" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="m19 65 30-40 32 40-2 7H21Z" fill="#fbefd5" />
    <path d="m18 71 10-5 9 6 11-6 12 7 10-6 13 5-3 7H21Z" fill="#80a34d" />
    <path d="M22 76h57" stroke="#d87351" strokeWidth="4" strokeLinecap="round" />
    <path d="m22 64 27-36 28 36Z" fill="#fff4dd" />
    <path d="m34 55 3-1m13-8 2 2m12 11 3-1" stroke="#e9d5ae" strokeWidth="2" strokeLinecap="round" />
  </>,
  Mexicana: <>
    <ellipse cx="50" cy="83" rx="36" ry="5" fill="#795333" opacity=".12" />
    <path d="M13 72c1-52 73-52 74 0Z" fill="#e3ab4d" stroke="#d09740" strokeWidth="1.5" />
    <path d="m16 60 7-16 9 5 7-12 12 8 9-9 10 13 9-4 6 20Z" fill="#78a04d" />
    <circle cx="31" cy="53" r="7" fill="#cf6949" />
    <circle cx="62" cy="50" r="7" fill="#cf6949" />
    <path d="m43 49 7-3 4 6-8 4Zm26 10 6-4 4 6-7 4Z" fill="#fff1c9" />
    <path d="M15 74c9-28 62-28 71 0v5H15Z" fill="#f1cb6d" stroke="#d7ab52" strokeWidth="1.5" />
    <path d="m29 69 3-1m11 5 2-1m11-6 3 1m11 5 2-1" stroke="#dca54b" strokeWidth="2" strokeLinecap="round" />
  </>,
  Pollo: <>
    <ellipse cx="50" cy="83" rx="34" ry="5" fill="#795333" opacity=".12" />
    <path d="m59 42 17-17c-1-7 7-13 11-7 6-3 11 5 5 9 0 7-8 10-12 5L65 48Z" fill="#fff5dd" stroke="#d8c6a8" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M23 40c10-14 25-17 34-8 4 5 2 11 9 17 7 7 0 22-8 21-13 1-18 12-30 7-12-4-15-23-5-37Z" fill="#cc8543" stroke="#b77339" strokeWidth="1.5" />
    <path d="M27 42c9-11 17-12 22-9M24 56c-3 8 0 12 6 14" fill="none" stroke="#eab770" strokeWidth="5" strokeLinecap="round" />
    <path d="m39 44 2 2m9 14 2-2m-12 11 3-1" stroke="#a86632" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 75q-4-10 5-12 5 9-5 12Zm0 0q13-9 15 1-7 7-15-1Z" fill="#7e9b56" />
  </>,
};

function IlustracionComida({ categoria }) {
  return <svg className="categoria-inicio-ilustracion" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">{ILUSTRACIONES[categoria]}</svg>;
}

export default function CategoriasInicio({ seleccionada, onSeleccionar }) {
  return (
    <section className="categorias-inicio" aria-label="Categorías de comida">
      <div className="categorias-inicio-lista">
        {CATEGORIAS.map(categoria => {
          const activa = seleccionada === categoria.id;
          return (
            <button key={categoria.id} type="button" className={`categoria-inicio${activa ? ' categoria-inicio-activa' : ''}`} aria-pressed={activa} onClick={() => onSeleccionar(activa ? null : categoria.id)} style={{ '--categoria-fondo': categoria.fondo }}>
              <span className="categoria-inicio-imagen">
                <IlustracionComida categoria={categoria.id} />
                {activa && <span className="categoria-inicio-seleccion"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6" /></svg></span>}
              </span>
              <span className="categoria-inicio-nombre">{categoria.id}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
