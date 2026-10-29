import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX, validarReporte } from '../server/lib/validacion.js';

const base = {
  clientId: 'cliente-prueba',
  titulo: 'Reporte de prueba',
  descripcion: 'Descripcion obligatoria',
  cliente: 'Cliente obligatorio',
  sitio: 'Sitio obligatorio',
  fechaServicio: '2099-01-01',
};

test('acepta un reporte minimo y uno completo', () => {
  assert.equal(validarReporte(base), null);
  assert.equal(validarReporte({
    ...base,
    descripcion: 'Descripcion',
    cliente: 'Cliente',
    sitio: 'Sitio',
    fechaServicio: '2099-02-28',
    estado: 'en_proceso',
  }), null);
});

test('rechaza cuerpo invalido y campos obligatorios', () => {
  assert.equal(validarReporte(null), 'Cuerpo invalido');
  assert.equal(validarReporte([]), 'Cuerpo invalido');
  assert.match(validarReporte({ titulo: 'x' }), /clientId/);
  assert.match(validarReporte({ clientId: 'x' }), /titulo/);
  assert.match(validarReporte({ ...base, clientId: '   ' }), /clientId/);
  assert.match(validarReporte({ ...base, titulo: '   ' }), /titulo/);
});

test('rechaza longitudes fuera de limite', () => {
  assert.match(validarReporte({ ...base, clientId: 'x'.repeat(MAX.clientId + 1) }), /clientId/);
  assert.match(validarReporte({ ...base, titulo: 'x'.repeat(MAX.titulo + 1) }), /titulo/);
  assert.match(validarReporte({ ...base, descripcion: 'x'.repeat(MAX.descripcion + 1) }), /descripcion/);
  assert.match(validarReporte({ ...base, cliente: 'x'.repeat(MAX.cliente + 1) }), /cliente/);
  assert.match(validarReporte({ ...base, sitio: 'x'.repeat(MAX.sitio + 1) }), /sitio/);
  assert.match(validarReporte({ ...base, estado: 'x'.repeat(MAX.estado + 1) }), /estado/);
});

test('rechaza estados no permitidos y acepta los permitidos', () => {
  assert.match(validarReporte({ ...base, estado: 'otro' }), /estado/);
  for (const estado of ['pendiente', 'en_proceso', 'completado']) {
    assert.equal(validarReporte({ ...base, estado }), null);
  }
});

test('rechaza fechas imposibles y formatos invalidos', () => {
  for (const fecha of [
    '2026-02-29',
    '2026-02-31',
    '2026-04-31',
    '2026-13-01',
    '0000-01-01',
  ]) {
    assert.equal(
      validarReporte({ ...base, fechaServicio: fecha }),
      'fechaServicio no es una fecha valida',
      fecha,
    );
  }
  for (const fecha of ['2026-2-28', '2026-02-28T00:00:00', 20260228]) {
    assert.match(
      validarReporte({ ...base, fechaServicio: fecha }),
      /fechaServicio.*formato YYYY-MM-DD/,
      String(fecha),
    );
  }
});

test('acepta fecha bisiesta real y rechaza fecha vacia o nula', () => {
  assert.equal(validarReporte({ ...base, fechaServicio: '2096-02-29' }), null);
  assert.match(validarReporte({ ...base, fechaServicio: '' }), /fechaServicio es obligatoria/);
  assert.match(validarReporte({ ...base, fechaServicio: null }), /fechaServicio es obligatoria/);
});
