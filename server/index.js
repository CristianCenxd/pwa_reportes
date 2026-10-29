import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import reportesRouter from './routes/reportes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

function sanitizarMensaje(mensaje) {
  if (typeof mensaje !== 'string') {
    return '';
  }
  return mensaje.replace(/postgres(?:ql)?:\/\/[^@\s]*@/gi, 'postgresql://***@');
}

app.get('/api/health', async (req, res) => {
  let database = 'disconnected';

  try {
    await pool.query('SELECT 1');
    database = 'connected';
  } catch (err) {
    console.error('Health check de base de datos:', err.code || '', sanitizarMensaje(err.message));
  }

  res.json({
    status: 'ok',
    database,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/reportes', reportesRouter);

app.use(express.static(publicDir));

app.use((req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

function esErrorDeBaseDeDatos(err) {
  const codigos = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '28000', '3D000', '57P01'];
  if (codigos.includes(err.code)) {
    return true;
  }
  if (!process.env.DATABASE_URL) {
    return true;
  }
  const mensaje = typeof err.message === 'string' ? err.message : '';
  return /SASL|password authentication|no password supplied|getaddrinfo|ECONNREFUSED|database .* does not exist|terminating connection/i.test(mensaje);
}

app.use((err, req, res, next) => {
  const status = err.status || (esErrorDeBaseDeDatos(err) ? 503 : 500);

  if (status >= 500) {
    console.error('Error en la solicitud:', err.code || '', sanitizarMensaje(err.message));
  }

  let mensaje = 'Error interno';
  if (status === 400) mensaje = 'Solicitud invalida';
  if (status === 503) mensaje = 'Base de datos no disponible';

  res.status(status).json({ error: mensaje });
});

if (!process.env.DATABASE_URL) {
  console.warn('Falta DATABASE_URL. Configura el archivo .env (ver .env.example).');
}

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
