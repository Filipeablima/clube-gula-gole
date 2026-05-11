let currentPin = "";
let campaignsCache = [];
let entriesCache = [];
let settingsCache = {};

function showSection(id){
  document.querySelectorAll(".panel-section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".nav button").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
}

async function loadAdmin(){
  currentPin = document.getElementById("adminPin").value.trim();
  if(!currentPin){
    alert("Digite o PIN do admin.");
    return;
  }

  try{
    const data = await jsonp({action:"adminData", pin:currentPin});
    if(!data.ok) throw new Error(data.message || "Não autorizado.");

    settingsCache = data.settings || {};
    campaignsCache = data.campaigns || [];
    entriesCache = data.entries || [];

    fillSettings(settingsCache);
    fillStats(data);
    fillCampaigns(campaignsCache);
    fillEntries(entriesCache);

    if(data.activeCampaign){
      setText("activeCampaignText", `${data.activeCampaign.nome} | ${data.activeCampaign.inicio} até ${data.activeCampaign.fim}`);
    }else{
      setText("activeCampaignText", "Nenhuma campanha ativa neste momento.");
    }

    document.getElementById("baseUrl").value = window.location.origin + window.location.pathname.replace("admin.html", "");
  }catch(err){
    alert(err.message);
  }
}

function fillSettings(s){
  document.getElementById("restaurantLat").value = safe(s.restaurantLat);
  document.getElementById("restaurantLng").value = safe(s.restaurantLng);
  document.getElementById("radiusMeters").value = safe(s.radiusMeters);
  document.getElementById("maxTableNumber").value = safe(s.maxTableNumber);
}

function fillStats(data){
  setText("totalCount", data.total || 0);
  setText("validCount", data.valid || 0);
  setText("tableCount", data.validTables?.length || 0);
  setText("blockedCount", data.blocked || 0);
}

function fillCampaigns(campaigns){
  const tbody = document.getElementById("campaignsTable");
  tbody.innerHTML = "";
  campaigns.forEach(c=>{
    const tr = document.createElement("tr");
    const activeClass = String(c.ativa).toUpperCase() === "TRUE" ? "active" : "inactive";
    tr.innerHTML = `
      <td>${c.id}</td>
      <td>${c.nome}</td>
      <td>${c.tipo}</td>
      <td>${c.canal}</td>
      <td>${c.inicio}</td>
      <td>${c.fim}</td>
      <td><span class="badge ${activeClass}">${c.ativa}</span></td>
      <td><button class="secondary" onclick="editCampaign('${c.id}')">Editar</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function fillEntries(entries){
  const tbody = document.getElementById("entriesTable");
  tbody.innerHTML = "";
  entries.forEach(e=>{
    const statusClass = e.status === "VALIDO" ? "valid" : "blocked";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.time || ""}</td>
      <td>${e.campaignName || ""}</td>
      <td>${e.name || ""}</td>
      <td>${e.whatsapp || ""}</td>
      <td>${e.tableNumber || ""}</td>
      <td><span class="badge ${statusClass}">${e.status || ""}</span></td>
      <td>${e.reason || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterEntries(){
  const q = document.getElementById("searchInput").value.toLowerCase();
  const filtered = entriesCache.filter(e => JSON.stringify(e).toLowerCase().includes(q));
  fillEntries(filtered);
}

function exportEntriesCSV(){
  const rows = [["Hora","Campanha","Nome","WhatsApp","Mesa/ref.","Status","Motivo"]];
  entriesCache.forEach(e => rows.push([e.time, e.campaignName, e.name, e.whatsapp, e.tableNumber, e.status, e.reason]));
  downloadCSV("participantes-clube-gula-gole.csv", rows);
}

function editCampaign(id){
  const c = campaignsCache.find(x => String(x.id) === String(id));
  if(!c) return;
  document.getElementById("campaignId").value = c.id || "";
  document.getElementById("campaignName").value = c.nome || "";
  document.getElementById("campaignType").value = c.tipo || "sorteio";
  document.getElementById("campaignDescription").value = c.descricao || "";
  document.getElementById("campaignChannel").value = c.canal || "restaurante";
  document.getElementById("campaignStart").value = c.inicio || "";
  document.getElementById("campaignEnd").value = c.fim || "";
  document.getElementById("campaignActive").value = String(c.ativa).toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
  document.getElementById("tableLimit").value = c.limiteMesa || "";
  document.getElementById("phoneLimit").value = c.limiteWhats || "";
  document.getElementById("needsLocation").value = String(c.precisaLocalizacao).toUpperCase() === "FALSE" ? "FALSE" : "TRUE";
  document.getElementById("buttonText").value = c.botao || "";
  showSectionProgrammatic("campaigns");
}

function showSectionProgrammatic(id){
  document.querySelectorAll(".panel-section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function clearCampaignForm(){
  ["campaignId","campaignName","campaignDescription","campaignStart","campaignEnd","tableLimit","phoneLimit","buttonText"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("campaignType").value = "sorteio";
  document.getElementById("campaignChannel").value = "restaurante";
  document.getElementById("campaignActive").value = "TRUE";
  document.getElementById("needsLocation").value = "TRUE";
}

async function saveSettings(){
  if(!currentPin) currentPin = document.getElementById("adminPin").value.trim();
  try{
    const data = await jsonp({
      action:"saveSettings",
      pin:currentPin,
      restaurantLat:document.getElementById("restaurantLat").value,
      restaurantLng:document.getElementById("restaurantLng").value,
      radiusMeters:document.getElementById("radiusMeters").value,
      maxTableNumber:document.getElementById("maxTableNumber").value
    });
    if(!data.ok) throw new Error(data.message || "Erro ao salvar.");
    showBox("settingsResult", "Dados fixos salvos.", "success");
    loadAdmin();
  }catch(err){
    showBox("settingsResult", err.message, "error");
  }
}

async function saveCampaign(){
  if(!currentPin) currentPin = document.getElementById("adminPin").value.trim();
  try{
    const params = {
      action:"saveCampaign",
      pin:currentPin,
      id:document.getElementById("campaignId").value,
      nome:document.getElementById("campaignName").value,
      tipo:document.getElementById("campaignType").value,
      descricao:document.getElementById("campaignDescription").value,
      canal:document.getElementById("campaignChannel").value,
      inicio:document.getElementById("campaignStart").value,
      fim:document.getElementById("campaignEnd").value,
      ativa:document.getElementById("campaignActive").value,
      limiteMesa:document.getElementById("tableLimit").value,
      limiteWhats:document.getElementById("phoneLimit").value,
      precisaLocalizacao:document.getElementById("needsLocation").value,
      botao:document.getElementById("buttonText").value
    };
    const data = await jsonp(params);
    if(!data.ok) throw new Error(data.message || "Erro ao salvar.");
    showBox("campaignResult", "Campanha salva.", "success");
    loadAdmin();
  }catch(err){
    showBox("campaignResult", err.message, "error");
  }
}

function generateQrLinks(){
  const base = document.getElementById("baseUrl").value.trim();
  const max = Number(settingsCache.maxTableNumber || 60);
  const tbody = document.getElementById("qrTable");
  tbody.innerHTML = "";
  for(let i=1;i<=max;i++){
    const link = base.replace(/\/?$/, "/") + "?mesa=" + i;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i}</td><td>${link}</td>`;
    tbody.appendChild(tr);
  }
}
