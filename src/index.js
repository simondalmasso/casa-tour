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
    // Let Assets resolve its own canonical root. /index.html redirects to / on Cloudflare.
    if (url.pathname === "/") return withSecurityHeaders(await env.ASSETS.fetch(request));
    if (url.pathname === "/studio") {
      // Cloudflare Assets may return a 404 when a Worker forwards a pretty /studio URL.
      // Serve a non-.html backing asset, avoiding the automatic canonical redirect loop.
      const shell = await env.ASSETS.fetch(new Request(new URL("/studio-shell.txt",url.origin),request));
      if (!shell.ok) return withSecurityHeaders(shell);
      const headers = new Headers(shell.headers);
      headers.set("content-type","text/html; charset=utf-8");
      headers.set("cache-control","public, max-age=60");
      const response=withSecurityHeaders(new Response(shell.body,{
        status:shell.status,statusText:shell.statusText,headers
      }));
      response.headers.set("content-security-policy","frame-ancestors 'none'");
      return response;
    }
    if (url.pathname === "/tour/demo" || url.pathname === "/embed/demo") {
      // Assets canonicalizes .html names, which would redirect away from our stable tour URL.
      // Fetch a non-HTML internal asset and set its actual MIME type explicitly instead.
      const shellRequest = new Request(new URL("/tour-shell.txt",url.origin),request);
      const shell = await env.ASSETS.fetch(shellRequest);
      if (!shell.ok) return withSecurityHeaders(shell);
      const headers = new Headers(shell.headers);
      headers.set("content-type","text/html; charset=utf-8");
      headers.set("cache-control","public, max-age=60");
      return withSecurityHeaders(new Response(shell.body,{
        status:shell.status,statusText:shell.statusText,headers
      }));
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
