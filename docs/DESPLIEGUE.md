# Despliegue de produccion con HTTPS

## Estado actual

**No ejecutado.** El proyecto no incluye una cuenta, dominio ni servicio de hosting configurado. Por lo tanto, no se afirma que HTTPS de produccion funcione. Esta guia deja los pasos exactos para completarlo y verificar sin inventar resultados.

## 1. Requisitos previos

- Cuenta en un proveedor con HTTPS automatico: Render, Railway, Fly.io, Azure App Service, Google Cloud Run o un VPS con Caddy/Nginx.
- PostgreSQL gestionado o accesible desde el servidor de produccion.
- Dominio o subdominio, o el dominio gratuito que asigne el proveedor.
- Repositorio con este proyecto.
- La tabla `public.reportes` ya existente y la restriccion unica de `client_id` activa.

No se debe versionar `.env` ni pegar credenciales en capturas, issues, README o logs.

## 2. Variables de entorno

Configurar en el panel de secretos del proveedor:

```text
DATABASE_URL=<cadena-de-conexion-real>
PORT=<puerto-asignado-por-el-proveedor>
NODE_ENV=production
```

- `DATABASE_URL` debe apuntar a la base real y usar el usuario de menor privilegio que necesite la app.
- No se incluye una cadena de ejemplo con usuario/contrasena para evitar credenciales en documentacion.
- Si el proveedor inyecta `PORT`, no lo sobrescribas con un valor fijo incompatible.
- Si el proveedor exige SSL hacia PostgreSQL, usa la cadena y opciones que documente el proveedor.

## 3. Build y arranque

El proyecto no tiene etapa de build; sirve archivos estaticos y ejecuta Node directamente.

```text
Build command: npm ci
Start command: npm start
Health check: /api/health
```

`npm ci` instala exactamente las dependencias de `package-lock.json`. No se requieren dependencias adicionales de runtime.

## 4. Configuracion de PostgreSQL

La aplicacion **no crea tablas ni modifica el esquema**. Antes de publicar:

1. Verificar que la base existe.
2. Verificar que `public.reportes` existe con las columnas que usa la app.
3. Verificar que `client_id` tiene restriccion unica, porque de ella depende la idempotencia.
4. Probar la conexion desde el servidor de produccion con `GET /api/health`.

Comprobaciones de solo lectura sugeridas (no ejecutar DDL desde la app):

```sql
SELECT current_database();
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reportes'
ORDER BY ordinal_position;
```

La restriccion unica debe existir; el nombre exacto puede variar. No se debe borrar ni recrear la tabla para desplegar.

## 5. HTTPS y proxy

- El proveedor debe servir la app por HTTPS. El service worker y la instalacion PWA no funcionan en produccion sobre HTTP.
- Si hay un proxy/balanceador delante de Express, configurarlo para enviar `X-Forwarded-Proto: https`.
- No confiar en un `X-Forwarded-Proto` enviado directamente por el cliente. El proxy debe sobrescribir ese encabezado.
- La app responde con `Strict-Transport-Security: max-age=15552000` cuando detecta HTTPS o el encabezado del proxy. HSTS solo lo aplica el navegador sobre HTTPS.

### Verificacion de HTTPS

```powershell
curl.exe -I https://TU-DOMINIO/
curl.exe -I https://TU-DOMINIO/api/health
```

Comprobar:

- Codigo `200`.
- `content-security-policy` presente.
- `strict-transport-security` presente en HTTPS.
- `x-content-type-options: nosniff`.
- `cache-control: no-store` en `/api/health`.
- Sin `x-powered-by`.

No usar `curl -k` para declarar exito: si hay error de certificado, el despliegue no esta listo.

## 6. Verificacion de la PWA en produccion

1. Abrir `https://TU-DOMINIO/` en Chrome/Edge.
2. DevTools > Application > Manifest: nombre, iconos 192/512, `display: standalone`, `start_url`.
3. Application > Service Workers: estado activo y controlando la pagina.
4. Application > Cache Storage: `reportes-servicio-v4` con los recursos precargados.
5. Instalar la app y abrirla en ventana standalone.
6. Network > Offline: recargar y comprobar app shell, IndexedDB y `offline.html`.
7. Crear un reporte offline, recuperar red, pulsar **Sincronizar pendientes** y verificar el badge **Sincronizado**.
8. Reenviar el mismo `clientId` y verificar que no se crea un duplicado.

## 7. Cache y actualizaciones

- Cada cambio en `public/sw.js` debe incrementar `CACHE_NAME` (actualmente `v4`).
- Al activarse la nueva version, el SW elimina caches de la familia `reportes-servicio-*` que no sean la actual.
- No usar cache para `/api/`; la API es solo red.
- Despues de desplegar, hacer una recarga completa o cerrar/abrir la app para que el nuevo SW tome control.

## 8. Seguridad operativa

- Rotar cualquier credencial que se haya compartido por error.
- Mantener `.env` fuera del repositorio y de las capturas.
- Revisar logs sin imprimir cadenas de conexion.
- Ejecutar `npm.cmd audit --omit=dev` antes de publicar.
- Ejecutar `npm.cmd test` y `npm.cmd run test:e2e` en la maquina de despliegue o en CI.
- Configurar backups de PostgreSQL segun el proveedor.

## 9. Checklist de aceptacion del despliegue

- [ ] La app responde por HTTPS con certificado valido.
- [ ] `/api/health` informa `database: connected`.
- [ ] `public.reportes` existe y `client_id` es unico.
- [ ] El manifest y los iconos cargan por HTTPS.
- [ ] El service worker se registra y activa.
- [ ] La app funciona offline tras la primera carga.
- [ ] Un reporte offline se sincroniza al recuperar red.
- [ ] Reintentar el mismo `clientId` no duplica.
- [ ] No hay credenciales en el repositorio, logs ni capturas.
- [ ] Se conservan las pruebas y la matriz actualizadas.

## 10. Limitacion declarada

Este documento es una guia de despliegue, no evidencia de un despliegue realizado. La matriz marca HTTPS de produccion como **PENDIENTE** hasta que exista una URL publica verificada.
