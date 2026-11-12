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
function fameText(el,value){if(value==null||!Number.isFinite(Number(value))){el.textContent="—";el.removeAttribute("title");el.removeAttribute("aria-label");return}el.textContent=compact(value);el.title=fmt(value);el.setAttribute("aria-label",fmt(value)+" fame");}
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
  const [profile,k,d]=await Promise.all([
   get(`/players/${pid}`),
   get(`/players/${pid}/kills?limit=20`),
   get(`/players/${pid}/deaths?limit=20`)
  ]);
  profileData=profile;kills=arr(k);deaths=arr(d);
  applyProfile(profile);writeCache();render();
  $("updated").textContent=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"}).format(new Date());
  msg(`Profil actualisé · ${kills.length} kills et ${deaths.length} morts · cache local mis à jour.`);
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
function renderCharts(all){
 const daily=$("daily-chart");daily.replaceChildren();
 const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);days.push(d)}
 const counts=days.map(d=>({label:new Intl.DateTimeFormat("fr-FR",{weekday:"short"}).format(d),k:0,m:0}));
 all.forEach(e=>{const d=new Date(date(e)||0);const item=counts.find((x,i)=>days[i].toDateString()===d.toDateString());if(item)item[e._type==="kill"?"k":"m"]++});
 const max=Math.max(1,...counts.map(x=>Math.max(x.k,x.m)));
 counts.forEach(x=>{const col=document.createElement("div");col.className="day-column";const bars=document.createElement("div");bars.className="day-bars";["k","m"].forEach(t=>{const b=document.createElement("i");b.className=t==="k"?"bar-kill":"bar-death";b.style.height=(x[t]/max*100)+"%";b.title=(t==="k"?"Kills ":"Morts ")+x[t];bars.append(b)});const label=document.createElement("small");label.textContent=x.label;col.append(bars,label);daily.append(col)});
 const kd=$("kd-chart");kd.replaceChildren();const total=kills.length+deaths.length;
 [["Kills",kills.length,"kill"],["Morts",deaths.length,"death"]].forEach(([label,n,type])=>{const line=document.createElement("div");line.className="kd-row";const top=document.createElement("div");top.className="kd-label";top.innerHTML="<span>"+label+"</span><b>"+n+"</b>";const track=document.createElement("div");track.className="kd-track";const fill=document.createElement("i");fill.className=type==="kill"?"kd-kill":"kd-death";fill.style.width=(total?n/total*100:0)+"%";track.append(fill);line.append(top,track);kd.append(line)});
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
$("refresh").addEventListener("click",load);$("error-retry").addEventListener("click",load);$("close").addEventListener("click",()=>$("detail").classList.add("hidden"));const initialCache=readCache();if(hydrateCache(initialCache)){msg("Dernières données enregistrées affichées · actualisation…")}load();
