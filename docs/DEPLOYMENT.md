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
