import test from 'node:test';
import assert from 'node:assert/strict';
import { esFechaCalendarioValida, tieneFormatoFecha } from '../public/js/fechas.js';

test('tieneFormatoFecha acepta solo YYYY-MM-DD', () => {
  for (const valor of ['2026-02-28', '2024-02-29', '0001-01-01', '9999-12-31']) {
    assert.equal(tieneFormatoFecha(valor), true, `deberia aceptar ${valor}`);
  }
  for (const valor of [
    '2026-2-28',
    '2026-02-28T00:00:00',
    ' 2026-02-28',
    '2026-02-28 ',
    '2026/02/28',
    '2026-02-28abc',
    '2026-02-28-01',
    '',
    null,
    undefined,
    20260228,
  ]) {
    assert.equal(tieneFormatoFecha(valor), false, `deberia rechazar ${String(valor)}`);
  }
});

test('esFechaCalendarioValida acepta fechas reales', () => {
  for (const valor of [
    '2026-02-28',
    '2024-02-29',
    '2000-02-29',
    '2400-02-29',
    '2026-01-31',
    '2026-04-30',
    '2026-12-31',
    '0001-01-01',
    '9999-12-31',
  ]) {
    assert.equal(esFechaCalendarioValida(valor), true, `deberia aceptar ${valor}`);
  }
});

test('esFechaCalendarioValida rechaza rollover, meses invalidos y anos no bisiestos', () => {
  for (const valor of [
    '2026-02-29',
    '2025-02-29',
    '1900-02-29',
    '2100-02-29',
    '2026-02-30',
    '2026-02-31',
    '2026-04-31',
    '2026-06-31',
    '2026-09-31',
    '2026-11-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-01-32',
    '0000-01-01',
    '2026-2-28',
    '2026-02-28T00:00:00',
    ' 2026-02-28',
    '2026-02-28 ',
    '2026/02/28',
    '',
    null,
    undefined,
    20260228,
  ]) {
    assert.equal(esFechaCalendarioValida(valor), false, `deberia rechazar ${String(valor)}`);
  }
});
