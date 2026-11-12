const API="https://site-albion-v2.maxbruneteau.workers.dev/api",NAME="LeMax", $=id=>document.getElementById(id);
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
function fameText(el,value){if(value==null||!Number.isFinite(Number(value))){el.textContent="—";el.removeAttribute("data-exact-value");return}el.textContent=compact(value);el.dataset.exactValue=fmt(value)+" fame";el.setAttribute("aria-label",fmt(value)+" fame");el.setAttribute("role","button");el.setAttribute("tabindex","0");}
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
 msg(hasData?"Données enregistrées affichées · actualisation en cours…":"Première récupération du profil Albion…");
 try{
  // L'identifiant du personnage est conservé : on évite la recherche à chaque visite.
  if(!playerId){
   const search=await get("/search?q=LeMax");
   const players=Array.isArray(search)?search:Array.isArray(search?.players)?search.players:Array.isArray(search?.Players)?search.Players:Array.isArray(search?.data?.players)?search.data.players:[];
   const matches=players.filter(p=>(p?.Id||p?.id)&&String(p?.Name||p?.name||"").trim().toLowerCase()==="lemax");
   if(!matches.length)throw new Error("Le personnage exact « LeMax » n’a pas été trouvé sur Europe.");
   if(matches.length>1)throw new Error("Plusieurs personnages nommés LeMax existent.");
   playerId=matches[0].Id||matches[0].id;
  }
  const pid=encodeURIComponent(playerId);
  const [profile]=await Promise.all([get(`/players/${pid}`)]);
  // Synchronise le flux récent dans la base persistante puis charge l'archive complète.
  const sync=await get("/archive/sync");
  if(!sync?.ok)throw new Error(sync?.error||"Synchronisation de l'archive impossible");
  const [k,d]=await Promise.all([
   get("/archive/kills?limit=5000"),
   get("/archive/deaths?limit=5000")
  ]);
  profileData=profile;kills=arr(k);deaths=arr(d);
  applyProfile(profile);writeCache();render();
  $("updated").textContent=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"}).format(new Date());
  msg(`Profil actualisé · archive : ${kills.length} kills et ${deaths.length} morts enregistrés.`);
 }catch(e){
  console.error(e);
  if(hasData){
   msg("API Albion indisponible ou trop lente · affichage des dernières données enregistrées.",true);
   $("updated").textContent="Données en cache";
  }else{
   msg("Le chargement a échoué.",true);
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
  const btn=document.createElement("button");btn.className="open";btn.textContent="↗";btn.title="Voir le rapport";btn.onclick=()=>detail(e);
  row.append(kind,opp,guild,f,dt,btn);list.append(row);
 });
}
function render(){
 const all=combined(),recent=all.slice(0,6);
 buildRows($("home-events"),recent);
 buildRows($("kill-events"),kills.filter(e=>matches({...e,_type:"kill"},killSearch)));
 buildRows($("death-events"),deaths.filter(e=>matches({...e,_type:"death"},deathSearch)));
 $("kills").textContent=fmt(kills.length);$("deaths").textContent=fmt(deaths.length);
 $("kill-total").textContent=kills.length;$("death-total").textContent=deaths.length;
 $("stat-kills").textContent=fmt(kills.length);$("stat-deaths").textContent=fmt(deaths.length);
 const ratio=deaths.length? (kills.length/deaths.length):kills.length;
 const ratioText=Number(ratio).toFixed(2);
 $("ratio").textContent=ratioText;$("stat-ratio").textContent=ratioText;
 $("ratio-fill").style.width=(kills.length+deaths.length?100*kills.length/(kills.length+deaths.length):0)+"%";
 const fameTotal=kills.reduce((n,e)=>n+(fame(e)||0),0);
 fameText($("stat-fame"),fameTotal);
 fameText($("avg-fame"),kills.length?Math.round(fameTotal/kills.length):null);
 renderCharts(all);
}
let statsPeriod="days";
function periodLabel(){return ({days:"7 derniers jours",week:"12 dernières semaines",month:"12 derniers mois",year:"années disponibles"})[statsPeriod]}
function periodBuckets(){
 const now=new Date(),out=[];
 if(statsPeriod==="days"){for(let i=6;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);out.push({key:d.toDateString(),label:new Intl.DateTimeFormat("fr-FR",{weekday:"short"}).format(d)})}}
 else if(statsPeriod==="week"){for(let i=11;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7)-7*i);out.push({key:d.toISOString().slice(0,10),label:"S"+String(Math.ceil((d.getDate()+((new Date(d.getFullYear(),d.getMonth(),1).getDay()+6)%7))/7)).padStart(2,"0")})}}
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
 const daily=$("daily-chart");daily.replaceChildren();daily.style.setProperty("--bucket-count",Math.max(1,counts.length));daily.dataset.bucketCount=String(counts.length);const max=Math.max(1,...counts.map(x=>Math.max(x.k,x.m)));
 counts.forEach(x=>{const col=document.createElement("div");col.className="day-column";const bars=document.createElement("div");bars.className="day-bars";["k","m"].forEach(t=>{const b=document.createElement("i");b.className=t==="k"?"bar-kill":"bar-death";b.style.height=(x[t]/max*100)+"%";b.dataset.exactValue=(t==="k"?"Kills : ":"Morts : ")+fmt(x[t]);b.setAttribute("tabindex","0");b.setAttribute("role","button");b.setAttribute("aria-label",b.dataset.exactValue);bars.append(b)});const label=document.createElement("small");label.textContent=x.label;col.append(bars,label);daily.append(col)});
 const kd=$("kd-chart");kd.replaceChildren();const total=filtered.k+filtered.m;
 [["Kills",filtered.k,"kill"],["Morts",filtered.m,"death"]].forEach(([label,n,type])=>{const line=document.createElement("div");line.className="kd-row";const top=document.createElement("div");top.className="kd-label";top.innerHTML="<span>"+label+"</span><b>"+fmt(n)+"</b>";const track=document.createElement("div");track.className="kd-track";const fill=document.createElement("i");fill.className=type==="kill"?"kd-kill":"kd-death";fill.style.width=(total?n/total*100:0)+"%";track.append(fill);line.append(top,track);kd.append(line)});
}
function setPage(page){
 currentPage=page;document.querySelectorAll(".page-tab").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
 $("detail").classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"});
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
  const totalFame=fame(e)??fame(summary);const meta=document.createElement("p");meta.className="footnote combat-meta";meta.textContent=(totalFame==null?"Fame non renseignée":compact(totalFame)+" fame")+" · "+dateText(e.TimeStamp||e.Timestamp||date(summary));if(totalFame!=null){meta.title=fmt(totalFame)+" fame";meta.setAttribute("aria-label",fmt(totalFame)+" fame")}
  wrap.append(sides,meta);
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
  const existing=exactTarget.querySelector(":scope > .value-reveal");
  if(existing){existing.remove();exactTarget.setAttribute("aria-expanded","false");}
  else{
   document.querySelectorAll(".value-reveal").forEach(node=>node.remove());
   const reveal=document.createElement("span");
   reveal.className="value-reveal";
   reveal.textContent=exactTarget.dataset.exactValue;
   exactTarget.append(reveal);
   exactTarget.setAttribute("aria-expanded","true");
  }
  return;
 }
 const tip=event.target.closest("[data-tooltip]");
 if(tip){document.querySelectorAll('[data-tip-open="true"]').forEach(el=>{if(el!==tip)el.removeAttribute("data-tip-open")});tip.toggleAttribute("data-tip-open");}
 else document.querySelectorAll('[data-tip-open="true"]').forEach(el=>el.removeAttribute("data-tip-open"));
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
$("refresh").addEventListener("click",load);$("error-retry").addEventListener("click",load);$("close").addEventListener("click",()=>$("detail").classList.add("hidden"));const initialCache=readCache();if(hydrateCache(initialCache)){msg("Dernières données enregistrées affichées · actualisation…")}load();
