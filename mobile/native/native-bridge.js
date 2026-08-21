import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';
import { App } from '@capacitor/app';
import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/* CENTRAL_NATIVE_BRIDGE_MEDIA_V4
 * Bridge Android sem interceptação global de input[type=file].
 * A UI chama CentralNativeAndroid explicitamente via media-core.js.
 */

const isAndroidNative = () =>
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === 'android';

const PENDING_CAMERA_KEY = 'central_mobile_pending_camera_v4';
const MAX_NATIVE_FILE_BYTES = 24 * 1024 * 1024;
let activePickerPromise = null;

let runtimeCleanupPromise = Promise.resolve();

if (isAndroidNative()) {
  // Marcador síncrono: o app.js gerado para Android não registra Service Worker.
  // Isso evita que um APK novo continue executando JS antigo preservado pelo WebView.
  window.__CENTRAL_ANDROID_NATIVE__ = true;
  runtimeCleanupPromise = cleanupNativeWebRuntime();
  exposeNativeApi();
  installAndroidBackButton();
  installNativeFileSharing();
  installRestoredCameraHandler();
}

async function cleanupNativeWebRuntime() {
  // IndexedDB/localStorage NÃO são limpos: registros, rascunhos e sessão continuam preservados.
  // Removemos somente Service Workers e Cache Storage do shell web.
  try {
    if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistrations === 'function') {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister().catch(() => false)));
    }
  } catch (error) {
    console.warn('[Native Runtime V4] Falha ao remover Service Worker legado:', error);
  }

  try {
    if ('caches' in window && typeof caches.keys === 'function') {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith('central-static-'))
          .map(key => caches.delete(key).catch(() => false)),
      );
    }
  } catch (error) {
    console.warn('[Native Runtime V4] Falha ao limpar cache legado:', error);
  }
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function visibleOverlays() {
  const selectors = ['#mobile-more-modal', '.modal', '[role="dialog"]', '[aria-modal="true"]'];
  const seen = new Set();
  const overlays = [];
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      if (!seen.has(element) && isVisible(element)) {
        seen.add(element);
        overlays.push(element);
      }
    }
  }
  return overlays.sort((a, b) => {
    const za = Number.parseInt(getComputedStyle(a).zIndex || '0', 10) || 0;
    const zb = Number.parseInt(getComputedStyle(b).zIndex || '0', 10) || 0;
    return zb - za;
  });
}

function tryCloseTopOverlay() {
  const overlay = visibleOverlays()[0];
  if (!overlay) return false;
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', code: 'Escape', bubbles: true, cancelable: true,
  }));
  if (!isVisible(overlay)) return true;
  const closeButton = overlay.querySelector([
    '[data-close]', '[data-dismiss]', '[data-action="close"]',
    '.modal-close', '.close-modal', '.dialog-close',
    'button[aria-label="Fechar"]', 'button[aria-label*="fechar" i]',
    'button[title*="fechar" i]', 'button.close',
  ].join(','));
  if (closeButton instanceof HTMLElement) closeButton.click();
  return true;
}

function findMobileHomeButton() {
  const candidates = [...document.querySelectorAll('.mobile-nav button, .mobile-nav a')].filter(isVisible);
  return candidates.find((element) => /in[ií]cio/i.test(element.textContent || '')) || candidates[0] || null;
}

function mobileHomeIsActive() {
  const active = document.querySelector('.mobile-nav .active, .mobile-nav [aria-current="page"]');
  if (!active) return false;
  return /in[ií]cio/i.test(active.textContent || '');
}

async function installAndroidBackButton() {
  await App.addListener('backButton', async () => {
    if (tryCloseTopOverlay()) return;
    const homeButton = findMobileHomeButton();
    if (homeButton && !mobileHomeIsActive()) {
      homeButton.click();
      return;
    }
    await App.minimizeApp();
  });
}

function setPendingCamera(meta) {
  try { localStorage.setItem(PENDING_CAMERA_KEY, JSON.stringify(meta || {})); } catch {}
}

function getPendingCamera() {
  try { return JSON.parse(localStorage.getItem(PENDING_CAMERA_KEY) || 'null'); }
  catch { return null; }
}

function clearPendingCamera() {
  try { localStorage.removeItem(PENDING_CAMERA_KEY); } catch {}
}

