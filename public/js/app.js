const form = document.getElementById('reporte-form');
const submitButton = document.getElementById('submit-button');
const formStatus = document.getElementById('form-status');
const listEl = document.getElementById('reportes-list');
const listStatus = document.getElementById('list-status');
const refreshButton = document.getElementById('refresh-button');
const connectionStatus = document.getElementById('connection-status');

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

let clientIdPendiente = null;

function generarClientId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  const aleatorio = Math.random().toString(16).slice(2);
  return `reporte-${Date.now()}-${aleatorio}`;
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

  if (datos.descripcion.trim().length > MAX.descripcion) {
    errores.descripcion = `La descripcion no puede superar ${MAX.descripcion} caracteres.`;
  }

  if (datos.cliente.trim().length > MAX.cliente) {
    errores.cliente = `El cliente no puede superar ${MAX.cliente} caracteres.`;
  }

  if (datos.sitio.trim().length > MAX.sitio) {
    errores.sitio = `El sitio no puede superar ${MAX.sitio} caracteres.`;
  }

  if (datos.fechaServicio && !/^\d{4}-\d{2}-\d{2}$/.test(datos.fechaServicio)) {
    errores.fechaServicio = 'Indica una fecha valida.';
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

function crearReporte(reporte) {
  const item = document.createElement('li');
  item.className = 'reporte';

  const encabezado = document.createElement('div');
  encabezado.className = 'reporte__header';

  const titulo = document.createElement('h3');
  titulo.className = 'reporte__titulo';
  titulo.textContent = reporte.titulo || 'Reporte sin titulo';

  const estadoClave = Object.prototype.hasOwnProperty.call(ESTADOS, reporte.estado)
    ? reporte.estado
    : 'desconocido';
  const badge = document.createElement('span');
  badge.className = `badge badge--${estadoClave}`;
  badge.textContent = ESTADOS[reporte.estado] || 'Sin estado';

  encabezado.append(titulo, badge);
  item.appendChild(encabezado);

  if (reporte.descripcion) {
    const descripcion = document.createElement('p');
    descripcion.className = 'reporte__descripcion';
    descripcion.textContent = reporte.descripcion;
    item.appendChild(descripcion);
  }

  const meta = document.createElement('dl');
  meta.className = 'reporte__meta';
  agregarDato(meta, 'Cliente', reporte.cliente);
  agregarDato(meta, 'Sitio', reporte.sitio);
  agregarDato(meta, 'Fecha del servicio', formatearFecha(reporte.fechaServicio));
  agregarDato(meta, 'Registrado', formatearFechaHora(reporte.createdAt));

  if (meta.children.length > 0) {
    item.appendChild(meta);
  }

  return item;
}

function renderizarReportes(reportes) {
  listEl.textContent = '';
  const fragmento = document.createDocumentFragment();
  reportes.forEach((reporte) => {
    fragmento.appendChild(crearReporte(reporte));
  });
  listEl.appendChild(fragmento);
}

async function cargarReportes() {
  listStatus.className = 'list-status';
  listStatus.textContent = 'Cargando reportes...';
  listEl.setAttribute('aria-busy', 'true');
  refreshButton.disabled = true;

  try {
    const response = await fetch('/api/reportes');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const mensaje = response.status === 503
        ? 'El servidor no puede acceder a la base de datos.'
        : data.error || 'No se pudieron cargar los reportes.';
      throw new Error(mensaje);
    }

    const reportes = Array.isArray(data.reportes) ? data.reportes : [];
    renderizarReportes(reportes);

    if (reportes.length === 0) {
      listStatus.textContent = 'Aun no hay reportes registrados.';
    } else {
      listStatus.textContent = `${reportes.length} reporte(s) encontrado(s).`;
    }
  } catch (error) {
    renderizarReportes([]);
    listStatus.className = 'list-status list-status--error';
    listStatus.textContent = error instanceof TypeError
      ? 'No se pudo conectar con el servidor.'
      : error.message;
  } finally {
    listEl.removeAttribute('aria-busy');
    refreshButton.disabled = false;
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

  if (!clientIdPendiente) {
    clientIdPendiente = generarClientId();
  }

  const payload = {
    clientId: clientIdPendiente,
    titulo: datos.titulo.trim(),
    descripcion: datos.descripcion.trim(),
    cliente: datos.cliente.trim(),
    sitio: datos.sitio.trim(),
    fechaServicio: datos.fechaServicio,
    estado: datos.estado,
  };

  establecerEnvioEnCurso(true);
  mostrarEstadoFormulario('Guardando reporte...', 'info');

  try {
    const response = await fetch('/api/reportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const mensaje = response.status === 503
        ? 'El servidor no puede acceder a la base de datos. El reporte no se guardo.'
        : data.error || 'No se pudo guardar el reporte.';
      throw new Error(mensaje);
    }

    const yaExistia = response.status === 200;
    mostrarEstadoFormulario(
      yaExistia
        ? 'El reporte ya existia y se recupero sin duplicarlo.'
        : 'Reporte guardado correctamente.',
      'success',
    );

    form.reset();
    limpiarErrores();
    clientIdPendiente = null;

    await cargarReportes();
    formStatus.focus();
  } catch (error) {
    const mensaje = error instanceof TypeError
      ? 'No se pudo conectar con el servidor. Revisa tu conexion e intenta de nuevo.'
      : error.message;
    mostrarEstadoFormulario(mensaje, 'error');
    formStatus.focus();
  } finally {
    establecerEnvioEnCurso(false);
  }
}

async function comprobarServidor() {
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

form.addEventListener('submit', guardarReporte);

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

registrarServiceWorker();
comprobarServidor();
cargarReportes();
