"use strict";
const audienceButtons = [...document.querySelectorAll("[data-audience]")];
const heroDescription = document.querySelector(".hero-copy > p");
const b2bHeading = document.querySelector(".b2b-bar strong");
const b2bDescription = document.querySelector(".b2b-bar p");
for (const button of audienceButtons) {
  button.addEventListener("click", () => {
    const business = button.dataset.audience === "business";
    audienceButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    heroDescription.textContent = business
      ? "Transformá la presentación de una propiedad con un modelo 3D explorable. Publicalo con un enlace o integralo en la web de tu inmobiliaria."
      : "Descubrí tu casa desde otro ángulo. Explorá un modelo tridimensional y prepará tus fotos para solicitar una reconstrucción personalizada.";
    b2bHeading.textContent = business
      ? "¿Trabajás con varias propiedades?"
      : "¿Tenés una casa que querés mostrar?";
    b2bDescription.textContent = business
      ? "Diseñamos un flujo B2B: tours con marca, publicaciones por lote y API para tu catálogo inmobiliario."
      : "Podés compartir una visita digital con familiares, compradores o personas interesadas en tu propiedad.";
  });
}
const copyButton = document.querySelector("#copy-embed");
const copyFeedback = document.querySelector("#copy-feedback");
if (copyButton) {
  copyButton.addEventListener("click", async () => {
    const src = new URL("/embed/demo", location.origin).href;
    const code = '<iframe src="' + src + '" title="Casa Tour — recorrido 3D" loading="lazy" allow="fullscreen" style="width:100%;height:600px;border:0"></iframe>';
    try {
      await navigator.clipboard.writeText(code);
      copyFeedback.textContent = "Iframe copiado";
    } catch {
      window.prompt("Copiá este iframe:", code);
      copyFeedback.textContent = "Código disponible para copiar";
    }
  });
}
const photoInput = document.querySelector("#photo-input");
const drop = document.querySelector("#upload-drop");
const result = document.querySelector("#upload-results");
const thumbs = document.querySelector("#thumbnail-list");
const download = document.querySelector("#download-brief");
const objectURLs = [];
let selectedPhotos = [];
const MAX_FILES = 36;
const MAX_BYTES = 15 * 1024 * 1024;
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
function clearPreview() {
  objectURLs.forEach(url => URL.revokeObjectURL(url));
  objectURLs.length = 0;
  thumbs.replaceChildren();
}
function setFiles(files) {
  clearPreview();
  const inputFiles = Array.from(files);
  const supported = inputFiles.filter(file => allowed.has(file.type) && file.size <= MAX_BYTES);
  selectedPhotos = supported.slice(0, MAX_FILES);
  let invalid = inputFiles.length - supported.length;
  if (supported.length > MAX_FILES) invalid += supported.length - MAX_FILES;
  selectedPhotos.slice(0, 8).forEach(file => {
    const image = document.createElement("img");
    image.alt = "Imagen de referencia seleccionada: " + file.name;
    image.loading = "lazy";
    const url = URL.createObjectURL(file);
    objectURLs.push(url);
    image.src = url;
    thumbs.appendChild(image);
  });
  result.textContent = selectedPhotos.length
    ? selectedPhotos.length + " foto(s) seleccionada(s)" + (invalid ? " · " + invalid + " excluida(s) por formato, tamaño o límite" : "") +
      (selectedPhotos.length < 3 ? " · Se recomiendan al menos 3 ángulos" : " · Lista para preparar una ficha local")
    : "No hay imágenes válidas. Usá JPG, PNG o WebP de hasta 15 MB cada una.";
  download.disabled = selectedPhotos.length === 0;
}
if (photoInput && drop) {
  photoInput.addEventListener("change", event => setFiles(event.target.files ?? []));
  for (const type of ["dragenter", "dragover"]) {
    drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add("dragover"); });
  }
  for (const type of ["dragleave", "dragend"]) {
    drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove("dragover"); });
  }
  drop.addEventListener("drop", event => {
    event.preventDefault(); drop.classList.remove("dragover"); setFiles(event.dataTransfer?.files ?? []);
  });
  download.addEventListener("click", () => {
    if (!selectedPhotos.length) return;
    const data = {
      schema: "casa-tour.intake.v1",
      status: "local-only",
      notice: "Este archivo no contiene imágenes. No se envió información a Casa Tour.",
      createdAt: new Date().toISOString(),
      photos: selectedPhotos.map(file => ({name:file.name,sizeBytes:file.size,type:file.type})),
      guidance: ["Enviar vistas de esquinas opuestas", "Adjuntar plano si existe", "Aportar una medida de referencia", "Indicar espacios no fotografiados"]
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "casa-tour-ficha.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
  window.addEventListener("pagehide", clearPreview);
}
