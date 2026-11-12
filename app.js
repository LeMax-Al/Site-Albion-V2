const API="https://site-albion-v2.maxbruneteau.workers.dev/api",NAME="LeMax", $=id=>document.getElementById(id);
let kills=[],deaths=[],filter="all",searchTerm="";
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
let currentPage="home",killSearch="",deathSearch="";
function combined(){return [...kills.map(e=>({...e,_type:"kill"})),...deaths.map(e=>({...e,_type:"death"}))].sort((a,b)=>new Date(date(b)||0)-new Date(date(a)||0))}
function matches(e,term){const p=e._type==="kill"?e.Victim:e.Killer;return !term||[p?.Name,p?.GuildName,zone(e)].some(v=>String(v||"").toLowerCase().includes(term))}
function buildRows(list,events){
 list.replaceChildren();
 if(!events.length){list.innerHTML='<div class="empty">Aucun événement trouvé.</div>';return}
 events.forEach(e=>{
  const type=e._type,person=type==="kill"?e.Victim:e.Killer;
  const row=document.createElement("div");row.className="event";
  const kind=document.createElement("div");kind.className=`kind ${type}`;kind.innerHTML=`<em>${type==="kill"?"⚔":"✕"}</em>${type==="kill"?"KILL":"MORT"}<small>#${val(id(e))}</small>`;
  const opp=document.createElement("div");opp.className="opponent";opp.textContent=person?.Name||"Adversaire inconnu";
  const guild=document.createElement("div");guild.className="guild";guild.textContent=person?.GuildName||"Sans guilde";
  const f=document.createElement("div");f.className="fame";f.textContent=fame(e)==null?"Fame —":fmt(fame(e));
  const z=document.createElement("div");z.className="zone";z.textContent=zone(e);z.title=z.textContent;
  const dt=document.createElement("div");dt.className="date";dt.textContent=dateText(date(e));
  const btn=document.createElement("button");btn.className="open";btn.textContent="↗";btn.title="Voir le rapport";btn.onclick=()=>detail(e);
  row.append(kind,opp,guild,z,f,dt,btn);list.append(row);
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
 $("stat-fame").textContent=fmt(fameTotal);
 $("avg-fame").textContent=kills.length?fmt(Math.round(fameTotal/kills.length)):"—";
 const zones={};all.forEach(e=>{const z=zone(e);if(z!=="Zone inconnue")zones[z]=(zones[z]||0)+1});
 const top=Object.entries(zones).sort((a,b)=>b[1]-a[1])[0];$("top-zone").textContent=top?top[0]:"—";
 renderCharts(all,zones);
}
function renderCharts(all,zones){
 const daily=$("daily-chart");daily.replaceChildren();
 const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);days.push(d)}
 const counts=days.map(d=>({label:new Intl.DateTimeFormat("fr-FR",{weekday:"short"}).format(d),k:0,m:0}));
 all.forEach(e=>{const d=new Date(date(e)||0);const item=counts.find((x,i)=>days[i].toDateString()===d.toDateString());if(item)item[e._type==="kill"?"k":"m"]++});
 const max=Math.max(1,...counts.map(x=>Math.max(x.k,x.m)));
 counts.forEach(x=>{const col=document.createElement("div");col.className="day-column";const bars=document.createElement("div");bars.className="day-bars";["k","m"].forEach(t=>{const b=document.createElement("i");b.className=t==="k"?"bar-kill":"bar-death";b.style.height=(x[t]/max*100)+"%";b.title=(t==="k"?"Kills ":"Morts ")+x[t];bars.append(b)});const label=document.createElement("small");label.textContent=x.label;col.append(bars,label);daily.append(col)});
 const kd=$("kd-chart");kd.replaceChildren();const total=kills.length+deaths.length;
 [["Kills",kills.length,"kill"],["Morts",deaths.length,"death"]].forEach(([label,n,type])=>{const line=document.createElement("div");line.className="kd-row";const top=document.createElement("div");top.className="kd-label";top.innerHTML="<span>"+label+"</span><b>"+n+"</b>";const track=document.createElement("div");track.className="kd-track";const fill=document.createElement("i");fill.className=type==="kill"?"kd-kill":"kd-death";fill.style.width=(total?n/total*100:0)+"%";track.append(fill);line.append(top,track);kd.append(line)});
 const zc=$("zone-chart");zc.replaceChildren();const topZones=Object.entries(zones).sort((a,b)=>b[1]-a[1]).slice(0,5);const maxZone=Math.max(1,...topZones.map(x=>x[1]));
 if(!topZones.length)zc.innerHTML='<div class="empty">Pas encore de données de zone.</div>';
 topZones.forEach(([name,n])=>{const row=document.createElement("div");row.className="zone-row";const title=document.createElement("div");title.className="zone-name";title.innerHTML="<span></span><b>"+n+"</b>";title.firstChild.textContent=name;const track=document.createElement("div");track.className="zone-track";const fill=document.createElement("i");fill.style.width=(n/maxZone*100)+"%";track.append(fill);row.append(title,track);zc.append(row)});
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
   card.append(h,sub,gear);
   card.append(h,sub,gear);sides.append(card);
  });
  const totalFame=fame(e)??fame(summary);const meta=document.createElement("p");meta.className="footnote combat-meta";meta.textContent=(totalFame==null?"Fame non renseignée":fmt(totalFame)+" fame")+" · "+dateText(e.TimeStamp||e.Timestamp||date(summary))+" · Zone : "+(zone(e)!=="Zone inconnue"?zone(e):zone(summary));
  wrap.append(sides,meta);
  if(detailWarning){const warning=document.createElement("p");warning.className="detail-warning";warning.textContent=detailWarning;wrap.append(warning)}
 }catch(err){$("detailbody").textContent=err.message;showError("Rapport de combat indisponible",err.message,"combat #"+eventId)}
}
document.querySelectorAll(".page-tab,[data-go]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page||b.dataset.go)));
$("search-kills").addEventListener("input",e=>{killSearch=e.target.value.trim().toLowerCase();render()});
$("search-deaths").addEventListener("input",e=>{deathSearch=e.target.value.trim().toLowerCase();render()});
$("refresh").addEventListener("click",load);$("error-retry").addEventListener("click",load);$("close").addEventListener("click",()=>$("detail").classList.add("hidden"));load();
