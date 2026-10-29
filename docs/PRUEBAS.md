# Pruebas y evidencias

## 1. Entorno de prueba

- Windows 10/11, PowerShell 5.1.
- Node.js `v24.16.0` (el proyecto declara compatibilidad desde Node 18).
- npm con `npm.cmd` para evitar bloqueos de politica de ejecucion.
- Microsoft Edge headless para la prueba E2E.
- PostgreSQL local para las pruebas de API que lo requieren.
- No se leyo ni se mostro el contenido de `.env`; las pruebas usan la configuracion del entorno sin imprimir credenciales.

## 2. Comandos

```powershell
# Instalacion (solo si falta node_modules)
npm.cmd install

# Suite principal: unitarias + API + estructura PWA
npm.cmd test

# Suites especificas
npm.cmd run test:unit
npm.cmd run test:api
npm.cmd run test:pwa

# E2E de navegador: CSP, SW, cache, IndexedDB, offline y recuperacion simulada
npm.cmd run test:e2e

# Todo
npm.cmd run test:all

# Auditoria de dependencias de produccion
npm.cmd audit --omit=dev

# Sintaxis de archivos JS
node --check server/index.js
node --check server/lib/validacion.js
node --check server/routes/reportes.js
node --check public/js/app.js
node --check public/js/fechas.js
node --check public/sw.js
node --check scripts/e2e-offline.mjs
```

## 3. Que cubre cada suite

### `test/fechas.test.js`

- Formato estricto `YYYY-MM-DD`.
- Fechas reales, anos bisiestos y meses de 30/31 dias.
- Rechazo de rollover (`2026-02-31`), `2026-02-29`, `2026-13-01`, `0000-01-01`, tipos no string y formatos con hora/espacios.

### `test/validacion.test.js`

- Cuerpo invalido, campos obligatorios y longitudes maximas.
- Estados permitidos.
- Fechas imposibles y formatos invalidos.
- Fecha opcional vacia/null.
- Misma logica que usa el backend.

### `test/api.test.js`

- `GET /` y cabeceras de seguridad/CSP.
- `GET /api/health` y HSTS condicional.
- Manifest, service worker, `fechas.js`, `offline.css` y `offline.html`.
- JSON invalido, cuerpo grande, cuerpos no objeto y errores genericos sin detalles internos.
- Rechazo de campos/fechas invalidas sin insertar datos.
- `GET /api/reportes/abc` y rutas inexistentes.
- Idempotencia no destructiva: si existe un reporte valido, reenvia el mismo `clientId` y verifica `200`, mismo `id` y cantidad de filas sin cambios. No crea ni modifica datos. Si no hay un reporte adecuado o PostgreSQL no esta disponible, la prueba se omite y lo informa.

### `test/pwa.test.js`

- Manifest, colores, `display: standalone`, iconos 192x192 y 512x512 reales.
- `index.html` y `offline.html` sin estilos/scripts inline incompatibles con CSP.
- Service worker con `install`, `activate`, `fetch`, `skipWaiting`, `clients.claim`, precache v4 y API solo red.
- `app.js` con IndexedDB, estados offline, sync manual/automatica y validador compartido.
- Scripts de `package.json`, `.gitignore`, `.env.example` sin credenciales y secciones del README.
- Existencia de la matriz, arquitectura, pruebas, despliegue, demo y plan.

### `scripts/e2e-offline.mjs`

- Levanta la app en un puerto libre.
- Usa un perfil temporal de Edge/Chrome.
- Comprueba que no haya violaciones CSP ni excepciones JS.
- Verifica service worker activo, cache `v4`, precache y limpieza de caches antiguas (`v1`/`v2`).
- Verifica responsive en viewport movil sin desbordamiento horizontal.
- Crea un reporte con la red emulada como offline; comprueba que queda en IndexedDB.
- Recarga sin red y verifica que el reporte sigue visible como pendiente.
- Detiene la API real y verifica el estado de error al intentar sincronizar.
- Levanta una API simulada en el mismo origen y comprueba reintento manual y sincronizacion al evento `online`.
- No escribe en PostgreSQL: usa IndexedDB local del perfil temporal y una API simulada.

## 4. Politica no destructiva

