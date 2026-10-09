import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {validatePlan,planToBoxes,summarizePlan} from "../public/scene-contract.js";
import {createGlb,inspectGlb} from "../public/glb-export.js";

const example=JSON.parse(readFileSync(new URL("../examples/annotated-two-room.json",import.meta.url),"utf8"));
const clone=()=>structuredClone(example);
const problems=plan=>validatePlan(plan).errors.join(" | ");

test("two-room annotated example is valid, explicitly unverified and reproducible",()=>{
  const result=summarizePlan(example);
  assert.equal(result.ok,true);
  assert.equal(result.rooms,2);assert.equal(result.walls,5);assert.equal(result.openings,3);
  assert.equal(result.areaM2,26.52);assert.equal(result.certified,false);
  assert.ok(result.boxes>result.walls);
  assert.equal(JSON.stringify(example),JSON.stringify(JSON.parse(readFileSync(new URL("../public/scene-sample.json",import.meta.url),"utf8"))));
});

test("GLB writer emits valid binary header, positions/normals and semantic provenance nodes",()=>{
  const bytes=createGlb(example);
  assert.ok(bytes.byteLength>1800);
  const gltf=inspectGlb(bytes);
  assert.equal(gltf.asset.version,"2.0");
  assert.equal(gltf.buffers.length,1);
  assert.equal(gltf.bufferViews.length,3);
  assert.equal(gltf.accessors[0].count,24);
  assert.equal(gltf.accessors[2].count,36);
  assert.equal(gltf.scenes[0].extras.origin,"manually-annotated-layout");
  assert.equal(gltf.scenes[0].extras.photosAreEmbedded,false);
  assert.equal(gltf.scenes[0].extras.metricEvidenceVerified,false);
  assert.equal(gltf.nodes.length,planToBoxes(example).length);
  assert.ok(gltf.nodes.every(node=>node.extras.sourceStatus==="inferred"));
  assert.ok(gltf.nodes.some(node=>node.extras.openingId==="ventana_norte"));
  assert.ok(gltf.nodes.some(node=>node.extras.openingId==="entrada"));
});

test("actual openings remove solid wall inside door/window intervals",()=>{
  const boxes=planToBoxes(example);
  const middle=boxes.filter(b=>b.id.startsWith("interior-piece-"));
  const insideDoor=middle.filter(b=>Math.abs(b.center[0]-4.6)<1e-6 &&
    b.center[2]>1.2 && b.center[2]<1.2+.87);
  assert.ok(insideDoor.every(b=>b.center[1]>=2.13),"Door must have a true empty lower opening");
  const north=boxes.filter(b=>b.id.startsWith("norte-piece-"));
  const insideWindow=north.filter(b=>b.center[0]>1.4 && b.center[0]<3.2);
  assert.ok(insideWindow.some(b=>b.center[1]<.92),"window sill exists");
  assert.ok(insideWindow.some(b=>b.center[1]>2.25),"window lintel exists");
  assert.ok(insideWindow.every(b=>b.center[1]<.92 || b.center[1]>2.25),"window void remains empty");
});

test("rooms, wall geometry and opening limits reject invalid topology",()=>{
  const overlap=clone();overlap.rooms[1].bounds[0]=4;
  assert.match(problems(overlap),/se superponen/);
  const diagonal=clone();diagonal.walls[0].to[1]=.4;
  assert.match(problems(diagonal),/ortogonales/);
  const duplicate=clone();duplicate.walls[1].id="norte";
  assert.match(problems(duplicate),/duplicado/);
  const opening=clone();opening.walls[0].openings[0].width=7;
  assert.match(problems(opening),/límites/);
  const another=clone();another.walls[0].openings.push({...another.walls[0].openings[0],id:"solapada"});
  assert.match(problems(another),/superpuestas/);
});
test("no unverified geometry may claim measured; photo claims require actual photo references",()=>{
  const metric=clone();metric.rooms[0].evidence.status="measured";
  assert.match(problems(metric),/no se puede afirmar una medición/);
  metric.capture.metricEvidenceVerified=true;
  assert.match(problems(metric),/measurementReference/);
  metric.capture.measurementReference="Measured 3.41 m room reference with signed on-site inspection";
  assert.equal(validatePlan(metric).ok,true);
  const photos=clone();photos.rooms[0].evidence.status="photo-supported";
  assert.match(problems(photos),/requiere al menos una foto/);
  photos.rooms[0].evidence.photoIds=["not-existing"];
  assert.match(problems(photos),/desconocida/);
  photos.photos.push({id:"photo_1",label:"Estar frontal"});
  photos.rooms[0].evidence.photoIds=["photo_1"];
  assert.equal(validatePlan(photos).ok,true);
  assert.ok(inspectGlb(createGlb(photos)).nodes.some(n=>n.extras.sourcePhotoIds.includes("photo_1")));
});
test("generator rejects malformed GLB headers and bad input plans",()=>{
  const bytes=createGlb(example);
  const corrupt=bytes.slice();corrupt[0]=0;
  assert.throws(()=>inspectGlb(corrupt),/header/);
  const bad=clone();delete bad.rooms[0].evidence;
  assert.equal(validatePlan(bad).ok,false);
  assert.throws(()=>createGlb(bad));
});
test("studio uses local model generation rather than untrusted remote reconstruction claims",()=>{
  const html=readFileSync(new URL("../public/studio.html",import.meta.url),"utf8");
  const studio=readFileSync(new URL("../public/studio.js",import.meta.url),"utf8");
  assert.match(html,/src="\/studio.js"/);
  assert.match(html,/id="render-stage"/);
  assert.match(html,/id="plan-editor"/);
  assert.match(html,/no extrae la geometría automáticamente/);
  assert.match(studio,/createGlb\(parsed\)/);
  assert.match(studio,/loader.parse\(/);
  assert.match(studio,/URL.createObjectURL/);
  assert.doesNotMatch(studio,/fetch\(.*https:|XMLHttpRequest|navigator\.sendBeacon/i);
});

test("offline CLI writes a valid GLB that preserves semantic names without network",()=>{
  const folder=mkdtempSync(join(tmpdir(),"casa-tour-glb-"));
  try{
    const output=join(folder,"render.glb");
    const command=spawnSync(process.execPath,[
      new URL("../tools/plan-to-glb.mjs",import.meta.url).pathname,
      new URL("../examples/annotated-two-room.json",import.meta.url).pathname,
      output
    ],{encoding:"utf8"});
    assert.equal(command.status,0,command.stderr);
    const exported=inspectGlb(new Uint8Array(readFileSync(output)));
    assert.ok(exported.nodes.find(x=>x.name.includes("norte")));
    assert.ok(exported.nodes.find(x=>x.name.includes("Dormitorio")));
  }finally{rmSync(folder,{recursive:true,force:true});}
});
