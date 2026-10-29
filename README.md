# Proyecto PWA - Reportes de Servicio Tecnico

PWA offline-first para que tecnicos de servicio registren reportes en campo, incluso sin Internet. El frontend guarda primero en IndexedDB y sincroniza con una API Node.js/Express respaldada por PostgreSQL.

## Requisitos

- Node.js 18 o superior (probado con Node.js 24).
- npm.
- PostgreSQL 18 local o remoto, con la base y la tabla `public.reportes` ya existentes.
- Para las pruebas E2E: Microsoft Edge o Google Chrome instalado en el equipo.

No se requieren dependencias adicionales para ejecutar las pruebas: usan `node:test` y `fetch` nativos.

## Instalacion

```powershell
npm.cmd install
```

En PowerShell puede ser necesario usar `npm.cmd` en lugar de `npm` por la politica de ejecucion de scripts.

## Configuracion

1. Copia la plantilla:

```powershell
Copy-Item .env.example .env
```

2. Edita `.env` con la cadena de conexion de tu PostgreSQL y el puerto local. La plantilla no incluye usuario ni contrasena de ejemplo; agrega los datos de tu instalacion solo en `.env`.

```text
DATABASE_URL=postgresql://localhost:5432/pwa_reportes
PORT=3000
```

No versiones `.env`. El archivo esta excluido por `.gitignore` y no debe compartirse ni mostrarse en capturas.

La aplicacion no crea tablas ni modifica el esquema. La tabla `public.reportes` debe existir previamente con la estructura usada por el proyecto (`id`, `client_id`, `titulo`, `descripcion`, `cliente`, `sitio`, `fecha_servicio`, `estado`, `created_at`) y la restriccion unica de `client_id`.

## Ejecucion

```powershell
npm.cmd start
```

Abre `http://localhost:3000`.

Modo de desarrollo con recarga automatica (Node 18.11+):

```powershell
npm.cmd run dev
```

## Endpoints

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor y de PostgreSQL (`SELECT 1`). |
| GET | `/api/reportes` | Lista de reportes, ordenados por fecha de creacion. |
| GET | `/api/reportes/:id` | Reporte por id o `404`. |
| POST | `/api/reportes` | Crea un reporte o devuelve el existente por `clientId`. |

### Ejemplo de reporte

```json
{
  "clientId": "c0a80101-0000-4000-8000-000000000001",
  "titulo": "Revision de equipo",
  "descripcion": "Mantenimiento preventivo",
  "cliente": "Cliente Demo",
  "sitio": "Planta Norte",
  "fechaServicio": "2026-10-28",
  "estado": "pendiente"
}
```

`clientId` es obligatorio y unico. Reenviar el mismo valor no crea duplicados: responde `200` con el reporte existente en lugar de `201`.

Validaciones principales: `clientId` hasta 100 caracteres, `titulo` hasta 200, `descripcion` hasta 2000, `cliente` y `sitio` hasta 200, `estado` en `pendiente`, `en_proceso` o `completado`, y `fechaServicio` en formato `YYYY-MM-DD` con fecha de calendario real. La misma validacion de fechas se comparte entre frontend y backend en `public/js/fechas.js`.

## Pruebas

```powershell
npm.cmd test
```

Ejecuta las pruebas unitarias, de API y de estructura PWA con `node:test`. No crean reportes nuevos ni borran datos.

Pruebas especificas:

```powershell
npm.cmd run test:unit
npm.cmd run test:api
npm.cmd run test:pwa
```

Prueba E2E de navegador (requiere Edge o Chrome):

```powershell
npm.cmd run test:e2e
```

La prueba E2E levanta el servidor en un puerto libre, usa un perfil temporal del navegador, comprueba CSP, service worker, cache v4, IndexedDB, recarga offline, estado sin conexion y recuperacion con una API simulada. No escribe en PostgreSQL.

Todas las pruebas juntas:

```powershell
npm.cmd run test:all
```

