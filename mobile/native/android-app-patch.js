/* ANDROID_NATIVE_APP_PATCH_V2
 *
 * Executado como parte do MESMO app.js do Android. Assim este patch tem acesso
 * às funções/estado já existentes da Central sem duplicar backend nem alterar
 * Windows/PWA.
 */
(function installAndroidNativeAppPatch(){
  'use strict';

  const isAndroid = () =>
    globalThis.Capacitor?.isNativePlatform?.() === true &&
    globalThis.Capacitor?.getPlatform?.() === 'android';

  if (!isAndroid()) return;

  const nativeApi = () => globalThis.CentralNativeAndroid;
  const delay = (ms, value = null) => new Promise(resolve => setTimeout(() => resolve(value), ms));

  async function localUserAvatar(){
    try{
      if(!state.cloudUser?.id)return null;
      return (await idbGet('appSettings',`user-avatar:${state.cloudUser.id}`))?.blob||null;
    }catch(error){
      console.warn('[Android] Cache local do avatar:',error);
      return null;
    }
  }

  async function refreshUserAvatarInBackground(){
    const path=state.cloudProfile?.avatar_path;
    if(!path||!navigator.onLine||!state.cloudUser?.id)return null;
    try{
      const {data,error}=await cloudClient.storage.from('user-profile-photos').download(path);
      if(error||!data)return null;
      await idbPut('appSettings',{key:`user-avatar:${state.cloudUser.id}`,blob:data,path,updatedAt:new Date().toISOString()});
      const avatar=document.getElementById('user-avatar');
      if(avatar)avatar.innerHTML=`<img src="${blobUrl(data)}" alt="Foto do perfil">`;
      const modalAvatar=document.querySelector('#my-profile-modal .whatsapp-profile-avatar');
      if(modalAvatar){
        const camera=modalAvatar.querySelector('.profile-avatar-camera')?.outerHTML||'';
        modalAvatar.innerHTML=`<img src="${blobUrl(data)}" alt="Foto do perfil">${camera}`;
      }
      const preview=document.getElementById('profile-photo-preview');
      if(preview)preview.innerHTML=`<img src="${blobUrl(data)}" alt="Foto atual">`;
      return data;
    }catch(error){
      console.warn('[Android] Atualização remota do avatar:',error);
      return null;
    }
  }

  // Nunca mais bloquear a interface esperando Storage antes de mostrar o perfil.
  const baseCachedUserAvatar=cachedUserAvatar;
  cachedUserAvatar=async function androidCachedUserAvatar(){
    const local=await localUserAvatar();
    refreshUserAvatarInBackground().catch(()=>{});
    if(local)return local;

    // Compatibilidade: uma tentativa curta da implementação original, sem travar UI.
    try{
      return await Promise.race([
        Promise.resolve(baseCachedUserAvatar()).catch(()=>null),
        delay(350,null),
      ]);
    }catch{return null}
  };

  // Fotos de ativos também são cache-first para não bloquear formulário/modal.
  const basePhotoForAsset=photoForAsset;
  photoForAsset=async function androidPhotoForAsset(assetId){
    try{
      const local=(await idbGet('assetPhotos',assetId))?.blob||null;
      if(local){
        Promise.resolve(basePhotoForAsset(assetId)).catch(()=>{});
        return local;
      }
    }catch(error){console.warn('[Android] Cache local da foto do ativo:',error)}
    try{
      return await Promise.race([
        Promise.resolve(basePhotoForAsset(assetId)).catch(()=>null),
        delay(700,null),
      ]);
    }catch{return null}
  };

  function profileIdentity(){
    const u=currentUser(),p=state.cloudProfile||{},email=state.cloudUser?.email||'';
    const rawName=(p.display_name||'').trim();
    const primaryName=rawName&&rawName.toLowerCase()!==email.toLowerCase()&&!rawName.includes('@')
      ?rawName:(email||'Usuário');
    const secondary=primaryName===email?u.label:`${email}${email?' · ':''}${u.label}`;
    return {u,p,email,primaryName,secondary};
  }

  function renderProfileAvatar(target,blob,u){
    if(!target)return;
    if(blob)target.innerHTML=`<img src="${blobUrl(blob)}" alt="Foto do perfil"><span class="profile-avatar-camera" data-icon="camera"></span>`;
    else target.innerHTML=`${esc(u.initials)}<span class="profile-avatar-camera" data-icon="camera"></span>`;
    hydrateIcons(target);
  }

  async function openAndroidProfileDialog(){
    const {u,p,primaryName,secondary}=profileIdentity();
    const root=document.getElementById('modal-root');
    if(!root)return;

    // O container é desenhado IMEDIATAMENTE. Nenhum fetch/IndexedDB antecede isto.
    root.innerHTML=`<div class="modal" id="my-profile-modal"><div class="modal-card profile-settings-dialog has-sticky-close"><button class="modal-close profile-standard-close" id="close-my-profile" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="whatsapp-profile-card"><div class="whatsapp-profile-head"><button class="whatsapp-profile-avatar profile-avatar-edit" id="profile-avatar-edit" type="button" aria-label="Alterar foto do perfil" title="Alterar foto do perfil">${esc(u.initials)}<span class="profile-avatar-camera" data-icon="camera"></span></button><div class="profile-identity"><strong>${esc(primaryName)}</strong><small>${esc(secondary)}</small></div></div><form id="my-profile-form" class="auth-form"><div class="auth-field"><label>Telefone / WhatsApp de contato</label><input name="whatsapp_number" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(32) 99999-9999" value="${esc(p.whatsapp_number||'')}"></div><div><label class="profile-section-label">Preferências de notificações</label>${notificationPreferencesMarkup(p,state.role)}</div><div class="push-device-card refined-push-device"><div><strong>Este dispositivo</strong><small class="push-device-intro">Gerencie as notificações deste computador ou celular.</small></div><button class="btn secondary push-device-toggle" id="push-device-toggle" type="button">Verificando…</button><p class="push-help" id="push-device-help"></p></div><div class="profile-save-row"><button class="btn primary" type="submit">Salvar preferências</button></div></form></div></div></div>`;
    hydrateIcons(root);

    const close=()=>{root.innerHTML=''};
    document.getElementById('close-my-profile').onclick=close;
    document.getElementById('my-profile-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};
    document.getElementById('profile-avatar-edit').onclick=()=>openAndroidProfilePhotoDialog();

    const pushButton=document.getElementById('push-device-toggle');
    pushButton.onclick=async e=>{
      const b=e.currentTarget,active=b.dataset.active==='true';
      b.disabled=true;b.textContent=active?'Desativando…':'Ativando…';
      try{
        if(active){await deactivatePushOnThisDevice();toast('Notificações desativadas neste dispositivo.')}
        else{await activatePushOnThisDevice();toast('Notificações ativadas neste dispositivo.')}
      }catch(error){toast(error.message||String(error),'warning')}
      finally{Promise.resolve().then(()=>refreshPushDeviceCard()).catch(()=>{})}
    };

    const form=document.getElementById('my-profile-form');
    form.onsubmit=async e=>{
      e.preventDefault();
      if(!navigator.onLine)return toast('Conecte-se à internet para atualizar seu perfil.','warning');
      const fd=new FormData(form),whatsapp=normalizeWhatsappInput(fd.get('whatsapp_number'));
      if(!whatsapp)return toast('Informe um telefone/WhatsApp válido com DDD.','warning');
      const prefs=notificationFormValues(fd,state.role);
      setAuthBusy(form,true,'Salvando…');
      try{
        const {error}=await cloudClient.rpc('update_own_push_notification_preferences',{
          p_whatsapp_number:whatsapp,
          p_push_notifications_enabled:prefs.push_notifications_enabled,
          p_notify_new_reports:prefs.notify_new_reports,
          p_notify_report_received:prefs.notify_report_received,
          p_notify_report_approved:prefs.notify_report_approved,
          p_notify_report_rejected:prefs.notify_report_rejected,
          p_notify_report_corrected:prefs.notify_report_corrected,
        });
        if(error)throw error;
        state.cloudProfile=await fetchCurrentProfile(state.cloudUser);
        storeIdentity(state.cloudUser,state.cloudProfile);
        close();
        await updateNotificationBell();
        toast('Contato e notificações atualizados.');
      }catch(error){toast(error.message||String(error),'warning')}
      finally{setAuthBusy(form,false)}
    };

    // Agora sim buscamos imagem/Push em segundo plano, com o modal já visível.
    localUserAvatar().then(blob=>renderProfileAvatar(document.getElementById('profile-avatar-edit'),blob,u)).catch(()=>{});
    refreshUserAvatarInBackground().catch(()=>{});
    Promise.resolve().then(()=>refreshPushDeviceCard()).catch(error=>console.warn('[Android] Card Push:',error));
  }

  async function saveUserAvatarFile(file){
    if(!file)return false;
    if(!navigator.onLine)return toast('Conecte-se à internet para alterar a foto do perfil.','warning'),false;
    if(!state.cloudUser?.id)return toast('Sessão do usuário indisponível. Entre novamente.','warning'),false;

    const compressed=await compressImage(file,700,.85),path=`${state.cloudUser.id}/avatar.jpg`;
    const {error:uploadError}=await cloudClient.storage.from('user-profile-photos').upload(path,compressed,{contentType:'image/jpeg',upsert:true});
    if(uploadError)throw uploadError;
    const {error:rpcError}=await cloudClient.rpc('set_own_profile_avatar',{p_storage_path:path});
    if(rpcError)throw rpcError;
    state.cloudProfile={...(state.cloudProfile||{}),avatar_path:path};
    await idbPut('appSettings',{key:`user-avatar:${state.cloudUser.id}`,blob:compressed,path,updatedAt:new Date().toISOString()});
    storeIdentity(state.cloudUser,state.cloudProfile);
    updateRoleChrome();
    return true;
  }

  async function removeUserAvatar(){
    if(!navigator.onLine)return toast('Conecte-se à internet para remover a foto.','warning'),false;
    const oldPath=state.cloudProfile?.avatar_path;
    if(oldPath)await cloudClient.storage.from('user-profile-photos').remove([oldPath]);
    const {error}=await cloudClient.rpc('set_own_profile_avatar',{p_storage_path:null});
    if(error)throw error;
    state.cloudProfile={...(state.cloudProfile||{}),avatar_path:null};
    if(state.cloudUser?.id)await idbDelete('appSettings',`user-avatar:${state.cloudUser.id}`);
    storeIdentity(state.cloudUser,state.cloudProfile);
    updateRoleChrome();
    return true;
  }

  async function pickOneNativeImage(context,title='Adicionar foto'){
    const api=nativeApi();
    if(!api?.pickImage)throw new Error('Seletor nativo de imagens indisponível.');
    return api.pickImage({title,context});
  }

  async function openAndroidProfilePhotoDialog(){
    const u=currentUser(),root=document.getElementById('modal-root');
    if(!root)return;
    root.innerHTML=`<div class="modal" id="profile-photo-modal"><div class="modal-card profile-photo-dialog"><button class="modal-close" id="close-profile-photo" type="button" aria-label="Fechar"><span data-icon="x"></span></button><h2>Foto do perfil</h2><p class="muted">A imagem ficará vinculada ao seu usuário e só será removida pelo botão “Remover foto”.</p><div class="profile-photo-preview" id="profile-photo-preview">${esc(u.initials)}</div><div class="profile-photo-actions"><button class="btn secondary" id="choose-profile-photo" type="button"><span data-icon="camera"></span>Adicionar ou alterar foto</button><button class="btn ghost hidden" id="remove-profile-photo" type="button"><span data-icon="trash"></span>Remover foto</button></div></div></div>`;
    hydrateIcons(root);
    const close=()=>{root.innerHTML=''};
    document.getElementById('close-profile-photo').onclick=close;
    document.getElementById('profile-photo-modal').onclick=e=>{if(e.target===e.currentTarget)e.stopPropagation()};

    const remove=document.getElementById('remove-profile-photo');
    const local=await localUserAvatar();
    if(local){document.getElementById('profile-photo-preview').innerHTML=`<img src="${blobUrl(local)}" alt="Foto atual">`;remove.classList.remove('hidden')}
    else if(state.cloudProfile?.avatar_path){remove.classList.remove('hidden');refreshUserAvatarInBackground().catch(()=>{})}

    document.getElementById('choose-profile-photo').onclick=async()=>{
      try{
        const file=await pickOneNativeImage({kind:'user-avatar'},'Foto do perfil');
        if(!file)return;
        if(await saveUserAvatarFile(file)){close();toast('Foto do perfil atualizada.')}
      }catch(error){toast(error.message||String(error),'warning')}
    };
    remove.onclick=async()=>{
      if(!confirm('Remover a foto do perfil?'))return;
      try{if(await removeUserAvatar()){close();toast('Foto do perfil removida.')}}catch(error){toast(error.message||String(error),'warning')}
    };
  }

  // Substitui os openers apenas no Android. O container aparece sem qualquer await prévio.
  openMyProfileDialog=openAndroidProfileDialog;
  openProfilePhotoDialog=openAndroidProfilePhotoDialog;

  // O listener original do avatar foi registrado antes deste patch e mantém a função antiga.
  // Capturamos o clique antes dele para garantir o opener Android determinístico.
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('#user-avatar,#mobile-profile-photo'):null;
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(target.id==='mobile-profile-photo')closeMobileMoreMenu();
    openAndroidProfileDialog().catch(error=>{console.error('[Android] Perfil:',error);toast(error.message||String(error),'warning')});
  },true);

  let assetPhotoBusy=false;

  async function saveAssetProfileFile(assetId,file){
    if(!file)return {saved:false,cloudWarning:null};
    let cloudWarning=null;
    try{
      await setAssetPhoto(assetId,file);
    }catch(error){
      const local=(await idbGet('assetPhotos',assetId))?.blob||null;
      if(!local)throw error;
      cloudWarning=error;
    }
    return {saved:true,cloudWarning};
  }

  async function changeAssetProfilePhoto(assetId,{context=null,afterSave=null}={}){
    if(assetPhotoBusy)return;
    assetPhotoBusy=true;
    try{
      const file=await pickOneNativeImage(context||{kind:'asset-profile',assetId},'Foto principal do ativo');
      if(!file)return;
      const result=await saveAssetProfileFile(assetId,file);
      if(result.cloudWarning)toast('Foto salva no aparelho, mas a sincronização com a nuvem não foi concluída.','warning');
      else toast('Foto principal do ativo atualizada.');
      if(afterSave)await afterSave();
    }catch(error){
      const message=error?.message||String(error);
      if(!/cancel|cancelado|canceled/i.test(message))toast(message,'warning');
    }finally{assetPhotoBusy=false}
  }

  // O app original chama chooseProfilePhoto(), mas não há implementação no app.js atual.
  globalThis.chooseProfilePhoto=async function androidChooseProfilePhoto(assetId){
    return changeAssetProfilePhoto(assetId,{
      context:{kind:'asset-profile-maintenance',assetId},
      afterSave:async()=>{if(state.screen==='activity')await renderActivity()},
    });
  };

  // Banco de Dados: acrescenta a mesma ação nativa à foto da ficha do ativo.
  const baseOpenAssetDetails=openAssetDetails;
  openAssetDetails=async function androidOpenAssetDetails(subId,assetId){
    await baseOpenAssetDetails(subId,assetId);
    if(state.role!=='admin')return;
    const photo=document.querySelector('#asset-modal .asset-modal-photo');
    if(!photo||photo.querySelector('.android-asset-photo-action'))return;
    photo.classList.add('android-photo-editable');
    const button=document.createElement('button');
    button.type='button';
    button.className='android-asset-photo-action';
    button.innerHTML='<span data-icon="camera"></span><span>Adicionar / alterar foto</span>';
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      changeAssetProfilePhoto(assetId,{
        context:{kind:'asset-profile-database',assetId,subId},
        afterSave:async()=>{await openAssetDetails(subId,assetId)},
      });
    };
    photo.appendChild(button);hydrateIcons(button);
  };

  // Se o Android recriar a Activity enquanto a câmera estiver aberta, finaliza a operação.
  window.addEventListener('central-native-images-restored',async event=>{
    const files=event.detail?.files||[],context=event.detail?.context||{};
    const file=files[0];if(!file)return;
    try{
      if(context.kind==='user-avatar'){
        if(await saveUserAvatarFile(file))toast('Foto do perfil atualizada.');
        return;
      }
      if(context.kind==='asset-profile-maintenance'||context.kind==='asset-profile-database'||context.kind==='asset-profile'){
        const result=await saveAssetProfileFile(context.assetId,file);
        if(result.cloudWarning)toast('Foto salva no aparelho; sincronização com a nuvem pendente.','warning');
        else toast('Foto principal do ativo atualizada.');
        if(context.kind==='asset-profile-database'&&context.subId)await openAssetDetails(context.subId,context.assetId);
        else if(state.screen==='activity')await renderActivity();
      }
    }catch(error){toast(error.message||String(error),'warning')}
  });

  // Reaplica o avatar do cache sem zerá-lo visualmente.
  localUserAvatar().then(blob=>{
    if(!blob)return;
    const avatar=document.getElementById('user-avatar');
    if(avatar)avatar.innerHTML=`<img src="${blobUrl(blob)}" alt="Foto do perfil">`;
  }).catch(()=>{});
})();
