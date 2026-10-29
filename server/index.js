import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool } from './db.js';
import reportesRouter from './routes/reportes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

const PERMISSIONS_POLICY = 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

function cabecerasSeguridad(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  res.setHeader('X-XSS-Protection', '0');

  const proto = req.headers['x-forwarded-proto'];
  const protocoloHttps = typeof proto === 'string' && proto.split(',')[0].trim() === 'https';
  if (req.secure || protocoloHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  }

  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }

  next();
}

app.disable('x-powered-by');
app.use(cabecerasSeguridad);
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
  if (status === 413) mensaje = 'Solicitud demasiado grande';
  if (status === 415) mensaje = 'Tipo de contenido no soportado';
  if (status === 503) mensaje = 'Base de datos no disponible';

  res.status(status).json({ error: mensaje });
});

if (!process.env.DATABASE_URL) {
  console.warn('Falta DATABASE_URL. Configura el archivo .env (ver .env.example).');
}

const esModuloPrincipal = Boolean(process.argv[1])
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (esModuloPrincipal) {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

export { app };
