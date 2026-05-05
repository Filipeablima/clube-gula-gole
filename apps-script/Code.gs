/****************************************************
 * CLUBE GULA & GOLE — GOOGLE APPS SCRIPT
 * Estrutura sem custo: GitHub Pages + Google Sheets
 * Use como Web App: Deploy > New deployment > Web app
 ****************************************************/

const SPREADSHEET_ID = "COLE_AQUI_O_ID_DA_PLANILHA";
const ADMIN_PIN = "1234"; // TROQUE ANTES DE USAR

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
    "timestamp", "data", "hora", "nome", "whatsapp", "mesa",
    "latitude", "longitude", "precisao", "distancia_metros",
    "campanha", "status", "motivo"
  ]);
  createSheetIfMissing_(ss, SHEETS.CAMPANHAS, [
    "data_criacao", "nome", "tipo", "descricao", "ativa"
  ]);
  createSheetIfMissing_(ss, SHEETS.GANHADORES, [
    "timestamp", "data", "hora", "campanha", "mesa_sorteada", "observacao"
  ]);

  const cfg = ss.getSheetByName(SHEETS.CONFIG);
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2,1,12,2).setValues([
      ["campaignName", "Rodada Premiada"],
      ["campaignDescription", "Cadastre-se e concorra à rodada de hoje."],
      ["campaignType", "sorteio"],
      ["startTime", "18:00"],
      ["endTime", "23:00"],
      ["tableLimit", "2"],
      ["phoneLimit", "1"],
      ["restaurantLat", "-20.075000"],
      ["restaurantLng", "-44.576000"],
      ["radiusMeters", "250"],
      ["maxTableNumber", "60"],
      ["timezone", "America/Sao_Paulo"]
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
    else if (action === "saveConfig") result = saveConfig_(p);
    else if (action === "drawData") result = drawData_(p);
    else if (action === "registerWinner") result = registerWinner_(p);
    else result = { ok:false, message:"Ação inválida." };

    return jsonp_(p.callback, result);
  } catch (err) {
    return jsonp_(e.parameter.callback, { ok:false, message: err.message });
  }
}

function getPublicConfig_() {
  const c = getConfig_();
  return {
    ok:true,
    config: {
      campaignName: c.campaignName,
      campaignDescription: c.campaignDescription,
      campaignType: c.campaignType,
      startTime: c.startTime,
      endTime: c.endTime,
      isOpen: isWithinTime_(c.startTime, c.endTime, c.timezone)
    }
  };
}

function register_(p) {
  const c = getConfig_();
  const now = new Date();
  const date = Utilities.formatDate(now, c.timezone, "yyyy-MM-dd");
  const time = Utilities.formatDate(now, c.timezone, "HH:mm:ss");

  const name = sanitize_(p.name);
  const whatsapp = onlyDigits_(p.whatsapp);
  const tableNumber = String(p.tableNumber || "").trim();
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const accuracy = p.accuracy || "";

  let status = "VALIDO";
  let reason = "Participação confirmada.";

  if (!name || name.split(" ").length < 2) {
    status = "BLOQUEADO"; reason = "Informe nome e sobrenome.";
  } else if (whatsapp.length < 10 || whatsapp.length > 11) {
    status = "BLOQUEADO"; reason = "WhatsApp inválido.";
  } else if (!tableNumber || Number(tableNumber) < 1 || Number(tableNumber) > Number(c.maxTableNumber || 60)) {
    status = "BLOQUEADO"; reason = "Mesa inválida.";
  } else if (!isWithinTime_(c.startTime, c.endTime, c.timezone)) {
    status = "BLOQUEADO"; reason = "Cadastro fora do horário permitido.";
  } else if (isNaN(lat) || isNaN(lng)) {
    status = "BLOQUEADO"; reason = "Localização não informada.";
  }

  const distance = (isNaN(lat) || isNaN(lng)) ? "" : distanceMeters_(lat, lng, Number(c.restaurantLat), Number(c.restaurantLng));

  if (status === "VALIDO" && distance > Number(c.radiusMeters)) {
    status = "BLOQUEADO"; reason = "Localização fora do raio permitido.";
  }

  const existing = getTodayEntries_();
  if (status === "VALIDO") {
    const phoneCount = existing.filter(r => r.whatsapp === whatsapp && r.status === "VALIDO").length;
    if (phoneCount >= Number(c.phoneLimit || 1)) {
      status = "BLOQUEADO"; reason = "Este WhatsApp já está participando hoje.";
    }
  }

  if (status === "VALIDO") {
    const tableCount = existing.filter(r => String(r.tableNumber) === String(tableNumber) && r.status === "VALIDO").length;
    if (tableCount >= Number(c.tableLimit || 2)) {
      status = "BLOQUEADO"; reason = "Esta mesa já atingiu o limite de participantes.";
    }
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CADASTROS);

  sheet.appendRow([
    now, date, time, name, whatsapp, tableNumber,
    lat, lng, accuracy, distance,
    c.campaignName, status, reason
  ]);

  return {
    ok: status === "VALIDO",
    status,
    message: reason
  };
}

