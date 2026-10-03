import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Propósito: Restaurar la configuración de fábrica de Vite.
// Por qué el cambio: Eliminamos la regla 'optimizeDeps'. Ahora que sabemos que el problema era que Vite apuntaba a la carpeta "core", le quitamos las restricciones para que vuelva a procesar todo con normalidad y sin bloqueos forzados.
export default defineConfig({
  plugins: [react()],
})