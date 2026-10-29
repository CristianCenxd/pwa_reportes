import { esFechaCalendarioValida, fechaHoyLocal } from './fechas.js';

const form = document.getElementById('reporte-form');
const submitButton = document.getElementById('submit-button');
const formStatus = document.getElementById('form-status');
const listEl = document.getElementById('reportes-list');
const listStatus = document.getElementById('list-status');
const syncStatus = document.getElementById('sync-status');
const refreshButton = document.getElementById('refresh-button');
const connectionStatus = document.getElementById('connection-status');
const fechaServicioInput = document.getElementById('fechaServicio');
if (fechaServicioInput) {
  fechaServicioInput.min = fechaHoyLocal();
}

const ESTADOS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completado: 'Completado',
};

const MAX = {
  titulo: 200,
  descripcion: 2000,
  cliente: 200,
  sitio: 200,
};

const CAMPOS = ['titulo', 'descripcion', 'cliente', 'sitio', 'fechaServicio', 'estado'];

const DB_NAME = 'reportes-pwa';
const DB_VERSION = 1;
const STORE_REPORTES = 'reportes';

let dbPromise = null;
let sincronizando = false;
let sesionStaff = null;
let sesionCliente = null;
let paginaActual = 1;
const TAMANO_PAGINA = 5;

function codigoPropietario() {
  let codigo = localStorage.getItem('ownerCode');
  if (!codigo || !/^[a-zA-Z0-9_-]{12,100}$/.test(codigo)) {
    codigo = generarClientId().replace(/-/g, '').slice(0, 32);
    localStorage.setItem('ownerCode', codigo);
  }
  return codigo;
}

function headersApi(extra = {}) {
  const sesionActiva = sesionStaff || sesionCliente;
  return sesionActiva
    ? { ...extra, Authorization: 'Bearer ' + sesionActiva.token }
    : { ...extra };
}

function generarClientId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  const aleatorio = Math.random().toString(16).slice(2);
  return `reporte-${Date.now()}-${aleatorio}`;
}

function abrirDB() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      dbPromise = null;
      reject(new Error('IndexedDB no disponible'));
      return;
    }

    const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      if (!db.objectStoreNames.contains(STORE_REPORTES)) {
        const store = db.createObjectStore(STORE_REPORTES, { keyPath: 'localId' });
        store.createIndex('clientId', 'clientId', { unique: true });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => {
      dbPromise = null;
      reject(solicitud.error || new Error('No se pudo abrir IndexedDB'));
    };
  });

  return dbPromise;
}

async function guardarReporteLocal(registro) {
  const db = await abrirDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTES, 'readwrite');
    tx.objectStore(STORE_REPORTES).put(registro);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaccion abortada'));
  });
}

async function obtenerReportesLocales() {
  const db = await abrirDB();
  const registros = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTES, 'readonly');
    const solicitud = tx.objectStore(STORE_REPORTES).getAll();
    solicitud.onsuccess = () => resolve(solicitud.result || []);
    solicitud.onerror = () => reject(solicitud.error);
  });

  const filtrados = sesionStaff
    ? registros
    : registros.filter((registro) => registro.ownerCode === codigoPropietario());
  return filtrados.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function obtenerReportePorClientId(clientId) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTES, 'readonly');
    const solicitud = tx.objectStore(STORE_REPORTES).index('clientId').get(clientId);
    solicitud.onsuccess = () => resolve(solicitud.result || null);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function actualizarReporteLocal(localId, cambios) {
  const db = await abrirDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORTES, 'readwrite');
    const store = tx.objectStore(STORE_REPORTES);
    const solicitud = store.get(localId);

    solicitud.onsuccess = () => {
      const actual = solicitud.result;
      if (!actual) {
        tx.abort();
        reject(new Error('Reporte local no encontrado'));
        return;
      }
      store.put({ ...actual, ...cambios });
    };

    solicitud.onerror = () => reject(solicitud.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaccion abortada'));
  });
}

