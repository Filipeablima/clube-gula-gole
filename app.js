let activeConfig = null;

function normalizeTime(value) {
  if (!value) return "";

  let text = String(value).trim();

  // Se vier como ISO/data, tenta extrair HH:mm
  const matchISO = text.match(/T(\d{2}):(\d{2})/);
  if (matchISO) {
    return `${matchISO[1]}:${matchISO[2]}`;
  }

  // Se vier como HH:mm:ss
  const matchFull = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (matchFull) {
    return `${matchFull[1]}:${matchFull[2]}`;
  }

  // Se vier como HH:mm
  const matchSimple = text.match(/^(\d{2}):(\d{2})$/);
  if (matchSimple) {
    return text;
  }

  return text;
}

function isWithinTime(start, end) {
  start = normalizeTime(start);
  end = normalizeTime(end);

  if (!start || !end) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Caso normal: 18:00 até 23:59
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  // Caso vire a madrugada: 18:00 até 02:00
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

async function loadCampaign() {
  try {
    const data = await jsonp({ action: "config" });

    if (!data.ok) {
      throw new Error(data.message || "Erro ao carregar configuração");
    }

    activeConfig = data.config;

    const campaignName = activeConfig.campaignName || "Rodada Premiada";
    const campaignDescription =
      activeConfig.campaignDescription || "Cadastre-se para participar.";

    const startTime = normalizeTime(activeConfig.startTime || "00:00");
    const endTime = normalizeTime(activeConfig.endTime || "23:59");

    document.getElementById("campaignTitle").textContent = campaignName;
    document.getElementById("campaignDesc").textContent = campaignDescription;

    const openNow = isWithinTime(startTime, endTime);

    if (!openNow) {
      const notice = document.getElementById("closedNotice");
      notice.textContent =
        `Cadastros fechados no momento. Horário permitido: ${startTime} às ${endTime}.`;
      notice.classList.remove("hidden");

      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      btn.textContent = "Cadastro fechado";
    } else {
      const notice = document.getElementById("closedNotice");
      notice.classList.add("hidden");

      const btn = document.getElementById("submitBtn");
      btn.disabled = false;
      btn.textContent = "Ativar localização e participar";
    }
  } catch (err) {
    document.getElementById("campaignTitle").textContent = "Clube Gula & Gole";
    document.getElementById("campaignDesc").textContent = err.message;
  }
}

document.getElementById("whatsapp").addEventListener("blur", (e) => {
  e.target.value = formatPhoneBR(e.target.value);
});

document.getElementById("participationForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Validando localização...";

  const name = document.getElementById("name").value.trim();
  const whatsapp = onlyDigits(document.getElementById("whatsapp").value);
  const tableNumber = document.getElementById("tableNumber").value.trim();

  if (name.split(" ").length < 2) {
    showBox("resultBox", "Informe nome e sobrenome.", "error");
    btn.disabled = false;
    btn.textContent = "Ativar localização e participar";
    return;
  }

  if (whatsapp.length < 10 || whatsapp.length > 11) {
    showBox("resultBox", "Informe um WhatsApp válido com DDD.", "error");
    btn.disabled = false;
    btn.textContent = "Ativar localização e participar";
    return;
  }

  if (!tableNumber || Number(tableNumber) <= 0) {
    showBox("resultBox", "Informe o número da mesa.", "error");
    btn.disabled = false;
    btn.textContent = "Ativar localização e participar";
    return;
  }

  if (!navigator.geolocation) {
    showBox("resultBox", "Seu celular não permitiu usar localização.", "error");
    btn.disabled = false;
    btn.textContent = "Ativar localização e participar";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        btn.textContent = "Enviando participação...";

        const data = await jsonp({
          action: "register",
          name,
          whatsapp,
          tableNumber,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || ""
        });

        if (data.ok) {
          showBox("resultBox", data.message || "Participação confirmada!", "success");
          document.getElementById("participationForm").reset();
        } else {
          showBox("resultBox", data.message || "Cadastro não validado.", "error");
        }
      } catch (err) {
        showBox("resultBox", err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Ativar localização e participar";
      }
    },
    () => {
      showBox("resultBox", "Para participar, ative a localização do celular.", "error");
      btn.disabled = false;
      btn.textContent = "Ativar localização e participar";
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    }
  );
});

loadCampaign();
