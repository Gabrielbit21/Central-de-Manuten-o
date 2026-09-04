const DATA={substations:[],equipment:{},histories:{},maintenanceTypes:['Manutenção corretiva','Manutenção preventiva','Apoio em serviço de subestação'],meta:{source:'Supabase',version:'1.9.6'}};
const APP_VERSION='1.9.6';
const PREVENTIVE_PLAN_SEED=[];
const main=document.getElementById('main');
const state={screen:'home',role:localStorage.getItem('central_manutencao_role')||'admin',sub:null,selected:new Set(),pendingPhotos:[],tab:'history',folderAsset:null,reports:[],maintenanceQueue:[],queueIndex:0,queueCompleted:0,batchId:null,activeDraftId:null,activeReportNumber:null,editingRecordId:null,editingOriginal:null,reviewPayload:null,autoSaveTimer:null,syncing:false,cloudReports:[],cloudProfile:null,cloudUser:null,offlineSession:false,cloudReady:false,preventivePlan:[],preventivePlanSource:'cloud',profileDirectory:[],preventivePlanView:localStorage.getItem('central_plan_view')||'table',preventivePlanMonth:Number(localStorage.getItem('central_plan_month'))||0};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const TABLER_ICON_PATHS={
  home:'<path d="M3 11l9 -8l9 8"/><path d="M5 10v10h14v-10"/><path d="M9 20v-6h6v6"/>',
  tool:'<path d="M15 5l4 4"/><path d="M14 6l-9 9"/><path d="M4 20l4 -1l9 -9"/><path d="M16 8l-2 -2"/><path d="M6 18l-2 2"/>',
  exchange:'<path d="M7 10h14l-4 -4"/><path d="M17 14h-14l4 4"/>',
  menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  clipboard:'<path d="M9 5h6"/><path d="M9 3h6a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h2v-1a2 2 0 0 1 2 -2z"/><path d="M9 12h6"/><path d="M9 16h6"/>',
  database:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8 -1.3 8 -3v-6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8 -1.3 8 -3v-6"/>',
  logout:'<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2"/><path d="M9 12h12l-3 -3"/><path d="M18 15l3 -3"/>',
  eye:'<path d="M3 12s3 -7 9 -7s9 7 9 7s-3 7 -9 7s-9 -7 -9 -7"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':'<path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"/><path d="M9.9 4.2a9.1 9.1 0 0 1 2.1 -.2c6 0 9 7 9 7a13.8 13.8 0 0 1 -1.7 2.7"/><path d="M6.6 6.6c-2.4 1.7 -3.6 4.4 -3.6 4.4s3 7 9 7a8.7 8.7 0 0 0 5.4 -1.8"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5 -3.5"/>',
  check:'<path d="M5 12l5 5l9 -9"/>',
  x:'<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  'chevron-down':'<path d="M6 9l6 6l6 -6"/>',
  'chevron-right':'<path d="M9 6l6 6l-6 6"/>',
  'chevron-left':'<path d="M15 6l-6 6l6 6"/>',
  'arrow-right':'<path d="M5 12h14"/><path d="M13 6l6 6l-6 6"/>',
  'arrow-left':'<path d="M19 12h-14"/><path d="M11 6l-6 6l6 6"/>',
  camera:'<path d="M5 7h2l1.5 -2h7l1.5 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><circle cx="12" cy="13" r="3"/>',
  'zoom-in':'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5 -3.5"/><path d="M11 8v6"/><path d="M8 11h6"/>',
  'zoom-out':'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5 -3.5"/><path d="M8 11h6"/>',
  download:'<path d="M12 3v12"/><path d="M7 10l5 5l5 -5"/><path d="M5 21h14"/>',
  upload:'<path d="M12 21v-12"/><path d="M7 14l5 -5l5 5"/><path d="M5 3h14"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11v-4a4 4 0 0 1 8 0v4"/>',
  'lock-open':'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11v-4a4 4 0 0 1 7.6 -1.7"/>',
  edit:'<path d="M7 7h-2a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-2"/><path d="M9 15l-1 4l4 -1l8.5 -8.5a2.1 2.1 0 0 0 -3 -3z"/><path d="M16 7l3 3"/>',
  refresh:'<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -5v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 5v-5h-5"/>',
  trash:'<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 14h12l1 -14"/><path d="M9 7v-3h6v3"/>',
  photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5 -5l-8 8"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>',
  wifi:'<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/>',
  'wifi-off':'<path d="M3 3l18 18"/><path d="M5 12.5a10 10 0 0 1 4.5 -2.6"/><path d="M14.5 10a10 10 0 0 1 4.5 2.5"/><path d="M8.5 16a5 5 0 0 1 3.5 -1.5"/><circle cx="12" cy="20" r="1"/>',
  'file-spreadsheet':'<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M11 11v8"/>',
  calendar:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 4v16"/>',
  grid:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  filter:'<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  cloud:'<path d="M6.5 19h11a4.5 4.5 0 0 0 .5 -9a6 6 0 0 0 -11.4 -2a5 5 0 0 0 -.1 11"/>',
  bell:'<path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3l2 2h-16l2 -2v-3a7 7 0 0 1 4 -6"/><path d="M9 21h6"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1 .1l-2.8 2.8l-.1 -.1a1.7 1.7 0 0 0 -1.9 -.3a1.7 1.7 0 0 0 -1 1.6v.2h-4v-.2a1.7 1.7 0 0 0 -1 -1.6a1.7 1.7 0 0 0 -1.9 .3l-.1 .1l-2.8 -2.8l.1 -.1a1.7 1.7 0 0 0 .3 -1.9a1.7 1.7 0 0 0 -1.6 -1h-.2v-4h.2a1.7 1.7 0 0 0 1.6 -1a1.7 1.7 0 0 0 -.3 -1.9l-.1 -.1l2.8 -2.8l.1 .1a1.7 1.7 0 0 0 1.9 .3a1.7 1.7 0 0 0 1 -1.6v-.2h4v.2a1.7 1.7 0 0 0 1 1.6a1.7 1.7 0 0 0 1.9 -.3l.1 -.1l2.8 2.8l-.1 .1a1.7 1.7 0 0 0 -.3 1.9a1.7 1.7 0 0 0 1.6 1h.2v4h-.2a1.7 1.7 0 0 0 -1.6 1z"/>',
  'arrow-up':'<path d="M12 19v-14"/><path d="M6 11l6 -6l6 6"/>',
  'arrow-down':'<path d="M12 5v14"/><path d="M18 13l-6 6l-6 -6"/>',
  'arrows-sort':'<path d="M8 9l4 -4l4 4"/><path d="M16 15l-4 4l-4 -4"/>'
};
function icon(name,className=''){const paths=TABLER_ICON_PATHS[name]||TABLER_ICON_PATHS.settings;return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`}
function setIconOnly(el,name){if(!el)return;el.classList.add('icon-only');el.innerHTML=icon(name);el.dataset.iconApplied=name}
function prependIcon(el,name){if(!el||el.querySelector(':scope > .ui-icon'))return;el.classList.add('icon-with-label');el.insertAdjacentHTML('afterbegin',icon(name))}
function hydrateIcons(root=document){
  root.querySelectorAll('[data-icon]').forEach(el=>{const name=el.dataset.icon;if(el.dataset.iconApplied===name)return;el.innerHTML=icon(name);el.dataset.iconApplied=name});
  root.querySelectorAll('.search:not(.icon-enhanced)').forEach(el=>{el.insertAdjacentHTML('afterbegin',`<span class="search-ui-icon">${icon('search')}</span>`);el.classList.add('icon-enhanced')});
  root.querySelectorAll('.review-card:not(.icon-enhanced)').forEach(el=>{el.insertAdjacentHTML('afterbegin',`<span class="review-ui-icon">${icon('check')}</span>`);el.classList.add('icon-enhanced')});
  root.querySelectorAll('.tree-category>summary:not(.icon-enhanced),.tree-type>summary:not(.icon-enhanced)').forEach(el=>{el.insertAdjacentHTML('afterbegin',`<span class="tree-chevron">${icon('chevron-right')}</span>`);el.classList.add('icon-enhanced')});
  root.querySelectorAll('.modal-close').forEach(el=>setIconOnly(el,'x'));
  setIconOnly(root.querySelector?.('#logout-button'),'logout');
  root.querySelectorAll('.password-toggle').forEach(el=>{const input=document.getElementById(el.dataset.togglePassword);setIconOnly(el,input?.type==='text'?'eye-off':'eye')});
  setIconOnly(root.querySelector?.('#viewer-prev'),'chevron-left');setIconOnly(root.querySelector?.('#viewer-next'),'chevron-right');setIconOnly(root.querySelector?.('#viewer-minus'),'zoom-out');setIconOnly(root.querySelector?.('#viewer-plus'),'zoom-in');setIconOnly(root.querySelector?.('#viewer-close'),'x');
  const download=root.querySelector?.('#viewer-download');if(download)prependIcon(download,'download');
  root.querySelectorAll('.asset-lock-button').forEach(el=>setIconOnly(el,el.classList.contains('unlocked')?'lock-open':'lock'));
  const actionIcons=[['#approve-report','check'],['#reject-report','x'],['#edit-report','edit'],['#retry-sync','upload'],['#save-asset-edit','check'],['#cancel-asset-edit','x'],['#choose-profile-photo','camera'],['#remove-profile-photo','trash'],['#purge-test-operations','trash'],['#export-assets-template','download'],['#select-import-file','upload'],['#open-bulk-update','file-spreadsheet'],['#confirm-bulk-import','check'],['#clear-import-preview','x'],['#confirm-operation','check'],['#edit-operation','edit']];
  actionIcons.forEach(([sel,name])=>root.querySelectorAll(sel).forEach(el=>prependIcon(el,name)));
}
const iconObserver=new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(node=>{if(node.nodeType===1)hydrateIcons(node)})));
hydrateIcons(document);iconObserver.observe(document.body,{childList:true,subtree:true});


const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const titleCaseWord=w=>String(w||'').toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/giu,(m,p1,p2)=>p1+p2.toUpperCase());
function canonicalTeamName(name){
  const raw=String(name??'').replace(/\s+/g,' ').trim();
  if(!raw)return '';
  const parts=raw
    .replace(/\s*\/\s*/g,' / ')
    .replace(/\s+-\s+/g,' / ')
    .replace(/\s+e\s+/gi,' / ')
    .split('/')
    .map(v=>titleCaseWord(v.trim()))
    .filter(Boolean);
  if(!parts.length)return titleCaseWord(raw);
  const unique=[];
  const seen=new Set();
  parts.forEach(part=>{const key=normalize(part);if(key&&!seen.has(key)){seen.add(key);unique.push(part)}});
  unique.sort((a,b)=>normalize(a).localeCompare(normalize(b),'pt-BR'));
  return unique.join(' / ');
}

const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const stepLabels=['Subestação','Equipamentos','Confirmação','Formulário','Revisão'];
function steps(active){return `<div class="steps">${stepLabels.map((x,i)=>`${i?'<span class="step-line"></span>':''}<span class="step ${i<active?'done':i===active?'active':''}"><b>${i+1}</b>${x}</span>`).join('')}</div>`}
function toast(text,type='success'){
  if(!text)return;

  const validTypes=['success','warning','error','info'];
  const kind=validTypes.includes(type)?type:'info';

  let stack=document.getElementById('central-toast-stack');

  if(!stack){
    stack=document.createElement('div');
    stack.id='central-toast-stack';
    stack.setAttribute('aria-live','polite');
    stack.setAttribute('aria-atomic','false');
    document.body.appendChild(stack);
  }

  const item=document.createElement('div');
  item.className=`central-toast central-toast--${kind}`;
  item.setAttribute('role',kind==='error'?'alert':'status');

  item.innerHTML=`
    <span class="central-toast-indicator"></span>
    <span class="central-toast-text">${esc(text)}</span>
  `;

  stack.appendChild(item);

  requestAnimationFrame(()=>{
    item.classList.add('show');
  });

  const remove=()=>{
    item.classList.remove('show');
    setTimeout(()=>{
      item.remove();
      if(stack&&!stack.children.length)stack.remove();
    },180);
  };

  setTimeout(remove,3800);
}

// IndexedDB: fotos de perfil, registros, fotos de manutenção e rascunhos.
let dbPromise;
function db(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('central_manutencao_db',6);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('assetPhotos'))d.createObjectStore('assetPhotos',{keyPath:'assetId'});if(!d.objectStoreNames.contains('maintenanceRecords'))d.createObjectStore('maintenanceRecords',{keyPath:'id'});if(!d.objectStoreNames.contains('maintenancePhotos')){const s=d.createObjectStore('maintenancePhotos',{keyPath:'id'});s.createIndex('assetId','assetId');s.createIndex('maintenanceId','maintenanceId')}if(!d.objectStoreNames.contains('drafts'))d.createObjectStore('drafts',{keyPath:'id'});if(!d.objectStoreNames.contains('auditLogs')){const a=d.createObjectStore('auditLogs',{keyPath:'id'});a.createIndex('recordId','recordId');a.createIndex('createdAt','createdAt')}if(!d.objectStoreNames.contains('syncQueue')){const q=d.createObjectStore('syncQueue',{keyPath:'id'});q.createIndex('recordId','recordId');q.createIndex('status','status');q.createIndex('createdAt','createdAt')}if(!d.objectStoreNames.contains('appSettings'))d.createObjectStore('appSettings',{keyPath:'key'});if(!d.objectStoreNames.contains('cloudCache'))d.createObjectStore('cloudCache',{keyPath:'key'});if(!d.objectStoreNames.contains('assetOperations')){const o=d.createObjectStore('assetOperations',{keyPath:'id'});o.createIndex('status','status');o.createIndex('createdAt','createdAt');o.createIndex('isTest','isTest')}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return dbPromise}
async function idbPut(store,val){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).put(val);tx.oncomplete=()=>res(val);tx.onerror=()=>rej(tx.error)})}
async function idbGet(store,key){const d=await db();return new Promise((res,rej)=>{const r=d.transaction(store).objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbDelete(store,key){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function idbByIndex(store,index,key){const d=await db();return new Promise((res,rej)=>{const r=d.transaction(store).objectStore(store).index(index).getAll(key);r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function idbAll(store){const d=await db();return new Promise((res,rej)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function compressImage(file,max=1500,quality=.82){const bmp=await createImageBitmap(file);const scale=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);return await new Promise(res=>c.toBlob(res,'image/jpeg',quality))}
function blobUrl(blob){return blob?URL.createObjectURL(blob):''}
async function photoForAsset(assetId){return (await idbGet('assetPhotos',assetId))?.blob||null}
async function setAssetPhoto(assetId,file){const blob=await compressImage(file,1000,.82);await idbPut('assetPhotos',{assetId,blob,updatedAt:new Date().toISOString()});return blob}
function currentSub(){return DATA.substations.find(s=>s.id===state.sub)}
function allEquipment(){const e=DATA.equipment[state.sub]||{eletronicos:[],reles:[],patio:[]};return [...e.eletronicos,...e.reles,...e.patio]}
function selectedEquipment(){return allEquipment().filter(e=>state.selected.has(e.id))}
function initializeMaintenanceQueue(){state.maintenanceQueue=selectedEquipment().map(e=>e.id);state.queueIndex=0;state.queueCompleted=0;state.batchId=uid();state.pendingPhotos=[]}
function queueAssets(){const map=new Map(allEquipment().map(e=>[e.id,e]));return state.maintenanceQueue.map(id=>map.get(id)).filter(Boolean)}
function currentFormAssets(){const queued=queueAssets();if(!queued.length)return selectedEquipment().slice(0,1);const current=queued[state.queueIndex];return current?[current]:[]}
function hasNextQueuedAsset(){return state.queueIndex<state.maintenanceQueue.length-1}
function assetName(e){return e.tipo||e.label||'Ativo'}
function assetCircuit(e){return String(e.circuito||'').trim()}
function assetTitle(e){return assetCircuit(e)?`${assetName(e)} — ${assetCircuit(e)}`:assetName(e)}
function assetProfileFrame(e,p){return `<div class="asset-profile-frame ${p?'has-photo':''}" data-asset-photo-frame="${e.id}">${p?`<img src="${blobUrl(p)}" alt="Foto de ${esc(assetName(e))}">`:'<div class="asset-profile-placeholder"><span data-icon="settings"></span><small>Sem imagem</small></div>'}<button type="button" class="asset-profile-action" data-profile-photo="${e.id}">${p?'Alterar imagem':'Adicionar imagem'}</button></div>`}


const ROLE_USERS={admin:{name:'Usuário Administrativo',initials:'AD',label:'Equipe Administrativa'},field:{name:'Usuário de Campo',initials:'EC',label:'Equipe de Campo'}};
function currentUser(){if(state.cloudProfile){const name=state.cloudProfile.display_name||state.cloudUser?.email||'Usuário';return {name,initials:name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'US',label:state.cloudProfile.role==='admin'?'Equipe Administrativa':'Equipe de Campo',id:state.cloudUser?.id,email:state.cloudUser?.email}}return ROLE_USERS[state.role]||ROLE_USERS.field}
function localOwnerId(value){return value?.usuario?.id||value?.user?.id||value?.authorId||value?.author_id||value?.ownerId||null}
function localOwnerEmail(value){return String(value?.usuario?.email||value?.user?.email||value?.authorEmail||'').trim().toLowerCase()}
function belongsToCurrentUser(value){
  const uid=state.cloudUser?.id;if(!uid)return false;
  const owner=localOwnerId(value);if(owner)return owner===uid;
  const email=localOwnerEmail(value),current=String(state.cloudUser?.email||'').trim().toLowerCase();
  return !!email&&!!current&&email===current;
}
async function currentUserLocalRecords(store){return (await idbAll(store)).filter(belongsToCurrentUser)}
function formatDate(value){if(!value)return 'Sem data';const text=String(value).trim();let match=text.match(/^(\d{4})-(\d{2})-(\d{2})/);if(match)return `${match[3]}-${match[2]}-${match[1]}`;match=text.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);if(match)return `${match[1]}-${match[2]}-${match[3]}`;const d=new Date(text);if(Number.isNaN(d.getTime()))return text;return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`}
function setActiveNav(target){document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===target))}
async function cachedUserAvatar(){if(!state.cloudUser)return null;const cached=await idbGet('appSettings',`user-avatar:${state.cloudUser.id}`);if(state.cloudProfile?.avatar_path&&navigator.onLine){const {data,error}=await cloudClient.storage.from('user-profile-photos').download(state.cloudProfile.avatar_path);if(!error&&data){await idbPut('appSettings',{key:`user-avatar:${state.cloudUser.id}`,blob:data,path:state.cloudProfile.avatar_path,updatedAt:new Date().toISOString()});return data}}return cached?.blob||null}
async function renderUserAvatarPhoto(){const avatar=document.getElementById('user-avatar');if(!avatar)return;const u=currentUser();avatar.innerHTML=`<span>${esc(u.initials)}</span>`;const blob=await cachedUserAvatar();if(blob)avatar.innerHTML=`<img src="${blobUrl(blob)}" alt="Foto de ${esc(u.name)}">`}
function updateRoleChrome(){const u=currentUser();document.body.classList.toggle('role-field',state.role==='field');const avatar=document.getElementById('user-avatar'),name=document.getElementById('user-name'),roleLabel=document.getElementById('user-role-label');if(avatar)avatar.innerHTML=`<span>${esc(u.initials)}</span>`;if(name)name.textContent=u.name;if(roleLabel)roleLabel.textContent=u.label;renderUserAvatarPhoto()}
function closeMoreMenu(){const toggle=document.getElementById('more-menu-toggle'),menu=document.getElementById('more-menu-dropdown');menu?.classList.add('hidden');toggle?.setAttribute('aria-expanded','false')}
function navigateTo(nav){closeMoreMenu();if(nav==='home')renderHome();else if(nav==='overview')renderOverview();else if(nav==='maintenance')renderSubstations();else if(nav==='integration')renderAssetOperationsHome();else if(nav==='plan')renderPreventivePlan();else if(nav==='database'){state.databaseSubId=null;state.databaseView='tree';renderDatabase()}}
function closeMobileMoreMenu(){document.getElementById('modal-root').innerHTML='';document.getElementById('mobile-more-menu')?.classList.remove('active')}
function openMobileMoreMenu(){const admin=state.role==='admin',moreButton=document.getElementById('mobile-more-menu');moreButton?.classList.add('active');document.getElementById('modal-root').innerHTML=`<div class="modal" id="mobile-more-modal"><div class="modal-card mobile-more-sheet"><h2>Mais opções</h2><div class="mobile-more-list">${admin?'<button data-mobile-nav="overview"><span data-icon="clipboard"></span>Relatórios</button><button data-mobile-nav="plan"><span data-icon="calendar"></span>PAM</button>':''}<button data-mobile-nav="database"><span data-icon="database"></span>Banco de Dados</button><button id="mobile-profile-photo"><span data-icon="user"></span>Meu perfil e notificações</button><button id="mobile-logout"><span data-icon="logout"></span>Sair deste dispositivo</button></div></div></div>`;document.getElementById('mobile-more-modal').onclick=e=>{if(e.target.id==='mobile-more-modal')closeMobileMoreMenu()};document.querySelectorAll('[data-mobile-nav]').forEach(b=>b.onclick=()=>{closeMobileMoreMenu();navigateTo(b.dataset.mobileNav)});document.getElementById('mobile-profile-photo').onclick=()=>{closeMobileMoreMenu();openMyProfileDialog()};document.getElementById('mobile-logout').onclick=()=>{closeMobileMoreMenu();logoutConnectedUser()}}
function bindNavigation(){document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigateTo(b.dataset.nav));document.getElementById('logout-button')?.addEventListener('click',logoutConnectedUser);document.getElementById('user-avatar')?.addEventListener('click',openMyProfileDialog);document.getElementById('mobile-more-menu')?.addEventListener('click',openMobileMoreMenu);const toggle=document.getElementById('more-menu-toggle'),menu=document.getElementById('more-menu-dropdown');toggle?.addEventListener('click',e=>{e.stopPropagation();const opening=menu.classList.contains('hidden');menu.classList.toggle('hidden',!opening);toggle.setAttribute('aria-expanded',String(opening))});document.addEventListener('click',e=>{if(!e.target.closest('#more-nav'))closeMoreMenu()});updateRoleChrome()}
function importedReports(){const out=[];for(const sub of DATA.substations){for(const r of (DATA.histories[sub.id]||[])){out.push({key:'imported:'+r.id,source:'imported',id:r.id,subId:sub.id,substation:sub.sigla+' — '+sub.nome,date:r.data||'',createdAt:r.data||'',author:r.equipe||'Equipe não informada',assets:[r.ativo||r.tipoEquipamento||'Ativo não informado'],type:r.tipoManutencao||'Atendimento',status:'importado',raw:r})}}return out}
async function updateConnectivityIndicator(){const indicator=document.getElementById('connection-indicator'),label=document.getElementById('connection-label'),badge=document.getElementById('pending-sync-badge');if(!indicator||!label||!badge)return;const online=navigator.onLine;indicator.classList.toggle('offline',!online);label.textContent=online?'Online':'Offline';const connectionIcon=document.getElementById('connection-state-icon');if(connectionIcon){connectionIcon.dataset.icon=online?'wifi':'wifi-off';connectionIcon.dataset.iconApplied='';hydrateIcons(connectionIcon.parentElement||document)};const records=await currentUserLocalRecords('maintenanceRecords');const pending=records.filter(r=>r.status==='aguardando_envio').length;badge.classList.toggle('hidden',pending===0);badge.textContent=pending===1?'1 aguardando envio':`${pending} aguardando envio`;indicator.title=online?(pending?`${pending} relatório(s) aguardando envio para a nuvem`:'Conexão disponível'):'Sem conexão — registros serão salvos localmente'}
function resetMaintenanceFlow(){state.maintenanceQueue=[];state.queueIndex=0;state.queueCompleted=0;state.batchId=null;state.pendingPhotos=[]}
async function combinedReports(){const local=await currentUserLocalRecords('maintenanceRecords');const locals=local.map(r=>{const form=r.form||{};const outcome=r.resultado||(normalize(form.inconclusivo)==='sim'?'inconclusivo':'concluido');return {key:'local:'+r.id,source:'local',id:r.id,subId:r.subestacao,substation:(DATA.substations.find(s=>s.id===r.subestacao)?.sigla||r.subestacao||'')+' — '+(DATA.substations.find(s=>s.id===r.subestacao)?.nome||''),date:form.data||r.criadoEm,createdAt:r.criadoEm,author:form.equipe||r.usuario?.name||'Equipe local',assets:(r.equipamentosSnapshot||[]).map(assetTitle),type:form.tipo||'Manutenção',status:r.status||'pendente_sincronizacao',outcome,raw:r}});return [...locals,...importedReports()].sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))}
async function openProfilePhotoDialog(){const u=currentUser(),blob=await cachedUserAvatar();document.getElementById('modal-root').innerHTML=`<div class="modal" id="profile-photo-modal"><div class="modal-card profile-photo-dialog"><button class="modal-close" id="close-profile-photo" type="button"><span data-icon="x"></span></button><h2>Foto do perfil</h2><p class="muted">A imagem ficará vinculada ao seu usuário e poderá ser alterada a qualquer momento.</p><div class="profile-photo-preview" id="profile-photo-preview">${blob?`<img src="${blobUrl(blob)}" alt="Foto atual">`:esc(u.initials)}</div><div class="profile-photo-actions"><button class="btn secondary" id="choose-profile-photo">${blob?'Alterar foto':'Adicionar foto'}</button>${blob?'<button class="btn ghost" id="remove-profile-photo">Remover foto</button>':''}<input class="hidden" id="profile-photo-input" type="file" accept="image/*"></div></div></div>`;const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-profile-photo').onclick=close;document.getElementById('profile-photo-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};const input=document.getElementById('profile-photo-input');document.getElementById('choose-profile-photo').onclick=()=>input.click();input.onchange=async()=>{const file=input.files?.[0];if(!file)return;if(!navigator.onLine)return toast('Conecte-se à internet para alterar a foto do perfil.','warning');try{const compressed=await compressImage(file,700,.85),path=`${state.cloudUser.id}/avatar.jpg`;const {error:uploadError}=await cloudClient.storage.from('user-profile-photos').upload(path,compressed,{contentType:'image/jpeg',upsert:true});if(uploadError)throw uploadError;const {error:rpcError}=await cloudClient.rpc('set_own_profile_avatar',{p_storage_path:path});if(rpcError)throw rpcError;state.cloudProfile.avatar_path=path;await idbPut('appSettings',{key:`user-avatar:${state.cloudUser.id}`,blob:compressed,path,updatedAt:new Date().toISOString()});storeIdentity(state.cloudUser,state.cloudProfile);close();updateRoleChrome();toast('Foto do perfil atualizada.')}catch(error){toast(error.message||String(error),'warning')}};document.getElementById('remove-profile-photo')?.addEventListener('click',async()=>{if(!navigator.onLine)return toast('Conecte-se à internet para remover a foto.','warning');try{const oldPath=state.cloudProfile?.avatar_path;if(oldPath)await cloudClient.storage.from('user-profile-photos').remove([oldPath]);const {error}=await cloudClient.rpc('set_own_profile_avatar',{p_storage_path:null});if(error)throw error;state.cloudProfile.avatar_path=null;await idbDelete('appSettings',`user-avatar:${state.cloudUser.id}`);storeIdentity(state.cloudUser,state.cloudProfile);close();updateRoleChrome();toast('Foto do perfil removida.')}catch(error){toast(error.message||String(error),'warning')}})}

async function renderHome(){state.screen='home';setActiveNav('home');updateRoleChrome();await updateConnectivityIndicator();const records=await currentUserLocalRecords('maintenanceRecords');const recent=records.sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0,3);const adminAction=state.role==='admin'?`<button class="home-action overview" data-home-action="overview"><span class="action-icon" data-icon="clipboard"></span><h3>Relatórios</h3><p>Caixa de entrada dos relatórios enviados pelas equipes, com acesso aos detalhes de cada atendimento.</p><span class="action-link">Abrir relatórios <span data-icon="arrow-right"></span></span></button><button class="home-action plan" data-home-action="plan"><span class="action-icon" data-icon="calendar"></span><h3>PAM</h3><p>Acompanhe competências, programação, execução e atrasos do plano de manutenção preventiva.</p><span class="action-link">Abrir PAM <span data-icon="arrow-right"></span></span></button>`:'';main.innerHTML=`<section class="home-hero"><article class="welcome-card"><h1>Olá, ${state.role==='admin'?'equipe administrativa':'equipe de campo'}.</h1><p>${state.role==='admin'?'Acompanhe os relatórios recebidos, inicie uma manutenção ou consulte o cadastro técnico dos ativos.':'Registre uma nova manutenção ou consulte rapidamente os ativos e subestações cadastrados.'}</p></article></section><section class="action-section"><h2>Acesso rápido</h2><div class="home-actions">${adminAction}<button class="home-action maintenance" data-home-action="maintenance"><span class="action-icon" data-icon="tool"></span><h3>Nova Manutenção</h3><p>Selecione a subestação e os ativos, consulte o histórico e registre todo o atendimento.</p><span class="action-link">Iniciar manutenção <span data-icon="arrow-right"></span></span></button><button class="home-action integration" data-home-action="integration"><span class="action-icon" data-icon="exchange"></span><h3>Integração / Substituição</h3><p>Cadastre um novo ativo ou registre a substituição de um equipamento existente.</p><span class="action-link">Abrir módulo <span data-icon="arrow-right"></span></span></button><button class="home-action database" data-home-action="database"><span class="action-icon" data-icon="database"></span><h3>Banco de Dados</h3><p>Consulte subestações, ativos, circuitos e informações cadastrais consolidadas.</p><span class="action-link">Consultar dados <span data-icon="arrow-right"></span></span></button></div></section>${recent.length?`<section class="recent-local"><div class="section-title"><h2 style="font-size:18px">Registros recentes neste dispositivo</h2></div><div class="recent-strip">${recent.map(r=>`<article class="recent-item"><b>${esc(r.form?.tipo||'Manutenção')} · ${esc(DATA.substations.find(s=>s.id===r.subestacao)?.sigla||r.subestacao)}</b><span>${formatDate(r.form?.data||r.criadoEm)} · ${(r.equipamentosSnapshot||[]).map(assetTitle).slice(0,2).map(esc).join(', ')||'Ativo não informado'}</span></article>`).join('')}</div></section>`:''}`;document.querySelectorAll('[data-home-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.homeAction;if(a==='overview')renderOverview();if(a==='plan')renderPreventivePlan();if(a==='maintenance'){resetMaintenanceFlow();renderSubstations()}if(a==='integration')renderAssetOperationsHome();if(a==='database'){state.databaseSubId=null;state.databaseView='tree';renderDatabase()}})}

const PLAN_MONTH_NAMES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function planMonthStart(value){
  if(!value)return null;
  const d=new Date(String(value).slice(0,10)+'T12:00:00');
  if(Number.isNaN(d.getTime()))return null;
  return new Date(d.getFullYear(),d.getMonth(),1);
}
function planCompetence(value){
  const d=planMonthStart(value);if(!d)return 'Sem competência';
  return `${PLAN_MONTH_NAMES[d.getMonth()]}/${d.getFullYear()}`;
}
function planComputedStatus(item,reference=new Date()){
  if(normalize(item.appStatus||item.app_status||'').includes('concluido'))return 'Concluído';
  const raw=normalize(item.status||item.source_status||'');
  if(raw.includes('concluido'))return 'Concluído';
  if(raw.includes('em execucao'))return 'Em execução';
  if(raw.includes('programado')&&!raw.includes('nao programado'))return 'Programado';
  if(raw.includes('reprogramar'))return 'A reprogramar';
  const planned=planMonthStart(item.planned||item.planned_for);
  if(planned){
    const current=new Date(reference.getFullYear(),reference.getMonth(),1);
    if(planned<current)return 'Atrasado';
  }
  return 'Não programado';
}
function planStatusClass(status){
  return {'Concluído':'done','Em execução':'running','Programado':'scheduled','A reprogramar':'replan','Atrasado':'overdue','Não programado':'pending'}[status]||'pending';
}
function cloudPlanItemToLocal(row){
  return {
    id:row.id,sourceRow:row.source_row,year:Number(String(row.planned_for||'').slice(0,4))||2026,
    group:row.item_group||'',region:row.region||'',sub:row.substation_ref||'',locality:row.locality||'',
    plant:row.plant_structure||'',sgd:row.sgd_key||'',planned:row.planned_for||'',
    service:row.service_description||'',qty:row.quantity,scheduled:row.source_execution_date||'',
    status:row.source_status||'',completed:row.completion_date||'',substationId:row.substation_id||'',
    assetId:row.asset_id||'',appStatus:row.app_status||'',appCompleted:row.app_completion_date||'',linkedReportId:row.linked_report_id||''
  };
}
async function loadPreventivePlanData({force=false}={}){
  if(!force&&state.preventivePlan?.length)return state.preventivePlan;
  if(cloudClient&&state.cloudUser&&navigator.onLine){
    try{
      const {data,error}=await cloudClient.from('maintenance_plan_items')
        .select('id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date,substation_id,asset_id,app_status,app_completion_date,linked_report_id')
        .order('source_row',{ascending:true});
      if(!error&&Array.isArray(data)&&data.length){
        state.preventivePlan=data.map(cloudPlanItemToLocal);
        state.preventivePlanSource='cloud';
        return state.preventivePlan;
      }
    }catch(_){}
  }
  state.preventivePlan=[];
  state.preventivePlanSource='cloud-unavailable';
  return state.preventivePlan;
}
function planDueForReference(item,reference=new Date()){
  const planned=planMonthStart(item.planned);if(!planned)return false;
  const ref=new Date(reference.getFullYear(),reference.getMonth(),1);
  return planned<=ref;
}
function planFormatSourceDate(value){
  if(!value)return '—';
  const d=new Date(String(value).slice(0,10)+'T12:00:00');
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleDateString('pt-BR');
}
function openPreventivePlanItem(id){
  const item=(state.preventivePlan||[]).find(x=>x.id===id);if(!item)return;
  const status=planComputedStatus(item);
  const fields=[
    ['Status calculado',status],['Status da fonte',item.status||'—'],['Mês',planCompetence(item.planned)],
    ['Data original planejada',planFormatSourceDate(item.planned)],['Regional',item.region||'—'],['Subestação / referência',item.sub||'—'],
    ['Localidade',item.locality||'—'],['Grupo',item.group||'—'],['Equipamento / estrutura',item.plant||'—'],
    ['Chave SGD',item.sgd||'—'],['Quantidade',item.qty??'—'],['Data informada em “Executado em”',planFormatSourceDate(item.scheduled)],
    ['Data conclusão da fonte',planFormatSourceDate(item.completed)],['Conclusão validada no aplicativo',item.appCompleted?planFormatSourceDate(item.appCompleted):'—'],['Linha de origem',item.sourceRow||'—']
  ];
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="plan-detail-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="close-plan-detail" type="button"><span data-icon="x"></span></button><div class="report-header"><div><span class="plan-status ${planStatusClass(status)}">${esc(status)}</span><h2>${esc(item.plant||item.group||'Atividade preventiva')}</h2><p class="muted">${esc(item.sub||item.locality||'PAM')}</p></div></div><div class="plan-detail-grid">${fields.map(([k,v])=>`<div class="plan-detail-box"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div><div class="detail-block"><h3>Serviço previsto</h3><p>${esc(item.service||'—')}</p></div><div class="plan-note">O PAM é acompanhado como uma camada própria, com visualizações em tabela, calendário mensal e visão anual. O vínculo com um ativo individual é opcional e só será forçado quando a correspondência for inequívoca. Preventivas aprovadas administrativamente podem concluir automaticamente a atividade correspondente do PAM. Em caso de ambiguidade, o vínculo fica reservado para conferência administrativa.</div></div></div>`;
  const close=()=>document.getElementById('modal-root').innerHTML='';
  document.getElementById('close-plan-detail').onclick=close;
  document.getElementById('plan-detail-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
}
async function renderPreventivePlan(){
  if(state.role!=='admin'){toast('O PAM é exclusivo da Equipe Administrativa.','warning');return renderHome()}
  state.screen='plan';setActiveNav('plan');
  const items=await loadPreventivePlanData();
  const years=[...new Set(items.map(x=>x.year).filter(Boolean))].sort((a,b)=>b-a);
  const now=new Date(),defaultYear=years.includes(now.getFullYear())?now.getFullYear():(years[0]||2026);
  let view=['table','calendar','year'].includes(state.preventivePlanView)?state.preventivePlanView:'table';
  let calendarMonth=state.preventivePlanMonth||((defaultYear===now.getFullYear())?now.getMonth()+1:1);
  const filterState={status:null,competence:null,sub:null,equipment:null,service:null,date:null};
  const sortState={key:'planned',dir:'asc'};
  main.innerHTML=`<div class="page-heading"><div><h1>PAM</h1><p>Planejamento administrativo das manutenções preventivas, por mês e situação.</p></div></div><div class="plan-kpis" id="plan-kpis"></div><section class="panel plan-filter-panel"><div class="plan-master-toolbar"><div class="plan-master-left"><div class="search"><input id="plan-search" placeholder="Buscar serviço, equipamento, SGD, subestação ou localidade"></div><select id="plan-year">${years.map(y=>`<option value="${y}" ${y===defaultYear?'selected':''}>${y}</option>`).join('')}</select></div><div class="plan-view-toggle" role="group" aria-label="Visualização do plano"><button class="plan-view-btn" data-plan-view="table" type="button"><span data-icon="table"></span>Tabela</button><button class="plan-view-btn" data-plan-view="calendar" type="button"><span data-icon="calendar"></span>Calendário</button><button class="plan-view-btn" data-plan-view="year" type="button"><span data-icon="grid"></span>Ano</button></div></div><div class="plan-mobile-filterbar" aria-label="Filtros do PAM"><button type="button" data-mobile-plan-filter="status" data-sort-key="status"><span data-icon="filter"></span>Status</button><button type="button" data-mobile-plan-filter="competence" data-sort-key="planned"><span data-icon="calendar"></span>Mês</button><button type="button" data-mobile-plan-filter="sub" data-sort-key="sub"><span data-icon="filter"></span>Subestação</button><button type="button" data-mobile-plan-filter="equipment" data-sort-key="equipment"><span data-icon="filter"></span>Equipamento</button></div><p class="plan-view-note" id="plan-view-note"></p><div class="plan-active-filters" id="plan-active-filters"></div><div class="plan-results-head"><p id="plan-result-count"></p><button class="btn secondary hidden" id="plan-clear-filters" type="button">Limpar filtros</button></div><div id="plan-results"></div></section>`;
  const qControl=document.getElementById('plan-search'),yearControl=document.getElementById('plan-year');
  const filterLabels={status:'Status',competence:'Mês',sub:'Subestação',equipment:'Equipamento',service:'Serviço',date:'Data informada'};
  function yearItems(){return items.filter(x=>Number(x.year)===Number(yearControl.value))}
  function filterValue(item,key){
    if(key==='status')return planComputedStatus(item);
    if(key==='competence')return planCompetence(item.planned);
    if(key==='sub')return item.sub||'Sem subestação';
    if(key==='equipment')return item.plant||item.group||'Sem equipamento';
    if(key==='service')return item.service||'Sem serviço';
    if(key==='date')return item.scheduled?planFormatSourceDate(item.scheduled):'Sem data';
    return '';
  }
  function qMatches(item){const q=normalize(qControl.value);return !q||normalize([item.group,item.region,item.sub,item.locality,item.plant,item.sgd,item.service,item.status,planComputedStatus(item)].join(' ')).includes(q)}
  function matchesFilters(item,{ignoreCompetence=false}={}){
    for(const key of Object.keys(filterState)){
      if(ignoreCompetence&&key==='competence')continue;
      const selected=filterState[key];if(selected!==null&&!selected.has(filterValue(item,key)))return false;
    }
    return true;
  }
  function sortValue(item,key){
    if(key==='planned')return String(item.planned||'9999-99-99');
    if(key==='date')return String(item.scheduled||'9999-99-99');
    return normalize(filterValue(item,key));
  }
  function filteredItems(options={}){
    const arr=yearItems().filter(x=>qMatches(x)&&matchesFilters(x,{ignoreCompetence:!!options.ignoreCompetence}));
    if(options.unsorted)return arr;
    return arr.sort((a,b)=>{const av=sortValue(a,sortState.key),bv=sortValue(b,sortState.key);const cmp=String(av).localeCompare(String(bv),'pt-BR',{numeric:true,sensitivity:'base'});return sortState.dir==='asc'?cmp:-cmp});
  }
  function uniqueValues(key){return [...new Set(yearItems().filter(qMatches).map(x=>filterValue(x,key)))].sort((a,b)=>key==='competence'?PLAN_MONTH_NAMES.indexOf(String(a).split('/')[0])-PLAN_MONTH_NAMES.indexOf(String(b).split('/')[0]):String(a).localeCompare(String(b),'pt-BR',{numeric:true,sensitivity:'base'}))}
  function drawKpis(){
    const base=yearItems(),ref=new Date();
    const statusCounts=base.reduce((acc,x)=>{const s=planComputedStatus(x,ref);acc[s]=(acc[s]||0)+1;return acc},{});
    const due=base.filter(x=>planDueForReference(x,ref)),doneDue=due.filter(x=>planComputedStatus(x,ref)==='Concluído');
    const compliance=due.length?Math.round(doneDue.length/due.length*100):0;
    document.getElementById('plan-kpis').innerHTML=`<div class="plan-kpi"><strong>${base.length}</strong><span>Total do plano</span></div><div class="plan-kpi compliance"><strong>${compliance}%</strong><span>Cumprimento até o mês atual</span></div><div class="plan-kpi"><strong>${statusCounts['Concluído']||0}</strong><span>Concluídos</span></div><div class="plan-kpi"><strong>${(statusCounts['Programado']||0)+(statusCounts['Em execução']||0)}</strong><span>Programados / em execução</span></div><div class="plan-kpi overdue"><strong>${statusCounts['Atrasado']||0}</strong><span>Atrasados</span></div><div class="plan-kpi"><strong>${statusCounts['Não programado']||0}</strong><span>Não programados</span></div>`;
  }
  function activeFilterCount(){return Object.values(filterState).filter(v=>v!==null).length}
  function drawActiveFilters(){
    const box=document.getElementById('plan-active-filters'),clear=document.getElementById('plan-clear-filters');
    const chips=[];
    for(const [key,set] of Object.entries(filterState))if(set!==null){const values=[...set],label=values.length===0?'Nenhum':values.length<=2?values.join(', '):`${values.slice(0,2).join(', ')} +${values.length-2}`;chips.push(`<span class="plan-filter-chip">${esc(filterLabels[key])}: ${esc(label)} <button data-clear-plan-filter="${key}" type="button" aria-label="Limpar filtro"><span data-icon="x"></span></button></span>`)}
    box.innerHTML=chips.join('');clear.classList.toggle('hidden',!chips.length);
    document.querySelectorAll('[data-mobile-plan-filter]').forEach(b=>b.classList.toggle('active',filterState[b.dataset.mobilePlanFilter]!==null));
    box.querySelectorAll('[data-clear-plan-filter]').forEach(b=>b.onclick=()=>{filterState[b.dataset.clearPlanFilter]=null;drawAll()});
  }
  function headerCell(key,label,sortKey=key){
    const active=filterState[key]!==null,sorted=sortState.key===sortKey;
    return `<div class="plan-header-cell"><button class="plan-header-button ${active?'filtered active':''}" data-plan-header-filter="${key}" data-sort-key="${sortKey}" type="button"><span>${label}</span><span class="plan-header-icons">${sorted?`<span data-icon="${sortState.dir==='asc'?'arrow-up':'arrow-down'}"></span>`:''}<span class="filter-indicator" data-icon="filter"></span></span></button></div>`;
  }
  function openHeaderFilter(key,button){
    document.querySelectorAll('.plan-filter-popover').forEach(x=>x.remove());
    const cell=button.closest('.plan-header-cell')||document.body,values=uniqueValues(key),selected=filterState[key],working=selected===null?new Set(values):new Set(selected);
    const pop=document.createElement('div');pop.className='plan-filter-popover';
    pop.innerHTML=`<div class="plan-filter-title"><span>Filtrar ${esc(filterLabels[key])}</span><span>${selected===null?'Todos':`${selected.size}/${values.length}`}</span></div><div class="plan-sort-actions"><button data-plan-sort="asc" class="${sortState.key===button.dataset.sortKey&&sortState.dir==='asc'?'active':''}" type="button">Ordenar A → Z</button><button data-plan-sort="desc" class="${sortState.key===button.dataset.sortKey&&sortState.dir==='desc'?'active':''}" type="button">Ordenar Z → A</button></div>${values.length>12?'<div class="plan-filter-search"><input placeholder="Pesquisar valores"></div>':''}<div class="plan-filter-values">${values.map((v,i)=>`<label class="plan-filter-option" data-filter-option-index="${i}"><input type="checkbox" data-filter-check="${i}" ${working.has(v)?'checked':''}><span>${esc(v)}</span></label>`).join('')}</div><div class="plan-filter-footer"><button data-filter-all type="button">Todos</button><button data-filter-none type="button">Nenhum</button><button class="primary-filter" data-filter-apply type="button">Aplicar</button></div>`;
    cell.appendChild(pop);
    requestAnimationFrame(()=>{
      if(window.innerWidth>760){
        const rect=pop.getBoundingClientRect(),margin=14;
        if(rect.right>window.innerWidth-margin){pop.style.left='auto';pop.style.right='4px'}
        const rect2=pop.getBoundingClientRect();
        if(rect2.left<margin){pop.style.right='auto';pop.style.left='4px'}
      }
    });
    pop.onclick=e=>e.stopPropagation();
    const countLabel=pop.querySelector('.plan-filter-title span:last-child'),updateCount=()=>{if(countLabel)countLabel.textContent=working.size===values.length?'Todos':`${working.size}/${values.length}`};
    const search=pop.querySelector('.plan-filter-search input');if(search)search.oninput=()=>{const s=normalize(search.value);pop.querySelectorAll('[data-filter-option-index]').forEach((row,i)=>row.style.display=!s||normalize(values[i]).includes(s)?'flex':'none')};
    pop.querySelectorAll('[data-plan-sort]').forEach(b=>b.onclick=()=>{sortState.key=button.dataset.sortKey;sortState.dir=b.dataset.planSort;pop.remove();drawResults()});
    pop.querySelectorAll('[data-filter-check]').forEach(ch=>ch.onchange=()=>{const value=values[Number(ch.dataset.filterCheck)];ch.checked?working.add(value):working.delete(value);updateCount()});
    pop.querySelector('[data-filter-none]').onclick=()=>{working.clear();pop.querySelectorAll('[data-filter-check]').forEach(ch=>ch.checked=false);updateCount()};
    pop.querySelector('[data-filter-all]').onclick=()=>{working.clear();values.forEach(v=>working.add(v));pop.querySelectorAll('[data-filter-check]').forEach(ch=>ch.checked=true);updateCount()};
    pop.querySelector('[data-filter-apply]').onclick=()=>{filterState[key]=working.size===values.length?null:new Set(working);pop.remove();drawAll()};
    setTimeout(()=>document.addEventListener('click',()=>pop.remove(),{once:true}),0);
  }
  function bindTableEvents(){
    document.querySelectorAll('[data-plan-item]').forEach(row=>row.onclick=()=>openPreventivePlanItem(row.dataset.planItem));
    document.querySelectorAll('[data-plan-header-filter]').forEach(button=>button.onclick=e=>{e.stopPropagation();openHeaderFilter(button.dataset.planHeaderFilter,button)});
  }
  function drawTable(){
    const matched=filteredItems();
    document.getElementById('plan-result-count').textContent=`${matched.length} atividade(s) encontrada(s)`;
    document.getElementById('plan-view-note').textContent='Use o funil no cabeçalho de cada coluna para filtrar e ordenar, no mesmo conceito das tabelas do Excel.';
    document.getElementById('plan-results').innerHTML=matched.length?`<div class="plan-list"><div class="plan-list-head excel-head">${headerCell('status','Status','status')}${headerCell('competence','Mês','planned')}${headerCell('sub','Regional / Subestação','sub')}${headerCell('equipment','Equipamento','equipment')}${headerCell('service','Serviço','service')}${headerCell('date','Data informada','date')}</div>${matched.map(item=>{const status=planComputedStatus(item);return `<article class="plan-row" data-plan-item="${esc(item.id)}"><span class="plan-status ${planStatusClass(status)}">${esc(status)}</span><strong class="plan-date">${esc(planCompetence(item.planned))}</strong><div class="plan-sub"><strong>${esc(item.sub||'—')}</strong><small>${esc(item.region||'')} ${item.locality?`· ${esc(item.locality)}`:''}</small></div><div class="plan-equipment"><strong>${esc(item.plant||item.group||'—')}</strong><small>${esc(item.group||'')}${item.sgd?` · SGD ${esc(item.sgd)}`:''}</small></div><div class="plan-service"><strong>${esc(item.service||'—')}</strong><small>Quantidade: ${esc(item.qty??'—')} · Fonte: ${esc(item.status||'—')}</small></div><strong>${esc(planFormatSourceDate(item.scheduled))}</strong></article>`}).join('')}</div>`:'<div class="empty">Nenhuma atividade encontrada para os filtros selecionados.</div>';
    bindTableEvents();
  }
  function parseDate(value){if(!value)return null;const d=new Date(String(value).slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())?null:d}
  function calendarExactDate(item,year,month){
    const candidates=[];if(item.completed)candidates.push(item.completed);if(item.scheduled)candidates.push(item.scheduled);
    for(const c of candidates){const d=parseDate(c);if(d&&d.getFullYear()===year&&d.getMonth()+1===month)return d}return null;
  }
  function openPlanItemsList(title,list){
    document.getElementById('modal-root').innerHTML=`<div class="modal" id="plan-list-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="close-plan-list" type="button"><span data-icon="x"></span></button><h2>${esc(title)}</h2><p class="muted">${list.length} atividade(s)</p><div class="operation-list">${list.map(item=>{const s=planComputedStatus(item);return `<article data-plan-list-item="${esc(item.id)}" style="cursor:pointer"><div><strong>${esc(item.sub||'—')} · ${esc(item.plant||item.group||'—')}</strong><span>${esc(item.service||'—')}</span></div><span class="plan-status ${planStatusClass(s)}">${esc(s)}</span></article>`}).join('')}</div></div></div>`;
    const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-plan-list').onclick=close;document.getElementById('plan-list-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.querySelectorAll('[data-plan-list-item]').forEach(r=>r.onclick=()=>{const id=r.dataset.planListItem;close();openPreventivePlanItem(id)});
  }
  function monthItems(month){return filteredItems({unsorted:true}).filter(x=>{const d=planMonthStart(x.planned);return d&&d.getMonth()+1===month})}
  function drawCalendar(){
    const year=Number(yearControl.value);calendarMonth=Math.max(1,Math.min(12,calendarMonth));state.preventivePlanMonth=calendarMonth;localStorage.setItem('central_plan_month',String(calendarMonth));
    const list=monthItems(calendarMonth),first=new Date(year,calendarMonth-1,1),days=new Date(year,calendarMonth,0).getDate(),offset=first.getDay(),cells=Math.ceil((offset+days)/7)*7;
    const byDay=new Map(),unplaced=[];for(const item of list){const d=calendarExactDate(item,year,calendarMonth);if(d){const day=d.getDate();if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(item)}else unplaced.push(item)}
    document.getElementById('plan-result-count').textContent=`${list.length} atividade(s) em ${PLAN_MONTH_NAMES[calendarMonth-1]}/${year} · ${unplaced.length} sem data definida na competência`;
    document.getElementById('plan-view-note').textContent='O calendário usa a competência do plano. Só posiciona uma atividade em um dia quando existe data informada dentro daquele mesmo mês; caso contrário ela permanece em “Sem data definida na competência”.';
    let cellHtml='';for(let i=0;i<cells;i++){const day=i-offset+1,outside=day<1||day>days;const events=outside?[]:(byDay.get(day)||[]);const today=!outside&&year===now.getFullYear()&&calendarMonth===now.getMonth()+1&&day===now.getDate();cellHtml+=`<div class="plan-day ${outside?'outside':''} ${today?'today':''} ${events.length?'has-events':''}">${outside?'':`<div class="plan-day-number"><b>${day}</b>${events.length?`<span>${events.length}</span>`:''}</div>${events.slice(0,3).map(item=>{const s=planComputedStatus(item);return `<button class="plan-calendar-event ${planStatusClass(s)}" data-plan-item="${esc(item.id)}" type="button"><b>${esc(item.sub||'—')} · ${esc(item.plant||item.group||'—')}</b><span>${esc(s)}</span></button>`}).join('')}${events.length>3?`<button class="plan-more-events" data-plan-day="${day}" type="button">+${events.length-3} atividade(s)</button>`:''}`}</div>`}
    const weekday=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    document.getElementById('plan-results').innerHTML=`<div class="plan-calendar-toolbar"><div class="plan-calendar-nav"><button id="plan-prev-month" type="button" ${calendarMonth===1?'disabled':''}><span data-icon="chevron-left"></span></button><div class="plan-calendar-title">${PLAN_MONTH_NAMES[calendarMonth-1]} ${year}</div><button id="plan-next-month" type="button" ${calendarMonth===12?'disabled':''}><span data-icon="chevron-right"></span></button></div><div class="plan-calendar-legend"><span><i class="plan-legend-dot done"></i>Concluído</span><span><i class="plan-legend-dot scheduled"></i>Programado</span><span><i class="plan-legend-dot running"></i>Em execução</span><span><i class="plan-legend-dot overdue"></i>Atrasado</span><span><i class="plan-legend-dot pending"></i>Não programado</span></div></div><div class="plan-calendar"><div class="plan-calendar-weekdays">${weekday.map(w=>`<div>${w}</div>`).join('')}</div><div class="plan-calendar-grid">${cellHtml}</div></div>${unplaced.length?`<section class="plan-unscheduled"><h3>Sem data definida na competência</h3><p>Inclui atividades sem data informada e atividades cuja data registrada está fora de ${PLAN_MONTH_NAMES[calendarMonth-1]}/${year}.</p><div class="plan-unscheduled-list">${unplaced.slice(0,12).map(item=>{const s=planComputedStatus(item);return `<button class="plan-unscheduled-item" data-plan-item="${esc(item.id)}" type="button"><b>${esc(item.sub||'—')} · ${esc(item.plant||item.group||'—')}</b><span>${esc(s)}${item.scheduled?` · data informada ${esc(planFormatSourceDate(item.scheduled))}`:''}</span></button>`}).join('')}</div>${unplaced.length>12?`<button class="btn secondary" id="plan-open-unscheduled" type="button" style="margin-top:9px">Ver todas as ${unplaced.length} atividades</button>`:''}</section>`:''}`;
    document.getElementById('plan-prev-month').onclick=()=>{calendarMonth--;drawResults()};document.getElementById('plan-next-month').onclick=()=>{calendarMonth++;drawResults()};
    document.querySelectorAll('[data-plan-item]').forEach(el=>el.onclick=()=>openPreventivePlanItem(el.dataset.planItem));
    document.querySelectorAll('[data-plan-day]').forEach(el=>el.onclick=()=>openPlanItemsList(`${el.dataset.planDay} de ${PLAN_MONTH_NAMES[calendarMonth-1]}`,byDay.get(Number(el.dataset.planDay))||[]));
    const openUn=document.getElementById('plan-open-unscheduled');if(openUn)openUn.onclick=()=>openPlanItemsList(`Sem data definida · ${PLAN_MONTH_NAMES[calendarMonth-1]}/${year}`,unplaced);
  }
  function drawYear(){
    const year=Number(yearControl.value),all=filteredItems({unsorted:true,ignoreCompetence:true});
    document.getElementById('plan-result-count').textContent=`Visão anual de ${year} · ${all.length} atividade(s) considerando os filtros ativos`;
    document.getElementById('plan-view-note').textContent='Clique em qualquer mês para abrir o calendário detalhado. Os filtros aplicados na Tabela também permanecem ativos nesta visão.';
    document.getElementById('plan-results').innerHTML=`<div class="plan-year-grid">${PLAN_MONTH_NAMES.map((name,index)=>{const month=index+1,list=all.filter(x=>planMonthStart(x.planned)?.getMonth()+1===month),counts=list.reduce((a,x)=>{const s=planComputedStatus(x);a[s]=(a[s]||0)+1;return a},{}),done=counts['Concluído']||0,pct=list.length?Math.round(done/list.length*100):0,pending=list.filter(x=>planComputedStatus(x)!=='Concluído').slice(0,3),current=year===now.getFullYear()&&month===now.getMonth()+1;return `<button class="plan-year-month ${current?'current':''}" data-year-month="${month}" type="button"><div class="plan-year-head"><h3>${name}</h3><div><strong>${list.length}</strong><span>${pct}% concluído</span></div></div><div class="plan-year-progress"><span style="width:${pct}%"></span></div>${list.length?`<div class="plan-year-stats"><div class="plan-year-stat"><span>Concluídos</span><b>${done}</b></div><div class="plan-year-stat"><span>Programados</span><b>${counts['Programado']||0}</b></div><div class="plan-year-stat"><span>Em execução</span><b>${counts['Em execução']||0}</b></div><div class="plan-year-stat"><span>Atrasados</span><b>${counts['Atrasado']||0}</b></div><div class="plan-year-stat"><span>Não programados</span><b>${counts['Não programado']||0}</b></div><div class="plan-year-stat"><span>Reprogramar</span><b>${counts['A reprogramar']||0}</b></div></div><div class="plan-year-preview"><b>Próximas pendências</b>${pending.length?pending.map(x=>`<span>${esc(x.sub||'—')} · ${esc(x.plant||x.group||'—')}</span>`).join(''):'<span>Sem pendências neste mês.</span>'}</div>`:'<div class="plan-year-empty">Nenhuma atividade nesta competência.</div>'}</button>`}).join('')}</div>`;
    document.querySelectorAll('[data-year-month]').forEach(b=>b.onclick=()=>{calendarMonth=Number(b.dataset.yearMonth);view='calendar';state.preventivePlanView=view;localStorage.setItem('central_plan_view',view);drawAll()});
  }
  function drawViewButtons(){document.querySelectorAll('[data-plan-view]').forEach(b=>b.classList.toggle('active',b.dataset.planView===view))}
  function drawResults(){drawViewButtons();if(view==='table')drawTable();else if(view==='calendar')drawCalendar();else drawYear()}
  function drawAll(){drawActiveFilters();drawResults()}
  document.querySelectorAll('[data-plan-view]').forEach(b=>b.onclick=()=>{view=b.dataset.planView;state.preventivePlanView=view;localStorage.setItem('central_plan_view',view);drawAll()});
  document.querySelectorAll('[data-mobile-plan-filter]').forEach(button=>button.onclick=e=>{e.stopPropagation();openHeaderFilter(button.dataset.mobilePlanFilter,button)});
  qControl.oninput=()=>drawResults();
  yearControl.onchange=()=>{for(const k of Object.keys(filterState))filterState[k]=null;calendarMonth=Number(yearControl.value)===now.getFullYear()?now.getMonth()+1:1;drawKpis();drawAll()};
  document.getElementById('plan-clear-filters').onclick=()=>{for(const k of Object.keys(filterState))filterState[k]=null;drawAll()};
  drawKpis();drawAll();
}
async function renderOverview(){if(state.role!=='admin'){toast('A área de Relatórios é exclusiva da Equipe Administrativa.','warning');return renderHome()}state.screen='overview';setActiveNav('overview');const reports=await combinedReports();state.reports=reports;const sortState={key:'date',dir:'desc'};main.innerHTML=`<div class="page-heading overview-heading"><div><h1>Relatórios</h1><p>Relatórios recebidos das equipes e registros históricos importados.</p></div><div class="stats"><div class="stat"><strong>${reports.filter(r=>r.source!=='imported').length}</strong><span>registros locais</span></div><div class="stat"><strong>${reports.filter(r=>r.outcome==='inconclusivo').length}</strong><span>inconclusivos</span></div><div class="stat"><strong>${reports.filter(r=>r.source==='imported').length}</strong><span>históricos importados</span></div></div></div><section class="panel"><div class="inbox-toolbar"><div class="search"><input id="report-search" placeholder="Buscar por ativo, equipe, subestação ou tipo"></div><select id="report-source"><option value="">Todos os relatórios</option><option value="local">Registros deste dispositivo</option><option value="inconclusivo">Atendimentos inconclusivos</option><option value="imported">Histórico importado</option></select></div><div id="inbox"></div></section>`;const search=document.getElementById('report-search'),source=document.getElementById('report-source');function sourceMatch(r,src){if(!src)return true;if(src==='inconclusivo')return r.outcome==='inconclusivo';return r.source===src}function reportTime(value){if(!value)return -Infinity;const text=String(value).trim();if(/^\d{4}-\d{2}-\d{2}/.test(text)){const time=new Date(text.slice(0,10)+'T12:00:00').getTime();return Number.isNaN(time)?-Infinity:time}const br=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(br){const time=new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00`).getTime();return Number.isNaN(time)?-Infinity:time}const time=new Date(text).getTime();return Number.isNaN(time)?-Infinity:time}function sortValue(r,key){if(key==='asset')return normalize(r.assets.join(', ')||'Ativo não informado');if(key==='author')return normalize(r.author||'');return reportTime(r.date)}function sortIndicator(key){return sortState.key!==key?icon('arrows-sort'):sortState.dir==='asc'?icon('arrow-up'):icon('arrow-down')}function drawInbox(){const q=normalize(search.value),src=source.value;const matched=reports.filter(r=>sourceMatch(r,src)&&(!q||normalize([r.author,r.substation,r.type,r.outcome,...r.assets].join(' ')).includes(q))).sort((a,b)=>{const av=sortValue(a,sortState.key),bv=sortValue(b,sortState.key);let comparison;if(sortState.key==='date')comparison=av-bv;else comparison=String(av).localeCompare(String(bv),'pt-BR',{sensitivity:'base',numeric:true});return sortState.dir==='asc'?comparison:-comparison});const list=matched.slice(0,300);document.getElementById('inbox').innerHTML=`<div class="inbox"><div class="inbox-head"><span></span><button class="sort-header ${sortState.key==='asset'?'active':''}" data-sort="asset" type="button">Relatório / ativo <span class="sort-icon">${sortIndicator('asset')}</span></button><button class="sort-header ${sortState.key==='author'?'active':''}" data-sort="author" type="button">Responsável <span class="sort-icon">${sortIndicator('author')}</span></button><button class="sort-header ${sortState.key==='date'?'active':''}" data-sort="date" type="button">Data <span class="sort-icon">${sortIndicator('date')}</span></button></div>${list.length?list.map(r=>`<article class="inbox-row ${r.source!=='imported'?'unread':''}" data-report-key="${esc(r.key)}" title="Abrir detalhes"><span class="report-dot ${r.outcome==='inconclusivo'?'inconclusive':r.source!=='imported'?'local':'sent'}"></span><div class="inbox-main"><strong>${esc(r.assets.join(', ')||'Ativo não informado')}</strong><span>${esc(r.type)} · ${esc(r.substation)}</span>${r.outcome==='inconclusivo'?'<span class="status-pill inconclusive">Inconclusivo</span>':''}${r.source!=='imported'?'<span class="status-pill pending">Pendente de sincronização</span>':''}</div><div class="inbox-person"><b>${esc(r.author)}</b></div><div class="inbox-date"><b>${formatDate(r.date)}</b></div></article>`).join(''):'<div class="empty">Nenhum relatório encontrado.</div>'}</div><p class="database-note">Exibindo ${list.length} de ${matched.length} resultado(s). Clique em qualquer linha para abrir os detalhes.</p>`;document.querySelectorAll('[data-report-key]').forEach(row=>row.onclick=()=>openReportDetails(row.dataset.reportKey));document.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{const key=button.dataset.sort;if(sortState.key===key)sortState.dir=sortState.dir==='asc'?'desc':'asc';else{sortState.key=key;sortState.dir=key==='date'?'desc':'asc'}drawInbox()})}search.oninput=drawInbox;source.onchange=drawInbox;drawInbox()}
async function openReportDetails(key){const r=state.reports.find(x=>x.key===key)||(await combinedReports()).find(x=>x.key===key);if(!r)return;const raw=r.raw,local=r.source!=='imported';const form=local?(raw.form||{}):raw;const photos=local?await idbByIndex('maintenancePhotos','maintenanceId',raw.id):[];const inconclusive=local&&(r.outcome==='inconclusivo'||normalize(form.inconclusivo)==='sim');const fields=local?[['Subestação',r.substation],['Data',formatDate(form.data||raw.criadoEm)],['Responsável',r.author],['Tipo',form.tipo],['Ordem de serviço',form.os],['Horário',[form.inicio,form.fim].filter(Boolean).join(' às ')],['Resultado',inconclusive?'Inconclusivo':'Concluído'],['Sincronização','Pendente de sincronização'],['Fotos anexadas',String(photos.length)],['Arquitetura atualizada?',form.arquiteturaAtualizada],['Projeto atualizado?',form.projetoAtualizado],['Configuração realizada?',form.configuracaoRealizada],['Ajuste de proteção conferido?',form.ajusteProtecao],['Houve substituição de peça?',form.houvePeca],['Necessário retorno?',form.retorno]]:[['Subestação',r.substation],['Data',formatDate(raw.data)],['Responsável',raw.equipe],['Tipo',raw.tipoManutencao],['Ordem de serviço',raw.os],['Horário',[raw.inicio,raw.fim].filter(Boolean).join(' às ')],['Fabricante',raw.fabricante],['Modelo',raw.modelo],['Número de série',raw.serial]];const blocks=local?[['Defeito encontrado ou condição da atividade',form.defeito],['Causa',form.causa],['Reparo/serviço realizado',form.reparo],['Ativo e configuração realizada',form.configuracao],['Peça substituída',form.peca],['Destino da peça retirada',form.destinoPeca],['Observações sobre a execução',form.comentarios],['Motivo ou pendência para conclusão',form.motivoInconclusao]]:[['Defeito ou condição encontrada',raw.defeito],['Causa',raw.causa],['Serviço/reparo realizado',raw.reparo],['Configuração',raw.configuracao],['Ativo substituído',raw.ativoSubstituido],['Peça substituída',raw.pecaSubstituida],['Comentários',raw.comentarios]];document.getElementById('modal-root').innerHTML=`<div class="modal" id="report-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="close-report" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="report-header"><div>${inconclusive?'<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="status-pill inconclusive">Inconclusivo</span></div>':''}<h2>${esc(r.type)}</h2><p class="muted">${esc(r.substation)}</p></div></div><div class="detail-block" style="border:0;margin:0;padding:0"><h3>Ativos envolvidos</h3><div class="asset-tags">${r.assets.map(a=>`<span class="asset-tag">${esc(a)}</span>`).join('')}</div></div><div class="detail-grid" style="margin-top:15px">${fields.filter(x=>x[1]).map(([k,v])=>`<div class="detail-box"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>${blocks.filter(x=>x[1]&&normalize(x[1])!=='nao se aplica').map(([k,v])=>`<div class="detail-block"><h3>${esc(k)}</h3><p>${esc(v)}</p></div>`).join('')}${photos.length?`<div class="detail-block"><h3>Imagens da manutenção</h3><div class="folder-gallery">${photos.map(p=>`<article class="folder-photo" data-modal-photo="${p.id}"><img src="${blobUrl(p.blob)}" alt=""><div><b>${esc(p.category||'Imagem')}</b>${p.caption?` · ${esc(p.caption)}`:''}</div></article>`).join('')}</div></div>`:''}</div></div>`;document.getElementById('close-report').onclick=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('report-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.querySelectorAll('[data-modal-photo]').forEach(c=>c.onclick=async()=>openPhoto(await idbGet('maintenancePhotos',c.dataset.modalPhoto)))}
function catalogAssets(){const rows=[];for(const sub of DATA.substations){const groups=DATA.equipment[sub.id]||{eletronicos:[],reles:[],patio:[]};for(const e of [...groups.eletronicos,...groups.reles,...groups.patio])rows.push({...e,subId:sub.id,subSigla:sub.sigla,subNome:sub.nome})}return rows}
function databaseSubtype(asset){
  const text=normalize([assetName(asset),asset.modelo,asset.identificacao].join(' '));
  if(asset.grupo==='Eletrônicos'){
    if(text.includes('concentrador'))return 'Concentradores';
    if(text.includes('modulo')||text.includes('i/o')||text.includes('io '))return 'Módulos I/O';
    if(text.includes('roteador')||text.includes('switch')||text.includes('gateway'))return 'Redes e comunicação';
    if(text.includes('retificador'))return 'Retificadores';
    if(text.includes('gps')||text.includes('sincron'))return 'GPS e sincronismo';
    if(text.includes('ihm')||text.includes('monitor')||text.includes('painel'))return 'Supervisão e interfaces';
    return 'Outros eletrônicos';
  }
  if(asset.grupo==='Relés'){
    if(text.includes('linha')||text.includes('ldat')||text.includes('lta'))return 'Proteção de linha';
    if(text.includes('transformador')||text.includes('trafo')||text.includes('87t'))return 'Proteção de transformador';
    if(text.includes('regulador'))return 'Reguladores';
    if(text.includes('barra')||text.includes('barramento'))return 'Barramentos';
    if(text.includes('capacitor')||text.includes(' bc '))return 'Banco de capacitores';
    return 'Outros relés';
  }
  if(text.includes('religador'))return 'Religadores';
  if(text.includes('disjuntor'))return 'Disjuntores';
  if(text.includes('transformador')||text.includes('trafo'))return 'Transformadores';
  if(text.includes('chave'))return 'Chaves e seccionadoras';
  if(text.includes('capacitor'))return 'Banco de capacitores';
  return 'Outros equipamentos de pátio';
}
function databaseTreeGroups(assets){
  const groups=new Map();
  for(const asset of assets){
    const category=asset.grupo||'Sem categoria',subtype=databaseSubtype(asset);
    if(!groups.has(category))groups.set(category,new Map());
    const types=groups.get(category);if(!types.has(subtype))types.set(subtype,[]);types.get(subtype).push(asset)
  }
  return groups
}

let orgConnectorResizeTimer=null;
function connectorPoint(node,tree,edge){const r=node.getBoundingClientRect(),t=tree.getBoundingClientRect();return {x:r.left-t.left+tree.scrollLeft+r.width/2,y:(edge==='top'?r.top:r.bottom)-t.top+tree.scrollTop}}
function drawOrgConnectors(host=document){
  const tree=host.querySelector?.('.database-org-tree'),svg=tree?.querySelector('.org-connectors');if(!tree||!svg)return;
  svg.innerHTML='';if(window.innerWidth<=900)return;
  const width=tree.scrollWidth,height=tree.scrollHeight;svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=width+'px';svg.style.height=height+'px';
  const root=tree.querySelector('.org-root-node');if(!root)return;
  const connect=(from,to)=>{if(!from||!to)return;const a=connectorPoint(from,tree,'bottom'),b=connectorPoint(to,tree,'top'),distance=Math.max(24,b.y-a.y),curve=Math.min(70,distance*.48),path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${a.x} ${a.y} C ${a.x} ${a.y+curve}, ${b.x} ${b.y-curve}, ${b.x} ${b.y}`);svg.appendChild(path)};
  tree.querySelectorAll('.org-category-node').forEach(category=>{connect(root,category);const branch=category.closest('.org-branch');branch?.querySelectorAll(':scope .org-type-node').forEach(type=>{if(type.closest('.org-branch')===branch)connect(category,type);const typeSection=type.closest('.org-type');typeSection?.querySelectorAll(':scope .org-type-assets .org-asset-node').forEach(asset=>connect(type,asset))})});
}
window.addEventListener('resize',()=>{clearTimeout(orgConnectorResizeTimer);orgConnectorResizeTimer=setTimeout(()=>drawOrgConnectors(document),120)});
function findAsset(subId,assetId){const groups=DATA.equipment[subId]||{eletronicos:[],reles:[],patio:[]};return [...groups.eletronicos,...groups.reles,...groups.patio].find(x=>x.id===assetId)}
async function loadAssetAudits(assetId){if(state.role!=='admin'||!navigator.onLine)return[];const {data,error}=await cloudClient.from('asset_audit_logs').select('id,action,changes,batch_id,created_at,actor_id').eq('asset_id',assetId).order('created_at',{ascending:false}).limit(40);if(error)return[];const names=new Map((state.profileDirectory||[]).map(p=>[p.id,p.display_name]));return (data||[]).map(row=>({...row,actor_name:names.get(row.actor_id)||'Administrativo'}))}
function assetEditableSnapshot(form){return Object.fromEntries(new FormData(form).entries())}
function assetEditChanged(form,initial){const current=assetEditableSnapshot(form);return Object.keys(current).some(k=>String(current[k]??'')!==String(initial[k]??''))}
function applyCloudAssetToLocal(asset,row){asset.grupo=row.category;asset.tipo=row.name;asset.label=row.name;asset.localizacao=row.location||'';asset.circuito=row.circuit||'';asset.fabricante=row.manufacturer||'';asset.modelo=row.model||'';asset.serial=row.serial_number||'';asset.numeroOperativo=row.operating_number||'';asset.identificacao=row.identification||'';asset.observacoes=row.notes||'';asset.rowVersion=Number(row.row_version||asset.rowVersion||1);asset.updatedAt=row.updated_at||new Date().toISOString()}
function normalizeSpreadsheetHeader(value){return normalize(String(value||'')).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function spreadsheetModuleReady(){if(window.XLSX)return true;toast('O módulo de planilhas ainda não foi carregado. Verifique a internet e reabra o sistema.','warning');return false}
function bulkTemplateRows(){return catalogAssets().sort((a,b)=>`${a.subSigla} ${assetTitle(a)}`.localeCompare(`${b.subSigla} ${assetTitle(b)}`,'pt-BR')).map(a=>({asset_id:String(a.id),subestacao_id:String(a.subId),subestacao:`${a.subSigla} — ${a.subNome}`,categoria:a.grupo||'',nome_tipo:assetName(a)||'',localizacao:a.localizacao||'',circuito:assetCircuit(a)||'',fabricante:a.fabricante||'',modelo:a.modelo||'',numero_serie:a.serial||'',numero_operativo:a.numeroOperativo||'',identificacao:a.identificacao||'',observacoes:a.observacoes||'',versao_registro:Number(a.rowVersion||1)}))}
function exportAssetUpdateWorkbook(){
  if(!spreadsheetModuleReady())return;const wb=XLSX.utils.book_new();
  const instructions=[['MODELO DE ATUALIZAÇÃO DE ATIVOS'],[''],['Regras'],['1. Não altere asset_id, subestacao_id ou versao_registro.'],['2. Células vazias mantêm o valor atual.'],['3. Para apagar um valor, escreva [LIMPAR].'],['4. Novos ativos entram pelo módulo Integração; trocas entram por Substituição.'],['5. A importação mostra as diferenças antes de alterar a base e pode ser revertida em lote.']];
  const wsInfo=XLSX.utils.aoa_to_sheet(instructions),rows=bulkTemplateRows(),ws=XLSX.utils.json_to_sheet(rows,{header:['asset_id','subestacao_id','subestacao','categoria','nome_tipo','localizacao','circuito','fabricante','modelo','numero_serie','numero_operativo','identificacao','observacoes','versao_registro']});
  ws['!cols']=[{wch:38},{wch:18},{wch:28},{wch:16},{wch:34},{wch:24},{wch:18},{wch:24},{wch:28},{wch:24},{wch:22},{wch:24},{wch:38},{wch:15}];ws['!autofilter']={ref:ws['!ref']};wsInfo['!cols']=[{wch:95}];
  XLSX.utils.book_append_sheet(wb,wsInfo,'Instruções');XLSX.utils.book_append_sheet(wb,ws,'Ativos');XLSX.writeFile(wb,`Atualizacao_Ativos_${new Date().toISOString().slice(0,10)}.xlsx`,{compression:true});
}
function compareImportedAssetRows(rows,fileName){
  const assets=new Map(catalogAssets().map(a=>[String(a.id),a])),seen=new Set(),validCategories=new Set(['Eletrônicos','Relés','Pátio']);let unchanged=0;const items=[],errors=[];
  const fieldDefs=[['categoria','grupo','category','Categoria'],['nome_tipo','tipo','name','Nome ou tipo'],['localizacao','localizacao','location','Localização'],['circuito','circuito','circuit','Circuito'],['fabricante','fabricante','manufacturer','Fabricante'],['modelo','modelo','model','Modelo'],['numero_serie','serial','serial_number','Número de série'],['numero_operativo','numeroOperativo','operating_number','Número operativo'],['identificacao','identificacao','identification','Identificação'],['observacoes','observacoes','notes','Observações']];
  rows.forEach((raw,index)=>{const row={};for(const [key,value] of Object.entries(raw||{}))row[normalizeSpreadsheetHeader(key)]=value;const line=index+2,id=String(row.asset_id??'').trim();if(!id){errors.push(`Linha ${line}: asset_id não informado.`);return}if(seen.has(id)){errors.push(`Linha ${line}: asset_id duplicado (${id}).`);return}seen.add(id);const asset=assets.get(id);if(!asset){errors.push(`Linha ${line}: asset_id ${id} não existe na base.`);return}const subId=String(row.subestacao_id??'').trim();if(subId&&subId!==String(asset.subId)){errors.push(`Linha ${line}: a subestação do ativo ${id} não pode ser alterada por planilha.`);return}const updates={},changes=[];for(const [header,localKey,dbKey,label] of fieldDefs){if(!(header in row))continue;const rawValue=row[header];if(rawValue===null||rawValue===undefined||String(rawValue).trim()==='')continue;const value=String(rawValue).trim()==='[LIMPAR]'?null:String(rawValue).trim();if(dbKey==='category'&&value&&!validCategories.has(value)){errors.push(`Linha ${line}: categoria inválida (${value}).`);continue}const before=String(asset[localKey]??'').trim(),after=value===null?'':String(value);if(before!==after){updates[dbKey]=value;changes.push({field:dbKey,label,before:before||'—',after:after||'—'})}}
    if(Object.keys(updates).length)items.push({asset_id:id,expected_version:Number(row.versao_registro||asset.rowVersion||1),updates,changes,title:`${asset.subSigla} · ${assetTitle(asset)}`});else unchanged++;
  });return {fileName,total:rows.length,items,errors,unchanged}
}
function renderImportPreview(result){const host=document.getElementById('bulk-import-preview');if(!host)return;state.pendingAssetImport=result;host.innerHTML=`<div class="import-summary"><div class="import-kpi"><strong>${result.total}</strong><span>linhas lidas</span></div><div class="import-kpi"><strong>${result.items.length}</strong><span>ativos com alterações</span></div><div class="import-kpi"><strong>${result.unchanged}</strong><span>sem alterações</span></div><div class="import-kpi error"><strong>${result.errors.length}</strong><span>erros</span></div></div>${result.errors.length?`<div class="import-error-list"><b>Corrija o arquivo antes de importar:</b><br>${result.errors.slice(0,25).map(esc).join('<br>')}${result.errors.length>25?`<br>... e mais ${result.errors.length-25} erro(s).`:''}</div>`:''}${result.items.length?`<div class="import-preview">${result.items.slice(0,80).map(item=>`<article class="import-asset-change"><strong>${esc(item.title)}</strong>${item.changes.map(c=>`<div class="import-change-row"><b>${esc(c.label)}</b><span>${esc(c.before)}</span><span>→</span><span>${esc(c.after)}</span></div>`).join('')}</article>`).join('')}</div>`:'<div class="empty">Nenhuma alteração foi encontrada.</div>'}<div class="report-actions"><button class="btn secondary" id="clear-import-preview">Limpar análise</button><button class="btn primary" id="confirm-bulk-import" ${result.errors.length||!result.items.length?'disabled':''}>Aplicar ${result.items.length} atualização(ões)</button></div>`;document.getElementById('clear-import-preview').onclick=()=>{state.pendingAssetImport=null;host.innerHTML=''};document.getElementById('confirm-bulk-import')?.addEventListener('click',applyPendingAssetImport)}
async function parseAssetUpdateWorkbook(file){if(!spreadsheetModuleReady())return;try{const buffer=await file.arrayBuffer(),wb=XLSX.read(buffer,{type:'array'}),sheet=wb.Sheets['Ativos']||wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});renderImportPreview(compareImportedAssetRows(rows,file.name))}catch(error){toast('Não foi possível ler a planilha: '+(error.message||error),'warning')}}
async function applyPendingAssetImport(){const result=state.pendingAssetImport;if(!result?.items.length||result.errors.length)return;if(!navigator.onLine)return toast('A importação exige conexão com a nuvem.','warning');const button=document.getElementById('confirm-bulk-import');button.disabled=true;button.textContent='Aplicando…';try{const batchId=crypto.randomUUID(),rows=result.items.map(i=>({asset_id:i.asset_id,expected_version:i.expected_version,updates:i.updates}));const {data,error}=await cloudClient.rpc('apply_asset_bulk_update',{p_batch_id:batchId,p_file_name:result.fileName,p_rows:rows});if(error)throw error;state.pendingAssetImport=null;await loadCloudSnapshot();toast(`${data?.changed_assets||rows.length} ativo(s) atualizado(s).`);openBulkAssetUpdate()}catch(error){button.disabled=false;button.textContent='Aplicar atualizações';toast(error.message||String(error),'warning')}}
async function recentAssetImportBatches(){if(!navigator.onLine||state.role!=='admin')return[];const {data,error}=await cloudClient.from('asset_import_batches').select('*').order('created_at',{ascending:false}).limit(12);return error?[]:(data||[])}
async function revertAssetImportBatch(batchId){if(!confirm('Reverter todas as alterações deste lote?'))return;const {data,error}=await cloudClient.rpc('revert_asset_import_batch',{p_batch_id:batchId});if(error)return toast(error.message||String(error),'warning');await loadCloudSnapshot();toast(`${data?.reverted_assets||0} ativo(s) revertido(s).`);openBulkAssetUpdate()}
async function openBulkAssetUpdate(){
  if(state.role!=='admin')return;const batches=await recentAssetImportBatches();document.getElementById('modal-root').innerHTML=`<div class="modal no-backdrop-close" id="bulk-update-modal"><div class="modal-card bulk-update-card"><button class="modal-close" id="close-bulk-update" type="button" aria-label="Fechar"><span data-icon="x"></span></button><h2>Atualização em massa de ativos</h2><p class="muted">Exporte a base atual, altere somente os campos necessários e envie a planilha para revisar as diferenças.</p><div class="bulk-update-actions"><section class="bulk-action"><h3>1. Exportar modelo atualizado</h3><p>Baixa os ativos atuais com identificadores protegidos e campos próprios para correção.</p><button class="btn secondary" id="export-assets-xlsx">Baixar Excel</button></section><section class="bulk-action"><h3>2. Analisar planilha preenchida</h3><p>Nenhum dado é alterado antes da tela de conferência.</p><label class="btn primary" for="bulk-file-input">Selecionar Excel</label><input class="bulk-file-input" id="bulk-file-input" type="file" accept=".xlsx,.xls"></section></div><div id="bulk-import-preview"></div><div class="detail-block"><h3>Lotes recentes</h3><div class="import-batches">${batches.length?batches.map(b=>`<article class="import-batch"><div><strong>${esc(b.file_name||'Importação')}</strong><small>${formatDate(b.created_at)} · ${b.changed_assets||0} ativo(s) · ${b.status==='reverted'?'Revertido':'Aplicado'}</small></div>${b.status==='applied'?`<button class="btn secondary" data-revert-batch="${b.id}">Reverter lote</button>`:''}</article>`).join(''):'<div class="empty">Nenhuma importação registrada.</div>'}</div></div></div></div>`;
  const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-bulk-update').onclick=close;document.getElementById('bulk-update-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.getElementById('export-assets-xlsx').onclick=exportAssetUpdateWorkbook;document.getElementById('bulk-file-input').onchange=e=>e.target.files[0]&&parseAssetUpdateWorkbook(e.target.files[0]);document.querySelectorAll('[data-revert-batch]').forEach(b=>b.onclick=()=>revertAssetImportBatch(b.dataset.revertBatch));
}

async function renderDatabase(){
  state.screen='database';setActiveNav('database');state.databaseView=state.databaseView||'tree';
  const assets=catalogAssets(),regions=[...new Set(DATA.substations.map(s=>s.regiao).filter(Boolean))].sort(),substations=[...DATA.substations].sort((a,b)=>(a.sigla+' '+a.nome).localeCompare(b.sigla+' '+b.nome,'pt-BR'));
  const selected=state.databaseSubId&&DATA.substations.find(s=>s.id===state.databaseSubId);
  if(!selected){
    main.innerHTML=`<div class="page-heading database-heading-premium"><div class="database-heading-copy"><h1>Banco de Dados</h1><p>Selecione uma subestação para explorar seus ativos por categoria e tipo.</p><div class="database-heading-metrics" aria-label="Resumo da base"><div class="database-heading-metric"><span data-icon="database"></span><div><strong>${DATA.substations.length}</strong><small>Subestações</small></div></div><div class="database-heading-metric"><span data-icon="tool"></span><div><strong>${assets.length}</strong><small>Ativos</small></div></div></div></div><div class="database-admin-actions"><button class="btn bulk-highlight database-export-btn" id="database-export-data" type="button">📊 Exportar dados</button>${state.role==='admin'?'<button class="btn bulk-highlight database-bulk-btn" id="bulk-asset-update" type="button">📊 Atualização em massa</button>':''}</div></div><section class="panel database-gallery-panel"><div class="database-gallery-toolbar"><div class="search"><input id="db-sub-search" placeholder="Buscar subestação por nome ou sigla"></div><select id="db-region"><option value="">Todas as regiões</option>${regions.map(r=>`<option>${esc(r)}</option>`).join('')}</select></div><div id="database-substation-grid" class="database-substation-grid"></div></section>`;
    hydrateIcons(main);const search=document.getElementById('db-sub-search'),region=document.getElementById('db-region');document.getElementById('database-export-data')?.addEventListener('click',openDataExportDialog);document.getElementById('bulk-asset-update')?.addEventListener('click',openBulkAssetUpdate);
    function drawGallery(){const q=normalize(search.value),reg=region.value;const rows=substations.filter(sub=>(!reg||sub.regiao===reg)&&(!q||normalize(`${sub.sigla} ${sub.nome}`).includes(q)));document.getElementById('database-substation-grid').innerHTML=rows.length?rows.map(sub=>`<button class="database-substation-button" data-db-substation="${sub.id}" type="button"><strong>${esc(sub.sigla)} — ${esc(sub.nome)}</strong></button>`).join(''):'<div class="empty">Nenhuma subestação encontrada.</div>';document.querySelectorAll('[data-db-substation]').forEach(b=>b.onclick=()=>{state.databaseSubId=b.dataset.dbSubstation;state.databaseView='tree';renderDatabase()})}
    search.oninput=drawGallery;region.onchange=drawGallery;drawGallery();return
  }
  const subAssets=assets.filter(a=>a.subId===selected.id);
  main.innerHTML=`<div class="database-selected-heading"><button class="back icon-back" id="db-back-gallery" type="button" aria-label="Voltar às subestações" title="Voltar às subestações"><span data-icon="arrow-left"></span></button><div><h1>${esc(selected.sigla)} — ${esc(selected.nome)}</h1><p>${subAssets.length} ativo(s) cadastrados · ${esc(selected.regiao||'Região não informada')} · ${esc(selected.classeTensao||'Classe de tensão não informada')}</p></div></div><section class="panel database-explorer"><div class="database-explorer-toolbar"><div class="search"><input id="db-asset-search" placeholder="Buscar ativo, circuito, série ou identificação"></div><div class="view-switch" role="group" aria-label="Modo de visualização"><button type="button" data-db-view="tree" class="${state.databaseView==='tree'?'active':''}">Árvore</button><button type="button" data-db-view="list" class="${state.databaseView==='list'?'active':''}">Lista</button></div></div><div id="database-explorer-content"></div></section>`;
  document.getElementById('db-back-gallery').onclick=()=>{state.databaseSubId=null;renderDatabase()};
  document.querySelectorAll('[data-db-view]').forEach(b=>b.onclick=()=>{state.databaseView=b.dataset.dbView;renderDatabase()});
  const search=document.getElementById('db-asset-search');
  function drawExplorer(){
    const q=normalize(search.value);
    const filtered=subAssets.filter(a=>!q||normalize([assetName(a),assetCircuit(a),a.serial,a.identificacao,a.numeroOperativo,a.fabricante,a.modelo].join(' ')).includes(q));
    const host=document.getElementById('database-explorer-content');
    if(state.databaseView==='list'){
      host.innerHTML=`<div class="database-list">${filtered.length?filtered.map(e=>`<button class="database-row database-row-button" data-db-asset="${e.id}" type="button"><div><strong>${esc(assetName(e))}${assetCircuit(e)?` — ${esc(assetCircuit(e))}`:''}</strong><small>${esc(e.fabricante||'Fabricante não informado')} · ${esc(e.modelo||'Modelo não informado')}</small></div><div class="db-group">${esc(e.grupo||'Sem categoria')}<br>${e.serial?`Série: ${esc(e.serial)}`:''}</div><span class="tree-open-hint">Abrir</span></button>`).join(''):'<div class="empty">Nenhum ativo encontrado.</div>'}</div>`;
    }else{
      const tree=databaseTreeGroups(filtered),order=['Eletrônicos','Relés','Pátio','Sem categoria'];
      const categories=order.filter(category=>tree.has(category));
      state.databaseOrgOpenTypes=state.databaseOrgOpenTypes||{};
      if(q){
        state.databaseOrgCategory=null;
      }else if(!state.databaseOrgCategory||!categories.includes(state.databaseOrgCategory)){
        state.databaseOrgCategory=categories[0]||null;
      }
      const categoryHtml=categories.map(category=>{
        const types=tree.get(category),count=[...types.values()].reduce((n,v)=>n+v.length,0);
        const categoryOpen=!!q||state.databaseOrgCategory===category;
        if(categoryOpen&&!q&&!Object.keys(state.databaseOrgOpenTypes).some(k=>k.startsWith(category+'::'))){
          const firstType=[...types.keys()].sort((a,b)=>a.localeCompare(b,'pt-BR'))[0];
          if(firstType)state.databaseOrgOpenTypes[category+'::'+firstType]=true;
        }
        const typesHtml=categoryOpen?`<div class="org-category-content"><div class="org-type-stack">${[...types.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')).map(([type,items])=>{
          const key=category+'::'+type,open=!!q||!!state.databaseOrgOpenTypes[key];
          return `<section class="org-type"><button class="org-type-node ${open?'active':''}" data-org-type="${esc(key)}" type="button"><span>${esc(type)}</span><b>${items.length}</b></button>${open?`<div class="org-type-assets">${items.sort((a,b)=>assetTitle(a).localeCompare(assetTitle(b),'pt-BR')).map(e=>`<button class="org-asset-node" data-db-asset="${e.id}" type="button"><strong>${esc(assetName(e))}${assetCircuit(e)?` — ${esc(assetCircuit(e))}`:''}</strong><small>${e.serial?`Série ${esc(e.serial)}`:esc(e.modelo||'Abrir ficha do ativo')}</small></button>`).join('')}</div>`:''}</section>`
        }).join('')}</div></div>`:'';
        return `<section class="org-branch"><button class="org-category-node ${categoryOpen?'active':''}" data-org-category="${esc(category)}" type="button"><span>${esc(category)}</span><span class="org-category-count">${count}</span></button>${typesHtml}</section>`
      }).join('');
      host.innerHTML=categories.length?`<p class="org-tree-help">Clique nos nós para expandir os ramos e abrir a ficha de cada ativo.</p><div class="database-org-tree"><svg class="org-connectors" aria-hidden="true"></svg><div class="org-root-wrap"><div class="org-root-node"><strong>${esc(selected.sigla)} — ${esc(selected.nome)}</strong><small>${filtered.length} ativo(s) nesta visualização</small></div></div><div class="org-root-stem"></div><div class="org-branches" style="--branch-count:${Math.max(categories.length,1)}">${categoryHtml}</div></div>`:'<div class="empty">Nenhum ativo encontrado.</div>';
      host.querySelectorAll('[data-org-category]').forEach(button=>button.onclick=()=>{
        const category=button.dataset.orgCategory;
        state.databaseOrgCategory=state.databaseOrgCategory===category?null:category;
        drawExplorer();
      });
      host.querySelectorAll('[data-org-type]').forEach(button=>button.onclick=()=>{
        const key=button.dataset.orgType;
        state.databaseOrgOpenTypes[key]=!state.databaseOrgOpenTypes[key];
        drawExplorer();
      });
      requestAnimationFrame(()=>drawOrgConnectors(host));
    }
    host.querySelectorAll('[data-db-asset]').forEach(b=>b.onclick=()=>openAssetDetails(selected.id,b.dataset.dbAsset));
  }
  search.oninput=drawExplorer;drawExplorer()
}
async function openAssetDetails(subId,assetId){
  const sub=DATA.substations.find(s=>s.id===subId),e=findAsset(subId,assetId);if(!e)return;const photo=await photoForAsset(e.id),hist=historyForAsset(e,subId).slice(0,12),audits=await loadAssetAudits(e.id),admin=state.role==='admin';
  const field=(name,label,value,{type='text',full=false,options=null}={})=>`<div class="asset-edit-field ${full?'full':''}"><label>${esc(label)}</label>${options?`<select name="${name}" disabled>${options.map(v=>`<option ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select>`:type==='textarea'?`<textarea name="${name}" readonly>${esc(value||'')}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value||'')}" readonly>`}</div>`;
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="asset-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="close-asset" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="report-header"><div><span class="status-pill imported">${esc(e.grupo||'Ativo')}</span><h2>${esc(assetTitle(e))}</h2><p class="muted">${esc(sub.sigla)} — ${esc(sub.nome)}</p></div>${admin?'<div class="asset-detail-header-actions"><button class="asset-lock-button" id="asset-edit-lock" type="button" title="Desbloquear edição" aria-label="Desbloquear edição"><span data-icon="lock"></span></button></div>':''}</div><div class="asset-modal-profile"><div class="asset-modal-photo">${photo?`<img src="${blobUrl(photo)}" alt="Foto do ativo">`:'<span data-icon="settings"></span>'}</div><form id="asset-edit-form" class="asset-edit-form"><div class="asset-edit-grid">${field('category','Categoria',e.grupo,{options:['Eletrônicos','Relés','Pátio']})}${field('name','Nome ou tipo',assetName(e))}${field('location','Localização',e.localizacao)}${field('circuit','Circuito',assetCircuit(e))}${field('manufacturer','Fabricante',e.fabricante)}${field('model','Modelo',e.modelo)}${field('serial_number','Número de série',e.serial)}${field('operating_number','Número operativo',e.numeroOperativo)}${field('identification','Identificação',e.identificacao)}${field('notes','Observações cadastrais',e.observacoes,{type:'textarea',full:true})}</div><div class="asset-version-note">Revisão cadastral ${Number(e.rowVersion||1)} · ID interno ${esc(e.id)}</div><div class="asset-edit-actions hidden" id="asset-edit-actions"><button class="btn secondary" id="cancel-asset-edit" type="button">Cancelar</button><button class="btn primary" id="save-asset-edit" type="submit">Salvar alterações</button></div></form></div><div class="detail-block"><h3>Histórico relacionado</h3>${hist.length?`<div class="history">${hist.map(r=>`<article class="history-card"><div class="date">${formatDate(r.data)} · ${esc(r.os||'Sem OS')}</div><h4>${esc(r.tipoManutencao||'Atendimento')}</h4><p>${esc(r.reparo||r.comentarios||'Sem descrição')}</p></article>`).join('')}</div>`:'<div class="empty">Nenhum histórico relacionado localizado automaticamente.</div>'}</div>${admin?`<div class="detail-block"><h3>Alterações cadastrais</h3><div class="asset-audit-list">${audits.length?audits.map(a=>`<article class="asset-audit-entry"><strong>${a.action==='bulk_update'?'Atualização por planilha':a.action==='batch_revert'?'Reversão de lote':'Edição administrativa'}</strong><small>${formatDate(a.created_at)} · ${new Date(a.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · ${esc(a.actor_name||'Administrativo')}</small><div class="asset-audit-changes">${(a.changes||[]).map(c=>`<span class="asset-audit-change"><b>${esc(c.label||c.field)}</b>: ${esc(c.before??'—')} → ${esc(c.after??'—')}</span>`).join('')}</div></article>`).join(''):'<div class="empty">Nenhuma alteração cadastral registrada.</div>'}</div></div>`:''}</div></div>`;
  const modal=document.getElementById('asset-modal'),form=document.getElementById('asset-edit-form'),lock=document.getElementById('asset-edit-lock'),actions=document.getElementById('asset-edit-actions');let editing=false,initial=assetEditableSnapshot(form);
  const setEditing=value=>{editing=value;form.classList.toggle('editing',editing);actions?.classList.toggle('hidden',!editing);form.querySelectorAll('input,textarea').forEach(x=>x.readOnly=!editing);form.querySelectorAll('select').forEach(x=>x.disabled=!editing);if(lock){lock.classList.toggle('unlocked',editing);setIconOnly(lock,editing?'lock-open':'lock');lock.title=editing?'Bloquear sem salvar':'Desbloquear edição';lock.setAttribute('aria-label',lock.title)}};
  const close=()=>{if(editing&&assetEditChanged(form,initial)&&!confirm('Descartar as alterações não salvas?'))return;document.getElementById('modal-root').innerHTML=''};document.getElementById('close-asset').onclick=close;modal.onclick=ev=>{if(ev.target.id==='asset-modal')close()};
  lock?.addEventListener('click',()=>{if(!navigator.onLine)return toast('A edição cadastral exige conexão com a nuvem.','warning');if(editing&&assetEditChanged(form,initial)){if(!confirm('Descartar as alterações feitas?'))return;form.reset()}setEditing(!editing)});
  document.getElementById('cancel-asset-edit')?.addEventListener('click',()=>{form.reset();setEditing(false)});
  form.onsubmit=async ev=>{ev.preventDefault();if(!editing)return;const values=assetEditableSnapshot(form),mapping={category:['grupo','Categoria'],name:['tipo','Nome ou tipo'],location:['localizacao','Localização'],circuit:['circuito','Circuito'],manufacturer:['fabricante','Fabricante'],model:['modelo','Modelo'],serial_number:['serial','Número de série'],operating_number:['numeroOperativo','Número operativo'],identification:['identificacao','Identificação'],notes:['observacoes','Observações']},updates={};for(const [dbKey,[localKey]] of Object.entries(mapping)){const value=String(values[dbKey]??'').trim(),before=String(e[localKey]??'').trim();if(value!==before)updates[dbKey]=value||null}if(!Object.keys(updates).length){toast('Nenhuma alteração foi identificada.','notice');return setEditing(false)}const button=document.getElementById('save-asset-edit');button.disabled=true;button.textContent='Salvando…';const {data,error}=await cloudClient.rpc('update_asset_record',{p_asset_id:e.id,p_expected_version:Number(e.rowVersion||1),p_updates:updates});if(error){button.disabled=false;button.textContent='Salvar alterações';return toast(error.message||String(error),'warning')}applyCloudAssetToLocal(e,data);await loadCloudSnapshot();toast('Cadastro do ativo atualizado.');document.getElementById('modal-root').innerHTML='';renderDatabase();setTimeout(()=>openAssetDetails(subId,assetId),80)};
}
async function renderSubstations(){state.screen='substations';setActiveNav('maintenance');state.sub=null;state.selected.clear();state.pendingPhotos=[];const regions=[...new Set(DATA.substations.map(s=>s.regiao).filter(Boolean))].sort();main.innerHTML=`${steps(0)}<section class="panel"><div class="hero"><div><h1>Nova Manutenção</h1><p>Selecione a subestação para visualizar seus ativos e registrar uma atividade.</p></div></div><div class="toolbar"><div class="search"><input id="sub-search" placeholder="Buscar subestação por nome ou sigla"></div><select id="region"><option value="">Todas as regiões</option>${regions.map(r=>`<option>${esc(r)}</option>`).join('')}</select></div><div id="sub-grid" class="grid"></div></section>`;const search=document.getElementById('sub-search'),region=document.getElementById('region');function draw(){const q=normalize(search.value),r=region.value;const list=DATA.substations.filter(s=>(!q||normalize(s.nome+' '+s.sigla).includes(q))&&(!r||s.regiao===r));document.getElementById('sub-grid').innerHTML=list.length?list.map(s=>`<article class="sub-card" data-id="${s.id}"><div class="sigla">${esc(s.sigla)}</div><h3>${esc(s.nome)}</h3><div class="meta">${s.regiao?`<span class="pill">${esc(s.regiao)}</span>`:''}${s.classeTensao?`<span class="pill">${esc(s.classeTensao)}</span>`:''}</div><div class="counts"><span>${s.qtdEquipamentos} ativos</span><span>${s.qtdHistorico} históricos</span></div></article>`).join(''):'<div class="empty">Nenhuma subestação encontrada.</div>';document.querySelectorAll('.sub-card').forEach(c=>c.onclick=()=>{state.sub=c.dataset.id;renderEquipment()})}search.oninput=draw;region.onchange=draw;draw()}

function equipmentCard(e){return `<label class="equip"><input class="check item-check" type="checkbox" value="${e.id}" ${state.selected.has(e.id)?'checked':''}><span><strong>${esc(assetName(e))}</strong>${assetCircuit(e)?`<small>Circuito: ${esc(assetCircuit(e))}</small>`:''}</span></label>`}
async function renderEquipment(){
  state.screen='equipment';
  const s=currentSub(),eq=DATA.equipment[state.sub]||{eletronicos:[],reles:[],patio:[]};
  main.innerHTML=`${steps(1)}<div class="head-row maintenance-equipment-head"><div><button class="back" id="back-sub" type="button" aria-label="Voltar às subestações" title="Voltar às subestações"><span data-icon="arrow-left"></span></button><h2>${esc(s.sigla)} · ${esc(s.nome)}</h2><span class="muted">Selecione ativos individualmente ou marque uma categoria inteira.</span></div></div><div class="toolbar equipment-search-toolbar"><div class="search"><input id="eq-search" placeholder="Buscar ativo ou circuito"></div></div><div id="groups" class="groups equipment-groups"><div class="panel empty">Carregando ativos...</div></div><div class="sticky-actions mobile-selection-dock"><div class="selection-dock-copy"><span><strong id="sel-count">${state.selected.size}</strong> ativo(s) selecionado(s)</span><small id="sel-preview">Selecione um ativo para continuar</small></div><button class="btn primary" id="continue" ${state.selected.size?'':'disabled'}>Prosseguir</button></div>`;
  document.getElementById('back-sub').onclick=renderSubstations;
  document.getElementById('continue').onclick=renderReview;
  const search=document.getElementById('eq-search');
  search.oninput=()=>drawGroups(search.value);
  drawGroups('');
  function allEquipment(){return [...(eq.eletronicos||[]),...(eq.reles||[]),...(eq.patio||[])]}
  function drawGroups(q){
    q=normalize(q);const defs=[['eletronicos','Eletrônicos'],['reles','Relés'],['patio','Pátio']],html=[];
    for(const [key,title] of defs){
      const items=(eq[key]||[]).filter(e=>!q||normalize([assetName(e),assetCircuit(e),e.label,e.tipo,e.modelo,e.serial,e.numeroOperativo].join(' ')).includes(q));
      if(!items.length)continue;
      const all=items.every(e=>state.selected.has(e.id)),cards=items.map(equipmentCard);
      html.push(`<section class="group"><label class="group-head"><input class="check group-check" type="checkbox" data-group="${key}" ${all?'checked':''}><strong>${title}</strong><span>${items.length} item(ns)</span></label><div class="equip-list">${cards.join('')}</div></section>`)
    }
    document.getElementById('groups').innerHTML=html.join('')||'<div class="panel empty">Nenhum ativo encontrado.</div>';
    document.querySelectorAll('.item-check').forEach(ch=>ch.onchange=()=>{ch.checked?state.selected.add(ch.value):state.selected.delete(ch.value);updateCount()});
    document.querySelectorAll('.group-check').forEach(ch=>ch.onchange=()=>{const key=ch.dataset.group;(eq[key]||[]).filter(e=>!q||normalize([assetName(e),assetCircuit(e),e.label,e.tipo,e.modelo,e.serial,e.numeroOperativo].join(' ')).includes(q)).forEach(e=>ch.checked?state.selected.add(e.id):state.selected.delete(e.id));drawGroups(search.value);updateCount()});
    updateCount()
  }
  function updateCount(){
    const count=state.selected.size,el=document.getElementById('sel-count'),btn=document.getElementById('continue'),preview=document.getElementById('sel-preview');
    if(el)el.textContent=count;if(btn)btn.disabled=!count;
    if(preview){const selected=allEquipment().filter(e=>state.selected.has(e.id));preview.textContent=!selected.length?'Selecione um ativo para continuar':selected.length===1?assetTitle(selected[0]):`${assetTitle(selected[0])} + ${selected.length-1} outro(s)`}
  }
}
async function renderReview(){state.screen='review';const s=currentSub(),sel=selectedEquipment();const cards=sel.map(e=>`<article class="review-card"><div><strong>${esc(assetName(e))}</strong>${assetCircuit(e)?`<small>Circuito: ${esc(assetCircuit(e))}</small>`:''}</div></article>`);main.innerHTML=`${steps(2)}<div class="head-row"><div><button class="back" id="back-eq" type="button" aria-label="Voltar aos equipamentos" title="Voltar aos equipamentos"><span data-icon="arrow-left"></span></button><h2>Confirmar seleção · ${esc(s.sigla)}</h2><span class="muted">Confira a sequência dos ativos que serão atendidos.</span></div></div><section class="panel"><div class="hero"><div><h2>${sel.length} ativo(s) selecionado(s)</h2><p>${sel.length>1?'Será aberto um formulário por vez. Após concluir um ativo, o próximo será carregado automaticamente.':'Será aberto um formulário individual para o ativo selecionado.'}</p></div></div><div class="selection-review">${cards.join('')}</div><div style="display:flex;justify-content:flex-end;gap:9px;margin-top:20px"><button class="btn secondary" id="edit-selection">Alterar seleção</button><button class="btn primary" id="go-form">${sel.length>1?'Iniciar sequência':'Abrir formulário'}</button></div></section>`;document.getElementById('back-eq').onclick=renderEquipment;document.getElementById('edit-selection').onclick=renderEquipment;document.getElementById('go-form').onclick=()=>{initializeMaintenanceQueue();renderActivity()}}
function compactText(value){return normalize(value).replace(/[^a-z0-9]/g,'')}
function historyMatchesAsset(record,asset){if(Array.isArray(record.assetIds)&&record.assetIds.includes(asset.id))return true;const recordText=normalize([record.ativo,record.serial].filter(Boolean).join(' ')),recordCompact=compactText(recordText);const direct=[asset.identificacao,asset.numeroOperativo,asset.circuito].filter(Boolean).map(compactText).filter(token=>token.length>=4);if(direct.some(token=>recordCompact.includes(token)))return true;const codes=[asset.identificacao,asset.numeroOperativo,asset.label,asset.circuito].filter(Boolean).flatMap(value=>String(value).match(/\d{4,}/g)||[]),recordCodes=recordText.match(/\d{4,}/g)||[];if(codes.some(code=>recordCodes.includes(code)))return true;const serialTokens=String(asset.serial||'').split(/[^A-Za-z0-9]+/).map(compactText).filter(token=>token.length>=5);return serialTokens.some(token=>recordCompact.includes(token))}
function historyForAsset(asset,subId=state.sub){if(!asset)return[];return (DATA.histories[subId]||[]).filter(record=>historyMatchesAsset(record,asset))}
function relevantHistory(sel){const seen=new Set(),matched=[];for(const asset of sel){for(const record of historyForAsset(asset)){if(!seen.has(record.id)){seen.add(record.id);matched.push(record)}}}return matched.slice(0,40)}
function requiredLabel(text){return `${esc(text)} <span class="required-mark" aria-hidden="true">*</span>`}
function setFormValues(form,values={}){Object.entries(values||{}).forEach(([k,v])=>{const el=form.elements[k];if(!el)return;if(el instanceof RadioNodeList){return}if(el.type==='checkbox')el.checked=normalize(v)==='sim'||v===true||v==='on';else el.value=v??''})}
function formSnapshot(form){const data=Object.fromEntries(new FormData(form).entries());data.inconclusivo=form.elements.inconclusivo?.checked?'Sim':'Não';data.resultadoAtendimento=data.inconclusivo==='Sim'?'Inconclusivo':'Concluído';if(data.inconclusivo!=='Sim'){data.retorno='Não';data.motivoInconclusao=''}if(normalize(data.houvePeca)!=='sim'){data.peca='';data.destinoPeca=''}return data}
function yesNoOptions(includeNA=true){return `<option value="">Selecione</option><option>Sim</option><option>Não</option>${includeNA?'<option>Não se aplica</option>':''}`}
function updateConfigurationDetail(form,values={}){const box=document.getElementById('configuration-detail');if(!box)return;const show=normalize(form.elements.configuracaoRealizada?.value)==='sim';box.classList.toggle('hidden',!show);box.querySelectorAll('input,textarea,select').forEach(el=>{el.disabled=!show;el.required=show&&el.dataset.requiredWhenVisible==='true'});if(show&&values.configuracao&&form.elements.configuracao)form.elements.configuracao.value=values.configuracao}
function renderDynamicActivityFields(form,values={}){const target=document.getElementById('activity-fields');if(!target)return;const type=normalize(form.elements.tipo.value);let html='';if(type.includes('corretiva')){html=`<section class="dynamic-section"><div class="dynamic-section-head"><div><h3>Dados da manutenção corretiva</h3><p>Campos derivados de Defeito, Causa e Reparo realizado da base de atendimentos.</p></div><span class="smart-form-hint">Formulário dinâmico</span></div><div class="field full"><label>${requiredLabel('Defeito encontrado')}</label><textarea name="defeito" required placeholder="Descreva o defeito ou anormalidade identificada."></textarea></div><div class="field full"><label>${requiredLabel('Causa identificada ou provável')}</label><textarea name="causa" required placeholder="Informe a causa apurada ou a hipótese técnica."></textarea></div><div class="field full"><label>${requiredLabel('Reparo realizado')}</label><textarea name="reparo" required placeholder="Detalhe as ações executadas para corrigir o defeito."></textarea></div><div class="field full"><label>Comentários relevantes</label><textarea name="comentarios" placeholder="Informações complementares, testes ou recomendações."></textarea></div></section>`}else if(type.includes('preventiva')){html=`<section class="dynamic-section"><div class="dynamic-section-head"><div><h3>Checklist da manutenção preventiva</h3><p>Os campos obrigatórios seguem as colunas de controle da base de atendimentos.</p></div><span class="smart-form-hint">Checklist obrigatório</span></div><div class="field"><label>${requiredLabel('Arquitetura atualizada?')}</label><select name="arquiteturaAtualizada" required>${yesNoOptions()}</select></div><div class="field"><label>${requiredLabel('Projeto atualizado?')}</label><select name="projetoAtualizado" required>${yesNoOptions()}</select></div><div class="field"><label>${requiredLabel('Configuração realizada?')}</label><select name="configuracaoRealizada" required>${yesNoOptions()}</select></div><div class="field"><label>${requiredLabel('Ajuste de proteção conferido?')}</label><select name="ajusteProtecao" required>${yesNoOptions()}</select></div><div id="configuration-detail" class="conditional-panel hidden"><div class="field full"><label>${requiredLabel('Ativo e configuração realizada')}</label><textarea name="configuracao" data-required-when-visible="true" placeholder="Informe o ativo e descreva a configuração executada."></textarea></div></div><div class="field full"><label>${requiredLabel('Observações sobre a execução da atividade')}</label><textarea name="comentarios" required placeholder="Descreva testes, validações, resultados e observações da preventiva."></textarea></div></section>`}else if(type.includes('apoio')){html=`<section class="dynamic-section"><div class="dynamic-section-head"><div><h3>Dados do apoio em serviço de subestação</h3><p>Registre de forma objetiva a condição encontrada e o apoio executado.</p></div><span class="smart-form-hint">Campos da atividade</span></div><div class="field full"><label>${requiredLabel('Descrição ou condição da atividade')}</label><textarea name="defeito" required placeholder="Contextualize a necessidade do apoio."></textarea></div><div class="field full"><label>${requiredLabel('Serviço ou apoio executado')}</label><textarea name="reparo" required placeholder="Descreva o que foi realizado pela equipe."></textarea></div><div class="field full"><label>Comentários relevantes</label><textarea name="comentarios" placeholder="Pendências, validações ou observações complementares."></textarea></div></section>`}else{html=`<section class="dynamic-section"><div class="dynamic-section-head"><div><h3>Detalhes da atividade</h3><p>Selecione o tipo de manutenção para carregar os campos correspondentes.</p></div><span class="smart-form-hint">Aguardando seleção</span></div><p class="validation-note">O formulário será ajustado automaticamente.</p></section>`}target.innerHTML=html;setFormValues(form,values);if(form.elements.configuracaoRealizada){form.elements.configuracaoRealizada.onchange=()=>updateConfigurationDetail(form,{});updateConfigurationDetail(form,values)}}
function updatePieceFields(form,values={}){const box=document.getElementById('piece-fields');if(!box)return;const show=normalize(form.elements.houvePeca?.value)==='sim';box.classList.toggle('hidden',!show);box.querySelectorAll('input,select,textarea').forEach(el=>{el.disabled=!show;el.required=show&&el.dataset.requiredWhenVisible==='true'});if(show)setFormValues(form,values)}
function updateInconclusiveFields(form,values={}){const card=document.getElementById('conclusion-card'),box=document.getElementById('inconclusive-fields');if(!card||!box)return;const show=!!form.elements.inconclusivo?.checked;card.classList.toggle('active',show);box.classList.toggle('hidden',!show);box.querySelectorAll('input,select,textarea').forEach(el=>{el.disabled=!show;el.required=show&&el.dataset.requiredWhenVisible==='true'});if(show)setFormValues(form,values)}
function setupSmartForm(form,values={}){form.elements.tipo.onchange=()=>renderDynamicActivityFields(form,{});form.elements.houvePeca.onchange=()=>updatePieceFields(form,{});form.elements.inconclusivo.onchange=()=>updateInconclusiveFields(form,{});renderDynamicActivityFields(form,values);updatePieceFields(form,values);updateInconclusiveFields(form,values)}
async function renderActivity(){state.screen='activity';if(!state.maintenanceQueue.length)initializeMaintenanceQueue();const s=currentSub(),allQueued=queueAssets(),sel=currentFormAssets();if(!sel.length)return renderReview();const current=sel[0],hist=relevantHistory(sel),total=allQueued.length,currentNumber=state.queueIndex+1;state.folderAsset=current.id;const profiles={};profiles[current.id]=await photoForAsset(current.id);const assetCards=sel.map(e=>`<article class="asset-summary-card">${assetProfileFrame(e,profiles[e.id])}<div class="asset-summary-info"><div class="asset-summary-head"><strong>${esc(assetName(e))}</strong>${assetCircuit(e)?`<span class="circuit-badge">${esc(assetCircuit(e))}</span>`:''}</div><div class="asset-meta">${[['Fabricante',e.fabricante],['Modelo',e.modelo],['Número de série',e.serial],['Número operativo',e.numeroOperativo],['Identificação',e.identificacao&&normalize(e.identificacao)!==normalize(assetCircuit(e))?e.identificacao:''],['Última manutenção',e.ultimaManutencao]].filter(x=>x[1]).map(x=>`<span><b>${esc(x[0])}</b>${esc(x[1])}</span>`).join('')||'<span>Sem informações cadastrais complementares.</span>'}</div></div></article>`).join('');const sequence=total>1?`<section class="maintenance-sequence"><div class="maintenance-sequence-head"><strong>Sequência de manutenção</strong><span>Ativo ${currentNumber} de ${total}</span></div><div class="sequence-assets">${allQueued.map((e,i)=>`<span class="sequence-chip ${i<state.queueIndex?'done':i===state.queueIndex?'current':''}">${esc(assetTitle(e))}</span>`).join('')}</div></section>`:'';main.innerHTML=`${steps(3)}<div class="head-row"><div><button class="back" id="back-review" type="button" aria-label="Voltar à confirmação" title="Voltar à confirmação"><span data-icon="arrow-left"></span></button><h2>Registrar manutenção · ${esc(s.sigla)}</h2><span class="muted">${total>1?`Preenchendo o ativo ${currentNumber} de ${total}`:'1 ativo selecionado'}</span></div></div><div id="saved-note"></div>${sequence}<div class="activity-layout"><section class="panel"><div class="section-title asset-summary-title"><h3>Ativo em atendimento</h3></div><div class="asset-summary-grid">${assetCards}</div><form id="form" class="form-grid"><div class="field"><label>${requiredLabel('Data do atendimento')}</label><input type="date" name="data" required></div><div class="field"><label>${requiredLabel('Tipo de manutenção')}</label><select name="tipo" required><option value="">Selecione</option>${DATA.maintenanceTypes.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Ordem de serviço</label><input name="os" placeholder="Ex.: ESO-IAP 0001/26"></div><div class="field"><label>${requiredLabel('Equipe técnica responsável')}</label><input name="equipe" required placeholder="Nomes da equipe"></div><div class="field"><label>Início do atendimento</label><input type="time" name="inicio"></div><div class="field"><label>Fim do atendimento</label><input type="time" name="fim"></div><div id="activity-fields" class="field full"></div><div class="field"><label>${requiredLabel('Houve substituição de peça?')}</label><select name="houvePeca" required><option>Não</option><option>Sim</option></select></div><p class="validation-note">Os campos de peça aparecem somente quando a resposta for “Sim”.</p><section id="piece-fields" class="dynamic-section piece-section hidden"><div class="dynamic-section-head"><div><h3>Peça substituída</h3><p>Identifique a peça e registre o destino do material retirado.</p></div><span class="smart-form-hint">Preenchimento obrigatório</span></div><div class="field"><label>${requiredLabel('Peça substituída')}</label><input name="peca" data-required-when-visible="true" placeholder="Código, descrição, série retirada e instalada"></div><div class="field"><label>${requiredLabel('Destino da peça retirada')}</label><select name="destinoPeca" data-required-when-visible="true"><option value="">Selecione</option><option>Estoque</option><option>Enviada para reparo</option><option>Descarte</option><option>Permaneceu no local</option><option>Outro</option></select></div></section><div class="field full"><section id="conclusion-card" class="conclusion-card"><label class="conclusion-check"><input type="checkbox" name="inconclusivo" value="Sim"><span><strong>Atendimento não conclusivo</strong><span>Marque quando a atividade não puder ser finalizada. O relatório receberá a tag <b>Inconclusivo</b> na Relatórios.</span></span></label><div id="inconclusive-fields" class="conditional-panel hidden"><div class="field full"><label>${requiredLabel('Motivo ou pendência para conclusão')}</label><textarea name="motivoInconclusao" data-required-when-visible="true" placeholder="Descreva o que impediu a conclusão e o que permanece pendente."></textarea></div><div class="field"><label>${requiredLabel('Necessário retorno?')}</label><select name="retorno" data-required-when-visible="true"><option value="">Selecione</option><option>Sim</option><option>A definir</option><option>Não</option></select></div></div></section></div><div class="field full"><div class="section-title"><h3>Imagens da manutenção</h3><span class="muted" style="font-size:11px">As fotos ficam na pasta deste ativo.</span></div><div id="upload-zone" class="upload-zone"><strong>Adicionar fotos ou tirar uma foto</strong><p>Antes, durante, depois, defeito, peça substituída ou identificação.</p><button type="button" class="btn secondary" id="pick-photos">Selecionar imagens</button><input id="photo-input" type="file" accept="image/*" capture="environment" multiple class="hidden"></div><div id="photo-grid" class="photo-grid"></div></div><p class="validation-note"><span class="required-mark">*</span> Campo obrigatório.</p><div class="field full" style="display:flex;flex-direction:row;justify-content:flex-end;gap:8px"><button type="button" class="btn secondary" id="save-draft">Salvar rascunho completo</button><button class="btn primary" type="submit">${hasNextQueuedAsset()?'Enviar e abrir próximo':'Concluir manutenção'}</button></div></form></section><aside class="panel"><div class="tabs"><button data-tab="history" class="${state.tab==='history'?'active':''}">Histórico</button><button data-tab="folder" class="${state.tab==='folder'?'active':''}">Pasta do ativo</button></div><div id="side-content"></div></aside></div>`;document.getElementById('back-review').onclick=renderReview;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderSide(hist,sel)});document.querySelectorAll('[data-profile-photo]').forEach(b=>b.onclick=()=>chooseProfilePhoto(b.dataset.profilePhoto));const form=document.getElementById('form');form.data.value=new Date().toISOString().slice(0,10);document.getElementById('pick-photos').onclick=()=>document.getElementById('photo-input').click();document.getElementById('photo-input').onchange=e=>addPendingPhotos([...e.target.files]);const zone=document.getElementById('upload-zone');['dragenter','dragover'].forEach(n=>zone.addEventListener(n,e=>{e.preventDefault();zone.classList.add('drag')}));['dragleave','drop'].forEach(n=>zone.addEventListener(n,e=>{e.preventDefault();zone.classList.remove('drag')}));zone.addEventListener('drop',e=>addPendingPhotos([...e.dataTransfer.files].filter(f=>f.type.startsWith('image/'))));document.getElementById('save-draft').onclick=()=>saveDraft(form);form.onsubmit=e=>submitMaintenance(e,form,sel);const restored=await restoreDraft(form);setupSmartForm(form,restored||{});drawPendingPhotos(sel);renderSide(hist,sel)}
async function addPendingPhotos(files){for(const f of files){if(!f.type.startsWith('image/'))continue;const blob=await compressImage(f);state.pendingPhotos.push({id:uid(),blob,category:'Antes',assetId:'all',caption:'',asProfile:false,originalName:f.name})}drawPendingPhotos(currentFormAssets())}
function drawPendingPhotos(sel){const el=document.getElementById('photo-grid');if(!el)return;el.innerHTML=state.pendingPhotos.map((p,i)=>`<article class="photo-item"><img src="${blobUrl(p.blob)}" alt="Prévia"><div class="photo-item-body"><div class="photo-row"><select data-p="${i}" data-field="category">${['Antes','Durante','Depois','Defeito encontrado','Peça substituída','Identificação','Outro'].map(x=>`<option ${p.category===x?'selected':''}>${x}</option>`).join('')}</select><select data-p="${i}" data-field="assetId"><option value="all" ${p.assetId==='all'?'selected':''}>Todos os ativos</option>${sel.map(e=>`<option value="${e.id}" ${p.assetId===e.id?'selected':''}>${esc(e.label)}</option>`).join('')}</select></div><input data-p="${i}" data-field="caption" value="${esc(p.caption)}" placeholder="Legenda opcional"><label class="profile-check"><input type="checkbox" data-p="${i}" data-field="asProfile" ${p.asProfile?'checked':''} ${p.assetId==='all'?'disabled':''}> Usar também como foto principal do ativo escolhido</label><button type="button" class="remove-photo" data-remove="${i}">Remover imagem</button></div></article>`).join('');el.querySelectorAll('[data-field]').forEach(x=>x.onchange=()=>{const p=state.pendingPhotos[+x.dataset.p];p[x.dataset.field]=x.type==='checkbox'?x.checked:x.value;if(x.dataset.field==='assetId'&&x.value==='all')p.asProfile=false;drawPendingPhotos(sel)});el.querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{state.pendingPhotos.splice(+x.dataset.remove,1);drawPendingPhotos(sel)})}
async function saveDraft(form){const current=currentFormAssets()[0];const draft={id:'current',subestacao:state.sub,assetId:current?.id||null,maintenanceQueue:[...state.maintenanceQueue],queueIndex:state.queueIndex,batchId:state.batchId,form:formSnapshot(form),photos:state.pendingPhotos,salvoEm:new Date().toISOString(),user:currentUser()};await idbPut('drafts',draft);document.getElementById('saved-note').innerHTML='<div class="success">Rascunho deste ativo salvo no dispositivo, incluindo os campos dinâmicos e as imagens.</div>';window.scrollTo({top:0,behavior:'smooth'})}
async function restoreDraft(form){const d=await idbGet('drafts','current'),current=currentFormAssets()[0];if(!d||d.subestacao!==state.sub||d.assetId!==current?.id)return null;if(Array.isArray(d.maintenanceQueue)&&d.maintenanceQueue.length){state.maintenanceQueue=d.maintenanceQueue;state.queueIndex=Number.isInteger(d.queueIndex)?d.queueIndex:state.queueIndex;state.batchId=d.batchId||state.batchId}setFormValues(form,d.form||{});state.pendingPhotos=d.photos||[];document.getElementById('saved-note').innerHTML='<div class="success">Rascunho deste ativo restaurado.</div>';return d.form||{}}
async function submitMaintenance(ev,form,sel){ev.preventDefault();if(!form.reportValidity())return;const maintenanceId=uid(),formData=formSnapshot(form),resultado=formData.resultadoAtendimento==='Inconclusivo'?'inconclusivo':'concluido',savedOffline=!navigator.onLine;const record={id:maintenanceId,version:APP_VERSION,batchId:state.batchId,batchPosition:state.queueIndex+1,batchTotal:state.maintenanceQueue.length||1,usuario:currentUser(),subestacao:state.sub,equipamentos:sel.map(e=>e.id),equipamentosSnapshot:sel,form:formData,resultado,criadoEm:new Date().toISOString(),status:savedOffline?'aguardando_envio':'salvo_local'};await idbPut('maintenanceRecords',record);for(let i=0;i<state.pendingPhotos.length;i++){const p=state.pendingPhotos[i];const assetIds=p.assetId==='all'?sel.map(e=>e.id):[p.assetId];for(const assetId of assetIds){await idbPut('maintenancePhotos',{id:`${maintenanceId}_${assetId}_${i}`,maintenanceId,assetId,blob:p.blob,category:p.category,caption:p.caption,criadoEm:record.criadoEm});if(p.asProfile&&p.assetId!=='all')await idbPut('assetPhotos',{assetId,blob:p.blob,updatedAt:record.criadoEm})}}await idbDelete('drafts','current');state.pendingPhotos=[];state.queueCompleted=Math.max(state.queueCompleted,state.queueIndex+1);await updateConnectivityIndicator();if(hasNextQueuedAsset()){const finished=assetTitle(sel[0]);state.queueIndex+=1;state.tab='history';toast(`Relatório de ${finished} salvo. Abrindo o próximo ativo.`);window.scrollTo({top:0,behavior:'smooth'});return renderActivity()}const inconclusive=resultado==='inconclusivo',total=state.maintenanceQueue.length||1;main.innerHTML=`${steps(3)}<section class="panel" style="max-width:720px;margin:auto;text-align:center;padding:48px 25px"><div style="font-size:55px;color:${inconclusive?'var(--orange)':'var(--success)'}">${inconclusive?'!':'✓'}</div><h2>${total>1?`${total} relatórios registrados`:(inconclusive?'Atendimento registrado como inconclusivo':'Manutenção registrada')}</h2><p class="muted">${total>1?`A sequência foi concluída e cada ativo recebeu um relatório individual.`:`O relatório de ${esc(assetTitle(sel[0]))} foi salvo localmente.`} ${savedOffline?'Como o dispositivo estava offline, o status ficou como <b>Aguardando envio</b>.':'O registro foi salvo com a conexão disponível.'}</p><div style="display:flex;justify-content:center;gap:9px;flex-wrap:wrap"><button class="btn secondary" id="go-home">Ir para o início</button><button class="btn secondary" id="view-assets">Voltar aos ativos</button><button class="btn primary" id="new">Nova manutenção</button></div></section>`;document.getElementById('go-home').onclick=()=>{resetMaintenanceFlow();renderHome()};document.getElementById('new').onclick=()=>{state.selected.clear();resetMaintenanceFlow();renderSubstations()};document.getElementById('view-assets').onclick=()=>{resetMaintenanceFlow();state.selected.clear();renderEquipment()}}
async function renderSide(hist,sel){const side=document.getElementById('side-content');if(!side)return;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));if(state.tab==='history'){side.innerHTML=`<p class="muted" style="font-size:12px">Histórico exclusivo do ativo em atendimento.</p><div class="history">${hist.length?hist.map(r=>`<article class="history-card"><div class="date">${formatDate(r.data)} · ${esc(r.os||'Sem OS')}</div><h4>${esc(r.tipoManutencao||'Atendimento')} — ${esc(r.ativo||r.tipoEquipamento)}</h4>${r.equipe?`<p><b>Equipe:</b> ${esc(r.equipe)}</p>`:''}${r.reparo?`<p><b>Reparo:</b> ${esc(r.reparo)}</p>`:''}${r.comentarios?`<p>${esc(r.comentarios)}</p>`:''}${r.pecaSubstituida?`<p><b>Peça:</b> ${esc(r.pecaSubstituida)}</p>`:''}</article>`).join(''):'<div class="empty">Sem histórico vinculado.</div>'}</div>`;return}side.innerHTML=`<div class="asset-folder-controls"><select id="folder-asset">${sel.map(e=>`<option value="${e.id}" ${state.folderAsset===e.id?'selected':''}>${esc(assetTitle(e))}</option>`).join('')}</select></div><div id="folder-body"><div class="empty">Carregando pasta...</div></div>`;document.getElementById('folder-asset').onchange=e=>{state.folderAsset=e.target.value;renderSide(hist,sel)};const asset=sel.find(e=>e.id===state.folderAsset),profile=await photoForAsset(state.folderAsset),photos=await idbByIndex('maintenancePhotos','assetId',state.folderAsset);document.getElementById('folder-body').innerHTML=`<div class="folder-profile">${profile?`<img src="${blobUrl(profile)}" alt="Foto principal">`:'<div class="equip-placeholder"><span data-icon="settings"></span></div>'}<div><strong>${esc(assetTitle(asset||{}))}</strong><div class="muted" style="font-size:11px;margin-top:5px">${profile?'Foto principal cadastrada':'Sem foto principal — adicione no quadro do ativo no formulário'}</div><div class="muted" style="font-size:11px">${photos.length} foto(s) de manutenção</div></div></div><div class="folder-gallery">${photos.length?photos.sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm))).map(p=>`<article class="folder-photo" data-open-photo="${p.id}"><img src="${blobUrl(p.blob)}" alt=""><div><b>${esc(p.category)}</b>${p.caption?` · ${esc(p.caption)}`:''}<br>${formatDate(p.criadoEm)}</div></article>`).join(''):'<div class="empty" style="grid-column:1/-1">As fotos vinculadas às manutenções aparecerão aqui.</div>'}</div>`;document.querySelectorAll('[data-open-photo]').forEach(c=>c.onclick=async()=>{const p=(await idbGet('maintenancePhotos',c.dataset.openPhoto));openPhoto(p)})}
function openPhoto(p){document.getElementById('modal-root').innerHTML=`<div class="modal" id="photo-modal"><div class="modal-card photo-modal-card"><button class="modal-close" id="close-modal" type="button" aria-label="Fechar"><span data-icon="x"></span></button><img src="${blobUrl(p.blob)}" alt=""><h3>${esc(p.category||'Imagem')}</h3>${p.caption?`<p>${esc(p.caption)}</p>`:''}</div></div>`;document.getElementById('close-modal').onclick=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('photo-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()}}
window.addEventListener('online',async()=>{await updateConnectivityIndicator();toast('Conexão reconhecida. Relatórios com status Aguardando envio permanecem identificados até a sincronização com a nuvem.')});
window.addEventListener('offline',async()=>{await updateConnectivityIndicator();toast('Sem conexão. Novos relatórios serão salvos com o status Aguardando envio.','notice')});


/* ===== v0.4.0: persistência local completa, revisão, fila e auditoria ===== */
window.CENTRAL_CLOUD_CONFIG=window.CENTRAL_CLOUD_CONFIG||{enabled:false};
const STATUS_META={
  aguardando_envio:{label:'Aguardando envio',className:'pending'},
  aguardando_nuvem:{label:'Aguardando configuração da nuvem',className:'waiting-cloud'},
  enviando:{label:'Enviando',className:'sent'},
  enviado:{label:'Enviado',className:'sent'},
  corrigido:{label:'Corrigido',className:'corrected'},
  aprovado:{label:'Aprovado',className:'approved'},
  erro_sincronizacao:{label:'Erro de sincronização',className:'sync-error'},
  salvo_local:{label:'Salvo localmente',className:'draft'}
};
const FORM_LABELS={data:'Data do atendimento',tipo:'Tipo de manutenção',os:'Ordem de serviço',equipe:'Equipe técnica responsável',inicio:'Início do atendimento',fim:'Fim do atendimento',defeito:'Defeito/condição encontrada',causa:'Causa',reparo:'Reparo/serviço realizado',comentarios:'Observações',arquiteturaAtualizada:'Arquitetura atualizada?',projetoAtualizado:'Projeto atualizado?',configuracaoRealizada:'Configuração realizada?',configuracao:'Ativo e configuração realizada',ajusteProtecao:'Ajuste de proteção conferido?',houvePeca:'Houve substituição de peça?',peca:'Peça substituída',destinoPeca:'Destino da peça retirada',inconclusivo:'Atendimento inconclusivo?',motivoInconclusao:'Motivo/pendência',retorno:'Necessário retorno?',resultadoAtendimento:'Resultado',justificativaAlteracao:'Justificativa da alteração'};
function statusMeta(status){return STATUS_META[status]||{label:String(status||'Sem status').replaceAll('_',' '),className:'draft'}}
function statusPill(status){const meta=statusMeta(status);return `<span class="status-pill ${meta.className}">${esc(meta.label)}</span>`}
function cloudConfigured(){return !!(window.CENTRAL_SYNC_ADAPTER&&typeof window.CENTRAL_SYNC_ADAPTER.sendReport==='function'&&state.cloudUser)}
function getDeviceCode(){let code=localStorage.getItem('central_manutencao_device_code');if(!code){code=Math.random().toString(36).slice(2,7).toUpperCase();localStorage.setItem('central_manutencao_device_code',code)}return code}
function generateReportNumber(){const now=new Date(),date=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;const key='central_manutencao_report_seq_'+date;const seq=Number(localStorage.getItem(key)||0)+1;localStorage.setItem(key,String(seq));return `MAN-${date}-${getDeviceCode()}-${String(seq).padStart(4,'0')}`}
function ensureReportNumber(){if(!state.activeReportNumber)state.activeReportNumber=generateReportNumber();return state.activeReportNumber}
function currentDraftId(){if(state.activeDraftId)return state.activeDraftId;const asset=currentFormAssets()[0];state.activeDraftId=`draft:${state.batchId||'single'}:${asset?.id||'unknown'}:${state.queueIndex}`;return state.activeDraftId}
function reportRequiresSync(status){return ['aguardando_envio','aguardando_nuvem','erro_sincronizacao','corrigido'].includes(status)}
async function addAudit(recordId,action,reason='',changes=[],statusFrom='',statusTo=''){const entry={id:uid(),recordId,action,reason,changes,statusFrom,statusTo,user:currentUser(),createdAt:new Date().toISOString()};await idbPut('auditLogs',entry);return entry}
async function auditForRecord(recordId){return (await idbByIndex('auditLogs','recordId',recordId)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))}
function formChanges(before={},after={}){const keys=[...new Set([...Object.keys(before||{}),...Object.keys(after||{})])];return keys.filter(k=>k!=='justificativaAlteracao'&&String(before?.[k]??'')!==String(after?.[k]??'')).map(k=>({field:k,label:FORM_LABELS[k]||k,before:String(before?.[k]??''),after:String(after?.[k]??'')}))}
async function enqueueSync(record){const existing=(await idbByIndex('syncQueue','recordId',record.id))[0];const item={id:existing?.id||`sync:${record.id}`,recordId:record.id,idempotencyKey:record.id,ownerId:localOwnerId(record)||state.cloudUser?.id||null,status:'pendente',attempts:existing?.attempts||0,lastError:'',createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};await idbPut('syncQueue',item);return item}
async function sendRecordThroughAdapter(record){if(window.CENTRAL_SYNC_ADAPTER&&typeof window.CENTRAL_SYNC_ADAPTER.sendReport==='function'){const photos=await idbByIndex('maintenancePhotos','maintenanceId',record.id);return await window.CENTRAL_SYNC_ADAPTER.sendReport({record,photos,idempotencyKey:record.id})}throw new Error('Integração com a nuvem ainda não configurada.')}
async function processSyncQueue({force=false}={}){if(state.syncing||!navigator.onLine)return {processed:0};const allItems=(await idbAll('syncQueue')).filter(i=>['pendente','erro'].includes(i.status)),items=[];for(const item of allItems){const record=await idbGet('maintenanceRecords',item.recordId);if(record&&belongsToCurrentUser(record))items.push(item)}if(!items.length)return {processed:0};if(!cloudConfigured()){await updateConnectivityIndicator();return {processed:0,configured:false}}state.syncing=true;let processed=0;try{for(const item of items){const record=await idbGet('maintenanceRecords',item.recordId);if(!record){await idbDelete('syncQueue',item.id);continue}try{item.status='enviando';item.attempts=(item.attempts||0)+1;item.updatedAt=new Date().toISOString();await idbPut('syncQueue',item);record.status='enviando';await idbPut('maintenanceRecords',record);const result=await sendRecordThroughAdapter(record);const previous=record.status;record.status=result?.status||'enviado';record.sincronizadoEm=new Date().toISOString();record.servidorId=result?.serverId||result?.id||record.servidorId||null;record.updatedAt=record.sincronizadoEm;await idbPut('maintenanceRecords',record);item.status='concluido';item.updatedAt=record.sincronizadoEm;item.lastError='';await idbPut('syncQueue',item);await addAudit(record.id,'sincronizado','Registro enviado à base principal.',[],previous,record.status);processed++}catch(error){record.status='erro_sincronizacao';record.updatedAt=new Date().toISOString();await idbPut('maintenanceRecords',record);item.status='erro';item.lastError=String(error?.message||error);item.updatedAt=record.updatedAt;await idbPut('syncQueue',item)}}}finally{state.syncing=false;await updateConnectivityIndicator()}return {processed}}
function scheduleAutoSave(){clearTimeout(state.autoSaveTimer);const form=document.getElementById('form');if(!form||state.screen!=='activity')return;const line=document.getElementById('autosave-line');if(line){line.className='autosave-line saving';line.querySelector('.autosave-text').textContent='Salvando alterações…'}state.autoSaveTimer=setTimeout(async()=>{try{await saveDraft(form,{silent:true,auto:true});const l=document.getElementById('autosave-line');if(l){l.className='autosave-line saved';l.querySelector('.autosave-text').textContent='Rascunho salvo automaticamente neste dispositivo'}}catch(error){const l=document.getElementById('autosave-line');if(l){l.className='autosave-line';l.querySelector('.autosave-text').textContent='Não foi possível salvar automaticamente'}}},650)}

const _baseSetupSmartForm=setupSmartForm;
setupSmartForm=function(form,values={}){_baseSetupSmartForm(form,values);form.addEventListener('input',scheduleAutoSave);form.addEventListener('change',scheduleAutoSave)};
const _baseDrawPendingPhotos=drawPendingPhotos;
drawPendingPhotos=function(sel){_baseDrawPendingPhotos(sel);scheduleAutoSave()};

saveDraft=async function(form,options={}){const silent=options===true||options?.silent;const current=currentFormAssets()[0];if(!current||!form)return null;if(!state.batchId)state.batchId=uid();const draft={id:currentDraftId(),reportNumber:ensureReportNumber(),editingRecordId:state.editingRecordId||null,subestacao:state.sub,assetId:current.id,assetSnapshot:current,maintenanceQueue:[...state.maintenanceQueue],queueIndex:state.queueIndex,batchId:state.batchId,form:formSnapshot(form),photos:state.pendingPhotos,salvoEm:new Date().toISOString(),user:currentUser(),version:APP_VERSION};await idbPut('drafts',draft);if(!silent){const note=document.getElementById('saved-note');if(note)note.innerHTML=`<div class="success">Rascunho salvo neste dispositivo.</div>`;toast('Rascunho salvo com sucesso.')}return draft};
restoreDraft=async function(form){const current=currentFormAssets()[0];if(!current)return null;let d=state.activeDraftId?await idbGet('drafts',state.activeDraftId):null;if(!d){const drafts=await currentUserLocalRecords('drafts');d=drafts.filter(x=>x.subestacao===state.sub&&x.assetId===current.id&&(!state.editingRecordId||x.editingRecordId===state.editingRecordId)).sort((a,b)=>String(b.salvoEm).localeCompare(String(a.salvoEm)))[0]}if(!d){const legacy=await idbGet('drafts','current');if(legacy&&belongsToCurrentUser(legacy)&&legacy.subestacao===state.sub&&legacy.assetId===current.id)d=legacy}if(!d)return null;state.activeDraftId=d.id;state.activeReportNumber=d.reportNumber||ensureReportNumber();state.editingRecordId=d.editingRecordId||state.editingRecordId;if(Array.isArray(d.maintenanceQueue)&&d.maintenanceQueue.length){state.maintenanceQueue=d.maintenanceQueue;state.queueIndex=Number.isInteger(d.queueIndex)?d.queueIndex:state.queueIndex;state.batchId=d.batchId||state.batchId}setFormValues(form,d.form||{});state.pendingPhotos=d.photos||[];const note=document.getElementById('saved-note');if(note)note.innerHTML=`<div class="success">Rascunho restaurado.</div>`;return d.form||{}};

const _baseRenderActivity=renderActivity;
renderActivity=async function(){await _baseRenderActivity();const form=document.getElementById('form');if(!form)return;ensureReportNumber();document.getElementById('autosave-line')?.remove();const submit=form.querySelector('button[type="submit"]');if(submit)submit.textContent=state.editingRecordId?'Revisar correção':'Revisar relatório';if(state.editingRecordId&&!document.getElementById('controlled-edit')){const actions=submit?.closest('.field.full');actions?.insertAdjacentHTML('beforebegin',`<div class="field full"><section id="controlled-edit" class="controlled-edit"><h3>Alteração controlada</h3><p>Este relatório já foi registrado. Informe o motivo da correção; o valor anterior e o novo serão mantidos no histórico.</p><label>${requiredLabel('Justificativa da alteração')}</label><textarea name="justificativaAlteracao" required placeholder="Explique por que o relatório precisa ser alterado."></textarea></section></div>`);const original=state.editingOriginal;const banner=`<section class="edit-banner"><div><strong>Editando relatório</strong><span>Status atual: ${esc(statusMeta(original?.status).label)}. A confirmação criará uma nova revisão sem apagar o conteúdo anterior.</span></div>${statusPill(original?.status)}</section>`;document.querySelector('.activity-layout')?.insertAdjacentHTML('beforebegin',banner)}form.addEventListener('input',scheduleAutoSave);form.addEventListener('change',scheduleAutoSave)};

function reviewRows(form){const primary=['data','tipo','os','equipe','inicio','fim','resultadoAtendimento','houvePeca'];return primary.filter(k=>form[k]).map(k=>[FORM_LABELS[k]||k,k==='data'?formatDate(form[k]):form[k]])}
function reviewBlocks(form){const keys=['defeito','causa','reparo','arquiteturaAtualizada','projetoAtualizado','configuracaoRealizada','configuracao','ajusteProtecao','peca','destinoPeca','comentarios','motivoInconclusao','retorno','justificativaAlteracao'];return keys.filter(k=>form[k]&&normalize(form[k])!=='nao se aplica').map(k=>[FORM_LABELS[k]||k,form[k]])}
async function renderSubmissionReview(){const payload=state.reviewPayload;if(!payload)return renderActivity();state.screen='submission-review';const s=currentSub(),asset=payload.sel[0],rows=reviewRows(payload.formData),blocks=reviewBlocks(payload.formData),offline=!navigator.onLine;main.innerHTML=`${steps(4)}<section class="submission-review"><div class="review-hero"><div><button class="back" id="review-back" type="button" aria-label="Voltar ao formulário" title="Voltar ao formulário"><span data-icon="arrow-left"></span></button><h2>Revisar relatório</h2><p class="muted">Confira todos os dados antes de registrar. Após a confirmação, qualquer correção será auditada.</p></div></div><div class="review-layout"><section class="panel"><div class="review-section"><h3>Ativo e subestação</h3><div class="review-details"><div class="review-detail"><b>Subestação</b><span>${esc(s.sigla)} — ${esc(s.nome)}</span></div><div class="review-detail"><b>Ativo</b><span>${esc(assetTitle(asset))}</span></div><div class="review-detail"><b>Categoria</b><span>${esc(asset.grupo||'Não informada')}</span></div><div class="review-detail"><b>Circuito</b><span>${esc(assetCircuit(asset)||'Não informado')}</span></div></div></div><div class="review-section"><h3>Dados do atendimento</h3><div class="review-details">${rows.map(([k,v])=>`<div class="review-detail"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>${blocks.map(([k,v])=>`<div class="review-text"><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join('')}</div><div class="review-section"><h3>Imagens</h3>${state.pendingPhotos.length?`<div class="review-photo-grid">${state.pendingPhotos.map(p=>`<img src="${blobUrl(p.blob)}" alt="${esc(p.category||'Imagem')}">`).join('')}</div><p class="validation-note">${state.pendingPhotos.length} imagem(ns) será(ão) vinculada(s) a este ativo.</p>`:'<div class="empty">Nenhuma imagem adicionada.</div>'}</div></section><aside class="panel confirm-send">${offline?'<div class="offline-review"><b>Dispositivo offline.</b><br>O relatório será guardado na fila e enviado automaticamente quando a internet e a conexão com a nuvem estiverem disponíveis.</div>':''}${!cloudConfigured()?'<div class="cloud-required"><b>Nuvem ainda não configurada.</b><br>O relatório ficará protegido no dispositivo e marcado para envio. A integração será ativada após a criação do ambiente em nuvem.</div>':''}<h3 style="margin-top:0">Confirmação</h3><label class="confirm-box"><input id="confirm-review" type="checkbox"><span><strong>Revisei os dados acima</strong></span></label><div style="display:grid;gap:8px"><button class="btn primary" id="confirm-submit" disabled>${state.editingRecordId?'Confirmar correção':'Confirmar e registrar'}</button><button class="btn secondary" id="review-back-bottom">Voltar e corrigir</button></div></aside></div></section>`;const checkbox=document.getElementById('confirm-review'),button=document.getElementById('confirm-submit');checkbox.onchange=()=>button.disabled=!checkbox.checked;document.getElementById('review-back').onclick=document.getElementById('review-back-bottom').onclick=()=>{state.screen='activity';renderActivity()};button.onclick=finalizeReviewedMaintenance}
submitMaintenance=async function(ev,form,sel){ev.preventDefault();if(!form.reportValidity())return;const draft=await saveDraft(form,{silent:true});state.reviewPayload={formData:formSnapshot(form),sel,reportNumber:draft?.reportNumber||ensureReportNumber(),draftId:draft?.id||currentDraftId(),editingRecordId:state.editingRecordId};await renderSubmissionReview()};

async function persistPendingPhotos(recordId,sel,createdAt){for(let i=0;i<state.pendingPhotos.length;i++){const p=state.pendingPhotos[i],assetIds=p.assetId==='all'?sel.map(e=>e.id):[p.assetId];for(const assetId of assetIds){const photoId=`${recordId}_${assetId}_${Date.now()}_${i}_${Math.random().toString(36).slice(2,6)}`;await idbPut('maintenancePhotos',{id:photoId,maintenanceId:recordId,assetId,blob:p.blob,category:p.category,caption:p.caption,criadoEm:createdAt});if(p.asProfile&&p.assetId!=='all')await idbPut('assetPhotos',{assetId,blob:p.blob,updatedAt:createdAt})}}}
function initialLocalStatus(){if(!navigator.onLine)return 'aguardando_envio';return cloudConfigured()?'aguardando_envio':'aguardando_nuvem'}
async function finalizeReviewedMaintenance(){const payload=state.reviewPayload;if(!payload)return;const now=new Date().toISOString(),isEdit=!!state.editingRecordId;let record,oldStatus='',changes=[];if(isEdit){record=await idbGet('maintenanceRecords',state.editingRecordId);if(!record)return toast('O relatório original não foi encontrado.','warning');oldStatus=record.status;changes=formChanges(record.form||{},payload.formData);const reason=payload.formData.justificativaAlteracao||'';record={...record,version:APP_VERSION,form:payload.formData,resultado:payload.formData.resultadoAtendimento==='Inconclusivo'?'inconclusivo':'concluido',updatedAt:now,revisao:(record.revisao||1)+1,status:['enviado','aprovado','corrigido','reprovado'].includes(oldStatus)?'corrigido':initialLocalStatus(),ultimoEditor:currentUser()};await idbPut('maintenanceRecords',record);await persistPendingPhotos(record.id,payload.sel,now);await addAudit(record.id,'corrigido',reason,changes,oldStatus,record.status)}else{const id=uid();record={id,numeroRelatorio:payload.reportNumber,idempotencyKey:id,version:APP_VERSION,batchId:state.batchId,batchPosition:state.queueIndex+1,batchTotal:state.maintenanceQueue.length||1,usuario:currentUser(),subestacao:state.sub,equipamentos:payload.sel.map(e=>e.id),equipamentosSnapshot:payload.sel,form:payload.formData,resultado:payload.formData.resultadoAtendimento==='Inconclusivo'?'inconclusivo':'concluido',criadoEm:now,updatedAt:now,revisao:1,status:initialLocalStatus()};await idbPut('maintenanceRecords',record);await persistPendingPhotos(record.id,payload.sel,now);await addAudit(record.id,'criado','Relatório confirmado após a tela de revisão.',[], '',record.status)}await enqueueSync(record);if(payload.draftId)await idbDelete('drafts',payload.draftId);if(payload.draftId==='current')await idbDelete('drafts','current');state.pendingPhotos=[];state.reviewPayload=null;state.editingRecordId=null;state.editingOriginal=null;state.activeDraftId=null;state.activeReportNumber=null;await processSyncQueue();state.queueCompleted=Math.max(state.queueCompleted,state.queueIndex+1);await updateConnectivityIndicator();if(!isEdit&&hasNextQueuedAsset()){const finished=assetTitle(payload.sel[0]);state.queueIndex+=1;state.tab='history';toast(`Relatório de ${finished} registrado. Abrindo o próximo ativo.`);window.scrollTo({top:0,behavior:'smooth'});return renderActivity()}const inconclusive=record.resultado==='inconclusivo',total=isEdit?1:(state.maintenanceQueue.length||1),status=statusMeta(record.status);main.innerHTML=`${steps(4)}<section class="panel" style="max-width:760px;margin:auto;text-align:center;padding:48px 25px"><div style="font-size:55px;color:${inconclusive?'var(--orange)':'var(--success)'}">${isEdit?'✓':inconclusive?'!':'✓'}</div><h2>${isEdit?'Correção registrada':total>1?`${total} relatórios registrados`:inconclusive?'Atendimento registrado como inconclusivo':'Manutenção registrada'}</h2><p class="muted">Status: <b>${esc(status.label)}</b>. ${reportRequiresSync(record.status)?'O conteúdo permanece protegido neste dispositivo até ser confirmado pela base na nuvem.':'O registro foi processado.'}</p><div style="display:flex;justify-content:center;gap:9px;flex-wrap:wrap"><button class="btn secondary" id="go-home">Ir para o início</button><button class="btn secondary" id="open-created-report">Abrir relatório</button><button class="btn primary" id="new">Nova manutenção</button></div></section>`;document.getElementById('go-home').onclick=()=>{resetMaintenanceFlow();renderHome()};document.getElementById('new').onclick=()=>{state.selected.clear();resetMaintenanceFlow();renderSubstations()};document.getElementById('open-created-report').onclick=async()=>{state.reports=await combinedReports();openReportDetails('local:'+record.id)}}

const _baseResetMaintenanceFlow=resetMaintenanceFlow;
resetMaintenanceFlow=function(){_baseResetMaintenanceFlow();state.activeDraftId=null;state.activeReportNumber=null;state.editingRecordId=null;state.editingOriginal=null;state.reviewPayload=null;clearTimeout(state.autoSaveTimer)};

async function resumeDraft(draftId){const d=await idbGet('drafts',draftId);if(!d)return toast('Rascunho não encontrado.','warning');state.sub=d.subestacao;state.maintenanceQueue=d.maintenanceQueue?.length?d.maintenanceQueue:[d.assetId];state.selected=new Set(state.maintenanceQueue);state.queueIndex=d.queueIndex||0;state.batchId=d.batchId||uid();state.activeDraftId=d.id;state.activeReportNumber=d.reportNumber||null;state.editingRecordId=d.editingRecordId||null;if(state.editingRecordId)state.editingOriginal=await idbGet('maintenanceRecords',state.editingRecordId);state.pendingPhotos=[];setActiveNav('maintenance');await renderActivity()}
async function deleteDraftWithConfirmation(id){if(!confirm('Excluir este rascunho do dispositivo?'))return;await idbDelete('drafts',id);toast('Rascunho excluído.');renderHome()}
async function injectDraftsOnHome(){const drafts=(await currentUserLocalRecords('drafts')).filter(d=>d.id!=='current'&&d.assetId).sort((a,b)=>String(b.salvoEm).localeCompare(String(a.salvoEm)));if(!drafts.length)return;const anchor=document.querySelector('.action-section');if(!anchor)return;const section=document.createElement('section');section.className='draft-section';section.innerHTML=`<div class="draft-header"><div><h2>Rascunhos neste dispositivo</h2><span>Salvos automaticamente e disponíveis mesmo sem internet.</span></div><span>${drafts.length} rascunho(s)</span></div><div class="draft-list">${drafts.slice(0,8).map(d=>{const sub=DATA.substations.find(s=>s.id===d.subestacao),asset=(DATA.equipment[d.subestacao]?[...(DATA.equipment[d.subestacao].eletronicos||[]),...(DATA.equipment[d.subestacao].reles||[]),...(DATA.equipment[d.subestacao].patio||[])]:[]).find(e=>e.id===d.assetId);return `<article class="draft-card"><strong>${esc(assetTitle(asset||d.assetSnapshot||{}))}</strong><small>${esc(sub?.sigla||d.subestacao)}<br>Salvo em ${formatDate(d.salvoEm)} às ${new Date(d.salvoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small><div class="draft-actions"><button class="btn primary" data-resume-draft="${esc(d.id)}">Continuar</button><button class="btn danger-outline" data-delete-draft="${esc(d.id)}">Excluir</button></div></article>`}).join('')}</div>`;anchor.insertAdjacentElement('afterend',section);section.querySelectorAll('[data-resume-draft]').forEach(b=>b.onclick=()=>resumeDraft(b.dataset.resumeDraft));section.querySelectorAll('[data-delete-draft]').forEach(b=>b.onclick=()=>deleteDraftWithConfirmation(b.dataset.deleteDraft))}
const _baseRenderHomeV040=renderHome;
renderHome=async function(){await _baseRenderHomeV040();await injectDraftsOnHome()};

combinedReports=async function(){const local=await currentUserLocalRecords('maintenanceRecords');const locals=local.map(r=>{const form=r.form||{},outcome=r.resultado||(normalize(form.inconclusivo)==='sim'?'inconclusivo':'concluido');return {key:'local:'+r.id,source:'local',id:r.id,number:r.numeroRelatorio||r.id,subId:r.subestacao,substation:(DATA.substations.find(s=>s.id===r.subestacao)?.sigla||r.subestacao||'')+' — '+(DATA.substations.find(s=>s.id===r.subestacao)?.nome||''),date:form.data||r.criadoEm,createdAt:r.criadoEm,author:form.equipe||r.usuario?.name||'Equipe local',assets:(r.equipamentosSnapshot||[]).map(assetTitle),type:form.tipo||'Manutenção',status:r.status||'salvo_local',outcome,raw:r}});return [...locals,...importedReports()].sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))};
function reportTimeV040(value){if(!value)return -Infinity;const text=String(value).trim();if(/^\d{4}-\d{2}-\d{2}/.test(text)){const t=new Date(text.slice(0,10)+'T12:00:00').getTime();return Number.isNaN(t)?-Infinity:t}const br=text.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);if(br){const t=new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00`).getTime();return Number.isNaN(t)?-Infinity:t}const t=new Date(text).getTime();return Number.isNaN(t)?-Infinity:t}
renderOverview=async function(){if(state.role!=='admin'){toast('A área de Relatórios é exclusiva da Equipe Administrativa.','warning');return renderHome()}state.screen='overview';setActiveNav('overview');const reports=await combinedReports();state.reports=reports;const sortState={key:'date',dir:'desc'};main.innerHTML=`<div class="page-heading overview-heading"><div><h1>Relatórios</h1><p>Relatórios das equipes e histórico consolidado de manutenção.</p></div><div class="stats"><div class="stat"><strong>${reports.filter(r=>r.source!=='imported').length}</strong><span>registros locais</span></div><div class="stat"><strong>${reports.filter(r=>r.source!=='imported'&&reportRequiresSync(r.status)).length}</strong><span>aguardando nuvem</span></div><div class="stat"><strong>${reports.filter(r=>r.outcome==='inconclusivo').length}</strong><span>inconclusivos</span></div></div></div><section class="panel"><div class="inbox-toolbar"><div class="search"><input id="report-search" placeholder="Buscar por ativo, equipe, subestação ou tipo"></div><select id="report-source"><option value="">Todos os relatórios</option><option value="local">Registros deste dispositivo</option><option value="cloud">Relatórios na nuvem</option><option value="pending">Aguardando envio</option><option value="inconclusivo">Atendimentos inconclusivos</option><option value="imported">Histórico importado</option></select></div><div id="inbox"></div></section>`;const search=document.getElementById('report-search'),source=document.getElementById('report-source');function matchSource(r,value){if(!value)return true;if(value==='pending')return r.source!=='imported'&&reportRequiresSync(r.status);if(value==='inconclusivo')return r.outcome==='inconclusivo';return r.source===value}function sortValue(r,key){if(key==='asset')return normalize(r.assets.join(', ')||'');if(key==='author')return normalize(r.author||'');return reportTimeV040(r.date)}function sortIndicator(key){return sortState.key!==key?icon('arrows-sort'):sortState.dir==='asc'?icon('arrow-up'):icon('arrow-down')}function draw(){const q=normalize(search.value),src=source.value;const matched=reports.filter(r=>matchSource(r,src)&&(!q||normalize([r.number,r.author,r.substation,r.type,r.outcome,...r.assets].join(' ')).includes(q))).sort((a,b)=>{const av=sortValue(a,sortState.key),bv=sortValue(b,sortState.key),cmp=sortState.key==='date'?av-bv:String(av).localeCompare(String(bv),'pt-BR',{sensitivity:'base',numeric:true});return sortState.dir==='asc'?cmp:-cmp});const list=matched.slice(0,300);document.getElementById('inbox').innerHTML=`<div class="inbox"><div class="inbox-head"><span></span><button class="sort-header ${sortState.key==='asset'?'active':''}" data-sort="asset">Relatório / ativo <span class="sort-icon">${sortIndicator('asset')}</span></button><button class="sort-header ${sortState.key==='author'?'active':''}" data-sort="author">Responsável <span class="sort-icon">${sortIndicator('author')}</span></button><button class="sort-header ${sortState.key==='date'?'active':''}" data-sort="date">Data <span class="sort-icon">${sortIndicator('date')}</span></button></div>${list.length?list.map(r=>`<article class="inbox-row ${r.source!=='imported'?'unread':''}" data-report-key="${esc(r.key)}"><span class="report-dot ${r.outcome==='inconclusivo'?'inconclusive':r.source!=='imported'?'local':'sent'}"></span><div class="inbox-main"><strong>${esc(r.assets.join(', ')||'Ativo não informado')}</strong><span>${esc(r.type)} · ${esc(r.substation)}</span>${r.source!=='imported'?`<span class="status-wrap">${statusPill(r.status)}${r.outcome==='inconclusivo'?'<span class="status-pill inconclusive">Inconclusivo</span>':''}</span>`:r.outcome==='inconclusivo'?'<span class="status-wrap"><span class="status-pill inconclusive">Inconclusivo</span></span>':''}</div><div class="inbox-person"><b>${esc(r.author)}</b></div><div class="inbox-date"><b>${formatDate(r.date)}</b></div></article>`).join(''):'<div class="empty">Nenhum relatório encontrado.</div>'}</div><p class="database-note">Exibindo ${list.length} de ${matched.length} resultado(s). Clique em qualquer linha para abrir os detalhes.</p>`;document.querySelectorAll('[data-report-key]').forEach(row=>row.onclick=()=>openReportDetails(row.dataset.reportKey));document.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{const key=button.dataset.sort;if(sortState.key===key)sortState.dir=sortState.dir==='asc'?'desc':'asc';else{sortState.key=key;sortState.dir=key==='date'?'desc':'asc'}draw()})}search.oninput=draw;source.onchange=draw;draw()};
function canEditRecord(record){if(!record)return false;if(state.role==='admin')return true;return ['aguardando_envio','aguardando_nuvem','erro_sincronizacao','salvo_local'].includes(record.status)}
async function beginControlledEdit(record){if(!canEditRecord(record))return toast('Este relatório não pode ser alterado com o perfil atual.','warning');document.getElementById('modal-root').innerHTML='';state.sub=record.subestacao;state.maintenanceQueue=[...(record.equipamentos||[])];state.selected=new Set(state.maintenanceQueue);state.queueIndex=0;state.batchId=record.batchId||uid();state.activeReportNumber=record.numeroRelatorio;state.editingRecordId=record.id;state.editingOriginal=JSON.parse(JSON.stringify(record));state.activeDraftId=`edit:${record.id}`;state.pendingPhotos=[];const current=(record.equipamentosSnapshot||[])[0];await idbPut('drafts',{id:state.activeDraftId,reportNumber:record.numeroRelatorio,editingRecordId:record.id,subestacao:record.subestacao,assetId:current?.id||record.equipamentos?.[0],assetSnapshot:current,maintenanceQueue:state.maintenanceQueue,queueIndex:0,batchId:state.batchId,form:record.form||{},photos:[],salvoEm:new Date().toISOString(),user:currentUser(),version:APP_VERSION});setActiveNav('maintenance');renderActivity()}
async function approveRecord(record){if(state.role!=='admin')return;const reason=prompt('Observação da aprovação (opcional):','')??null;if(reason===null)return;const old=record.status;record.status='aprovado';record.aprovadoEm=new Date().toISOString();record.aprovadoPor=currentUser();record.updatedAt=record.aprovadoEm;await idbPut('maintenanceRecords',record);await addAudit(record.id,'aprovado',reason,[],old,'aprovado');await enqueueSync(record);await processSyncQueue();toast('Relatório aprovado.');state.reports=await combinedReports();openReportDetails('local:'+record.id)}
openReportDetails=async function(key){const r=state.reports.find(x=>x.key===key)||(await combinedReports()).find(x=>x.key===key);if(!r)return;const raw=r.raw,local=r.source!=='imported',form=local?(raw.form||{}):raw,photos=local?await idbByIndex('maintenancePhotos','maintenanceId',raw.id):[],audits=local?await auditForRecord(raw.id):[],inconclusive=local&&(r.outcome==='inconclusivo'||normalize(form.inconclusivo)==='sim');const fields=local?[['Status',statusMeta(raw.status).label],['Revisão',String(raw.revisao||1)],['Subestação',r.substation],['Data',formatDate(form.data||raw.criadoEm)],['Responsável',r.author],['Tipo',form.tipo],['Ordem de serviço',form.os],['Horário',[form.inicio,form.fim].filter(Boolean).join(' às ')],['Resultado',inconclusive?'Inconclusivo':'Concluído'],['Fotos anexadas',String(photos.length)],['Arquitetura atualizada?',form.arquiteturaAtualizada],['Projeto atualizado?',form.projetoAtualizado],['Configuração realizada?',form.configuracaoRealizada],['Ajuste de proteção conferido?',form.ajusteProtecao],['Houve substituição de peça?',form.houvePeca],['Necessário retorno?',form.retorno]]:[['Subestação',r.substation],['Data',formatDate(raw.data)],['Responsável',raw.equipe],['Tipo',raw.tipoManutencao],['Ordem de serviço',raw.os],['Horário',[raw.inicio,raw.fim].filter(Boolean).join(' às ')],['Fabricante',raw.fabricante],['Modelo',raw.modelo],['Número de série',raw.serial]];const blocks=local?[['Defeito encontrado ou condição da atividade',form.defeito],['Causa',form.causa],['Reparo/serviço realizado',form.reparo],['Ativo e configuração realizada',form.configuracao],['Peça substituída',form.peca],['Destino da peça retirada',form.destinoPeca],['Observações sobre a execução',form.comentarios],['Motivo ou pendência para conclusão',form.motivoInconclusao]]:[['Defeito ou condição encontrada',raw.defeito],['Causa',raw.causa],['Serviço/reparo realizado',raw.reparo],['Configuração',raw.configuracao],['Ativo substituído',raw.ativoSubstituido],['Peça substituída',raw.pecaSubstituida],['Comentários',raw.comentarios]];const approveAllowed=local&&state.role==='admin'&&['enviado','corrigido'].includes(raw.status);document.getElementById('modal-root').innerHTML=`<div class="modal" id="report-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="close-report" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="report-header"><div><div style="display:flex;gap:6px;flex-wrap:wrap">${local?statusPill(raw.status):''}${inconclusive?'<span class="status-pill inconclusive">Inconclusivo</span>':''}</div><h2>${esc(r.type)}</h2><p class="muted">${esc(r.substation)}</p></div></div><div class="detail-block" style="border:0;margin:0;padding:0"><h3>Ativos envolvidos</h3><div class="asset-tags">${r.assets.map(a=>`<span class="asset-tag">${esc(a)}</span>`).join('')}</div></div><div class="detail-grid" style="margin-top:15px">${fields.filter(x=>x[1]).map(([k,v])=>`<div class="detail-box"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>${blocks.filter(x=>x[1]&&normalize(x[1])!=='nao se aplica').map(([k,v])=>`<div class="detail-block"><h3>${esc(k)}</h3><p>${esc(v)}</p></div>`).join('')}${photos.length?`<div class="detail-block"><h3>Imagens da manutenção</h3><div class="folder-gallery">${photos.map(p=>`<article class="folder-photo" data-modal-photo="${p.id}"><img src="${blobUrl(p.blob)}" alt=""><div><b>${esc(p.category||'Imagem')}</b>${p.caption?` · ${esc(p.caption)}`:''}</div></article>`).join('')}</div></div>`:''}${local?`<div class="detail-block"><h3>Histórico de alterações</h3><div class="audit-timeline">${audits.length?audits.map(a=>`<article class="audit-entry"><strong>${esc(a.action.charAt(0).toUpperCase()+a.action.slice(1))}</strong><small>${formatDate(a.createdAt)} · ${new Date(a.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · ${esc(a.user?.name||'Usuário')}</small>${a.reason?`<p><b>Motivo:</b> ${esc(a.reason)}</p>`:''}${a.changes?.length?`<div class="change-list">${a.changes.map(c=>`<div class="change-item"><b>${esc(c.label)}</b><br>${esc(c.before||'—')} → ${esc(c.after||'—')}</div>`).join('')}</div>`:''}</article>`).join(''):'<div class="empty">Sem alterações registradas.</div>'}</div></div><div class="report-actions">${canEditRecord(raw)?'<button class="btn secondary" id="edit-report">Editar relatório</button>':''}${reportRequiresSync(raw.status)?'<button class="btn secondary" id="retry-sync">Tentar enviar</button>':''}${approveAllowed?'<button class="btn primary" id="approve-report">Aprovar relatório</button>':''}</div>`:''}</div></div>`;document.getElementById('close-report').onclick=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('report-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.querySelectorAll('[data-modal-photo]').forEach(c=>c.onclick=async()=>openPhoto(await idbGet('maintenancePhotos',c.dataset.modalPhoto)));document.getElementById('edit-report')?.addEventListener('click',()=>beginControlledEdit(raw));document.getElementById('retry-sync')?.addEventListener('click',async()=>{await enqueueSync(raw);const result=await processSyncQueue({force:true});if(!cloudConfigured())toast('A integração com a nuvem ainda precisa ser configurada.','notice');else if(result.processed)toast('Relatório enviado com sucesso.');state.reports=await combinedReports();openReportDetails(key)});document.getElementById('approve-report')?.addEventListener('click',()=>approveRecord(raw))};

async function openSyncCenter(){const records=await currentUserLocalRecords('maintenanceRecords'),recordIds=new Set(records.map(r=>r.id)),queue=(await idbAll('syncQueue')).filter(q=>q.status!=='concluido'&&recordIds.has(q.recordId)).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));document.getElementById('modal-root').innerHTML=`<div class="modal" id="sync-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="close-sync"><span data-icon="x"></span></button><h2>Fila de sincronização</h2><p class="muted">Registros mantidos com segurança neste dispositivo até a confirmação da base principal.</p>${!cloudConfigured()?'<div class="cloud-required"><b>Integração em nuvem pendente.</b><br>A fila já está pronta, com identificadores únicos e proteção contra duplicidade. O envio real será ativado quando o ambiente de nuvem for criado.</div>':''}<div class="sync-list">${queue.length?queue.map(q=>{const r=records.find(x=>x.id===q.recordId);return `<article class="sync-item"><div><strong>${esc((r?.equipamentosSnapshot||[]).map(assetTitle).join(', ')||'Relatório local')}</strong><small> ${esc(statusMeta(r?.status).label)}${q.lastError?`<br>Erro: ${esc(q.lastError)}`:''}</small></div>${q.status==='erro'?`<button class="btn secondary" data-retry-item="${esc(q.id)}">Tentar novamente</button>`:''}</article>`}).join(''):'<div class="sync-empty">Nenhum relatório aguardando envio.</div>'}</div><div class="report-actions"><button class="btn secondary" id="sync-now">Sincronizar agora</button></div></div></div>`;document.getElementById('close-sync').onclick=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('sync-modal').onclick=e=>{if(e.target.id==='sync-modal')document.getElementById('modal-root').innerHTML=''};document.getElementById('sync-now').onclick=async()=>{const result=await processSyncQueue({force:true});if(!cloudConfigured())toast('A nuvem ainda não está configurada. Os dados continuam salvos localmente.','notice');else toast(result.processed?`${result.processed} relatório(s) sincronizado(s).`:'Não havia registros para enviar.');openSyncCenter()};document.querySelectorAll('[data-retry-item]').forEach(b=>b.onclick=async()=>{const q=await idbGet('syncQueue',b.dataset.retryItem);q.status='pendente';q.lastError='';await idbPut('syncQueue',q);await processSyncQueue({force:true});openSyncCenter()})}
updateConnectivityIndicator=async function(){const indicator=document.getElementById('connection-indicator'),label=document.getElementById('connection-label'),badge=document.getElementById('pending-sync-badge');if(!indicator||!label||!badge)return;const online=navigator.onLine;indicator.classList.toggle('offline',!online);label.textContent=online?'Online':'Offline';const connectionIcon=document.getElementById('connection-state-icon');if(connectionIcon){connectionIcon.dataset.icon=online?'wifi':'wifi-off';connectionIcon.dataset.iconApplied='';hydrateIcons(connectionIcon.parentElement||document)};const records=await currentUserLocalRecords('maintenanceRecords'),recordIds=new Set(records.map(r=>r.id)),queue=(await idbAll('syncQueue')).filter(q=>q.status!=='concluido'&&recordIds.has(q.recordId)),pending=queue.length;badge.classList.toggle('hidden',pending===0);badge.textContent=pending===1?'1 aguardando envio':`${pending} aguardando envio`;badge.onclick=pending?openSyncCenter:null;indicator.title=online?(pending?`${pending} relatório(s) aguardando confirmação da nuvem`:'Conexão disponível'):'Sem conexão — registros serão salvos localmente';if(online&&pending&&cloudConfigured()&&!state.syncing)setTimeout(()=>processSyncQueue(),50)};
window.addEventListener('online',()=>processSyncQueue());



// =========================================================
// CONEXÃO SUPABASE — v0.5.0
// =========================================================
function assertLocalRuntimeDependencies(){
  const missing=[];
  if(!globalThis.supabase?.createClient)missing.push('Supabase JS local');
  if(!globalThis.XLSX?.utils)missing.push('SheetJS local');
  if(missing.length)throw new Error(`Dependências locais ausentes: ${missing.join(', ')}. Execute PREPARAR_RELEASE.bat antes de publicar/instalar a v1.9.6.`);
}
assertLocalRuntimeDependencies();
window.CENTRAL_CLOUD_CONFIG={enabled:true,supabaseUrl:'https://szshskfyocsumvmqwuem.supabase.co',supabasePublishableKey:'sb_publishable_2gLFPNZzZtjdA4XKOKWvhw_lnecGM8L'};
const cloudClient=window.supabase?.createClient(window.CENTRAL_CLOUD_CONFIG.supabaseUrl,window.CENTRAL_CLOUD_CONFIG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let pendingVerificationEmail=localStorage.getItem('central_pending_verification_email')||'';

function authMessage(text,type='info'){
  const box=document.getElementById('auth-message');
  if(!box)return;

  if(!text){
    box.innerHTML='';
    return;
  }

  /* Erros de preenchimento continuam junto do formulário. */
  if(type==='error'){
    box.innerHTML=`<div class="auth-message error">${esc(text)}</div>`;
    return;
  }

  /* Sucessos e avisos transitórios passam para o canto superior direito. */
  box.innerHTML='';
  toast(
    text,
    type==='success'?'success':
    type==='warning'?'warning':
    'info'
  );
}
function setAuthBusy(form,busy,label){const button=form?.querySelector('button[type="submit"]');if(!button)return;if(!button.dataset.label)button.dataset.label=button.textContent;button.disabled=busy;button.textContent=busy?label:button.dataset.label}
function isValidAccountEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||'').trim().toLowerCase())}
function showAuthTab(name){if(name==='verify'&&!pendingVerificationEmail)name='signup';const activeTab=(name==='verify'||name==='invite')?'signup':name;document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===activeTab));document.querySelectorAll('[data-auth-pane]').forEach(p=>p.classList.toggle('active',p.dataset.authPane===name));if(name==='verify'){document.getElementById('verify-email-target').textContent=pendingVerificationEmail||'Informe o e-mail na etapa anterior'}authMessage('')}
function showCloudLoading(show,text='Sincronizando a base…'){const el=document.getElementById('cloud-loading');if(!el)return;el.classList.toggle('hidden',!show);const strong=el.querySelector('strong');if(strong)strong.textContent=text}
function cachedIdentity(){try{return JSON.parse(localStorage.getItem('central_offline_identity')||'null')}catch{return null}}
function storeIdentity(user,profile){const safeProfile={id:profile?.id||user.id,display_name:profile?.display_name||user.email||'Usuário',role:profile?.role==='admin'?'admin':'field',active:profile?.active!==false,avatar_path:profile?.avatar_path||null,approval_status:'approved',must_change_password:false};localStorage.setItem('central_offline_identity',JSON.stringify({user:{id:user.id,email:user.email},profile:safeProfile,authenticatedAt:new Date().toISOString()}))}

async function paginatedSelect(table,columns='*',orderColumn='id'){
  const pageSize=1000,all=[];let from=0;
  while(true){let query=cloudClient.from(table).select(columns).range(from,from+pageSize-1);if(orderColumn)query=query.order(orderColumn,{ascending:true});const {data,error}=await query;if(error)throw error;all.push(...(data||[]));if(!data||data.length<pageSize)break;from+=pageSize}
  return all
}
function cloudAssetToLocal(a){return {id:a.id,subestacao:a.substation_id,grupo:a.category,tipo:a.name,label:a.name,localizacao:a.location||'',circuito:a.circuit||'',fabricante:a.manufacturer||'',modelo:a.model||'',serial:a.serial_number||'',numeroOperativo:a.operating_number||'',identificacao:a.identification||'',observacoes:a.notes||'',profilePhotoPath:a.profile_photo_path||'',rowVersion:Number(a.row_version||1),updatedAt:a.updated_at||'',ultimaManutencao:a.last_maintenance_date||'',origem:'Base Supabase'}}
function cloudHistoricalPayloadToLocal(p){return {id:p.source_id||uid(),data:p.data||'',os:p.ordemServico||'',equipe:p.equipe||'',inicio:p.inicio||'',fim:p.fim||'',tipoManutencao:p.tipoManutencao||'Manutenção',tipoEquipamento:p.tipoEquipamento||'',ativo:p.ativo||'',fabricante:p.fabricante||'',modelo:p.modelo||'',serial:p.serial||'',defeito:p.defeito||'',causa:p.causa||'',reparo:p.reparo||'',configuracao:p.configuracao||'',ativoSubstituido:p.ativoSubstituido||'',pecaSubstituida:p.pecaSubstituida||'',comentarios:p.comentarios||'',necessitaRetorno:p.necessitaRetorno||''}}
function cloudModernRaw(report,assetsById,profileById,linkMap){const p=report.payload||{},form=p.form||p,assetIds=p.equipamentos||linkMap.get(report.id)||[],snapshots=(p.equipamentosSnapshot||assetIds.map(id=>assetsById.get(id)).filter(Boolean).map(cloudAssetToLocal));return {id:report.id,numeroRelatorio:report.report_number,idempotencyKey:report.idempotency_key,version:p.app_version||'cloud',batchId:p.batchId||null,batchPosition:p.batchPosition||1,batchTotal:p.batchTotal||1,usuario:{name:profileById.get(report.author_id)?.display_name||form.equipe||'Equipe',id:report.author_id},subestacao:report.substation_id,equipamentos:assetIds,equipamentosSnapshot:snapshots,form,resultado:report.outcome,criadoEm:report.created_at,updatedAt:report.updated_at,revisao:report.revision,status:report.status,servidorId:report.id,cloud:true}}
function applyCloudSnapshot(snapshot){
  const substations=snapshot.substations||[],assets=snapshot.assets||[],reports=snapshot.reports||[],links=snapshot.links||[],profiles=snapshot.profiles||[];
  state.profileDirectory=profiles;const assetsById=new Map(assets.map(a=>[a.id,a])),profileById=new Map(profiles.map(p=>[p.id,p])),linkMap=new Map();for(const l of links){if(!linkMap.has(l.report_id))linkMap.set(l.report_id,[]);linkMap.get(l.report_id).push(l.asset_id)}
  DATA.substations=substations.map(s=>({id:s.id,sigla:s.acronym,nome:s.name,empresa:s.company||'',regiao:s.region||'',classeTensao:s.voltage_class||'',qtdEletronicos:0,qtdReles:0,qtdPatio:0,qtdEquipamentos:0,qtdHistorico:0}));DATA.equipment={};DATA.histories={};
  for(const sub of DATA.substations)DATA.equipment[sub.id]={eletronicos:[],reles:[],patio:[]};
  for(const row of assets){const a=cloudAssetToLocal(row),group=row.category==='Eletrônicos'?'eletronicos':row.category==='Relés'?'reles':'patio';if(!DATA.equipment[row.substation_id])DATA.equipment[row.substation_id]={eletronicos:[],reles:[],patio:[]};DATA.equipment[row.substation_id][group].push(a);const sub=DATA.substations.find(s=>s.id===row.substation_id);if(sub){sub.qtdEquipamentos++;if(group==='eletronicos')sub.qtdEletronicos++;else if(group==='reles')sub.qtdReles++;else sub.qtdPatio++}}
  state.cloudReports=[];
  for(const r of reports){const p=r.payload||{},sub=DATA.substations.find(s=>s.id===r.substation_id),assetIds=linkMap.get(r.id)||p.historical_matched_asset_ids||[];if(p.historical_import){const raw=cloudHistoricalPayloadToLocal(p);(DATA.histories[r.substation_id]??=[]).push(raw);state.cloudReports.push({key:'cloud:'+r.id,source:'imported',id:r.id,number:r.report_number,subId:r.substation_id,substation:`${sub?.sigla||r.substation_id} — ${sub?.nome||''}`,date:p.data||r.created_at,createdAt:r.created_at,author:p.equipe||profileById.get(r.author_id)?.display_name||'Equipe',assets:assetIds.map(id=>assetsById.get(id)?.name).filter(Boolean).length?assetIds.map(id=>assetsById.get(id)?.name).filter(Boolean):[p.ativo||'Ativo não informado'],type:p.tipoManutencao||'Manutenção',status:r.status,outcome:r.outcome,raw})}else{const raw=cloudModernRaw(r,assetsById,profileById,linkMap);const currentAssets=raw.equipamentosSnapshot.map(assetTitle);const historyEntry={id:r.id,data:raw.form.data||r.created_at,os:raw.form.os||'',equipe:raw.form.equipe||raw.usuario.name,tipoManutencao:raw.form.tipo||'Manutenção',ativo:currentAssets.join(', ')||'Ativo não informado',serial:raw.equipamentosSnapshot.map(a=>a.serial).filter(Boolean).join(' / '),defeito:raw.form.defeito||'',causa:raw.form.causa||'',reparo:raw.form.reparo||'',configuracao:raw.form.configuracao||'',pecaSubstituida:raw.form.peca||'',comentarios:raw.form.comentarios||raw.form.motivoInconclusao||'',necessitaRetorno:raw.form.retorno||'',assetIds:[...assetIds],status:r.status,source:'cloud'};(DATA.histories[r.substation_id]??=[]).push(historyEntry);state.cloudReports.push({key:'cloud:'+r.id,source:'cloud',id:r.id,number:r.report_number,subId:r.substation_id,substation:`${sub?.sigla||r.substation_id} — ${sub?.nome||''}`,date:raw.form.data||r.created_at,createdAt:r.created_at,author:raw.form.equipe||raw.usuario.name,assets:currentAssets,type:raw.form.tipo||'Manutenção',status:r.status,outcome:r.outcome,raw})}}
  for(const sub of DATA.substations)sub.qtdHistorico=(DATA.histories[sub.id]||[]).length;
  DATA.meta={...(DATA.meta||{}),substationCount:substations.length,equipmentCountAfterConsolidation:assets.length,historyCount:reports.length,version:APP_VERSION,source:'Supabase'};state.cloudReady=true
}
function cloudSnapshotCacheKey(){return state.cloudUser?.id?`snapshot:${state.cloudUser.id}`:'snapshot:anonymous'}
async function clearSensitiveSessionCache(userId=state.cloudUser?.id){
  try{if(userId)await idbDelete('cloudCache',`snapshot:${userId}`);await idbDelete('cloudCache','snapshot')}catch(_){ }
  try{if(userId)await idbDelete('appSettings',`user-avatar:${userId}`)}catch(_){ }
}
async function loadCloudSnapshot(){
  const cacheKey=cloudSnapshotCacheKey(),cache=await idbGet('cloudCache',cacheKey);if(!navigator.onLine){if(cache?.data){applyCloudSnapshot(cache.data);return {cached:true}}throw new Error('Faça ao menos um acesso online neste dispositivo antes de utilizar o modo offline.')}
  try{const [substations,assets,reports,links,profiles]=await Promise.all([paginatedSelect('substations','*','id'),paginatedSelect('assets','*','id'),paginatedSelect('maintenance_reports','*','created_at'),paginatedSelect('maintenance_report_assets','*','report_id'),paginatedSelect('profile_directory','id,display_name,role,active,avatar_path','id')]);const data={substations,assets,reports,links,profiles,syncedAt:new Date().toISOString()};await idbPut('cloudCache',{key:cacheKey,data,updatedAt:data.syncedAt,userId:state.cloudUser?.id||null});applyCloudSnapshot(data);return {cached:false}}catch(error){if(cache?.data){applyCloudSnapshot(cache.data);toast('Não foi possível atualizar a nuvem. Usando a última base salva para este usuário neste dispositivo.','notice');return {cached:true,error}}throw error}
}
async function fetchCurrentProfile(user){
  if(navigator.onLine){
    const {data,error}=await cloudClient.from('profiles').select('id,display_name,role,active,avatar_path,must_change_password,approved_at,approved_by,approval_status,requested_role,whatsapp_number,push_notifications_enabled,notify_new_reports,notify_report_received,notify_report_approved,notify_report_rejected,notify_report_corrected').eq('id',user.id).single();
    if(error)throw error;
    if(data.approval_status==='pending')throw new Error('Seu cadastro está aguardando aprovação administrativa.');
    if(data.approval_status==='rejected')throw new Error('Sua solicitação de acesso foi rejeitada. Procure a equipe administrativa.');
    if(data.approval_status && data.approval_status!=='approved')throw new Error('Seu acesso ainda não foi liberado.');
    if(!data.active)throw new Error('Este usuário está inativo. Procure a equipe administrativa.');
    return data;
  }
  const cached=cachedIdentity();
  if(cached?.profile&&cached.user?.id===user.id)return cached.profile;
  throw new Error('O perfil não está disponível offline.');
}
async function enterApplication(user,profile,{offline=false}={}){state.cloudUser=user;state.cloudProfile=profile;state.role=profile.role==='admin'?'admin':'field';state.offlineSession=offline;storeIdentity(user,profile);showCloudLoading(true,offline?'Abrindo a base offline…':'Sincronizando a base…');try{await loadCloudSnapshot();document.getElementById('auth-shell').classList.add('hidden');document.getElementById('app-shell').classList.remove('hidden');bindNavigation();await updateConnectivityIndicator();await renderHome();if(navigator.onLine)setTimeout(()=>processSyncQueue(),200)}catch(error){authMessage(error.message||String(error),'error');document.getElementById('auth-shell').classList.remove('hidden');document.getElementById('app-shell').classList.add('hidden')}finally{showCloudLoading(false)}}
async function startFromSession(session){const profile=await fetchCurrentProfile(session.user);await enterApplication(session.user,profile)}
async function logoutConnectedUser(){if(!confirm('Sair da Central de Manutenção neste dispositivo?'))return;try{if(navigator.onLine)await cloudClient.auth.signOut()}finally{const logoutUserId=state.cloudUser?.id;await clearSensitiveSessionCache(logoutUserId);localStorage.removeItem('central_offline_identity');state.cloudUser=null;state.cloudProfile=null;state.cloudReports=[];document.getElementById('app-shell').classList.add('hidden');document.getElementById('auth-shell').classList.remove('hidden');showAuthTab('login');authMessage('Sessão encerrada.','info')}}

async function uploadMaintenancePhotos(record,user){const photos=await idbByIndex('maintenancePhotos','maintenanceId',record.id);for(const photo of photos){if(!photo.cloudId){photo.cloudId=crypto.randomUUID();await idbPut('maintenancePhotos',photo)}const path=`${user.id}/${record.id}/${photo.cloudId}.jpg`;const {error:uploadError}=await cloudClient.storage.from('maintenance-photos').upload(path,photo.blob,{contentType:photo.blob?.type||'image/jpeg',upsert:true});if(uploadError)throw uploadError;const {error:rowError}=await cloudClient.from('maintenance_photos').insert({id:photo.cloudId,report_id:record.id,asset_id:photo.assetId,storage_path:path,category:photo.category||null,caption:photo.caption||null});if(rowError&&rowError.code!=='23505')throw rowError}}
async function syncAudits(record){const audits=await auditForRecord(record.id);for(const a of audits){const {error}=await cloudClient.from('audit_logs').insert({id:a.cloudId||a.id,report_id:record.id,actor_id:state.cloudUser.id,action:a.action,reason:a.reason||null,changes:a.changes||[],status_from:a.statusFrom||null,status_to:a.statusTo||null,created_at:a.createdAt});if(error&&error.code!=='23505')throw error}}
async function ensureReportChildren(record,user){if(record.equipamentos?.length){const {error}=await cloudClient.from('maintenance_report_assets').insert(record.equipamentos.map(asset_id=>({report_id:record.id,asset_id})));if(error&&error.code!=='23505')throw error}if(normalize(record.form?.houvePeca)==='sim'&&record.form?.peca){if(!record.partCloudId){record.partCloudId=crypto.randomUUID();await idbPut('maintenanceRecords',record)}const assetId=record.equipamentos?.[0];if(assetId){const {error}=await cloudClient.from('maintenance_parts').insert({id:record.partCloudId,report_id:record.id,asset_id:assetId,description:record.form.peca,removed_destination:record.form.destinoPeca||null});if(error&&error.code!=='23505')throw error}}await uploadMaintenancePhotos(record,user);await syncAudits(record)}
window.CENTRAL_SYNC_ADAPTER={
  async sendReport({record}){
    const {data:{session},error:sessionError}=await cloudClient.auth.getSession();if(sessionError)throw sessionError;if(!session)throw new Error('Sessão expirada. Entre novamente para sincronizar.');
    const {data:existing,error:findError}=await cloudClient.from('maintenance_reports').select('id,status,revision').eq('idempotency_key',record.idempotencyKey||record.id).maybeSingle();if(findError)throw findError;
    if(existing){if(record.aprovadoEm||record.status==='aprovado'){const {data,error}=await cloudClient.rpc('approve_maintenance_report',{p_report_id:existing.id});if(error)throw error;await ensureReportChildren(record,session.user);return {id:existing.id,status:data?.status||'aprovado'}}if((record.revisao||1)>Number(existing.revision||1)){const audits=await auditForRecord(record.id),reason=audits.find(a=>a.action==='corrigido')?.reason||'Correção registrada no aplicativo';const payload={schema_version:1,source:'app',app_version:APP_VERSION,form:record.form,equipamentos:record.equipamentos,equipamentosSnapshot:record.equipamentosSnapshot,batchId:record.batchId,batchPosition:record.batchPosition,batchTotal:record.batchTotal};const {data,error}=await cloudClient.rpc('correct_maintenance_report',{p_report_id:existing.id,p_payload:payload,p_reason:reason});if(error)throw error;await ensureReportChildren(record,session.user);return {id:existing.id,status:data?.status||'corrigido'}}await ensureReportChildren(record,session.user);return {id:existing.id,status:existing.status||'enviado'}}
    const payload={schema_version:1,source:'app',app_version:APP_VERSION,form:record.form,equipamentos:record.equipamentos,equipamentosSnapshot:record.equipamentosSnapshot,batchId:record.batchId,batchPosition:record.batchPosition,batchTotal:record.batchTotal};
    const {error:reportError}=await cloudClient.from('maintenance_reports').insert({id:record.id,report_number:record.numeroRelatorio,idempotency_key:record.idempotencyKey||record.id,substation_id:record.subestacao,author_id:session.user.id,status:'enviado',outcome:record.resultado||'concluido',revision:record.revisao||1,payload,created_at:record.criadoEm||new Date().toISOString()});if(reportError)throw reportError;
    await ensureReportChildren(record,session.user);return {id:record.id,status:'enviado'}
  }
};

// Cloud-first overview: local pending records + cloud records, sem duplicidade.
combinedReports=async function(){const local=await idbAll('maintenanceRecords'),cloudIds=new Set(state.cloudReports.map(r=>r.id));const locals=local.filter(r=>!cloudIds.has(r.id)||reportRequiresSync(r.status)).map(r=>{const form=r.form||{},outcome=r.resultado||(normalize(form.inconclusivo)==='sim'?'inconclusivo':'concluido');return {key:'local:'+r.id,source:'local',id:r.id,number:r.numeroRelatorio||r.id,subId:r.subestacao,substation:(DATA.substations.find(s=>s.id===r.subestacao)?.sigla||r.subestacao||'')+' — '+(DATA.substations.find(s=>s.id===r.subestacao)?.nome||''),date:form.data||r.criadoEm,createdAt:r.criadoEm,author:form.equipe||r.usuario?.name||'Equipe local',assets:(r.equipamentosSnapshot||[]).map(assetTitle),type:form.tipo||'Manutenção',status:r.status||'salvo_local',outcome,raw:r}});return [...locals,...state.cloudReports].sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))};

// Foto de perfil: cache local + upload privado quando houver conexão.
const _localSetAssetPhoto=setAssetPhoto;
setAssetPhoto=async function(assetId,file){const blob=await _localSetAssetPhoto(assetId,file);if(navigator.onLine&&state.cloudUser){const path=`${state.cloudUser.id}/${assetId}/${Date.now()}.jpg`;const {error}=await cloudClient.storage.from('asset-profile-photos').upload(path,blob,{contentType:'image/jpeg',upsert:true});if(error)throw error;const {error:rpcError}=await cloudClient.rpc('set_asset_profile_photo',{p_asset_id:assetId,p_storage_path:path});if(rpcError)throw rpcError;for(const sub of Object.values(DATA.equipment)){for(const group of ['eletronicos','reles','patio']){const asset=(sub[group]||[]).find(a=>a.id===assetId);if(asset)asset.profilePhotoPath=path}}}return blob};
const _localPhotoForAsset=photoForAsset;
photoForAsset=async function(assetId){const local=await _localPhotoForAsset(assetId);if(local)return local;let asset;for(const sub of Object.values(DATA.equipment)){asset=[...(sub.eletronicos||[]),...(sub.reles||[]),...(sub.patio||[])].find(a=>a.id===assetId);if(asset)break}if(!asset?.profilePhotoPath||!navigator.onLine)return null;const {data,error}=await cloudClient.storage.from('asset-profile-photos').download(asset.profilePhotoPath);if(error)return null;await idbPut('assetPhotos',{assetId,blob:data,updatedAt:new Date().toISOString()});return data};

function setupAuthUI(){
  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.onclick=()=>showAuthTab(b.dataset.authTab));
  document.querySelectorAll('[data-toggle-password]').forEach(b=>b.onclick=()=>{const input=document.getElementById(b.dataset.togglePassword);input.type=input.type==='password'?'text':'password';setIconOnly(b,input.type==='text'?'eye-off':'eye');b.setAttribute('aria-label',input.type==='text'?'Ocultar senha':'Mostrar senha')});
  let resendTimer=null,resendUntil=0;
  const updateResendButton=()=>{const b=document.getElementById('resend-code');if(!b)return;const left=Math.max(0,Math.ceil((resendUntil-Date.now())/1000));b.disabled=left>0;b.textContent=left>0?`Reenviar código em ${left}s`:'Reenviar código';if(!left&&resendTimer){clearInterval(resendTimer);resendTimer=null}};
  const startResendCooldown=(seconds=60)=>{resendUntil=Date.now()+seconds*1000;updateResendButton();if(resendTimer)clearInterval(resendTimer);resendTimer=setInterval(updateResendButton,1000)};
  const login=document.getElementById('login-form');
  login.onsubmit=async e=>{
    e.preventDefault();
    if(!navigator.onLine)return authMessage('O login diário exige conexão com a internet.','error');
    const fd=new FormData(login);setAuthBusy(login,true,'Entrando…');authMessage('');
    try{
      const {data,error}=await cloudClient.auth.signInWithPassword({email:String(fd.get('email')).trim(),password:String(fd.get('password'))});
      if(error)throw error;
      try{const profile=await fetchCurrentProfile(data.user);markDailySession();await enterApplication(data.user,profile)}catch(accessError){await cloudClient.auth.signOut().catch(()=>{});throw accessError}
    }catch(error){authMessage(error.message==='Invalid login credentials'?'E-mail ou senha inválidos.':error.message,'error')}finally{setAuthBusy(login,false)}
  };
  const signup=document.getElementById('signup-form');
  signup.onsubmit=async e=>{
    e.preventDefault();
    if(!navigator.onLine)return authMessage('A criação da conta exige conexão com a internet.','error');
    const fd=new FormData(signup),email=String(fd.get('email')).trim().toLowerCase(),password=String(fd.get('password')),confirm=String(fd.get('confirm_password')),name=String(fd.get('display_name')).trim(),whatsapp=normalizeWhatsappInput(fd.get('whatsapp_number'));
    if(!name)return authMessage('Informe seu nome completo.','error');
    if(!whatsapp)return authMessage('Informe um telefone/WhatsApp válido com DDD.','error');
    if(!isValidAccountEmail(email))return authMessage('Informe um endereço de e-mail válido.','error');
    if(password.length<8)return authMessage('Use uma senha com pelo menos 8 caracteres.','error');
    if(password!==confirm)return authMessage('As senhas não coincidem.','error');
    setAuthBusy(signup,true,'Criando conta…');authMessage('');
    try{
      const {data,error}=await cloudClient.auth.signUp({email,password,options:{data:{display_name:name,requested_role:'field',central_self_signup:true,whatsapp_number:whatsapp,push_notifications_enabled:true}}});
      if(error)throw error;
      if(data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0)throw new Error('Já existe uma conta para este e-mail. Tente entrar ou recuperar sua senha.');
      if(data.session){await cloudClient.auth.signOut().catch(()=>{});throw new Error('A confirmação de e-mail precisa estar habilitada no Supabase antes de usar o cadastro por código.');}
      pendingVerificationEmail=email;localStorage.setItem('central_pending_verification_email',email);showAuthTab('verify');startResendCooldown(60);authMessage('Código enviado. Verifique seu e-mail para concluir a criação da conta.','success');
    }catch(error){authMessage(error.message,'error')}finally{setAuthBusy(signup,false)}
  };
  const verify=document.getElementById('verify-form');
  verify.onsubmit=async e=>{
    e.preventDefault();
    if(!pendingVerificationEmail)return authMessage('Informe o e-mail na etapa Criar conta.','error');
    const token=String(new FormData(verify).get('token')).replace(/\D/g,'').trim();if(!token)return authMessage('Digite o código numérico recebido por e-mail.','error');if(token.length>12)return authMessage('O código informado é maior que o esperado. Confira o e-mail e tente novamente.','error');
    setAuthBusy(verify,true,'Validando…');authMessage('');
    try{
      const {data,error}=await cloudClient.auth.verifyOtp({email:pendingVerificationEmail,token,type:'email'});if(error)throw error;
      if(!data?.user||!data?.session)throw new Error('O e-mail foi validado, mas a sessão não foi criada. Tente entrar novamente.');
      const {error:finalizeError}=await cloudClient.rpc('finalize_verified_self_signup');if(finalizeError)throw finalizeError;
      localStorage.removeItem('central_pending_verification_email');pendingVerificationEmail='';signup.reset();verify.reset();
      const profile=await fetchCurrentProfile(data.user);markDailySession();authMessage('Conta confirmada. Abrindo a Central…','success');await enterApplication(data.user,profile);
    }catch(error){authMessage(error.message,'error')}finally{setAuthBusy(verify,false)}
  };
  document.getElementById('back-to-signup').onclick=()=>showAuthTab('signup');
  document.getElementById('resend-code').onclick=async()=>{if(Date.now()<resendUntil)return;if(!pendingVerificationEmail)return authMessage('Informe o e-mail na etapa Criar conta.','error');try{const {error}=await cloudClient.auth.resend({type:'signup',email:pendingVerificationEmail});if(error)throw error;startResendCooldown(60);authMessage('Código reenviado.','success')}catch(error){authMessage(error.message,'error')}};
  document.getElementById('forgot-password').onclick=async()=>{const email=document.getElementById('login-email').value.trim();if(!email)return authMessage('Informe o e-mail no campo de login.','info');if(!navigator.onLine)return authMessage('A recuperação de senha exige internet.','error');try{const {error}=await cloudClient.auth.resetPasswordForEmail(email);if(error)throw error;authMessage('Solicitação enviada ao e-mail informado.','success')}catch(error){authMessage(error.message,'error')}};
}

function prefillInviteForm(){
  const source=document.getElementById('signup-form'),target=document.getElementById('invite-signup-form');if(!source||!target)return;
  ['display_name','email','whatsapp_number'].forEach(name=>{const from=source.elements?.namedItem(name),to=target.elements?.namedItem(name);if(from&&to&&!to.value)to.value=from.value||''});
}
function normalizeInviteCode(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function setupInviteFallbackUI(){
  const openInvite=()=>{prefillInviteForm();showAuthTab('invite');setTimeout(()=>document.getElementById('invite-code')?.focus(),50)};
  document.getElementById('use-invite-from-signup')?.addEventListener('click',openInvite);
  document.getElementById('use-invite-from-verify')?.addEventListener('click',openInvite);
  document.getElementById('back-from-invite')?.addEventListener('click',()=>showAuthTab('signup'));
  const form=document.getElementById('invite-signup-form');if(!form)return;
  form.querySelectorAll('[data-toggle-password]').forEach(button=>button.onclick=()=>{const input=document.getElementById(button.dataset.togglePassword);if(!input)return;input.type=input.type==='password'?'text':'password';button.setAttribute('aria-label',input.type==='password'?'Mostrar senha':'Ocultar senha')});
  form.onsubmit=async e=>{
    e.preventDefault();if(!navigator.onLine)return authMessage('A criação da conta exige conexão com a internet.','error');
    const fd=new FormData(form),email=String(fd.get('email')).trim().toLowerCase(),password=String(fd.get('password')),confirm=String(fd.get('confirm_password')),name=String(fd.get('display_name')).trim(),whatsapp=normalizeWhatsappInput(fd.get('whatsapp_number')),inviteCode=normalizeInviteCode(fd.get('invite_code'));
    if(!name)return authMessage('Informe seu nome completo.','error');
    if(!isValidAccountEmail(email))return authMessage('Informe um endereço de e-mail válido.','error');
    if(!whatsapp)return authMessage('Informe um telefone/WhatsApp válido com DDD.','error');
    if(inviteCode.length!==16)return authMessage('Informe o código de convite de 16 caracteres.','error');
    if(password.length<8)return authMessage('Use uma senha com pelo menos 8 caracteres.','error');
    if(password!==confirm)return authMessage('As senhas não coincidem.','error');
    setAuthBusy(form,true,'Validando convite…');authMessage('');
    try{
      const {data,error}=await cloudClient.functions.invoke('invite-signup',{body:{email,password,display_name:name,whatsapp_number:whatsapp,invite_code:inviteCode}});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Não foi possível usar o código de convite.');
      const {data:loginData,error:loginError}=await cloudClient.auth.signInWithPassword({email,password});if(loginError)throw loginError;
      const profile=await fetchCurrentProfile(loginData.user);markDailySession();form.reset();authMessage('Convite validado. Abrindo a Central…','success');await enterApplication(loginData.user,profile);
    }catch(error){authMessage(error.message||String(error),'error')}finally{setAuthBusy(form,false)}
  };
}

async function bootConnectedApp(){
  setupAuthUI();setupInviteFallbackUI();
  if(!cloudClient)return authMessage('Não foi possível carregar a biblioteca de conexão. Verifique a internet e recarregue.','error');
  const offline=cachedIdentity();
  if(!dailySessionValid()){
    localStorage.removeItem('central_offline_identity');
    if(navigator.onLine)await cloudClient.auth.signOut().catch(()=>{});
  }else if(!navigator.onLine&&offline){
    const box=document.getElementById('offline-login');box.classList.remove('hidden');box.innerHTML=`<button class="btn secondary" id="open-offline" style="width:100%">Acessar offline como ${esc(offline.profile.display_name||offline.user.email)}</button><p class="muted" style="font-size:10px;text-align:center">Disponível somente até a virada do dia da sessão atual.</p>`;document.getElementById('open-offline').onclick=()=>enterApplication(offline.user,offline.profile,{offline:true})
  }
  if(navigator.onLine){
    try{
      const {data,error}=await cloudClient.auth.getSession();if(error)throw error;
      if(data.session){
        if(!dailySessionValid()){await cloudClient.auth.signOut().catch(()=>{});showAuthTab('login');return authMessage('Sua sessão diária foi encerrada. Entre novamente para continuar.','info')}
        return await startFromSession(data.session)
      }
    }catch(error){
      await cloudClient.auth.signOut().catch(()=>{});
      authMessage(error.message,'error')
    }
  }
  showAuthTab(pendingVerificationEmail?'verify':'login');
  cloudClient.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){document.getElementById('app-shell').classList.add('hidden');document.getElementById('auth-shell').classList.remove('hidden')}})
}


/* ===== v0.5.1: revisão administrativa e reprovação controlada ===== */
STATUS_META.reprovado={label:'Reprovado',className:'rejected'};

function reportDotClass(report){
  if(report.source==='imported')return 'imported-state';
  const status=report.status||'';
  if(status==='aprovado')return 'approved-state';
  if(status==='reprovado')return 'rejected-state';
  if(['enviado','corrigido'].includes(status))return 'review';
  return 'pending-state';
}
function actionLabel(action){return ({criado:'Criado',sincronizado:'Sincronizado',corrigido:'Corrigido',correcao:'Corrigido',aprovado:'Aprovado',aprovacao:'Aprovado',reprovado:'Reprovado',reprovacao:'Reprovado'})[action]||String(action||'Alteração').replaceAll('_',' ')}
function canEditRecord(record){
  if(!record||record.status==='aprovado')return false;
  if(state.role==='admin')return true;
  const ownerId=record.usuario?.id||record.authorId||record.author_id;
  const isOwner=!ownerId||ownerId===state.cloudUser?.id;
  return isOwner&&['reprovado','aguardando_envio','aguardando_nuvem','erro_sincronizacao','salvo_local'].includes(record.status);
}

const _v050CloudModernRaw=cloudModernRaw;
cloudModernRaw=function(report,assetsById,profileById,linkMap){
  const raw=_v050CloudModernRaw(report,assetsById,profileById,linkMap);
  raw.authorId=report.author_id;
  raw.rejeitadoEm=report.rejected_at||null;
  raw.rejeitadoPor=report.rejected_by||null;
  raw.motivoReprovacao=report.rejection_reason||null;
  raw.aprovadoEm=report.approved_at||null;
  raw.aprovadoPor=report.approved_by||null;
  return raw;
};

async function cloudAuditForRecord(recordId){
  if(!navigator.onLine||!state.cloudUser)return [];
  const {data,error}=await cloudClient.from('audit_logs').select('*').eq('report_id',recordId).order('created_at',{ascending:false});
  if(error)return [];
  const actorIds=[...new Set((data||[]).map(x=>x.actor_id).filter(Boolean))];
  let names=new Map();
  if(actorIds.length){const {data:profiles}=await cloudClient.from('profile_directory').select('id,display_name').in('id',actorIds);names=new Map((profiles||[]).map(x=>[x.id,x.display_name]))}
  return (data||[]).map(a=>({id:a.id,recordId:a.report_id,action:a.action,reason:a.reason||'',changes:Array.isArray(a.changes)?a.changes:[],statusFrom:a.status_from||'',statusTo:a.status_to||'',user:{name:names.get(a.actor_id)||'Usuário'},createdAt:a.created_at}));
}
async function allAuditsForRecord(raw){
  const local=await auditForRecord(raw.id),cloud=raw.cloud?await cloudAuditForRecord(raw.id):[];
  const map=new Map();for(const a of [...cloud,...local])map.set(a.id,a);
  return [...map.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}

renderOverview=async function(){
  if(state.role!=='admin'){toast('A área de Relatórios é exclusiva da Equipe Administrativa.','warning');return renderHome()}
  state.screen='overview';setActiveNav('overview');
  const reports=await combinedReports();state.reports=reports;const sortState={key:'date',dir:'desc'};
  main.innerHTML=`<div class="page-heading overview-heading"><div><h1>Relatórios</h1><p>Relatórios das equipes e histórico consolidado de manutenção.</p></div><div class="stats"><div class="stat"><strong>${reports.filter(r=>r.source!=='imported').length}</strong><span>relatórios atuais</span></div><div class="stat"><strong>${reports.filter(r=>r.status==='reprovado').length}</strong><span>reprovados</span></div><div class="stat"><strong>${reports.filter(r=>r.outcome==='inconclusivo').length}</strong><span>inconclusivos</span></div></div></div><section class="panel"><div class="inbox-toolbar"><div class="search"><input id="report-search" placeholder="Buscar por ativo, equipe, subestação ou tipo"></div><select id="report-source"><option value="">Todos os relatórios</option><option value="cloud">Relatórios na nuvem</option><option value="pending">Aguardando envio</option><option value="review">Aguardando revisão</option><option value="approved">Aprovados</option><option value="rejected">Reprovados</option><option value="inconclusivo">Atendimentos inconclusivos</option><option value="imported">Histórico importado</option></select></div><div id="inbox"></div></section>`;
  const search=document.getElementById('report-search'),source=document.getElementById('report-source');
  function matchSource(r,value){if(!value)return true;if(value==='pending')return r.source!=='imported'&&reportRequiresSync(r.status);if(value==='review')return ['enviado','corrigido'].includes(r.status);if(value==='approved')return r.status==='aprovado';if(value==='rejected')return r.status==='reprovado';if(value==='inconclusivo')return r.outcome==='inconclusivo';return r.source===value}
  function sortValue(r,key){if(key==='asset')return normalize(r.assets.join(', ')||'');if(key==='author')return normalize(r.author||'');return reportTimeV040(r.date)}
  function sortIndicator(key){return sortState.key!==key?icon('arrows-sort'):sortState.dir==='asc'?icon('arrow-up'):icon('arrow-down')}
  function draw(){
    const q=normalize(search.value),src=source.value;
    const matched=reports.filter(r=>matchSource(r,src)&&(!q||normalize([r.number,r.author,r.substation,r.type,r.outcome,...r.assets].join(' ')).includes(q))).sort((a,b)=>{const av=sortValue(a,sortState.key),bv=sortValue(b,sortState.key),cmp=sortState.key==='date'?av-bv:String(av).localeCompare(String(bv),'pt-BR',{sensitivity:'base',numeric:true});return sortState.dir==='asc'?cmp:-cmp});
    const list=matched.slice(0,300);
    document.getElementById('inbox').innerHTML=`<div class="inbox"><div class="inbox-head"><span></span><button class="sort-header ${sortState.key==='asset'?'active':''}" data-sort="asset">Relatório / ativo <span class="sort-icon">${sortIndicator('asset')}</span></button><button class="sort-header ${sortState.key==='author'?'active':''}" data-sort="author">Responsável <span class="sort-icon">${sortIndicator('author')}</span></button><button class="sort-header ${sortState.key==='date'?'active':''}" data-sort="date">Data <span class="sort-icon">${sortIndicator('date')}</span></button></div>${list.length?list.map(r=>`<article class="inbox-row ${r.source!=='imported'?'unread':''}" data-report-key="${esc(r.key)}"><span class="report-dot ${reportDotClass(r)}"></span><div class="inbox-main"><strong>${esc(r.assets.join(', ')||'Ativo não informado')}</strong><span>${esc(r.type)} · ${esc(r.substation)}</span>${r.source!=='imported'?`<span class="status-wrap">${statusPill(r.status)}${r.outcome==='inconclusivo'?'<span class="status-pill inconclusive">Inconclusivo</span>':''}</span>`:r.outcome==='inconclusivo'?'<span class="status-wrap"><span class="status-pill inconclusive">Inconclusivo</span></span>':''}</div><div class="inbox-person"><b>${esc(r.author)}</b></div><div class="inbox-date"><b>${formatDate(r.date)}</b></div></article>`).join(''):'<div class="empty">Nenhum relatório encontrado.</div>'}</div><p class="database-note">Exibindo ${list.length} de ${matched.length} resultado(s). Clique em qualquer linha para abrir os detalhes.</p>`;
    document.querySelectorAll('[data-report-key]').forEach(row=>row.onclick=()=>openReportDetails(row.dataset.reportKey));
    document.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{const key=button.dataset.sort;if(sortState.key===key)sortState.dir=sortState.dir==='asc'?'desc':'asc';else{sortState.key=key;sortState.dir=key==='date'?'desc':'asc'}draw()})
  }
  search.oninput=draw;source.onchange=draw;draw();
};


function isPreventiveReportRecord(record){return normalize(record?.form?.tipo||record?.payload?.form?.tipo||'').includes('preventiv')}
async function fetchPamMatchResult(reportId){
  if(!cloudClient||!navigator.onLine)return null;
  try{
    const {data,error}=await cloudClient.rpc('complete_pam_from_approved_report',{p_report_id:reportId});
    if(error)throw error;
    return data||null;
  }catch(error){
    console.warn('Integração PAM:',error);
    return {status:'erro',message:error?.message||String(error)};
  }
}
function openPamMatchReview(reportId,result){
  const candidates=Array.isArray(result?.candidates)?result.candidates:[];
  const candidateHtml=candidates.length?candidates.map(c=>`<button class="pam-match-option" type="button" data-pam-candidate="${esc(c.id)}"><strong>${esc(planCompetence(c.planned_for))} · ${esc(c.group||'Atividade preventiva')}</strong><span>${esc(c.equipment||'Equipamento não individualizado')} · ${esc(c.substation||'Subestação')}<br>${esc(c.service||'Serviço preventivo')}</span></button>`).join(''):'<div class="pam-match-note">Nenhum item foi identificado com segurança. O relatório permanece aprovado, mas esta atividade precisa ser conferida no PAM.</div>';
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="pam-match-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="close-pam-match" type="button"><span data-icon="x"></span></button><h2>Conferir vínculo com o PAM</h2><p class="muted">A preventiva foi aprovada, porém o sistema encontrou mais de uma possibilidade ou não obteve segurança suficiente para concluir o item automaticamente.</p><div class="pam-match-review-list">${candidateHtml}</div><div class="report-actions"><button class="btn secondary" id="pam-open-plan" type="button">Abrir PAM</button></div></div></div>`;
  const close=()=>document.getElementById('modal-root').innerHTML='';
  document.getElementById('close-pam-match').onclick=close;
  document.getElementById('pam-match-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
  document.getElementById('pam-open-plan').onclick=()=>{close();renderPreventivePlan()};
  document.querySelectorAll('[data-pam-candidate]').forEach(button=>button.onclick=async()=>{
    button.disabled=true;
    try{
      const {data,error}=await cloudClient.rpc('resolve_pam_report_match',{p_report_id:reportId,p_plan_item_id:button.dataset.pamCandidate});
      if(error)throw error;
      state.preventivePlan=[];
      close();toast('Atividade do PAM concluída após a conferência administrativa.');
    }catch(error){button.disabled=false;toast(error.message||String(error),'warning')}
  });
}
async function updateLocalAdministrativeStatus(record,status,extra={}){
  const local=await idbGet('maintenanceRecords',record.id);
  if(!local)return;
  Object.assign(local,{status,updatedAt:new Date().toISOString()},extra);
  await idbPut('maintenanceRecords',local);
}
async function refreshAfterAdministrativeAction(message){
  await loadCloudSnapshot();state.reports=await combinedReports();document.getElementById('modal-root').innerHTML='';toast(message);return renderOverview();
}
async function approveRecord(record){
  if(state.role!=='admin')return;
  if(!navigator.onLine)return toast('A aprovação exige conexão com a nuvem.','warning');
  try{
    const reportId=record.servidorId||record.id;
    const {data,error}=await cloudClient.rpc('approve_maintenance_report',{p_report_id:reportId});if(error)throw error;
    await updateLocalAdministrativeStatus(record,'aprovado',{aprovadoEm:data?.approved_at||new Date().toISOString(),aprovadoPor:currentUser(),motivoReprovacao:null});
    let pamResult=null;
    if(isPreventiveReportRecord(record))pamResult=await fetchPamMatchResult(reportId);
    if(pamResult?.status==='concluido')state.preventivePlan=[];
    const message=pamResult?.status==='concluido'?'Relatório aprovado e atividade do PAM concluída.':pamResult?.status==='revisar'?'Relatório aprovado. O vínculo com o PAM precisa de conferência.':'Relatório aprovado.';
    await refreshAfterAdministrativeAction(message);
    if(pamResult?.status==='revisar')setTimeout(()=>openPamMatchReview(reportId,pamResult),80);
    if(pamResult?.status==='erro')toast('Relatório aprovado, mas a integração com o PAM não pôde ser confirmada. Verifique se o SQL da v0.8.3 foi executado.','notice');
  }catch(error){toast(error.message||String(error),'warning')}
}
function openRejectDialog(record){
  document.getElementById('modal-root').insertAdjacentHTML('beforeend',`<div class="modal" id="reject-modal"><div class="modal-card rejection-dialog"><button class="modal-close" id="close-reject" type="button" aria-label="Fechar"><span data-icon="x"></span></button><h2>Reprovar relatório</h2><p class="muted">Informe claramente o que precisa ser corrigido pela equipe de campo.</p><div class="field full" style="margin-top:16px"><label>${requiredLabel('Motivo da reprovação')}</label><textarea id="rejection-reason" placeholder="Descreva a inconsistência ou informação que precisa ser corrigida."></textarea></div><div class="report-actions"><button class="btn secondary" id="cancel-reject">Cancelar</button><button class="btn reject-action" id="confirm-reject">Confirmar reprovação</button></div></div></div>`);
  const close=()=>document.getElementById('reject-modal')?.remove();
  document.getElementById('close-reject').onclick=close;document.getElementById('cancel-reject').onclick=close;
  document.getElementById('reject-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
  document.getElementById('confirm-reject').onclick=async()=>{
    const reason=document.getElementById('rejection-reason').value.trim();if(!reason)return toast('Informe o motivo da reprovação.','warning');
    const button=document.getElementById('confirm-reject');button.disabled=true;button.textContent='Reprovando…';
    try{const reportId=record.servidorId||record.id;const {data,error}=await cloudClient.rpc('reject_maintenance_report',{p_report_id:reportId,p_reason:reason});if(error)throw error;await updateLocalAdministrativeStatus(record,'reprovado',{rejeitadoEm:data?.rejected_at||new Date().toISOString(),rejeitadoPor:currentUser(),motivoReprovacao:reason});close();await refreshAfterAdministrativeAction('Relatório reprovado e devolvido para correção.')}catch(error){button.disabled=false;button.textContent='Confirmar reprovação';toast(error.message||String(error),'warning')}
  };
}

async function beginControlledEdit(record){
  if(!canEditRecord(record))return toast('Este relatório não pode ser alterado com o perfil atual.','warning');
  document.getElementById('modal-root').innerHTML='';
  let editable=await idbGet('maintenanceRecords',record.id);
  if(!editable){editable={...record,cloud:false,servidorId:record.servidorId||record.id,updatedAt:record.updatedAt||new Date().toISOString()};await idbPut('maintenanceRecords',editable)}
  state.sub=editable.subestacao;state.maintenanceQueue=[...(editable.equipamentos||[])];state.selected=new Set(state.maintenanceQueue);state.queueIndex=0;state.batchId=editable.batchId||uid();state.activeReportNumber=editable.numeroRelatorio;state.editingRecordId=editable.id;state.editingOriginal=JSON.parse(JSON.stringify(editable));state.activeDraftId=`edit:${editable.id}`;state.pendingPhotos=[];
  const current=(editable.equipamentosSnapshot||[])[0];await idbPut('drafts',{id:state.activeDraftId,reportNumber:editable.numeroRelatorio,editingRecordId:editable.id,subestacao:editable.subestacao,assetId:current?.id||editable.equipamentos?.[0],assetSnapshot:current,maintenanceQueue:state.maintenanceQueue,queueIndex:0,batchId:state.batchId,form:editable.form||{},photos:[],salvoEm:new Date().toISOString(),user:currentUser(),version:APP_VERSION});setActiveNav('maintenance');renderActivity();
}

openReportDetails=async function(key){
  const r=state.reports.find(x=>x.key===key)||(await combinedReports()).find(x=>x.key===key);if(!r)return;
  const raw=r.raw,modern=r.source!=='imported',form=modern?(raw.form||{}):raw,photos=modern?await allPhotosForReport(raw.id):[],audits=modern?await allAuditsForRecord(raw):[],inconclusive=modern&&(r.outcome==='inconclusivo'||normalize(form.inconclusivo)==='sim');
  const fields=modern?[['Status',statusMeta(raw.status).label],['Revisão',String(raw.revisao||1)],['Subestação',r.substation],['Data',formatDate(form.data||raw.criadoEm)],['Responsável',r.author],['Tipo',form.tipo],['Ordem de serviço',form.os],['Horário',[form.inicio,form.fim].filter(Boolean).join(' às ')],['Resultado',inconclusive?'Inconclusivo':'Concluído'],['Fotos anexadas',String(photos.length)],['Arquitetura atualizada?',form.arquiteturaAtualizada],['Projeto atualizado?',form.projetoAtualizado],['Configuração realizada?',form.configuracaoRealizada],['Ajuste de proteção conferido?',form.ajusteProtecao],['Houve substituição de peça?',form.houvePeca],['Necessário retorno?',form.retorno]]:[['Subestação',r.substation],['Data',formatDate(raw.data)],['Responsável',raw.equipe],['Tipo',raw.tipoManutencao],['Ordem de serviço',raw.os],['Horário',[raw.inicio,raw.fim].filter(Boolean).join(' às ')],['Fabricante',raw.fabricante],['Modelo',raw.modelo],['Número de série',raw.serial]];
  const blocks=modern?[['Defeito encontrado ou condição da atividade',form.defeito],['Causa',form.causa],['Reparo/serviço realizado',form.reparo],['Ativo e configuração realizada',form.configuracao],['Peça substituída',form.peca],['Destino da peça retirada',form.destinoPeca],['Observações sobre a execução',form.comentarios],['Motivo ou pendência para conclusão',form.motivoInconclusao]]:[['Defeito ou condição encontrada',raw.defeito],['Causa',raw.causa],['Serviço/reparo realizado',raw.reparo],['Configuração',raw.configuracao],['Ativo substituído',raw.ativoSubstituido],['Peça substituída',raw.pecaSubstituida],['Comentários',raw.comentarios]];
  const reviewAllowed=modern&&state.role==='admin'&&['enviado','corrigido'].includes(raw.status);
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="report-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="close-report" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="report-header"><div><div style="display:flex;gap:6px;flex-wrap:wrap">${modern?statusPill(raw.status):''}${inconclusive?'<span class="status-pill inconclusive">Inconclusivo</span>':''}</div><h2>${esc(r.type)}</h2><p class="muted">${esc(r.substation)}</p></div></div>${raw.status==='reprovado'&&raw.motivoReprovacao?`<section class="rejection-panel"><h3>Motivo da reprovação</h3><p>${esc(raw.motivoReprovacao)}</p></section>`:''}<div class="detail-block" style="border:0;margin:0;padding:0"><h3>Ativos envolvidos</h3><div class="asset-tags">${r.assets.map(a=>`<span class="asset-tag">${esc(a)}</span>`).join('')}</div></div><div class="detail-grid" style="margin-top:15px">${fields.filter(x=>x[1]).map(([k,v])=>`<div class="detail-box"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>${blocks.filter(x=>x[1]&&normalize(x[1])!=='nao se aplica').map(([k,v])=>`<div class="detail-block"><h3>${esc(k)}</h3><p>${esc(v)}</p></div>`).join('')}${photos.length?`<div class="detail-block"><h3>Imagens da manutenção</h3><div class="folder-gallery">${photos.map(p=>`<article class="folder-photo" data-modal-photo="${p.id}"><img src="${blobUrl(p.blob)}" alt=""><div><b>${esc(p.category||'Imagem')}</b>${p.caption?` · ${esc(p.caption)}`:''}</div></article>`).join('')}</div></div>`:''}${modern?`<div class="detail-block"><h3>Histórico de alterações</h3><div class="audit-timeline">${audits.length?audits.map(a=>`<article class="audit-entry"><strong>${esc(actionLabel(a.action))}</strong><small>${formatDate(a.createdAt)} · ${new Date(a.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · ${esc(a.user?.name||'Usuário')}</small>${a.reason?`<p><b>Motivo:</b> ${esc(a.reason)}</p>`:''}${Array.isArray(a.changes)&&a.changes.length?`<div class="change-list">${a.changes.map(c=>`<div class="change-item"><b>${esc(c.label||c.field||'Campo')}</b><br>${esc(c.before||'—')} → ${esc(c.after||'—')}</div>`).join('')}</div>`:''}</article>`).join(''):'<div class="empty">Sem alterações registradas.</div>'}</div></div><div class="report-actions">${canEditRecord(raw)?`<button class="btn secondary" id="edit-report">${raw.status==='reprovado'&&state.role!=='admin'?'Corrigir relatório':'Editar relatório'}</button>`:''}${reportRequiresSync(raw.status)?'<button class="btn secondary" id="retry-sync">Tentar enviar</button>':''}${reviewAllowed?'<button class="btn reject-action" id="reject-report">Reprovar relatório</button><button class="btn approve-action" id="approve-report">Aprovar relatório</button>':''}</div>`:''}</div></div>`;
  document.getElementById('close-report').onclick=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('report-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
  document.querySelectorAll('[data-modal-photo]').forEach(c=>c.onclick=async()=>openPhoto(await idbGet('maintenancePhotos',c.dataset.modalPhoto)));
  document.getElementById('edit-report')?.addEventListener('click',()=>beginControlledEdit(raw));document.getElementById('approve-report')?.addEventListener('click',()=>approveRecord(raw));document.getElementById('reject-report')?.addEventListener('click',()=>openRejectDialog(raw));
  document.getElementById('retry-sync')?.addEventListener('click',async()=>{await enqueueSync(raw);const result=await processSyncQueue({force:true});if(result.processed)toast('Relatório enviado com sucesso.');await loadCloudSnapshot();state.reports=await combinedReports();openReportDetails('cloud:'+raw.id)});
};

const _v050RenderHome=renderHome;
renderHome=async function(){
  await _v050RenderHome();
  if(state.role!=='field')return;
  const rejected=state.cloudReports.filter(r=>r.status==='reprovado'&&(r.raw?.usuario?.id===state.cloudUser?.id||r.raw?.authorId===state.cloudUser?.id));
  if(!rejected.length)return;
  main.insertAdjacentHTML('beforeend',`<section class="field-review-section"><div class="section-title"><h2 style="font-size:18px">Relatórios devolvidos para correção</h2></div><div class="field-review-list">${rejected.map(r=>`<article class="field-review-item" data-field-rejected="${esc(r.key)}"><strong>${esc(r.assets.join(', ')||'Ativo não informado')}</strong><span>${esc(r.type)} · ${esc(r.substation)} · ${formatDate(r.date)}</span><span>${esc(r.raw?.motivoReprovacao||'Abra para consultar o motivo da reprovação.')}</span></article>`).join('')}</div></section>`);
  document.querySelectorAll('[data-field-rejected]').forEach(item=>item.onclick=async()=>{state.reports=await combinedReports();openReportDetails(item.dataset.fieldRejected)});
};


/* v0.5.2 — atualização automática entre dispositivos */
let liveUpdatesChannel=null;
let liveRefreshTimer=null;
let livePollingTimer=null;
let liveRefreshRunning=false;
let liveRefreshQueued=false;
let livePendingEvents=new Set();
let liveLastRefreshAt=0;

function stopLiveUpdates(){
  if(liveRefreshTimer){clearTimeout(liveRefreshTimer);liveRefreshTimer=null}
  if(livePollingTimer){clearInterval(livePollingTimer);livePollingTimer=null}
  if(liveUpdatesChannel&&cloudClient){try{cloudClient.removeChannel(liveUpdatesChannel)}catch(_){}}
  liveUpdatesChannel=null;
}

function scheduleLiveRefresh(kind='dados',delay=900){
  if(!state.cloudUser||!navigator.onLine)return;
  livePendingEvents.add(kind);
  if(liveRefreshTimer)clearTimeout(liveRefreshTimer);
  liveRefreshTimer=setTimeout(()=>refreshFromCloudAutomatically(),delay);
}

async function rerenderAfterLiveRefresh(){
  if(state.screen==='overview'&&state.role==='admin'){
    const searchValue=document.getElementById('report-search')?.value||'';
    const sourceValue=document.getElementById('report-source')?.value||'';
    const scrollY=window.scrollY;
    await renderOverview();
    const search=document.getElementById('report-search'),source=document.getElementById('report-source');
    if(search){search.value=searchValue;search.dispatchEvent(new Event('input'))}
    if(source){source.value=sourceValue;source.dispatchEvent(new Event('change'))}
    requestAnimationFrame(()=>window.scrollTo({top:scrollY,behavior:'auto'}));
    return;
  }
  if(state.screen==='home')await renderHome();
  if(state.screen==='database'&&[...livePendingEvents].some(k=>['ativos','subestacoes'].includes(k)))await renderDatabase();
  if(state.screen==='integration'&&[...livePendingEvents].some(k=>['operacoes_ativos','ativos','subestacoes'].includes(k)))await renderAssetOperationsHome();
  if(state.screen==='plan'&&livePendingEvents.has('plano_preventivo')){state.preventivePlan=[];await renderPreventivePlan();}
}

async function refreshFromCloudAutomatically({manual=false}={}){
  if(!state.cloudUser||!navigator.onLine)return;
  if(liveRefreshRunning){liveRefreshQueued=true;return}
  liveRefreshRunning=true;
  const pendingKinds=new Set(livePendingEvents);livePendingEvents.clear();
  const beforeIds=new Set((state.cloudReports||[]).map(r=>r.id));
  try{
    await loadCloudSnapshot();
    state.reports=await combinedReports();
    liveLastRefreshAt=Date.now();
    await updateConnectivityIndicator();
    await rerenderAfterLiveRefresh();
    const newCloudReports=(state.cloudReports||[]).filter(r=>!beforeIds.has(r.id)&&r.source!=='imported');
    if(manual)toast('Base atualizada.');
    else if(state.role==='admin'&&(newCloudReports.length||pendingKinds.has('novo_relatorio')))toast('Novo relatório recebido da equipe de campo.');
    else if(state.role==='field'&&pendingKinds.has('relatorio_atualizado'))toast('Um relatório seu foi atualizado pela equipe administrativa.','notice');
  }catch(error){
    if(manual)toast(error.message||'Não foi possível atualizar a base.','warning');
  }finally{
    liveRefreshRunning=false;
    if(liveRefreshQueued){liveRefreshQueued=false;scheduleLiveRefresh('dados',300)}
  }
}

function bindManualCloudRefresh(){
  const indicator=document.getElementById('connection-indicator');
  if(!indicator)return;
  indicator.style.cursor='pointer';
  indicator.setAttribute('role','button');
  indicator.setAttribute('tabindex','0');
  indicator.title='Clique para sincronizar e atualizar a base';
  const run=()=>refreshFromCloudAutomatically({manual:true});
  indicator.onclick=run;
  indicator.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();run()}};
}

function startLiveUpdates(){
  stopLiveUpdates();
  if(!cloudClient||!state.cloudUser||!navigator.onLine)return;
  liveUpdatesChannel=cloudClient
    .channel(`central-maintenance-${state.cloudUser.id}-${Date.now()}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'maintenance_reports'},()=>scheduleLiveRefresh('novo_relatorio',1200))
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'maintenance_reports'},()=>scheduleLiveRefresh('relatorio_atualizado',800))
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'maintenance_reports'},()=>scheduleLiveRefresh('relatorio_atualizado',800))
    .on('postgres_changes',{event:'*',schema:'public',table:'maintenance_report_assets'},()=>scheduleLiveRefresh('vinculos',1200))
    .on('postgres_changes',{event:'*',schema:'public',table:'maintenance_parts'},()=>scheduleLiveRefresh('pecas',1200))
    .on('postgres_changes',{event:'*',schema:'public',table:'maintenance_photos'},()=>scheduleLiveRefresh('fotos',1200))
    .on('postgres_changes',{event:'*',schema:'public',table:'audit_logs'},()=>scheduleLiveRefresh('auditoria',1200))
    .on('postgres_changes',{event:'*',schema:'public',table:'assets'},()=>scheduleLiveRefresh('ativos',1200))
    .on('postgres_changes',{event:'*',schema:'public',table:'substations'},()=>scheduleLiveRefresh('subestacoes',1200))
    .on('postgres_changes',{event:'*',schema:'public',table:'asset_operations'},()=>scheduleLiveRefresh('operacoes_ativos',1000))
    .on('postgres_changes',{event:'*',schema:'public',table:'maintenance_plan_items'},()=>scheduleLiveRefresh('plano_preventivo',1000))
    .subscribe();
  livePollingTimer=setInterval(()=>{
    if(document.visibilityState==='visible'&&navigator.onLine&&Date.now()-liveLastRefreshAt>55000)scheduleLiveRefresh('verificacao_periodica',0);
  },60000);
  bindManualCloudRefresh();
}

const _v051EnterApplication=enterApplication;
enterApplication=async function(...args){
  await _v051EnterApplication(...args);
  if(state.cloudUser){liveLastRefreshAt=Date.now();startLiveUpdates()}
};

const _v051LogoutConnectedUser=logoutConnectedUser;
logoutConnectedUser=async function(...args){stopLiveUpdates();return _v051LogoutConnectedUser(...args)};

window.addEventListener('focus',()=>{
  if(state.cloudUser&&navigator.onLine&&Date.now()-liveLastRefreshAt>10000)scheduleLiveRefresh('retorno_ao_aplicativo',250);
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&state.cloudUser&&navigator.onLine&&Date.now()-liveLastRefreshAt>10000)scheduleLiveRefresh('retorno_ao_aplicativo',250);
});
window.addEventListener('online',()=>{
  if(state.cloudUser){startLiveUpdates();scheduleLiveRefresh('reconectado',250)}
});
window.addEventListener('offline',()=>{
  if(liveUpdatesChannel&&cloudClient){try{cloudClient.removeChannel(liveUpdatesChannel)}catch(_){}}
  liveUpdatesChannel=null;
});


/* ===== v0.6.1: histórico exato, galeria avançada e Integração/Substituição ===== */
async function cloudPhotosForAsset(assetId){
  if(!navigator.onLine||!state.cloudUser)return [];
  const {data,error}=await cloudClient.from('maintenance_photos').select('*').eq('asset_id',assetId).order('created_at',{ascending:false});
  if(error)return [];
  const result=[];
  for(const row of data||[]){
    let cached=await idbGet('maintenancePhotos',row.id);
    if(!cached?.blob){
      const downloaded=await cloudClient.storage.from('maintenance-photos').download(row.storage_path);
      if(downloaded.error)continue;
      cached={id:row.id,maintenanceId:row.report_id,assetId:row.asset_id,blob:downloaded.data,category:row.category||'Imagem',caption:row.caption||'',criadoEm:row.created_at,storagePath:row.storage_path,cloudId:row.id};
      await idbPut('maintenancePhotos',cached);
    }
    result.push(cached);
  }
  return result;
}
async function allPhotosForAsset(assetId){
  const local=await idbByIndex('maintenancePhotos','assetId',assetId),cloud=await cloudPhotosForAsset(assetId),map=new Map();
  for(const p of [...cloud,...local])map.set(p.id,p);
  return [...map.values()].sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)));
}
async function allPhotosForReport(reportId){
  const local=await idbByIndex('maintenancePhotos','maintenanceId',reportId);
  if(!navigator.onLine||!state.cloudUser)return local;
  const {data,error}=await cloudClient.from('maintenance_photos').select('*').eq('report_id',reportId).order('created_at',{ascending:false});
  if(error)return local;
  const map=new Map(local.map(p=>[p.id,p]));
  for(const row of data||[]){
    let p=map.get(row.id)||await idbGet('maintenancePhotos',row.id);
    if(!p?.blob){
      const downloaded=await cloudClient.storage.from('maintenance-photos').download(row.storage_path);
      if(downloaded.error)continue;
      p={id:row.id,maintenanceId:row.report_id,assetId:row.asset_id,blob:downloaded.data,category:row.category||'Imagem',caption:row.caption||'',criadoEm:row.created_at,storagePath:row.storage_path,cloudId:row.id};
      await idbPut('maintenancePhotos',p);
    }
    map.set(p.id,p);
  }
  return [...map.values()].sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)));
}
openPhoto=function(photo,gallery=[photo]){
  if(!photo?.blob)return;
  const items=gallery.filter(p=>p?.blob),start=Math.max(0,items.findIndex(p=>p.id===photo.id));let index=start,scale=1,offsetX=0,offsetY=0,lastX=0,lastY=0,drag=false,pinchDistance=0;
  const root=document.getElementById('modal-root');
  root.innerHTML=`<div class="modal" id="photo-modal"><div class="modal-card photo-viewer-card"><div class="photo-viewer-top"><div class="photo-viewer-title"><strong id="viewer-category"></strong><small id="viewer-caption"></small></div><div class="photo-viewer-actions"><button id="viewer-prev" title="Imagem anterior"><span data-icon="chevron-left"></span></button><button id="viewer-minus" title="Reduzir"><span data-icon="zoom-out"></span></button><span id="viewer-scale">100%</span><button id="viewer-plus" title="Ampliar"><span data-icon="zoom-in"></span></button><button id="viewer-fit" title="Ajustar à tela">Ajustar</button><a id="viewer-download" download>Baixar</a><button id="viewer-close" title="Fechar"><span data-icon="x"></span></button><button id="viewer-next" title="Próxima imagem"><span data-icon="chevron-right"></span></button></div></div><div class="photo-viewer-stage" id="viewer-stage"><img id="viewer-image" alt="Imagem do ativo"></div></div></div>`;
  const img=document.getElementById('viewer-image'),stage=document.getElementById('viewer-stage'),scaleText=document.getElementById('viewer-scale'),download=document.getElementById('viewer-download');
  function apply(){img.style.transform=`translate(${offsetX}px,${offsetY}px) scale(${scale})`;scaleText.textContent=`${Math.round(scale*100)}%`}
  function show(i){index=(i+items.length)%items.length;const p=items[index],url=blobUrl(p.blob);img.src=url;document.getElementById('viewer-category').textContent=p.category||'Imagem';document.getElementById('viewer-caption').textContent=p.caption||formatDate(p.criadoEm)||'';download.href=url;download.download=`${(p.category||'imagem').replace(/[^\w-]+/g,'_')}_${formatDate(p.criadoEm).replaceAll('-','')||p.id}.jpg`;scale=1;offsetX=offsetY=0;apply();document.getElementById('viewer-prev').disabled=items.length<2;document.getElementById('viewer-next').disabled=items.length<2}
  function close(){root.innerHTML=''}
  document.getElementById('viewer-close').onclick=close;document.getElementById('photo-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
  document.getElementById('viewer-plus').onclick=()=>{scale=Math.min(5,scale+.25);apply()};document.getElementById('viewer-minus').onclick=()=>{scale=Math.max(.25,scale-.25);apply()};document.getElementById('viewer-fit').onclick=()=>{scale=1;offsetX=offsetY=0;apply()};
  document.getElementById('viewer-prev').onclick=()=>show(index-1);document.getElementById('viewer-next').onclick=()=>show(index+1);
  stage.onwheel=e=>{e.preventDefault();scale=Math.max(.25,Math.min(5,scale+(e.deltaY<0?.15:-.15)));apply()};
  stage.onpointerdown=e=>{if(e.pointerType==='touch')return;drag=true;lastX=e.clientX;lastY=e.clientY;img.classList.add('dragging');stage.setPointerCapture(e.pointerId)};
  stage.onpointermove=e=>{if(!drag)return;offsetX+=e.clientX-lastX;offsetY+=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;apply()};
  stage.onpointerup=()=>{drag=false;img.classList.remove('dragging')};
  stage.ontouchstart=e=>{if(e.touches.length===2)pinchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);else if(e.touches.length===1){lastX=e.touches[0].clientX;lastY=e.touches[0].clientY}};
  stage.ontouchmove=e=>{e.preventDefault();if(e.touches.length===2){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(pinchDistance){scale=Math.max(.25,Math.min(5,scale*d/pinchDistance));apply()}pinchDistance=d}else if(e.touches.length===1){offsetX+=e.touches[0].clientX-lastX;offsetY+=e.touches[0].clientY-lastY;lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;apply()}};
  document.addEventListener('keydown',function keyHandler(e){if(!document.getElementById('photo-modal'))return document.removeEventListener('keydown',keyHandler);if(e.key==='Escape')close();if(e.key==='ArrowRight'&&items.length>1)show(index+1);if(e.key==='ArrowLeft'&&items.length>1)show(index-1)});
  show(index);
};

renderSide=async function(hist,sel){
  const side=document.getElementById('side-content');if(!side)return;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
  if(state.tab==='history'){side.innerHTML=`<p class="muted" style="font-size:12px">Histórico exclusivo do ativo em atendimento.</p><div class="history">${hist.length?hist.sort((a,b)=>String(b.data).localeCompare(String(a.data))).map(r=>`<article class="history-card"><div class="date">${formatDate(r.data)} · ${esc(r.os||'Sem OS')}</div><h4>${esc(r.tipoManutencao||'Atendimento')} — ${esc(r.ativo||r.tipoEquipamento)}</h4>${r.status?`<span class="status-pill ${statusMeta(r.status).className}">${esc(statusMeta(r.status).label)}</span>`:''}${r.equipe?`<p><b>Equipe:</b> ${esc(r.equipe)}</p>`:''}${r.reparo?`<p><b>Reparo:</b> ${esc(r.reparo)}</p>`:''}${r.comentarios?`<p>${esc(r.comentarios)}</p>`:''}${r.pecaSubstituida?`<p><b>Peça:</b> ${esc(r.pecaSubstituida)}</p>`:''}</article>`).join(''):'<div class="empty">Sem histórico vinculado.</div>'}</div>`;return}
  side.innerHTML=`<div class="asset-folder-controls"><select id="folder-asset">${sel.map(e=>`<option value="${e.id}" ${state.folderAsset===e.id?'selected':''}>${esc(assetTitle(e))}</option>`).join('')}</select></div><div id="folder-body"><div class="empty">Carregando pasta...</div></div>`;
  document.getElementById('folder-asset').onchange=e=>{state.folderAsset=e.target.value;renderSide(hist,sel)};
  const asset=sel.find(e=>e.id===state.folderAsset),profile=await photoForAsset(state.folderAsset),photos=await allPhotosForAsset(state.folderAsset);
  document.getElementById('folder-body').innerHTML=`<div class="folder-profile">${profile?`<img src="${blobUrl(profile)}" alt="Foto principal">`:'<div class="equip-placeholder"><span data-icon="settings"></span></div>'}<div><strong>${esc(assetTitle(asset||{}))}</strong><div class="muted" style="font-size:11px;margin-top:5px">${profile?'Foto principal cadastrada':'Sem foto principal — adicione no quadro do ativo no formulário'}</div><div class="muted" style="font-size:11px">${photos.length} foto(s) de manutenção</div></div></div><div class="folder-gallery">${photos.length?photos.map(p=>`<article class="folder-photo" data-open-photo="${p.id}"><img src="${blobUrl(p.blob)}" alt=""><div><b>${esc(p.category)}</b>${p.caption?` · ${esc(p.caption)}`:''}<br>${formatDate(p.criadoEm)}</div></article>`).join(''):'<div class="empty" style="grid-column:1/-1">As fotos vinculadas às manutenções aparecerão aqui.</div>'}</div>`;
  document.querySelectorAll('[data-open-photo]').forEach(c=>c.onclick=()=>openPhoto(photos.find(p=>p.id===c.dataset.openPhoto),photos));
};

function operationNumber(prefix){const d=new Date(),date=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;return `${prefix}-${date}-${crypto.randomUUID().slice(0,8).toUpperCase()}`}
async function loadAssetOperations(){
  const local=(await idbAll('assetOperations')).filter(belongsToCurrentUser),map=new Map(local.map(x=>[x.id,x]));
  if(navigator.onLine&&state.cloudUser){
    const {data,error}=await cloudClient.from('asset_operations').select('*').order('created_at',{ascending:false}).limit(100);
    if(!error)for(const row of data||[])map.set(row.id,{id:row.id,number:row.operation_number,type:row.operation_type,replacementType:row.replacement_type||'',substationId:row.substation_id,currentAssetId:row.current_asset_id||'',authorId:row.author_id,status:row.status,isTest:row.is_test,payload:row.payload||{},createdAt:row.created_at,updatedAt:row.updated_at,cloud:true});
  }
  return [...map.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
async function syncAssetOperation(operation){
  if(!navigator.onLine||!state.cloudUser)return false;
  const {error}=await cloudClient.from('asset_operations').insert({id:operation.id,operation_number:operation.number,idempotency_key:operation.idempotencyKey,operation_type:operation.type,replacement_type:operation.replacementType||null,substation_id:operation.substationId,current_asset_id:operation.currentAssetId||null,author_id:state.cloudUser.id,status:'enviado',is_test:!!operation.isTest,payload:operation.payload,created_at:operation.createdAt,updated_at:new Date().toISOString()});
  if(error&&error.code!=='23505')throw error;operation.status='sincronizado';operation.cloud=true;operation.updatedAt=new Date().toISOString();await idbPut('assetOperations',operation);return true;
}
async function syncPendingAssetOperations(){
  const pending=(await idbAll('assetOperations')).filter(x=>belongsToCurrentUser(x)&&(!x.cloud||x.status==='aguardando_envio'));
  for(const op of pending){try{await syncAssetOperation(op)}catch(_){}}
}
function operationTypeLabel(type){return type==='integracao'?'Integração de novo ativo':'Substituição de ativo'}
function operationSubstationOptions(selected=''){return [...DATA.substations].sort((a,b)=>(a.sigla+' '+a.nome).localeCompare(b.sigla+' '+b.nome,'pt-BR')).map(s=>`<option value="${s.id}" ${selected===s.id?'selected':''}>${esc(s.sigla)} — ${esc(s.nome)}</option>`).join('')}
function operationAssetOptions(subId,selected=''){if(!subId)return '<option value="">Selecione primeiro a subestação</option>';const groups=DATA.equipment[subId]||{eletronicos:[],reles:[],patio:[]};return [...groups.eletronicos,...groups.reles,...groups.patio].sort((a,b)=>assetTitle(a).localeCompare(assetTitle(b),'pt-BR')).map(a=>`<option value="${a.id}" ${selected===a.id?'selected':''}>${esc(assetTitle(a))}</option>`).join('')}
async function renderAssetOperationsHome(){
  state.screen='integration';setActiveNav('integration');await syncPendingAssetOperations();const operations=await loadAssetOperations(),tests=operations.filter(x=>x.isTest);
  main.innerHTML=`<div class="page-heading"><div><h1>Integração / Substituição de Ativos</h1><p>Registre a inclusão de um novo equipamento ou a substituição de um ativo existente.</p></div>${state.role==='admin'&&tests.length?`<button class="btn secondary" id="purge-test-operations">Limpar ${tests.length} teste(s)</button>`:''}</div><section class="panel"><div class="operation-hero"><div><h2>Escolha a atividade</h2><p class="muted">O cadastro principal de ativos não será alterado durante os testes. As operações são registradas separadamente para revisão.</p></div></div><div class="operation-type-grid"><button class="operation-card" data-operation-type="integracao"><span class="operation-icon" data-icon="plus"></span><h3>Integrar novo ativo</h3><p>Selecione uma subestação e inclua os dados técnicos do novo equipamento.</p></button><button class="operation-card orange" data-operation-type="substituicao"><span class="operation-icon" data-icon="exchange"></span><h3>Substituir ativo existente</h3><p>Carregue o equipamento atual e informe os dados do substituto, temporário ou definitivo.</p></button></div></section><section class="panel" style="margin-top:16px"><div class="section-title"><h2 style="font-size:18px">Operações recentes</h2><span class="muted">${operations.length} registro(s)</span></div><div class="operation-list">${operations.length?operations.slice(0,30).map(op=>`<article><div><strong>${esc(operationTypeLabel(op.type))} · ${esc(DATA.substations.find(s=>s.id===op.substationId)?.sigla||op.substationId)}</strong><span>${formatDate(op.createdAt)} · ${esc(op.payload?.equipe||state.cloudProfile?.display_name||'Equipe')}</span>${op.isTest?'<span class="test-badge">Teste — não altera ativos</span>':''}</div><span class="operation-status ${op.cloud?'synced':'pending'}">${op.cloud?'Sincronizado':'Aguardando envio'}</span></article>`).join(''):'<div class="empty">Nenhuma operação registrada.</div>'}</div></section>`;
  document.querySelectorAll('[data-operation-type]').forEach(b=>b.onclick=()=>renderAssetOperationForm(b.dataset.operationType));
  document.getElementById('purge-test-operations')?.addEventListener('click',async()=>{if(!confirm('Remover todos os registros marcados como teste? O cadastro principal de ativos não será afetado.'))return;const {data,error}=await cloudClient.rpc('purge_test_asset_operations');if(error)return toast(error.message,'warning');for(const op of tests)await idbDelete('assetOperations',op.id);toast(`${data||tests.length} registro(s) de teste removido(s).`);renderAssetOperationsHome()});
}
function operationAssets(substationId=null){const source=substationId?[DATA.equipment[substationId]]:Object.values(DATA.equipment);return source.filter(Boolean).flatMap(g=>[...(g.eletronicos||[]),...(g.reles||[]),...(g.patio||[])])}
function uniqueCatalog(values){const map=new Map();for(const raw of values){const value=String(raw||'').trim();if(!value||['xxxx','na','n/a'].includes(normalize(value)))continue;const key=normalize(value).replace(/\s+/g,' ');if(!map.has(key))map.set(key,value)}return [...map.values()].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}))}
function fillDatalist(id,values){const list=document.getElementById(id);if(list)list.innerHTML=uniqueCatalog(values).map(v=>`<option value="${esc(v)}"></option>`).join('')}
function refreshOperationCatalog(form){const substationId=form.substationId.value,manufacturer=form.manufacturer.value.trim(),subAssets=operationAssets(substationId);fillDatalist('operation-circuit-options',subAssets.map(a=>assetCircuit(a)));fillDatalist('operation-manufacturer-options',operationAssets().map(a=>a.fabricante));const models=operationAssets().filter(a=>!manufacturer||normalize(a.fabricante)===normalize(manufacturer)).map(a=>a.modelo);fillDatalist('operation-model-options',models)}

function renderAssetOperationForm(type){
  state.screen='integration-form';setActiveNav('integration');const isReplacement=type==='substituicao';
  main.innerHTML=`<div class="operation-form"><div class="head-row"><div><button class="back" id="back-operations" type="button" aria-label="Voltar à Integração / Substituição" title="Voltar à Integração / Substituição"><span data-icon="arrow-left"></span></button><h2>${esc(operationTypeLabel(type))}</h2><span class="muted">${isReplacement?'Selecione o ativo atual e cadastre os dados do substituto.':'Informe os dados do equipamento que será incluído na subestação.'}</span></div></div><section class="panel"><form id="asset-operation-form" class="form-grid"><div class="field"><label>${requiredLabel('Subestação')}</label><select name="substationId" required><option value="">Selecione</option>${operationSubstationOptions()}</select></div>${isReplacement?`<div class="field"><label>${requiredLabel('Ativo atual')}</label><select name="currentAssetId" required><option value="">Selecione primeiro a subestação</option></select></div><div class="field"><label>${requiredLabel('Tipo de substituição')}</label><select name="replacementType" required><option value="">Selecione</option><option value="temporaria">Temporária</option><option value="definitiva">Definitiva</option></select></div><div class="field"><label>${requiredLabel('Destino do ativo retirado')}</label><select name="removedDestination" required><option value="">Selecione</option><option>Reserva</option><option>Manutenção</option><option>Almoxarifado</option><option>Reparo externo</option><option>Desativação</option><option>Outro</option></select></div><div class="field full"><label>${requiredLabel('Motivo da substituição')}</label><textarea name="reason" required placeholder="Descreva a necessidade técnica da substituição."></textarea></div><div class="field hidden" id="expected-return-field"><label>${requiredLabel('Previsão de retorno')}</label><input type="date" name="expectedReturn"></div><section class="operation-section" id="current-asset-section"><h3>Dados do ativo atual</h3><p>Os dados serão carregados após selecionar o equipamento.</p><div id="current-asset-preview"></div></section>`:''}<section class="operation-section"><h3>${isReplacement?'Dados do ativo substituto':'Dados do novo ativo'}</h3><p>Preencha os dados disponíveis. Campos marcados com asterisco são obrigatórios.</p><div class="form-grid"><div class="field"><label>${requiredLabel('Categoria')}</label><select name="category" required><option value="">Selecione</option><option>Eletrônicos</option><option>Relés</option><option>Pátio</option></select></div><div class="field"><label>${requiredLabel('Nome ou tipo do ativo')}</label><input name="name" required placeholder="Ex.: Religador de subestação"></div><div class="field"><label>Circuito</label><input name="circuit" list="operation-circuit-options" autocomplete="off" placeholder="Selecione ou digite"><datalist id="operation-circuit-options"></datalist><span class="hybrid-help">Sugestões da subestação selecionada; também aceita preenchimento manual.</span></div><div class="field"><label>Fabricante</label><input name="manufacturer" list="operation-manufacturer-options" autocomplete="off" placeholder="Selecione ou digite"><datalist id="operation-manufacturer-options"></datalist><span class="hybrid-help">Fabricantes existentes na base; um novo nome pode ser informado.</span></div><div class="field"><label>Modelo</label><input name="model" list="operation-model-options" autocomplete="off" placeholder="Selecione ou digite"><datalist id="operation-model-options"></datalist><span class="hybrid-help">Os modelos são filtrados pelo fabricante, sem impedir um cadastro novo.</span></div><div class="field"><label>Número de série</label><input name="serialNumber"></div><div class="field"><label>Número operativo</label><input name="operatingNumber"></div><div class="field"><label>Identificação</label><input name="identification"></div></div></section><section class="operation-section"><h3>Dados da atividade</h3><p>Informações para rastreabilidade da integração ou substituição.</p><div class="form-grid"><div class="field"><label>${requiredLabel('Data da atividade')}</label><input type="date" name="activityDate" required value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>${requiredLabel('Equipe responsável')}</label><input name="equipe" required value="${esc(state.cloudProfile?.display_name||'')}"></div><div class="field"><label>Ordem de serviço</label><input name="serviceOrder"></div><div class="field full"><label>${requiredLabel('Testes, configuração e comissionamento')}</label><textarea name="commissioning" required></textarea></div><div class="field full"><label>Observações</label><textarea name="notes"></textarea></div></div></section><div class="field full"><label class="test-mode-box"><input type="checkbox" name="isTest" checked><span><strong>Modo de teste</strong><span>O registro será identificado como teste e não criará nem substituirá ativos no cadastro principal. Um administrador poderá remover todos os testes depois.</span></span></label></div><div class="field full" style="display:flex;justify-content:flex-end;gap:9px"><button type="button" class="btn secondary" id="cancel-operation">Cancelar</button><button type="submit" class="btn primary">Revisar e registrar</button></div></form></section></div>`;
  document.getElementById('back-operations').onclick=renderAssetOperationsHome;document.getElementById('cancel-operation').onclick=renderAssetOperationsHome;
  const form=document.getElementById('asset-operation-form'),sub=form.elements.substationId;refreshOperationCatalog(form);form.elements.manufacturer.addEventListener('input',()=>refreshOperationCatalog(form));sub.addEventListener('change',()=>refreshOperationCatalog(form));
  if(isReplacement){
    const assetSelect=form.elements.currentAssetId,replacement=form.elements.replacementType;
    sub.onchange=()=>{refreshOperationCatalog(form);assetSelect.innerHTML='<option value="">Selecione</option>'+operationAssetOptions(sub.value);document.getElementById('current-asset-preview').innerHTML=''};
    assetSelect.onchange=()=>{const groups=DATA.equipment[sub.value]||{eletronicos:[],reles:[],patio:[]},asset=[...groups.eletronicos,...groups.reles,...groups.patio].find(a=>a.id===assetSelect.value);document.getElementById('current-asset-preview').innerHTML=asset?`<div class="current-asset-preview">${[['Ativo',assetTitle(asset)],['Categoria',asset.grupo],['Fabricante',asset.fabricante],['Modelo',asset.modelo],['Série',asset.serial],['Número operativo',asset.numeroOperativo]].filter(x=>x[1]).map(([k,v])=>`<div class="detail-box"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>`:''};
    replacement.onchange=()=>{const field=document.getElementById('expected-return-field');field.classList.toggle('hidden',replacement.value!=='temporaria');form.elements.expectedReturn.required=replacement.value==='temporaria'};
  }
  form.onsubmit=e=>reviewAssetOperation(e,type,form);
}
function reviewAssetOperation(e,type,form){
  e.preventDefault();const values=Object.fromEntries(new FormData(form).entries());for(const key of ['circuit','manufacturer','model','serialNumber','operatingNumber','identification','name','equipe','serviceOrder'])if(typeof values[key]==='string')values[key]=values[key].trim();values.isTest=form.elements.isTest.checked;
  const required=['substationId','category','name','activityDate','equipe','commissioning'];if(type==='substituicao')required.push('currentAssetId','replacementType','removedDestination','reason');
  if(required.some(k=>!String(values[k]||'').trim()))return toast('Preencha todos os campos obrigatórios.','warning');
  const sub=DATA.substations.find(s=>s.id===values.substationId),groups=DATA.equipment[values.substationId]||{eletronicos:[],reles:[],patio:[]},current=[...groups.eletronicos,...groups.reles,...groups.patio].find(a=>a.id===values.currentAssetId);
  const review=[['Atividade',operationTypeLabel(type)],['Subestação',sub?`${sub.sigla} — ${sub.nome}`:values.substationId],['Ativo atual',current?assetTitle(current):''],['Tipo de substituição',values.replacementType],['Novo ativo',values.name],['Categoria',values.category],['Fabricante',values.manufacturer],['Modelo',values.model],['Número de série',values.serialNumber],['Data',formatDate(values.activityDate)],['Equipe',values.equipe],['Modo',values.isTest?'Teste — não altera ativos':'Registro operacional para revisão']];
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="operation-review-modal"><div class="modal-card rejection-dialog" style="max-width:760px"><button class="modal-close" id="close-operation-review"><span data-icon="x"></span></button><h2>Revisar operação</h2><p class="muted">Confira os dados antes de registrar.</p><div class="operation-review"><div class="operation-review-grid">${review.filter(x=>x[1]).map(([k,v])=>`<div class="operation-review-item"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div></div><div class="report-actions"><button class="btn secondary" id="edit-operation">Voltar e corrigir</button><button class="btn primary" id="confirm-operation">Confirmar registro</button></div></div></div>`;
  const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-operation-review').onclick=close;document.getElementById('edit-operation').onclick=close;
  document.getElementById('confirm-operation').onclick=()=>saveAssetOperation(type,values,current,close);
}
async function saveAssetOperation(type,values,current,close){
  const button=document.getElementById('confirm-operation');button.disabled=true;button.textContent='Registrando…';
  const now=new Date().toISOString(),operation={id:crypto.randomUUID(),number:operationNumber(type==='integracao'?'INT':'SUB'),idempotencyKey:crypto.randomUUID(),type,replacementType:values.replacementType||'',substationId:values.substationId,currentAssetId:values.currentAssetId||'',authorId:state.cloudUser?.id||'',status:'aguardando_envio',isTest:!!values.isTest,payload:{...values,currentAssetSnapshot:current||null},createdAt:now,updatedAt:now,cloud:false};
  await idbPut('assetOperations',operation);
  try{if(navigator.onLine)await syncAssetOperation(operation);close();toast(operation.cloud?'Operação registrada na nuvem.':'Operação salva e aguardando envio.');renderAssetOperationsHome()}catch(error){close();toast('Operação salva no dispositivo e aguardando sincronização.','notice');renderAssetOperationsHome()}
}
const _v060EnterApplication=enterApplication;
enterApplication=async function(...args){await _v060EnterApplication(...args);if(state.cloudUser&&navigator.onLine)setTimeout(syncPendingAssetOperations,500)};
window.addEventListener('online',()=>{if(state.cloudUser)setTimeout(syncPendingAssetOperations,700)});


/* ===== v0.9.0 — Gestão de Usuários ===== */
async function adminUsersInvoke(body){
  if(!navigator.onLine)throw new Error('A gestão de usuários exige conexão com a internet.');
  const {data,error}=await cloudClient.functions.invoke('admin-users',{body});
  if(error){
    let message=error.message||'Falha ao acessar a gestão de usuários.';
    try{if(error.context&&typeof error.context.json==='function'){const payload=await error.context.json();message=payload?.error||payload?.message||message}}catch(_){ }
    throw new Error(message);
  }
  if(data?.error)throw new Error(data.error);
  return data||{};
}
function formatDateTime(value){if(!value)return '—';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function userInitials(name,email){return String(name||email||'U').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'U'}
function userRoleLabel(role){return role==='admin'?'Administrativo':'Equipe de Campo'}
function generateTemporaryPassword(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes=new Uint32Array(10);crypto.getRandomValues(bytes);
  return 'CM!'+Array.from(bytes,n=>alphabet[n%alphabet.length]).join('');
}
async function renderUserManagement(){
  if(state.role!=='admin'){toast('A gestão de usuários é exclusiva da Equipe Administrativa.','warning');return renderHome()}
  state.screen='users';setActiveNav('users');
  main.innerHTML=`<div class="page-heading users-heading"><div><h1>Usuários</h1><p>Crie acessos, defina perfis e controle quem pode utilizar a Central de Manutenção.</p></div><button class="btn primary" id="new-user"><span data-icon="plus"></span>Novo usuário</button></div><section class="panel"><div class="empty">Carregando usuários…</div></section>`;hydrateIcons(main);
  document.getElementById('new-user').onclick=openCreateUserDialog;
  try{
    const payload=await adminUsersInvoke({action:'list'}),users=payload.users||[],audit=payload.audit||[];
    const active=users.filter(u=>u.active).length,admins=users.filter(u=>u.active&&u.role==='admin').length,fields=users.filter(u=>u.active&&u.role!=='admin').length,inactive=users.filter(u=>!u.active).length;
    main.innerHTML=`<div class="page-heading users-heading"><div><h1>Usuários</h1><p>Crie acessos, defina perfis e controle quem pode utilizar a Central de Manutenção.</p></div><button class="btn primary" id="new-user"><span data-icon="plus"></span>Novo usuário</button></div><div class="user-kpi-strip"><div class="user-kpi"><strong>${active}</strong><span>Ativos</span></div><div class="user-kpi"><strong>${admins}</strong><span>Administrativos</span></div><div class="user-kpi"><strong>${fields}</strong><span>Campo</span></div><div class="user-kpi"><strong>${inactive}</strong><span>Desativados</span></div></div><section class="panel"><div class="users-toolbar"><div class="search"><input id="user-search" placeholder="Buscar por nome ou e-mail"></div><select id="user-status-filter"><option value="all">Todos os status</option><option value="active">Ativos</option><option value="inactive">Desativados</option><option value="admin">Administrativos</option><option value="field">Equipe de Campo</option></select></div><div id="users-list"></div></section><section class="panel user-audit"><div class="section-title"><h2 style="font-size:17px">Alterações recentes</h2><span class="muted">Auditoria administrativa</span></div><div class="user-audit-list">${audit.length?audit.slice(0,12).map(a=>`<div class="user-audit-item"><small>${formatDateTime(a.created_at)}</small><div><strong>${esc(a.actor_name||'Administrador')}</strong> · ${esc(a.action_label||a.action||'Alteração')}<small>${a.target_name?` em ${esc(a.target_name)}`:''}${a.details?` · ${esc(a.details)}`:''}</small></div><small>${esc(a.target_email||'')}</small></div>`).join(''):'<div class="empty">Nenhuma alteração administrativa registrada.</div>'}</div></section>`;
    hydrateIcons(main);document.getElementById('new-user').onclick=openCreateUserDialog;document.querySelectorAll('[data-retry-notification]').forEach(button=>button.onclick=async()=>{const id=button.dataset.retryNotification;if(!id)return;button.disabled=true;button.textContent='Enviando…';try{await adminUsersInvoke({action:'retry_notification',notification_id:id});toast('Reenvio solicitado.');await renderUserManagement()}catch(error){button.disabled=false;button.textContent='Reenviar';toast(error.message,'warning')}});
    const renderList=()=>{
      const q=normalize(document.getElementById('user-search').value),filter=document.getElementById('user-status-filter').value;
      const filtered=users.filter(u=>{const text=normalize(`${u.display_name||''} ${u.email||''}`);const okText=!q||text.includes(q);const okFilter=filter==='all'||(filter==='active'&&u.active)||(filter==='inactive'&&!u.active)||(filter==='admin'&&u.role==='admin')||(filter==='field'&&u.role!=='admin');return okText&&okFilter});
      document.getElementById('users-list').innerHTML=filtered.length?`<div class="users-list"><div class="user-list-head"><span>Usuário</span><span>Último acesso</span><span>Perfil</span><span>Status</span><span>Ações</span></div>${filtered.map(u=>`<div class="user-list-row" data-user-id="${esc(u.id)}"><div class="user-person"><div class="user-person-avatar">${esc(userInitials(u.display_name,u.email))}</div><div><strong>${esc(u.display_name||'Usuário')}</strong><small>${esc(u.email||'')}</small>${u.must_change_password?'<small style="color:var(--orange-dark);font-weight:800">Troca de senha pendente</small>':''}</div></div><span class="user-list-muted">${u.last_sign_in_at?formatDateTime(u.last_sign_in_at):'Nunca acessou'}</span><span class="user-role-pill ${u.role==='admin'?'admin':'field'}">${userRoleLabel(u.role)}</span><span class="user-state-pill ${u.active?'active':'inactive'}">${u.active?'Ativo':'Desativado'}</span><div class="user-row-actions"><button data-edit-user="${esc(u.id)}">Editar</button><button data-reset-user="${esc(u.id)}">Nova senha</button></div></div>`).join('')}</div>`:'<div class="empty">Nenhum usuário encontrado.</div>';
      document.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>openEditUserDialog(users.find(u=>u.id===b.dataset.editUser)));
      document.querySelectorAll('[data-reset-user]').forEach(b=>b.onclick=()=>openResetUserPasswordDialog(users.find(u=>u.id===b.dataset.resetUser)));
    };
    document.getElementById('user-search').oninput=renderList;document.getElementById('user-status-filter').onchange=renderList;renderList();
  }catch(error){main.querySelector('.panel').innerHTML=`<div class="empty"><strong>Não foi possível carregar a gestão de usuários.</strong><br><span class="muted">${esc(error.message)}</span><br><br><span class="muted">Confirme se o SQL v0.9.0 foi executado e se a Edge Function <b>admin-users</b> está publicada no Supabase.</span></div>`}
}
function openCreateUserDialog(){
  const temp=generateTemporaryPassword();
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="create-user-modal"><div class="modal-card rejection-dialog" style="max-width:650px"><button class="modal-close" id="close-create-user"><span data-icon="x"></span></button><h2>Novo usuário</h2><p class="muted">O acesso será criado já validado. A senha temporária deverá ser alterada no primeiro login.</p><form id="create-user-form" class="user-form-grid"><div class="field full"><label>Nome completo *</label><input name="display_name" required autocomplete="off"></div><div class="field full"><label>E-mail *</label><input name="email" type="email" required placeholder="nome@exemplo.com" autocomplete="off"></div><div class="field"><label>Perfil *</label><select name="role" required><option value="field">Equipe de Campo</option><option value="admin">Administrativo</option></select></div><div class="field"><label>Status</label><select name="active"><option value="true">Ativo</option><option value="false">Desativado</option></select></div><div class="field full"><label>Senha temporária *</label><div class="temp-password-row"><input name="password" id="new-user-password" type="text" minlength="8" required value="${esc(temp)}"><button class="btn secondary" id="generate-user-password" type="button">Gerar outra</button></div><span class="password-rule">Use no mínimo 8 caracteres. O usuário será obrigado a criar uma nova senha no primeiro acesso.</span></div><div class="field full"><div class="report-actions"><button type="button" class="btn secondary" id="cancel-create-user">Cancelar</button><button type="submit" class="btn primary">Criar usuário</button></div></div></form></div></div>`;hydrateIcons(document.getElementById('modal-root'));
  const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-create-user').onclick=close;document.getElementById('cancel-create-user').onclick=close;document.getElementById('create-user-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.getElementById('generate-user-password').onclick=()=>document.getElementById('new-user-password').value=generateTemporaryPassword();
  const form=document.getElementById('create-user-form');form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),body={action:'create',display_name:String(fd.get('display_name')).trim(),email:String(fd.get('email')).trim().toLowerCase(),role:String(fd.get('role')),active:String(fd.get('active'))==='true',password:String(fd.get('password'))};if(!isValidAccountEmail(body.email))return toast('Informe um endereço de e-mail válido.','warning');if(body.password.length<8)return toast('A senha temporária precisa ter pelo menos 8 caracteres.','warning');setAuthBusy(form,true,'Criando…');try{const result=await adminUsersInvoke(body);close();showCreatedUserCredential(result.user,body.password);setTimeout(renderUserManagement,100)}catch(error){toast(error.message,'warning')}finally{setAuthBusy(form,false)}};
}
function showCreatedUserCredential(user,password){document.getElementById('modal-root').innerHTML=`<div class="modal" id="created-user-modal"><div class="modal-card rejection-dialog" style="max-width:560px"><button class="modal-close" id="close-created-user"><span data-icon="x"></span></button><h2>Usuário criado</h2><p class="muted">Repasse a senha temporária por um canal seguro. Ela deixa de ser válida assim que o usuário fizer a troca obrigatória.</p><div class="user-created-credential"><b>Usuário</b><code>${esc(user?.email||'')}</code></div><div class="user-created-credential"><b>Senha temporária</b><code>${esc(password)}</code></div><div class="report-actions"><button class="btn primary" id="finish-created-user">Concluir</button></div></div></div>`;hydrateIcons(document.getElementById('modal-root'));const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-created-user').onclick=close;document.getElementById('finish-created-user').onclick=close}
function openEditUserDialog(user){if(!user)return;document.getElementById('modal-root').innerHTML=`<div class="modal" id="edit-user-modal"><div class="modal-card rejection-dialog" style="max-width:620px"><button class="modal-close" id="close-edit-user"><span data-icon="x"></span></button><h2>Editar usuário</h2><p class="muted">${esc(user.email||'')}</p><form id="edit-user-form" class="user-form-grid"><div class="field full"><label>Nome completo *</label><input name="display_name" required value="${esc(user.display_name||'')}"></div><div class="field"><label>Perfil *</label><select name="role"><option value="field" ${user.role!=='admin'?'selected':''}>Equipe de Campo</option><option value="admin" ${user.role==='admin'?'selected':''}>Administrativo</option></select></div><div class="field"><label>Status *</label><select name="active"><option value="true" ${user.active?'selected':''}>Ativo</option><option value="false" ${!user.active?'selected':''}>Desativado</option></select></div><div class="field full"><span class="password-rule">Desativar um usuário bloqueia novos acessos. O sistema impede remover o próprio acesso administrativo e protege o último administrador ativo.</span></div><div class="field full"><div class="report-actions"><button type="button" class="btn secondary" id="cancel-edit-user">Cancelar</button><button type="submit" class="btn primary">Salvar alterações</button></div></div></form></div></div>`;hydrateIcons(document.getElementById('modal-root'));const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-edit-user').onclick=close;document.getElementById('cancel-edit-user').onclick=close;document.getElementById('edit-user-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};const form=document.getElementById('edit-user-form');form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),body={action:'update',user_id:user.id,display_name:String(fd.get('display_name')).trim(),role:String(fd.get('role')),active:String(fd.get('active'))==='true'};setAuthBusy(form,true,'Salvando…');try{await adminUsersInvoke(body);close();toast('Usuário atualizado.');await renderUserManagement()}catch(error){toast(error.message,'warning')}finally{setAuthBusy(form,false)}}}
function openResetUserPasswordDialog(user){if(!user)return;const temp=generateTemporaryPassword();document.getElementById('modal-root').innerHTML=`<div class="modal" id="reset-user-modal"><div class="modal-card rejection-dialog" style="max-width:560px"><button class="modal-close" id="close-reset-user"><span data-icon="x"></span></button><h2>Gerar nova senha</h2><p class="muted">${esc(user.display_name||user.email)} receberá uma senha temporária e terá que alterá-la no próximo acesso.</p><form id="reset-user-form"><div class="field"><label>Senha temporária *</label><div class="temp-password-row"><input name="password" id="reset-user-password" type="text" minlength="8" required value="${esc(temp)}"><button class="btn secondary" id="generate-reset-password" type="button">Gerar outra</button></div></div><div class="report-actions" style="margin-top:16px"><button type="button" class="btn secondary" id="cancel-reset-user">Cancelar</button><button type="submit" class="btn primary">Atualizar senha</button></div></form></div></div>`;hydrateIcons(document.getElementById('modal-root'));const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-reset-user').onclick=close;document.getElementById('cancel-reset-user').onclick=close;document.getElementById('reset-user-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.getElementById('generate-reset-password').onclick=()=>document.getElementById('reset-user-password').value=generateTemporaryPassword();const form=document.getElementById('reset-user-form');form.onsubmit=async e=>{e.preventDefault();const password=String(new FormData(form).get('password'));setAuthBusy(form,true,'Atualizando…');try{await adminUsersInvoke({action:'reset_password',user_id:user.id,password});close();showCreatedUserCredential({email:user.email},password);toast('Senha temporária atualizada.');setTimeout(renderUserManagement,100)}catch(error){toast(error.message,'warning')}finally{setAuthBusy(form,false)}}}
function openForcedPasswordChange(){
  if(!state.cloudProfile?.must_change_password)return;
  document.getElementById('modal-root').innerHTML=`<div class="modal force-password-backdrop"><div class="modal-card forced-password-card"><h2>Crie sua nova senha</h2><div class="auth-notice">Por segurança, a senha temporária deve ser substituída antes de continuar usando o aplicativo.</div><form id="forced-password-form" class="auth-form"><div class="auth-field"><label>Nova senha</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div><div class="auth-field"><label>Confirmar nova senha</label><input name="confirm" type="password" minlength="8" autocomplete="new-password" required></div><button class="btn primary auth-submit" type="submit">Salvar nova senha</button><div id="forced-password-message"></div></form></div></div>`;
  const form=document.getElementById('forced-password-form');form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),password=String(fd.get('password')),confirm=String(fd.get('confirm'));const msg=document.getElementById('forced-password-message');if(password.length<8){msg.innerHTML='<div class="auth-message error">Use pelo menos 8 caracteres.</div>';return}if(password!==confirm){msg.innerHTML='<div class="auth-message error">As senhas não coincidem.</div>';return}if(!navigator.onLine){msg.innerHTML='<div class="auth-message error">Conecte-se à internet para trocar a senha.</div>';return}setAuthBusy(form,true,'Salvando…');try{const {error}=await cloudClient.auth.updateUser({password});if(error)throw error;const {error:rpcError}=await cloudClient.rpc('clear_own_password_change_requirement');if(rpcError)throw rpcError;state.cloudProfile.must_change_password=false;storeIdentity(state.cloudUser,state.cloudProfile);document.getElementById('modal-root').innerHTML='';toast('Senha atualizada com sucesso.')}catch(error){msg.innerHTML=`<div class="auth-message error">${esc(error.message)}</div>`}finally{setAuthBusy(form,false)}};
}
const _v090NavigateTo=navigateTo;navigateTo=function(nav){if(nav==='users'){closeMoreMenu();return renderUserManagement()}return _v090NavigateTo(nav)};
const _v090OpenMobileMoreMenu=openMobileMoreMenu;openMobileMoreMenu=function(){const admin=state.role==='admin',moreButton=document.getElementById('mobile-more-menu');moreButton?.classList.add('active');document.getElementById('modal-root').innerHTML=`<div class="modal no-backdrop-close" id="mobile-more-modal"><div class="modal-card mobile-more-sheet"><button class="modal-close" id="close-mobile-more" type="button" aria-label="Fechar"><span data-icon="x"></span></button><h2>Mais opções</h2><div class="mobile-more-list">${admin?'<button data-mobile-nav="overview"><span data-icon="clipboard"></span>Relatórios</button><button data-mobile-nav="plan"><span data-icon="calendar"></span>PAM</button><button data-mobile-nav="users"><span data-icon="user"></span>Usuários</button>':''}<button data-mobile-nav="database"><span data-icon="database"></span>Banco de Dados</button><button id="mobile-profile-photo"><span data-icon="user"></span>Meu perfil e notificações</button><button id="mobile-logout"><span data-icon="logout"></span>Sair deste dispositivo</button></div></div></div>`;hydrateIcons(document.getElementById('modal-root'));document.getElementById('close-mobile-more').onclick=closeMobileMoreMenu;document.getElementById('mobile-more-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.querySelectorAll('[data-mobile-nav]').forEach(b=>b.onclick=()=>{closeMobileMoreMenu();navigateTo(b.dataset.mobileNav)});document.getElementById('mobile-profile-photo').onclick=()=>{closeMobileMoreMenu();openMyProfileDialog()};document.getElementById('mobile-logout').onclick=()=>{closeMobileMoreMenu();logoutConnectedUser()}};
const _v090EnterApplication=enterApplication;enterApplication=async function(...args){await _v090EnterApplication(...args);if(state.cloudProfile?.must_change_password)setTimeout(openForcedPasswordChange,80)};


/* ===== v0.9.1 — Autocadastro com aprovação + logout diário ===== */
const DAILY_SESSION_KEY='central_daily_session_day';
const DAILY_SESSION_TIME_ZONE='America/Sao_Paulo';
function dailySessionDay(){
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:DAILY_SESSION_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  catch(_){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
}
function markDailySession(){localStorage.setItem(DAILY_SESSION_KEY,dailySessionDay())}
function dailySessionValid(){return localStorage.getItem(DAILY_SESSION_KEY)===dailySessionDay()}
async function preserveCurrentDraftBeforeDailyLogout(){try{if(state.screen==='activity'){const form=document.getElementById('form');if(form)await saveDraft(form,{silent:true})}}catch(_){}}
async function dailySessionLogout(){
  if(!state.cloudUser&&!cachedIdentity())return;
  await preserveCurrentDraftBeforeDailyLogout();
  if(navigator.onLine&&cloudClient)await cloudClient.auth.signOut().catch(()=>{});
  localStorage.removeItem('central_offline_identity');localStorage.removeItem(DAILY_SESSION_KEY);
  state.cloudUser=null;state.cloudProfile=null;state.cloudReports=[];state.offlineSession=false;
  document.getElementById('modal-root').innerHTML='';
  document.getElementById('app-shell').classList.add('hidden');document.getElementById('auth-shell').classList.remove('hidden');
  showAuthTab('login');authMessage('Sua sessão diária foi encerrada. Entre novamente para continuar.','info');
}
async function enforceDailySessionBoundary(){if((state.cloudUser||cachedIdentity())&&!dailySessionValid())await dailySessionLogout()}
setInterval(enforceDailySessionBoundary,60000);
window.addEventListener('focus',enforceDailySessionBoundary);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')enforceDailySessionBoundary()});

const _v091LogoutConnectedUser=logoutConnectedUser;
logoutConnectedUser=async function(){
  if(!confirm('Sair da Central de Manutenção neste dispositivo?'))return;
  try{if(navigator.onLine)await cloudClient.auth.signOut()}finally{const logoutUserId=state.cloudUser?.id||cachedIdentity()?.user?.id;await clearSensitiveSessionCache(logoutUserId);localStorage.removeItem('central_offline_identity');localStorage.removeItem(DAILY_SESSION_KEY);state.cloudUser=null;state.cloudProfile=null;state.cloudReports=[];document.getElementById('app-shell').classList.add('hidden');document.getElementById('auth-shell').classList.remove('hidden');showAuthTab('login');authMessage('Sessão encerrada.','info')}
};
function userApprovalLabel(user){return user.approval_status==='pending'?'Pendente':user.approval_status==='rejected'?'Rejeitado':user.active?'Ativo':'Desativado'}
function requestedRoleLabel(user){return userRoleLabel(user.requested_role||user.role||'field')}
async function approveRequestedUser(user){
  if(!user)return;
  const chosen=user.requested_role||'field';
  if(!confirm(`Aprovar ${user.display_name||user.email} como ${userRoleLabel(chosen)}?`))return;
  try{await adminUsersInvoke({action:'approve',user_id:user.id});toast('Acesso aprovado.');await renderUserManagement()}catch(error){toast(error.message,'warning')}
}
async function rejectRequestedUser(user){
  if(!user||!confirm(`Rejeitar a solicitação de ${user.display_name||user.email}?`))return;
  try{await adminUsersInvoke({action:'reject',user_id:user.id});toast('Solicitação rejeitada.');await renderUserManagement()}catch(error){toast(error.message,'warning')}
}
function openApproveUserDialog(user){
  if(!user)return;
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="approve-user-modal"><div class="modal-card rejection-dialog" style="max-width:560px"><button class="modal-close" id="close-approve-user"><span data-icon="x"></span></button><h2>Aprovar acesso</h2><p class="muted">${esc(user.display_name||user.email)} escolheu o perfil <b>${esc(requestedRoleLabel(user))}</b>. A aprovação libera exatamente o tipo de conta solicitado.</p><div class="auth-notice">O perfil poderá ser alterado posteriormente pela administração, depois que a conta estiver ativa.</div><div class="report-actions" style="margin-top:16px"><button type="button" class="btn secondary" id="cancel-approve-user">Cancelar</button><button type="button" class="btn primary" id="confirm-approve-user">Aprovar acesso</button></div></div></div>`;
  hydrateIcons(document.getElementById('modal-root'));const close=()=>document.getElementById('modal-root').innerHTML='';
  document.getElementById('close-approve-user').onclick=close;document.getElementById('cancel-approve-user').onclick=close;document.getElementById('approve-user-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
  document.getElementById('confirm-approve-user').onclick=async()=>{close();await approveRequestedUser(user)};
}
renderUserManagement=async function(){
  if(state.role!=='admin'){toast('A gestão de usuários é exclusiva da Equipe Administrativa.','warning');return renderHome()}
  state.screen='users';setActiveNav('users');
  main.innerHTML=`<div class="page-heading users-heading"><div><h1>Usuários</h1><p>Aprove solicitações, ajuste perfis e controle os acessos à Central de Manutenção.</p></div></div><section class="panel"><div class="empty">Carregando usuários…</div></section>`;
  try{
    const payload=await adminUsersInvoke({action:'list'}),users=payload.users||[],audit=payload.audit||[];
    const pending=users.filter(u=>u.approval_status==='pending').length,active=users.filter(u=>u.approval_status==='approved'&&u.active).length,admins=users.filter(u=>u.approval_status==='approved'&&u.active&&u.role==='admin').length,inactive=users.filter(u=>u.approval_status==='rejected'||(u.approval_status==='approved'&&!u.active)).length;
    main.innerHTML=`<div class="page-heading users-heading"><div><h1>Usuários</h1><p>Os usuários solicitam o próprio acesso e permanecem bloqueados até aprovação administrativa.</p></div></div><div class="user-kpi-strip"><div class="user-kpi"><strong>${pending}</strong><span>Pendentes</span></div><div class="user-kpi"><strong>${active}</strong><span>Ativos</span></div><div class="user-kpi"><strong>${admins}</strong><span>Administrativos</span></div><div class="user-kpi"><strong>${inactive}</strong><span>Inativos / rejeitados</span></div></div><section class="panel"><div class="users-toolbar"><div class="search"><input id="user-search" placeholder="Buscar por nome ou e-mail"></div><select id="user-status-filter"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="active">Ativos</option><option value="inactive">Desativados</option><option value="rejected">Rejeitados</option><option value="admin">Administrativos</option><option value="field">Equipe de Campo</option></select></div><div id="users-list"></div></section><section class="panel user-audit"><div class="section-title"><h2 style="font-size:17px">Alterações recentes</h2><span class="muted">Auditoria administrativa</span></div><div class="user-audit-list">${audit.length?audit.slice(0,12).map(a=>`<div class="user-audit-item"><small>${formatDateTime(a.created_at)}</small><div><strong>${esc(a.actor_name||'Administrador')}</strong> · ${esc(a.action_label||a.action||'Alteração')}<small>${a.target_name?` em ${esc(a.target_name)}`:''}${a.details?` · ${esc(a.details)}`:''}</small></div><small>${esc(a.target_email||'')}</small></div>`).join(''):'<div class="empty">Nenhuma alteração administrativa registrada.</div>'}</div></section>`;
    const renderList=()=>{
      const q=normalize(document.getElementById('user-search').value),filter=document.getElementById('user-status-filter').value;
      const filtered=users.filter(u=>{const text=normalize(`${u.display_name||''} ${u.email||''}`);const status=u.approval_status||'approved';const okText=!q||text.includes(q);const okFilter=filter==='all'||(filter==='pending'&&status==='pending')||(filter==='rejected'&&status==='rejected')||(filter==='active'&&status==='approved'&&u.active)||(filter==='inactive'&&status==='approved'&&!u.active)||(filter==='admin'&&status==='approved'&&u.role==='admin')||(filter==='field'&&status==='approved'&&u.role!=='admin');return okText&&okFilter});
      document.getElementById('users-list').innerHTML=filtered.length?`<div class="users-list"><div class="user-list-head"><span>Usuário</span><span>Último acesso</span><span>Perfil</span><span>Status</span><span>Ações</span></div>${filtered.map(u=>{const status=u.approval_status||'approved',pending=status==='pending',rejected=status==='rejected',statusClass=pending?'pending':rejected?'rejected':u.active?'active':'inactive';return `<div class="user-list-row ${pending?'pending-user-row':''}" data-user-id="${esc(u.id)}"><div class="user-person"><div class="user-person-avatar">${esc(userInitials(u.display_name,u.email))}</div><div><strong>${esc(u.display_name||'Usuário')}</strong><small>${esc(u.email||'')}</small>${pending?`<span class="user-requested-role">Solicitou: ${esc(requestedRoleLabel(u))}</span>`:''}${u.must_change_password?'<small style="color:var(--orange-dark);font-weight:800">Troca de senha pendente</small>':''}</div></div><span class="user-list-muted">${u.last_sign_in_at?formatDateTime(u.last_sign_in_at):'Nunca acessou'}</span><span class="user-role-pill ${(pending?u.requested_role:u.role)==='admin'?'admin':'field'}">${pending?'Solicitado: ':''}${pending?requestedRoleLabel(u):userRoleLabel(u.role)}</span><span class="user-state-pill ${statusClass}">${userApprovalLabel(u)}</span><div class="user-row-actions">${pending?`<button class="approve-user" data-approve-user="${esc(u.id)}">Aprovar</button><button class="reject-user" data-reject-user="${esc(u.id)}">Rejeitar</button>`:`<button data-edit-user="${esc(u.id)}">Editar</button><button data-reset-user="${esc(u.id)}">Nova senha</button>`}</div></div>`}).join('')}</div>`:'<div class="empty">Nenhum usuário encontrado.</div>';
      document.querySelectorAll('[data-approve-user]').forEach(b=>b.onclick=()=>openApproveUserDialog(users.find(u=>u.id===b.dataset.approveUser)));
      document.querySelectorAll('[data-reject-user]').forEach(b=>b.onclick=()=>rejectRequestedUser(users.find(u=>u.id===b.dataset.rejectUser)));
      document.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>openEditUserDialog(users.find(u=>u.id===b.dataset.editUser)));
      document.querySelectorAll('[data-reset-user]').forEach(b=>b.onclick=()=>openResetUserPasswordDialog(users.find(u=>u.id===b.dataset.resetUser)));
    };
    document.getElementById('user-search').oninput=renderList;document.getElementById('user-status-filter').onchange=renderList;renderList();
  }catch(error){main.querySelector('.panel').innerHTML=`<div class="empty"><strong>Não foi possível carregar a gestão de usuários.</strong><br><span class="muted">${esc(error.message)}</span><br><br><span class="muted">Confirme se o SQL v0.9.1 foi executado e se a Edge Function <b>admin-users</b> foi atualizada.</span></div>`}
};



/* ===== v1.0.0 — WhatsApp transacional e preferências ===== */
function normalizeWhatsappInput(value){
  const raw=String(value??'').trim();if(!raw)return '';
  let digits=raw.replace(/\D/g,'');
  if(!raw.startsWith('+')&&!digits.startsWith('55')&&(digits.length===10||digits.length===11))digits='55'+digits;
  if(digits.length<8||digits.length>15)return '';
  return '+'+digits;
}
function formatWhatsapp(value){
  const phone=normalizeWhatsappInput(value);if(!phone)return 'Não cadastrado';
  const d=phone.replace(/\D/g,'');
  if(d.startsWith('55')&&(d.length===12||d.length===13)){
    const local=d.slice(2),ddd=local.slice(0,2),num=local.slice(2);
    return `+55 (${ddd}) ${num.length===9?num.slice(0,5)+'-'+num.slice(5):num.slice(0,4)+'-'+num.slice(4)}`;
  }
  return phone;
}
function checked(v){return v!==false?'checked':''}
function notificationPreferencesMarkup(profile={},role=profile.role||'field'){
  const admin=role==='admin';
  return `<div class="notification-master"><input type="checkbox" name="push_notifications_enabled" ${checked(profile.push_notifications_enabled)}><span>Receber notificações Push</span></div><div class="notification-pref-grid">${admin?`<label class="notification-pref"><input type="checkbox" name="notify_new_reports" ${checked(profile.notify_new_reports)}><span><strong>Novos relatórios</strong>Avisa quando a equipe de campo envia um novo relatório.</span></label><label class="notification-pref"><input type="checkbox" name="notify_report_corrected" ${checked(profile.notify_report_corrected)}><span><strong>Relatórios corrigidos</strong>Avisa quando uma correção é reenviada para análise.</span></label>`:`<label class="notification-pref"><input type="checkbox" name="notify_report_received" ${checked(profile.notify_report_received)}><span><strong>Confirmação de recebimento</strong>Confirma que o relatório chegou à base.</span></label><label class="notification-pref"><input type="checkbox" name="notify_report_approved" ${checked(profile.notify_report_approved)}><span><strong>Relatório aprovado</strong>Avisa quando a administração aprovar o relatório.</span></label><label class="notification-pref"><input type="checkbox" name="notify_report_rejected" ${checked(profile.notify_report_rejected)}><span><strong>Devolvido para correção</strong>Envia o motivo informado pela administração.</span></label>`}</div>`;
}
function notificationFormValues(fd,role){
  return {push_notifications_enabled:fd.get('push_notifications_enabled')==='on',notify_new_reports:role==='admin'?fd.get('notify_new_reports')==='on':true,notify_report_corrected:role==='admin'?fd.get('notify_report_corrected')==='on':true,notify_report_received:role!=='admin'?fd.get('notify_report_received')==='on':true,notify_report_approved:role!=='admin'?fd.get('notify_report_approved')==='on':true,notify_report_rejected:role!=='admin'?fd.get('notify_report_rejected')==='on':true};
}
async function openMyProfileDialog(){
  const u=currentUser(),p=state.cloudProfile||{},blob=await cachedUserAvatar();
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="my-profile-modal"><div class="modal-card rejection-dialog" style="max-width:650px"><button class="modal-close" id="close-my-profile"><span data-icon="x"></span></button><div class="whatsapp-profile-card"><div class="whatsapp-profile-head"><div class="whatsapp-profile-avatar">${blob?`<img src="${blobUrl(blob)}" alt="Foto do perfil">`:esc(u.initials)}</div><div><strong>${esc(u.name)}</strong><small>${esc(state.cloudUser?.email||'')} · ${esc(u.label)}</small></div></div><form id="my-profile-form" class="auth-form"><div class="auth-field"><label>WhatsApp</label><input name="whatsapp_number" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(32) 99999-9999" value="${esc(p.whatsapp_number||'')}"><small class="whatsapp-field-note">Salvo no padrão internacional como dado cadastral de contato. O Push não utiliza este número.</small></div><div><label style="display:block;font-size:11px;font-weight:850;color:#405660;margin-bottom:7px">Notificações</label>${notificationPreferencesMarkup(p,state.role)}</div><div class="report-actions"><button class="btn secondary" id="change-profile-photo" type="button">Foto do perfil</button><button class="btn primary" type="submit">Salvar preferências</button></div></form></div></div></div>`;
  hydrateIcons(document.getElementById('modal-root'));const close=()=>document.getElementById('modal-root').innerHTML='';
  document.getElementById('close-my-profile').onclick=close;document.getElementById('my-profile-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
  document.getElementById('change-profile-photo').onclick=()=>{close();openProfilePhotoDialog()};
  const form=document.getElementById('my-profile-form');form.onsubmit=async e=>{e.preventDefault();if(!navigator.onLine)return toast('Conecte-se à internet para atualizar seu perfil.','warning');const fd=new FormData(form),whatsapp=normalizeWhatsappInput(fd.get('whatsapp_number'));if(!whatsapp)return toast('Informe um WhatsApp válido com DDD.','warning');const prefs=notificationFormValues(fd,state.role);setAuthBusy(form,true,'Salvando…');try{const {error}=await cloudClient.rpc('update_own_push_notification_preferences',{p_whatsapp_number:whatsapp,p_push_notifications_enabled:prefs.push_notifications_enabled,p_notify_new_reports:prefs.notify_new_reports,p_notify_report_received:prefs.notify_report_received,p_notify_report_approved:prefs.notify_report_approved,p_notify_report_rejected:prefs.notify_report_rejected,p_notify_report_corrected:prefs.notify_report_corrected});if(error)throw error;state.cloudProfile=await fetchCurrentProfile(state.cloudUser);storeIdentity(state.cloudUser,state.cloudProfile);close();toast('Contato e notificações atualizados.')}catch(error){toast(error.message||String(error),'warning')}finally{setAuthBusy(form,false)}};
}

openCreateUserDialog=function(){
  const temp=generateTemporaryPassword();
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="create-user-modal"><div class="modal-card rejection-dialog" style="max-width:690px"><button class="modal-close" id="close-create-user"><span data-icon="x"></span></button><h2>Novo usuário</h2><p class="muted">Cadastre os dados de contato junto com o acesso. As preferências podem ser alteradas depois.</p><form id="create-user-form" class="user-form-grid"><div class="field full"><label>Nome completo *</label><input name="display_name" required></div><div class="field full"><label>E-mail *</label><input name="email" type="email" required placeholder="nome@exemplo.com"></div><div class="field full"><label>WhatsApp *</label><input name="whatsapp_number" type="tel" inputmode="tel" required placeholder="(32) 99999-9999"></div><div class="field"><label>Perfil *</label><select name="role" id="create-user-role"><option value="field">Equipe de Campo</option><option value="admin">Administrativo</option></select></div><div class="field"><label>Status</label><select name="active"><option value="true">Ativo</option><option value="false">Desativado</option></select></div><div class="field full" id="create-user-notifications">${notificationPreferencesMarkup({},'field')}</div><div class="field full"><label>Senha temporária *</label><div class="temp-password-row"><input name="password" id="new-user-password" type="text" minlength="8" required value="${esc(temp)}"><button class="btn secondary" id="generate-user-password" type="button">Gerar outra</button></div></div><div class="field full"><div class="report-actions"><button type="button" class="btn secondary" id="cancel-create-user">Cancelar</button><button type="submit" class="btn primary">Criar usuário</button></div></div></form></div></div>`;
  hydrateIcons(document.getElementById('modal-root'));const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-create-user').onclick=close;document.getElementById('cancel-create-user').onclick=close;document.getElementById('create-user-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.getElementById('generate-user-password').onclick=()=>document.getElementById('new-user-password').value=generateTemporaryPassword();
  const role=document.getElementById('create-user-role');role.onchange=()=>document.getElementById('create-user-notifications').innerHTML=notificationPreferencesMarkup({},role.value);
  const form=document.getElementById('create-user-form');form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),whatsapp=normalizeWhatsappInput(fd.get('whatsapp_number')),roleValue=String(fd.get('role')),prefs=notificationFormValues(fd,roleValue),body={action:'create',display_name:String(fd.get('display_name')).trim(),email:String(fd.get('email')).trim().toLowerCase(),whatsapp_number:whatsapp,role:roleValue,active:String(fd.get('active'))==='true',password:String(fd.get('password')),...prefs};if(!isValidAccountEmail(body.email))return toast('Informe um endereço de e-mail válido.','warning');if(!whatsapp)return toast('Informe um WhatsApp válido com DDD.','warning');if(body.password.length<8)return toast('A senha temporária precisa ter pelo menos 8 caracteres.','warning');setAuthBusy(form,true,'Criando…');try{const result=await adminUsersInvoke(body);close();showCreatedUserCredential(result.user,body.password);setTimeout(renderUserManagement,100)}catch(error){toast(error.message,'warning')}finally{setAuthBusy(form,false)}};
};

openEditUserDialog=function(user){
  if(!user)return;const profile={...user};
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="edit-user-modal"><div class="modal-card rejection-dialog" style="max-width:690px"><button class="modal-close" id="close-edit-user"><span data-icon="x"></span></button><h2>Editar usuário</h2><p class="muted">${esc(user.email||'')}</p><form id="edit-user-form" class="user-form-grid"><div class="field full"><label>Nome completo *</label><input name="display_name" required value="${esc(user.display_name||'')}"></div><div class="field full"><label>WhatsApp *</label><input name="whatsapp_number" type="tel" inputmode="tel" required value="${esc(user.whatsapp_number||'')}"></div><div class="field"><label>Perfil *</label><select name="role" id="edit-user-role"><option value="field" ${user.role!=='admin'?'selected':''}>Equipe de Campo</option><option value="admin" ${user.role==='admin'?'selected':''}>Administrativo</option></select></div><div class="field"><label>Status *</label><select name="active"><option value="true" ${user.active?'selected':''}>Ativo</option><option value="false" ${!user.active?'selected':''}>Desativado</option></select></div><div class="field full" id="edit-user-notifications">${notificationPreferencesMarkup(profile,user.role)}</div><div class="field full"><span class="password-rule">O telefone pertence ao usuário como contato; as regras acima definem quais eventos serão enviados por Push.</span></div><div class="field full"><div class="report-actions"><button type="button" class="btn secondary" id="cancel-edit-user">Cancelar</button><button type="submit" class="btn primary">Salvar alterações</button></div></div></form></div></div>`;
  hydrateIcons(document.getElementById('modal-root'));const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-edit-user').onclick=close;document.getElementById('cancel-edit-user').onclick=close;document.getElementById('edit-user-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};const role=document.getElementById('edit-user-role');role.onchange=()=>document.getElementById('edit-user-notifications').innerHTML=notificationPreferencesMarkup(profile,role.value);
  const form=document.getElementById('edit-user-form');form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),roleValue=String(fd.get('role')),whatsapp=normalizeWhatsappInput(fd.get('whatsapp_number')),prefs=notificationFormValues(fd,roleValue),body={action:'update',user_id:user.id,display_name:String(fd.get('display_name')).trim(),role:roleValue,active:String(fd.get('active'))==='true',whatsapp_number:whatsapp,...prefs};if(body.active&&!whatsapp)return toast('Usuários ativos precisam ter um WhatsApp válido.','warning');setAuthBusy(form,true,'Salvando…');try{await adminUsersInvoke(body);close();toast('Usuário atualizado.');await renderUserManagement()}catch(error){toast(error.message,'warning')}finally{setAuthBusy(form,false)}};
};

openApproveUserDialog=function(user){
  if(!user)return;
  document.getElementById('modal-root').innerHTML=`<div class="modal" id="approve-user-modal"><div class="modal-card rejection-dialog" style="max-width:580px"><button class="modal-close" id="close-approve-user"><span data-icon="x"></span></button><h2>Aprovar acesso</h2><p class="muted">${esc(user.display_name||user.email)} solicitou o perfil <b>${esc(requestedRoleLabel(user))}</b>.</p><div class="field" style="margin-top:15px"><label>WhatsApp *</label><input id="approve-user-whatsapp" type="tel" inputmode="tel" required value="${esc(user.whatsapp_number||'')}" placeholder="(32) 99999-9999"><span class="whatsapp-field-note">Confirme o número antes de liberar o acesso.</span></div><div class="report-actions" style="margin-top:16px"><button type="button" class="btn secondary" id="cancel-approve-user">Cancelar</button><button type="button" class="btn primary" id="confirm-approve-user">Aprovar acesso</button></div></div></div>`;
  hydrateIcons(document.getElementById('modal-root'));const close=()=>document.getElementById('modal-root').innerHTML='';document.getElementById('close-approve-user').onclick=close;document.getElementById('cancel-approve-user').onclick=close;document.getElementById('approve-user-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.getElementById('confirm-approve-user').onclick=async()=>{const whatsapp=normalizeWhatsappInput(document.getElementById('approve-user-whatsapp').value);if(!whatsapp)return toast('Informe um WhatsApp válido com DDD.','warning');try{await adminUsersInvoke({action:'approve',user_id:user.id,whatsapp_number:whatsapp});close();toast('Acesso aprovado.');await renderUserManagement()}catch(error){toast(error.message,'warning')}};
};

function notificationEventLabel(type){return ({new_report_admin:'Novo relatório',report_received_field:'Relatório recebido',report_approved_field:'Relatório aprovado',report_rejected_field:'Devolvido para correção',report_corrected_admin:'Relatório corrigido'})[type]||type}
function notificationStatusLabel(status){return ({queued:'Na fila',sending:'Enviando',sent:'Enviado',delivered:'Entregue',read:'Lido',failed:'Falhou',skipped:'Ignorado'})[status]||status}

renderUserManagement=async function(){
  if(state.role!=='admin'){toast('A gestão de usuários é exclusiva da Equipe Administrativa.','warning');return renderHome()}
  state.screen='users';setActiveNav('users');main.innerHTML=`<div class="page-heading users-heading"><div><h1>Usuários e notificações</h1><p>Controle acessos, números e notificações da Central de Manutenção.</p></div></div><section class="panel"><div class="empty">Carregando usuários e notificações…</div></section>`;
  try{
    const payload=await adminUsersInvoke({action:'list'}),users=payload.users||[],audit=payload.audit||[],logs=payload.notification_logs||[],waConfigured=!!payload.push_configured;
    const pending=users.filter(u=>u.approval_status==='pending').length,active=users.filter(u=>u.approval_status==='approved'&&u.active).length,admins=users.filter(u=>u.approval_status==='approved'&&u.active&&u.role==='admin').length,whatsappReady=users.filter(u=>u.approval_status==='approved'&&u.active&&u.whatsapp_number&&u.push_notifications_enabled).length;
    main.innerHTML=`<div class="page-heading users-heading"><div><h1>Usuários e notificações</h1><p>O telefone permanece como dado cadastral; cada perfil escolhe quais eventos quer receber por Push.</p></div><button class="btn primary" id="new-user"><span data-icon="plus"></span>Novo usuário</button></div><div class="user-kpi-strip"><div class="user-kpi"><strong>${pending}</strong><span>Pendentes</span></div><div class="user-kpi"><strong>${active}</strong><span>Ativos</span></div><div class="user-kpi"><strong>${admins}</strong><span>Administrativos</span></div><div class="user-kpi"><strong>${whatsappReady}</strong><span>Push habilitado</span></div></div><section class="panel"><div class="whatsapp-config-banner"><div><strong>Notificações Web Push</strong><span>${waConfigured?'Chaves VAPID detectadas no backend.':'Chaves VAPID ainda não detectadas no backend.'}</span></div><i class="config-dot ${waConfigured?'':'pending'}"></i></div><div class="users-toolbar"><div class="search"><input id="user-search" placeholder="Buscar por nome, e-mail ou WhatsApp"></div><select id="user-status-filter"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="active">Ativos</option><option value="inactive">Desativados</option><option value="rejected">Rejeitados</option><option value="admin">Administrativos</option><option value="field">Equipe de Campo</option></select></div><div id="users-list"></div></section><section class="panel"><div class="section-title"><h2 style="font-size:17px">Últimas notificações</h2><span class="muted">Fila de notificações Push e histórico do sistema</span></div><div class="notification-log">${logs.length?logs.slice(0,24).map(n=>`<div class="notification-log-row"><div><strong>${esc(notificationEventLabel(n.event_type))}</strong><small>${esc(n.payload?.report_number||'')} · ${esc(n.recipient_name||'Usuário')}</small></div><span>${esc(formatWhatsapp(n.recipient_phone))}</span><span class="notify-state ${esc(n.status)}">${esc(notificationStatusLabel(n.status))}</span><span>${esc(formatDateTime(n.created_at))}</span>${n.status==='failed'&&Number(n.attempts||0)<5?`<button class="notification-retry" data-retry-notification="${esc(n.id)}">Reenviar</button>`:'<span></span>'}${n.last_error?`<small style="grid-column:1/-1;color:var(--danger)">${esc(n.last_error)}</small>`:''}</div>`).join(''):'<div class="empty">Nenhuma notificação registrada ainda.</div>'}</div></section><section class="panel user-audit"><div class="section-title"><h2 style="font-size:17px">Alterações recentes</h2><span class="muted">Auditoria administrativa</span></div><div class="user-audit-list">${audit.length?audit.slice(0,12).map(a=>`<div class="user-audit-item"><small>${formatDateTime(a.created_at)}</small><div><strong>${esc(a.actor_name||'Administrador')}</strong> · ${esc(a.action_label||a.action||'Alteração')}<small>${a.target_name?` em ${esc(a.target_name)}`:''}${a.details?` · ${esc(a.details)}`:''}</small></div><small>${esc(a.target_email||'')}</small></div>`).join(''):'<div class="empty">Nenhuma alteração administrativa registrada.</div>'}</div></section>`;
    hydrateIcons(main);document.getElementById('new-user').onclick=openCreateUserDialog;document.querySelectorAll('[data-retry-notification]').forEach(button=>button.onclick=async()=>{const id=button.dataset.retryNotification;if(!id)return;button.disabled=true;button.textContent='Enviando…';try{await adminUsersInvoke({action:'retry_notification',notification_id:id});toast('Reenvio solicitado.');await renderUserManagement()}catch(error){button.disabled=false;button.textContent='Reenviar';toast(error.message,'warning')}});
    const renderList=()=>{const q=normalize(document.getElementById('user-search').value),filter=document.getElementById('user-status-filter').value;const filtered=users.filter(u=>{const text=normalize(`${u.display_name||''} ${u.email||''} ${u.whatsapp_number||''}`),status=u.approval_status||'approved';const okText=!q||text.includes(q),okFilter=filter==='all'||(filter==='pending'&&status==='pending')||(filter==='rejected'&&status==='rejected')||(filter==='active'&&status==='approved'&&u.active)||(filter==='inactive'&&status==='approved'&&!u.active)||(filter==='admin'&&status==='approved'&&u.role==='admin')||(filter==='field'&&status==='approved'&&u.role!=='admin');return okText&&okFilter});document.getElementById('users-list').innerHTML=filtered.length?`<div class="users-list"><div class="user-list-head"><span>Usuário</span><span>Último acesso</span><span>Perfil</span><span>Status</span><span>Ações</span></div>${filtered.map(u=>{const status=u.approval_status||'approved',pending=status==='pending',rejected=status==='rejected',statusClass=pending?'pending':rejected?'rejected':u.active?'active':'inactive',waReady=!!u.whatsapp_number&&u.push_notifications_enabled;return `<div class="user-list-row ${pending?'pending-user-row':''}"><div class="user-person"><div class="user-person-avatar">${esc(userInitials(u.display_name,u.email))}</div><div><strong>${esc(u.display_name||'Usuário')}</strong><small>${esc(u.email||'')}</small><small class="user-whatsapp-line ${waReady?'ready':'missing'}">${waReady?'WhatsApp: ':'WhatsApp pendente: '}${esc(formatWhatsapp(u.whatsapp_number))}</small>${pending?`<span class="user-requested-role">Solicitou: ${esc(requestedRoleLabel(u))}</span>`:''}</div></div><span class="user-list-muted">${u.last_sign_in_at?formatDateTime(u.last_sign_in_at):'Nunca acessou'}</span><span class="user-role-pill ${(pending?u.requested_role:u.role)==='admin'?'admin':'field'}">${pending?'Solicitado: ':''}${pending?requestedRoleLabel(u):userRoleLabel(u.role)}</span><span class="user-state-pill ${statusClass}">${userApprovalLabel(u)}</span><div class="user-row-actions">${pending?`<button class="approve-user" data-approve-user="${esc(u.id)}">Aprovar</button><button class="reject-user" data-reject-user="${esc(u.id)}">Rejeitar</button>`:`<button data-edit-user="${esc(u.id)}">Editar</button><button data-reset-user="${esc(u.id)}">Nova senha</button>`}</div></div>`}).join('')}</div>`:'<div class="empty">Nenhum usuário encontrado.</div>';document.querySelectorAll('[data-approve-user]').forEach(b=>b.onclick=()=>openApproveUserDialog(users.find(u=>u.id===b.dataset.approveUser)));document.querySelectorAll('[data-reject-user]').forEach(b=>b.onclick=()=>rejectRequestedUser(users.find(u=>u.id===b.dataset.rejectUser)));document.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>openEditUserDialog(users.find(u=>u.id===b.dataset.editUser)));document.querySelectorAll('[data-reset-user]').forEach(b=>b.onclick=()=>openResetUserPasswordDialog(users.find(u=>u.id===b.dataset.resetUser)))};
    document.getElementById('user-search').oninput=renderList;document.getElementById('user-status-filter').onchange=renderList;renderList();
  }catch(error){main.querySelector('.panel').innerHTML=`<div class="empty"><strong>Não foi possível carregar usuários/notificações.</strong><br><span class="muted">${esc(error.message)}</span><br><br><span class="muted">Execute a migration v1.0.0 e publique a Edge Function <b>admin-users</b>.</span></div>`}
};

const _v100EnterApplication=enterApplication;
enterApplication=async function(...args){
  await _v100EnterApplication(...args);
  if(state.cloudProfile&&!state.cloudProfile.whatsapp_number){
    setTimeout(()=>toast('Ative as notificações Push em Meu perfil neste dispositivo.','warning'),450);
  }
};


/* ===== v1.1.1 — Web Push + Central de Notificações ===== */
TABLER_ICON_PATHS.bell='<path d="M10 5a2 2 0 1 1 4 0"/><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9h-18c0-2 3-2 3-9"/><path d="M10 21h4"/>';

function notificationPreferencesMarkup(profile={},role=profile.role||'field'){
  const admin=role==='admin';
  return `<label class="notification-master"><input type="checkbox" name="push_notifications_enabled" ${checked(profile.push_notifications_enabled)}><span>Receber notificações Push</span></label><div class="notification-pref-grid">${admin?`<label class="notification-pref"><input type="checkbox" name="notify_new_reports" ${checked(profile.notify_new_reports)}><span><strong>Novos relatórios</strong>Avisa quando a equipe de campo envia um novo relatório.</span></label><label class="notification-pref"><input type="checkbox" name="notify_report_corrected" ${checked(profile.notify_report_corrected)}><span><strong>Relatórios corrigidos</strong>Avisa quando uma correção é reenviada para análise.</span></label>`:`<label class="notification-pref"><input type="checkbox" name="notify_report_received" ${checked(profile.notify_report_received)}><span><strong>Confirmação de recebimento</strong>Confirma que o relatório chegou à base.</span></label><label class="notification-pref"><input type="checkbox" name="notify_report_approved" ${checked(profile.notify_report_approved)}><span><strong>Relatório aprovado</strong>Avisa quando a administração aprovar o relatório.</span></label><label class="notification-pref"><input type="checkbox" name="notify_report_rejected" ${checked(profile.notify_report_rejected)}><span><strong>Devolvido para correção</strong>Mostra o motivo informado pela administração.</span></label>`}</div>`;
}
function notificationFormValues(fd,role){
  return {push_notifications_enabled:fd.get('push_notifications_enabled')==='on',notify_new_reports:role==='admin'?fd.get('notify_new_reports')==='on':true,notify_report_corrected:role==='admin'?fd.get('notify_report_corrected')==='on':true,notify_report_received:role!=='admin'?fd.get('notify_report_received')==='on':true,notify_report_approved:role!=='admin'?fd.get('notify_report_approved')==='on':true,notify_report_rejected:role!=='admin'?fd.get('notify_report_rejected')==='on':true};
}
function pushSupported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window}
function iosDevice(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function standaloneApp(){return window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true}
function vapidKeyBytes(value){
  const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
async function registerCentralServiceWorker(){
  if(!('serviceWorker' in navigator))return null;
  if(location.protocol!=='https:'&&location.hostname!=='localhost')return null;
  try{
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    try{await registration.update()}catch{}
    return navigator.serviceWorker.ready;
  }catch(error){console.warn('Service Worker:',error);return null}
}
async function currentPushSubscription(){
  if(!pushSupported())return null;
  const registration=await registerCentralServiceWorker();if(!registration)return null;
  return registration.pushManager.getSubscription();
}
async function fetchVapidPublicKey(){
  const {data,error}=await cloudClient.functions.invoke('push-config',{body:{action:'public_key'}});
  if(error)throw error;if(!data?.publicKey)throw new Error('Chave pública VAPID não disponível.');return data.publicKey;
}
async function savePushSubscription(subscription){
  const json=subscription.toJSON(),keys=json.keys||{};
  if(!json.endpoint||!keys.p256dh||!keys.auth)throw new Error('O navegador não retornou uma assinatura Push completa.');
  const {error}=await cloudClient.rpc('upsert_own_push_subscription',{p_endpoint:json.endpoint,p_p256dh:keys.p256dh,p_auth:keys.auth,p_user_agent:navigator.userAgent,p_platform:navigator.platform||null});
  if(error)throw error;
}
async function persistPushPreferences({enabled=true}={}){
  const p=state.cloudProfile||{},phone=p.whatsapp_number||'';
  const {error}=await cloudClient.rpc('update_own_push_notification_preferences',{
    p_whatsapp_number:phone,p_push_notifications_enabled:enabled,
    p_notify_new_reports:p.notify_new_reports!==false,p_notify_report_received:p.notify_report_received!==false,
    p_notify_report_approved:p.notify_report_approved!==false,p_notify_report_rejected:p.notify_report_rejected!==false,
    p_notify_report_corrected:p.notify_report_corrected!==false
  });
  if(error)throw error;
}
async function activatePushOnThisDevice(){
  if(!navigator.onLine)throw new Error('Conecte-se à internet para ativar as notificações.');
  if(!pushSupported())throw new Error('Este navegador não oferece suporte a notificações Push.');
  if(iosDevice()&&!standaloneApp())throw new Error('No iPhone/iPad, adicione a Central à Tela de Início e abra pelo ícone antes de ativar as notificações.');
  let permission=Notification.permission;
  if(permission!=='granted')permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('A permissão de notificações não foi concedida.');
  const registration=await registerCentralServiceWorker();if(!registration)throw new Error('Não foi possível registrar o serviço de notificações.');
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription){
    const key=await fetchVapidPublicKey();
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKeyBytes(key)});
  }
  await savePushSubscription(subscription);
  await persistPushPreferences({enabled:true});
  state.cloudProfile=await fetchCurrentProfile(state.cloudUser);storeIdentity(state.cloudUser,state.cloudProfile);
  await updateNotificationBell();
  return subscription;
}
async function deactivatePushOnThisDevice(){
  const subscription=await currentPushSubscription();if(!subscription)return false;
  const {error}=await cloudClient.rpc('deactivate_own_push_subscription',{p_endpoint:subscription.endpoint});if(error)throw error;
  await subscription.unsubscribe();return true;
}
async function ownNotifications(limit=80){
  if(!state.cloudUser||!navigator.onLine)return [];
  const {data,error}=await cloudClient.from('notification_outbox').select('id,event_type,report_id,report_revision,payload,status,read_at,created_at,last_error').order('created_at',{ascending:false}).limit(limit);
  if(error)throw error;return data||[];
}
function notificationBodyText(n){
  const p=n?.payload||{},sub=DATA.substations.find(s=>s.id===p.substation_id),subLabel=sub?`${sub.sigla} — ${sub.nome}`:(p.substation_id||'');
  const report=p.report_number||'Relatório',asset=p.asset_label||'Ativo não informado',author=p.author_name||'Equipe de Campo';
  if(n.event_type==='new_report_admin')return `${author} · ${subLabel} · ${asset}`;
  if(n.event_type==='report_received_field')return `${report} foi recebido pela Central de Manutenção.`;
  if(n.event_type==='report_approved_field')return `${report} · ${subLabel} · ${asset}`;
  if(n.event_type==='report_rejected_field')return `${report} · ${p.rejection_reason||'Consulte o motivo na Central.'}`;
  if(n.event_type==='report_corrected_admin')return `${author} reenviou ${report} · ${asset}`;
  return `${report} possui uma nova atualização.`;
}
async function updateNotificationBell(){
  const bell=document.getElementById('notification-bell'),badge=document.getElementById('notification-bell-count');
  if(!bell||!badge)return;
  if(!state.cloudUser||state.offlineSession||!navigator.onLine){badge.classList.add('hidden');return}
  try{
    const rows=await ownNotifications(100),count=rows.filter(n=>!n.read_at).length;
    badge.textContent=String(Math.min(count,99));badge.classList.toggle('hidden',count===0);bell.title=count?`${count} notificação(ões) não lida(s)`:'Notificações';
  }catch{badge.classList.add('hidden')}
}
async function markNotificationRead(id){
  const {error}=await cloudClient.rpc('mark_notification_read',{p_id:id});if(error)throw error;
}
async function openNotificationReport(notification){
  if(!notification?.report_id)return;
  try{
    state.reports=await combinedReports();
    const report=state.reports.find(r=>String(r.id)===String(notification.report_id)||String(r.raw?.id)===String(notification.report_id));
    if(report){openReportDetails(report.key);return}
    toast('O relatório desta notificação não está disponível neste dispositivo.','warning');
  }catch(error){toast(error.message||String(error),'warning')}
}
async function openNotificationCenter(){
  const root=document.getElementById('modal-root');
  root.innerHTML=`<div class="modal refined-notification-overlay no-backdrop-close" id="notification-center-modal"><div class="modal-card notification-center-card"><button class="modal-close" id="close-notification-center" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="notification-center-head"><div><h2>Notificações</h2><p class="muted">Atualizações da Central de Manutenção.</p></div><button class="notification-mark-all hidden" id="mark-all-notifications" type="button">Marcar todas como lidas</button></div><div id="notification-center-list" class="notification-center-list"><div class="notification-empty">Carregando…</div></div></div></div>`;
  const close=()=>root.innerHTML='';const overlay=document.getElementById('notification-center-modal');document.getElementById('close-notification-center').onclick=close;overlay.onclick=e=>{if(e.target===overlay)e.stopPropagation()};
  const escHandler=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',escHandler)}};document.addEventListener('keydown',escHandler);
  try{
    const rows=await ownNotifications(),list=document.getElementById('notification-center-list'),markAll=document.getElementById('mark-all-notifications'),unread=rows.filter(n=>!n.read_at).length;
    markAll.classList.toggle('hidden',!rows.length||!unread);
    list.innerHTML=rows.length?rows.map(n=>`<button class="notification-item ${n.read_at?'':'unread'}" data-notification-id="${esc(n.id)}"><span><strong>${esc(notificationEventLabel(n.event_type))}</strong><p>${esc(notificationBodyText(n))}</p><span class="notification-item-meta">${esc(notificationStatusLabel(n.status))}</span></span><time>${esc(formatDateTime(n.created_at))}</time></button>`).join(''):'<div class="notification-empty notification-empty-compact"><span data-icon="bell"></span><strong>Nenhuma notificação por enquanto.</strong></div>';
    hydrateIcons(list);list.querySelectorAll('[data-notification-id]').forEach(button=>button.onclick=async()=>{const n=rows.find(x=>x.id===button.dataset.notificationId);if(!n)return;try{if(!n.read_at)await markNotificationRead(n.id);await updateNotificationBell();close();await openNotificationReport(n)}catch(error){toast(error.message||String(error),'warning')}});
    markAll.onclick=async()=>{try{const {error}=await cloudClient.rpc('mark_all_notifications_read');if(error)throw error;await updateNotificationBell();await openNotificationCenter()}catch(error){toast(error.message||String(error),'warning')}};
  }catch(error){document.getElementById('notification-center-list').innerHTML=`<div class="notification-empty notification-empty-compact">${esc(error.message||String(error))}</div>`}
}
async function refreshPushDeviceCard(){
  const button=document.getElementById('push-device-toggle'),help=document.getElementById('push-device-help');if(!button)return;
  if(!pushSupported()){button.disabled=true;button.textContent='Push não suportado neste navegador';if(help)help.textContent='Use um navegador compatível para receber notificações neste dispositivo.';return}
  try{
    const sub=await currentPushSubscription(),active=!!sub&&Notification.permission==='granted';button.dataset.active=active?'true':'false';button.disabled=false;button.textContent=active?'Desativar neste dispositivo':'Ativar neste dispositivo';
    if(help){if(active)help.textContent='';else if(Notification.permission==='denied')help.textContent='As notificações estão bloqueadas nas configurações do navegador.';else if(iosDevice()&&!standaloneApp())help.textContent='No iPhone/iPad, adicione a Central à Tela de Início e abra pelo ícone antes de ativar.';else help.textContent='Ative para receber avisos neste computador ou celular.';help.classList.toggle('hidden',!help.textContent)}
    if(active&&navigator.onLine)savePushSubscription(sub).catch(()=>{});
  }catch{button.disabled=true;button.textContent='Não foi possível verificar este dispositivo'}
}
openMyProfileDialog=async function(){
  const u=currentUser(),p=state.cloudProfile||{},blob=await cachedUserAvatar(),email=state.cloudUser?.email||'',rawName=(p.display_name||'').trim(),primaryName=rawName&&rawName.toLowerCase()!==email.toLowerCase()&&!rawName.includes('@')?rawName:(email||'Usuário'),secondary=primaryName===email?u.label:`${email}${email?' · ':''}${u.label}`;
  const root=document.getElementById('modal-root');root.innerHTML=`<div class="modal" id="my-profile-modal"><div class="modal-card profile-settings-dialog"><button class="modal-close" id="close-my-profile"><span data-icon="x"></span></button><div class="whatsapp-profile-card"><div class="whatsapp-profile-head"><button class="whatsapp-profile-avatar profile-avatar-edit" id="profile-avatar-edit" type="button" aria-label="Alterar foto do perfil" title="Alterar foto do perfil">${blob?`<img src="${blobUrl(blob)}" alt="Foto do perfil">`:esc(u.initials)}<span class="profile-avatar-camera" data-icon="camera"></span></button><div class="profile-identity"><strong>${esc(primaryName)}</strong><small>${esc(secondary)}</small></div></div><form id="my-profile-form" class="auth-form"><div class="auth-field"><label>Telefone / WhatsApp de contato</label><input name="whatsapp_number" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(32) 99999-9999" value="${esc(p.whatsapp_number||'')}"></div><div><label class="profile-section-label">Preferências de notificações</label>${notificationPreferencesMarkup(p,state.role)}</div><div class="push-device-card refined-push-device"><div><strong>Este dispositivo</strong><small class="push-device-intro">Gerencie as notificações deste computador ou celular.</small></div><button class="btn secondary push-device-toggle" id="push-device-toggle" type="button">Verificando…</button><p class="push-help" id="push-device-help"></p></div><div class="profile-save-row"><button class="btn primary" type="submit">Salvar preferências</button></div></form></div></div></div>`;
  hydrateIcons(root);const close=()=>root.innerHTML='';document.getElementById('close-my-profile').onclick=close;document.getElementById('my-profile-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};document.getElementById('profile-avatar-edit').onclick=()=>{close();openProfilePhotoDialog()};
  document.getElementById('push-device-toggle').onclick=async e=>{const b=e.currentTarget,active=b.dataset.active==='true';b.disabled=true;b.textContent=active?'Desativando…':'Ativando…';try{if(active){await deactivatePushOnThisDevice();toast('Notificações desativadas neste dispositivo.')}else{await activatePushOnThisDevice();toast('Notificações ativadas neste dispositivo.')}await refreshPushDeviceCard()}catch(error){toast(error.message||String(error),'warning');await refreshPushDeviceCard()}};
  const form=document.getElementById('my-profile-form');form.onsubmit=async e=>{e.preventDefault();if(!navigator.onLine)return toast('Conecte-se à internet para atualizar seu perfil.','warning');const fd=new FormData(form),whatsapp=normalizeWhatsappInput(fd.get('whatsapp_number'));if(!whatsapp)return toast('Informe um telefone/WhatsApp válido com DDD.','warning');const prefs=notificationFormValues(fd,state.role);setAuthBusy(form,true,'Salvando…');try{const {error}=await cloudClient.rpc('update_own_push_notification_preferences',{p_whatsapp_number:whatsapp,p_push_notifications_enabled:prefs.push_notifications_enabled,p_notify_new_reports:prefs.notify_new_reports,p_notify_report_received:prefs.notify_report_received,p_notify_report_approved:prefs.notify_report_approved,p_notify_report_rejected:prefs.notify_report_rejected,p_notify_report_corrected:prefs.notify_report_corrected});if(error)throw error;state.cloudProfile=await fetchCurrentProfile(state.cloudUser);storeIdentity(state.cloudUser,state.cloudProfile);close();await updateNotificationBell();toast('Contato e notificações atualizados.')}catch(error){toast(error.message||String(error),'warning')}finally{setAuthBusy(form,false)}};
  await refreshPushDeviceCard();
};

renderUserManagement=async function(){
  if(state.role!=='admin'){toast('A gestão de usuários é exclusiva da Equipe Administrativa.','warning');return renderHome()}
  state.screen='users';setActiveNav('users');main.innerHTML=`<div class="page-heading users-heading"><div><h1>Usuários e notificações</h1><p>Controle acessos, contato cadastral e notificações Push da Central.</p></div></div><section class="panel"><div class="empty">Carregando usuários e notificações…</div></section>`;
  try{
    const payload=await adminUsersInvoke({action:'list'}),users=payload.users||[],audit=payload.audit||[],logs=payload.notification_logs||[],pushConfigured=!!payload.push_configured;
    const pending=users.filter(u=>u.approval_status==='pending').length,active=users.filter(u=>u.approval_status==='approved'&&u.active).length,admins=users.filter(u=>u.approval_status==='approved'&&u.active&&u.role==='admin').length,pushReady=users.filter(u=>u.approval_status==='approved'&&u.active&&u.push_notifications_enabled&&Number(u.push_device_count||0)>0).length;
    main.innerHTML=`<div class="page-heading users-heading"><div><h1>Usuários e notificações</h1><p>O telefone permanece cadastral; o Push é ativado individualmente em cada dispositivo.</p></div><button class="btn primary" id="new-user"><span data-icon="plus"></span>Novo usuário</button></div><div class="user-kpi-strip"><div class="user-kpi"><strong>${pending}</strong><span>Pendentes</span></div><div class="user-kpi"><strong>${active}</strong><span>Ativos</span></div><div class="user-kpi"><strong>${admins}</strong><span>Administrativos</span></div><div class="user-kpi"><strong>${pushReady}</strong><span>Push ativo</span></div></div><section class="panel"><div class="push-config-banner"><div><strong>Notificações Web Push</strong><span>${pushConfigured?'Chaves VAPID detectadas no backend.':'Chaves VAPID ainda não detectadas no backend.'}</span></div><i class="push-dot ${pushConfigured?'':'pending'}"></i></div><div class="users-toolbar"><div class="search"><input id="user-search" placeholder="Buscar por nome, e-mail ou telefone"></div><select id="user-status-filter"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="active">Ativos</option><option value="inactive">Desativados</option><option value="rejected">Rejeitados</option><option value="admin">Administrativos</option><option value="field">Equipe de Campo</option></select></div><div id="users-list"></div></section><section class="panel"><div class="section-title"><h2 style="font-size:17px">Últimas notificações</h2><span class="muted">Fila de Push e histórico interno</span></div><div class="notification-log">${logs.length?logs.slice(0,24).map(n=>`<div class="notification-log-row"><div><strong>${esc(notificationEventLabel(n.event_type))}</strong><small>${esc(n.payload?.report_number||'')} · ${esc(n.recipient_name||'Usuário')}</small></div><span>${esc(n.provider==='web_push'?'Web Push':(n.provider||'—'))}</span><span class="notify-state ${esc(n.status)}">${esc(notificationStatusLabel(n.status))}</span><span>${esc(formatDateTime(n.created_at))}</span>${n.status==='failed'&&Number(n.attempts||0)<5?`<button class="notification-retry" data-retry-notification="${esc(n.id)}">Reenviar</button>`:'<span></span>'}${n.last_error?`<small style="grid-column:1/-1;color:var(--danger)">${esc(n.last_error)}</small>`:''}</div>`).join(''):'<div class="empty">Nenhuma notificação registrada ainda.</div>'}</div></section><section class="panel user-audit"><div class="section-title"><h2 style="font-size:17px">Alterações recentes</h2><span class="muted">Auditoria administrativa</span></div><div class="user-audit-list">${audit.length?audit.slice(0,12).map(a=>`<div class="user-audit-item"><small>${formatDateTime(a.created_at)}</small><div><strong>${esc(a.actor_name||'Administrador')}</strong> · ${esc(a.action_label||a.action||'Alteração')}<small>${a.target_name?` em ${esc(a.target_name)}`:''}${a.details?` · ${esc(a.details)}`:''}</small></div><small>${esc(a.target_email||'')}</small></div>`).join(''):'<div class="empty">Nenhuma alteração administrativa registrada.</div>'}</div></section>`;
    hydrateIcons(main);document.getElementById('new-user').onclick=openCreateUserDialog;document.querySelectorAll('[data-retry-notification]').forEach(button=>button.onclick=async()=>{const id=button.dataset.retryNotification;if(!id)return;button.disabled=true;button.textContent='Enviando…';try{await adminUsersInvoke({action:'retry_notification',notification_id:id});toast('Reenvio solicitado.');await renderUserManagement()}catch(error){button.disabled=false;button.textContent='Reenviar';toast(error.message,'warning')}});
    const renderList=()=>{const q=normalize(document.getElementById('user-search').value),filter=document.getElementById('user-status-filter').value;const filtered=users.filter(u=>{const text=normalize(`${u.display_name||''} ${u.email||''} ${u.whatsapp_number||''}`),status=u.approval_status||'approved';const okText=!q||text.includes(q),okFilter=filter==='all'||(filter==='pending'&&status==='pending')||(filter==='rejected'&&status==='rejected')||(filter==='active'&&status==='approved'&&u.active)||(filter==='inactive'&&status==='approved'&&!u.active)||(filter==='admin'&&status==='approved'&&u.role==='admin')||(filter==='field'&&status==='approved'&&u.role!=='admin');return okText&&okFilter});document.getElementById('users-list').innerHTML=filtered.length?`<div class="users-list"><div class="user-list-head"><span>Usuário</span><span>Último acesso</span><span>Perfil</span><span>Status</span><span>Ações</span></div>${filtered.map(u=>{const status=u.approval_status||'approved',pending=status==='pending',rejected=status==='rejected',statusClass=pending?'pending':rejected?'rejected':u.active?'active':'inactive',deviceCount=Number(u.push_device_count||0),pushReady=u.push_notifications_enabled&&deviceCount>0;return `<div class="user-list-row ${pending?'pending-user-row':''}"><div class="user-person"><div class="user-person-avatar">${esc(userInitials(u.display_name,u.email))}</div><div><strong>${esc(u.display_name||'Usuário')}</strong><small>${esc(u.email||'')}</small><small>${esc(formatWhatsapp(u.whatsapp_number))}</small><small class="user-push-line ${pushReady?'ready':'missing'}">${pushReady?`Push ativo em ${deviceCount} dispositivo(s)`:(u.push_notifications_enabled?'Push ainda não ativado em dispositivo':'Notificações Push desativadas')}</small>${pending?`<span class="user-requested-role">Solicitou: ${esc(requestedRoleLabel(u))}</span>`:''}</div></div><span class="user-list-muted">${u.last_sign_in_at?formatDateTime(u.last_sign_in_at):'Nunca acessou'}</span><span class="user-role-pill ${(pending?u.requested_role:u.role)==='admin'?'admin':'field'}">${pending?'Solicitado: ':''}${pending?requestedRoleLabel(u):userRoleLabel(u.role)}</span><span class="user-state-pill ${statusClass}">${userApprovalLabel(u)}</span><div class="user-row-actions">${pending?`<button class="approve-user" data-approve-user="${esc(u.id)}">Aprovar</button><button class="reject-user" data-reject-user="${esc(u.id)}">Rejeitar</button>`:`<button data-edit-user="${esc(u.id)}">Editar</button><button data-reset-user="${esc(u.id)}">Nova senha</button>`}</div></div>`}).join('')}</div>`:'<div class="empty">Nenhum usuário encontrado.</div>';document.querySelectorAll('[data-approve-user]').forEach(b=>b.onclick=()=>openApproveUserDialog(users.find(u=>u.id===b.dataset.approveUser)));document.querySelectorAll('[data-reject-user]').forEach(b=>b.onclick=()=>rejectRequestedUser(users.find(u=>u.id===b.dataset.rejectUser)));document.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>openEditUserDialog(users.find(u=>u.id===b.dataset.editUser)));document.querySelectorAll('[data-reset-user]').forEach(b=>b.onclick=()=>openResetUserPasswordDialog(users.find(u=>u.id===b.dataset.resetUser)))};
    document.getElementById('user-search').oninput=renderList;document.getElementById('user-status-filter').onchange=renderList;renderList();
  }catch(error){main.querySelector('.panel').innerHTML=`<div class="empty"><strong>Não foi possível carregar usuários/notificações.</strong><br><span class="muted">${esc(error.message)}</span><br><br><span class="muted">Confirme a migration Web Push e as Edge Functions <b>admin-users</b>, <b>push-config</b> e <b>push-dispatch</b>.</span></div>`}
};


function inviteStatus(invite){
  if(invite.revoked_at)return {key:'revoked',label:'Revogado'};
  if(invite.used_at)return {key:'used',label:'Utilizado'};
  if(new Date(invite.expires_at).getTime()<=Date.now())return {key:'expired',label:'Expirado'};
  return {key:'active',label:'Ativo'};
}
function openCreateInviteDialog(){
  const root=document.getElementById('modal-root');root.innerHTML=`<div class="modal" id="invite-admin-modal"><div class="modal-card rejection-dialog" style="max-width:560px"><button class="modal-close" id="close-invite-admin"><span data-icon="x"></span></button><h2>Gerar código de convite</h2><p class="muted">Use como contingência quando o código por e-mail não chegar. O convite cria apenas acesso de Equipe de Campo.</p><form id="invite-admin-form" class="auth-form"><div class="auth-field"><label>Validade</label><select name="expires_hours"><option value="4">4 horas</option><option value="12">12 horas</option><option value="24" selected>24 horas</option><option value="48">48 horas</option><option value="72">72 horas</option></select></div><div class="auth-field"><label>Observação (opcional)</label><input name="note" maxlength="120" placeholder="Ex.: equipe da SE Cataguases"></div><button class="btn primary" type="submit">Gerar código</button></form></div></div>`;hydrateIcons(root);
  const close=()=>root.innerHTML='';document.getElementById('close-invite-admin').onclick=close;document.getElementById('invite-admin-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
  const form=document.getElementById('invite-admin-form');form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form);setAuthBusy(form,true,'Gerando…');try{const result=await adminUsersInvoke({action:'create_invite',expires_hours:Number(fd.get('expires_hours')||24),note:String(fd.get('note')||'').trim()});const invite=result.invite;root.innerHTML=`<div class="modal" id="invite-created-modal"><div class="modal-card rejection-dialog" style="max-width:580px"><h2>Código de convite criado</h2><p class="muted">Copie agora. Por segurança, o código completo não fica armazenado para consulta posterior.</p><div class="invite-code-display" id="invite-created-code">${esc(invite.code)}</div><p class="muted">Válido até ${esc(formatDateTime(invite.expires_at))}. Uso único.</p><div class="invite-created-actions"><button class="btn secondary" id="copy-invite-code" type="button">Copiar código</button><button class="btn primary" id="finish-invite-code" type="button">Concluir</button></div></div></div>`;document.getElementById('copy-invite-code').onclick=async()=>{try{await navigator.clipboard.writeText(invite.code);toast('Código copiado.')}catch{toast('Selecione e copie o código manualmente.','warning')}};document.getElementById('finish-invite-code').onclick=async()=>{root.innerHTML='';await renderUserManagement()};}catch(error){toast(error.message||String(error),'warning');setAuthBusy(form,false)}};
}
async function revokeSignupInvite(id){
  if(!confirm('Revogar este código de convite?'))return;
  try{await adminUsersInvoke({action:'revoke_invite',invite_id:id});toast('Convite revogado.');await renderUserManagement()}catch(error){toast(error.message||String(error),'warning')}
}
const _v130RenderUserManagementBase=renderUserManagement;
renderUserManagement=async function(){
  await _v130RenderUserManagementBase();if(state.role!=='admin'||state.screen!=='users')return;
  try{
    const payload=await adminUsersInvoke({action:'list'}),invites=payload.invites||[];
    const heading=main.querySelector('.users-heading');if(heading){const existing=heading.querySelector('#new-user');const actions=document.createElement('div');actions.className='users-heading-actions';if(existing){existing.replaceWith(actions);actions.appendChild(existing)}const inviteButton=document.createElement('button');inviteButton.className='btn secondary';inviteButton.id='new-invite';inviteButton.innerHTML='<span data-icon="plus"></span>Gerar convite';actions.appendChild(inviteButton);inviteButton.onclick=openCreateInviteDialog;hydrateIcons(actions)}
    const firstPanel=main.querySelector('section.panel');if(firstPanel){const panel=document.createElement('section');panel.className='panel invite-panel';panel.innerHTML=`<div class="section-title"><h2 style="font-size:17px">Códigos de convite</h2><span class="muted">Contingência para cadastro quando o e-mail de verificação não chegar.</span></div><div class="invite-list">${invites.length?invites.slice(0,20).map(i=>{const st=inviteStatus(i);return `<div class="invite-row"><div><strong>Convite ••••${esc(i.code_hint||'')}</strong><small>${esc(i.note||'Sem observação')}</small></div><div><span class="invite-state ${st.key}">${st.label}</span><small>Expira ${esc(formatDateTime(i.expires_at))}</small></div><div><small>Criado ${esc(formatDateTime(i.created_at))}${i.used_email?`<br>Uso: ${esc(i.used_email)}`:''}</small></div><div class="user-row-actions">${st.key==='active'?`<button data-revoke-invite="${esc(i.id)}">Revogar</button>`:''}</div></div>`}).join(''):'<div class="empty">Nenhum código de convite gerado.</div>'}</div>`;firstPanel.insertAdjacentElement('afterend',panel);panel.querySelectorAll('[data-revoke-invite]').forEach(b=>b.onclick=()=>revokeSignupInvite(b.dataset.revokeInvite))}
  }catch(error){console.warn('Convites administrativos:',error)}
};

async function processNotificationDeepLink(){
  const params=new URLSearchParams(location.search),id=params.get('notification');if(!id||!state.cloudUser||!navigator.onLine)return;
  try{
    const {data,error}=await cloudClient.from('notification_outbox').select('id,report_id').eq('id',id).maybeSingle();if(error)throw error;
    if(data){await markNotificationRead(id);await updateNotificationBell();await openNotificationReport(data)}
  }catch(error){console.warn('Deep link de notificação:',error)}
  params.delete('notification');const query=params.toString();history.replaceState({},'',location.pathname+(query?'?'+query:'')+location.hash);
}
const _v111EnterApplication=enterApplication;
enterApplication=async function(...args){
  await _v111EnterApplication(...args);
  const bell=document.getElementById('notification-bell');if(bell){bell.onclick=openNotificationCenter;hydrateIcons(bell)}
  await registerCentralServiceWorker();
  await updateNotificationBell();
  setTimeout(()=>processNotificationDeepLink(),250);
};
window.addEventListener('focus',()=>{if(state.cloudUser)updateNotificationBell()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.cloudUser)updateNotificationBell()});


async function reconcilePushRegistrationSilently(){
  if(!state.cloudUser||!navigator.onLine||!pushSupported()||Notification.permission!=='granted')return;
  try{const sub=await currentPushSubscription();if(sub)await savePushSubscription(sub)}catch(error){console.warn('Ressincronização Push:',error)}
}
const _v120EnterApplication=enterApplication;
enterApplication=async function(...args){await _v120EnterApplication(...args);const version=document.getElementById('app-version-label');if(version)version.textContent='v1.9.6';setTimeout(()=>reconcilePushRegistrationSilently(),300)};
const APP_BUILD='1.9.6';
async function ensureCurrentBuild(){
  try{
    const response=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)return true;
    const info=await response.json();
    if(info?.build&&info.build!==APP_BUILD){
      const next=new URL(location.href);
      next.searchParams.set('build',info.build);
      next.searchParams.set('refresh',Date.now().toString());
      location.replace(next.toString());
      return false;
    }
  }catch{}
  return true;
}


/* ===== v1.4.0 — saudação e indicadores contextuais ===== */
function homeFirstName(){
  const profileName=String(state.cloudProfile?.display_name||'').trim();
  const fallback=String(state.cloudUser?.email||currentUser()?.name||'Usuário').trim();
  const source=profileName&&!profileName.includes('@')?profileName:fallback;
  const token=(source.includes('@')?source.split('@')[0]:source).trim().split(/\s+/)[0]||'Usuário';
  return token.charAt(0).toLocaleUpperCase('pt-BR')+token.slice(1);
}
function currentWeekStartMs(){
  const now=new Date(),day=(now.getDay()+6)%7,start=new Date(now);
  start.setHours(0,0,0,0);start.setDate(now.getDate()-day);return start.getTime();
}
function smartReportTime(report){
  const raw=report?.createdAt||report?.raw?.criadoEm||report?.date||'';
  const value=new Date(raw).getTime();return Number.isFinite(value)?value:0;
}
function reportOwnedByCurrentUser(report){
  const uid=String(state.cloudUser?.id||''),email=normalize(state.cloudUser?.email||''),name=normalize(state.cloudProfile?.display_name||'');
  const rawUid=String(report?.raw?.usuario?.id||report?.raw?.authorId||'');
  if(uid&&rawUid===uid)return true;
  const rawEmail=normalize(report?.raw?.usuario?.email||'');if(email&&rawEmail&&rawEmail===email)return true;
  return !!(name&&normalize(report?.author||report?.raw?.usuario?.name||'')===name);
}
function pluralCount(value,singular,plural){return `${value} ${value===1?singular:plural}`}
async function enhanceSmartHome(){
  const card=main.querySelector('.welcome-card');if(!card)return;
  const title=card.querySelector('h1'),text=card.querySelector('p');if(!title||!text)return;
  title.textContent=`Olá, ${homeFirstName()}.`;
  text.classList.add('smart-home-summary');
  try{
    const all=(await combinedReports()).filter(r=>r.source!=='imported'),weekStart=currentWeekStartMs();
    if(state.role==='admin'){
      const week=all.filter(r=>smartReportTime(r)>=weekStart);
      const pending=all.filter(r=>['enviado','corrigido'].includes(String(r.status||'').toLowerCase()));
      const total=week.length,waiting=pending.length;
      if(!total&&!waiting){
        text.innerHTML='Nenhum relatório novo nesta semana e <strong>nenhuma conferência pendente</strong> no momento.';
      }else if(!waiting){
        text.innerHTML=`Nesta semana chegaram <strong>${pluralCount(total,'relatório','relatórios')}</strong>. Nenhum relatório aguarda conferência.`;
      }else{
        text.innerHTML=`Nesta semana chegaram <strong>${pluralCount(total,'relatório','relatórios')}</strong>. <strong class="attention">${pluralCount(waiting,'relatório aguarda','relatórios aguardam')} sua conferência</strong>.`;
      }
    }else{
      const own=all.filter(reportOwnedByCurrentUser),week=own.filter(r=>smartReportTime(r)>=weekStart),rejected=own.filter(r=>String(r.status||'').toLowerCase()==='reprovado');
      const total=week.length,corrections=rejected.length;
      if(!total&&!corrections){
        text.innerHTML='Você ainda não registrou relatórios nesta semana. <strong>Nenhuma correção pendente</strong> no momento.';
      }else if(!corrections){
        text.innerHTML=`Nesta semana você registrou <strong>${pluralCount(total,'relatório','relatórios')}</strong>. Nenhum relatório aguarda correção.`;
      }else{
        text.innerHTML=`Nesta semana você registrou <strong>${pluralCount(total,'relatório','relatórios')}</strong>. Você possui <strong class="attention">${pluralCount(corrections,'relatório devolvido','relatórios devolvidos')} para correção</strong>.`;
      }
    }
  }catch(error){
    console.warn('Resumo inteligente da página inicial:',error);
    text.textContent=state.role==='admin'?'Confira as movimentações recentes e os relatórios que aguardam sua análise.':'Registre suas manutenções e acompanhe aqui as pendências dos seus relatórios.';
  }
}
const _v140RenderHome=renderHome;
renderHome=async function(){await _v140RenderHome();await enhanceSmartHome()};
const _v140EnterApplication=enterApplication;
enterApplication=async function(...args){
  await _v140EnterApplication(...args);
  const footerVersion=document.getElementById('environment-footer-version');if(footerVersion)footerVersion.textContent='v1.9.6';
};


/* ===== v1.5.0 — exportação Excel padronizada + preparação multi-família ===== */
const ASSET_FAMILY_LABELS={SUBESTACAO:'Ativo de Subestação',REPETIDORA:'Repetidora',RELIGADOR_DISTRIBUICAO:'Religador de Distribuição'};
const EXPORT_SCHEMA_VERSION='CMSE_EXPORT_V1';
const EXPORT_ASSET_HEADERS=['ID_ATIVO','FAMILIA_ATIVO','EMPRESA','REGIAO','LOCAL','SIGLA_LOCAL','CATEGORIA','TIPO_ATIVO','LOCALIZACAO','CIRCUITO','FABRICANTE','MODELO','NUMERO_SERIE','NUMERO_OPERATIVO','IDENTIFICACAO','OBSERVACOES','VERSAO_REGISTRO','ULTIMA_MANUTENCAO'];
const EXPORT_MAINT_HEADERS=['ID_RELATORIO','NUMERO_RELATORIO','DATA_ATENDIMENTO','DATA_CRIACAO','FAMILIA_ATIVO','LOCAL','SIGLA_LOCAL','REGIAO','EQUIPE_RESPONSAVEL','TIPO_MANUTENCAO','ORDEM_SERVICO','INICIO','FIM','ATIVOS','IDS_ATIVOS','STATUS_RELATORIO','RESULTADO','REVISAO','DEFEITO','CAUSA','REPARO_REALIZADO','CONFIGURACAO','PECA_SUBSTITUIDA','DESTINO_PECA','COMENTARIOS','NECESSARIO_RETORNO','MOTIVO_DEVOLUCAO','FONTE'];

const _v150CloudAssetToLocal=cloudAssetToLocal;
cloudAssetToLocal=function(row){const asset=_v150CloudAssetToLocal(row);asset.familyCode=row.family_code||'SUBESTACAO';return asset};
const _v150ApplyCloudAssetToLocal=applyCloudAssetToLocal;
applyCloudAssetToLocal=function(asset,row){_v150ApplyCloudAssetToLocal(asset,row);asset.familyCode=row.family_code||asset.familyCode||'SUBESTACAO'};

function exportFamilyCode(asset){return String(asset?.familyCode||asset?.family_code||'SUBESTACAO').trim().toUpperCase()||'SUBESTACAO'}
function exportFamilyLabel(code){return ASSET_FAMILY_LABELS[code]||code||'Não informado'}
function exportSafeText(value){return value===null||value===undefined?'':String(value).trim()}
function exportIsoDate(value){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value).slice(0,10);return d.toISOString().slice(0,10)}
function exportDateTime(value){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);return d.toLocaleString('pt-BR')}
function exportStatusLabel(status){const map={enviado:'Enviado / aguardando análise',corrigido:'Corrigido / aguardando análise',aprovado:'Aprovado',reprovado:'Devolvido para correção',aguardando_envio:'Aguardando envio',salvo_local:'Salvo localmente',enviando:'Enviando'};return map[String(status||'').toLowerCase()]||status||'Não informado'}
function exportReportAssetIds(report){const raw=report?.raw||{},ids=raw.equipamentos||raw.assetIds||raw.payload?.equipamentos||[];return Array.isArray(ids)?ids.map(String):[]}
function exportReportFamilies(report){const ids=exportReportAssetIds(report),assets=catalogAssets(),byId=new Map(assets.map(a=>[String(a.id),a]));const families=[...new Set(ids.map(id=>exportFamilyCode(byId.get(id))).filter(Boolean))];return families.length?families:['SUBESTACAO']}
function standardAssetExportRows(){return catalogAssets().map(asset=>({
  ID_ATIVO:exportSafeText(asset.id),FAMILIA_ATIVO:exportFamilyLabel(exportFamilyCode(asset)),EMPRESA:exportSafeText((DATA.substations.find(s=>s.id===asset.subId)||{}).empresa),REGIAO:exportSafeText((DATA.substations.find(s=>s.id===asset.subId)||{}).regiao),LOCAL:exportSafeText(asset.subNome),SIGLA_LOCAL:exportSafeText(asset.subSigla),CATEGORIA:exportSafeText(asset.grupo),TIPO_ATIVO:exportSafeText(assetName(asset)),LOCALIZACAO:exportSafeText(asset.localizacao),CIRCUITO:exportSafeText(assetCircuit(asset)),FABRICANTE:exportSafeText(asset.fabricante),MODELO:exportSafeText(asset.modelo),NUMERO_SERIE:exportSafeText(asset.serial),NUMERO_OPERATIVO:exportSafeText(asset.numeroOperativo),IDENTIFICACAO:exportSafeText(asset.identificacao),OBSERVACOES:exportSafeText(asset.observacoes),VERSAO_REGISTRO:Number(asset.rowVersion||1),ULTIMA_MANUTENCAO:exportIsoDate(asset.ultimaManutencao)
})).sort((a,b)=>`${a.FAMILIA_ATIVO} ${a.SIGLA_LOCAL} ${a.TIPO_ATIVO}`.localeCompare(`${b.FAMILIA_ATIVO} ${b.SIGLA_LOCAL} ${b.TIPO_ATIVO}`,'pt-BR',{numeric:true}))}
function standardMaintenanceExportRow(report){
  const raw=report?.raw||{},form=raw.form||raw,payload=raw.payload||{},sub=DATA.substations.find(s=>s.id===report.subId)||{},assetIds=exportReportAssetIds(report),families=exportReportFamilies(report),modern=!!raw.form;
  const date=form.data||raw.data||report.date||report.createdAt,created=report.createdAt||raw.criadoEm||raw.created_at||date;
  return {ID_RELATORIO:exportSafeText(report.id),NUMERO_RELATORIO:exportSafeText(report.number||raw.numeroRelatorio||raw.report_number),DATA_ATENDIMENTO:exportIsoDate(date),DATA_CRIACAO:exportDateTime(created),FAMILIA_ATIVO:families.map(exportFamilyLabel).join(' / '),LOCAL:exportSafeText(sub.nome||report.substation),SIGLA_LOCAL:exportSafeText(sub.sigla||report.subId),REGIAO:exportSafeText(sub.regiao),EQUIPE_RESPONSAVEL:exportSafeText(canonicalTeamName(report.author||form.equipe||raw.equipe)),TIPO_MANUTENCAO:exportSafeText(report.type||form.tipo||raw.tipoManutencao),ORDEM_SERVICO:exportSafeText(form.os||raw.os||payload.ordemServico),INICIO:exportSafeText(form.inicio||raw.inicio),FIM:exportSafeText(form.fim||raw.fim),ATIVOS:(report.assets||[]).join(' | '),IDS_ATIVOS:assetIds.join(' | '),STATUS_RELATORIO:exportStatusLabel(report.status),RESULTADO:report.outcome==='inconclusivo'?'Inconclusivo':'Concluído',REVISAO:Number(raw.revisao||raw.revision||1),DEFEITO:exportSafeText(form.defeito||raw.defeito),CAUSA:exportSafeText(form.causa||raw.causa),REPARO_REALIZADO:exportSafeText(form.reparo||raw.reparo),CONFIGURACAO:exportSafeText(form.configuracao||raw.configuracao),PECA_SUBSTITUIDA:exportSafeText(form.peca||raw.pecaSubstituida),DESTINO_PECA:exportSafeText(form.destinoPeca||raw.destinoPeca),COMENTARIOS:exportSafeText(form.comentarios||raw.comentarios),NECESSARIO_RETORNO:exportSafeText(form.retorno||raw.necessitaRetorno),MOTIVO_DEVOLUCAO:exportSafeText(raw.motivoReprovacao||raw.rejection_reason),FONTE:report.source==='imported'?'Histórico importado':report.source==='local'?'Registro local':'Central de Manutenção'}
}
function exportPeriodBounds(preset,fromValue,toValue){const now=new Date(),start=new Date(now),end=new Date(now);start.setHours(0,0,0,0);end.setHours(23,59,59,999);if(preset==='week'){const day=(now.getDay()+6)%7;start.setDate(now.getDate()-day)}else if(preset==='month'){start.setDate(1)}else if(preset==='previous_month'){start.setMonth(now.getMonth()-1,1);end.setDate(0)}else if(preset==='last30'){start.setDate(now.getDate()-29)}else if(preset==='custom'){const f=fromValue?new Date(fromValue+'T00:00:00'):null,t=toValue?new Date(toValue+'T23:59:59'):null;return {start:f&&!Number.isNaN(f)?f:null,end:t&&!Number.isNaN(t)?t:null,label:[fromValue||'início',toValue||'hoje'].join(' a ')}}else return {start:null,end:null,label:'Todo o período'};return {start,end,label:`${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`}}
function exportReportDateMs(row){const value=row.DATA_ATENDIMENTO||row.DATA_CRIACAO;if(!value)return 0;const br=String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})/);const d=br?new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00`):new Date(value+'T12:00:00');return Number.isNaN(d.getTime())?0:d.getTime()}
function exportApplyMaintenanceFilters(rows,filters){const bounds=exportPeriodBounds(filters.period,filters.from,filters.to),start=bounds.start?.getTime()??-Infinity,end=bounds.end?.getTime()??Infinity;return rows.filter(row=>{const time=exportReportDateMs(row);return time>=start&&time<=end&&(!filters.team||row.EQUIPE_RESPONSAVEL===filters.team)&&(!filters.substation||row.SIGLA_LOCAL===filters.substation)&&(!filters.status||row.STATUS_RELATORIO===filters.status)&&(!filters.family||row.FAMILIA_ATIVO.includes(exportFamilyLabel(filters.family)))})}
function exportApplyAssetFilters(rows,filters){return rows.filter(row=>(!filters.family||row.FAMILIA_ATIVO===exportFamilyLabel(filters.family))&&(!filters.substation||row.SIGLA_LOCAL===filters.substation)&&(!filters.category||row.CATEGORIA===filters.category))}
function exportTeamSummary(rows){const map=new Map();for(const row of rows){const key=row.EQUIPE_RESPONSAVEL||'Não informado',item=map.get(key)||{EQUIPE:key,TOTAL:0,APROVADOS:0,DEVOLVIDOS:0,PENDENTES_ANALISE:0,INCONCLUSIVOS:0};item.TOTAL++;if(row.STATUS_RELATORIO==='Aprovado')item.APROVADOS++;if(row.STATUS_RELATORIO==='Devolvido para correção')item.DEVOLVIDOS++;if(row.STATUS_RELATORIO.includes('aguardando análise'))item.PENDENTES_ANALISE++;if(row.RESULTADO==='Inconclusivo')item.INCONCLUSIVOS++;map.set(key,item)}return [...map.values()].sort((a,b)=>b.TOTAL-a.TOTAL||a.EQUIPE.localeCompare(b.EQUIPE,'pt-BR'))}
function exportDictionaryRows(){return [
 {ABA:'Ativos',CAMPO:'ID_ATIVO',DESCRICAO:'Identificador permanente do ativo na Central',TIPO:'Texto/UUID',PADRAO:'Não alterar'},
 {ABA:'Ativos',CAMPO:'FAMILIA_ATIVO',DESCRICAO:'Família funcional do ativo',TIPO:'Categoria',PADRAO:'Ativo de Subestação | Repetidora | Religador de Distribuição'},
 {ABA:'Ativos',CAMPO:'LOCAL / SIGLA_LOCAL',DESCRICAO:'Instalação ou local operacional do ativo',TIPO:'Texto',PADRAO:'Padronizado por família'},
 {ABA:'Ativos',CAMPO:'CATEGORIA / TIPO_ATIVO',DESCRICAO:'Classificação técnica do equipamento',TIPO:'Texto',PADRAO:'Vocabulário controlado por módulo'},
 {ABA:'Ativos',CAMPO:'FABRICANTE / MODELO / NUMERO_SERIE',DESCRICAO:'Identificação cadastral do equipamento',TIPO:'Texto',PADRAO:'Campos comuns a todas as famílias'},
 {ABA:'Manutencoes',CAMPO:'ID_RELATORIO',DESCRICAO:'Identificador permanente do relatório',TIPO:'Texto/UUID',PADRAO:'Único'},
 {ABA:'Manutencoes',CAMPO:'DATA_ATENDIMENTO',DESCRICAO:'Data operacional informada no relatório',TIPO:'Data',PADRAO:'AAAA-MM-DD'},
 {ABA:'Manutencoes',CAMPO:'EQUIPE_RESPONSAVEL',DESCRICAO:'Equipe ou responsável pelo atendimento',TIPO:'Texto',PADRAO:'Nome cadastrado'},
 {ABA:'Manutencoes',CAMPO:'STATUS_RELATORIO',DESCRICAO:'Situação de análise do relatório',TIPO:'Categoria',PADRAO:'Aprovado | Devolvido | Aguardando análise | Aguardando envio'},
 {ABA:'Manutencoes',CAMPO:'ATIVOS / IDS_ATIVOS',DESCRICAO:'Ativos vinculados ao atendimento',TIPO:'Texto',PADRAO:'Separados por |'},
 {ABA:'Geral',CAMPO:'EXPORT_SCHEMA_VERSION',DESCRICAO:'Versão do contrato de exportação',TIPO:'Texto',PADRAO:EXPORT_SCHEMA_VERSION}
]}
function exportWorkbookSheet(wb,name,rows,headers,widths){const data=rows.length?rows:[Object.fromEntries(headers.map(h=>[h,'']))],ws=XLSX.utils.json_to_sheet(data,{header:headers});ws['!cols']=widths||headers.map(h=>({wch:Math.min(34,Math.max(12,h.length+2))}));ws['!autofilter']={ref:ws['!ref']};XLSX.utils.book_append_sheet(wb,ws,name);return ws}
function exportInfoSheet(wb,meta){const rows=[['CENTRAL DE MANUTENÇÃO — EXPORTAÇÃO PADRONIZADA'],[''],['Versão do aplicativo',APP_BUILD],['Versão do padrão de exportação',EXPORT_SCHEMA_VERSION],['Gerado em',new Date().toLocaleString('pt-BR')],['Usuário',state.cloudProfile?.display_name||state.cloudUser?.email||'Usuário'],['Perfil',state.role==='admin'?'Equipe Administrativa':'Equipe de Campo'],['Tipo de exportação',meta.modeLabel],['Período',meta.periodLabel||'Não aplicável'],['Equipe',meta.team||'Todas as equipes disponíveis'],['Local',meta.substation||'Todos os locais'],['Família',meta.family?exportFamilyLabel(meta.family):'Todas as famílias disponíveis'],['Status',meta.status||'Todos'],['Observação','Os campos comuns foram padronizados com base no cadastro atual de Subestações e preparados para futuras famílias de Repetidoras e Religadores de Distribuição.']];const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:34},{wch:82}];XLSX.utils.book_append_sheet(wb,ws,'Informacoes')}
function exportSummarySheet(wb,maintenance,assets){const statusCounts=new Map();maintenance.forEach(r=>statusCounts.set(r.STATUS_RELATORIO,(statusCounts.get(r.STATUS_RELATORIO)||0)+1));const rows=[['RESUMO DA EXPORTAÇÃO'],[''],['Ativos exportados',assets.length],['Manutenções exportadas',maintenance.length],['Equipes no período',new Set(maintenance.map(r=>r.EQUIPE_RESPONSAVEL).filter(Boolean)).size],['Locais envolvidos',new Set([...assets.map(r=>r.SIGLA_LOCAL),...maintenance.map(r=>r.SIGLA_LOCAL)].filter(Boolean)).size],[''],['STATUS','QUANTIDADE'],...[...statusCounts.entries()].sort((a,b)=>b[1]-a[1])];const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:42},{wch:18}];XLSX.utils.book_append_sheet(wb,ws,'Resumo')}
function exportFileName(prefix){return `${prefix}_${new Date().toISOString().slice(0,10)}.xlsx`.replace(/[^a-zA-Z0-9À-ÿ_.-]+/g,'_')}
async function buildStandardExport(mode,filters){
  if(!spreadsheetModuleReady())return;
  const allReports=(await combinedReports()).map(standardMaintenanceExportRow),allAssets=standardAssetExportRows(),filteredMaint=exportApplyMaintenanceFilters(allReports,filters),filteredAssets=exportApplyAssetFilters(allAssets,filters),bounds=exportPeriodBounds(filters.period,filters.from,filters.to),wb=XLSX.utils.book_new();
  const labels={assets:'Base de Ativos',maintenance:'Manutenções',history:'Histórico por Ativo',consolidated:'Workbook Consolidado'};
  let assets=filteredAssets,maintenance=filteredMaint,file='Central_Dados';
  if(mode==='assets'){maintenance=[];file='Central_Base_Ativos'}
  if(mode==='maintenance'){assets=[];file='Central_Manutencoes'}
  if(mode==='history'){
    const selected=String(filters.asset||'');if(!selected)return toast('Selecione um ativo para exportar o histórico.','warning');const current=allAssets.find(a=>a.ID_ATIVO===selected);assets=current?[current]:[];maintenance=filteredMaint.filter(r=>r.IDS_ATIVOS.split(' | ').includes(selected)||r.ATIVOS.split(' | ').some(name=>current&&name===current.TIPO_ATIVO));file=`Central_Historico_${current?.SIGLA_LOCAL||'Ativo'}_${current?.TIPO_ATIVO||selected}`
  }
  if(mode==='consolidated')file='Central_Dados_Consolidados';
  if(!assets.length&&!maintenance.length)return toast('Nenhum dado corresponde aos filtros selecionados.','notice');
  exportInfoSheet(wb,{modeLabel:labels[mode],periodLabel:bounds.label,team:filters.team,substation:filters.substation,family:filters.family,status:filters.status});
  if(mode==='consolidated')exportSummarySheet(wb,maintenance,assets);
  if(assets.length)exportWorkbookSheet(wb,'Ativos',assets,EXPORT_ASSET_HEADERS,[{wch:38},{wch:26},{wch:28},{wch:14},{wch:27},{wch:14},{wch:18},{wch:34},{wch:24},{wch:20},{wch:23},{wch:26},{wch:24},{wch:22},{wch:24},{wch:40},{wch:15},{wch:18}]);
  if(maintenance.length){exportWorkbookSheet(wb,mode==='history'?'Historico':'Manutencoes',maintenance,EXPORT_MAINT_HEADERS,[{wch:38},{wch:22},{wch:17},{wch:22},{wch:25},{wch:28},{wch:14},{wch:14},{wch:28},{wch:25},{wch:20},{wch:12},{wch:12},{wch:42},{wch:42},{wch:27},{wch:18},{wch:10},{wch:40},{wch:32},{wch:48},{wch:48},{wch:32},{wch:28},{wch:48},{wch:20},{wch:42},{wch:20}]);exportWorkbookSheet(wb,'Resumo_Equipes',exportTeamSummary(maintenance),['EQUIPE','TOTAL','APROVADOS','DEVOLVIDOS','PENDENTES_ANALISE','INCONCLUSIVOS'],[{wch:34},{wch:12},{wch:14},{wch:14},{wch:20},{wch:16}])}
  exportWorkbookSheet(wb,'Dicionario_Dados',exportDictionaryRows(),['ABA','CAMPO','DESCRICAO','TIPO','PADRAO'],[{wch:18},{wch:30},{wch:62},{wch:16},{wch:58}]);
  XLSX.writeFile(wb,exportFileName(file),{compression:true});toast('Arquivo Excel gerado com o padrão '+EXPORT_SCHEMA_VERSION+'.');
}
function exportCurrentFilterValues(root){return {period:root.querySelector('#export-period')?.value||'all',from:root.querySelector('#export-date-from')?.value||'',to:root.querySelector('#export-date-to')?.value||'',team:root.querySelector('#export-team')?.value||'',substation:root.querySelector('#export-substation')?.value||'',status:root.querySelector('#export-status')?.value||'',family:root.querySelector('#export-family')?.value||'',category:root.querySelector('#export-category')?.value||'',asset:root.querySelector('#export-asset')?.value||''}}
async function openDataExportDialog(){
  if(!spreadsheetModuleReady())return;const reports=(await combinedReports()).map(standardMaintenanceExportRow),assets=standardAssetExportRows(),teams=[...new Set(reports.map(r=>canonicalTeamName(r.EQUIPE_RESPONSAVEL)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),subs=[...new Set([...assets.map(a=>a.SIGLA_LOCAL),...reports.map(r=>r.SIGLA_LOCAL)].filter(Boolean))].sort(),statuses=[...new Set(reports.map(r=>r.STATUS_RELATORIO).filter(Boolean))].sort(),families=[...new Set(assets.map(a=>Object.entries(ASSET_FAMILY_LABELS).find(([,label])=>label===a.FAMILIA_ATIVO)?.[0]||'SUBESTACAO'))],categories=[...new Set(assets.map(a=>a.CATEGORIA).filter(Boolean))].sort(),assetOptions=assets.map(a=>({id:a.ID_ATIVO,label:`${a.SIGLA_LOCAL} · ${a.TIPO_ATIVO}${a.CIRCUITO?' — '+a.CIRCUITO:''}`})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR',{numeric:true}));
  const root=document.getElementById('modal-root');root.innerHTML=`<div class="modal no-backdrop-close" id="data-export-modal"><div class="modal-card data-export-dialog"><button class="modal-close" id="close-data-export" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="export-header"><div><h2>Exportar dados</h2><p>Gere planilhas padronizadas da base cadastral e das manutenções, com filtros e rastreabilidade da exportação.</p></div></div><div class="export-mode-grid"><button class="export-mode-card active" data-export-mode="assets" type="button"><span data-icon="database"></span><strong>Base de ativos</strong><small>Cadastro técnico padronizado dos ativos.</small></button><button class="export-mode-card" data-export-mode="maintenance" type="button"><span data-icon="clipboard"></span><strong>Manutenções</strong><small>Período, equipe, local e situação do relatório.</small></button><button class="export-mode-card" data-export-mode="history" type="button"><span data-icon="history"></span><strong>Histórico por ativo</strong><small>Ficha cadastral e atendimentos do ativo selecionado.</small></button><button class="export-mode-card" data-export-mode="consolidated" type="button"><span data-icon="file-spreadsheet"></span><strong>Consolidado</strong><small>Ativos, manutenções, resumo e dicionário em um único arquivo.</small></button></div><section class="export-filter-panel"><div class="export-filter-title"><strong>Filtros da exportação</strong><small>Os filtros não alteram a base.</small></div><div class="export-filter-grid"><div class="export-field" data-filter="family"><label>Família do ativo</label><select id="export-family"><option value="">Todas</option>${families.map(code=>`<option value="${esc(code)}">${esc(exportFamilyLabel(code))}</option>`).join('')}</select></div><div class="export-field" data-filter="substation"><label>Local</label><select id="export-substation"><option value="">Todos</option>${subs.map(v=>`<option>${esc(v)}</option>`).join('')}</select></div><div class="export-field" data-filter="category"><label>Categoria</label><select id="export-category"><option value="">Todas</option>${categories.map(v=>`<option>${esc(v)}</option>`).join('')}</select></div><div class="export-field hidden" data-filter="period"><label>Período</label><select id="export-period"><option value="week">Esta semana</option><option value="month" selected>Este mês</option><option value="previous_month">Mês anterior</option><option value="last30">Últimos 30 dias</option><option value="all">Todo o período</option><option value="custom">Personalizado</option></select></div><div class="export-custom-dates hidden" id="export-custom-dates"><div class="export-field"><label>De</label><input id="export-date-from" type="date"></div><div class="export-field"><label>Até</label><input id="export-date-to" type="date"></div></div><div class="export-field hidden" data-filter="team"><label>Equipe</label><select id="export-team"><option value="">Todas</option>${teams.map(v=>`<option>${esc(v)}</option>`).join('')}</select></div><div class="export-field hidden" data-filter="status"><label>Status</label><select id="export-status"><option value="">Todos</option>${statuses.map(v=>`<option>${esc(v)}</option>`).join('')}</select></div><div class="export-field hidden" data-filter="asset"><label>Ativo</label><select id="export-asset"><option value="">Selecione…</option>${assetOptions.map(a=>`<option value="${esc(a.id)}">${esc(a.label)}</option>`).join('')}</select></div></div></section><div class="export-preview-strip" id="export-preview-strip"></div><div class="export-actions single-action"><button class="btn primary excel-orange" id="generate-data-export" type="button">📊 Exportar Excel (.xlsx)</button></div></div></div>`;
  hydrateIcons(root);let mode='assets';const close=()=>root.innerHTML='';root.querySelector('#close-data-export').onclick=close;root.querySelector('#data-export-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
  const field=(name)=>root.querySelector(`[data-filter="${name}"]`),custom=root.querySelector('#export-custom-dates');
  function draw(){const maintenanceMode=['maintenance','consolidated'].includes(mode);field('period').classList.toggle('hidden',!maintenanceMode&&mode!=='history');field('team').classList.toggle('hidden',!maintenanceMode&&mode!=='history');field('status').classList.toggle('hidden',!maintenanceMode&&mode!=='history');field('asset').classList.toggle('hidden',mode!=='history');field('category').classList.toggle('hidden',!['assets','consolidated'].includes(mode));field('family').classList.toggle('hidden',mode==='history');custom.classList.toggle('hidden',root.querySelector('#export-period')?.value!=='custom'||(!maintenanceMode&&mode!=='history'));const f=exportCurrentFilterValues(root),filteredA=exportApplyAssetFilters(assets,f),filteredM=exportApplyMaintenanceFilters(reports,f),histCount=mode==='history'&&f.asset?filteredM.filter(r=>r.IDS_ATIVOS.split(' | ').includes(f.asset)).length:0;root.querySelector('#export-preview-strip').innerHTML=`<div class="export-preview-kpi"><strong>${mode==='maintenance'?0:mode==='history'?(f.asset?1:0):filteredA.length}</strong><span>ativos no arquivo</span></div><div class="export-preview-kpi"><strong>${mode==='assets'?0:mode==='history'?histCount:filteredM.length}</strong><span>manutenções no arquivo</span></div><div class="export-preview-kpi"><strong>${new Set(filteredM.map(r=>canonicalTeamName(r.EQUIPE_RESPONSAVEL)).filter(Boolean)).size}</strong><span>equipes</span></div><div class="export-preview-kpi"><strong>${new Set([...filteredA.map(a=>a.SIGLA_LOCAL),...filteredM.map(r=>r.SIGLA_LOCAL)].filter(Boolean)).size}</strong><span>locais</span></div>`}
  root.querySelectorAll('[data-export-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.exportMode;root.querySelectorAll('[data-export-mode]').forEach(b=>b.classList.toggle('active',b===button));draw()});root.querySelectorAll('.export-filter-grid select,.export-filter-grid input').forEach(control=>control.addEventListener('change',draw));root.querySelector('#generate-data-export').onclick=async()=>{const button=root.querySelector('#generate-data-export');button.disabled=true;button.textContent='Gerando Excel…';try{await buildStandardExport(mode,exportCurrentFilterValues(root))}finally{button.disabled=false;button.innerHTML='<span data-icon="download"></span>Exportar Excel (.xlsx)';hydrateIcons(button)}};draw();
}
function injectDatabaseExportAction(){
  if(state.screen!=='database')return;const existing=document.getElementById('database-export-data');if(existing){existing.onclick=openDataExportDialog;return}const button=document.createElement('button');button.className='btn bulk-highlight database-export-btn';button.id='database-export-data';button.type='button';button.textContent='📊 Exportar dados';button.onclick=openDataExportDialog;
  const adminActions=main.querySelector('.database-admin-actions');if(adminActions){adminActions.insertBefore(button,adminActions.firstChild)}else{const heading=main.querySelector('.database-selected-heading');if(heading){let actions=heading.querySelector('.database-selected-actions');if(!actions){actions=document.createElement('div');actions.className='database-selected-actions';heading.appendChild(actions)}actions.appendChild(button)}}hydrateIcons(button)
}
const _v150RenderDatabase=renderDatabase;
renderDatabase=async function(){await _v150RenderDatabase();injectDatabaseExportAction()};
const _v150EnterApplication=enterApplication;
enterApplication=async function(...args){await _v150EnterApplication(...args);const footerVersion=document.getElementById('environment-footer-version');if(footerVersion)footerVersion.textContent='v1.9.6';const version=document.getElementById('app-version-label');if(version)version.textContent='v1.9.6'};


/* ===== v1.9.0 — ajustes comportamentais consolidados ===== */
function syncAdaptiveHeader(){
  const topbar=document.querySelector('.topbar'),quick=document.querySelector('.quick-nav'),more=document.getElementById('more-nav'),menu=document.getElementById('more-menu-dropdown'),brand=document.querySelector('.brand'),user=document.querySelector('.user-control');
  if(!topbar||!quick||!more||!menu||!brand||!user)return;
  const setMore=(active)=>{
    more.classList.toggle('v180-active',!!active);
    more.classList.toggle('v180-empty',!active);
    more.style.setProperty('display',active?'flex':'none','important');
    if(!active)closeMoreMenu();
  };
  if(window.innerWidth<=760){setMore(false);return}
  const buttons=[...quick.querySelectorAll('button[data-nav]')];
  buttons.forEach(b=>b.classList.remove('adaptive-hidden'));
  setMore(false);
  const roleHidden=b=>document.body.classList.contains('role-field')&&b.hasAttribute('data-admin-only');
  const eligible=()=>buttons.filter(b=>!roleHidden(b)&&!b.classList.contains('adaptive-hidden'));
  const gap=parseFloat(getComputedStyle(quick).columnGap||getComputedStyle(quick).gap||'0')||0;
  const topGap=parseFloat(getComputedStyle(topbar).columnGap||getComputedStyle(topbar).gap||'0')||0;
  const navWidth=()=>eligible().reduce((sum,b)=>sum+b.offsetWidth,0)+Math.max(0,eligible().length-1)*gap;
  const baseAvailable=Math.max(0,topbar.clientWidth-brand.offsetWidth-user.offsetWidth-(topGap*3)-8);
  const overflowOrder=['users','plan','database','overview'];
  const hidden=[];
  for(const nav of overflowOrder){
    if(navWidth()<=baseAvailable)break;
    const btn=quick.querySelector(`[data-nav="${nav}"]`);
    if(btn&&!roleHidden(btn)&&!btn.classList.contains('adaptive-hidden')){btn.classList.add('adaptive-hidden');hidden.push(nav)}
  }
  if(hidden.length){
    setMore(true);
    const moreWidth=Math.max(68,more.offsetWidth||68);
    const availableWithMore=Math.max(0,baseAvailable-moreWidth-topGap);
    for(const nav of overflowOrder){
      if(navWidth()<=availableWithMore)break;
      const btn=quick.querySelector(`[data-nav="${nav}"]`);
      if(btn&&!roleHidden(btn)&&!btn.classList.contains('adaptive-hidden')){btn.classList.add('adaptive-hidden');if(!hidden.includes(nav))hidden.push(nav)}
    }
  }
  [...menu.querySelectorAll('button[data-nav]')].forEach(item=>{
    const matching=quick.querySelector(`button[data-nav="${item.dataset.nav}"]`);
    const shouldShow=!roleHidden(item)&&!!matching&&matching.classList.contains('adaptive-hidden');
    item.style.display=shouldShow?'block':'none';
  });
  const hasMenuItems=[...menu.querySelectorAll('button[data-nav]')].some(b=>b.style.display==='block');
  setMore(hasMenuItems);
}

const _v170UpdateRoleChrome=updateRoleChrome;
updateRoleChrome=function(){const result=_v170UpdateRoleChrome();requestAnimationFrame(syncAdaptiveHeader);return result};
window.addEventListener('resize',()=>requestAnimationFrame(syncAdaptiveHeader),{passive:true});
document.getElementById('modal-root')?.addEventListener('click',e=>{if(e.target?.classList?.contains('modal'))e.stopImmediatePropagation()},true);


const _v170NavigateTo=navigateTo;
navigateTo=function(nav){if(nav!=='users')main.classList.remove('users-premium');const result=_v170NavigateTo(nav);requestAnimationFrame(syncAdaptiveHeader);return result};
const _v170RenderUsers=renderUserManagement;
renderUserManagement=async function(){
  await _v170RenderUsers();
  if(state.screen!=='users')return;
  main.classList.add('users-premium');
  main.querySelector('.push-config-banner')?.remove();
  const heading=main.querySelector('.users-heading');
  const subtitle=heading?.querySelector('p');if(subtitle)subtitle.textContent='Gerencie perfis, permissões, credenciais e dispositivos vinculados à Central.';
  hydrateIcons(main);
};

const _v170RenderDatabase=renderDatabase;
renderDatabase=async function(){
  main.classList.remove('users-premium');
  await _v170RenderDatabase();
  const exportButton=document.getElementById('database-export-data');if(exportButton)exportButton.onclick=openDataExportDialog;
  const bulkButton=document.getElementById('bulk-asset-update');if(bulkButton)bulkButton.onclick=openBulkAssetUpdate;
  hydrateIcons(main);requestAnimationFrame(syncAdaptiveHeader);
};

const _v170RenderPlan=renderPreventivePlan;
renderPreventivePlan=async function(){main.classList.remove('users-premium');await _v170RenderPlan();hydrateIcons(main);requestAnimationFrame(syncAdaptiveHeader)};

const _v170OpenProfile=openMyProfileDialog;
openMyProfileDialog=async function(){await _v170OpenProfile();const card=document.querySelector('.profile-settings-dialog');if(card)card.classList.add('has-sticky-close');hydrateIcons(document.getElementById('modal-root'))};

const _v170OpenBulk=openBulkAssetUpdate;
openBulkAssetUpdate=async function(){await _v170OpenBulk();hydrateIcons(document.getElementById('modal-root'))};

const _v170OpenNotifications=openNotificationCenter;
openNotificationCenter=async function(){await _v170OpenNotifications();hydrateIcons(document.getElementById('modal-root'))};

const _v170EnterApplication=enterApplication;
enterApplication=async function(...args){
  await _v170EnterApplication(...args);
  const version=document.getElementById('app-version-label');if(version)version.textContent='v1.9.6';
  const footerVersion=document.getElementById('environment-footer-version');if(footerVersion)footerVersion.textContent='v1.9.6';
  const bell=document.getElementById('notification-bell');if(bell){bell.innerHTML='<span data-icon="bell"></span><span class="notification-bell-count hidden" id="notification-bell-count">0</span>';bell.onclick=openNotificationCenter;hydrateIcons(bell)}
  requestAnimationFrame(syncAdaptiveHeader);
};



/* ===== v1.9.0 — refinamentos finais de tela ===== */
const _v180RenderUsers=renderUserManagement;
renderUserManagement=async function(){
  await _v180RenderUsers();
  if(state.screen!=='users')return;
  const head=main.querySelector('.user-list-head');if(head&&head.children.length>=5)head.children[4].textContent='Ações';
  requestAnimationFrame(syncAdaptiveHeader);
};
const _v180RenderOverview=renderOverview;
renderOverview=async function(){
  await _v180RenderOverview();
  if(state.screen!=='overview')return;
  const title=main.querySelector('.overview-heading h1');if(title)title.textContent='Relatórios';
  requestAnimationFrame(syncAdaptiveHeader);
};
const _v180RenderHome=renderHome;
renderHome=async function(){
  await _v180RenderHome();
  main.querySelectorAll('[data-home-action="overview"] h3').forEach(el=>el.textContent='Relatórios');
  requestAnimationFrame(syncAdaptiveHeader);
};
const _v180OpenProfile=openMyProfileDialog;
openMyProfileDialog=async function(){
  await _v180OpenProfile();
  const close=document.getElementById('close-my-profile');if(close){close.classList.add('profile-standard-close');close.setAttribute('aria-label','Fechar')}
  hydrateIcons(document.getElementById('modal-root'));
};
/* ===== v1.9.3 — homologação operacional ===== */

// 1) Integração / substituição: fluxo exclusivamente operacional (sem modo de teste).
const _v193RenderAssetOperationsHome=renderAssetOperationsHome;
renderAssetOperationsHome=async function(){
  await _v193RenderAssetOperationsHome();
  document.getElementById('purge-test-operations')?.remove();
  const heroText=main.querySelector('.operation-hero .muted');
  if(heroText)heroText.textContent='As operações registradas atualizam o cadastro principal de ativos após a sincronização com a nuvem.';
};

const _v193RenderAssetOperationForm=renderAssetOperationForm;
renderAssetOperationForm=function(type){
  _v193RenderAssetOperationForm(type);
  const form=document.getElementById('asset-operation-form');
  const testInput=form?.elements?.isTest;
  if(testInput){
    testInput.checked=false;
    testInput.closest('.field.full')?.classList.add('hidden');
  }
};

const _v193ReviewAssetOperation=reviewAssetOperation;
reviewAssetOperation=function(e,type,form){
  if(form?.elements?.isTest)form.elements.isTest.checked=false;
  _v193ReviewAssetOperation(e,type,form);
  document.querySelectorAll('#operation-review-modal .operation-review-item').forEach(item=>{
    if(item.querySelector('b')?.textContent?.trim()==='Modo')item.remove();
  });
};

const _v193SaveAssetOperation=saveAssetOperation;
saveAssetOperation=async function(...args){
  await _v193SaveAssetOperation(...args);
  if(navigator.onLine&&state.cloudUser){
    try{await loadCloudSnapshot()}catch(error){console.warn('Atualização pós-operação de ativo:',error)}
  }
};

// 2) Nova manutenção: separação entre peça retirada e peça nova instalada.
FORM_LABELS.peca='Peça retirada';
FORM_LABELS.pecaNovaCodigo='Código da peça nova';
FORM_LABELS.pecaNovaDescricao='Descrição da peça nova';
FORM_LABELS.pecaNovaSerie='Número de série da peça nova';

const _v193RenderActivity=renderActivity;
renderActivity=async function(){
  await _v193RenderActivity();
  if(state.screen!=='activity')return;
  const section=document.getElementById('piece-fields'),form=document.getElementById('form');
  if(!section||!form)return;

  const previous={
    peca:form.elements.peca?.value||'',
    destinoPeca:form.elements.destinoPeca?.value||''
  };

  section.innerHTML=`<div class="dynamic-section-head"><div><h3>Peças da substituição</h3><p>Registre separadamente o material retirado e a peça nova instalada.</p></div><span class="smart-form-hint">Preenchimento obrigatório</span></div>
    <div class="piece-subsection">
      <h4>Peça retirada</h4>
      <div class="form-grid">
        <div class="field"><label>${requiredLabel('Peça retirada')}</label><input name="peca" data-required-when-visible="true" placeholder="Código, descrição e série da peça retirada"></div>
        <div class="field"><label>${requiredLabel('Destino da peça retirada')}</label><select name="destinoPeca" data-required-when-visible="true"><option value="">Selecione</option><option>Estoque</option><option>Enviada para reparo</option><option>Descarte</option><option>Permaneceu no local</option><option>Outro</option></select></div>
      </div>
    </div>
    <div class="piece-subsection new-part-subsection">
      <h4>Peça nova instalada</h4>
      <div class="form-grid">
        <div class="field"><label>Código da peça nova</label><input name="pecaNovaCodigo" placeholder="Código ou part number"></div>
        <div class="field"><label>${requiredLabel('Descrição da peça nova')}</label><input name="pecaNovaDescricao" data-required-when-visible="true" placeholder="Descrição da peça instalada"></div>
        <div class="field"><label>Número de série da peça nova</label><input name="pecaNovaSerie" placeholder="Número de série, quando aplicável"></div>
      </div>
    </div>`;

  form.elements.peca.value=previous.peca;
  form.elements.destinoPeca.value=previous.destinoPeca;

  let restored={};
  try{
    const draftId=state.activeDraftId||'current';
    const draft=await idbGet('drafts',draftId);
    restored=draft?.form||state.editingOriginal?.form||{};
  }catch(_){restored=state.editingOriginal?.form||{}}
  updatePieceFields(form,restored);
};

// Mantém a tabela estruturada de peças sincronizada, inclusive em correções.
const _v193EnsureReportChildren=ensureReportChildren;
ensureReportChildren=async function(record,user){
  await _v193EnsureReportChildren(record,user);
  if(normalize(record.form?.houvePeca)!=='sim'||!record.partCloudId)return;
  const {error}=await cloudClient.from('maintenance_parts').update({
    description:record.form?.peca||'',
    removed_destination:record.form?.destinoPeca||null,
    installed_part_code:record.form?.pecaNovaCodigo||null,
    installed_part_description:record.form?.pecaNovaDescricao||null,
    installed_part_serial_number:record.form?.pecaNovaSerie||null
  }).eq('id',record.partCloudId);
  if(error)throw error;
};

const _v193OpenReportDetails=openReportDetails;
openReportDetails=async function(key){
  await _v193OpenReportDetails(key);
  const report=state.reports.find(r=>r.key===key)||(await combinedReports()).find(r=>r.key===key);
  if(!report||report.source==='imported')return;
  const form=report.raw?.form||{};
  const card=document.querySelector('#report-modal .report-modal-card');
  if(!card)return;

  const pieceBlock=[...card.querySelectorAll('.detail-block')].find(block=>block.querySelector('h3')?.textContent?.trim()==='Peça substituída');
  if(pieceBlock)pieceBlock.querySelector('h3').textContent='Peça retirada';

  const newPartValues=[
    ['Código',form.pecaNovaCodigo],
    ['Descrição',form.pecaNovaDescricao],
    ['Número de série',form.pecaNovaSerie]
  ].filter(([,value])=>String(value||'').trim());

  if(pieceBlock&&newPartValues.length){
    pieceBlock.insertAdjacentHTML('afterend',`<div class="detail-block"><h3>Peça nova instalada</h3>${newPartValues.map(([label,value])=>`<p><b>${esc(label)}:</b> ${esc(value)}</p>`).join('')}</div>`);
  }
};

const _v193StandardMaintenanceExportRow=standardMaintenanceExportRow;
standardMaintenanceExportRow=function(report){
  const row=_v193StandardMaintenanceExportRow(report),form=report?.raw?.form||report?.raw||{};
  return {
    ...row,
    PECA_RETIRADA:row.PECA_SUBSTITUIDA||'',
    PECA_NOVA_CODIGO:exportSafeText(form.pecaNovaCodigo),
    PECA_NOVA_DESCRICAO:exportSafeText(form.pecaNovaDescricao),
    PECA_NOVA_NUMERO_SERIE:exportSafeText(form.pecaNovaSerie)
  };
};

// 3) Central de notificações: listar somente notificações ainda não visualizadas.
ownNotifications=async function(limit=80){
  if(!state.cloudUser||!navigator.onLine)return [];
  const {data,error}=await cloudClient
    .from('notification_outbox')
    .select('id,event_type,report_id,report_revision,payload,status,read_at,created_at,last_error')
    .is('read_at',null)
    .order('created_at',{ascending:false})
    .limit(limit);
  if(error)throw error;
  return data||[];
};

const _v193OpenNotificationCenter=openNotificationCenter;
openNotificationCenter=async function(){
  await _v193OpenNotificationCenter();
  const subtitle=document.querySelector('.notification-center-head .muted');
  if(subtitle)subtitle.textContent='Somente atualizações ainda não visualizadas.';
  const empty=document.querySelector('.notification-empty strong');
  if(empty&&empty.textContent.includes('Nenhuma notificação'))empty.textContent='Nenhuma notificação nova.';
};

// 4) Equipe de Campo: painel de todos os relatórios do usuário, com status e detalhes.
function ensureV193Styles(){
  if(document.getElementById('v193-homologation-styles'))return;
  const style=document.createElement('style');
  style.id='v193-homologation-styles';
  style.textContent=`
    .piece-subsection{grid-column:1/-1;border:1px solid var(--line);border-radius:12px;padding:14px;background:#fff}
    .piece-subsection h4{margin:0 0 12px;color:var(--blue-dark);font-size:13px}
    .new-part-subsection{background:#f8fcfd;border-color:#cfe7ed}
    .my-reports-section{margin-top:18px}
    .my-reports-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:12px}
    .my-reports-head h2{margin:0;font-size:18px}
    .my-reports-head p{margin:4px 0 0;color:var(--muted);font-size:12px}
    .my-reports-count{font-size:11px;font-weight:850;color:var(--blue-dark);background:var(--blue-soft);border:1px solid #cce8ef;border-radius:999px;padding:5px 9px;white-space:nowrap}
    .my-reports-list{display:grid;gap:9px;max-height:560px;overflow:auto;padding-right:3px}
    .my-report-item{width:100%;border:1px solid var(--line);background:#fff;border-radius:12px;padding:12px 14px;text-align:left;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;color:inherit}
    .my-report-item:hover{border-color:#8acddd;background:#fbfdfe}
    .my-report-main{min-width:0;display:grid;gap:4px}
    .my-report-main strong{font-size:12px;color:var(--ink);overflow-wrap:anywhere}
    .my-report-main span{font-size:12px;color:#425b66;overflow-wrap:anywhere}
    .my-report-main small{font-size:11px;color:var(--muted);overflow-wrap:anywhere}
    .my-report-meta{display:grid;justify-items:end;gap:6px;white-space:nowrap}
    .my-report-meta time{font-size:10px;color:var(--muted)}
    @media(max-width:700px){
      .piece-subsection .form-grid{grid-template-columns:1fr}
      .my-report-item{grid-template-columns:1fr;gap:9px}
      .my-report-meta{justify-items:start}
      .my-reports-head{align-items:flex-start}
    }
  `;
  document.head.appendChild(style);
}

async function injectMyReportsOnHome(){
  if(state.role!=='field'||!state.cloudUser)return;
  document.querySelector('.my-reports-section')?.remove();
  document.querySelector('.recent-local')?.remove();
  const anchor=document.querySelector('.action-section');
  if(!anchor)return;

  const all=await combinedReports(),uid=state.cloudUser.id;
  const own=all.filter(report=>report.source!=='imported'&&(
    report.raw?.usuario?.id===uid||
    report.raw?.authorId===uid||
    report.raw?.author_id===uid||
    belongsToCurrentUser(report.raw)
  ));

  const section=document.createElement('section');
  section.className='panel my-reports-section';
  section.innerHTML=`<div class="my-reports-head"><div><h2>Meus Relatórios</h2><p>Consulte os atendimentos enviados por você e acompanhe o status de cada relatório.</p></div><span class="my-reports-count">${own.length} relatório(s)</span></div>
    <div class="my-reports-list">${own.length?own.map(report=>`<button class="my-report-item" type="button" data-my-report-key="${esc(report.key)}"><span class="my-report-main"><strong>${esc(report.number||'Relatório')}</strong><span>${esc(report.type)} · ${esc(report.substation)}</span><small>${esc(report.assets.join(', ')||'Ativo não informado')}</small></span><span class="my-report-meta">${statusPill(report.status)}<time>${esc(formatDate(report.date))}</time></span></button>`).join(''):'<div class="empty">Você ainda não possui relatórios registrados.</div>'}</div>`;

  anchor.insertAdjacentElement('afterend',section);
  section.querySelectorAll('[data-my-report-key]').forEach(button=>button.onclick=async()=>{
    state.reports=await combinedReports();
    await openReportDetails(button.dataset.myReportKey);
  });
}

const _v193RenderHome=renderHome;
renderHome=async function(){
  await _v193RenderHome();
  ensureV193Styles();
  await injectMyReportsOnHome();
  requestAnimationFrame(syncAdaptiveHeader);
};
/* ===== v1.9.5 — refinamentos visuais e de hierarquia ===== */

// Escopo desta versão: somente apresentação/navegação de interface.
// Não altera schema, persistência, sincronização, regras de aprovação ou fluxo de manutenção.

function ensureV194Styles(){
  if(document.getElementById('v194-visual-styles'))return;
  const style=document.createElement('style');
  style.id='v194-visual-styles';
  style.textContent=`
    /* Item 6 — peças: um único bloco principal, sem caixas aninhadas */
    #piece-fields.piece-section{
      background:#fff;
      border:1px solid var(--line);
      border-radius:14px;
      padding:16px 18px;
      box-shadow:none;
    }
    #piece-fields .dynamic-section-head{padding-bottom:13px}
    #piece-fields .piece-subsection{
      grid-column:1/-1;
      border:0!important;
      border-radius:0!important;
      padding:15px 0 2px!important;
      background:transparent!important;
      box-shadow:none!important;
    }
    #piece-fields .piece-subsection h4{
      margin:0 0 12px;
      color:var(--ink);
      font-size:13px;
      font-weight:850;
    }
    #piece-fields .piece-subsection + .piece-subsection{
      margin-top:10px;
      padding-top:18px!important;
      border-top:1px solid #e7edf0!important;
    }

    /* Item 7 — link de criação de conta discreto e realmente clicável */
    .auth-managed-access .auth-inline-link{
      appearance:none;
      border:0;
      background:transparent;
      padding:0;
      color:var(--blue-dark);
      font:inherit;
      font-weight:850;
      text-decoration:underline;
      text-underline-offset:3px;
      cursor:pointer;
    }
    .auth-managed-access .auth-inline-link:hover{color:var(--orange-dark)}

    /* Item 8 — saudação plana, sem gradiente, sem card decorativo */
    .home-hero{margin-bottom:0}
    .welcome-card.v194-welcome{
      width:100%;
      min-height:0;
      padding:4px 0 18px;
      border:0;
      border-radius:0;
      background:transparent;
      box-shadow:none;
      overflow:visible;
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:28px;
    }
    .welcome-card.v194-welcome:after{display:none!important}
    .v194-greeting-copy{min-width:0}
    .welcome-card.v194-welcome h1{
      margin:0 0 6px;
      font-size:28px;
      line-height:1.15;
      letter-spacing:-.02em;
    }
    .welcome-card.v194-welcome .v194-greeting-sub{
      margin:0;
      max-width:700px;
      color:var(--muted);
      font-size:12px;
      line-height:1.5;
    }
    .v194-home-metrics{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:0;
      flex-wrap:wrap;
    }
    .v194-home-metric{
      appearance:none;
      border:0;
      border-left:1px solid var(--line);
      background:transparent;
      color:inherit;
      padding:2px 16px;
      text-align:left;
      min-width:128px;
      cursor:pointer;
    }
    .v194-home-metric:first-child{border-left:0}
    .v194-home-metric strong{
      display:block;
      font-size:19px;
      line-height:1.05;
      color:var(--ink);
      margin-bottom:4px;
    }
    .v194-home-metric span{
      display:block;
      color:var(--muted);
      font-size:10px;
      line-height:1.25;
      white-space:nowrap;
    }
    .v194-home-metric:hover strong{color:var(--blue-dark)}
    .v194-home-metric:focus-visible{outline:3px solid rgba(0,143,179,.14);outline-offset:2px;border-radius:8px}

    /* Avatar do cabeçalho sem aro/borda decorativa */
    .user-avatar,
    .user-avatar:hover,
    .user-avatar:focus{
      border:0!important;
      box-shadow:none!important;
    }
    .user-avatar:focus-visible{outline:3px solid rgba(0,143,179,.16);outline-offset:2px}

    /* Item 9 — ação de Usuários usa a mesma linguagem dos demais atalhos */
    .home-action.users .action-icon{background:#f3f1fb;color:#6251a4}
    .home-action.users .action-link{color:#6251a4}

    /* Item 5 — código do relatório passa a ser metadado secundário */
    .my-report-main strong{font-size:13px!important;line-height:1.35}
    .my-report-main small.v194-report-code{font-size:10px;color:#7a8b94}

    @media(max-width:760px){
      #piece-fields.piece-section{padding:14px}
      #piece-fields .piece-subsection{padding-top:13px!important}
      .welcome-card.v194-welcome{
        display:grid;
        gap:12px;
        padding:2px 0 12px;
      }
      .welcome-card.v194-welcome h1{font-size:23px}
      .welcome-card.v194-welcome .v194-greeting-sub{font-size:11px}
      .v194-home-metrics{
        justify-content:flex-start;
        width:100%;
      }
      .v194-home-metric{
        min-width:0;
        flex:0 1 auto;
        padding:1px 13px;
      }
      .v194-home-metric:first-child{padding-left:0}
      .v194-home-metric strong{font-size:17px}
      .v194-home-metric span{font-size:9.5px}
      .action-section{margin-top:12px}
    }
  `;
  document.head.appendChild(style);
}

// Item 7 — melhora a transição Login -> Criar conta sem mudar o processo de cadastro.
const _v194SetupAuthUI=setupAuthUI;
setupAuthUI=function(){
  _v194SetupAuthUI();
  const managed=document.querySelector('.auth-managed-access');
  if(managed){
    managed.innerHTML='Ainda não possui uma conta? <button type="button" class="auth-inline-link" id="auth-create-account-link">Criar conta</button>.';
    document.getElementById('auth-create-account-link')?.addEventListener('click',()=>showAuthTab('signup'));
  }
  document.querySelector('#signup-form > .auth-notice')?.remove();
  ensureV194Styles();
};

function v194FirstName(){
  const raw=String(currentUser()?.name||'').trim();
  if(!raw||raw.includes('@'))return '';
  return raw.split(/\s+/)[0];
}
function v194Greeting(){
  const hour=new Date().getHours();
  return hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
}
function v194OwnReports(reports){
  const uid=state.cloudUser?.id;
  if(!uid)return [];
  return reports.filter(report=>report.source!=='imported'&&(
    report.raw?.usuario?.id===uid||
    report.raw?.authorId===uid||
    report.raw?.author_id===uid||
    belongsToCurrentUser(report.raw)
  ));
}
function v194ReportTime(report){
  const raw=report?.createdAt||report?.raw?.created_at||report?.raw?.criadoEm||report?.date;
  const time=new Date(raw||0).getTime();
  return Number.isFinite(time)?time:0;
}

async function v194RefreshHomeSummary(){
  const card=main.querySelector('.welcome-card');
  if(!card)return;
  card.classList.add('v194-welcome');

  const firstName=v194FirstName();
  const greeting=`${v194Greeting()}${firstName?`, ${esc(firstName)}`:''}.`;
  let reports=[];
  try{reports=await combinedReports()}catch(_){reports=[]}

  let subtitle='';
  let metrics='';

  if(state.role==='admin'){
    const operational=reports.filter(r=>r.source!=='imported');
    const pending=operational.filter(r=>['enviado','corrigido'].includes(String(r.status||'').toLowerCase())).length;
    const now=new Date(),weekStart=new Date(now);
    weekStart.setHours(0,0,0,0);
    weekStart.setDate(now.getDate()-((now.getDay()+6)%7));
    const receivedWeek=operational.filter(r=>v194ReportTime(r)>=weekStart.getTime()).length;
    subtitle=pending?'Há relatórios aguardando sua conferência.':'Nenhum relatório aguardando conferência neste momento.';
    metrics=`<button class="v194-home-metric" type="button" data-v194-summary="reports"><strong>${pending}</strong><span>Aguardando conferência</span></button><button class="v194-home-metric" type="button" data-v194-summary="week"><strong>${receivedWeek}</strong><span>Recebidos esta semana</span></button>`;
  }else{
    const own=v194OwnReports(reports),rejected=own.filter(r=>String(r.status||'').toLowerCase()==='reprovado').length;
    subtitle=rejected?'Há relatório devolvido que precisa da sua atenção.':'Registre atendimentos e acompanhe seus relatórios.';
    metrics=`<button class="v194-home-metric" type="button" data-v194-summary="mine"><strong>${own.length}</strong><span>Meus relatórios</span></button>${rejected?`<button class="v194-home-metric" type="button" data-v194-summary="corrections"><strong>${rejected}</strong><span>Para corrigir</span></button>`:''}`;
  }

  card.innerHTML=`<div class="v194-greeting-copy"><h1>${greeting}</h1><p class="v194-greeting-sub">${esc(subtitle)}</p></div><div class="v194-home-metrics">${metrics}</div>`;

  card.querySelector('[data-v194-summary="reports"]')?.addEventListener('click',()=>renderOverview());
  card.querySelector('[data-v194-summary="week"]')?.addEventListener('click',()=>renderOverview());
  card.querySelector('[data-v194-summary="mine"]')?.addEventListener('click',()=>document.querySelector('.my-reports-section')?.scrollIntoView({behavior:'smooth',block:'start'}));
  card.querySelector('[data-v194-summary="corrections"]')?.addEventListener('click',()=>document.querySelector('.field-review-section')?.scrollIntoView({behavior:'smooth',block:'start'}));
}

// Item 9 — a ordem é a mesma no Windows e no celular para manter previsibilidade.
function v194OrderHomeActions(){
  const grid=main.querySelector('.home-actions');
  if(!grid)return;

  if(state.role==='admin'&&!grid.querySelector('[data-home-action="users"]')){
    const users=document.createElement('button');
    users.className='home-action users';
    users.type='button';
    users.dataset.homeAction='users';
    users.innerHTML='<span class="action-icon" data-icon="user"></span><h3>Usuários</h3><p>Gerencie acessos, perfis e notificações dos usuários da Central.</p><span class="action-link">Abrir usuários <span data-icon="arrow-right"></span></span>';
    users.onclick=()=>renderUserManagement();
    grid.appendChild(users);
    hydrateIcons(users);
  }

  const order=state.role==='admin'
    ?['maintenance','overview','integration','database','plan','users']
    :['maintenance','integration','database'];

  order.forEach(action=>{
    const button=grid.querySelector(`[data-home-action="${action}"]`);
    if(button)grid.appendChild(button);
  });
}

// Item 5 — usa o ativo como título principal; MAN-... fica apenas como referência secundária.
async function v194RefineMyReportTitles(){
  const section=main.querySelector('.my-reports-section');
  if(!section)return;
  let reports=[];
  try{reports=await combinedReports()}catch(_){return}
  const byKey=new Map(reports.map(report=>[String(report.key),report]));

  section.querySelectorAll('[data-my-report-key]').forEach(button=>{
    const report=byKey.get(String(button.dataset.myReportKey));
    if(!report)return;
    const box=button.querySelector('.my-report-main');
    if(!box)return;
    const title=box.querySelector('strong'),meta=box.querySelector('span'),small=box.querySelector('small');
    const assetTitle=(report.assets||[]).join(', ')||'Ativo não informado';
    if(title)title.textContent=assetTitle;
    if(meta)meta.textContent=`${report.type||'Manutenção'} · ${report.substation||'Local não informado'}`;
    if(small){
      small.classList.add('v194-report-code');
      small.textContent=report.number?`Relatório ${report.number}`:'Relatório';
    }
  });
}

const _v194RenderHome=renderHome;
renderHome=async function(){
  await _v194RenderHome();
  ensureV194Styles();
  v194OrderHomeActions();
  await v194RefreshHomeSummary();
  await v194RefineMyReportTitles();
  requestAnimationFrame(syncAdaptiveHeader);
};
/* ===== v1.9.5 — proteção de senha vazada (HIBP via Edge Function) ===== */

async function centralAssertSafePassword(password){
  if(!navigator.onLine)throw new Error('Conecte-se à internet para validar a segurança da senha.');
  const {data,error}=await cloudClient.functions.invoke('password-security',{body:{password}});
  if(error){
    let message=error.message||'Não foi possível validar a segurança da senha.';
    try{
      if(error.context&&typeof error.context.json==='function'){
        const payload=await error.context.json();
        message=payload?.error||payload?.message||message;
      }
    }catch(_){ }
    throw new Error(message);
  }
  if(!data?.ok)throw new Error(data?.error||'Esta senha não passou pela validação de segurança.');
  return true;
}

function centralWrapPasswordForm(form,{confirmName='confirm_password',showError}={}){
  if(!form||form.dataset.passwordSecurityWrapped==='1'||typeof form.onsubmit!=='function')return;
  const original=form.onsubmit;
  form.dataset.passwordSecurityWrapped='1';
  form.onsubmit=async function(event){
    event.preventDefault();
    const fd=new FormData(form),password=String(fd.get('password')||''),confirm=confirmName?String(fd.get(confirmName)||''):password;
    if(password.length>=8&&password===confirm){
      try{await centralAssertSafePassword(password)}
      catch(error){
        const message=error?.message||String(error);
        if(typeof showError==='function')showError(message);
        else toast(message,'warning');
        return;
      }
    }
    return original.call(form,event);
  };
}

// Cadastro comum por e-mail/OTP.
const _v195SetupAuthUI=setupAuthUI;
setupAuthUI=function(){
  _v195SetupAuthUI();
  centralWrapPasswordForm(document.getElementById('signup-form'),{
    confirmName:'confirm_password',
    showError:message=>authMessage(message,'error'),
  });
};

// Troca obrigatória da senha temporária.
const _v195OpenForcedPasswordChange=openForcedPasswordChange;
openForcedPasswordChange=function(){
  _v195OpenForcedPasswordChange();
  const form=document.getElementById('forced-password-form');
  centralWrapPasswordForm(form,{
    confirmName:'confirm',
    showError:message=>{
      const msg=document.getElementById('forced-password-message');
      if(msg)msg.innerHTML=`<div class="auth-message error">${esc(message)}</div>`;
      else toast(message,'warning');
    },
  });
};

// Criação de usuário pela Equipe Administrativa.
const _v195OpenCreateUserDialog=openCreateUserDialog;
openCreateUserDialog=function(){
  _v195OpenCreateUserDialog();
  centralWrapPasswordForm(document.getElementById('create-user-form'),{
    confirmName:null,
    showError:message=>toast(message,'warning'),
  });
};

// Redefinição administrativa de senha temporária.
const _v195OpenResetUserPasswordDialog=openResetUserPasswordDialog;
openResetUserPasswordDialog=function(user){
  _v195OpenResetUserPasswordDialog(user);
  centralWrapPasswordForm(document.getElementById('reset-user-form'),{
    confirmName:null,
    showError:message=>toast(message,'warning'),
  });
};

/* ===== v1.9.7 — checklist visual da senha obrigatória ===== */

function centralPasswordChecklistHTML(){
  return `
    <div id="central-password-checklist" class="central-password-checklist" aria-live="polite">
      <div class="central-password-checklist-title">Requisitos da nova senha</div>
      <div class="central-password-checklist-item" data-rule="length">
        <span class="central-password-check-icon">○</span>
        <span>Pelo menos 8 caracteres</span>
      </div>
      <div class="central-password-checklist-item" data-rule="match">
        <span class="central-password-check-icon">○</span>
        <span>As senhas coincidem</span>
      </div>
      <div class="central-password-checklist-item" data-rule="leaked">
        <span class="central-password-check-icon">○</span>
        <span>Não encontrada em vazamentos conhecidos</span>
      </div>
      <div class="central-password-checklist-item recommended" data-rule="number">
        <span class="central-password-check-icon">○</span>
        <span>Recomendado: incluir número</span>
      </div>
      <div class="central-password-checklist-item recommended" data-rule="symbol">
        <span class="central-password-check-icon">○</span>
        <span>Recomendado: incluir símbolo</span>
      </div>
      <div class="central-password-checklist-hint">
        Número e símbolo são recomendações para fortalecer a senha; não são obrigatórios.
      </div>
    </div>
  `;
}

function centralEnsurePasswordChecklistStyles(){
  if(document.getElementById('central-password-checklist-styles'))return;

  const style=document.createElement('style');
  style.id='central-password-checklist-styles';
  style.textContent=`
    .central-password-checklist{
      margin:12px 0 14px;
      padding:12px 13px;
      border:1px solid #e1eaed;
      border-radius:12px;
      background:#f8fafb;
      text-align:left;
    }

    .central-password-checklist-title{
      margin-bottom:8px;
      color:#35515d;
      font-size:12px;
      font-weight:750;
    }

    .central-password-checklist-item{
      display:flex;
      align-items:center;
      gap:8px;
      min-height:24px;
      color:#647983;
      font-size:11.5px;
      line-height:1.35;
      transition:color .15s ease;
    }

    .central-password-checklist-icon{
      width:18px;
      flex:0 0 18px;
      text-align:center;
      color:#9aabb2;
      font-size:14px;
      font-weight:800;
    }

    .central-password-checklist-item.ok{
      color:#286c51;
    }

    .central-password-checklist-item.ok .central-password-check-icon{
      color:var(--success);
    }

    .central-password-checklist-item.fail{
      color:#a43e3e;
    }

    .central-password-checklist-item.fail .central-password-check-icon{
      color:var(--danger);
    }

    .central-password-checklist-item.pending{
      color:#637780;
    }

    .central-password-checklist-item.pending .central-password-check-icon{
      color:var(--blue);
    }

    .central-password-checklist-item.recommended{
      color:#788a91;
    }

    .central-password-checklist-hint{
      margin-top:7px;
      color:#83939a;
      font-size:10.5px;
      line-height:1.4;
    }

    @media(max-width:760px){
      .central-password-checklist{
        margin:10px 0 13px;
        padding:11px 12px;
      }

      .central-password-checklist-item{
        font-size:11px;
      }

      .central-password-checklist-hint{
        font-size:10px;
      }
    }
  `;
  document.head.appendChild(style);
}

function centralUpdatePasswordChecklist(password,confirm,{leaked='pending'}={}){
  const root=document.getElementById('central-password-checklist');
  if(!root)return;

  const setRule=(name,state)=>{
    const item=root.querySelector(`[data-rule="${name}"]`);
    if(!item)return;
    item.classList.remove('ok','fail','pending');
    if(state)item.classList.add(state);
    const icon=item.querySelector('.central-password-check-icon');
    if(icon)icon.textContent=state==='ok'?'✓':state==='fail'?'✕':'○';
  };

  setRule('length',password.length>=8?'ok':password.length?'fail':'pending');
  setRule('match',confirm&&password===confirm?'ok':confirm?'fail':'pending');
  setRule('leaked',leaked==='safe'?'ok':leaked==='compromised'?'fail':'pending');

  setRule('number',/\d/.test(password)?'ok':'pending');
  setRule('symbol',/[^\p{L}\p{N}\s]/u.test(password)?'ok':'pending');
}

function centralInstallPasswordChecklist(form){
  if(!form)return;

  centralEnsurePasswordChecklistStyles();

  if(!document.getElementById('central-password-checklist')){
    const anchor=form.querySelector('.auth-field:nth-of-type(2)');
    const target=anchor||form.querySelector('.auth-submit');
    if(target){
      target.insertAdjacentHTML('beforebegin',centralPasswordChecklistHTML());
    }
  }

  const password=form.querySelector('input[name="password"]');
  const confirm=form.querySelector('input[name="confirm"]');
  if(!password||!confirm)return;

  const refresh=()=>{
    centralUpdatePasswordChecklist(password.value,confirm.value);
  };

  password.addEventListener('input',refresh);
  confirm.addEventListener('input',refresh);
  refresh();
}

function centralSetPasswordChecklistLeakedState(state){
  const item=document.querySelector('#central-password-checklist [data-rule="leaked"]');
  if(!item)return;

  item.classList.remove('ok','fail','pending');

  if(state==='safe'){
    item.classList.add('ok');
  }else if(state==='compromised'){
    item.classList.add('fail');
  }else{
    item.classList.add('pending');
  }

  const icon=item.querySelector('.central-password-check-icon');
  if(icon)icon.textContent=state==='safe'?'✓':state==='compromised'?'✕':'○';
}

/* ===== v1.9.6 — troca obrigatória de senha concluída pelo backend ===== */

const _v196OpenForcedPasswordChange=openForcedPasswordChange;

openForcedPasswordChange=function(){
  _v196OpenForcedPasswordChange();

  const form=document.getElementById('forced-password-form');
  if(!form)return;

  centralInstallPasswordChecklist(form);

  form.onsubmit=async e=>{
    e.preventDefault();

    const fd=new FormData(form);
    const password=String(fd.get('password'));
    const confirm=String(fd.get('confirm'));
    const msg=document.getElementById('forced-password-message');

    if(password.length<8){
      centralUpdatePasswordChecklist(password,confirm);
      msg.innerHTML='<div class="auth-message error">Use pelo menos 8 caracteres.</div>';
      return;
    }

    if(password!==confirm){
      centralUpdatePasswordChecklist(password,confirm);
      msg.innerHTML='<div class="auth-message error">As senhas não coincidem.</div>';
      return;
    }

    if(!navigator.onLine){
      msg.innerHTML='<div class="auth-message error">Conecte-se à internet para trocar a senha.</div>';
      return;
    }

    centralSetPasswordChecklistLeakedState('pending');
    setAuthBusy(form,true,'Validando…');

    try{
      await centralAssertSafePassword(password);
      centralSetPasswordChecklistLeakedState('safe');

      setAuthBusy(form,true,'Salvando…');

      const {data,error}=await cloudClient.functions.invoke(
        'change-own-password',
        {body:{password}}
      );

      if(error){
        let message=error.message||'Não foi possível alterar a senha.';

        try{
          if(error.context&&typeof error.context.json==='function'){
            const payload=await error.context.json();
            message=payload?.error||payload?.message||message;
          }
        }catch(_){}

        throw new Error(message);
      }

      if(!data?.ok){
        throw new Error(
          data?.error||
          'Não foi possível concluir a troca obrigatória da senha.'
        );
      }

      state.cloudProfile.must_change_password=false;
      storeIdentity(state.cloudUser,state.cloudProfile);

      document.getElementById('modal-root').innerHTML='';
      toast('Senha atualizada com sucesso.');

    }catch(error){
      const message=error?.message||String(error);
      if(/vazamento|vazamentos|comprometida|apareceu/i.test(message)){
        centralSetPasswordChecklistLeakedState('compromised');
      }else{
        centralSetPasswordChecklistLeakedState('pending');
      }
      msg.innerHTML=
        `<div class="auth-message error">${esc(message)}</div>`;
    }finally{
      setAuthBusy(form,false);
    }
  };
};

(async()=>{
  await registerCentralServiceWorker();
  if(await ensureCurrentBuild())bootConnectedApp();
})();

