import { categoriasLocal, textoCategoriaLocal } from './vendedorUtils';
import './EtiquetasLocal.css';

export default function EtiquetasLocal({ tipo, className = '' }) {
  const categorias = [...new Set(categoriasLocal(tipo).map(valor => valor.toLocaleUpperCase('es-ES')))];
  return <ul className={'etiquetas-local ' + className} aria-label="Tipo de local y especialidades">
    {categorias.map(categoria => <li className="etiqueta-local" key={categoria}>{textoCategoriaLocal(categoria)}</li>)}
  </ul>;
}
