import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function encontrarNavegador() {
  const candidatos = [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);

  const encontrado = candidatos.find((ruta) => existsSync(ruta));
  if (!encontrado) {
    throw new Error('No se encontro Edge ni Chrome. Define EDGE_PATH o CHROME_PATH.');
  }
  return encontrado;
}

async function puertoLibre() {
  const servidor = net.createServer();
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const { port } = servidor.address();
  await new Promise((resolve) => servidor.close(resolve));
  return port;
}

function iniciarServidorReal(puerto) {
  return import('../server/index.js').then(({ app }) => new Promise((resolve, reject) => {
    const servidor = app.listen(puerto, '127.0.0.1');
    servidor.once('listening', () => resolve(servidor));
    servidor.once('error', reject);
  }));
}

async function cerrarServidor(servidor) {
  if (!servidor) {
    return;
  }
  await new Promise((resolve) => {
    servidor.close(resolve);
    servidor.closeAllConnections?.();
  });
}

function iniciarMock(puerto, estado) {
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${puerto}`);
    const cabeceras = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    };

    if (url.pathname === '/api/health' && req.method === 'GET') {
      res.writeHead(200, cabeceras);
      res.end(JSON.stringify({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() }));
      return;
    }

    if (url.pathname === '/api/reportes' && req.method === 'GET') {
      res.writeHead(200, cabeceras);
      res.end(JSON.stringify({ reportes: [] }));
      return;
    }

    if (url.pathname === '/api/reportes' && req.method === 'POST') {
      let cuerpo = '';
      req.setEncoding('utf8');
      req.on('data', (parte) => {
        cuerpo += parte;
      });
      req.on('end', () => {
        try {
          const datos = JSON.parse(cuerpo);
          estado.posts.push(datos);
          const id = 900000 + estado.posts.length;
          res.writeHead(201, cabeceras);
          res.end(JSON.stringify({ ...datos, id, createdAt: new Date().toISOString() }));
        } catch {
          res.writeHead(400, cabeceras);
          res.end(JSON.stringify({ error: 'Solicitud invalida' }));
        }
      });
      return;
    }

    res.writeHead(404, cabeceras);
    res.end(JSON.stringify({ error: 'No encontrado' }));
  });

  return new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(puerto, '127.0.0.1', () => resolve(servidor));
  });
}

async function esperarArchivo(ruta, timeout = 25000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    try {
      const contenido = await readFile(ruta, 'utf8');
      const [puerto] = contenido.trim().split(/\r?\n/);
      if (puerto && Number.isInteger(Number(puerto))) {
        return Number(puerto);
      }
    } catch {
    }
    await esperar(200);
  }
  throw new Error('No se pudo leer DevToolsActivePort');
}

async function esperarCDP(puerto, timeout = 25000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    try {
      const respuesta = await fetch(`http://127.0.0.1:${puerto}/json`);
      if (respuesta.ok) {
        const objetivos = await respuesta.json();
        if (Array.isArray(objetivos) && objetivos.length > 0) {
          return objetivos;
        }
      }
    } catch {
    }
    await esperar(200);
  }
  throw new Error('CDP no disponible');
}

async function conectarCDP(puerto) {
  const objetivos = await esperarCDP(puerto);
  const objetivo = objetivos.find((item) => item.type === 'page');
  if (!objetivo) {
    throw new Error('No hay una pagina CDP disponible');
  }

  const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let contador = 0;
  const pendientes = new Map();
  const eventos = [];

  ws.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (mensaje.id && pendientes.has(mensaje.id)) {
      pendientes.get(mensaje.id)(mensaje);
      pendientes.delete(mensaje.id);
      return;
    }
    if (mensaje.method) {
      eventos.push(mensaje);
    }
  });

  function enviar(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++contador;
      pendientes.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluar(expression) {
    const respuesta = await enviar('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (respuesta.result?.exceptionDetails) {
      const detalle = respuesta.result.exceptionDetails;
      throw new Error(`EVAL: ${detalle.exception?.description || detalle.text || 'Excepcion'}`);
    }
    return respuesta.result?.result?.value;
  }

  return { enviar, evaluar, eventos, cerrar: () => ws.close() };
}

async function esperarCarga(evaluar, timeout = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    if (await evaluar('document.readyState') === 'complete') {
      return;
    }
    await esperar(200);
  }
  throw new Error('Timeout esperando la carga de la pagina');
}

