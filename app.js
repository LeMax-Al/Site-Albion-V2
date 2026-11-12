const API="https://site-albion-v2.maxbruneteau.workers.dev/api",NAME="LeMax", $=id=>document.getElementById(id);
try{const n=document.getElementById("notice");if(n)n.textContent="JavaScript chargé · initialisation du profil…"}catch(e){}
let kills=[],deaths=[],filter="all",searchTerm="",playerId=null,profileData=null;
const CACHE_KEY="lemax-albion-dashboard-v2";
function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||"null")}catch{return null}}
function writeCache(){try{localStorage.setItem(CACHE_KEY,JSON.stringify({playerId,profile:profileData,kills,deaths,savedAt:Date.now()}))}catch(e){console.warn("Cache local indisponible",e)}}
function applyProfile(profile){
 profileData=profile;
 $("name").textContent=profile.Name||NAME;
 $("guild").textContent=[profile.GuildName,profile.AllianceName?[`[${profile.AllianceName}]`]:null].filter(Boolean).join(" · ")||"Aucune guilde renseignée";
 const stats=profile.LifetimeStatistics||{};
 const lifetimePvp=stats.PvP?.Total??stats.PvP?.total??stats.KillFame??profile.KillFame??profile.TotalKillFame;
 fameText($("fame"),lifetimePvp);
 $("guildstat").textContent=profile.GuildName||"—";$("guildsub").textContent=profile.GuildName||"Guilde actuelle";
}
function hydrateCache(c){
 if(!c?.playerId||!c?.profile)return false;
 playerId=c.playerId;profileData=c.profile;kills=Array.isArray(c.kills)?c.kills:[];deaths=Array.isArray(c.deaths)?c.deaths:[];
 applyProfile(profileData);render();
 $("updated").textContent=c.savedAt?new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"}).format(new Date(c.savedAt)):"—";
 return true;
}
const fmt=v=>Number.isFinite(Number(v))?new Intl.NumberFormat("fr-FR").format(Number(v)):"—";
const compact=v=>{const n=Number(v);if(!Number.isFinite(n))return "—";const abs=Math.abs(n);if(abs>=1e6)return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(n/1e6)+"M";if(abs>=1e3)return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(n/1e3)+"k";return fmt(n)};
function fameText(el,value){
 if(value==null||!Number.isFinite(Number(value))){el.textContent="—";el.removeAttribute("data-exact-value");el.removeAttribute("data-short-value");return}
 el.textContent=compact(value);el.dataset.shortValue=compact(value);el.dataset.exactValue=fmt(value)+" fame";el.setAttribute("aria-label","Cliquer pour afficher "+el.dataset.exactValue);el.setAttribute("role","button");el.setAttribute("tabindex","0");
}
const val=(v,d="—")=>v==null||v===""?d:String(v);
async function get(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(API+path,{method:"GET",mode:"cors",cache:"default",redirect:"follow",headers:{Accept:"application/json"},signal:controller.signal});
  if(!response.ok)throw new Error("HTTP "+response.status+" pour "+path);
  try{return await response.json()}catch{throw new Error("Réponse invalide pour "+path)}
 }catch(err){
  if(err?.name==="AbortError")throw new Error("Délai dépassé après 12 secondes ("+path+")");
  if(err instanceof TypeError)throw new Error("Connexion réseau impossible ("+path+")");
  throw err;
 }finally{clearTimeout(timer)}
}
function msg(s,error=false){$("notice").textContent=s;$("notice").classList.toggle("error",error)}
function showError(title,message,stage=""){const p=$("error-panel");p.classList.remove("hidden");$("error-title").textContent=title;$("error-message").textContent=message;$("error-stage").textContent=stage?"Étape : "+stage:""}
function clearError(){$("error-panel").classList.add("hidden")}
function id(e){return e.EventId??e.eventId??e.Id??e.id}
function date(e){return e.TimeStamp||e.Timestamp||e.timeStamp}
function arr(x){return Array.isArray(x)?x:(x?.Events||x?.events||[])}
function fame(e){const n=e?.TotalVictimKillFame??e?.totalVictimKillFame??e?.KillFame??e?.Victim?.KillFame??e?.victim?.KillFame??e?.Victim?.DeathFame;return n==null||!Number.isFinite(Number(n))?null:Number(n)}
function itemCode(item){return String(item?.Type??item?.type??item?.UniqueName??item?.uniqueName??"").trim()}
function dateText(v){if(!v)return"Date inconnue";const d=new Date(v);return isNaN(d)?String(v):new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(d)}
async function load(){
 $("refresh").disabled=true;clearError();
 const hasData=!!(playerId&&profileData);
 msg(hasData?"Données enregistrées affichées · actualisation en cours…":"Recherche du profil LeMax…");
 try{
  if(!playerId){
   const search=await get("/search?q="+encodeURIComponent(NAME));
   const players=Array.isArray(search)?search:Array.isArray(search?.players)?search.players:Array.isArray(search?.Players)?search.Players:Array.isArray(search?.data?.players)?search.data.players:[];
   const matches=players.filter(p=>(p?.Id||p?.id)&&String(p?.Name||p?.name||"").trim().toLowerCase()===NAME.toLowerCase());
   if(!matches.length)throw new Error("Le personnage exact « "+NAME+" » n’a pas été trouvé sur Europe.");
   if(matches.length>1)throw new Error("Plusieurs personnages nommés "+NAME+" existent.");
   playerId=matches[0].Id||matches[0].id;
  }
  msg("Profil trouvé · récupération des informations du personnage…");
  const profile=await get("/players/"+encodeURIComponent(playerId));
  // Affiche le profil dès qu'il est disponible : l'archive ne doit plus bloquer l'écran de chargement.
  profileData=profile;applyProfile(profile);writeCache();
  msg("Profil chargé · synchronisation des combats en arrière-plan…");
  $("updated").textContent=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"}).format(new Date());
  $("refresh").disabled=false;
  try{
   const sync=await get("/archive/sync");
   if(!sync?.ok)throw new Error(sync?.error||"Synchronisation de l'archive impossible");
   const [k,d]=await Promise.all([get("/archive/kills?limit=5000"),get("/archive/deaths?limit=5000")]);
   kills=arr(k);deaths=arr(d);writeCache();render();
   msg("Profil actualisé · archive : "+kills.length+" kills et "+deaths.length+" morts enregistrés.");
  }catch(archiveError){
   console.warn("Archive indisponible, conservation des combats déjà chargés",archiveError);
   render();
   msg("Profil chargé · archive des combats temporairement indisponible. Réessaie avec Actualiser.",true);
  }
 }catch(e){
  console.error(e);
  if(hasData){
   msg("API Albion indisponible · dernières données enregistrées affichées.",true);
   $("updated").textContent="Données en cache";
  }else{
   msg("Le chargement du profil a échoué.",true);
   showError("Impossible de récupérer le profil",e.message,"récupération API Albion");
  }
 }finally{$("refresh").disabled=false}
}
let currentPage="home",killSearch="",deathSearch="";
function combined(){return [...kills.map(e=>({...e,_type:"kill"})),...deaths.map(e=>({...e,_type:"death"}))].sort((a,b)=>new Date(date(b)||0)-new Date(date(a)||0))}
function matches(e,term){const p=e._type==="kill"?e.Victim:e.Killer;return !term||[p?.Name,p?.GuildName].some(v=>String(v||"").toLowerCase().includes(term))}
function buildRows(list,events){
 list.replaceChildren();
 if(!events.length){list.innerHTML='<div class="empty">Aucun événement trouvé.</div>';return}
 events.forEach(e=>{
  const type=e._type,person=type==="kill"?e.Victim:e.Killer;
  const row=document.createElement("div");row.className="event";
  const kind=document.createElement("div");kind.className=`kind ${type}`;kind.innerHTML=`<em>${type==="kill"?"⚔":"✕"}</em>${type==="kill"?"KILL":"MORT"}<small>#${val(id(e))}</small>`;
  const opp=document.createElement("div");opp.className="opponent";opp.textContent=person?.Name||"Adversaire inconnu";
  const guild=document.createElement("div");guild.className="guild";guild.textContent=person?.GuildName||"Sans guilde";
  const f=document.createElement("div");f.className="fame";fameText(f,fame(e));
  const dt=document.createElement("div");dt.className="date";dt.textContent=dateText(date(e));
  const btn=document.createElement("button");btn.className="open gear-open";btn.textContent="Stuff";btn.title="Afficher les équipements du tueur et de la victime";btn.setAttribute("aria-label","Voir les équipements des deux joueurs du combat "+id(e));btn.onclick=()=>detail(e,row);
  row.append(kind,opp,guild,f,dt,btn);list.append(row);
 });
}
function render(){
 const all=combined(),recent=all.slice(0,6);
 buildRows($("home-events"),recent);
 buildRows($("kill-events"),kills.filter(e=>matches({...e,_type:"kill"},killSearch)).map(e=>({...e,_type:"kill"})));
 buildRows($("death-events"),deaths.filter(e=>matches({...e,_type:"death"},deathSearch)).map(e=>({...e,_type:"death"})));
 $("kills").textContent=fmt(kills.length);$("deaths").textContent=fmt(deaths.length);
 $("kill-total").textContent=kills.length;$("death-total").textContent=deaths.length;
 $("stat-kills").textContent=fmt(kills.length);$("stat-deaths").textContent=fmt(deaths.length);
 const ratio=deaths.length? (kills.length/deaths.length):kills.length;
 const ratioText=Number(ratio).toFixed(2);
 $("ratio").textContent=ratioText;$("stat-ratio").textContent=ratioText;
 $("ratio-fill").style.width=(kills.length+deaths.length?100*kills.length/(kills.length+deaths.length):0)+"%";
 const fameTotal=kills.reduce((n,e)=>n+(fame(e)||0),0);
 const deathFameTotal=deaths.reduce((n,e)=>n+(fame(e)||0),0);
 const killFames=kills.map(e=>fame(e)).filter(v=>v!=null&&v>0);
 const deathFames=deaths.map(e=>fame(e)).filter(v=>v!=null&&v>0);
 fameText($("stat-fame"),fameTotal);
 fameText($("avg-fame"),kills.length?Math.round(fameTotal/kills.length):null);
 $("quick-kills").textContent=fmt(kills.length);
 $("quick-deaths").textContent=fmt(deaths.length);
 fameText($("quick-total-fame"),fameTotal);
 fameText($("quick-best-kill"),killFames.length?Math.max(...killFames):null);
 fameText($("quick-death-fame"),deathFames.length?Math.round(deathFameTotal/deathFames.length):null);
 $("quick-net").textContent=(kills.length-deaths.length>0?"+":"")+fmt(kills.length-deaths.length);
 $("quick-net").style.color=kills.length>=deaths.length?"var(--green)":"var(--red)";
 renderCharts(all);
}
let statsPeriod="days";
function periodLabel(){return ({days:"7 derniers jours",week:"12 dernières semaines",month:"12 derniers mois",year:"années disponibles"})[statsPeriod]}
function periodBuckets(){
 const now=new Date(),out=[];
 if(statsPeriod==="days"){for(let i=6;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);out.push({key:d.toDateString(),label:new Intl.DateTimeFormat("fr-FR",{weekday:"short"}).format(d)})}}
 else if(statsPeriod==="week"){for(let i=11;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7)-7*i);const end=new Date(d);end.setDate(end.getDate()+6);const shortDate=x=>String(x.getDate()).padStart(2,"0")+"/"+String(x.getMonth()+1).padStart(2,"0");out.push({key:d.toISOString().slice(0,10),label:shortDate(d)+" → "+shortDate(end)})}}
 else if(statsPeriod==="month"){for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push({key:d.getFullYear()+"-"+d.getMonth(),label:new Intl.DateTimeFormat("fr-FR",{month:"short"}).format(d)})}}
 else {const years=[...new Set([...kills,...deaths].map(e=>new Date(date(e)||0).getFullYear()).filter(y=>Number.isFinite(y)&&y>1970))].sort((a,b)=>a-b);years.forEach(y=>out.push({key:String(y),label:String(y)}));if(!out.length)out.push({key:String(now.getFullYear()),label:String(now.getFullYear())})}
 return out;
}
function bucketKey(v){const d=new Date(v||0);if(isNaN(d))return "";if(statsPeriod==="days")return d.toDateString();if(statsPeriod==="week"){d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toISOString().slice(0,10)}if(statsPeriod==="month")return d.getFullYear()+"-"+d.getMonth();return String(d.getFullYear())}
function renderCharts(all){
 const buckets=periodBuckets(),counts=buckets.map(b=>({...b,k:0,m:0}));
 all.forEach(e=>{const item=counts.find(x=>x.key===bucketKey(date(e)));if(item)item[e._type==="kill"?"k":"m"]++});
 const filtered=counts.reduce((a,x)=>({k:a.k+x.k,m:a.m+x.m}),{k:0,m:0});
 $("chart-period-label").textContent=periodLabel();
 $("period-kills").textContent=fmt(filtered.k);$("period-deaths").textContent=fmt(filtered.m);
 $("period-ratio").textContent=(filtered.m?filtered.k/filtered.m:filtered.k).toFixed(2);
 const daily=$("daily-chart");daily.replaceChildren();daily.style.setProperty("--bucket-count",Math.max(1,counts.length));daily.style.gridTemplateColumns=`repeat(${Math.max(1,counts.length)},minmax(0,1fr))`;daily.dataset.bucketCount=String(counts.length);const max=Math.max(1,...counts.map(x=>Math.max(x.k,x.m)));
 counts.forEach(x=>{const col=document.createElement("button");col.type="button";col.className="day-column bucket-select";col.dataset.bucketKey=x.key;col.setAttribute("aria-label","Afficher les combats : "+x.label);const bars=document.createElement("div");bars.className="day-bars";["k","m"].forEach(t=>{const b=document.createElement("i");b.className=t==="k"?"bar-kill":"bar-death";b.style.height=(x[t]/max*100)+"%";b.dataset.exactValue=(t==="k"?"Kills : ":"Morts : ")+fmt(x[t]);b.setAttribute("tabindex","0");b.setAttribute("role","button");b.setAttribute("aria-label",b.dataset.exactValue);bars.append(b)});const label=document.createElement("small");label.textContent=statsPeriod==="week"?x.label.replace(" → ","\n"):x.label;label.className=statsPeriod==="week"?"week-date-label":"";col.append(bars,label);daily.append(col)});
 const kd=$("kd-chart");kd.replaceChildren();const total=filtered.k+filtered.m;
 [["Kills",filtered.k,"kill"],["Morts",filtered.m,"death"]].forEach(([label,n,type])=>{const line=document.createElement("div");line.className="kd-row";const top=document.createElement("div");top.className="kd-label";top.innerHTML="<span>"+label+"</span><b>"+fmt(n)+"</b>";const track=document.createElement("div");track.className="kd-track";const fill=document.createElement("i");fill.className=type==="kill"?"kd-kill":"kd-death";fill.style.width=(total?n/total*100:0)+"%";track.append(fill);line.append(top,track);kd.append(line)});
}
function setPage(page){
 currentPage=page;document.querySelectorAll(".page-tab").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
 $("detail").classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"});
}
async function detail(summary,triggerRow){
 const eventId=id(summary);if(!eventId)return;
 let detailPanel=$("detail");
 // Sécurité : si le panneau a été retiré du DOM ou si une ancienne version HTML est encore servie,
 // le reconstruire plutôt que de faire échouer l'ouverture du rapport.
 if(!(detailPanel instanceof Element)){
  detailPanel=document.createElement("section");
  detailPanel.id="detail";detailPanel.className="detail panel hidden";
  const head=document.createElement("div");head.className="detailhead";
  const titleWrap=document.createElement("div");
  const eyebrow=document.createElement("div");eyebrow.className="eyebrow";eyebrow.textContent="ANALYSE DE RENCONTRE";
  const title=document.createElement("h2");title.id="detailtitle";title.textContent="Détail du combat";
  titleWrap.append(eyebrow,title);
  const closeButton=document.createElement("button");closeButton.id="close";closeButton.type="button";closeButton.textContent="Fermer";closeButton.addEventListener("click",()=>detailPanel.classList.add("hidden"));
  head.append(titleWrap,closeButton);
  const body=document.createElement("div");body.id="detailbody";
  detailPanel.append(head,body);
  ( $("page-home")||document.body ).append(detailPanel);
 }
 let detailTitle=$("detailtitle"),detailBody=$("detailbody");
 if(!(detailTitle instanceof Element)){detailTitle=document.createElement("h2");detailTitle.id="detailtitle";detailPanel.prepend(detailTitle)}
 if(!(detailBody instanceof Element)){detailBody=document.createElement("div");detailBody.id="detailbody";detailPanel.append(detailBody)}
 if(triggerRow instanceof Element && triggerRow.parentNode)triggerRow.parentNode.insertBefore(detailPanel,triggerRow.nextSibling);
 detailPanel.dataset.eventId=String(eventId);
 detailPanel.classList.remove("hidden");
 detailTitle.textContent=`Combat #${eventId}`;
 detailBody.textContent="Chargement du rapport…";
 detailPanel.scrollIntoView({behavior:"smooth",block:"nearest"});
 const cacheKey="lemax-combat-report-cache-v1";
 const cacheTtl=7*24*60*60*1000;
 let hasCache=false;
 try{
  const store=JSON.parse(localStorage.getItem(cacheKey)||"{}");
  const entry=store[String(eventId)];
  if(entry?.data && Date.now()-Number(entry.savedAt||0)<cacheTtl){
   hasCache=true;
   renderCombatReport(summary,entry.data,"");
   const cachedLabel=document.createElement("p");
   cachedLabel.className="inventory-note cache-status";
   cachedLabel.textContent="Rapport affiché depuis le cache local · vérification de l’archive Cloudflare…";
   $("detailbody").append(cachedLabel);
  }
 }catch(cacheError){console.warn("Cache du rapport illisible",cacheError)}
 try{
  const archivedResponse=await get(`/archive/report/${encodeURIComponent(eventId)}`);
  const fresh=archivedResponse?.event||archivedResponse;
  // Les statistiques détaillées d'une bataille sont exposées par un endpoint distinct.
  const battleId=fresh?.BattleId??fresh?.battleId??summary?.BattleId??summary?.battleId;
  if(battleId!=null){
   try{fresh._BattleData=await get(`/battles/${encodeURIComponent(battleId)}`)}
   catch(battleError){console.warn("Données de bataille indisponibles",battleId,battleError)}
   // Le flux des kills de la bataille peut contenir une version plus complète de l'événement.
   try{
    const battleEventsResponse=await get(`/events/battle/${encodeURIComponent(battleId)}?limit=51&offset=0`);
    const battleEvents=Array.isArray(battleEventsResponse)?battleEventsResponse:(battleEventsResponse?.events||battleEventsResponse?.Events||[]);
    const sameEvent=battleEvents.find(item=>String(item?.EventId??item?.eventId??item?.Id??item?.id)===String(eventId));
    if(sameEvent){
     if(!(Array.isArray(fresh.Participants)&&fresh.Participants.length)&&Array.isArray(sameEvent.Participants))fresh.Participants=sameEvent.Participants;
     if(!(Array.isArray(fresh.GroupMembers)&&fresh.GroupMembers.length)&&Array.isArray(sameEvent.GroupMembers))fresh.GroupMembers=sameEvent.GroupMembers;
    }
   }catch(battleEventsError){console.warn("Événements détaillés de bataille indisponibles",battleId,battleEventsError)}
  }
  try{
   const store=JSON.parse(localStorage.getItem(cacheKey)||"{}");
   store[String(eventId)]={savedAt:Date.now(),data:fresh};
   const keys=Object.keys(store).sort((a,b)=>(Number(store[b]?.savedAt)||0)-(Number(store[a]?.savedAt)||0));
   keys.slice(60).forEach(key=>delete store[key]);
   localStorage.setItem(cacheKey,JSON.stringify(store));
  }catch(cacheError){console.warn("Impossible d’enregistrer le rapport dans le cache",cacheError)}
  if(detailPanel.dataset.eventId===String(eventId))renderCombatReport(summary,fresh,"");
 }catch(err){
  if(detailPanel.dataset.eventId===String(eventId)){
   if(!hasCache)renderCombatReport(summary,summary,"Rapport complet indisponible ("+err.message+"). Informations issues de la liste du combat.");
   else{
    const status=document.createElement("p");status.className="inventory-note cache-status";
    status.textContent="Cache local conservé · archive Cloudflare temporairement inaccessible.";
    $("detailbody").append(status);
   }
  }
 }
}
function renderCombatReport(summary,e,detailWarning){
 const eventId=id(summary);
 try{
  const wrap=$("detailbody");wrap.replaceChildren();
  const modeBar=document.createElement("div");modeBar.className="combat-view-tabs";
  const equipmentTab=document.createElement("button");equipmentTab.type="button";equipmentTab.className="combat-view-tab active";equipmentTab.textContent="Équipement porté";
  const inventoryTab=document.createElement("button");inventoryTab.type="button";inventoryTab.className="combat-view-tab";inventoryTab.textContent="Inventaire transporté";
  const alliesTab=document.createElement("button");alliesTab.type="button";alliesTab.className="combat-view-tab";alliesTab.textContent="Assistants & groupe";
  modeBar.append(equipmentTab,inventoryTab,alliesTab);
  const sides=document.createElement("div");sides.className="sides";
  [["TUEUR",e.Killer||e.killer||summary.Killer||summary.killer],["VICTIME",e.Victim||e.victim||summary.Victim||summary.victim]].forEach(([title,p])=>{
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
   card.append(h,sub,gear);sides.append(card);
  });
  const inventorySides=document.createElement("div");inventorySides.className="sides inventory-sides hidden";
  let inventoryAvailable=false;
  [["TUEUR",e.Killer||e.killer||summary.Killer||summary.killer],["VICTIME",e.Victim||e.victim||summary.Victim||summary.victim]].forEach(([title,p])=>{
   const card=document.createElement("article");card.className="side";
   const heading=document.createElement("h3");heading.textContent=title+" · "+(p?.Name||"Inconnu");
   const inv=p?.Inventory??p?.inventory;
   const items=Array.isArray(inv)?inv.map((item,index)=>({key:String(index),item})):inv&&typeof inv==="object"?Object.entries(inv).filter(([,item])=>item!=null).map(([key,item])=>({key,item})):[];
   const grid=document.createElement("div");grid.className="inventory-grid";
   items.forEach(({key,item})=>{
    const code=itemCode(item);if(!code)return;
    inventoryAvailable=true;
    const quantity=Number(item?.Count??item?.count??item?.Amount??item?.amount??1)||1;
    const cell=document.createElement("div");cell.className="inventory-item";cell.title=code+" · x"+quantity;
    const img=document.createElement("img");img.loading="lazy";img.decoding="async";img.alt=code;img.src="https://render.albiononline.com/v1/item/"+encodeURIComponent(code)+".png?quality="+(Number(item?.Quality??item?.quality??1)||1)+"&size=96";img.onerror=()=>img.remove();
    const name=document.createElement("span");name.textContent=code;
    const count=document.createElement("b");count.textContent="×"+quantity;
    cell.append(img,name,count);grid.append(cell);
   });
   if(!items.length||!grid.childElementCount){const empty=document.createElement("p");empty.className="inventory-empty";empty.textContent="Inventaire non transmis pour ce joueur dans les données de cet événement.";card.append(heading,empty)}
   else card.append(heading,grid);
   inventorySides.append(card);
  });
  const alliesPanel=document.createElement("div");alliesPanel.className="allies-panel hidden";
  const killer=e.Killer||e.killer||summary.Killer||summary.killer;
  const victim=e.Victim||e.victim||summary.Victim||summary.victim;
  const playerKey=p=>String(p?.Id??p?.id??p?.Name??p?.name??"").trim().toLowerCase();
  const participantList=Array.isArray(e.Participants)?e.Participants:Array.isArray(e.participants)?e.participants:[];
  const rawGroupList=Array.isArray(e.GroupMembers)?e.GroupMembers:Array.isArray(e.groupMembers)?e.groupMembers:[];
  const battle=e._BattleData||e.battleData||null;
  const rawBattlePlayers=battle?.players??battle?.Players??battle?.participants??battle?.Participants??{};
  const battlePlayerList=Array.isArray(rawBattlePlayers)?rawBattlePlayers:Object.entries(rawBattlePlayers||{}).map(([key,value])=>({Id:value?.Id??value?.id??key,...(value||{})}));
  const battleById=new Map(battlePlayerList.map(p=>[playerKey(p),p]).filter(([key])=>key));
  const groupList=rawGroupList.map(p=>({...((battleById.get(playerKey(p))||{})),...p,Equipment:p.Equipment||p.equipment||(battleById.get(playerKey(p))||{}).Equipment}));
  const mainKeys=new Set([playerKey(killer),playerKey(victim)].filter(Boolean));
  const assistants=participantList.filter(p=>p&&typeof p==="object"&&!mainKeys.has(playerKey(p)));
  const battleParticipants=battlePlayerList.filter(p=>p&&typeof p==="object"&&!mainKeys.has(playerKey(p)));
  function renderCombatTable(title,players,emptyText){
   const section=document.createElement("details");section.className="combat-roster";section.open=false;
   const heading=document.createElement("summary");heading.className="combat-roster-toggle";heading.textContent=title+" · "+players.length;
   section.append(heading);
   if(!players.length){const empty=document.createElement("p");empty.className="inventory-empty";empty.textContent=emptyText;section.append(empty);return section}
   const metricDefs=[
    {label:"IP moyen",keys:["AverageItemPower","averageItemPower"],format:v=>Math.round(v).toString()},
    {label:"Kills",keys:["kills","Kills","killCount","KillCount"]},
    {label:"Morts",keys:["deaths","Deaths","deathCount","DeathCount"]},
    {label:"Fame kill",keys:["killFame","KillFame","totalKillFame","TotalKillFame"]},
    {label:"Dégâts",keys:["DamageDone","damageDone","Damage","damage"]},
    {label:"Soins",keys:["HealingDone","healingDone","Healing","healing"]},
    {label:"Soins soutien",keys:["SupportHealingDone","supportHealingDone","SupportHealing","supportHealing"]}
   ];
   const metricValue=(p,keys)=>{
    for(const key of keys){const raw=p?.[key];if(raw!==undefined&&raw!==null&&raw!==""&&Number.isFinite(Number(raw))&&Number(raw)>0)return Number(raw)}
    return null;
   };
   const rows=players.map(p=>({p,bp:battleById.get(playerKey(p))||p}));
   // Ne garder que les colonnes de statistiques qui contiennent au moins une vraie valeur.
   const visibleMetrics=metricDefs.filter(def=>rows.some(({p,bp})=>metricValue(bp,def.keys)??metricValue(p,def.keys))!==null);
   const scroll=document.createElement("div");scroll.className="roster-scroll";
   const table=document.createElement("table");table.className="roster-table";
   const thead=document.createElement("thead"),headRow=document.createElement("tr");
   ["Joueur","Guilde / alliance",...visibleMetrics.map(def=>def.label),"Équipement porté"].forEach(label=>{const th=document.createElement("th");th.textContent=label;headRow.append(th)});
   thead.append(headRow);table.append(thead);
   const tbody=document.createElement("tbody");
   rows.forEach(({p,bp})=>{
    const tr=document.createElement("tr");
    const nameCell=document.createElement("td");nameCell.className="roster-name";nameCell.textContent=p.Name||p.name||"Joueur inconnu";
    const guildCell=document.createElement("td");guildCell.textContent=[p.GuildName||p.guildName,p.AllianceName||p.allianceName].filter(Boolean).join(" · ")||"—";
    const metricCells=visibleMetrics.map(def=>{
     const cell=document.createElement("td");
     const value=metricValue(bp,def.keys)??metricValue(p,def.keys);
     cell.textContent=value===null?"—":(def.format?def.format(value):fmt(value));
     return cell;
    });
    const gearCell=document.createElement("td");const gearLine=document.createElement("div");gearLine.className="roster-gear";
    const equipment=p.Equipment||p.equipment||bp.Equipment||bp.equipment||{};
    const slotNames=[["MainHand","Arme"],["OffHand","Main sec."],["Head","Tête"],["Armor","Torse"],["Shoes","Chaussures"],["Bag","Sac"],["Cape","Cape"],["Mount","Monture"],["Food","Nourriture"],["Potion","Potion"]];
    let gearCount=0;
    slotNames.forEach(([slot,label])=>{
     const item=equipment[slot]??equipment[slot.toLowerCase()];const code=itemCode(item);if(!code)return;gearCount++;
     const icon=document.createElement("img");icon.loading="lazy";icon.decoding="async";icon.alt=label+": "+code;icon.title=label+": "+code+" · qualité "+(item?.Quality??item?.quality??1);
     icon.src="https://render.albiononline.com/v1/item/"+encodeURIComponent(code)+".png?quality="+(Number(item?.Quality??item?.quality??1)||1)+"&size=48";icon.onerror=()=>icon.remove();gearLine.append(icon);
    });
    if(!gearCount){const missing=document.createElement("span");missing.className="roster-no-gear";missing.textContent="Équipement non transmis";gearLine.append(missing)}
    gearCell.append(gearLine);tr.append(nameCell,guildCell,...metricCells,gearCell);tbody.append(tr);
   });
   table.append(tbody);
   // Deuxième vérification sur le rendu final : si toutes les cellules d'une statistique
   // affichent "—", supprimer réellement son en-tête et toutes ses cellules.
   const headerCells=Array.from(thead.rows[0]?.cells||[]);
   for(let col=headerCells.length-2;col>=2;col--){
    const cells=Array.from(tbody.rows).map(row=>row.cells[col]).filter(Boolean);
    if(cells.length&&cells.every(cell=>cell.textContent.trim()==="—")){
     headerCells[col].remove();
     tbody.querySelectorAll("tr").forEach(row=>row.cells[col]?.remove());
    }
   }
   scroll.append(table);section.append(scroll);return section;
  }
  if(battle&&typeof battle==="object"){
   const totalPlayers=battle.totalPlayers??battle.playersCount??(Array.isArray(battlePlayerList)?battlePlayerList.length:0);
   const totalKills=battle.totalKills??battle.kills;
   const totalFame=battle.totalFame??battle.fame;
   const hasSummary=(Number(totalPlayers)>0)||(Number(totalKills)>0)||(Number(totalFame)>0);
   if(hasSummary){
    const battleSummary=document.createElement("p");battleSummary.className="inventory-note";
    const parts=[];if(Number(totalPlayers)>0)parts.push("Joueurs : "+fmt(totalPlayers));if(Number(totalKills)>0)parts.push("Kills : "+fmt(totalKills));if(Number(totalFame)>0)parts.push("Fame : "+fmt(totalFame));
    battleSummary.textContent=parts.join(" · ");alliesPanel.append(battleSummary);
   }
  }
  alliesPanel.append(
   renderCombatTable("Assistants (participants de l’événement)",assistants,"Albion ne transmet aucun participant individuel pour cet événement."),
   renderCombatTable("Groupe et alliés",groupList,"Aucun membre de groupe transmis par l’API pour ce combat.")
  );
  if(battlePlayerList.length)alliesPanel.append(renderCombatTable("Participants de la bataille",battleParticipants,"Aucun participant transmis pour cette bataille."));
  const showInventory=()=>{sides.classList.add("hidden");inventorySides.classList.remove("hidden");alliesPanel.classList.add("hidden");equipmentTab.classList.remove("active");inventoryTab.classList.add("active");alliesTab.classList.remove("active")};
  const showEquipment=()=>{inventorySides.classList.add("hidden");alliesPanel.classList.add("hidden");sides.classList.remove("hidden");inventoryTab.classList.remove("active");equipmentTab.classList.add("active");alliesTab.classList.remove("active")};
  const showAllies=()=>{sides.classList.add("hidden");inventorySides.classList.add("hidden");alliesPanel.classList.remove("hidden");equipmentTab.classList.remove("active");inventoryTab.classList.remove("active");alliesTab.classList.add("active")};
  equipmentTab.addEventListener("click",showEquipment);inventoryTab.addEventListener("click",showInventory);alliesTab.addEventListener("click",showAllies);
  if(!inventoryAvailable){const note=document.createElement("p");note.className="inventory-note";note.textContent="L’API Albion ne transmet pas toujours le contenu de l’inventaire. Si les données sont absentes, aucun objet ne sera inventé.";inventorySides.append(note)}
  const totalFame=fame(e)??fame(summary);const meta=document.createElement("p");meta.className="footnote combat-meta";meta.textContent=(totalFame==null?"Fame non renseignée":compact(totalFame)+" fame")+" · "+dateText(e.TimeStamp||e.Timestamp||date(summary));if(totalFame!=null){meta.title=fmt(totalFame)+" fame";meta.setAttribute("aria-label",fmt(totalFame)+" fame")}
  wrap.append(modeBar,sides,inventorySides,alliesPanel,meta);
  if(detailWarning){const warning=document.createElement("p");warning.className="detail-warning";warning.textContent=detailWarning;wrap.append(warning)}
 }catch(err){$("detailbody").textContent=err.message;showError("Rapport de combat indisponible",err.message,"combat #"+eventId)}
}

