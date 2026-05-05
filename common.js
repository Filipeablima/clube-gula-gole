function jsonp(params){
  return new Promise((resolve, reject) => {
    if(!SCRIPT_URL || SCRIPT_URL.includes("COLE_AQUI")){
      reject(new Error("Configure a variável SCRIPT_URL no arquivo config.js"));
      return;
    }
    const callbackName = "cb_" + Date.now() + "_" + Math.floor(Math.random()*9999);
    params.callback = callbackName;
    const url = SCRIPT_URL + "?" + new URLSearchParams(params).toString();

    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado. Verifique a URL do Apps Script."));
    }, 15000);

    function cleanup(){
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Erro ao conectar ao Apps Script."));
    };

    script.src = url;
    document.body.appendChild(script);
  });
}

function onlyDigits(value){
  return (value || "").replace(/\D/g, "");
}

function formatPhoneBR(raw){
  let d = onlyDigits(raw);
  if(d.length === 11){
    return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if(d.length === 10){
    return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return raw;
}

function showBox(id, message, type="success"){
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = "result " + type;
  el.classList.remove("hidden");
}
