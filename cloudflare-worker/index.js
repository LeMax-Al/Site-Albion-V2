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
    const marketMatch = path.match(/^market\/prices\/([A-Za-z0-9_%@,.-]+)$/);
    if (marketMatch) {
      const target = new URL("https://europe.albion-online-data.com/api/v2/stats/prices/" + marketMatch[1] + ".json");
      target.search = url.search;
      if (target.searchParams.get("locations") !== "Martlock") return new Response("Only Martlock prices are allowed", { status: 400, headers });
      try {
        const upstream = await fetch(target.toString(), { headers: { "Accept": "application/json" } });
        return new Response(upstream.body, { status: upstream.status, headers: { ...headers, "Content-Type": upstream.headers.get("Content-Type") || "application/json", "Cache-Control": upstream.ok ? "public, max-age=300" : "no-store" } });
      } catch {
        return new Response(JSON.stringify({ error: "Albion market API unavailable" }), { status: 502, headers: { ...headers, "Content-Type": "application/json" } });
      }
    }
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