Auditoria Lighthouse local (Edge headless, `localhost` HTTP): Performance 100, Accessibility 100, Best Practices 100 y SEO 100. La evidencia y el comando estan en `docs/LIGHTHOUSE.md`. No sustituye la verificacion de HTTPS de produccion ni las pruebas en dispositivos reales.

La matriz de cumplimiento y el detalle de evidencias estan en:

- `docs/MATRIZ-CUMPLIMIENTO.md`
- `docs/PRUEBAS.md`
- `docs/LIGHTHOUSE.md`
- `docs/ARQUITECTURA.md`
- `docs/DESPLIEGUE.md`
- `docs/DEMO.md`
- `PLAN.md`

## Uso offline

1. El formulario guarda el reporte en IndexedDB antes de intentar cualquier envio.
2. El service worker precarga la interfaz, el CSS, el JS, el manifest y la pagina `offline.html`.
3. Si se recarga la aplicacion sin red, se sirve el app shell desde cache y la lista se reconstruye desde IndexedDB.
4. La interfaz muestra estados de conexion, sincronizacion, pendiente, sincronizado y error.
5. Si la API o PostgreSQL no estan disponibles, el reporte permanece en el dispositivo y puede reintentarse.

## Sincronizacion

- Al iniciar la app, al recuperar la conexion (`online`) y al pulsar **Sincronizar pendientes**.
- Los reportes pendientes o con error se reintentan.
- Cada reporte conserva el mismo `clientId`; el backend usa una restriccion unica y `ON CONFLICT DO NOTHING` para evitar duplicados.
- Un error de red no elimina el reporte local.

## Estructura

```text
proyecto-PWA/
├─ public/
│  ├─ index.html
│  ├─ offline.html
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  ├─ css/styles.css
│  ├─ css/offline.css
│  ├─ js/app.js
│  ├─ js/fechas.js
│  └─ icons/
├─ server/
│  ├─ index.js
│  ├─ db.js
│  ├─ lib/validacion.js
│  └─ routes/reportes.js
├─ test/
│  ├─ api.test.js
│  ├─ fechas.test.js
│  ├─ pwa.test.js
│  └─ validacion.test.js
├─ scripts/e2e-offline.mjs
├─ docs/
├─ PLAN.md
├─ .env.example
├─ .gitignore
└─ package.json
```

## Despliegue

El despliegue de produccion con HTTPS **no esta ejecutado** en este repositorio. Requiere una cuenta, un dominio o subdominio y un PostgreSQL gestionado o accesible por el servidor. Los pasos y verificaciones estan en `docs/DESPLIEGUE.md`.

Puntos obligatorios para produccion:

- Servir la app por HTTPS para que el service worker y la instalacion funcionen fuera de `localhost`.
- Configurar `DATABASE_URL` y `PORT` como variables de entorno del proveedor, nunca en el repositorio.
- Verificar que `public.reportes` existe y que la restriccion unica de `client_id` esta activa.
- Configurar el proxy para enviar `X-Forwarded-Proto: https` si la app queda detras de un balanceador, y no confiar en ese encabezado si el cliente puede falsificarlo.
- Ejecutar `npm.cmd test` y `npm.cmd run test:e2e` antes de publicar.

## Compatibilidad y limitaciones

- Probado en Edge headless sobre Windows durante la auditoria; no se probo en Android ni iOS reales.
- Chrome/Edge en escritorio y Android soportan service workers, IndexedDB, instalacion y Background Sync de forma amplia.
- Safari/iOS tiene limitaciones de instalacion, ciclo de vida del service worker y almacenamiento; la app no depende de Background Sync, por lo que usa sincronizacion al abrir, al recuperar conexion y manual.
- La tabla comparativa completa, incluyendo Safari/iOS, esta en `docs/ARQUITECTURA.md`.

## Seguridad

- `.env` esta excluido del repositorio.
- No se incluyen credenciales reales en codigo, documentacion ni logs.
- El servidor aplica CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y `Cache-Control: no-store` para la API.
- Los mensajes de error de la API no exponen detalles internos de PostgreSQL.

## Demo

La guia paso a paso para la presentacion esta en `docs/DEMO.md`.
