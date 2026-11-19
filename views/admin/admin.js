(() => {
  'use strict';

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
    addAdminForm: document.getElementById('add-admin-form'),
    newAdminEmail: document.getElementById('new-admin-email'),
    addAdminBtn: document.getElementById('add-admin-btn'),
    adminManageResult: document.getElementById('admin-manage-result'),
    adminsTbody: document.getElementById('admins-tbody'),
    confirmDialog: document.getElementById('confirm-dialog'),
    confirmDialogTitle: document.getElementById('confirm-dialog-title'),
    confirmDialogMessage: document.getElementById('confirm-dialog-message'),
    confirmDialogSummary: document.getElementById('confirm-dialog-summary'),
    confirmDialogSubmit: document.getElementById('confirm-dialog-submit'),
    tabEstornos: document.getElementById('tab-estornos'),
    tabRecompensas: document.getElementById('tab-recompensas'),
    tabAdmins: document.getElementById('tab-admins'),
    panelEstornos: document.getElementById('panel-estornos'),
    panelRecompensas: document.getElementById('panel-recompensas'),
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
    deliveriesTbody: document.getElementById('deliveries-tbody')
  };

  let currentUser = null;
  let googleClientId = null;
  let googleInitialized = false;
  let editingTierSlug = null;
  let editingRewardId = null;
  let tierSlugManuallyEdited = false;
  let allTiers = [];
  let allRewards = [];
  let allDonors = [];

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
    if (!Array.isArray(pairs) || pairs.length === 0) return;
    const supportsFocusGroup =
      typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'focusGroup');

    const activate = (selectedTab, shouldScroll = true) => {
      for (const { tab, panel } of pairs) {
        const isSelected = tab === selectedTab;
        tab.setAttribute('aria-selected', String(isSelected));
        tab.toggleAttribute('focusgroupstart', isSelected);
        tab.tabIndex = isSelected ? 0 : -1;
        panel.hidden = !isSelected;
      }
      if (shouldScroll) {
        selectedTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    const initialPair = pairs.find(({ tab }) => tab.getAttribute('aria-selected') === 'true') || pairs[0];
    activate(initialPair.tab, false);

    pairs.forEach(({ tab }, index) => {
      tab.addEventListener('click', () => activate(tab, true));

      if (!supportsFocusGroup) {
        tab.addEventListener('keydown', (event) => {
          let nextIndex = null;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % pairs.length;
          else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + pairs.length) % pairs.length;
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = pairs.length - 1;

          if (nextIndex === null) return;
          event.preventDefault();
          const targetTab = pairs[nextIndex].tab;
          pairs.forEach((p) => {
            p.tab.tabIndex = p.tab === targetTab ? 0 : -1;
          });
          targetTab.focus();
          targetTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
      }
    });
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
    els.userRoleBadge.textContent = user.isRoot ? 'Root' : 'Admin';
    els.userRoleBadge.classList.toggle('is-root', Boolean(user.isRoot));

    if (user.picture) {
      els.userAvatar.src = user.picture;
      els.userAvatar.alt = user.name || user.email;
      els.userAvatar.hidden = false;
    } else {
      els.userAvatar.hidden = true;
      els.userAvatar.removeAttribute('src');
    }

    els.addAdminForm.hidden = !user.isRoot;
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
    if (response.status === 401 || response.status === 403) {
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
    if (response.status === 401 || response.status === 403) {
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
    const { response, body } = await apiFetch('/api/admin/admins');
    if (response.status === 401 || response.status === 403) {
      handleUnauthorized(body?.error || 'Sessão expirada.');
      return;
    }
    if (!response.ok) {
      renderEmptyRow(els.adminsTbody, 5, body?.error || 'Erro ao carregar administradores.');
      return;
    }

    const admins = Array.isArray(body?.admins) ? body.admins : [];
    if (admins.length === 0) {
      renderEmptyRow(els.adminsTbody, 5, 'Nenhum administrador encontrado.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const admin of admins) {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = admin.email;

      const tdRole = document.createElement('td');
      const roleSpan = document.createElement('span');
      roleSpan.className = `role-badge${admin.role === 'root' ? ' is-root' : ''}`;
      roleSpan.textContent = admin.role === 'root' ? 'Root' : 'Admin';
      tdRole.append(roleSpan);

      const tdSource = document.createElement('td');
      tdSource.textContent =
        admin.source === 'root' ? 'Sistema (root)' : admin.source === 'env' ? 'Variável de ambiente' : 'Banco de dados';

      const tdCreatedBy = document.createElement('td');
      tdCreatedBy.textContent = admin.created_by || '-';

      const tdAcao = document.createElement('td');
      if (admin.role === 'root') {
        tdAcao.textContent = 'Protegido';
      } else if (currentUser?.isRoot) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-danger btn-sm';
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', () => handleRemoveAdmin(admin.email));
        tdAcao.append(removeBtn);
      } else {
        tdAcao.textContent = 'Somente root';
      }

      tr.append(th, tdRole, tdSource, tdCreatedBy, tdAcao);
      fragment.append(tr);
    }

    els.adminsTbody.replaceChildren(fragment);
  }

  async function loadDashboardData() {
    await Promise.all([
      loadTransactions(),
      loadEstornos(),
      loadAdmins(),
      loadRewardTiers(),
      loadRewards(),
      loadDonors(),
      loadDeliveries()
    ]);
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
    if (response.status === 401 || response.status === 403) {
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
    if (response.status === 401 || response.status === 403) {
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
    if (response.status === 401 || response.status === 403) {
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
    if (response.status === 401 || response.status === 403) {
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

      if (response.status === 401 || response.status === 403) {
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
      if (response.status === 401) {
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

      if (response.status === 401 || response.status === 403) {
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
      if (response.status === 401) {
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

      if (response.status === 401 || response.status === 403) {
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
      if (response.status === 401) {
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

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }

      if (!response.ok) {
        showBanner(
          els.refundResult,
          body?.error ? `${body.error}${body.message ? ` — ${body.message}` : ''}` : 'Falha ao executar estorno.',
          'error'
        );
        await loadEstornos();
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

  async function handleAddAdminSubmit(event) {
    event.preventDefault();
    hideBanner(els.adminManageResult);

    const email = els.newAdminEmail.value.trim().toLowerCase();
    if (!email) return;

    els.addAdminBtn.disabled = true;
    try {
      const { response, body } = await apiFetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (response.status === 401 || response.status === 403) {
        if (response.status === 401) {
          handleUnauthorized(body?.error || 'Sessão expirada.');
          return;
        }
        showBanner(els.adminManageResult, body?.error || 'Acesso negado.', 'error');
        return;
      }

      if (!response.ok) {
        showBanner(els.adminManageResult, body?.error || 'Não foi possível cadastrar o administrador.', 'error');
        return;
      }

      showBanner(els.adminManageResult, `Administrador ${body.admin.email} autorizado com sucesso.`, 'success');
      els.addAdminForm.reset();
      await loadAdmins();
    } catch (_) {
      showBanner(els.adminManageResult, 'Erro de conexão ao cadastrar administrador.', 'error');
    } finally {
      els.addAdminBtn.disabled = false;
    }
  }

  async function handleRemoveAdmin(email) {
    hideBanner(els.adminManageResult);

    const confirmed = await openConfirmDialog({
      title: 'Remover administrador',
      message: 'A conta perderá imediatamente o acesso ao painel e ao endpoint de estornos.',
      confirmLabel: 'Remover acesso',
      summaryItems: [{ label: 'E-mail', value: email }]
    });

    if (!confirmed) return;

    try {
      const { response, body } = await apiFetch(`/api/admin/admins/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });

      if (response.status === 401) {
        handleUnauthorized(body?.error || 'Sessão expirada.');
        return;
      }

      if (!response.ok) {
        showBanner(els.adminManageResult, body?.error || 'Não foi possível remover o administrador.', 'error');
        return;
      }

      const extra = body?.inEnvList
        ? ' Atenção: este e-mail ainda consta na variável de ambiente ADMIN_EMAILS.'
        : '';
      showBanner(els.adminManageResult, `Acesso de ${email} removido.${extra}`, body?.inEnvList ? 'warning' : 'success');
      await loadAdmins();
    } catch (_) {
      showBanner(els.adminManageResult, 'Erro de conexão ao remover administrador.', 'error');
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
    els.txTbody.replaceChildren();
    els.estornosTbody.replaceChildren();
    els.adminsTbody.replaceChildren();
    els.tiersTbody.replaceChildren();
    els.rewardsTbody.replaceChildren();
    els.deliveriesTbody.replaceChildren();
    resetTierForm();
    resetRewardForm();
    resetDeliveryForm();
    hideBanner(els.refundResult);
    hideBanner(els.adminManageResult);
    hideBanner(els.tierResult);
    hideBanner(els.rewardResult);
    hideBanner(els.deliveryResult);
    handleUnauthorized();
  }

  // =========================================================
  // Inicialização
  // =========================================================
  function bindEvents() {
    initTabGroup([
      { tab: els.tabEstornos, panel: els.panelEstornos },
      { tab: els.tabRecompensas, panel: els.panelRecompensas },
      { tab: els.tabAdmins, panel: els.panelAdmins }
    ]);

    initTabGroup([
      { tab: els.subtabCatalogo, panel: els.subpanelCatalogo },
      { tab: els.subtabEntregas, panel: els.subpanelEntregas }
    ]);

    els.deliveryDate.value = getTodayPlainDateISO();

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

    els.addAdminForm.addEventListener('submit', handleAddAdminSubmit);
    els.logoutBtn.addEventListener('click', handleLogout);
  }

  initValidationListeners();
  bindEvents();
  checkSession();
})();
