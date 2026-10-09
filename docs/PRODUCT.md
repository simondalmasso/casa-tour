# Casa Tour — alcance de producto y negocio (2026-10-09)

## Posicionamiento

Servicio de representación de viviendas para **inmobiliarias B2B** y **particulares B2C**. El resultado es una URL y/o un iframe que lleva a un espacio navegable. Los planes distinguen 360° fotográfico, modelo tridimensional y reconstrucción con validación dimensional.

**Invariante de producto:** no presentar modelos generados, geometría inferida o panoramas como levantamientos arquitectónicos medidos. El demo incluye geometría 3D real pero no procede de fotografías de un inmueble real.

## Canales

- B2B: inmobiliarias y administradores de alquileres; portfolio de propiedades, panel multiusuario, marca blanca, iframe, personalización, volumen, integración API, leads verificables.
- B2C: propietarios, alquiler temporal, anfitriones; pago único por proyecto con URL, exportación opcional.
- Una única base de producto multiinquilino; facturación por unidad de procesamiento + alojamiento/visualizaciones opcionales.

## SKU propuestos, sujetos a pruebas de costos y entrevistas

| Servicio | Entrada | Salida | Nivel de confianza |
| --- | --- | --- | --- |
| Panorama | Panoramas 360° proporcionados, o captura asistida | Visor esférico con puntos de navegación | Fotografía real desde puntos concretos, no modelo volumétrico |
| Casa 3D | Fotos desde múltiples ángulos, plano opcional y escala | Malla 3D, orbit/walk/top, iframe y URL | Geometría modelada; zonas ocultas identificadas como inferidas |
| Estudio+ | Lo anterior + mediciones, validación humana | Habitaciones y superficies parametrizadas; materiales, cotas y exportación si se valida | Cada dimensión con procedencia y tolerancia declarada |

Cada modalidad puede admitir personalización visual, sin confundir cambios de diseño con estado real.

### Diseño de precios para validar

- Particular: pago único por inmueble + opción de alojamiento prolongado.
- Inmobiliaria: cuota de cuenta/equipo + precio por propiedad procesada; paquetes por volumen.
- Presupuesto por complejidad (cantidad de habitaciones, superficies, fotos, nivel de detalle), no por promesa de conversión instantánea.
- **No publicar precios definitivos** sin medir coste real de GPU, QA y retrabajo por inmueble. La landing actualmente usa “Consultar / A cotizar / A medida”.

## Inspiración tecnológica y competidores

