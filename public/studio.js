import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {summarizePlan} from "./scene-contract.js";
import {createGlb,inspectGlb} from "./glb-export.js";

// Photo bytes, property JSON and generated GLB stay in the tab.
// This tool never posts data or constructs remote model URLs.
const $ = id => document.getElementById(id);
const editor=$("plan-editor"),feedback=$("feedback"),buildButton=$("build-glb"),saveGlb=$("save-glb");
const stage=$("render-stage"),loading=$("render-loading");
const photosUrls=[],loader=new GLTFLoader();
let lastBytes=null,lastPlan=null,group=null;
let active=true,disposed=false;
const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile=window.matchMedia("(max-width:760px)").matches;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xdbe8d9);
scene.fog=new THREE.Fog(0xdbe8d9,35,80);
const camera=new THREE.PerspectiveCamera(42,1,.03,200);
camera.position.set(8,8,11);
const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:mobile?"low-power":"default"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.15:1.6));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.3;
stage.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=!reduceMotion;
controls.dampingFactor=.07;
controls.autoRotate=!reduceMotion;
controls.autoRotateSpeed=.35;
controls.minDistance=.4;
controls.maxDistance=70;
renderer.domElement.style.touchAction="pan-y";
scene.add(new THREE.HemisphereLight(0xffffff,0x839f87,3));
const light=new THREE.DirectionalLight(0xfff5e5,2.2);
light.position.set(-6,14,8);
scene.add(light);
const grid=new THREE.GridHelper(32,32,0xacc0a8,0xc8d7c6);
grid.position.y=-.17;
scene.add(grid);

