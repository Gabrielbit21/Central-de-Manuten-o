/* Central de Manutenção SE — v2.0.6
 * Distribuição + Telecom + governança cadastral + offline resiliente.
 * Carregado depois do app principal para preservar compatibilidade com Subestações.
 */
(() => {
  'use strict';
  if(globalThis.__CENTRAL_V205__) return;
  globalThis.__CENTRAL_V205__=true;

  const V205_VERSION='2.0.6';
  const OFFLINE_AUTH_MAX_MS=7*24*60*60*1000;
  const FRONT_CACHE_PREFIX='v205-front-assets:';
  const FRONT_LABELS={substation:'Subestação',distribution:'Distribuição',telecom:'Telecom'};
  const OPERATORS=['Algar','Claro','Vivo','Tim'];
  const REPEATER_ALIASES={
    'UCD':'CORONEL DOMINICIANO','USINA CORONEL DOMINICIANO':'CORONEL DOMINICIANO','CORONEL DOMICILIANO':'CORONEL DOMINICIANO',
    'UBA':'UBÁ','SANTANA DE MANHUAÇU':'SANTANA DO MANHUAÇU','ALTO DA CONCEIÇÃO (CEMIG)':'ALTO DA CONCEIÇÃO',
    'PAULA CANDIDO':'PAULA CÂNDIDO','SIMONESIA':'SIMONÉSIA'
  };

  state.frontAssets=state.frontAssets||[];
  state.frontAssetMap=state.frontAssetMap||new Map();
  state.databaseFront=state.databaseFront||'all';
  state.distributionFamily=state.distributionFamily||null;
  state.v205Asset=state.v205Asset||null;
  state.v205Activity=state.v205Activity||null;
  state.v205TelecomLocation=state.v205TelecomLocation||null;
  state.v205TelecomSubstation=state.v205TelecomSubstation||null;

  const norm=v=>normalize(String(v??''));
  const nowIso=()=>new Date().toISOString();
  const safeJson=(value,fallback=null)=>{try{return JSON.parse(value)}catch{return fallback}};
  const compactCode=v=>norm(v).replace(/[^a-z0-9]/g,'');
  const frontLabel=code=>FRONT_LABELS[code]||code||'Subestação';
  const prettyKey=key=>String(key||'').replace(/^data\./,'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
  const isUnknown=(asset,path)=>asset?.data_state?.[path]==='unknown'||getAssetField(asset,path)==='?';
  const cleanExisting=v=>v===null||v===undefined||v===''||v==='-'?'':String(v);

  function frontCacheKey(){return `${FRONT_CACHE_PREFIX}${state.cloudUser?.id||'anonymous'}`}
  function frontFamilyLabel(code){return ({distribution_recloser:'Religador de Distribuição',voltage_regulator:'Regulador de Tensão',repeater:'Repetidora',telecom_site:'Local de Telecom',radio_voice_vhf:'Rádio de Voz VHF',radio_data_uhf:'Rádio de Dados UHF',radio_microwave:'Rádio Micro-ondas',converter_125_12:'Conversor 125/12 Vcc',converter_125_12_detailed:'Conversor 125/12 Vcc',converter_125_48:'Conversor 125/48 Vcc',router:'Roteador',claroty:'Claroty'})[code]||prettyKey(code)}
  function frontAssetTitle(a){return a?.operating_code||a?.display_name||'Ativo'}
  function normalizeRepeaterName(value){const raw=String(value||'').trim(),upper=raw.toUpperCase();return REPEATER_ALIASES[upper]||raw}
  function getAssetField(asset,path){
    if(!asset||!path)return null;
    if(path.startsWith('data.')){let v=asset.data;for(const part of path.slice(5).split('.')){if(v==null)return null;v=v[part]}return v}
    return asset[path];
  }
  function setObjectPath(target,path,value){const parts=path.split('.');let cur=target;for(let i=0;i<parts.length-1;i++){const p=parts[i];cur[p]??={};cur=cur[p]}cur[parts.at(-1)]=value}
  function standardFrontAsset(row){
    const a={...row};a.row_version=Number(a.row_version||1);a.data=a.data||{};a.data_state=a.data_state||{};a.active=a.active!==false;
    return a;
  }
  function applyFrontAssets(rows){state.frontAssets=(rows||[]).map(standardFrontAsset);state.frontAssetMap=new Map(state.frontAssets.map(a=>[a.id,a]));}
  function frontAssetsByFamily(family){return state.frontAssets.filter(a=>a.family_code===family)}
  function repeaters(){return frontAssetsByFamily('repeater').sort((a,b)=>a.display_name.localeCompare(b.display_name,'pt-BR'))}
  function telecomSites(){return frontAssetsByFamily('telecom_site')}
  function telecomChildren(parentId){return state.frontAssets.filter(a=>a.parent_id===parentId).sort((a,b)=>frontFamilyLabel(a.family_code).localeCompare(frontFamilyLabel(b.family_code),'pt-BR'))}
  function relayAssets(){return frontAssetsByFamily('distribution_recloser')}
  function regulatorAssets(){return frontAssetsByFamily('voltage_regulator')}
  function findRepeaterByName(name){const n=norm(normalizeRepeaterName(name));return repeaters().find(r=>norm(r.display_name)===n||((r.data?.aliases||[]).some(x=>norm(x)===n)))||null}

  async function loadStaticFrontAssets(){
    try{
      const response=await fetch('./assets/data/v205/front-assets.json',{cache:'no-store'});if(!response.ok)throw new Error('Base local v2.0.5 indisponível');
      const rows=await response.json();return Array.isArray(rows)?rows:[];
    }catch(_){return []}
  }
  async function loadV205FrontAssets(){
    const key=frontCacheKey(),cached=await idbGet('cloudCache',key).catch(()=>null);
    if(navigator.onLine&&state.cloudUser&&cloudClient){
      try{
        const rows=await paginatedSelect('front_assets','*','display_name');
        if(rows?.length){applyFrontAssets(rows);await idbPut('cloudCache',{key,data:rows,updatedAt:nowIso(),userId:state.cloudUser.id});return rows}
      }catch(error){console.warn('[v2.0.5] front_assets:',error)}
    }
    if(cached?.data?.length){applyFrontAssets(cached.data);return cached.data}
    const local=await loadStaticFrontAssets();if(local.length){applyFrontAssets(local);await idbPut('cloudCache',{key,data:local,updatedAt:nowIso(),userId:state.cloudUser?.id||null}).catch(()=>{});return local}
    applyFrontAssets([]);return [];
  }

  /* ---------- histórico legado + carga inicial v2.0.5 ---------- */
  const HISTORY_CACHE_PREFIX='v205-front-history:';
  state.frontHistory=state.frontHistory||[];
  function historyCacheKey(){return `${HISTORY_CACHE_PREFIX}${state.cloudUser?.id||'anonymous'}`}
  async function loadStaticFrontHistory(){
    try{const response=await fetch('./assets/data/v205/front-history.json',{cache:'no-store'});if(!response.ok)throw new Error('Histórico local v2.0.5 indisponível');const rows=await response.json();return Array.isArray(rows)?rows:[]}catch(_){return []}
  }
  async function loadV205History(){
    const key=historyCacheKey(),cached=await idbGet('cloudCache',key).catch(()=>null);
    if(navigator.onLine&&state.cloudUser&&cloudClient){
      try{const {data,error}=await cloudClient.from('front_asset_history').select('*').order('occurred_on',{ascending:false}).limit(3000);if(error)throw error;if(data?.length){state.frontHistory=data;await idbPut('cloudCache',{key,data,updatedAt:nowIso(),userId:state.cloudUser.id});return data}}catch(error){console.warn('[v2.0.5] front_asset_history:',error)}
    }
    if(cached?.data?.length){state.frontHistory=cached.data;return cached.data}
    const local=await loadStaticFrontHistory();state.frontHistory=local;if(local.length)await idbPut('cloudCache',{key,data:local,updatedAt:nowIso(),userId:state.cloudUser?.id||null}).catch(()=>{});return local
  }
  function frontHistoryForAsset(asset){if(!asset)return[];const code=compactCode(asset.operating_code);return (state.frontHistory||[]).filter(h=>h.asset_id===asset.id||(!h.asset_id&&code&&compactCode(h.operating_code)===code)).sort((a,b)=>String(b.occurred_on||'').localeCompare(String(a.occurred_on||'')))}
  function historySummaryText(h){return h.summary||h.payload?.['Descreva a atividade executada, o diagnóstico identificado e o que ficou pendente.']||''}
  function v205HistoryMarkup(asset,limit=8){const rows=frontHistoryForAsset(asset).slice(0,limit);return `<section class="v205-history"><h3>Histórico de manutenção <span class="muted" style="font-size:10px">${frontHistoryForAsset(asset).length} registro(s)</span></h3><div class="v205-history-list">${rows.length?rows.map(h=>`<button class="v205-history-item" type="button" data-v205-history="${h.id}"><b>${esc(formatDate(h.occurred_on))} · ${esc(h.maintenance_type||'Atendimento')}</b><span>${esc([h.work_order,h.team].filter(Boolean).join(' · '))}</span>${historySummaryText(h)?`<p>${esc(historySummaryText(h))}</p>`:''}</button>`).join(''):'<div class="empty">Sem histórico vinculado a este ativo.</div>'}</div></section>`}
  function openV205HistoryDetails(id){const h=(state.frontHistory||[]).find(x=>x.id===id);if(!h)return;const payload=Object.entries(h.payload||{}).filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()!=='');document.getElementById('modal-root').innerHTML=`<div class="modal" id="v205-history-modal"><div class="modal-card v205-history-full"><button class="modal-close" id="v205-close-history"><span data-icon="x"></span></button><h2>${esc(h.maintenance_type||'Atendimento de Distribuição')}</h2><p class="muted">${esc([formatDate(h.occurred_on),h.operating_code,h.work_order,h.team].filter(Boolean).join(' · '))}</p>${historySummaryText(h)?`<div class="detail-block"><h3>Atividade, diagnóstico e pendências</h3><p>${esc(historySummaryText(h))}</p></div>`:''}<div class="v205-history-payload">${payload.map(([k,v])=>`<div><b>${esc(k)}</b><span>${esc(Array.isArray(v)?v.join(', '):String(v))}</span></div>`).join('')}</div></div></div>`;hydrateIcons(document.getElementById('modal-root'));document.getElementById('v205-close-history').onclick=()=>document.getElementById('modal-root').innerHTML=''}
  function bindV205History(root=document){root.querySelectorAll('[data-v205-history]').forEach(b=>b.onclick=()=>openV205HistoryDetails(b.dataset.v205History))}

  let v205SeedRunning=false;
  async function seedV205BaselineIfNeeded(){
    if(v205SeedRunning||state.role!=='admin'||!navigator.onLine||!state.cloudUser)return false;v205SeedRunning=true;
    try{
      const localAssets=await loadStaticFrontAssets();
      if(localAssets.length){
        const {count,error}=await cloudClient.from('front_assets').select('*',{count:'exact',head:true});if(error)throw error;
        if(Number(count||0)<localAssets.length){
          const ordered=[...localAssets].sort((a,b)=>{const pa=['repeater','telecom_site'].includes(a.family_code)?0:1,pb=['repeater','telecom_site'].includes(b.family_code)?0:1;return pa-pb});
          for(let i=0;i<ordered.length;i+=80){const {error:seedError}=await cloudClient.rpc('seed_v205_front_assets',{p_rows:ordered.slice(i,i+80)});if(seedError)throw seedError}
          await loadV205FrontAssets();
        }
      }
      const localHistory=await loadStaticFrontHistory();
      if(localHistory.length){
        const {count,error}=await cloudClient.from('front_asset_history').select('*',{count:'exact',head:true});if(error)throw error;
        if(Number(count||0)<localHistory.length){
          setTimeout(async()=>{try{for(let i=0;i<localHistory.length;i+=80){const {error:e}=await cloudClient.rpc('seed_v205_front_history',{p_rows:localHistory.slice(i,i+80)});if(e)throw e}await loadV205History()}catch(error){console.warn('[v2.0.5] carga de histórico:',error)}},20);
        }
      }
      return true;
    }catch(error){console.warn('[v2.0.5] carga inicial:',error);return false}finally{v205SeedRunning=false}
  }

  /* ---------- autorização offline por 7 dias ---------- */
  function cachedValidation(){const c=cachedIdentity?.();const stamp=c?.validatedAt||c?.authenticatedAt;const time=stamp?new Date(stamp).getTime():0;return {cached:c,time,valid:!!time&&Date.now()-time>=0&&Date.now()-time<=OFFLINE_AUTH_MAX_MS}}
  const baseStoreIdentity=storeIdentity;
  storeIdentity=function(user,profile){
    const previous=cachedIdentity?.();baseStoreIdentity(user,profile);const current=cachedIdentity?.()||{};
    const validatedAt=(navigator.onLine&&!state.offlineSession)?nowIso():(previous?.validatedAt||previous?.authenticatedAt||current.authenticatedAt);
    localStorage.setItem('central_offline_identity',JSON.stringify({...current,offlineCredential:previous?.offlineCredential||current?.offlineCredential||null,validatedAt,authenticatedAt:validatedAt}));
  };
  markDailySession=function(){const c=cachedIdentity?.();if(c){const stamp=nowIso();localStorage.setItem('central_offline_identity',JSON.stringify({...c,validatedAt:stamp,authenticatedAt:stamp}))}localStorage.setItem('central_daily_session_day',dailySessionDay())};
  dailySessionValid=function(){return cachedValidation().valid};
  enforceDailySessionBoundary=async function(){
    const {valid}=cachedValidation();if((state.cloudUser||cachedIdentity?.())&&!valid){await preserveCurrentDraftBeforeDailyLogout?.();state.cloudUser=null;state.cloudProfile=null;state.cloudReports=[];state.offlineSession=false;document.getElementById('app-shell')?.classList.add('hidden');document.getElementById('auth-shell')?.classList.remove('hidden');showAuthTab('login');authMessage('Conecte-se à internet para renovar a autorização deste dispositivo.','info')}
  };
  function showOfflineAccess(){if(typeof syncLoginConnectivityUi==='function')syncLoginConnectivityUi();return false}
  function networkLikeError(error){return /failed to fetch|network|load failed|networkerror|fetch/i.test(String(error?.message||error||''))}
  function patchLoginFallback(){if(typeof syncLoginConnectivityUi==='function')syncLoginConnectivityUi()}


  const baseLoadCloudSnapshot=loadCloudSnapshot;
  loadCloudSnapshot=async function(...args){const result=await baseLoadCloudSnapshot(...args);await loadV205FrontAssets();await loadV205History();return result};
  const baseEnterApplication=enterApplication;
  enterApplication=async function(user,profile,options={}){const result=await baseEnterApplication(user,profile,options);if(state.cloudUser)await loadV205FrontAssets();return result};

  /* ---------- máscaras / validações ---------- */
  function digits(v){return String(v||'').replace(/\D/g,'')}
  function maskIccid(v){return '#'+digits(v).slice(0,20)}
  function validIccid(v){return /^#\d{20}$/.test(String(v||''))}
  function validImeI(v){return /^\d{15}$/.test(digits(v))}
  function validIpv4(v){const p=String(v||'').trim().split('.');return p.length===4&&p.every(x=>/^\d{1,3}$/.test(x)&&Number(x)>=0&&Number(x)<=255)}
  function validCommFirmware(v){return /^\d+(?:\.\d+){2}$/.test(String(v||'').trim())}
  function bindMasks(root=document){
    root.querySelectorAll('[data-mask="iccid"]').forEach(i=>{const apply=()=>{i.value=maskIccid(i.value)};i.addEventListener('input',apply);apply()});
    root.querySelectorAll('[data-mask="imei"]').forEach(i=>i.addEventListener('input',()=>i.value=digits(i.value).slice(0,15)));
    root.querySelectorAll('[data-mask="ipv4"]').forEach(i=>i.addEventListener('input',()=>i.value=i.value.replace(/[^\d.]/g,'').slice(0,15)));
    root.querySelectorAll('[data-mask="firmware3"]').forEach(i=>i.addEventListener('input',()=>i.value=i.value.replace(/[^\d.]/g,'')));
  }
  function validateMaskedFields(root){
    let ok=true;
    root.querySelectorAll('[data-mask]').forEach(i=>{if(i.disabled||i.closest('[hidden],.hidden')){i.setCustomValidity('');return}if(!i.value){i.setCustomValidity('');return}let good=true,m='';if(i.dataset.mask==='iccid'){good=validIccid(i.value);m='ICCID deve possuir # seguido de 20 dígitos.'}if(i.dataset.mask==='imei'){good=validImeI(i.value);m='IMEI deve possuir 15 dígitos.'}if(i.dataset.mask==='ipv4'){good=validIpv4(i.value);m='Informe um endereço IPv4 válido.'}if(i.dataset.mask==='firmware3'){good=validCommFirmware(i.value);m='Firmware deve usar três blocos numéricos, por exemplo 1.9.3.'}i.setCustomValidity(good?'':m);if(!good)ok=false});return ok;
  }

  function options(list,selected=''){return list.map(v=>`<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(v)}</option>`).join('')}
  function yesNo(name,label,required=true,value=''){return `<div class="field"><label>${required?requiredLabel(label):esc(label)}</label><select name="${esc(name)}" ${required?'required':''}><option value="">Selecione</option>${options(['Sim','Não'],value)}</select></div>`}
  function textField(name,label,{required=false,value='',placeholder='',mask='',type='text',full=false,inputmode=''}={}){return `<div class="field ${full?'full':''}"><label>${required?requiredLabel(label):esc(label)}</label><input type="${type}" name="${esc(name)}" value="${esc(value)}" ${required?'required':''} ${mask?`data-mask="${mask}"`:''} ${inputmode?`inputmode="${inputmode}"`:''} placeholder="${esc(placeholder)}"></div>`}
  function textArea(name,label,{required=false,value='',placeholder='',full=true}={}){return `<div class="field ${full?'full':''}"><label>${required?requiredLabel(label):esc(label)}</label><textarea name="${esc(name)}" ${required?'required':''} placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`}
  function selectField(name,label,items,{required=false,value='',full=false}={}){return `<div class="field ${full?'full':''}"><label>${required?requiredLabel(label):esc(label)}</label><select name="${esc(name)}" ${required?'required':''}><option value="">Selecione</option>${options(items,value)}</select></div>`}
  function checkGroup(name,label,items,required=false){return `<div class="field full v205-check-field" data-check-required="${required?'true':'false'}"><label>${required?requiredLabel(label):esc(label)}</label><div class="v205-check-grid">${items.map((x,i)=>`<label><input type="checkbox" name="${esc(name)}" value="${esc(x)}"> <span>${esc(x)}</span></label>`).join('')}</div></div>`}
  function section(title,body,subtitle=''){return `<div class="v205-form-section"><div class="v205-section-title"><h3>${esc(title)}</h3>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><div class="form-grid">${body}</div></div>`}
  function dynamicBlock(id,body,hidden=true){return `<div id="${id}" class="v205-conditional ${hidden?'hidden':''}">${body}</div>`}
  function formValues(form){const fd=new FormData(form),out={};for(const [k,v] of fd.entries()){if(out[k]!==undefined)out[k]=Array.isArray(out[k])?[...out[k],v]:[out[k],v];else out[k]=v}return out}
  function checkRequiredGroups(form){let ok=true;form.querySelectorAll('[data-check-required="true"]').forEach(g=>{if(g.closest('[hidden],.hidden')){g.classList.remove('v205-invalid');return}const controls=[...g.querySelectorAll('input[type=checkbox],input[type=radio]')].filter(x=>!x.disabled&&!x.closest('[hidden],.hidden'));if(!controls.length){g.classList.remove('v205-invalid');return}const any=controls.some(x=>x.checked);g.classList.toggle('v205-invalid',!any);if(!any)ok=false});if(!ok)toast('Preencha os grupos obrigatórios.','warning');return ok}

  /* ---------- saneamento cadastral transversal ---------- */
  const FIELD_META={
    'status':{label:'Situação / status'},'region':{label:'Região'},'substation_code':{label:'Subestação'},'feeder':{label:'Alimentador'},'location_name':{label:'Localização'},
    'manufacturer':{label:'Fabricante'},'model':{label:'Modelo'},'serial_number':{label:'Número de série'},'operating_code':{label:'Código operativo'},
    'data.point_map':{label:'Mapa de pontos'},'data.position':{label:'Posição'},'data.affected_customers':{label:'Clientes afetados'},'data.address':{label:'Endereço'},
    'data.switch_model':{label:'Modelo da chave'},'data.switch_serial':{label:'Nº de série da chave'},'data.control_model':{label:'Modelo do controle'},'data.control_serial':{label:'Nº de série do controle'},
    'data.battery_specification':{label:'Especificação da bateria'},'data.battery_spec':{label:'Especificação da bateria (legado)'},'data.battery_last_change':{label:'Última troca da bateria'},'data.relay_firmware':{label:'Firmware do relé'},
    'data.communication_identifier':{label:'IMEI / identificador de comunicação'},'data.communication_medium':{label:'Meio de comunicação'},'data.communication_manufacturer':{label:'Fabricante da comunicação'},
    'data.communication_technology':{label:'Tecnologia de comunicação'},'data.communication_firmware':{label:'Firmware da comunicação',mask:'firmware3'},'data.repeater_name':{label:'Repetidora'},
    'data.radio_ip':{label:'IP do rádio',mask:'ipv4'},'data.relay_ip':{label:'IP do relé',mask:'ipv4'},
    'data.sim1_operator':{label:'Operadora chip 1',operator:true},'data.sim1_iccid':{label:'ICCID chip 1',mask:'iccid'},'data.sim2_operator':{label:'Operadora chip 2',operator:true},'data.sim2_iccid':{label:'ICCID chip 2',mask:'iccid'},
    'data.firmware':{label:'Firmware'},'data.control_serial':{label:'Nº de série do controle'},'data.communication_type':{label:'Tipo de comunicação'},'data.chip_legacy':{label:'Identificador de comunicação legado'},
    'data.structure_type':{label:'Tipo da estrutura'},'data.structure_manufacturer':{label:'Fabricante da estrutura'},'data.structure_height_m':{label:'Altura da estrutura (m)'},'data.installation_year':{label:'Ano de instalação'},
    'data.aev_tower':{label:'AEV da torre'},'data.aev_installed':{label:'AEV instalado'},'data.battery_48v_banks':{label:'Quantidade de bancos 48 V'},'data.battery_type':{label:'Tipo de bateria'},
    'data.battery_manufacturer':{label:'Fabricante da bateria'},'data.xps_ip':{label:'IP do retificador/XPS',mask:'ipv4'},'data.xps_model':{label:'Modelo do retificador/XPS'},
    'data.city':{label:'Cidade'},'data.site_key_type':{label:'Tipo de chave de acesso'},'data.road_dry':{label:'Acesso em tempo seco'},'data.road_rain':{label:'Acesso com chuva'},'data.night_service':{label:'Atendimento noturno'}
  };
  Object.assign(FIELD_META,{
    'data.switch_manufacture_year':{label:'Ano de fabricação da chave'},
    'data.control_install_year':{label:'Ano de instalação do controle'},
    'data.network_voltage':{label:'Tensão da rede'},
    'data.reviewed_on':{label:'Data da última revisão da base'},
    'data.linked_repeater_external_key':{label:'Identificador interno da repetidora'},
    'data.regulator_name':{label:'Identificação do regulador'},
    'data.automated':{label:'Automatizado'},
    'data.power':{label:'Potência'},
    'data.reference_voltage':{label:'Tensão de referência'},
    'data.tp_ratio':{label:'Relação TP'},
    'data.cell_quantity':{label:'Quantidade de células'},
    'data.legacy_chip':{label:'Identificador legado do chip'},
    'data.unit':{label:'Unidade'},
    'data.cps':{label:'CPS'},
    'data.ownership':{label:'Propriedade'},
    'data.shelter_type':{label:'Tipo de abrigo'},
    'data.tower_technologies':{label:'Tecnologias instaladas na torre'},
    'data.primary_comm_medium':{label:'Meio de comunicação principal'},
    'data.primary_network_type':{label:'Rede principal'},
    'data.redundant_comm_medium':{label:'Meio de comunicação redundante'},
    'data.observations':{label:'Observações'},
    'data.improvement_need':{label:'Necessidade de melhoria'},
    'data.grounding':{label:'Aterramento'},
    'data.utility_installation':{label:'Instalação da concessionária'},
    'data.utility_feeder':{label:'Alimentador da concessionária'},
    'data.utility_switch':{label:'Chave da concessionária'},
    'data.access_4x2':{label:'Acesso com veículo 4x2'},
    'data.access_trail':{label:'Acesso por trilha'},
    'data.fence_type':{label:'Tipo de fechamento do terreno'},
    'data.ac_capacity':{label:'Capacidade do ar-condicionado'},
    'data.ac_type':{label:'Tipo de ar-condicionado'},
    'data.ac_quantity':{label:'Quantidade de aparelhos de ar-condicionado'},
    'data.ac_status':{label:'Situação do ar-condicionado'},
    'data.ac_brand':{label:'Marca do ar-condicionado'},
    'data.ac_model':{label:'Modelo do ar-condicionado'},
    'data.ac_serial':{label:'Número de série do ar-condicionado'},
    'data.camera_bullet_quantity':{label:'Quantidade de câmeras bullet'},
    'data.camera_bullet_model':{label:'Modelo da câmera bullet'},
    'data.camera_speed_dome_tower_height':{label:'Altura da câmera Speed Dome'},
    'data.camera_speed_dome_location':{label:'Localização da câmera Speed Dome'},
    'data.camera_speed_dome_quantity':{label:'Quantidade de câmeras Speed Dome'},
    'data.xps_protocol':{label:'Protocolo do retificador/XPS'},
    'data.xps_sit_management':{label:'Gerenciamento do XPS no SIT'},
    'data.electrical_condition':{label:'Condição da instalação elétrica'},
    'data.battery_next_change':{label:'Próxima troca das baterias'},
    'data.battery_autonomy':{label:'Autonomia das baterias'},
    'data.vegetation_priority':{label:'Prioridade de limpeza de vegetação'},
    'data.vegetation_cleanings_year':{label:'Limpezas de vegetação por ano'},
    'data.electrical_planned_date':{label:'Data prevista para adequação elétrica'}
  });
  const V209_HIDDEN_CADASTRAL_KEYS=new Set([
    'source_row','monthly_status','aliases','reviewed_on','linked_repeater_external_key',
    'rent_value','rent_expiry','land_contract_type','land_contract_expiry','land_expiry',
    'land_status','land_dup','physical_units'
  ]);
  function fieldMeta(path){return FIELD_META[path]||{label:prettyKey(path)}}
  function flattenEditableData(obj,prefix='data',out=[]){
    if(!obj||typeof obj!=='object')return out;
    for(const [k,v] of Object.entries(obj)){
      const p=`${prefix}.${k}`;
      if(V209_HIDDEN_CADASTRAL_KEYS.has(k)||/_external_key$/i.test(k))continue;
      if(Array.isArray(v)){continue}
      if(v&&typeof v==='object')flattenEditableData(v,p,out);else out.push(p);
    }
    return out;
  }
  function frontEditablePaths(asset){return [...new Set(['status','region','substation_code','feeder','location_name','manufacturer','model','serial_number',...flattenEditableData(asset?.data||{})])].filter(p=>getAssetField(asset,p)!==undefined)}
  const LEGACY_FIELDS=[['manufacturer','Fabricante','fabricante'],['model','Modelo','modelo'],['serial_number','Número de série','serial'],['operating_number','Número operativo','numeroOperativo'],['identification','Identificação','identificacao'],['location','Localização','localizacao'],['circuit','Circuito','circuito'],['notes','Observações','observacoes']];
  function cadastralInput(path,value='',required=false){const meta=fieldMeta(path);if(meta.operator)return `<select data-cadastral-new="${esc(path)}" ${required?'required':''}><option value="">Selecione</option>${options(OPERATORS,value)}</select>`;return `<input data-cadastral-new="${esc(path)}" value="${esc(value==='?'?'':cleanExisting(value))}" ${required?'required':''} ${meta.mask?`data-mask="${meta.mask}"`:''}>`}
  function frontUnknownPaths(asset){return Object.entries(asset?.data_state||{}).filter(([,v])=>v==='unknown').map(([k])=>k.startsWith('data.')?k:`data.${k}`).concat(['status','region','substation_code','feeder','location_name','manufacturer','model','serial_number'].filter(p=>getAssetField(asset,p)==='?'))}
  function cadastralMarkup(asset,source='front_assets'){
    const unknown=source==='front_assets'?frontUnknownPaths(asset):LEGACY_FIELDS.filter(([, ,local])=>asset?.[local]==='?').map(([db])=>db);
    const paths=source==='front_assets'?frontEditablePaths(asset):LEGACY_FIELDS.map(([db])=>db);
    const fieldLabel=p=>source==='front_assets'?fieldMeta(p).label:(LEGACY_FIELDS.find(([db])=>db===p)?.[1]||p);
    const oldValue=p=>source==='front_assets'?getAssetField(asset,p):asset?.[LEGACY_FIELDS.find(([db])=>db===p)?.[2]];
    return `<section class="v205-cadastral" data-cadastral-source="${source}" data-cadastral-asset="${esc(asset.id)}" data-cadastral-version="${Number(asset.row_version||asset.rowVersion||1)}">
      ${unknown.length?`<div class="v205-section-title"><h3>Dados cadastrais pendentes</h3><p>Estes dados estão desconhecidos na base e devem ser confirmados neste atendimento.</p></div><div class="form-grid v205-unknown-grid">${unknown.map(p=>`<div class="field"><label>${requiredLabel(fieldLabel(p))}</label>${cadastralInput(p,'',true)}<small class="v205-field-note">Cadastro atual: não informado</small></div>`).join('')}</div>`:''}
      <div class="v205-divergence-head"><button class="btn secondary v205-add-divergence" type="button">Informar divergência cadastral</button><span class="muted">Use somente se algum dado existente estiver incorreto ou desatualizado.</span></div>
      <div class="v205-divergence-list"></div>
      <template class="v205-divergence-template"><div class="v205-divergence-row"><select class="v205-divergence-field"><option value="">Selecione o dado</option>${paths.map(p=>`<option value="${esc(p)}">${esc(fieldLabel(p))}</option>`).join('')}</select><div class="v205-divergence-editor"></div><button type="button" class="v205-remove-divergence" aria-label="Remover">×</button></div></template>
      <input type="hidden" name="assetChangesJson" value="[]">
    </section>`;
  }
  function bindCadastral(root,asset,source='front_assets'){
    const sectionEl=root.querySelector('.v205-cadastral');if(!sectionEl)return;
    const list=sectionEl.querySelector('.v205-divergence-list'),template=sectionEl.querySelector('.v205-divergence-template');
    const oldValue=p=>source==='front_assets'?getAssetField(asset,p):asset?.[LEGACY_FIELDS.find(([db])=>db===p)?.[2]];
    const label=p=>source==='front_assets'?fieldMeta(p).label:(LEGACY_FIELDS.find(([db])=>db===p)?.[1]||p);
    function editorMarkup(p){const meta=source==='front_assets'?fieldMeta(p):{};const current=cleanExisting(oldValue(p));if(meta.operator)return `<select class="v205-divergence-value"><option value="">Novo valor</option>${options(OPERATORS,current)}</select>`;return `<input class="v205-divergence-value" value="" placeholder="Novo valor" ${meta.mask?`data-mask="${meta.mask}"`:''}>`}
    sectionEl.querySelector('.v205-add-divergence').onclick=()=>{const frag=template.content.cloneNode(true),row=frag.querySelector('.v205-divergence-row');row.querySelector('.v205-divergence-field').onchange=e=>{row.querySelector('.v205-divergence-editor').innerHTML=e.target.value?editorMarkup(e.target.value):'';bindMasks(row);sync()};row.querySelector('.v205-remove-divergence').onclick=()=>{row.remove();sync()};list.appendChild(frag)};
    function sync(){
      const changes=[],version=Number(sectionEl.dataset.cadastralVersion||1),assetId=sectionEl.dataset.cadastralAsset;
      sectionEl.querySelectorAll('[data-cadastral-new]').forEach(i=>{const path=i.dataset.cadastralNew;if(String(i.value||'').trim())changes.push({asset_source:source,asset_id:assetId,field_path:path,label:label(path),old_value:oldValue(path)??null,new_value:i.value,base_version:version,reason:'unknown'})});
      list.querySelectorAll('.v205-divergence-row').forEach(row=>{const path=row.querySelector('.v205-divergence-field')?.value,val=row.querySelector('.v205-divergence-value')?.value;if(path&&String(val||'').trim()&&String(val)!==String(oldValue(path)??''))changes.push({asset_source:source,asset_id:assetId,field_path:path,label:label(path),old_value:oldValue(path)??null,new_value:val,base_version:version,reason:'divergence'})});
      const hidden=sectionEl.querySelector('[name=assetChangesJson]');if(hidden)hidden.value=JSON.stringify(changes);
      return changes;
    }
    sectionEl.addEventListener('input',sync);sectionEl.addEventListener('change',sync);bindMasks(sectionEl);sectionEl._v205Sync=sync;
  }

  /* ---------- formulários Distribuição / Telecom ---------- */
  function attendanceBaseMarkup(){return section('Dados do atendimento',
    textField('data','Data do atendimento',{required:true,type:'date'})+
    textField('os','Ordem de serviço',{placeholder:'Ex.: OS / chamado'})+
    textField('equipe','Equipe técnica responsável',{required:true,value:state.cloudProfile?.display_name||''})+
    textField('inicio','Início do atendimento',{type:'time'})+
    textField('fim','Fim do atendimento',{type:'time'})
  )}
  function distributionClosingMarkup(){return section('Encerramento da atividade',
    yesNo('groundingGood','O aterramento está em boas condições?')+
    yesNo('surgeArrestersGood','Os para-raios estão em boas condições?')+
    textArea('executionDiagnosis','Descreva a atividade executada, o diagnóstico identificado e o que ficou pendente.',{required:true})+
    yesNo('returnRequired','Será necessário retornar ao equipamento?')+
    yesNo('bypassed','Equipamento ficou By-passado (Fora de Operação)?')+
    dynamicBlock('v205-bypass-reason',selectField('bypassReason','Motivo do equipamento permanecer fora de operação',[
      'Faltou peça ou material para concluir o atendimento','Necessita correção ou substituição de componente em campo','Necessita configuração, comunicação ou comissionamento','Apresentou defeito que exige retirada para oficina','Não foi possível definir durante o atendimento'
    ],{required:true,full:true}))+
    selectField('workshopRemoval','O equipamento precisa ser retirado do campo e enviado para manutenção em oficina?',['SIM — retirada para oficina necessária','NÃO — a correção pode ser realizada em campo/remotamente','NÃO FOI POSSÍVEL DEFINIR'],{required:true,full:true})+
    dynamicBlock('v205-workshop-reason',textArea('workshopReason','Justificativa para retirada do equipamento',{required:true,placeholder:'Informe o defeito identificado e por que ele não pode ser corrigido em campo.'}))
  )}
  function telecomClosingMarkup(){return section('Encerramento',selectField('activityStatus','Situação da atividade',['Concluído','Pendente'],{required:true})+dynamicBlock('v205-pendency',textArea('activityPending','Qual foi a pendência da atividade?',{required:true})))}
  function operatorSelect(name,label,required=false,value=''){return selectField(name,label,[...OPERATORS,'Não há operadora redundante'],{required,value})}
  function batteryOptionsPreventive(){return ['12V 7Ah','12V 12Ah','12V 18Ah','12V 24Ah','12V 26Ah']}
  function batteryOptionsCorrective(){return ['12V 18Ah','12V 7Ah','12V 26Ah','12V 12Ah']}
  function lithiumOptions(){return ['12V 10Ah','24V 10Ah','12V 30Ah']}

  function v209RelayCommunicationMedium(d={}){
    const medium=norm(d.communication_medium),manufacturer=norm(d.communication_manufacturer),technology=norm(d.communication_technology);
    if(medium.includes('radio'))return 'Rádio';
    if(medium.includes('fibra'))return 'Fibra Óptica';
    if(medium.includes('modem')||medium.includes('gprs')){
      if(manufacturer.includes('romagnole'))return 'Modem (Romagnole)';
      if(manufacturer.includes('lupa'))return 'Modem (Lupa)';
      return 'Modem (Lupa)';
    }
    if(medium.includes('orbcomm'))return d.sim2_operator?'ORBCOMM com redundância GPRS':'ORBCOMM';
    if(medium.includes('satelital')){
      if(manufacturer.includes('gilat')||manufacturer.includes('skyedge')||technology.includes('ku'))return 'Skyedge';
      if(manufacturer.includes('orbcomm')||technology.includes('banda l'))return d.sim2_operator?'ORBCOMM com redundância GPRS':'ORBCOMM';
    }
    return '';
  }
  function v209CommissioningMedium(d={}){
    const medium=v209RelayCommunicationMedium(d);
    if(medium.startsWith('Modem'))return '4G/3G';
    return medium;
  }
  function v209RadioModel(d={}){
    const manufacturer=norm(d.communication_manufacturer);
    if(manufacturer.includes('ge mds'))return 'GE MDS';
    if(manufacturer.includes('ge orbit'))return 'GE ORBIT';
    if(manufacturer.includes('apri')||manufacturer.includes('aviat'))return 'Aprisa 4RF/Aviat';
    return '';
  }
  function v209BatteryProfile(spec=''){
    const text=String(spec||'').trim(),n=norm(text);
    if(!text||text==='-'||text==='?')return {type:'',capacity:''};
    const type=n.includes('litio')?'Lítio':'Chumbo Ácida';
    const m=text.match(/(\d+)\s*V\s*(\d+)\s*Ah/i);
    return {type,capacity:m?`${m[1]}V ${m[2]}Ah`:''};
  }
  function v209RepeaterBatteryType(value=''){
    const n=norm(value);
    if(n.includes('litio'))return 'Lítio';
    if(n.includes('chumbo'))return 'Chumbo Ácido';
    return '';
  }
  function v209RepeaterStructureType(value=''){
    const n=norm(value);
    if(n.includes('autoport'))return 'Torre Autoportante';
    if(n.includes('estai'))return 'Torre Estaiada';
    if(n.includes('duplo')||n.includes('duplo t'))return 'Poste Duplo T';
    if(n.includes('circular'))return 'Poste Circular';
    if(n.includes('poste'))return 'Poste Circular';
    return value&&value!=='-'&&value!=='?'?'Outro':'';
  }
  function v209RepeaterStructureManufacturer(value=''){
    const n=norm(value);
    if(n.includes('flex'))return 'Flextower';
    if(n.includes('engefame'))return 'Engefame';
    if(n.includes('adaxa'))return 'Adaxa';
    return value&&value!=='-'&&value!=='?'?'Outro':'';
  }

  function preventiveRelayMarkup(asset){
    const d=asset.data||{};
    return section('Relé e acesso remoto',
      textField('relayFirmware','Firmware do relé',{required:true,value:cleanExisting(d.relay_firmware)})+
      yesNo('remoteAccess','Foi parametrizado acesso remoto?',true)+
      selectField('communicationMedium','Meio de comunicação',['Rádio','ORBCOMM','ORBCOMM com redundância GPRS','Modem (Lupa)','Modem (Romagnole)','Fibra Óptica','Skyedge'],{required:true,full:true,value:v209RelayCommunicationMedium(d)})
    )+
    dynamicBlock('v205-comm-radio',section('Comunicação por rádio',
      selectField('radioModel','Modelo do rádio',['GE MDS','GE ORBIT','Aprisa 4RF/Aviat'],{required:true,value:v209RadioModel(d)})+
      textField('radioSignalSnr','Sinal recebido / SNR',{required:true,placeholder:'Ex.: -90dBm / SNR: 35dB'})+
      textField('radioIp','IP do rádio',{required:true,value:cleanExisting(d.radio_ip),mask:'ipv4',inputmode:'decimal'})+
      textField('communicationFirmware','Firmware de comunicação',{required:true,value:cleanExisting(d.communication_firmware),mask:'firmware3'})+
      selectField('repeater','Repetidora',repeaters().map(r=>r.display_name),{required:true,value:cleanExisting(d.repeater_name)})+
      `<div class="field full v205-photo-requirement"><label>${requiredLabel('Foto georreferenciada do wattímetro — potência direta')}</label><input type="file" accept="image/*" capture="environment" data-v205-photo-role="Potência direta" required></div>`+
      `<div class="field full v205-photo-requirement"><label>${requiredLabel('Foto georreferenciada do wattímetro — potência refletida')}</label><input type="file" accept="image/*" capture="environment" data-v205-photo-role="Potência refletida" required></div>`
    ))+
    dynamicBlock('v205-comm-modem',section('Comunicação por modem',
      selectField('modemTechnology','Tecnologia',['2G','3G','4G'],{required:true,value:cleanExisting(d.communication_technology)})+
      textField('imei','IMEI',{required:true,value:/^#?\d{15}$/.test(String(d.communication_identifier||''))?digits(d.communication_identifier):'',mask:'imei',inputmode:'numeric'})+
      textField('modemFirmware','Firmware do modem',{required:true,value:cleanExisting(d.communication_firmware),mask:'firmware3'})+
      operatorSelect('mainOperator','Operadora principal',true,cleanExisting(d.sim1_operator))+
      operatorSelect('redundantOperator','Operadora redundante',true,cleanExisting(d.sim2_operator)||'Não há operadora redundante')+
      textField('mainIccid','ICCID principal',{required:true,value:cleanExisting(d.sim1_iccid),mask:'iccid',inputmode:'numeric'})+
      textField('redundantIccid','ICCID redundante',{value:cleanExisting(d.sim2_iccid),mask:'iccid',inputmode:'numeric'})+
      textField('modemSignal','Sinal do modem (dBm)',{required:true,placeholder:'Ex.: -75 dBm'})+
      yesNo('canChangeToUhf','É possível alterar a comunicação atual para rádio UHF?',true)+
      dynamicBlock('v205-modem-repeater',selectField('suggestedRepeater','Qual repetidora?',repeaters().map(r=>r.display_name),{required:true,full:true}))
    ))+
    dynamicBlock('v205-comm-orbcomm',section('Comunicação ORBCOMM',
      textField('orbcommNumber','Número / identificador ORBCOMM',{required:true,value:cleanExisting(d.communication_identifier)})+
      textField('orbcommSignal','Sinal recebido',{required:true})+
      yesNo('orbcommCanUhf','É possível alterar a comunicação atual para rádio UHF?',true)+
      dynamicBlock('v205-orbcomm-repeater',selectField('orbcommRepeater','Qual repetidora?',repeaters().map(r=>r.display_name),{required:true,full:true}))
    ))+
    dynamicBlock('v205-comm-skyedge',section('Comunicação Skyedge',
      textField('iduNumber','Número da IDU',{required:true,value:cleanExisting(d.communication_identifier)})+
      textField('iduSignal','Sinal recebido pela IDU',{required:true})+
      yesNo('skyedgeCanUhf','É possível alterar a comunicação atual para rádio UHF?',true)+
      dynamicBlock('v205-skyedge-repeater',selectField('skyedgeRepeater','Qual repetidora?',repeaters().map(r=>r.display_name),{required:true,full:true}))
    ))+
    (()=>{const battery=v209BatteryProfile(d.battery_specification||d.battery_spec);return section('Bateria',yesNo('batteryReplaced','A bateria foi substituída nesta preventiva?')+
      dynamicBlock('v205-preventive-battery',selectField('batteryType','Tipo da bateria instalada',['Lítio','Chumbo Ácida'],{required:true,value:battery.type})+
        dynamicBlock('v205-battery-lithium',selectField('batteryCapacityLithium','Capacidade da bateria',lithiumOptions(),{required:true,value:battery.type==='Lítio'?battery.capacity:''}))+
        dynamicBlock('v205-battery-lead',selectField('batteryCapacityLead','Capacidade da bateria',batteryOptionsPreventive(),{required:true,value:battery.type==='Chumbo Ácida'?battery.capacity:''})))
    )})();
  }

  const COMM_DEFECTS=['Problema no equipamento de comunicação (modem, rádio, orbcomm)','Problema nos periféricos do equipamento do meio de comunicação (antena, cabos)','Problema no chip (apenas se for GPRS)','Problema na ERB (apenas se for GPRS)','Problema na Alimentação do meio de comunicação'];
  const COMM_CAUSES=['Queima do Equipamento de Comunicação','Inseto no Equipamento de Comunicação','Problema interno no Equipamento de Comunicação','Extrapolação do pacote de dados, ocasionando bloqueio da porta de comunicação','Problema de conexão com o equipamento de comunicação','Piora no nível de sinal','Antena danificada','Antena inadequada (Modelo inadequado ou número de elementos insuficientes)','Cabos danificados ou mau contato','Centelhador','Conversor','Queima do chip 1 ou 2','Sem sinal da operadora atual','Chip não conecta','Chip queimado','Falta de Alimentação na ERB','Disjuntor desligado/desarmado','Problema na alimentação externa do relé','Problema com o Scada'];
  const HARDWARE_DEFECTS=['Problema na Bateria','Problema no Controle','Problema na Chave','Problema nos periféricos do religador (Cabos e outros)'];
  const HARDWARE_CAUSES=['Vida útil ultrapassada (desgaste)','Oxidação dos terminais','Bateria estufada','Descarga profunda','Sensor da bateria','Bateria em curto','Defeito em placas internas do controle (RIF, CPU, Fonte, Módulo SIM, DC1000, Toróide, RCM, ...)','Defeito no relé','Ajuste na parametrização do equipamento (atualização de firmware, calibração de tensão...)','Inseto no controle','Conversor','Umidade no controle','Defeito no pólo','Defeito em placas internas da chave (Atuador, SCEM, C100, ...)','Defeito na caixa de interface','Umidade na chave','Defeito nos sensores de tensão e corrente','Problema no Umbilical','Problema no DPS','Problema no disjuntor de CA/CC','Para raios','Aterramento','Conversores','Chicotes internos','Tensão alta na entrada do relé'];
  function correctiveDistributionMarkup(asset){const d=asset?.data||{},battery=v209BatteryProfile(d.battery_specification||d.battery_spec);return section('Tipo de corretiva',checkGroup('correctiveType','Selecione o(s) tipo(s) de corretiva',['Corretiva de Comunicação','Corretiva de Hardware'],true))+
    dynamicBlock('v205-corrective-communication',section('Corretiva de Comunicação',
      checkGroup('communicationDefect','Tipo de defeito',COMM_DEFECTS,true)+checkGroup('communicationCause','Causa do defeito',COMM_CAUSES,true)+
      dynamicBlock('v205-worse-signal',textField('worseSignalValue','Nível de sinal identificado',{required:true,placeholder:'Ex.: -98 dBm'}))+
      yesNo('communicationEquipmentReplaced','Foi substituído o meio/equipamento de comunicação?')+dynamicBlock('v205-communication-replaced',textField('communicationRemoved','Equipamento retirado',{required:true})+textField('communicationInstalled','Equipamento instalado',{required:true}))+
      yesNo('peripheralsReplaced','Foram substituídos periféricos?')+dynamicBlock('v205-peripherals-replaced',textField('peripheralsDetails','Periféricos substituídos',{required:true,full:true}))+
      yesNo('chipReplaced','Foi substituído chip (GPRS)?')+dynamicBlock('v205-chip-replaced',
        textField('chip1Removed','ICCID chip 1 retirado',{required:true,mask:'iccid',inputmode:'numeric'})+textField('chip1Installed','ICCID chip 1 instalado',{required:true,mask:'iccid',inputmode:'numeric'})+
        yesNo('secondChipChanged','Houve troca também do chip 2?',true)+dynamicBlock('v205-chip2-replaced',textField('chip2Removed','ICCID chip 2 retirado',{required:true,mask:'iccid',inputmode:'numeric'})+textField('chip2Installed','ICCID chip 2 instalado',{required:true,mask:'iccid',inputmode:'numeric'}))
      )
    ))+
    dynamicBlock('v205-corrective-hardware',section('Corretiva de Hardware',
      checkGroup('hardwareDefect','Tipo de defeito',HARDWARE_DEFECTS,true)+checkGroup('hardwareCause','Causa do defeito',HARDWARE_CAUSES,true)+
      yesNo('removeSwitch','Será necessário retirar a chave de campo?')+
      yesNo('batteryReplacement','Foi necessário substituir a bateria?')+dynamicBlock('v205-corrective-battery',selectField('correctiveBatteryType','Tipo da bateria',['Chumbo Ácida','Lítio'],{required:true,value:battery.type})+dynamicBlock('v205-corr-battery-lead',selectField('correctiveLeadCapacity','Capacidade',batteryOptionsCorrective(),{required:true,value:battery.type==='Chumbo Ácida'?battery.capacity:''}))+dynamicBlock('v205-corr-battery-lithium',selectField('correctiveLithiumCapacity','Capacidade',lithiumOptions(),{required:true,value:battery.type==='Lítio'?battery.capacity:''})))+
      yesNo('controlParts','Foi necessário substituir peças no controle?')+dynamicBlock('v205-control-parts',textField('controlPartsDetails','Peças substituídas no controle',{required:true,full:true}))+
      yesNo('switchParts','Foi necessário substituir peças na chave?')+dynamicBlock('v205-switch-parts',textField('switchPartsDetails','Peças substituídas na chave',{required:true,full:true}))+
      yesNo('recloserPeripherals','Foi necessário substituir periféricos do religador?')+dynamicBlock('v205-recloser-peripherals',textField('recloserPeripheralsDetails','Periféricos substituídos',{required:true,full:true}))
    ));}

  function matrixMarkup(name,rows,statuses){return `<div class="field full"><div class="v205-matrix-wrap"><table class="v205-matrix"><thead><tr><th>Item verificado</th>${statuses.map(s=>`<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${esc(r)}</td>${statuses.map(s=>`<td><input type="radio" name="${esc(name)}_${i}" value="${esc(s)}" required aria-label="${esc(r)} — ${esc(s)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`}
  const SHELTER_ROWS=['Rádio SHF (Aviat)','Rádio UHF (GE/4RF/LoRa)','Rádio VHF (Repetidora/Fixo)','Roteador/Switch','Retificador/Conversor','Câmeras','Banco de Baterias','Fontes (Todas)','Duplexadores','Tomadas e Lâmpadas','Cabos (RF/Rede/Energia)','Aterramento dos Itens Internos','Abrigo (Telhado/Piso/Elétrica)','Limpeza','Estrada de Acesso','Ar Condicionado','Cadeados e Fechaduras','Medidor/Trafo/Para Raio/Elo Fusível','Alambrado/Muro'];
  const TOWER_ROWS=['Antena VHF Colinear','Antena VHF Yagi','Antena VHF Plano Terra','Antena UHF 400 MHz Colinear','Antena UHF 900 MHz Colinear','Suportes','ODUs','Cabos','Prensa-cabos','Conectores','Estrutura','Linha de vida','Balizador noturno','Para-raio','Aterramento dos Cabos/ODU/Estrutura','Estai'];
  function telecomPreventiveMarkup(asset,isRepeater){
    const d=asset.data||{};
    let html=section('Bancos de baterias',
      textField('battery12Qty','Quantidade de bancos de baterias (12 V)',{required:true,type:'number',inputmode:'numeric'})+
      textField('battery12Voltage','Valor aferido no banco de 12 V',{required:true,type:'number',placeholder:'Ex.: 13.5'})+
      textField('battery48Qty','Quantidade de bancos de baterias (48 V)',{required:true,type:'number',inputmode:'numeric',value:cleanExisting(d.battery_48v_banks)})+
      textField('battery48Voltage','Valor aferido no banco de 48 V',{required:true,type:'number',placeholder:'Ex.: 54.0'})+
      selectField('batteryType','Tipo de bateria',['Lítio','Chumbo Ácido'],{required:true,value:v209RepeaterBatteryType(d.battery_type)})
    )+
    section('Equipamentos internos e abrigo',matrixMarkup('shelterCheck',SHELTER_ROWS,['OK','Falha','Corrigido','Não Possui','Não se Aplica'])+
      dynamicBlock('v205-shelter-failure',textArea('shelterCorrection','Descreva a correção realizada ou detalhe a falha que não pôde ser corrigida.',{required:true}))+textField('txPower','Potência configurada para transmissão no rádio ou repetidora',{required:true,placeholder:'Ex.: 45 W'})+textField('directReflectedPower','Potência direta e refletida aferida do rádio fixo',{required:true})+textField('vswr','Tensão VSWR da repetidora aferida pelo software RDAC',{required:true,placeholder:'Ex.: 1.27 V'})+textArea('internalMeasurements','Valores relevantes aferidos ou coletados dos equipamentos internos',{required:true,placeholder:'Ex.: número de série, modelo, tensão...'}));
    if(isRepeater){
      html+=section('Ciclo da preventiva',selectField('preventiveCycle','Qual preventiva está sendo realizada?',['Primeira','Segunda'],{required:true})+yesNo('hasVerticalStructure','O site possui estrutura vertical de telecomunicações? (Ex.: Torre/Poste)',true,cleanExisting(d.structure_type)?'Sim':''))+
      dynamicBlock('v205-vertical-structure',section('Estrutura vertical',
        selectField('structureType','Tipo de estrutura',['Torre Autoportante','Torre Estaiada','Poste Duplo T','Poste Circular','Outro'],{required:true,value:v209RepeaterStructureType(d.structure_type)})+
        selectField('structureManufacturer','Fabricante da torre',['Flextower','Engefame','Adaxa','Outro'],{required:true,value:v209RepeaterStructureManufacturer(d.structure_manufacturer)})+
        textField('structureYear','Ano de fabricação/instalação',{required:true,type:'number',value:cleanExisting(d.installation_year)})+
        textField('structureHeight','Altura da estrutura (m)',{required:true,type:'number',value:cleanExisting(d.structure_height_m)})+
        textField('towerAev','AEV da torre',{required:true,value:cleanExisting(d.aev_tower)})+
        textArea('antennaHeightModels','Descreva a altura e o modelo de cada antena',{required:true})+
        yesNo('structureClimbed','Houve escalada na estrutura?')+dynamicBlock('v205-no-climb-reason',textArea('noClimbReason','Por qual motivo não houve escalada?',{required:true}))+
        matrixMarkup('towerCheck',TOWER_ROWS,['OK','Falha','Corrigido','Não Possui'])+dynamicBlock('v205-tower-failure',textArea('towerFailureDetails','Qual item apresentou falha? Explique detalhadamente.',{required:true}))+
        selectField('structureCondition','Condição geral da estrutura (0 = péssimo / 10 = ótimo)',Array.from({length:11},(_,i)=>String(i)),{required:true})+
        textField('activeCables','Quantidade de cabos em uso',{required:true,type:'number'})+
        yesNo('hasReserveCables','Existem cabos reserva?')+dynamicBlock('v205-reserve-cables',textField('reserveCableQty','Quantos cabos reserva?',{required:true,type:'number'}))
      ));
    }
    html+=section('Atividade extra',yesNo('extraActivity','Houve atividade extra?',true)+dynamicBlock('v205-extra-activity',textArea('extraActivityDescription','Descreva detalhadamente qual foi a atividade realizada.',{required:true})));
    return html;
  }
  const TELECOM_CORRECTIVE_ITEMS=['ODU','Cabo de RF','Cabo óptico','Antena','Suporte','Conector','Balizador','Torre','Limpeza','Ar-condicionado','Cadeados e fechaduras','Abrigo','Rádio micro-ondas','Roteador','Conversor','Retificador','Banco de baterias','Centelhador','Supressor de surto','Parte elétrica','Enlace de RF','Rádio de voz','Rádio de dados','DPS','Duplexador','Alambrado/muro','Estrada de acesso','Falta de energia','Gerador','Placa solar','Câmera','Arrombamento','Poste'];
  function telecomCorrectiveMarkup(){return section('Itens envolvidos',checkGroup('correctiveItems','Selecione os itens envolvidos no atendimento',TELECOM_CORRECTIVE_ITEMS,true))+
    section('Ocorrências',yesNo('equipmentBurned','Houve queima de equipamento?')+yesNo('memoryCardBurned','Houve queima do cartão de memória?')+yesNo('siteTheft','Houve furto de algum item do site?')+dynamicBlock('v205-police-report',yesNo('policeReportMade','Foi realizado boletim de ocorrência?')+dynamicBlock('v205-police-report-number',textField('policeReportNumber','Número do boletim de ocorrência',{required:true})))+textArea('correctiveDescription','Descreva detalhadamente qual foi o problema encontrado e a corretiva realizada.',{required:true}));}

  function setBlock(id,show){const el=document.getElementById(id);if(!el)return;el.classList.toggle('hidden',!show);el.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=!show)}
  function val(form,name){return form.elements[name]?.value||''}
  function checkedValues(form,name){return [...form.querySelectorAll(`input[name="${CSS.escape(name)}"]:checked`)].map(x=>x.value)}
  function anyMatrixValue(form,prefix,value){return [...form.querySelectorAll(`input[name^="${prefix}_"]:checked`)].some(x=>x.value===value)}
  function bindV205Dynamics(form){
    const refresh=()=>{
      const medium=val(form,'communicationMedium');setBlock('v205-comm-radio',medium==='Rádio');setBlock('v205-comm-modem',medium.startsWith('Modem'));setBlock('v205-comm-orbcomm',medium.startsWith('ORBCOMM'));setBlock('v205-comm-skyedge',medium==='Skyedge');
      setBlock('v205-modem-repeater',val(form,'canChangeToUhf')==='Sim');setBlock('v205-orbcomm-repeater',val(form,'orbcommCanUhf')==='Sim');setBlock('v205-skyedge-repeater',val(form,'skyedgeCanUhf')==='Sim');
      const redundant=val(form,'redundantOperator');const redundIccid=form.elements.redundantIccid;if(redundIccid){const needed=redundant&&redundant!=='Não há operadora redundante';redundIccid.closest('.field')?.classList.toggle('hidden',!needed);redundIccid.disabled=!needed;redundIccid.required=needed}
      setBlock('v205-preventive-battery',val(form,'batteryReplaced')==='Sim');setBlock('v205-battery-lithium',val(form,'batteryType')==='Lítio');setBlock('v205-battery-lead',val(form,'batteryType')==='Chumbo Ácida');
      const ct=checkedValues(form,'correctiveType');setBlock('v205-corrective-communication',ct.includes('Corretiva de Comunicação'));setBlock('v205-corrective-hardware',ct.includes('Corretiva de Hardware'));
      setBlock('v205-worse-signal',checkedValues(form,'communicationCause').includes('Piora no nível de sinal'));
      setBlock('v205-communication-replaced',val(form,'communicationEquipmentReplaced')==='Sim');setBlock('v205-peripherals-replaced',val(form,'peripheralsReplaced')==='Sim');setBlock('v205-chip-replaced',val(form,'chipReplaced')==='Sim');setBlock('v205-chip2-replaced',val(form,'secondChipChanged')==='Sim');
      setBlock('v205-corrective-battery',val(form,'batteryReplacement')==='Sim');setBlock('v205-corr-battery-lead',val(form,'correctiveBatteryType')==='Chumbo Ácida');setBlock('v205-corr-battery-lithium',val(form,'correctiveBatteryType')==='Lítio');setBlock('v205-control-parts',val(form,'controlParts')==='Sim');setBlock('v205-switch-parts',val(form,'switchParts')==='Sim');setBlock('v205-recloser-peripherals',val(form,'recloserPeripherals')==='Sim');
      setBlock('v205-bypass-reason',val(form,'bypassed')==='Sim');setBlock('v205-workshop-reason',String(val(form,'workshopRemoval')).startsWith('SIM'));
      setBlock('v205-vertical-structure',val(form,'hasVerticalStructure')==='Sim');setBlock('v205-no-climb-reason',val(form,'structureClimbed')==='Não');setBlock('v205-reserve-cables',val(form,'hasReserveCables')==='Sim');setBlock('v205-extra-activity',val(form,'extraActivity')==='Sim');
      setBlock('v205-shelter-failure',anyMatrixValue(form,'shelterCheck','Falha')||anyMatrixValue(form,'shelterCheck','Corrigido'));setBlock('v205-tower-failure',anyMatrixValue(form,'towerCheck','Falha'));
      setBlock('v205-police-report',val(form,'siteTheft')==='Sim');setBlock('v205-police-report-number',val(form,'policeReportMade')==='Sim');setBlock('v205-pendency',val(form,'activityStatus')==='Pendente');
    };
    form.addEventListener('change',refresh);form.addEventListener('input',e=>{if(e.target.matches('[data-mask]'))validateMaskedFields(form)});refresh();bindMasks(form);
  }

  async function getCurrentCoordinates(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),()=>resolve(null),{enableHighAccuracy:true,timeout:8000,maximumAge:60000})})}
  async function addV205Photo(file,category,assetId){if(!file)return null;const blob=await compressImage(file,1400,.82),geo=await getCurrentCoordinates();const photo={id:uid(),blob,category,assetId,caption:'',latitude:geo?.latitude??null,longitude:geo?.longitude??null,accuracy:geo?.accuracy??null,criadoEm:nowIso()};state.pendingPhotos.push(photo);return photo}
  function bindV205Photos(form,asset){
    form.querySelectorAll('[data-v205-photo-role]').forEach(input=>input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;input.disabled=true;try{await addV205Photo(file,input.dataset.v205PhotoRole,asset.id);toast('Imagem adicionada ao relatório.')}catch(error){toast(error.message||String(error),'warning')}finally{input.disabled=false}}));
    const general=form.querySelector('#v205-general-photos');general?.addEventListener('change',async()=>{for(const file of general.files||[])await addV205Photo(file,'Imagem da manutenção',asset.id);const count=form.querySelector('#v205-photo-count');if(count)count.textContent=`${state.pendingPhotos.length} imagem(ns) adicionada(s).`;general.value=''});
  }

  function commissioningDistributionMarkup(asset){const d=asset.data||{};return section('Comissionamento',
    textField('relayFirmware','Firmware do relé',{required:true,value:cleanExisting(d.relay_firmware||d.firmware)})+yesNo('remoteAccess','Acesso remoto parametrizado?')+
    selectField('commissioningMedium','Meio de comunicação',['Rádio','ORBCOMM','ORBCOMM com redundância GPRS','4G/3G','Fibra Óptica','Skyedge'],{required:true,full:true,value:v209CommissioningMedium(d)})+
    textField('remoteAccessIp','IP de acesso remoto',{mask:'ipv4'})+selectField('commissioningRadioModel','Modelo do rádio',['GE MDS','GE ORBIT','Aprisa 4RF'],{})+
    textField('commissioningRadioIp','IP do rádio',{mask:'ipv4',value:cleanExisting(d.radio_ip)})+textField('commissioningRadioFirmware','Firmware do rádio',{mask:'firmware3',value:cleanExisting(d.communication_firmware)})+
    selectField('commissioningRepeater','Repetidora',repeaters().map(r=>r.display_name),{value:cleanExisting(d.repeater_name)})+
    selectField('commissioningTechnology','Tecnologia',['2G','3G','4G'],{value:cleanExisting(d.communication_technology)})+textField('commissioningImei','IMEI',{mask:'imei',value:/\d{15}/.test(String(d.communication_identifier||''))?digits(d.communication_identifier):''})+
    textField('commissioningModemFirmware','Firmware do modem',{mask:'firmware3',value:cleanExisting(d.communication_firmware)})+operatorSelect('commissioningMainOperator','Operadora principal',false,cleanExisting(d.sim1_operator))+operatorSelect('commissioningRedundantOperator','Operadora redundante',false,cleanExisting(d.sim2_operator)||'Não há operadora redundante')+
    textField('commissioningMainIccid','ICCID principal',{mask:'iccid',value:cleanExisting(d.sim1_iccid)})+textField('commissioningRedundantIccid','ICCID redundante',{mask:'iccid',value:cleanExisting(d.sim2_iccid)})+
    textField('commissioningOrbcomm','Número ORBCOMM',{value:cleanExisting(d.communication_identifier)})+
    selectField('commissioningBatteryType','Tipo da bateria',['Lítio','Chumbo Ácida'],{required:true})+selectField('commissioningLithiumCapacity','Capacidade — lítio',lithiumOptions(),{})+selectField('commissioningLeadCapacity','Capacidade — chumbo',['12V 7Ah','12V 12Ah','12V 18Ah'],{})
  )+distributionClosingMarkup()}

  function thirdPartyMarkup(){return section('Acompanhamento de Terceiros',textArea('thirdPartyDescription','Descreva detalhadamente qual foi a atividade realizada.',{required:true}))+telecomClosingMarkup()}
  function telecomInstallationMarkup(){return section('Instalação de Equipamentos',textArea('telecomInstallationDescription','Descreva detalhadamente qual foi a instalação realizada no site.',{required:true}))+telecomClosingMarkup()}

  function activityTitle(){if(state.businessFront==='distribution')return `${frontFamilyLabel(state.v205Asset?.family_code)} · ${state.v205Activity}`;if(state.businessFront==='telecom')return `${state.v205Asset?.display_name||'Telecom'} · ${state.v205Activity}`;return state.v205Activity||'Atividade'}
  function v205ActivitySpecificMarkup(asset,activity){
    if(state.businessFront==='distribution'){
      if(activity==='Manutenção Preventiva')return preventiveRelayMarkup(asset)+distributionClosingMarkup();
      if(activity==='Manutenção Corretiva')return correctiveDistributionMarkup(asset)+distributionClosingMarkup();
      if(activity==='Comissionamento de ativo')return commissioningDistributionMarkup(asset);
    }
    if(state.businessFront==='telecom'){
      if(activity==='Manutenção Preventiva')return telecomPreventiveMarkup(asset,asset.family_code==='repeater')+telecomClosingMarkup();
      if(activity==='Manutenção Corretiva')return telecomCorrectiveMarkup()+telecomClosingMarkup();
      if(activity==='Acompanhamento de Terceiros')return thirdPartyMarkup();
      if(activity==='Instalação de Equipamentos de Telecom')return telecomInstallationMarkup();
    }
    return '';
  }

  function v205AssetSummary(asset){const fields=[['Família',frontFamilyLabel(asset.family_code)],['Código operativo',asset.operating_code],['Status',asset.status],['Região',asset.region],['Subestação',asset.substation_code],['Alimentador',asset.feeder],['Fabricante',asset.manufacturer],['Modelo',asset.model],['Número de série',asset.serial_number]].filter(x=>x[1]);return `<div class="v205-asset-summary"><div><strong>${esc(frontAssetTitle(asset))}</strong><span>${esc(frontFamilyLabel(asset.family_code))}</span></div><div class="v205-summary-meta">${fields.map(([k,v])=>`<span><b>${esc(k)}</b>${esc(v)}</span>`).join('')}</div></div>`}

  async function renderV205Activity(){
    const asset=state.v205Asset;if(!asset)return state.businessFront==='distribution'?renderDistributionMaintenance():renderTelecomMaintenance();
    state.screen='v205-activity';setActiveNav('maintenance');state.pendingPhotos=[];
    main.innerHTML=`<section class="v205-page">${v205FlowSteps(2)}<div class="head-row"><div><button class="back" id="v205-back-activity" type="button"><span data-icon="arrow-left"></span></button><h1>${esc(activityTitle())}</h1><p class="muted">Preencha somente as informações verificadas no atendimento.</p></div></div>${v205AssetSummary(asset)}<form id="v205-form" class="v205-maintenance-form">${attendanceBaseMarkup()}${cadastralMarkup(asset,'front_assets')}${v205ActivitySpecificMarkup(asset,state.v205Activity)}${section('Imagens da manutenção',`<div class="field full"><label>Fotos adicionais</label><input id="v205-general-photos" type="file" accept="image/*" capture="environment" multiple><small id="v205-photo-count" class="muted">Nenhuma imagem adicional.</small></div>`)}<div class="v205-form-actions"><button class="btn secondary" type="button" id="v205-save-draft">Salvar rascunho</button><button class="btn primary" type="submit">Revisar relatório</button></div></form></section>`;
    hydrateIcons(main);const form=document.getElementById('v205-form');form.elements.data.value=new Date().toISOString().slice(0,10);bindV205Dynamics(form);bindCadastral(form,asset,'front_assets');bindV205Photos(form,asset);
    document.getElementById('v205-back-activity').onclick=()=>renderV205ActivityChoice(asset);
    document.getElementById('v205-save-draft').onclick=async()=>{form.querySelector('.v205-cadastral')?._v205Sync?.();const draft={id:`v205:${state.businessFront}:${asset.id}`,kind:'v205',businessFront:state.businessFront,assetId:asset.id,activity:state.v205Activity,form:formValues(form),photos:state.pendingPhotos,salvoEm:nowIso(),user:currentUser()};await idbPut('drafts',draft);toast('Rascunho salvo neste dispositivo.')};
    form.onsubmit=async e=>{e.preventDefault();form.querySelector('.v205-cadastral')?._v205Sync?.();validateMaskedFields(form);const valid=typeof centralValidateForm==='function'?centralValidateForm(form,{checkGroups:true}):(form.reportValidity()&&checkRequiredGroups(form));if(!valid)return;const values=formValues(form),reviewSections=typeof centralBuildReviewSections==='function'?centralBuildReviewSections(form,values):[];await renderV205Review(asset,values,reviewSections)};
  }

  async function renderV205Review(asset,values,reviewSections=[]){
    state.screen='v205-review';const changes=safeJson(values.assetChangesJson,[])||[];
    const humanReview=typeof centralReviewSectionsMarkup==='function'?centralReviewSectionsMarkup(reviewSections):'';
    main.innerHTML=`<section class="v205-page">${v205FlowSteps(3)}<div class="head-row"><div><button class="back" id="v205-review-back" type="button"><span data-icon="arrow-left"></span></button><h1>Revisar relatório</h1><p class="muted">Confira as respostas antes de registrar.</p></div></div><div class="v205-review-grid"><section class="panel">${v205AssetSummary(asset)}${humanReview||'<div class="empty">Nenhuma resposta preenchida.</div>'}${changes.length?`<div class="v205-change-review"><h3>Atualizações cadastrais propostas</h3>${changes.map(c=>`<p><b>${esc(c.label)}</b>: ${esc(c.old_value??'—')} → ${esc(c.new_value)}</p>`).join('')}<small>O cadastro mestre só será alterado após aprovação administrativa.</small></div>`:''}<div class="v205-review-photos"><b>${state.pendingPhotos.length}</b> imagem(ns) anexada(s)</div></section><aside class="panel v205-confirm"><label><input type="checkbox" id="v205-confirm"> Revisei os dados acima.</label><button class="btn primary" id="v205-confirm-report" disabled>Confirmar e registrar</button></aside></div></section>`;
    hydrateIcons(main);document.getElementById('v205-review-back').onclick=renderV205Activity;const check=document.getElementById('v205-confirm'),btn=document.getElementById('v205-confirm-report');check.onchange=()=>btn.disabled=!check.checked;btn.onclick=()=>finalizeV205Report(asset,values,changes);
  }

  function v205SubstationForAsset(asset){const code=asset.substation_code;if(code&&DATA.substations.some(s=>s.id===code))return code;if(state.v205TelecomSubstation&&DATA.substations.some(s=>s.id===state.v205TelecomSubstation))return state.v205TelecomSubstation;return null}
  async function finalizeV205Report(asset,values,changes){
    const id=uid(),created=nowIso(),number=ensureReportNumber?.()||`R-${Date.now()}`,substation=v205SubstationForAsset(asset);
    const record={id,numeroRelatorio:number,idempotencyKey:id,version:V205_VERSION,businessFront:state.businessFront,usuario:currentUser(),subestacao:substation,frontAssetIds:[asset.id],frontAssetsSnapshot:[asset],equipamentos:[],equipamentosSnapshot:[],form:{...values,assetChangesJson:JSON.stringify(changes)},assetChanges:changes,resultado:values.activityStatus==='Pendente'?'inconclusivo':'concluido',criadoEm:created,updatedAt:created,revisao:1,status:initialLocalStatus()};
    await idbPut('maintenanceRecords',record);for(let i=0;i<state.pendingPhotos.length;i++){const p=state.pendingPhotos[i];await idbPut('maintenancePhotos',{id:`${id}_${p.id||i}`,maintenanceId:id,assetId:asset.id,frontAssetId:asset.id,blob:p.blob,category:p.category,caption:p.caption||'',latitude:p.latitude??null,longitude:p.longitude??null,criadoEm:created})}
    await addAudit(record.id,'criado','Relatório multi-frente confirmado após revisão.',[], '',record.status);await enqueueSync(record);await idbDelete('drafts',`v205:${state.businessFront}:${asset.id}`).catch(()=>{});state.pendingPhotos=[];await processSyncQueue();await updateConnectivityIndicator();
    main.innerHTML=`<section class="panel v205-success"><div class="v205-success-icon">✓</div><h2>Relatório registrado</h2><p class="muted">${esc(frontLabel(state.businessFront))} · ${esc(frontAssetTitle(asset))}<br>Status: <b>${esc(statusMeta(record.status).label)}</b></p><div><button class="btn secondary" id="v205-success-home">Início</button><button class="btn primary" id="v205-success-new">Nova manutenção</button></div></section>`;document.getElementById('v205-success-home').onclick=renderHome;document.getElementById('v205-success-new').onclick=()=>{state.v205Asset=null;state.v205Activity=null;if(state.v209EmbeddedTelecomSubstation){const sub=state.v209EmbeddedTelecomSubstation;state.v209EmbeddedTelecomSubstation=null;state.businessFront='substation';state.sub=sub;return renderEquipment()}renderSubstations()};
  }

  /* ---------- navegação de manutenção multi-frente ---------- */
  renderBusinessFrontSelector=function(){
    state.screen='business-front';setActiveNav('maintenance');const fronts=[...(state.businessFronts||[])].sort((a,b)=>Number(a.sort_order||100)-Number(b.sort_order||100));
    main.innerHTML=`<section class="business-front-shell"><div class="head-row business-front-head"><div><button class="back" id="front-back-home" type="button"><span data-icon="arrow-left"></span></button><h1>Nova Manutenção</h1><p>Escolha a frente de negócio.</p></div></div><div class="business-front-grid">${fronts.map(front=>{const enabled=front.active!==false;const meta=front.code==='substation'?{icon:'settings',description:'Manutenções e atendimentos em ativos de subestações.'}:front.code==='distribution'?{icon:'tool',description:'Religadores e reguladores de tensão da Distribuição.'}:{icon:'wifi',description:'Manutenções e atendimentos nas Repetidoras de Telecom.'};return `<button class="business-front-card" type="button" data-front="${esc(front.code)}" ${enabled?'':'disabled'}><span class="business-front-icon" data-icon="${meta.icon}"></span><h2>${esc(front.label)}</h2><p>${esc(meta.description)}</p><span class="business-front-state">${enabled?'<span data-icon="check"></span>Disponível':'Indisponível'}</span></button>`}).join('')}</div></section>`;
    hydrateIcons(main);document.getElementById('front-back-home').onclick=()=>{state.businessFront=null;renderHome()};main.querySelectorAll('[data-front]:not(:disabled)').forEach(b=>b.onclick=()=>{state.businessFront=b.dataset.front;state.v205Asset=null;state.v205Activity=null;if(state.businessFront==='substation')return v205BaseRenderSubstations();if(state.businessFront==='distribution')return renderDistributionMaintenance();return renderTelecomMaintenance()});
  };

  const v205BaseRenderSubstations=renderSubstations;
  renderSubstations=async function(){
    if(!state.businessFront)return renderBusinessFrontSelector();
    if(state.businessFront==='substation')return v205BaseRenderSubstations();
    if(state.businessFront==='distribution')return renderDistributionMaintenance();
    if(state.businessFront==='telecom')return renderTelecomMaintenance();
    return renderBusinessFrontSelector();
  };
  function v205FlowSteps(active){
  const firstLabel=state.businessFront==='distribution'
    ?'Ativo'
    :(state.v209EmbeddedTelecomSubstation?'Equipamento':'Repetidora');

  const labels=[firstLabel,'Atividade','Formulário','Revisão'];

  return `<div class="steps">${labels.map((label,index)=>`
    ${index?'<span class="step-line"></span>':''}
    <span class="step ${index<active?'done':index===active?'active':''}">
      <b>${index+1}</b>${label}
    </span>
  `).join('')}</div>`;
}
  function renderDistributionMaintenance(){
    state.screen='v205-distribution';setActiveNav('maintenance');const family=state.distributionFamily;
    main.innerHTML=`<section class="v205-page">${v205FlowSteps(0)}<div class="head-row"><div><button class="back" id="v205-dist-back" type="button"><span data-icon="arrow-left"></span></button><h1>Distribuição</h1><p class="muted">Selecione a família e localize o ativo pelo código operativo.</p></div></div><div class="v205-family-tabs"><button data-dist-family="distribution_recloser" class="${family==='distribution_recloser'?'active':''}">Religadores</button><button data-dist-family="voltage_regulator" class="${family==='voltage_regulator'?'active':''}">Reguladores de Tensão</button></div>${family?`<section class="panel v205-picker-panel"><div class="toolbar"><div class="search"><input id="v205-dist-search" autocomplete="off" placeholder="Buscar por número operativo, alimentador, subestação ou modelo"></div><select id="v205-dist-group"><option value="">Sem agrupamento</option><option value="region">Região</option><option value="substation_code">Subestação</option><option value="feeder">Alimentador</option><option value="model">Modelo</option></select></div><div id="v205-dist-results"></div></section>`:'<div class="v205-empty-prompt">Escolha Religadores ou Reguladores de Tensão para continuar.</div>'}</section>`;
    hydrateIcons(main);document.getElementById('v205-dist-back').onclick=()=>{state.distributionFamily=null;state.businessFront=null;renderBusinessFrontSelector()};document.querySelectorAll('[data-dist-family]').forEach(b=>b.onclick=()=>{state.distributionFamily=b.dataset.distFamily;renderDistributionMaintenance()});if(!family)return;
    const search=document.getElementById('v205-dist-search'),group=document.getElementById('v205-dist-group');const source=family==='distribution_recloser'?relayAssets():regulatorAssets();
    function isSelectable(a){if(family!=='distribution_recloser')return a.active!==false;const s=norm(a.status);return a.active!==false&&!s.includes('reserva')&&!s.includes('nao instalado')}
    function draw(){const q=compactCode(search.value),g=group.value;let rows=source.filter(isSelectable).filter(a=>!q||compactCode([a.operating_code,a.display_name,a.feeder,a.substation_code,a.model,a.manufacturer].join(' ')).includes(q));if(!g){rows=rows.slice(0,20);document.getElementById('v205-dist-results').innerHTML=rows.length?`<div class="v205-asset-results">${rows.map(a=>distributionResultRow(a)).join('')}</div>`:'<div class="empty">Nenhum ativo encontrado.</div>'}else{const buckets=new Map();for(const a of rows){const key=a[g]||'Não informado';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(a)}document.getElementById('v205-dist-results').innerHTML=[...buckets.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'pt-BR')).slice(0,30).map(([k,list])=>`<details class="v205-group"><summary><b>${esc(k)}</b><span>${list.length}</span></summary><div class="v205-asset-results">${list.slice(0,20).map(a=>distributionResultRow(a)).join('')}</div></details>`).join('')||'<div class="empty">Nenhum ativo encontrado.</div>'}document.querySelectorAll('[data-v205-select-asset]').forEach(b=>b.onclick=()=>{state.v205Asset=state.frontAssetMap.get(b.dataset.v205SelectAsset);renderV205ActivityChoice(state.v205Asset)})}
    search.oninput=draw;group.onchange=draw;draw();
  }
  function distributionResultRow(a){return `<button class="v205-asset-row" type="button" data-v205-select-asset="${a.id}"><div><strong>${esc(a.operating_code||a.display_name)}</strong><span>${esc([a.substation_code,a.feeder,a.model].filter(Boolean).join(' · '))}</span></div><span class="v205-status ${norm(a.status).includes('operacao')?'ok':''}">${esc(a.status||'Sem status')}</span></button>`}

  function renderV205ActivityChoice(asset){
    state.v205Asset=asset;state.screen='v205-activity-choice';const isDist=state.businessFront==='distribution';let activities=[];
    if(isDist)activities=asset.family_code==='distribution_recloser'?['Manutenção Preventiva','Manutenção Corretiva']:['Manutenção Corretiva'];
    else activities=['Manutenção Preventiva','Manutenção Corretiva','Acompanhamento de Terceiros'];
    main.innerHTML=`<section class="v205-page">${v205FlowSteps(1)}<div class="head-row"><div><button class="back" id="v205-choice-back" type="button"><span data-icon="arrow-left"></span></button><h1>${esc(frontAssetTitle(asset))}</h1><p class="muted">Escolha a atividade.</p></div></div>${v205AssetSummary(asset)}<div class="v205-activity-grid">${activities.map(a=>`<button class="operation-card" data-v205-activity="${esc(a)}"><span class="operation-icon" data-icon="tool"></span><h3>${esc(a)}</h3></button>`).join('')}</div></section>`;
    hydrateIcons(main);document.getElementById('v205-choice-back').onclick=()=>isDist?renderDistributionMaintenance():renderTelecomMaintenance();document.querySelectorAll('[data-v205-activity]').forEach(b=>b.onclick=()=>{state.v205Activity=b.dataset.v205Activity;renderV205Activity()});
  }

  function renderTelecomMaintenance(){
    state.screen='v205-telecom';setActiveNav('maintenance');state.v205TelecomLocation='repeater';
    main.innerHTML=`<section class="v205-page">${v205FlowSteps(0)}<div class="head-row"><div><button class="back" id="v205-tel-back"><span data-icon="arrow-left"></span></button><h1>Telecom</h1><p class="muted">Selecione uma repetidora cadastrada.</p></div></div><div id="v205-telecom-picker"></div></section>`;
    hydrateIcons(main);document.getElementById('v205-tel-back').onclick=()=>{state.businessFront=null;state.v205TelecomLocation=null;renderBusinessFrontSelector()};drawTelecomPicker();
  }
  function drawTelecomPicker(){const host=document.getElementById('v205-telecom-picker');if(!host)return;const type=state.v205TelecomLocation;if(type==='repeater'){host.innerHTML=`<section class="panel v205-picker-panel"><div class="search"><input id="v205-repeater-search" placeholder="Buscar repetidora"></div><div id="v205-repeater-list" class="v205-asset-results"></div></section>`;const input=document.getElementById('v205-repeater-search');const draw=()=>{const q=norm(input.value);const rows=repeaters().filter(r=>!q||norm([r.display_name,r.location_name,r.data?.city].join(' ')).includes(q));document.getElementById('v205-repeater-list').innerHTML=rows.map(r=>`<button class="v205-asset-row" data-v205-repeater="${r.id}"><div><strong>${esc(r.display_name)}</strong><span>${esc([r.location_name,r.data?.structure_type,r.data?.structure_height_m?`${r.data.structure_height_m} m`:null].filter(Boolean).join(' · '))}</span></div></button>`).join('');document.querySelectorAll('[data-v205-repeater]').forEach(b=>b.onclick=()=>{state.v205Asset=state.frontAssetMap.get(b.dataset.v205Repeater);renderV205ActivityChoice(state.v205Asset)})};input.oninput=draw;draw();return}
    const rows=DATA.substations.map(s=>{const site=telecomSites().find(t=>t.substation_code===s.id);return {s,site}}).filter(x=>x.site);host.innerHTML=`<section class="panel v205-picker-panel"><div class="search"><input id="v205-tel-sub-search" placeholder="Buscar subestação por nome ou sigla"></div><div id="v205-tel-sub-list" class="v205-asset-results"></div></section>`;const input=document.getElementById('v205-tel-sub-search');const draw=()=>{const q=norm(input.value);const list=rows.filter(x=>!q||norm(`${x.s.sigla} ${x.s.nome}`).includes(q)).slice(0,30);document.getElementById('v205-tel-sub-list').innerHTML=list.map(({s,site})=>`<button class="v205-asset-row" data-v205-tel-site="${site.id}" data-sub="${s.id}"><div><strong>${esc(s.sigla)} — ${esc(s.nome)}</strong><span>${telecomChildren(site.id).length} equipamento(s) de comunicação</span></div></button>`).join('');document.querySelectorAll('[data-v205-tel-site]').forEach(b=>b.onclick=()=>{state.v205TelecomSubstation=b.dataset.sub;state.v205Asset=state.frontAssetMap.get(b.dataset.v205TelSite);renderV205ActivityChoice(state.v205Asset)})};input.oninput=draw;draw();
  }

  /* Ponte v2.0.9: permite que a seleção de Subestação abra um equipamento
     de Comunicação preservando o registro canônico em front_assets. */
  globalThis.CENTRAL_V205_OPEN_FRONT_ASSET=function(assetId,options={}){
    const asset=state.frontAssetMap.get(assetId);if(!asset)return false;
    state.businessFront=options.front||asset.business_front||'telecom';
    state.v205Asset=asset;state.v205Activity=null;
    state.v205TelecomSubstation=options.substationId||asset.substation_code||null;
    if(options.embeddedSubstation)state.v209EmbeddedTelecomSubstation=options.embeddedSubstation;
    renderV205ActivityChoice(asset);return true;
  };

  /* ---------- Banco de Dados multi-frente ---------- */
  const v205BaseRenderDatabase=renderDatabase;
  function databaseTabs(active){return `<div class="v205-top-tabs" role="tablist">${[['all','Todos'],['substation','Subestação'],['distribution','Distribuição'],['telecom','Telecom']].map(([k,l])=>`<button type="button" data-db-front="${k}" class="${active===k?'active':''}">${l}</button>`).join('')}</div>`}
  function bindDatabaseTabs(){document.querySelectorAll('[data-db-front]').forEach(b=>b.onclick=()=>{state.databaseFront=b.dataset.dbFront;state.databaseSubId=null;state.databaseV205Family=null;state.databaseTelecomType=null;renderDatabase()})}
  renderDatabase=async function(){
    state.screen='database';setActiveNav('database');const front=state.databaseFront||'all';
    if(front==='substation'){
      await v205BaseRenderDatabase();main.insertAdjacentHTML('afterbegin',databaseTabs('substation'));bindDatabaseTabs();injectSubstationCommunicationBranch();return;
    }
    if(front==='all')return renderDatabaseAll();
    if(front==='distribution')return renderDatabaseDistribution();
    return renderDatabaseTelecom();
  };
  function dbCount(family){return state.frontAssets.filter(a=>a.family_code===family&&a.active!==false).length}
  function renderDatabaseAll(){
    const legacy=catalogAssets().length,dist=relayAssets().length+regulatorAssets().length,tel=state.frontAssets.filter(a=>a.business_front==='telecom').length;
    main.innerHTML=`${databaseTabs('all')}<div class="page-heading"><div><h1>Banco de Dados</h1><p>Visão consolidada das três frentes de negócio.</p></div></div><section class="v205-db-overview"><button data-db-jump="substation"><strong>${DATA.substations.length}</strong><span>Subestações</span><small>${legacy} ativos cadastrados</small></button><button data-db-jump="distribution"><strong>${dist}</strong><span>Ativos de Distribuição</span><small>${relayAssets().length} religadores · ${regulatorAssets().length} reguladores</small></button><button data-db-jump="telecom"><strong>${tel}</strong><span>Registros de Telecom</span><small>${repeaters().length} repetidoras · ${telecomSites().length} locais</small></button></section>`;bindDatabaseTabs();document.querySelectorAll('[data-db-jump]').forEach(b=>b.onclick=()=>{state.databaseFront=b.dataset.dbJump;renderDatabase()})
  }
  function currentDbDistributionAssets(){const f=state.databaseV205Family||'distribution_recloser';return f==='distribution_recloser'?relayAssets():regulatorAssets()}
  function renderDatabaseDistribution(){
    const family=state.databaseV205Family||'distribution_recloser';state.databaseV205Family=family;
    main.innerHTML=`${databaseTabs('distribution')}<div class="page-heading"><div><h1>Distribuição</h1><p>Consulte os dados cadastrais e técnicos dos equipamentos.</p></div><div class="database-admin-actions"><button class="btn secondary" id="v205-export-db">Exportar dados</button>${state.role==='admin'?'<button class="btn secondary" id="v205-bulk-db">Atualização em massa</button>':''}</div></div><div class="v205-family-tabs"><button data-db-family="distribution_recloser" class="${family==='distribution_recloser'?'active':''}">Religadores <span>${relayAssets().length}</span></button><button data-db-family="voltage_regulator" class="${family==='voltage_regulator'?'active':''}">Reguladores de Tensão <span>${regulatorAssets().length}</span></button></div><section class="panel"><div class="toolbar"><div class="search"><input id="v205-db-dist-search" placeholder="Buscar por número operativo"></div><select id="v205-db-dist-group"><option value="region">Agrupar por Região</option><option value="substation_code">Agrupar por Subestação</option><option value="feeder">Agrupar por Alimentador</option><option value="model">Agrupar por Modelo</option><option value="">Sem agrupamento</option></select></div><div id="v205-db-dist-results"></div></section>`;
    bindDatabaseTabs();document.querySelectorAll('[data-db-family]').forEach(b=>b.onclick=()=>{state.databaseV205Family=b.dataset.dbFamily;renderDatabaseDistribution()});const search=document.getElementById('v205-db-dist-search'),group=document.getElementById('v205-db-dist-group');
    const draw=()=>{const q=compactCode(search.value),g=group.value;let rows=currentDbDistributionAssets().filter(a=>!q||compactCode([a.operating_code,a.display_name,a.feeder,a.substation_code,a.model].join(' ')).includes(q));const host=document.getElementById('v205-db-dist-results');if(!g){rows=rows.slice(0,20);host.innerHTML=`<div class="v205-asset-results">${rows.map(a=>distributionResultRow(a).replace('data-v205-select-asset','data-v205-db-asset')).join('')}</div>`}else{const m=new Map();for(const a of rows){const k=a[g]||'Não informado';if(!m.has(k))m.set(k,[]);m.get(k).push(a)}host.innerHTML=[...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'pt-BR')).map(([k,list])=>`<details class="v205-group"><summary><b>${esc(k)}</b><span>${list.length}</span></summary><div class="v205-asset-results">${list.slice(0,30).map(a=>distributionResultRow(a).replace('data-v205-select-asset','data-v205-db-asset')).join('')}</div></details>`).join('')||'<div class="empty">Nenhum equipamento encontrado.</div>'}document.querySelectorAll('[data-v205-db-asset]').forEach(b=>b.onclick=()=>openFrontAssetDetails(state.frontAssetMap.get(b.dataset.v205DbAsset)))};search.oninput=draw;group.onchange=draw;draw();
    document.getElementById('v205-export-db').onclick=()=>exportFrontAssets(currentDbDistributionAssets(),family);document.getElementById('v205-bulk-db')?.addEventListener('click',()=>openFrontBulkUpdate(family));
  }

  function displayValue(v){if(v===null||v===undefined||v===''||v==='-')return '—';if(Array.isArray(v))return v.join(', ');if(typeof v==='object')return JSON.stringify(v);return String(v)}
  function detailRows(asset){const rows=[['Frente',frontLabel(asset.business_front)],['Família',frontFamilyLabel(asset.family_code)],['Código operativo',asset.operating_code],['Status',asset.status],['Região',asset.region],['Subestação',asset.substation_code],['Alimentador',asset.feeder],['Localização',asset.location_name],['Fabricante',asset.manufacturer],['Modelo',asset.model],['Número de série',asset.serial_number]];for(const p of flattenEditableData(asset.data||{})){const v=getAssetField(asset,p);if(v!==null&&v!==undefined&&v!==''&&v!=='-')rows.push([fieldMeta(p).label,v])}return rows}
  async function openRelayRoute(asset){if(!navigator.onLine)return toast('Rota disponível quando houver conexão.','notice');if(asset.latitude==null||asset.longitude==null)return toast('Este equipamento não possui coordenadas cadastradas.','warning');const geo=await getCurrentCoordinates(),dest=`${asset.latitude},${asset.longitude}`,origin=geo?`&origin=${geo.latitude},${geo.longitude}`:'';const url=`https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(dest)}&travelmode=driving`;window.open(url,'_blank','noopener')}
  function openFrontAssetDetails(asset){if(!asset)return;const isRelay=asset.family_code==='distribution_recloser',rep=asset.linked_repeater_id?state.frontAssetMap.get(asset.linked_repeater_id):findRepeaterByName(asset.data?.repeater_name);const rows=detailRows(asset);document.getElementById('modal-root').innerHTML=`<div class="modal" id="v205-asset-modal"><div class="modal-card v205-asset-modal"><button class="modal-close" id="v205-close-asset"><span data-icon="x"></span></button><div class="v205-detail-head"><div><span class="v205-status ${norm(asset.status).includes('operacao')?'ok':''}">${esc(asset.status||'Sem status')}</span><h2>${esc(frontAssetTitle(asset))}</h2><p>${esc(frontFamilyLabel(asset.family_code))}</p></div>${isRelay?`<button class="btn primary" id="v205-route" ${asset.latitude==null||asset.longitude==null?'disabled':''}>Traçar rota</button>`:''}</div>${isRelay&&asset.latitude!=null?`<div class="v205-coordinates">${Number(asset.latitude).toFixed(6)}, ${Number(asset.longitude).toFixed(6)}</div>`:''}${rep?`<button class="v205-linked-repeater" id="v205-open-repeater">Comunicação via <b>${esc(rep.display_name)}</b></button>`:''}<div class="v205-detail-grid">${rows.map(([k,v])=>`<div><b>${esc(k)}</b><span>${esc(displayValue(v))}</span></div>`).join('')}</div></div></div>`;hydrateIcons(document.getElementById('modal-root'));document.getElementById('v205-close-asset').onclick=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('v205-asset-modal').onclick=e=>{if(e.target===e.currentTarget)document.getElementById('modal-root').innerHTML=''};document.getElementById('v205-route')?.addEventListener('click',()=>openRelayRoute(asset));document.getElementById('v205-open-repeater')?.addEventListener('click',()=>{document.getElementById('modal-root').innerHTML='';openRepeaterDetails(rep)})}

  function repeaterRelayLinks(rep){return relayAssets().filter(a=>a.linked_repeater_id===rep.id||norm(normalizeRepeaterName(a.data?.repeater_name))===norm(rep.display_name)).sort((a,b)=>String(a.operating_code).localeCompare(String(b.operating_code),'pt-BR',{numeric:true}))}
  function repeaterSectionRows(rep,sectionName){const groups={
    cadastro:['data.cps','data.city','region','location_name'],estrutura:['data.structure_type','data.structure_manufacturer','data.structure_height_m','data.aev_tower','data.aev_installed','data.installation_year','data.grounding','data.shelter_type'],energia:['data.utility_installation','data.utility_feeder','data.utility_switch','data.electrical_condition','data.xps_model','data.xps_ip','data.xps_protocol','data.xps_sit_management'],baterias:['data.battery_48v_banks','data.battery_type','data.battery_manufacturer','data.battery_last_change','data.battery_next_change','data.battery_autonomy'],equipamentos:['data.tower_technologies','data.primary_comm_medium','data.primary_network_type','data.redundant_comm_medium','data.ac_quantity','data.ac_brand','data.ac_model','data.camera_bullet_quantity'],acesso:['data.access_4x2','data.access_trail','data.road_dry','data.road_rain','data.night_service','data.site_key_type','data.fence_type']};return (groups[sectionName]||[]).map(p=>[fieldMeta(p).label,getAssetField(rep,p)]).filter(([,v])=>v!==null&&v!==undefined&&v!==''&&v!=='-')}
  function repeaterDetailsMarkup(rep){const relays=repeaterRelayLinks(rep);return `<div class="v205-repeater-branches">${[['cadastro','Cadastro'],['estrutura','Estrutura vertical'],['energia','Energia / Retificador'],['baterias','Baterias'],['equipamentos','Equipamentos Telecom'],['acesso','Acesso e infraestrutura']].map(([k,l])=>{const rows=repeaterSectionRows(rep,k);return `<details><summary>${l}</summary><div class="v205-branch-grid">${rows.map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(displayValue(b))}</span></div>`).join('')||'<span class="muted">Sem dados cadastrados.</span>'}</div></details>`}).join('')}<details open><summary>Religadores atendidos <span>${relays.length}</span></summary><div class="v205-relay-links">${relays.length?relays.map(a=>`<button data-repeater-relay="${a.id}"><b>${esc(a.operating_code||a.display_name)}</b><span>${esc([a.substation_code,a.feeder,a.data?.radio_ip].filter(Boolean).join(' · '))}</span></button>`).join(''):'<span class="muted">Nenhum religador vinculado.</span>'}</div></details></div>`}
  function openRepeaterDetails(rep){if(!rep)return;document.getElementById('modal-root').innerHTML=`<div class="modal" id="v205-repeater-modal"><div class="modal-card v205-repeater-modal"><button class="modal-close" id="v205-close-repeater"><span data-icon="x"></span></button><div class="v205-detail-head"><div><h2>${esc(rep.display_name)}</h2><p>${esc([rep.location_name,rep.data?.city].filter(Boolean).join(' · '))}</p></div></div>${rep.latitude!=null?`<div class="v205-coordinates">${Number(rep.latitude).toFixed(6)}, ${Number(rep.longitude).toFixed(6)}</div>`:''}${repeaterDetailsMarkup(rep)}</div></div>`;hydrateIcons(document.getElementById('modal-root'));document.getElementById('v205-close-repeater').onclick=()=>document.getElementById('modal-root').innerHTML='';document.querySelectorAll('[data-repeater-relay]').forEach(b=>b.onclick=()=>openFrontAssetDetails(state.frontAssetMap.get(b.dataset.repeaterRelay)))}

  function renderDatabaseTelecom(){
    const type=state.databaseTelecomType||'repeater';state.databaseTelecomType=type;
    main.innerHTML=`${databaseTabs('telecom')}<div class="page-heading"><div><h1>Telecom</h1><p>Repetidoras e equipamentos de comunicação instalados nas subestações.</p></div><div class="database-admin-actions"><button class="btn secondary" id="v205-export-tel">Exportar dados</button>${state.role==='admin'?'<button class="btn secondary" id="v205-bulk-tel">Atualização em massa</button>':''}</div></div><div class="v205-family-tabs"><button data-db-tel="repeater" class="${type==='repeater'?'active':''}">Repetidoras <span>${repeaters().length}</span></button><button data-db-tel="substation" class="${type==='substation'?'active':''}">Equipamentos em Subestações <span>${telecomSites().length}</span></button></div><section class="panel"><div class="search"><input id="v205-db-tel-search" placeholder="Buscar"></div><div id="v205-db-tel-results"></div></section>`;bindDatabaseTabs();document.querySelectorAll('[data-db-tel]').forEach(b=>b.onclick=()=>{state.databaseTelecomType=b.dataset.dbTel;renderDatabaseTelecom()});const input=document.getElementById('v205-db-tel-search');const draw=()=>{const q=norm(input.value),host=document.getElementById('v205-db-tel-results');if(type==='repeater'){const rows=repeaters().filter(r=>!q||norm([r.display_name,r.location_name,r.data?.city].join(' ')).includes(q));host.innerHTML=`<div class="v205-repeater-tree-list">${rows.map(rep=>{const relays=repeaterRelayLinks(rep);return `<details class="v205-repeater-tree"><summary><div><strong>${esc(rep.display_name)}</strong><span>${esc([rep.data?.structure_type,rep.data?.structure_height_m?`${rep.data.structure_height_m} m`:null].filter(Boolean).join(' · '))}</span></div><small>${relays.length} religador(es)</small></summary>${repeaterDetailsMarkup(rep)}<button class="btn secondary v205-open-full-repeater" data-open-full-repeater="${rep.id}">Abrir ficha completa</button></details>`}).join('')}</div>`;document.querySelectorAll('[data-open-full-repeater]').forEach(b=>b.onclick=()=>openRepeaterDetails(state.frontAssetMap.get(b.dataset.openFullRepeater)));document.querySelectorAll('[data-repeater-relay]').forEach(b=>b.onclick=()=>openFrontAssetDetails(state.frontAssetMap.get(b.dataset.repeaterRelay)))}else{const rows=telecomSites().filter(s=>!q||norm([s.display_name,s.substation_code].join(' ')).includes(q));host.innerHTML=rows.map(site=>`<details class="v205-group"><summary><b>${esc(site.display_name)}</b><span>${telecomChildren(site.id).length}</span></summary><div class="v205-asset-results">${telecomChildren(site.id).map(a=>`<button class="v205-asset-row" data-v205-db-tel-asset="${a.id}"><div><strong>${esc(frontFamilyLabel(a.family_code))}</strong><span>${esc([a.manufacturer,a.model].filter(Boolean).join(' · '))}</span></div></button>`).join('')}</div></details>`).join('')||'<div class="empty">Nenhum local encontrado.</div>';document.querySelectorAll('[data-v205-db-tel-asset]').forEach(b=>b.onclick=()=>openFrontAssetDetails(state.frontAssetMap.get(b.dataset.v205DbTelAsset)))}};input.oninput=draw;draw();document.getElementById('v205-export-tel').onclick=()=>exportFrontAssets(type==='repeater'?repeaters():state.frontAssets.filter(a=>a.business_front==='telecom'&&a.family_code!=='repeater'),type);document.getElementById('v205-bulk-tel')?.addEventListener('click',()=>openFrontBulkUpdate(type==='repeater'?'repeater':'telecom'));
  }

  function injectSubstationCommunicationBranch(){if(!state.databaseSubId)return;const site=telecomSites().find(t=>t.substation_code===state.databaseSubId);if(!site)return;const children=telecomChildren(site.id);const panel=document.createElement('section');panel.className='panel v205-substation-communication';panel.innerHTML=`<details class="tree-category" open><summary><span data-icon="wifi"></span><strong>Comunicação</strong><span>${children.length} equipamento(s)</span></summary><div class="v205-asset-results">${children.map(a=>`<button class="v205-asset-row" data-sub-comm="${a.id}"><div><strong>${esc(frontFamilyLabel(a.family_code))}</strong><span>${esc([a.manufacturer,a.model].filter(Boolean).join(' · '))}</span></div></button>`).join('')||'<div class="empty">Nenhum equipamento de Telecom cadastrado.</div>'}</div></details>`;main.appendChild(panel);hydrateIcons(panel);panel.querySelectorAll('[data-sub-comm]').forEach(b=>b.onclick=()=>openFrontAssetDetails(state.frontAssetMap.get(b.dataset.subComm)))}

  const BULK_SCHEMAS={
    distribution_recloser:[['Código','operating_code'],['Status','status'],['Região','region'],['Subestação','substation_code'],['Alimentador','feeder'],['Localização','location_name'],['Fabricante','manufacturer'],['Modelo','model'],['Número de série','serial_number'],['Firmware do relé','data.relay_firmware'],['Meio de comunicação','data.communication_medium'],['Fabricante comunicação','data.communication_manufacturer'],['Tecnologia','data.communication_technology'],['Firmware comunicação','data.communication_firmware'],['Repetidora','data.repeater_name'],['IP rádio','data.radio_ip'],['IP relé','data.relay_ip'],['Operadora chip 1','data.sim1_operator'],['ICCID chip 1','data.sim1_iccid'],['Operadora chip 2','data.sim2_operator'],['ICCID chip 2','data.sim2_iccid']],
    voltage_regulator:[['Código','operating_code'],['Status','status'],['Regional','region'],['Subestação','substation_code'],['Alimentador','feeder'],['Localização','location_name'],['Fabricante','manufacturer'],['Modelo','model'],['Número de série','serial_number'],['Nº série controle','data.control_serial'],['Firmware','data.firmware'],['Automatizado','data.automated'],['Comunicação','data.communication_type'],['Potência','data.power'],['Tensão de referência','data.reference_voltage'],['Relação TP','data.tp_ratio']],
    repeater:[['Nome','display_name'],['Status','status'],['Cidade','data.city'],['CPS','data.cps'],['Tipo estrutura','data.structure_type'],['Fabricante estrutura','data.structure_manufacturer'],['Altura (m)','data.structure_height_m'],['AEV torre','data.aev_tower'],['AEV instalado','data.aev_installed'],['Ano instalação','data.installation_year'],['Bancos 48 V','data.battery_48v_banks'],['Tipo bateria','data.battery_type'],['Fabricante bateria','data.battery_manufacturer'],['IP XPS','data.xps_ip'],['Modelo XPS','data.xps_model'],['Acesso seco','data.road_dry'],['Acesso chuva','data.road_rain']],
    telecom:[['Nome','display_name'],['Família','family_code'],['Subestação','substation_code'],['Fabricante','manufacturer'],['Modelo','model'],['Número de série','serial_number'],['Status','status']]
  };
  function schemaFor(key){return BULK_SCHEMAS[key]||BULK_SCHEMAS.telecom}
  function exportRowsForAssets(assets,key){const schema=schemaFor(key);return assets.map(a=>{const r={'ID (não alterar)':a.id,'Versão (não alterar)':a.row_version,'Chave externa (não alterar)':a.external_key};for(const [label,path] of schema)r[label]=getAssetField(a,path)??'';return r})}
  function exportFrontAssets(assets,key){if(!globalThis.XLSX)return toast('Módulo de planilhas indisponível.','warning');const rows=exportRowsForAssets(assets,key),wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Ativos');XLSX.writeFile(wb,`Central_${String(key).replace(/[^a-z0-9]+/gi,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`)}
  function validateBulkValue(path,value){const s=String(value||'').trim();if(!s)return null;if(path.includes('iccid')&&!validIccid(s))return 'ICCID inválido';if(path.endsWith('_ip')&&!validIpv4(s))return 'IPv4 inválido';if(path==='data.communication_firmware'&&!validCommFirmware(s))return 'Firmware inválido';if(path.includes('operator')&&s&&![...OPERATORS,'Oi','OI','Não há operadora redundante','-'].includes(s))return 'Operadora inválida';return null}
  function openFrontBulkUpdate(key){const assets=key==='repeater'?repeaters():key==='telecom'?state.frontAssets.filter(a=>a.business_front==='telecom'&&a.family_code!=='repeater'):key==='distribution_recloser'?relayAssets():regulatorAssets();document.getElementById('modal-root').innerHTML=`<div class="modal no-backdrop-close" id="v205-bulk-modal"><div class="modal-card bulk-update-card"><button class="modal-close" id="v205-close-bulk"><span data-icon="x"></span></button><h2>Atualização em massa · ${esc(frontFamilyLabel(key))}</h2><p class="muted">Exporte a base, altere os campos permitidos e envie o arquivo para conferência. Os identificadores e a versão não devem ser alterados.</p><div class="bulk-update-actions"><section class="bulk-action"><h3>1. Exportar base</h3><button class="btn secondary" id="v205-bulk-export">Baixar Excel</button></section><section class="bulk-action"><h3>2. Analisar alterações</h3><label class="btn primary" for="v205-bulk-file">Selecionar Excel</label><input id="v205-bulk-file" type="file" accept=".xlsx,.xls" class="hidden"></section></div><div id="v205-bulk-preview"></div></div></div>`;hydrateIcons(document.getElementById('modal-root'));document.getElementById('v205-close-bulk').onclick=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('v205-bulk-export').onclick=()=>exportFrontAssets(assets,key);document.getElementById('v205-bulk-file').onchange=e=>e.target.files?.[0]&&analyzeFrontBulkFile(e.target.files[0],assets,key)}
  async function analyzeFrontBulkFile(file,assets,key){const buffer=await file.arrayBuffer(),wb=XLSX.read(buffer,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:false}),byId=new Map(assets.map(a=>[a.id,a])),schema=schemaFor(key),changes=[],errors=[];for(let i=0;i<rows.length;i++){const row=rows[i],id=String(row['ID (não alterar)']||''),a=byId.get(id);if(!a){errors.push(`Linha ${i+2}: ID não encontrado.`);continue}if(Number(row['Versão (não alterar)'])!==Number(a.row_version)){errors.push(`Linha ${i+2}: versão desatualizada.`);continue}const updates={};for(const [label,path] of schema){let value=String(row[label]??'').trim();const old=String(getAssetField(a,path)??'');if(value!==old){const err=validateBulkValue(path,value);if(err){errors.push(`Linha ${i+2} · ${label}: ${err}.`);continue}updates[path]=value||null}}if(Object.keys(updates).length)changes.push({a,updates})}const host=document.getElementById('v205-bulk-preview');host.innerHTML=`<div class="import-summary"><div class="import-kpi"><strong>${rows.length}</strong><span>linhas lidas</span></div><div class="import-kpi"><strong>${changes.length}</strong><span>ativos alterados</span></div><div class="import-kpi error"><strong>${errors.length}</strong><span>erros</span></div></div>${errors.length?`<div class="import-error-list">${errors.slice(0,30).map(esc).join('<br>')}</div>`:''}${changes.length?`<div class="import-preview">${changes.slice(0,50).map(c=>`<article class="import-asset-change"><strong>${esc(frontAssetTitle(c.a))}</strong>${Object.entries(c.updates).map(([p,v])=>`<div class="import-change-row"><b>${esc(fieldMeta(p).label)}</b><span>${esc(displayValue(getAssetField(c.a,p)))}</span><span>→</span><span>${esc(displayValue(v))}</span></div>`).join('')}</article>`).join('')}</div>`:''}<div class="report-actions"><button class="btn primary" id="v205-apply-bulk" ${errors.length||!changes.length?'disabled':''}>Aplicar ${changes.length} atualização(ões)</button></div>`;document.getElementById('v205-apply-bulk')?.addEventListener('click',async e=>{if(!navigator.onLine)return toast('A atualização em massa exige conexão.','warning');e.currentTarget.disabled=true;let done=0;try{for(const c of changes){const {error}=await cloudClient.rpc('update_front_asset_record',{p_asset_id:c.a.id,p_expected_version:c.a.row_version,p_updates:c.updates});if(error)throw error;done++}await loadV205FrontAssets();toast(`${done} ativo(s) atualizado(s).`);document.getElementById('modal-root').innerHTML='';renderDatabase()}catch(error){e.currentTarget.disabled=false;toast(error.message||String(error),'warning')}})}

  /* ---------- sincronização multi-frente ---------- */
  async function v205UploadPhotos(record,user){const photos=await idbByIndex('maintenancePhotos','maintenanceId',record.id);for(const photo of photos){if(!photo.cloudId){photo.cloudId=crypto.randomUUID();await idbPut('maintenancePhotos',photo)}const path=`${user.id}/${record.id}/${photo.cloudId}.jpg`;const {error:uploadError}=await cloudClient.storage.from('maintenance-photos').upload(path,photo.blob,{contentType:photo.blob?.type||'image/jpeg',upsert:true});if(uploadError)throw uploadError;const row={id:photo.cloudId,report_id:record.id,storage_path:path,category:photo.category||null,caption:photo.caption||null,latitude:photo.latitude??null,longitude:photo.longitude??null};if(record.businessFront&&record.businessFront!=='substation')row.front_asset_id=photo.frontAssetId||photo.assetId;else row.asset_id=photo.assetId;const {error}=await cloudClient.from('maintenance_photos').insert(row);if(error&&error.code!=='23505')throw error}}
  async function v205EnsureChildren(record,user){
    if(record.businessFront&&record.businessFront!=='substation'){
      if(record.frontAssetIds?.length){const {error}=await cloudClient.from('maintenance_report_front_assets').insert(record.frontAssetIds.map(asset_id=>({report_id:record.id,asset_id})));if(error&&error.code!=='23505')throw error}
    }else if(record.equipamentos?.length){const {error}=await cloudClient.from('maintenance_report_assets').insert(record.equipamentos.map(asset_id=>({report_id:record.id,asset_id})));if(error&&error.code!=='23505')throw error}
    const f=record.form||{};if(norm(f.houvePeca)==='sim'&&f.peca){if(!record.partCloudId){record.partCloudId=crypto.randomUUID();await idbPut('maintenanceRecords',record)}const part={id:record.partCloudId,report_id:record.id,description:f.peca,removed_destination:f.destinoPeca||null};if(record.businessFront&&record.businessFront!=='substation')part.front_asset_id=record.frontAssetIds?.[0];else part.asset_id=record.equipamentos?.[0];if(part.front_asset_id||part.asset_id){const {error}=await cloudClient.from('maintenance_parts').insert(part);if(error&&error.code!=='23505')throw error}}
    await v205UploadPhotos(record,user);await syncAudits(record);
  }
  function recordChanges(record){if(Array.isArray(record.assetChanges))return record.assetChanges;return safeJson(record.form?.assetChangesJson,[])||[]}
  function v205Payload(record){return {schema_version:2,source:'app',app_version:V205_VERSION,business_front:record.businessFront||'substation',form:record.form||{},equipamentos:record.equipamentos||[],equipamentosSnapshot:record.equipamentosSnapshot||[],frontAssetIds:record.frontAssetIds||[],frontAssetsSnapshot:record.frontAssetsSnapshot||[],asset_changes:recordChanges(record),batchId:record.batchId||null,batchPosition:record.batchPosition||1,batchTotal:record.batchTotal||1}}
  const v205BaseSendReport=window.CENTRAL_SYNC_ADAPTER?.sendReport?.bind(window.CENTRAL_SYNC_ADAPTER);
  if(window.CENTRAL_SYNC_ADAPTER)window.CENTRAL_SYNC_ADAPTER.sendReport=async function({record}){
    const changes=recordChanges(record),front=record.businessFront||'substation';if(front==='substation'&&!changes.length&&v205BaseSendReport)return v205BaseSendReport({record});
    const {data:{session},error:sessionError}=await cloudClient.auth.getSession();if(sessionError)throw sessionError;if(!session)throw new Error('Sessão expirada. Entre novamente para sincronizar.');
    const {data:existing,error:findError}=await cloudClient.from('maintenance_reports').select('id,status,revision').eq('idempotency_key',record.idempotencyKey||record.id).maybeSingle();if(findError)throw findError;const payload=v205Payload(record);
    if(existing){if(record.aprovadoEm||record.status==='aprovado'){const {data,error}=await cloudClient.rpc('approve_maintenance_report',{p_report_id:existing.id});if(error)throw error;await v205EnsureChildren(record,session.user);return {id:existing.id,status:data?.status||'aprovado'}}if((record.revisao||1)>Number(existing.revision||1)){const audits=await auditForRecord(record.id),reason=audits.find(a=>a.action==='corrigido')?.reason||'Correção registrada no aplicativo';const {data,error}=await cloudClient.rpc('correct_maintenance_report',{p_report_id:existing.id,p_payload:payload,p_reason:reason});if(error)throw error;await v205EnsureChildren(record,session.user);return {id:existing.id,status:data?.status||'corrigido'}}await v205EnsureChildren(record,session.user);return {id:existing.id,status:existing.status||'enviado'}}
    const {error:reportError}=await cloudClient.from('maintenance_reports').insert({id:record.id,report_number:record.numeroRelatorio,idempotency_key:record.idempotencyKey||record.id,substation_id:record.subestacao||null,author_id:session.user.id,business_front:front,status:'enviado',outcome:record.resultado||'concluido',revision:record.revisao||1,payload,created_at:record.criadoEm||nowIso()});if(reportError)throw reportError;await v205EnsureChildren(record,session.user);return {id:record.id,status:'enviado'};
  };

  async function loadV205CloudReports(){if(!navigator.onLine||!state.cloudUser)return;try{const [{data:reports,error:rErr},links]=await Promise.all([cloudClient.from('maintenance_reports').select('*').in('business_front',['distribution','telecom']).order('created_at',{ascending:false}).limit(1500),paginatedSelect('maintenance_report_front_assets','*','report_id')]);if(rErr)throw rErr;const byReport=new Map();for(const l of links||[]){if(!byReport.has(l.report_id))byReport.set(l.report_id,[]);byReport.get(l.report_id).push(l.asset_id)}const profileById=new Map((state.profileDirectory||[]).map(p=>[p.id,p]));const extra=(reports||[]).map(r=>{const p=r.payload||{},ids=byReport.get(r.id)||p.frontAssetIds||[],snaps=(p.frontAssetsSnapshot||ids.map(id=>state.frontAssetMap.get(id)).filter(Boolean)).map(standardFrontAsset),form=p.form||{},assetNames=snaps.map(frontAssetTitle);const raw={id:r.id,numeroRelatorio:r.report_number,idempotencyKey:r.idempotency_key,version:p.app_version||'cloud',businessFront:r.business_front,usuario:{name:profileById.get(r.author_id)?.display_name||form.equipe||'Equipe',id:r.author_id},subestacao:r.substation_id,frontAssetIds:ids,frontAssetsSnapshot:snaps,equipamentos:[],equipamentosSnapshot:[],form,assetChanges:p.asset_changes||[],resultado:r.outcome,criadoEm:r.created_at,updatedAt:r.updated_at,revisao:r.revision,status:r.status,servidorId:r.id,cloud:true,motivoReprovacao:r.rejection_reason||'',authorId:r.author_id};return {key:'cloud:'+r.id,source:'cloud',id:r.id,number:r.report_number,subId:r.substation_id,substation:snaps[0]?.location_name||snaps[0]?.substation_code||frontLabel(r.business_front),businessFront:r.business_front,date:form.data||r.created_at,createdAt:r.created_at,author:form.equipe||raw.usuario.name,assets:assetNames.length?assetNames:['Ativo não informado'],type:form.activityLabel||form.tipo||'Manutenção',status:r.status,outcome:r.outcome,raw}});const ids=new Set(extra.map(x=>x.id));state.cloudReports=[...(state.cloudReports||[]).filter(r=>!ids.has(r.id)),...extra].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))}catch(error){console.warn('[v2.0.5] relatórios multi-frente:',error)}}
  const v205PrevLoad=loadCloudSnapshot;loadCloudSnapshot=async function(...args){const r=await v205PrevLoad(...args);await loadV205CloudReports();return r};

  const v205BaseCombinedReports=combinedReports;
  combinedReports=async function(){const base=await v205BaseCombinedReports(),cloudIds=new Set((state.cloudReports||[]).map(r=>r.id)),local=await currentUserLocalRecords('maintenanceRecords');const frontLocals=local.filter(r=>r.businessFront&&r.businessFront!=='substation'&&(!cloudIds.has(r.id)||reportRequiresSync(r.status))).map(r=>{const a=(r.frontAssetsSnapshot||[]).map(frontAssetTitle);return {key:'local:'+r.id,source:'local',id:r.id,number:r.numeroRelatorio||r.id,businessFront:r.businessFront,subId:r.subestacao,substation:r.frontAssetsSnapshot?.[0]?.location_name||r.frontAssetsSnapshot?.[0]?.substation_code||frontLabel(r.businessFront),date:r.form?.data||r.criadoEm,createdAt:r.criadoEm,author:r.form?.equipe||r.usuario?.name||'Equipe local',assets:a.length?a:['Ativo não informado'],type:r.form?.activityLabel||r.form?.tipo||r.form?.activity||r.v205Activity||state.v205Activity||'Manutenção',status:r.status||'salvo_local',outcome:r.resultado||'concluido',raw:r}});const noMalformedFront=base.filter(r=>!(r.businessFront&&r.businessFront!=='substation')&&!frontLocals.some(x=>x.id===r.id));const cloudFront=(state.cloudReports||[]).filter(r=>r.businessFront&&r.businessFront!=='substation');const cloudFrontIds=new Set(cloudFront.map(r=>r.id));return [...noMalformedFront.filter(r=>!cloudFrontIds.has(r.id)),...frontLocals,...cloudFront].sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))};

  /* ---------- Relatórios com abas por frente ---------- */
  function reportFront(r){return r.businessFront||r.raw?.businessFront||r.raw?.business_front||r.raw?.payload?.business_front||'substation'}
  function reportFrontTabs(active,reports){const count=f=>f==='all'?reports.length:reports.filter(r=>reportFront(r)===f).length;return `<div class="v205-top-tabs v205-report-tabs">${[['all','Todos'],['substation','Subestação'],['distribution','Distribuição'],['telecom','Telecom']].map(([k,l])=>`<button data-report-front="${k}" class="${active===k?'active':''}">${l}<span>${count(k)}</span></button>`).join('')}</div>`}
  renderOverview=async function(){
    if(state.role!=='admin'){toast('A área de Relatórios é exclusiva da Equipe Administrativa.','warning');return renderHome()}state.screen='overview';setActiveNav('overview');const reports=await combinedReports();state.reports=reports;let active=state.reportFront||'all';const sortState={key:'date',dir:'desc'};
    main.innerHTML=`<div class="page-heading overview-heading"><div><h1>Relatórios</h1><p>Relatórios das equipes e histórico consolidado de manutenção.</p></div></div>${reportFrontTabs(active,reports)}<div id="v205-report-stats"></div><section class="panel"><div class="inbox-toolbar"><div class="search"><input id="report-search" placeholder="Buscar por ativo, equipe, local ou tipo"></div><select id="report-source"><option value="">Todos os status</option><option value="pending">Aguardando envio</option><option value="review">Aguardando revisão</option><option value="approved">Aprovados</option><option value="rejected">Reprovados</option><option value="inconclusivo">Atendimentos inconclusivos</option><option value="imported">Histórico importado</option></select></div><div id="inbox"></div></section>`;
    const search=document.getElementById('report-search'),source=document.getElementById('report-source');
    const frontRows=()=>reports.filter(r=>active==='all'||reportFront(r)===active);function statusMatch(r,v){if(!v)return true;if(v==='pending')return reportRequiresSync(r.status);if(v==='review')return ['enviado','corrigido'].includes(r.status);if(v==='approved')return r.status==='aprovado';if(v==='rejected')return r.status==='reprovado';if(v==='inconclusivo')return r.outcome==='inconclusivo';if(v==='imported')return r.source==='imported';return true}
    function drawStats(){const rows=frontRows();document.getElementById('v205-report-stats').innerHTML=`<div class="stats v205-report-stats"><div class="stat"><strong>${rows.length}</strong><span>relatórios</span></div><div class="stat"><strong>${rows.filter(r=>['enviado','corrigido'].includes(r.status)).length}</strong><span>em análise</span></div><div class="stat"><strong>${rows.filter(r=>r.status==='aprovado').length}</strong><span>aprovados</span></div><div class="stat"><strong>${rows.filter(r=>r.status==='reprovado').length}</strong><span>reprovados</span></div></div>`}
    function time(v){const t=new Date(v||0).getTime();return Number.isNaN(t)?0:t}function draw(){const q=norm(search.value),src=source.value;const matched=frontRows().filter(r=>statusMatch(r,src)&&(!q||norm([r.number,r.author,r.substation,r.type,...r.assets].join(' ')).includes(q))).sort((a,b)=>time(b.date||b.createdAt)-time(a.date||a.createdAt));const list=matched.slice(0,300);document.getElementById('inbox').innerHTML=`<div class="inbox"><div class="inbox-head"><span></span><span>Relatório / ativo</span><span>Responsável</span><span>Data</span></div>${list.length?list.map(r=>`<article class="inbox-row ${r.source!=='imported'?'unread':''}" data-report-key="${esc(r.key)}"><span class="report-dot ${r.status==='aprovado'?'approved-state':r.status==='reprovado'?'rejected':r.outcome==='inconclusivo'?'inconclusive':'review'}"></span><div class="inbox-main"><strong>${esc(r.assets.join(', ')||'Ativo não informado')}</strong><span>${esc(frontLabel(reportFront(r)))} · ${esc(r.type)} · ${esc(r.substation||'')}</span>${r.source!=='imported'?`<span class="status-wrap">${statusPill(r.status)}</span>`:''}</div><div class="inbox-person"><b>${esc(r.author||'')}</b></div><div class="inbox-date"><b>${formatDate(r.date)}</b></div></article>`).join(''):'<div class="empty">Nenhum relatório encontrado.</div>'}</div><p class="database-note">Exibindo ${list.length} de ${matched.length} resultado(s).</p>`;document.querySelectorAll('[data-report-key]').forEach(row=>row.onclick=()=>openReportDetails(row.dataset.reportKey))}
    document.querySelectorAll('[data-report-front]').forEach(b=>b.onclick=()=>{active=b.dataset.reportFront;state.reportFront=active;document.querySelectorAll('[data-report-front]').forEach(x=>x.classList.toggle('active',x===b));drawStats();draw()});search.oninput=draw;source.onchange=draw;drawStats();draw();
  };

  const v205BaseOpenReportDetails=openReportDetails;
  openReportDetails=async function(key){const r=state.reports.find(x=>x.key===key)||(await combinedReports()).find(x=>x.key===key);if(!r)return;if(reportFront(r)==='substation')return v205BaseOpenReportDetails(key);return openV205ReportDetails(r)};
  function valueListMarkup(form){return Object.entries(form||{}).filter(([k,v])=>k!=='assetChangesJson'&&v!==''&&v!=null&&!/^shelterCheck_|^towerCheck_/.test(k)).map(([k,v])=>`<div class="detail-box"><b>${esc(prettyKey(k))}</b><span>${esc(Array.isArray(v)?v.join(', '):String(v))}</span></div>`).join('')}
  async function openV205ReportDetails(r){const raw=r.raw,changes=raw.assetChanges||safeJson(raw.form?.assetChangesJson,[])||[];let requests=[];if(navigator.onLine&&raw.id){const {data}=await cloudClient.from('asset_change_requests').select('*').eq('report_id',raw.id).order('created_at',{ascending:true});requests=data||[]}const conflicts=requests.filter(x=>x.status==='conflict');const reviewAllowed=state.role==='admin'&&raw.cloud&&['enviado','corrigido'].includes(raw.status);const canCorrect=raw.status==='reprovado'&&(raw.usuario?.id===state.cloudUser?.id||raw.authorId===state.cloudUser?.id||state.role==='admin');document.getElementById('modal-root').innerHTML=`<div class="modal" id="v205-report-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="v205-close-report"><span data-icon="x"></span></button><div class="report-header"><div><div class="status-wrap">${statusPill(raw.status)}</div><h2>${esc(r.type)}</h2><p class="muted">${esc(frontLabel(reportFront(r)))} · ${esc(r.substation||'')}</p></div></div><div class="detail-block" style="border:0;padding:0"><h3>Ativos envolvidos</h3><div class="asset-tags">${r.assets.map(a=>`<span class="asset-tag">${esc(a)}</span>`).join('')}</div></div><div class="detail-grid">${valueListMarkup(raw.form)}</div>${changes.length?`<div class="detail-block"><h3>Atualizações cadastrais propostas</h3><div class="v205-change-review">${changes.map(c=>{const req=requests.find(x=>x.asset_id===String(c.asset_id)&&x.field_path===c.field_path),st=req?.status;return `<p><b>${esc(c.label||c.field_path)}</b>: ${esc(c.old_value??'—')} → ${esc(c.new_value)} ${st?`<span class="v205-change-state ${st}">${esc(st==='applied'?'Aplicado':st==='conflict'?'Conflito':st==='kept_current'?'Mantido atual':'Pendente')}</span>`:''}</p>`}).join('')}</div></div>`:''}${conflicts.length?`<div class="detail-block v205-conflicts"><h3>Conflitos cadastrais</h3><p>O cadastro foi alterado depois do atendimento. Escolha qual valor deve prevalecer.</p>${conflicts.map(c=>`<article><b>${esc(c.label)}</b><span>Valor do relatório: ${esc(displayValue(c.new_value))}</span><div><button class="btn secondary" data-conflict-keep="${c.id}">Manter cadastro atual</button><button class="btn primary" data-conflict-apply="${c.id}">Aplicar valor do relatório</button></div></article>`).join('')}</div>`:''}${raw.motivoReprovacao?`<div class="rejection-panel"><h3>Motivo da reprovação</h3><p>${esc(raw.motivoReprovacao)}</p></div>`:''}<div class="report-actions">${canCorrect?'<button class="btn secondary" id="v205-correct-report">Corrigir relatório</button>':''}${reviewAllowed?'<button class="btn reject-action" id="v205-reject-report">Reprovar relatório</button><button class="btn approve-action" id="v205-approve-report">Aprovar relatório</button>':''}</div></div></div>`;hydrateIcons(document.getElementById('modal-root'));document.getElementById('v205-close-report').onclick=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('v205-report-modal').onclick=e=>{if(e.target===e.currentTarget)document.getElementById('modal-root').innerHTML=''};
    document.getElementById('v205-approve-report')?.addEventListener('click',async()=>{const {error}=await cloudClient.rpc('approve_maintenance_report',{p_report_id:raw.id});if(error)return toast(error.message||String(error),'warning');await loadCloudSnapshot();toast('Relatório aprovado. Alterações cadastrais sem conflito foram aplicadas.');state.reports=await combinedReports();openReportDetails('cloud:'+raw.id)});
    document.getElementById('v205-reject-report')?.addEventListener('click',async()=>{const reason=prompt('Motivo da reprovação:','');if(!reason?.trim())return;const {error}=await cloudClient.rpc('reject_maintenance_report',{p_report_id:raw.id,p_reason:reason.trim()});if(error)return toast(error.message||String(error),'warning');await loadCloudSnapshot();toast('Relatório reprovado e devolvido para correção.');state.reports=await combinedReports();openReportDetails('cloud:'+raw.id)});
    document.querySelectorAll('[data-conflict-keep]').forEach(b=>b.onclick=()=>resolveV205Conflict(b.dataset.conflictKeep,'keep_current',raw.id));document.querySelectorAll('[data-conflict-apply]').forEach(b=>b.onclick=()=>resolveV205Conflict(b.dataset.conflictApply,'apply_report',raw.id));document.getElementById('v205-correct-report')?.addEventListener('click',()=>beginV205Correction(raw));
  }
  async function resolveV205Conflict(id,resolution,reportId){const {error}=await cloudClient.rpc('resolve_asset_change_request',{p_request_id:id,p_resolution:resolution,p_note:null});if(error)return toast(error.message||String(error),'warning');await loadV205FrontAssets();toast(resolution==='apply_report'?'Valor do relatório aplicado.':'Cadastro atual mantido.');state.reports=await combinedReports();openReportDetails('cloud:'+reportId)}

  /* ---------- correção de relatórios multi-frente ---------- */
  state.v205EditRecord=state.v205EditRecord||null;
  function beginV205Correction(raw){const asset=(raw.frontAssetIds||[]).map(id=>state.frontAssetMap.get(id)).filter(Boolean)[0]||raw.frontAssetsSnapshot?.[0];if(!asset)return toast('O ativo deste relatório não foi encontrado na base local.','warning');state.businessFront=raw.businessFront||'distribution';state.v205Asset=standardFrontAsset(asset);state.v205Activity=raw.form?.activityLabel||raw.form?.tipo||(state.businessFront==='telecom'?'Manutenção Corretiva':'Manutenção Corretiva');state.v205EditRecord=raw;document.getElementById('modal-root').innerHTML='';renderV205Activity()}
  const v205RenderActivityOriginal=renderV205Activity;
  renderV205Activity=async function(){await v205RenderActivityOriginal();const edit=state.v205EditRecord;if(!edit||state.screen!=='v205-activity')return;const form=document.getElementById('v205-form');if(!form)return;setFormValues(form,edit.form||{});const correction=document.createElement('div');correction.className='v205-form-section';correction.innerHTML=`<div class="v205-section-title"><h3>Correção do relatório</h3><p>Informe o que foi corrigido antes de reenviar.</p></div><div class="form-grid">${textArea('correctionReason','Justificativa da correção',{required:true})}</div>`;form.querySelector('.v205-form-actions')?.before(correction);const originalChanges=edit.assetChanges||safeJson(edit.form?.assetChangesJson,[])||[];for(const c of originalChanges){const input=form.querySelector(`[data-cadastral-new="${CSS.escape(c.field_path)}"]`);if(input)input.value=c.new_value??''}form.querySelector('.v205-cadastral')?._v205Sync?.();form.dispatchEvent(new Event('change',{bubbles:true}));bindMasks(form)};

  finalizeV205Report=async function(asset,values,changes){
    const edit=state.v205EditRecord,created=edit?.criadoEm||nowIso(),now=nowIso();let record;
    const mergedChanges=new Map();for(const c of (edit?.assetChanges||safeJson(edit?.form?.assetChangesJson,[])||[]))mergedChanges.set(`${c.asset_source}:${c.asset_id}:${c.field_path}`,c);for(const c of changes||[])mergedChanges.set(`${c.asset_source}:${c.asset_id}:${c.field_path}`,c);changes=[...mergedChanges.values()];
    const form={...values,activityLabel:state.v205Activity,assetChangesJson:JSON.stringify(changes)};
    if(edit){record={...edit,cloud:false,businessFront:state.businessFront,frontAssetIds:[asset.id],frontAssetsSnapshot:[asset],equipamentos:[],equipamentosSnapshot:[],form,assetChanges:changes,resultado:values.activityStatus==='Pendente'?'inconclusivo':'concluido',updatedAt:now,revisao:Number(edit.revisao||1)+1,status:'corrigido',motivoReprovacao:''};await idbPut('maintenanceRecords',record);await addAudit(record.id,'corrigido',values.correctionReason||'Correção do relatório.',[],edit.status,'corrigido')}
    else{const id=uid();record={id,numeroRelatorio:ensureReportNumber?.()||`R-${Date.now()}`,idempotencyKey:id,version:V205_VERSION,businessFront:state.businessFront,usuario:currentUser(),subestacao:v205SubstationForAsset(asset),frontAssetIds:[asset.id],frontAssetsSnapshot:[asset],equipamentos:[],equipamentosSnapshot:[],form,assetChanges:changes,resultado:values.activityStatus==='Pendente'?'inconclusivo':'concluido',criadoEm:created,updatedAt:now,revisao:1,status:initialLocalStatus()};await idbPut('maintenanceRecords',record);await addAudit(record.id,'criado','Relatório multi-frente confirmado após revisão.',[], '',record.status)}
    for(let i=0;i<state.pendingPhotos.length;i++){const p=state.pendingPhotos[i];await idbPut('maintenancePhotos',{id:`${record.id}_${p.id||i}_${Date.now()}`,maintenanceId:record.id,assetId:asset.id,frontAssetId:asset.id,blob:p.blob,category:p.category,caption:p.caption||'',latitude:p.latitude??null,longitude:p.longitude??null,criadoEm:now})}
    await enqueueSync(record);await idbDelete('drafts',`v205:${state.businessFront}:${asset.id}`).catch(()=>{});state.pendingPhotos=[];state.v205EditRecord=null;await processSyncQueue();await updateConnectivityIndicator();main.innerHTML=`<section class="panel v205-success"><div class="v205-success-icon">✓</div><h2>${edit?'Correção registrada':'Relatório registrado'}</h2><p class="muted">${esc(frontLabel(state.businessFront))} · ${esc(frontAssetTitle(asset))}<br>Status: <b>${esc(statusMeta(record.status).label)}</b></p><div><button class="btn secondary" id="v205-success-home">Início</button><button class="btn primary" id="v205-success-new">Nova manutenção</button></div></section>`;document.getElementById('v205-success-home').onclick=renderHome;document.getElementById('v205-success-new').onclick=()=>{state.v205Asset=null;state.v205Activity=null;if(state.v209EmbeddedTelecomSubstation){const sub=state.v209EmbeddedTelecomSubstation;state.v209EmbeddedTelecomSubstation=null;state.businessFront='substation';state.sub=sub;return renderEquipment()}renderSubstations()};
  };

  /* ---------- divergência cadastral também em Subestações ---------- */
  const v205BaseRenderActivity=renderActivity;
  renderActivity=async function(){await v205BaseRenderActivity();if(state.businessFront!=='substation'||state.screen!=='activity')return;const form=document.getElementById('form'),asset=currentFormAssets?.()[0];if(!form||!asset||form.querySelector('.v205-cadastral'))return;const wrap=document.createElement('div');wrap.className='field full';wrap.innerHTML=cadastralMarkup(asset,'assets');const summary=form.querySelector('.asset-summary-grid');if(summary)summary.after(wrap);else form.prepend(wrap);bindCadastral(form,asset,'assets');form.addEventListener('submit',()=>{form.querySelector('.v205-cadastral')?._v205Sync?.();validateMaskedFields(form)},true)};

  /* ---------- histórico nas fichas e no atendimento ---------- */
  openFrontAssetDetails=function(asset){
    if(!asset)return;
    const isRelay=asset.family_code==='distribution_recloser',rep=asset.linked_repeater_id?state.frontAssetMap.get(asset.linked_repeater_id):findRepeaterByName(asset.data?.repeater_name),rows=detailRows(asset);
    document.getElementById('modal-root').innerHTML=`<div class="modal" id="v205-asset-modal"><div class="modal-card v205-asset-modal"><button class="modal-close" id="v205-close-asset"><span data-icon="x"></span></button><div class="v205-detail-head"><div><span class="v205-status ${norm(asset.status).includes('operacao')?'ok':''}">${esc(asset.status||'Sem status')}</span><h2>${esc(frontAssetTitle(asset))}</h2><p>${esc(frontFamilyLabel(asset.family_code))}</p></div>${isRelay?`<button class="btn primary" id="v205-route" ${asset.latitude==null||asset.longitude==null?'disabled':''}>Traçar rota</button>`:''}</div>${isRelay&&asset.latitude!=null?`<div class="v205-coordinates">${Number(asset.latitude).toFixed(6)}, ${Number(asset.longitude).toFixed(6)}</div>`:''}${rep?`<button class="v205-linked-repeater" id="v205-open-repeater">Comunicação via <b>${esc(rep.display_name)}</b></button>`:''}<div class="v205-detail-grid">${rows.map(([k,v])=>`<div><b>${esc(k)}</b><span>${esc(displayValue(v))}</span></div>`).join('')}</div>${asset.business_front==='distribution'?v205HistoryMarkup(asset,12):''}</div></div>`;
    hydrateIcons(document.getElementById('modal-root'));bindV205History(document.getElementById('modal-root'));
    document.getElementById('v205-close-asset').onclick=()=>document.getElementById('modal-root').innerHTML='';
    document.getElementById('v205-asset-modal').onclick=e=>{if(e.target===e.currentTarget)document.getElementById('modal-root').innerHTML=''};
    document.getElementById('v205-route')?.addEventListener('click',()=>openRelayRoute(asset));
    document.getElementById('v205-open-repeater')?.addEventListener('click',()=>{document.getElementById('modal-root').innerHTML='';openRepeaterDetails(rep)});
  };

  const v205HistoryActivityBase=renderV205Activity;
  renderV205Activity=async function(){
    await v205HistoryActivityBase();
    if(state.screen!=='v205-activity'||state.businessFront!=='distribution'||!state.v205Asset)return;
    const form=document.getElementById('v205-form');if(!form||document.getElementById('v205-activity-history'))return;
    const box=document.createElement('div');box.id='v205-activity-history';box.innerHTML=v205HistoryMarkup(state.v205Asset,6);form.before(box);bindV205History(box);
  };

  /* ---------- Ativos multi-frente ---------- */
  const v205LegacyAssetOperationsHome=renderAssetOperationsHome;
  state.assetOperationFront=state.assetOperationFront||null;
  const FRONT_OPERATION_FAMILIES={
    distribution:[['distribution_recloser','Religador de Distribuição'],['voltage_regulator','Regulador de Tensão']],
    telecom:[['repeater','Repetidora'],['telecom_site','Local de Telecom'],['radio_voice_vhf','Rádio de Voz VHF'],['radio_data_uhf','Rádio de Dados UHF'],['radio_microwave','Rádio Micro-ondas'],['converter_125_12','Conversor 125/12 Vcc'],['converter_125_48','Conversor 125/48 Vcc'],['router','Roteador'],['claroty','Claroty']]
  };
  function v205OperationFrontAssets(front){return state.frontAssets.filter(a=>a.business_front===front&&a.active!==false)}
  async function loadV205FrontOperations(front){
    const local=(await idbAll('appSettings')).filter(x=>x?.kind==='v205-front-operation'&&x.businessFront===front),map=new Map(local.map(x=>[x.id,x]));
    if(navigator.onLine&&state.cloudUser){const {data,error}=await cloudClient.from('front_asset_operations').select('*').eq('business_front',front).order('created_at',{ascending:false}).limit(80);if(!error)for(const r of data||[])map.set(r.id,{id:r.id,number:r.operation_number,type:r.operation_type,businessFront:r.business_front,familyCode:r.family_code,currentAssetId:r.current_asset_id,status:r.status,payload:r.payload||{},createdAt:r.created_at,cloud:true})}
    return [...map.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  async function syncPendingV205FrontOperations(){
    if(!navigator.onLine||!state.cloudUser)return 0;let done=0;
    const pending=(await idbAll('appSettings')).filter(x=>x?.kind==='v205-front-operation'&&x.ownerId===state.cloudUser.id);
    for(const op of pending){try{const {error}=await cloudClient.from('front_asset_operations').insert({id:op.id,operation_number:op.number,idempotency_key:op.id,business_front:op.businessFront,operation_type:op.type,family_code:op.familyCode,current_asset_id:op.currentAssetId||null,author_id:state.cloudUser.id,status:'enviado',payload:op.payload,created_at:op.createdAt});if(error&&error.code!=='23505')throw error;await idbDelete('appSettings',op.key);done++}catch(error){op.lastError=String(error?.message||error);op.updatedAt=nowIso();await idbPut('appSettings',op)}}
    if(done)await loadV205FrontAssets();return done;
  }
  async function submitV205FrontOperation(type,front,family,currentAsset,payload){
    const id=uid(),number=operationNumber(front==='distribution'?'DIST':'TEL'),createdAt=nowIso();
    if(navigator.onLine&&state.cloudUser){const {error}=await cloudClient.from('front_asset_operations').insert({id,operation_number:number,idempotency_key:id,business_front:front,operation_type:type,family_code:family,current_asset_id:currentAsset?.id||null,author_id:state.cloudUser.id,status:'enviado',payload,created_at:createdAt});if(error)throw error;await loadV205FrontAssets();toast(type==='substitution'?'Substituição registrada e aplicada.':'Novo ativo integrado à base.');return true}
    const entry={key:`v205-front-operation:${id}`,kind:'v205-front-operation',id,number,type,businessFront:front,familyCode:family,currentAssetId:currentAsset?.id||null,ownerId:state.cloudUser?.id||null,payload,createdAt,updatedAt:createdAt,status:'aguardando_envio'};await idbPut('appSettings',entry);toast('Operação salva no dispositivo. Será aplicada quando houver conexão.','notice');return true;
  }
  function v205FamilyOptions(front,selected=''){return (FRONT_OPERATION_FAMILIES[front]||[]).map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('')}
  function renderV205FrontOperationForm(type,currentAsset=null){
    const front=state.assetOperationFront||'distribution',family=currentAsset?.family_code||'',subOptions=DATA.substations.map(s=>`<option value="${s.id}">${esc(s.sigla)} — ${esc(s.nome)}</option>`).join(''),sites=telecomSites();
    main.innerHTML=`<section class="v205-page v205-operation-form"><div class="head-row"><div><button class="back" id="v205-op-back"><span data-icon="arrow-left"></span></button><h1>${type==='substitution'?'Substituição de ativo':'Integração de novo ativo'}</h1><p class="muted">${esc(frontLabel(front))}${currentAsset?` · ${esc(frontAssetTitle(currentAsset))}`:''}</p></div></div>${currentAsset?v205AssetSummary(currentAsset):''}<form id="v205-op-form" class="v205-maintenance-form">${section('Identificação',`${selectField('familyCode','Família',(FRONT_OPERATION_FAMILIES[front]||[]).map(x=>x[0]),{required:true,value:family})}${textField('operatingCode','Código operativo',{required:front==='distribution'})}${textField('displayName','Nome ou identificação',{required:true,value:currentAsset?.display_name||''})}${selectField('status','Status',['EM OPERAÇÃO','FORA DE OPERAÇÃO','RESERVA','CADASTRADO'],{required:true,value:front==='distribution'?'EM OPERAÇÃO':'CADASTRADO'})}`)}${section('Localização',`${textField('region','Região')}${selectField('substationCode','Subestação',DATA.substations.map(s=>s.id),{})}${textField('feeder','Alimentador')}${textField('locationName','Localização / endereço',{full:true})}${textField('latitude','Latitude',{type:'number'})}${textField('longitude','Longitude',{type:'number'})}`)}${section('Dados do equipamento',`${textField('manufacturer','Fabricante')}${textField('model','Modelo')}${textField('serialNumber','Número de série')}${front==='telecom'?selectField('parentId','Local pai',sites.map(s=>s.id),{}):''}${front==='distribution'?`${textField('relayFirmware','Firmware do relé')}${selectField('communicationMedium','Meio de comunicação',['Rádio','MODEM GPRS','ORBCOMM','ORBCOMM com redundância GPRS','Fibra Óptica','Skyedge'],{})}`:''}`)}<div class="v205-form-actions"><button class="btn secondary" type="button" id="v205-op-cancel">Cancelar</button><button class="btn primary" type="submit">Registrar operação</button></div></form></section>`;
    hydrateIcons(main);const form=document.getElementById('v205-op-form');if(currentAsset){form.elements.familyCode.value=currentAsset.family_code;form.elements.familyCode.disabled=true;form.elements.operatingCode.value='';form.elements.displayName.value=currentAsset.display_name||'';form.elements.status.value=currentAsset.status||'EM OPERAÇÃO';form.elements.region.value=currentAsset.region||'';form.elements.substationCode.value=currentAsset.substation_code||'';form.elements.feeder.value=currentAsset.feeder||'';form.elements.locationName.value=currentAsset.location_name||'';form.elements.latitude.value=currentAsset.latitude??'';form.elements.longitude.value=currentAsset.longitude??'';form.elements.manufacturer.value=currentAsset.manufacturer||'';form.elements.model.value=currentAsset.model||'';form.elements.serialNumber.value=''}
    const back=()=>renderAssetOperationsHome();document.getElementById('v205-op-back').onclick=back;document.getElementById('v205-op-cancel').onclick=back;
    form.onsubmit=async e=>{e.preventDefault();if(typeof centralValidateForm==='function'?!centralValidateForm(form):!form.reportValidity())return;const x=formValues(form),fam=currentAsset?.family_code||x.familyCode,data={};if(x.relayFirmware)data.relay_firmware=x.relayFirmware;if(x.communicationMedium)data.communication_medium=x.communicationMedium;const payload={operating_code:x.operatingCode||null,display_name:x.displayName,status:x.status,region:x.region||null,substation_code:x.substationCode||null,feeder:x.feeder||null,location_name:x.locationName||null,latitude:x.latitude||null,longitude:x.longitude||null,manufacturer:x.manufacturer||null,model:x.model||null,serial_number:x.serialNumber||null,parent_id:x.parentId||null,data};try{await submitV205FrontOperation(type,front,fam,currentAsset,payload);state.v205Asset=null;renderAssetOperationsHome()}catch(error){toast(error.message||String(error),'warning')}};
  }
  function renderV205OperationPicker(mode){
    const front=state.assetOperationFront||'distribution';let rows=v205OperationFrontAssets(front);if(mode==='commissioning')rows=rows.filter(a=>['distribution_recloser','voltage_regulator'].includes(a.family_code));if(mode==='telecom-installation')rows=rows.filter(a=>['repeater','telecom_site'].includes(a.family_code));
    main.innerHTML=`<section class="v205-page"><div class="head-row"><div><button class="back" id="v205-picker-back"><span data-icon="arrow-left"></span></button><h1>${mode==='substitution'?'Selecionar ativo atual':mode==='commissioning'?'Comissionamento de ativo':'Instalação de Equipamentos de Telecom'}</h1><p class="muted">Busque o ativo ou local para continuar.</p></div></div><section class="panel"><div class="search"><input id="v205-operation-search" placeholder="Buscar por código, nome, local, subestação ou modelo"></div><div id="v205-operation-results" class="v205-asset-results"></div></section></section>`;hydrateIcons(main);document.getElementById('v205-picker-back').onclick=renderAssetOperationsHome;const input=document.getElementById('v205-operation-search');const draw=()=>{const q=norm(input.value),list=rows.filter(a=>!q||norm([a.operating_code,a.display_name,a.location_name,a.substation_code,a.model].join(' ')).includes(q)).slice(0,40);document.getElementById('v205-operation-results').innerHTML=list.map(a=>`<button class="v205-asset-row" data-v205-op-asset="${a.id}"><div><strong>${esc(frontAssetTitle(a))}</strong><span>${esc([frontFamilyLabel(a.family_code),a.substation_code,a.location_name].filter(Boolean).join(' · '))}</span></div></button>`).join('')||'<div class="empty">Nenhum ativo encontrado.</div>';document.querySelectorAll('[data-v205-op-asset]').forEach(b=>b.onclick=()=>{const asset=state.frontAssetMap.get(b.dataset.v205OpAsset);if(mode==='substitution')return renderV205FrontOperationForm('substitution',asset);state.businessFront=front;state.v205Asset=asset;state.v205Activity=mode==='commissioning'?'Comissionamento de ativo':'Instalação de Equipamentos de Telecom';renderV205Activity()})};input.oninput=draw;draw();
  }
  renderAssetOperationsHome=async function(){
    state.screen='integration';setActiveNav('integration');await syncPendingV205FrontOperations();const front=state.assetOperationFront;
    if(front==='substation')return v205LegacyAssetOperationsHome();
    if(!front){main.innerHTML=`<div class="page-heading"><div><h1>Ativos</h1><p>Integração, substituição, comissionamento e instalações das três frentes.</p></div></div><section class="v205-ops-fronts"><button data-v205-op-front="substation"><strong>Subestação</strong><small>Integração e substituição de ativos de subestação.</small></button><button data-v205-op-front="distribution"><strong>Distribuição</strong><small>Religadores, reguladores e comissionamento.</small></button><button data-v205-op-front="telecom"><strong>Telecom</strong><small>Equipamentos, sites e instalações de Telecom.</small></button></section>`;document.querySelectorAll('[data-v205-op-front]').forEach(b=>b.onclick=()=>{state.assetOperationFront=b.dataset.v205OpFront;renderAssetOperationsHome()});return}
    const operations=await loadV205FrontOperations(front),dist=front==='distribution';main.innerHTML=`<div class="page-heading"><div><button class="back" id="v205-assets-front-back"><span data-icon="arrow-left"></span></button><h1>Ativos · ${esc(frontLabel(front))}</h1><p>Escolha a operação desejada.</p></div></div><div class="v205-activity-grid"><button class="operation-card" data-v205-operation="integration"><span class="operation-icon" data-icon="plus"></span><h3>Integração de novo ativo</h3><p>Inclua um novo equipamento na base.</p></button><button class="operation-card orange" data-v205-operation="substitution"><span class="operation-icon" data-icon="exchange"></span><h3>Substituição de ativo</h3><p>Selecione o equipamento atual e registre o substituto.</p></button>${dist?`<button class="operation-card" data-v205-operation="commissioning"><span class="operation-icon" data-icon="check"></span><h3>Comissionamento de ativo</h3><p>Registre o comissionamento de um ativo já cadastrado.</p></button>`:`<button class="operation-card" data-v205-operation="telecom-installation"><span class="operation-icon" data-icon="tool"></span><h3>Instalação de Equipamentos de Telecom</h3><p>Registre a instalação realizada no site.</p></button>`}</div><section class="panel" style="margin-top:16px"><div class="section-title"><h2 style="font-size:18px">Operações recentes</h2><span class="muted">${operations.length} registro(s)</span></div><div class="v205-operation-list">${operations.slice(0,30).map(op=>`<article><div><strong>${esc(op.type==='substitution'?'Substituição':'Integração')} · ${esc(frontFamilyLabel(op.familyCode))}</strong><small>${esc(op.number||'')} · ${formatDate(op.createdAt)}</small></div><span class="v205-status ${op.status==='aplicado'?'ok':''}">${esc(op.status||'Aguardando envio')}</span></article>`).join('')||'<div class="empty">Nenhuma operação registrada.</div>'}</div></section>`;hydrateIcons(main);document.getElementById('v205-assets-front-back').onclick=()=>{state.assetOperationFront=null;renderAssetOperationsHome()};document.querySelectorAll('[data-v205-operation]').forEach(b=>b.onclick=()=>{const op=b.dataset.v205Operation;if(op==='integration')return renderV205FrontOperationForm('integration');if(op==='substitution')return renderV205OperationPicker('substitution');if(op==='commissioning')return renderV205OperationPicker('commissioning');return renderV205OperationPicker('telecom-installation')});
  };

  /* ---------- acabamento / inicialização ---------- */
  function enableV205Fronts(){state.businessFronts=(state.businessFronts?.length?state.businessFronts:[{code:'substation',label:'Subestações',sort_order:10},{code:'distribution',label:'Distribuição',sort_order:20},{code:'telecom',label:'Telecom',sort_order:30}]).map(f=>['substation','distribution','telecom'].includes(f.code)?{...f,active:true}:f)}
  function applyV205VersionChrome(){document.title=document.title.replace(/v\d+\.\d+\.\d+/i,'v'+V205_VERSION);const footer=document.getElementById('environment-footer-version');if(footer)footer.textContent='v'+V205_VERSION;document.querySelectorAll('[data-app-version]').forEach(x=>x.textContent=V205_VERSION)}
  function ensureV205Css(){if(document.querySelector('link[data-v205-css]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./assets/css/v205.css';link.dataset.v205Css='1';document.head.appendChild(link)}
  const v205HomeBase=renderHome;
  renderHome=async function(){enableV205Fronts();await v205HomeBase();const card=main.querySelector('[data-home-action="integration"]');if(card){const h=card.querySelector('h3'),p=card.querySelector('p'),link=card.querySelector('.action-link');if(h)h.textContent='Ativos';if(p)p.textContent='Integração, substituição, comissionamento e instalações de equipamentos.';if(link)link.childNodes[0].textContent='Abrir módulo '}}
  const v205EnterFinal=enterApplication;
  enterApplication=async function(user,profile,options={}){const r=await v205EnterFinal(user,profile,options);enableV205Fronts();applyV205VersionChrome();if(state.cloudUser){setTimeout(()=>seedV205BaselineIfNeeded(),120);setTimeout(()=>syncPendingV205FrontOperations(),250)}return r};
  const v205ToastBase=toast;
  toast=function(message,type){const text=String(message||'');if(/^Conexão reconhecida\.|^Sem conexão\. Novos relatórios serão salvos/i.test(text))return;return v205ToastBase(message,type)};
  window.addEventListener('online',()=>{syncPendingV205FrontOperations();seedV205BaselineIfNeeded()});

  ensureV205Css();enableV205Fronts();applyV205VersionChrome();patchLoginFallback();showOfflineAccess();
  loadStaticFrontAssets().then(rows=>{if(rows.length&&!state.frontAssets.length)applyFrontAssets(rows)}).catch(()=>{});
  loadStaticFrontHistory().then(rows=>{if(rows.length&&!state.frontHistory.length)state.frontHistory=rows}).catch(()=>{});

  // Libera o bootstrap somente depois de a v2.0.5 instalar seus overrides.
  if(globalThis.__CENTRAL_DEFER_BOOT__&&typeof globalThis.__CENTRAL_BOOT__==='function'){
    globalThis.__CENTRAL_DEFER_BOOT__=false;
    setTimeout(()=>globalThis.__CENTRAL_BOOT__(),0);
  }
})();
