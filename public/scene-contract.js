// Casa Tour spatial contract v1 — metric room/wall annotation, NOT photogrammetry.
// All coordinates are meters in an X/Z ground plane with Y up.
const statuses = new Set(["inferred", "photo-supported", "measured"]);
const allowedOpeningKinds = new Set(["door", "window"]);
const maxElements = 160;
const finite = (n,min,max) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const code = (v) => typeof v === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/.test(v);
const round = n => Math.round(n * 1e5) / 1e5;

export function validatePlan(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return {ok:false,errors:["El plano debe ser un objeto JSON."],plan:null};
  if (input.schemaVersion !== 1 || input.units !== "m") errors.push("Usá schemaVersion:1 y units:'m'.");
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 120) errors.push("El título debe tener 1–120 caracteres.");
  if (!input.capture || typeof input.capture !== "object" || Array.isArray(input.capture)) errors.push("Falta capture.");
  const measuredPermitted = input.capture?.metricEvidenceVerified === true &&
    typeof input.capture?.measurementReference === "string" &&
    input.capture.measurementReference.trim().length >= 8;
  if (input.capture?.metricEvidenceVerified === true && !measuredPermitted)
    errors.push("Toda escala verificada requiere measurementReference descriptiva.");
  const photos = input.photos;
  if (!Array.isArray(photos) || photos.length > 120) errors.push("photos debe ser una lista de hasta 120 referencias, sin imágenes incrustadas.");
  const photoSet = new Set();
  for (const photo of Array.isArray(photos) ? photos : []) {
    if (!code(photo?.id) || photoSet.has(photo.id)) errors.push("IDs de fotos inválidos o repetidos.");
    else photoSet.add(photo.id);
    if (photo && Object.keys(photo).some(key => !["id","label"].includes(key))) errors.push("Las referencias de foto solo admiten id y label; no incluyas datos EXIF, URL ni bytes.");
  }
  const rooms = input.rooms, walls = input.walls;
  if (!Array.isArray(rooms) || !rooms.length || rooms.length > maxElements) errors.push("El plano necesita entre 1 y 160 ambientes.");
  if (!Array.isArray(walls) || !walls.length || walls.length > maxElements) errors.push("El plano necesita entre 1 y 160 paredes.");
  const ids = new Set();
  function evidence(element,label) {
    if (!statuses.has(element?.evidence?.status)) errors.push(label + ": evidencia debe ser inferred, photo-supported o measured.");
    if (!Array.isArray(element?.evidence?.photoIds) || element.evidence.photoIds.length > 120)
      errors.push(label + ": evidence.photoIds debe ser una lista.");
    else for (const id of element.evidence.photoIds) if (!photoSet.has(id)) errors.push(label + ": foto referenciada desconocida: " + id);
    if (element?.evidence?.status === "photo-supported" && !element.evidence.photoIds.length)
      errors.push(label + ": photo-supported requiere al menos una foto.");
    if (element?.evidence?.status === "measured" && !measuredPermitted)
      errors.push(label + ": no se puede afirmar una medición sin referencia métrica verificada.");
  }
  function elemId(e,type) {
    if (!code(e?.id) || ids.has(e.id)) errors.push(type+": ID inválido o duplicado.");
    else ids.add(e.id);
  }
  for (const room of Array.isArray(rooms) ? rooms : []) {
    elemId(room,"Ambiente");
    if (typeof room?.name !== "string" || room.name.length > 80 || !room.name.trim()) errors.push("Ambiente: nombre obligatorio.");
    if (!Array.isArray(room?.bounds) || room.bounds.length !== 4 ||
        !finite(room.bounds[0],-100,100) || !finite(room.bounds[1],-100,100) ||
        !finite(room.bounds[2],0.45,40) || !finite(room.bounds[3],0.45,40))
      errors.push("Ambiente: bounds [x,z,ancho,fondo] inválidos (metros).");
    evidence(room,"Ambiente "+room?.id);
  }
  if (Array.isArray(rooms)) for (let i=0;i<rooms.length;i++) for(let j=i+1;j<rooms.length;j++) {
    const a=rooms[i]?.bounds,b=rooms[j]?.bounds;
    if(!Array.isArray(a)||a.length!==4||!Array.isArray(b)||b.length!==4)continue;
    const overlapX=Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0]);
    const overlapZ=Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]);
    if(overlapX>0.002&&overlapZ>0.002)errors.push("Los ambientes "+rooms[i].id+" y "+rooms[j].id+" se superponen.");
  }
  const keys = new Set();
  for (const wall of Array.isArray(walls) ? walls : []) {
    elemId(wall,"Pared");
    const from=wall?.from,to=wall?.to;
    const valid=Array.isArray(from)&&Array.isArray(to)&&from.length===2&&to.length===2 &&
      [...from,...to].every(n=>finite(n,-100,100)) &&
      ((Math.abs(from[0]-to[0])<1e-5 && Math.abs(from[1]-to[1])>.05) ||
       (Math.abs(from[1]-to[1])<1e-5 && Math.abs(from[0]-to[0])>.05));
    if (!valid) {errors.push("Pared "+wall?.id+": se requieren extremos ortogonales no nulos.");continue;}
    const key=[from.join(","),to.join(",")].sort().join("|");
    if(keys.has(key))errors.push("Pared duplicada: "+wall.id);
    keys.add(key);
    if (!finite(wall.height,1.9,6) || !finite(wall.thickness,.07,.6)) errors.push("Pared "+wall.id+": altura/grosor inválidos.");
    evidence(wall,"Pared "+wall.id);
    const len=Math.abs(to[0]-from[0])+Math.abs(to[1]-from[1]);
    const openings=wall.openings ?? [];
    if(!Array.isArray(openings)||openings.length>12){errors.push("Pared "+wall.id+": hasta 12 aberturas.");continue;}
    const intervals=[];
    for(const opening of openings){
      const label="Abertura "+opening?.id;
      elemId(opening,"Abertura");
      if(!allowedOpeningKinds.has(opening?.kind))errors.push(label+": tipo inválido.");
      if(!finite(opening?.at,.08,len)||!finite(opening?.width,.4,4) ||
         opening.at+opening.width>len-.07)errors.push(label+": fuera de los límites de la pared.");
      if(!finite(opening?.bottom,0,3)||!finite(opening?.height,.45,3) ||
         opening.bottom+opening.height>wall.height+.0001)errors.push(label+": altura incompatible.");
      evidence(opening,label);
      intervals.push([opening?.at,opening?.at+opening?.width,opening?.id]);
    }
    for(let i=0;i<intervals.length;i++)for(let j=i+1;j<intervals.length;j++){
      if(intervals[i][0]<intervals[j][1]-.001 && intervals[j][0]<intervals[i][1]-.001)
        errors.push("Aberturas superpuestas en "+wall.id+": "+intervals[i][2]+" / "+intervals[j][2]);
    }
  }
  const plan=errors.length?null:input;
  return {ok:errors.length===0,errors:[...new Set(errors)],plan};
}

