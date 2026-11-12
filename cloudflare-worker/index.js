const ALBION_API = "https://gameinfo-ams.albiononline.com/api/gameinfo/";
const SITE_ORIGIN = "https://lemax-al.github.io";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": SITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    // Le site GitHub Pages est le seul site autorisé.
    if (origin !== SITE_ORIGIN) {
      return new Response("Origin not allowed", { status: 403 });
    }

    const headers = corsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...headers, "Allow": "GET, OPTIONS" }
      });
    }

    // N'autorise que les routes Gameinfo utilisées par le killboard.
    const path = url.pathname.replace(/^\/api\/?/, "");
    if (!/^(search|players|events)(\/[A-Za-z0-9_-]+)*$/.test(path)) {
      return new Response("Endpoint not allowed", { status: 403, headers });
    }

    const target = new URL(path, ALBION_API);
    target.search = url.search;

    try {
      const upstream = await fetch(target.toString(), {
        headers: { "Accept": "application/json" }
      });

      const responseHeaders = new Headers(headers);
      responseHeaders.set(
        "Content-Type",
        upstream.headers.get("Content-Type") || "application/json; charset=utf-8"
      );
      responseHeaders.set("Cache-Control", upstream.ok ? "public, max-age=20" : "no-store");

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders
      });
    } catch {
      return new Response(JSON.stringify({
        error: "Albion Gameinfo API unavailable"
      }), {
        status: 502,
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
      });
    }
  }
};
