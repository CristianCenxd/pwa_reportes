# Demostracion en clase

## 1. Preparacion previa

En una terminal, desde `C:\Users\crist\Desktop\proyecto-PWA`:

```powershell
npm.cmd install
npm.cmd test
npm.cmd start
```

Antes de empezar, verificar:

- PostgreSQL esta iniciado y `.env` tiene la conexion correcta (no mostrar `.env`).
- La tabla `public.reportes` existe.
- `http://localhost:3000/api/health` responde con `database: "connected"`.
- Edge o Chrome estan actualizados.
- Se limpio el sitio o se usa un perfil nuevo si se quiere demostrar la instalacion desde cero.
- No se van a borrar reportes existentes.

Si no se quiere agregar datos a la base real durante la demo, usar una base local de demostracion. No borrar filas existentes para "dejar limpio" el entorno.

## 2. Guion sugerido (10 a 15 minutos)

### Paso 1: Presentar el problema y la decision

Mostrar `docs/ARQUITECTURA.md`:

- Tecnico en zona rural, conectividad intermitente.
- Offline-first: IndexedDB primero, API despues.
- Matriz de decision: PWA gana por offline, costo y cobertura.
- Limitaciones declaradas: Safari/iOS y HTTPS de produccion.

### Paso 2: Mostrar la API y el estado

Abrir en el navegador:

```text
http://localhost:3000/api/health
http://localhost:3000/api/reportes
```

Mostrar que la API responde JSON y que `health` informa la base conectada. No mostrar cadenas de conexion.

### Paso 3: Mostrar la PWA y el manifest

1. Abrir `http://localhost:3000/`.
2. DevTools > Application > Manifest.
3. Mostrar nombre, `short_name`, colores, `display: standalone` e iconos 192/512.
4. Application > Service Workers: mostrar el SW activo.
5. Application > Cache Storage: mostrar `reportes-servicio-v4` y los recursos precargados.

### Paso 4: Instalar la app

En Chrome/Edge, usar el icono de instalacion de la barra de direcciones o el menu **Instalar aplicacion**. Abrir la app instalada en ventana standalone. Si el navegador no muestra el prompt, usar **Agregar a pantalla de inicio** en movil; en iOS es manual desde Compartir.

### Paso 5: Crear un reporte con conexion

1. Completar titulo, descripcion, cliente, sitio, fecha y estado.
2. Guardar.
3. Mostrar el reporte en la lista con badge **Sincronizado**.
4. Opcional: abrir `/api/reportes` y mostrar el reporte.

### Paso 6: Demostrar offline real

1. DevTools > Network > Offline.
2. Crear un segundo reporte.
3. Mostrar que se guarda en el dispositivo y queda **Pendiente de sincronizar**.
4. Recargar la pagina sin red.
5. Mostrar que el app shell carga y el reporte pendiente sigue visible desde IndexedDB.
6. Navegar a una ruta no cacheada, por ejemplo `http://localhost:3000/ruta-sin-cache`, y mostrar `offline.html`.

### Paso 7: Demostrar error de API y recuperacion

1. Volver a la app y dejar el reporte pendiente.
2. En la terminal del servidor, detener con `Ctrl+C`.
3. Con Network en **Online**, pulsar **Sincronizar pendientes**.
4. Mostrar el mensaje de error y el badge **Error al sincronizar**.
5. Reiniciar el servidor:

```powershell
npm.cmd start
```

6. Volver a pulsar **Sincronizar pendientes**.
7. Mostrar el badge **Sincronizado** y el mensaje de exito.

La prueba E2E automatizada hace esta recuperacion con una API simulada para no escribir en PostgreSQL. La sincronizacion real contra PostgreSQL se probo en la etapa 3 con filas propias de prueba.

### Paso 8: Demostrar idempotencia

Mostrar en el codigo:

- `server/routes/reportes.js`: `ON CONFLICT (client_id) DO NOTHING`.
- Restriccion unica de `client_id` en PostgreSQL.
- `test/api.test.js`: prueba no destructiva que reenvia un `clientId` existente, espera `200`, el mismo `id` y la misma cantidad de filas.

Ejecutar:

```powershell
npm.cmd run test:api
```

No crear un reporte nuevo solo para borrarlo despues. La prueba usa un reporte existente y no lo modifica.

### Paso 9: Mostrar validacion estricta

1. En el formulario, intentar una fecha imposible. El control `type="date"` del navegador ya la bloquea; la validacion compartida tambien la rechaza en backend.
2. Mostrar `public/js/fechas.js` y `server/lib/validacion.js`.
3. Ejecutar:

```powershell
npm.cmd run test:unit
```

Mostrar que `2026-02-31` y `2026-02-29` se rechazan, y que `2024-02-29` se acepta.

### Paso 10: Mostrar pruebas y calidad

Ejecutar en vivo:

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd audit --omit=dev
```

Mostrar la matriz `docs/MATRIZ-CUMPLIMIENTO.md` y aclarar que:

- Android/iOS reales no se probaron.
- HTTPS de produccion no se ejecuto; solo se probo HSTS simulado.
- Lighthouse local se ejecuto con 100/100/100/100; ver `docs/LIGHTHOUSE.md`.

## 3. Comandos exactos de arranque

```powershell
cd C:\Users\crist\Desktop\proyecto-PWA
npm.cmd install
npm.cmd start
```

Abrir:

```text
http://localhost:3000
```

Detener el servidor:

```text
Ctrl+C en la terminal donde corre npm.cmd start
```

Reiniciar:

```powershell
npm.cmd start
```

## 4. Evidencias para capturar

- `GET /api/health` con base conectada.
- Manifest y service worker activos.
- App instalada o prompt de instalacion.
- Vista movil 375x812 sin scroll horizontal.
- Reporte pendiente en IndexedDB y tras recarga offline.
- `offline.html` al navegar sin red.
- Error de sincronizacion con servidor detenido.
- Reporte sincronizado al reiniciar el servidor.
- Salida verde de `npm.cmd test` y `npm.cmd run test:e2e`.
- Matriz de cumplimiento y arquitectura.

## 5. Preguntas que conviene tener respondidas

- **Por que IndexedDB y no localStorage?** IndexedDB permite almacenar objetos, indices y volumen suficiente para reportes; localStorage es sincrono y limitado.
- **Por que no Background Sync?** Safari/iOS no lo soporta de forma general; la app usa inicio, evento `online` y boton manual.
- **Que pasa si se cae la API?** El reporte queda local como pendiente/error y se reintenta.
- **Como se evita duplicar?** `clientId` estable + restriccion unica + `ON CONFLICT DO NOTHING`.
- **Que falta para produccion?** HTTPS real, hosting, PostgreSQL gestionado, backups y pruebas en dispositivos reales.
- **Que no se puede afirmar?** Que funcione en Android/iOS reales o que HTTPS de produccion este desplegado.