- Las pruebas no borran reportes existentes.
- La prueba de idempotencia usa un reporte existente y reenvia el mismo `clientId`; por `ON CONFLICT DO NOTHING` no se inserta ni actualiza nada.
- La E2E no crea filas en PostgreSQL; usa IndexedDB del perfil temporal y un servidor HTTP simulado para la recuperacion.
- No se modifica el esquema de PostgreSQL.
- No se instalan dependencias de runtime para probar: se usa `node:test`, `fetch` y el navegador ya instalado.

## 5. Resultados de la ejecucion final

| Comando / prueba | Resultado | Evidencia |
| --- | --- | --- |
| `node --check` de 6 archivos de aplicacion + E2E | OK | Salida de consola |
| `npm.cmd test` | 25 pasan, 0 fallan, 1 omitida | Salida de consola |
| `npm.cmd run test:e2e` | `ok: true`; cache v4, offline, error y recuperacion | Salida JSON de la E2E |
| `npm.cmd run test:all` | Ambas suites completadas; E2E `ok: true` | Salida de consola |
| `npm.cmd audit --omit=dev` | 0 vulnerabilidades | Salida de consola |
| Lighthouse | Performance 100, Accessibility 100, Best Practices 100, SEO 100 | `docs/LIGHTHOUSE.md` y `docs/lighthouse.json` |
| Prueba real Android | No ejecutada | Requiere dispositivo Android |
| Prueba real iOS/Safari | No ejecutada | Requiere iPhone/iPad o macOS con Safari |
| HTTPS de produccion | No ejecutado | Requiere cuenta/dominio; ver `docs/DESPLIEGUE.md` |

La prueba de idempotencia de `npm.cmd test` se omitio porque no habia un reporte existente valido para reenviar sin crear datos. La idempotencia real ya se habia validado en la etapa 3 contra PostgreSQL con un reporte propio, y el codigo conserva `client_id` unico + `ON CONFLICT DO NOTHING`.

## 6. Evidencias que deben capturarse para la presentacion

Guardar capturas o grabaciones en una carpeta local de evidencias. No incluir `.env`, cadenas de conexion, tokens ni datos personales reales.

1. **Escritorio online**
   - `GET /api/health` con `database: connected`.
   - Formulario completo y reporte en la lista.
   - Panel de Application > Manifest con nombre, iconos y `standalone`.
2. **Instalacion**
   - Prompt de instalacion en Chrome/Edge o app instalada abierta en ventana standalone.
3. **Responsive**
   - Vista movil 375x812 sin scroll horizontal.
   - Formulario usable con teclado tactil.
4. **Offline**
   - DevTools > Network > Offline.
   - Reporte guardado en IndexedDB.
   - Recarga sin red mostrando el reporte pendiente.
   - Navegacion a una ruta no cacheada mostrando `offline.html`.
5. **Sincronizacion**
   - Servidor detenido: badge de error y mensaje de reintento.
   - Servidor restaurado: boton **Sincronizar pendientes** y badge **Sincronizado**.
   - Evento `online` sincronizando automaticamente.
6. **Idempotencia**
   - Mismo `clientId` reenviado; respuesta `200` y mismo `id`.
   - Conteo de filas antes/despues sin cambios.
7. **Service worker**
   - Application > Service Workers con estado `activated and is running`.
   - Cache Storage con `reportes-servicio-v4` y los recursos precargados.
8. **Pruebas**
   - Captura de `npm.cmd test` y `npm.cmd run test:e2e` en verde.
9. **Lighthouse**
   - Captura de puntuaciones y hallazgos relevantes. Se ejecuto en localhost HTTP; aclarar que la categoria PWA/HTTPS de produccion no esta incluida en esa auditoria.
10. **Documentacion**
    - Matriz de cumplimiento y arquitectura abiertas durante la demo.

## 7. Limitaciones declaradas

- No se probo en Android ni iOS reales; solo Edge headless en Windows.
- No se desplego a produccion ni se verifico HTTPS real; solo se probo la cabecera HSTS simulando `X-Forwarded-Proto: https`.
- Lighthouse se ejecuto localmente sobre `localhost` HTTP con Edge headless; la evidencia esta en `docs/LIGHTHOUSE.md`. No se ejecuto contra HTTPS de produccion.
- La sincronizacion exitosa contra PostgreSQL se valido en la etapa 3 con filas propias de prueba; en el cierre final se evito crear/borrar datos y se uso una API simulada para la recuperacion del cliente.