export function planToBoxes(input) {
  const {ok,errors,plan}=validatePlan(input);
  if(!ok)throw new Error(errors.join("\n"));
  const boxes=[];
  for(const room of plan.rooms){
    const [x,z,w,d]=room.bounds;
    boxes.push({
      id:room.id,name:room.name,kind:"floor",
      center:[round(x+w/2),-.07,round(z+d/2)], size:[w,.14,d],evidence:room.evidence
    });
  }
  for(const wall of plan.walls){
    const fx=wall.from[0],fz=wall.from[1],tx=wall.to[0],tz=wall.to[1];
    const alongX=Math.abs(tx-fx)>.001, len=alongX?Math.abs(tx-fx):Math.abs(tz-fz);
    const dir=alongX?Math.sign(tx-fx):Math.sign(tz-fz);
    const opens=wall.openings??[];
    const cuts=[0,len,...opens.flatMap(o=>[o.at,o.at+o.width])].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1];
      if(b-a<1e-5)continue;
      const target=opens.find(o=>o.at<(a+b)/2 && o.at+o.width>(a+b)/2);
      const spans=target?[[0,target.bottom],[target.bottom+target.height,wall.height]]:[[0,wall.height]];
      for(const [y0,y1] of spans) {
        if(y1-y0<1e-5)continue;
        const mid=(a+b)/2;
        boxes.push({
          id:wall.id+"-piece-"+i+"-"+Math.round(y0*100),
          name:"Pared "+wall.id,
          kind:"wall",
          center:alongX?[round(fx+dir*mid),round((y0+y1)/2),fz]:
                        [fx,round((y0+y1)/2),round(fz+dir*mid)],
          size:alongX?[round(b-a),round(y1-y0),wall.thickness]:
                      [wall.thickness,round(y1-y0),round(b-a)],
          evidence:wall.evidence,
          openingId:target?.id??null
        });
      }
    }
  }
  return boxes;
}

export function summarizePlan(input) {
  const {ok,errors}=validatePlan(input);
  if(!ok)return {ok:false,errors};
  const rooms=input.rooms.length,walls=input.walls.length,openings=input.walls.reduce((sum,w)=>sum+(w.openings?.length||0),0);
  const area=input.rooms.reduce((sum,r)=>sum+r.bounds[2]*r.bounds[3],0);
  const statuses=[...input.rooms,...input.walls,...input.walls.flatMap(w=>w.openings??[])].reduce((a,e)=>(a[e.evidence.status]=(a[e.evidence.status]||0)+1,a),{});
  return {ok:true,rooms,walls,openings,areaM2:round(area),statuses,boxes:planToBoxes(input).length,
    certified:input.capture.metricEvidenceVerified===true};
}
