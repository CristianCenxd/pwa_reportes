import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

export async function inicializarEsquema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.pwa_usuarios (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('administrador', 'tecnico')),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.pwa_clientes (
      id BIGSERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.pwa_sesiones (
      token TEXT PRIMARY KEY,
      usuario_id BIGINT NOT NULL REFERENCES public.pwa_usuarios(id) ON DELETE CASCADE,
      expira_en TIMESTAMPTZ NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.reportes ADD COLUMN IF NOT EXISTS owner_code TEXT;
    ALTER TABLE public.reportes ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;
    CREATE TABLE IF NOT EXISTS public.pwa_cliente_sesiones (
      token TEXT PRIMARY KEY,
      cliente_id BIGINT NOT NULL REFERENCES public.pwa_clientes(id) ON DELETE CASCADE,
      expira_en TIMESTAMPTZ NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS reportes_owner_code_idx ON public.reportes(owner_code);
  `);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existente = await pool.query('SELECT id FROM public.pwa_usuarios WHERE email = $1', [adminEmail]);
    if (existente.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await pool.query(
        'INSERT INTO public.pwa_usuarios (email, password_hash, rol) VALUES ($1, $2, $3)',
        [adminEmail, hash, 'administrador'],
      );
    }
  }
}

export async function autenticar(email, password) {
  const normalizado = String(email || '').trim().toLowerCase();
  const usuario = await pool.query('SELECT * FROM public.pwa_usuarios WHERE email = $1', [normalizado]);
  if (!usuario.rows.length || !await bcrypt.compare(String(password || ''), usuario.rows[0].password_hash)) {
    return null;
  }
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    "INSERT INTO public.pwa_sesiones (token, usuario_id, expira_en) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
    [token, usuario.rows[0].id],
  );
  return { token, usuario: { id: usuario.rows[0].id, email: usuario.rows[0].email, rol: usuario.rows[0].rol } };
}

export async function autenticarCliente(codigo) {
  const { rows } = await pool.query(
    'SELECT id, codigo, nombre FROM public.pwa_clientes WHERE codigo = $1 AND activo = TRUE',
    [String(codigo || '').trim()],
  );
  if (!rows.length) return null;
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    "INSERT INTO public.pwa_cliente_sesiones (token, cliente_id, expira_en) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
    [token, rows[0].id],
  );
  return { token, cliente: rows[0] };
}

export async function usuarioDesdeSolicitud(req) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.rol FROM public.pwa_sesiones s
    JOIN public.pwa_usuarios u ON u.id = s.usuario_id
    WHERE s.token = $1 AND s.expira_en > NOW()
  `, [token]);
  return rows[0] || null;
}

export async function clienteDesdeSolicitud(req) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { rows } = await pool.query(`
    SELECT c.id, c.codigo, c.nombre FROM public.pwa_cliente_sesiones s
    JOIN public.pwa_clientes c ON c.id = s.cliente_id
    WHERE s.token = $1 AND s.expira_en > NOW() AND c.activo = TRUE
  `, [token]);
  return rows[0] || null;
}
