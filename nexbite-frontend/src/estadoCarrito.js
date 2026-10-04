import { createContext } from 'react';

export const EstadoCarritoContext = createContext({ carrito: [], restarDelCarrito: () => {} });
