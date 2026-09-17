/* Central de Manutenção SE — v2.0.9
 * Ajustes focados:
 * - Comunicação de SE acessada pela própria Subestação;
 * - picker de foto principal idêntico ao sistema consolidado da Subestação.
 * As traduções e pré-preenchimentos ficam na camada-base v205 corrigida.
 */
(() => {
  'use strict';
  if (globalThis.__CENTRAL_V209__) return;
  globalThis.__CENTRAL_V209__ = true;

  const V209_VERSION = '2.0.9';
  let enhancing = false;

  const safe = value => String(value ?? '');
  const norm209 = value => {
    try { return normalize(safe(value)); }
    catch (_) {
      return safe(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    }
  };

  function frontAssetById(id) {
    return state?.frontAssetMap?.get?.(id)
      || (state?.frontAssets || []).find(asset => asset.id === id)
      || null;
  }

  function telecomSiteForSubstation(substationId) {
    return (state?.frontAssets || []).find(asset =>
      asset.active !== false
      && asset.family_code === 'telecom_site'
      && safe(asset.substation_code) === safe(substationId)
    ) || null;
  }

  function telecomChildrenForSubstation(substationId) {
    const site = telecomSiteForSubstation(substationId);
    if (!site) return [];
    return (state?.frontAssets || [])
      .filter(asset => asset.active !== false && asset.parent_id === site.id)
      .sort((a, b) => {
        const left = `${familyLabel(a.family_code)} ${a.display_name || ''} ${a.model || ''}`;
        const right = `${familyLabel(b.family_code)} ${b.display_name || ''} ${b.model || ''}`;
        return left.localeCompare(right, 'pt-BR');
      });
  }

  function familyLabel(code) {
    return ({
      radio_voice_vhf: 'Rádio de Voz VHF',
      radio_data_uhf: 'Rádio de Dados UHF',
      radio_microwave: 'Rádio Micro-ondas',
      converter_125_12: 'Conversor 125/12 Vcc',
      converter_125_12_detailed: 'Conversor 125/12 Vcc',
      converter_125_48: 'Conversor 125/48 Vcc',
      router: 'Roteador / Switch',
      claroty: 'Claroty',
    })[code] || safe(code).replace(/_/g, ' ');
  }

  function communicationAssetTitle(asset) {
    return asset.display_name
      || [familyLabel(asset.family_code), asset.model].filter(Boolean).join(' — ')
      || familyLabel(asset.family_code);
  }

  /* ------------------------------------------------------------------
   * Comunicação dentro da seleção da Subestação.
   * Os registros continuam canônicos em front_assets; somente a navegação
   * passa a ser feita pela Subestação.
   * ------------------------------------------------------------------ */
  function updateSelectionDockForCommunication(asset) {
    const count = document.getElementById('sel-count');
    const preview = document.getElementById('sel-preview');
    const button = document.getElementById('continue');
    if (count) count.textContent = asset ? '1' : String(state.selected?.size || 0);
    if (preview) {
      preview.textContent = asset
        ? communicationAssetTitle(asset)
        : (state.selected?.size ? 'Ativos selecionados para continuar' : 'Selecione um ativo para continuar');
    }
    if (button) button.disabled = asset ? false : !(state.selected?.size);
  }

  function clearCommunicationSelection() {
    state.v209CommunicationAssetId = null;
    document.querySelectorAll('.v209-comm-check').forEach(input => { input.checked = false; });
  }

  function bindLegacySelectionClearsCommunication() {
    document.querySelectorAll('.item-check:not(.v209-comm-check)').forEach(input => {
      if (input.dataset.v209LegacyBound === '1') return;
      input.dataset.v209LegacyBound = '1';
      input.addEventListener('change', () => {
        if (!input.checked) return;
        clearCommunicationSelection();
      });
    });
    document.querySelectorAll('.group-check').forEach(input => {
      if (input.dataset.v209LegacyBound === '1') return;
      input.dataset.v209LegacyBound = '1';
      input.addEventListener('change', () => {
        if (!input.checked) return;
        clearCommunicationSelection();
      });
    });
  }

  function renderCommunicationGroup(query = '') {
    if (state?.screen !== 'equipment' || !state?.sub) return;
    const host = document.getElementById('groups');
    if (!host) return;

    host.querySelector('.v209-communication-group')?.remove();

    const q = norm209(query);
    const items = telecomChildrenForSubstation(state.sub).filter(asset => {
      if (!q) return true;
      return norm209([
        communicationAssetTitle(asset),
        familyLabel(asset.family_code),
        asset.manufacturer,
        asset.model,
        asset.serial_number,
      ].filter(Boolean).join(' ')).includes(q);
    });
    if (!items.length) {
      bindLegacySelectionClearsCommunication();
      return;
    }

    const section = document.createElement('section');
    section.className = 'group v209-communication-group';
    section.innerHTML = `
      <div class="group-head v209-communication-head">
        <span class="v209-communication-icon" data-icon="wifi"></span>
        <strong>Comunicação</strong>
        <span>${items.length} item(ns)</span>
      </div>
      <div class="equip-list">
        ${items.map(asset => `
          <label class="equip v209-communication-equip">
            <input class="check v209-comm-check" type="checkbox"
                   value="${esc(asset.id)}"
                   ${state.v209CommunicationAssetId === asset.id ? 'checked' : ''}>
            <span>
              <strong>${esc(communicationAssetTitle(asset))}</strong>
              <small>${esc([
                familyLabel(asset.family_code),
                asset.manufacturer,
                asset.model,
              ].filter(Boolean).join(' · '))}</small>
            </span>
          </label>
        `).join('')}
      </div>`;

    host.appendChild(section);
    hydrateIcons?.(section);

    section.querySelectorAll('.v209-comm-check').forEach(input => {
      input.onchange = () => {
        if (!input.checked) {
          if (state.v209CommunicationAssetId === input.value) {
            state.v209CommunicationAssetId = null;
          }
          updateSelectionDockForCommunication(null);
          return;
        }

        /* Equipamentos de Comunicação usam o fluxo front_assets.
           Para não misturar FKs diferentes no mesmo relatório, a seleção
           desta categoria é individual. */
        state.selected?.clear?.();
        document.querySelectorAll('.item-check:not(.v209-comm-check),.group-check')
          .forEach(other => { other.checked = false; });

        section.querySelectorAll('.v209-comm-check').forEach(other => {
          if (other !== input) other.checked = false;
        });

        state.v209CommunicationAssetId = input.value;
        updateSelectionDockForCommunication(frontAssetById(input.value));
      };
    });

    bindLegacySelectionClearsCommunication();
  }

  function installCommunicationSelection() {
    if (state?.screen !== 'equipment' || !state?.sub) return;
    const search = document.getElementById('eq-search');
    const continueButton = document.getElementById('continue');
    if (!search || !continueButton) return;

    if (!document.querySelector('.v209-communication-group')) {
  renderCommunicationGroup(search.value);
}

    if (search.dataset.v209CommSearch !== '1') {
      search.dataset.v209CommSearch = '1';
      const original = search.oninput;
      search.oninput = event => {
        original?.call(search, event);
        requestAnimationFrame(() => renderCommunicationGroup(search.value));
      };
    }

    if (continueButton.dataset.v209CommContinue !== '1') {
      continueButton.dataset.v209CommContinue = '1';
      const original = continueButton.onclick;
      continueButton.onclick = () => {
        const assetId = state.v209CommunicationAssetId;
        if (!assetId) return original?.();

        const asset = frontAssetById(assetId);
        if (!asset) {
          toast('O equipamento de Comunicação não foi encontrado na base local.', 'warning');
          return;
        }

        const substationId = state.sub;
        state.v209EmbeddedTelecomSubstation = substationId;
        state.v205TelecomSubstation = substationId;
        state.v209CommunicationAssetId = null;
        state.selected?.clear?.();

        const opened = globalThis.CENTRAL_V205_OPEN_FRONT_ASSET?.(asset.id, {
          front: 'telecom',
          substationId,
          embeddedSubstation: substationId,
        });
        if (!opened) toast('Não foi possível abrir o formulário deste equipamento.', 'warning');
      };
    }
  }

  const baseRenderEquipment209 = globalThis.renderEquipment;
  if (typeof baseRenderEquipment209 === 'function') {
    globalThis.renderEquipment = async function renderEquipmentV209(...args) {
      state.v209CommunicationAssetId = null;
      const result = await baseRenderEquipment209(...args);
      requestAnimationFrame(installCommunicationSelection);
      return result;
    };
  }

  /* ------------------------------------------------------------------
   * Voltar para a SE quando o equipamento de Comunicação foi aberto por lá.
   * Também preserva a troca de tipo de manutenção da v2.0.8.
   * ------------------------------------------------------------------ */
  function installEmbeddedCommunicationBack() {
    const substationId = state?.v209EmbeddedTelecomSubstation;
    if (!substationId || state?.screen !== 'v205-activity') return;

    const oldButton = document.getElementById('v205-back-activity');
    if (!oldButton || oldButton.dataset.v209EmbeddedBack === '1') return;

    const internalActivityBack = oldButton.onclick;
    const button = oldButton.cloneNode(true);
    button.dataset.v208Back = '1';
    button.dataset.v209EmbeddedBack = '1';
    oldButton.replaceWith(button);

    button.onclick = event => {
      event?.preventDefault?.();
      const sub = state.v209EmbeddedTelecomSubstation;
      state.v209EmbeddedTelecomSubstation = null;
      state.v205Asset = null;
      state.v205Activity = null;
      state.v207RequestedActivity = null;
      state.v205TelecomLocation = null;
      state.v205TelecomSubstation = null;
      state.businessFront = 'substation';
      state.sub = sub;
      state.selected?.clear?.();
      renderEquipment();
    };

    const oldSelect = document.querySelector('#v205-form select[name="v207ActivityType"]');
    if (oldSelect && oldSelect.dataset.v209EmbeddedActivity !== '1') {
      const select = oldSelect.cloneNode(true);
      select.dataset.v208Activity = '1';
      select.dataset.v209EmbeddedActivity = '1';
      oldSelect.replaceWith(select);
      select.onchange = event => {
        const wanted = event.currentTarget.value;
        if (!wanted || wanted === state.v205Activity) return;
        state.v207RequestedActivity = wanted;
        if (typeof internalActivityBack === 'function') internalActivityBack();
      };
    }
  }

  /* ------------------------------------------------------------------
   * Foto principal: usa o MESMO seletor de mídia da Subestação.
   * Android nativo -> Camera/Galeria.
   * Notebook/navegador -> seletor de arquivo.
   * Sem modal paralelo criado pela v2.0.8.
   * ------------------------------------------------------------------ */
  function fallbackPickImage() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.className = 'hidden';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');

      let settled = false;
      const cleanup = () => {
        window.removeEventListener('focus', onFocus, true);
        input.remove();
      };
      const finish = file => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(file || null);
      };
      const onFocus = () => setTimeout(() => finish(input.files?.[0] || null), 250);

      input.onchange = () => finish(input.files?.[0] || null);
      input.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Não foi possível abrir o seletor de imagens.'));
      };
      window.addEventListener('focus', onFocus, true);
      document.body.appendChild(input);
      input.click();
    });
  }

  async function pickProfileImage(asset) {
    if (!asset) return;
    try {
      const source = globalThis.CentralMedia?.pickImage
        ? await globalThis.CentralMedia.pickImage({
            title: 'Foto principal do ativo',
            context: { kind: 'front-asset-profile', assetId: asset.id },
          })
        : await fallbackPickImage();

      if (!source) return;

      const nativeAndroid = (() => {
        try { return globalThis.CentralNativeAndroid?.isAvailable?.() === true; }
        catch (_) { return false; }
      })();

      const blob = nativeAndroid
        ? source
        : await compressImage(source, 1000, .82);

      await idbPut('assetPhotos', {
        assetId: asset.id,
        blob,
        updatedAt: new Date().toISOString(),
        frontAsset: true,
      });

      updateFrontProfileFrame(asset, blob);
      toast('Foto principal atualizada.');
    } catch (error) {
      const message = safe(error?.message || error);
      if (!/cancel|cancelado|canceled/i.test(message)) toast(message, 'warning');
    }
  }

  function updateFrontProfileFrame(asset, blob) {
    const frame = document.querySelector('.v206-asset-summary-card .v208-front-profile-frame');
    if (!frame) return;

    frame.classList.toggle('has-photo', !!blob);
    frame.innerHTML = blob
      ? `<img src="${blobUrl(blob)}" alt="Foto de ${esc(asset.operating_code || asset.display_name || 'ativo')}">
         <button type="button" class="asset-profile-action" data-v208-profile-photo>Alterar imagem</button>`
      : `<div class="asset-profile-placeholder"><span data-icon="settings"></span><small>Sem imagem</small></div>
         <button type="button" class="asset-profile-action" data-v208-profile-photo>Adicionar imagem</button>`;
    hydrateIcons?.(frame);
    bindCanonicalFrontProfilePicker();
  }

  function bindCanonicalFrontProfilePicker() {
    if (state?.screen !== 'v205-activity') return;
    const asset = state?.v205Asset;
    const button = document.querySelector('.v208-front-profile-frame [data-v208-profile-photo]');
    if (!asset || !button) return;

    button.dataset.v209MediaPicker = '1';
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      document.getElementById('v208-profile-source-modal')?.remove();
      pickProfileImage(asset);
    };
  }

  function enhance() {
    if (enhancing) return;
    enhancing = true;
    try {
      installCommunicationSelection();
      installEmbeddedCommunicationBack();
      bindCanonicalFrontProfilePicker();
    } finally {
      enhancing = false;
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  if (main) observer.observe(main, { childList: true, subtree: true });

  requestAnimationFrame(enhance);
})();
