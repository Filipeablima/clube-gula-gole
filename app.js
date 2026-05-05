let activeConfig = null;

async function loadCampaign(){
  try{
    const data = await jsonp({action:"config"});
    if(!data.ok) throw new Error(data.message || "Erro ao carregar configuração");
    activeConfig = data.config;

    document.getElementById("campaignTitle").textContent = data.config.campaignName || "Campanha ativa";
    document.getElementById("campaignDesc").textContent = data.config.campaignDescription || "Cadastre-se para participar.";

    if(!data.config.isOpen){
      const notice = document.getElementById("closedNotice");
      notice.textContent = "Cadastros fechados no momento. Horário permitido: " + data.config.startTime + " às " + data.config.endTime + ".";
      notice.classList.remove("hidden");
      document.getElementById("submitBtn").disabled = true;
      document.getElementById("submitBtn").textContent = "Cadastro fechado";
    }
  }catch(err){
    document.getElementById("campaignTitle").textContent = "Clube Gula & Gole";
    document.getElementById("campaignDesc").textContent = err.message;
  }
}

document.getElementById("whatsapp").addEventListener("blur", (e)=>{
  e.target.value = formatPhoneBR(e.target.value);
});

document.getElementById("participationForm").addEventListener("submit", async (e)=>{
  e.preventDefault();

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Validando localização...";

  const name = document.getElementById("name").value.trim();
  const whatsapp = onlyDigits(document.getElementById("whatsapp").value);
  const tableNumber = document.getElementById("tableNumber").value.trim();

  if(name.split(" ").length < 2){
    showBox("resultBox", "Informe nome e sobrenome.", "error");
    btn.disabled = false; btn.textContent = "Ativar localização e participar";
    return;
  }

  if(whatsapp.length < 10 || whatsapp.length > 11){
    showBox("resultBox", "Informe um WhatsApp válido com DDD.", "error");
    btn.disabled = false; btn.textContent = "Ativar localização e participar";
    return;
  }

  if(!navigator.geolocation){
    showBox("resultBox", "Seu celular não permitiu usar localização.", "error");
    btn.disabled = false; btn.textContent = "Ativar localização e participar";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos)=>{
    try{
      btn.textContent = "Enviando participação...";

      const data = await jsonp({
        action:"register",
        name,
        whatsapp,
        tableNumber,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy || ""
      });

      if(data.ok){
        showBox("resultBox", data.message || "Participação confirmada!", "success");
        document.getElementById("participationForm").reset();
      }else{
        showBox("resultBox", data.message || "Cadastro não validado.", "error");
      }
    }catch(err){
      showBox("resultBox", err.message, "error");
    }finally{
      btn.disabled = false;
      btn.textContent = "Ativar localização e participar";
    }
  }, ()=>{
    showBox("resultBox", "Para participar, ative a localização do celular.", "error");
    btn.disabled = false;
    btn.textContent = "Ativar localização e participar";
  }, {
    enableHighAccuracy:true,
    timeout:12000,
    maximumAge:0
  });
});

loadCampaign();