async function guardarReporteServidor(serverReport) {
  if (!serverReport || !serverReport.clientId) {
    return;
  }

  const ahora = new Date().toISOString();
  const existente = await obtenerReportePorClientId(serverReport.clientId);

  if (existente) {
    await actualizarReporteLocal(existente.localId, {
      titulo: serverReport.titulo || existente.titulo,
      descripcion: serverReport.descripcion || '',
      cliente: serverReport.cliente || '',
      sitio: serverReport.sitio || '',
      fechaServicio: serverReport.fechaServicio || '',
      estado: serverReport.estado || existente.estado,
      ownerCode: sesionStaff ? null : codigoPropietario(),
      syncStatus: 'sincronizado',
      serverId: serverReport.id,
      syncedAt: existente.syncedAt || ahora,
      syncError: null,
      updatedAt: ahora,
    });
    return;
  }

  await guardarReporteLocal({
    localId: generarClientId(),
    clientId: serverReport.clientId,
    titulo: serverReport.titulo || 'Reporte sin titulo',
    descripcion: serverReport.descripcion || '',
    cliente: serverReport.cliente || '',
    sitio: serverReport.sitio || '',
    fechaServicio: serverReport.fechaServicio || '',
    estado: serverReport.estado || 'pendiente',
    ownerCode: sesionStaff ? null : codigoPropietario(),
    syncStatus: 'sincronizado',
    createdAt: serverReport.createdAt || ahora,
    updatedAt: ahora,
    serverId: serverReport.id,
    syncedAt: ahora,
    syncError: null,
  });
}

function mostrarError(campo, mensaje) {
  const input = document.getElementById(campo);
  const errorEl = document.getElementById(`error-${campo}`);
  if (!input || !errorEl) {
    return;
  }
  if (mensaje) {
    errorEl.textContent = mensaje;
    input.setAttribute('aria-invalid', 'true');
  } else {
    errorEl.textContent = '';
    input.removeAttribute('aria-invalid');
  }
}

function limpiarErrores() {
  CAMPOS.forEach((campo) => mostrarError(campo, ''));
}

function obtenerDatos() {
  return {
    titulo: document.getElementById('titulo').value,
    descripcion: document.getElementById('descripcion').value,
    cliente: document.getElementById('cliente').value,
    sitio: document.getElementById('sitio').value,
    fechaServicio: document.getElementById('fechaServicio').value,
    estado: document.getElementById('estado').value,
  };
}

function validarFormulario(datos) {
  const errores = {};
  const titulo = datos.titulo.trim();

  if (!titulo) {
    errores.titulo = 'El titulo es obligatorio.';
  } else if (titulo.length > MAX.titulo) {
    errores.titulo = `El titulo no puede superar ${MAX.titulo} caracteres.`;
  }

  if (!datos.descripcion.trim()) {
    errores.descripcion = 'La descripcion es obligatoria.';
  } else if (datos.descripcion.trim().length > MAX.descripcion) {
    errores.descripcion = `La descripcion no puede superar ${MAX.descripcion} caracteres.`;
  }

  if (!datos.cliente.trim()) {
    errores.cliente = 'El cliente es obligatorio.';
  } else if (datos.cliente.trim().length > MAX.cliente) {
    errores.cliente = `El cliente no puede superar ${MAX.cliente} caracteres.`;
  }

  if (!datos.sitio.trim()) {
    errores.sitio = 'El sitio es obligatorio.';
  } else if (datos.sitio.trim().length > MAX.sitio) {
    errores.sitio = `El sitio no puede superar ${MAX.sitio} caracteres.`;
  }

  if (!datos.fechaServicio) {
    errores.fechaServicio = 'La fecha del servicio es obligatoria.';
  } else if (!esFechaCalendarioValida(datos.fechaServicio)) {
    errores.fechaServicio = 'Indica una fecha valida.';
  } else if (datos.fechaServicio < fechaHoyLocal()) {
    errores.fechaServicio = 'No puedes elegir una fecha pasada.';
  }

  if (!ESTADOS[datos.estado]) {
    errores.estado = 'Selecciona un estado valido.';
  }

  CAMPOS.forEach((campo) => mostrarError(campo, errores[campo] || ''));

  const primerCampo = CAMPOS.find((campo) => errores[campo]);
  if (primerCampo) {
    document.getElementById(primerCampo).focus();
  }

  return Object.keys(errores).length === 0;
}

function mostrarEstadoFormulario(mensaje, tipo) {
  formStatus.textContent = mensaje;
  formStatus.className = `form-status form-status--${tipo}`;
}

