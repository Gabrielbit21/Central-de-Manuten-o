/*
 * Correções Android — Etapa 2.1
 *
 * 1) Foto principal do ATIVO:
 *    o app web usa um botão [data-profile-photo], não um <input type="file">.
 *    Por isso o bridge nativo genérico da Etapa 2 não via esse fluxo.
 *    Criamos um input temporário para reutilizar exatamente o seletor nativo
 *    "Tirar foto / Escolher da galeria" já instalado pelo native-bridge.js.
 *
 * 2) Foto/diálogo do PERFIL DO USUÁRIO:
 *    cachedUserAvatar() tenta baixar a imagem da nuvem antes de usar o cache.
 *    No Android, uma resposta lenta pode deixar o clique no avatar parecendo
 *    sem resposta e mostrar temporariamente apenas as iniciais.
 *    Aqui passamos a preferir o blob local e limitamos a espera quando não há cache.
 *
 * Este arquivo é carregado SOMENTE no bundle Android.
 */

(() => {
  const isAndroidNative =
    window.Capacitor?.isNativePlatform?.() === true &&
    window.Capacitor?.getPlatform?.() === 'android';

  if (!isAndroidNative) return;

  installFastUserAvatarCache();
  installAssetProfilePhotoPicker();

  // Atualiza o avatar do cabeçalho uma vez após instalar o cache rápido.
  queueMicrotask(() => {
    try {
      window.updateRoleChrome?.();
    } catch (error) {
      console.warn('[Android] Não foi possível atualizar o avatar inicial:', error);
    }
  });
})();

function currentIdentityUserId() {
  try {
    const identity = JSON.parse(
      localStorage.getItem('central_offline_identity') || 'null'
    );
    return identity?.user?.id || null;
  } catch {
    return null;
  }
}

function openCentralDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('central_manutencao_db');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCentralStore(storeName, key) {
  const db = await openCentralDb();
  try {
    return await new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(null);
        return;
      }
      const request = db
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function readLocalUserAvatar() {
  const userId = currentIdentityUserId();
  if (!userId) return null;
  const record = await readCentralStore('appSettings', `user-avatar:${userId}`);
  return record?.blob || null;
}

async function readLocalAssetPhoto(assetId) {
  const record = await readCentralStore('assetPhotos', assetId);
  return record?.blob || null;
}

function installFastUserAvatarCache() {
  const original = window.cachedUserAvatar;
  if (typeof original !== 'function' || original.__androidFastCache) return;

  const wrapped = async function androidCachedUserAvatar(...args) {
    // Primeiro usa o que já está no aparelho: abertura instantânea do perfil.
    try {
      const local = await readLocalUserAvatar();
      if (local) {
        // Atualiza a cópia local em segundo plano, sem bloquear a interface.
        Promise.resolve()
          .then(() => original.apply(this, args))
          .then((fresh) => {
            if (!fresh) return;
            const avatar = document.getElementById('user-avatar');
            if (!avatar) return;
            const url = URL.createObjectURL(fresh);
            avatar.innerHTML = `<img src="${url}" alt="Foto do perfil">`;
          })
          .catch((error) => {
            console.warn('[Android] Atualização do avatar em segundo plano:', error);
          });

        return local;
      }
    } catch (error) {
      console.warn('[Android] Leitura do avatar local:', error);
    }

    // Sem cache: não deixa um download lento travar a abertura do modal.
    const remote = Promise.resolve()
      .then(() => original.apply(this, args))
      .catch((error) => {
        console.warn('[Android] Download do avatar:', error);
        return null;
      });

    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve(null), 1800)
    );

    return Promise.race([remote, timeout]);
  };

  wrapped.__androidFastCache = true;
  window.cachedUserAvatar = wrapped;
}

function isAssetProfileTarget(target) {
  if (!(target instanceof Element)) return null;
  const frame = target.closest('[data-asset-photo-frame]');
  if (!frame) return null;
  const assetId =
    frame.getAttribute('data-asset-photo-frame') ||
    target.closest('[data-profile-photo]')?.getAttribute('data-profile-photo');
  return assetId ? { frame, assetId } : null;
}

let assetPhotoBusy = false;

function installAssetProfilePhotoPicker() {
  document.addEventListener(
    'click',
    async (event) => {
      const target = isAssetProfileTarget(event.target);
      if (!target || assetPhotoBusy) return;

      // O Android assume o fluxo inteiro deste clique.
      event.preventDefault();
      event.stopImmediatePropagation();

      assetPhotoBusy = true;
      try {
        const file = await requestOneNativeImage();
        if (!file) return;

        if (typeof window.setAssetPhoto !== 'function') {
          throw new Error('A função de foto principal do ativo não está disponível.');
        }

        let savedBlob = null;
        let cloudWarning = null;

        try {
          savedBlob = await window.setAssetPhoto(target.assetId, file);
        } catch (error) {
          /*
           * setAssetPhoto() grava primeiro no IndexedDB e depois tenta a nuvem.
           * Se apenas o upload falhar, preservamos a foto local e avisamos.
           */
          savedBlob = await readLocalAssetPhoto(target.assetId);
          if (!savedBlob) throw error;
          cloudWarning = error;
        }

        renderAssetProfileFrame(target.frame, target.assetId, savedBlob);

        if (cloudWarning) {
          console.warn('[Android] Foto do ativo salva localmente; nuvem pendente:', cloudWarning);
          if (typeof window.toast === 'function') {
            window.toast(
              'Foto salva no dispositivo. O envio à nuvem poderá ser repetido quando a conexão estiver estável.',
              'warning'
            );
          }
        } else if (typeof window.toast === 'function') {
          window.toast('Foto principal do ativo atualizada.');
        }
      } catch (error) {
        const message = String(
          error?.message || error || 'Não foi possível alterar a foto do ativo.'
        );
        if (!/cancel|cancelado|canceled/i.test(message)) {
          console.error('[Android] Foto principal do ativo:', error);
          alert(`Não foi possível alterar a foto do ativo.\n${message}`);
        }
      } finally {
        assetPhotoBusy = false;
      }
    },
    true
  );
}

function requestOneNativeImage() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.className = 'hidden';
    input.setAttribute('aria-hidden', 'true');

    let settled = false;

    const cleanup = () => {
      input.onchange = null;
      input.remove();
    };

    input.onchange = () => {
      if (settled) return;
      settled = true;
      const file = input.files?.[0] || null;
      cleanup();
      resolve(file);
    };

    /*
     * O native-bridge.js captura este click e apresenta:
     * Tirar foto / Escolher da galeria / Cancelar.
     */
    document.body.appendChild(input);

    try {
      input.click();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
      return;
    }

    /*
     * Se o usuário cancelar, o bridge nativo não dispara change.
     * Removemos o input temporário após um intervalo seguro.
     */
    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, 120000);
  });
}

function renderAssetProfileFrame(frame, assetId, blob) {
  if (!(frame instanceof HTMLElement) || !blob) return;

  const oldImage = frame.querySelector('img');
  if (oldImage?.src?.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(oldImage.src);
    } catch {}
  }

  const url = URL.createObjectURL(blob);
  frame.classList.add('has-photo');
  frame.innerHTML = `
    <img src="${url}" alt="Foto principal do ativo">
    <button
      type="button"
      class="asset-profile-action"
      data-profile-photo="${String(assetId).replaceAll('"', '&quot;')}"
    >Alterar imagem</button>
  `;
}
