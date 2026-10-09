# Casa Tour — revisión móvil y despliegue (2026-10-09)

## Prioridades de experiencia móvil implementadas
1. El modelo 3D navegado con Three.js aparece inmediatamente después del titular, antes del texto comercial y botones.
2. No hay etiquetas superpuestas al modelo en el hero: se oculta la anotación decorativa y se preservan los controles rápidos.
3. El visor interior distribuye las opciones por prioridad: información mínima arriba, barra de habitaciones sobre la barra de modos y materiales/sol dentro del panel **Personalizar** cerrado por defecto.
4. El panel tiene `aria-expanded`, soporte de Escape y cierre al tocar fuera. La opción de compartir ocupa una sola línea incluso en 320 px.
5. El canvas utiliza `touch-action: pan-y` **tras** inicializar OrbitControls para que arrastres verticales puedan desplazar la página; los horizontales interactúan con el modelo.
6. Los teléfonos limitan el pixel ratio a 1.2 y el mapa de sombras a 1024 px para reducir coste de GPU. El `prefers-reduced-motion` original sigue vigente.
7. Se reduce espacio en blanco y alto total de página mediante tarjetas y etapas más compactas, sin ocultar información contractual.

## QA automatizada (Playwright + Wrangler local)
- Inicio de Worker local y comprobación de WebGL/Three.js.
- Perspectivas, animación de ensamblaje y enfoque de habitaciones.
- Anchuras 1440, 390 y 320 px.
- En 390 px, geometría del hero dentro del primer pliegue y texto comercial después del modelo.
- Personalización oculta por defecto, apertura, cambio de paleta y cierre.
- Comprobación de no overflow horizontal en 390/320, sin `pageerror` y capturas.
- `npm run validate` cubre sintaxis y tests del contrato de Worker.

## Estado del servicio externo (2026-10-09)
- El endpoint público de Cloudflare responde HTTP 200 con cuerpo `text/plain` de 12 bytes **también en** `/api/v1/health`, no el JSON previsto de Casa Tour. Por tanto, el Worker público todavía no ejecuta este código.
- La prueba aislada de GitHub Actions, `Cloudflare isolated preview`, validó los tests pero **omitió el deploy**: `CLOUDFLARE_ACCOUNT_ID` y/o `CLOUDFLARE_API_TOKEN` no están configurados como GitHub Actions secrets de este repositorio.
- La cuenta Cloudflare real, el Worker activo y sus deploys anteriores no están inspeccionados; no sobreescribir producción sin acceso controlado y rollback.
- Configurar secrets en GitHub > Settings > Secrets and variables > Actions, con token de Cloudflare de privilegios mínimos (Workers Scripts Edit para la cuenta adecuada) y su Account ID. No escribir tokens en el repositorio ni en mensajes.

La experiencia móvil es un MVP visual real sobre una **maqueta ilustrativa**. No convierte automáticamente fotografías en modelos 3D ni mide viviendas reales.
