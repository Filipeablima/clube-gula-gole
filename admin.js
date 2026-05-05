let currentPin = "";

async function loadAdmin(){
  currentPin = document.getElementById("adminPin").value.trim();
  if(!currentPin){
    alert("Digite o PIN do admin.");
    return;
  }

  try{
    const data = await jsonp({action:"adminData", pin:currentPin});
    if(!data.ok) throw new Error(data.message || "Não autorizado.");

    fillConfig(data.config);
    fillStats(data);
    fillTable(data.entries || []);
  }catch(err){
    alert(err.message);
  }
}

function fillConfig(c){
  document.getElementById("campaignName").value = c.campaignName || "";
  document.getElementById("campaignDescription").value = c.campaignDescription || "";
  document.getElementById("campaignType").value = c.campaignType || "sorteio";
  document.getElementById("startTime").value = c.startTime || "";
  document.getElementById("endTime").value = c.endTime || "";
  document.getElementById("tableLimit").value = c.tableLimit || "";
  document.getElementById("phoneLimit").value = c.phoneLimit || "";
  document.getElementById("restaurantLat").value = c.restaurantLat || "";
  document.getElementById("restaurantLng").value = c.restaurantLng || "";
  document.getElementById("radiusMeters").value = c.radiusMeters || "";
}

function fillStats(data){
  document.getElementById("totalCount").textContent = data.total || 0;
  document.getElementById("validCount").textContent = data.valid || 0;
  document.getElementById("tableCount").textContent = data.validTables?.length || 0;
  document.getElementById("blockedCount").textContent = data.blocked || 0;
}

function fillTable(entries){
  const tbody = document.getElementById("entriesTable");
  tbody.innerHTML = "";
  entries.forEach(e=>{
    const tr = document.createElement("tr");
    const statusClass = e.status === "VALIDO" ? "valid" : "blocked";
    tr.innerHTML = `
      <td>${e.time || ""}</td>
      <td>${e.name || ""}</td>
      <td>${e.whatsapp || ""}</td>
      <td>${e.tableNumber || ""}</td>
      <td><span class="badge ${statusClass}">${e.status || ""}</span></td>
      <td>${e.reason || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function saveConfig(){
  if(!currentPin){
    currentPin = document.getElementById("adminPin").value.trim();
  }
  if(!currentPin){
    alert("Digite o PIN do admin.");
    return;
  }

  try{
    const params = {
      action:"saveConfig",
      pin:currentPin,
      campaignName:document.getElementById("campaignName").value,
      campaignDescription:document.getElementById("campaignDescription").value,
      campaignType:document.getElementById("campaignType").value,
      startTime:document.getElementById("startTime").value,
      endTime:document.getElementById("endTime").value,
      tableLimit:document.getElementById("tableLimit").value,
      phoneLimit:document.getElementById("phoneLimit").value,
      restaurantLat:document.getElementById("restaurantLat").value,
      restaurantLng:document.getElementById("restaurantLng").value,
      radiusMeters:document.getElementById("radiusMeters").value
    };

    const data = await jsonp(params);
    if(!data.ok) throw new Error(data.message || "Erro ao salvar.");
    showBox("configResult", "Configurações salvas.", "success");
    loadAdmin();
  }catch(err){
    showBox("configResult", err.message, "error");
  }
}
