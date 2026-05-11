let activeCampaign = null;

function getUrlMesa(){
  const params = new URLSearchParams(window.location.search);
  return params.get("mesa") || "";
}

async function loadCampaign() {
  try {
    const data = await jsonp({ action: "config" });

    if (!data.ok) throw new Error(data.message || "Erro ao carregar campanha.");

    activeCampaign = data.campaign;

    if (!activeCampaign) {
      setText("campaignTitle", "Nenhuma campanha ativa");
      setText("campaignDesc", "Aguarde a próxima ação do Clube Gula & Gole.");
      const notice = document.getElementById("closedNotice");
      notice.textContent = "Não há campanha ativa neste momento.";
      notice.classList.remove("hidden");
      document.getElementById("submitBtn").disabled = true;
      document.getElementById("submitBtn").textContent = "Campanha fechada";
      return;
    }

    setText("campaignTitle", activeCampaign.nome);
    setText("campaignDesc", activeCampaign.descricao || "Cadastre-se para participar.");
    setText("campaignWindow", `${activeCampaign.inicioBR} até ${activeCampaign.fimBR}`);

    const mesaUrl = getUrlMesa();
    if(mesaUrl){
      document.getElementById("tableNumber").value = mesaUrl;
      document.getElementById("tableNumber").readOnly = true;
    }

    const isDelivery = activeCampaign.canal === "delivery";

    if (isDelivery) {
      document.getElementById("tableLabel").childNodes[0].nodeValue = "Mesa ou referência do pedido";
      document.getElementById("tableNumber").placeholder = "Ex.: delivery";
      document.getElementById("validationText").textContent =
        "Campanha válida conforme a regra informada pelo Gula & Gole.";
    } else {
      document.getElementById("tableLabel").childNodes[0].nodeValue = "Número da mesa";
      document.getElementById("tableNumber").placeholder = "Ex.: 12";
      document.getElementById("validationText").textContent =
        "Para validar sua participação, é necessário estar no Gula & Gole e permanecer presente no momento da campanha.";
    }

    const btn = document.getElementById("submitBtn");
    btn.disabled = false;
    btn.textContent = activeCampaign.botao || "Ativar localização e participar";

  } catch (err) {
    setText("campaignTitle", "Clube Gula & Gole");
    setText("campaignDesc", err.message);
  }
}

document.getElementById("whatsapp").addEventListener("blur", (e) => {
  e.target.value = formatPhoneBR(e.target.value);
});

document.getElementById("participationForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Validando...";

  const name = document.getElementById("name").value.trim();
  const whatsapp = onlyDigits(document.getElementById("whatsapp").value);
  const tableNumber = document.getElementById("tableNumber").value.trim();

  if (!activeCampaign) {
    showBox("resultBox", "Não há campanha ativa neste momento.", "error");
    btn.disabled = false;
    btn.textContent = "Participar";
    return;
  }

  if (name.split(" ").length < 2) {
    showBox("resultBox", "Informe nome e sobrenome.", "error");
    btn.disabled = false;
    btn.textContent = activeCampaign.botao || "Participar";
    return;
  }

  if (whatsapp.length < 10 || whatsapp.length > 11) {
    showBox("resultBox", "Informe um WhatsApp válido com DDD.", "error");
    btn.disabled = false;
    btn.textContent = activeCampaign.botao || "Participar";
    return;
  }

  if (activeCampaign.canal !== "delivery" && (!tableNumber || Number(tableNumber) <= 0)) {
    showBox("resultBox", "Informe o número da mesa.", "error");
    btn.disabled = false;
    btn.textContent = activeCampaign.botao || "Participar";
    return;
  }

  const send = async (lat="", lng="", accuracy="") => {
    try {
      btn.textContent = "Enviando participação...";
      const data = await jsonp({
        action: "register",
        campaignId: activeCampaign.id,
        name,
        whatsapp,
        tableNumber,
        lat,
        lng,
        accuracy
      });

      if (data.ok) {
        showBox("resultBox", data.message || "Participação confirmada!", "success");
        document.getElementById("participationForm").reset();
        const mesaUrl = getUrlMesa();
        if(mesaUrl) document.getElementById("tableNumber").value = mesaUrl;
      } else {
        showBox("resultBox", data.message || "Cadastro não validado.", "error");
      }
    } catch (err) {
      showBox("resultBox", err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = activeCampaign.botao || "Participar";
    }
  };

  if (String(activeCampaign.precisaLocalizacao).toUpperCase() !== "TRUE") {
    await send();
    return;
  }

  if (!navigator.geolocation) {
    showBox("resultBox", "Seu celular não permitiu usar localização.", "error");
    btn.disabled = false;
    btn.textContent = activeCampaign.botao || "Participar";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await send(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy || "");
    },
    () => {
      showBox("resultBox", "Para participar, ative a localização do celular.", "error");
      btn.disabled = false;
      btn.textContent = activeCampaign.botao || "Participar";
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
});

loadCampaign();
