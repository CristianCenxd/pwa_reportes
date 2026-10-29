import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool } from './db.js';
import reportesRouter from './routes/reportes.js';
import { autenticar, autenticarCliente, clienteDesdeSolicitud, inicializarEsquema, usuarioDesdeSolicitud } from './auth.js';

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

app.post('/api/auth/login', async (req, res) => {
  const resultado = await autenticar(req.body?.email, req.body?.password);
  if (!resultado) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  res.json(resultado);
});

app.post('/api/auth/client-login', async (req, res) => {
  const resultado = await autenticarCliente(req.body?.codigo);
  if (!resultado) return res.status(401).json({ error: 'Codigo de cliente invalido o inactivo' });
  res.json(resultado);
});

app.get('/api/auth/me', async (req, res) => {
  const usuario = await usuarioDesdeSolicitud(req);
  if (!usuario) return res.status(401).json({ error: 'Sesion no valida' });
  const cliente = await clienteDesdeSolicitud(req);
  res.json({ usuario: usuario || null, cliente: cliente || null });
});

app.post('/api/clientes', async (req, res, next) => {
  try {
    const usuario = await usuarioDesdeSolicitud(req);
    if (!usuario || usuario.rol !== 'administrador') return res.status(403).json({ error: 'Solo el administrador puede crear clientes' });
    const nombre = String(req.body?.nombre || '').trim();
    const codigo = String(req.body?.codigo || '').trim();
    if (!nombre || !/^Cliente-[A-Za-z0-9]{8,}$/.test(codigo)) {
      return res.status(400).json({ error: 'Nombre y codigo valido son obligatorios' });
    }
    await pool.query('INSERT INTO public.pwa_clientes (codigo, nombre) VALUES ($1, $2)', [codigo, nombre]);
    res.status(201).json({ codigo, nombre });
  } catch (err) { next(err); }
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
  inicializarEsquema()
    .catch((error) => {
      console.error('No se pudo preparar la base de datos:', error.code || error.message);
      process.exitCode = 1;
    })
    .then(() => {
      if (process.exitCode) return;
      app.listen(PORT, () => {
        console.log(`Servidor escuchando en http://localhost:${PORT}`);
      });
    });
}

export { app };
