# Matriz de cumplimiento

## 1. Como leer esta matriz

| Estado | Significado |
| --- | --- |
| **CUMPLIDO Y PROBADO** | Existe la implementacion/documento y se verifico con una prueba automatizada, una ejecucion real o una inspeccion reproducible. |
| **IMPLEMENTADO PERO NO PROBADO** | Existe la implementacion, pero falta la ejecucion en el entorno requerido o la evidencia final. |
| **PENDIENTE** | No existe o no se ejecuto; requiere accion manual, cuenta, dispositivo o herramienta externa. |

La matriz se actualiza con la salida real de la sesion de cierre. No se marca un requisito como probado solo porque el codigo exista.

## 2. Resumen

| Estado | Cantidad |
| --- | ---: |
| CUMPLIDO Y PROBADO | 38 |
| IMPLEMENTADO PERO NO PROBADO | 1 |
| PENDIENTE | 2 |

## 3. Requisitos A: arquitectura, justificacion y documentacion

| ID | Requisito | Evidencia | Estado | Nota / limitacion |
| --- | --- | --- | --- | --- |
| A1 | Justificar la PWA para tecnicos rurales con conectividad intermitente | `docs/ARQUITECTURA.md`, seccion 1 y 2 | CUMPLIDO Y PROBADO | Verificado por `test/pwa.test.js` y revision del documento. |
| A2 | Comparar web tradicional, PWA, API orientada a servicios, nativa y multiplataforma | `docs/ARQUITECTURA.md`, seccion 3 | CUMPLIDO Y PROBADO | La API se presenta como complemento, no como cliente offline. |
| A3 | Matriz de decision con criterios, pesos, puntuaciones y justificacion | `docs/ARQUITECTURA.md`, seccion 4 | CUMPLIDO Y PROBADO | PWA 4.40; multiplataforma 3.95; nativa 3.35. |
| A4 | Tabla de compatibilidad de navegadores y sistemas operativos, incluido Safari/iOS | `docs/ARQUITECTURA.md`, seccion 6 | CUMPLIDO Y PROBADO | Documentado; no se probo en dispositivos reales. |
| A5 | README con requisitos, instalacion, configuracion, ejecucion, pruebas, offline y despliegue | `README.md` | CUMPLIDO Y PROBADO | `test/pwa.test.js` verifica secciones y comandos. |
| A6 | Plan y checklist de aceptacion | `PLAN.md` | CUMPLIDO Y PROBADO | Incluye tareas pendientes y criterio de cierre. |
| A7 | Documentacion de pruebas y evidencias | `docs/PRUEBAS.md` | CUMPLIDO Y PROBADO | Incluye comandos, cobertura y capturas a realizar. |
| A8 | Guia de demostracion para clase | `docs/DEMO.md` | CUMPLIDO Y PROBADO | Guion de 10 a 15 minutos y limitaciones. |

## 4. Requisitos B: API, entorno y seguridad

| ID | Requisito | Evidencia | Estado | Nota / limitacion |
| --- | --- | --- | --- | --- |
| B1 | Documentar Node.js, servidor y estructura | `README.md`, `docs/ARQUITECTURA.md` | CUMPLIDO Y PROBADO | Revision de documentos. |
| B2 | Endpoints de salud, listado, detalle y creacion | `server/index.js`, `server/routes/reportes.js`, `test/api.test.js` | CUMPLIDO Y PROBADO | API probada con `test/api.test.js`. |
| B3 | Configuracion por `.env` y plantilla `.env.example` | `.env.example`, `README.md` | CUMPLIDO Y PROBADO | `.env` no se leyo ni se versiona. |
| B4 | `.gitignore` excluye secretos, dependencias, temporales y artefactos | `.gitignore` | CUMPLIDO Y PROBADO | `test/pwa.test.js` verifica entradas. |
| B5 | Scripts npm de ejecucion y pruebas | `package.json` | CUMPLIDO Y PROBADO | `test`, `test:unit`, `test:api`, `test:pwa`, `test:e2e`, `test:all`. |
| B6 | Sin credenciales reales en codigo, documentacion, logs ni repositorio | `.env.example`, `README.md`, busqueda de patrones en archivos | CUMPLIDO Y PROBADO | Solo hay placeholders y mensajes genericos. No se imprimio `.env`. |
| B7 | No modificar el esquema de PostgreSQL | Codigo del servidor; sin migraciones ni DDL | CUMPLIDO Y PROBADO | La app solo hace SELECT/INSERT con `ON CONFLICT`; no CREATE/ALTER/DROP. |
| B8 | No borrar ni alterar reportes existentes | `test/api.test.js`, `scripts/e2e-offline.mjs` | CUMPLIDO Y PROBADO | Pruebas no destructivas; la E2E usa IndexedDB y API simulada. |
| B9 | API responde JSON y errores sin filtrar detalles internos | `server/index.js`, `server/routes/reportes.js`, `test/api.test.js` | CUMPLIDO Y PROBADO | Errores 400/404/413/415/500 con mensajes controlados. |
| B10 | Cabeceras de seguridad y CSP estricta | `server/index.js`, `test/api.test.js` | CUMPLIDO Y PROBADO | CSP, nosniff, DENY, Referrer-Policy, Permissions-Policy, HSTS condicional. |

