const CACHE_PREFIX = 'reportes-servicio-';
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
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
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function redPrimeroNavegacion(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      return response;
    }
  } catch {
  }

  const url = new URL(request.url);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const appShell = await caches.match('/index.html');
    if (appShell) {
      return appShell;
    }
  }

  const offline = await caches.match(OFFLINE_URL);
  if (offline) {
    return offline;
  }

  return new Response('Sin conexion a internet.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function cachePrimero(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Sin conexion' });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => new Response(
        JSON.stringify({ error: 'Servidor no disponible' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        },
      )),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(redPrimeroNavegacion(request));
    return;
  }

  event.respondWith(cachePrimero(request));
});
