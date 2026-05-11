/****************************************************
 * CLUBE GULA & GOLE — GOOGLE APPS SCRIPT V2
 * GitHub Pages + Google Sheets
 ****************************************************/

const SPREADSHEET_ID = "1281Zlzx3yUMRaarU-9K0wr6oJwzkMK6yVBQ09K3vdMA";
const ADMIN_PIN = "1234";

const SHEETS = {
  CONFIG: "CONFIG",
  CADASTROS: "CADASTROS",
  CAMPANHAS: "CAMPANHAS",
  GANHADORES: "GANHADORES"
};

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  createSheetIfMissing_(ss, SHEETS.CONFIG, ["campo", "valor"]);
  createSheetIfMissing_(ss, SHEETS.CADASTROS, [
    "timestamp", "data", "hora", "campanha_id", "campanha_nome", "nome", "whatsapp", "mesa_ref",
    "latitude", "longitude", "precisao", "distancia_metros", "status", "motivo"
  ]);
  createSheetIfMissing_(ss, SHEETS.CAMPANHAS, [
    "id", "nome", "tipo", "descricao", "canal", "inicio", "fim", "ativa",
    "limiteMesa", "limiteWhats", "precisaLocalizacao", "botao"
  ]);
  createSheetIfMissing_(ss, SHEETS.GANHADORES, [
    "timestamp", "data", "hora", "campanha_id", "campanha_nome", "mesa_sorteada", "observacao"
  ]);

  setConfigDefaults_();

  const campanhas = ss.getSheetByName(SHEETS.CAMPANHAS);
  if (campanhas.getLastRow() < 2) {
    const hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");

    campanhas.appendRow([
      "RP-" + hoje.replaceAll("-", ""),
      "Rodada Premiada",
      "sorteio",
      "Cadastre-se e concorra à rodada de hoje.",
      "restaurante",
      hoje + " 00:00",
      hoje + " 23:59",
      "TRUE",
      "2",
      "1",
      "TRUE",
      "Ativar localização e participar"
    ]);
  }
}

function doGet(e) {
  try {
    const p = e.parameter || {};
    const action = p.action || "config";
    let result;

    if (action === "config") result = getPublicConfig_();
    else if (action === "register") result = register_(p);
    else if (action === "adminData") result = adminData_(p);
    else if (action === "saveSettings") result = saveSettings_(p);
    else if (action === "saveCampaign") result = saveCampaign_(p);
    else if (action === "drawData") result = drawData_(p);
    else if (action === "registerWinner") result = registerWinner_(p);
    else result = { ok: false, message: "Ação inválida." };

    return jsonp_(p.callback, result);
  } catch (err) {
    return jsonp_((e.parameter || {}).callback, {
      ok: false,
      message: err.message
    });
  }
}

function getPublicConfig_() {
  const campaign = getActiveCampaign_();

  return {
    ok: true,
    campaign: campaign ? publicCampaign_(campaign) : null
  };
}

function register_(p) {
  const settings = getSettings_();
  const timezone = settings.timezone || "America/Sao_Paulo";
  const campaign = getCampaignById_(p.campaignId) || getActiveCampaign_();

  if (!campaign) {
    return { ok: false, message: "Não há campanha ativa neste momento." };
  }

  if (!isCampaignOpen_(campaign)) {
    return { ok: false, message: "Campanha fora do horário permitido." };
  }

  const now = new Date();
  const date = Utilities.formatDate(now, timezone, "yyyy-MM-dd");
  const time = Utilities.formatDate(now, timezone, "HH:mm:ss");

  const name = sanitize_(p.name);
  const whatsapp = onlyDigits_(p.whatsapp);
  const tableNumber = String(p.tableNumber || "").trim();
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const accuracy = p.accuracy || "";

  let status = "VALIDO";
  let reason = "Participação confirmada.";

  const requiresLocation = String(campaign.precisaLocalizacao).toUpperCase() === "TRUE";
  const isDelivery = campaign.canal === "delivery";

  if (!name || name.split(" ").length < 2) {
    status = "BLOQUEADO";
    reason = "Informe nome e sobrenome.";
  } else if (whatsapp.length < 10 || whatsapp.length > 11) {
    status = "BLOQUEADO";
    reason = "WhatsApp inválido.";
  } else if (!isDelivery && (!tableNumber || Number(tableNumber) < 1 || Number(tableNumber) > Number(settings.maxTableNumber || 60))) {
    status = "BLOQUEADO";
    reason = "Mesa inválida.";
  } else if (requiresLocation && (isNaN(lat) || isNaN(lng))) {
    status = "BLOQUEADO";
    reason = "Localização não informada.";
  }

  const distance = (!isNaN(lat) && !isNaN(lng))
    ? distanceMeters_(lat, lng, Number(settings.restaurantLat), Number(settings.restaurantLng))
    : "";

  if (status === "VALIDO" && requiresLocation && distance > Number(settings.radiusMeters || 50)) {
    status = "BLOQUEADO";
    reason = "Localização fora do raio permitido.";
  }

  const existing = getTodayEntries_();

  if (status === "VALIDO") {
    const phoneCount = existing.filter(r =>
      r.campaignId === campaign.id &&
      r.whatsapp === whatsapp &&
      r.status === "VALIDO"
    ).length;

    if (phoneCount >= Number(campaign.limiteWhats || 1)) {
      status = "BLOQUEADO";
      reason = "Este WhatsApp já está participando desta campanha.";
    }
  }

  if (status === "VALIDO" && !isDelivery) {
    const tableCount = existing.filter(r =>
      r.campaignId === campaign.id &&
      String(r.tableNumber) === String(tableNumber) &&
      r.status === "VALIDO"
    ).length;

    if (tableCount >= Number(campaign.limiteMesa || 2)) {
      status = "BLOQUEADO";
      reason = "Esta mesa já atingiu o limite de participantes.";
    }
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CADASTROS);

  sheet.appendRow([
    now,
    date,
    time,
    campaign.id,
    campaign.nome,
    name,
    whatsapp,
    tableNumber,
    lat || "",
    lng || "",
    accuracy,
    distance,
    status,
    reason
  ]);

  return {
    ok: status === "VALIDO",
    status,
    message: reason
  };
}