function adminData_(p) {
  checkPin_(p.pin);
  const config = getConfig_();
  const entries = getTodayEntries_();
  const validEntries = entries.filter(e => e.status === "VALIDO");
  const validTables = [...new Set(validEntries.map(e => String(e.tableNumber)))].sort((a,b)=>Number(a)-Number(b));

  return {
    ok:true,
    config,
    total: entries.length,
    valid: validEntries.length,
    blocked: entries.length - validEntries.length,
    validTables,
    entries: entries.reverse()
  };
}

function saveConfig_(p) {
  checkPin_(p.pin);
  const allowed = [
    "campaignName", "campaignDescription", "campaignType", "startTime", "endTime",
    "tableLimit", "phoneLimit", "restaurantLat", "restaurantLng", "radiusMeters"
  ];
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.CONFIG);
  const data = sh.getDataRange().getValues();

  allowed.forEach(key => {
    const value = String(p[key] || "").trim();
    let row = -1;
    for (let i=1;i<data.length;i++) if (data[i][0] === key) row = i+1;
    if (row > -1) sh.getRange(row, 2).setValue(value);
    else sh.appendRow([key, value]);
  });

  const campaigns = ss.getSheetByName(SHEETS.CAMPANHAS);
  campaigns.appendRow([new Date(), p.campaignName || "", p.campaignType || "", p.campaignDescription || "", "sim"]);

  return { ok:true, message:"Configurações salvas." };
}

function drawData_(p) {
  checkPin_(p.pin);
  const config = getConfig_();
  const validTables = [...new Set(getTodayEntries_()
    .filter(e => e.status === "VALIDO")
    .map(e => String(e.tableNumber)))]
    .sort((a,b)=>Number(a)-Number(b));

  return { ok:true, config, validTables };
}

function registerWinner_(p) {
  checkPin_(p.pin);
  const c = getConfig_();
  const now = new Date();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.GANHADORES);
  sh.appendRow([
    now,
    Utilities.formatDate(now, c.timezone, "yyyy-MM-dd"),
    Utilities.formatDate(now, c.timezone, "HH:mm:ss"),
    c.campaignName,
    p.tableNumber,
    "Confirmar presença manualmente."
  ]);
  return { ok:true };
}

function getTodayEntries_() {
  const c = getConfig_();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.CADASTROS);
  const values = sh.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), c.timezone, "yyyy-MM-dd");
  const rows = [];

  for (let i=1; i<values.length; i++) {
    if (values[i][1] === today) {
      rows.push({
        timestamp: values[i][0],
        date: values[i][1],
        time: values[i][2],
        name: values[i][3],
        whatsapp: values[i][4],
        tableNumber: values[i][5],
        lat: values[i][6],
        lng: values[i][7],
        accuracy: values[i][8],
        distance: values[i][9],
        campaign: values[i][10],
        status: values[i][11],
        reason: values[i][12]
      });
    }
  }
  return rows;
}

function getConfig_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS.CONFIG);
  const values = sh.getDataRange().getValues();
  const c = {};
  for (let i=1;i<values.length;i++) c[values[i][0]] = values[i][1];
  c.timezone = c.timezone || "America/Sao_Paulo";
  return c;
}

function isWithinTime_(start, end, timezone) {
  const now = new Date();
  const current = Utilities.formatDate(now, timezone || "America/Sao_Paulo", "HH:mm");
  return current >= start && current <= end;
}

function distanceMeters_(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function jsonp_(callback, obj) {
  const json = JSON.stringify(obj);
  const output = callback ? `${callback}(${json});` : json;
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function checkPin_(pin) {
  if (String(pin) !== String(ADMIN_PIN)) throw new Error("PIN inválido.");
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
  if (sh.getLastRow() === 0) sh.appendRow(headers);
}