async function esperarHasta(fn, timeout, intervalo, etiqueta) {
  const inicio = Date.now();
  let ultimo;
  while (Date.now() - inicio < timeout) {
    try {
      const valor = await fn();
      if (valor) {
        return valor;
      }
      ultimo = valor;
    } catch (error) {
      ultimo = error.message;
    }
    await esperar(intervalo);
  }
  throw new Error(`Timeout ${etiqueta}: ${JSON.stringify(ultimo)}`);
}

function erroresCsp(eventos) {
  return eventos.filter((evento) => {
    if (evento.method === 'Runtime.exceptionThrown') {
      return true;
    }
    if (evento.method === 'ServiceWorker.workerErrorReported') {
      return true;
    }
    if (evento.method === 'Network.loadingFailed') {
      return evento.params.blockedReason === 'csp';
    }
    if (evento.method === 'Log.entryAdded') {
      const entry = evento.params.entry;
      return /Content Security Policy|Refused to/i.test(`${entry.source || ''} ${entry.text || ''}`);
    }
    return false;
  });
}

function erroresJs(eventos) {
  return eventos.filter((evento) => evento.method === 'Runtime.exceptionThrown');
}

const LEER_DB = `
(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('reportes-pwa', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!db.objectStoreNames.contains('reportes')) {
    return '[]';
  }
  const registros = await new Promise((resolve, reject) => {
    const tx = db.transaction('reportes', 'readonly');
    const all = tx.objectStore('reportes').getAll();
    all.onsuccess = () => resolve(all.result);
    all.onerror = () => reject(all.error);
  });
  return JSON.stringify(registros);
})()
`;

const LEER_UI = `
JSON.stringify({
  title: document.title,
  form: Boolean(document.getElementById('reporte-form')),
  formStatus: document.getElementById('form-status')?.textContent || '',
  listStatus: document.getElementById('list-status')?.textContent || '',
  syncStatus: document.getElementById('sync-status')?.textContent || '',
  connection: document.getElementById('connection-status')?.textContent || '',
  styles: Array.from(document.styleSheets).map((hoja) => hoja.href).filter(Boolean),
  reportes: Array.from(document.querySelectorAll('.reporte')).map((li) => ({
    titulo: li.querySelector('.reporte__titulo')?.textContent || '',
    badges: Array.from(li.querySelectorAll('.badge')).map((badge) => badge.textContent),
    errorSync: li.querySelector('.reporte__sync-error')?.textContent || ''
  }))
})
`;

function scriptCrear(titulo) {
  return `(() => {
    const set = (id, valor) => {
      const el = document.getElementById(id);
      el.value = valor;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('titulo', ${JSON.stringify(titulo)});
    set('descripcion', 'Prueba E2E no destructiva');
    set('cliente', 'Cliente E2E');
    set('sitio', 'Sitio E2E');
    set('fechaServicio', '2026-10-28');
    set('estado', 'pendiente');
    document.getElementById('reporte-form').requestSubmit();
    return 'ok';
  })()`;
}

function scriptCaches() {
  return `(async () => {
    const keys = await caches.keys();
    const cache = keys.includes('reportes-servicio-v4')
      ? await caches.open('reportes-servicio-v4')
      : null;
    const requests = cache ? await cache.keys() : [];
    return {
      keys,
      cached: requests.map((request) => new URL(request.url).pathname).sort(),
    };
  })()`;
}

async function detenerArbol(pid) {
  if (!pid) {
    return;
  }
  await new Promise((resolve) => {
    const proceso = spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
    proceso.on('exit', resolve);
    proceso.on('error', resolve);
  });
}

