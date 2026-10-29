import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const ESTADOS = new Set(['pendiente', 'en_proceso', 'completado']);
const MAX = {
  clientId: 100,
  titulo: 200,
  descripcion: 2000,
  cliente: 200,
  sitio: 200,
  estado: 30,
};

const SELECT_REPORTE = `
  SELECT id, client_id, titulo, descripcion, cliente, sitio,
         fecha_servicio::text AS fecha_servicio, estado, created_at
  FROM public.reportes
`;

function toReporte(row) {
  return {
    id: Number(row.id),
    clientId: row.client_id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    cliente: row.cliente,
    sitio: row.sitio,
    fechaServicio: row.fecha_servicio,
    estado: row.estado,
    createdAt: row.created_at,
  };
}

function esTextoValido(valor, max, requerido = false) {
  if (valor === undefined || valor === null || valor === '') {
    return !requerido;
  }
  if (typeof valor !== 'string') {
    return false;
  }
  const limpio = valor.trim();
  if (requerido && limpio.length === 0) {
    return false;
  }
  return limpio.length <= max;
}

function validarReporte(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Cuerpo invalido';
  }
  if (!esTextoValido(body.clientId, MAX.clientId, true)) {
    return `clientId es obligatorio y debe tener hasta ${MAX.clientId} caracteres`;
  }
  if (!esTextoValido(body.titulo, MAX.titulo, true)) {
    return `titulo es obligatorio y debe tener hasta ${MAX.titulo} caracteres`;
  }
  if (!esTextoValido(body.descripcion, MAX.descripcion)) {
    return `descripcion debe tener hasta ${MAX.descripcion} caracteres`;
  }
  if (!esTextoValido(body.cliente, MAX.cliente)) {
    return `cliente debe tener hasta ${MAX.cliente} caracteres`;
  }
  if (!esTextoValido(body.sitio, MAX.sitio)) {
    return `sitio debe tener hasta ${MAX.sitio} caracteres`;
  }
  if (body.estado !== undefined && body.estado !== null && body.estado !== '') {
    if (!esTextoValido(body.estado, MAX.estado, true) || !ESTADOS.has(body.estado)) {
      return `estado debe ser uno de: ${[...ESTADOS].join(', ')}`;
    }
  }
  if (body.fechaServicio !== undefined && body.fechaServicio !== null && body.fechaServicio !== '') {
    if (typeof body.fechaServicio !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.fechaServicio)) {
      return 'fechaServicio debe tener formato YYYY-MM-DD';
    }
    if (Number.isNaN(Date.parse(body.fechaServicio))) {
      return 'fechaServicio no es una fecha valida';
    }
  }
  return null;
}

function aNulo(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }
  if (typeof valor === 'string') {
    const limpio = valor.trim();
    return limpio.length === 0 ? null : limpio;
  }
  return valor;
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${SELECT_REPORTE} ORDER BY created_at DESC`);
    res.json({ reportes: rows.map(toReporte) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id invalido' });
  }
  try {
    const { rows } = await pool.query(`${SELECT_REPORTE} WHERE id = $1`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    res.json(toReporte(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const error = validarReporte(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const clientId = req.body.clientId.trim();
  const titulo = req.body.titulo.trim();
  const descripcion = aNulo(req.body.descripcion);
  const cliente = aNulo(req.body.cliente);
  const sitio = aNulo(req.body.sitio);
  const fechaServicio = aNulo(req.body.fechaServicio);
  const estado = aNulo(req.body.estado) || 'pendiente';

  try {
    const insert = await pool.query(
      `
        INSERT INTO public.reportes (client_id, titulo, descripcion, cliente, sitio, fecha_servicio, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (client_id) DO NOTHING
        RETURNING id, client_id, titulo, descripcion, cliente, sitio,
                  fecha_servicio::text AS fecha_servicio, estado, created_at
      `,
      [clientId, titulo, descripcion, cliente, sitio, fechaServicio, estado]
    );

    if (insert.rows.length > 0) {
      return res.status(201).json(toReporte(insert.rows[0]));
    }

    const existente = await pool.query(`${SELECT_REPORTE} WHERE client_id = $1`, [clientId]);
    if (existente.rows.length === 0) {
      return res.status(500).json({ error: 'No se pudo recuperar el reporte' });
    }
    return res.status(200).json(toReporte(existente.rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
