import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import worker from "../src/index.js";

const served=[];
const env={ASSETS:{async fetch(request){
  const path=new URL(request.url).pathname;
  served.push(path);
  return new Response("<!doctype html><html lang=\"es\"><title>Mock</title></html>",{
    status:200,headers:{"content-type":"text/html; charset=utf-8"}
  });
}}};
const request=(path,method="GET")=>new Request("https://tour.example.test"+path,{method});

test("API advertises prototype truthfully",async()=>{
  const response=await worker.fetch(request("/api/v1/health"),env);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.ok,true);
  assert.equal(data.reconstruction,"not_available");
  assert.equal(response.headers.get("access-control-allow-origin"),"*");
});
test("demo metadata says it was not reconstructed from real photos",async()=>{
  const response=await worker.fetch(request("/api/v1/tours/demo"),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.representation,"semantic-3d-mesh");
  assert.equal(data.capturedFromPhotos,false);
  assert.equal(data.surveyAccuracyVerified,false);
  assert.equal(data.routes.embed,"/embed/demo");
});
test("disabled upload cannot silently accept photos or payments",async()=>{
  const response=await worker.fetch(request("/api/v1/jobs","POST"),env);
  assert.equal(response.status,501);
  assert.equal((await response.json()).error,"not_implemented");
});
test("unsupported API route is 404",async()=>{
  const response=await worker.fetch(request("/api/v1/tours/unknown"),env);
  assert.equal(response.status,404);
});
test("public iframe and share routes resolve to real HTML asset",async()=>{
  for(const path of ["/embed/demo","/tour/demo"]){
    const response=await worker.fetch(request(path),env);
    assert.equal(response.status,200);
    assert.equal(response.headers.get("x-frame-options"),null);
    assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  }
  assert.deepEqual(served.slice(-2),["/embed.html","/embed.html"]);
});
test("homepage maps to static index",async()=>{
  const response=await worker.fetch(request("/"),env);
  assert.equal(response.status,200);
  assert.equal(served.at(-1),"/index.html");
});
test("sample viewer and landing contain functional hooks",()=>{
  const html=readFileSync(resolve("public/index.html"),"utf8");
  const embed=readFileSync(resolve("public/embed.html"),"utf8");
  const viewer=readFileSync(resolve("public/viewer.js"),"utf8");
  const app=readFileSync(resolve("public/app.js"),"utf8");
  assert.match(html,/id="photo-input"/);
  assert.match(html,/id="demo-frame"/);
  assert.match(embed,/id="daylight"/);
  assert.match(embed,/data-mode="walk"/);
  assert.match(viewer,/new THREE.WebGLRenderer/);
  assert.match(viewer,/new THREE.BoxGeometry/);
  assert.match(app,/URL\.createObjectURL/);
  assert.match(app,/URL\.revokeObjectURL/);
});

test("live hero embeds the actual 3D viewer, not a static CSS mockup",()=>{
  const html=readFileSync(resolve("public/index.html"),"utf8");
  assert.match(html,/id="hero-model"[^>]+src="\/embed\/demo\?surface=hero"/);
  assert.match(html,/href="\/motion.css"/);
  assert.match(html,/src="\/motion.js"/);
  assert.doesNotMatch(html,/class="art-floorplan"/);
  assert.match(html,/data-scene-view="assembly"/);
});
test("room navigation, assembly and camera flights are wired to the 3D scene",()=>{
  const html=readFileSync(resolve("public/embed.html"),"utf8");
  const viewer=readFileSync(resolve("public/viewer.js"),"utf8");
  const motion=readFileSync(resolve("public/motion.js"),"utf8");
  assert.match(html,/data-room="living"/);
  assert.match(html,/data-room="bedroom"/);
  assert.match(html,/data-room="kitchen"/);
  assert.match(html,/id="assemble"/);
  assert.match(viewer,/function glideTo\(/);
  assert.match(viewer,/function updateAssembly\(/);
  assert.match(viewer,/function startAssembly\(/);
  assert.match(viewer,/CASA_TOUR_VISIBILITY/);
  assert.match(motion,/CASA_TOUR_SET_VIEW/);
  assert.match(motion,/IntersectionObserver/);
  assert.match(motion,/event.origin!==location.origin/);
});
test("demo truthfulness and reduced-motion behavior survive visual improvements",()=>{
  const html=readFileSync(resolve("public/index.html"),"utf8");
  const embed=readFileSync(resolve("public/embed.html"),"utf8");
  const viewer=readFileSync(resolve("public/viewer.js"),"utf8");
  const motionCSS=readFileSync(resolve("public/motion.css"),"utf8");
  assert.match(html,/reconstrucción automática desde fotografías está en desarrollo/i);
  assert.match(embed,/NO ES UN PLANO MEDIDO/);
  assert.match(viewer,/prefers-reduced-motion: reduce/);
  assert.match(motionCSS,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/MODALIDAD FUTURA/);
});
