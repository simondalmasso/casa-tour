// Minimal dependency-free glTF 2.0 binary exporter for Casa Tour annotated metric box meshes.
// Produces real indexed 3D geometry (walls, apertures, rooms), not any reconstructed photo surface.
import {planToBoxes, summarizePlan} from "./scene-contract.js";

function unitCube(){
  const faces=[
    {n:[0,0,1],v:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
    {n:[0,0,-1],v:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]},
    {n:[1,0,0],v:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]},
    {n:[-1,0,0],v:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]},
    {n:[0,1,0],v:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]},
    {n:[0,-1,0],v:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]}
  ];
  const positions=[],normals=[],indices=[];
  for(let i=0;i<faces.length;i++){
    for(const point of faces[i].v){positions.push(...point);normals.push(...faces[i].n);}
    indices.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);
  }
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint16Array(indices)};
}
const align = value => (value+3)&~3;
const copyBytes = array => new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const sceneMaterials=[
  {name:"Muro / material ilustrativo",pbrMetallicRoughness:{baseColorFactor:[.82,.87,.79,1],metallicFactor:0,roughnessFactor:.92},doubleSided:false},
  {name:"Piso / material ilustrativo",pbrMetallicRoughness:{baseColorFactor:[.74,.67,.56,1],metallicFactor:0,roughnessFactor:.85},doubleSided:false}
];

export function createGlb(plan){
  const summary=summarizePlan(plan);
  if(!summary.ok)throw new Error(summary.errors.join("\n"));
  const boxes=planToBoxes(plan);
  const cube=unitCube();
  const parts=[copyBytes(cube.positions),copyBytes(cube.normals),copyBytes(cube.indices)];
  const views=[];let binaryLength=0;
  for(let i=0;i<parts.length;i++){
    binaryLength=align(binaryLength);
    views.push({buffer:0,byteOffset:binaryLength,byteLength:parts[i].byteLength,
      target:i===2?34963:34962});
    binaryLength+=parts[i].byteLength;
  }
  binaryLength=align(binaryLength);
  const binary=new Uint8Array(binaryLength);
  for(let i=0;i<parts.length;i++)binary.set(parts[i],views[i].byteOffset);
  const nodes=boxes.map(box=>({
    name:box.name+" ["+box.id+"]",mesh:box.kind==="floor"?1:0,
    translation:box.center,scale:box.size,
    extras:{id:box.id,kind:box.kind,sourceStatus:box.evidence.status,
      sourcePhotoIds:box.evidence.photoIds,openingId:box.openingId||null}
  }));
  const meshes=sceneMaterials.map((mat,index)=>({
    name:index===0?"Muro sólido":"Piso sólido",
    primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2,material:index,mode:4}]
  }));
  const data={
    asset:{version:"2.0",generator:"Casa Tour assisted-layout compiler 1.0"},
    scene:0,scenes:[{name:plan.title,nodes:nodes.map((_,i)=>i),
      extras:{schemaVersion:1,units:"m",origin:"manually-annotated-layout",
        metricEvidenceVerified:summary.certified,measurementReference:summary.certified?plan.capture.measurementReference:null,
        photosAreEmbedded:false,photoCount:plan.photos.length,provenance:summary.statuses,
        disclaimer:"This mesh is derived from an annotated plan, NOT reconstructed automatically from images."}}],
    nodes,meshes,materials:sceneMaterials,
    buffers:[{byteLength:binaryLength}],
    bufferViews:views,
    accessors:[
      {bufferView:0,componentType:5126,count:24,type:"VEC3",min:[-.5,-.5,-.5],max:[.5,.5,.5]},
      {bufferView:1,componentType:5126,count:24,type:"VEC3"},
      {bufferView:2,componentType:5123,count:36,type:"SCALAR",min:[0],max:[23]}
    ]
  };
  const encoder=new TextEncoder();
  const json=encoder.encode(JSON.stringify(data));
  const jsonLength=align(json.byteLength);
  const total=12+8+jsonLength+8+binaryLength;
  const output=new Uint8Array(total);
  const view=new DataView(output.buffer);
  view.setUint32(0,0x46546c67,true);
  view.setUint32(4,2,true);
  view.setUint32(8,total,true);
  view.setUint32(12,jsonLength,true);
  view.setUint32(16,0x4e4f534a,true);
  output.fill(0x20,20,20+jsonLength);
  output.set(json,20);
  const at=20+jsonLength;
  view.setUint32(at,binaryLength,true);
  view.setUint32(at+4,0x004e4942,true);
  output.set(binary,at+8);
  return output;
}

export function inspectGlb(bytes){
  if(!(bytes instanceof Uint8Array))throw new Error("GLB debe ser Uint8Array.");
  if(bytes.byteLength<28)throw new Error("Archivo GLB demasiado corto.");
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.byteLength)
    throw new Error("GLB header/version/length inválidos.");
  const jsonLength=v.getUint32(12,true),at=20+jsonLength;
  if(v.getUint32(16,true)!==0x4e4f534a||jsonLength<2||at+8>bytes.byteLength)
    throw new Error("GLB JSON chunk inválido.");
  if(v.getUint32(at+4,true)!==0x004e4942||at+8+v.getUint32(at,true)!==bytes.byteLength)
    throw new Error("GLB BIN chunk inválido.");
  const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength)).trim());
  if(json.asset?.version!=="2.0"||!Array.isArray(json.nodes)||!Array.isArray(json.meshes))
    throw new Error("GLB sin estructura glTF 2.0.");
  return json;
}
