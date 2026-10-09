# Casa Tour — producción Cloudflare, release 2026-10-09

## URLs verificadas

- Producción: https://casa-tour.simondalmasso44.workers.dev/
- Tour 3D: https://casa-tour.simondalmasso44.workers.dev/tour/demo
- Iframe: https://casa-tour.simondalmasso44.workers.dev/embed/demo
- Salud: https://casa-tour.simondalmasso44.workers.dev/api/v1/health

## Estado comprobado

El 2026-10-09 se sustituyó el Worker de texto plano de 12 bytes por el primer MVP real de Casa Tour.

- Fuente funcional: `main` en commit `3a950da031530bdfbb5dc0f4ba48eb018470cd44`. La publicación se ejecutó desde una rama operativa creada desde ese commit con dos archivos de workflow adicionales; no alteró el código de la aplicación.
- Staging aislado: `casa-tour-stg-b78e36d6`. [Deploy, HTTP y navegador GREEN](https://github.com/simondalmasso/casa-tour/actions/runs/37991683773).
- Producción: `casa-tour`. [Release, HTTP y Playwright GREEN](https://github.com/simondalmasso/casa-tour/actions/runs/37991867603).
- Smoke test navegador sobre el **dominio de producción**: WebGL real, escritorio, móvil 390/320 px, primera pantalla 3D-first, panel de materiales plegable, controles y scroll vertical táctil, cambios de habitaciones y ensamblaje, cero errores JavaScript.
- Contract tests Node: **14 pasaron / 0 fallaron**.
- Probes externos tras el deploy: `/` HTTP 200 `text/html`, `/embed/demo` HTTP 200 `text/html`, `/api/v1/health` HTTP 200 `application/json`, sin bucles de redirecciones.
- La prueba de producción activó el rollback de forma **condicional**; no fue necesario ejecutarlo porque todo pasó.
- Imágenes y despliegues anteriores archivados en los artifacts de las ejecuciones citadas; retención temporal en GitHub Actions.

## Reversión

Antes de este release, `wrangler deployments list --name casa-tour` registró:

- Versión anterior `0b276636-642a-4c9e-b245-475d64ab4b38`, creada el 2026-10-09T20:07:55Z, correspondiente al Worker de placeholder.
- Si fuese necesario volver exactamente a esa versión, bajo la **cuenta correcta** de Cloudflare y con permisos apropiados: `npx wrangler@4 rollback 0b276636-642a-4c9e-b245-475d64ab4b38 --name casa-tour --message "Rollback Casa Tour to placeholder"`.
- Preferir `wrangler deployments list --name casa-tour` y revisar la versión actual antes de revertir; rollbacks afectan tráfico real inmediatamente.
- El rollback automático de un workflow fallido debe comprobarse igualmente con la URL de salud.

## Publicaciones posteriores

- El workflow principal `.github/workflows/deploy.yml` se ejecuta manualmente; credenciales exclusivamente en los secrets `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN`. No registrar valores de esos secrets en repo/issues/logs.
- Ejecutar tests y verificar dominio+iframe tanto en escritorio como en móvil tras cada modificación visual.
- Los Workers de staging son entornos aislados; no confundirlos con producción.
- El código está publicado, pero **NO** reconstruye casas reales desde fotografías; no tiene login, cobros ni GPU.

## Próximo bloque real

El siguiente gran hito es el pipeline privado foto→geometría semántica editable (ver [issue #4](https://github.com/simondalmasso/casa-tour/issues/4)). Evitar cobrar por reconstrucción automática mientras no exista una prueba sobre viviendas reales autorizadas.

## Segundo release: Casa Tour Studio 3D (2026-10-09)

- Fuente publicada: rama operativa creada desde `main` SHA `6a5c05b959734fb41fc1cf4f7649547af45785f4`, sin cambios en el código de la aplicación.
- Versión de Worker **activa verificada**: `a4773364-55e4-459c-94ce-9d9b509bdfa3`. La anterior fue `34b90f9f-e9fd-4ce0-9865-e61cbef0770a`.
- Staging aislado [GREEN](https://github.com/simondalmasso/casa-tour/actions/runs/37994453201); URL `https://casa-tour-recon-stg-9344ca3d.simondalmasso44.workers.dev/studio`.
- Release production [GREEN](https://github.com/simondalmasso/casa-tour/actions/runs/37995092708), con **23 pruebas Node, 6 Python, Playwright real** en escritorio/móvil (390/320), exportación, reimportación, seguridad de referencias de foto, y comprobación del tour previo.
- Endpoints `/`, `/studio`, `/embed/demo`, `/glb-export.js` y `/api/v1/health` verificados en producción. Se esperaron **dos pases completos consecutivos** antes del browser QA para evitar errores por propagación transitoria de Cloudflare.
- Dos intentos anteriores se bloquearon o revirtieron con seguridad: [guard de selección histórica](https://github.com/simondalmasso/casa-tour/actions/runs/37994798532) y [rollback automático verificado](https://github.com/simondalmasso/casa-tour/actions/runs/37994896529). Ninguno se declaró exitoso.
- El flujo futuro `.github/workflows/deploy.yml` es **manual**, guarda la versión activa más reciente, prueba la geometría y la UI con Node/Python/Chromium, y ejecuta rollback a la versión exacta anterior si la publicación falla después del deploy.
- **Sin reconstrucción automática desde fotos ni GPU:** `/studio` compila planos anotados a GLB local; las fotos permanecen en el dispositivo. GenRecon sigue restringido a investigación sin explotación comercial.

Si se requiere reversión de este release por incidentes, verificar primero la versión actual y que no haya despliegues posteriores. El rollback a `34b90f9f-e9fd-4ce0-9865-e61cbef0770a` restauraría el tour original, sin Studio.
