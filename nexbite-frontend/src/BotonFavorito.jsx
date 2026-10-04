import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import BotonCorazon from './BotonCorazon';

const ALTERNAR_FAVORITO = gql`
  mutation AlternarFavorito($id_restaurante: ID!) {
    alternarFavorito(id_restaurante: $id_restaurante)
  }
`;

const OBTENER_FAVORITOS = gql`
  query ObtenerFavoritos($id_usuario: ID!) {
    obtenerFavoritos(id_usuario: $id_usuario) { id_restaurante }
  }
`;

export default function BotonFavorito({ idRestaurante, idUsuario, esFavoritoInicial, nombreRestaurante }) {
  const [esFavorito, setEsFavorito] = useState(esFavoritoInicial || false);

  // MODIFICACIÓN 3: ¡Clave! Obligamos al botón a actualizar su color si GraphQL detecta que los datos por detrás cambiaron
  useEffect(() => {
    setEsFavorito(esFavoritoInicial);
  }, [esFavoritoInicial]);

  const [alternarFavorito, { loading }] = useMutation(ALTERNAR_FAVORITO, {
    // Si tenemos un usuario válido, refrescamos la lista de favoritos en la base de datos
    refetchQueries: idUsuario && idUsuario !== "0" ? [{ query: OBTENER_FAVORITOS, variables: { id_usuario: idUsuario } }] : []
  });

  const handleClick = async () => {
    // 1. Cambiamos el estado visualmente de inmediato para que se vea rápido
    const nuevoEstado = !esFavorito;
    setEsFavorito(nuevoEstado);

    try {
      // 2. Lo guardamos en la base de datos
      await alternarFavorito({ variables: { id_restaurante: idRestaurante } });
    } catch (error) {
      // 3. Si falla, devolvemos el corazón a su estado original
      setEsFavorito(!nuevoEstado);
      alert("Error al actualizar favoritos. Revisa tu conexión.");
    }
  };

  return (
    <BotonCorazon activo={esFavorito} onClick={handleClick} disabled={loading} nombre={nombreRestaurante} />
  );
}
