import { esFechaCalendarioValida, fechaHoyLocal, tieneFormatoFecha } from '../../public/js/fechas.js';

export const ESTADOS = new Set(['pendiente', 'en_proceso', 'completado']);

export const MAX = {
  clientId: 100,
  titulo: 200,
  descripcion: 2000,
  cliente: 200,
  sitio: 200,
  estado: 30,
};

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

export function validarReporte(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Cuerpo invalido';
  }
  if (!esTextoValido(body.clientId, MAX.clientId, true)) {
    return `clientId es obligatorio y debe tener hasta ${MAX.clientId} caracteres`;
  }
  if (!esTextoValido(body.titulo, MAX.titulo, true)) {
    return `titulo es obligatorio y debe tener hasta ${MAX.titulo} caracteres`;
  }
  if (!esTextoValido(body.descripcion, MAX.descripcion, true)) {
    return `descripcion es obligatoria y debe tener hasta ${MAX.descripcion} caracteres`;
  }
  if (!esTextoValido(body.cliente, MAX.cliente, true)) {
    return `cliente es obligatorio y debe tener hasta ${MAX.cliente} caracteres`;
  }
  if (!esTextoValido(body.sitio, MAX.sitio, true)) {
    return `sitio es obligatorio y debe tener hasta ${MAX.sitio} caracteres`;
  }
  if (body.estado !== undefined && body.estado !== null && body.estado !== '') {
    if (!esTextoValido(body.estado, MAX.estado, true) || !ESTADOS.has(body.estado)) {
      return `estado debe ser uno de: ${[...ESTADOS].join(', ')}`;
    }
  }
  if (!tieneFormatoFecha(body.fechaServicio)) {
    return 'fechaServicio es obligatoria y debe tener formato YYYY-MM-DD';
  }
  if (!esFechaCalendarioValida(body.fechaServicio)) {
    return 'fechaServicio no es una fecha valida';
  }
  if (body.fechaServicio < fechaHoyLocal()) {
    return 'fechaServicio no puede ser una fecha pasada';
  }
  return null;
}
