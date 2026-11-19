(() => {
  'use strict';

  const TAB_LABELS = {
    estornos: 'Estornos e Transações',
    recompensas: 'Recompensas',
    metas: 'Metas',
    doacao: 'Doação',
    usuarios: 'Usuários'
  };

  const els = {
    userSessionBar: document.getElementById('user-session-bar'),
    userAvatar: document.getElementById('user-avatar'),
    userEmail: document.getElementById('user-email'),
    userRoleBadge: document.getElementById('user-role-badge'),
    logoutBtn: document.getElementById('logout-btn'),
    globalBanner: document.getElementById('global-banner'),
    loginView: document.getElementById('login-view'),
    googleSigninContainer: document.getElementById('google-signin-container'),
    googleConfigWarning: document.getElementById('google-config-warning'),
    loginError: document.getElementById('login-error'),
    dashboardView: document.getElementById('dashboard-view'),
    noTabsWarning: document.getElementById('no-tabs-warning'),
    tabsShell: document.getElementById('tabs-shell'),
    refundForm: document.getElementById('refund-form'),
    refundTid: document.getElementById('refund-tid'),
    refundValor: document.getElementById('refund-valor'),
    refundMotivo: document.getElementById('refund-motivo'),
    refundSubmitBtn: document.getElementById('refund-submit-btn'),
    refundResetBtn: document.getElementById('refund-reset-btn'),
    refundResult: document.getElementById('refund-result'),
    filterForm: document.getElementById('filter-form'),
    filterSearch: document.getElementById('filter-search'),
    filterStatus: document.getElementById('filter-status'),
    refreshTxBtn: document.getElementById('refresh-tx-btn'),
    txTbody: document.getElementById('tx-tbody'),
    refreshEstornosBtn: document.getElementById('refresh-estornos-btn'),
    estornosTbody: document.getElementById('estornos-tbody'),
    subtabUsuariosLista: document.getElementById('subtab-usuarios-lista'),
    subtabUsuariosCriar: document.getElementById('subtab-usuarios-criar'),
    subpanelUsuariosLista: document.getElementById('subpanel-usuarios-lista'),
    subpanelUsuariosCriar: document.getElementById('subpanel-usuarios-criar'),
    refreshAdminsBtn: document.getElementById('refresh-admins-btn'),
    goCreateUserBtn: document.getElementById('go-create-user-btn'),
    backToUsersListBtn: document.getElementById('back-to-users-list-btn'),
    createUserHeading: document.getElementById('create-user-heading'),
    createUserSubtitle: document.getElementById('create-user-subtitle'),
    addAdminForm: document.getElementById('add-admin-form'),
    newAdminEmail: document.getElementById('new-admin-email'),
    userRoleFieldset: document.getElementById('user-role-fieldset'),
    newUserRoleUser: document.getElementById('new-user-role-user'),
    newUserRoleAdminWrap: document.getElementById('new-user-role-admin-wrap'),
    newUserRoleAdmin: document.getElementById('new-user-role-admin'),
    userRoleAdminNote: document.getElementById('user-role-admin-note'),
    userTabsFieldset: document.getElementById('user-tabs-fieldset'),
    userTabsAdminAutoNote: document.getElementById('user-tabs-admin-auto-note'),
    selectAllTabsBtn: document.getElementById('select-all-tabs-btn'),
    clearAllTabsBtn: document.getElementById('clear-all-tabs-btn'),
    userTabsError: document.getElementById('user-tabs-error'),
    addAdminBtn: document.getElementById('add-admin-btn'),
    cancelEditUserBtn: document.getElementById('cancel-edit-user-btn'),
    resetUserFormBtn: document.getElementById('reset-user-form-btn'),
    userCreateResult: document.getElementById('user-create-result'),
    adminManageResult: document.getElementById('admin-manage-result'),
    adminsTbody: document.getElementById('admins-tbody'),
    permTabCheckboxes: Array.from(document.querySelectorAll('#user-tabs-fieldset input[name="allowed_tabs"]')),
    confirmDialog: document.getElementById('confirm-dialog'),
    confirmDialogTitle: document.getElementById('confirm-dialog-title'),
    confirmDialogMessage: document.getElementById('confirm-dialog-message'),
    confirmDialogSummary: document.getElementById('confirm-dialog-summary'),
    confirmDialogSubmit: document.getElementById('confirm-dialog-submit'),
    tabEstornos: document.getElementById('tab-estornos'),
    tabRecompensas: document.getElementById('tab-recompensas'),
    tabMetas: document.getElementById('tab-metas'),
    tabDoacao: document.getElementById('tab-doacao'),
    tabAdmins: document.getElementById('tab-admins'),
    panelEstornos: document.getElementById('panel-estornos'),
    panelRecompensas: document.getElementById('panel-recompensas'),
    panelMetas: document.getElementById('panel-metas'),
    panelDoacao: document.getElementById('panel-doacao'),
    panelAdmins: document.getElementById('panel-admins'),
    subtabCatalogo: document.getElementById('subtab-catalogo'),
    subtabEntregas: document.getElementById('subtab-entregas'),
    subpanelCatalogo: document.getElementById('subpanel-catalogo'),
    subpanelEntregas: document.getElementById('subpanel-entregas'),
    refreshTiersBtn: document.getElementById('refresh-tiers-btn'),
    tierForm: document.getElementById('tier-form'),
    tierName: document.getElementById('tier-name'),
    tierSlug: document.getElementById('tier-slug'),
    tierMinAmount: document.getElementById('tier-min-amount'),
    tierColor: document.getElementById('tier-color'),
    tierSortOrder: document.getElementById('tier-sort-order'),
    tierActive: document.getElementById('tier-active'),
    tierSubmitBtn: document.getElementById('tier-submit-btn'),
    tierCancelEditBtn: document.getElementById('tier-cancel-edit-btn'),
    tierResult: document.getElementById('tier-result'),
    tiersTbody: document.getElementById('tiers-tbody'),
    refreshRewardsBtn: document.getElementById('refresh-rewards-btn'),
    rewardForm: document.getElementById('reward-form'),
    rewardName: document.getElementById('reward-name'),
    rewardTier: document.getElementById('reward-tier'),
    rewardStock: document.getElementById('reward-stock'),
    rewardDescription: document.getElementById('reward-description'),
    rewardActive: document.getElementById('reward-active'),
    rewardSubmitBtn: document.getElementById('reward-submit-btn'),
    rewardCancelEditBtn: document.getElementById('reward-cancel-edit-btn'),
    rewardResult: document.getElementById('reward-result'),
    rewardsTbody: document.getElementById('rewards-tbody'),
    refreshDonorsBtn: document.getElementById('refresh-donors-btn'),
    deliveryForm: document.getElementById('delivery-form'),
    deliveryDonorFilter: document.getElementById('delivery-donor-filter'),
    deliveryDoadorHint: document.getElementById('delivery-doador-hint'),
    deliveryDoador: document.getElementById('delivery-doador'),
    deliveryReward: document.getElementById('delivery-reward'),
    deliveryQty: document.getElementById('delivery-qty'),
    deliveryDate: document.getElementById('delivery-date'),
    deliveryNotes: document.getElementById('delivery-notes'),
    deliverySubmitBtn: document.getElementById('delivery-submit-btn'),
    deliveryResetBtn: document.getElementById('delivery-reset-btn'),
    deliveryResult: document.getElementById('delivery-result'),
    refreshDeliveriesBtn: document.getElementById('refresh-deliveries-btn'),
    deliveriesFilterForm: document.getElementById('deliveries-filter-form'),
    deliveriesFilterSearch: document.getElementById('deliveries-filter-search'),
    deliveriesFilterReward: document.getElementById('deliveries-filter-reward'),
    deliveriesTbody: document.getElementById('deliveries-tbody'),
    goalsPublicUrl: document.getElementById('goals-public-url'),
    copyGoalsEndpointBtn: document.getElementById('copy-goals-endpoint-btn'),
    goalsCopyStatus: document.getElementById('goals-copy-status'),
    goalForm: document.getElementById('goal-form'),
    goalTitulo: document.getElementById('goal-titulo'),
    goalSlug: document.getElementById('goal-slug'),
    goalValorMeta: document.getElementById('goal-valor-meta'),
    goalValorInicial: document.getElementById('goal-valor-inicial'),
    goalCampanhaId: document.getElementById('goal-campanha-id'),
    goalOrdem: document.getElementById('goal-ordem'),
    goalDataInicio: document.getElementById('goal-data-inicio'),
    goalDataFim: document.getElementById('goal-data-fim'),
    goalDescricao: document.getElementById('goal-descricao'),
    goalDestaque: document.getElementById('goal-destaque'),
    goalAtiva: document.getElementById('goal-ativa'),
    goalSubmitBtn: document.getElementById('goal-submit-btn'),
    goalCancelEditBtn: document.getElementById('goal-cancel-edit-btn'),
    goalResult: document.getElementById('goal-result'),
    refreshGoalsBtn: document.getElementById('refresh-goals-btn'),
    goalsTbody: document.getElementById('goals-tbody'),
    donateForm: document.getElementById('donate-form'),
    donateValorReq: document.getElementById('donate-valor-req'),
    donateValor: document.getElementById('donate-valor'),
    donateCid: document.getElementById('donate-cid'),
    donateAnonimo: document.getElementById('donate-anonimo'),
    donateDonorFields: document.getElementById('donate-donor-fields'),
    donateNome: document.getElementById('donate-nome'),
    donateWhatsapp: document.getElementById('donate-whatsapp'),
    donateMensagem: document.getElementById('donate-mensagem'),
    donateCardSection: document.getElementById('donate-card-section'),
    donateCardNumber: document.getElementById('donate-card-number'),
    donateCardName: document.getElementById('donate-card-name'),
    donateCardExp: document.getElementById('donate-card-exp'),
    donateCardCsc: document.getElementById('donate-card-csc'),
    donateCardEmail: document.getElementById('donate-card-email'),
    donateCardBrand: document.getElementById('donate-card-brand'),
    donateInstallmentsWrap: document.getElementById('donate-installments-wrap'),
    donateParcelas: document.getElementById('donate-parcelas'),
    donateBillingAddress: document.getElementById('donate-billing-address'),
    donateBillingCity: document.getElementById('donate-billing-city'),
    donateBillingState: document.getElementById('donate-billing-state'),
    donateBillingPostal: document.getElementById('donate-billing-postal'),
    donateCryptoSection: document.getElementById('donate-crypto-section'),
    donateSubmitBtn: document.getElementById('donate-submit-btn'),
    donateResetBtn: document.getElementById('donate-reset-btn'),
    donateResult: document.getElementById('donate-result'),
    donateOutputCard: document.getElementById('donate-output-card'),
    donateOutputMessage: document.getElementById('donate-output-message'),
    donateCheckStatusBtn: document.getElementById('donate-check-status-btn'),
    donateSummary: document.getElementById('donate-summary'),
    donatePixBox: document.getElementById('donate-pix-box'),
    donatePixQr: document.getElementById('donate-pix-qr'),
    donatePixBrcode: document.getElementById('donate-pix-brcode'),
    donateCopyPixBtn: document.getElementById('donate-copy-pix-btn'),
    donate3dsBox: document.getElementById('donate-3ds-box'),
    donateOpen3dsBtn: document.getElementById('donate-open-3ds-btn'),
    donateCryptoBox: document.getElementById('donate-crypto-box'),
    donateCryptoNetwork: document.getElementById('donate-crypto-network'),
    donateCryptoQr: document.getElementById('donate-crypto-qr'),
    donateCryptoAddress: document.getElementById('donate-crypto-address'),
    donateCopyAddressBtn: document.getElementById('donate-copy-address-btn'),
    donateCryptoMemo: document.getElementById('donate-crypto-memo'),
    donateCopyMemoBtn: document.getElementById('donate-copy-memo-btn'),
    donateCheckMemoBtn: document.getElementById('donate-check-memo-btn'),
    donateHashForm: document.getElementById('donate-hash-form'),
    donateStellarHash: document.getElementById('donate-stellar-hash'),
    donateConfirmHashBtn: document.getElementById('donate-confirm-hash-btn'),
    donatePollStatus: document.getElementById('donate-poll-status')
  };

  let currentUser = null;
  let googleClientId = null;
  let googleInitialized = false;
  let editingTierSlug = null;
  let editingRewardId = null;
  let editingGoalId = null;
  let editingUserEmail = null;
  let tierSlugManuallyEdited = false;
  let goalSlugManuallyEdited = false;
  let allTiers = [];
  let allRewards = [];
  let allDonors = [];
  let allUsers = [];
  let currentDonation = null;
  let donationPollTimer = null;
  let donationPopupTimer = null;
  let mainTabsController = null;
  let usersSubtabsController = null;

  // =========================================================
  // Acessibilidade de validação (ARIA + fallback :user-invalid)
  // =========================================================
  const linkError = (el, shown) => {
    const errorId = el.dataset.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  };

  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.classList.add('visually-hidden');
  document.body.append(announcer);

  let announceTimer;
  let announcedField;

  const spokenText = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy
      .querySelectorAll('[role="img"][aria-label]')
      .forEach((n) => n.replaceWith(`${n.getAttribute('aria-label')}: `));
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };

  const announceError = (el) => {
    const error = document.getElementById(el.dataset.error);
    if (!error) return;
    const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = label + spokenText(error);
    }, 500);
  };

  const flagged = new WeakSet();
  const announced = new WeakSet();
  const supportsUserInvalid = typeof CSS !== 'undefined' && CSS.supports('selector(:user-invalid)');

  const syncAria = (el, announce = false) => {
    if (!el.matches?.('input, select, textarea')) return;
    const invalid = supportsUserInvalid
      ? el.matches(':user-invalid')
      : el.classList.contains('user-invalid-fallback');

    if (invalid) {
      if (announce && !announced.has(el)) {
        announceError(el);
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
  };

  const UserInvalidFallback = (() => {
    const dirtyState = new WeakMap();

    const updateState = (input) => {
      const isValid = input.validity.valid;
      input.classList.toggle('user-invalid-fallback', !isValid);
      input.classList.toggle('user-valid-fallback', isValid);
      syncAria(input, !isValid);
    };

    const handleEvent = (event) => {
      const input = event.target;
      if (event.type === 'reset') {
        const controls = input.elements || [];
        for (const control of controls) {
          dirtyState.delete(control);
          control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
          if (control.matches('input, select, textarea')) {
            control.setAttribute('aria-invalid', 'false');
          }
          if (control.dataset?.error) linkError(control, false);
        }
        return;
      }

      if (!input.checkValidity) return;

      if (event.type === 'invalid') {
        dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
        updateState(input);
        return;
      }

      if (event.type === 'input' || event.type === 'change') {
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        dirtyState.set(input, state);
        if (state.hasBlurred) updateState(input);
      } else if (event.type === 'blur') {
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(input, state);
        if (state.hasInteracted) updateState(input);
      }
    };

    const init = () => {
      if (supportsUserInvalid) return;
      document.addEventListener('blur', handleEvent, true);
      document.addEventListener('input', handleEvent);
      document.addEventListener('change', handleEvent);
      document.addEventListener('invalid', handleEvent, true);
      document.addEventListener('reset', handleEvent, true);
    };

    return { init };
  })();

  function initValidationListeners() {
    document.querySelectorAll('input, select, textarea').forEach((el) => syncAria(el));

    if (supportsUserInvalid) {
      document.addEventListener('blur', (e) => syncAria(e.target, true), true);
      document.addEventListener('input', (e) => {
        if (e.target.hasAttribute('aria-invalid')) syncAria(e.target);
      });
      document.addEventListener('change', (e) => syncAria(e.target, true), true);
      document.addEventListener(
        'invalid',
        (e) => {
          announced.add(e.target);
          syncAria(e.target);
        },
        true
      );
      document.addEventListener(
        'reset',
        (e) => {
          setTimeout(() => [...e.target.elements].forEach((el) => syncAria(el)));
        },
        true
      );
    } else {
      UserInvalidFallback.init();
    }
  }

  // =========================================================
  // Helpers de UI e formatação
  // =========================================================
  function showBanner(element, message, type = 'info') {
    element.textContent = message;
    element.classList.remove('banner-success', 'banner-warning', 'banner-error');
    if (type === 'success') element.classList.add('banner-success');
    else if (type === 'warning') element.classList.add('banner-warning');
    else if (type === 'error') element.classList.add('banner-error');
    element.hidden = false;
  }

  function hideBanner(element) {
    element.hidden = true;
    element.textContent = '';
    element.classList.remove('banner-success', 'banner-warning', 'banner-error');
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return 'Total';
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR');
  }

  function createStatusPill(status) {
    const span = document.createElement('span');
    const upper = String(status || '').toUpperCase();
    span.className = 'status-pill';
    span.textContent = status || '-';

    if (upper === 'CONFIRMADA' || upper === 'DONE') {
      span.classList.add('status-ok');
    } else if (
      upper === 'AGUARDANDO' ||
      upper === 'PENDENTE_3DS' ||
      upper === 'PROCESSING' ||
      upper === 'ESTORNO_PENDENTE'
    ) {
      span.classList.add('status-warn');
    } else if (upper === 'NEGADA' || upper === 'FAILED' || upper === 'DENIED' || upper === 'ESTORNADA') {
      span.classList.add('status-danger');
    }

    return span;
  }

  function parseOptionalValor(rawValue) {
    if (typeof rawValue !== 'string') return null;
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NaN;
    }
    return Math.round(parsed * 100) / 100;
  }

  function validateRefundValorInput() {
    const raw = els.refundValor.value.trim();
    if (!raw) {
      els.refundValor.setCustomValidity('');
      return;
    }
    const parsed = parseOptionalValor(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      els.refundValor.setCustomValidity('Informe um valor positivo maior que zero.');
    } else {
      els.refundValor.setCustomValidity('');
    }
  }

  function slugifyLocal(text) {
    if (typeof text !== 'string') return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 49);
  }

  function getTodayPlainDateISO() {
    if (typeof Temporal !== 'undefined' && Temporal.Now?.plainDateISO) {
      return Temporal.Now.plainDateISO().toString();
    }
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatPlainDate(isoDate) {
    if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim())) {
      return '-';
    }
    const clean = isoDate.trim();
    if (typeof Temporal !== 'undefined' && Temporal.PlainDate?.from) {
      try {
        return Temporal.PlainDate.from(clean).toLocaleString('pt-BR');
      } catch (_) {
        // fallback below
      }
    }
    const [year, month, day] = clean.split('-');
    return `${day}/${month}/${year}`;
  }

  function createColorDotSvg(hexColor) {
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(String(hexColor || '')) ? hexColor : '#6b7280';
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '12');
    svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '6');
    circle.setAttribute('cy', '6');
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', safeColor);
    svg.append(circle);
    return svg;
  }

  function initTabGroup(pairs) {
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    const supportsFocusGroup =
      typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'focusGroup');

    const activate = (selectedTab, shouldScroll = true) => {
      if (!selectedTab || selectedTab.hidden) return;
      for (const { tab, panel } of pairs) {
        const isSelected = tab === selectedTab && !tab.hidden;
        tab.setAttribute('aria-selected', String(isSelected));
        tab.toggleAttribute('focusgroupstart', isSelected);
        tab.tabIndex = isSelected ? 0 : -1;
        panel.hidden = !isSelected;
      }
      if (shouldScroll) {
        selectedTab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
      }
    };

    const syncVisibility = (allowedKeysSet) => {
      for (const { key, tab, panel } of pairs) {
        const isAllowed = !allowedKeysSet || !key || allowedKeysSet.has(key);
        tab.hidden = !isAllowed;
        if (!isAllowed) {
          tab.setAttribute('focusgroup', 'none');
          tab.setAttribute('aria-selected', 'false');
          tab.removeAttribute('focusgroupstart');
          tab.tabIndex = -1;
          panel.hidden = true;
        } else {
          tab.removeAttribute('focusgroup');
        }
      }

      const visiblePairs = pairs.filter(({ tab }) => !tab.hidden);
      const selectedVisible =
        visiblePairs.find(({ tab }) => tab.getAttribute('aria-selected') === 'true') || visiblePairs[0];
      if (selectedVisible) {
        activate(selectedVisible.tab, false);
      }
      return visiblePairs.map((p) => p.key).filter(Boolean);
    };

    const initialVisible = pairs.filter(({ tab }) => !tab.hidden);
    const initialPair =
      initialVisible.find(({ tab }) => tab.getAttribute('aria-selected') === 'true') || initialVisible[0];
    if (initialPair) {
      activate(initialPair.tab, false);
    }

    pairs.forEach(({ tab }) => {
      tab.addEventListener('click', () => activate(tab, true));

      if (!supportsFocusGroup) {
        tab.addEventListener('keydown', (event) => {
          const visiblePairs = pairs.filter(({ tab: candidate }) => !candidate.hidden);
          const currentIndex = visiblePairs.findIndex(({ tab: candidate }) => candidate === tab);
          if (currentIndex === -1 || visiblePairs.length === 0) return;

          let nextIndex = null;
          if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % visiblePairs.length;
          else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + visiblePairs.length) % visiblePairs.length;
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = visiblePairs.length - 1;

          if (nextIndex === null) return;
          event.preventDefault();
          const targetTab = visiblePairs[nextIndex].tab;
          visiblePairs.forEach((p) => {
            p.tab.tabIndex = p.tab === targetTab ? 0 : -1;
          });
          targetTab.focus();
          targetTab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
        });
      }
    });

    return { activate, syncVisibility };
  }

  /**
   * Modal nativo <dialog> para confirmações destrutivas.
   * Lê returnValue no evento close e o reseta imediatamente para evitar vazamento de estado.
   */
  function openConfirmDialog({ title, message, summaryItems = [], confirmLabel = 'Confirmar' }) {
    return new Promise((resolve) => {
      els.confirmDialogTitle.textContent = title;
      els.confirmDialogMessage.textContent = message;
      els.confirmDialogSubmit.textContent = confirmLabel;
      els.confirmDialogSummary.replaceChildren();

      for (const item of summaryItems) {
        const row = document.createElement('div');
        row.className = 'dialog-summary-row';

        const dt = document.createElement('dt');
        dt.textContent = item.label;

        const dd = document.createElement('dd');
        dd.textContent = item.value;

        row.append(dt, dd);
        els.confirmDialogSummary.append(row);
      }

      els.confirmDialog.addEventListener(
        'close',
        () => {
          const confirmed = els.confirmDialog.returnValue === 'confirm';
          els.confirmDialog.returnValue = '';
          resolve(confirmed);
        },
        { once: true }
      );

      els.confirmDialog.returnValue = '';
      els.confirmDialog.showModal();
    });
  }

  async function apiFetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      headers.set('X-Admin-Request', '1');
    }

    const response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: 'same-origin'
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : null;
    return { response, body };
  }

  function hasTab(tabKey) {
    if (!currentUser) return false;
    if (currentUser.isRoot || currentUser.role === 'root') return true;
    return Array.isArray(currentUser.allowedTabs) && currentUser.allowedTabs.includes(tabKey);
  }

  function canAccessUsersSection() {
    if (!currentUser) return false;
    return Boolean(currentUser.isRoot || currentUser.role === 'admin' || currentUser.isAdmin);
  }

  function isSessionInvalidResponse(response, body) {
    return response.status === 401 || (response.status === 403 && body?.code === 'ACCOUNT_UNAUTHORIZED');
  }

  async function refreshPostDonationData() {
    const tasks = [];
    if (hasTab('estornos')) tasks.push(loadTransactions());
    if (hasTab('metas')) tasks.push(loadGoals());
    if (hasTab('recompensas')) tasks.push(loadDonors());
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  function handleUnauthorized(message) {
    currentUser = null;
    els.dashboardView.hidden = true;
    els.userSessionBar.hidden = true;
    els.loginView.hidden = false;
    if (message) {
      showBanner(els.loginError, message, 'error');
    }
    initGoogleSignIn();
  }

  // =========================================================
  // Autenticação Google
  // =========================================================
  async function handleGoogleCredential(googleResponse) {
    hideBanner(els.loginError);
    if (!googleResponse || !googleResponse.credential) {
      showBanner(els.loginError, 'Não foi possível obter a credencial do Google.', 'error');
      return;
    }

    try {
      const { response, body } = await apiFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: googleResponse.credential })
      });

      if (!response.ok) {
        showBanner(els.loginError, body?.error || 'Falha na autenticação com o Google.', 'error');
        return;
      }

      setAuthenticatedUser(body.user);
      await loadDashboardData();
    } catch (error) {
      showBanner(els.loginError, 'Erro de conexão ao autenticar com o servidor.', 'error');
    }
  }

  function renderGoogleButton() {
    if (!googleClientId || !window.google?.accounts?.id) return false;

    if (!googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        auto_select: false
      });
      googleInitialized = true;
    }

    els.googleSigninContainer.replaceChildren();
    window.google.accounts.id.renderButton(els.googleSigninContainer, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      locale: 'pt-BR'
    });
    return true;
  }

  async function initGoogleSignIn() {
    try {
      if (!googleClientId) {
        const { response, body } = await apiFetch('/api/auth/google/config');
        if (!response.ok || !body?.enabled || !body.clientId) {
          els.googleConfigWarning.hidden = false;
          return;
        }
        googleClientId = body.clientId;
      }

      els.googleConfigWarning.hidden = true;
      if (renderGoogleButton()) return;

      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (renderGoogleButton() || attempts >= 50) {
          clearInterval(timer);
        }
      }, 100);
    } catch (_) {
      els.googleConfigWarning.hidden = false;
    }
  }

  function setAuthenticatedUser(user) {
    currentUser = user;
    hideBanner(els.loginError);
    hideBanner(els.globalBanner);

    els.userEmail.textContent = user.email;
    if (user.isRoot || user.role === 'root') {
      els.userRoleBadge.textContent = 'Root';
      els.userRoleBadge.className = 'role-badge is-root';
    } else if (user.role === 'admin' || user.isAdmin) {
      els.userRoleBadge.textContent = 'Admin';
      els.userRoleBadge.className = 'role-badge is-admin';
    } else {
      els.userRoleBadge.textContent = 'Usuário';
      els.userRoleBadge.className = 'role-badge is-user';
    }

    if (user.picture) {
      els.userAvatar.src = user.picture;
      els.userAvatar.alt = user.name || user.email;
      els.userAvatar.hidden = false;
    } else {
      els.userAvatar.hidden = true;
      els.userAvatar.removeAttribute('src');
    }

    const rawTabs = Array.isArray(user.allowedTabs) ? user.allowedTabs : [];
    const allowedSet = new Set(
      user.isRoot || user.role === 'root'
        ? ['estornos', 'recompensas', 'metas', 'doacao', 'usuarios']
        : rawTabs
    );
    if (!canAccessUsersSection()) {
      allowedSet.delete('usuarios');
    } else {
      allowedSet.add('usuarios');
    }

    const visibleKeys = mainTabsController ? mainTabsController.syncVisibility(allowedSet) : [];
    const hasNoTabs = visibleKeys.length === 0;
    els.noTabsWarning.hidden = !hasNoTabs;
    els.tabsShell.hidden = hasNoTabs;

    if (canAccessUsersSection()) {
      usersSubtabsController?.syncVisibility(new Set(['lista', 'criar']));
      usersSubtabsController?.activate(els.subtabUsuariosLista, false);
    } else {
      usersSubtabsController?.syncVisibility(new Set());
    }

    syncCreateUserFormPermissions();
    resetUserForm();

    els.userSessionBar.hidden = false;
    els.loginView.hidden = true;
    els.dashboardView.hidden = false;
  }

  async function checkSession() {
    try {
      const { response, body } = await apiFetch('/api/auth/admin/me');
      if (response.ok && body?.user) {
        setAuthenticatedUser(body.user);
        await loadDashboardData();
      } else {
        handleUnauthorized();
      }
    } catch (_) {
      handleUnauthorized();
    }
  }

  // =========================================================
  // Carregamento e renderização de tabelas
  // =========================================================
  function renderEmptyRow(tbody, colSpan, message) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.className = 'empty-cell';
    td.textContent = message;
    tr.append(td);
    tbody.replaceChildren(tr);
  }

  async function loadTransactions() {
    const params = new URLSearchParams();
    params.set('limit', '25');
    if (els.filterSearch.value.trim()) params.set('search', els.filterSearch.value.trim());
    if (els.filterStatus.value) params.set('status', els.filterStatus.value);

    const { response, body } = await apiFetch(`/api/admin/transacoes?${params.toString()}`);
    if (isSessionInvalidResponse(response, body)) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      renderEmptyRow(els.txTbody, 7, body?.error || 'Erro ao carregar transações.');
      return;
    }

    const rows = Array.isArray(body?.data) ? body.data : [];
    if (rows.length === 0) {
      renderEmptyRow(els.txTbody, 7, 'Nenhuma transação e-Rede encontrada.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      th.className = 'mono-cell';
      th.textContent = row.tid || 'Sem TID';
      const subTxid = document.createElement('span');
      subTxid.className = 'sub-meta';
      subTxid.textContent = `TXID: ${row.txid}`;
      th.append(subTxid);

      const tdValor = document.createElement('td');
      tdValor.textContent = formatCurrency(row.valor);
      if (Number(row.total_estornado) > 0) {
        const subEst = document.createElement('span');
        subEst.className = 'sub-meta';
        subEst.textContent = `Estornado: ${formatCurrency(row.total_estornado)}`;
        tdValor.append(subEst);
      }

      const tdMetodo = document.createElement('td');
      const metodoParts = [row.tipo_pagamento || '-'];
      if (row.bandeira_cartao) metodoParts.push(row.bandeira_cartao);
      if (row.parcelas && Number(row.parcelas) > 1) metodoParts.push(`${row.parcelas}x`);
      tdMetodo.textContent = metodoParts.join(' · ');

      const tdStatus = document.createElement('td');
      tdStatus.append(createStatusPill(row.status));

      const tdDoador = document.createElement('td');
      tdDoador.textContent = row.doador_nome || 'Anônimo';

      const tdData = document.createElement('td');
      tdData.textContent = formatDate(row.criado_em);

      const tdAcao = document.createElement('td');
      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'btn btn-secondary btn-sm';
      useBtn.textContent = 'Usar TID';
      useBtn.disabled = !row.tid;
      if (row.tid) {
        useBtn.addEventListener('click', () => {
          els.refundTid.value = row.tid;
          els.refundTid.setCustomValidity('');
          syncAria(els.refundTid);
          els.refundTid.focus();
          els.refundForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      tdAcao.append(useBtn);

      tr.append(th, tdValor, tdMetodo, tdStatus, tdDoador, tdData, tdAcao);
      fragment.append(tr);
    }

    els.txTbody.replaceChildren(fragment);
  }

  async function loadEstornos() {
    const { response, body } = await apiFetch('/api/admin/estornos?limit=30');
    if (isSessionInvalidResponse(response, body)) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      renderEmptyRow(els.estornosTbody, 6, body?.error || 'Erro ao carregar histórico de estornos.');
      return;
    }

    const rows = Array.isArray(body?.data) ? body.data : [];
    if (rows.length === 0) {
      renderEmptyRow(els.estornosTbody, 6, 'Nenhum estorno registrado até o momento.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      th.className = 'mono-cell';
      th.textContent = row.tid;
      if (row.refund_id || row.cancel_id) {
        const subRef = document.createElement('span');
        subRef.className = 'sub-meta';
        subRef.textContent = row.refund_id ? `Refund: ${row.refund_id}` : `Cancel D+1: ${row.cancel_id}`;
        th.append(subRef);
      }

      const tdValor = document.createElement('td');
      tdValor.textContent = row.valor_estornado ? formatCurrency(row.valor_estornado) : 'Total';
      const subTipo = document.createElement('span');
      subTipo.className = 'sub-meta';
      subTipo.textContent = row.estorno_total ? 'Estorno total' : 'Estorno parcial';
      tdValor.append(subTipo);

      const tdStatus = document.createElement('td');
      tdStatus.append(createStatusPill(row.status));

      const tdAdmin = document.createElement('td');
      tdAdmin.textContent = row.admin_email;

      const tdMotivo = document.createElement('td');
      tdMotivo.textContent = row.motivo || '-';

      const tdData = document.createElement('td');
      tdData.textContent = formatDate(row.criado_em);

      tr.append(th, tdValor, tdStatus, tdAdmin, tdMotivo, tdData);
      fragment.append(tr);
    }

    els.estornosTbody.replaceChildren(fragment);
  }

  async function loadAdmins() {
    if (!canAccessUsersSection()) {
      els.adminsTbody.replaceChildren();
      return;
    }

    const { response, body } = await apiFetch('/api/admin/admins');
    if (isSessionInvalidResponse(response, body)) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      renderEmptyRow(els.adminsTbody, 5, body?.error || 'Erro ao carregar usuários.');
      return;
    }

    allUsers = Array.isArray(body?.admins) ? body.admins : [];
    if (allUsers.length === 0) {
      renderEmptyRow(els.adminsTbody, 5, 'Nenhum usuário cadastrado.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const userRecord of allUsers) {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = userRecord.email;
      const subSource = document.createElement('span');
      subSource.className = 'sub-meta';
      subSource.textContent =
        userRecord.source === 'root'
          ? 'Sistema (root)'
          : userRecord.source === 'env'
            ? 'Variável de ambiente'
            : 'Banco de dados';
      th.append(subSource);

      const tdRole = document.createElement('td');
      const roleSpan = document.createElement('span');
      if (userRecord.role === 'root') {
        roleSpan.className = 'role-badge is-root';
        roleSpan.textContent = 'Root';
      } else if (userRecord.role === 'admin') {
        roleSpan.className = 'role-badge is-admin';
        roleSpan.textContent = 'Admin';
      } else {
        roleSpan.className = 'role-badge is-user';
        roleSpan.textContent = 'Usuário';
      }
      tdRole.append(roleSpan);

      const tdTabs = document.createElement('td');
      const tabsWrap = document.createElement('div');
      tabsWrap.className = 'tab-badges-list';
      if (userRecord.role === 'root') {
        const allBadge = document.createElement('span');
        allBadge.className = 'tab-badge';
        allBadge.textContent = 'Todas as abas';
        tabsWrap.append(allBadge);
      } else {
        const tabs = Array.isArray(userRecord.allowedTabs) ? userRecord.allowedTabs : [];
        if (tabs.length === 0) {
          const noneSpan = document.createElement('span');
          noneSpan.className = 'sub-meta';
          noneSpan.textContent = 'Nenhuma';
          tabsWrap.append(noneSpan);
        } else {
          for (const tabKey of tabs) {
            const badge = document.createElement('span');
            badge.className = 'tab-badge';
            badge.textContent = TAB_LABELS[tabKey] || tabKey;
            tabsWrap.append(badge);
          }
        }
      }
      tdTabs.append(tabsWrap);

      const tdCreatedBy = document.createElement('td');
      tdCreatedBy.textContent = userRecord.created_by || '-';

      const tdAcao = document.createElement('td');
      const isSelf =
        Boolean(currentUser?.email) && userRecord.email.toLowerCase() === currentUser.email.toLowerCase();
      if (userRecord.role === 'root') {
        tdAcao.textContent = 'Protegido';
      } else if (isSelf) {
        tdAcao.textContent = 'Sua conta';
      } else if (userRecord.role === 'admin' && !currentUser?.isRoot) {
        tdAcao.textContent = 'Somente root';
      } else {
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'row-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary btn-sm';
        editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', () => startEditUser(userRecord));

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-danger btn-sm';
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', () => handleRemoveAdmin(userRecord));

        actionsWrap.append(editBtn, removeBtn);
        tdAcao.append(actionsWrap);
      }

      tr.append(th, tdRole, tdTabs, tdCreatedBy, tdAcao);
      fragment.append(tr);
    }

    els.adminsTbody.replaceChildren(fragment);
  }

  async function loadDashboardData() {
    const tasks = [];
    if (hasTab('estornos')) {
      tasks.push(loadTransactions(), loadEstornos());
    }
    if (hasTab('recompensas')) {
      tasks.push(loadRewardTiers(), loadRewards(), loadDonors(), loadDeliveries());
    }
    if (hasTab('metas')) {
      tasks.push(loadGoals());
    }
    if (canAccessUsersSection()) {
      tasks.push(loadAdmins());
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  // =========================================================
  // Recompensas, Tiers, Recipientes e Entregas
  // =========================================================
  function renderTierSelectors() {
    const currentRewardTier = els.rewardTier.value;
    els.rewardTier.replaceChildren();

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Selecione um tier';
    els.rewardTier.append(defaultOpt);

    for (const tier of allTiers) {
      const opt = document.createElement('option');
      opt.value = tier.slug;
      opt.textContent = `${tier.name} (mín. ${formatCurrency(tier.min_amount)})${tier.active ? '' : ' [Inativo]'}`;
      els.rewardTier.append(opt);
    }

    if (currentRewardTier && allTiers.some((t) => t.slug === currentRewardTier)) {
      els.rewardTier.value = currentRewardTier;
    }
  }

  function renderRewardSelectors() {
    const selectedDeliveryReward = els.deliveryReward.value;
    const selectedFilterReward = els.deliveriesFilterReward.value;

    els.deliveryReward.replaceChildren();
    const deliveryDefault = document.createElement('option');
    deliveryDefault.value = '';
    deliveryDefault.textContent = 'Selecione uma recompensa';
    els.deliveryReward.append(deliveryDefault);

    els.deliveriesFilterReward.replaceChildren();
    const filterDefault = document.createElement('option');
    filterDefault.value = '';
    filterDefault.textContent = 'Todas as recompensas';
    els.deliveriesFilterReward.append(filterDefault);

    for (const reward of allRewards) {
      const availText =
        reward.quantidade_disponivel === null || reward.quantidade_disponivel === undefined
          ? 'Ilimitada'
          : `Disponível: ${reward.quantidade_disponivel}`;

      const opt = document.createElement('option');
      opt.value = String(reward.id);
      opt.textContent = `${reward.name} (${reward.tier_name} · ${availText})${reward.active ? '' : ' [Inativa]'}`;
      els.deliveryReward.append(opt);

      const fOpt = document.createElement('option');
      fOpt.value = String(reward.id);
      fOpt.textContent = `${reward.name} (${reward.tier_name})`;
      els.deliveriesFilterReward.append(fOpt);
    }

    if (selectedDeliveryReward && allRewards.some((r) => String(r.id) === selectedDeliveryReward)) {
      els.deliveryReward.value = selectedDeliveryReward;
    }
    if (selectedFilterReward && allRewards.some((r) => String(r.id) === selectedFilterReward)) {
      els.deliveriesFilterReward.value = selectedFilterReward;
    }
  }

  function formatDonorOptionLabel(donor) {
    const nome = donor.anonimo === false && donor.nome ? donor.nome : 'Doador anônimo';
    const parts = [`#${donor.id}`, nome];
    if (Number(donor.total_doado) > 0) parts.push(formatCurrency(donor.total_doado));
    if (donor.whatsapp) parts.push(donor.whatsapp);
    return parts.join(' · ');
  }

  function renderDonorOptions() {
    const previousValue = els.deliveryDoador.value;
    const query = els.deliveryDonorFilter.value.trim().toLowerCase();

    const filtered = query
      ? allDonors.filter((donor) => {
          const nome = String(donor.nome || '').toLowerCase();
          const whatsapp = String(donor.whatsapp || '').toLowerCase();
          const idStr = String(donor.id);
          return nome.includes(query) || whatsapp.includes(query) || idStr === query;
        })
      : allDonors;

    els.deliveryDoador.replaceChildren();
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = filtered.length > 0 ? 'Selecione um doador' : 'Nenhum doador encontrado';
    els.deliveryDoador.append(defaultOpt);

    for (const donor of filtered) {
      const opt = document.createElement('option');
      opt.value = String(donor.id);
      opt.textContent = formatDonorOptionLabel(donor);
      els.deliveryDoador.append(opt);
    }

    if (previousValue && filtered.some((d) => String(d.id) === previousValue)) {
      els.deliveryDoador.value = previousValue;
    }

    els.deliveryDoadorHint.textContent =
      allDonors.length === 0
        ? 'Nenhum doador cadastrado na tabela doadores.'
        : `${filtered.length} doador(es) exibido(s) de ${allDonors.length} carregado(s).`;
  }

  async function loadRewardTiers() {
    const { response, body } = await apiFetch('/api/admin/rewards/tiers');
    if (isSessionInvalidResponse(response, body)) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      renderEmptyRow(els.tiersTbody, 5, body?.error || 'Erro ao carregar tiers.');
      return;
    }

    allTiers = Array.isArray(body?.data) ? body.data : [];
    renderTierSelectors();

    if (allTiers.length === 0) {
      renderEmptyRow(els.tiersTbody, 5, 'Nenhum tier cadastrado.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const tier of allTiers) {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      const pill = document.createElement('span');
      pill.className = 'tier-pill';
      pill.append(createColorDotSvg(tier.color), document.createTextNode(tier.name));
      const subSlug = document.createElement('span');
      subSlug.className = 'sub-meta';
      subSlug.textContent = `slug: ${tier.slug} · ordem: ${tier.sort_order}`;
      th.append(pill, subSlug);

      const tdMin = document.createElement('td');
      tdMin.textContent = formatCurrency(tier.min_amount);

      const tdCount = document.createElement('td');
      tdCount.textContent = String(tier.rewards_count ?? 0);

      const tdStatus = document.createElement('td');
      const statusSpan = document.createElement('span');
      statusSpan.className = `status-pill ${tier.active ? 'status-ok' : 'status-danger'}`;
      statusSpan.textContent = tier.active ? 'Ativo' : 'Inativo';
      tdStatus.append(statusSpan);

      const tdActions = document.createElement('td');
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'row-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-secondary btn-sm';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => startEditTier(tier));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Excluir';
      deleteBtn.addEventListener('click', () => handleDeleteTier(tier));

      actionsWrap.append(editBtn, deleteBtn);
      tdActions.append(actionsWrap);

      tr.append(th, tdMin, tdCount, tdStatus, tdActions);
      fragment.append(tr);
    }

    els.tiersTbody.replaceChildren(fragment);
  }

  async function loadRewards() {
    const { response, body } = await apiFetch('/api/admin/rewards');
    if (isSessionInvalidResponse(response, body)) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      renderEmptyRow(els.rewardsTbody, 6, body?.error || 'Erro ao carregar recompensas.');
      return;
    }

    allRewards = Array.isArray(body?.data) ? body.data : [];
    renderRewardSelectors();

    if (allRewards.length === 0) {
      renderEmptyRow(els.rewardsTbody, 6, 'Nenhuma recompensa cadastrada.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const reward of allRewards) {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = reward.name;
      if (reward.description) {
        const subDesc = document.createElement('span');
        subDesc.className = 'sub-meta';
        subDesc.textContent = reward.description;
        th.append(subDesc);
      }

      const tdTier = document.createElement('td');
      const tierPill = document.createElement('span');
      tierPill.className = 'tier-pill';
      tierPill.append(createColorDotSvg(reward.tier_color), document.createTextNode(reward.tier_name));
      tdTier.append(tierPill);

      const tdStock = document.createElement('td');
      if (reward.quantidade_disponivel === null || reward.quantidade_disponivel === undefined) {
        tdStock.textContent = 'Ilimitada';
      } else {
        const stockSpan = document.createElement('span');
        stockSpan.className = `status-pill ${reward.quantidade_disponivel === 0 ? 'status-danger' : 'status-ok'}`;
        stockSpan.textContent = String(reward.quantidade_disponivel);
        tdStock.append(stockSpan);
      }

      const tdDelivered = document.createElement('td');
      tdDelivered.textContent = String(reward.quantidade_entregue ?? 0);

      const tdStatus = document.createElement('td');
      const statusSpan = document.createElement('span');
      statusSpan.className = `status-pill ${reward.active ? 'status-ok' : 'status-danger'}`;
      statusSpan.textContent = reward.active ? 'Ativa' : 'Inativa';
      tdStatus.append(statusSpan);

      const tdActions = document.createElement('td');
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'row-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-secondary btn-sm';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => startEditReward(reward));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Excluir';
      deleteBtn.addEventListener('click', () => handleDeleteReward(reward));

      actionsWrap.append(editBtn, deleteBtn);
      tdActions.append(actionsWrap);

      tr.append(th, tdTier, tdStock, tdDelivered, tdStatus, tdActions);
      fragment.append(tr);
    }

    els.rewardsTbody.replaceChildren(fragment);
  }

  async function loadDonors() {
    const { response, body } = await apiFetch('/api/admin/doadores?limit=300');
    if (isSessionInvalidResponse(response, body)) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      els.deliveryDoadorHint.textContent = body?.error || 'Erro ao carregar doadores.';
      return;
    }

    allDonors = Array.isArray(body?.data) ? body.data : [];
    renderDonorOptions();
  }

  async function loadDeliveries() {
    const params = new URLSearchParams();
    params.set('limit', '50');
    if (els.deliveriesFilterSearch.value.trim()) {
      params.set('search', els.deliveriesFilterSearch.value.trim());
    }
    if (els.deliveriesFilterReward.value) {
      params.set('reward_id', els.deliveriesFilterReward.value);
    }

    const { response, body } = await apiFetch(`/api/admin/rewards/deliveries?${params.toString()}`);
    if (isSessionInvalidResponse(response, body)) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      renderEmptyRow(els.deliveriesTbody, 6, body?.error || 'Erro ao carregar entregas.');
      return;
    }

    const rows = Array.isArray(body?.data) ? body.data : [];
    if (rows.length === 0) {
      renderEmptyRow(els.deliveriesTbody, 6, 'Nenhuma entrega de recompensa registrada.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement('tr');

      const thDate = document.createElement('th');
      thDate.scope = 'row';
      thDate.textContent = formatPlainDate(row.data_entrega);
      const subId = document.createElement('span');
      subId.className = 'sub-meta';
      subId.textContent = `Registro #${row.id}`;
      thDate.append(subId);

      const tdDonor = document.createElement('td');
      const donorLabel = row.doador_anonimo === false && row.doador_nome
        ? row.doador_nome
        : `Doador anônimo (#${row.doador_id})`;
      tdDonor.textContent = donorLabel;
      const subDonor = document.createElement('span');
      subDonor.className = 'sub-meta';
      subDonor.textContent = `#${row.doador_id}${row.doador_whatsapp ? ` · ${row.doador_whatsapp}` : ''}`;
      tdDonor.append(subDonor);

      const tdReward = document.createElement('td');
      tdReward.textContent = row.reward_name;
      const subTier = document.createElement('span');
      subTier.className = 'sub-meta';
      subTier.textContent = row.tier_name;
      tdReward.append(subTier);

      const tdQty = document.createElement('td');
      tdQty.textContent = String(row.quantidade);

      const tdNotes = document.createElement('td');
      tdNotes.textContent = row.observacoes || '-';
      const subAdmin = document.createElement('span');
      subAdmin.className = 'sub-meta';
      subAdmin.textContent = `Por: ${row.registrado_por}`;
      tdNotes.append(subAdmin);

      const tdAction = document.createElement('td');
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-danger btn-sm';
      removeBtn.textContent = 'Remover';
      removeBtn.addEventListener('click', () => handleDeleteDelivery(row));
      tdAction.append(removeBtn);

      tr.append(thDate, tdDonor, tdReward, tdQty, tdNotes, tdAction);
      fragment.append(tr);
    }

    els.deliveriesTbody.replaceChildren(fragment);
  }

  function resetTierForm() {
    editingTierSlug = null;
    tierSlugManuallyEdited = false;
    els.tierForm.reset();
    els.tierSlug.readOnly = false;
    els.tierColor.value = '#cd7f32';
    els.tierSortOrder.value = '0';
    els.tierActive.checked = true;
    els.tierSubmitBtn.textContent = 'Cadastrar tier';
    els.tierCancelEditBtn.hidden = true;
    [els.tierName, els.tierSlug, els.tierMinAmount, els.tierSortOrder].forEach((el) => {
      el.setCustomValidity('');
      syncAria(el);
    });
  }

  function startEditTier(tier) {
    hideBanner(els.tierResult);
    editingTierSlug = tier.slug;
    tierSlugManuallyEdited = true;
    els.tierName.value = tier.name;
    els.tierSlug.value = tier.slug;
    els.tierSlug.readOnly = true;
    els.tierMinAmount.value = String(tier.min_amount);
    els.tierColor.value = /^#[0-9a-fA-F]{6}$/.test(tier.color || '') ? tier.color : '#6b7280';
    els.tierSortOrder.value = String(tier.sort_order ?? 0);
    els.tierActive.checked = Boolean(tier.active);
    els.tierSubmitBtn.textContent = 'Salvar alterações';
    els.tierCancelEditBtn.hidden = false;
    [els.tierName, els.tierSlug, els.tierMinAmount, els.tierSortOrder].forEach((el) => {
      el.setCustomValidity('');
      syncAria(el);
    });
    els.tierForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    els.tierName.focus();
  }

  async function handleTierSubmit(event) {
    event.preventDefault();
    hideBanner(els.tierResult);

    const minVal = Number(els.tierMinAmount.value.trim().replace(',', '.'));
    if (!Number.isFinite(minVal) || minVal < 0) {
      els.tierMinAmount.setCustomValidity('Informe um valor maior ou igual a 0.');
      els.tierMinAmount.reportValidity();
      return;
    }

    const payload = {
      name: els.tierName.value.trim(),
      slug: els.tierSlug.value.trim().toLowerCase(),
      min_amount: Math.round(minVal * 100) / 100,
      color: els.tierColor.value,
      sort_order: parseInt(els.tierSortOrder.value.trim() || '0', 10),
      active: els.tierActive.checked
    };

    els.tierSubmitBtn.disabled = true;
    try {
      const isEdit = Boolean(editingTierSlug);
      const url = isEdit
        ? `/api/admin/rewards/tiers/${encodeURIComponent(editingTierSlug)}`
        : '/api/admin/rewards/tiers';
      const { response, body } = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }
      if (!response.ok) {
        showBanner(els.tierResult, body?.error || 'Não foi possível salvar o tier.', 'error');
        return;
      }

      showBanner(
        els.tierResult,
        isEdit ? `Tier "${body.tier.name}" atualizado com sucesso.` : `Tier "${body.tier.name}" cadastrado com sucesso.`,
        'success'
      );
      resetTierForm();
      await Promise.all([loadRewardTiers(), loadRewards()]);
    } catch (_) {
      showBanner(els.tierResult, 'Erro de comunicação ao salvar o tier.', 'error');
    } finally {
      els.tierSubmitBtn.disabled = false;
    }
  }

  async function handleDeleteTier(tier) {
    hideBanner(els.tierResult);
    const confirmed = await openConfirmDialog({
      title: 'Excluir tier de recompensa',
      message: 'Só é possível excluir tiers que não possuam recompensas vinculadas.',
      confirmLabel: 'Excluir tier',
      summaryItems: [
        { label: 'Tier', value: tier.name },
        { label: 'Slug', value: tier.slug },
        { label: 'Valor mínimo', value: formatCurrency(tier.min_amount) }
      ]
    });
    if (!confirmed) return;

    try {
      const { response, body } = await apiFetch(`/api/admin/rewards/tiers/${encodeURIComponent(tier.slug)}`, {
        method: 'DELETE'
      });
      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }
      if (!response.ok) {
        showBanner(els.tierResult, body?.error || 'Não foi possível excluir o tier.', 'error');
        return;
      }
      if (editingTierSlug === tier.slug) resetTierForm();
      showBanner(els.tierResult, `Tier "${tier.name}" excluído.`, 'success');
      await Promise.all([loadRewardTiers(), loadRewards()]);
    } catch (_) {
      showBanner(els.tierResult, 'Erro de comunicação ao excluir o tier.', 'error');
    }
  }

  function resetRewardForm() {
    editingRewardId = null;
    els.rewardForm.reset();
    els.rewardActive.checked = true;
    els.rewardSubmitBtn.textContent = 'Cadastrar recompensa';
    els.rewardCancelEditBtn.hidden = true;
    [els.rewardName, els.rewardTier, els.rewardStock, els.rewardDescription].forEach((el) => {
      el.setCustomValidity('');
      syncAria(el);
    });
  }

  function startEditReward(reward) {
    hideBanner(els.rewardResult);
    editingRewardId = reward.id;
    els.rewardName.value = reward.name;
    els.rewardTier.value = reward.tier_slug;
    els.rewardStock.value =
      reward.quantidade_disponivel === null || reward.quantidade_disponivel === undefined
        ? ''
        : String(reward.quantidade_disponivel);
    els.rewardDescription.value = reward.description || '';
    els.rewardActive.checked = Boolean(reward.active);
    els.rewardSubmitBtn.textContent = 'Salvar alterações';
    els.rewardCancelEditBtn.hidden = false;
    [els.rewardName, els.rewardTier, els.rewardStock, els.rewardDescription].forEach((el) => {
      el.setCustomValidity('');
      syncAria(el);
    });
    els.rewardForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    els.rewardName.focus();
  }

  async function handleRewardSubmit(event) {
    event.preventDefault();
    hideBanner(els.rewardResult);

    const stockRaw = els.rewardStock.value.trim();
    const payload = {
      name: els.rewardName.value.trim(),
      tier_slug: els.rewardTier.value,
      quantidade_disponivel: stockRaw === '' ? null : parseInt(stockRaw, 10),
      description: els.rewardDescription.value.trim(),
      active: els.rewardActive.checked
    };

    els.rewardSubmitBtn.disabled = true;
    try {
      const isEdit = editingRewardId !== null;
      const url = isEdit ? `/api/admin/rewards/${editingRewardId}` : '/api/admin/rewards';
      const { response, body } = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }
      if (!response.ok) {
        showBanner(els.rewardResult, body?.error || 'Não foi possível salvar a recompensa.', 'error');
        return;
      }

      showBanner(
        els.rewardResult,
        isEdit
          ? `Recompensa "${body.reward.name}" atualizada com sucesso.`
          : `Recompensa "${body.reward.name}" cadastrada com sucesso.`,
        'success'
      );
      resetRewardForm();
      await Promise.all([loadRewardTiers(), loadRewards(), loadDeliveries()]);
    } catch (_) {
      showBanner(els.rewardResult, 'Erro de comunicação ao salvar a recompensa.', 'error');
    } finally {
      els.rewardSubmitBtn.disabled = false;
    }
  }

  async function handleDeleteReward(reward) {
    hideBanner(els.rewardResult);
    const confirmed = await openConfirmDialog({
      title: 'Excluir recompensa',
      message: 'Recompensas que já tenham entregas registradas não podem ser excluídas (desative-as em vez disso).',
      confirmLabel: 'Excluir recompensa',
      summaryItems: [
        { label: 'Recompensa', value: reward.name },
        { label: 'Tier', value: reward.tier_name },
        {
          label: 'Disponível',
          value: reward.quantidade_disponivel === null ? 'Ilimitada' : String(reward.quantidade_disponivel)
        }
      ]
    });
    if (!confirmed) return;

    try {
      const { response, body } = await apiFetch(`/api/admin/rewards/${reward.id}`, { method: 'DELETE' });
      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }
      if (!response.ok) {
        showBanner(els.rewardResult, body?.error || 'Não foi possível excluir a recompensa.', 'error');
        return;
      }
      if (editingRewardId === reward.id) resetRewardForm();
      showBanner(els.rewardResult, `Recompensa "${reward.name}" excluída.`, 'success');
      await Promise.all([loadRewardTiers(), loadRewards()]);
    } catch (_) {
      showBanner(els.rewardResult, 'Erro de comunicação ao excluir a recompensa.', 'error');
    }
  }

  function resetDeliveryForm() {
    els.deliveryForm.reset();
    els.deliveryQty.value = '1';
    els.deliveryDate.value = getTodayPlainDateISO();
    renderDonorOptions();
    [els.deliveryDoador, els.deliveryReward, els.deliveryQty, els.deliveryDate, els.deliveryNotes].forEach((el) => {
      el.setCustomValidity('');
      syncAria(el);
    });
  }

  async function handleDeliverySubmit(event) {
    event.preventDefault();
    hideBanner(els.deliveryResult);

    const payload = {
      doador_id: parseInt(els.deliveryDoador.value, 10),
      reward_id: parseInt(els.deliveryReward.value, 10),
      quantidade: parseInt(els.deliveryQty.value.trim(), 10),
      data_entrega: els.deliveryDate.value,
      observacoes: els.deliveryNotes.value.trim()
    };

    els.deliverySubmitBtn.disabled = true;
    try {
      const { response, body } = await apiFetch('/api/admin/rewards/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }
      if (!response.ok) {
        showBanner(els.deliveryResult, body?.error || 'Não foi possível registrar a entrega.', 'error');
        return;
      }

      const d = body.delivery;
      const saldoMsg =
        d.reward_quantidade_disponivel === null || d.reward_quantidade_disponivel === undefined
          ? ''
          : ` Saldo disponível restante: ${d.reward_quantidade_disponivel}.`;
      showBanner(
        els.deliveryResult,
        `Entrega registrada: ${d.quantidade}x "${d.reward_name}" em ${formatPlainDate(d.data_entrega)}.${saldoMsg}`,
        'success'
      );
      resetDeliveryForm();
      await Promise.all([loadRewards(), loadDonors(), loadDeliveries()]);
    } catch (_) {
      showBanner(els.deliveryResult, 'Erro de comunicação ao registrar a entrega.', 'error');
    } finally {
      els.deliverySubmitBtn.disabled = false;
    }
  }

  async function handleDeleteDelivery(delivery) {
    hideBanner(els.deliveryResult);
    const donorName = delivery.doador_anonimo === false && delivery.doador_nome
      ? delivery.doador_nome
      : `Doador anônimo (#${delivery.doador_id})`;

    const confirmed = await openConfirmDialog({
      title: 'Remover registro de entrega',
      message: 'Ao remover esta entrega, a quantidade correspondente será devolvida ao estoque disponível da recompensa (se finito).',
      confirmLabel: 'Remover entrega',
      summaryItems: [
        { label: 'Data de entrega', value: formatPlainDate(delivery.data_entrega) },
        { label: 'Recipiente', value: donorName },
        { label: 'Recompensa', value: delivery.reward_name },
        { label: 'Quantidade', value: String(delivery.quantidade) }
      ]
    });
    if (!confirmed) return;

    try {
      const { response, body } = await apiFetch(`/api/admin/rewards/deliveries/${delivery.id}`, {
        method: 'DELETE'
      });
      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }
      if (!response.ok) {
        showBanner(els.deliveryResult, body?.error || 'Não foi possível remover o registro de entrega.', 'error');
        return;
      }
      showBanner(els.deliveryResult, 'Entrega removida e estoque restaurado.', 'success');
      await Promise.all([loadRewards(), loadDonors(), loadDeliveries()]);
    } catch (_) {
      showBanner(els.deliveryResult, 'Erro de comunicação ao remover a entrega.', 'error');
    }
  }

  // =========================================================
  // Metas de Doação
  // =========================================================
  async function copyUrlWithFeedback(pathOrUrl, label) {
    const fullUrl = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${window.location.origin}${pathOrUrl}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        throw new Error('Clipboard API indisponível');
      }
      showBanner(els.goalsCopyStatus, `${label}: ${fullUrl} copiado para a área de transferência.`, 'success');
    } catch (_) {
      showBanner(els.goalsCopyStatus, `URL disponível: ${fullUrl}`, 'info');
    }
  }

  function validateGoalDatesInput() {
    const start = els.goalDataInicio.value;
    const end = els.goalDataFim.value;
    if (start && end && end < start) {
      els.goalDataFim.setCustomValidity('A data limite deve ser igual ou posterior à data inicial.');
    } else {
      els.goalDataFim.setCustomValidity('');
    }
  }

  function validateGoalAmountsInput() {
    const metaRaw = els.goalValorMeta.value.trim();
    if (metaRaw) {
      const metaVal = Number(metaRaw.replace(',', '.'));
      if (!Number.isFinite(metaVal) || metaVal <= 0) {
        els.goalValorMeta.setCustomValidity('Informe um valor maior que zero.');
      } else {
        els.goalValorMeta.setCustomValidity('');
      }
    } else {
      els.goalValorMeta.setCustomValidity('');
    }

    const initRaw = els.goalValorInicial.value.trim();
    if (initRaw) {
      const initVal = Number(initRaw.replace(',', '.'));
      if (!Number.isFinite(initVal) || initVal < 0) {
        els.goalValorInicial.setCustomValidity('Informe um valor maior ou igual a zero.');
      } else {
        els.goalValorInicial.setCustomValidity('');
      }
    } else {
      els.goalValorInicial.setCustomValidity('');
    }
  }

  async function loadGoals() {
    const { response, body } = await apiFetch('/api/admin/metas');
    if (isSessionInvalidResponse(response, body)) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      renderEmptyRow(els.goalsTbody, 5, body?.error || 'Erro ao carregar metas.');
      return;
    }

    const goals = Array.isArray(body?.data) ? body.data : [];
    if (goals.length === 0) {
      renderEmptyRow(els.goalsTbody, 5, 'Nenhuma meta de doação cadastrada.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const goal of goals) {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = goal.titulo;

      const subSlug = document.createElement('span');
      subSlug.className = 'sub-meta mono-cell';
      subSlug.textContent = `slug: ${goal.slug}`;
      th.append(subSlug);

      const details = [];
      if (goal.campanha_id) details.push(`Campanha: ${goal.campanha_id}`);
      if (goal.data_inicio || goal.data_fim) {
        const ini = goal.data_inicio ? formatPlainDate(goal.data_inicio) : 'Início livre';
        const fim = goal.data_fim ? formatPlainDate(goal.data_fim) : 'Sem limite';
        details.push(`${ini} até ${fim}`);
      }
      if (details.length > 0) {
        const subMeta = document.createElement('span');
        subMeta.className = 'sub-meta';
        subMeta.textContent = details.join(' · ');
        th.append(subMeta);
      }

      if (goal.destaque) {
        const badges = document.createElement('div');
        badges.className = 'goal-badges';
        const feat = document.createElement('span');
        feat.className = 'role-badge is-root';
        feat.textContent = 'Principal';
        badges.append(feat);
        th.append(badges);
      }

      const tdProgress = document.createElement('td');
      tdProgress.textContent = `${formatCurrency(goal.valor_arrecadado)} / ${formatCurrency(goal.valor_meta)} (${goal.percentual.toFixed(1)}%)`;
      if (goal.valor_inicial > 0) {
        const subInit = document.createElement('span');
        subInit.className = 'sub-meta';
        subInit.textContent = `Online: ${formatCurrency(goal.valor_arrecadado_online)} · Inicial: ${formatCurrency(goal.valor_inicial)}`;
        tdProgress.append(subInit);
      }
      const progressEl = document.createElement('progress');
      progressEl.className = `goal-progress${goal.atingida ? ' is-reached' : ''}`;
      progressEl.max = 100;
      progressEl.value = Number(goal.percentual_barra || 0);
      progressEl.setAttribute('aria-label', `${goal.titulo}: ${goal.percentual}% arrecadado`);
      tdProgress.append(progressEl);

      const tdDonations = document.createElement('td');
      tdDonations.textContent = `${goal.total_doacoes} doações`;
      const subDonors = document.createElement('span');
      subDonors.className = 'sub-meta';
      subDonors.textContent = `${goal.total_doadores} doadores`;
      tdDonations.append(subDonors);

      const tdStatus = document.createElement('td');
      const statusWrap = document.createElement('div');
      statusWrap.className = 'goal-badges';
      const activePill = document.createElement('span');
      activePill.className = `status-pill ${goal.ativa ? 'status-ok' : 'status-danger'}`;
      activePill.textContent = goal.ativa ? 'Ativa' : 'Inativa';
      statusWrap.append(activePill);
      if (goal.atingida) {
        const reachedPill = document.createElement('span');
        reachedPill.className = 'status-pill status-ok';
        reachedPill.textContent = 'Atingida';
        statusWrap.append(reachedPill);
      }
      tdStatus.append(statusWrap);

      const tdActions = document.createElement('td');
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'row-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-secondary btn-sm';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => startEditGoal(goal));

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-secondary btn-sm';
      copyBtn.textContent = 'Copiar link';
      copyBtn.addEventListener('click', () => copyUrlWithFeedback(`/api/metas/${encodeURIComponent(goal.slug)}`, `Meta "${goal.titulo}"`));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Excluir';
      deleteBtn.addEventListener('click', () => handleDeleteGoal(goal));

      actionsWrap.append(editBtn, copyBtn, deleteBtn);
      tdActions.append(actionsWrap);

      tr.append(th, tdProgress, tdDonations, tdStatus, tdActions);
      fragment.append(tr);
    }

    els.goalsTbody.replaceChildren(fragment);
  }

  function resetGoalForm() {
    editingGoalId = null;
    goalSlugManuallyEdited = false;
    els.goalForm.reset();
    els.goalOrdem.value = '0';
    els.goalDestaque.checked = false;
    els.goalAtiva.checked = true;
    els.goalSubmitBtn.textContent = 'Cadastrar meta';
    els.goalCancelEditBtn.hidden = true;
    [
      els.goalTitulo,
      els.goalSlug,
      els.goalValorMeta,
      els.goalValorInicial,
      els.goalCampanhaId,
      els.goalOrdem,
      els.goalDataInicio,
      els.goalDataFim,
      els.goalDescricao
    ].forEach((el) => {
      el.setCustomValidity('');
      syncAria(el);
    });
  }

  function startEditGoal(goal) {
    hideBanner(els.goalResult);
    editingGoalId = goal.id;
    goalSlugManuallyEdited = true;
    els.goalTitulo.value = goal.titulo;
    els.goalSlug.value = goal.slug;
    els.goalValorMeta.value = String(goal.valor_meta);
    els.goalValorInicial.value = goal.valor_inicial > 0 ? String(goal.valor_inicial) : '';
    els.goalCampanhaId.value = goal.campanha_id || '';
    els.goalOrdem.value = String(goal.ordem ?? 0);
    els.goalDataInicio.value = goal.data_inicio || '';
    els.goalDataFim.value = goal.data_fim || '';
    els.goalDescricao.value = goal.descricao || '';
    els.goalDestaque.checked = Boolean(goal.destaque);
    els.goalAtiva.checked = Boolean(goal.ativa);
    els.goalSubmitBtn.textContent = 'Salvar alterações';
    els.goalCancelEditBtn.hidden = false;

    [
      els.goalTitulo,
      els.goalSlug,
      els.goalValorMeta,
      els.goalValorInicial,
      els.goalCampanhaId,
      els.goalOrdem,
      els.goalDataInicio,
      els.goalDataFim,
      els.goalDescricao
    ].forEach((el) => {
      el.setCustomValidity('');
      syncAria(el);
    });
    els.goalForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    els.goalTitulo.focus();
  }

  async function handleGoalSubmit(event) {
    event.preventDefault();
    hideBanner(els.goalResult);

    validateGoalAmountsInput();
    validateGoalDatesInput();
    if (!els.goalForm.reportValidity()) return;

    const valorMetaNum = Number(els.goalValorMeta.value.trim().replace(',', '.'));
    const initRaw = els.goalValorInicial.value.trim();
    const valorInicialNum = initRaw ? Number(initRaw.replace(',', '.')) : 0;

    const payload = {
      titulo: els.goalTitulo.value.trim(),
      slug: els.goalSlug.value.trim().toLowerCase(),
      valor_meta: Math.round(valorMetaNum * 100) / 100,
      valor_inicial: Math.round(valorInicialNum * 100) / 100,
      campanha_id: els.goalCampanhaId.value.trim() || null,
      ordem: parseInt(els.goalOrdem.value.trim() || '0', 10),
      data_inicio: els.goalDataInicio.value || null,
      data_fim: els.goalDataFim.value || null,
      descricao: els.goalDescricao.value.trim() || null,
      destaque: els.goalDestaque.checked,
      ativa: els.goalAtiva.checked
    };

    els.goalSubmitBtn.disabled = true;
    try {
      const isEdit = editingGoalId !== null;
      const url = isEdit ? `/api/admin/metas/${editingGoalId}` : '/api/admin/metas';
      const { response, body } = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }
      if (!response.ok) {
        showBanner(els.goalResult, body?.error || 'Não foi possível salvar a meta.', 'error');
        return;
      }

      showBanner(
        els.goalResult,
        isEdit
          ? `Meta "${body.meta.titulo}" atualizada com sucesso.`
          : `Meta "${body.meta.titulo}" cadastrada com sucesso.`,
        'success'
      );
      resetGoalForm();
      await loadGoals();
    } catch (_) {
      showBanner(els.goalResult, 'Erro de comunicação ao salvar a meta.', 'error');
    } finally {
      els.goalSubmitBtn.disabled = false;
    }
  }

  async function handleDeleteGoal(goal) {
    hideBanner(els.goalResult);
    const confirmed = await openConfirmDialog({
      title: 'Excluir meta de doação',
      message: 'A meta será removida permanentemente do painel e do endpoint público.',
      confirmLabel: 'Excluir meta',
      summaryItems: [
        { label: 'Título', value: goal.titulo },
        { label: 'Slug', value: goal.slug },
        { label: 'Valor da meta', value: formatCurrency(goal.valor_meta) }
      ]
    });
    if (!confirmed) return;

    try {
      const { response, body } = await apiFetch(`/api/admin/metas/${goal.id}`, { method: 'DELETE' });
      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }
      if (!response.ok) {
        showBanner(els.goalResult, body?.error || 'Não foi possível excluir a meta.', 'error');
        return;
      }
      if (editingGoalId === goal.id) resetGoalForm();
      showBanner(els.goalResult, `Meta "${goal.titulo}" excluída.`, 'success');
      await loadGoals();
    } catch (_) {
      showBanner(els.goalResult, 'Erro de comunicação ao excluir a meta.', 'error');
    }
  }

  // =========================================================
  // Realizar Doação (PIX, Crédito, Débito e Cripto)
  // =========================================================
  function stopDonationTimers() {
    if (donationPollTimer) {
      clearInterval(donationPollTimer);
      donationPollTimer = null;
    }
    if (donationPopupTimer) {
      clearInterval(donationPopupTimer);
      donationPopupTimer = null;
    }
  }

  function toImageDataUri(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('data:image/') ? trimmed : `data:image/png;base64,${trimmed}`;
  }

  function getSelectedPaymentMethod() {
    const checked = els.donateForm.querySelector('input[name="tipo_pagamento"]:checked');
    return checked ? checked.value : 'PIX';
  }

  function getSelectedCryptoCurrency() {
    const checked = els.donateForm.querySelector('input[name="currency"]:checked');
    return checked ? checked.value : 'USDC';
  }

  function parseCardExpiry(raw) {
    if (typeof raw !== 'string') return null;
    const match = raw.trim().match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})$/);
    if (!match) return null;
    const month = parseInt(match[1], 10);
    let year = parseInt(match[2], 10);
    if (match[2].length === 2) {
      year += 2000;
    }
    if (year < 2000 || year > 2100) return null;
    return { month, year };
  }

  function validateDonationFields() {
    const method = getSelectedPaymentMethod();
    const isCard = method === 'CREDITO' || method === 'DEBITO';
    const isAnonymous = els.donateAnonimo.checked;

    const valorRaw = els.donateValor.value.trim();
    if (valorRaw) {
      const valNum = Number(valorRaw.replace(',', '.'));
      if (!Number.isFinite(valNum) || valNum < 0.01 || valNum > 100000) {
        els.donateValor.setCustomValidity('Informe um valor entre R$ 0,01 e R$ 100.000,00.');
      } else {
        els.donateValor.setCustomValidity('');
      }
    } else {
      els.donateValor.setCustomValidity('');
    }

    if (!isAnonymous) {
      const digits = els.donateWhatsapp.value.replace(/[\s().-]/g, '');
      if (!/^[0-9]{10,15}$/.test(digits)) {
        els.donateWhatsapp.setCustomValidity('Informe um WhatsApp com 10 a 15 dígitos.');
      } else {
        els.donateWhatsapp.setCustomValidity('');
      }
    } else {
      els.donateWhatsapp.setCustomValidity('');
    }

    if (isCard) {
      const cardDigits = els.donateCardNumber.value.replace(/\s+/g, '');
      if (!/^\d{13,19}$/.test(cardDigits)) {
        els.donateCardNumber.setCustomValidity('Informe de 13 a 19 dígitos numéricos.');
      } else {
        els.donateCardNumber.setCustomValidity('');
      }

      if (!parseCardExpiry(els.donateCardExp.value)) {
        els.donateCardExp.setCustomValidity('Informe a validade no formato MM/AA ou MM/AAAA.');
      } else {
        els.donateCardExp.setCustomValidity('');
      }
    } else {
      els.donateCardNumber.setCustomValidity('');
      els.donateCardExp.setCustomValidity('');
    }
  }

  function syncDonationFormState() {
    const method = getSelectedPaymentMethod();
    const isCard = method === 'CREDITO' || method === 'DEBITO';
    const isCredit = method === 'CREDITO';
    const isCrypto = method === 'CRIPTO';
    const isAnonymous = els.donateAnonimo.checked;

    els.donateValor.required = !isCrypto;
    els.donateValorReq.hidden = isCrypto;

    els.donateDonorFields.hidden = isAnonymous;
    els.donateNome.required = !isAnonymous;
    els.donateWhatsapp.required = !isAnonymous;

    els.donateCardSection.hidden = !isCard;
    els.donateCardNumber.required = isCard;
    els.donateCardName.required = isCard;
    els.donateCardExp.required = isCard;
    els.donateCardCsc.required = isCard;
    els.donateCardEmail.required = isCard;
    els.donateInstallmentsWrap.hidden = !isCredit;

    els.donateCryptoSection.hidden = !isCrypto;

    const submitLabels = {
      PIX: 'Gerar cobrança PIX',
      CREDITO: 'Pagar com cartão de crédito',
      DEBITO: 'Pagar com cartão de débito',
      CRIPTO: 'Gerar pagamento Cripto'
    };
    els.donateSubmitBtn.textContent = submitLabels[method] || 'Gerar pagamento';

    validateDonationFields();
    [
      els.donateValor,
      els.donateNome,
      els.donateWhatsapp,
      els.donateCardNumber,
      els.donateCardName,
      els.donateCardExp,
      els.donateCardCsc,
      els.donateCardEmail
    ].forEach((el) => syncAria(el));
  }

  function renderDonationSummary(data) {
    els.donateSummary.replaceChildren();
    const items = [
      { label: 'TXID', value: data.txid || '-' },
      { label: 'Meio', value: data.tipo_pagamento || '-' },
      { label: 'Status', value: data.status || '-' }
    ];
    if (data.rede_tid) items.push({ label: 'TID (e-Rede)', value: data.rede_tid });
    if (data.valor !== null && data.valor !== undefined && Number(data.valor) > 0) {
      items.push({ label: 'Valor', value: formatCurrency(data.valor) });
    }
    if (data.autorizacao?.status) {
      items.push({
        label: 'Autorização',
        value: `${data.autorizacao.status}${data.autorizacao.codigo ? ` (${data.autorizacao.codigo})` : ''}`
      });
    }

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'dialog-summary-row';
      const dt = document.createElement('dt');
      dt.textContent = item.label;
      const dd = document.createElement('dd');
      dd.textContent = item.value;
      row.append(dt, dd);
      els.donateSummary.append(row);
    }
  }

  function renderDonationOutput(data) {
    currentDonation = data;
    els.donateOutputCard.hidden = false;
    els.donateOutputMessage.textContent = data.mensagem || '';
    renderDonationSummary(data);

    els.donatePixBox.hidden = true;
    els.donate3dsBox.hidden = true;
    els.donateCryptoBox.hidden = true;
    els.donatePixQr.hidden = true;
    els.donatePixQr.removeAttribute('src');
    els.donateCryptoQr.hidden = true;
    els.donateCryptoQr.removeAttribute('src');
    hideBanner(els.donatePollStatus);

    if (data.tipo_pagamento === 'PIX') {
      els.donatePixBox.hidden = false;
      els.donatePixBrcode.textContent = data.brCode || '';
      const qrSrc = toImageDataUri(data.qrCodeImage);
      if (qrSrc) {
        els.donatePixQr.src = qrSrc;
        els.donatePixQr.hidden = false;
      }
      startDonationPolling();
    } else if (data.tipo_pagamento === 'CRIPTO') {
      els.donateCryptoBox.hidden = false;
      els.donateCryptoNetwork.textContent = `${data.currency || 'USDC'} · ${data.network || 'stellar'}`;
      els.donateCryptoAddress.textContent = data.recipient_address || '';
      els.donateCryptoMemo.textContent = data.memo || data.txid || '';
      const qrSrc = toImageDataUri(data.qr_code);
      if (qrSrc) {
        els.donateCryptoQr.src = qrSrc;
        els.donateCryptoQr.hidden = false;
      }
    } else if (data.requires3DS && data.threeDSecureUrl) {
      els.donate3dsBox.hidden = false;
      startDonationPolling();
    }
  }

  async function checkDonationStatus({ silent = false } = {}) {
    if (!currentDonation?.txid) return;
    try {
      const { response, body } = await apiFetch(`/api/cobranca/txid/${encodeURIComponent(currentDonation.txid)}`);
      if (!response.ok || !body) {
        if (!silent) {
          showBanner(els.donatePollStatus, body?.error || 'Não foi possível consultar o status.', 'error');
        }
        return;
      }

      currentDonation.status = body.status;
      if (body.rede_tid) currentDonation.rede_tid = body.rede_tid;
      renderDonationSummary(currentDonation);

      if (body.status === 'CONFIRMADA') {
        stopDonationTimers();
        showBanner(els.donatePollStatus, 'Pagamento confirmado com sucesso!', 'success');
        await refreshPostDonationData();
      } else if (['NEGADA', 'CANCELADA', 'EXPIRADA'].includes(body.status)) {
        stopDonationTimers();
        showBanner(els.donatePollStatus, `Status final da cobrança: ${body.status}.`, 'error');
      } else if (!silent) {
        showBanner(els.donatePollStatus, `Status atual: ${body.status}.`, 'info');
      }
    } catch (_) {
      if (!silent) {
        showBanner(els.donatePollStatus, 'Erro de conexão ao consultar status da cobrança.', 'error');
      }
    }
  }

  function startDonationPolling() {
    stopDonationTimers();
    let attempts = 0;
    donationPollTimer = setInterval(() => {
      attempts += 1;
      if (attempts > 30 || !currentDonation?.txid) {
        stopDonationTimers();
        return;
      }
      checkDonationStatus({ silent: true });
    }, 4000);
  }

  async function copyDonationText(text, label) {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showBanner(els.donatePollStatus, `${label} copiado para a área de transferência.`, 'success');
      } else {
        showBanner(els.donatePollStatus, `${label}: ${text}`, 'info');
      }
    } catch (_) {
      showBanner(els.donatePollStatus, `${label}: ${text}`, 'info');
    }
  }

  async function handleDonateSubmit(event) {
    event.preventDefault();
    hideBanner(els.donateResult);
    validateDonationFields();
    if (!els.donateForm.reportValidity()) return;

    const method = getSelectedPaymentMethod();
    const isCard = method === 'CREDITO' || method === 'DEBITO';
    const isCrypto = method === 'CRIPTO';
    const isAnonymous = els.donateAnonimo.checked;

    const payload = {
      tipo_pagamento: method,
      cid: els.donateCid.value.trim()
    };

    const valorRaw = els.donateValor.value.trim();
    if (valorRaw) {
      payload.valor = Math.round(Number(valorRaw.replace(',', '.')) * 100) / 100;
    }

    if (isAnonymous) {
      payload.doador = { anonimo: true };
    } else {
      payload.doador = {
        anonimo: false,
        nome: els.donateNome.value.trim(),
        whatsapp: els.donateWhatsapp.value.replace(/[\s().-]/g, '')
      };
      const msg = els.donateMensagem.value.trim();
      if (msg) payload.doador.mensagem = msg;
    }

    if (isCrypto) {
      payload.currency = getSelectedCryptoCurrency();
    }

    if (isCard) {
      const expiry = parseCardExpiry(els.donateCardExp.value);
      const cardEmail = els.donateCardEmail.value.trim();
      payload.cartao = {
        cardNumber: els.donateCardNumber.value.replace(/\s+/g, ''),
        cardholderName: els.donateCardName.value.trim(),
        expirationMonth: expiry.month,
        expirationYear: expiry.year,
        securityCode: els.donateCardCsc.value.trim(),
        email: cardEmail
      };
      if (els.donateCardBrand.value) {
        payload.cartao.bandeira = els.donateCardBrand.value;
      }
      if (method === 'CREDITO') {
        payload.parcelas = parseInt(els.donateParcelas.value || '1', 10);
      }

      const tzOffset = String(Math.abs(Math.round(new Date().getTimezoneOffset() / -60)) || 3);
      payload.threeDSecure = {
        userAgent: navigator.userAgent,
        device: {
          colorDepth: window.screen?.colorDepth || 24,
          deviceType3ds: 'BROWSER',
          javaEnabled: false,
          language: (navigator.language || 'pt').split('-')[0],
          screenHeight: window.screen?.height || 1080,
          screenWidth: window.screen?.width || 1920,
          timeZoneOffset: tzOffset
        }
      };

      const billingAddr = els.donateBillingAddress.value.trim();
      const billingCity = els.donateBillingCity.value.trim();
      const billingState = els.donateBillingState.value.trim();
      const billingPostal = els.donateBillingPostal.value.trim();
      if (billingAddr || billingCity || billingState || billingPostal) {
        payload.threeDSecure.billing = {
          address: billingAddr || 'Não informado',
          city: billingCity || 'Não informado',
          state: billingState || 'SP',
          postalcode: billingPostal || '00000-000',
          country: 'Brasil',
          emailAddress: cardEmail,
          phoneNumber: payload.doador?.whatsapp || '00000000000'
        };
      }
    }

    els.donateSubmitBtn.disabled = true;
    try {
      const { response, body } = await apiFetch('/api/gerar-pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Remove imediatamente PAN e CVV do DOM após envio de cartão
      if (isCard) {
        els.donateCardNumber.value = '';
        els.donateCardCsc.value = '';
        syncAria(els.donateCardNumber);
        syncAria(els.donateCardCsc);
      }

      if (!response.ok || !body?.success) {
        showBanner(els.donateResult, body?.error || 'Não foi possível gerar o pagamento.', 'error');
        return;
      }

      const isDenied = body.autorizacao?.status === 'NEGADA';
      showBanner(
        els.donateResult,
        body.mensagem || `Cobrança ${body.txid} gerada (${body.status}).`,
        isDenied ? 'error' : 'success'
      );
      renderDonationOutput(body);
      await refreshPostDonationData();
    } catch (_) {
      showBanner(els.donateResult, 'Erro de conexão ao gerar o pagamento.', 'error');
    } finally {
      els.donateSubmitBtn.disabled = false;
    }
  }

  async function handleCheckMemo() {
    const memo = currentDonation?.memo || currentDonation?.txid;
    if (!memo) return;
    els.donateCheckMemoBtn.disabled = true;
    try {
      const { response, body } = await apiFetch('/api/check-payment-by-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo })
      });
      if (!response.ok || !body?.success) {
        showBanner(els.donatePollStatus, body?.message || body?.error || 'Pagamento ainda não encontrado.', 'warning');
        return;
      }
      currentDonation.status = 'CONFIRMADA';
      renderDonationSummary(currentDonation);
      showBanner(els.donatePollStatus, body.message || 'Pagamento Stellar confirmado!', 'success');
      await refreshPostDonationData();
    } catch (_) {
      showBanner(els.donatePollStatus, 'Erro de conexão ao verificar pagamento pelo memo.', 'error');
    } finally {
      els.donateCheckMemoBtn.disabled = false;
    }
  }

  async function handleConfirmHash(event) {
    event.preventDefault();
    const hash = els.donateStellarHash.value.trim();
    if (!hash) return;
    els.donateConfirmHashBtn.disabled = true;
    try {
      const { response, body } = await apiFetch('/api/confirm-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, txid: currentDonation?.txid })
      });
      if (!response.ok || !body?.success) {
        showBanner(els.donatePollStatus, body?.error || 'Não foi possível confirmar pelo hash.', 'error');
        return;
      }
      currentDonation.status = 'CONFIRMADA';
      renderDonationSummary(currentDonation);
      showBanner(els.donatePollStatus, body.message || 'Pagamento Stellar confirmado!', 'success');
      els.donateHashForm.reset();
      await refreshPostDonationData();
    } catch (_) {
      showBanner(els.donatePollStatus, 'Erro de conexão ao confirmar hash Stellar.', 'error');
    } finally {
      els.donateConfirmHashBtn.disabled = false;
    }
  }

  function resetDonateForm() {
    stopDonationTimers();
    currentDonation = null;
    els.donateForm.reset();
    const pixRadio = document.getElementById('donate-method-pix');
    if (pixRadio) pixRadio.checked = true;
    const usdcRadio = document.getElementById('donate-currency-usdc');
    if (usdcRadio) usdcRadio.checked = true;
    els.donateCid.value = 'campanha-01';
    els.donateAnonimo.checked = false;
    els.donateOutputCard.hidden = true;
    els.donateSummary.replaceChildren();
    hideBanner(els.donateResult);
    hideBanner(els.donatePollStatus);
    syncDonationFormState();
  }

  // =========================================================
  // Ações de estorno e gestão de admins
  // =========================================================
  async function handleRefundSubmit(event) {
    event.preventDefault();
    hideBanner(els.refundResult);

    const tid = els.refundTid.value.trim();
    const valorParsed = parseOptionalValor(els.refundValor.value);
    const motivo = els.refundMotivo.value.trim();

    if (Number.isNaN(valorParsed)) {
      els.refundValor.setCustomValidity('Informe um valor positivo maior que zero.');
      els.refundValor.reportValidity();
      return;
    }

    const confirmed = await openConfirmDialog({
      title: 'Confirmar solicitação de estorno',
      message: 'Esta operação envia um estorno real para a e-Rede e será registrada em auditoria.',
      confirmLabel: 'Confirmar estorno',
      summaryItems: [
        { label: 'TID', value: tid },
        { label: 'Modalidade', value: valorParsed ? 'Estorno parcial' : 'Estorno total' },
        { label: 'Valor', value: valorParsed ? formatCurrency(valorParsed) : 'Valor integral' },
        { label: 'Motivo', value: motivo || 'Não informado' }
      ]
    });

    if (!confirmed) return;

    els.refundSubmitBtn.disabled = true;
    try {
      const payload = { tid };
      if (valorParsed !== null) payload.valor = valorParsed;
      if (motivo) payload.motivo = motivo;

      const { response, body } = await apiFetch('/api/cancelar-cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }

      if (!response.ok) {
        showBanner(
          els.refundResult,
          body?.error ? `${body.error}${body.message ? ` — ${body.message}` : ''}` : 'Falha ao executar estorno.',
          'error'
        );
        if (response.status !== 403) {
          await loadEstornos();
        }
        return;
      }

      const cancel = body?.cancelamento || {};
      const resumo = `Estorno enviado (${cancel.status || 'Processing'}) · TID: ${cancel.tid || tid}${
        cancel.refundId ? ` · Refund ID: ${cancel.refundId}` : ''
      }${cancel.cancelId ? ` · Cancel ID D+1: ${cancel.cancelId}` : ''}.`;
      showBanner(els.refundResult, resumo, 'success');
      els.refundForm.reset();
      await Promise.all([loadTransactions(), loadEstornos()]);
    } catch (_) {
      showBanner(els.refundResult, 'Erro de comunicação ao solicitar o estorno.', 'error');
    } finally {
      els.refundSubmitBtn.disabled = false;
    }
  }

  function getSelectedUserRole() {
    if (els.newUserRoleAdmin?.checked && !els.newUserRoleAdmin.disabled) {
      return 'admin';
    }
    return 'user';
  }

  function getSelectedUserTabs() {
    return els.permTabCheckboxes
      .filter((cb) => cb.checked && !cb.disabled)
      .map((cb) => cb.value);
  }

  function validateUserTabsSelection() {
    const role = getSelectedUserRole();
    const selected = getSelectedUserTabs();
    if (role === 'user' && selected.length === 0) {
      els.userTabsError.classList.add('is-visible');
      return false;
    }
    els.userTabsError.classList.remove('is-visible');
    return true;
  }

  function syncCreateUserFormPermissions() {
    const isRoot = Boolean(currentUser?.isRoot || currentUser?.role === 'root');
    if (els.newUserRoleAdminWrap && els.newUserRoleAdmin) {
      els.newUserRoleAdminWrap.hidden = !isRoot;
      els.newUserRoleAdmin.disabled = !isRoot;
      if (!isRoot && els.newUserRoleAdmin.checked) {
        els.newUserRoleUser.checked = true;
      }
    }
    if (els.userRoleAdminNote) {
      els.userRoleAdminNote.hidden = isRoot;
    }

    const selectedRole = getSelectedUserRole();
    if (els.userTabsAdminAutoNote) {
      els.userTabsAdminAutoNote.hidden = selectedRole !== 'admin';
    }

    let enabledCount = 0;
    for (const cb of els.permTabCheckboxes) {
      const canGrant = isRoot || hasTab(cb.value);
      cb.disabled = !canGrant;
      if (!canGrant) {
        cb.checked = false;
      } else {
        enabledCount += 1;
      }
      cb.closest('.tab-permission-item')?.classList.toggle('is-disabled', !canGrant);
    }

    if (els.selectAllTabsBtn) els.selectAllTabsBtn.disabled = enabledCount === 0;
    if (els.clearAllTabsBtn) els.clearAllTabsBtn.disabled = enabledCount === 0;
  }

  function resetUserForm() {
    editingUserEmail = null;
    els.addAdminForm.reset();
    els.newAdminEmail.readOnly = false;
    els.newUserRoleUser.checked = true;
    els.permTabCheckboxes.forEach((cb) => {
      cb.checked = false;
    });
    els.userTabsError.classList.remove('is-visible');
    els.createUserHeading.textContent = 'Criar Novo Usuário';
    els.createUserSubtitle.textContent =
      'Escolha o e-mail Google, o perfil e exatamente quais abas serão visíveis para este usuário.';
    els.addAdminBtn.textContent = 'Criar usuário';
    els.cancelEditUserBtn.hidden = true;
    els.newAdminEmail.setCustomValidity('');
    syncAria(els.newAdminEmail);
    syncCreateUserFormPermissions();
  }

  function startEditUser(userRecord) {
    hideBanner(els.adminManageResult);
    hideBanner(els.userCreateResult);
    resetUserForm();

    editingUserEmail = userRecord.email;
    els.newAdminEmail.value = userRecord.email;
    els.newAdminEmail.readOnly = true;
    els.newAdminEmail.setCustomValidity('');
    syncAria(els.newAdminEmail);

    if (userRecord.role === 'admin' && (currentUser?.isRoot || currentUser?.role === 'root')) {
      els.newUserRoleAdmin.checked = true;
    } else {
      els.newUserRoleUser.checked = true;
    }
    syncCreateUserFormPermissions();

    const allowedSet = new Set(Array.isArray(userRecord.allowedTabs) ? userRecord.allowedTabs : []);
    els.permTabCheckboxes.forEach((cb) => {
      if (!cb.disabled) {
        cb.checked = allowedSet.has(cb.value);
      }
    });
    els.userTabsError.classList.remove('is-visible');

    els.createUserHeading.textContent = `Editar Usuário: ${userRecord.email}`;
    els.createUserSubtitle.textContent =
      'Atualize o perfil e selecione exatamente quais abas serão visíveis para este usuário.';
    els.addAdminBtn.textContent = 'Salvar permissões';
    els.cancelEditUserBtn.hidden = false;

    usersSubtabsController?.activate(els.subtabUsuariosCriar, true);
    els.createUserHeading.focus();
  }

  async function handleAddAdminSubmit(event) {
    event.preventDefault();
    hideBanner(els.userCreateResult);
    hideBanner(els.adminManageResult);

    if (!els.addAdminForm.reportValidity()) {
      return;
    }

    if (!validateUserTabsSelection()) {
      const firstEnabled = els.permTabCheckboxes.find((cb) => !cb.disabled);
      firstEnabled?.focus();
      return;
    }

    const email = (editingUserEmail || els.newAdminEmail.value).trim().toLowerCase();
    if (!email) return;

    const role = getSelectedUserRole();
    const allowedTabs = getSelectedUserTabs();
    const isEdit = Boolean(editingUserEmail);

    els.addAdminBtn.disabled = true;
    try {
      const url = isEdit
        ? `/api/admin/admins/${encodeURIComponent(editingUserEmail)}`
        : '/api/admin/admins';
      const { response, body } = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, allowedTabs })
      });

      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }

      if (!response.ok) {
        showBanner(
          els.userCreateResult,
          body?.error || (isEdit ? 'Não foi possível atualizar o usuário.' : 'Não foi possível criar o usuário.'),
          'error'
        );
        return;
      }

      await loadAdmins();

      const saved = body?.admin || { email, allowedTabs };
      const tabSummary = (saved.allowedTabs || []).map((t) => TAB_LABELS[t] || t).join(', ');
      if (isEdit) {
        resetUserForm();
        usersSubtabsController?.activate(els.subtabUsuariosLista, true);
        showBanner(
          els.adminManageResult,
          `Permissões de ${saved.email} atualizadas (${tabSummary || 'sem abas'}).`,
          'success'
        );
      } else {
        resetUserForm();
        showBanner(
          els.userCreateResult,
          `Usuário ${saved.email} criado com acesso a: ${tabSummary || 'nenhuma aba'}.`,
          'success'
        );
      }
    } catch (_) {
      showBanner(els.userCreateResult, 'Erro de conexão ao salvar usuário.', 'error');
    } finally {
      els.addAdminBtn.disabled = false;
    }
  }

  async function handleRemoveAdmin(userOrEmail) {
    const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
    const roleLabel =
      typeof userOrEmail === 'object' && userOrEmail?.role === 'admin' ? 'Administrador' : 'Usuário';
    if (!email) return;

    hideBanner(els.adminManageResult);
    hideBanner(els.userCreateResult);

    const confirmed = await openConfirmDialog({
      title: 'Remover usuário',
      message: 'A conta perderá imediatamente o acesso ao painel e às rotas protegidas.',
      confirmLabel: 'Remover acesso',
      summaryItems: [
        { label: 'E-mail', value: email },
        { label: 'Perfil', value: roleLabel }
      ]
    });

    if (!confirmed) return;

    try {
      const { response, body } = await apiFetch(`/api/admin/admins/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });

      if (isSessionInvalidResponse(response, body)) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }

      if (!response.ok) {
        showBanner(els.adminManageResult, body?.error || 'Não foi possível remover o usuário.', 'error');
        return;
      }

      if (editingUserEmail && editingUserEmail.toLowerCase() === email.toLowerCase()) {
        resetUserForm();
      }

      const extra = body?.inEnvList
        ? ' Atenção: este e-mail ainda consta na variável de ambiente ADMIN_EMAILS.'
        : '';
      showBanner(els.adminManageResult, `Acesso de ${email} removido.${extra}`, body?.inEnvList ? 'warning' : 'success');
      await loadAdmins();
    } catch (_) {
      showBanner(els.adminManageResult, 'Erro de conexão ao remover usuário.', 'error');
    }
  }

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/admin/logout', { method: 'POST' });
    } catch (_) {
      // ignore
    }
    window.google?.accounts?.id?.disableAutoSelect?.();
    allTiers = [];
    allRewards = [];
    allDonors = [];
    allUsers = [];
    stopDonationTimers();
    els.txTbody.replaceChildren();
    els.estornosTbody.replaceChildren();
    els.adminsTbody.replaceChildren();
    els.tiersTbody.replaceChildren();
    els.rewardsTbody.replaceChildren();
    els.deliveriesTbody.replaceChildren();
    els.goalsTbody.replaceChildren();
    resetTierForm();
    resetRewardForm();
    resetDeliveryForm();
    resetGoalForm();
    resetDonateForm();
    resetUserForm();
    hideBanner(els.refundResult);
    hideBanner(els.adminManageResult);
    hideBanner(els.userCreateResult);
    hideBanner(els.tierResult);
    hideBanner(els.rewardResult);
    hideBanner(els.deliveryResult);
    hideBanner(els.goalResult);
    hideBanner(els.goalsCopyStatus);
    handleUnauthorized();
  }

  // =========================================================
  // Inicialização
  // =========================================================
  function bindEvents() {
    mainTabsController = initTabGroup([
      { key: 'estornos', tab: els.tabEstornos, panel: els.panelEstornos },
      { key: 'recompensas', tab: els.tabRecompensas, panel: els.panelRecompensas },
      { key: 'metas', tab: els.tabMetas, panel: els.panelMetas },
      { key: 'doacao', tab: els.tabDoacao, panel: els.panelDoacao },
      { key: 'usuarios', tab: els.tabAdmins, panel: els.panelAdmins }
    ]);

    initTabGroup([
      { tab: els.subtabCatalogo, panel: els.subpanelCatalogo },
      { tab: els.subtabEntregas, panel: els.subpanelEntregas }
    ]);

    usersSubtabsController = initTabGroup([
      { key: 'lista', tab: els.subtabUsuariosLista, panel: els.subpanelUsuariosLista },
      { key: 'criar', tab: els.subtabUsuariosCriar, panel: els.subpanelUsuariosCriar }
    ]);

    syncDonationFormState();
    els.donateForm.querySelectorAll('input[name="tipo_pagamento"]').forEach((radio) => {
      radio.addEventListener('change', syncDonationFormState);
    });
    els.donateAnonimo.addEventListener('change', syncDonationFormState);
    [els.donateValor, els.donateWhatsapp, els.donateCardNumber, els.donateCardExp].forEach((input) => {
      input.addEventListener('input', validateDonationFields);
      input.addEventListener('blur', validateDonationFields);
    });
    els.donateForm.addEventListener('submit', handleDonateSubmit);
    els.donateResetBtn.addEventListener('click', resetDonateForm);
    els.donateCheckStatusBtn.addEventListener('click', () => checkDonationStatus({ silent: false }));
    els.donateCopyPixBtn.addEventListener('click', () => copyDonationText(els.donatePixBrcode.textContent, 'Código Pix'));
    els.donateCopyAddressBtn.addEventListener('click', () => copyDonationText(els.donateCryptoAddress.textContent, 'Endereço Stellar'));
    els.donateCopyMemoBtn.addEventListener('click', () => copyDonationText(els.donateCryptoMemo.textContent, 'Memo'));
    els.donateOpen3dsBtn.addEventListener('click', () => {
      if (!currentDonation?.threeDSecureUrl) return;
      const popup = window.open(
        currentDonation.threeDSecureUrl,
        '3DS Authentication',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      if (!popup) {
        showBanner(els.donatePollStatus, 'Pop-up bloqueado pelo navegador. Libere pop-ups para concluir o 3DS.', 'warning');
        return;
      }
      if (donationPopupTimer) clearInterval(donationPopupTimer);
      donationPopupTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(donationPopupTimer);
          donationPopupTimer = null;
          checkDonationStatus({ silent: false });
        }
      }, 1000);
    });
    els.donateCheckMemoBtn.addEventListener('click', handleCheckMemo);
    els.donateHashForm.addEventListener('submit', handleConfirmHash);

    els.goalsPublicUrl.textContent = `${window.location.origin}/api/metas`;
    els.deliveryDate.value = getTodayPlainDateISO();

    els.copyGoalsEndpointBtn.addEventListener('click', () => {
      copyUrlWithFeedback('/api/metas', 'Endpoint de metas');
    });

    els.goalTitulo.addEventListener('input', () => {
      if (editingGoalId === null && !goalSlugManuallyEdited) {
        els.goalSlug.value = slugifyLocal(els.goalTitulo.value).slice(0, 59);
      }
    });
    els.goalSlug.addEventListener('input', () => {
      goalSlugManuallyEdited = Boolean(els.goalSlug.value.trim());
    });
    els.goalValorMeta.addEventListener('input', validateGoalAmountsInput);
    els.goalValorMeta.addEventListener('blur', validateGoalAmountsInput);
    els.goalValorInicial.addEventListener('input', validateGoalAmountsInput);
    els.goalValorInicial.addEventListener('blur', validateGoalAmountsInput);
    els.goalDataInicio.addEventListener('change', validateGoalDatesInput);
    els.goalDataFim.addEventListener('change', validateGoalDatesInput);
    els.goalForm.addEventListener('submit', handleGoalSubmit);
    els.goalCancelEditBtn.addEventListener('click', () => {
      resetGoalForm();
      hideBanner(els.goalResult);
    });
    els.refreshGoalsBtn.addEventListener('click', loadGoals);

    els.refundValor.addEventListener('input', validateRefundValorInput);
    els.refundValor.addEventListener('blur', validateRefundValorInput);

    els.refundForm.addEventListener('submit', handleRefundSubmit);
    els.refundResetBtn.addEventListener('click', () => {
      els.refundForm.reset();
      els.refundValor.setCustomValidity('');
      hideBanner(els.refundResult);
    });

    els.filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loadTransactions();
    });
    els.refreshTxBtn.addEventListener('click', loadTransactions);
    els.refreshEstornosBtn.addEventListener('click', loadEstornos);

    els.tierName.addEventListener('input', () => {
      if (!editingTierSlug && !tierSlugManuallyEdited) {
        els.tierSlug.value = slugifyLocal(els.tierName.value);
      }
    });
    els.tierSlug.addEventListener('input', () => {
      tierSlugManuallyEdited = Boolean(els.tierSlug.value.trim());
    });
    els.tierForm.addEventListener('submit', handleTierSubmit);
    els.tierCancelEditBtn.addEventListener('click', () => {
      resetTierForm();
      hideBanner(els.tierResult);
    });
    els.refreshTiersBtn.addEventListener('click', loadRewardTiers);

    els.rewardForm.addEventListener('submit', handleRewardSubmit);
    els.rewardCancelEditBtn.addEventListener('click', () => {
      resetRewardForm();
      hideBanner(els.rewardResult);
    });
    els.refreshRewardsBtn.addEventListener('click', loadRewards);

    els.deliveryDonorFilter.addEventListener('input', renderDonorOptions);
    els.refreshDonorsBtn.addEventListener('click', loadDonors);
    els.deliveryForm.addEventListener('submit', handleDeliverySubmit);
    els.deliveryResetBtn.addEventListener('click', () => {
      resetDeliveryForm();
      hideBanner(els.deliveryResult);
    });
    els.deliveriesFilterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loadDeliveries();
    });
    els.refreshDeliveriesBtn.addEventListener('click', loadDeliveries);

    els.refreshAdminsBtn.addEventListener('click', loadAdmins);
    els.goCreateUserBtn.addEventListener('click', () => {
      resetUserForm();
      hideBanner(els.userCreateResult);
      usersSubtabsController?.activate(els.subtabUsuariosCriar, true);
      els.newAdminEmail.focus();
    });
    els.backToUsersListBtn.addEventListener('click', () => {
      usersSubtabsController?.activate(els.subtabUsuariosLista, true);
    });
    els.newUserRoleUser.addEventListener('change', () => {
      syncCreateUserFormPermissions();
      validateUserTabsSelection();
    });
    els.newUserRoleAdmin.addEventListener('change', () => {
      syncCreateUserFormPermissions();
      validateUserTabsSelection();
    });
    els.permTabCheckboxes.forEach((cb) => {
      cb.addEventListener('change', () => {
        if (els.userTabsError.classList.contains('is-visible')) {
          validateUserTabsSelection();
        }
      });
    });
    els.selectAllTabsBtn.addEventListener('click', () => {
      els.permTabCheckboxes.forEach((cb) => {
        if (!cb.disabled) cb.checked = true;
      });
      validateUserTabsSelection();
    });
    els.clearAllTabsBtn.addEventListener('click', () => {
      els.permTabCheckboxes.forEach((cb) => {
        if (!cb.disabled) cb.checked = false;
      });
      els.userTabsError.classList.remove('is-visible');
    });
    els.cancelEditUserBtn.addEventListener('click', () => {
      resetUserForm();
      hideBanner(els.userCreateResult);
      usersSubtabsController?.activate(els.subtabUsuariosLista, true);
    });
    els.resetUserFormBtn.addEventListener('click', () => {
      resetUserForm();
      hideBanner(els.userCreateResult);
    });

    els.addAdminForm.addEventListener('submit', handleAddAdminSubmit);
    els.logoutBtn.addEventListener('click', handleLogout);
  }

  initValidationListeners();
  bindEvents();
  checkSession();
})();
