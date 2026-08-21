/* CENTRAL_MEDIA_CORE_V2
 * Camada única de mídia da Central de Manutenção SE.
 *
 * Princípios:
 * - um único seletor por plataforma;
 * - nenhum listener global interceptando input[type=file];
 * - validação/compressão antes de tocar no cache do ativo;
 * - persistência local-first + fila idempotente para Supabase;
 * - recuperação automática de blobs locais inválidos;
 * - diagnóstico por estágio em vez de erro genérico.
 */
(() => {
  'use strict';

  if (globalThis.__CENTRAL_MEDIA_CORE_V2__) return;
  globalThis.__CENTRAL_MEDIA_CORE_V2__ = true;

  const ASSET_QUEUE_KIND = 'asset-profile-sync-v2';
  const AVATAR_QUEUE_KIND = 'user-avatar-sync-v2';
  const ASSET_QUEUE_PREFIX = 'media:v2:asset-profile:';
  const AVATAR_QUEUE_PREFIX = 'media:v2:user-avatar:';
  const MAX_SOURCE_BYTES = 24 * 1024 * 1024;
  const diagnostics = [];
  let pickerPromise = null;
  let assetPhotoBusy = false;

  function nowIso() { return new Date().toISOString(); }
  function ownerId() { return state?.cloudUser?.id || null; }

  function diagnostic(stage, status, detail = {}) {
    const entry = { at: nowIso(), stage, status, ...detail };
    diagnostics.push(entry);
    if (diagnostics.length > 40) diagnostics.shift();
    try { sessionStorage.setItem('central_media_v2_diagnostics', JSON.stringify(diagnostics.slice(-20))); } catch {}
    return entry;
  }

  function mediaError(stage, error, context = {}) {
    const original = error instanceof Error ? error : new Error(String(error || 'Falha de mídia.'));
    if (original.centralMediaStage) return original;
    const wrapped = new Error(`[${stage}] ${original.message || 'Falha de mídia.'}`);
    wrapped.name = original.name || 'MediaError';
    wrapped.stack = original.stack || wrapped.stack;
    wrapped.centralMediaStage = stage;
    wrapped.cause = original;
    diagnostic(stage, 'error', { message: original.message || String(original), context });
    console.error('[Media V2]', stage, context, original);
    return wrapped;
  }

  async function stage(name, fn, context = {}) {
    diagnostic(name, 'start', { context });
    try {
      const value = await fn();
      diagnostic(name, 'ok', { context });
      return value;
    } catch (error) {
      throw mediaError(name, error, context);
    }
  }

  function showMediaError(error) {
    const message = String(error?.message || error || 'Falha de mídia.');
    if (!/cancel|cancelado|canceled/i.test(message)) toast(message, 'warning');
  }

  function mediaCss() {
    if (document.querySelector('link[data-central-media-core]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './assets/css/media-core.css';
    link.dataset.centralMediaCore = '2';
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
      const cleanup = () => {
        window.removeEventListener('focus', onFocus, true);
        input.remove();
      };
      const finish = (files = []) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(files);
      };
      const onFocus = () => setTimeout(() => finish([...(input.files || [])]), 250);

      input.addEventListener('change', () => finish([...(input.files || [])]), { once: true });
      input.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Não foi possível abrir o seletor de imagens.'));
      }, { once: true });
      window.addEventListener('focus', onFocus, true);
      document.body.appendChild(input);
      try { input.click(); }
      catch (error) { settled = true; cleanup(); reject(error); }
    });
  }

  async function pickImages(options = {}) {
    if (pickerPromise) return pickerPromise;
    pickerPromise = stage('picker', async () => {
      const native = globalThis.CentralNativeAndroid;
      if (native?.isAvailable?.() && typeof native.pickImages === 'function') {
        return native.pickImages(options);
      }
      return browserPickImages(options);
    }, { multiple: Boolean(options.multiple), kind: options.context?.kind || 'generic' });

    try { return await pickerPromise; }
    finally { pickerPromise = null; }
  }

  async function pickImage(options = {}) {
    const native = globalThis.CentralNativeAndroid;
    if (native?.isAvailable?.() && typeof native.pickImage === 'function') {
      return stage('picker', () => native.pickImage({ ...options, multiple: false }), {
        multiple: false,
        kind: options.context?.kind || 'generic',
      });
    }
    const files = await pickImages({ ...options, multiple: false });
    return files?.[0] || null;
  }

  async function validateImageBlob(blob) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error('Arquivo de imagem vazio ou inválido.');
    if (blob.size > MAX_SOURCE_BYTES) throw new Error('Imagem acima do limite de processamento de 24 MB.');
    const bitmap = await createImageBitmap(blob);
    try {
      if (!bitmap.width || !bitmap.height) throw new Error('A imagem não possui dimensões válidas.');
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close?.();
    }
  }

  async function compressValidated(source, max = 1000, quality = .82, context = {}) {
    await stage('decode-source', () => validateImageBlob(source), context);
    const blob = await stage('compress', () => compressImage(source, max, quality), context);
    if (!blob) throw mediaError('compress', new Error('Falha ao gerar JPEG comprimido.'), context);
    await stage('validate-output', () => validateImageBlob(blob), context);
    return blob;
  }

  function assetQueueKey(uid, assetId) { return `${ASSET_QUEUE_PREFIX}${uid}:${assetId}`; }
  function avatarQueueKey(uid) { return `${AVATAR_QUEUE_PREFIX}${uid}`; }

  async function queueAssetProfile(assetId, blob) {
    const uid = ownerId();
    if (!uid || !assetId || !blob) return null;
    const key = assetQueueKey(uid, assetId);
    const previous = await idbGet('appSettings', key).catch(() => null);
    const entry = {
      key, kind: ASSET_QUEUE_KIND, ownerId: uid, assetId, blob,
      status: 'pendente', attempts: previous?.attempts || 0, lastError: '',
      createdAt: previous?.createdAt || nowIso(), updatedAt: nowIso(),
    };
    await idbPut('appSettings', entry);
    return entry;
  }

  async function queueAvatar(blob, action = 'set', oldPath = null) {
    const uid = ownerId();
    if (!uid) return null;
    const key = avatarQueueKey(uid);
    const previous = await idbGet('appSettings', key).catch(() => null);
    const entry = {
      key, kind: AVATAR_QUEUE_KIND, ownerId: uid, action,
      blob: action === 'set' ? blob : null,
      oldPath: oldPath || previous?.oldPath || state.cloudProfile?.avatar_path || null,
      status: 'pendente', attempts: previous?.attempts || 0, lastError: '',
      createdAt: previous?.createdAt || nowIso(), updatedAt: nowIso(),
    };
    await idbPut('appSettings', entry);
    return entry;
  }

  function updateAssetPath(assetId, path) {
    for (const sub of Object.values(DATA.equipment || {})) {
      for (const group of ['eletronicos', 'reles', 'patio']) {
        const asset = (sub?.[group] || []).find(item => item.id === assetId);
        if (asset) asset.profilePhotoPath = path;
      }
    }
  }

  async function syncAssetEntry(entry) {
    if (!entry || entry.kind !== ASSET_QUEUE_KIND || !navigator.onLine || !state.cloudUser?.id) return false;
    if (entry.ownerId !== state.cloudUser.id) return false;
    entry.attempts = (entry.attempts || 0) + 1;
    entry.updatedAt = nowIso();
    await idbPut('appSettings', entry);
    const path = `${state.cloudUser.id}/${entry.assetId}/profile.jpg`;
    try {
      await stage('cloud-asset-upload', async () => {
        const { error } = await cloudClient.storage.from('asset-profile-photos')
          .upload(path, entry.blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }, { assetId: entry.assetId });
      await stage('cloud-asset-rpc', async () => {
        const { error } = await cloudClient.rpc('set_asset_profile_photo', {
          p_asset_id: entry.assetId,
          p_storage_path: path,
        });
        if (error) throw error;
      }, { assetId: entry.assetId });
      updateAssetPath(entry.assetId, path);
      await idbDelete('appSettings', entry.key);
      return true;
    } catch (error) {
      entry.status = 'erro';
      entry.lastError = String(error?.message || error);
      entry.updatedAt = nowIso();
      await idbPut('appSettings', entry);
      throw error;
    }
  }

  async function saveAssetProfilePhoto(assetId, source) {
    if (!assetId || !source) return null;
    const context = { assetId };
    const blob = await compressValidated(source, 1000, .82, context);
    // Só substitui o cache depois que o JPEG final foi decodificado e validado.
    await stage('local-asset-commit', () => idbPut('assetPhotos', {
      assetId, blob, updatedAt: nowIso(),
    }), context);
    const entry = await queueAssetProfile(assetId, blob);
    if (entry && navigator.onLine && state.cloudUser?.id) {
      try { await syncAssetEntry(entry); }
      catch (error) { console.warn('[Media V2] Foto local válida; sincronização ficou pendente.', error); }
    }
    return blob;
  }

  async function pendingEntries(kind) {
    const uid = ownerId();
    if (!uid) return [];
    const rows = await idbAll('appSettings');
    return rows.filter(row => row?.kind === kind && row.ownerId === uid);
  }

  async function syncPendingAssetProfiles() {
    if (!navigator.onLine || !state.cloudUser?.id) return 0;
    let processed = 0;
    for (const entry of await pendingEntries(ASSET_QUEUE_KIND)) {
      try { if (await syncAssetEntry(entry)) processed += 1; }
      catch (error) { console.warn('[Media V2] Foto de ativo pendente:', error); }
    }
    return processed;
  }

  const basePhotoForAsset = photoForAsset;
  photoForAsset = async function safePhotoForAsset(assetId) {
    const local = await idbGet('assetPhotos', assetId).catch(() => null);
    if (local?.blob) {
      try {
        await validateImageBlob(local.blob);
        return local.blob;
      } catch (error) {
        console.warn('[Media V2] Cache local inválido removido do ativo:', assetId, error);
        diagnostic('repair-asset-cache', 'removed', { assetId, message: String(error?.message || error) });
        await idbDelete('assetPhotos', assetId).catch(() => {});
      }
    }
    const fallback = await basePhotoForAsset(assetId);
    if (!fallback) return null;
    try {
      await validateImageBlob(fallback);
      return fallback;
    } catch (error) {
      await idbDelete('assetPhotos', assetId).catch(() => {});
      diagnostic('repair-asset-cache', 'remote-invalid', { assetId, message: String(error?.message || error) });
      return null;
    }
  };

  async function localAvatar() {
    if (!state.cloudUser?.id) return null;
    const row = await idbGet('appSettings', `user-avatar:${state.cloudUser.id}`).catch(() => null);
    if (!row?.blob) return null;
    try { await validateImageBlob(row.blob); return row.blob; }
    catch {
      await idbDelete('appSettings', `user-avatar:${state.cloudUser.id}`).catch(() => {});
      return null;
    }
  }

  async function syncAvatarEntry(entry) {
    if (!entry || entry.kind !== AVATAR_QUEUE_KIND || !navigator.onLine || !state.cloudUser?.id) return false;
    if (entry.ownerId !== state.cloudUser.id) return false;
    entry.attempts = (entry.attempts || 0) + 1;
    entry.updatedAt = nowIso();
    await idbPut('appSettings', entry);
    try {
      if (entry.action === 'remove') {
        if (entry.oldPath) {
          const { error } = await cloudClient.storage.from('user-profile-photos').remove([entry.oldPath]);
          if (error) console.warn('[Media V2] Remoção do avatar anterior:', error);
        }
        const { error } = await cloudClient.rpc('set_own_profile_avatar', { p_storage_path: null });
        if (error) throw error;
        state.cloudProfile = { ...(state.cloudProfile || {}), avatar_path: null };
      } else {
        const path = `${state.cloudUser.id}/avatar.jpg`;
        const { error: uploadError } = await cloudClient.storage.from('user-profile-photos')
          .upload(path, entry.blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        const { error: rpcError } = await cloudClient.rpc('set_own_profile_avatar', { p_storage_path: path });
        if (rpcError) throw rpcError;
        state.cloudProfile = { ...(state.cloudProfile || {}), avatar_path: path };
      }
      storeIdentity(state.cloudUser, state.cloudProfile);
      await idbDelete('appSettings', entry.key);
      return true;
    } catch (error) {
      entry.status = 'erro';
      entry.lastError = String(error?.message || error);
      entry.updatedAt = nowIso();
      await idbPut('appSettings', entry);
      throw mediaError('cloud-avatar', error);
    }
  }

  async function saveAvatar(source) {
    if (!state.cloudUser?.id) throw new Error('Sessão do usuário indisponível. Entre novamente.');
    const blob = await compressValidated(source, 700, .85, { kind: 'user-avatar' });
    const path = `${state.cloudUser.id}/avatar.jpg`;
    await stage('local-avatar-commit', () => idbPut('appSettings', {
      key: `user-avatar:${state.cloudUser.id}`, blob, path, updatedAt: nowIso(),
    }));
    state.cloudProfile = { ...(state.cloudProfile || {}), avatar_path: path };
    storeIdentity(state.cloudUser, state.cloudProfile);
    const entry = await queueAvatar(blob, 'set');
    if (entry && navigator.onLine) {
      try { await syncAvatarEntry(entry); }
      catch (error) { console.warn('[Media V2] Avatar local válido; sincronização pendente.', error); }
    }
    updateRoleChrome();
    return blob;
  }

  async function removeAvatar() {
    if (!state.cloudUser?.id) throw new Error('Sessão do usuário indisponível. Entre novamente.');
    const oldPath = state.cloudProfile?.avatar_path || null;
    await idbDelete('appSettings', `user-avatar:${state.cloudUser.id}`);
    state.cloudProfile = { ...(state.cloudProfile || {}), avatar_path: null };
    storeIdentity(state.cloudUser, state.cloudProfile);
    const entry = await queueAvatar(null, 'remove', oldPath);
    if (entry && navigator.onLine) {
      try { await syncAvatarEntry(entry); }
      catch (error) { console.warn('[Media V2] Remoção do avatar pendente.', error); }
    }
    updateRoleChrome();
  }

  async function syncPendingAvatars() {
    if (!navigator.onLine || !state.cloudUser?.id) return 0;
    let processed = 0;
    for (const entry of await pendingEntries(AVATAR_QUEUE_KIND)) {
      try { if (await syncAvatarEntry(entry)) processed += 1; }
      catch (error) { console.warn('[Media V2] Avatar pendente:', error); }
    }
    return processed;
  }

  const baseCachedUserAvatar = cachedUserAvatar;
  cachedUserAvatar = async function safeCachedUserAvatar() {
    const local = await localAvatar();
    if (local) return local;
    if (!navigator.onLine) return null;
    try {
      const remote = await Promise.race([
        Promise.resolve(baseCachedUserAvatar()).catch(() => null),
        new Promise(resolve => setTimeout(() => resolve(null), 900)),
      ]);
      if (!remote) return null;
      await validateImageBlob(remote);
      return remote;
    } catch { return null; }
  };

  async function syncPending() {
    if (!navigator.onLine || !state.cloudUser?.id) return { assetProfiles: 0, avatars: 0 };
    const [assetProfiles, avatars] = await Promise.all([
      syncPendingAssetProfiles(), syncPendingAvatars(),
    ]);
    return { assetProfiles, avatars };
  }

  async function chooseAssetProfilePhoto(assetId, options = {}) {
    if (!assetId || assetPhotoBusy) return null;
    assetPhotoBusy = true;
    const context = { kind: 'asset-profile', assetId, ...(options.context || {}) };
    try {
      const file = await pickImage({ title: options.title || 'Foto principal do ativo', context });
      if (!file) return null;
      const blob = await saveAssetProfilePhoto(assetId, file);
      if (typeof options.afterSave === 'function') await options.afterSave(blob);
      toast(navigator.onLine
        ? 'Foto principal do ativo atualizada.'
        : 'Foto principal salva no dispositivo e aguardando sincronização.',
        navigator.onLine ? 'success' : 'notice');
      return blob;
    } catch (error) {
      showMediaError(error);
      return null;
    } finally { assetPhotoBusy = false; }
  }

  globalThis.chooseProfilePhoto = async function chooseProfilePhotoV2(assetId) {
    return chooseAssetProfilePhoto(assetId, {
      context: { kind: 'asset-profile', assetId },
      afterSave: async () => { if (state.screen === 'activity') await renderActivity(); },
    });
  };

  // Evita que persistPendingPhotos grave uma foto principal sem validação.
  const basePersistPendingPhotos = persistPendingPhotos;
  persistPendingPhotos = async function persistPendingPhotosV2(recordId, sel, createdAt) {
    const selected = (state.pendingPhotos || [])
      .filter(photo => photo?.asProfile && photo.assetId && photo.assetId !== 'all')
      .map(photo => ({ photo, assetId: photo.assetId }));
    const originalFlags = (state.pendingPhotos || []).map(photo => Boolean(photo.asProfile));
    for (const photo of state.pendingPhotos || []) photo.asProfile = false;
    let result;
    try { result = await basePersistPendingPhotos(recordId, sel, createdAt); }
    finally { (state.pendingPhotos || []).forEach((photo, i) => { photo.asProfile = originalFlags[i] || false; }); }
    for (const item of selected) {
      try { await saveAssetProfilePhoto(item.assetId, item.photo.blob); }
      catch (error) { console.warn('[Media V2] Promoção de foto da manutenção:', error); }
    }
    return result;
  };

  function bindActivityMedia() {
    document.querySelectorAll('[data-profile-photo]').forEach(button => {
      button.onclick = () => chooseAssetProfilePhoto(button.dataset.profilePhoto, {
        context: { kind: 'asset-profile', assetId: button.dataset.profilePhoto },
        afterSave: async () => { if (state.screen === 'activity') await renderActivity(); },
      });
    });
    const button = document.getElementById('pick-photos');
    if (button) {
      button.onclick = async event => {
        event.preventDefault();
        try {
          const files = await pickImages({
            multiple: true,
            title: 'Adicionar fotos',
            context: { kind: 'maintenance-photos' },
          });
          if (files?.length) await addPendingPhotos(files);
        } catch (error) { showMediaError(error); }
      };
    }
  }

  const baseRenderActivity = renderActivity;
  renderActivity = async function renderActivityV2(...args) {
    const result = await baseRenderActivity.apply(this, args);
    bindActivityMedia();
    return result;
  };

  function attachAssetAction(subId, assetId) {
    if (state.role !== 'admin') return;
    const modal = document.getElementById('asset-modal');
    const photoHost = modal?.querySelector('.asset-modal-photo');
    if (!photoHost || photoHost.querySelector('.central-media-asset-action')) return;
    photoHost.classList.add('central-media-photo-host');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'central-media-asset-action';
    button.innerHTML = '<span data-icon="camera"></span><span>Adicionar / alterar foto</span>';
    photoHost.appendChild(button);
    hydrateIcons(button);
    button.onclick = async event => {
      event.preventDefault();
      event.stopPropagation();
      await chooseAssetProfilePhoto(assetId, {
        title: 'Foto do ativo',
        context: { kind: 'asset-profile', assetId, subId },
        afterSave: async () => {
          // Chama a implementação base diretamente para não reentrar no wrapper.
          await baseOpenAssetDetails(subId, assetId);
          attachAssetAction(subId, assetId);
        },
      });
    };
  }

  const baseOpenAssetDetails = openAssetDetails;
  openAssetDetails = async function openAssetDetailsV2(subId, assetId) {
    try {
      const result = await baseOpenAssetDetails(subId, assetId);
      attachAssetAction(subId, assetId);
      return result;
    } catch (error) {
      console.error('[Media V2] Abertura de ativo:', assetId, error);
      throw error;
    }
  };

  function profileIdentity() {
    const u = currentUser();
    const p = state.cloudProfile || {};
    const email = state.cloudUser?.email || '';
    const rawName = (p.display_name || '').trim();
    const primaryName = rawName && rawName.toLowerCase() !== email.toLowerCase() && !rawName.includes('@')
      ? rawName : (email || 'Usuário');
    const secondary = primaryName === email ? u.label : `${email}${email ? ' · ' : ''}${u.label}`;
    return { u, p, primaryName, secondary };
  }

  async function openProfilePhotoDialogV2() {
    const u = currentUser();
    const root = document.getElementById('modal-root');
    if (!root) return;
    const local = await localAvatar();
    root.innerHTML = `<div class="modal" id="profile-photo-modal"><div class="modal-card profile-photo-dialog"><button class="modal-close" id="close-profile-photo" type="button" aria-label="Fechar"><span data-icon="x"></span></button><h2>Foto do perfil</h2><p class="muted">No celular, escolha câmera ou galeria. No computador, selecione uma imagem do dispositivo.</p><div class="profile-photo-preview" id="profile-photo-preview">${local ? `<img src="${blobUrl(local)}" alt="Foto atual">` : esc(u.initials)}</div><div class="profile-photo-actions"><button class="btn secondary" id="choose-profile-photo" type="button"><span data-icon="camera"></span>${local ? 'Alterar foto' : 'Adicionar foto'}</button>${(local || state.cloudProfile?.avatar_path) ? '<button class="btn ghost" id="remove-profile-photo" type="button"><span data-icon="trash"></span>Remover foto</button>' : ''}</div></div></div>`;
    hydrateIcons(root);
    const close = () => { root.innerHTML = ''; };
    document.getElementById('close-profile-photo').onclick = close;
    document.getElementById('profile-photo-modal').onclick = event => { if (event.target === event.currentTarget) event.stopPropagation(); };
    document.getElementById('choose-profile-photo').onclick = async () => {
      try {
        const file = await pickImage({ title: 'Foto do perfil', context: { kind: 'user-avatar' } });
        if (!file) return;
        await saveAvatar(file);
        close();
        toast(navigator.onLine ? 'Foto do perfil atualizada.' : 'Foto salva localmente e aguardando sincronização.', navigator.onLine ? 'success' : 'notice');
      } catch (error) { showMediaError(error); }
    };
    document.getElementById('remove-profile-photo')?.addEventListener('click', async () => {
      if (!confirm('Remover a foto do perfil?')) return;
      try { await removeAvatar(); close(); toast('Foto do perfil removida.'); }
      catch (error) { showMediaError(error); }
    });
  }

  async function openMyProfileDialogV2() {
    const { u, p, primaryName, secondary } = profileIdentity();
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = `<div class="modal" id="my-profile-modal"><div class="modal-card profile-settings-dialog has-sticky-close"><button class="modal-close profile-standard-close" id="close-my-profile" type="button" aria-label="Fechar"><span data-icon="x"></span></button><div class="whatsapp-profile-card"><div class="whatsapp-profile-head"><button class="whatsapp-profile-avatar profile-avatar-edit" id="profile-avatar-edit" type="button" aria-label="Alterar foto do perfil" title="Alterar foto do perfil">${esc(u.initials)}<span class="profile-avatar-camera" data-icon="camera"></span></button><div class="profile-identity"><strong>${esc(primaryName)}</strong><small>${esc(secondary)}</small></div></div><form id="my-profile-form" class="auth-form"><div class="auth-field"><label>Telefone / WhatsApp de contato</label><input name="whatsapp_number" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(32) 99999-9999" value="${esc(p.whatsapp_number || '')}"></div><div><label class="profile-section-label">Preferências de notificações</label>${notificationPreferencesMarkup(p, state.role)}</div><div class="push-device-card refined-push-device"><div><strong>Este dispositivo</strong><small class="push-device-intro">Gerencie as notificações deste computador ou celular.</small></div><button class="btn secondary push-device-toggle" id="push-device-toggle" type="button">Verificando…</button><p class="push-help" id="push-device-help"></p></div><div class="profile-save-row"><button class="btn primary" type="submit">Salvar preferências</button></div></form></div></div></div>`;
    hydrateIcons(root);
    const close = () => { root.innerHTML = ''; };
    document.getElementById('close-my-profile').onclick = close;
    document.getElementById('my-profile-modal').onclick = event => { if (event.target === event.currentTarget) event.stopPropagation(); };
    document.getElementById('profile-avatar-edit').onclick = () => openProfilePhotoDialogV2();
    const pushButton = document.getElementById('push-device-toggle');
    pushButton.onclick = async event => {
      const button = event.currentTarget;
      const active = button.dataset.active === 'true';
      button.disabled = true;
      button.textContent = active ? 'Desativando…' : 'Ativando…';
      try {
        if (active) { await deactivatePushOnThisDevice(); toast('Notificações desativadas neste dispositivo.'); }
        else { await activatePushOnThisDevice(); toast('Notificações ativadas neste dispositivo.'); }
      } catch (error) { toast(error?.message || String(error), 'warning'); }
      finally { Promise.resolve().then(() => refreshPushDeviceCard()).catch(() => {}); }
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
      } catch (error) { toast(error?.message || String(error), 'warning'); }
      finally { setAuthBusy(form, false); }
    };
    localAvatar().then(blob => {
      if (!blob) return;
      const avatar = document.getElementById('profile-avatar-edit');
      if (!avatar) return;
      avatar.innerHTML = `<img src="${blobUrl(blob)}" alt="Foto do perfil"><span class="profile-avatar-camera" data-icon="camera"></span>`;
      hydrateIcons(avatar);
    }).catch(() => {});
    Promise.resolve().then(() => refreshPushDeviceCard()).catch(() => {});
  }

  openProfilePhotoDialog = openProfilePhotoDialogV2;
  openMyProfileDialog = openMyProfileDialogV2;

  // O avatar desktop tinha um addEventListener com a função antiga capturada.
  // Clonamos uma única vez para remover somente esse listener legado.
  function installDesktopProfileOpener() {
    const old = document.getElementById('user-avatar');
    if (!old || old.dataset.centralMediaV2 === '1') return;
    const clone = old.cloneNode(true);
    clone.dataset.centralMediaV2 = '1';
    old.replaceWith(clone);
    clone.addEventListener('click', () => openMyProfileDialogV2());
  }

  const baseEnterApplication = enterApplication;
  enterApplication = async function enterApplicationV2(...args) {
    const result = await baseEnterApplication.apply(this, args);
    installDesktopProfileOpener();
    if (state.cloudUser?.id && navigator.onLine) setTimeout(() => syncPending().catch(() => {}), 700);
    return result;
  };

  window.addEventListener('online', () => {
    if (state.cloudUser?.id) setTimeout(() => syncPending().catch(() => {}), 800);
  });

  window.addEventListener('central-native-images-restored', async event => {
    const files = event.detail?.files || [];
    const context = event.detail?.context || {};
    try {
      if (context.kind === 'maintenance-photos') {
        if (files.length) await addPendingPhotos(files);
        return;
      }
      const file = files[0];
      if (!file) return;
      if (context.kind === 'user-avatar') {
        await saveAvatar(file);
        toast('Foto do perfil atualizada.');
        return;
      }
      if (context.kind === 'asset-profile' && context.assetId) {
        await saveAssetProfilePhoto(context.assetId, file);
        if (context.subId && document.getElementById('asset-modal')) {
          await baseOpenAssetDetails(context.subId, context.assetId);
          attachAssetAction(context.subId, context.assetId);
        } else if (state.screen === 'activity') {
          await renderActivity();
        }
        toast('Foto principal do ativo atualizada.');
      }
    } catch (error) { showMediaError(error); }
  });

  globalThis.CentralMedia = Object.freeze({
    version: '2.0.0',
    pickImages,
    pickImage,
    saveAssetProfilePhoto,
    saveAvatar,
    syncPending,
    getDiagnostics: () => diagnostics.slice(),
  });

  mediaCss();
  installDesktopProfileOpener();
  if (state.cloudUser?.id && navigator.onLine) setTimeout(() => syncPending().catch(() => {}), 1000);
})();
