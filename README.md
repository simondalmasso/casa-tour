# Casa Tour

**Producto de visitas tridimensionales para inmobiliarias (B2B) y particulares (B2C).** Publicación por URL o iframe, con planes diferenciados de panoramas 360°, vista Dios, materiales y reconstrucción geométrica revisada.

## Estado actual: MVP 3D online (desde 2026-10-09)

**[Casa Tour en Cloudflare](https://casa-tour.simondalmasso44.workers.dev/)** · [Tour 3D](https://casa-tour.simondalmasso44.workers.dev/tour/demo) · [Salud de API](https://casa-tour.simondalmasso44.workers.dev/api/v1/health)

Deploy, contratos y pruebas Playwright de escritorio/móvil verificados en producción. [Reporte de despliegue y rollback](docs/DEPLOYMENT.md). Sigue siendo una **demo geométrica**, no un servicio de reconstrucción foto→3D automático.

## Primer MVP demostrativo

Incluye una **maqueta 3D auténtica** de vivienda construida mediante Three.js: pisos, muros, aberturas y muebles como mallas independientes. Puede rotarse, verse desde arriba, recorrerse con WASD, mostrar malla geométrica y cambiar materiales e iluminación. La landing muestra ahora la maqueta 3D directamente, con accesos rápidos a Vista Dios, Planta y una animación ilustrativa de ensamblaje. Los botones de Estar, Dormitorio y Cocina activan recorridos de cámara entre puntos definidos; no son fotografías panorámicas.

**Todavía NO hay reconstrucción automática de viviendas desde fotografías.** El formulario permite seleccionar imágenes localmente y exportar una ficha JSON; no sube ni procesa fotos. No hay cuentas, pagos, captación de datos personales ni precisión dimensional certificada. No debe anunciarse como reconstrucción de una casa real.

## Rutas

- `/`: landing B2B/B2C y preparación local de fotos
- `/tour/demo`: tour independiente
- `/embed/demo`: visor para iframe
- `/api/v1/health`: salud del producto
- `/api/v1/tours/demo`: manifest del tour

Ejemplo de integración del demo publicado:

```html
<iframe
  src="https://casa-tour.simondalmasso44.workers.dev/embed/demo"
  title="Casa Tour — visita 3D"
  loading="lazy"
  allow="fullscreen"
  style="width:100%;height:600px;border:0">
</iframe>
```

El visor carga Three.js desde jsDelivr. Necesita conexión a Internet y un navegador con WebGL. **La URL anterior está publicada y verificada en producción desde el 2026-10-09.**

## Desarrollar y desplegar

Node.js 22+; Wrangler 4 para Cloudflare Workers.

```bash
npm run validate
npx wrangler@4 dev
```

Deploy manual: `npx wrangler@4 deploy`, utilizando credenciales adecuadas del proyecto Cloudflare. `.github/workflows/deploy.yml` requiere `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; se dispara manualmente para evitar sobrescrituras involuntarias.

Ver [docs/PRODUCT.md](docs/PRODUCT.md) para arquitectura B2B/B2C, evidencias, limitaciones, estrategias de reconstrucción, seguridad y roadmap.

## Movimiento y revisión visual

- `public/motion.css` y `public/motion.js`: microinteracciones de presentación, revelado por scroll y controles coordinados con el iframe del visor, con respeto a `prefers-reduced-motion`.
- El iframe `/embed/demo?surface=hero` oculta sus barras para dejar protagonista a la geometría. La página mantiene controles externos.
- `CASA_TOUR_SET_VIEW` admite `dollhouse`, `top`, `walk`, `wireframe`, `living`, `bedroom`, `kitchen` y `assembly`.
- La integración apaga el render en visores fuera de pantalla para ahorrar GPU; la reconstrucción de fotografías sigue sin implementarse.
- `npm run validate` realiza las pruebas sintácticas y de contrato. Un flujo separado `.github/workflows/browser-smoke.yml` comprueba WebGL, controles, consola y vistas escritorio/móvil, subiendo capturas temporales.

**Seguridad y transparencia:** el botón *Ensamblar* es una animación representativa de una maqueta; no corresponde a la construcción real de un inmueble ni avala cotas, superficies o levantamientos.

## Mobile-first (actualización octubre de 2026)

En teléfonos, la **maqueta 3D aparece inmediatamente después del titular**. El visor usa una barra de ambientes, otra de modos y un panel plegable de materiales/sol. Los deslizamientos verticales pueden seguir desplazando la página incluso sobre el canvas; los gestos horizontales permiten manipular la casa. Se reduce resolución interna y sombras para equipos móviles.

Las pruebas de navegador incluyen anchuras de 390 y 320 px, sin overflow horizontal, tests de personalización y capturas reales. Ver [docs/MOBILE_QA.md](docs/MOBILE_QA.md).

Ese mismo día, Cloudflare empezó a servir el frontend real en producción después de pasar por staging. [Ver evidencia de producción](https://github.com/simondalmasso/casa-tour/actions/runs/37991867603). El antiguo Worker era un placeholder de 12 bytes y fue sustituido mediante un release con rollback disponible.