function adminData_(p) {
  checkPin_(p.pin);

  const settings = getSettings_();
  const campaigns = getCampaigns_();
  const entries = getTodayEntries_();
  const active = getActiveCampaign_();

  const validEntries = entries.filter(e => e.status === "VALIDO");

  const validTables = [...new Set(validEntries
    .filter(e => !active || e.campaignId === active.id)
    .map(e => String(e.tableNumber))
    .filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b));

  return {
    ok: true,
    settings,
    campaigns,
    activeCampaign: active,
    total: entries.length,
    valid: validEntries.length,
    blocked: entries.length - validEntries.length,
    validTables,
    entries: entries.reverse()
  };
}

function saveSettings_(p) {
  checkPin_(p.pin);

  updateConfig_({
    restaurantLat: p.restaurantLat,
    restaurantLng: p.restaurantLng,
    radiusMeters: p.radiusMeters,
    maxTableNumber: p.maxTableNumber,
    timezone: "America/Sao_Paulo"
  });

  return { ok: true, message: "Dados fixos salvos." };
}

function saveCampaign_(p) {
  checkPin_(p.pin);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.CAMPANHAS);
  const rows = sh.getDataRange().getValues();

  const id = sanitize_(p.id) || ("CAMP-" + new Date().getTime());

  const rowData = [
    id,
    sanitize_(p.nome),
    sanitize_(p.tipo || "sorteio"),
    sanitize_(p.descricao),
    sanitize_(p.canal || "restaurante"),
    sanitize_(p.inicio),
    sanitize_(p.fim),
    String(p.ativa || "TRUE").toUpperCase(),
    sanitize_(p.limiteMesa || "2"),
    sanitize_(p.limiteWhats || "1"),
    String(p.precisaLocalizacao || "TRUE").toUpperCase(),
    sanitize_(p.botao || "Participar agora")
  ];

  let foundRow = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      foundRow = i + 1;
    }
  }

  if (foundRow > -1) {
    sh.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sh.appendRow(rowData);
  }

  return {
    ok: true,
    message: "Campanha salva.",
    id
  };
}

function drawData_(p) {
  checkPin_(p.pin);

  const campaign = getActiveCampaign_();

  const validTables = [...new Set(getTodayEntries_()
    .filter(e => e.status === "VALIDO")
    .filter(e => campaign ? e.campaignId === campaign.id : true)
    .map(e => String(e.tableNumber))
    .filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b));

  return {
    ok: true,
    campaign,
    validTables
  };
}

function registerWinner_(p) {
  checkPin_(p.pin);

  const settings = getSettings_();
  const timezone = settings.timezone || "America/Sao_Paulo";
  const campaign = getCampaignById_(p.campaignId) || getActiveCampaign_();
  const now = new Date();

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.GANHADORES);

  sh.appendRow([
    now,
    Utilities.formatDate(now, timezone, "yyyy-MM-dd"),
    Utilities.formatDate(now, timezone, "HH:mm:ss"),
    campaign ? campaign.id : "",
    campaign ? campaign.nome : "",
    p.tableNumber,
    "Confirmar presença manualmente."
  ]);

  return { ok: true };
}

function getSettings_() {
  const c = getConfig_();

  return {
    restaurantLat: normalizeDecimal_(c.restaurantLat || "-20.07623"),
    restaurantLng: normalizeDecimal_(c.restaurantLng || "-44.58252"),
    radiusMeters: c.radiusMeters || "50",
    maxTableNumber: c.maxTableNumber || "60",
    timezone: c.timezone || "America/Sao_Paulo"
  };
}

