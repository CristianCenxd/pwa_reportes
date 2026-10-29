import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const raiz = new URL('../', import.meta.url);

async function leer(ruta) {
  return readFile(new URL(ruta, raiz), 'utf8');
}

async function leerBinario(ruta) {
  return readFile(new URL(ruta, raiz));
}

function dimensionesPng(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'firma PNG');
  return {
    ancho: buffer.readUInt32BE(16),
    alto: buffer.readUInt32BE(20),
  };
}

test('manifest declara nombre, colores, standalone e iconos 192/512 validos', async () => {
  const manifest = JSON.parse(await leer('public/manifest.webmanifest'));
  assert.equal(manifest.name, 'Reportes de Servicio');
  assert.equal(manifest.short_name, 'Reportes');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);

  const iconos = new Map(manifest.icons.map((icono) => [icono.sizes, icono]));
  assert.equal(iconos.get('192x192')?.type, 'image/png');
  assert.equal(iconos.get('512x512')?.type, 'image/png');

  assert.deepEqual(dimensionesPng(await leerBinario('public/icons/icon-192.png')), { ancho: 192, alto: 192 });
  assert.deepEqual(dimensionesPng(await leerBinario('public/icons/icon-512.png')), { ancho: 512, alto: 512 });
});

test('index.html vincula manifest, CSS y modulo; no usa inline bloqueado por CSP', async () => {
  const html = await leer('public/index.html');
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<meta name="theme-color" content="#0b4f8a">/);
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="icon" href="\/icons\/icon-192\.png"/);
  assert.match(html, /<link rel="stylesheet" href="\/css\/styles\.css">/);
  assert.match(html, /<script type="module" src="\/js\/app\.js"><\/script>/);
  assert.ok(!html.includes('<style'));
  assert.ok(!/ style=/.test(html));
  assert.ok(!/\son[a-z]+=/i.test(html));
});

test('offline.html usa CSS externo y no estilos inline', async () => {
  const html = await leer('public/offline.html');
  assert.match(html, /<link rel="icon" href="\/icons\/icon-192\.png"/);
  assert.match(html, /<link rel="stylesheet" href="\/css\/offline\.css">/);
  assert.ok(!html.includes('<style'));
  assert.match(html, /Sin conexion/);
});

test('service worker implementa install/activate/fetch, precache v5 y red solo para API', async () => {
  const sw = await leer('public/sw.js');
  assert.match(sw, /addEventListener\('install'/);
  assert.match(sw, /addEventListener\('activate'/);
  assert.match(sw, /addEventListener\('fetch'/);
  assert.match(sw, /skipWaiting\(\)/);
  assert.match(sw, /clients\.claim\(\)/);
  assert.match(sw, /\$\{CACHE_PREFIX\}v5/);
  assert.match(sw, /caches\.delete\(key\)/);
  assert.match(sw, /cache\.addAll\(PRECACHE_URLS\)/);
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /fetch\(request, \{ cache: 'no-store' \}\)/);
  assert.match(sw, /request\.mode === 'navigate'/);

  for (const recurso of [
    '/',
    '/index.html',
    '/offline.html',
    '/css/styles.css',
    '/css/offline.css',
    '/js/app.js',
    '/js/fechas.js',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
  ]) {
    assert.ok(sw.includes(`'${recurso}'`), `precache incompleto: ${recurso}`);
  }
});

test('app.js conserva IndexedDB, offline-first, sync automatica y validacion compartida', async () => {
  const app = await leer('public/js/app.js');
  assert.match(app, /from '\.\/fechas\.js'/);
  assert.match(app, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(app, /createObjectStore\(STORE_REPORTES, \{ keyPath: 'localId' \}\)/);
  assert.match(app, /createIndex\('clientId', 'clientId', \{ unique: true \}\)/);
  assert.match(app, /guardarReporteLocal\(registro\)/);
  assert.match(app, /navigator\.onLine/);
  assert.match(app, /window\.addEventListener\('online'/);
  assert.match(app, /window\.addEventListener\('offline'/);
  assert.match(app, /sincronizarPendientes/);
  assert.match(app, /esFechaCalendarioValida\(datos\.fechaServicio\)/);
});

test('package.json expone scripts de ejecucion y pruebas', async () => {
  const pkg = JSON.parse(await leer('package.json'));
  assert.equal(pkg.scripts.start, 'node server/index.js');
  assert.equal(pkg.scripts.dev, 'node --watch server/index.js');
  assert.match(pkg.scripts.test, /node --test/);
  assert.match(pkg.scripts['test:e2e'], /scripts\/e2e-offline\.mjs/);
});

test('.gitignore excluye secretos, dependencias y artefactos', async () => {
  const gitignore = await leer('.gitignore');
  for (const patron of ['.env', 'node_modules/', '*.log', 'certs/', 'coverage/', 'dist/', 'test-results/']) {
    assert.ok(gitignore.includes(patron), `falta patron ${patron}`);
  }
});

test('.env.example no contiene credenciales embebidas', async () => {
  const ejemplo = await leer('.env.example');
  assert.match(ejemplo, /^DATABASE_URL=/m);
  assert.match(ejemplo, /^PORT=/m);
  assert.doesNotMatch(ejemplo, /postgresql:\/\/[^@\s]*:[^@\s]*@/i);
  assert.doesNotMatch(ejemplo, /pwacris|contrasena|contraseña/i);
});

test('README documenta requisitos, ejecucion, pruebas, offline, sync y despliegue', async () => {
  const readme = await leer('README.md');
  for (const seccion of [
    '## Requisitos',
    '## Instalacion',
    '## Configuracion',
    '## Ejecucion',
    '## Endpoints',
    '## Pruebas',
    '## Uso offline',
    '## Sincronizacion',
    '## Despliegue',
  ]) {
    assert.ok(readme.includes(seccion), `falta seccion ${seccion}`);
  }
});

test('entregables academicos existen y cubren la matriz', async () => {
  const matriz = await leer('docs/MATRIZ-CUMPLIMIENTO.md');
  assert.match(matriz, /CUMPLIDO Y PROBADO/);
  assert.match(matriz, /IMPLEMENTADO PERO NO PROBADO/);
  assert.match(matriz, /PENDIENTE/);

  const arquitectura = await leer('docs/ARQUITECTURA.md');
  assert.match(arquitectura, /Safari/i);
  assert.match(arquitectura, /iOS/i);
  assert.match(arquitectura, /Matriz de decision/i);

  const pruebas = await leer('docs/PRUEBAS.md');
  assert.match(pruebas, /npm\.cmd test/);
  assert.match(pruebas, /test:e2e/);

  const despliegue = await leer('docs/DESPLIEGUE.md');
  assert.match(despliegue, /HTTPS/);

  const demo = await leer('docs/DEMO.md');
  assert.match(demo, /Demostracion/i);

  const plan = await leer('PLAN.md');
  assert.match(plan, /Checklist de aceptacion/i);
});