## 5. Requisitos C: PWA, instalacion y cache

| ID | Requisito | Evidencia | Estado | Nota / limitacion |
| --- | --- | --- | --- | --- |
| C1 | Interfaz responsiva para movil y escritorio | `public/css/styles.css`, `public/index.html`, E2E viewport 375x812 | CUMPLIDO Y PROBADO | E2E verifica ausencia de scroll horizontal; captura manual recomendada. |
| C2 | Manifest con nombre, colores, standalone e iconos 192/512 | `public/manifest.webmanifest`, `public/icons/`, `test/pwa.test.js` | CUMPLIDO Y PROBADO | Dimensiones reales verificadas. |
| C3 | Service worker con install, activate y fetch | `public/sw.js`, `test/pwa.test.js`, E2E | CUMPLIDO Y PROBADO | E2E confirma SW activo y controlando. |
| C4 | Cache del app shell, API solo red y pagina offline | `public/sw.js`, `public/offline.html`, `public/css/offline.css`, E2E | CUMPLIDO Y PROBADO | E2E confirma app shell offline y `offline.html`. |
| C5 | Precache y actualizacion de cache con limpieza de versiones anteriores | `public/sw.js` (`v4`), E2E de upgrade v1/v2 | CUMPLIDO Y PROBADO | E2E final confirmo cache v4 y eliminacion de v1/v2. |
| C6 | Instalacion real desde el navegador | Manifest y boton de instalacion; prueba manual | IMPLEMENTADO PERO NO PROBADO | Requiere interaccion manual; no se automatizo el prompt del navegador. |
| C7 | Funcionamiento offline tras la primera carga | E2E offline, `docs/PRUEBAS.md` | CUMPLIDO Y PROBADO | Probado con Edge headless y en etapa 3. |

## 6. Requisitos D: persistencia, sincronizacion y validacion

| ID | Requisito | Evidencia | Estado | Nota / limitacion |
| --- | --- | --- | --- | --- |
| D1 | Guardar primero en IndexedDB | `public/js/app.js`, E2E offline | CUMPLIDO Y PROBADO | El reporte offline queda en la base local. |
| D2 | Persistencia tras recarga sin conexion | E2E offline + recarga | CUMPLIDO Y PROBADO | Probado en etapa 3 y smoke de etapa 4. |
| D3 | Estados de conexion, pendiente, sincronizado y error | `public/js/app.js`, UI, E2E | CUMPLIDO Y PROBADO | Badges y mensajes verificados. |
| D4 | Sincronizacion al iniciar, al evento `online` y manual | `public/js/app.js`, E2E mock | CUMPLIDO Y PROBADO | La recuperacion real se probo en etapa 3. |
| D5 | Idempotencia por `clientId`, unique y `ON CONFLICT DO NOTHING` | `server/routes/reportes.js`, `test/api.test.js`, etapa 3 | CUMPLIDO Y PROBADO | La prueba final se omitio por no haber un reporte existente valido; la etapa 3 valido mismo `id` y conteo sin duplicar. |
| D6 | Validacion estricta frontend/backend | `public/js/fechas.js`, `server/lib/validacion.js`, tests | CUMPLIDO Y PROBADO | 9 fechas validas / 24 invalidas en prueba pura. |
| D7 | API no disponible y recuperacion | E2E con servidor detenido y API simulada; etapa 3 real | CUMPLIDO Y PROBADO | La E2E final no escribe en PostgreSQL. |
| D8 | No duplicar reportes al reintentar | Prueba de idempotencia de etapa 3 | CUMPLIDO Y PROBADO | Depende de la restriccion unica existente en la base. |

## 7. Requisitos E: pruebas, Lighthouse, HTTPS y demo

