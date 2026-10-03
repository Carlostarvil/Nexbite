import { useState } from 'react';
import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

const BUSCAR_RESTAURANTES = gql`
  query BuscarRestaurantes($termino: String!) {
    buscarRestaurantes(termino: $termino) { id_restaurante, nombre, tipo, imagen_url }
  }
`;

const BUSCAR_PLATOS = gql`
  query BuscarPlatos($termino: String!) {
    buscarPlatos(termino: $termino) { id_plato, id_restaurante, nombre, descripcion, precio, imagen_url }
  }
`;

// PROPÓSITO: Recibir onSelectPlato para poder abrir la página dedicada al plato
export default function Buscador({ onSelectRestaurante, onSelectPlato }) {
  const [tipoBusqueda, setTipoBusqueda] = useState('RESTAURANTES'); 
  const [termino, setTermino] = useState('');
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  const queryOptions = {
    variables: { termino },
    skip: termino.length < 2,
    fetchPolicy: 'network-only' 
  };

  const { data: dataRestaurantes, loading: loadingRest } = useQuery(BUSCAR_RESTAURANTES, { ...queryOptions, skip: queryOptions.skip || tipoBusqueda !== 'RESTAURANTES' });
  const { data: dataPlatos, loading: loadingPlatos } = useQuery(BUSCAR_PLATOS, { ...queryOptions, skip: queryOptions.skip || tipoBusqueda !== 'PLATOS' });

  const cargando = loadingRest || loadingPlatos;
  const resultadosRestaurantes = dataRestaurantes?.buscarRestaurantes || [];
  const resultadosPlatos = dataPlatos?.buscarPlatos || [];
  
  const hayResultados = tipoBusqueda === 'RESTAURANTES' ? resultadosRestaurantes.length > 0 : resultadosPlatos.length > 0;

  const handleSeleccionRestaurante = (e, idRestaurante) => {
    e.preventDefault();
    setMostrarDropdown(false);
    setTermino('');
    onSelectRestaurante(idRestaurante);
  };

  // PROPÓSITO: Al hacer clic en el plato, limpia el buscador y envía el objeto del plato a App.jsx
  const handleSeleccionPlato = (e, plato) => {
    e.preventDefault();
    setMostrarDropdown(false);
    setTermino('');
    onSelectPlato(plato);
  };

  const pestañaStyle = (activa) => ({
    padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', border: 'none',
    backgroundColor: activa ? '#ff4500' : '#eee', color: activa ? 'white' : '#666',
    borderRadius: activa ? '20px' : '8px', transition: 'all 0.2s', flex: 1
  });

  return (
    <div style={{ position: 'relative', zIndex: 1000, maxWidth: '600px', margin: '0 auto 2rem auto' }}>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={() => { setTipoBusqueda('RESTAURANTES'); setTermino(''); }} style={pestañaStyle(tipoBusqueda === 'RESTAURANTES')}>🏪 Buscar Locales</button>
        <button onClick={() => { setTipoBusqueda('PLATOS'); setTermino(''); }} style={pestañaStyle(tipoBusqueda === 'PLATOS')}>🍔 Buscar Platos</button>
      </div>

      <input
        type="text"
        placeholder={tipoBusqueda === 'RESTAURANTES' ? "¿Qué restaurante buscas?" : "¿Te apetece una pizza, sushi, hamburguesa...?"}
        value={termino}
        onChange={(e) => {
          setTermino(e.target.value);
          setMostrarDropdown(true);
        }}
        onFocus={() => { if (termino.length >= 2) setMostrarDropdown(true); }}
        onBlur={() => setTimeout(() => setMostrarDropdown(false), 250)}
        style={{ width: '100%', padding: '15px 20px', fontSize: '1.1rem', borderRadius: '12px', border: '2px solid #ff4500', boxSizing: 'border-box', outline: 'none', boxShadow: '0 4px 10px rgba(255, 69, 0, 0.1)' }}
      />

      {mostrarDropdown && termino.length >= 2 && (
        <div style={{ position: 'absolute', top: '105%', left: 0, right: 0, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', overflow: 'hidden', border: '1px solid #eee' }}>
          
          {cargando ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Buscando... 🔍</div>
          ) : !hayResultados ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No hemos encontrado resultados para "{termino}" 😥</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              
              {tipoBusqueda === 'RESTAURANTES' && resultadosRestaurantes.map(rest => (
                <li key={rest.id_restaurante} onMouseDown={(e) => handleSeleccionRestaurante(e, rest.id_restaurante)} style={{ padding: '15px 20px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  {rest.imagen_url ? <img src={rest.imagen_url} alt={rest.nombre} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} /> : <div style={{ fontSize: '1.5rem' }}>🏪</div>}
                  <div>
                    <h4 style={{ margin: 0, color: '#333' }}>{rest.nombre}</h4>
                    <span style={{ fontSize: '12px', color: '#ff4500', fontWeight: 'bold' }}>{rest.tipo}</span>
                  </div>
                </li>
              ))}

              {tipoBusqueda === 'PLATOS' && resultadosPlatos.map(plato => (
                <li key={plato.id_plato} onMouseDown={(e) => handleSeleccionPlato(e, plato)} style={{ padding: '15px 20px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  {plato.imagen_url ? <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} /> : <div style={{ fontSize: '1.5rem' }}>🍽️</div>}
                  
                  <div style={{ flexGrow: 1 }}>
                    <h4 style={{ margin: 0, color: '#333' }}>{plato.nombre}</h4>
                    <span style={{ fontSize: '13px', color: '#666' }}>Ver detalles del plato</span>
                  </div>
                  
                  <div style={{ fontWeight: 'bold', color: '#0066cc' }}>€{plato.precio.toFixed(2)}</div>
                </li>
              ))}

            </ul>
          )}
        </div>
      )}
    </div>
  );
}