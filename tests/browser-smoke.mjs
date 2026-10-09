import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const origin=process.env.CASA_TOUR_BASE_URL||"http://127.0.0.1:8787";
const browser=await chromium.launch({headless:true,args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--disable-dev-shm-usage","--no-sandbox"]});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1, reducedMotion:"reduce"});
await mkdir("test-artifacts",{recursive:true});
try {
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push("main: "+e.message));
  let ready=false;
  for(let attempt=0;attempt<40;attempt++){
    try{
      const response=await page.goto(origin+"/",{waitUntil:"domcontentloaded",timeout:12000});
      if(response?.status()===200){ready=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,1200));
  }
  assert.ok(ready,"Cloudflare local dev server did not become healthy");
  await page.locator("#hero-model").waitFor({state:"visible"});
  const heroFrame=page.frameLocator("#hero-model");
  await heroFrame.locator("canvas").waitFor({timeout:30000,state:"visible"});
  await heroFrame.locator("canvas").evaluate(async canvas=>{
    const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
    if(!gl)throw Error("Real 3D canvas does not expose WebGL");
  });
  await page.locator('[data-scene-view="top"]').click();
  await heroFrame.locator('[data-mode="top"][aria-pressed="true"]').waitFor({timeout:10000,state:"attached"});
  await page.locator('[data-scene-view="assembly"]').click();
  await heroFrame.locator("#view-status").getByText(/ENSAMBLAJE ILUSTRATIVO/).waitFor({timeout:8000});
  await page.screenshot({path:"test-artifacts/home-desktop.png",fullPage:true});
  await page.locator("#explorar").scrollIntoViewIfNeeded();
  await page.locator('[data-tour-view="bedroom"]').click();
  const tourFrame=page.frameLocator("#demo-frame");
  await tourFrame.locator('[data-room="bedroom"][aria-pressed="true"]').waitFor({timeout:12000,state:"attached"});
  await page.screenshot({path:"test-artifacts/tour-desktop.png"});
  assert.deepEqual(errors,[],errors.join("\n"));
  const mobile=await context.browser().newPage({viewport:{width:390,height:844},deviceScaleFactor:1, reducedMotion:"reduce"});
  mobile.on("pageerror",e=>errors.push("mobile: "+e.message));
  const mobileResponse=await mobile.goto(origin+"/",{waitUntil:"domcontentloaded"});
  assert.equal(mobileResponse?.status(),200);
  await mobile.frameLocator("#hero-model").locator("canvas").waitFor({timeout:30000});
  await mobile.screenshot({path:"test-artifacts/home-mobile.png",fullPage:true});
  const horizontalOverflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth+3);
  assert.equal(horizontalOverflow,false,"Unexpected page-level mobile horizontal overflow");
  assert.deepEqual(errors,[],errors.join("\n"));
  console.log("Browser smoke: desktop and mobile 3D canvas, camera mode, assembly, room focus, no JS errors, no mobile overflow.");
}finally{
  await browser.close();
}