| ID | Requisito | Evidencia | Estado | Nota / limitacion |
| --- | --- | --- | --- | --- |
| E1 | Pruebas automatizadas ejecutables desde npm | `test/`, `package.json`, salida de `npm.cmd test` | CUMPLIDO Y PROBADO | 25 pasan, 0 fallan, 1 omitida (idempotencia sin reporte valido existente). |
| E2 | E2E de navegador ejecutable desde npm | `scripts/e2e-offline.mjs`, salida `ok: true` | CUMPLIDO Y PROBADO | Cache v4, upgrade v1/v2, offline, error y recuperacion con API simulada. |
| E3 | Auditoria Lighthouse | `docs/LIGHTHOUSE.md`, `docs/lighthouse.json` | CUMPLIDO Y PROBADO | 100/100/100/100 en local; no sustituye HTTPS de produccion ni dispositivos reales. |
| E4 | Despliegue con HTTPS verificado | `docs/DESPLIEGUE.md` | PENDIENTE | Requiere cuenta, hosting, dominio y certificado; no se inventa una URL. |
| E5 | Demo reproducible | `docs/DEMO.md` | CUMPLIDO Y PROBADO | Guion y comandos exactos. |
| E6 | Auditoria de dependencias | `npm.cmd audit --omit=dev` | CUMPLIDO Y PROBADO | 0 vulnerabilidades en produccion en la ultima ejecucion. |
| E7 | Sintaxis JS valida | `node --check` de 6 archivos de aplicacion + E2E | CUMPLIDO Y PROBADO | Ejecutado despues del refactor y de los cambios finales. |
| E8 | Pruebas en Android/iOS reales | Dispositivos fisicos o nube | PENDIENTE | No se dispone de dispositivos; solo Edge Windows. |

## 8. Evidencia de ejecuciones ya realizadas

| Fecha / etapa | Prueba | Resultado |
| --- | --- | --- |
| Etapa 3 | E2E real con PostgreSQL | Alta online, offline+recarga, error con servidor caido, recuperacion manual e idempotencia; cleanup de 2 filas propias. |
| Etapa 4 | `node --check` | OK en 6 archivos. |
| Etapa 4 | Validacion pura | 9 validas / 24 invalidas OK. |
| Etapa 4 | API/cabeceras/validacion | `Pruebas API/cabeceras/validacion OK`; sin inserts del prefijo de prueba. |
| Etapa 4 | Smoke Edge | `Smoke test CSP/SW/offline OK`; cache v3, offline CSS, app shell y rechazo de fecha invalida. |
| Etapa 4 | `npm.cmd audit --omit=dev` | 0 vulnerabilidades. |
| Etapa 4 | `git diff --check` | Solo warnings CRLF. |
| Cierre | `npm.cmd test` | 25 pasan, 0 fallan, 1 omitida. |
| Cierre | `npm.cmd run test:e2e` | `ok: true`; SW activo, cache v4, offline+recarga, error, recuperacion manual y auto-sync. |
| Cierre | `npm.cmd run test:all` | Suite completa ejecutada; E2E `ok: true`. |
| Cierre | Lighthouse 13.6.0 | Performance 100, Accessibility 100, Best Practices 100, SEO 100. |
| Cierre | `npm.cmd audit --omit=dev` | 0 vulnerabilidades. |

## 9. Limitaciones declaradas

- **Android/iOS reales:** no probados. La app evita APIs exclusivas de Chromium y documenta las limitaciones de Safari/iOS, pero no se certifica su funcionamiento en esos dispositivos.
- **HTTPS de produccion:** no desplegado. La unica verificacion de HSTS fue simulada con `X-Forwarded-Proto: https` en local.
- **Lighthouse:** ejecutado en `localhost` HTTP con Edge headless; no se ejecuto contra HTTPS de produccion. Lighthouse 13 no reporta una categoria PWA separada.
- **Instalacion real:** el manifest cumple los criterios, pero el prompt de instalacion es una interaccion manual del navegador.
- **Sincronizacion real en el cierre:** la etapa 3 la valido contra PostgreSQL; el cierre final usa una API simulada para no crear ni borrar datos.

## 10. Conclusion

La implementacion cubre el nucleo funcional y la documentacion solicitada. Los pendientes son los que dependen de infraestructura o dispositivos externos: HTTPS de produccion y pruebas en Android/iOS reales. La instalacion real desde el navegador queda como interaccion manual no automatizada. La matriz no declara cumplido nada que no tenga evidencia.
