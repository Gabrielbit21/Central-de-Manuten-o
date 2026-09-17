/* Central de Manutenção SE — v2.0.8
 * Correção pequena e focada:
 * 1) Voltar correto nos formulários de Distribuição/Telecom.
 * 2) Reuso do padrão de Subestação para equipe, fotos e encerramento.
 */
(() => {
  'use strict';
  if (globalThis.__CENTRAL_V208__) return;
  globalThis.__CENTRAL_V208__ = true;

  const V208_VERSION = '2.0.8';
  const FRONT_SCOPE = new Set(['distribution', 'telecom']);
  let enhancing = false;

  const safe = value => String(value ?? '');
  const normalizeV208 = value => {
    try { return normalize(safe(value)); }
    catch (_) {
      return safe(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    }
  };
  const inFrontScope = () =>
    FRONT_SCOPE.has(state?.businessFront) &&
    state?.screen === 'v205-activity' &&
    !!document.getElementById('v205-form');

  function currentFrontAsset() {
    return state?.v205Asset || null;
  }

  function frontAssetLabel(asset) {
    return asset?.operating_code || asset?.display_name || 'Ativo';
  }

  function frontAssetAdapter(asset) {
    return {
      id: asset.id,
      label: frontAssetLabel(asset),
      tipo: asset.display_name || asset.operating_code || 'Ativo',
      circuito: asset.operating_code || '',
    };
  }

  /* ------------------------------------------------------------------
   * 1. VOLTAR: sai do formulário para a seleção real do ativo/local.
   * Não passa mais pela tela antiga de escolha de atividade.
   * ------------------------------------------------------------------ */
  function installBackNavigation() {
    const button = document.getElementById('v205-back-activity');
    if (!button || button.dataset.v208Back === '1') return;

    button.dataset.v208Back = '1';
    button.setAttribute(
      'aria-label',
      state.businessFront === 'distribution'
        ? 'Voltar aos ativos de Distribuição'
        : 'Voltar aos locais e ativos de Telecom'
    );
    button.title = button.getAttribute('aria-label');

    button.addEventListener('click', event => {
      if (!FRONT_SCOPE.has(state.businessFront)) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      state.v205Asset = null;
      state.v205Activity = null;
      state.v207RequestedActivity = null;
      state.pendingPhotos = [];
      state.maintenanceParticipants = [];

      /* O override da v2.0.5 usa businessFront para voltar diretamente
         para Distribuição ou Telecom, sem retornar ao seletor de frente. */
      renderSubstations();
    }, true);
  }

  /* A v2.0.7 troca o tipo de manutenção usando internamente o botão Voltar.
     Como na v2.0.8 o Voltar ganhou um destino real, interceptamos SOMENTE a
     mudança do select e chamamos diretamente o onclick antigo da v2.0.5.
     Assim o tipo continua dentro do formulário e o Voltar continua correto. */
  function protectActivityTypeChange() {
    const select = document.querySelector('#v205-form select[name="v207ActivityType"]');
    if (!select || select.dataset.v208Activity === '1') return;
    select.dataset.v208Activity = '1';

    select.addEventListener('change', event => {
      const wanted = event.currentTarget.value;
      if (!wanted || wanted === state.v205Activity) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      state.v207RequestedActivity = wanted;
      const back = document.getElementById('v205-back-activity');

      /* Invoca a função original sem disparar o evento de clique, portanto
         não aciona o novo handler de navegação da v2.0.8. */
      if (back && typeof back.onclick === 'function') back.onclick();
    }, true);
  }

  /* ------------------------------------------------------------------
   * 2. EQUIPE: usa LITERALMENTE o componente já consolidado da Subestação.
   * ------------------------------------------------------------------ */
  async function installCanonicalTeamPicker(form) {
    if (!form || form.dataset.v208Team === '1') return;

    /* Remove o seletor paralelo criado na v2.0.7. */
    form.querySelectorAll('.v207-team-control').forEach(node => node.remove());

    let input = form.elements?.equipe;
    if (!input) return;

    /* setupV200TeamPicker procura um input[name=equipe]. */
    input.type = 'text';
    input.classList.remove('hidden');
    input.removeAttribute('hidden');

    if (typeof setupV200TeamPicker !== 'function') return;
    await setupV200TeamPicker(form);

    /* Impede o observer da v2.0.7 de recriar o seletor antigo. */
    input = form.elements?.equipe;
    if (input) input.dataset.v207Team = '1';

    /* Mantém também os IDs no payload multi-frente. */
    if (!form.elements?.participantIds) {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'participantIds';
      form.appendChild(hidden);
    }
    const syncIds = () => {
      if (form.elements?.participantIds) {
        form.elements.participantIds.value =
          JSON.stringify([...(state.maintenanceParticipants || [])]);
      }
    };
    syncIds();
    form.querySelector('.v200-team-box')?.addEventListener('change', syncIds);
    form.querySelector('.v200-team-box')?.addEventListener('click', () =>
      queueMicrotask(syncIds)
    );

    /* O submit da v205 não passa por submitMaintenance(), então a validação
       de quantidade é aplicada aqui para manter a mesma regra da Subestação. */
    form.addEventListener('submit', event => {
      if ((state.maintenanceParticipants || []).length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toast('Selecione pelo menos um integrante da equipe executante.', 'warning');
      document.getElementById('v200-team-select')?.focus();
    }, true);

    form.dataset.v208Team = '1';
  }

  /* ------------------------------------------------------------------
   * FOTO PRINCIPAL DO ATIVO: mesma aparência do quadro da Subestação.
   * ------------------------------------------------------------------ */
  async function getFrontProfilePhoto(assetId) {
    try {
      return (await idbGet('assetPhotos', assetId))?.blob || null;
    } catch (_) {
      return null;
    }
  }

  async function saveFrontProfilePhoto(asset, file) {
    if (!file?.type?.startsWith('image/')) return;
    const blob = await compressImage(file, 1000, .82);
    await idbPut('assetPhotos', {
      assetId: asset.id,
      blob,
      updatedAt: new Date().toISOString(),
      frontAsset: true,
    });
    await refreshProfileFrame(asset);
  }

  function chooseFrontProfilePhoto(asset, capture) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await saveFrontProfilePhoto(asset, file);
      } catch (error) {
        toast(error?.message || String(error), 'warning');
      }
    };
    input.click();
  }

  function openProfileSourceDialog(asset) {
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = `<div class="modal" id="v208-profile-source-modal">
      <div class="modal-card v208-profile-source-card">
        <button class="modal-close" id="v208-profile-source-close" type="button" aria-label="Fechar"><span data-icon="x"></span></button>
        <h2>Imagem do ativo</h2>
        <p class="muted">Escolha como deseja adicionar a foto principal.</p>
        <div class="v208-profile-source-actions">
          <button class="btn secondary" id="v208-profile-camera" type="button"><span data-icon="camera"></span>Tirar foto</button>
          <button class="btn secondary" id="v208-profile-gallery" type="button"><span data-icon="photo"></span>Selecionar da galeria</button>
        </div>
      </div>
    </div>`;
    hydrateIcons?.(root);
    const close = () => { root.innerHTML = ''; };
    root.querySelector('#v208-profile-source-close').onclick = close;
    root.querySelector('#v208-profile-camera').onclick = () => {
      close();
      chooseFrontProfilePhoto(asset, true);
    };
    root.querySelector('#v208-profile-gallery').onclick = () => {
      close();
      chooseFrontProfilePhoto(asset, false);
    };
  }

  async function refreshProfileFrame(asset) {
    const current = document.querySelector('.v206-asset-summary-card .v208-front-profile-frame');
    if (!current) return;
    const blob = await getFrontProfilePhoto(asset.id);
    current.classList.toggle('has-photo', !!blob);
    current.innerHTML = blob
      ? `<img src="${blobUrl(blob)}" alt="Foto de ${esc(frontAssetLabel(asset))}">
         <button type="button" class="asset-profile-action" data-v208-profile-photo>Alterar imagem</button>`
      : `<div class="asset-profile-placeholder"><span data-icon="settings"></span><small>Sem imagem</small></div>
         <button type="button" class="asset-profile-action" data-v208-profile-photo>Adicionar imagem</button>`;
    current.querySelector('[data-v208-profile-photo]').onclick = () =>
      openProfileSourceDialog(asset);
    hydrateIcons?.(current);
  }

  async function installCanonicalProfileFrame(asset) {
    const old = document.querySelector('.v206-asset-summary-card .v206-asset-photo');
    if (!old) return;

    /* Retira os botões paralelos "Tirar foto / Galeria" que ficavam soltos. */
    old.querySelectorAll('.v207-photo-actions').forEach(node => node.remove());

    if (!old.classList.contains('v208-front-profile-frame')) {
      old.className = 'asset-profile-frame v208-front-profile-frame';
    }
    await refreshProfileFrame(asset);
  }

  /* ------------------------------------------------------------------
   * IMAGENS DA MANUTENÇÃO: mesmo upload-zone/photo-grid da Subestação.
   * ------------------------------------------------------------------ */
  function findPhotoSection(form) {
    return [...form.querySelectorAll('.v205-form-section')].find(section =>
      normalizeV208(section.querySelector('.v205-section-title h3')?.textContent)
        .includes('imagens da manutencao')
    ) || null;
  }

  async function addFrontMaintenancePhotos(files, asset) {
    for (const file of files || []) {
      if (!file?.type?.startsWith('image/')) continue;
      const blob = await compressImage(file);
      state.pendingPhotos.push({
        id: uid(),
        blob,
        category: 'Antes',
        assetId: asset.id,
        caption: '',
        asProfile: false,
        originalName: file.name || '',
      });
    }
    drawFrontPendingPhotos(asset);
  }

  function drawFrontPendingPhotos(asset) {
    const adapter = frontAssetAdapter(asset);
    if (typeof drawPendingPhotos === 'function') {
      drawPendingPhotos([adapter]);
    }

    /* O renderer da Subestação já controla categoria, legenda, remoção e a
       caixa "usar como foto principal". Para front_assets só faltava aplicar
       a foto principal, porque a finalização da v205 ignora asProfile. */
    const grid = document.getElementById('photo-grid');
    if (!grid || grid.dataset.v208ProfileSync === '1') return;
    grid.dataset.v208ProfileSync = '1';
    grid.addEventListener('change', async event => {
      const control = event.target.closest('[data-field="asProfile"]');
      if (!control || !control.checked) return;
      const item = state.pendingPhotos?.[Number(control.dataset.p)];
      if (!item?.blob) return;
      await idbPut('assetPhotos', {
        assetId: asset.id,
        blob: item.blob,
        updatedAt: new Date().toISOString(),
        frontAsset: true,
      });
      await refreshProfileFrame(asset);
    });
  }

  function installCanonicalMaintenancePhotos(form, asset) {
    const section = findPhotoSection(form);
    if (!section || section.dataset.v208Photos === '1') return;

    section.dataset.v208Photos = '1';
    section.classList.add('v208-standard-photo-section');
    section.innerHTML = `
      <div class="v208-photo-heading">
        <h3>Imagens da manutenção</h3>
        <span class="muted">As fotos ficam na pasta deste ativo.</span>
      </div>
      <div class="field full">
        <div id="upload-zone" class="upload-zone">
          <strong>Adicionar fotos ou tirar uma foto</strong>
          <p>Antes, durante, depois, defeito, peça substituída ou identificação.</p>
          <button type="button" class="btn secondary" id="pick-photos">Selecionar imagens</button>
          <input id="photo-input" type="file" accept="image/*" capture="environment" multiple class="hidden">
        </div>
        <div id="photo-grid" class="photo-grid"></div>
      </div>`;

    const input = section.querySelector('#photo-input');
    const zone = section.querySelector('#upload-zone');

    section.querySelector('#pick-photos').onclick = () => input.click();
    input.onchange = async event => {
      await addFrontMaintenancePhotos([...event.target.files], asset);
      event.target.value = '';
    };

    ['dragenter', 'dragover'].forEach(name =>
      zone.addEventListener(name, event => {
        event.preventDefault();
        zone.classList.add('drag');
      })
    );
    ['dragleave', 'drop'].forEach(name =>
      zone.addEventListener(name, event => {
        event.preventDefault();
        zone.classList.remove('drag');
      })
    );
    zone.addEventListener('drop', event =>
      addFrontMaintenancePhotos(
        [...event.dataTransfer.files].filter(file => file.type.startsWith('image/')),
        asset
      )
    );

    drawFrontPendingPhotos(asset);
  }

  /* ------------------------------------------------------------------
   * ENCERRAMENTO: mesmos rótulos e mesma hierarquia visual da Subestação.
   * ------------------------------------------------------------------ */
  function standardizeFormFooter(form) {
    const actions = form.querySelector('.v205-form-actions');
    if (!actions) return;

    actions.classList.add('v208-standard-actions');

    const draft = actions.querySelector('#v205-save-draft');
    if (draft) draft.textContent = 'Salvar rascunho completo';

    const submit = actions.querySelector('button[type="submit"]');
    if (submit) submit.textContent = 'Revisar relatório';

    if (!form.querySelector('.v208-required-note')) {
      const note = document.createElement('p');
      note.className = 'validation-note v208-required-note';
      note.innerHTML = '<span class="required-mark">*</span> Campo obrigatório.';
      actions.before(note);
    }
  }

  /* Mantém os IDs da equipe sincronizados antes do rascunho e da revisão. */
  function installParticipantSync(form) {
    if (form.dataset.v208ParticipantSync === '1') return;
    form.dataset.v208ParticipantSync = '1';

    const sync = () => {
      let hidden = form.elements?.participantIds;
      if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'participantIds';
        form.appendChild(hidden);
      }
      hidden.value = JSON.stringify([...(state.maintenanceParticipants || [])]);
    };

    form.addEventListener('change', sync);
    form.addEventListener('submit', sync, true);
    document.getElementById('v205-save-draft')?.addEventListener('click', sync, true);
    sync();
  }

  async function enhanceFrontForm() {
    if (enhancing || !inFrontScope()) return;
    enhancing = true;
    try {
      const form = document.getElementById('v205-form');
      const asset = currentFrontAsset();
      if (!form || !asset) return;

      installBackNavigation();
      protectActivityTypeChange();
      await installCanonicalTeamPicker(form);
      installParticipantSync(form);
      await installCanonicalProfileFrame(asset);
      installCanonicalMaintenancePhotos(form, asset);
      standardizeFormFooter(form);
      hydrateIcons?.(form.closest('.v205-page') || form);
    } finally {
      enhancing = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (!inFrontScope()) return;
    requestAnimationFrame(enhanceFrontForm);
  });
  if (main) observer.observe(main, {childList:true, subtree:true});

  requestAnimationFrame(enhanceFrontForm);
})();
