import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../server/index.js';
import { pool } from '../server/db.js';
import { validarReporte } from '../server/lib/validacion.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections?.();
    });
  }
  await pool.end();
});

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization') && !headers.has('X-Owner-Code')) {
    headers.set('X-Owner-Code', `test-owner-${Date.now()}`);
  }
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
  }
  return { res, text, json };
}

function assertSecurityHeaders(res, contexto) {
  const csp = res.headers.get('content-security-policy') || '';
  for (const directiva of [
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
  ]) {
    assert.ok(csp.includes(directiva), `${contexto}: falta ${directiva}`);
  }
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff', `${contexto}: X-Content-Type-Options`);
  assert.equal(res.headers.get('x-frame-options'), 'DENY', `${contexto}: X-Frame-Options`);
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer', `${contexto}: Referrer-Policy`);
  assert.equal(res.headers.get('x-xss-protection'), '0', `${contexto}: X-XSS-Protection`);
  assert.match(res.headers.get('permissions-policy') || '', /camera=\(\)/, `${contexto}: Permissions-Policy`);
  assert.equal(res.headers.get('x-powered-by'), null, `${contexto}: X-Powered-By`);
}

async function postJson(body) {
  return request('/api/reportes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('GET / sirve la app con cabeceras y sin contenido inline bloqueado por CSP', async () => {
  const { res, text } = await request('/');
  assert.equal(res.status, 200);
  assertSecurityHeaders(res, 'GET /');
  assert.equal(res.headers.get('strict-transport-security'), null);
  assert.ok(!text.includes('<style'), 'no debe haber <style> inline');
  assert.ok(!/ style=/.test(text), 'no debe haber atributos style inline');
  assert.ok(!/\son[a-z]+=/i.test(text), 'no debe haber manejadores inline');
  assert.match(text, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(text, /<script type="module" src="\/js\/app\.js"><\/script>/);
});

test('GET /api/health responde y aplica no-store y HSTS condicional', async () => {
  const health = await request('/api/health');
  assert.equal(health.res.status, 200);
  assert.equal(health.json.status, 'ok');
  assert.ok(['connected', 'disconnected'].includes(health.json.database));
  assertSecurityHeaders(health.res, 'GET /api/health');
  assert.equal(health.res.headers.get('cache-control'), 'no-store');
  assert.equal(health.res.headers.get('strict-transport-security'), null);

  const https = await request('/api/health', { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(https.res.status, 200);
  assert.equal(https.res.headers.get('strict-transport-security'), 'max-age=15552000');
});

test('sirve manifest, service worker, fechas y CSS offline con MIME correcto', async () => {
  const manifest = await request('/manifest.webmanifest');
  assert.equal(manifest.res.status, 200);
  assert.match(manifest.res.headers.get('content-type') || '', /manifest\+json|application\/json/);
  assert.equal(manifest.json.display, 'standalone');

  const sw = await request('/sw.js');
  assert.equal(sw.res.status, 200);
  assert.match(sw.res.headers.get('content-type') || '', /javascript/);
  assert.match(sw.text, /\$\{CACHE_PREFIX\}v7/);
  assert.match(sw.text, /'\/js\/fechas\.js'/);
  assert.match(sw.text, /'\/css\/offline\.css'/);

  const fechas = await request('/js/fechas.js');
  assert.equal(fechas.res.status, 200);
  assert.match(fechas.res.headers.get('content-type') || '', /javascript/);
  assert.match(fechas.text, /export function esFechaCalendarioValida/);

  const offlineCss = await request('/css/offline.css');
  assert.equal(offlineCss.res.status, 200);
  assert.match(offlineCss.res.headers.get('content-type') || '', /text\/css/);
  assert.match(offlineCss.text, /:root/);

  const offline = await request('/offline.html');
  assert.equal(offline.res.status, 200);
  assert.match(offline.text, /<link rel="stylesheet" href="\/css\/offline\.css">/);
  assert.ok(!offline.text.includes('<style'));
});

test('rechaza JSON invalido, cuerpo grande y cuerpos no objeto sin filtrar detalles internos', async () => {
  const malformed = await request('/api/reportes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.res.status, 400);
  assert.equal(malformed.json.error, 'Solicitud invalida');
  assert.doesNotMatch(malformed.text, /postgresql:\/\/|password|SASL|ECONNREFUSED/i);

  const array = await postJson([]);
  assert.equal(array.res.status, 400);
  assert.equal(array.json.error, 'Cuerpo invalido');

  const oversized = await request('/api/reportes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'x', titulo: 'x'.repeat(17000) }),
  });
  assert.equal(oversized.res.status, 413);
  assert.equal(oversized.json.error, 'Solicitud demasiado grande');
  assertSecurityHeaders(oversized.res, 'POST grande');
});

test('rechaza campos invalidos y fechas imposibles sin escribir en la base', async () => {
  const prefijo = `test-api-${Date.now()}`;
  const base = { clientId: `${prefijo}-base`, titulo: 'Prueba', descripcion: 'Descripcion', cliente: 'Cliente', sitio: 'Sitio', fechaServicio: '2099-02-28' };
  const casos = [
    [{ titulo: 'x', descripcion: 'Descripcion', cliente: 'Cliente', sitio: 'Sitio', fechaServicio: '2099-02-28' }, /clientId/],
    [{ clientId: `${prefijo}-sin-titulo`, fechaServicio: '2026-02-28' }, /titulo/],
    [{ ...base, clientId: '   ' }, /clientId/],
    [{ ...base, titulo: '   ' }, /titulo/],
    [{ ...base, descripcion: 'x'.repeat(2001) }, /descripcion/],
    [{ ...base, cliente: 'x'.repeat(201) }, /cliente/],
    [{ ...base, sitio: 'x'.repeat(201) }, /sitio/],
    [{ ...base, estado: 'otro' }, /estado/],
    [{ ...base, fechaServicio: '2026-02-31' }, /fechaServicio no es una fecha valida/],
    [{ ...base, fechaServicio: '2026-04-31' }, /fechaServicio no es una fecha valida/],
    [{ ...base, fechaServicio: '2026-13-01' }, /fechaServicio no es una fecha valida/],
    [{ ...base, fechaServicio: '2026-2-28' }, /formato YYYY-MM-DD/],
    [{ ...base, fechaServicio: 20260228 }, /formato YYYY-MM-DD/],
  ];

  for (const [body, patron] of casos) {
    const resultado = await postJson(body);
    assert.equal(resultado.res.status, 400, JSON.stringify(body));
    assert.match(resultado.json.error, patron);
  }

  const health = await request('/api/health');
  if (health.json.database === 'connected') {
    const lista = await request('/api/reportes');
    assert.equal(lista.res.status, 200);
    const insertados = lista.json.reportes.filter((reporte) => reporte.clientId.startsWith(prefijo));
    assert.deepEqual(insertados, []);
  }
});

test('valida ids, rutas inexistentes y respuestas 404', async () => {
  const idInvalido = await request('/api/reportes/abc');
  assert.equal(idInvalido.res.status, 400);
  assert.equal(idInvalido.json.error, 'id invalido');

  const inexistente = await request('/api/no-existe');
  assert.equal(inexistente.res.status, 404);
  assert.equal(inexistente.json.error, 'No encontrado');
  assert.equal(inexistente.res.headers.get('cache-control'), 'no-store');

  const health = await request('/api/health');
  if (health.json.database === 'connected') {
    const noExiste = await request('/api/reportes/999999999999');
    assert.equal(noExiste.res.status, 404);
    assert.equal(noExiste.json.error, 'Reporte no encontrado');
  }
});

test('idempotencia no crea duplicados ni modifica un reporte existente', async (t) => {
  const health = await request('/api/health');
  if (health.json.database !== 'connected') {
    t.skip('PostgreSQL no disponible; prueba de idempotencia omitida');
    return;
  }

  const lista = await request('/api/reportes');
  if (!lista.res.ok) {
    t.skip(`No se pudo listar reportes: HTTP ${lista.res.status}`);
    return;
  }

  const existente = lista.json.reportes.find((reporte) => (
    validarReporte(reporte) === null
    && reporte.clientId === reporte.clientId.trim()
  ));
  if (!existente) {
    t.skip('No hay un reporte existente valido para probar sin crear datos');
    return;
  }

  const antes = lista.json.reportes.length;
  const body = {
    clientId: existente.clientId,
    titulo: existente.titulo,
    descripcion: existente.descripcion,
    cliente: existente.cliente,
    sitio: existente.sitio,
    fechaServicio: existente.fechaServicio,
    estado: existente.estado,
  };

  const repetido = await postJson(body);
  assert.equal(repetido.res.status, 200);
  assert.equal(repetido.json.id, existente.id);

  const despues = await request('/api/reportes');
  assert.equal(despues.res.status, 200);
  assert.equal(despues.json.reportes.length, antes);
});
