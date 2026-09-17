/* Central de Manutenção SE — v3.0.0 */
(() => {
'use strict';
if(globalThis.__CENTRAL_V300__)return;
globalThis.__CENTRAL_V300__=true;
const V300_VERSION='3.0.0';
const safe=v=>String(v??'');
const norm=v=>{try{return normalize(safe(v))}catch(_){return safe(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()}};
const esc300=v=>safe(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const V300_LAST_FIRST_NAME_KEY='central_last_first_name';

function v300FirstName(value){
  return safe(value).trim().split(/\s+/)[0]||'';
}

function v300RememberFirstName(profile){
  const name=v300FirstName(profile?.display_name);
  if(name)localStorage.setItem(V300_LAST_FIRST_NAME_KEY,name);
}

function v300KnownFirstName(){
  try{
    const cached=JSON.parse(localStorage.getItem('central_offline_identity')||'null');
    return v300FirstName(cached?.profile?.display_name)
      || localStorage.getItem(V300_LAST_FIRST_NAME_KEY)
      || '';
  }catch(_){
    return localStorage.getItem(V300_LAST_FIRST_NAME_KEY)||'';
  }
}

function v300UpdateLoginGreeting(){
  const shell=document.getElementById('auth-shell');
  if(!shell)return;

  const title=[...shell.querySelectorAll('h1,h2')]
    .find(x=>/olá|ola|bem-vindo/i.test(x.textContent||''))
    || shell.querySelector('h1');

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
const FAMILY={distribution_recloser:'Religador de Distribuição',voltage_regulator:'Regulador de Tensão',repeater:'Repetidora',telecom_site:'Local de Telecom',radio_voice_vhf:'Rádio de Voz VHF',radio_data_uhf:'Rádio de Dados UHF',radio_microwave:'Rádio Micro-ondas',converter_125_12:'Conversor 125/12 Vcc',converter_125_12_detailed:'Conversor 125/12 Vcc',converter_125_48:'Conversor 125/48 Vcc',router:'Roteador / Switch',claroty:'Claroty'};
const familyLabel=c=>FAMILY[c]||safe(c).replace(/_/g,' ');
const frontAssets=()=>Array.isArray(state?.frontAssets)?state.frontAssets:[];
const frontAssetById=id=>state?.frontAssetMap?.get?.(id)||frontAssets().find(a=>a.id===id)||null;
state.v300CommunicationSelected=state.v300CommunicationSelected instanceof Set?state.v300CommunicationSelected:new Set();

function telecomSiteForSubstation(subId){return frontAssets().find(a=>a.active!==false&&a.family_code==='telecom_site'&&safe(a.substation_code)===safe(subId))||null}
function communicationAssetsForSubstation(subId){
  const site=telecomSiteForSubstation(subId);if(!site)return[];
  return frontAssets().filter(a=>a.active!==false&&a.parent_id===site.id).sort((a,b)=>communicationTitle(a).localeCompare(communicationTitle(b),'pt-BR'));
}
function communicationTitle(a){return a?.display_name||[familyLabel(a?.family_code),a?.model].filter(Boolean).join(' — ')||familyLabel(a?.family_code)}

function clearCommunicationSelection(){
  state.v300CommunicationSelected.clear();state.v209CommunicationAssetId=null;
  document.querySelectorAll('.v209-comm-check,.v300-comm-group-check').forEach(x=>{x.checked=false;x.indeterminate=false});
}
function clearLegacySelectionUi(){
  state.selected?.clear?.();
  document.querySelectorAll('.item-check:not(.v209-comm-check),.group-check:not(.v300-comm-group-check)').forEach(x=>{x.checked=false;x.indeterminate=false});
}
function updateSelectionDock(){
  const comm=state.v300CommunicationSelected.size,legacy=state.selected?.size||0,count=comm||legacy;
  const countEl=document.getElementById('sel-count'),preview=document.getElementById('sel-preview'),button=document.getElementById('continue');
  if(countEl)countEl.textContent=String(count);
  if(preview)preview.textContent=comm?(comm===1?'1 equipamento de Comunicação selecionado':`${comm} equipamentos de Comunicação selecionados`):(legacy?`${legacy} ativo(s) selecionado(s) para continuar`:'Selecione um ativo para continuar');
  if(button)button.disabled=count===0;
}
function syncCommunicationHeader(section){
  const items=[...section.querySelectorAll('.v209-comm-check')],group=section.querySelector('.v300-comm-group-check');if(!group)return;
  const selected=items.filter(x=>x.checked).length;group.checked=items.length>0&&selected===items.length;group.indeterminate=selected>0&&selected<items.length;
}
function bindLegacyReset(){
  document.querySelectorAll('.item-check:not(.v209-comm-check),.group-check:not(.v300-comm-group-check)').forEach(input=>{
    if(input.dataset.v300LegacyReset==='1')return;input.dataset.v300LegacyReset='1';
    input.addEventListener('change',()=>{if(input.checked){clearCommunicationSelection();updateSelectionDock()}});
  });
}
function enhanceCommunicationGroup(){
  if(state?.screen!=='equipment'||!state?.sub)return;
  const section=document.querySelector('.v209-communication-group');if(!section)return;
  const inputs=[...section.querySelectorAll('.v209-comm-check')];if(!inputs.length)return;
  const header=section.querySelector('.v209-communication-head,.group-head');
  if(header&&!header.querySelector('.v300-comm-group-check')){
    header.className='group-head v300-communication-head';
    header.innerHTML=`<input class="check group-check v300-comm-group-check" type="checkbox" aria-label="Selecionar todos os equipamentos de Comunicação"><strong>Comunicação</strong><span>${inputs.length} item(ns)</span>`;
  }
  inputs.forEach(input=>{
    input.checked=state.v300CommunicationSelected.has(input.value);
    input.onchange=()=>{
      if(input.checked){clearLegacySelectionUi();state.v300CommunicationSelected.add(input.value)}else state.v300CommunicationSelected.delete(input.value);
      state.v209CommunicationAssetId=null;syncCommunicationHeader(section);updateSelectionDock();
    };
  });
  const group=section.querySelector('.v300-comm-group-check');
  if(group)group.onchange=()=>{
    clearLegacySelectionUi();
    inputs.forEach(input=>{input.checked=group.checked;if(group.checked)state.v300CommunicationSelected.add(input.value);else state.v300CommunicationSelected.delete(input.value)});
    group.indeterminate=false;state.v209CommunicationAssetId=null;updateSelectionDock();
  };
  syncCommunicationHeader(section);bindLegacyReset();installCommunicationContinue();updateSelectionDock();
}
function clearCommunicationQueue(){state.v300CommunicationQueue=[];state.v300CommunicationQueueIndex=0;state.v300CommunicationQueueSubstation=null}
function openCommunicationQueueItem(index){
  const q=state.v300CommunicationQueue||[],asset=frontAssetById(q[index]),sub=state.v300CommunicationQueueSubstation;
  if(!asset||!sub){clearCommunicationQueue();return toast?.('Não foi possível continuar a sequência de Comunicação.','warning')}
  state.v300CommunicationQueueIndex=index;state.v209EmbeddedTelecomSubstation=sub;state.v205TelecomSubstation=sub;state.businessFront='telecom';state.v205Asset=null;state.v205Activity=null;state.v207RequestedActivity=null;
  if(!globalThis.CENTRAL_V205_OPEN_FRONT_ASSET?.(asset.id,{front:'telecom',substationId:sub,embeddedSubstation:sub}))toast?.('Não foi possível abrir o formulário deste equipamento.','warning');
}
function beginCommunicationQueue(){
  const ids=[...state.v300CommunicationSelected];if(!ids.length)return false;
  state.v300CommunicationQueue=ids;state.v300CommunicationQueueIndex=0;state.v300CommunicationQueueSubstation=state.sub;
  if(ids.length>1)toast?.(`${ids.length} equipamentos de Comunicação serão atendidos em sequência.`,'notice');
  openCommunicationQueueItem(0);return true;
}
function installCommunicationContinue(){
  const b=document.getElementById('continue');if(!b||b.dataset.v300Continue==='1')return;
  const previous=b.onclick;b.dataset.v300Continue='1';b.onclick=e=>{if(state.v300CommunicationSelected.size){e?.preventDefault?.();return beginCommunicationQueue()}previous?.call(b,e)};
}
function enhanceCommunicationSuccess(){
  const q=state.v300CommunicationQueue||[],next=document.getElementById('v205-success-new');if(!q.length||!next||next.dataset.v300Queue==='1')return;
  next.dataset.v300Queue='1';const i=Number(state.v300CommunicationQueueIndex||0),hasNext=i<q.length-1;
  if(hasNext){next.textContent=`Abrir próximo ativo (${i+2} de ${q.length})`;next.onclick=()=>openCommunicationQueueItem(i+1)}
  else{next.textContent='Voltar à Subestação';next.onclick=()=>{const sub=state.v300CommunicationQueueSubstation;clearCommunicationQueue();clearCommunicationSelection();state.v209EmbeddedTelecomSubstation=null;state.businessFront='substation';state.sub=sub;state.selected?.clear?.();renderEquipment()}}
  const home=document.getElementById('v205-success-home');
  if(home&&!home.dataset.v300Queue){const prev=home.onclick;home.dataset.v300Queue='1';home.onclick=e=>{clearCommunicationQueue();clearCommunicationSelection();prev?.call(home,e)}}
}
function installQueueBackCleanup(){
  if(!(state.v300CommunicationQueue||[]).length)return;
  const b=document.getElementById('v205-back-activity');if(!b||b.dataset.v300QueueBack==='1')return;b.dataset.v300QueueBack='1';
  b.addEventListener('click',()=>{clearCommunicationQueue();clearCommunicationSelection()},true);
}

function styleIntegrationEntry(){
  if(state?.screen!=='integration'||state?.assetOperationFront){main?.classList.remove('v300-integration-entry');return}
  const grid=main?.querySelector('.v205-ops-fronts'),heading=main?.querySelector('.page-heading');if(!grid||!heading)return;
  main.classList.add('v300-integration-entry');heading.classList.add('v300-entry-heading');
  const title=heading.querySelector('h1'),subtitle=heading.querySelector('p');if(title)title.textContent='Integração / Substituição';if(subtitle)subtitle.textContent='Escolha a frente de negócio.';
  const inner=heading.querySelector(':scope > div')||heading;
  if(!inner.querySelector('.v300-entry-back')){const b=document.createElement('button');b.type='button';b.className='back v300-entry-back';b.setAttribute('aria-label','Voltar ao início');b.innerHTML='<span data-icon="arrow-left"></span>';b.onclick=()=>renderHome();inner.prepend(b)}
  grid.classList.add('business-front-grid','v300-front-grid');
  const meta={substation:['Subestações','Integração e substituição de ativos de subestações.'],distribution:['Distribuição','Integração, substituição e comissionamento de religadores e reguladores.'],telecom:['Telecom','Integração e instalação de ativos de Telecom.']};
  grid.querySelectorAll('[data-v205-op-front]').forEach(b=>{b.classList.add('business-front-card','v300-front-card');const m=meta[b.dataset.v205OpFront];if(!m)return;const h=b.querySelector('h2,strong'),p=b.querySelector('p,small');if(h)h.textContent=m[0];if(p)p.textContent=m[1]});
  hydrateIcons?.(heading);
}

function databaseDistributionAssets(){
  const family=state?.databaseV205Family||'distribution_recloser';
  return frontAssets().filter(a=>a.family_code===family&&a.active!==false).sort((a,b)=>safe(a.operating_code||a.display_name).localeCompare(safe(b.operating_code||b.display_name),'pt-BR',{numeric:true}));
}
function statusClass(status){const n=norm(status);if(n.includes('OPERACAO'))return'ok';if(n.includes('SUCATA')||n.includes('FORA'))return'danger';if(n.includes('RESERVA'))return'warning';return''}
function databaseRowMarkup(a){
  return `<button type="button" class="v206-db-asset-row v300-db-asset-row" data-v206-db-front-asset="${esc300(a.id)}"><div><strong>${esc300(a.operating_code||a.display_name)}</strong><span>${esc300([a.substation_code,a.feeder,a.model].filter(Boolean).join(' · '))}</span></div><span class="v205-status ${statusClass(a.status)}">${esc300(a.status||'Sem status')}</span></button>`;
}
function renderDatabaseGroup(details){
  if(!details?.open)return;
  const body=details.querySelector('.v206-db-group-body'),key=details.querySelector('summary strong')?.textContent?.trim()||'Não informado',field=state?.v206DistributionGroup||'region';
  if(!body||!field)return;
  const list=databaseDistributionAssets().filter(a=>safe(a[field]||'Não informado')===key);
  body.innerHTML=list.length?list.map(databaseRowMarkup).join(''):'<div class="empty">Nenhum ativo neste agrupamento.</div>';
  body.dataset.rendered='1';body.dataset.v300Rendered='1';
}
function enhanceDatabaseGroups(){
  if(state?.screen!=='database'||state?.databaseFront!=='distribution')return;
  document.querySelectorAll('.v206-db-group').forEach(details=>{
    const summary=details.querySelector(':scope > summary');if(!summary||summary.dataset.v300Group==='1')return;
    summary.dataset.v300Group='1';summary.setAttribute('role','button');summary.setAttribute('tabindex','0');summary.setAttribute('aria-expanded',String(details.open));
    const toggle=e=>{e.preventDefault();e.stopPropagation();details.open=!details.open;summary.setAttribute('aria-expanded',String(details.open));if(details.open)renderDatabaseGroup(details)};
    summary.addEventListener('click',toggle);
    summary.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')toggle(e)});
    details.addEventListener('toggle',()=>{summary.setAttribute('aria-expanded',String(details.open));if(details.open)renderDatabaseGroup(details)});
  });
}

const FIELD_LABELS={switch_model:'Modelo da chave',switch_serial:'Nº de série da chave',switch_manufacture_year:'Ano de fabricação da chave',control_model:'Modelo do controle',control_serial:'Nº de série do controle',control_install_year:'Ano de instalação do controle',network_voltage:'Tensão da rede',point_map:'Mapa de pontos',position:'Posição',affected_customers:'Clientes afetados',address:'Endereço',battery_specification:'Especificação da bateria',battery_spec:'Especificação da bateria',battery_last_change:'Última troca da bateria',relay_firmware:'Firmware do relé',firmware:'Firmware',automated:'Automatizado',power:'Potência',reference_voltage:'Tensão de referência',tp_ratio:'Relação TP',communication_medium:'Meio de comunicação',communication_manufacturer:'Fabricante da comunicação',communication_technology:'Tecnologia de comunicação',communication_firmware:'Firmware da comunicação',communication_identifier:'IMEI / identificador',communication_type:'Tipo de comunicação',repeater_name:'Repetidora',radio_ip:'IP do rádio',relay_ip:'IP do relé',sim1_operator:'Operadora chip 1',sim1_iccid:'ICCID chip 1',sim2_operator:'Operadora chip 2',sim2_iccid:'ICCID chip 2',chip_legacy:'Identificador legado de comunicação',cell_quantity:'Quantidade de células',unit:'Unidade'};
const INTERNAL_DATA_KEYS=new Set(['source_row','reviewed_on','monthly_status','aliases','linked_repeater_external_key','physical_units','rent_value','rent_expiry','land_contract_type','land_contract_expiry','land_expiry','land_status','land_dup']);
const prettyDataKey=k=>FIELD_LABELS[k]||safe(k).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
const useful=v=>v!==null&&v!==undefined&&safe(v).trim()!==''&&safe(v).trim()!=='-';
const makeRows=items=>items.filter(([,v])=>useful(v));
function sectionMarkup(title,rows){
  if(!rows.length)return'';
  return `<section class="v300-detail-section"><h3>${esc300(title)}</h3><div class="v300-detail-grid">${rows.map(([l,v])=>`<div class="v300-detail-field"><b>${esc300(l)}</b><span>${esc300(Array.isArray(v)?v.join(', '):v)}</span></div>`).join('')}</div></section>`;
}
function detailGroups(asset){
  const d=asset.data||{},used=new Set();const take=(k,l=prettyDataKey(k))=>{used.add(k);return[l,d[k]]};
  const identification=makeRows([['Frente',asset.business_front==='distribution'?'Distribuição':'Telecom'],['Família',familyLabel(asset.family_code)],['Código operativo',asset.operating_code],['Status',asset.status]]);
  const operational=makeRows([['Região',asset.region],['Subestação',asset.substation_code],['Alimentador',asset.feeder],['Localização',asset.location_name],take('address','Endereço'),take('position','Posição'),take('affected_customers','Clientes afetados'),take('network_voltage','Tensão da rede')]);
  const technical=makeRows([['Fabricante',asset.manufacturer],['Modelo',asset.model],['Número de série',asset.serial_number],take('switch_model'),take('switch_serial'),take('switch_manufacture_year'),take('control_model'),take('control_serial'),take('control_install_year'),take('relay_firmware'),take('firmware'),take('point_map'),take('battery_specification'),take('battery_spec'),take('battery_last_change'),take('automated'),take('power'),take('reference_voltage'),take('tp_ratio'),take('cell_quantity')]);
  const communication=makeRows([take('communication_medium'),take('communication_manufacturer'),take('communication_technology'),take('communication_firmware'),take('communication_identifier'),take('communication_type'),take('repeater_name'),take('radio_ip'),take('relay_ip'),take('sim1_operator'),take('sim1_iccid'),take('sim2_operator'),take('sim2_iccid'),take('chip_legacy')]);
  const other=[];
  for(const [k,v] of Object.entries(d)){if(used.has(k)||INTERNAL_DATA_KEYS.has(k)||/_external_key$/i.test(k)||!useful(v)||typeof v==='object')continue;other.push([prettyDataKey(k),v])}
  return{identification,operational,technical,communication,other};
}

async function localProfilePhoto(assetId){try{return(await idbGet('assetPhotos',assetId))?.blob||null}catch(_){return null}}
async function chooseDetailPhoto(asset){
  try{
    let source=null;
    if(globalThis.CentralMedia?.pickImage)source=await globalThis.CentralMedia.pickImage({title:'Foto principal do ativo',context:{kind:'front-asset-profile',assetId:asset.id}});
    else source=await new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>resolve(input.files?.[0]||null);input.click()});
    if(!source)return;
    const native=(()=>{try{return globalThis.CentralNativeAndroid?.isAvailable?.()===true}catch(_){return false}})();
    let blob=source;if(!native&&typeof compressImage==='function')blob=await compressImage(source,1000,.82);
    await idbPut('assetPhotos',{assetId:asset.id,blob,updatedAt:new Date().toISOString(),frontAsset:true});
    openV300AssetDetails(asset);
  }catch(error){const m=safe(error?.message||error);if(!/cancel|cancelado|canceled/i.test(m))toast?.(m,'warning')}
}
async function routeToAsset(asset){
  if(asset.latitude==null||asset.longitude==null)return;
  if(!navigator.onLine)return toast?.('Rota disponível quando houver conexão.','notice');
  let origin='';try{const c=typeof getCurrentCoordinates==='function'?await getCurrentCoordinates():null;if(c)origin=`&origin=${encodeURIComponent(`${c.latitude},${c.longitude}`)}`}catch(_){}
  window.open(`https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(`${asset.latitude},${asset.longitude}`)}&travelmode=driving`,'_blank','noopener');
}
async function openV300AssetDetails(asset){
  if(!asset||asset.family_code==='repeater')return;
  const root=document.getElementById('modal-root');if(!root)return;
  const photo=await localProfilePhoto(asset.id),g=detailGroups(asset),canRoute=asset.family_code==='distribution_recloser'&&asset.latitude!=null&&asset.longitude!=null;
  root.innerHTML=`<div class="modal" id="v300-asset-modal"><div class="modal-card report-modal-card v300-asset-detail">
    <button class="modal-close" id="v300-close-asset" type="button" aria-label="Fechar"><span data-icon="x"></span></button>
    <div class="v300-detail-header"><div><span class="status-pill imported">${esc300(familyLabel(asset.family_code))}</span><h2>${esc300(asset.operating_code||asset.display_name)}</h2><p class="muted">${esc300([asset.substation_code,asset.location_name].filter(Boolean).join(' — '))}</p></div></div>
    <div class="v300-detail-layout">
      <aside class="v300-detail-profile">
        <button type="button" class="v300-profile-photo" id="v300-detail-photo">${photo?`<img src="${blobUrl(photo)}" alt="Foto do ativo"><span>Alterar foto</span>`:`<span data-icon="settings"></span><strong>Adicionar foto do ativo</strong>`}</button>
        ${canRoute?`<button type="button" class="btn primary v300-route-button" id="v300-route"><span data-icon="arrow-right"></span>Traçar rota</button>`:''}
      </aside>
      <div class="v300-detail-content">
        ${sectionMarkup('Identificação',g.identification)}
        ${sectionMarkup('Operacional e localização',g.operational)}
        ${sectionMarkup('Detalhes técnicos',g.technical)}
        ${sectionMarkup('Comunicação',g.communication)}
        ${sectionMarkup('Outras informações técnicas',g.other)}
      </div>
    </div>
  </div></div>`;
  root.querySelector('#v300-close-asset').onclick=()=>{root.innerHTML=''};
  root.querySelector('#v300-detail-photo').onclick=()=>chooseDetailPhoto(asset);
  root.querySelector('#v300-route')?.addEventListener('click',()=>routeToAsset(asset));
  root.querySelector('#v300-asset-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)root.innerHTML=''});
  hydrateIcons?.(root);
}

/* window/capture vem antes do listener antigo da v2.0.7 no document. */
window.addEventListener('click',event=>{
  const row=event.target.closest?.('[data-v206-db-front-asset]');
  if(!row||state?.screen!=='database'||state?.databaseFront!=='distribution')return;
  const asset=frontAssetById(row.dataset.v206DbFrontAsset);if(!asset)return;
  event.preventDefault();event.stopImmediatePropagation();openV300AssetDetails(asset);
},true);

function enhance(){
  v300UpdateLoginGreeting();
  styleIntegrationEntry();
  enhanceCommunicationGroup();
  enhanceCommunicationSuccess();
  installQueueBackCleanup();
  enhanceDatabaseGroups();
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
  }
});

window.addEventListener('pageshow',v300UpdateLoginGreeting);

setTimeout(v300UpdateLoginGreeting,0);

})();