function mostrarEstadoSincronizacion(mensaje, tipo) {
  syncStatus.textContent = mensaje;
  syncStatus.className = `sync-status sync-status--${tipo}`;
}

function establecerEnvioEnCurso(activo) {
  submitButton.disabled = activo;
  submitButton.textContent = activo ? 'Guardando...' : 'Guardar reporte';
  form.setAttribute('aria-busy', activo ? 'true' : 'false');
}

function formatearFecha(valor) {
  if (!valor) {
    return '';
  }
  const partes = String(valor).slice(0, 10).split('-');
  if (partes.length !== 3) {
    return String(valor);
  }
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearFechaHora(valor) {
  if (!valor) {
    return '';
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  return fecha.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

function agregarDato(lista, etiqueta, valor) {
  if (!valor) {
    return;
  }
  const dt = document.createElement('dt');
  dt.textContent = etiqueta;
  const dd = document.createElement('dd');
  dd.textContent = valor;
  lista.append(dt, dd);
}

function crearBadge(texto, clase) {
  const badge = document.createElement('span');
  badge.className = `badge ${clase}`;
  badge.textContent = texto;
  return badge;
}

function crearReporte(reporte) {
  const item = document.createElement('li');
  item.className = 'reporte';

  const encabezado = document.createElement('div');
  encabezado.className = 'reporte__header';

  const titulo = document.createElement('h3');
  titulo.className = 'reporte__titulo';
  titulo.textContent = reporte.titulo || 'Reporte sin titulo';

  const badges = document.createElement('div');
  badges.className = 'reporte__badges';

  const estadoClave = Object.prototype.hasOwnProperty.call(ESTADOS, reporte.estado)
    ? reporte.estado
    : 'desconocido';
  badges.appendChild(crearBadge(ESTADOS[reporte.estado] || 'Sin estado', `badge--${estadoClave}`));

  const syncStatusValor = reporte.syncStatus || 'sincronizado';
  const syncInfo = {
    pendiente: ['Pendiente de sincronizar', 'badge--sync-pendiente'],
    sincronizado: ['Sincronizado', 'badge--sync-sincronizado'],
    error: ['Error al sincronizar', 'badge--sync-error'],
  }[syncStatusValor] || ['Sincronizado', 'badge--sync-sincronizado'];
  badges.appendChild(crearBadge(syncInfo[0], syncInfo[1]));

  encabezado.append(titulo, badges);
  item.appendChild(encabezado);

  if (reporte.descripcion) {
    const descripcion = document.createElement('p');
    descripcion.className = 'reporte__descripcion';
    descripcion.textContent = reporte.descripcion;
    item.appendChild(descripcion);
  }

  if (syncStatusValor === 'error' && reporte.syncError) {
    const errorSync = document.createElement('p');
    errorSync.className = 'reporte__sync-error';
    errorSync.textContent = `No se pudo sincronizar: ${reporte.syncError}`;
    item.appendChild(errorSync);
  }

  if (sesionStaff?.usuario?.rol === 'administrador') {
    const selector = document.createElement('select');
    selector.setAttribute('aria-label', 'Cambiar estado del reporte');
    for (const [valor, texto] of Object.entries(ESTADOS)) {
      const option = document.createElement('option');
      option.value = valor;
      option.textContent = texto;
      option.selected = valor === reporte.estado;
      selector.appendChild(option);
    }
    selector.addEventListener('change', async () => {
      await fetch(`/api/reportes/${reporte.serverId || reporte.id}/estado`, {
        method: 'PATCH',
        headers: headersApi({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ estado: selector.value }),
      });
      await cargarReportes();
    });
    item.appendChild(selector);
  }

  const meta = document.createElement('dl');
  meta.className = 'reporte__meta';
  agregarDato(meta, 'Cliente', reporte.cliente);
  agregarDato(meta, 'Sitio', reporte.sitio);
  agregarDato(meta, 'Fecha del servicio', formatearFecha(reporte.fechaServicio));
  agregarDato(meta, 'Registrado', formatearFechaHora(reporte.createdAt));
  agregarDato(meta, 'Sincronizado', formatearFechaHora(reporte.syncedAt));

  if (meta.children.length > 0) {
    item.appendChild(meta);
  }

  return item;
}

function renderizarReportes(reportes) {
  listEl.textContent = '';
  const totalPaginas = Math.max(1, Math.ceil(reportes.length / TAMANO_PAGINA));
  paginaActual = Math.min(paginaActual, totalPaginas);
  const inicio = (paginaActual - 1) * TAMANO_PAGINA;
  const fragmento = document.createDocumentFragment();
  reportes.slice(inicio, inicio + TAMANO_PAGINA).forEach((reporte) => {
    fragmento.appendChild(crearReporte(reporte));
  });
  listEl.appendChild(fragmento);
  document.getElementById('pagination-info').textContent = `Pagina ${paginaActual} de ${totalPaginas}`;
  document.getElementById('pagination-prev').disabled = paginaActual <= 1;
  document.getElementById('pagination-next').disabled = paginaActual >= totalPaginas;
}

async function cargarReportesLocal() {
  const reportes = await obtenerReportesLocales();
  renderizarReportes(reportes);
  return reportes;
}

async function refrescarListaSegura() {
  try {
    const reportes = await cargarReportesLocal();
    const pendientes = reportes.filter((r) => r.syncStatus !== 'sincronizado').length;
    if (pendientes > 0) {
      listStatus.className = 'list-status list-status--warn';
      listStatus.textContent = `${reportes.length} reporte(s); ${pendientes} pendiente(s) de sincronizar.`;
    } else {
      listStatus.className = 'list-status';
      listStatus.textContent = reportes.length === 0
        ? 'Aun no hay reportes registrados.'
        : `${reportes.length} reporte(s) sincronizados con el servidor.`;
    }
  } catch {
    listStatus.className = 'list-status list-status--error';
    listStatus.textContent = 'No se pudo actualizar la lista de reportes.';
  }
}

async function cargarReportes() {
  listStatus.className = 'list-status';
  listStatus.textContent = 'Cargando reportes...';
  listEl.setAttribute('aria-busy', 'true');
  refreshButton.disabled = true;

  let reportesLocales = [];

  try {
    reportesLocales = await cargarReportesLocal();
  } catch {
    listStatus.className = 'list-status list-status--error';
    listStatus.textContent = 'No se pudo acceder al almacenamiento local del dispositivo.';
    listEl.removeAttribute('aria-busy');
    refreshButton.disabled = false;
    return;
  }

  if (!navigator.onLine) {
    listStatus.className = 'list-status list-status--warn';
    listStatus.textContent = reportesLocales.length === 0
      ? 'Sin conexion. No hay reportes guardados en el dispositivo.'
      : `Sin conexion. Mostrando ${reportesLocales.length} reporte(s) guardado(s) en el dispositivo.`;
    listEl.removeAttribute('aria-busy');
    refreshButton.disabled = false;
    return;
  }

  try {
    const response = await fetch('/api/reportes', { headers: headersApi() });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const reportesServidor = Array.isArray(data.reportes) ? data.reportes : [];
    for (const reporte of reportesServidor) {
      await guardarReporteServidor(reporte);
    }

    const actualizados = await cargarReportesLocal();
    const pendientes = actualizados.filter((r) => r.syncStatus !== 'sincronizado').length;

    listStatus.className = 'list-status';
    if (actualizados.length === 0) {
      listStatus.textContent = 'Aun no hay reportes registrados.';
    } else if (pendientes > 0) {
      listStatus.textContent = `${actualizados.length} reporte(s); ${pendientes} pendiente(s) de sincronizar.`;
    } else {
      listStatus.textContent = `${actualizados.length} reporte(s) sincronizados con el servidor.`;
    }
  } catch {
    listStatus.className = 'list-status list-status--warn';
    listStatus.textContent = 'No se pudo consultar el servidor. Mostrando reportes guardados en el dispositivo.';
  } finally {
    listEl.removeAttribute('aria-busy');
    refreshButton.disabled = false;
  }
}

async function sincronizarReporte(registro) {
  try {
    const response = await fetch('/api/reportes', {
      method: 'POST',
      headers: headersApi({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        clientId: registro.clientId,
        titulo: registro.titulo,
        descripcion: registro.descripcion,
        cliente: registro.cliente,
        sitio: registro.sitio,
        fechaServicio: registro.fechaServicio,
        estado: registro.estado,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const ahora = new Date().toISOString();
    await actualizarReporteLocal(registro.localId, {
      syncStatus: 'sincronizado',
      serverId: typeof data.id === 'number' ? data.id : registro.serverId || null,
      syncedAt: ahora,
      syncError: null,
      updatedAt: ahora,
    });

    return { ok: true, data };
  } catch (error) {
    const mensaje = error instanceof TypeError
      ? 'Sin conexion con el servidor'
      : error.message || 'Error de sincronizacion';

    try {
      await actualizarReporteLocal(registro.localId, {
        syncStatus: 'error',
        syncError: mensaje,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      return { ok: false, error };
    }

    return { ok: false, error };
  }
}

async function sincronizarPendientes(opciones = {}) {
  const silencioso = Boolean(opciones.silencioso);

  if (sincronizando) {
    return;
  }

  if (!navigator.onLine) {
    if (!silencioso) {
      mostrarEstadoSincronizacion('Sin conexion. Los reportes pendientes se conservan en el dispositivo.', 'warn');
    }
    return;
  }

  sincronizando = true;

  if (!silencioso) {
    mostrarEstadoSincronizacion('Sincronizando reportes pendientes...', 'info');
  }

  try {
    const reportes = await obtenerReportesLocales();
    const pendientes = reportes.filter((r) => r.syncStatus !== 'sincronizado');

    if (pendientes.length === 0) {
      if (!silencioso) {
        mostrarEstadoSincronizacion('No hay reportes pendientes de sincronizar.', 'info');
      }
      return;
    }

    let exitos = 0;
    let fallos = 0;

    for (const reporte of pendientes) {
      const resultado = await sincronizarReporte(reporte);
      if (resultado.ok) {
        exitos += 1;
      } else {
        fallos += 1;
      }
    }

    await refrescarListaSegura();

    if (fallos === 0) {
      mostrarEstadoSincronizacion(`${exitos} reporte(s) sincronizado(s).`, 'success');
    } else {
      mostrarEstadoSincronizacion(
        `${exitos} sincronizado(s); ${fallos} con error. Se reintentara mas adelante.`,
        'error',
      );
    }
  } catch {
    mostrarEstadoSincronizacion('No se pudieron sincronizar los reportes. Se conservan en el dispositivo.', 'error');
  } finally {
    sincronizando = false;
  }
}

async function guardarReporte(event) {
  event.preventDefault();

  if (submitButton.disabled) {
    return;
  }

  const datos = obtenerDatos();

  if (!validarFormulario(datos)) {
    mostrarEstadoFormulario('Revisa los campos marcados en rojo.', 'error');
    return;
  }

  const ahora = new Date().toISOString();
  const registro = {
    localId: generarClientId(),
    clientId: generarClientId(),
    titulo: datos.titulo.trim(),
    descripcion: datos.descripcion.trim(),
    cliente: datos.cliente.trim(),
    sitio: datos.sitio.trim(),
    fechaServicio: datos.fechaServicio,
    estado: datos.estado,
    ownerCode: sesionStaff ? null : codigoPropietario(),
    syncStatus: 'pendiente',
    createdAt: ahora,
    updatedAt: ahora,
    serverId: null,
    syncedAt: null,
    syncError: null,
  };

  establecerEnvioEnCurso(true);

  try {
    mostrarEstadoFormulario('Guardando en el dispositivo...', 'info');

    try {
      await guardarReporteLocal(registro);
    } catch {
      mostrarEstadoFormulario('No se pudo guardar el reporte en el dispositivo. Intenta de nuevo.', 'error');
      return;
    }

    form.reset();
    limpiarErrores();
    await refrescarListaSegura();

    if (!navigator.onLine) {
      mostrarEstadoFormulario(
        'Guardado en el dispositivo. Queda pendiente de sincronizar cuando vuelva la conexion.',
        'success',
      );
      return;
    }

    mostrarEstadoFormulario('Guardado en el dispositivo. Sincronizando con el servidor...', 'info');
    const resultado = await sincronizarReporte(registro);
    await refrescarListaSegura();

    if (resultado.ok) {
      mostrarEstadoFormulario('Reporte guardado y sincronizado con el servidor.', 'success');
    } else {
      mostrarEstadoFormulario(
        'Guardado en el dispositivo, pero no se pudo sincronizar. Se reintentara al recuperar la conexion.',
        'error',
      );
    }
  } finally {
    formStatus.focus();
    establecerEnvioEnCurso(false);
  }
}

async function comprobarServidor() {
  if (!navigator.onLine) {
    connectionStatus.className = 'connection-status connection-status--error';
    connectionStatus.textContent = 'Sin conexion';
    return;
  }

  try {
    const response = await fetch('/api/health');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error('health');
    }

    if (data.database === 'connected') {
      connectionStatus.className = 'connection-status connection-status--ok';
      connectionStatus.textContent = 'Servidor y base de datos conectados';
    } else {
      connectionStatus.className = 'connection-status connection-status--warn';
      connectionStatus.textContent = 'Servidor activo; base de datos no disponible';
    }
  } catch {
    connectionStatus.className = 'connection-status connection-status--error';
    connectionStatus.textContent = 'Servidor no disponible';
  }
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('No se pudo registrar el service worker:', error);
    });
  });
}

function aplicarAcceso() {
  const autenticado = Boolean(sesionStaff || sesionCliente);
  document.getElementById('access-panel').hidden = autenticado;
  document.querySelectorAll('.authenticated-only').forEach((elemento) => {
    elemento.hidden = !autenticado;
  });
}

async function iniciarSesionCliente(event) {
  event.preventDefault();
  const status = document.getElementById('client-status');
  try {
    const response = await fetch('/api/auth/client-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: document.getElementById('client-code').value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesion');
    sesionCliente = data;
    sesionStaff = null;
    localStorage.setItem('clientSession', JSON.stringify(data));
    localStorage.removeItem('staffSession');
    aplicarAcceso();
    await iniciarApp();
  } catch (error) { status.textContent = error.message; }
}

async function iniciarSesionStaff(event) {
  event.preventDefault();
  const status = document.getElementById('staff-status');
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('staff-email').value,
        password: document.getElementById('staff-password').value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesion');
    sesionStaff = data;
    sesionCliente = null;
    localStorage.setItem('staffSession', JSON.stringify(data));
    localStorage.removeItem('clientSession');
    status.textContent = `Sesion iniciada como ${data.usuario.rol}.`;
    aplicarAcceso();
    await iniciarApp();
  } catch (error) {
    status.textContent = error.message;
  }
}

async function iniciarApp() {
  try {
    sesionStaff = JSON.parse(localStorage.getItem('staffSession') || 'null');
    sesionCliente = JSON.parse(localStorage.getItem('clientSession') || 'null');
    if ((sesionStaff?.token || sesionCliente?.token) && navigator.onLine) {
      const response = await fetch('/api/auth/me', { headers: headersApi() });
      if (!response.ok) {
        sesionStaff = null;
        sesionCliente = null;
        localStorage.removeItem('staffSession');
        localStorage.removeItem('clientSession');
      }
    }
  } catch {
    sesionStaff = null;
    sesionCliente = null;
  }
  aplicarAcceso();
  if (!sesionStaff && !sesionCliente) return;
  await comprobarServidor();
  await cargarReportes();

  if (navigator.onLine) {
    await sincronizarPendientes({ silencioso: true });
  }
}

form.addEventListener('submit', guardarReporte);
document.getElementById('staff-login-form').addEventListener('submit', iniciarSesionStaff);
document.getElementById('client-login-form').addEventListener('submit', iniciarSesionCliente);
document.getElementById('pagination-prev').addEventListener('click', () => { paginaActual -= 1; cargarReportes(); });
document.getElementById('pagination-next').addEventListener('click', () => { paginaActual += 1; cargarReportes(); });

form.addEventListener('input', (event) => {
  if (CAMPOS.includes(event.target.id)) {
    mostrarError(event.target.id, '');
  }
});

form.addEventListener('change', (event) => {
  if (CAMPOS.includes(event.target.id)) {
    mostrarError(event.target.id, '');
  }
});

refreshButton.addEventListener('click', cargarReportes);

window.addEventListener('online', async () => {
  await comprobarServidor();
  await sincronizarPendientes();
  await cargarReportes();
});

window.addEventListener('offline', () => {
  comprobarServidor();
  cargarReportes();
  mostrarEstadoSincronizacion('Sin conexion. Los reportes pendientes se conservan en el dispositivo.', 'warn');
});

registrarServiceWorker();
iniciarApp();
