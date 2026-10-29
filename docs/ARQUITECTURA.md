# Arquitectura y justificacion de la PWA

## 1. Contexto

El escenario es un tecnico que atiende zonas rurales o con conectividad intermitente y necesita registrar reportes de servicio desde un telefono o una computadora portatil. La red puede desaparecer a mitad del formulario, el equipo puede quedarse sin bateria y el tecnico no puede esperar a tener senal para dejar constancia del trabajo.

La decision central es **offline-first**: el dispositivo es la fuente de verdad inmediata y la nube es el destino de sincronizacion. El reporte se guarda primero en IndexedDB; luego se envia a la API con un identificador estable (`clientId`) para que los reintentos sean idempotentes.

## 2. Por que una PWA sirve para este problema

- **Funciona sin red despues de la primera carga**: el service worker cachea el app shell y la pagina de contingencia.
- **Persistencia local real**: IndexedDB conserva reportes pendientes aunque se recargue la aplicacion o se cierre la pestana.
- **Instalable sin tienda**: el manifest permite agregar la app a la pantalla de inicio en navegadores compatibles.
- **Un solo codigo para escritorio y movil**: HTML, CSS y JavaScript; no hay dos aplicaciones que mantener.
- **Actualizacion centralizada**: al publicar una nueva version del service worker, los clientes actualizan la cache.
- **Bajo costo y despliegue web**: no requiere publicar en App Store ni Google Play.
- **Hardware suficiente para el caso de uso**: formularios, camara opcional, geolocalizacion opcional y almacenamiento local; no se requiere acceso profundo al sistema.
- **Sincronizacion controlada**: la app sincroniza al iniciar, al recuperar conexion y manualmente; no depende de Background Sync, que no esta disponible en Safari/iOS.

La PWA no es la mejor opcion si el requisito principal fuera acceso intensivo a hardware nativo, procesos en segundo plano complejos o integracion profunda con el sistema operativo. En este proyecto esas necesidades no existen.

## 3. Comparacion de alternativas

| Alternativa | Como se instala / distribuye | Offline | Acceso a hardware | Actualizaciones | Costo y alcance | Adecuacion al caso |
| --- | --- | --- | --- | --- | --- | --- |
| Web tradicional | URL en navegador | Muy limitado; sin cache de aplicacion ni persistencia offline confiable | Limitado | Inmediatas | Bajo; multiplataforma | No cumple el requisito de campo sin red. |
| PWA | URL + instalacion desde el navegador | Alto con service worker e IndexedDB | Medio; APIs web | Inmediatas y controladas | Bajo/medio; un codigo | Alta: cubre offline, instalacion y bajo costo. |
| API orientada a servicios | Backend/API para clientes | No resuelve por si sola la experiencia offline del cliente | Depende del cliente | Inmediatas en servidor | Medio; requiere cliente | Es un complemento arquitectonico, no un reemplazo del cliente offline. |
| Aplicacion nativa | App Store / Google Play | Alto | Alto | Por tienda y version | Alto; un codigo por plataforma | Sobredimensionada para formularios y despliegue academico. |
| Multiplataforma (Flutter/React Native) | Tiendas o binarios | Alto si se implementa | Alto/medio | Por tienda o actualizacion | Medio/alto; toolchain adicional | Buena si se exigiera hardware nativo; agrega complejidad innecesaria aqui. |

**Nota importante:** "API orientada a servicios" describe una forma de organizar el backend, no un tipo de cliente. En este proyecto la API Express/PostgreSQL existe y se combina con la PWA; la fila de la tabla se puntua como "solo API + cliente ligero" para mostrar que la API por si sola no resuelve el offline.

## 4. Matriz de decision arquitectonica

Escala de puntuacion: 1 = malo, 5 = excelente. Los pesos son especificos para este proyecto y suman 100%.

| Criterio | Peso | Web tradicional | PWA | API + cliente ligero | Nativa | Multiplataforma |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Offline-first en campo | 30% | 1 | 5 | 1 | 5 | 4 |
| Instalacion y experiencia tipo app | 15% | 1 | 4 | 1 | 5 | 5 |
| Costo y tiempo de desarrollo | 15% | 5 | 4 | 4 | 1 | 3 |
| Cobertura multiplataforma | 15% | 5 | 5 | 5 | 1 | 4 |
| Mantenibilidad y despliegue | 10% | 5 | 4 | 5 | 2 | 4 |
| Acceso a hardware nativo | 10% | 2 | 3 | 1 | 5 | 4 |
| Actualizaciones | 5% | 5 | 5 | 5 | 2 | 3 |
| **Total ponderado** | **100%** | **2.90** | **4.40** | **2.65** | **3.35** | **3.95** |

### Justificacion de la decision

La PWA obtiene **4.40**, por encima de multiplataforma (**3.95**) y nativa (**3.35**). La diferencia decisiva esta en el peso del offline (30%) y en la relacion costo/cobertura. La app nativa tambien resuelve el offline, pero exige dos bases de codigo, tiendas, firmas y un proceso de publicacion que no aporta valor proporcional para un formulario de reportes. La multiplataforma reduce ese costo, pero sigue agregando toolchain y distribucion binaria.

