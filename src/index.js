const demo = Object.freeze({
  id: "demo",
  title: "Apartamento de demostración",
  status: "demo",
  representation: "semantic-3d-mesh",
  capturedFromPhotos: false,
  surveyAccuracyVerified: false,
  description: "Escena 3D ilustrativa. No corresponde a un inmueble real ni se reconstruyó a partir de fotografías.",
  features: ["dollhouse", "top", "walk", "materials", "lighting", "embed"],
  routes: {tour:"/tour/demo",embed:"/embed/demo"},
  embed: {responsive:true,frameBorder:0},
  createdFor: "Casa Tour prototype"
});
const json = (data, status=200) => new Response(JSON.stringify(data),{
  status,
  headers: {"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=120",
    "access-control-allow-origin":"*","x-content-type-options":"nosniff"}
});
const notFound = () => json({error:"not_found",message:"Este recurso no existe."},404);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({error:"not_implemented",message:"La carga y reconstrucción de fotos aún no están habilitadas. No se aceptan archivos ni pagos."},501);
      }
      if (url.pathname === "/api/health" || url.pathname === "/api/v1/health") {
        return json({ok:true,product:"casa-tour",phase:"prototype",reconstruction:"not_available"});
      }
      if (url.pathname === "/api/tours/demo" || url.pathname === "/api/v1/tours/demo") {
        return json(demo);
      }
      return notFound();
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed",{status:405,headers:{"allow":"GET, HEAD"}});
    }
    let assetPath = url.pathname;
    if (assetPath === "/tour/demo" || assetPath === "/embed/demo") assetPath = "/embed.html";
    if (assetPath === "/") assetPath = "/index.html";
    if (url.pathname === "/tour/demo" || url.pathname === "/embed/demo") {
      const headers = new Headers(request.headers);
      const assetURL = new URL(assetPath,url.origin);
      const assetRequest = new Request(assetURL,{method:request.method,headers});
      return withSecurityHeaders(await env.ASSETS.fetch(assetRequest));
    }
    if (assetPath !== url.pathname) {
      return withSecurityHeaders(await env.ASSETS.fetch(new Request(new URL(assetPath,url.origin),request)));
    }
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options","nosniff");
  headers.set("referrer-policy","strict-origin-when-cross-origin");
  headers.set("permissions-policy","camera=(), microphone=(), geolocation=()");
  headers.delete("x-frame-options");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