async function limpiarEdgePorPerfil(perfil) {
  const ruta = perfil.replace(/'/g, "''");
  const comando = `Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('msedge.exe', 'chrome.exe') -and $_.CommandLine -like '*${ruta}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  await new Promise((resolve) => {
    const proceso = spawn('powershell', ['-NoProfile', '-Command', comando], { stdio: 'ignore' });
    proceso.on('exit', resolve);
    proceso.on('error', resolve);
  });
}

async function principal() {
  const runId = String(Date.now());
  const tituloB = `ZZ E2E offline B ${runId}`;
  const tituloC = `ZZ E2E offline C ${runId}`;
  const puerto = await puertoLibre();
  const base = `http://127.0.0.1:${puerto}`;
  const navegador = encontrarNavegador();
  const perfil = await mkdtemp(path.join(os.tmpdir(), 'pwa-e2e-'));
  const estadoMock = { posts: [] };
  const resultados = {};

  let servidorReal = null;
  let servidorMock = null;
  let edge = null;
  let cdp = null;

  try {
    servidorReal = await iniciarServidorReal(puerto);

    edge = spawn(navegador, [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      '--remote-allow-origins=*',
      `--user-data-dir=${perfil}`,
      `${base}/offline.html`,
    ], { stdio: 'ignore' });

    const puertoCDP = await esperarArchivo(path.join(perfil, 'DevToolsActivePort'));
    cdp = await conectarCDP(puertoCDP);
    await cdp.enviar('Page.enable');
    await cdp.enviar('Runtime.enable');
    await cdp.enviar('Log.enable');
    await cdp.enviar('Network.enable');
    await cdp.enviar('ServiceWorker.enable');
    await esperarCarga(cdp.evaluar);

    const cachesPrevias = await cdp.evaluar(`(async () => {
      for (const nombre of ['reportes-servicio-v1', 'reportes-servicio-v2']) {
        const cache = await caches.open(nombre);
        await cache.put('/__e2e_old__', new Response('old', { headers: { 'Content-Type': 'text/plain' } }));
      }
      return await caches.keys();
    })()`);
    assert.ok(cachesPrevias.includes('reportes-servicio-v1'), 'No se creo la cache v1');
    assert.ok(cachesPrevias.includes('reportes-servicio-v2'), 'No se creo la cache v2');

    await cdp.enviar('Page.navigate', { url: `${base}/` });
    await esperarCarga(cdp.evaluar);

    const estadoSw = await esperarHasta(async () => {
      const valor = await cdp.evaluar(`(async () => {
        const registro = await navigator.serviceWorker.getRegistration();
        return {
          activo: Boolean(registro?.active),
          controlador: Boolean(navigator.serviceWorker.controller),
          keys: await caches.keys(),
        };
      })()`);
      return valor?.activo && valor?.controlador ? valor : null;
    }, 30000, 400, 'service-worker');

    assert.ok(estadoSw.keys.includes('reportes-servicio-v4'), 'Falta la cache v4');
    assert.ok(!estadoSw.keys.includes('reportes-servicio-v1'), 'No se elimino la cache v1');
    assert.ok(!estadoSw.keys.includes('reportes-servicio-v2'), 'No se elimino la cache v2');

    const cache = await cdp.evaluar(scriptCaches());
    const precacheEsperado = [
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
    for (const ruta of precacheEsperado) {
      assert.ok(cache.cached.includes(ruta), `Precache incompleto: falta ${ruta}`);
    }

    const uiInicial = JSON.parse(await cdp.evaluar(LEER_UI));
    assert.equal(uiInicial.title, 'Reportes de Servicio Tecnico');
    assert.equal(uiInicial.form, true);
    assert.ok(uiInicial.connection.length > 0, 'Estado de conexion vacio');
    assert.ok(uiInicial.styles.some((href) => href.endsWith('/css/styles.css')), 'CSS principal no aplicado');

    await cdp.enviar('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const movil = await cdp.evaluar(`(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      form: Boolean(document.getElementById('reporte-form')),
      overflow: getComputedStyle(document.body).overflowX,
    }))()`);
    assert.equal(movil.form, true);
    assert.ok(movil.scrollWidth <= movil.innerWidth + 1, `Desborde horizontal: ${JSON.stringify(movil)}`);
    await cdp.enviar('Emulation.clearDeviceMetricsOverride');

    assert.deepEqual(erroresCsp(cdp.eventos), [], 'Violaciones CSP en linea');
    assert.deepEqual(erroresJs(cdp.eventos), [], 'Excepciones JS en linea');

    await cdp.enviar('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
      connectionType: 'none',
    });
    await esperarHasta(async () => (await cdp.evaluar('navigator.onLine')) === false, 5000, 200, 'offline');
    await esperarHasta(async () => {
      const ui = JSON.parse(await cdp.evaluar(LEER_UI));
      return ui.connection === 'Sin conexion' ? ui : null;
    }, 10000, 300, 'ui-offline');

    await cdp.evaluar(scriptCrear(tituloB));
    const bPendiente = await esperarHasta(async () => {
      const registros = JSON.parse(await cdp.evaluar(LEER_DB));
      const registro = registros.find((item) => item.titulo === tituloB);
      return registro?.syncStatus === 'pendiente' ? registro : null;
    }, 15000, 300, 'B-pendiente');

    const uiOffline = JSON.parse(await cdp.evaluar(LEER_UI));
    const itemOffline = uiOffline.reportes.find((item) => item.titulo === tituloB);
    assert.equal(uiOffline.connection, 'Sin conexion');
    assert.ok(itemOffline?.badges.includes('Pendiente de sincronizar'), 'Badge pendiente ausente');

    await cdp.enviar('Page.reload');
    await esperarCarga(cdp.evaluar);
    await esperarHasta(async () => (await cdp.evaluar('navigator.onLine')) === false, 5000, 200, 'sigue-offline');
    await esperarHasta(async () => {
      const ui = JSON.parse(await cdp.evaluar(LEER_UI));
      return ui.connection === 'Sin conexion' && ui.form ? ui : null;
    }, 10000, 300, 'ui-offline-reload');
    const trasRecarga = await esperarHasta(async () => {
      const registros = JSON.parse(await cdp.evaluar(LEER_DB));
      const registro = registros.find((item) => item.titulo === tituloB);
      return registro?.syncStatus === 'pendiente' ? registro : null;
    }, 10000, 300, 'B-tras-recarga');
    const uiTrasRecarga = JSON.parse(await cdp.evaluar(LEER_UI));
    const itemTrasRecarga = uiTrasRecarga.reportes.find((item) => item.titulo === tituloB);
    assert.equal(trasRecarga.titulo, tituloB);
    assert.ok(itemTrasRecarga?.badges.includes('Pendiente de sincronizar'), 'Badge pendiente tras recarga ausente');

    await cdp.enviar('Page.navigate', { url: `${base}/ruta-sin-cache` });
    await esperarCarga(cdp.evaluar);
    await esperarHasta(async () => (await cdp.evaluar('document.title')) === 'Sin conexion - Reportes de Servicio', 10000, 200, 'pagina-offline');
    const offlinePage = await cdp.evaluar(`(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent || '',
      styles: Array.from(document.styleSheets).map((hoja) => hoja.href).filter(Boolean),
      bg: getComputedStyle(document.body).backgroundColor,
    }))()`);
    assert.equal(offlinePage.title, 'Sin conexion - Reportes de Servicio');
    assert.equal(offlinePage.h1, 'Sin conexion');
    assert.ok(offlinePage.styles.some((href) => href.endsWith('/css/offline.css')), 'CSS offline no aplicado');
    assert.notEqual(offlinePage.bg, 'rgba(0, 0, 0, 0)', 'Fondo offline transparente');

    await cdp.enviar('Page.navigate', { url: `${base}/` });
    await esperarCarga(cdp.evaluar);
    await esperarHasta(async () => (await cdp.evaluar('Boolean(document.getElementById("reporte-form"))')) === true, 10000, 300, 'app-offline');

    await cerrarServidor(servidorReal);
    servidorReal = null;
    await esperar(500);

    await cdp.enviar('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: 'wifi',
    });
    await esperarHasta(async () => (await cdp.evaluar('navigator.onLine')) === true, 5000, 200, 'online-sin-api');

    const bError = await esperarHasta(async () => {
      const registros = JSON.parse(await cdp.evaluar(LEER_DB));
      const registro = registros.find((item) => item.titulo === tituloB);
      return registro?.syncStatus === 'error' ? registro : null;
    }, 20000, 400, 'B-error');
    const uiError = await esperarHasta(async () => {
      const ui = JSON.parse(await cdp.evaluar(LEER_UI));
      const item = ui.reportes.find((reporte) => reporte.titulo === tituloB);
      return ui.connection === 'Servidor no disponible' && item?.badges.includes('Error al sincronizar') ? ui : null;
    }, 10000, 300, 'ui-servidor-caido');
    const itemError = uiError.reportes.find((item) => item.titulo === tituloB);
    assert.ok(bError.syncError, 'Falta el detalle del error de sincronizacion');
    assert.ok(itemError?.badges.includes('Error al sincronizar'), 'Badge de error ausente');
    assert.match(uiError.connection, /Servidor no disponible/, 'Estado de conexion tras caida');

    servidorMock = await iniciarMock(puerto, estadoMock);
    await cdp.evaluar("document.getElementById('sync-button').click(); 'clicked'");

    const bSincronizada = await esperarHasta(async () => {
      const registros = JSON.parse(await cdp.evaluar(LEER_DB));
      const registro = registros.find((item) => item.titulo === tituloB);
      return registro?.syncStatus === 'sincronizado' && registro.serverId ? registro : null;
    }, 15000, 300, 'B-sincronizada');

    assert.equal(bSincronizada.serverId, 900001);
    assert.equal(estadoMock.posts.length, 1);
    assert.equal(estadoMock.posts[0].titulo, tituloB);
    const postsB = estadoMock.posts.length;
    const uiSincronizada = await esperarHasta(async () => {
      const ui = JSON.parse(await cdp.evaluar(LEER_UI));
      const item = ui.reportes.find((reporte) => reporte.titulo === tituloB);
      return item?.badges.includes('Sincronizado') ? ui : null;
    }, 10000, 300, 'ui-sincronizada');
    const itemSincronizado = uiSincronizada.reportes.find((item) => item.titulo === tituloB);
    assert.ok(itemSincronizado?.badges.includes('Sincronizado'), 'Badge sincronizado ausente');

    await cdp.enviar('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
      connectionType: 'none',
    });
    await esperarHasta(async () => (await cdp.evaluar('navigator.onLine')) === false, 5000, 200, 'offline-para-C');
    await cdp.evaluar(scriptCrear(tituloC));
    await esperarHasta(async () => {
      const registros = JSON.parse(await cdp.evaluar(LEER_DB));
      const registro = registros.find((item) => item.titulo === tituloC);
      return registro?.syncStatus === 'pendiente' ? registro : null;
    }, 15000, 300, 'C-pendiente');

    await cdp.enviar('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: 'wifi',
    });
    await esperarHasta(async () => (await cdp.evaluar('navigator.onLine')) === true, 5000, 200, 'online-C');

    const cSincronizada = await esperarHasta(async () => {
      const registros = JSON.parse(await cdp.evaluar(LEER_DB));
      const registro = registros.find((item) => item.titulo === tituloC);
      return registro?.syncStatus === 'sincronizado' && registro.serverId ? registro : null;
    }, 20000, 400, 'C-sincronizada-auto');
    assert.equal(cSincronizada.serverId, 900002);
    assert.equal(estadoMock.posts.length, 2);
    assert.equal(estadoMock.posts[1].titulo, tituloC);

    assert.deepEqual(erroresCsp(cdp.eventos), [], 'Violaciones CSP al final');
    assert.deepEqual(erroresJs(cdp.eventos), [], 'Excepciones JS al final');

    Object.assign(resultados, {
      puerto,
      navegador: path.basename(navegador),
      serviceWorker: {
        activo: estadoSw.activo,
        controlador: estadoSw.controlador,
        cacheV4: estadoSw.keys.includes('reportes-servicio-v4'),
        cachesAntiguasEliminadas: !estadoSw.keys.includes('reportes-servicio-v1')
          && !estadoSw.keys.includes('reportes-servicio-v2'),
      },
      precache: cache.cached,
      responsive: movil,
      offline: {
        pendiente: bPendiente.syncStatus,
        persistioTrasRecarga: trasRecarga.syncStatus,
        paginaOffline: offlinePage.title,
      },
      errorApi: {
        estado: bError.syncStatus,
        mensaje: bError.syncError,
        conexion: uiError.connection,
      },
      recuperacion: {
        estado: bSincronizada.syncStatus,
        serverId: bSincronizada.serverId,
        posts: postsB,
      },
      sincronizacionAutomatica: {
        estado: cSincronizada.syncStatus,
        serverId: cSincronizada.serverId,
        posts: estadoMock.posts.length,
      },
      csp: 'sin violaciones',
      erroresJs: 'sin excepciones',
      ok: true,
    });
  } catch (error) {
    resultados.ok = false;
    resultados.error = error.message;
  } finally {
    try {
      cdp?.cerrar();
    } catch {
    }
    try {
      await cerrarServidor(servidorMock);
    } catch {
    }
    try {
      await cerrarServidor(servidorReal);
    } catch {
    }
    try {
      await detenerArbol(edge?.pid);
    } catch {
    }
    await limpiarEdgePorPerfil(perfil);
    try {
      await rm(perfil, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    } catch {
    }
    try {
      const { pool } = await import('../server/db.js');
      await pool.end();
    } catch {
    }
  }

  console.log(JSON.stringify(resultados, null, 2));
  if (!resultados.ok) {
    process.exitCode = 1;
  }
}

await principal();