La PWA permite ademas integrar la API orientada a servicios sin renunciar al offline: el cliente guarda localmente y la API solo confirma la sincronizacion. Por eso la decision final es **PWA + API Express/PostgreSQL**, no "PWA en lugar de API".

### Sensibilidad de la decision

Si el acceso a hardware nativo subiera a 40% y el offline bajara a 10%, la nativa o la multiplataforma podrian ganar. Si el requisito fuera solo consulta en linea, la web tradicional seria suficiente. La matriz debe revisarse si cambian los requisitos del profesor o del cliente.

## 5. Arquitectura implementada

```text
+------------------------------+
| Navegador / dispositivo      |
|                              |
|  index.html + CSS + app.js   |
|  manifest.webmanifest        |
|  service worker (sw.js)      |
|  IndexedDB (reportes-pwa)    |
+--------------+---------------+
               | HTTPS en produccion
               | fetch /api/*
               v
+------------------------------+
| Node.js + Express            |
|  server/index.js             |
|  cabeceras de seguridad      |
|  /api/health                 |
|  /api/reportes               |
|  validacion compartida       |
+--------------+---------------+
               | pg Pool
               v
+------------------------------+
| PostgreSQL                   |
|  public.reportes             |
|  unique(client_id)           |
+------------------------------+
```

### Flujo offline-first

1. El tecnico completa el formulario.
2. `app.js` valida en frontend con `public/js/fechas.js`.
3. El reporte se escribe en IndexedDB con estado `pendiente` y un `clientId` estable.
4. Si hay red, se hace `POST /api/reportes`.
5. El backend valida de nuevo, inserta con `ON CONFLICT (client_id) DO NOTHING` y responde `201` o `200`.
6. El frontend actualiza el registro local a `sincronizado`.
7. Si no hay red o la API falla, el registro queda `pendiente` o `error` y se reintenta al volver la conexion o al pulsar **Sincronizar pendientes**.

### Estrategia de cache

- `install`: precache del app shell, CSS, JS, manifest, iconos y `offline.html`.
- `activate`: elimina caches antiguas de la familia `reportes-servicio-*` y toma control con `clients.claim()`.
- `fetch`:
  - Navegacion: red primero; si falla, app shell (`/index.html`) para `/` o `/index.html`, y `offline.html` para el resto.
  - API: solo red con `cache: 'no-store'`.
  - Estaticos: cache primero, con actualizacion de cache cuando hay red.
- La version actual de cache es `v4`; incluye `fechas.js` y `offline.css`.

## 6. Compatibilidad de navegadores y sistemas operativos

| Navegador / sistema | Service Worker | IndexedDB | Instalacion | Offline | Limitaciones relevantes |
| --- | --- | --- | --- | --- | --- |
| Chrome escritorio (Windows/macOS/Linux) | Si | Si | Si, con prompt | Si | Requiere HTTPS o localhost. |
| Edge escritorio (Windows/macOS) | Si | Si | Si, con prompt | Si | Requiere HTTPS o localhost. |
| Chrome Android | Si | Si | Si, con prompt | Si | El sistema puede limitar el almacenamiento si el dispositivo esta bajo presion. |
| Firefox escritorio/Android | Si | Si | Parcial; el flujo de instalacion varia | Si | Menos soporte de instalacion tipo app que Chromium. |
| Samsung Internet (Android) | Si | Si | Si | Si | Basado en Chromium; validar version del dispositivo. |
| Safari macOS | Si | Si | Parcial; agregar a Dock/Launchpad segun version | Si | Ciclo de vida del service worker y almacenamiento mas restrictivos. |
| Safari iOS/iPadOS | Si, con limitaciones | Si | Manual: Compartir > Agregar a pantalla de inicio | Si, con limitaciones | Sin `beforeinstallprompt`; sin Background Sync; el sistema puede desalojar almacenamiento; notificaciones push solo en versiones recientes y con la app instalada; el ciclo de vida del SW puede suspenderse. |

**Estado de prueba real:** la auditoria final se ejecuto en **Edge headless sobre Windows**. No se probo en Android ni en iOS/Safari reales. Por lo tanto, la tabla anterior es una guia de compatibilidad documentada, no una certificacion de esos dispositivos. Para la entrega, si el profesor exige evidencia movil, deben capturarse pruebas en un telefono Android y, si hay acceso, en un iPhone/iPad.

La app no usa Background Sync ni APIs exclusivas de Chromium, precisamente para no romper Safari/iOS. La sincronizacion se apoya en `online`, inicio de la app y boton manual.

## 7. Decisiones de seguridad

- CSP estricta: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `worker-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`.
- CSS offline extraido a `/css/offline.css` para no necesitar `unsafe-inline`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictiva.
- HSTS condicional cuando la peticion es HTTPS o el proxy informa `X-Forwarded-Proto: https`.
- `Cache-Control: no-store` en `/api/`.
- Mensajes de error genericos; los detalles de PostgreSQL se registran solo en el servidor y se sanitizan.

## 8. Referencias internas

- Matriz de cumplimiento: `docs/MATRIZ-CUMPLIMIENTO.md`
- Pruebas y evidencias: `docs/PRUEBAS.md`
- Despliegue: `docs/DESPLIEGUE.md`
- Demo: `docs/DEMO.md`
