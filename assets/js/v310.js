/* Central de Manutenção SE — v3.1.1
 * Relações visuais entre Subestações, Telecom e Religadores.
 * Camada pequena e reversível carregada por último.
 */
(() => {
  'use strict';
  if (globalThis.__CENTRAL_V310__) return;
  globalThis.__CENTRAL_V310__ = true;

  const VERSION = '3.1.1';
  const safe = value => String(value ?? '');
  const norm = value => safe(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const esc = value => safe(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  const FAMILY = {
    radio_voice_vhf: 'Rádio de Voz VHF',
    radio_data_uhf: 'Rádio de Dados UHF',
    radio_microwave: 'Rádio Micro-ondas',
    converter_125_12: 'Conversor 125/12 Vcc',
    converter_125_12_detailed: 'Conversor 125/12 Vcc',
    converter_125_48: 'Conversor 125/48 Vcc',
    router: 'Roteador / Switch',
    claroty: 'Claroty'
  };
  const FAMILY_ORDER = [
    'radio_voice_vhf', 'radio_data_uhf', 'radio_microwave',
    'router', 'converter_125_12', 'converter_125_12_detailed',
    'converter_125_48', 'claroty'
  ];

  const familyLabel = code => FAMILY[code] || safe(code).replace(/_/g, ' ');
  const allFrontAssets = () => Array.isArray(state?.frontAssets) ? state.frontAssets : [];

  function legacyAssetsForSubstation(substationId) {
    const groups = DATA?.equipment?.[substationId] || {};
    return []
      .concat(groups.eletronicos || [])
      .concat(groups.reles || [])
      .concat(groups.patio || []);
  }

  function telecomSitesForSubstation(substationId) {
    return allFrontAssets().filter(asset =>
      asset.active !== false &&
      asset.family_code === 'telecom_site' &&
      safe(asset.substation_code) === safe(substationId)
    );
  }

  function communicationAssetsForSubstation(substationId) {
    const parentIds = new Set(telecomSitesForSubstation(substationId).map(site => site.id));
    if (!parentIds.size) return [];
    const seen = new Set();
    return allFrontAssets()
      .filter(asset =>
        asset.active !== false &&
        asset.business_front === 'telecom' &&
        asset.family_code !== 'telecom_site' &&
        asset.family_code !== 'repeater' &&
        parentIds.has(asset.parent_id)
      )
      .filter(asset => {
        if (seen.has(asset.id)) return false;
        seen.add(asset.id);
        return true;
      })
      .sort((a, b) => {
        const ai = FAMILY_ORDER.indexOf(a.family_code);
        const bi = FAMILY_ORDER.indexOf(b.family_code);
        const ao = ai < 0 ? 999 : ai;
        const bo = bi < 0 ? 999 : bi;
        if (ao !== bo) return ao - bo;
        return safe(a.display_name || a.operating_code).localeCompare(safe(b.display_name || b.operating_code), 'pt-BR', {numeric:true});
      });
  }

  function frontSearchText(asset) {
    return norm([
      familyLabel(asset.family_code), asset.display_name, asset.operating_code,
      asset.manufacturer, asset.model, asset.serial_number, asset.status,
      asset.location_name, asset.substation_code
    ].join(' '));
  }

  function legacySearchText(asset) {
    return norm([
      asset?.tipo, asset?.label, asset?.name, asset?.circuito, asset?.circuit,
      asset?.serial, asset?.identificacao, asset?.numeroOperativo,
      asset?.fabricante, asset?.modelo, asset?.localizacao
    ].join(' '));
  }

  const currentSearch = () => norm(document.getElementById('db-asset-search')?.value || '');
  const selectedSubstation = () => DATA?.substations?.find(item => safe(item.id) === safe(state?.databaseSubId)) || null;

  function filteredCommunicationAssets() {
    const q = currentSearch();
    return communicationAssetsForSubstation(state.databaseSubId).filter(asset => !q || frontSearchText(asset).includes(q));
  }

  function filteredLegacyCount() {
    const q = currentSearch();
    return legacyAssetsForSubstation(state.databaseSubId).filter(asset => !q || legacySearchText(asset).includes(q)).length;
  }

  function openFrontAsset(assetId) {
    const asset = state?.frontAssetMap?.get?.(assetId) || allFrontAssets().find(item => item.id === assetId);
    if (!asset) return;
    if (typeof globalThis.CENTRAL_OPEN_FRONT_ASSET_DETAILS === 'function') {
      globalThis.CENTRAL_OPEN_FRONT_ASSET_DETAILS(asset);
      return;
    }
    if (typeof toast === 'function') toast('A ficha deste ativo ainda não está disponível.', 'warning');
  }

  function updateVersionChrome() {
    const footer = document.getElementById('environment-footer-version');
    if (footer && footer.textContent !== 'v' + VERSION) footer.textContent = 'v' + VERSION;
    const label = document.getElementById('app-version-label');
    if (label && label.textContent !== 'v' + VERSION) label.textContent = 'v' + VERSION;
    const authFooter = document.querySelector('.auth-build-footer span');
    if (authFooter && authFooter.textContent !== 'Versão ' + VERSION) authFooter.textContent = 'Versão ' + VERSION;
    if (document.title && /v\d+\.\d+\.\d+/i.test(document.title)) {
      const next = document.title.replace(/v\d+\.\d+\.\d+/ig, 'v' + VERSION);
      if (next !== document.title) document.title = next;
    }
  }

  function updateSubstationCount() {
    if (state?.screen !== 'database' || state?.databaseFront !== 'substation' || !state?.databaseSubId) return;
    const sub = selectedSubstation();
    if (!sub) return;
    const total = legacyAssetsForSubstation(sub.id).length + communicationAssetsForSubstation(sub.id).length;
    const copy = main?.querySelector?.('.database-selected-heading p');
    if (!copy) return;
    const next = total + ' ativo(s) cadastrados · ' + safe(sub.regiao || 'Região não informada') + ' · ' + safe(sub.classeTensao || 'Classe de tensão não informada');
    if (copy.textContent !== next) copy.textContent = next;
  }

  function groupCommunication(rows) {
    const groups = new Map();
    rows.forEach(asset => {
      const label = familyLabel(asset.family_code);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(asset);
    });
    return [...groups.entries()].sort((a, b) => {
      const familyA = a[1][0]?.family_code || '';
      const familyB = b[1][0]?.family_code || '';
      const ai = FAMILY_ORDER.indexOf(familyA);
      const bi = FAMILY_ORDER.indexOf(familyB);
      const ao = ai < 0 ? 999 : ai;
      const bo = bi < 0 ? 999 : bi;
      return ao === bo ? a[0].localeCompare(b[0], 'pt-BR') : ao - bo;
    });
  }

  function assetNode(asset) {
    const title = safe(asset.operating_code || asset.display_name || familyLabel(asset.family_code));
    const detail = [asset.manufacturer, asset.model].filter(Boolean).join(' · ') || asset.status || 'Abrir ficha do ativo';
    return '<button class="org-asset-node v310-communication-asset" data-v310-front-asset="' + esc(asset.id) + '" type="button">' +
      '<strong>' + esc(title) + '</strong><small>' + esc(detail) + '</small></button>';
  }

  function typeKey(label) {
    return norm(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function renderCommunicationBranch(branches, rows) {
    if (!branches || !rows.length) return;
    if (branches.querySelector('.v310-communication-branch')) return;

    const q = currentSearch();
    const categoryKey = 'Comunicação';
    state.databaseOrgOpenCategories = state.databaseOrgOpenCategories || {};
    state.databaseOrgOpenTypes = state.databaseOrgOpenTypes || {};
    if (!Object.prototype.hasOwnProperty.call(state.databaseOrgOpenCategories, categoryKey)) {
      state.databaseOrgOpenCategories[categoryKey] = false;
    }

    const open = !!q || !!state.databaseOrgOpenCategories[categoryKey];
    const groups = groupCommunication(rows);
    if (open && !q && !Object.keys(state.databaseOrgOpenTypes).some(key => key.startsWith(categoryKey + '::')) && groups[0]) {
      state.databaseOrgOpenTypes[categoryKey + '::' + typeKey(groups[0][0])] = true;
    }
    let typesHtml = '';
    if (open) {
      typesHtml = '<div class="org-category-content v310-communication-content"><div class="org-type-stack">';
      groups.forEach(([label, items]) => {
        const key = categoryKey + '::' + typeKey(label);
        const typeOpen = !!q || !!state.databaseOrgOpenTypes[key];
        typesHtml += '<section class="org-type v310-communication-type">' +
          '<button class="org-type-node ' + (typeOpen ? 'active' : '') + '" data-v310-comm-type="' + esc(key) + '" type="button">' +
          '<span>' + esc(label) + '</span><b>' + items.length + '</b></button>' +
          (typeOpen ? '<div class="org-type-assets">' + items.map(assetNode).join('') + '</div>' : '') +
          '</section>';
      });
      typesHtml += '</div></div>';
    }

    const branch = document.createElement('section');
    branch.className = 'org-branch v310-communication-branch';
    branch.innerHTML =
      '<button class="org-category-node v310-communication-node ' + (open ? 'active' : '') + '" data-v310-communication-toggle type="button">' +
        '<span class="v310-communication-title"><span data-icon="wifi"></span>Comunicação</span>' +
        '<span class="org-category-count">' + rows.length + '</span>' +
      '</button>' + typesHtml;
    branches.appendChild(branch);
    branches.style.setProperty('--branch-count', String(branches.querySelectorAll(':scope > .org-branch').length));

    branch.querySelector('[data-v310-communication-toggle]')?.addEventListener('click', () => {
      state.databaseOrgOpenCategories[categoryKey] = !state.databaseOrgOpenCategories[categoryKey];
      branch.remove();
      renderSubstationCommunication();
    });
    branch.querySelectorAll('[data-v310-comm-type]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.v310CommType;
        state.databaseOrgOpenTypes[key] = !state.databaseOrgOpenTypes[key];
        branch.remove();
        renderSubstationCommunication();
      });
    });
    branch.querySelectorAll('[data-v310-front-asset]').forEach(button => {
      button.addEventListener('click', () => openFrontAsset(button.dataset.v310FrontAsset));
    });
    if (typeof hydrateIcons === 'function') hydrateIcons(branch);
  }

  function ensureTelecomOnlyTree(explorer, rows) {
    if (explorer.querySelector('.database-org-tree') || !rows.length) return;
    const sub = selectedSubstation();
    if (!sub) return;
    explorer.innerHTML =
      '<p class="org-tree-help">Clique nos nós para expandir os ramos e abrir a ficha de cada ativo.</p>' +
      '<div class="database-org-tree">' +
        '<svg class="org-connectors" aria-hidden="true"></svg>' +
        '<div class="org-root-wrap"><div class="org-root-node"><strong>' + esc(sub.sigla) + ' — ' + esc(sub.nome) + '</strong><small>' + rows.length + ' ativo(s) nesta visualização</small></div></div>' +
        '<div class="org-root-stem"></div>' +
        '<div class="org-branches" style="--branch-count:1"></div>' +
      '</div>';
  }

  function renderTreeCommunication(explorer, rows) {
    ensureTelecomOnlyTree(explorer, rows);
    const tree = explorer.querySelector('.database-org-tree');
    if (!tree) return;
    const rootCopy = tree.querySelector('.org-root-node small');
    if (rootCopy) {
      const total = filteredLegacyCount() + rows.length;
      const next = total + ' ativo(s) nesta visualização';
      if (rootCopy.textContent !== next) rootCopy.textContent = next;
    }
    renderCommunicationBranch(tree.querySelector('.org-branches'), rows);
    requestAnimationFrame(() => {
      try { if (typeof drawOrgConnectors === 'function') drawOrgConnectors(explorer); } catch (_) {}
    });
  }

  function renderListCommunication(explorer, rows) {
    const list = explorer.querySelector('.database-list');
    if (!list || list.querySelector('[data-v310-front-asset]')) return;
    if (rows.length) list.querySelector(':scope > .empty')?.remove();
    rows.forEach(asset => {
      const button = document.createElement('button');
      button.className = 'database-row database-row-button v310-communication-list-row';
      button.type = 'button';
      button.dataset.v310FrontAsset = asset.id;
      const title = safe(asset.operating_code || asset.display_name || familyLabel(asset.family_code));
      const meta = [asset.manufacturer, asset.model].filter(Boolean).join(' · ') || 'Dados técnicos não informados';
      button.innerHTML = '<div><strong>' + esc(title) + '</strong><small>' + esc(meta) + '</small></div>' +
        '<div class="db-group">Comunicação<br>' + esc(familyLabel(asset.family_code)) + '</div>' +
        '<span class="tree-open-hint">Abrir</span>';
      button.onclick = () => openFrontAsset(asset.id);
      list.appendChild(button);
    });
  }

  function renderSubstationCommunication() {
    if (state?.screen !== 'database' || state?.databaseFront !== 'substation' || !state?.databaseSubId) return;
    updateSubstationCount();
    const explorer = document.getElementById('database-explorer-content');
    if (!explorer) return;
    const rows = filteredCommunicationAssets();
    if ((state.databaseView || 'tree') === 'list') renderListCommunication(explorer, rows);
    else renderTreeCommunication(explorer, rows);
  }

  function enhanceRepeaterRelationshipTree() {
    const modal = document.getElementById('v207-repeater-modal');
    const list = modal?.querySelector('.v207-linked-relays');
    if (!modal || !list) return;
    const block = list.closest('.detail-block');
    if (!block || block.dataset.v311Tree === '1') return;

    const sourceButtons = [...list.querySelectorAll(':scope > button')];
    if (!sourceButtons.length) return;
    const relays = sourceButtons.map(button => ({
      id: button.dataset.v207LinkedRelay,
      title: button.querySelector('strong')?.textContent?.trim() || 'Religador',
      detail: button.querySelector('span')?.textContent?.trim() || 'Abrir ficha do religador'
    })).filter(item => item.id);
    if (!relays.length) return;

    block.dataset.v311Tree = '1';
    block.classList.add('v311-repeater-link-block');
    const heading = block.querySelector(':scope > h3');
    if (heading) heading.textContent = 'Mapa de vínculos';

    const rootTitle = modal.querySelector('.report-header h2')?.textContent?.trim() || 'Repetidora';
    const countLabel = relays.length === 1 ? '1 religador conectado' : relays.length + ' religadores conectados';
    const columns = Math.max(1, Math.min(relays.length, 4));
    const tree = document.createElement('div');
    tree.className = 'database-org-tree v311-repeater-tree';
    tree.innerHTML =
      '<svg class="org-connectors" aria-hidden="true"></svg>' +
      '<div class="org-root-wrap"><div class="org-root-node v311-repeater-root"><strong>' + esc(rootTitle) + '</strong><small>' + esc(countLabel) + '</small></div></div>' +
      '<div class="org-root-stem"></div>' +
      '<div class="org-branches v311-repeater-branches" style="--branch-count:' + columns + '">' +
        relays.map(relay => '<section class="org-branch v311-repeater-branch"><button type="button" class="org-asset-node org-direct-node v311-repeater-relay-node" data-v311-relay="' + esc(relay.id) + '"><strong>' + esc(relay.title) + '</strong><small>' + esc(relay.detail) + '</small></button></section>').join('') +
      '</div>';

    list.replaceWith(tree);
    tree.querySelectorAll('[data-v311-relay]').forEach(button => {
      button.addEventListener('click', () => openFrontAsset(button.dataset.v311Relay));
    });
    if (typeof hydrateIcons === 'function') hydrateIcons(tree);
    requestAnimationFrame(() => {
      try { if (typeof drawOrgConnectors === 'function') drawOrgConnectors(block); } catch (_) {}
    });
  }

  function enhance() {
    updateVersionChrome();
    renderSubstationCommunication();
    enhanceRepeaterRelationshipTree();
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  }

  const observer = new MutationObserver(schedule);
  if (main) observer.observe(main, {childList:true, subtree:true});
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) observer.observe(modalRoot, {childList:true, subtree:true});
  document.addEventListener('input', event => {
    if (event.target?.id === 'db-asset-search') setTimeout(schedule, 0);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(); });
  window.addEventListener('pageshow', schedule);
  schedule();
})();
