/* Central de Manutenção SE — v2.0.7
 * Consolidação visual entre frentes, histórico Telecom e refinamentos de UX.
 * Carregado depois das camadas v2.0.5 e v2.0.6.
 */
(() => {
  'use strict';
  if (globalThis.__CENTRAL_V207__) return;
  globalThis.__CENTRAL_V207__ = true;
  const V207_VERSION = '2.0.7';
  const OFFLINE_MAX_MS = 7*24*60*60*1000;
  const safe=v=>String(v??'');
  const esc=v=>safe(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const norm=v=>{try{return normalize(safe(v))}catch(_){return safe(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()}};
  const assetById=id=>state?.frontAssetMap?.get?.(id)||(state?.frontAssets||[]).find(a=>a.id===id)||null;
  const frontAssets=()=>Array.isArray(state?.frontAssets)?state.frontAssets:[];
  const telSites=()=>frontAssets().filter(a=>a.family_code==='telecom_site'&&a.active!==false);
  const telChildren=id=>frontAssets().filter(a=>a.parent_id===id&&a.active!==false);
  const repeaters=()=>frontAssets().filter(a=>a.family_code==='repeater'&&a.active!==false).sort((a,b)=>safe(a.display_name).localeCompare(safe(b.display_name),'pt-BR'));
  const relays=()=>frontAssets().filter(a=>a.family_code==='distribution_recloser'&&a.active!==false);
  const familyLabel=code=>({
    distribution_recloser:'Religador de Distribuição',voltage_regulator:'Regulador de Tensão',repeater:'Repetidora',
    telecom_site:'Local de Telecom',radio_voice_vhf:'Rádio de Voz VHF',radio_data_uhf:'Rádio de Dados UHF',
    radio_microwave:'Rádio Micro-ondas',converter_125_12:'Conversor 125/12 Vcc',converter_125_12_detailed:'Conversor 125/12 Vcc',
    converter_125_48:'Conversor 125/48 Vcc',router:'Roteador / Switch',claroty:'Claroty'
  })[code]||safe(code).replace(/_/g,' ');

  function applyVersionChrome(){
    const title=document.title.replace(/v\d+\.\d+\.\d+/i,'v'+V207_VERSION);if(document.title!==title)document.title=title;
    const footer=document.getElementById('environment-footer-version');if(footer&&footer.textContent!==`v${V207_VERSION}`)footer.textContent=`v${V207_VERSION}`;
    const label=document.getElementById('app-version-label');if(label&&label.textContent!==`v${V207_VERSION}`)label.textContent=`v${V207_VERSION}`;
  }

  /* ---------- Login: saudação dinâmica e botão offline contextual ---------- */
  function cachedIdentityV207(){try{return JSON.parse(localStorage.getItem('central_offline_identity')||'null')}catch(_){return null}}
  function offlineIdentityValid(){
    const c=cachedIdentityV207(),stamp=c?.validatedAt||c?.authenticatedAt,time=stamp?new Date(stamp).getTime():0;
    return {cached:c,valid:!!time&&Date.now()-time>=0&&Date.now()-time<=OFFLINE_MAX_MS};
  }
  function firstName(name){return safe(name).trim().split(/\s+/)[0]||''}
  function updateLoginGreeting(){
    /* v3.0.2: a saudação persistente pertence à camada v300. */
    if(globalThis.__CENTRAL_V300__)return;
    const shell=document.getElementById('auth-shell');if(!shell)return;
    const email=shell.querySelector('#login-form input[name="email"]')?.value||'';
    const c=cachedIdentityV207();const known=(!email||norm(email)===norm(c?.user?.email))?firstName(c?.profile?.display_name):'';
    const title=[...shell.querySelectorAll('h1,h2')].find(x=>/olá|ola|bem-vindo/i.test(x.textContent||''))||shell.querySelector('h1');
    if(title){const text=known?`Olá, ${known}.`:'Olá, seja bem-vindo.';if(title.textContent!==text)title.textContent=text}
  }
  function renderOfflineAccess(force=false){
    const box=document.getElementById('offline-login');if(!box)return;
    const {cached,valid}=offlineIdentityValid(),show=(force||!navigator.onLine)&&cached&&valid;
    if(!show){if(!box.classList.contains('hidden'))box.classList.add('hidden');if(box.innerHTML)box.innerHTML='';return}
    const text=`Acessar offline como ${cached.profile?.display_name||cached.user?.email||'usuário'}`;
    box.classList.remove('hidden');
    let button=box.querySelector('#v207-open-offline');
    if(!button){box.innerHTML=`<button class="btn secondary" id="v207-open-offline" type="button" style="width:100%">${esc(text)}</button>`;button=box.querySelector('#v207-open-offline')}
    else if(button.textContent!==text)button.textContent=text;
    button.onclick=()=>enterApplication(cached.user,cached.profile,{offline:true});
  }
  function bindLoginUX(){
    updateLoginGreeting();renderOfflineAccess();
    const email=document.querySelector('#login-form input[name="email"]');
    if(email&&!email.dataset.v207Greeting){email.dataset.v207Greeting='1';email.addEventListener('input',updateLoginGreeting)}
  }
  addEventListener('online',()=>renderOfflineAccess(false));addEventListener('offline',()=>renderOfflineAccess(true));

  /* ---------- Histórico Telecom ---------- */
  let telecomHistoryPromise=null;
  let telecomHistorySeedPromise=null;
  let telecomHistorySeededForSession=false;
  function mergeHistory(rows){
    const map=new Map((state.frontHistory||[]).map(x=>[x.id,x]));
    for(const r of rows||[])map.set(r.id,r);
    state.frontHistory=[...map.values()];
  }
  function seedTelecomHistoryWhenReady(rows){
    if(
      telecomHistorySeededForSession||
      telecomHistorySeedPromise||
      !Array.isArray(rows)||
      !rows.length||
      !navigator.onLine||
      state.role!=='admin'||
      !state.cloudUser||
      !cloudClient
    )return;

    telecomHistorySeedPromise=(async()=>{
      try{
        for(let i=0;i<rows.length;i+=80){
          const {error}=await cloudClient.rpc('seed_v205_front_history',{p_rows:rows.slice(i,i+80)});
          if(error)throw error;
        }
        telecomHistorySeededForSession=true;
        return true;
      }catch(e){
        console.warn('[v2.0.7] seed histórico Telecom:',e);
        return false;
      }finally{
        telecomHistorySeedPromise=null;
      }
    })();
  }
  async function loadTelecomHistory(){
    if(!telecomHistoryPromise){
      telecomHistoryPromise=(async()=>{
        try{
          const response=await fetch('./assets/data/v207/telecom-history.json',{cache:'no-store'});
          if(!response.ok)throw new Error('Histórico Telecom v2.0.7 indisponível');
          const rows=await response.json();
          return Array.isArray(rows)?rows:[];
        }catch(e){
          console.warn('[v2.0.7] histórico Telecom:',e);
          return[];
        }
      })();
    }

    const rows=await telecomHistoryPromise;

    /*
     * O histórico v2.0.5 pode ser recarregado da nuvem depois que este arquivo
     * já leu o JSON local. Isso substitui state.frontHistory. Por isso a mesclagem
     * precisa acontecer em toda chamada, e não somente na primeira leitura.
     */
    mergeHistory(rows);
    seedTelecomHistoryWhenReady(rows);
    return rows;
  }

  /*
   * A carga principal da nuvem da camada v2.0.5 substitui state.frontHistory.
   * Reaplicamos o histórico Telecom logo depois para preservar as três frentes.
   */
  if(typeof loadCloudSnapshot==='function'){
    const v207BaseLoadCloudSnapshot=loadCloudSnapshot;
    loadCloudSnapshot=async function(...args){
      const result=await v207BaseLoadCloudSnapshot(...args);
      await loadTelecomHistory();
      return result;
    };
  }

  /* ---------- Foto principal + pasta do ativo ---------- */
  async function localAssetPhoto(id){try{return (await idbGet('assetPhotos',id))?.blob||null}catch(_){return null}}
  async function saveAssetPhoto(asset,file){
    const blob=typeof compressImage==='function'?await compressImage(file,1000,.82):file;
    await idbPut('assetPhotos',{assetId:asset.id,blob,updatedAt:new Date().toISOString(),frontAsset:true});
    const host=document.querySelector('.v206-asset-summary-card .v206-asset-photo');
    if(host){host.querySelector('img')?.remove();host.querySelector(':scope > [data-icon]')?.remove();host.querySelector(':scope > small')?.remove();const img=document.createElement('img');img.src=blobUrl(blob);img.alt='Foto do ativo';host.prepend(img);host.classList.add('has-image')}
    return blob;
  }
  function chooseAssetPhoto(asset,capture){
    const input=document.createElement('input');input.type='file';input.accept='image/*';if(capture)input.capture='environment';
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{await saveAssetPhoto(asset,file);enhanceActivityAfterRender()}catch(e){toast?.(e.message||String(e),'warning')}};
    input.click();
  }
  async function assetFolderPhotos(asset){
    let profile=await localAssetPhoto(asset.id),photos=[];
    try{photos=await idbByIndex('maintenancePhotos','assetId',asset.id)}catch(_){}
    return {profile,photos:(photos||[]).sort((a,b)=>safe(b.criadoEm).localeCompare(safe(a.criadoEm)))};
  }
  async function renderFolderPane(side,asset){
    const pane=side.querySelector('[data-v206-side-pane="folder"]');if(!pane)return;
    const {profile,photos}=await assetFolderPhotos(asset);
    pane.innerHTML=`<div class="folder-profile">${profile?`<img src="${blobUrl(profile)}" alt="Foto principal">`:'<div class="equip-placeholder"><span data-icon="settings"></span></div>'}<div><strong>${esc(asset.operating_code||asset.display_name)}</strong><div class="muted">${profile?'Foto principal cadastrada':'Sem foto principal cadastrada'}</div><div class="muted">${photos.length} foto(s) de manutenção</div></div></div><div class="folder-gallery">${photos.length?photos.map(p=>`<article class="folder-photo" data-v207-photo="${esc(p.id)}"><img src="${blobUrl(p.blob)}" alt=""><div><b>${esc(p.category||'Imagem')}</b>${p.caption?` · ${esc(p.caption)}`:''}<br>${typeof formatDate==='function'?formatDate(p.criadoEm):esc(p.criadoEm)}</div></article>`).join(''):'<div class="empty">As fotos das manutenções deste ativo aparecerão aqui.</div>'}</div>`;
    pane.querySelectorAll('[data-v207-photo]').forEach(el=>el.onclick=()=>{const p=photos.find(x=>x.id===el.dataset.v207Photo);if(p&&typeof openPhoto==='function')openPhoto(p,photos)});
    hydrateIcons?.(pane);
  }

  /* ---------- Equipe técnica padronizada ---------- */
  function activeTechnicians(){
    const rows=(state.profileDirectory||[]).filter(p=>p.active!==false&&p.approval_status!=='rejected'&&(p.role==='field'||!p.role));
    return rows.sort((a,b)=>safe(a.display_name).localeCompare(safe(b.display_name),'pt-BR'));
  }
  function installTeamSelector(form){
    const input=form?.elements?.equipe;if(!input||input.dataset.v207Team==='1')return;
    input.dataset.v207Team='1';input.type='hidden';
    const field=input.closest('.field')||input.parentElement;const techs=activeTechnicians();
    const current=state.cloudProfile?.id||state.cloudUser?.id||'';
    const wrap=document.createElement('div');wrap.className='v207-team-control';
    wrap.innerHTML=`<button type="button" class="v207-team-button">Selecionar equipe técnica <span data-icon="chevron-down"></span></button><div class="v207-team-menu hidden">${techs.map(p=>`<label><input type="checkbox" value="${esc(p.id)}" data-name="${esc(p.display_name||p.email||'Técnico')}" ${p.id===current?'checked':''}><span>${esc(p.display_name||p.email||'Técnico')}</span></label>`).join('')}</div><div class="v207-team-chips"></div><input type="hidden" name="participantIds" value="">`;
    field.appendChild(wrap);
    const btn=wrap.querySelector('.v207-team-button'),menu=wrap.querySelector('.v207-team-menu'),chips=wrap.querySelector('.v207-team-chips'),ids=wrap.querySelector('[name=participantIds]');
    const sync=()=>{const sel=[...menu.querySelectorAll('input:checked')];input.value=sel.map(x=>x.dataset.name).join(', ');ids.value=sel.map(x=>x.value).join(',');chips.innerHTML=sel.length?sel.map(x=>`<span>${esc(x.dataset.name)}</span>`).join(''):'<small>Nenhum integrante selecionado.</small>';input.setCustomValidity(sel.length?'':'Selecione ao menos um integrante da equipe.')};
    btn.onclick=()=>menu.classList.toggle('hidden');menu.addEventListener('change',sync);sync();hydrateIcons?.(wrap);
  }

  /* ---------- Tipo de manutenção dentro do formulário ---------- */
  function allowedActivities(asset){
    if(state.businessFront==='distribution')return asset.family_code==='distribution_recloser'?['Manutenção Preventiva','Manutenção Corretiva']:['Manutenção Corretiva'];
    if(state.businessFront==='telecom')return ['Manutenção Preventiva','Manutenção Corretiva','Acompanhamento de Terceiros'];
    return [];
  }
  function autoEnterActivityChoice(){
    if(state?.screen!=='v205-activity-choice'||!state.v205Asset)return;
    const cards=[...main.querySelectorAll('.v205-activity-grid .operation-card')];if(!cards.length)return;
    const allowed=allowedActivities(state.v205Asset),wanted=state.v207RequestedActivity||state.v205Activity||allowed[0];
    const chosen=cards.find(b=>norm(b.textContent).includes(norm(wanted)))||cards[0];
    state.v207RequestedActivity=null;
    if(chosen&&!chosen.dataset.v207Auto){chosen.dataset.v207Auto='1';chosen.click()}
  }
  function installActivitySelector(form,asset){
    if(!form||form.querySelector('[name="v207ActivityType"]'))return;
    const options=allowedActivities(asset);if(!options.length)return;
    const section=form.querySelector('.v205-form-section')||form.firstElementChild;
    const field=document.createElement('div');field.className='field v207-activity-field';
    field.innerHTML=`<label>Tipo de manutenção <span class="required-mark">*</span></label><select name="v207ActivityType" required>${options.map(x=>`<option ${x===state.v205Activity?'selected':''}>${esc(x)}</option>`).join('')}</select>`;
    if(section?.querySelector('.form-grid'))section.querySelector('.form-grid').prepend(field);else form.prepend(field);
    field.querySelector('select').onchange=e=>{const wanted=e.target.value;if(wanted===state.v205Activity)return;state.v207RequestedActivity=wanted;document.getElementById('v205-back-activity')?.click();setTimeout(autoEnterActivityChoice,0)};
  }

  /* ---------- Encerramento condicional Distribuição ---------- */
  function installBypassDependency(form){
    const bypass=form?.elements?.bypassed,workshop=form?.elements?.workshopRemoval;if(!bypass||!workshop)return;
    const workshopField=workshop.closest('.field')||workshop.parentElement;
    const workshopReason=form.elements.workshopReason,reasonContainer=workshopReason?.closest('.v205-conditional')||workshopReason?.closest('.field');
    const sync=()=>{const show=norm(bypass.value)==='sim';workshopField?.classList.toggle('hidden',!show);workshop.disabled=!show;workshop.required=show;if(!show){workshop.value='';if(workshopReason){workshopReason.value='';workshopReason.disabled=true;workshopReason.required=false}reasonContainer?.classList.add('hidden')}};
    bypass.addEventListener('change',sync);sync();
  }

  async function enhanceActivityAfterRender(){
    const form=document.getElementById('v205-form'),asset=state.v205Asset;if(!form||!asset)return;
    installActivitySelector(form,asset);installTeamSelector(form);installBypassDependency(form);
    const card=document.querySelector('.v206-asset-summary-card');if(card&&!card.dataset.v207){
      card.dataset.v207='1';const photo=card.querySelector('.v206-asset-photo');if(photo){photo.classList.add('v207-photo-box');photo.insertAdjacentHTML('beforeend','<div class="v207-photo-actions"><button type="button" data-photo-camera>Tirar foto</button><button type="button" data-photo-gallery>Galeria</button></div>');photo.querySelector('[data-photo-camera]').onclick=e=>{e.stopPropagation();chooseAssetPhoto(asset,true)};photo.querySelector('[data-photo-gallery]').onclick=e=>{e.stopPropagation();chooseAssetPhoto(asset,false)}}
    }
    const side=document.querySelector('.v206-activity-side');if(side){const folderBtn=side.querySelector('[data-v206-side-tab="folder"]');if(folderBtn&&!folderBtn.dataset.v207){folderBtn.dataset.v207='1';folderBtn.addEventListener('click',()=>renderFolderPane(side,asset))}}
  }

  /* ---------- Ativos: seletor de frente no padrão visual do sistema ---------- */
  function styleOperationsFrontSelector(){
    if(state?.screen!=='integration'||state.assetOperationFront)return;
    const grid=main.querySelector('.v205-ops-fronts');if(!grid||grid.dataset.v207)return;grid.dataset.v207='1';grid.classList.add('business-front-grid','v207-ops-front-grid');
    const meta={substation:['settings','Subestação','Integração e substituição de ativos de subestação.'],distribution:['tool','Distribuição','Religadores, reguladores e comissionamento.'],telecom:['wifi','Telecom','Equipamentos, sites e instalações de Telecom.']};
    grid.querySelectorAll('[data-v205-op-front]').forEach(b=>{const m=meta[b.dataset.v205OpFront];if(!m)return;b.className='business-front-card';b.innerHTML=`<span class="business-front-icon" data-icon="${m[0]}"></span><h2>${m[1]}</h2><p>${m[2]}</p><span class="business-front-state"><span data-icon="check"></span>Disponível</span>`});hydrateIcons?.(grid);
  }

  /* ---------- Banco de Dados: apenas 3 frentes ---------- */
  function classifyTelecomAsset(asset){
    if(['radio_voice_vhf','radio_data_uhf','radio_microwave','router','claroty'].includes(asset.family_code))return 'redes e comunicacao';
    if(['converter_125_12','converter_125_12_detailed','converter_125_48'].includes(asset.family_code))return 'retificadores';
    return 'outros eletronicos';
  }
  function findTreeType(category,label){
    const target=norm(label);return [...category.querySelectorAll('.tree-type')].find(x=>norm(x.querySelector('summary')?.textContent).includes(target))||null;
  }
  function integrateTelecomIntoSubstationTree(){
    if(state?.screen!=='database'||state.databaseFront!=='substation'||!state.databaseSubId)return;
    main.querySelector('.v206-communication-category')?.remove();
    const site=telSites().find(s=>safe(s.substation_code)===safe(state.databaseSubId));if(!site)return;
    const children=telChildren(site.id);if(!children.length)return;
    const electronic=[...main.querySelectorAll('.tree-category')].find(x=>norm(x.querySelector('summary')?.textContent).includes('eletronicos'));if(!electronic)return;
    for(const asset of children){
      const key=classifyTelecomAsset(asset);let type=findTreeType(electronic,key);
      if(!type)type=findTreeType(electronic,'outros eletronicos');
      if(!type)continue;
      let host=type.querySelector('.v207-telecom-tree-assets');if(!host){host=document.createElement('div');host.className='v207-telecom-tree-assets';type.appendChild(host)}
      if(host.querySelector(`[data-v207-sub-asset="${CSS.escape(asset.id)}"]`))continue;
      const b=document.createElement('button');b.type='button';b.className='v207-substation-telecom-leaf';b.dataset.v207SubAsset=asset.id;b.innerHTML=`<strong>${esc(familyLabel(asset.family_code))}</strong><span>${esc([asset.manufacturer,asset.model].filter(Boolean).join(' · '))}</span>`;b.onclick=()=>openV207AssetDetails(asset);host.appendChild(b);
    }
  }
  function cleanDatabaseTabs(){
    if(state?.screen!=='database')return;
    const all=main.querySelector('[data-db-front="all"]');all?.remove();
    if(state.databaseFront==='all'||!state.databaseFront){state.databaseFront='substation';setTimeout(()=>renderDatabase(),0);return}
    if(state.databaseFront==='telecom'){
      main.querySelector('[data-db-tel="substation"]')?.remove();state.databaseTelecomType='repeater';
      const familyTabs=main.querySelector('.v205-family-tabs');if(familyTabs&&!familyTabs.dataset.v207Clean){familyTabs.dataset.v207Clean='1';const rep=familyTabs.querySelector('[data-db-tel="repeater"]');if(rep){rep.classList.add('active');rep.textContent=`Repetidoras ${repeaters().length}`}}
    }
    integrateTelecomIntoSubstationTree();
  }

  /* ---------- Repetidoras: ficha de ativo, sem árvore ---------- */
  function repeaterLinks(rep){
    const rname=norm(rep.display_name);return relays().filter(a=>a.linked_repeater_id===rep.id||norm(a.data?.repeater_name)===rname).sort((a,b)=>safe(a.operating_code).localeCompare(safe(b.operating_code),'pt-BR',{numeric:true}));
  }
  async function openV207RepeaterDetails(rep){
    const root=document.getElementById('modal-root');if(!root||!rep)return;
    const photo=await localAssetPhoto(rep.id),links=repeaterLinks(rep);
    const rows=[
      ['Cidade',rep.data?.city],['Regional',rep.region],['CPS',rep.data?.cps],['Tipo de estrutura',rep.data?.structure_type],['Fabricante da estrutura',rep.data?.structure_manufacturer],
      ['Altura',rep.data?.structure_height_m?`${rep.data.structure_height_m} m`:''],['AEV torre',rep.data?.aev_tower],['AEV instalado',rep.data?.aev_installed],
      ['Meio principal',rep.data?.primary_comm_medium],['Rede principal',rep.data?.primary_network_type],['Meio redundante',rep.data?.redundant_comm_medium],
      ['Modelo XPS',rep.data?.xps_model],['IP XPS',rep.data?.xps_ip],['Bancos 48 V',rep.data?.battery_48v_banks],['Tipo de bateria',rep.data?.battery_type],
      ['Fabricante bateria',rep.data?.battery_manufacturer],['Ar-condicionado',rep.data?.ac_quantity],['Câmeras',rep.data?.camera_bullet_quantity],
      ['Acesso seco',rep.data?.road_dry],['Acesso chuva',rep.data?.road_rain],['Chave/acesso',rep.data?.site_key_type]
    ].filter(([,v])=>v!==null&&v!==undefined&&safe(v).trim()&&v!=='-');
    root.innerHTML=`<div class="modal" id="v207-repeater-modal"><div class="modal-card report-modal-card v207-repeater-detail"><button class="modal-close" id="v207-close-repeater"><span data-icon="x"></span></button><div class="report-header"><div><span class="status-pill imported">Repetidora</span><h2>${esc(rep.display_name)}</h2><p class="muted">${esc([rep.data?.city,rep.region].filter(Boolean).join(' — '))}</p></div></div><div class="asset-modal-profile"><div class="v207-repeater-photo"><div class="asset-modal-photo">${photo?`<img src="${blobUrl(photo)}" alt="Foto da repetidora">`:'<span data-icon="wifi"></span>'}</div><div class="v207-photo-actions"><button class="btn secondary" data-rep-camera>Tirar foto</button><button class="btn secondary" data-rep-gallery>Galeria</button></div></div><div class="asset-edit-form"><div class="asset-edit-grid">${rows.map(([k,v])=>`<div class="asset-edit-field"><label>${esc(k)}</label><input readonly value="${esc(v)}"></div>`).join('')}</div></div></div>${links.length?`<div class="detail-block"><h3>Religadores conectados <span class="muted">${links.length}</span></h3><div class="v207-linked-relays">${links.map(a=>`<button type="button" data-v207-linked-relay="${esc(a.id)}"><strong>${esc(a.operating_code||a.display_name)}</strong><span>${esc([a.substation_code,a.feeder,a.data?.radio_ip,a.data?.relay_ip].filter(Boolean).join(' · '))}</span></button>`).join('')}</div></div>`:''}</div></div>`;
    root.querySelector('#v207-close-repeater').onclick=()=>root.innerHTML='';
    root.querySelector('[data-rep-camera]')?.addEventListener('click',()=>chooseAssetPhoto(rep,true));root.querySelector('[data-rep-gallery]')?.addEventListener('click',()=>chooseAssetPhoto(rep,false));
    root.querySelectorAll('[data-v207-linked-relay]').forEach(b=>b.onclick=()=>openV207AssetDetails(assetById(b.dataset.v207LinkedRelay)));hydrateIcons?.(root);
  }
  function renderRepeaterList(){
    if(state?.screen!=='database'||state.databaseFront!=='telecom')return;
    const host=document.getElementById('v205-db-tel-results'),search=document.getElementById('v205-db-tel-search');if(!host||!search||host.querySelector('.v207-repeater-list'))return;
    const draw=()=>{const q=norm(search.value),rows=repeaters().filter(r=>!q||norm([r.display_name,r.data?.city,r.region].join(' ')).includes(q));host.innerHTML=`<div class="v206-repeater-picker v207-repeater-list">${rows.map(r=>`<button type="button" data-v207-repeater="${esc(r.id)}"><strong>${esc(r.display_name)}</strong><span>${esc([r.data?.city,r.region].filter(Boolean).join(' · '))}</span></button>`).join('')||'<div class="empty">Nenhuma repetidora encontrada.</div>'}</div>`;host.querySelectorAll('[data-v207-repeater]').forEach(b=>b.onclick=()=>openV207RepeaterDetails(assetById(b.dataset.v207Repeater)))};
    search.oninput=draw;draw();
  }

  /* ---------- Ficha padrão para Distribuição/Telecom ---------- */
  async function openV207AssetDetails(asset){
    if(!asset)return;const root=document.getElementById('modal-root');if(!root)return;
    if(asset.family_code==='repeater')return openV207RepeaterDetails(asset);
    const photo=await localAssetPhoto(asset.id);const rows=[
      ['Família',familyLabel(asset.family_code)],['Código operativo',asset.operating_code],['Status',asset.status],['Região',asset.region],['Subestação',asset.substation_code],
      ['Alimentador',asset.feeder],['Localização',asset.location_name],['Fabricante',asset.manufacturer],['Modelo',asset.model],['Número de série',asset.serial_number]
    ];
    for(const [k,v] of Object.entries(asset.data||{})){if(v===null||v===undefined||v===''||v==='-'||typeof v==='object')continue;rows.push([k.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()),v])}
    const seen=new Set(),clean=rows.filter(([k,v])=>v!==null&&v!==undefined&&safe(v).trim()&&v!=='-'&&!seen.has(`${k}|${v}`)&&seen.add(`${k}|${v}`));
    const canRoute=asset.family_code==='distribution_recloser'&&asset.latitude!=null&&asset.longitude!=null;
    root.innerHTML=`<div class="modal" id="v207-asset-modal"><div class="modal-card report-modal-card v207-asset-detail"><button class="modal-close" id="v207-close-asset"><span data-icon="x"></span></button><div class="report-header"><div><span class="status-pill imported">${esc(familyLabel(asset.family_code))}</span><h2>${esc(asset.operating_code||asset.display_name)}</h2><p class="muted">${esc([asset.substation_code,asset.location_name].filter(Boolean).join(' — '))}</p></div>${canRoute?'<button class="btn primary v207-route" id="v207-route">Traçar rota</button>':''}</div><div class="asset-modal-profile"><div class="v207-repeater-photo"><div class="asset-modal-photo">${photo?`<img src="${blobUrl(photo)}" alt="Foto do ativo">`:'<span data-icon="settings"></span>'}</div><div class="v207-photo-actions"><button class="btn secondary" data-asset-camera>Tirar foto</button><button class="btn secondary" data-asset-gallery>Galeria</button></div></div><div class="asset-edit-form"><div class="asset-edit-grid">${clean.map(([k,v])=>`<div class="asset-edit-field"><label>${esc(k)}</label><input readonly value="${esc(v)}"></div>`).join('')}</div></div></div></div></div>`;
    root.querySelector('#v207-close-asset').onclick=()=>root.innerHTML='';root.querySelector('[data-asset-camera]')?.addEventListener('click',()=>chooseAssetPhoto(asset,true));root.querySelector('[data-asset-gallery]')?.addEventListener('click',()=>chooseAssetPhoto(asset,false));
    root.querySelector('#v207-route')?.addEventListener('click',async()=>{if(!navigator.onLine)return toast?.('Rota disponível quando houver conexão.','notice');let origin='';try{const g=typeof getCurrentCoordinates==='function'?await getCurrentCoordinates():null;if(g)origin=`&origin=${encodeURIComponent(`${g.latitude},${g.longitude}`)}`}catch(_){}window.open(`https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(`${asset.latitude},${asset.longitude}`)}&travelmode=driving`,'_blank','noopener')});hydrateIcons?.(root);
  }

  /* ---------- Relatórios legados: datas legíveis, sem duplicação ---------- */
  function excelSerialToDate(n){const base=Date.UTC(1899,11,30),ms=base+Number(n)*86400000;return new Date(ms)}
  function legacyValue(label,value){
    const l=norm(label);if(typeof value==='number'){
      if(l.includes('DATA')){const d=excelSerialToDate(value);return d.toLocaleDateString('pt-BR')}
      if(l.includes('HORA')||l.includes('INICIO')||l.includes('CONCLUSAO')||l.includes('FIM')){
        if(value<1){const total=Math.round(value*24*60),h=Math.floor(total/60)%24,m=total%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
        const d=excelSerialToDate(value);return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`
      }
    }return Array.isArray(value)?value.join(', '):safe(value)
  }
  function openV207HistoryReport(report){
    const row=report.raw||{},p=row.payload||{},root=document.getElementById('modal-root');if(!root)return;
    const summary=row.summary||report.summary||'';
    const skip=/^(id|email|__v207_|nome$|selecione o tipo de manuten|data do atendimento|data inicial|data final|ordem de servi|hora de início|hora de conclus|insira o nome da equipe|nome do equipamento)/i;
    const entries=Object.entries(p).filter(([k,v])=>v!==null&&v!==undefined&&safe(v).trim()&&safe(v)!=='-'&&!skip.test(k)&&legacyValue(k,v)!==summary);
    const loc=p.__v207_location_name||row.operating_code||'Atendimento histórico',locType=p.__v207_location_type||'Ativo';
    const started=p.__v207_form_started_at,completed=p.__v207_form_completed_at;
    root.innerHTML=`<div class="modal" id="v207-history-modal"><div class="modal-card report-modal-card v207-history-modal"><button class="modal-close" id="v207-history-close"><span data-icon="x"></span></button><div class="report-header"><div><span class="status-pill imported">Histórico importado</span><h2>${esc(loc)}</h2><p class="muted">${esc([row.maintenance_type,row.work_order,row.team].filter(Boolean).join(' · '))}</p></div></div><div class="detail-block"><h3>Atendimento</h3><div class="v207-report-grid"><div><b>Data</b><span>${typeof formatDate==='function'?formatDate(row.occurred_on):esc(row.occurred_on)}</span></div><div><b>Local</b><span>${esc(locType)} · ${esc(loc)}</span></div>${row.work_order?`<div><b>Ordem de serviço</b><span>${esc(row.work_order)}</span></div>`:''}${row.team?`<div><b>Equipe / responsável</b><span>${esc(row.team)}</span></div>`:''}${started?`<div><b>Formulário iniciado</b><span>${esc(started)}</span></div>`:''}${completed?`<div><b>Formulário concluído</b><span>${esc(completed)}</span></div>`:''}</div></div>${summary?`<div class="detail-block"><h3>Atividade executada</h3><p>${esc(summary)}</p></div>`:''}${entries.length?`<div class="detail-block"><h3>Dados técnicos registrados</h3><div class="v207-report-grid">${entries.map(([k,v])=>`<div><b>${esc(k)}</b><span>${esc(legacyValue(k,v))}</span></div>`).join('')}</div></div>`:''}</div></div>`;
    root.querySelector('#v207-history-close').onclick=()=>root.innerHTML='';hydrateIcons?.(root);
  }
  document.addEventListener('click',e=>{
    const row=e.target.closest('[data-v206-report-key]');if(row){const report=(state.reports||[]).find(r=>r.key===row.dataset.v206ReportKey);if(report?.source==='imported-front'){e.preventDefault();e.stopImmediatePropagation();openV207HistoryReport(report);return}}
    const a=e.target.closest('[data-v205-db-asset],[data-v205-db-tel-asset],[data-repeater-relay],[data-v206-relay],[data-v206-sub-comm],[data-v206-db-front-asset],[data-v207-sub-asset]');
    if(a){const id=a.dataset.v205DbAsset||a.dataset.v205DbTelAsset||a.dataset.repeaterRelay||a.dataset.v206Relay||a.dataset.v206SubComm||a.dataset.v206DbFrontAsset||a.dataset.v207SubAsset,asset=assetById(id);if(asset){e.preventDefault();e.stopImmediatePropagation();openV207AssetDetails(asset)}}
  },true);

  /* Relatórios aguardam o histórico Telecom antes de montar os contadores. */
  if(typeof renderOverview==='function'){const baseOverview=renderOverview;renderOverview=async function(){await loadTelecomHistory();return baseOverview()}}

  function enhanceAll(){
    applyVersionChrome();bindLoginUX();autoEnterActivityChoice();enhanceActivityAfterRender();styleOperationsFrontSelector();cleanDatabaseTabs();renderRepeaterList();
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(enhanceAll));
  if(main)observer.observe(main,{childList:true,subtree:true});
  loadTelecomHistory().then(()=>requestAnimationFrame(enhanceAll));
  requestAnimationFrame(enhanceAll);
})();
