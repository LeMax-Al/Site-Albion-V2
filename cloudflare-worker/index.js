const ALBION_API = "https://gameinfo-ams.albiononline.com/api/gameinfo/";
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
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
    if (path === "health") {
      return new Response(JSON.stringify({
        ok: true,
        service: "site-albion-v2",
        upstream: "gameinfo-ams.albiononline.com",
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    if (!/^(search|players|events)(\/[A-Za-z0-9_-]+)*$/.test(path)) {
      return new Response("Endpoint not allowed", { status: 403, headers });
    }

    const target = new URL(path, ALBION_API);
    target.search = url.search;
    const cache = caches.default;
    const cacheKey = new Request(target.toString(), { method: "GET" });

    try {
      // Cache edge courte : évite de rappeler Gameinfo pour les mêmes données
      // quand plusieurs visiteurs/actualisations arrivent à quelques secondes d'intervalle.
      const cached = await cache.match(cacheKey);
      if (cached) {
        const cachedHeaders = new Headers(cached.headers);
        for (const [key, value] of Object.entries(headers)) cachedHeaders.set(key, value);
        cachedHeaders.set("X-Albion-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers: cachedHeaders });
      }
      const upstream = await fetch(target.toString(), {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000)
      });

      const responseHeaders = new Headers(headers);
      responseHeaders.set(
        "Content-Type",
        upstream.headers.get("Content-Type") || "application/json; charset=utf-8"
      );
      responseHeaders.set("Cache-Control", upstream.ok ? "public, max-age=30" : "no-store");
      responseHeaders.set("X-Albion-Cache", "MISS");
      const response = new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders
      });
      if (upstream.ok) {
        const cacheResponse = new Response(response.clone().body, {
          status: response.status,
          headers: response.headers
        });
        cacheResponse.headers.set("Cache-Control", "public, max-age=30");
        await cache.put(cacheKey, cacheResponse).catch(() => {});
      }
      return response;
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
