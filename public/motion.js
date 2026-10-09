
"use strict";
// Presentation effects are progressive enhancement. No access to private files or tracking.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const heroIframe = document.getElementById("hero-model");
const tourIframe = document.getElementById("demo-frame");
const heroScene = document.querySelector(".hero-art");
const shortcuts = [...document.querySelectorAll("[data-scene-view]")];
const frames = [heroIframe, tourIframe].filter(Boolean);
const ready = new WeakSet();
const allowedViews = new Set(["dollhouse", "top", "walk", "wireframe", "assembly", "living", "bedroom", "kitchen"]);
function changeScene(mode,frame=heroIframe){
  if(!allowedViews.has(mode)||!frame)return;
  if(!ready.has(frame)){
    frame.addEventListener("load",()=>sendMode(frame,mode),{once:true});
  } else sendMode(frame,mode);
  shortcuts.forEach(button=>button.classList.toggle("active",button.dataset.sceneView===mode));
}
function sendMode(frame,mode){
  if(frame?.contentWindow)frame.contentWindow.postMessage({type:"CASA_TOUR_SET_VIEW",mode},location.origin);
}
document.querySelectorAll("[data-scene-view]").forEach(button=>{
  button.addEventListener("click",()=>changeScene(button.dataset.sceneView));
});
document.querySelectorAll("[data-tour-view]").forEach(button=>{
  button.addEventListener("click",()=>{
    document.getElementById("explorar")?.scrollIntoView({behavior:reduceMotion.matches?"instant":"smooth"});
    changeScene(button.dataset.tourView,tourIframe);
  });
});
window.addEventListener("message",event=>{
  if(event.origin!==location.origin||!frames.some(frame=>frame.contentWindow===event.source))return;
  if(event.data?.type==="CASA_TOUR_READY"){
    const frame=frames.find(item=>item.contentWindow===event.source);
    if(frame)ready.add(frame);
  }
});
if(heroScene&&!reduceMotion.matches){
  heroScene.addEventListener("pointermove",event=>{
    const bounds=heroScene.getBoundingClientRect();
    const x=(event.clientX-bounds.left)/bounds.width-.5;
    const y=(event.clientY-bounds.top)/bounds.height-.5;
    heroScene.style.setProperty("--hero-parallax-x",(x*3).toFixed(2));
    heroScene.style.setProperty("--hero-parallax-y",(-y*2.4).toFixed(2));
  },{passive:true});
  heroScene.addEventListener("pointerleave",()=>{
    heroScene.style.setProperty("--hero-parallax-x","0");
    heroScene.style.setProperty("--hero-parallax-y","0");
  });
}
const reveals=[...document.querySelectorAll("[data-reveal]")];
if("IntersectionObserver" in window&&!reduceMotion.matches){
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  },{threshold:.10,rootMargin:"0px 0px -26px 0px"});
  reveals.forEach(item=>observer.observe(item));
}else reveals.forEach(item=>item.classList.add("is-visible"));
// Reduce duplicate WebGL activity when a tour is outside the viewport.
if("IntersectionObserver" in window){
  const visibilityObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      entry.target.contentWindow?.postMessage({type:"CASA_TOUR_VISIBILITY",active:entry.isIntersecting},location.origin);
    });
  },{threshold:.04});
  frames.forEach(frame=>visibilityObserver.observe(frame));
}
// Do not invent availability for unsupported representations (e.g. panorama 360°).
window.CasaTourDemo=Object.freeze({views:[...allowedViews],ready:()=>frames.filter(frame=>ready.has(frame)).length});
