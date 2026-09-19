/* Central de Manutenção SE — v3.1.2
 * Consolidação corretiva sem nova camada:
 * - mantém Comunicação como agrupamento nativo da Subestação;
 * - mantém saudação persistente do login;
 * - replica a entrada de Integração/Substituição usando o MESMO componente da Nova Manutenção;
 * - remove toda a interceptação paralela do Banco de Dados (o dono volta a ser v206.js).
 */
(() => {
'use strict';
if(globalThis.__CENTRAL_V300__)return;
globalThis.__CENTRAL_V300__=true;

const V300_VERSION='3.1.2';
const safe=v=>String(v??'');
const esc300=v=>safe(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

/* Saudação persistente: guarda somente o primeiro nome, separado da sessão. */
const V300_LAST_FIRST_NAME_KEY='central_last_first_name';
function v300FirstName(value){return safe(value).trim().split(/\s+/)[0]||''}
function v300RememberFirstName(profile){
  const name=v300FirstName(profile?.display_name);
  if(name)localStorage.setItem(V300_LAST_FIRST_NAME_KEY,name);
}
function v300KnownFirstName(){
  try{
    const cached=JSON.parse(localStorage.getItem('central_offline_identity')||'null');
    return v300FirstName(cached?.profile?.display_name)||localStorage.getItem(V300_LAST_FIRST_NAME_KEY)||'';
  }catch(_){
    return localStorage.getItem(V300_LAST_FIRST_NAME_KEY)||'';
  }
}
function v300UpdateLoginGreeting(){
  const shell=document.getElementById('auth-shell');if(!shell)return;
  const email=shell.querySelector('#login-form input[name="email"]');
  if(email&&email.dataset.v300Greeting!=='1'){
    email.dataset.v300Greeting='1';
    email.addEventListener('input',()=>requestAnimationFrame(v300UpdateLoginGreeting));
  }
  const title=[...shell.querySelectorAll('h1,h2')]
    .find(x=>/olá|ola|bem-vindo/i.test(x.textContent||''))||shell.querySelector('h1');
  if(!title)return;
  const name=v300KnownFirstName();
  const text=name?`Olá, ${name}.`:'Olá, seja bem-vindo.';
  if(title.textContent!==text)title.textContent=text;
}
if(typeof storeIdentity==='function'){
  const v300BaseStoreIdentity=storeIdentity;
  storeIdentity=function(user,profile){
    v300RememberFirstName(profile);
    return v300BaseStoreIdentity(user,profile);
  };
}

/* Corrige o chrome de versão que camadas históricas ainda tentam sobrescrever. */
function v300SyncVersionChrome(){
  const footer=document.getElementById('environment-footer-version');
  if(footer)footer.textContent='v3.1.2';
  const label=document.getElementById('app-version-label');
  if(label)label.textContent='v3.1.2';
  if(document.title&&/v\d+\.\d+\.\d+/i.test(document.title)){
    document.title=document.title.replace(/v\d+\.\d+\.\d+/ig,'v3.1.2');
  }
}

const FAMILY={
  distribution_recloser:'Religador de Distribuição',
  voltage_regulator:'Regulador de Tensão',
  repeater:'Repetidora',
  telecom_site:'Local de Telecom',
  radio_voice_vhf:'Rádio de Voz VHF',
  radio_data_uhf:'Rádio de Dados UHF',
  radio_microwave:'Rádio Micro-ondas',
  converter_125_12:'Conversor 125/12 Vcc',
  converter_125_12_detailed:'Conversor 125/12 Vcc',
  converter_125_48:'Conversor 125/48 Vcc',
  router:'Roteador / Switch',
  claroty:'Claroty'
};
const familyLabel=c=>FAMILY[c]||safe(c).replace(/_/g,' ');
const frontAssets=()=>Array.isArray(state?.frontAssets)?state.frontAssets:[];
const frontAssetById=id=>state?.frontAssetMap?.get?.(id)||frontAssets().find(a=>a.id===id)||null;

state.v300CommunicationSelected=state.v300CommunicationSelected instanceof Set
  ? state.v300CommunicationSelected
  : new Set();

function clearCommunicationSelection(){
  state.v300CommunicationSelected.clear();
  state.v209CommunicationAssetId=null;
  document.querySelectorAll('.v209-comm-check,.v300-comm-group-check')
    .forEach(x=>{x.checked=false;x.indeterminate=false});
}
function clearLegacySelectionUi(){
  state.selected?.clear?.();
  document.querySelectorAll('.item-check:not(.v209-comm-check),.group-check:not(.v300-comm-group-check)')
    .forEach(x=>{x.checked=false;x.indeterminate=false});
}
function updateSelectionDock(){
  const comm=state.v300CommunicationSelected.size;
  const legacy=state.selected?.size||0;
  const count=comm||legacy;
  const countEl=document.getElementById('sel-count');
  const preview=document.getElementById('sel-preview');
  const button=document.getElementById('continue');
  if(countEl)countEl.textContent=String(count);
  if(preview){
    preview.textContent=comm
      ?(comm===1?'1 equipamento de Comunicação selecionado':`${comm} equipamentos de Comunicação selecionados`)
      :(legacy?`${legacy} ativo(s) selecionado(s) para continuar`:'Selecione um ativo para continuar');
  }
  if(button)button.disabled=count===0;
}
function syncCommunicationHeader(section){
  const items=[...section.querySelectorAll('.v209-comm-check')];
  const group=section.querySelector('.v300-comm-group-check');
  if(!group)return;
  const selected=items.filter(x=>x.checked).length;
  group.checked=items.length>0&&selected===items.length;
  group.indeterminate=selected>0&&selected<items.length;
}
function bindLegacyReset(){
  document.querySelectorAll('.item-check:not(.v209-comm-check),.group-check:not(.v300-comm-group-check)')
    .forEach(input=>{
      if(input.dataset.v300LegacyReset==='1')return;
      input.dataset.v300LegacyReset='1';
      input.addEventListener('change',()=>{
        if(input.checked){clearCommunicationSelection();updateSelectionDock()}
      });
    });
}
function enhanceCommunicationGroup(){
  if(state?.screen!=='equipment'||!state?.sub)return;
  const section=document.querySelector('.v209-communication-group');
  if(!section)return;
  const inputs=[...section.querySelectorAll('.v209-comm-check')];
  if(!inputs.length)return;

  const header=section.querySelector('.v209-communication-head,.group-head');
  if(header&&!header.querySelector('.v300-comm-group-check')){
    header.className='group-head v300-communication-head';
    header.innerHTML=`<input class="check group-check v300-comm-group-check" type="checkbox" aria-label="Selecionar todos os equipamentos de Comunicação"><strong>Comunicação</strong><span>${inputs.length} item(ns)</span>`;
  }

  inputs.forEach(input=>{
    input.checked=state.v300CommunicationSelected.has(input.value);
    input.onchange=()=>{
      if(input.checked){
        clearLegacySelectionUi();
        state.v300CommunicationSelected.add(input.value);
      }else{
        state.v300CommunicationSelected.delete(input.value);
      }
      state.v209CommunicationAssetId=null;
      syncCommunicationHeader(section);
      updateSelectionDock();
    };
  });

  const group=section.querySelector('.v300-comm-group-check');
  if(group){
    group.onchange=()=>{
      clearLegacySelectionUi();
      inputs.forEach(input=>{
        input.checked=group.checked;
        if(group.checked)state.v300CommunicationSelected.add(input.value);
        else state.v300CommunicationSelected.delete(input.value);
      });
      group.indeterminate=false;
      state.v209CommunicationAssetId=null;
      updateSelectionDock();
    };
  }

  syncCommunicationHeader(section);
  bindLegacyReset();
  installCommunicationContinue();
  updateSelectionDock();
}

function clearCommunicationQueue(){
  state.v300CommunicationQueue=[];
  state.v300CommunicationQueueIndex=0;
  state.v300CommunicationQueueSubstation=null;
}
function openCommunicationQueueItem(index){
  const q=state.v300CommunicationQueue||[];
  const asset=frontAssetById(q[index]);
  const sub=state.v300CommunicationQueueSubstation;
  if(!asset||!sub){
    clearCommunicationQueue();
    return toast?.('Não foi possível continuar a sequência de Comunicação.','warning');
  }
  state.v300CommunicationQueueIndex=index;
  state.v209EmbeddedTelecomSubstation=sub;
  state.v205TelecomSubstation=sub;
  state.businessFront='telecom';
  state.v205Asset=null;
  state.v205Activity=null;
  state.v207RequestedActivity=null;
  if(!globalThis.CENTRAL_V205_OPEN_FRONT_ASSET?.(asset.id,{
    front:'telecom',
    substationId:sub,
    embeddedSubstation:sub
  })){
    toast?.('Não foi possível abrir o formulário deste equipamento.','warning');
  }
}
function beginCommunicationQueue(){
  const ids=[...state.v300CommunicationSelected];
  if(!ids.length)return false;
  state.v300CommunicationQueue=ids;
  state.v300CommunicationQueueIndex=0;
  state.v300CommunicationQueueSubstation=state.sub;
  if(ids.length>1)toast?.(`${ids.length} equipamentos de Comunicação serão atendidos em sequência.`,'notice');
  openCommunicationQueueItem(0);
  return true;
}
function installCommunicationContinue(){
  const b=document.getElementById('continue');
  if(!b||b.dataset.v300Continue==='1')return;
  const previous=b.onclick;
  b.dataset.v300Continue='1';
  b.onclick=e=>{
    if(state.v300CommunicationSelected.size){
      e?.preventDefault?.();
      return beginCommunicationQueue();
    }
    previous?.call(b,e);
  };
}
function enhanceCommunicationSuccess(){
  const q=state.v300CommunicationQueue||[];
  const next=document.getElementById('v205-success-new');
  if(!q.length||!next||next.dataset.v300Queue==='1')return;
  next.dataset.v300Queue='1';
  const i=Number(state.v300CommunicationQueueIndex||0);
  const hasNext=i<q.length-1;
  if(hasNext){
    next.textContent=`Abrir próximo ativo (${i+2} de ${q.length})`;
    next.onclick=()=>openCommunicationQueueItem(i+1);
  }else{
    next.textContent='Voltar à Subestação';
    next.onclick=()=>{
      const sub=state.v300CommunicationQueueSubstation;
      clearCommunicationQueue();
      clearCommunicationSelection();
      state.v209EmbeddedTelecomSubstation=null;
      state.businessFront='substation';
      state.sub=sub;
      state.selected?.clear?.();
      renderEquipment();
    };
  }
  const home=document.getElementById('v205-success-home');
  if(home&&!home.dataset.v300Queue){
    const prev=home.onclick;
    home.dataset.v300Queue='1';
    home.onclick=e=>{
      clearCommunicationQueue();
      clearCommunicationSelection();
      prev?.call(home,e);
    };
  }
}
function installQueueBackCleanup(){
  if(!(state.v300CommunicationQueue||[]).length)return;
  const b=document.getElementById('v205-back-activity');
  if(!b||b.dataset.v300QueueBack==='1')return;
  b.dataset.v300QueueBack='1';
  b.addEventListener('click',()=>{
    clearCommunicationQueue();
    clearCommunicationSelection();
  },true);
}

/* Integração/Substituição: usa literalmente o mesmo shell/classes da Nova Manutenção. */
function styleIntegrationEntry(){
  if(state?.screen!=='integration'||state?.assetOperationFront)return;
  if(main?.querySelector('[data-v300-integration-entry="1"]'))return;

  main.classList.remove('v300-integration-entry');
  main.innerHTML=`<section class="business-front-shell" data-v300-integration-entry="1">
    <div class="head-row business-front-head">
      <div>
        <button class="back" id="v300-integration-back" type="button" aria-label="Voltar">
          <span data-icon="arrow-left"></span>
        </button>
        <h1>Integração / Substituição</h1>
        <p>Escolha a frente de negócio.</p>
      </div>
    </div>
    <div class="business-front-grid">
      <button type="button" class="business-front-card" data-front="substation" data-v300-op-front="substation">
        <span class="business-front-icon" data-icon="settings"></span>
        <h2>Subestações</h2>
        <p>Integração e substituição de ativos de subestações.</p>
        <span class="business-front-state"><span data-icon="check"></span>Disponível</span>
      </button>
      <button type="button" class="business-front-card" data-front="distribution" data-v300-op-front="distribution">
        <span class="business-front-icon" data-icon="tool"></span>
        <h2>Distribuição</h2>
        <p>Integração, substituição e comissionamento de religadores e reguladores.</p>
        <span class="business-front-state"><span data-icon="check"></span>Disponível</span>
      </button>
      <button type="button" class="business-front-card" data-front="telecom" data-v300-op-front="telecom">
        <span class="business-front-icon" data-icon="wifi"></span>
        <h2>Telecom</h2>
        <p>Integração e instalação de ativos de Telecom.</p>
        <span class="business-front-state"><span data-icon="check"></span>Disponível</span>
      </button>
    </div>
  </section>`;

  document.getElementById('v300-integration-back').onclick=()=>renderHome();
  main.querySelectorAll('[data-v300-op-front]').forEach(button=>{
    button.onclick=()=>{
      state.assetOperationFront=button.dataset.v300OpFront;
      renderAssetOperationsHome();
    };
  });
  hydrateIcons?.(main);
}

function enhance(){
  v300UpdateLoginGreeting();
  v300SyncVersionChrome();
  styleIntegrationEntry();
  enhanceCommunicationGroup();
  enhanceCommunicationSuccess();
  installQueueBackCleanup();
}

let scheduled=false;
function scheduleEnhance(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    enhance();
  });
}
const observer=new MutationObserver(scheduleEnhance);
if(main)observer.observe(main,{childList:true,subtree:true});

scheduleEnhance();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    v300UpdateLoginGreeting();
    v300SyncVersionChrome();
  }
});
window.addEventListener('pageshow',()=>{
  v300UpdateLoginGreeting();
  v300SyncVersionChrome();
});
setTimeout(enhance,0);
})();
