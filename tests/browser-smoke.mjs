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
  await heroFrame.locator("#view-status").getByText(/ENSAMBLAJE ILUSTRATIVO/).waitFor({state:"attached",timeout:8000});
  await page.screenshot({path:"test-artifacts/home-desktop.png",fullPage:true});
  await page.locator("#explorar").scrollIntoViewIfNeeded();
  await page.locator('[data-tour-view="bedroom"]').click();
  const tourFrame=page.frameLocator("#demo-frame");
  await tourFrame.locator('[data-room="bedroom"][aria-pressed="true"]').waitFor({timeout:12000,state:"attached"});
  await page.screenshot({path:"test-artifacts/tour-desktop.png"});
  assert.deepEqual(errors,[],errors.join("\n"));
  // Free both desktop WebGL canvases before starting mobile on CI software GPU.
  await page.close();
  await context.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1, reducedMotion:"reduce"});
  mobile.on("pageerror",e=>errors.push("mobile: "+e.message));
  const mobileResponse=await mobile.goto(origin+"/",{waitUntil:"domcontentloaded"});
  assert.equal(mobileResponse?.status(),200);
  await mobile.frameLocator("#hero-model").locator("canvas").waitFor({timeout:30000});
  const layout=await mobile.evaluate(()=>{
    const bounds=selector=>document.querySelector(selector).getBoundingClientRect();
    return {
      scene:bounds(".hero-art").toJSON(),
      heading:bounds(".hero h1").toJSON(),
      summary:bounds(".hero-copy>p:not(.hero-note)").toJSON(),
      annotation:getComputedStyle(document.querySelector(".hero-annotation")).display,
      scrollWidth:document.documentElement.scrollWidth,
      viewportWidth:innerWidth
    };
  });
  assert.ok(layout.scene.top<350,"3D house should appear above mobile fold: "+layout.scene.top);
  assert.ok(layout.heading.bottom<=layout.scene.top+5,"Headline must precede interactive house");
  assert.ok(layout.summary.top>=layout.scene.bottom-5,"Marketing text should follow interactive house");
  assert.equal(layout.annotation,"none","Decorative annotation must not overlay house on mobile");
  assert.ok(layout.scrollWidth<=layout.viewportWidth+3,"No horizontal scroll at 390px");
  await mobile.locator(".hero-art").screenshot({path:"test-artifacts/hero-mobile.png"});
  await mobile.screenshot({path:"test-artifacts/home-mobile.png",fullPage:true});
  await mobile.locator("#explorar").scrollIntoViewIfNeeded();
  const mobileTour=mobile.frameLocator("#demo-frame");
  await mobileTour.locator("canvas").waitFor({state:"visible",timeout:20000});
  const touchAction=await mobileTour.locator("canvas").evaluate(canvas=>getComputedStyle(canvas).touchAction);
  assert.equal(touchAction,"pan-y","3D canvas must allow vertical document scroll on phones");
  const toggle=mobileTour.locator("#settings-toggle");
  await toggle.waitFor({state:"visible"});
  const panel=mobileTour.locator("#viewer-settings");
  assert.equal(await panel.isVisible(),false,"Customizer should begin folded");
  await toggle.click();
  await panel.waitFor({state:"visible"});
  assert.equal(await toggle.getAttribute("aria-expanded"),"true");
  await mobileTour.locator('[data-palette="forest"]').click();
  assert.equal(await mobileTour.locator('[data-palette="forest"]').getAttribute("aria-pressed"),"true");
  await toggle.click();
  assert.equal(await panel.isVisible(),false);
  await mobileTour.locator('[data-room="kitchen"]').click();
  assert.equal(await mobileTour.locator('[data-room="kitchen"]').getAttribute("aria-pressed"),"true");
  await mobile.screenshot({path:"test-artifacts/tour-mobile.png"});
  await mobile.setViewportSize({width:320,height:700});
  const shareHeight=await mobile.frameLocator("#demo-frame").locator("#share").evaluate(button=>button.getBoundingClientRect().height);
  assert.ok(shareHeight<=50,"Compact share action must stay one line at 320px");
  await mobile.screenshot({path:"test-artifacts/home-mobile-small.png",fullPage:false});
  const smallOverflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth+3);
  assert.equal(smallOverflow,false,"Unexpected horizontal overflow at 320px");
  assert.deepEqual(errors,[],errors.join("\n"));
  console.log("Browser smoke: desktop WebGL, phone 390/320, 3D-first fold, camera, assembly, responsive drawer, room focus and no JS errors.");
}finally{
  await browser.close();
}
