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

export default function ResenasRestaurante({ idRestaurante, idUsuario }) {
  const [puntuacion, setPuntuacion] = useState(5);
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
    if (!comentario.trim()) return alert("El comentario no puede estar vacío.");

    try {
      await crearResena({
        variables: { id_restaurante: idRestaurante, id_usuario: idUsuario, puntuacion, comentario }
      });
      setComentario('');
      setPuntuacion(5);
    } catch (err) {
      alert("Error al enviar la reseña.");
    }
  };

  const resenas = data?.obtenerResenasRestaurante || [];
  const promedio = resenas.length ? (resenas.reduce((acc, r) => acc + r.puntuacion, 0) / resenas.length).toFixed(1) : 0;

  return (
    <div style={{ marginTop: '3rem', padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eaeaea' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Reseñas ({resenas.length})</h2>
        {resenas.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff0eb', color: '#ff4500', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold' }}>
            <span>⭐</span> {promedio} / 5
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem', background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px' }}>
        <h4 style={{ margin: 0, color: '#333' }}>Deja tu valoración</h4>
        <div style={{ display: 'flex', gap: '5px', fontSize: '1.5rem', cursor: 'pointer' }}>
          {[1, 2, 3, 4, 5].map(estrella => (
            <span key={estrella} onClick={() => setPuntuacion(estrella)} style={{ filter: estrella <= puntuacion ? 'none' : 'grayscale(100%) opacity(30%)' }}>⭐</span>
          ))}
        </div>
        <textarea 
          placeholder="¿Qué te ha parecido la comida y el servicio?" 
          value={comentario} 
          onChange={(e) => setComentario(e.target.value)} 
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <button type="submit" disabled={enviando} style={{ alignSelf: 'flex-start', background: '#000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: enviando ? 'not-allowed' : 'pointer' }}>
          {enviando ? 'Enviando...' : 'Publicar reseña'}
        </button>
      </form>

      {loading && <p>Cargando opiniones...</p>}
      {error && <p style={{ color: 'red' }}>Error al cargar las reseñas.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {resenas.map(resena => (
          <div key={resena.id_resena} style={{ borderBottom: '1px solid #eaeaea', paddingBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', color: '#000' }}>{resena.nombre_usuario}</span>
              <span style={{ color: '#666', fontSize: '13px' }}>{new Date(Number(resena.fecha)).toLocaleDateString()}</span>
            </div>
            <div style={{ marginBottom: '8px' }}>{'⭐'.repeat(resena.puntuacion)}</div>
            <p style={{ margin: 0, color: '#444', lineHeight: '1.5' }}>{resena.comentario}</p>
          </div>
        ))}
        {!loading && resenas.length === 0 && <p style={{ color: '#666' }}>Todavía no hay reseñas. ¡Sé el primero en opinar!</p>}
      </div>
    </div>
  );
}