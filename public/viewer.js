import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.getElementById("canvas");
const status = document.getElementById("view-status");
const hint = document.getElementById("view-hint");
const error = document.getElementById("render-error");
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.2;
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce7d9);
scene.fog = new THREE.Fog(0xdce7d9,23,49);
const camera = new THREE.PerspectiveCamera(42,1,0.06,90);
camera.position.set(11.5,11,14);
const controls = new OrbitControls(camera,renderer.domElement);
controls.target.set(0,0.6,0);
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.minDistance=2;
controls.maxDistance=30;
controls.maxPolarAngle=Math.PI*.49;
controls.autoRotate=true;
controls.autoRotateSpeed=.38;
controls.update();
const keyLight=new THREE.DirectionalLight(0xffedcf,3);
keyLight.position.set(-6,14,8);
keyLight.castShadow=true;
keyLight.shadow.mapSize.set(2048,2048);
keyLight.shadow.camera.left=-16; keyLight.shadow.camera.right=16;
keyLight.shadow.camera.top=16; keyLight.shadow.camera.bottom=-16;
keyLight.shadow.bias=-.00015;
scene.add(keyLight);
scene.add(new THREE.HemisphereLight(0xe8f6ff,0x898776,2));
const ambient = new THREE.AmbientLight(0xffffff,.2);
scene.add(ambient);
const model = new THREE.Group();
scene.add(model);
const materials = {
  wall:new THREE.MeshStandardMaterial({color:0xe9e9db,roughness:.91}),
  trim:new THREE.MeshStandardMaterial({color:0xfaf8ed,roughness:.75}),
  wood:new THREE.MeshStandardMaterial({color:0xbfa98f,roughness:.86}),
  floor:new THREE.MeshStandardMaterial({color:0xd6c9b2,roughness:.92}),
  kitchen:new THREE.MeshStandardMaterial({color:0xb8c7b6,roughness:.82}),
  stone:new THREE.MeshStandardMaterial({color:0xe9e7df,roughness:.65}),
  sofa:new THREE.MeshStandardMaterial({color:0x718b79,roughness:1}),
  white:new THREE.MeshStandardMaterial({color:0xfbf8ef,roughness:1}),
  dark:new THREE.MeshStandardMaterial({color:0x39483d,roughness:.6}),
  linen:new THREE.MeshStandardMaterial({color:0xe6e0d5,roughness:1}),
  rug:new THREE.MeshStandardMaterial({color:0xb1bdad,roughness:1}),
  metal:new THREE.MeshStandardMaterial({color:0x7c8c7f,metalness:.45,roughness:.35}),
  plant:new THREE.MeshStandardMaterial({color:0x50724d,roughness:.95}),
  glass:new THREE.MeshPhysicalMaterial({color:0xc9f0dc,transparent:true,opacity:.42,roughness:.1,metalness:0,depthWrite:false}),
  ground:new THREE.MeshStandardMaterial({color:0xe2e9db,roughness:1})
};
const meshes=[];
const hiddenWalls=[];
function add(geometry,material,x,y,z,options={}){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  mesh.castShadow=options.cast!==false;
  mesh.receiveShadow=true;
  if(options.name)mesh.name=options.name;
  model.add(mesh); meshes.push(mesh);
  return mesh;
}
function box(w,h,d,m,x,y,z,name){
  return add(new THREE.BoxGeometry(w,h,d),m,x,y,z,{name});
}
function cyl(radius,height,m,x,y,z){
  return add(new THREE.CylinderGeometry(radius,radius,height,24),m,x,y,z);
}
function sphere(radius,m,x,y,z){
  return add(new THREE.SphereGeometry(radius,12,10),m,x,y,z);
}
const ground=add(new THREE.BoxGeometry(15,.28,11),materials.ground,0,-.34,0,{cast:false,name:"base"});
box(11.65,.15,7.45,materials.floor,0,-.13,0,"piso-general");
box(6.35,.018,7.15,materials.wood,-2.6,-.043,0,"piso-estar");
box(5.0,.018,3.65,materials.linen,3.18,-.043,-1.85,"piso-dormitorio");
box(5.0,.018,3.4,materials.stone,3.18,-.043,1.85,"piso-cocina");
for(let i=0;i<16;i++){
  const x=-5.48+i*.38;
  if(x>.49)break;
  box(.014,.009,7.1,materials.floor,x,-.026,0,"junta-piso");
}
function wallX(x1,x2,z,mat=materials.wall,h=3.05){
  return box(Math.abs(x2-x1),h,.16,mat,(x1+x2)/2,h/2,z,"muro");
}
function wallZ(z1,z2,x,mat=materials.wall,h=3.05){
  return box(.16,h,Math.abs(z2-z1),mat,x,h/2,(z1+z2)/2,"muro");
}
wallZ(-3.7,3.7,-5.8);wallZ(-3.7,3.7,5.8);
wallX(-5.8,-3.65,-3.7);wallX(-2.12,.9,-3.7);wallX(2.52,5.8,-3.7);
for(const [x1,x2] of [[-3.65,-2.12],[.9,2.52]]){
  box(x2-x1,.65,.17,materials.wall,(x1+x2)/2,2.72,-3.7,"dintel-ventana");
  box(x2-x1,.68,.17,materials.wall,(x1+x2)/2,.34,-3.7,"antepecho-ventana");
  box(x2-x1,1.7,.045,materials.glass,(x1+x2)/2,1.55,-3.7,"cristal");
  box(.06,1.7,.085,materials.trim,(x1+x2)/2,1.55,-3.7,"marco-ventana");
  box(x2-x1,.06,.086,materials.trim,(x1+x2)/2,2.4,-3.7,"marco-ventana");
}
wallZ(-3.7,-1.1,.61); wallZ(.19,3.7,.61);
box(.12,.62,1.3,materials.wall,.61,2.75,-.45,"dintel-puerta");
wallX(.61,2.45,.32); wallX(3.43,5.8,.32);
box(.98,.6,.13,materials.wall,2.94,2.75,.32,"dintel-puerta");
const frontLeft=wallX(-5.8,-1.5,3.7);
const frontRight=wallX(-.42,5.8,3.7);
hiddenWalls.push(frontLeft,frontRight);
// Molduras estructurales y zócalos.
for(const z of [-3.53,3.53]){
  box(11.3,.11,.06,materials.trim,0,.09,z,"zócalo");
}
for(const x of [-5.65,5.65]){
  box(.05,.11,7.05,materials.trim,x,.09,0,"zócalo");
}
// Estar: sofá modular, alfombra, mesa y biblioteca.
box(3.6,.034,2.25,materials.rug,-2.6,.017,1.25,"alfombra-estar");
box(2.65,.39,.88,materials.sofa,-3.5,.38,-.83,"sofa-asiento");
box(2.65,.55,.27,materials.sofa,-3.5,.75,-1.28,"sofa-respaldo");
for(const x of [-4.52,-3.67,-2.83])box(.75,.16,.67,materials.linen,x,.65,-.84,"sofa-almohadón");
box(.22,.66,.92,materials.sofa,-4.78,.6,-.83,"sofa-brazo");
box(.22,.66,.92,materials.sofa,-2.22,.6,-.83,"sofa-brazo");
box(1.35,.12,.69,materials.wood,-2.75,.44,1.18,"mesa-centro");
for(const x of [-3.28,-2.24])for(const z of [.92,1.48])cyl(.05,.75,materials.dark,x,.0+0.06,z);
box(.36,1.45,2.52,materials.wood,-5.27,.73,-.1,"estantería");
for(const z of [-1.1,-.45,.2,.85])box(.44,.07,.45,materials.linen,-5.25,.2+(.18*(z+1.1)),z,"estante");
box(.96,.06,.82,materials.wood,-.47,.77,1.45,"escritorio");
for(const x of [-.85,-.1])box(.055,.7,.65,materials.dark,x,.37,1.47,"pata-escritorio");
box(.7,.32,.7,materials.white,-.6,.45,2.66,"silla");
box(.7,.68,.13,materials.white,-.6,.83,2.94,"respaldo-silla");
// Dormitorio: cama, cabecera, cómoda, lámparas.
box(2.42,.37,2.85,materials.wood,3.5,.25,-1.82,"base-cama");
box(2.32,.28,2.72,materials.white,3.5,.55,-1.82,"colchón");
box(2.27,.075,1.5,materials.linen,3.5,.75,-1.1,"manta");
for(const x of [2.92,4.08])box(.92,.11,.47,materials.white,x,.78,-2.87,"almohada");
box(2.48,1.3,.17,materials.wood,3.5,.65,-3.37,"cabecera");
box(.48,.55,.48,materials.wood,1.63,.28,-3.02,"mesa-luz");
box(.37,.035,.37,materials.stone,1.63,.58,-3.02,"mesa-luz-tapa");
cyl(.1,.37,materials.white,1.63,.82,-3.02);
box(.8,.7,1.5,materials.kitchen,5.14,.36,-.94,"cómoda");
// Cocina-comedor: mesada y alacenas tridimensionales.
box(4.6,.86,.62,materials.kitchen,3.22,.41,3.04,"bajo-mesada");
box(4.75,.085,.78,materials.stone,3.22,.88,3.04,"mesada");
for(const x of [1.9,2.74,3.58,4.42]){
  box(.027,.68,.65,materials.trim,x,.42,3.05,"junta-frente");
}
box(1.24,.08,.62,materials.dark,4.2,.93,3.04,"anafe");
for(const x of [3.86,4.42])for(const z of [2.85,3.24])cyl(.11,.012,materials.metal,x,.98,z);
box(2.25,.12,1.18,materials.wood,3.13,.73,1.5,"mesa-comedor");
for(const x of [2.19,4.06])for(const z of [1.02,1.98])box(.07,.72,.07,materials.dark,x,.35,z,"pata-mesa-comedor");
for(const x of [2.1,4.17]){
  box(.48,.13,.48,materials.linen,x,.46,1.51,"asiento");
  box(.51,.75,.1,materials.wood,x,.82,1.95,"respaldo");
}
// Macetas y objetos independientes como mallas.
for(const [x,z,s] of [[-4.82,2.85,1],[.0,-2.8,.85],[5.05,2.3,.73]]){
  cyl(.25*s,.39*s,materials.stone,x,.2*s,z);
  const stem=cyl(.055*s,.47*s,materials.dark,x,.6*s,z);
  stem.castShadow=false;
  for(let a=0;a<6;a++){
    const angle=a*Math.PI/3;
    const leaf=sphere(.22*s,materials.plant,x+Math.sin(angle)*.18*s,.84*s+(a%2)*.19*s,z+Math.cos(angle)*.18*s);
    leaf.scale.set(.65,1.5,.7);
  }
}
const sceneMaterials=Object.values(materials);
function setPalette(name){
  const options={
    natural:{wall:0xe9e9db,wood:0xbfa98f,floor:0xd6c9b2,kitchen:0xb8c7b6,sofa:0x718b79,rug:0xb1bdad},
    forest:{wall:0xd2decf,wood:0x9b8d72,floor:0xb4c4a7,kitchen:0x7a9b81,sofa:0x4f7861,rug:0x9fae97},
    bright:{wall:0xf7f6ed,wood:0xd9c2a6,floor:0xe8ddc7,kitchen:0xe5dfcf,sofa:0xb6c1ad,rug:0xd5d7c5}
  };
  const palette=options[name];if(!palette)return;
  Object.keys(palette).forEach(key=>materials[key].color.setHex(palette[key]));
  document.querySelectorAll("[data-palette]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.palette===name)));
  notifyParent("CASA_TOUR_PALETTE",{palette:name});
}
document.querySelectorAll("[data-palette]").forEach(button=>button.addEventListener("click",()=>setPalette(button.dataset.palette)));
function daylight(hour){
  const daylightAmount=Math.max(.12,Math.sin((hour-6)/16*Math.PI));
  const angle=(hour-7)/14*Math.PI;
  keyLight.position.set(12*Math.cos(angle),4+12*daylightAmount,6*Math.sin(angle));
  keyLight.intensity=.42+daylightAmount*2.7;
  keyLight.color.set(hour>17?0xffcd9b:0xffedcf);
  renderer.toneMappingExposure=.62+daylightAmount*.58;
  document.getElementById("clock").textContent=String(hour).padStart(2,"0")+":00";
}
document.getElementById("daylight").addEventListener("input",e=>daylight(Number(e.target.value)));
daylight(14);
let mode="dollhouse", lastMode="dollhouse";
function setView(next){
  if(!["dollhouse","top","walk","wireframe"].includes(next))return;
  if(next==="wireframe"){
    const on=mode!=="wireframe";
    sceneMaterials.forEach(mat=>mat.wireframe=on);
    mode=on?"wireframe":lastMode;
    status.textContent=on?"GEOMETRÍA TRIANGULADA / MODO MALLA":"MODELO GEOMÉTRICO DEMO · SIN MEDIDAS CERTIFICADAS";
    document.querySelectorAll("[data-mode]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.mode===mode)));
    return;
  }
  sceneMaterials.forEach(mat=>mat.wireframe=false);
  mode=next;lastMode=next;
  hiddenWalls.forEach(mesh=>mesh.visible=mode==="top");
  controls.autoRotate=false;
  controls.maxPolarAngle=mode==="top"?.19:Math.PI*.49;
  controls.minPolarAngle=mode==="top"?.015:.015;
  controls.minDistance=mode==="walk"?.2:2;
  controls.maxDistance=mode==="walk"?10:30;
  if(mode==="top"){
    camera.position.set(0,17,.3);controls.target.set(0,0,0);
    hint.textContent="Vista superior · arrastrá para desplazar y usá la rueda";
  }else if(mode==="walk"){
    camera.position.set(-2.6,1.64,2.7);controls.target.set(-2.6,1.55,-2.0);
    hint.textContent="W A S D para moverte · arrastrá para mirar";
  }else{
    camera.position.set(11.5,11,14);controls.target.set(0,.6,0);
    hint.textContent="Arrastrá para girar · rueda para acercar";
  }
  controls.update();
  status.textContent="MODELO GEOMÉTRICO DEMO · SIN MEDIDAS CERTIFICADAS";
  document.querySelectorAll("[data-mode]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.mode===mode)));
  notifyParent("CASA_TOUR_MODE",{mode});
}
document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>setView(button.dataset.mode)));
renderer.domElement.addEventListener("pointerdown",()=>{controls.autoRotate=false;});
function notifyParent(type,detail){
  if(window.parent!==window)window.parent.postMessage({type,tourId:"demo",...detail},"*");
}
window.addEventListener("message",event=>{
  if(event.source!==window.parent || !event.data || event.data.type!=="CASA_TOUR_SET_VIEW")return;
  setView(event.data.mode);
});
document.getElementById("share").addEventListener("click",async()=>{
  const shareURL=new URL("/tour/demo",location.origin).href;
  try{await navigator.clipboard.writeText(shareURL);document.getElementById("share").textContent="Enlace copiado ✓";}
  catch{window.prompt("Compartí esta URL:",shareURL);}
});
const pressed=new Set();
window.addEventListener("keydown",e=>{if(!e.target.matches("input,button"))pressed.add(e.key.toLowerCase());});
window.addEventListener("keyup",e=>pressed.delete(e.key.toLowerCase()));
window.addEventListener("blur",()=>pressed.clear());
let previousTime=0;
function animate(time){
  if(!container.isConnected)return;
  requestAnimationFrame(animate);
  const delta=Math.min((time-previousTime)/1000||0,.05);previousTime=time;
  if(mode==="walk"){
    const forward=new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y=0;forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const movement=new THREE.Vector3();
    if(pressed.has("w")||pressed.has("arrowup"))movement.add(forward);
    if(pressed.has("s")||pressed.has("arrowdown"))movement.sub(forward);
    if(pressed.has("a")||pressed.has("arrowleft"))movement.sub(right);
    if(pressed.has("d")||pressed.has("arrowright"))movement.add(right);
    if(movement.lengthSq()>0){
      movement.normalize().multiplyScalar(delta*2.3);
      const nx=THREE.MathUtils.clamp(camera.position.x+movement.x,-5.4,5.4);
      const nz=THREE.MathUtils.clamp(camera.position.z+movement.z,-3.36,3.36);
      const offset=new THREE.Vector3(nx-camera.position.x,0,nz-camera.position.z);
      camera.position.add(offset);controls.target.add(offset);
    }
  }
  controls.update();
  renderer.render(scene,camera);
}
function resize(){
  const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
  camera.aspect=width/height;camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
}
new ResizeObserver(resize).observe(container);resize();
setView("dollhouse");controls.autoRotate=true;
requestAnimationFrame(animate);
renderer.domElement.addEventListener("webglcontextlost",event=>{
  event.preventDefault();error.style.display="flex";error.firstElementChild.textContent="Se perdió el contexto WebGL.";
});
notifyParent("CASA_TOUR_READY",{status:"demo",representation:"semantic-3d-mesh",photoReconstructed:false});