function getConfig_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.CONFIG);
  const values = sh.getDataRange().getValues();
  const c = {};

  for (let i = 1; i < values.length; i++) {
    c[values[i][0]] = values[i][1];
  }

  return c;
}

function updateConfig_(updates) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.CONFIG);
  const data = sh.getDataRange().getValues();

  Object.keys(updates).forEach(key => {
    let row = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        row = i + 1;
      }
    }

    if (row > -1) {
      sh.getRange(row, 2).setValue(String(updates[key] || ""));
    } else {
      sh.appendRow([key, String(updates[key] || "")]);
    }
  });
}

function setConfigDefaults_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const cfg = ss.getSheetByName(SHEETS.CONFIG);

  const defaults = {
    restaurantLat: "-20.07623",
    restaurantLng: "-44.58252",
    radiusMeters: "50",
    maxTableNumber: "60",
    timezone: "America/Sao_Paulo"
  };

  const existing = cfg.getDataRange().getValues().map(r => r[0]);

  Object.keys(defaults).forEach(k => {
    if (!existing.includes(k)) {
      cfg.appendRow([k, defaults[k]]);
    }
  });
}

function getCampaigns_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.CAMPANHAS);
  const values = sh.getDataRange().getValues();
  const campaigns = [];

  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    campaigns.push(rowToCampaign_(values[i]));
  }

  return campaigns;
}

function rowToCampaign_(r) {
  return {
    id: String(r[0]),
    nome: String(r[1] || ""),
    tipo: String(r[2] || "sorteio"),
    descricao: String(r[3] || ""),
    canal: String(r[4] || "restaurante"),
    inicio: normalizeDateTime_(r[5]),
    fim: normalizeDateTime_(r[6]),
    ativa: String(r[7] || "FALSE").toUpperCase(),
    limiteMesa: String(r[8] || "2"),
    limiteWhats: String(r[9] || "1"),
    precisaLocalizacao: String(r[10] || "TRUE").toUpperCase(),
    botao: String(r[11] || "Participar agora")
  };
}

function getActiveCampaign_() {
  const campaigns = getCampaigns_();

  const active = campaigns
    .filter(c => String(c.ativa).toUpperCase() === "TRUE")
    .filter(c => isCampaignOpen_(c))
    .sort((a, b) => parseCampaignDate_(a.inicio) - parseCampaignDate_(b.inicio));

  return active.length ? active[0] : null;
}

function getCampaignById_(id) {
  if (!id) return null;
  return getCampaigns_().find(c => String(c.id) === String(id)) || null;
}

function isCampaignOpen_(campaign) {
  const now = new Date();
  const start = parseCampaignDate_(campaign.inicio);
  const end = parseCampaignDate_(campaign.fim);

  return now >= start && now <= end;
}

function publicCampaign_(c) {
  return {
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    descricao: c.descricao,
    canal: c.canal,
    inicio: c.inicio,
    fim: c.fim,
    inicioBR: formatDateTimeBR_(c.inicio),
    fimBR: formatDateTimeBR_(c.fim),
    ativa: c.ativa,
    limiteMesa: c.limiteMesa,
    limiteWhats: c.limiteWhats,
    precisaLocalizacao: c.precisaLocalizacao,
    botao: c.botao
  };
}

function getTodayEntries_() {
  const settings = getSettings_();
  const timezone = settings.timezone || "America/Sao_Paulo";

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.CADASTROS);
  const values = sh.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === today) {
      rows.push({
        timestamp: values[i][0],
        date: values[i][1],
        time: values[i][2],
        campaignId: values[i][3],
        campaignName: values[i][4],
        name: values[i][5],
        whatsapp: values[i][6],
        tableNumber: values[i][7],
        lat: values[i][8],
        lng: values[i][9],
        accuracy: values[i][10],
        distance: values[i][11],
        status: values[i][12],
        reason: values[i][13]
      });
    }
  }

  return rows;
}

function normalizeDateTime_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "America/Sao_Paulo", "yyyy-MM-dd HH:mm");
  }

  return String(value || "").trim();
}

function parseCampaignDate_(text) {
  text = normalizeDateTime_(text);

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);

  if (!m) {
    throw new Error("Data/hora inválida na campanha: " + text);
  }

  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    0
  );
}

function formatDateTimeBR_(text) {
  const m = String(text).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);

  if (!m) return text;

  return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}`;
}

function normalizeDecimal_(value) {
  return String(value || "").replace(",", ".").trim();
}

function distanceMeters_(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = v => v * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function jsonp_(callback, obj) {
  const json = JSON.stringify(obj);
  const output = callback ? `${callback}(${json});` : json;

  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function checkPin_(pin) {
  if (String(pin) !== String(ADMIN_PIN)) {
    throw new Error("PIN inválido.");
  }
}

function sanitize_(v) {
  return String(v || "").trim().replace(/[<>]/g, "");
}

function onlyDigits_(v) {
  return String(v || "").replace(/\D/g, "");
}

function createSheetIfMissing_(ss, name, headers) {
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  }
}
