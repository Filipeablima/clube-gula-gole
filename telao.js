let validTables = [];
let activeCampaign = null;
let screenPin = "";

async function loadScreenData(){
  screenPin = document.getElementById("screenPin").value.trim();
  if(!screenPin){
    alert("Digite o PIN do admin.");
    return;
  }

  try{
    const data = await jsonp({action:"drawData", pin:screenPin});
    if(!data.ok) throw new Error(data.message || "Erro ao carregar mesas.");

    validTables = data.validTables || [];
    activeCampaign = data.campaign;
    setText("screenCampaign", activeCampaign?.nome || "Nenhuma campanha ativa");

    setText("screenInfo", validTables.length + " mesa(s) válida(s) disponíveis para sorteio.");
  }catch(err){
    alert(err.message);
  }
}

function startDraw(){
  if(!validTables.length){
    alert("Atualize as mesas primeiro. Nenhuma mesa válida carregada.");
    return;
  }

  const box = document.getElementById("drawBox");
  const info = document.getElementById("screenInfo");
  let i = 0;

  const interval = setInterval(()=>{
    const randomTable = validTables[Math.floor(Math.random()*validTables.length)];
    box.textContent = randomTable;
    i++;
    if(i > 38){
      clearInterval(interval);
      const winner = validTables[Math.floor(Math.random()*validTables.length)];
      box.textContent = winner;
      info.textContent = "🎉 Mesa " + winner + " foi sorteada! Confirmar presença na mesa.";
      registerWinner(winner);
    }
  }, 75);
}

async function registerWinner(tableNumber){
  if(!screenPin || !activeCampaign) return;
  try{
    await jsonp({action:"registerWinner", pin:screenPin, tableNumber, campaignId: activeCampaign.id});
  }catch(e){}
}
