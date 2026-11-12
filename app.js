const API="https://site-albion-v2.maxbruneteau.workers.dev/api",NAME="LeMax", $=id=>document.getElementById(id);
let kills=[],deaths=[],filter="all";
const fmt=v=>Number.isFinite(Number(v))?new Intl.NumberFormat("fr-FR").format(Number(v)):"—";
const val=(v,d="—")=>v==null||v===""?d:String(v);
async function get(path){const r=await fetch(API+path,{headers:{Accept:"application/json"}});if(!r.ok)throw Error(`API Albion : HTTP ${r.status}`);return r.json()}
function msg(s,error=false){$("notice").textContent=s;$("notice").classList.toggle("error",error)}
function showError(title,message,stage=""){const p=$("error-panel");p.classList.remove("hidden");$("error-title").textContent=title;$("error-message").textContent=message;$("error-stage").textContent=stage?"Étape : "+stage:""}
function clearError(){$("error-panel").classList.add("hidden")}
function id(e){return e.EventId??e.eventId??e.Id??e.id}
function date(e){return e.TimeStamp||e.Timestamp||e.timeStamp}
function arr(x){return Array.isArray(x)?x:(x?.Events||x?.events||[])}
function fame(e){const n=e?.TotalVictimKillFame??e?.totalVictimKillFame??e?.KillFame??e?.Victim?.KillFame??e?.victim?.KillFame??e?.Victim?.DeathFame;return n==null||!Number.isFinite(Number(n))?null:Number(n)}
function zone(e){return e?.Location??e?.location??e?.ClusterName??e?.clusterName??e?.Victim?.Location??"Zone inconnue"}
function itemCode(item){return String(item?.Type??item?.type??item?.UniqueName??item?.uniqueName??"").trim()}
function dateText(v){if(!v)return"Date inconnue";const d=new Date(v);return isNaN(d)?String(v):new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(d)}
async function load(){
 let stage="recherche du personnage";
 $("refresh").disabled=true;clearError();msg("Connexion à l’API Albion Europe…");
 try{
  const search=await get("/search?q=LeMax");
  // Gameinfo renvoie un objet SearchResult dont les personnages sont dans "players".
  // On garde aussi la compatibilité avec les réponses déjà renvoyées sous forme de tableau.
  const players=Array.isArray(search)?search:
    Array.isArray(search?.players)?search.players:
    Array.isArray(search?.Players)?search.Players:
    Array.isArray(search?.data?.players)?search.data.players:[];
  const matches=players.filter(p=>(p?.Id||p?.id)&&String(p?.Name||p?.name||"").trim().toLowerCase()==="lemax");
  if(!matches.length)throw Error("Le personnage exact « LeMax » n’a pas été trouvé sur le serveur Europe.");
  if(matches.length>1)throw Error("Plusieurs personnages nommés LeMax existent. Il faut identifier le bon personnage avant de charger ses statistiques.");
  const p=matches[0],pid=encodeURIComponent(p.Id||p.id);
  stage="chargement du profil et des combats";
  const [profile,k,d]=await Promise.all([get(`/players/${pid}`),get(`/players/${pid}/kills?limit=20`),get(`/players/${pid}/deaths?limit=20`)]);
  kills=arr(k);deaths=arr(d);
  $("name").textContent=profile.Name||NAME;
  $("guild").textContent=[profile.GuildName,profile.AllianceName?`[${profile.AllianceName}]`:null].filter(Boolean).join(" · ")||"Aucune guilde renseignée";
  const stats=profile.LifetimeStatistics||{};
  const lifetimePvp=stats.PvP?.Total??stats.PvP?.total??stats.KillFame??profile.KillFame??profile.TotalKillFame;$("fame").textContent=lifetimePvp==null?"—":fmt(lifetimePvp);
  $("kills").textContent=fmt(kills.length);$("deaths").textContent=fmt(deaths.length);
  $("guildstat").textContent=profile.GuildName?"—":"—";$("guildsub").textContent=profile.GuildName||"Guilde actuelle";
  $("updated").textContent=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"}).format(new Date());
  render();msg(`LeMax chargé sur Europe · ${kills.length} kills et ${deaths.length} morts récupérés.`);
 }catch(e){console.error(e);msg("Le chargement a rencontré une erreur.",true);showError("Impossible de charger le killboard",e.message,stage);$("events").innerHTML='<div class="empty">Données indisponibles. Réessaie dans un instant.</div>'}
 finally{$("refresh").disabled=false}
}
function render(){
 const all=[...kills.map(e=>({...e,_type:"kill"})),...deaths.map(e=>({...e,_type:"death"}))].sort((a,b)=>new Date(date(b)||0)-new Date(date(a)||0));
 const shown=filter==="all"?all:all.filter(e=>e._type===filter);
 $("total").textContent=all.length;$("ktotal").textContent=kills.length;$("dtotal").textContent=deaths.length;
 const list=$("events");list.replaceChildren();
 if(!shown.length){list.innerHTML='<div class="empty">Aucun combat disponible pour ce filtre.</div>';return}
 shown.forEach(e=>{
  const type=e._type,person=type==="kill"?e.Victim:e.Killer;
  const row=document.createElement("div");row.className="event";
  const kind=document.createElement("div");kind.className=`kind ${type}`;kind.innerHTML=`<em>${type==="kill"?"⚔":"✕"}</em>${type==="kill"?"KILL":"MORT"}<small>#${val(id(e))}</small>`;
  const opp=document.createElement("div");opp.className="opponent";opp.textContent=person?.Name||"Adversaire inconnu";
  const guild=document.createElement("div");guild.className="guild";guild.textContent=person?.GuildName||"Sans guilde";
  const f=document.createElement("div");f.className="fame";f.textContent=fame(e)==null?"Fame —":fmt(fame(e));const z=document.createElement("div");z.className="zone";z.textContent=zone(e);z.title=z.textContent;
  const dt=document.createElement("div");dt.className="date";dt.textContent=dateText(date(e));
  const btn=document.createElement("button");btn.className="open";btn.textContent="↗";btn.title="Voir le rapport";btn.onclick=()=>detail(e);
  row.append(kind,opp,guild,z,f,dt,btn);list.append(row);
 });
}
async function detail(summary){
 const eventId=id(summary);if(!eventId)return;
 $("detail").classList.remove("hidden");$("detailtitle").textContent=`Combat #${eventId}`;$("detailbody").textContent="Chargement…";$("detail").scrollIntoView({behavior:"smooth"});
 try{
  const e=await get(`/events/${encodeURIComponent(eventId)}`),wrap=$("detailbody");wrap.replaceChildren();
  const sides=document.createElement("div");sides.className="sides";
  [["TUEUR",e.Killer],["VICTIME",e.Victim]].forEach(([title,p])=>{
   const card=document.createElement("article");card.className="side";
   const h=document.createElement("h3");h.textContent=`${title} · ${p?.Name||"Inconnu"}`;
   const sub=document.createElement("p");sub.textContent=[p?.GuildName,p?.AllianceName].filter(Boolean).join(" · ")||"Sans guilde";
   const gear=document.createElement("div");gear.className="gear";
   Object.entries(p?.Equipment||p?.equipment||{}).forEach(([slot,item])=>{
    const code=itemCode(item);if(!code)return;
    const box=document.createElement("div");box.className="gear-slot";box.title=slot+": "+code;
    const img=document.createElement("img");img.loading="lazy";img.alt=code;
    const quality=Number(item?.Quality??item?.quality??1)||1;
    const urls=["https://render.albiononline.com/v1/item/"+code+".png?quality="+quality+"&size=96","https://render.albiononline.com/v1/item/"+encodeURIComponent(code)+".png?quality="+quality+"&size=96","https://render.albiononline.com/v1/item/"+code.split("@")[0]+".png?quality="+quality+"&size=96"];
    let attempt=0;img.onerror=()=>{attempt++;if(attempt<urls.length)img.src=urls[attempt];else{img.remove();const fallback=document.createElement("span");fallback.className="item-fallback";fallback.textContent=slot.slice(0,2).toUpperCase();fallback.title=code;box.append(fallback)}};
    img.src=urls[0];box.append(img);gear.append(box);
   });
   card.append(h,sub,gear);sides.append(card);
  });
  const totalFame=fame(e)??fame(summary);const meta=document.createElement("p");meta.className="footnote combat-meta";meta.textContent=(totalFame==null?"Fame non renseignée":fmt(totalFame)+" fame")+" · "+dateText(e.TimeStamp||e.Timestamp||date(summary))+" · Zone : "+(zone(e)!=="Zone inconnue"?zone(e):zone(summary));
  wrap.append(sides,meta);
 }catch(e){$("detailbody").textContent=e.message;showError("Rapport de combat indisponible",e.message,"combat #"+eventId)}
}
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));filter=b.dataset.filter;render()}));
$("refresh").addEventListener("click",load);$("error-retry").addEventListener("click",load);$("close").addEventListener("click",()=>$("detail").classList.add("hidden"));load();