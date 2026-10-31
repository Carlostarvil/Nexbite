import express from 'express';
import { MAX_BYTES_PETICION_JSON, MENSAJE_IMAGEN_GRANDE } from '../shared/limitesImagen.js';

const cuerpoJson = express.Router();

// Base64 ocupa más que el archivo original: una foto de 5 MB necesita casi 7 MB de JSON.
cuerpoJson.use(express.json({ limit: MAX_BYTES_PETICION_JSON }));
cuerpoJson.use((error, _req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      errors: [{ message: MENSAJE_IMAGEN_GRANDE, extensions: { code: 'PAYLOAD_TOO_LARGE' } }],
    });
  }
  return next(error);
});

export default cuerpoJson;
