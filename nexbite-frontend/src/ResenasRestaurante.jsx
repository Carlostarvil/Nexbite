import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

const OBTENER_RESENAS = gql`
  query ObtenerResenas($id_restaurante: ID!) {
    obtenerResenasRestaurante(id_restaurante: $id_restaurante) {
      id_resena
      nombre_usuario
      puntuacion
      comentario
      fecha
    }
  }
`;

const CREAR_RESENA = gql`
  mutation CrearResena($id_restaurante: ID!, $id_usuario: ID!, $puntuacion: Int!, $comentario: String!) {
    crearResena(id_restaurante: $id_restaurante, id_usuario: $id_usuario, puntuacion: $puntuacion, comentario: $comentario) {
      id_resena
      nombre_usuario
      puntuacion
      comentario
      fecha
    }
  }
`;

// COMPONENTE ESTRELLA SVG REUTILIZABLE
const EstrellaSVG = ({ llena, interactiva, onMouseEnter, onMouseLeave, onClick, tamano = 20 }) => (
  <svg 
    width={tamano} height={tamano} viewBox="0 0 24 24" 
    fill={llena ? "#ffc107" : "none"} 
    stroke={llena ? "#ffc107" : "#cbd5e1"} 
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    style={{ 
      cursor: interactiva ? 'pointer' : 'default', 
      transition: 'all 0.2s ease',
      transform: interactiva && llena ? 'scale(1.1)' : 'scale(1)'
    }}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

export default function ResenasRestaurante({ idRestaurante, idUsuario }) {
  const [puntuacion, setPuntuacion] = useState(0);
  const [hoverEstrella, setHoverEstrella] = useState(0);
  const [comentario, setComentario] = useState('');

  const { data, loading, error } = useQuery(OBTENER_RESENAS, {
    variables: { id_restaurante: idRestaurante },
    fetchPolicy: 'cache-and-network'
  });

  const [crearResena, { loading: enviando }] = useMutation(CREAR_RESENA, {
    update(cache, { data: { crearResena } }) {
      const existing = cache.readQuery({
        query: OBTENER_RESENAS,
        variables: { id_restaurante: idRestaurante }
      });
      cache.writeQuery({
        query: OBTENER_RESENAS,
        variables: { id_restaurante: idRestaurante },
        data: {
          obtenerResenasRestaurante: [crearResena, ...(existing?.obtenerResenasRestaurante || [])]
        }
      });
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idUsuario || idUsuario === "0") return alert("Debes iniciar sesión para opinar.");
    if (puntuacion === 0) return alert("Por favor, selecciona una puntuación.");
    if (!comentario.trim()) return alert("El comentario no puede estar vacío.");

    try {
      await crearResena({
        variables: { id_restaurante: idRestaurante, id_usuario: idUsuario, puntuacion, comentario }
      });
      setComentario('');
      setPuntuacion(0);
      setHoverEstrella(0);
    } catch (err) {
      alert("Error al enviar la reseña.");
    }
  };

  const resenas = data?.obtenerResenasRestaurante || [];
  const totalResenas = resenas.length;
  const promedio = totalResenas ? (resenas.reduce((acc, r) => acc + r.puntuacion, 0) / totalResenas).toFixed(1) : "0.0";

  // CÁLCULO PARA LAS BARRAS DE DISTRIBUCIÓN
  const distribucion = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  resenas.forEach(r => { if (distribucion[r.puntuacion] !== undefined) distribucion[r.puntuacion]++; });

  return (
    <div style={{ marginTop: '3rem', paddingTop: '3rem', borderTop: '1px solid #eaeaea' }}>
      
      <h2 style={{ margin: '0 0 2rem 0', fontSize: '1.8rem', color: '#1a1a1a', letterSpacing: '-0.5px' }}>Opiniones de clientes</h2>

      {/* PANEL DE RESUMEN DE PUNTUACIONES */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'center', backgroundColor: '#fafafa', padding: '2.5rem', borderRadius: '20px', marginBottom: '2.5rem' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '150px' }}>
          <span style={{ fontSize: '4rem', fontWeight: '800', color: '#1a1a1a', lineHeight: '1' }}>{promedio}</span>
          <div style={{ display: 'flex', gap: '4px', margin: '10px 0' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <EstrellaSVG key={i} llena={i <= Math.round(promedio)} tamano={22} />
            ))}
          </div>
          <span style={{ color: '#666', fontSize: '14px', fontWeight: '500' }}>Basado en {totalResenas} reseñas</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '250px' }}>
          {[5, 4, 3, 2, 1].map(estrella => {
            const porcentaje = totalResenas ? (distribucion[estrella] / totalResenas) * 100 : 0;
            return (
              <div key={estrella} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#555', fontSize: '14px', fontWeight: 'bold', width: '10px' }}>{estrella}</span>
                <EstrellaSVG llena={true} tamano={14} />
                <div style={{ flex: 1, height: '8px', backgroundColor: '#eaeaea', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: '#ffc107', borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FORMULARIO DE RESEÑA */}
      <div style={{ border: '1px solid #eaeaea', borderRadius: '16px', padding: '2rem', marginBottom: '3rem', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#333', fontSize: '1.2rem' }}>Deja tu valoración</h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <span style={{ display: 'block', marginBottom: '10px', color: '#666', fontSize: '14px' }}>Selecciona tu puntuación:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map(estrella => (
                <EstrellaSVG 
                  key={estrella} 
                  tamano={32}
                  llena={estrella <= (hoverEstrella || puntuacion)}
                  interactiva={true}
                  onMouseEnter={() => setHoverEstrella(estrella)}
                  onMouseLeave={() => setHoverEstrella(0)}
                  onClick={() => setPuntuacion(estrella)}
                />
              ))}
            </div>
          </div>
          
          <textarea 
            placeholder="Cuéntanos más sobre tu experiencia. ¿Qué tal la comida y el servicio?" 
            value={comentario} 
            onChange={(e) => setComentario(e.target.value)} 
            style={{ 
              width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #f0f0f0', 
              minHeight: '120px', fontFamily: 'inherit', resize: 'vertical', fontSize: '15px', 
              outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#fafafa', boxSizing: 'border-box'
            }}
            onFocus={(e) => { e.target.style.borderColor = '#ff4500'; e.target.style.backgroundColor = '#fff'; }}
            onBlur={(e) => { e.target.style.borderColor = '#f0f0f0'; e.target.style.backgroundColor = '#fafafa'; }}
          />
          
          <button 
            type="submit" 
            disabled={enviando} 
            style={{ 
              alignSelf: 'flex-start', background: '#1a1a1a', color: '#fff', border: 'none', 
              padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px',
              cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.7 : 1, transition: 'background 0.2s' 
            }}
            onMouseEnter={(e) => !enviando && (e.currentTarget.style.background = '#333')}
            onMouseLeave={(e) => !enviando && (e.currentTarget.style.background = '#1a1a1a')}
          >
            {enviando ? 'Publicando...' : 'Publicar reseña'}
          </button>
        </form>
      </div>

      {loading && <p style={{ color: '#666' }}>Cargando opiniones...</p>}
      {error && <p style={{ color: '#d63031' }}>Error al cargar las reseñas.</p>}

      {/* LISTADO DE RESEÑAS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {!loading && resenas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#fafafa', borderRadius: '16px', border: '1px dashed #ccc' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px' }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            <p style={{ margin: 0, color: '#666', fontSize: '1.1rem' }}>Todavía no hay reseñas. ¡Sé el primero en opinar!</p>
          </div>
        ) : (
          resenas.map(resena => (
            <div key={resena.id_resena} style={{ backgroundColor: '#fff', border: '1px solid #eaeaea', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  {/* AVATAR DE USUARIO GENERADO */}
                  <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#ff4500', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
                    {resena.nombre_usuario.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#1a1a1a', display: 'block', fontSize: '15px' }}>{resena.nombre_usuario}</span>
                    <span style={{ color: '#888', fontSize: '13px' }}>{new Date(Number(resena.fecha)).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <EstrellaSVG key={i} llena={i <= resena.puntuacion} tamano={18} />
                ))}
              </div>
              
              <p style={{ margin: 0, color: '#444', lineHeight: '1.6', fontSize: '15px' }}>
                {resena.comentario}
              </p>
            </div>
          ))
        )}
      </div>

    </div>
  );
}