function showMessage(message,isError=false){
  feedback.textContent=message;
  feedback.classList.toggle("error",isError);
}
function updateStats(result){
  $("rooms-count").textContent=result.ok?String(result.rooms):"—";
  $("walls-count").textContent=result.ok?String(result.walls):"—";
  $("openings-count").textContent=result.ok?String(result.openings):"—";
  $("area-count").textContent=result.ok?result.areaM2.toFixed(1)+" m²":"—";
  const verified=result.ok&&result.certified;
  $("provenance-title").textContent=verified?"Medidas con referencia declarada":"Medidas sin certificación";
  $("provenance-description").textContent=verified
    ?"El archivo declara una referencia de medida aportada. Casa Tour no ha verificado externamente esa fuente ni su precisión."
    :"Geometría elaborada desde un plano anotado: paredes, vanos y medidas no fueron reconstruidos ni comprobados automáticamente desde fotografías.";
}
function readPlan(){
  const parsed=JSON.parse(editor.value);
  const result=summarizePlan(parsed);
  if(!result.ok)throw new Error(result.errors.join("\n"));
  return {parsed,result};
}
function resetDownload(){
  lastBytes=null;lastPlan=null;saveGlb.disabled=true;
}
editor.addEventListener("input",()=>{
  resetDownload();
  try{const {result}=readPlan();updateStats(result);showMessage("Plano válido. Generá la malla para actualizar el visor.");}
  catch(error){updateStats({ok:false});showMessage(error.message,true);}
});
function renderSize(){
  if(disposed)return;
  const {width,height}=stage.getBoundingClientRect();
  if(!width||!height)return;
  renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();
}
new ResizeObserver(renderSize).observe(stage);
function disposeGroup(previous){
  if(!previous)return;
  const geometries=new Set(),materials=new Set();
  previous.traverse(object=>{
    if(object.isMesh){
      if(object.geometry)geometries.add(object.geometry);
      for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);
    }
  });
  scene.remove(previous);
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
}
async function previewGlb(bytes){
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  return await new Promise((resolve,reject)=>{
    loader.parse(buffer,"",gltf=>{
      const next=gltf.scene;
      disposeGroup(group);group=next;scene.add(group);
      const bounds=new THREE.Box3().setFromObject(group);
      if(bounds.isEmpty())return reject(new Error("El GLB no contiene geometría visible."));
      const center=bounds.getCenter(new THREE.Vector3());
      const radius=bounds.getSize(new THREE.Vector3()).length();
      controls.target.copy(center);
      camera.position.copy(center.clone().add(new THREE.Vector3(1.1,.85,1.3).normalize().multiplyScalar(Math.max(4,radius*1.45))));
      camera.near=.03;camera.far=Math.max(120,radius*13);camera.updateProjectionMatrix();
      controls.minDistance=Math.max(.2,radius*.07);
      controls.maxDistance=Math.max(20,radius*5);
      controls.update();
      loading.classList.add("is-ready");
      resolve();
    },reject);
  });
}
async function buildModel(){
  buildButton.disabled=true;
  try{
    const {parsed,result}=readPlan();
    const bytes=createGlb(parsed);
    await previewGlb(bytes);
    lastPlan=parsed;lastBytes=bytes;saveGlb.disabled=false;
    updateStats(result);
    showMessage("Malla GLB creada localmente: "+result.boxes+" elementos sólidos · "+(bytes.byteLength/1024).toFixed(1)+" KiB. Sin fotos incorporadas; las zonas no medidas siguen siendo inferidas.");
  }catch(error){
    resetDownload();showMessage("No se pudo generar la malla: "+error.message,true);
  }finally{buildButton.disabled=false;}
}
buildButton.addEventListener("click",buildModel);
const safeFilename=(name)=>name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"casa-tour";
function downloadBlob(blob,name){
  const objectUrl=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=objectUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();
  // Defers revocation long enough for the browser download manager to capture the bytes.
  setTimeout(()=>URL.revokeObjectURL(objectUrl),3000);
}
saveGlb.addEventListener("click",()=>{
  if(!lastBytes||!lastPlan)return;
  downloadBlob(new Blob([lastBytes],{type:"model/gltf-binary"}),safeFilename(lastPlan.title)+".glb");
});
$("save-json").addEventListener("click",()=>{
  try{
    const {parsed}=readPlan();
    downloadBlob(new Blob([JSON.stringify(parsed,null,2)+"\n"],{type:"application/json"}),safeFilename(parsed.title)+".json");
    showMessage("Plano JSON guardado en tu dispositivo. No incluye bytes de fotografía.");
  }catch(error){showMessage(error.message,true);}
});
async function loadSample(){
  const response=await fetch("/scene-sample.json",{cache:"no-store"});
  if(!response.ok)throw new Error("No se pudo cargar la planta de demostración.");
  const sample=await response.text();
  editor.value=sample;
  resetDownload();
  await buildModel();
}
$("reset-sample").addEventListener("click",()=>{
  if(editor.value.trim()&&!confirm("Esto reemplaza el plano JSON actual por el ejemplo. ¿Continuar?"))return;
  loadSample().catch(error=>showMessage(error.message,true));
});
$("plan-file").addEventListener("change",async event=>{
  const file=event.target.files?.[0];
  if(!file)return;
  if(file.size>256*1024){showMessage("El JSON supera el máximo de 256 KiB.",true);return;}
  try{
    const text=await file.text(),plan=JSON.parse(text),summary=summarizePlan(plan);
    if(!summary.ok)throw new Error(summary.errors.join("\n"));
    editor.value=JSON.stringify(plan,null,2);
    resetDownload();updateStats(summary);
    showMessage("Plano importado localmente. Revisá medidas y evidencias antes de exportar.");
  }catch(error){showMessage("No se pudo importar: "+error.message,true);}
  finally{event.target.value="";}
});
$("photo-files").addEventListener("change",async event=>{
  const files=[...(event.target.files||[])].slice(0,16);
  if(!files.length)return;
  let plan;
  try{plan=JSON.parse(editor.value);if(!Array.isArray(plan.photos))throw new Error("photos debe ser una lista.");}
  catch(error){showMessage("Primero corregí el JSON: "+error.message,true);return;}
  const allowed=new Set(["image/jpeg","image/png","image/webp"]);
  const known=new Set(plan.photos.map(x=>x.id));
  let added=0;
  for(const file of files){
    if(!allowed.has(file.type)||file.size>15*1024*1024){showMessage("Solo JPG/PNG/WebP de hasta 15 MB por imagen.",true);continue;}
    if(plan.photos.length>=120)break;
    let counter=1;while(known.has("photo_"+counter))counter++;
    const id="photo_"+counter;known.add(id);
    plan.photos.push({id,label:file.name.slice(0,80)});
    const objectUrl=URL.createObjectURL(file);photosUrls.push(objectUrl);
    const tile=document.createElement("div");tile.className="thumb";
    const img=document.createElement("img");img.src=objectUrl;img.alt="Foto de referencia "+id;img.loading="lazy";
    const span=document.createElement("span");span.textContent=id;
    tile.append(img,span);$("photo-thumbs").append(tile);added++;
  }
  editor.value=JSON.stringify(plan,null,2);
  resetDownload();
  updateStats(summarizePlan(plan));
  showMessage(added+" fotos elegidas. Solo se agregaron sus IDs/etiquetas al JSON; vinculalas a las superficies mediante evidence.photoIds. Nada fue enviado.");
  event.target.value="";
});
// Import output from an external offline reconstruction pipeline (e.g. GenRecon).
// Security: never allow an imported GLB to fetch images or binary blobs by URI.
$("model-file").addEventListener("change",async event=>{
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    if(file.size>120*1024*1024 || file.size<28)throw new Error("El GLB debe medir entre 28 bytes y 120 MiB.");
    const bytes=new Uint8Array(await file.arrayBuffer());
    const gltf=inspectGlb(bytes);
    const unsafeUris=[
      ...(gltf.buffers||[]).map(b=>b.uri).filter(Boolean),
      ...(gltf.images||[]).map(img=>img.uri).filter(Boolean)
    ].filter(uri=>typeof uri!=="string"||!uri.startsWith("data:"));
    if(unsafeUris.length)throw new Error("El GLB contiene recursos externos. Usá un GLB autocontenido para evitar conexiones no autorizadas.");
    await previewGlb(bytes);
    resetDownload();
    updateStats({ok:false});
    $("provenance-title").textContent="GLB externo · origen no verificado";
    $("provenance-description").textContent="Modelo importado de un archivo local. Casa Tour no puede confirmar su origen, escala, fidelidad respecto de fotografías ni derechos de publicación. El archivo no fue transmitido.";
    showMessage("Modelo GLB externo abierto localmente ("+(bytes.byteLength/1024/1024).toFixed(2)+" MiB, "+gltf.nodes.length+" nodos). El plano JSON del editor no ha cambiado.");
  }catch(error){showMessage("No se pudo abrir el GLB: "+error.message,true);}
  finally{event.target.value="";}
});
const clock=new THREE.Clock();
function animate(){
  if(disposed)return;
  requestAnimationFrame(animate);
  if(!active)return;
  const delta=Math.min(.05,clock.getDelta());
  controls.update(delta);
  renderer.render(scene,camera);
}
document.addEventListener("visibilitychange",()=>{active=!document.hidden;clock.getDelta();});
window.addEventListener("pagehide",()=>{
  disposed=true;
  for(const url of photosUrls)URL.revokeObjectURL(url);
  disposeGroup(group);controls.dispose();renderer.dispose();
},{once:true});
renderSize();animate();
loadSample().catch(error=>{
  loading.textContent="No se pudo iniciar el visor.";
  showMessage(error.message,true);
});
