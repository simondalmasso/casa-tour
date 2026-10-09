# Casa Tour · ruta de reconstrucción real (investigación y producto)

Actualización: 2026-10-09. Esta documentación distingue código probado, infraestructura no disponible y motores externos sujetos a licencias.

## Estado comprobado de cada etapa

| Etapa | Estado | Evidencia / limitación |
| --- | --- | --- |
| Landing móvil, URL e iframe con Three.js | Publicado y validado | QA de producción en GitHub Actions |
| Planta anotada a malla 3D semántica GLB | **Publicado en `/studio` y verificado en producción** | [Release/QA](https://github.com/simondalmasso/casa-tour/actions/runs/37995092708); `scene-contract.js`, `glb-export.js`; JSON/GLB y procedencia |
| Vinculación local de fotos de referencia | Implementada en Studio | Se importan imágenes en memoria, se guardan solo etiquetas/IDs; **no hay extracción de geometría** |
| Inspección de GLB externo | Implementada en Studio | GLTFLoader local; bloquea referencias externas de imágenes/buffers; no certifica escala |
| Calibración automática de cámaras para fotos | Pendiente | COLMAP/MASt3R/poses, instalación y validación con fotografías autorizadas |
| Reconstrucción generativa a partir de fotos | **Solo evaluación offline** | GenRecon: GPU CUDA, checkpoint, poses, licencias NVIDIA no comerciales |
| Comparación cámara → render / correcciones | Pendiente | QA humana + puntuación métrica y topológica |
| Publicación de inmuebles B2B/B2C | Pendiente | Auth, R2 privado, tenancy, colas, pricing y borrado |

## Estudio 3D: qué hace exactamente

Abrir `/studio`. El editor lee un contrato JSON con `rooms` (rectángulos en metros X/Z), `walls` ortogonales, `openings` de puertas/ventanas y `evidence` por elemento. Compila un `.glb` autocontenido con GLTF 2.0: vértices, normales, triángulos, mallas separadas para pisos/paredes, transformaciones, materiales simples y `extras` de procedencia.

El hueco de una ventana es geometría ausente entre antepecho y dintel; una puerta elimina la cara de la pared por debajo de su altura. El sistema rechaza áreas de habitaciones superpuestas, muros oblicuos, huecos superpuestos/fuera de límite, números infinitos, foto IDs inexistentes y afirmaciones `measured` sin declarar referencia métrica. No valida la precisión de esa referencia externamente.

Los archivos fotográficos no se cargan al servidor; el navegador solo registra sus IDs y etiquetas. `photo-supported` significa **que un operador declaró esa referencia**, no que la IA comparó imagen y pared. Las propiedades ausentes, muebles, materiales y espacios ocultos **no** se infieren desde imágenes en esta etapa.

Prueba reproducible sin GPU:

```bash
npm run validate
node tools/plan-to-glb.mjs examples/annotated-two-room.json /tmp/casa-tour-pilot.glb
# Abrir Studio → Ver GLB externo → elegir /tmp/casa-tour-pilot.glb
```

El mismo comando en Windows PowerShell puede usar una ruta absoluta de salida terminada en `.glb`.

## Candidatos tecnológicos y derechos

| Proyecto | Licencia propia conocida | Lo que resuelve | Riesgo / decisión |
| --- | --- | --- | --- |
| [OpenHouse 3D](https://github.com/yunfanye/openhouse-3d) | Código MIT | Helpers `bpy` para arquitectura, ajuste de cámara, recorrido | La propia documentación aclara que requiere interpretar fotos/plano y programar la casa. Fotos inmobiliarias de terceros conservan copyright. Candidato a flujo supervisado |
| [VIGA](https://github.com/Fugtemypt123/VIGA) | Código MIT | Bucle agente Blender programa → renderiza → verifica | Depende de modelos/APIs, SAM, Infinigen y eventualmente servicios comerciales. Revisar cada peso, licencia, coste y salida. Solo investigación |
| [Modly](https://github.com/lightningpixel/modly) | Código MIT | Objetos 3D aislados desde una imagen, importación/exportación | No crea un inmueble multiambiente. Los modelos/extensiones son componentes con permisos separados; respetar la atribución |
| [GenRecon](https://github.com/kasothaphie/GenRecon) | Código y checkpoints anunciados como MIT | RGB multivista + cámara estimada + nube escasa → geometría de escena con texturas PBR y GLB | Requiere CUDA, COLMAP y dependencias NVIDIA con restricciones no comerciales. **No integrar en el SaaS comercial con la distribución actual** |

**Bloqueo legal confirmado:** el archivo [`nvdiffrast/LICENSE.txt`](https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt), sección 3.3, limita el uso a investigación o evaluación sin ganancia monetaria salvo NVIDIA o sus afiliadas. [nvdiffrec](https://github.com/NVlabs/nvdiffrec) usa también Nvidia Source Code License. Aunque el código del proyecto superior tenga MIT, **MIT no anula los términos de dependencias**. Un uso comercial podría requerir contratos/licencias diferentes, revisión jurídica e inventario de versiones. La salida no debe asumirse licenciada comercialmente solo porque el script corrió. No se ha obtenido ninguna autorización comercial.

Referencias del proyecto GenRecon: [repositorio](https://github.com/kasothaphie/GenRecon), [README de inferencia](https://github.com/kasothaphie/GenRecon#-inference), [nvdiffrast](https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt), [TRELLIS.2](https://github.com/microsoft/TRELLIS.2).

## GenRecon: adapter de investigación offline

`tools/genrecon-bridge.py` es un adaptador local **solo para investigación**, sin GPU propia ni credenciales. No instala software, no clona repositorios ni descarga checkpoints. Sus comprobaciones requieren:

- Checkout local auditado de GenRecon, en versión concreta.
- Capturas locales con `rgb/` y al menos 8 imágenes, más `colmap/cameras.txt`, `images.txt`, `points3D.txt` generados mediante SfM.
- Checkpoints `sparse_structure.pt`, `shape_slat.pt`, `texture_slat.pt` provistos manualmente.
- Directorio de salida separado de la captura y del checkout.

Solo preflight, sin escribir ni ejecutar modelos:

```bash
python3 tools/genrecon-bridge.py \
  --repo /ruta/GenRecon --capture /ruta/captura-autorizada \
  --output /ruta/resultados \
  --ss-ckpt /ruta/checkpoints/sparse_structure.pt \
  --shape-ckpt /ruta/checkpoints/shape_slat.pt \
  --tex-ckpt /ruta/checkpoints/texture_slat.pt
```

Para una **evaluación no comercial** en un host CUDA confiable, y solo cuando el operador confirmó derechos de fotos y revisión legal, añadir `--execute --rights-confirmed --dependencies-reviewed`. El modo `--purpose commercial --execute` **siempre falla** por el bloqueo de licencia anterior. No proveer claves API ni conectarlo con solicitudes públicas sin cuotas.

El adapter corre `reconstruct_scene.py --mode Iphone`, valida `to_glb_inputs.pt` y `chunk_inputs.pt`, luego convierte con `chunked_to_glb.py`. Si termina, verifica la estructura del GLB y escribe `casa-tour-provenance.json` con estado `generated_unreviewed`, SHA-256 y `publishable:false`. **Los tests CI solo usan scripts falsos de prueba; no prueban la calidad ni el consumo GPU real de GenRecon.**

## Próximo piloto de reconstrucción real

La validación real empieza con **dos inmuebles con autorización escrita**: fotografías desde posiciones distintas y al menos una dimensión comprobada por ambiente, preferentemente plano. Comparar malla y foto con cámaras resueltas, medir consistencia de distribución y conexiones, errores en cotas y huecos, y porcentaje inferido. Usar inferencia GPU solo en entornos autorizados para investigación, o evaluar un pipeline de producción con todas las licencias comerciales claras.

Las métricas deben incluir coste GPU, tiempo de especialista, ratio de reconstrucciones fallidas y correcciones. No publicar "reconstrucción automática en segundos" ni activar cobros hasta que el piloto pruebe calidad y derechos.

## Seguridad y despliegue

- Ninguna captura se transmite desde Studio; el GLB externo solo se abre si está autocontenido, no puede inyectar URLs de buffers o texturas.
- Validación del JSON acotada a elementos finitos, límites de foto, geometría y evidencia.
- Los modelos grandes pueden agotar GPU/memoria en móviles: importar con cautela, especialmente en dispositivos con poca memoria.
- La UI pública se aloja en Cloudflare Workers; **el cálculo GPU no se ejecuta en Workers**.
- El flujo está sujeto a pruebas Playwright (GLB real + móvil) y a publicación manual protegida por rollback. Ver [DEPLOYMENT.md](DEPLOYMENT.md).