document.querySelectorAll(".page-tab,[data-go]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page||b.dataset.go)));
$("search-kills").addEventListener("input",e=>{killSearch=e.target.value.trim().toLowerCase();render()});
$("search-deaths").addEventListener("input",e=>{deathSearch=e.target.value.trim().toLowerCase();render()});
document.addEventListener("click",event=>{
 const exactTarget=event.target.closest("[data-exact-value]");
 if(exactTarget){
  event.preventDefault();
  if(exactTarget.dataset.shortValue){
   const expanded=exactTarget.dataset.expanded==="true";
   exactTarget.textContent=expanded?exactTarget.dataset.shortValue:exactTarget.dataset.exactValue;
   exactTarget.dataset.expanded=String(!expanded);
  }else{
   const old=exactTarget.querySelector(".value-reveal");
   if(old){old.remove();exactTarget.dataset.expanded="false";}
   else{
    document.querySelectorAll(".value-reveal").forEach(node=>node.remove());
    const reveal=document.createElement("span");reveal.className="value-reveal chart-value-popover";reveal.textContent=exactTarget.dataset.exactValue;
    document.body.append(reveal);
    const rect=exactTarget.getBoundingClientRect();
    const popupRect=reveal.getBoundingClientRect();
    const popupWidth=popupRect.width,popupHeight=popupRect.height;
    const chart=exactTarget.closest(".chart-panel")||exactTarget.closest("#page-stats")||document.documentElement;
    const bounds=chart.getBoundingClientRect();
    const minLeft=Math.max(8,bounds.left+8);
    const maxLeft=Math.min(window.innerWidth-popupWidth-8,bounds.right-popupWidth-8);
    const left=Math.max(minLeft,Math.min(maxLeft,rect.left+rect.width/2-popupWidth/2));
    const minTop=Math.max(8,bounds.top+8);
    const maxTop=Math.min(window.innerHeight-popupHeight-8,bounds.bottom-popupHeight-8);
    const preferredTop=rect.top-popupHeight-9;
    const top=Math.max(minTop,Math.min(maxTop,preferredTop));
    reveal.style.left=left+"px";reveal.style.top=top+"px";
    exactTarget.dataset.expanded="true";
   }
  }
  return;
 }
 const tip=event.target.closest("[data-tooltip]");
 if(tip){document.querySelectorAll('[data-tip-open="true"]').forEach(el=>{if(el!==tip)el.removeAttribute("data-tip-open")});tip.toggleAttribute("data-tip-open");}
 else document.querySelectorAll('[data-tip-open="true"]').forEach(el=>el.removeAttribute("data-tip-open"));
 const bucket=event.target.closest("[data-bucket-key]");
 if(bucket){
  event.preventDefault();
  const key=bucket.dataset.bucketKey;
  const events=combined().filter(e=>bucketKey(date(e))===key);
  const killsIn=events.filter(e=>e._type==="kill"),deathsIn=events.filter(e=>e._type==="death");
  $("bucket-title").textContent="Combats · "+bucket.querySelector("small").textContent.replace("\\n"," → ");
  $("bucket-count-kills").textContent=fmt(killsIn.length);
  $("bucket-count-deaths").textContent=fmt(deathsIn.length);
  buildRows($("bucket-kills"),killsIn);
  buildRows($("bucket-deaths"),deathsIn);
  $("bucket-events").classList.remove("hidden");
  document.querySelectorAll(".bucket-select").forEach(el=>el.classList.toggle("selected",el===bucket));
  $("bucket-events").scrollIntoView({behavior:"smooth",block:"nearest"});
  return;
 }
 const button=event.target.closest("[data-stats-period]");
 if(!button)return;
 event.preventDefault();
 const next=button.getAttribute("data-stats-period");
 if(!["days","week","month","year"].includes(next))return;
 statsPeriod=next;
 document.querySelectorAll("[data-stats-period]").forEach(item=>{
  const active=item===button;
  item.classList.toggle("active",active);
  item.setAttribute("aria-pressed",String(active));
 });
 renderCharts(combined());
});
// Démarrage sécurisé : une erreur d'interface ne doit jamais empêcher le chargement du profil.
try{
 if($("bucket-close"))$("bucket-close").addEventListener("click",()=>{$("bucket-events").classList.add("hidden");document.querySelectorAll(".bucket-select").forEach(el=>el.classList.remove("selected"))});
 if($("refresh"))$("refresh").addEventListener("click",load);
 if($("error-retry"))$("error-retry").addEventListener("click",load);
 if($("close"))$("close").addEventListener("click",()=>{$("detail").classList.add("hidden");const home=$("page-home");home.appendChild($("detail"));});
 const initialCache=readCache();
 if(hydrateCache(initialCache))msg("Données en cache affichées · actualisation du profil…");
}catch(bootError){console.error("Erreur interface au démarrage",bootError);msg("Interface démarrée · récupération du profil…",true)}
load().catch(error=>{console.error("Erreur fatale de chargement",error);msg("Erreur pendant la récupération du profil : "+error.message,true);if($("refresh"))$("refresh").disabled=false});
window.addEventListener("error",event=>{console.error("Erreur JavaScript",event.error||event.message);msg("Erreur JavaScript : "+String(event.message||"inconnue"),true)});
window.addEventListener("unhandledrejection",event=>{console.error("Erreur asynchrone",event.reason);msg("Erreur réseau ou chargement : "+String(event.reason?.message||event.reason||"inconnue"),true)});
