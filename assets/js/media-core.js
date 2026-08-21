/* CENTRAL_MEDIA_CORE_V1
 * Camada compartilhada de mídia da Central de Manutenção SE.
 * Carregada depois de app.js em PWA, Windows Native e Android Native.
 *
 * Responsabilidades:
 * - um único seletor de imagens por plataforma;
 * - foto principal de ativo com cache local + fila offline + Supabase;
 * - uso de foto de manutenção como foto principal com a mesma persistência;
 * - foto do usuário com seleção comum e fila offline;
 * - mesma ação de foto na ficha do Banco de Dados;
 * - perfil abre imediatamente, sem bloquear a UI esperando Storage.
 */
(() => {
  'use strict';

  if (globalThis.__CENTRAL_MEDIA_CORE_V1__) return;
  globalThis.__CENTRAL_MEDIA_CORE_V1__ = true;

  const ASSET_QUEUE_KIND = 'asset-profile-sync-v1';
  const AVATAR_QUEUE_KIND = 'user-avatar-sync-v1';
  const ASSET_QUEUE_PREFIX = 'media:asset-profile:';
  const AVATAR_QUEUE_PREFIX = 'media:user-avatar:';
  let pickerPromise = null;
  let assetPhotoBusy = false;

  function currentOwnerId() {
    return state?.cloudUser?.id || null;
  }

  function mediaCss() {
    if (document.querySelector('link[data-central-media-core]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './assets/css/media-core.css';
    link.dataset.centralMediaCore = '1';
    document.head.appendChild(link);
  }

  function browserPickImages({ multiple = false } = {}) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = Boolean(multiple);
      input.className = 'hidden';
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;

      let settled = false;
      const finish = (files = []) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('focus', onFocus, true);
        input.remove();
        resolve(files);
      };
      const onFocus = () => {
        // O seletor nativo fecha antes de o navegador recuperar o foco.
        // Um pequeno atraso permite que input.files seja atualizado.
        setTimeout(() => finish([...(input.files || [])]), 250);
      };

      input.addEventListener('change', () => finish([...(input.files || [])]), { once: true });
      input.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        window.removeEventListener('focus', onFocus, true);
        input.remove();
        reject(new Error('Não foi possível abrir o seletor de imagens.'));
      }, { once: true });
      window.addEventListener('focus', onFocus, true);
      document.body.appendChild(input);

      try {
        input.click();
      } catch (error) {
        settled = true;
        window.removeEventListener('focus', onFocus, true);
        input.remove();
        reject(error);
      }
    });
  }

  async function pickImages(options = {}) {
    if (pickerPromise) return pickerPromise;

    pickerPromise = (async () => {
      const native = globalThis.CentralNativeAndroid;
      if (native?.isAvailable?.() && typeof native.pickImages === 'function') {
        return native.pickImages(options);
      }
      return browserPickImages(options);
    })();

    try {
      return await pickerPromise;
    } finally {
      pickerPromise = null;
    }
  }

  async function pickImage(options = {}) {
    const files = await pickImages({ ...options, multiple: false });
    return files[0] || null;
  }

  globalThis.CentralMedia = Object.freeze({
    pickImages,
    pickImage,
    syncPending: () => syncPendingMedia(),
  });

  function assetQueueKey(ownerId, assetId) {
    return `${ASSET_QUEUE_PREFIX}${ownerId}:${assetId}`;
  }

  function avatarQueueKey(ownerId) {
    return `${AVATAR_QUEUE_PREFIX}${ownerId}`;
  }

  async function queueAssetProfilePhoto(assetId, blob) {
    const ownerId = currentOwnerId();
    if (!ownerId || !assetId || !blob) return null;
    const key = assetQueueKey(ownerId, assetId);
    const previous = await idbGet('appSettings', key).catch(() => null);
    const entry = {
      key,
      kind: ASSET_QUEUE_KIND,
      ownerId,
      assetId,
      blob,
      status: 'pendente',
      attempts: previous?.attempts || 0,
      lastError: '',
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await idbPut('appSettings', entry);
    return entry;
  }

  function updateAssetPhotoPath(assetId, path) {
    for (const sub of Object.values(DATA.equipment || {})) {
      for (const group of ['eletronicos', 'reles', 'patio']) {
        const asset = (sub?.[group] || []).find(item => item.id === assetId);
        if (asset) asset.profilePhotoPath = path;
      }
    }
  }

  async function syncAssetProfileEntry(entry) {
    if (!entry || entry.kind !== ASSET_QUEUE_KIND) return false;
    if (!navigator.onLine || !state.cloudUser?.id) return false;
    if (entry.ownerId !== state.cloudUser.id) return false;

    entry.attempts = (entry.attempts || 0) + 1;
    entry.updatedAt = new Date().toISOString();
    await idbPut('appSettings', entry);

    // Caminho estável: retries são idempotentes e não deixam arquivos órfãos.
    const path = `${state.cloudUser.id}/${entry.assetId}/profile.jpg`;
    try {
      const { error: uploadError } = await cloudClient.storage
        .from('asset-profile-photos')
        .upload(path, entry.blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { error: rpcError } = await cloudClient.rpc('set_asset_profile_photo', {
        p_asset_id: entry.assetId,
        p_storage_path: path,
      });
      if (rpcError) throw rpcError;

      updateAssetPhotoPath(entry.assetId, path);
      await idbDelete('appSettings', entry.key);
      return true;
    } catch (error) {
      entry.status = 'erro';
      entry.lastError = String(error?.message || error);
      entry.updatedAt = new Date().toISOString();
      await idbPut('appSettings', entry);
      throw error;
    }
  }

  async function saveAssetProfileBlob(assetId, sourceBlob) {
    if (!assetId || !sourceBlob) return null;
    const blob = await compressImage(sourceBlob, 1000, .82);
    await idbPut('assetPhotos', {
      assetId,
      blob,
      updatedAt: new Date().toISOString(),
    });

    const entry = await queueAssetProfilePhoto(assetId, blob);
    if (entry && navigator.onLine && state.cloudUser?.id) {
      try {
        await syncAssetProfileEntry(entry);
      } catch (error) {
        console.warn('[Media] Foto principal salva localmente; sincronização pendente:', error);
      }
    }
    return blob;
  }

  // Substitui a implementação antiga: sempre local-first e com fila offline.
  setAssetPhoto = async function sharedSetAssetPhoto(assetId, file) {
    return saveAssetProfileBlob(assetId, file);
  };

  async function pendingEntries(kind) {
    const ownerId = currentOwnerId();
    if (!ownerId) return [];
    const rows = await idbAll('appSettings');
    return rows.filter(row => row?.kind === kind && row.ownerId === ownerId);
  }

  async function syncPendingAssetProfiles() {
    if (!navigator.onLine || !state.cloudUser?.id) return { processed: 0 };
    const rows = await pendingEntries(ASSET_QUEUE_KIND);
    let processed = 0;
    for (const entry of rows) {
      try {
        if (await syncAssetProfileEntry(entry)) processed += 1;
      } catch (error) {
        console.warn('[Media] Sincronização de foto principal pendente:', error);
      }
    }
    return { processed };
  }

  async function localUserAvatar() {
    if (!state.cloudUser?.id) return null;
    return (await idbGet('appSettings', `user-avatar:${state.cloudUser.id}`).catch(() => null))?.blob || null;
  }

  async function queueUserAvatar(blob, action = 'set', oldPath = null) {
    const ownerId = currentOwnerId();
    if (!ownerId) return null;
    const key = avatarQueueKey(ownerId);
    const previous = await idbGet('appSettings', key).catch(() => null);
    const entry = {
      key,
      kind: AVATAR_QUEUE_KIND,
      ownerId,
      action,
      blob: action === 'set' ? blob : null,
      oldPath: oldPath || previous?.oldPath || state.cloudProfile?.avatar_path || null,
      status: 'pendente',
      attempts: previous?.attempts || 0,
      lastError: '',
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await idbPut('appSettings', entry);
    return entry;
  }

  async function syncUserAvatarEntry(entry) {
    if (!entry || entry.kind !== AVATAR_QUEUE_KIND) return false;
    if (!navigator.onLine || !state.cloudUser?.id) return false;
    if (entry.ownerId !== state.cloudUser.id) return false;

    entry.attempts = (entry.attempts || 0) + 1;
    entry.updatedAt = new Date().toISOString();
    await idbPut('appSettings', entry);

    try {
      if (entry.action === 'remove') {
        if (entry.oldPath) {
          const { error: removeError } = await cloudClient.storage
            .from('user-profile-photos')
            .remove([entry.oldPath]);
          if (removeError) console.warn('[Media] Remoção do arquivo antigo do avatar:', removeError);
        }
        const { error } = await cloudClient.rpc('set_own_profile_avatar', { p_storage_path: null });
        if (error) throw error;
        state.cloudProfile = { ...(state.cloudProfile || {}), avatar_path: null };
      } else {
        const path = `${state.cloudUser.id}/avatar.jpg`;
        const { error: uploadError } = await cloudClient.storage
          .from('user-profile-photos')
          .upload(path, entry.blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        const { error: rpcError } = await cloudClient.rpc('set_own_profile_avatar', {
          p_storage_path: path,
        });
        if (rpcError) throw rpcError;
        state.cloudProfile = { ...(state.cloudProfile || {}), avatar_path: path };
      }

      storeIdentity(state.cloudUser, state.cloudProfile);
      await idbDelete('appSettings', entry.key);
      return true;
    } catch (error) {
      entry.status = 'erro';
      entry.lastError = String(error?.message || error);
      entry.updatedAt = new Date().toISOString();
      await idbPut('appSettings', entry);
      throw error;
    }
  }

  async function syncPendingUserAvatar() {
    if (!navigator.onLine || !state.cloudUser?.id) return { processed: 0 };
    const rows = await pendingEntries(AVATAR_QUEUE_KIND);
    let processed = 0;
    for (const entry of rows) {
      try {
        if (await syncUserAvatarEntry(entry)) processed += 1;
      } catch (error) {
        console.warn('[Media] Sincronização de avatar pendente:', error);
      }
    }
    return { processed };
  }

  async function saveUserAvatar(file) {
    if (!state.cloudUser?.id) throw new Error('Sessão do usuário indisponível. Entre novamente.');
    const blob = await compressImage(file, 700, .85);
    const path = `${state.cloudUser.id}/avatar.jpg`;
    await idbPut('appSettings', {
      key: `user-avatar:${state.cloudUser.id}`,
      blob,
      path,
      updatedAt: new Date().toISOString(),
    });
    state.cloudProfile = { ...(state.cloudProfile || {}), avatar_path: path };
    storeIdentity(state.cloudUser, state.cloudProfile);

    const entry = await queueUserAvatar(blob, 'set');
    if (entry && navigator.onLine) {
      try {
        await syncUserAvatarEntry(entry);
      } catch (error) {
        console.warn('[Media] Avatar salvo localmente; sincronização pendente:', error);
      }
    }
    updateRoleChrome();
    return blob;
  }

  async function removeUserAvatarShared() {
    if (!state.cloudUser?.id) throw new Error('Sessão do usuário indisponível. Entre novamente.');
    const oldPath = state.cloudProfile?.avatar_path || null;
    await idbDelete('appSettings', `user-avatar:${state.cloudUser.id}`);
    state.cloudProfile = { ...(state.cloudProfile || {}), avatar_path: null };
    storeIdentity(state.cloudUser, state.cloudProfile);
    const entry = await queueUserAvatar(null, 'remove', oldPath);
    if (entry && navigator.onLine) {
      try {
        await syncUserAvatarEntry(entry);
      } catch (error) {
        console.warn('[Media] Remoção do avatar pendente de sincronização:', error);
      }
    }
    updateRoleChrome();
    return true;
  }

  // Cache-first: evita que a interface dependa da latência do Storage.
  const baseCachedUserAvatar = cachedUserAvatar;
  cachedUserAvatar = async function sharedCachedUserAvatar() {
    const local = await localUserAvatar();
    if (local) return local;
    if (!navigator.onLine) return null;
    try {
      return await Promise.race([
        Promise.resolve(baseCachedUserAvatar()).catch(() => null),
        new Promise(resolve => setTimeout(() => resolve(null), 700)),
      ]);
    } catch {
      return null;
    }
  };

  async function syncPendingMedia() {
    if (!navigator.onLine || !state.cloudUser?.id) return { assetProfiles: 0, avatars: 0 };
    const [assets, avatars] = await Promise.all([
      syncPendingAssetProfiles(),
      syncPendingUserAvatar(),
    ]);
    return { assetProfiles: assets.processed, avatars: avatars.processed };
  }

  async function chooseAssetProfilePhoto(assetId, { afterSave = null, title = 'Foto principal do ativo' } = {}) {
    if (!assetId || assetPhotoBusy) return null;
    assetPhotoBusy = true;
    try {
      const file = await pickImage({
        title,
        context: { kind: 'asset-profile', assetId },
      });
      if (!file) return null;
      const blob = await setAssetPhoto(assetId, file);
      if (typeof afterSave === 'function') await afterSave(blob);
      toast(navigator.onLine
        ? 'Foto principal do ativo atualizada.'
        : 'Foto principal salva no dispositivo e aguardando sincronização.',
        navigator.onLine ? 'success' : 'notice');
      return blob;
    } catch (error) {
      const message = String(error?.message || error);
      if (!/cancel|cancelado|canceled/i.test(message)) toast(message, 'warning');
      return null;
    } finally {
      assetPhotoBusy = false;
    }
  }

  // Nome já utilizado pelo formulário principal de manutenção.
  globalThis.chooseProfilePhoto = async function chooseProfilePhotoShared(assetId) {
    return chooseAssetProfilePhoto(assetId, {
      afterSave: async () => {
        if (state.screen === 'activity') await renderActivity();
      },
    });
  };

  // Quando uma foto da manutenção for marcada como foto principal, usa a mesma fila.
  const basePersistPendingPhotos = persistPendingPhotos;
  persistPendingPhotos = async function sharedPersistPendingPhotos(recordId, sel, createdAt) {
    const result = await basePersistPendingPhotos(recordId, sel, createdAt);
    const profileSelections = (state.pendingPhotos || [])
      .filter(photo => photo?.asProfile && photo.assetId && photo.assetId !== 'all');

    for (const photo of profileSelections) {
      try {
        await saveAssetProfileBlob(photo.assetId, photo.blob);
      } catch (error) {
        console.warn('[Media] Foto da manutenção não pôde ser promovida à foto principal:', error);
      }
    }
    return result;
  };

  function attachAssetDatabasePhotoAction(subId, assetId) {
    if (state.role !== 'admin') return;
    const modal = document.getElementById('asset-modal');
    const photo = modal?.querySelector('.asset-modal-photo');
    if (!photo || photo.querySelector('.central-media-asset-action')) return;

    photo.classList.add('central-media-photo-host');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'central-media-asset-action';
    button.innerHTML = '<span data-icon="camera"></span><span>Adicionar / alterar foto</span>';
    photo.appendChild(button);
    hydrateIcons(button);

    /*
     * A foto é uma mídia independente dos campos cadastrais. Por isso ela pode
     * ser alterada mesmo com o formulário textual bloqueado e também offline;
     * a fila compartilhada fará a sincronização quando a conexão voltar.
     */

    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      await chooseAssetProfilePhoto(assetId, {
        title: 'Foto do ativo',
        afterSave: async () => {
          await openAssetDetails(subId, assetId);
          // A foto acabou de ser salva; reabre a ficha em modo de leitura por segurança.
        },
      });
    });
  }

  const baseOpenAssetDetails = openAssetDetails;
  openAssetDetails = async function sharedOpenAssetDetails(subId, assetId) {
    const result = await baseOpenAssetDetails(subId, assetId);
    attachAssetDatabasePhotoAction(subId, assetId);
    return result;
  };

  function profileIdentity() {
    const u = currentUser();
    const p = state.cloudProfile || {};
    const email = state.cloudUser?.email || '';
    const rawName = (p.display_name || '').trim();
    const primaryName = rawName && rawName.toLowerCase() !== email.toLowerCase() && !rawName.includes('@')
      ? rawName
      : (email || 'Usuário');
    const secondary = primaryName === email ? u.label : `${email}${email ? ' · ' : ''}${u.label}`;
    return { u, p, email, primaryName, secondary };
  }

  async function openSharedProfilePhotoDialog() {
    const u = currentUser();
    const root = document.getElementById('modal-root');
    if (!root) return;
    const local = await localUserAvatar();

    root.innerHTML = `<div class="modal" id="profile-photo-modal"><div class="modal-card profile-photo-dialog"><button class="modal-close" id="close-profile-photo" type="button" aria-label="Fechar"><span data-icon="x"></span></button><h2>Foto do perfil</h2><p class="muted">No celular você pode tirar uma foto ou escolher da galeria. No computador, selecione uma imagem salva no dispositivo.</p><div class="profile-photo-preview" id="profile-photo-preview">${local ? `<img src="${blobUrl(local)}" alt="Foto atual">` : esc(u.initials)}</div><div class="profile-photo-actions"><button class="btn secondary" id="choose-profile-photo" type="button"><span data-icon="camera"></span>${local ? 'Alterar foto' : 'Adicionar foto'}</button>${(local || state.cloudProfile?.avatar_path) ? '<button class="btn ghost" id="remove-profile-photo" type="button"><span data-icon="trash"></span>Remover foto</button>' : ''}</div></div></div>`;
    hydrateIcons(root);

    const close = () => { root.innerHTML = ''; };
    document.getElementById('close-profile-photo').onclick = close;
    document.getElementById('profile-photo-modal').onclick = event => {
      if (event.target === event.currentTarget) event.stopPropagation();
    };

    document.getElementById('choose-profile-photo').onclick = async () => {
      try {
        const file = await pickImage({
          title: 'Foto do perfil',
          context: { kind: 'user-avatar' },
        });
        if (!file) return;
        await saveUserAvatar(file);
        close();
        toast(navigator.onLine
          ? 'Foto do perfil atualizada.'
          : 'Foto salva no dispositivo e aguardando sincronização.',
          navigator.onLine ? 'success' : 'notice');
      } catch (error) {
        toast(error?.message || String(error), 'warning');
      }
    };

    document.getElementById('remove-profile-photo')?.addEventListener('click', async () => {
      if (!confirm('Remover a foto do perfil?')) return;
      try {
        await removeUserAvatarShared();
        close();
        toast(navigator.onLine
          ? 'Foto do perfil removida.'
          : 'Remoção salva no dispositivo e aguardando sincronização.',
          navigator.onLine ? 'success' : 'notice');
      } catch (error) {
        toast(error?.message || String(error), 'warning');
      }
    });
  }

  async function openSharedMyProfileDialog() {
    const { u, p, primaryName, secondary } = profileIdentity();
    const root = document.getElementById('modal-root');
    if (!root) return;

    // Renderiza primeiro. Nenhum acesso ao Storage antecede a abertura do container.
    root.innerHTML = `<div class="modal" id="my-profile-modal"><div class="modal-card profile-settings-dialog has-sticky-close"><button class="modal-close profile-standard-close" id="close-my-profile" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="whatsapp-profile-card"><div class="whatsapp-profile-head"><button class="whatsapp-profile-avatar profile-avatar-edit" id="profile-avatar-edit" type="button" aria-label="Alterar foto do perfil" title="Alterar foto do perfil">${esc(u.initials)}<span class="profile-avatar-camera" data-icon="camera"></span></button><div class="profile-identity"><strong>${esc(primaryName)}</strong><small>${esc(secondary)}</small></div></div><form id="my-profile-form" class="auth-form"><div class="auth-field"><label>Telefone / WhatsApp de contato</label><input name="whatsapp_number" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(32) 99999-9999" value="${esc(p.whatsapp_number || '')}"></div><div><label class="profile-section-label">Preferências de notificações</label>${notificationPreferencesMarkup(p, state.role)}</div><div class="push-device-card refined-push-device"><div><strong>Este dispositivo</strong><small class="push-device-intro">Gerencie as notificações deste computador ou celular.</small></div><button class="btn secondary push-device-toggle" id="push-device-toggle" type="button">Verificando…</button><p class="push-help" id="push-device-help"></p></div><div class="profile-save-row"><button class="btn primary" type="submit">Salvar preferências</button></div></form></div></div></div>`;
    hydrateIcons(root);

    const close = () => { root.innerHTML = ''; };
    document.getElementById('close-my-profile').onclick = close;
    document.getElementById('my-profile-modal').onclick = event => {
      if (event.target === event.currentTarget) event.stopPropagation();
    };
    document.getElementById('profile-avatar-edit').onclick = () => openSharedProfilePhotoDialog();

    const pushButton = document.getElementById('push-device-toggle');
    pushButton.onclick = async event => {
      const button = event.currentTarget;
      const active = button.dataset.active === 'true';
      button.disabled = true;
      button.textContent = active ? 'Desativando…' : 'Ativando…';
      try {
        if (active) {
          await deactivatePushOnThisDevice();
          toast('Notificações desativadas neste dispositivo.');
        } else {
          await activatePushOnThisDevice();
          toast('Notificações ativadas neste dispositivo.');
        }
      } catch (error) {
        toast(error?.message || String(error), 'warning');
      } finally {
        Promise.resolve().then(() => refreshPushDeviceCard()).catch(() => {});
      }
    };

    const form = document.getElementById('my-profile-form');
    form.onsubmit = async event => {
      event.preventDefault();
      if (!navigator.onLine) return toast('Conecte-se à internet para atualizar seus dados cadastrais.', 'warning');
      const fd = new FormData(form);
      const whatsapp = normalizeWhatsappInput(fd.get('whatsapp_number'));
      if (!whatsapp) return toast('Informe um telefone/WhatsApp válido com DDD.', 'warning');
      const prefs = notificationFormValues(fd, state.role);
      setAuthBusy(form, true, 'Salvando…');
      try {
        const { error } = await cloudClient.rpc('update_own_push_notification_preferences', {
          p_whatsapp_number: whatsapp,
          p_push_notifications_enabled: prefs.push_notifications_enabled,
          p_notify_new_reports: prefs.notify_new_reports,
          p_notify_report_received: prefs.notify_report_received,
          p_notify_report_approved: prefs.notify_report_approved,
          p_notify_report_rejected: prefs.notify_report_rejected,
          p_notify_report_corrected: prefs.notify_report_corrected,
        });
        if (error) throw error;
        state.cloudProfile = await fetchCurrentProfile(state.cloudUser);
        storeIdentity(state.cloudUser, state.cloudProfile);
        close();
        await updateNotificationBell();
        toast('Contato e notificações atualizados.');
      } catch (error) {
        toast(error?.message || String(error), 'warning');
      } finally {
        setAuthBusy(form, false);
      }
    };

    // Imagem e estado do Push são preenchidos depois que o modal já está visível.
    localUserAvatar().then(blob => {
      if (!blob) return;
      const avatar = document.getElementById('profile-avatar-edit');
      if (!avatar) return;
      avatar.innerHTML = `<img src="${blobUrl(blob)}" alt="Foto do perfil"><span class="profile-avatar-camera" data-icon="camera"></span>`;
      hydrateIcons(avatar);
    }).catch(() => {});
    Promise.resolve().then(() => refreshPushDeviceCard()).catch(() => {});
  }

  openProfilePhotoDialog = openSharedProfilePhotoDialog;
  openMyProfileDialog = openSharedMyProfileDialog;

  // Garante o novo opener mesmo se algum listener antigo tiver capturado a função anterior.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest('#user-avatar,#mobile-profile-photo')
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target.id === 'mobile-profile-photo') {
      try { closeMobileMoreMenu(); } catch {}
    }
    openSharedMyProfileDialog().catch(error => {
      console.error('[Media] Perfil:', error);
      toast(error?.message || String(error), 'warning');
    });
  }, true);

  const baseEnterApplication = enterApplication;
  enterApplication = async function sharedMediaEnterApplication(...args) {
    const result = await baseEnterApplication.apply(this, args);
    if (state.cloudUser?.id && navigator.onLine) {
      setTimeout(() => syncPendingMedia().catch(() => {}), 600);
    }
    return result;
  };

  window.addEventListener('online', () => {
    if (state.cloudUser?.id) setTimeout(() => syncPendingMedia().catch(() => {}), 700);
  });

  // Android pode recriar a Activity enquanto câmera/galeria estão abertas.
  // A bridge nativa devolve o arquivo por este evento quando isso acontece.
  window.addEventListener('central-native-images-restored', async event => {
    const files = event.detail?.files || [];
    const context = event.detail?.context || {};
    const file = files[0];
    if (!file) return;
    try {
      if (context.kind === 'user-avatar') {
        await saveUserAvatar(file);
        toast('Foto do perfil atualizada.');
        return;
      }
      if (context.kind === 'asset-profile' && context.assetId) {
        await setAssetPhoto(context.assetId, file);
        if (context.subId && document.getElementById('asset-modal')) {
          await openAssetDetails(context.subId, context.assetId);
        } else if (state.screen === 'activity') {
          await renderActivity();
        }
        toast('Foto principal do ativo atualizada.');
      }
    } catch (error) {
      console.warn('[Media] Resultado restaurado da câmera:', error);
      toast(error?.message || String(error), 'warning');
    }
  });

  mediaCss();
  if (state.cloudUser?.id && navigator.onLine) {
    setTimeout(() => syncPendingMedia().catch(() => {}), 900);
  }
})();
