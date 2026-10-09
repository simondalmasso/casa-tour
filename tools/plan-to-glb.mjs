#!/usr/bin/env node
// Offline only: no network, no photos uploaded, no third-party model executed.
// Usage: node tools/plan-to-glb.mjs examples/annotated-two-room.json /tmp/casa-pilot.glb
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,dirname,extname} from "node:path";
import {createGlb,inspectGlb} from "../public/glb-export.js";
import {summarizePlan} from "../public/scene-contract.js";

const [filePath,outPath]=process.argv.slice(2);
if(!filePath || !outPath || extname(outPath).toLowerCase()!==".glb"){
  console.error("Uso: node tools/plan-to-glb.mjs <plano.json> <modelo.glb>");
  process.exitCode=2;
}else try{
  const source=JSON.parse(await readFile(resolve(filePath),"utf8"));
  const summary=summarizePlan(source);
  if(!summary.ok)throw new Error(summary.errors.join("\n"));
  const bytes=createGlb(source);
  const gltf=inspectGlb(bytes);
  if(gltf.nodes.length!==summary.boxes)throw new Error("Error interno: discrepancia nodos/geometría.");
  await mkdir(dirname(resolve(outPath)),{recursive:true});
  await writeFile(resolve(outPath),bytes);
  console.log(JSON.stringify({status:"ok",file:resolve(outPath),bytes:bytes.byteLength,
    rooms:summary.rooms,areaM2:summary.areaM2,boxes:summary.boxes,
    origin:"manually-annotated-layout",certified:summary.certified,
    disclaimer:"Not an automatic reconstruction from photographs."},null,2));
}catch(error){
  console.error("Plano rechazado: "+error.message);
  process.exitCode=1;
}
