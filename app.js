const API="https://site-albion-v2.maxbruneteau.workers.dev/api",NAME="LeMax", $=id=>document.getElementById(id);
let kills=[],deaths=[],filter="all";
const fmt=v=>Number.isFinite(Number(v))?new Intl.NumberFormat("fr-FR").format(Number(v)):"—";
const val=(v,d="—")=>v==null||v===""?d:String(v);
async function get(path){
 let response;
 try{
  response=await fetch(API+path,{method:"GET",mode:"cors",cache:"no-store",redirect:"follow",headers:{Accept:"application/json"}});
 }catch(err){
  throw new Error("Connexion réseau impossible vers "+API+path+" ("+(err?.message||"Load failed")+")");
 }
 if(!response.ok)throw new Error("Le proxy a répondu HTTP "+response.status+" pour "+path);
 try{return await response.json()}catch{throw new Error("Réponse invalide reçue pour "+path)}
}
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
 let stage="test de connexion au proxy Cloudflare";
 $("refresh").disabled=true;clearError();msg("Connexion à l’API Albion Europe…");
 try{
  const health=await get("/health");
  if(!health?.ok)throw new Error("Le proxy a répondu, mais son contrôle de santé est invalide.");
  stage="recherche du personnage";
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
async function getBuildPrices(players){
 const items=[];
 players.forEach((p,side)=>Object.entries(p?.Equipment||p?.equipment||{}).forEach(([slot,item])=>{
  const code=itemCode(item);if(code)items.push({side,slot,code,quality:Number(item?.Quality??item?.quality??1)||1});
 }));
 const unique=[...new Map(items.map(x=>[x.code+"|"+x.quality,x])).values()];
 if(!unique.length)return {items:[]};
 const ids=[...new Set(unique.map(x=>x.code))],qualities=[...new Set(unique.map(x=>x.quality))];
 const result=await get("/market/prices/"+ids.map(encodeURIComponent).join(",")+"?locations=Martlock&qualities="+qualities.join(","));
 const rows=Array.isArray(result)?result:[];
 return {items:unique.map(item=>{
  const row=rows.find(r=>r.item_id===item.code&&Number(r.quality)===item.quality&&Number(r.city_id)===3008);
  const price=Number(row?.sell_price_min)||0;
  return {...item,price:price>0?price:null};
 })};
}
async function detail(summary){
 const eventId=id(summary);if(!eventId)return;
 $("detail").classList.remove("hidden");$("detailtitle").textContent=`Combat #${eventId}`;$("detailbody").textContent="Chargement…";$("detail").scrollIntoView({behavior:"smooth"});
 let e=summary,detailWarning="";
 try{
  e=await get(`/events/${encodeURIComponent(eventId)}`);
 }catch(err){
  // Le résumé kill/death contient souvent déjà les joueurs et équipements.
  // On l'affiche quand même au lieu de laisser le rapport vide si /events échoue.
  detailWarning="Rapport complet indisponible ("+err.message+"). Informations du combat issues de la liste.";
 }
 try{
  const wrap=$("detailbody");wrap.replaceChildren();
  const sides=document.createElement("div");sides.className="sides";
  const combatPlayers=[e.Killer||e.killer||summary.Killer||summary.killer,e.Victim||e.victim||summary.Victim||summary.victim];
  let market=null,marketError="";
  try{market=await getBuildPrices(combatPlayers)}catch(err){marketError=err.message}
  [["TUEUR",combatPlayers[0],0],["VICTIME",combatPlayers[1],1]].forEach(([title,p,sideIndex])=>{
   const card=document.createElement("article");card.className="side";
   const h=document.createElement("h3");h.textContent=`${title} · ${p?.Name||"Inconnu"}`;
   const sub=document.createElement("p");sub.textContent=[p?.GuildName,p?.AllianceName].filter(Boolean).join(" · ")||"Sans guilde";
   const gear=document.createElement("div");gear.className="gear";
   const equipment=p?.Equipment||p?.equipment||{};
   const slots=[
    ["Bag","Sac"],["Head","Tête"],["Cape","Cape"],
    ["MainHand","Arme"],["Armor","Torse"],["OffHand","Main sec."],
    ["Food","Nourriture"],["Shoes","Chaussures"],["Potion","Potion"],
    ["Mount","Monture"]
   ];
   gear.classList.add("gear-layout");
   slots.forEach(([key,label])=>{
    const item=equipment[key]||equipment[key.toLowerCase()];
    const box=document.createElement("div");box.className="gear-slot"+(itemCode(item)?" has-item":"");box.title=label+(itemCode(item)?" : "+itemCode(item):"");
    const code=itemCode(item);
    if(code){
     const fallback=document.createElement("span");fallback.className="item-fallback";fallback.textContent=label.slice(0,2).toUpperCase();fallback.title=code;box.append(fallback);
     const img=document.createElement("img");
     img.loading="lazy";img.decoding="async";img.fetchPriority="low";img.alt=code;
     const quality=Number(item?.Quality??item?.quality??1)||1;
     img.src="https://render.albiononline.com/v1/item/"+encodeURIComponent(code)+".png?quality="+quality+"&size=64";
     img.onerror=()=>img.remove();
     box.append(img);
    }
    gear.append(box);
   });
   card.append(h,sub,gear);
   const price=document.createElement("div");price.className="build-price";
   if(marketError){price.textContent="Estimation indisponible";price.title=marketError}
   else if(market){
    const own=market.items.filter(x=>x.side===sideIndex);
    const total=own.reduce((sum,x)=>sum+(x.price||0),0),missing=own.filter(x=>!x.price).length;
    const caption=document.createElement("span");caption.textContent="ESTIMATION · MARTLOCK";
    const amount=document.createElement("strong");amount.textContent=total.toLocaleString("fr-FR")+" silver"+(missing?"*":"");
    const note=document.createElement("small");note.textContent=missing?missing+" objet(s) sans prix disponible":"Prix d’achat immédiat estimé";
    price.append(caption,amount,note);
   }
   card.append(price);sides.append(card);
  });
  const totalFame=fame(e)??fame(summary);const meta=document.createElement("p");meta.className="footnote combat-meta";meta.textContent=(totalFame==null?"Fame non renseignée":fmt(totalFame)+" fame")+" · "+dateText(e.TimeStamp||e.Timestamp||date(summary))+" · Zone : "+(zone(e)!=="Zone inconnue"?zone(e):zone(summary));
  wrap.append(sides,meta);
  if(detailWarning){const warning=document.createElement("p");warning.className="detail-warning";warning.textContent=detailWarning;wrap.append(warning)}
 }catch(err){$("detailbody").textContent=err.message;showError("Rapport de combat indisponible",err.message,"combat #"+eventId)}
}
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));filter=b.dataset.filter;render()}));
$("refresh").addEventListener("click",load);$("error-retry").addEventListener("click",load);$("close").addEventListener("click",()=>$("detail").classList.add("hidden"));load();