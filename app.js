const $ = (id) => document.getElementById(id);

const REGION_HOSTS = {
  europe: "https://gameinfo-ams.albiononline.com/api/gameinfo",
  west: "https://gameinfo.albiononline.com/api/gameinfo",
  east: "https://gameinfo-sgp.albiononline.com/api/gameinfo"
};

// L'ordre et la disposition des cases reprennent la disposition habituelle du panneau d'équipement Albion.
const EQUIPMENT_SLOTS = [
  ["Head", 0], ["Cape", 2], ["MainHand", 4],
  ["Armor", 3], ["OffHand", 1], ["Bag", 5],
  ["Shoes", 6], ["Mount", 8], ["Potion", 7],
  ["Food", 9], ["", 10], ["", 11]
];

function itemImage(item, size = 128) {
  if (!item || !item.Type) return "";
  const quality = Number(item.Quality || 1);
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(item.Type)}.png?quality=${quality}&size=${size}`;
}
function tierLabel(type = "") {
  const match = String(type).match(/^T(\d)/);
  return match ? `T${match[1]}` : "";
}
function safeText(value, fallback = "—") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}
function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat("fr-FR").format(n) : "—";
}
function setStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}
function createItemCard(item, className = "inventory-item") {
  const card = document.createElement("div");
  card.className = className + (item?.Type ? "" : " empty");
  if (!item?.Type) return card;

  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = item.Type;
  img.src = itemImage(item);
  img.onerror = () => { img.style.display = "none"; };
  card.appendChild(img);

  const tier = document.createElement("span");
  tier.className = "tier";
  tier.textContent = tierLabel(item.Type);
  card.appendChild(tier);

  const qtyValue = Number(item.Count || item.Amount || 0);
  if (qtyValue > 1) {
    const qty = document.createElement("span");
    qty.className = "qty";
    qty.textContent = formatNumber(qtyValue);
    card.appendChild(qty);
  }
  card.title = `${item.Type}${qtyValue > 1 ? ` × ${qtyValue}` : ""}`;
  return card;
}
function renderEquipment(containerId, equipment) {
  const container = $(containerId);
  container.replaceChildren();
  const gear = equipment || {};
  for (const [slot] of EQUIPMENT_SLOTS) {
    const item = slot ? gear[slot] : null;
    container.appendChild(createItemCard(item, "equip-slot"));
  }
}
function renderInventory(inventory) {
  const grid = $("victim-inventory");
  grid.replaceChildren();
  const items = Array.isArray(inventory) ? inventory.filter(item => item && item.Type) : [];
  if (!items.length) {
    const note = document.createElement("p");
    note.className = "combat-location";
    note.textContent = "Aucun objet d'inventaire transmis par l'API pour ce kill.";
    grid.appendChild(note);
    return;
  }
  items.forEach(item => grid.appendChild(createItemCard(item)));
}
function renderPlayer(prefix, player) {
  $(prefix + "-name").textContent = safeText(player?.Name, "Joueur inconnu");
  $(prefix + "-guild").textContent = safeText(player?.GuildName, "Sans guilde");
  $(prefix + "-alliance").textContent = player?.AllianceName ? `[${player.AllianceName}]` : "";
  $(prefix + "-ip").textContent = player?.AverageItemPower ? `IP ${Math.round(player.AverageItemPower)}` : "";
  renderEquipment(prefix + "-equipment", player?.Equipment || {});
}
function formatDate(value) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium", timeStyle: "short"
  }).format(date);
}
function renderEvent(event) {
  const killer = event.Killer || {};
  const victim = event.Victim || {};
  renderPlayer("killer", killer);
  renderPlayer("victim", victim);

  $("fame-value").textContent = formatNumber(event.TotalVictimKillFame);
  // L'API Gameinfo ne donne pas systématiquement une valeur Silver fiable.
  $("silver-value").textContent = "—";
  $("combat-date").textContent = formatDate(event.TimeStamp || event.Timestamp);
  $("combat-location").textContent = safeText(event.Location, `${safeText(event.NumberOfParticipants, "?")} participant(s)`);
  renderInventory(victim.Inventory || event.VictimInventory || []);
}

async function loadKill(eventId) {
  const id = String(eventId).trim();
  if (!/^\d+$/.test(id)) {
    setStatus("Entre un identifiant de kill numérique valide.", true);
    return;
  }
  const region = $("region").value;
  const url = `${REGION_HOSTS[region]}/events/${encodeURIComponent(id)}`;
  setStatus("Chargement du combat…");
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(response.status === 404 ? "Kill introuvable sur ce serveur." : `Erreur API (${response.status}).`);
    const event = await response.json();
    if (!event || (!event.Killer && !event.Victim)) throw new Error("Réponse API inattendue pour cet identifiant.");
    renderEvent(event);
    setStatus(`Kill #${id} chargé · serveur ${region}.`);
  } catch (error) {
    console.error(error);
    setStatus(`${error.message} Vérifie le serveur et l'identifiant. Si le navigateur bloque la requête (CORS), lance le site avec un petit serveur local et ajoute un proxy backend.`, true);
  }
}

function renderDemo() {
  const fakeGear = (prefix) => ({
    MainHand: {Type: `${prefix}_2H_BOW`}, OffHand: {Type: "T6_OFF_SHIELD"},
    Head: {Type: "T6_HEAD_PLATE_SET1"}, Armor: {Type: "T6_ARMOR_LEATHER_SET2"},
    Shoes: {Type: "T6_SHOES_LEATHER_SET1"}, Cape: {Type: "T6_CAPE"},
    Bag: {Type: "T6_BAG"}, Mount: {Type: "T5_MOUNT_HORSE"},
    Potion: {Type: "T6_POTION_HEAL"}, Food: {Type: "T7_MEAL_OMELETTE"}
  });
  renderPlayer("killer", {
    Name: "LeMax", GuildName: "La 7eme Compagnie", AllianceName: "", AverageItemPower: 1450,
    Equipment: fakeGear("T8")
  });
  renderPlayer("victim", {
    Name: "LiverWhisp3R", GuildName: "[NO] Squirtle Squad", AllianceName: "", AverageItemPower: 1320,
    Equipment: fakeGear("T7")
  });
  $("fame-value").textContent = "6 108 987";
  $("silver-value").textContent = "—";
  $("combat-date").textContent = "EXEMPLE DE PRÉSENTATION";
  $("combat-location").textContent = "Données fictives";
  renderInventory([
    {Type:"T6_POTION_HEAL",Count:9},{Type:"T8_HEAD_CLOTH_SET1",Count:1},
    {Type:"T8_2H_AXE",Count:1},{Type:"T7_ARMOR_LEATHER_SET1",Count:1},
    {Type:"T7_SHOES_LEATHER_SET1",Count:1},{Type:"T6_BAG",Count:1},
    {Type:"T6_CAPE",Count:1},{Type:"T5_FOOD",Count:100},
    {Type:"T6_RESOURCE_FIBER",Count:12},{Type:"T6_RESOURCE_HIDE",Count:19},
    {Type:"T6_ORE",Count:45},{Type:"T6_WOOD",Count:26}
  ]);
}

$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  loadKill($("event-id").value);
});

renderDemo();