async function mediaResultToFile(result, index = 0) {
  const source = result?.webPath || result?.uri;
  if (!source) throw new Error('A câmera não retornou um caminho de imagem utilizável.');
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Não foi possível ler a imagem (${response.status}).`);
  const blob = await response.blob();
  if (!blob.size) throw new Error('A câmera retornou uma imagem vazia.');
  if (blob.size > MAX_NATIVE_FILE_BYTES) {
    throw new Error('A imagem permaneceu acima de 24 MB após o redimensionamento nativo.');
  }
  const mime = blob.type || `image/${result?.metadata?.format || 'jpeg'}`;
  const subtype = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg').split(';')[0];
  return new File([blob], `foto-${Date.now()}-${index + 1}.${subtype}`, {
    type: mime,
    lastModified: Date.now(),
  });
}

async function runImagePicker({ multiple = false, title = 'Adicionar foto', context = null } = {}) {
  const action = await ActionSheet.showActions({
    title,
    options: [
      { title: 'Tirar foto' },
      { title: 'Escolher da galeria' },
      { title: 'Cancelar', style: ActionSheetButtonStyle.Cancel },
    ],
    cancelable: true,
  });

  if (action.canceled || action.index < 0 || action.index === 2) {
    clearPendingCamera();
    return [];
  }

  setPendingCamera({ context: context || null, multiple: Boolean(multiple) });

  try {
    let results = [];
    if (action.index === 0) {
      const photo = await Camera.takePhoto({
        quality: 85,
        targetWidth: 1600,
        targetHeight: 1600,
        correctOrientation: true,
        saveToGallery: false,
        includeMetadata: true,
      });
      results = photo ? [photo] : [];
    } else {
      const gallery = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo,
        allowMultipleSelection: Boolean(multiple),
        limit: multiple ? 12 : 1,
        quality: 85,
        targetWidth: 1600,
        targetHeight: 1600,
        correctOrientation: true,
        includeMetadata: true,
      });
      results = gallery?.results || [];
    }

    if (!results.length) {
      clearPendingCamera();
      return [];
    }
    const files = await Promise.all(results.map(mediaResultToFile));
    clearPendingCamera();
    return files;
  } catch (error) {
    clearPendingCamera();
    const message = String(error?.message || error || '');
    if (/cancel|cancelado|canceled/i.test(message)) return [];
    throw error;
  }
}

async function pickImages(options = {}) {
  if (!isAndroidNative()) return [];
  if (activePickerPromise) return activePickerPromise;
  activePickerPromise = runImagePicker(options);
  try { return await activePickerPromise; }
  finally { activePickerPromise = null; }
}

function exposeNativeApi() {
  window.CentralNativeAndroid = Object.freeze({
    version: '4.0.0',
    isAvailable: () => true,
    runtimeReady: () => runtimeCleanupPromise,
    pickImages: (options = {}) => pickImages(options),
    pickImage: async (options = {}) => (await pickImages({ ...options, multiple: false }))[0] || null,
    shareFile: (blob, filename) => shareBlob(blob, filename),
  });
}

function installRestoredCameraHandler() {
  App.addListener('appRestoredResult', async (event) => {
    if (event.pluginId !== 'Camera' || !event.success || !event.data) return;
    const pending = getPendingCamera();
    if (!pending) return;
    try {
      const results = Array.isArray(event.data?.results) ? event.data.results : [event.data];
      const files = await Promise.all(results.filter(Boolean).map(mediaResultToFile));
      if (!files.length) return;
      window.dispatchEvent(new CustomEvent('central-native-images-restored', {
        detail: { files, context: pending.context || null },
      }));
    } catch (error) {
      console.error('[Native Media V3] restored result:', error);
    } finally {
      clearPendingCamera();
      activePickerPromise = null;
    }
  });
}

const blobUrlMap = new Map();
const originalCreateObjectURL = URL.createObjectURL.bind(URL);
const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
const originalAnchorClick = HTMLAnchorElement.prototype.click;

function safeFilename(value) {
  return String(value || 'arquivo')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'arquivo';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
}

async function shareBlob(blob, filename) {
  const finalName = safeFilename(filename);
  const path = `exports/${Date.now()}-${finalName}`;
  const data = await blobToBase64(blob);
  await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({ title: finalName, files: [uri], dialogTitle: 'Compartilhar ou salvar arquivo' });
}

function installNativeFileSharing() {
  URL.createObjectURL = function createObjectURL(object) {
    const url = originalCreateObjectURL(object);
    if (object instanceof Blob) blobUrlMap.set(url, object);
    return url;
  };
  URL.revokeObjectURL = function revokeObjectURL(url) {
    window.setTimeout(() => {
      blobUrlMap.delete(String(url));
      originalRevokeObjectURL(url);
    }, 30000);
  };
  HTMLAnchorElement.prototype.click = function nativeAwareAnchorClick() {
    const href = String(this.href || '');
    const filename = String(this.download || '');
    const blob = filename && href.startsWith('blob:') ? blobUrlMap.get(href) : null;
    if (!blob) return originalAnchorClick.call(this);
    shareBlob(blob, filename).catch((error) => {
      console.error('Native file share:', error);
      originalAnchorClick.call(this);
    });
  };
}
