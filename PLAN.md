# Plan de cierre y checklist de aceptacion

## Objetivo

Cerrar el Proyecto Integrador PWA demostrando cumplimiento verificable, sin reconstruir la app, sin modificar el esquema de PostgreSQL y sin borrar reportes existentes.

## Checklist de aceptacion

### A. Arquitectura y documentacion

- [x] Justificacion de PWA para tecnicos en zonas rurales sin Internet.
- [x] Comparacion entre web tradicional, PWA, API orientada a servicios, nativa y multiplataforma.
- [x] Matriz de decision con criterios, pesos, puntuaciones y justificacion.
- [x] Tabla de compatibilidad de navegadores y sistemas operativos, con limitaciones de Safari/iOS.
- [x] README con requisitos, instalacion, configuracion, ejecucion, pruebas, offline, sincronizacion y despliegue.
- [x] Checklist de aceptacion y plan de cierre.
- [x] Documentacion de pruebas y evidencias para la presentacion.

### B. Entorno y API

- [x] Node.js y servidor documentados.
- [x] `GET /api/health`, `GET /api/reportes`, `GET /api/reportes/:id`, `POST /api/reportes`.
- [x] Configuracion mediante `.env` y plantilla `.env.example`.
- [x] `.gitignore` excluye secretos, dependencias, temporales y artefactos.
- [x] Scripts npm de ejecucion y pruebas.
- [x] Sin credenciales reales en codigo, documentacion, logs ni repositorio.

### C. PWA e instalacion

- [x] Interfaz responsiva con puntos de quiebre para movil y escritorio.
- [x] Manifest vinculado con nombre, colores, standalone e iconos 192/512.
- [x] Service Worker con install, activate y fetch.
- [x] Cache del app shell, API solo red y pagina `offline.html`.
- [x] Precache y actualizacion de cache a `v4` con limpieza de versiones anteriores.

### D. Offline y persistencia

- [x] Reporte guardado primero en IndexedDB.
- [x] Persistencia tras recarga sin conexion.
- [x] Estados de conexion, pendiente, sincronizado y error.
- [x] Sincronizacion al iniciar, al evento `online` y con boton manual.
- [x] Idempotencia por `clientId`, restriccion unica y `ON CONFLICT DO NOTHING`.
- [x] Validacion estricta compartida frontend/backend.
- [x] Comportamiento con API no disponible y recuperacion simulada del cliente.

### E. Calidad y entrega

- [x] Pruebas automatizadas ejecutables desde npm: `npm.cmd test`.
- [x] E2E de navegador ejecutable desde npm: `npm.cmd run test:e2e`.
- [x] Auditoria Lighthouse local ejecutada y problema de favicon corregido (100/100/100/100).
- [ ] Despliegue de produccion con HTTPS verificado.
- [x] Guia de demostracion reproducible para el profesor.

## Tareas pendientes que dependen de terceros o acciones manuales

1. **HTTPS de produccion**: requiere cuenta, hosting, dominio y PostgreSQL accesible. Seguir `docs/DESPLIEGUE.md`; no se puede declarar cumplido sin URL publica y certificado valido.
2. **Android/iOS reales**: requieren dispositivos fisicos o servicios de dispositivos en la nube. La app esta disenada para funcionar, pero no se probo en esos sistemas.
3. **Lighthouse de produccion**: la auditoria local ya esta en `docs/LIGHTHOUSE.md`; repetirla contra la URL HTTPS cuando exista el despliegue.
4. **Evidencias visuales**: capturar las pantallas indicadas en `docs/PRUEBAS.md` y `docs/DEMO.md`.

## Orden de trabajo

1. Revisar documentacion y matriz.
2. Ejecutar `npm.cmd test`.
3. Ejecutar `npm.cmd run test:e2e`.
4. Ejecutar `npm.cmd audit --omit=dev`.
5. Repetir Lighthouse contra HTTPS cuando exista despliegue; la auditoria local ya se ejecuto.
6. Preparar la demo con `docs/DEMO.md`.
7. No hacer commit automaticamente; revisar `git diff` y decidir.

## Criterio de cierre

El proyecto se considera cerrado para la entrega academica cuando:

- La suite `npm.cmd test` pasa.
- La E2E `npm.cmd run test:e2e` pasa.
- La matriz no tiene requisitos en estado PENDIENTE sin una justificacion clara.
- Las limitaciones de HTTPS produccion, Android/iOS y Lighthouse local estan declaradas con honestidad.
- La demo se puede repetir con los comandos de `docs/DEMO.md`.
