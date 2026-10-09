import IconoInfoRestaurante from './IconoInfoRestaurante';
import { categoriasLocal, textoCategoriaLocal } from './vendedorUtils';

const ICONOS = { RESTAURANTE: 'restaurante', SUPERMERCADO: 'supermercado', FARMACIA: 'farmacia' };

export default function EtiquetasInfoLocal({ tipo }) {
  const categorias = [...new Set(categoriasLocal(tipo).map(valor => valor.toLocaleUpperCase('es-ES')))];
  if (!categorias.length) categorias.push('LOCAL');

  return <ul className="info-restaurante-etiquetas" aria-label="Tipo de local y especialidades">
    {categorias.map(categoria => <li key={categoria} className={'info-restaurante-etiqueta info-restaurante-etiqueta-' + (ICONOS[categoria] || 'categoria')}>
      {ICONOS[categoria] && <span className="info-restaurante-etiqueta-icono"><IconoInfoRestaurante tipo={ICONOS[categoria]} /></span>}
      <span>{textoCategoriaLocal(categoria)}</span>
    </li>)}
  </ul>;
}
