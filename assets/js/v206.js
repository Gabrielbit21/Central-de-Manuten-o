/* Central de Manutenção SE — v2.0.6
 * Refinamento visual de Distribuição/Telecom e árvores de Telecom integradas.
 * Carregado depois da camada v2.0.5.
 */
(() => {
  'use strict';
  if (globalThis.__CENTRAL_V206__) return;
  globalThis.__CENTRAL_V206__ = true;

  const V206_VERSION = '2.0.6';
  const REPEATER_ALIASES = {
    'UCD': 'CORONEL DOMINICIANO',
    'USINA CORONEL DOMINICIANO': 'CORONEL DOMINICIANO',
    'CORONEL DOMICILIANO': 'CORONEL DOMINICIANO',
    'UBA': 'UBÁ',
    'SANTANA DE MANHUAÇU': 'SANTANA DO MANHUAÇU',
    'ALTO DA CONCEIÇÃO (CEMIG)': 'ALTO DA CONCEIÇÃO',
    'PAULA CANDIDO': 'PAULA CÂNDIDO',
    'SIMONESIA': 'SIMONÉSIA'
  };

  const familyLabels = {
    distribution_recloser: 'Religador de Distribuição',
    voltage_regulator: 'Regulador de Tensão',
    repeater: 'Repetidora',
    telecom_site: 'Local de Telecom',
    radio_voice_vhf: 'Rádio de Voz VHF',
    radio_data_uhf: 'Rádio de Dados UHF',
    radio_microwave: 'Rádio Micro-ondas',
    converter_125_12: 'Conversor 125/12 Vcc',
    converter_125_12_detailed: 'Conversor 125/12 Vcc',
    converter_125_48: 'Conversor 125/48 Vcc',
    router: 'Roteador / Switch',
    claroty: 'Claroty'
  };

  const safe = value => String(value ?? '');
  const escapeHtml = value => safe(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const normalized = value => {
    try { return normalize(safe(value)); }
    catch (_) { return safe(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase(); }
  };
  const familyLabel = code => familyLabels[code] || safe(code).replace(/_/g, ' ');
  const assetTitle = asset => asset?.operating_code || asset?.display_name || 'Ativo';
  const frontAssets = () => Array.isArray(state?.frontAssets) ? state.frontAssets : [];
  const assetById = id => state?.frontAssetMap?.get?.(id) || frontAssets().find(a => a.id === id) || null;
  const repeaterAssets = () => frontAssets().filter(a => a.family_code === 'repeater' && a.active !== false).sort((a,b) => safe(a.display_name).localeCompare(safe(b.display_name), 'pt-BR'));
  const relayAssets = () => frontAssets().filter(a => a.family_code === 'distribution_recloser' && a.active !== false);
  const telecomSites = () => frontAssets().filter(a => a.family_code === 'telecom_site' && a.active !== false);
  const telecomChildren = siteId => frontAssets().filter(a => a.parent_id === siteId && a.active !== false).sort((a,b) => familyLabel(a.family_code).localeCompare(familyLabel(b.family_code), 'pt-BR'));

  function normalizeRepeaterName(value) {
    const raw = safe(value).trim();
    const key = raw.toUpperCase();
    return REPEATER_ALIASES[key] || raw;
  }

  function repeaterRelayLinks(rep) {
    if (!rep) return [];
    const repName = normalized(normalizeRepeaterName(rep.display_name));
    const aliases = new Set([repName, ...((rep.data?.aliases || []).map(x => normalized(normalizeRepeaterName(x))))]);
    return relayAssets().filter(relay => {
      if (relay.linked_repeater_id === rep.id) return true;
      const named = normalized(normalizeRepeaterName(relay.data?.repeater_name));
      return !!named && aliases.has(named);
    }).sort((a,b) => safe(a.operating_code).localeCompare(safe(b.operating_code), 'pt-BR', {numeric:true}));
  }

  function detailValue(value) {
    if (value === null || value === undefined || value === '' || value === '-') return '—';
    if (Array.isArray(value)) return value.join(', ');
    return safe(value);
  }

  function assetSummaryCard(asset) {
    if (!asset) return '';
    const image = asset.data?.profile_photo_url || asset.data?.photo_url || '';
    const primary = [
      ['FABRICANTE', asset.manufacturer],
      ['MODELO', asset.model],
      ['NÚMERO DE SÉRIE', asset.serial_number],
      ['NÚMERO OPERATIVO', asset.operating_code],
      ['SUBESTAÇÃO', asset.substation_code],
      ['ALIMENTADOR', asset.feeder],
      ['REGIÃO', asset.region],
      ['STATUS', asset.status]
    ].filter(([,v]) => v !== null && v !== undefined && safe(v).trim() && v !== '-').slice(0, 8);
    return `<div class="v206-asset-summary-card">
      <div class="v206-asset-photo ${image ? 'has-image' : ''}">${image ? `<img src="${escapeHtml(image)}" alt="Imagem do ativo">` : `<span data-icon="settings"></span><small>Sem imagem</small>`}</div>
      <div class="v206-asset-summary-info">
        <div class="v206-asset-summary-head"><strong>${escapeHtml(assetTitle(asset))}</strong></div>
        <div class="v206-asset-meta">${primary.map(([k,v]) => `<span><b>${escapeHtml(k)}</b>${escapeHtml(detailValue(v))}</span>`).join('')}</div>
      </div>
    </div>`;
  }

  function assetFolderMarkup(asset) {
    const rows = [
      ['Família', familyLabel(asset?.family_code)],
      ['Código operativo', asset?.operating_code],
      ['Status', asset?.status],
      ['Região', asset?.region],
      ['Subestação', asset?.substation_code],
      ['Alimentador', asset?.feeder],
      ['Localização', asset?.location_name],
      ['Fabricante', asset?.manufacturer],
      ['Modelo', asset?.model],
      ['Número de série', asset?.serial_number],
      ['Meio de comunicação', asset?.data?.communication_medium || asset?.data?.primary_comm_medium],
      ['IP rádio', asset?.data?.radio_ip],
      ['IP relé', asset?.data?.relay_ip],
      ['Repetidora', asset?.data?.repeater_name]
    ].filter(([,v]) => v !== null && v !== undefined && safe(v).trim() && v !== '-');
    return `<div class="v206-folder-card"><div class="v206-folder-title"><strong>${escapeHtml(assetTitle(asset))}</strong><small>Cadastro técnico do ativo</small></div><div class="v206-folder-grid">${rows.map(([k,v]) => `<div><b>${escapeHtml(k)}</b><span>${escapeHtml(detailValue(v))}</span></div>`).join('')}</div></div>`;
  }

  function frontHistoryRows(asset) {
    const code = normalized(asset?.operating_code).replace(/[^a-z0-9]/g, '');
    const legacy = (state?.frontHistory || []).filter(row => row.asset_id === asset?.id || (!row.asset_id && code && normalized(row.operating_code).replace(/[^a-z0-9]/g,'') === code));
    return legacy.sort((a,b) => safe(b.occurred_on).localeCompare(safe(a.occurred_on)));
  }

  function historyMarkup(asset) {
    const rows = frontHistoryRows(asset).slice(0, 10);
    if (!rows.length) return '<div class="empty">Sem histórico vinculado a este ativo.</div>';
    return `<div class="v206-history-list">${rows.map(row => {
      const summary = row.summary || row.payload?.['Descreva a atividade executada, o diagnóstico identificado e o que ficou pendente.'] || '';
      return `<article class="v206-history-card"><div class="v206-history-date">${escapeHtml(typeof formatDate === 'function' ? formatDate(row.occurred_on) : row.occurred_on)}${row.work_order ? ` · ${escapeHtml(row.work_order)}` : ''}</div><h4>${escapeHtml(row.maintenance_type || 'Atendimento')}</h4>${row.team ? `<p><b>Equipe:</b> ${escapeHtml(row.team)}</p>` : ''}${summary ? `<p>${escapeHtml(summary)}</p>` : ''}</article>`;
    }).join('')}</div>`;
  }

  function bindSideTabs(side) {
    side.querySelectorAll('[data-v206-side-tab]').forEach(button => button.addEventListener('click', () => {
      const tab = button.dataset.v206SideTab;
      side.querySelectorAll('[data-v206-side-tab]').forEach(b => b.classList.toggle('active', b === button));
      side.querySelectorAll('[data-v206-side-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.v206SidePane !== tab));
    }));
  }

  function enhanceActivityLayout() {
    const form = document.getElementById('v205-form');
    const asset = state?.v205Asset;
    if (!form || !asset || form.dataset.v206Layout === '1') return;
    const page = form.closest('.v205-page');
    if (!page) return;
    form.dataset.v206Layout = '1';
    page.classList.add('v206-activity-page');

    const heading = page.querySelector(':scope > .head-row');
    if (heading) {
      const h1 = heading.querySelector('h1');
      const p = heading.querySelector('p');
      if (h1) h1.textContent = `Registrar manutenção · ${assetTitle(asset)}`;
      if (p) p.textContent = '1 ativo selecionado';
    }

    page.querySelector(':scope > .v205-asset-summary')?.remove();

    const existingHistory = page.querySelector(':scope > #v205-activity-history');
    if (existingHistory) existingHistory.remove();

    const cadastral = form.querySelector('.v205-cadastral');
    if (cadastral) form.prepend(cadastral);

    const layout = document.createElement('div');
    layout.className = 'v206-activity-layout';
    const left = document.createElement('section');
    left.className = 'panel v206-activity-main';
    left.innerHTML = `<h2 class="v206-panel-title">Ativo em atendimento</h2>${assetSummaryCard(asset)}`;
    left.appendChild(form);

    const side = document.createElement('aside');
    side.className = 'panel v206-activity-side';
    side.innerHTML = `<div class="v206-side-tabs"><button type="button" class="active" data-v206-side-tab="history">Histórico</button><button type="button" data-v206-side-tab="folder">Pasta do ativo</button></div><div data-v206-side-pane="history"><p class="muted v206-side-help">Histórico exclusivo do ativo em atendimento.</p>${historyMarkup(asset)}</div><div class="hidden" data-v206-side-pane="folder">${assetFolderMarkup(asset)}</div>`;
    bindSideTabs(side);

    layout.append(left, side);
    if (heading) heading.after(layout); else page.appendChild(layout);
    if (typeof hydrateIcons === 'function') hydrateIcons(layout);
  }

  function repeaterInfoRows(rep, section) {
    const map = {
      infrastructure: [
        ['Tipo de estrutura', rep.data?.structure_type],
        ['Fabricante', rep.data?.structure_manufacturer],
        ['Altura', rep.data?.structure_height_m ? `${rep.data.structure_height_m} m` : ''],
        ['AEV torre', rep.data?.aev_tower],
        ['AEV instalado', rep.data?.aev_installed],
        ['Abrigo', rep.data?.shelter_type],
        ['Aterramento', rep.data?.grounding],
        ['Condição elétrica', rep.data?.electrical_condition],
        ['Bancos 48 V', rep.data?.battery_48v_banks],
        ['Tipo de bateria', rep.data?.battery_type],
        ['Ar-condicionado', rep.data?.ac_quantity],
        ['Câmeras bullet', rep.data?.camera_bullet_quantity],
        ['Acesso seco', rep.data?.road_dry],
        ['Acesso chuva', rep.data?.road_rain]
      ],
      communication: [
        ['Tecnologias', rep.data?.tower_technologies],
        ['Meio principal', rep.data?.primary_comm_medium],
        ['Rede principal', rep.data?.primary_network_type],
        ['Meio redundante', rep.data?.redundant_comm_medium],
        ['Modelo XPS', rep.data?.xps_model],
        ['IP XPS', rep.data?.xps_ip],
        ['Protocolo', rep.data?.xps_protocol],
        ['Gerência SIT', rep.data?.xps_sit_management]
      ]
    };
    return (map[section] || []).filter(([,v]) => v !== null && v !== undefined && safe(v).trim() && v !== '-');
  }

  function branchRowsMarkup(rows) {
    if (!rows.length) return '<div class="v206-tree-empty">Sem dados cadastrados.</div>';
    return rows.map(([label,value]) => `<div class="v206-tree-leaf v206-data-leaf"><b>${escapeHtml(label)}</b><span>${escapeHtml(detailValue(value))}</span></div>`).join('');
  }

  function relayLeafMarkup(relay) {
    const ips = [relay.data?.radio_ip, relay.data?.relay_ip].filter(Boolean).join(' / ');
    return `<button class="v206-tree-leaf v206-relay-leaf" type="button" data-v206-relay="${escapeHtml(relay.id)}"><b>${escapeHtml(relay.operating_code || relay.display_name)}</b><span>${escapeHtml([relay.substation_code, relay.feeder, ips].filter(Boolean).join(' · '))}</span></button>`;
  }

  function repeaterTreeMarkup(rep) {
    const relays = repeaterRelayLinks(rep);
    const infra = repeaterInfoRows(rep, 'infrastructure');
    const comm = repeaterInfoRows(rep, 'communication');
    return `<div class="v206-telecom-tree-browser">
      <div class="v206-tree-toolbar"><button class="back v206-tree-back" type="button" data-v206-tree-back><span data-icon="arrow-left"></span></button><div><strong>Repetidoras</strong><span>Selecione outro local ou navegue pelos galhos abaixo.</span></div></div>
      <div class="v206-tree-canvas">
        <button type="button" class="v206-tree-root" data-v206-open-repeater="${escapeHtml(rep.id)}"><strong>${escapeHtml(rep.display_name)}</strong><span>${escapeHtml([rep.data?.city, rep.region].filter(Boolean).join(' · '))}</span><small>${relays.length} religador(es) vinculado(s)</small></button>
        <div class="v206-tree-trunk"></div>
        <div class="v206-tree-branches">
          <section class="v206-tree-branch"><div class="v206-branch-line"></div><div class="v206-tree-branch-head"><strong>Infraestrutura</strong><span>${infra.length}</span></div><div class="v206-tree-leaves">${branchRowsMarkup(infra)}</div></section>
          <section class="v206-tree-branch"><div class="v206-branch-line"></div><div class="v206-tree-branch-head"><strong>Comunicação</strong><span>${comm.length}</span></div><div class="v206-tree-leaves">${branchRowsMarkup(comm)}</div></section>
          <section class="v206-tree-branch v206-relay-branch"><div class="v206-branch-line"></div><div class="v206-tree-branch-head"><strong>Religadores vinculados</strong><span>${relays.length}</span></div><div class="v206-tree-leaves">${relays.length ? relays.map(relayLeafMarkup).join('') : '<div class="v206-tree-empty">Nenhum religador vinculado.</div>'}</div></section>
        </div>
      </div>
    </div>`;
  }

  function repeaterPickerMarkup(rows) {
    return `<div class="v206-repeater-picker">${rows.map(rep => {
      const relays = repeaterRelayLinks(rep);
      return `<button type="button" class="v206-repeater-choice" data-v206-choose-repeater="${escapeHtml(rep.id)}"><div><strong>${escapeHtml(rep.display_name)}</strong><span>${escapeHtml([rep.data?.city, rep.data?.structure_type, rep.data?.structure_height_m ? `${rep.data.structure_height_m} m` : ''].filter(Boolean).join(' · '))}</span></div><small>${relays.length} religador(es)</small></button>`;
    }).join('') || '<div class="empty">Nenhuma repetidora encontrada.</div>'}</div>`;
  }

  function openRelayMiniDetails(relay) {
    if (!relay) return;
    const root = document.getElementById('modal-root');
    if (!root) return;
    const rows = [
      ['Status', relay.status], ['Região', relay.region], ['Subestação', relay.substation_code], ['Alimentador', relay.feeder],
      ['Fabricante', relay.manufacturer], ['Modelo', relay.model], ['Número de série', relay.serial_number],
      ['Meio de comunicação', relay.data?.communication_medium], ['Repetidora', relay.data?.repeater_name],
      ['IP rádio', relay.data?.radio_ip], ['IP relé', relay.data?.relay_ip]
    ].filter(([,v]) => v !== null && v !== undefined && safe(v).trim() && v !== '-');
    root.innerHTML = `<div class="modal" id="v206-relay-modal"><div class="modal-card v206-mini-modal"><button class="modal-close" type="button" data-v206-modal-close><span data-icon="x"></span></button><h2>${escapeHtml(assetTitle(relay))}</h2><p class="muted">${escapeHtml(familyLabel(relay.family_code))}</p><div class="v206-folder-grid">${rows.map(([k,v]) => `<div><b>${escapeHtml(k)}</b><span>${escapeHtml(detailValue(v))}</span></div>`).join('')}</div></div></div>`;
    root.querySelector('[data-v206-modal-close]').onclick = () => { root.innerHTML = ''; };
    if (typeof hydrateIcons === 'function') hydrateIcons(root);
  }

  function openRepeaterMiniDetails(rep) {
    if (!rep) return;
    return openV206FrontAssetDetails(rep);
  }

  function enhanceTelecomTree() {
    if (state?.screen !== 'database' || state?.databaseFront !== 'telecom' || (state.databaseTelecomType || 'repeater') !== 'repeater') return;
    const host = document.getElementById('v205-db-tel-results');
    const search = document.getElementById('v205-db-tel-search');
    if (!host || !search) return;
    if (host.querySelector('.v206-telecom-tree-browser') || host.querySelector('.v206-repeater-picker')) return;

    const q = normalized(search.value);
    const rows = repeaterAssets().filter(rep => !q || normalized([rep.display_name, rep.location_name, rep.data?.city].join(' ')).includes(q));
    let selected = state.v206SelectedRepeaterId ? assetById(state.v206SelectedRepeaterId) : null;
    if (selected && selected.family_code !== 'repeater') selected = null;
    if (selected && q && !rows.some(r => r.id === selected.id)) selected = null;

    host.innerHTML = selected ? repeaterTreeMarkup(selected) : repeaterPickerMarkup(rows);
    host.querySelectorAll('[data-v206-choose-repeater]').forEach(button => button.onclick = () => {
      state.v206SelectedRepeaterId = button.dataset.v206ChooseRepeater;
      host.innerHTML = '';
      enhanceTelecomTree();
    });
    host.querySelector('[data-v206-tree-back]')?.addEventListener('click', () => {
      state.v206SelectedRepeaterId = null;
      host.innerHTML = '';
      enhanceTelecomTree();
    });
    host.querySelectorAll('[data-v206-relay]').forEach(button => button.onclick = () => openRelayMiniDetails(assetById(button.dataset.v206Relay)));
    host.querySelector('[data-v206-open-repeater]')?.addEventListener('click', e => openRepeaterMiniDetails(assetById(e.currentTarget.dataset.v206OpenRepeater)));
    if (typeof hydrateIcons === 'function') hydrateIcons(host);
  }

  function buildCommunicationBranch(site) {
    const children = telecomChildren(site.id);
    return `<details class="tree-category v206-communication-category" open><summary><span data-icon="wifi"></span><strong>Comunicação</strong><span>${children.length}</span></summary><div class="v206-substation-comm-leaves">${children.length ? children.map(asset => `<button type="button" class="v206-substation-comm-leaf" data-v206-sub-comm="${escapeHtml(asset.id)}"><strong>${escapeHtml(familyLabel(asset.family_code))}</strong><span>${escapeHtml([asset.manufacturer, asset.model].filter(Boolean).join(' · '))}</span></button>`).join('') : '<div class="empty">Nenhum equipamento de Telecom cadastrado.</div>'}</div></details>`;
  }

  function integrateSubstationCommunication() {
    if (state?.screen !== 'database' || state?.databaseFront !== 'substation' || !state?.databaseSubId) return;
    if (main.querySelector('.v206-communication-category')) return;

    const site = telecomSites().find(item => item.substation_code === state.databaseSubId);
    if (!site) return;

    const oldPanel = main.querySelector('.v205-substation-communication');
    const existingCategories = [...main.querySelectorAll('.tree-category')].filter(el => !oldPanel?.contains(el));
    if (!existingCategories.length) return;

    const branchHost = existingCategories[0].parentElement;
    if (!branchHost || !existingCategories.every(el => el.parentElement === branchHost)) return;
    branchHost.classList.add('v206-substation-tree-branches');
    branchHost.insertAdjacentHTML('beforeend', buildCommunicationBranch(site));
    oldPanel?.remove();
    const inserted = branchHost.querySelector('.v206-communication-category');
    inserted?.querySelectorAll('[data-v206-sub-comm]').forEach(button => button.onclick = () => openRelayMiniDetails(assetById(button.dataset.v206SubComm)));
    if (typeof hydrateIcons === 'function' && inserted) hydrateIcons(inserted);
  }

  function resetRepeaterSelectionWhenLeaving() {
    if (state?.databaseFront !== 'telecom' || (state.databaseTelecomType || 'repeater') !== 'repeater') state.v206SelectedRepeaterId = null;
  }

  function applyVersionChrome() {
    if(globalThis.__CENTRAL_V300__)return;
    document.title = document.title.replace(/v\d+\.\d+\.\d+/i, `v${V206_VERSION}`);
    const footer = document.getElementById('environment-footer-version');
    if (footer) footer.textContent = `v${V206_VERSION}`;
    const version = document.getElementById('app-version-label');
    if (version) version.textContent = `v${V206_VERSION}`;
  }

  let scheduled = false;
  function scheduleEnhancements() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyVersionChrome();
      enhanceActivityLayout();
      integrateSubstationCommunication();
      enhanceTelecomTree();
      resetRepeaterSelectionWhenLeaving();
    });
  }

  const observer = new MutationObserver(scheduleEnhancements);
  if (main) observer.observe(main, {subtree:true, childList:true});
  document.addEventListener('input', event => {
    if (event.target?.id === 'v205-db-tel-search') setTimeout(() => {
      const host = document.getElementById('v205-db-tel-results');
      if (host) host.innerHTML = '';
      enhanceTelecomTree();
    }, 0);
  });

  window.addEventListener('online', scheduleEnhancements);
  applyVersionChrome();
  scheduleEnhancements();

  /* ===== v2.0.6 — consolidação visual e funcional final ===== */
  const v206NormCode = value => normalized(value).replace(/[^a-z0-9]/g, '');
  const v206StatusClass = value => {
    const status=normalized(value);
    if(status.includes('sucata')||(status.includes('fora')&&status.includes('operacao')))return 'scrap';
    if(status.includes('manutencao'))return 'warning';
    if(status.includes('reserva'))return 'reserve';
    if(status.includes('inativo')||status.includes('desativado'))return 'inactive';
    if(status.includes('operacao'))return 'ok';
    return '';
  };

  function v206FrontDetailRows(asset) {
    const rows = [
      ['Frente', asset.business_front === 'telecom' ? 'Telecom' : 'Distribuição'],
      ['Família', familyLabel(asset.family_code)],
      ['Código operativo', asset.operating_code],
      ['Status', asset.status],
      ['Região', asset.region],
      ['Subestação', asset.substation_code],
      ['Alimentador', asset.feeder],
      ['Localização', asset.location_name],
      ['Fabricante', asset.manufacturer],
      ['Modelo', asset.model],
      ['Número de série', asset.serial_number]
    ];
    const friendly = {
      switch_manufacture_year:'Ano de fabricação da chave', control_install_year:'Ano de instalação do controle', network_voltage:'Tensão de rede', position:'Posição',
      affected_customers:'Clientes afetados', switch_serial:'Nº de série da chave', control_model:'Modelo do controle', control_serial:'Nº de série do controle',
      relay_firmware:'Firmware do relé', point_map:'Mapa de pontos', communication_medium:'Meio de comunicação', communication_manufacturer:'Fabricante da comunicação',
      communication_technology:'Tecnologia', communication_firmware:'Firmware da comunicação', communication_identifier:'Identificador / IMEI', repeater_name:'Repetidora',
      radio_ip:'IP do rádio', relay_ip:'IP do relé', sim1_operator:'Operadora chip 1', sim1_iccid:'ICCID chip 1', sim2_operator:'Operadora chip 2', sim2_iccid:'ICCID chip 2',
      structure_type:'Tipo de estrutura', structure_manufacturer:'Fabricante da estrutura', structure_height_m:'Altura da estrutura', aev_tower:'AEV da torre',
      battery_type:'Tipo de bateria', battery_48v_banks:'Bancos de bateria 48 V', primary_comm_medium:'Meio de comunicação principal', primary_network_type:'Rede principal',
      redundant_comm_medium:'Meio redundante', xps_model:'Modelo XPS', xps_ip:'IP XPS', city:'Cidade', cps:'CPS'
    };
    const walk = (obj, prefix='') => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
      for (const [key,value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) { walk(value, `${prefix}${key}.`); continue; }
        if (value === null || value === undefined || value === '' || value === '-') continue;
        const leaf = key;
        const label = friendly[leaf] || leaf.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
        rows.push([label, Array.isArray(value) ? value.join(', ') : value]);
      }
    };
    walk(asset.data || {});
    const seen = new Set();
    return rows.filter(([label,value]) => {
      if (value === null || value === undefined || value === '' || value === '-') return false;
      const key = `${label}|${safe(value)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  async function v206RouteToAsset(asset) {
    if (!navigator.onLine) return typeof toast === 'function' && toast('Rota disponível quando houver conexão.','notice');
    if (asset.latitude == null || asset.longitude == null) return typeof toast === 'function' && toast('Este equipamento não possui coordenadas cadastradas.','warning');
    let origin = '';
    try {
      if (typeof getCurrentCoordinates === 'function') {
        const geo = await getCurrentCoordinates();
        if (geo) origin = `&origin=${encodeURIComponent(`${geo.latitude},${geo.longitude}`)}`;
      }
    } catch (_) {}
    const destination = encodeURIComponent(`${asset.latitude},${asset.longitude}`);
    window.open(`https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}&travelmode=driving`,'_blank','noopener');
  }

  async function v206LocalAssetPhoto(assetId) {
    try { return typeof photoForAsset === 'function' ? await photoForAsset(assetId) : (await idbGet('assetPhotos',assetId))?.blob || null; }
    catch (_) { try { return (await idbGet('assetPhotos',assetId))?.blob || null; } catch(__) { return null; } }
  }

  const V301_FRONT_HIDDEN_KEYS=new Set([
    'source_row','monthly_status','aliases','reviewed_on','linked_repeater_external_key',
    'physical_units','rent_value','rent_expiry','land_contract_type','land_contract_expiry',
    'land_expiry','land_status','land_dup','cpf','document','documento','landlord','owner',
    'proprietario','proprietário','locador','arrendador'
  ]);
  const V301_FRONT_LABELS={
    status:'Status',region:'Região',substation_code:'Subestação',feeder:'Alimentador',
    location_name:'Localização',manufacturer:'Fabricante',model:'Modelo',serial_number:'Número de série',
    'data.city':'Cidade','data.cps':'CPS','data.address':'Endereço','data.position':'Posição',
    'data.network_voltage':'Tensão da rede','data.affected_customers':'Clientes afetados',
    'data.switch_model':'Modelo da chave','data.switch_serial':'Nº de série da chave',
    'data.switch_manufacture_year':'Ano de fabricação da chave','data.control_model':'Modelo do controle',
    'data.control_serial':'Nº de série do controle','data.control_install_year':'Ano de instalação do controle',
    'data.relay_firmware':'Firmware do relé','data.firmware':'Firmware','data.point_map':'Mapa de pontos',
    'data.battery_specification':'Especificação da bateria','data.battery_spec':'Especificação da bateria',
    'data.battery_last_change':'Última troca da bateria','data.battery_next_change':'Próxima troca da bateria',
    'data.battery_type':'Tipo de bateria','data.battery_manufacturer':'Fabricante da bateria',
    'data.battery_48v_banks':'Bancos de bateria 48 V','data.battery_autonomy':'Autonomia da bateria',
    'data.communication_medium':'Meio de comunicação','data.communication_manufacturer':'Fabricante da comunicação',
    'data.communication_technology':'Tecnologia de comunicação','data.communication_firmware':'Firmware da comunicação',
    'data.communication_identifier':'IMEI / identificador','data.communication_type':'Tipo de comunicação',
    'data.repeater_name':'Repetidora','data.radio_ip':'IP do rádio','data.relay_ip':'IP do relé',
    'data.sim1_operator':'Operadora chip 1','data.sim1_iccid':'ICCID chip 1',
    'data.sim2_operator':'Operadora chip 2','data.sim2_iccid':'ICCID chip 2','data.chip_legacy':'Identificador legado',
    'data.structure_type':'Tipo de estrutura','data.structure_manufacturer':'Fabricante da estrutura',
    'data.structure_height_m':'Altura da estrutura','data.aev_tower':'AEV da torre','data.aev_installed':'AEV instalada',
    'data.installation_year':'Ano de instalação','data.shelter_type':'Tipo de abrigo','data.grounding':'Aterramento',
    'data.access_4x2':'Acesso 4x2','data.access_trail':'Acesso por trilha','data.road_dry':'Condição de acesso no seco',
    'data.road_rain':'Condição de acesso na chuva','data.night_service':'Atendimento noturno',
    'data.site_key_type':'Tipo de chave do site','data.fence_type':'Tipo de cercamento',
    'data.primary_comm_medium':'Meio de comunicação principal','data.primary_network_type':'Rede principal',
    'data.redundant_comm_medium':'Meio redundante','data.xps_model':'Modelo XPS','data.xps_ip':'IP XPS',
    'data.xps_protocol':'Protocolo XPS','data.xps_sit_management':'Gerenciamento XPS/SIT',
    'data.automated':'Automatizado','data.power':'Potência','data.reference_voltage':'Tensão de referência',
    'data.tp_ratio':'Relação TP','data.cell_quantity':'Quantidade de células','data.electrical_condition':'Condição elétrica'
  };

  function v301FrontFieldLabel(path){
    if(V301_FRONT_LABELS[path])return V301_FRONT_LABELS[path];
    return safe(path).replace(/^data\./,'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
  }
  function v301FrontFieldValue(asset,path){
    if(path.startsWith('data.')){
      let value=asset?.data;
      for(const part of path.slice(5).split('.')){
        if(value==null)return null;
        value=value[part];
      }
      return value;
    }
    return asset?.[path];
  }
  function v301FrontScalarPaths(obj,prefix='data',out=[]){
    if(!obj||typeof obj!=='object'||Array.isArray(obj))return out;
    for(const [key,value] of Object.entries(obj)){
      if(V301_FRONT_HIDDEN_KEYS.has(key)||/_external_key$/i.test(key)||/(^|_)(cpf|documento|document|owner|landlord|proprietario|locador|arrendador|telefone|phone|email|contato|contact)(_|$)/i.test(key))continue;
      const path=`${prefix}.${key}`;
      if(Array.isArray(value))continue;
      if(value&&typeof value==='object')v301FrontScalarPaths(value,path,out);
      else out.push(path);
    }
    return out;
  }
  function v301FrontEditablePaths(asset){
    const top=['status','region','substation_code','feeder','location_name','manufacturer','model','serial_number'];
    return [...new Set([...top,...v301FrontScalarPaths(asset?.data||{})])]
      .filter(path=>v301FrontFieldValue(asset,path)!==undefined);
  }
  function v301FrontGroup(path){
    const key=path.replace(/^data\./,'').toLowerCase();
    if(key==='status')return'identification';
    if(/communication|comm_|radio|relay_ip|sim\d|iccid|chip|operator|operadora|repeater|primary_network|redundant|xps/.test(key))return'communication';
    if(/region|substation|feeder|location|city|cps|address|position|network_voltage|affected_customer|access|road_|trail|night_service|site_key|fence/.test(key))return'operational';
    return'technical';
  }
  function v301FrontGroups(asset){
    const groups={identification:[],operational:[],technical:[],communication:[]};
    groups.identification.push(['Código operativo',asset.operating_code||asset.display_name||'',null]);
    groups.identification.push(['Família',familyLabel(asset.family_code),null]);
    for(const path of v301FrontEditablePaths(asset)){
      const value=v301FrontFieldValue(asset,path);
      const row=[v301FrontFieldLabel(path),value,path];
      groups[v301FrontGroup(path)].push(row);
    }
    return groups;
  }
  function v301FrontInputValue(value){
    if(value===null||value===undefined)return'';
    if(typeof value==='boolean')return value?'Sim':'Não';
    return String(value);
  }
  function v301FrontSectionMarkup(title,rows){
    if(!rows.length)return'';
    return `<section class="v301-front-section"><h3>${escapeHtml(title)}</h3><div class="v301-front-grid">${rows.map(([label,value,path])=>`<div class="v301-front-field"><label>${escapeHtml(label)}</label>${path?`<input data-v301-front-path="${escapeHtml(path)}" readonly value="${escapeHtml(v301FrontInputValue(value))}">`:`<input readonly tabindex="-1" value="${escapeHtml(v301FrontInputValue(value))}">`}</div>`).join('')}</div></section>`;
  }
  function v301FrontSnapshot(form){
    const result={};
    form?.querySelectorAll('[data-v301-front-path]').forEach(input=>{
      result[input.dataset.v301FrontPath]=String(input.value??'').trim();
    });
    return result;
  }
  function v301FrontChanged(current,initial){
    return Object.keys(current).some(key=>String(current[key]??'')!==String(initial[key]??''));
  }
  async function v301LoadFrontAudits(assetId){
    if(state.role!=='admin'||!navigator.onLine||!cloudClient)return[];
    try{
      const {data,error}=await cloudClient.from('asset_audit_logs')
        .select('id,action,changes,batch_id,created_at,actor_id')
        .eq('asset_id',assetId)
        .order('created_at',{ascending:false})
        .limit(40);
      if(error)throw error;
      const names=new Map((state.profileDirectory||[]).map(profile=>[profile.id,profile.display_name]));
      return (data||[]).map(row=>({...row,actor_name:names.get(row.actor_id)||'Administrativo'}));
    }catch(error){
      console.warn('Auditoria de front_assets:',error?.message||error);
      return[];
    }
  }
  function v301FrontAuditMarkup(audits){
    if(!audits.length)return'<div class="empty">Nenhuma alteração cadastral registrada.</div>';
    return audits.map(a=>`<article class="asset-audit-entry"><strong>${a.action==='bulk_update'?'Atualização por planilha':a.action==='batch_revert'?'Reversão de lote':'Edição administrativa'}</strong><small>${escapeHtml(typeof formatDate==='function'?formatDate(a.created_at):String(a.created_at||''))} · ${escapeHtml(new Date(a.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))} · ${escapeHtml(a.actor_name||'Administrativo')}</small><div class="asset-audit-changes">${(a.changes||[]).map(change=>`<span class="asset-audit-change"><b>${escapeHtml(change.label||v301FrontFieldLabel(change.field||change.field_path||''))}</b>: ${escapeHtml(change.before??change.old_value??'—')} → ${escapeHtml(change.after??change.new_value??'—')}</span>`).join('')}</div></article>`).join('');
  }

  async function v206ChooseFrontAssetPhoto(asset, imgHost) {
    try{
      let source=null;
      if(globalThis.CentralMedia?.pickImage){
        source=await globalThis.CentralMedia.pickImage({
          title:'Foto principal do ativo',
          context:{kind:'front-asset-profile',assetId:asset.id}
        });
      }else{
        source=await new Promise(resolve=>{
          const input=document.createElement('input');
          input.type='file';
          input.accept='image/*';
          input.onchange=()=>resolve(input.files?.[0]||null);
          input.click();
        });
      }
      if(!source)return;
      const nativeAndroid=(()=>{
        try{return globalThis.CentralNativeAndroid?.isAvailable?.()===true}
        catch(_){return false}
      })();
      const blob=nativeAndroid?source:(typeof compressImage==='function'?await compressImage(source,1000,.82):source);
      await idbPut('assetPhotos',{assetId:asset.id,blob,updatedAt:new Date().toISOString(),frontAsset:true});
      imgHost.innerHTML=`<img src="${blobUrl(blob)}" alt="Foto do ativo"><span class="v206-photo-hover">Alterar foto</span>`;
      imgHost.classList.add('has-photo');
      if(typeof toast==='function')toast('Foto principal atualizada.');
    }catch(error){
      const message=String(error?.message||error);
      if(!/cancel|cancelado|canceled/i.test(message)&&typeof toast==='function')toast(message,'warning');
    }
  }

  async function v301RefreshFrontAsset(asset){
    if(!navigator.onLine||!cloudClient)return asset;
    try{
      const {data,error}=await cloudClient.from('front_assets').select('*').eq('id',asset.id).single();
      if(error)throw error;
      if(data){
        Object.assign(asset,data,{row_version:Number(data.row_version||1),data:data.data||{},data_state:data.data_state||{}});
        state.frontAssetMap?.set?.(asset.id,asset);
        const index=(state.frontAssets||[]).findIndex(item=>item.id===asset.id);
        if(index>=0)state.frontAssets[index]=asset;
      }
    }catch(error){
      console.warn('Atualização do ativo após edição:',error?.message||error);
    }
    return asset;
  }

  async function openV206FrontAssetDetails(asset) {
    if(!asset)return;
    const root=document.getElementById('modal-root');
    if(!root)return;

    const [photo,audits]=await Promise.all([
      v206LocalAssetPhoto(asset.id),
      v301LoadFrontAudits(asset.id)
    ]);
    const history=frontHistoryRows(asset).slice(0,12);
    const groups=v301FrontGroups(asset);
    const admin=state.role==='admin';
    const canRoute=asset.latitude!=null&&asset.longitude!=null;

    root.innerHTML=`<div class="modal" id="v206-front-asset-modal"><div class="modal-card report-modal-card v206-front-detail-card v301-front-detail-card">
      <button class="modal-close" id="v206-close-front-detail" type="button" aria-label="Fechar"><span data-icon="x"></span></button>
      <div class="report-header v206-front-detail-header">
        <div>
          <span class="status-pill imported">${escapeHtml(familyLabel(asset.family_code))}</span>
          <h2>${escapeHtml(assetTitle(asset))}</h2>
          <p class="muted">${escapeHtml([asset.substation_code,asset.location_name].filter(Boolean).join(' — '))}</p>
        </div>
        ${admin?'<div class="asset-detail-header-actions"><button class="asset-lock-button" id="v301-front-edit-lock" type="button" title="Desbloquear edição" aria-label="Desbloquear edição"><span data-icon="lock"></span></button></div>':''}
      </div>

      <div class="v301-front-detail-layout">
        <aside class="v301-front-detail-aside">
          <button type="button" class="asset-modal-photo v206-front-photo ${photo?'has-photo':''}" id="v206-front-photo">
            ${photo?`<img src="${blobUrl(photo)}" alt="Foto do ativo"><span class="v206-photo-hover">Alterar foto</span>`:'<span data-icon="settings"></span><small>Adicionar foto do ativo</small>'}
          </button>
          ${canRoute?'<button class="btn accent v301-front-route" id="v206-detail-route" type="button"><span data-icon="arrow-right"></span>Traçar rota</button>':''}
        </aside>

        <form id="v301-front-edit-form" class="v301-front-detail-content">
          ${v301FrontSectionMarkup('Identificação',groups.identification)}
          ${v301FrontSectionMarkup('Operacional e localização',groups.operational)}
          ${v301FrontSectionMarkup('Detalhes técnicos',groups.technical)}
          ${v301FrontSectionMarkup('Comunicação',groups.communication)}
          <div class="asset-version-note">Revisão cadastral ${Number(asset.row_version||1)} · ID interno ${escapeHtml(asset.id)}</div>
          <div class="asset-edit-actions hidden" id="v301-front-edit-actions">
            <button class="btn secondary" id="v301-front-edit-cancel" type="button">Cancelar</button>
            <button class="btn primary" id="v301-front-edit-save" type="submit">Salvar alterações</button>
          </div>
        </form>
      </div>

      <div class="detail-block"><h3>Histórico relacionado</h3>${history.length?`<div class="history">${history.map(row=>{const summary=row.summary||row.payload?.['Descreva a atividade executada, o diagnóstico identificado e o que ficou pendente.']||'';return `<article class="history-card"><div class="date">${escapeHtml(typeof formatDate==='function'?formatDate(row.occurred_on):row.occurred_on)} · ${escapeHtml(row.work_order||'Sem OS')}</div><h4>${escapeHtml(row.maintenance_type||'Atendimento')}</h4>${row.team?`<p><b>Equipe:</b> ${escapeHtml(row.team)}</p>`:''}${summary?`<p>${escapeHtml(summary)}</p>`:''}</article>`}).join('')}</div>`:'<div class="empty">Nenhum histórico relacionado localizado automaticamente.</div>'}</div>

      ${admin?`<div class="detail-block"><h3>Alterações cadastrais</h3><div class="asset-audit-list">${v301FrontAuditMarkup(audits)}</div></div>`:''}
    </div></div>`;

    const modal=root.querySelector('#v206-front-asset-modal');
    const form=root.querySelector('#v301-front-edit-form');
    const lock=root.querySelector('#v301-front-edit-lock');
    const actions=root.querySelector('#v301-front-edit-actions');
    const photoHost=root.querySelector('#v206-front-photo');
    let editing=false;
    let initial=v301FrontSnapshot(form);

    const setEditing=value=>{
      editing=value;
      form.classList.toggle('editing',editing);
      actions?.classList.toggle('hidden',!editing);
      form.querySelectorAll('[data-v301-front-path]').forEach(input=>{input.readOnly=!editing});
      if(lock){
        lock.classList.toggle('unlocked',editing);
        if(typeof setIconOnly==='function')setIconOnly(lock,editing?'lock-open':'lock');
        else lock.innerHTML=`<span data-icon="${editing?'lock-open':'lock'}"></span>`;
        lock.title=editing?'Bloquear sem salvar':'Desbloquear edição';
        lock.setAttribute('aria-label',lock.title);
      }
    };

    const close=()=>{
      if(editing&&v301FrontChanged(v301FrontSnapshot(form),initial)&&!confirm('Descartar as alterações não salvas?'))return;
      root.innerHTML='';
    };

    root.querySelector('#v206-close-front-detail').onclick=close;
    modal.onclick=event=>{if(event.target===modal)close()};
    root.querySelector('#v206-detail-route')?.addEventListener('click',()=>v206RouteToAsset(asset));
    photoHost?.addEventListener('click',()=>v206ChooseFrontAssetPhoto(asset,photoHost));

    lock?.addEventListener('click',()=>{
      if(!navigator.onLine)return toast('A edição cadastral exige conexão com a nuvem.','warning');
      if(editing&&v301FrontChanged(v301FrontSnapshot(form),initial)){
        if(!confirm('Descartar as alterações feitas?'))return;
        for(const [path,value] of Object.entries(initial)){
          const input=[...form.querySelectorAll('[data-v301-front-path]')].find(item=>item.dataset.v301FrontPath===path);
          if(input)input.value=value;
        }
      }
      setEditing(!editing);
    });

    root.querySelector('#v301-front-edit-cancel')?.addEventListener('click',()=>{
      for(const [path,value] of Object.entries(initial)){
        const input=[...form.querySelectorAll('[data-v301-front-path]')].find(item=>item.dataset.v301FrontPath===path);
        if(input)input.value=value;
      }
      setEditing(false);
    });

    form.onsubmit=async event=>{
      event.preventDefault();
      if(!editing)return;
      if(!navigator.onLine)return toast('A edição cadastral exige conexão com a nuvem.','warning');

      const current=v301FrontSnapshot(form);
      const updates={};
      for(const [path,value] of Object.entries(current)){
        const before=String(initial[path]??'');
        if(value!==before)updates[path]=value===''?null:value;
      }
      if(!Object.keys(updates).length){
        toast('Nenhuma alteração foi identificada.','notice');
        return setEditing(false);
      }

      const save=root.querySelector('#v301-front-edit-save');
      save.disabled=true;
      save.textContent='Salvando…';
      try{
        const {error}=await cloudClient.rpc('update_front_asset_record',{
          p_asset_id:asset.id,
          p_expected_version:Number(asset.row_version||1),
          p_updates:updates
        });
        if(error)throw error;
        await v301RefreshFrontAsset(asset);
        toast('Cadastro do ativo atualizado.');
        await openV206FrontAssetDetails(asset);
      }catch(error){
        save.disabled=false;
        save.textContent='Salvar alterações';
        const message=String(error?.message||error);
        toast(/version|versão|conflict|conflito/i.test(message)?'O cadastro mudou desde que esta ficha foi aberta. Feche a ficha, abra novamente e revise os dados.':message,'warning');
      }
    };

    setEditing(false);
    if(typeof hydrateIcons==='function')hydrateIcons(root);
  }

  /* v3.1.0: disponibiliza a ficha canônica para relações exibidas por outras frentes. */
  globalThis.CENTRAL_OPEN_FRONT_ASSET_DETAILS = openV206FrontAssetDetails;

  function v206DistributionAssets() {
    const family=state.databaseV205Family||'distribution_recloser';
    return frontAssets().filter(a=>a.family_code===family&&a.active!==false).sort((a,b)=>safe(a.operating_code||a.display_name).localeCompare(safe(b.operating_code||b.display_name),'pt-BR',{numeric:true}));
  }

  function v206DistributionRow(asset) {
    return `<button type="button" class="v206-db-asset-row" data-v206-db-front-asset="${escapeHtml(asset.id)}"><div><strong>${escapeHtml(asset.operating_code||asset.display_name)}</strong><span>${escapeHtml([asset.substation_code,asset.feeder,asset.model].filter(Boolean).join(' · '))}</span></div><span class="v205-status ${v206StatusClass(asset.status)}">${escapeHtml(asset.status||'Sem status')}</span></button>`;
  }

  function v206RenderDistributionBrowser() {
    if(state?.screen!=='database'||state?.databaseFront!=='distribution')return;
    const host=document.getElementById('v205-db-dist-results'), search=document.getElementById('v205-db-dist-search'), oldSelect=document.getElementById('v205-db-dist-group');
    if(!host||!search)return;
    const toolbar=search.closest('.toolbar');
    const family=state.databaseV205Family||'distribution_recloser';
    const browserKey=`distribution:${family}`;

    /*
     * v3.0.3: não recriar a galeria a cada mutação interna do próprio browser.
     * O redraw dos filtros passa a ser responsabilidade exclusiva dos handlers
     * locais abaixo. Isso elimina o efeito de "mal contato" nos botões e <details>.
     */
    const hasControls=!!toolbar?.querySelector('.v206-group-controls');
    const hasBrowser=!!host.querySelector('.v206-db-groups,.v206-db-list');
    if(host.dataset.v206BrowserKey===browserKey&&hasControls&&hasBrowser)return;
    host.dataset.v206BrowserKey=browserKey;

    if(oldSelect){oldSelect.remove();}
    let controls=toolbar?.querySelector('.v206-group-controls');
    if(!controls&&toolbar){controls=document.createElement('div');controls.className='v206-group-controls';controls.innerHTML='<span>Visualizar por</span>'+[['region','Região'],['substation_code','Subestação'],['feeder','Alimentador'],['model','Modelo'],['','Todos']].map(([k,l])=>`<button type="button" data-v206-group="${k}">${l}</button>`).join('');toolbar.appendChild(controls);}
    state.v206DistributionGroup = state.v206DistributionGroup ?? 'region';
    const draw=()=>{
      const all=v206DistributionAssets(), q=v206NormCode(search.value), group=state.v206DistributionGroup;
      controls?.querySelectorAll('[data-v206-group]').forEach(b=>b.classList.toggle('active',b.dataset.v206Group===group));
      if(q){const rows=all.filter(a=>v206NormCode([a.operating_code,a.display_name,a.feeder,a.substation_code,a.model,a.manufacturer].join(' ')).includes(q));host.innerHTML=`<div class="v206-db-list">${rows.map(v206DistributionRow).join('')||'<div class="empty">Nenhum equipamento encontrado.</div>'}</div>`;bind();return;}
      if(!group){host.innerHTML=`<div class="v206-db-list">${all.map(v206DistributionRow).join('')}</div>`;bind();return;}
      const buckets=new Map();for(const asset of all){const key=asset[group]||'Não informado';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(asset)}
      const entries=[...buckets.entries()].sort((a,b)=>safe(a[0]).localeCompare(safe(b[0]),'pt-BR',{numeric:true}));
      host.innerHTML=`<div class="v206-db-groups">${entries.map(([key,list],idx)=>`<details class="v206-db-group" data-v206-group-details><summary><strong>${escapeHtml(key)}</strong><span>${list.length} ativo(s)</span></summary><div class="v206-db-group-body" data-v206-lazy="${idx}"></div></details>`).join('')}</div>`;
      [...host.querySelectorAll('[data-v206-group-details]')].forEach((details,idx)=>details.addEventListener('toggle',()=>{if(!details.open)return;const body=details.querySelector('.v206-db-group-body');if(body.dataset.rendered)return;const list=entries[idx]?.[1]||[];body.innerHTML=list.map(v206DistributionRow).join('');body.dataset.rendered='1';bind(body)}));
    };
    const bind=(scope=host)=>scope.querySelectorAll('[data-v206-db-front-asset]').forEach(b=>b.onclick=()=>openV206FrontAssetDetails(assetById(b.dataset.v206DbFrontAsset)));
    search.oninput=draw;
    controls?.querySelectorAll('[data-v206-group]').forEach(b=>b.onclick=()=>{state.v206DistributionGroup=b.dataset.v206Group;draw()});
    draw();
  }

  function v206LegacyHistoryReports() {
    return (state.frontHistory||[]).map(row=>({
      key:`front-history:${row.id}`, source:'imported-front', id:row.id, businessFront:row.business_front||'distribution', familyCode:row.family_code||'',
      number:row.work_order||row.source_key||row.id, date:row.occurred_on, createdAt:row.occurred_on, author:row.team||'Equipe', assets:[row.operating_code||'Ativo não informado'],
      type:row.maintenance_type||'Manutenção', status:'historico', outcome:'concluido', raw:row, summary:row.summary||''
    }));
  }

  function v206ReportFront(report){return report.businessFront||report.raw?.businessFront||report.raw?.business_front||report.raw?.payload?.business_front||'substation'}
  function openV206HistoryReport(report){const root=document.getElementById('modal-root'),row=report.raw||{};if(!root)return;const payload=Object.entries(row.payload||{}).filter(([,v])=>v!==null&&v!==undefined&&safe(v).trim()!=='');root.innerHTML=`<div class="modal" id="v206-history-report-modal"><div class="modal-card report-modal-card"><button class="modal-close" id="v206-close-history-report"><span data-icon="x"></span></button><div class="report-header"><div><span class="status-pill imported">Histórico importado</span><h2>${escapeHtml(row.operating_code||'Atendimento histórico')}</h2><p class="muted">${escapeHtml([row.maintenance_type,row.work_order,row.team].filter(Boolean).join(' · '))}</p></div></div>${row.summary?`<div class="detail-block"><h3>Atividade, diagnóstico e pendências</h3><p>${escapeHtml(row.summary)}</p></div>`:''}<div class="detail-block"><h3>Dados do atendimento</h3><div class="v206-history-payload">${payload.map(([k,v])=>`<div><b>${escapeHtml(k)}</b><span>${escapeHtml(Array.isArray(v)?v.join(', '):v)}</span></div>`).join('')}</div></div></div></div>`;root.querySelector('#v206-close-history-report').onclick=()=>root.innerHTML='';if(typeof hydrateIcons==='function')hydrateIcons(root)}

  const v206BaseRenderOverview = typeof renderOverview === 'function' ? renderOverview : null;
  if(v206BaseRenderOverview) renderOverview=async function(){
    if(state.role!=='admin')return v206BaseRenderOverview();
    state.screen='overview';setActiveNav('overview');
    const live=await combinedReports(), legacy=v206LegacyHistoryReports(), byKey=new Map();[...live,...legacy].forEach(r=>byKey.set(r.key||`${r.source}:${r.id}`,r));const reports=[...byKey.values()].sort((a,b)=>safe(b.createdAt||b.date).localeCompare(safe(a.createdAt||a.date)));
    state.reports=reports;let active=state.reportFront||'all';
    const count=front=>front==='all'?reports.length:reports.filter(r=>v206ReportFront(r)===front).length;
    const tabs=()=>`<div class="v205-top-tabs v205-report-tabs">${[['all','Todos'],['substation','Subestação'],['distribution','Distribuição'],['telecom','Telecom']].map(([k,l])=>`<button data-v206-report-front="${k}" class="${active===k?'active':''}">${l}<span>${count(k)}</span></button>`).join('')}</div>`;
    main.innerHTML=`<div class="page-heading overview-heading"><div><h1>Relatórios</h1><p>Relatórios das equipes e histórico consolidado de manutenção.</p></div></div>${tabs()}<div id="v206-report-stats"></div><section class="panel"><div class="inbox-toolbar"><div class="search"><input id="report-search" placeholder="Buscar por ativo, equipe, local ou tipo"></div><select id="report-source"><option value="">Todos os status</option><option value="pending">Aguardando envio</option><option value="review">Aguardando revisão</option><option value="approved">Aprovados</option><option value="rejected">Reprovados</option><option value="imported">Histórico importado</option></select></div><div id="inbox"></div></section>`;
    const search=document.getElementById('report-search'),source=document.getElementById('report-source');
    const rowsForFront=()=>reports.filter(r=>active==='all'||v206ReportFront(r)===active);
    const statusMatch=(r,v)=>!v||(v==='imported'?r.source==='imported'||r.source==='imported-front':v==='pending'?reportRequiresSync(r.status):v==='review'?['enviado','corrigido'].includes(r.status):v==='approved'?r.status==='aprovado':v==='rejected'?r.status==='reprovado':true);
    const drawStats=()=>{const rows=rowsForFront();const operational=rows.filter(r=>r.source!=='imported'&&r.source!=='imported-front');document.getElementById('v206-report-stats').innerHTML=`<div class="stats v205-report-stats"><div class="stat"><strong>${rows.length}</strong><span>relatórios</span></div><div class="stat"><strong>${operational.filter(r=>['enviado','corrigido'].includes(r.status)).length}</strong><span>em análise</span></div><div class="stat"><strong>${operational.filter(r=>r.status==='aprovado').length}</strong><span>aprovados</span></div><div class="stat"><strong>${operational.filter(r=>r.status==='reprovado').length}</strong><span>reprovados</span></div></div>`};
    const draw=()=>{const q=normalized(search.value),src=source.value,matched=rowsForFront().filter(r=>statusMatch(r,src)&&(!q||normalized([r.number,r.author,r.substation,r.type,...(r.assets||[]),r.summary].join(' ')).includes(q))).sort((a,b)=>safe(b.date||b.createdAt).localeCompare(safe(a.date||a.createdAt)));document.getElementById('inbox').innerHTML=`<div class="inbox"><div class="inbox-head"><span></span><span>Relatório / ativo</span><span>Responsável</span><span>Data</span></div>${matched.length?matched.map(r=>`<article class="inbox-row ${r.source==='imported-front'?'':'unread'}" data-v206-report-key="${escapeHtml(r.key)}"><span class="report-dot ${r.source==='imported-front'?'':'review'}"></span><div class="inbox-main"><strong>${escapeHtml((r.assets||[]).join(', ')||'Ativo não informado')}</strong><span>${escapeHtml((v206ReportFront(r)==='distribution'?'Distribuição':v206ReportFront(r)==='telecom'?'Telecom':'Subestação'))} · ${escapeHtml(r.type||'Manutenção')} ${r.source==='imported-front'?'· Histórico importado':''}</span></div><div class="inbox-person"><b>${escapeHtml(r.author||'')}</b></div><div class="inbox-date"><b>${typeof formatDate==='function'?formatDate(r.date):escapeHtml(r.date)}</b></div></article>`).join(''):'<div class="empty">Nenhum relatório encontrado.</div>'}</div><p class="database-note">Exibindo ${matched.length} resultado(s).</p>`;document.querySelectorAll('[data-v206-report-key]').forEach(row=>row.onclick=()=>{const r=reports.find(x=>x.key===row.dataset.v206ReportKey);if(!r)return;if(r.source==='imported-front')openV206HistoryReport(r);else if(typeof openReportDetails==='function')openReportDetails(r.key)})};
    document.querySelectorAll('[data-v206-report-front]').forEach(b=>b.onclick=()=>{active=b.dataset.v206ReportFront;state.reportFront=active;document.querySelectorAll('[data-v206-report-front]').forEach(x=>x.classList.toggle('active',x===b));drawStats();draw()});search.oninput=draw;source.onchange=draw;drawStats();draw();
  };

  function v206EnsureStandardBackButtons(){
    if(!main)return;
    if(state?.screen==='integration'){
      const heading=main.querySelector('.page-heading,.head-row');if(heading){let back=heading.querySelector('.back');if(!back&&state.assetOperationFront){back=document.createElement('button');back.type='button';back.className='back v206-injected-back';back.innerHTML='<span data-icon="arrow-left"></span>';heading.querySelector('div')?.prepend(back)}if(back&&state.assetOperationFront){back.onclick=()=>{state.assetOperationFront=null;renderAssetOperationsHome()}}}
    }
    if(state?.businessFront==='substation'&&['substations','equipment','review'].includes(state?.screen)){
      const heading=main.querySelector('.head-row');if(heading){let back=heading.querySelector('.back');if(!back){back=document.createElement('button');back.type='button';back.className='back v206-injected-back';back.innerHTML='<span data-icon="arrow-left"></span>';heading.querySelector('div')?.prepend(back)}back.onclick=()=>{state.businessFront=null;state.sub=null;state.selected?.clear?.();renderBusinessFrontSelector()}}
    }
    if(typeof hydrateIcons==='function')hydrateIcons(main);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-v205-db-asset],[data-v205-db-tel-asset],[data-repeater-relay],[data-v206-relay],[data-v206-sub-comm],[data-v206-db-front-asset]');
    if(!button)return;const id=button.dataset.v205DbAsset||button.dataset.v205DbTelAsset||button.dataset.repeaterRelay||button.dataset.v206Relay||button.dataset.v206SubComm||button.dataset.v206DbFrontAsset;const asset=assetById(id);if(!asset)return;event.preventDefault();event.stopImmediatePropagation();openV206FrontAssetDetails(asset);
  },true);

  function v206StandardizeDatabaseActions(){
    if(state?.screen!=='database')return;
    const front=state.databaseFront||'substation';
    const exportButton=front==='distribution'?document.getElementById('v205-export-db'):front==='telecom'?document.getElementById('v205-export-tel'):document.getElementById('database-export-data');
    const bulkButton=front==='distribution'?document.getElementById('v205-bulk-db'):front==='telecom'?document.getElementById('v205-bulk-tel'):document.getElementById('bulk-asset-update');
    if(exportButton){exportButton.className='btn bulk-highlight database-export-btn';exportButton.innerHTML='📊 Exportar dados';exportButton.onclick=()=>typeof openDataExportDialog==='function'&&openDataExportDialog()}
    if(bulkButton){bulkButton.className='btn bulk-highlight database-bulk-btn';bulkButton.innerHTML='📊 Atualização em massa';bulkButton.onclick=()=>typeof openBulkAssetUpdate==='function'&&openBulkAssetUpdate()}
  }
  function v206FinalizeDatabase(){
    v206RenderDistributionBrowser();
    v206StandardizeDatabaseActions();
    v206EnsureStandardBackButtons();
    if(typeof hydrateIcons==='function')hydrateIcons(main);
  }

  /*
   * v3.0.3: a inicialização de Distribuição ocorre no fim do render de Banco de Dados,
   * e não por observação contínua das mutações internas. Assim o navegador assume a tela
   * uma vez, os filtros passam a ser donos do próprio redraw e "Todos" usa a lista completa.
   */
  if(typeof renderDatabase==='function'){
    const v206BaseRenderDatabase=renderDatabase;
    renderDatabase=async function(...args){
      const result=await v206BaseRenderDatabase(...args);
      requestAnimationFrame(v206FinalizeDatabase);
      return result;
    };
  }
  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-db-family],[data-db-tel],[data-db-front]'))return;
    setTimeout(()=>requestAnimationFrame(v206FinalizeDatabase),0);
  });
  requestAnimationFrame(v206FinalizeDatabase);

})();
