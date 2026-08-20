import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';
import { App } from '@capacitor/app';
import { Camera } from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const isAndroidNative = () =>
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === 'android';

if (isAndroidNative()) {
  installAndroidBackButton();
  installNativeImagePicker();
  installNativeFileSharing();
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

const PENDING_CAMERA_INPUT_KEY = 'central_mobile_pending_camera_input';
let imagePickerBusy = false;

function ensureInputId(input) {
  if (input.id) return input.id;
  input.id = `central-native-file-${crypto.randomUUID?.() || Date.now()}`;
  return input.id;
}

function isImageInput(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'file') return false;
  const accept = String(input.accept || '').toLowerCase();
  return accept.includes('image/') || accept.includes('image/*');
}

async function mediaResultToFile(result, index = 0) {
  const source = result?.webPath || result?.uri;
  if (!source) throw new Error('A câmera não retornou um arquivo de imagem.');

  const response = await fetch(source);
  if (!response.ok) throw new Error(`Não foi possível ler a imagem (${response.status}).`);
  const blob = await response.blob();
  const mime = blob.type || `image/${result?.metadata?.format || 'jpeg'}`;
  const subtype = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg').split(';')[0];
  return new File([blob], `foto-${Date.now()}-${index + 1}.${subtype}`, {
    type: mime,
    lastModified: Date.now(),
  });
}

function dispatchFilesToInput(input, files) {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function chooseNativeImages(input) {
  const inputId = ensureInputId(input);
  localStorage.setItem(PENDING_CAMERA_INPUT_KEY, inputId);

  const result = await ActionSheet.showActions({
    title: 'Adicionar foto',
    options: [
      { title: 'Tirar foto' },
      { title: 'Escolher da galeria' },
      { title: 'Cancelar', style: ActionSheetButtonStyle.Cancel },
    ],
    cancelable: true,
  });

  if (result.canceled || result.index < 0 || result.index === 2) {
    localStorage.removeItem(PENDING_CAMERA_INPUT_KEY);
    return;
  }

  let mediaResults = [];
  if (result.index === 0) {
    mediaResults = [await Camera.takePhoto({
      quality: 88,
      saveToGallery: false,
      includeMetadata: true,
    })];
  } else {
    const gallery = await Camera.chooseFromGallery({
      quality: 88,
      allowMultipleSelection: Boolean(input.multiple),
      limit: input.multiple ? 12 : 1,
      includeMetadata: true,
    });
    mediaResults = gallery.results || [];
  }

  if (!mediaResults.length) {
    localStorage.removeItem(PENDING_CAMERA_INPUT_KEY);
    return;
  }

  const files = await Promise.all(mediaResults.map(mediaResultToFile));
  dispatchFilesToInput(input, files);
  localStorage.removeItem(PENDING_CAMERA_INPUT_KEY);
}

function installNativeImagePicker() {
  document.addEventListener('click', async (event) => {
    const input = event.target instanceof Element ? event.target.closest('input[type="file"]') : null;
    if (!isImageInput(input) || imagePickerBusy) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    imagePickerBusy = true;

    try {
      await chooseNativeImages(input);
    } catch (error) {
      const message = String(error?.message || error || 'Falha ao abrir câmera/galeria.');
      if (!/cancel|cancelado|canceled/i.test(message)) {
        console.error('Camera:', error);
        alert(`Não foi possível adicionar a foto.\n${message}`);
      }
      localStorage.removeItem(PENDING_CAMERA_INPUT_KEY);
    } finally {
      imagePickerBusy = false;
    }
  }, true);

  App.addListener('appRestoredResult', async (event) => {
    if (event.pluginId !== 'Camera' || !event.success || !event.data) return;
    const inputId = localStorage.getItem(PENDING_CAMERA_INPUT_KEY);
    if (!inputId) return;
    const input = document.getElementById(inputId);
    if (!isImageInput(input)) return;

    try {
      const results = Array.isArray(event.data?.results) ? event.data.results : [event.data];
      const files = await Promise.all(results.filter(Boolean).map(mediaResultToFile));
      if (files.length) dispatchFilesToInput(input, files);
    } catch (error) {
      console.error('Camera restored result:', error);
    } finally {
      localStorage.removeItem(PENDING_CAMERA_INPUT_KEY);
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

  await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Cache,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({
    title: finalName,
    files: [uri],
    dialogTitle: 'Compartilhar ou salvar arquivo',
  });
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
