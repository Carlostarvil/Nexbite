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

  // Sincroniza el estado local cuando cambia el favorito recibido del componente padre.
  useEffect(() => {
    setEsFavorito(esFavoritoInicial);
  }, [esFavoritoInicial]);

  const [alternarFavorito, { loading }] = useMutation(ALTERNAR_FAVORITO, {
    // Refresca la consulta de favoritos después de guardar el cambio.
    refetchQueries: idUsuario && idUsuario !== "0" ? [{ query: OBTENER_FAVORITOS, variables: { id_usuario: idUsuario } }] : []
  });

  const handleClick = async () => {
    // Actualización optimista: el corazón cambia antes de que responda el servidor.
    const nuevoEstado = !esFavorito;
    setEsFavorito(nuevoEstado);

    try {
      await alternarFavorito({ variables: { id_restaurante: idRestaurante } });
    } catch (error) {
      // Si la mutación falla, recupera el estado visual anterior.
      setEsFavorito(!nuevoEstado);
      alert("Error al actualizar favoritos. Revisa tu conexión.");
    }
  };

  return (
    <BotonCorazon activo={esFavorito} onClick={handleClick} disabled={loading} nombre={nombreRestaurante} />
  );
}
