// Cambia la etiqueta visible y mantiene el valor guardado en los platos existentes.
export const nombreCategoria = categoria => {
  if (categoria === 'PLATO') return 'PLATO PRINCIPAL';
  if (categoria === 'MENU') return 'MENÚ';
  return categoria;
};
