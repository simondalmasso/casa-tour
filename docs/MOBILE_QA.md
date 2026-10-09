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

## Estado de publicación: en producción desde 2026-10-09

- El Worker antiguo devolvía texto plano de 12 bytes. Ese hallazgo fue resuelto mediante release.
- Se configuraron en GitHub Actions los secretos Cloudflare y se publicó **staging** aislado: [deploy + QA GREEN](https://github.com/simondalmasso/casa-tour/actions/runs/37991683773).
- Luego se desplegó el Worker público `casa-tour` mediante un workflow con detección del placeholder anterior, registro de versión previa y rollback automático en caso de fallos. [Release GREEN](https://github.com/simondalmasso/casa-tour/actions/runs/37991867603).
- Se completó Playwright sobre la URL definitiva, sin errores JavaScript, con screenshots de escritorio y teléfonos 390/320 px. Las comprobaciones HTTP externas confirmaron HTML y JSON correctos.
- Ver [docs/DEPLOYMENT.md](DEPLOYMENT.md) para URLs, evidencia y rollback.


La experiencia móvil es un MVP visual real sobre una **maqueta ilustrativa**. No convierte automáticamente fotografías en modelos 3D ni mide viviendas reales.
