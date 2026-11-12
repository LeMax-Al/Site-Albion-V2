const ALBION_API="https://gameinfo-ams.albiononline.com/api/gameinfo/",PLAYER_NAME="LeMax";
function corsHeaders(){return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}}
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders(),"Content-Type":"application/json; charset=utf-8",...extra}});
async function fetchAlbion(path){const r=await fetch(new URL(path,ALBION_API),{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error("Albion API HTTP "+r.status+" ("+path+")");return r.json()}
async function syncArchive(env){
 const search=await fetchAlbion("search?q="+encodeURIComponent(PLAYER_NAME)),players=Array.isArray(search)?search:(search?.players||search?.Players||[]);
 const p=players.find(x=>String(x?.Name||x?.name||"").trim().toLowerCase()===PLAYER_NAME.toLowerCase()&&(x?.Id||x?.id));
 if(!p)throw new Error("Personnage LeMax introuvable sur Albion Europe");
 const pid=encodeURIComponent(p.Id||p.id);
 const [k,d]=await Promise.all([fetchAlbion("players/"+pid+"/kills?limit=51"),fetchAlbion("players/"+pid+"/deaths?limit=51")]);
 const list=x=>Array.isArray(x)?x:(x?.Events||x?.events||[]);
 const rows=[...list(k).map(e=>({e,kind:"kill"})),...list(d).map(e=>({e,kind:"death"}))];let saved=0;
 for(const {e,kind} of rows){
  const eid=e.EventId??e.eventId??e.Id??e.id;if(eid==null)continue;
  const time=e.TimeStamp??e.Timestamp??e.timeStamp??null,fame=Number(e.TotalVictimKillFame??e.totalVictimKillFame??e.KillFame??0)||0;
  const r=await env.DB.prepare("INSERT INTO events (event_id,kind,event_time,fame,payload,captured_at) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(event_id) DO UPDATE SET kind=excluded.kind,event_time=excluded.event_time,fame=excluded.fame,payload=excluded.payload")
   .bind(String(eid),kind,time?String(time):null,fame,JSON.stringify(e),new Date().toISOString()).run();
  saved+=r.meta?.changes||0;
 }
 const totals=await env.DB.prepare("SELECT kind,COUNT(*) AS total FROM events GROUP BY kind").all();
 return {ok:true,received:rows.length,insertedOrUpdated:saved,totals:totals.results||[],syncedAt:new Date().toISOString()};
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),headers=corsHeaders();
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="GET")return json({error:"Method not allowed"},405,{"Allow":"GET, OPTIONS"});
  const path=url.pathname.replace(/^\/api\/?/,"");
  if(path==="health")return json({ok:true,service:"site-albion-v2",upstream:"gameinfo-ams.albiononline.com",timestamp:new Date().toISOString()});
  if(path==="archive/sync"){try{return json(await syncArchive(env))}catch(e){return json({error:e.message},502)}}
  if(path==="archive/status"){try{const r=await env.DB.prepare("SELECT kind,COUNT(*) AS total,MAX(captured_at) AS last_capture FROM events GROUP BY kind").all();return json({ok:true,totals:r.results||[]})}catch(e){return json({error:e.message},500)}}
  const m=path.match(/^archive\/(kills|deaths)$/);
  if(m){try{const kind=m[1]==="kills"?"kill":"death",limit=Math.min(5000,Math.max(1,Number(url.searchParams.get("limit")||1000))),offset=Math.max(0,Number(url.searchParams.get("offset")||0));
   const [r,c]=await Promise.all([env.DB.prepare("SELECT payload FROM events WHERE kind=?1 ORDER BY event_time DESC LIMIT ?2 OFFSET ?3").bind(kind,limit,offset).all(),env.DB.prepare("SELECT COUNT(*) AS total FROM events WHERE kind=?1").bind(kind).first()]);
   return json({events:(r.results||[]).map(x=>JSON.parse(x.payload)),total:c?.total||0,limit,offset});
  }catch(e){return json({error:e.message},500)}}
  if(!/^(search|players|events)(\/[A-Za-z0-9_-]+)*$/.test(path))return new Response("Endpoint not allowed",{status:403,headers});
  const target=new URL(path,ALBION_API);target.search=url.search;const cache=caches.default,cacheKey=new Request(target.toString(),{method:"GET"});
  try{const cached=await cache.match(cacheKey);if(cached){const h=new Headers(cached.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);h.set("X-Albion-Cache","HIT");return new Response(cached.body,{status:cached.status,headers:h})}
   const upstream=await fetch(target.toString(),{headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)}),h=new Headers(headers);
   h.set("Content-Type",upstream.headers.get("Content-Type")||"application/json; charset=utf-8");h.set("Cache-Control",upstream.ok?"public, max-age=30":"no-store");h.set("X-Albion-Cache","MISS");
   const response=new Response(upstream.body,{status:upstream.status,headers:h});if(upstream.ok)await cache.put(cacheKey,response.clone()).catch(()=>{});return response;
  }catch{return json({error:"Albion Gameinfo API unavailable"},502)}
 },
 async scheduled(controller,env,ctx){ctx.waitUntil(syncArchive(env).catch(e=>console.error("Archive sync failed:",e)))}
};