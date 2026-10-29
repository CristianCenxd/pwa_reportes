# Auditoria Lighthouse

## Resultado final

| Categoria | Puntaje |
| --- | ---: |
| Performance | 100 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| Agentic Browsing | 100 |

- Lighthouse: `13.6.0`.
- Fecha de ejecucion reportada por Lighthouse: `2026-10-29T02:48:29.316Z` (UTC).
- URL auditada: `http://localhost:3100/`.
- Form factor: `mobile`.
- Metodo de throttling: `simulate`.
- Evidencia JSON completa: `docs/lighthouse.json`.

## Comando ejecutado

```powershell
$env:PORT = '3100'
node server/index.js
```

En otra terminal:

```powershell
$env:CHROME_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npx.cmd --yes lighthouse http://localhost:3100 `
  --chrome-path="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" `
  --output=json `
  --output-path="docs/lighthouse.json" `
  --quiet
```

Lighthouse se ejecuto con `npx --yes` como herramienta temporal de auditoria. No se agrego a `dependencies` ni a `devDependencies` del proyecto.

## Correccion realizada

La primera ejecucion marco **Best Practices 96** por un `404` de `/favicon.ico` en la consola del navegador. Se agrego el icono explicito en `public/index.html` y `public/offline.html`:

```html
<link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192">
```

La segunda ejecucion obtuvo **100** en Best Practices y no dejo auditorias fallidas en esa categoria.

## Interpretacion

- La app es rapida y accesible en el entorno local auditado.
- No hay errores de consola ni problemas de mejores practicas en la ejecucion final.
- Lighthouse 13 ya no reporta una categoria PWA separada; la instalabilidad se verifico con el manifest, el service worker y la prueba E2E, no con un puntaje PWA de Lighthouse.
- La auditoria se hizo sobre `localhost` con HTTP. El service worker funciona en `localhost`, pero **no se verifico HTTPS de produccion**; eso sigue PENDIENTE en la matriz.
- La auditoria es de escritorio con emulacion movil y Edge headless. No reemplaza una prueba en Android o iOS reales.

## Limitaciones

- No se ejecuto Lighthouse contra una URL HTTPS publica.
- No se ejecuto en un telefono fisico.
- El puntaje puede variar con la red, el equipo, la base de datos y la version de Lighthouse.
- La evidencia JSON contiene datos de la auditoria local; no incluye credenciales ni `.env`.
