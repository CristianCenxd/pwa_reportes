# Proyecto PWA - Reportes de Servicio Tecnico

Servidor Node.js + Express que sirve la PWA y expone la API de reportes sobre PostgreSQL.

## Requisitos

- Node.js 18 o superior
- npm
- PostgreSQL 18 (local o remoto)

## Instalacion

```powershell
npm install
```

## Configuracion de PostgreSQL

La aplicacion usa la base `pwa_reportes` y la tabla existente `public.reportes`.

1. Copia el archivo de ejemplo y completa la conexion:

```powershell
Copy-Item .env.example .env
```

2. Edita `.env` y define tu cadena real:

```text
DATABASE_URL=postgresql://pwacris:contrasena@localhost:5432/pwa_reportes
PORT=3000
```

No versiones `.env`. El servidor solo usa la base indicada en `DATABASE_URL`.
La tabla `public.reportes` debe existir previamente: la aplicacion no crea tablas ni requiere permisos `CREATE` en el esquema.

## Ejecucion

```powershell
npm start
```

El servidor queda disponible en `http://localhost:3000`.

Modo con recarga automatica (Node 18.11+):

```powershell
npm run dev
```

## Endpoints

- `GET /api/health` -> `{ "status": "ok", "database": "connected|disconnected", "timestamp": "..." }`
- `GET /api/reportes` -> `{ "reportes": [...] }`
- `GET /api/reportes/:id` -> reporte o `404`
- `POST /api/reportes` -> crea o devuelve el existente por `clientId`
- `GET /` -> PWA estatica desde `public/`

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

`clientId` es obligatorio y unico: reenviar el mismo valor no crea duplicados (responde `200` con el reporte existente en lugar de `201`).

## Estructura

```text
proyecto-PWA/
├─ public/
│  ├─ index.html
│  ├─ css/styles.css
│  └─ js/app.js
├─ server/
│  ├─ index.js
│  ├─ db.js
│  └─ routes/reportes.js
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```

## Notas

- Sin Service Worker, IndexedDB ni sincronizacion offline en esta etapa.
- Si falta `DATABASE_URL` o las credenciales son incorrectas, las rutas de reportes responden `503` con JSON; el error real se muestra en la consola del servidor sin exponer credenciales.
- `/api/health` comprueba la conexion con `SELECT 1`; solo informa `database: "connected"` si esa consulta tuvo exito.
- `npm` en PowerShell puede fallar por la politica de ejecucion; si ocurre, usa `npm.cmd` o ejecuta en `cmd`.