- [sael.net/interior](https://sael.net/interior/): manipulación intuitiva de materiales y luz en una maqueta 3D.
- [3dapartment](https://3dapartment.com/): exploración de propiedad y recorrido de conversión inmobiliaria.
- [Modly](https://github.com/lightningpixel/modly): orquestación local de modelos image-to-3D, útil para **assets aislados**, no resuelve por sí solo una vivienda completa.
- [OpenHouse 3D](https://github.com/yunfanye/openhouse-3d): Blender, fotografías inmobiliarias, modelado procedural y comparaciones por cámara. Requiere interpretar plano; no one-click.
- [VIGA](https://github.com/Fugtemypt123/VIGA): agente de Blender con loop render-comparación.
- [GenRecon](https://kasothaphie.github.io/GenRecon/): investigación de malla PBR interior desde imágenes multivista; investigar condiciones y derechos comerciales.

Revisar licencias del código **y** de los checkpoints de los modelos, datasets y recursos 3D antes de convertir cualquier pipeline en servicio comercial.

## Arquitectura objetivo

1. **Web pública/visor:** Cloudflare Worker sirve assets estáticos + API de metadatos públicos. Three.js usa geometría 3D y materiales; iframe aislado, interfaz móvil y URL permanente.
2. **Cuentas/tenants:** autenticación, autorización, catálogo de inmuebles, roles agencia/particular, cuotas. Aún no implementado.
3. **Intake privado:** subida directa de imágenes firmada, validación de tipo/tamaño, eliminación EXIF sensible, control de derechos, cifrado y retención de datos. Posible R2 para imágenes/GLB y D1 para metadatos. Aún no implementado.
4. **Trabajo de reconstrucción:** cola idempotente; ejecutores GPU externos en entornos controlados; resultados reintentables; capturas por ambiente, poses y mapa de fuentes. Aún no implementado.
5. **QA y edición:** alinear con fotografías, corregir continuidad de habitaciones, aperturas y mobiliario, establecer escala y registrar áreas estimadas. Intervención humana para planes de máxima fidelidad.
6. **Publicación:** optimizar glTF/GLB y texturas, subir a CDN, versionar el modelo, gestionar URL/iframe y controles de acceso.
7. **Cobro:** checkout y consumo medido; no se habilitan pagos hasta disponer de pipeline real y SLA/condiciones.

## Contrato web ya implementado (fase 0)

- GET `/`: landing para agencia y particular.
- GET `/embed/demo`: escena de ejemplo en iframe.
- GET `/tour/demo`: vista independiente compartible.
- GET `/api/v1/health`: salud y declaración de fase del producto.
- GET `/api/v1/tours/demo`: metadatos del visor, marcada claramente como demo.
- POST `/api/v1/jobs`: HTTP 501; no acepta fotos ni genera modelos todavía.
- Iframe: `postMessage({type:"CASA_TOUR_SET_VIEW",mode:"top"|"walk"|"dollhouse"|"wireframe"})`.
- Viewer: emite `CASA_TOUR_READY`, `CASA_TOUR_MODE`, `CASA_TOUR_PALETTE`.
- Navegador: selección local de JPG/PNG/WebP, thumbnails y descarga de ficha JSON. Sin transferencia de imágenes al servidor.

## Roadmap con puertas de calidad

- **0 — Visor y website:** demo geométrica reproducible, modos 3D, API read-only, integración iframe, verificación CI. En desarrollo.
- **1 — Tour real supervisado:** modelar dos viviendas reales autorizadas desde fotos y planos, revisadas por un humano; medir horas, coste y similitud cámara por cámara.
- **2 — SaaS de publicación:** cuentas B2C y B2B, almacenamiento privado, subida con autorización, cola, panel de trabajos, acceso público y facturación.
- **3 — Reconstrucción asistida IA:** comparar OpenHouse 3D/VIGA/GenRecon más biblioteca propia y Modly para objetos. Nunca declarar imágenes reconstruidas automáticamente si requirieron trabajo humano.
- **4 — Escala:** procesadores GPU aislados, caché, variantes de calidad, QA automático, volumen y soporte.

## Riesgos y mitigación

- Geometría oculta: marcar inferencia; pedir vistas y planos extra. Nunca fingir exactitud.
- Derechos de fotos: declaración de titularidad, permiso de publicación, acuerdo de tratamiento de datos, borrado.
- Desinformación inmobiliaria: materiales simulados claramente etiquetados; planos/cotas solo tras revisión.
- Seguridad: prohibir subida pública anónima sin cuota, antivirus/validación de medios, URLs firmadas, tenants separados, rate limiting.
- Costos: procesar GPU fuera del edge; no usar Workers como motor de reconstrucción 3D.
- Calidad visual: no confundir orbitado de un modelo con un panorama 360° ni una malla geométrica con un scan medido.

## Métricas para piloto

- Conversión foto→modelo publicable y % rechazado por insuficiencia de fotos.
- Horas humanas e inferencia GPU por inmueble; margen bruto real por SKU.
- Calidad: consistencia entre habitaciones, diferencia en vistas de referencia, error métrico en elementos medidos y tasa de geometría inferida.
- Negocio: agencias activas, propiedades por agencia, tasa de publicación, aperturas de iframe, consultas efectivas, cancelaciones y soporte.
