import {chromium} from "playwright";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mkdir} from "node:fs/promises";
import {inspectGlb} from "../public/glb-export.js";

const base=process.env.CASA_TOUR_BASE_URL||"http://127.0.0.1:8787";
const browser=await chromium.launch({headless:true,args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--disable-dev-shm-usage","--no-sandbox"]});
const errors=[],posts=[];
await mkdir("test-artifacts",{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"reduce",acceptDownloads:true});
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(r.method()==="POST"||r.method()==="PUT")posts.push(r.url());});
  let loaded=false;
  for(let attempt=0;attempt<28;attempt++){
    try{
      const response=await page.goto(base+"/studio",{waitUntil:"domcontentloaded",timeout:12000});
      if(response?.status()===200){loaded=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,800));
  }
  assert.equal(loaded,true,"/studio must serve HTML successfully");
  assert.match(await page.title(),/Casa Tour Studio/);
  await page.locator("#save-glb:enabled").waitFor({timeout:45000});
  assert.equal(await page.locator("#rooms-count").textContent(),"2");
  assert.equal(await page.locator("#walls-count").textContent(),"5");
  assert.equal(await page.locator("#openings-count").textContent(),"3");
  assert.match(await page.locator("#area-count").textContent(),/26\.5/);
  await page.locator("#render-stage canvas").waitFor({state:"visible"});
  await page.screenshot({path:"test-artifacts/studio-desktop.png",fullPage:true});
  const beforeDownload=page.waitForEvent("download");
  await page.locator("#save-glb").click();
  const download=await beforeDownload;
  await download.saveAs("test-artifacts/studio-generated.glb");
  assert.ok(download.suggestedFilename().endsWith(".glb"));
  const gltf=inspectGlb(new Uint8Array(readFileSync("test-artifacts/studio-generated.glb")));
  assert.ok(gltf.nodes.length>5,"must export individual walls and floors");
  assert.equal(gltf.scenes[0].extras.origin,"manually-annotated-layout");
  assert.equal(gltf.scenes[0].extras.metricEvidenceVerified,false);
  // Invalid metric input must prevent export and show why.
  let sample=JSON.parse(await page.locator("#plan-editor").inputValue());
  sample.rooms[0].bounds[2]=-2;
  await page.locator("#plan-editor").fill(JSON.stringify(sample));
  assert.match(await page.locator("#feedback").textContent(),/bounds/);
  assert.equal(await page.locator("#save-glb").isDisabled(),true);
  const dialogue=page.waitForEvent("dialog").then(d=>d.accept());
  await page.locator("#reset-sample").click();await dialogue;
  await page.locator("#save-glb:enabled").waitFor({timeout:15000});
  // Photo byte stays local, only a source reference is appended to the contract.
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aDUAAAAASUVORK5CYII=","base64");
  await page.locator("#photo-files").setInputFiles({name:"living.png",mimeType:"image/png",buffer:png});
  assert.equal(await page.locator(".thumb").count(),1);
  sample=JSON.parse(await page.locator("#plan-editor").inputValue());
  assert.equal(sample.photos[0].id,"photo_1");
  sample.rooms[0].evidence={status:"photo-supported",photoIds:["photo_1"]};
  await page.locator("#plan-editor").fill(JSON.stringify(sample,null,2));
  await page.locator("#build-glb").click();
  await page.locator("#save-glb:enabled").waitFor({timeout:18000});
  const dPromise=page.waitForEvent("download");
  await page.locator("#save-glb").click();
  await (await dPromise).saveAs("test-artifacts/studio-with-evidence.glb");
  const provenance=inspectGlb(new Uint8Array(readFileSync("test-artifacts/studio-with-evidence.glb")));
  assert.ok(provenance.nodes.some(n=>n.extras.sourceStatus==="photo-supported"&&n.extras.sourcePhotoIds.includes("photo_1")));
  assert.deepEqual(posts,[],"photos and plan data must never POST/PUT");

  await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});
  mobile.on("pageerror",e=>errors.push(e.message));
  assert.equal((await mobile.goto(base+"/studio",{waitUntil:"domcontentloaded"}))?.status(),200);
  await mobile.locator("#save-glb:enabled").waitFor({timeout:40000});
  const layout=await mobile.evaluate(()=>{
    const bounds=id=>document.querySelector(id).getBoundingClientRect();
    return {viewer:bounds(".preview").toJSON(),editor:bounds(".editor").toJSON(),
      width:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  assert.ok(layout.viewer.top<layout.editor.top,"Mobile users must see 3D viewer before code editor");
  assert.ok(layout.width<=layout.viewport+3,"No horizontal overflow at 390px");
  await mobile.screenshot({path:"test-artifacts/studio-mobile.png",fullPage:true});
  await mobile.setViewportSize({width:320,height:700});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth+3),false,"No horizontal overflow at 320px");
  await mobile.screenshot({path:"test-artifacts/studio-mobile-small.png",fullPage:false});
  assert.deepEqual(errors,[],errors.join("\n"));
  console.log("Casa Tour Studio smoke GREEN: GLB preview/export, openings, provenance, local photo privacy, invalid plan rejection, desktop and 390/320 phone.");
}finally{
  await browser.close();
}
