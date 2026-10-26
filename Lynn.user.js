// ==UserScript==
// @name         🌸 Lynn
// @namespace    https://crack.wrtn.ai/
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/rkdskaaldls/lynn/main/Lynn.user.js
// @downloadURL  https://raw.githubusercontent.com/rkdskaaldls/lynn/main/Lynn.user.js
// @match        *://crack.wrtn.ai/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (window.__lynnScript) return;
  window.__lynnScript = true;

  const ID = {
    gear: 'lynn-gear',
    root: 'lynn-settings-root',
    backdrop: 'lynn-settings-backdrop',
    panel: 'lynn-settings-panel',
    toggleFullscreen: 'lynn-toggle-fullscreen',
    toggleModelBubble: 'lynn-toggle-model-bubble',
    toggleRecommendReply: 'lynn-toggle-recommend-reply',
    toggleLogTools: 'lynn-toggle-log-tools',
    toggleEmptySend: 'lynn-toggle-empty-send',
    toggleLineBreak: 'lynn-toggle-line-break',
    toggleChrome: 'lynn-toggle-chrome',
    toggleBars: 'lynn-toggle-bars',
    chromeTop: 'lynn-chrome-top',
    visibleModelDisclosure: 'lynn-visible-model-disclosure',
    visibleModelPanel: 'lynn-visible-model-panel',
    officialModelVisibilityStyle: 'lynn-official-model-visibility-style',
    bottomModelButton: 'lynn-bottom-model-button',
    bottomModelPopup: 'lynn-bottom-model-popup',
    fullscreenButton: 'lynn-fullscreen-btn',
  };

  const LS = {
    fullscreen: 'lynn_fullscreen_button',
    modelBubble: 'lynn_model_bubble',
    recommendReply: 'lynn_recommend_reply',
    logTools: 'lynn_log_tools',
    emptySend: 'lynn_empty_send_guard',
    lineBreak: 'lynn_line_break_optimize',
    chromeHover: 'lynn_chrome_hover',
    barsHover: 'lynn_bars_hover',
    visibleModels: 'lynn_visible_models',
    registry: 'lynn_model_registry',
    visibleOpen: 'lynn_visible_models_open',
    orderSource: 'lynn_model_order_source',
  };

  const LEGACY = {
    fullscreen: 'crack_ui_fullscreen_button',
    modelBubble: 'crack_ui_bottom_model_picker',
    emptySend: 'crack_ui_empty_send_guard',
    lineBreak: 'crack_ui_line_break_optimize',
    visibleModels: 'crack_ui_bottom_model_visible_models',
    registry: 'crack_ui_bottom_model_registry_v2',
    visibleOpen: 'crack_ui_bottom_model_visible_models_open',
  };

  const EMPTY_SEND_ABSENT = '__lynn_absent__';
  const MODEL_MENU_SCAN_DELAYS = [80, 220, 520];

  let cachedHeader = null;
  let sidebarCollapsedHref = '';
  let sidebarCollapseHref = '';
  let sidebarCollapseTries = 0;
  let lastSidebarClick = 0;
  let barsCloseTimer = 0;
  let cachedBottomSendButton = null;
  let cachedComposerEditable = null;
  let cachedOriginalModelButton = null;
  let emptySendGuardUiRaf = 0;
  let panelOpen = false;
  let initScheduled = false;
  let lastInitRun = 0;
  let initThrottleTimer = null;
  let syncingOfficialModelInfo = false;
  let modelPopupInteractionAt = 0;
  let modelMenuConcealTimer = null;
  let officialModelRegistryScanTimers = [];
  let registryCleanupNeeded = false;

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }

  function readOwnOrLegacy(key, legacyKey) {
    const own = readStorage(key);
    if (own != null) return own;
    return readStorage(legacyKey);
  }

  function loadFlag(key, legacyKey, fallback) {
    const raw = readOwnOrLegacy(key, legacyKey);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return fallback;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch] || ch));
  }

  function cssEscapeAttr(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function isEpisodeRoute() {
    return /^\/stories\/[^/]+\/episodes\/[^/]+/.test(location.pathname);
  }

  function isFullscreenRoute() {
    const path = String(location.pathname || '');
    return (/\/stories\//.test(path) && /\/episodes\//.test(path)) ||
      (/\/characters\//.test(path) && /\/chats\//.test(path));
  }

  function isActiveChatRoute() {
    const path = String(location.pathname || '').replace(/\/+$/, '');
    return /^\/stories\/[^/]+\/episodes\/[^/]+$/.test(path) ||
      /^\/characters\/[^/]+\/chats\/[^/]+$/.test(path) ||
      /^\/u\/[^/]+\/c\/[^/]+$/.test(path);
  }

  function ready(fn) {
    if (document.body) fn();
    else requestAnimationFrame(() => ready(fn));
  }

  function modelSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  let fullscreenEnabled = loadFlag(LS.fullscreen, LEGACY.fullscreen, true);
  let modelBubbleEnabled = loadFlag(LS.modelBubble, LEGACY.modelBubble, true);
  let recommendReplyVisible = loadFlag(LS.recommendReply, '', false);
  let logToolsEnabled = loadFlag(LS.logTools, '', true);
  let emptySendGuard = loadFlag(LS.emptySend, LEGACY.emptySend, true);
  let lineBreakOptimize = loadFlag(LS.lineBreak, LEGACY.lineBreak, true);
  let chromeHover = loadFlag(LS.chromeHover, '', true);
  let barsHover = loadFlag(LS.barsHover, '', true);
  let visibleModelListOpen = readOwnOrLegacy(LS.visibleOpen, LEGACY.visibleOpen) !== '0';

  function applyLineBreakOptimize() {
    document.documentElement.classList.toggle('lynn-line-break', lineBreakOptimize);
  }

  applyLineBreakOptimize();

  function findSidebarToggle() {
    return document.querySelector('button[aria-label="사이드바 접기"]');
  }

  function pressSidebarToggle(button) {
    const view = button.ownerDocument?.defaultView || window;
    const pointer = { bubbles: true, cancelable: true, view, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    const mouse = { bubbles: true, cancelable: true, view, button: 0, buttons: 1 };
    try { button.dispatchEvent(new PointerEvent('pointerdown', pointer)); } catch { }
    button.dispatchEvent(new MouseEvent('mousedown', mouse));
    try { button.dispatchEvent(new PointerEvent('pointerup', { ...pointer, buttons: 0 })); } catch { }
    button.dispatchEvent(new MouseEvent('mouseup', { ...mouse, buttons: 0 }));
    button.click();
  }

  function isBarHoverDevice() {
    if (/Android|Mobile/i.test(navigator.userAgent || '')) return false;
    if (window.matchMedia('(pointer: coarse)').matches) return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function barsAreHovered() {
    if (panelOpen) return true;
    return !!document.querySelector(
      `#${ID.chromeTop}:hover, [data-lynn-bar]:hover, [data-radix-popper-content-wrapper]:hover, [role="menu"]:hover, [role="listbox"]:hover`
    );
  }

  function setBarsOpen(open) {
    document.documentElement.classList.toggle('lynn-bars-open', open);
  }

  function scheduleBarsClose() {
    clearTimeout(barsCloseTimer);
    barsCloseTimer = setTimeout(() => {
      if (!barsAreHovered()) setBarsOpen(false);
    }, 240);
  }

  function bindQuietBar(bar) {
    if (!bar || bar.dataset.lynnBarBound === '1') return;
    bar.dataset.lynnBarBound = '1';
    bar.addEventListener('pointerenter', () => {
      if (!isBarHoverDevice()) return;
      clearTimeout(barsCloseTimer);
      setBarsOpen(true);
    });
    bar.addEventListener('pointerleave', () => {
      if (!isBarHoverDevice()) return;
      scheduleBarsClose();
    });
  }

  let barTouchStart = null;

  function isBarChromeTarget(target) {
    return !!target.closest(
      `#${ID.chromeTop}, [data-lynn-bar], #${ID.panel}, #${ID.gear}, #${ID.root}, #${ID.bottomModelPopup}, #${ID.bottomModelButton}, [data-radix-popper-content-wrapper], [role="menu"], [role="listbox"]`
    );
  }

  function isBarInteractiveTarget(target) {
    return !!target.closest(
      'button, a, input, textarea, select, label, summary, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="switch"], [role="textbox"]'
    );
  }

  function directText(element) {
    let text = '';
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.textContent || '';
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  function isBarBackgroundTarget(target) {
    if (!(target instanceof Element)) return false;
    if (isBarChromeTarget(target) || isBarInteractiveTarget(target)) return false;
    if (target.closest('img, video, canvas, svg, picture')) return false;
    const composer = findChatComposerEditable();
    if (composer) {
      const box = composer.closest('form') || composer.parentElement;
      if (box?.contains(target)) return false;
    }
    if (directText(target).length > 0) return false;
    if (target.closest('p, li, blockquote, pre, h1, h2, h3, h4, td, th')) return false;
    const text = (target.textContent || '').replace(/\s+/g, ' ').trim();
    const rect = target.getBoundingClientRect();
    if (text.length > 24 && rect.height > 0 && rect.height < 240) return false;
    return true;
  }

  function bindBarTouch() {
    if (document.documentElement.dataset.lynnBarTouch === '1') return;
    document.documentElement.dataset.lynnBarTouch = '1';
    document.addEventListener('pointerdown', (event) => {
      if (!barsHover || isBarHoverDevice() || !event.isPrimary) return;
      barTouchStart = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: Date.now(),
      };
    }, true);
    document.addEventListener('pointercancel', () => {
      barTouchStart = null;
    }, true);
    document.addEventListener('pointerup', (event) => {
      if (!barsHover || isBarHoverDevice()) return;
      const start = barTouchStart;
      barTouchStart = null;
      if (!start || start.id !== event.pointerId) return;
      if (!isActiveChatRoute()) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (dx * dx + dy * dy > 144) return;
      if (Date.now() - start.t > 450) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (event.clientY < 72) return;
      if (isBarChromeTarget(target)) return;
      const open = document.documentElement.classList.contains('lynn-bars-open');
      if (isBarBackgroundTarget(target)) {
        setBarsOpen(!open);
        return;
      }
      if (open) setBarsOpen(false);
    }, true);
  }

  function syncQuietBars() {
    const allowBars = barsHover && isActiveChatRoute();
    document.documentElement.classList.toggle('lynn-bars-hide', allowBars);
    document.documentElement.classList.toggle('lynn-bars-touch', allowBars && !isBarHoverDevice());
    if (!allowBars) {
      setBarsOpen(false);
      document.getElementById(ID.chromeTop)?.remove();
      return;
    }
    if (!document.body) return;
    const header = findHeader();
    if (header) {
      header.dataset.lynnBar = 'header';
      bindQuietBar(header);
    }
    const headerHeight = header?.offsetHeight > 20 ? header.offsetHeight : 0;
    for (const bar of document.querySelectorAll('[class*="group-hover/header:translate-y-0"]')) {
      if (!(bar instanceof HTMLElement) || bar === header || bar.closest(`#${ID.panel}`)) continue;
      const rect = bar.getBoundingClientRect();
      if (rect.height < 30 || rect.height > 80 || rect.width < 180) continue;
      bar.dataset.lynnBar = 'room';
      const parentTop = (bar.offsetParent instanceof HTMLElement ? bar.offsetParent : bar.parentElement)?.getBoundingClientRect().top ?? 0;
      const shift = header && parentTop < Math.max(headerHeight, 24) ? headerHeight : 0;
      bar.style.setProperty('--lynn-room-shift', `${shift}px`);
      bindQuietBar(bar);
    }
    let zone = document.getElementById(ID.chromeTop);
    if (!zone) {
      zone = document.createElement('div');
      zone.id = ID.chromeTop;
      zone.title = '상단 막대 보기';
      document.body.appendChild(zone);
      zone.addEventListener('pointerenter', () => {
        if (!isBarHoverDevice()) return;
        clearTimeout(barsCloseTimer);
        setBarsOpen(true);
      });
      zone.addEventListener('pointerleave', () => {
        if (!isBarHoverDevice()) return;
        scheduleBarsClose();
      });
    }
    bindBarTouch();
  }

  function applyChromeHover() {
    syncQuietBars();
    if (!chromeHover || !document.body || !isActiveChatRoute()) return;
    if (sidebarCollapseHref !== location.href) {
      sidebarCollapseHref = location.href;
      sidebarCollapseTries = 0;
      sidebarCollapsedHref = '';
    }
    if (sidebarCollapsedHref === location.href || sidebarCollapseTries >= 4) return;
    const button = findSidebarToggle();
    if (!button) return;
    const now = Date.now();
    if (now - lastSidebarClick < 800) return;
    lastSidebarClick = now;
    sidebarCollapseTries += 1;
    pressSidebarToggle(button);
    setTimeout(() => {
      if (!findSidebarToggle()) sidebarCollapsedHref = location.href;
    }, 500);
  }

  applyChromeHover();

  function compareChatModelNames(a, b) {
    const families = ['페이블챗', '울트라챗', '하이퍼챗', '슈퍼챗', '프로챗', '파워챗'];
    const rank = (name) => {
      const text = normalizeText(name);
      const family = families.findIndex((item) => text.startsWith(item));
      const version = Number(text.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
      return [family === -1 ? families.length : family, -version, text];
    };
    const left = rank(a);
    const right = rank(b);
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] < right[index]) return -1;
      if (left[index] > right[index]) return 1;
    }
    return 0;
  }

  function placeUltraChatBelowFable(order) {
    const crack = '울트라챗 1.0';
    const hasUltra = order.includes('울트라챗') || order.includes(crack);
    const next = order.filter((name) => name !== '울트라챗' && name !== crack);
    if (!hasUltra) return next;
    const fableIndex = next.indexOf('페이블챗 1.0');
    next.splice(fableIndex === -1 ? 0 : fableIndex + 1, 0, crack);
    return next;
  }

  function migrateLynnUltraChat() {
    const crack = '울트라챗 1.0';
    const hadLynn = Object.prototype.hasOwnProperty.call(CHAT_MODEL_INFO, '울트라챗') || CHAT_MODEL_ORDER.includes('울트라챗');
    const image = CHAT_MODEL_INFO[crack]?.image || CHAT_MODEL_INFO['울트라챗']?.image || '';
    delete CHAT_MODEL_INFO['울트라챗'];
    if (image) CHAT_MODEL_INFO[crack] = { image };
    const nextOrder = placeUltraChatBelowFable(CHAT_MODEL_ORDER);
    const moved = nextOrder.some((name, index) => name !== CHAT_MODEL_ORDER[index]) || nextOrder.length !== CHAT_MODEL_ORDER.length;
    CHAT_MODEL_ORDER = nextOrder;
    CHAT_MODEL_ICON_MAP = buildChatModelIconMap(CHAT_MODEL_INFO);
    if (hadLynn || moved) registryCleanupNeeded = true;
  }

  function isRetiredRegistryName(name) {
    const normalized = normalizeText(name);
    if (!normalized) return false;
    return /\s*·\s*서비스\s*종료\s*$/.test(normalized);
  }

  function getModelIconFileFromUrl(value) {
    let text = String(value || '').trim();
    if (!text) return '';

    for (let i = 0; i < 2; i += 1) {
      try {
        const decoded = decodeURIComponent(text);
        if (decoded === text) break;
        text = decoded;
      } catch {
        break;
      }
    }

    const nested = text.match(/model-icon\/([^/?#"'<>\s]+\.(?:webp|png|svg|avif))/i);
    if (nested?.[1]) return nested[1];
    return text.split(/[?#]/)[0].split('/').pop() || '';
  }

  function buildChatModelIconMap(infoMap) {
    const map = {};
    for (const [name, info] of Object.entries(infoMap || {})) {
      const file = getModelIconFileFromUrl(info?.image);
      if (file) map[file] = name;
    }
    return map;
  }

  function loadChatModelRegistry() {
    const raw = readOwnOrLegacy(LS.registry, LEGACY.registry);
    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return {};

      const next = {};
      for (const entry of parsed) {
        const name = normalizeText(entry?.name);
        const image = String(entry?.image || '').trim();
        if (!name || !image.includes('model-icon')) continue;
        if (isRetiredRegistryName(name)) {
          registryCleanupNeeded = true;
          continue;
        }
        if (!Object.prototype.hasOwnProperty.call(next, name)) next[name] = { image };
      }

      return next;
    } catch {
      return {};
    }
  }

  let CHAT_MODEL_INFO = loadChatModelRegistry();
  let CHAT_MODEL_ORDER = Object.keys(CHAT_MODEL_INFO);
  let CHAT_MODEL_ICON_MAP = buildChatModelIconMap(CHAT_MODEL_INFO);

  function saveChatModelRegistry() {
    writeJsonStorage(
      LS.registry,
      CHAT_MODEL_ORDER.map((name) => ({
        name,
        image: String(CHAT_MODEL_INFO[name]?.image || ''),
      }))
    );
  }

  if (readStorage(LS.orderSource) !== 'menu') {
    const sortedOrder = [...CHAT_MODEL_ORDER].sort(compareChatModelNames);
    const orderChanged = sortedOrder.some((name, index) => name !== CHAT_MODEL_ORDER[index]);
    if (orderChanged) {
      CHAT_MODEL_ORDER = sortedOrder;
      saveChatModelRegistry();
    }
  }

  migrateLynnUltraChat();

  function loadVisibleChatModelNames() {
    const raw = readOwnOrLegacy(LS.visibleModels, LEGACY.visibleModels);
    if (!raw) return [...CHAT_MODEL_ORDER];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...CHAT_MODEL_ORDER];
      const wanted = parsed.map((name) => (normalizeText(name) === '울트라챗' ? '울트라챗 1.0' : name));
      if (wanted.some((name, index) => name !== parsed[index])) registryCleanupNeeded = true;
      const next = CHAT_MODEL_ORDER.filter((name) => wanted.includes(name));
      return next.length ? next : [...CHAT_MODEL_ORDER];
    } catch {
      return [...CHAT_MODEL_ORDER];
    }
  }

  let visibleChatModelNames = loadVisibleChatModelNames();

  function saveVisibleChatModelNames() {
    writeJsonStorage(LS.visibleModels, visibleChatModelNames);
  }

  function saveVisibleModelListOpen() {
    writeStorage(LS.visibleOpen, visibleModelListOpen ? '1' : '0');
  }

  if (registryCleanupNeeded) {
    saveChatModelRegistry();
    saveVisibleChatModelNames();
  }

  function isKnownChatModelName(value) {
    return Object.prototype.hasOwnProperty.call(CHAT_MODEL_INFO, normalizeText(value));
  }

  function isVisibleElement(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getVisibleChatModelNames() {
    const next = CHAT_MODEL_ORDER.filter((name) => visibleChatModelNames.includes(name));
    if (next.length) return next;
    visibleChatModelNames = [...CHAT_MODEL_ORDER];
    saveVisibleChatModelNames();
    return [...CHAT_MODEL_ORDER];
  }

  function getHiddenChatModelNames() {
    const visible = new Set(getVisibleChatModelNames());
    return CHAT_MODEL_ORDER.filter((name) => !visible.has(name));
  }

  function getModelIconSourceFromNode(node) {
    if (!node) return '';
    const icon = node.matches?.('img[src*="model-icon"], img[srcset*="model-icon"]')
      ? node
      : node.querySelector?.('img[src*="model-icon"], img[srcset*="model-icon"]');
    if (!icon) return '';

    const src = String(icon.currentSrc || icon.getAttribute?.('src') || icon.src || '').trim();
    if (src) return src;

    const srcset = String(icon.getAttribute?.('srcset') || '').trim();
    return srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
  }

  function getRawModelNameFromNode(node) {
    if (!node) return '';

    const icon = node.matches?.('img[src*="model-icon"], img[srcset*="model-icon"], img[alt]')
      ? node
      : node.querySelector?.('img[src*="model-icon"], img[srcset*="model-icon"], img[alt]');

    const imgAlt = normalizeText(icon?.getAttribute?.('alt'));
    if (imgAlt) return imgAlt;

    const src = getModelIconSourceFromNode(node);
    const fromSrc = CHAT_MODEL_ICON_MAP[getModelIconFileFromUrl(src)];
    if (fromSrc) return fromSrc;

    const row = icon?.closest?.('.flex.items-center, [class*="items-center"]') || node;
    const spanText = [...(row.querySelectorAll?.('span') || [])]
      .map((span) => normalizeText(span.textContent))
      .find((text) => text && text.length <= 40 && !/변경\s*예정|권장|\d+\s*개/.test(text));
    if (spanText) return spanText;

    const text = normalizeText(node.textContent);
    return CHAT_MODEL_ORDER.find((model) => text.includes(model)) || '';
  }

  function getModelNameFromNode(node) {
    return normalizeText(getRawModelNameFromNode(node));
  }

  function getDisplayModelInfo(modelName) {
    const name = normalizeText(modelName);
    if (isKnownChatModelName(name)) return { name, ...CHAT_MODEL_INFO[name] };
    return { name: name || '모델', image: '' };
  }

  function isOriginalModelButtonCandidate(button) {
    const panel = document.getElementById(ID.panel);
    const popup = document.getElementById(ID.bottomModelPopup);
    if (!button || button.id === ID.bottomModelButton || button.id === ID.fullscreenButton || button.id === ID.gear) return false;
    if (!button.isConnected) return false;
    if (panel?.contains(button) || popup?.contains(button)) return false;
    const icon = button.querySelector('img[src*="model-icon"], img[srcset*="model-icon"]');
    if (!icon) return false;
    return !!getRawModelNameFromNode(button) || !!getModelIconSourceFromNode(button);
  }

  function findOriginalModelButton() {
    if (isOriginalModelButtonCandidate(cachedOriginalModelButton)) return cachedOriginalModelButton;

    const found = [...document.querySelectorAll(
      'button[aria-haspopup="menu"], button[aria-haspopup="dialog"], button[id^="radix-"], button[role="combobox"][aria-controls]'
    )].find((button) => isOriginalModelButtonCandidate(button)) || null;

    cachedOriginalModelButton = found;
    return found;
  }

  function getOfficialModelItemCandidates(menu) {
    if (!(menu instanceof Element)) return [];
    return [...menu.querySelectorAll(
      '[role="menuitem"], [role="option"], [data-radix-select-item], button'
    )].filter((item) => item.querySelector('img[src*="model-icon"], img[srcset*="model-icon"]'));
  }

  function getOfficialModelMenu() {
    const popup = document.getElementById(ID.bottomModelPopup);
    const panel = document.getElementById(ID.panel);
    return [...document.querySelectorAll(
      '[role="menu"], [role="listbox"], [data-radix-select-content], [role="dialog"]'
    )].find((menu) => {
      if (popup?.contains(menu) || panel?.contains(menu)) return false;
      return getOfficialModelItemCandidates(menu).length >= 2;
    }) || null;
  }

  function getCurrentModelName() {
    const buttonName = getModelNameFromNode(findOriginalModelButton());
    if (buttonName) return buttonName;

    const icons = [...document.querySelectorAll('img[src*="model-icon"], img[srcset*="model-icon"]')];
    for (const icon of icons) {
      if (icon.closest(`#${ID.bottomModelButton}, #${ID.bottomModelPopup}, #${ID.panel}, [role="menuitem"], [role="option"], [role="listbox"], [role="dialog"]`)) continue;
      const alt = normalizeText(icon.getAttribute('alt'));
      if (alt) return alt;
      const fromSrc = CHAT_MODEL_ICON_MAP[getModelIconFileFromUrl(icon.getAttribute('src') || icon.src || '')];
      if (fromSrc) return fromSrc;
    }

    return '';
  }

  function getCurrentModelInfo() {
    const name = getCurrentModelName();
    if (isKnownChatModelName(name)) return getDisplayModelInfo(name);
    return {
      name: name || '모델',
      image: getModelIconSourceFromNode(findOriginalModelButton()),
    };
  }

  function scanOfficialModelMenuEntries(menu = getOfficialModelMenu()) {
    if (!menu) return [];
    const modelItems = getOfficialModelItemCandidates(menu);
    if (modelItems.length < 2) return [];

    const entries = [];
    const seenNames = new Set();
    let unresolved = 0;
    for (const item of modelItems) {
      const image = getModelIconSourceFromNode(item);
      const name = getModelNameFromNode(item);
      const iconFile = getModelIconFileFromUrl(image);
      if (!name || !image || !iconFile) {
        unresolved += 1;
        continue;
      }
      if (seenNames.has(name) || isRetiredRegistryName(name)) continue;
      seenNames.add(name);
      entries.push({ name, image });
    }

    if (unresolved || entries.length < 2) return [];
    return entries;
  }

  function syncVisibleChatModelsToRegistry(previousOrder, nextOrder) {
    const previousKnown = new Set(previousOrder);
    const visibleSet = new Set(visibleChatModelNames);
    let nextVisible = nextOrder.filter((name) => visibleSet.has(name) || !previousKnown.has(name));
    if (!nextVisible.length) nextVisible = [...nextOrder];
    visibleChatModelNames = nextVisible;
    saveVisibleChatModelNames();
  }

  function syncChatModelRegistryFromOfficialMenu(menu = getOfficialModelMenu()) {
    const entries = scanOfficialModelMenuEntries(menu);
    if (!entries.length) {
      if (menu) applyOfficialModelMenuVisibility(menu);
      return false;
    }

    const previousOrder = [...CHAT_MODEL_ORDER];
    const menuNames = entries.map((entry) => entry.name).filter((name) => name !== '울트라챗');
    const menuSet = new Set(menuNames);
    const nextOrder = placeUltraChatBelowFable([
      ...menuNames,
      ...previousOrder.filter((name) => !menuSet.has(name) && name !== '울트라챗'),
    ]);
    const nextInfo = Object.fromEntries(
      previousOrder
        .filter((name) => name !== '울트라챗')
        .map((name) => [name, { ...(CHAT_MODEL_INFO[name] || {}) }])
    );
    let changed = nextOrder.some((name, index) => name !== previousOrder[index]) ||
      nextOrder.length !== previousOrder.length;

    for (const entry of entries) {
      if (!nextInfo[entry.name]) nextInfo[entry.name] = {};
      if (entry.image && String(nextInfo[entry.name].image || '') !== String(entry.image)) {
        nextInfo[entry.name].image = entry.image;
        changed = true;
      }
    }

    applyOfficialModelMenuVisibility(menu);
    if (!changed) return false;

    CHAT_MODEL_INFO = nextInfo;
    CHAT_MODEL_ORDER = nextOrder;
    CHAT_MODEL_ICON_MAP = buildChatModelIconMap(CHAT_MODEL_INFO);
    writeStorage(LS.orderSource, 'menu');
    saveChatModelRegistry();
    syncVisibleChatModelsToRegistry(previousOrder, nextOrder);
    refreshVisibleModelChoicesPanel();
    syncOfficialModelVisibilityStyle(getHiddenChatModelNames());
    applyOfficialModelMenuVisibility(menu);

    if (isBottomModelPopupOpen()) {
      renderBottomModelPopup(document.getElementById(ID.bottomModelButton), getStaticModelList());
    }
    return true;
  }

  function clearOfficialModelRegistryScanTimers() {
    officialModelRegistryScanTimers.forEach((timer) => clearTimeout(timer));
    officialModelRegistryScanTimers = [];
  }

  function scheduleOfficialModelRegistryScanBurst() {
    clearOfficialModelRegistryScanTimers();
    officialModelRegistryScanTimers = MODEL_MENU_SCAN_DELAYS.map((delay) => setTimeout(() => {
      const menu = getOfficialModelMenu();
      if (menu) syncChatModelRegistryFromOfficialMenu(menu);
      else syncOfficialModelVisibility();
    }, delay));
  }

  function bindOfficialModelRegistryScan(button = findOriginalModelButton()) {
    if (!button || button.dataset.lynnModelRegistryBound === '1') return;
    button.dataset.lynnModelRegistryBound = '1';
    button.addEventListener('click', scheduleOfficialModelRegistryScanBurst, { passive: true });
  }

  function syncOfficialModelVisibilityStyle(hiddenNames = getHiddenChatModelNames()) {
    let style = document.getElementById(ID.officialModelVisibilityStyle);
    if (!hiddenNames.length) {
      style?.remove();
      return;
    }

    const selectors = hiddenNames.flatMap((name) => {
      const file = getModelIconFileFromUrl(CHAT_MODEL_INFO[name]?.image);
      const escapedName = cssEscapeAttr(name);
      const next = [
        `[data-radix-popper-content-wrapper] :is([role="menuitem"], [role="option"], [data-radix-select-item]):has(img[alt="${escapedName}"])`,
        `[data-radix-popper-content-wrapper] > [role="dialog"] button:has(img[alt="${escapedName}"])`,
      ];
      if (file) {
        const escapedFile = cssEscapeAttr(file);
        next.push(
          `[data-radix-popper-content-wrapper] :is([role="menuitem"], [role="option"], [data-radix-select-item]):has(img[src*="${escapedFile}"])`,
          `[data-radix-popper-content-wrapper] > [role="dialog"] button:has(img[src*="${escapedFile}"])`
        );
      }
      return next;
    });

    if (!style) {
      style = document.createElement('style');
      style.id = ID.officialModelVisibilityStyle;
      (document.head || document.documentElement).appendChild(style);
    }

    const nextCss = `${selectors.join(',\n')} {\n  display: none !important;\n}`;
    if (style.textContent !== nextCss) style.textContent = nextCss;
  }

  function applyOfficialModelMenuVisibility(menu = getOfficialModelMenu()) {
    if (!menu) return 0;
    const visible = new Set(getVisibleChatModelNames());
    let hiddenCount = 0;

    getOfficialModelItemCandidates(menu).forEach((item) => {
      const name = getModelNameFromNode(item);
      if (!isKnownChatModelName(name)) {
        delete item.dataset.lynnOfficialModelHidden;
        return;
      }
      const shouldHide = !visible.has(name);
      item.dataset.lynnOfficialModelHidden = shouldHide ? '1' : '0';
      if (shouldHide) hiddenCount += 1;
    });

    return hiddenCount;
  }

  function syncOfficialModelVisibility() {
    const hiddenNames = getHiddenChatModelNames();
    syncOfficialModelVisibilityStyle(hiddenNames);
    if (hiddenNames.length) applyOfficialModelMenuVisibility();
  }

  function isOfficialTriggerOpen(el) {
    return el?.getAttribute?.('aria-expanded') === 'true' || el?.dataset?.state === 'open';
  }

  function dispatchModelPointer(el, type) {
    const init = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 };
    const EventType = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    try { el.dispatchEvent(new EventType(type, init)); } catch { }
  }

  function fireModelClickSequence(el, mode) {
    if (!el) return false;
    if (mode === 'open' && isOfficialTriggerOpen(el)) return true;
    dispatchModelPointer(el, 'pointerdown');
    dispatchModelPointer(el, 'mousedown');
    const openedByPress = mode === 'open' && isOfficialTriggerOpen(el);
    dispatchModelPointer(el, 'pointerup');
    dispatchModelPointer(el, 'mouseup');
    if (openedByPress) return true;
    dispatchModelPointer(el, 'click');
    return true;
  }

  async function waitForOfficialModelMenu(timeout = 900) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const menu = getOfficialModelMenu();
      if (menu) return menu;
      await modelSleep(35);
    }
    return null;
  }

  function closeOfficialModelMenuIfOpen() {
    const trigger = findOriginalModelButton();
    const expanded = trigger?.getAttribute('aria-expanded') === 'true' || trigger?.dataset?.state === 'open';
    if (!expanded) return;
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      }));
    } catch {
    }
  }

  function blurModelPickerFocus() {
    const officialBtn = findOriginalModelButton();
    try { officialBtn?.blur?.(); } catch { }
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const shouldBlur = active === officialBtn ||
      officialBtn?.contains?.(active) ||
      !!active.closest?.('[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"], [role="menuitem"], [role="listbox"], [role="option"]');
    if (shouldBlur) {
      try { active.blur(); } catch { }
    }
  }

  function concealOfficialModelMenuBriefly(ms = 700) {
    document.documentElement.classList.add('lynn-conceal-model-menu');
    closeOfficialModelMenuIfOpen();
    clearTimeout(modelMenuConcealTimer);
    modelMenuConcealTimer = setTimeout(() => {
      modelMenuConcealTimer = null;
      if (syncingOfficialModelInfo) return;
      document.documentElement.classList.remove('lynn-conceal-model-menu');
    }, ms);
  }

  function watchChatSwitches() {
    if (history.pushState.__lynnWrapped) return;
    const wrap = (original) => {
      const wrapped = function () {
        const before = location.pathname;
        const result = original.apply(this, arguments);
        if (location.pathname !== before) concealOfficialModelMenuBriefly();
        return result;
      };
      wrapped.__lynnWrapped = true;
      return wrapped;
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', () => concealOfficialModelMenuBriefly());
  }

  async function selectModelInvisibly(targetModelName) {
    const targetName = normalizeText(targetModelName);
    if (!isKnownChatModelName(targetName)) return false;

    for (let waited = 0; waited < 6000; waited += 30) {
      if (!syncingOfficialModelInfo) break;
      await modelSleep(30);
    }
    if (syncingOfficialModelInfo) return false;

    const officialBtn = findOriginalModelButton();
    if (!officialBtn) return false;

    const clickTargetFromOfficialMenu = async () => {
      if (officialBtn.getAttribute('aria-expanded') !== 'true' && officialBtn.dataset.state !== 'open') {
        fireModelClickSequence(officialBtn, 'open');
      }
      await modelSleep(90);
      const modelMenu = await waitForOfficialModelMenu(900);
      if (!modelMenu) return false;

      const targetItem = getOfficialModelItemCandidates(modelMenu).find((item) => {
        const itemName = getModelNameFromNode(item);
        return itemName === targetName || normalizeText(item.textContent).includes(targetName);
      });
      if (!targetItem) return false;

      try { targetItem.focus?.(); } catch { }
      fireModelClickSequence(targetItem, 'choose');
      await modelSleep(260);
      return getCurrentModelName() === targetName;
    };

    syncingOfficialModelInfo = true;
    clearTimeout(modelMenuConcealTimer);
    modelMenuConcealTimer = null;
    document.documentElement.classList.add('lynn-conceal-model-menu');
    try {
      let ok = await clickTargetFromOfficialMenu();
      if (ok) return true;
      closeOfficialModelMenuIfOpen();
      await modelSleep(120);
      ok = await clickTargetFromOfficialMenu();
      return ok || getCurrentModelName() === targetName;
    } finally {
      setTimeout(() => {
        closeOfficialModelMenuIfOpen();
        syncingOfficialModelInfo = false;
        blurModelPickerFocus();
        document.documentElement.classList.remove('lynn-conceal-model-menu');
      }, 280);
    }
  }

  function getStaticModelList() {
    const current = getCurrentModelName();
    return getVisibleChatModelNames().map((name) => {
      const info = getDisplayModelInfo(name);
      return { name, icon: info.image, selected: current === name };
    });
  }

  function isChatComposerSendButton(button) {
    if (!button || button.id === ID.bottomModelButton || button.id === ID.gear || button.id === ID.fullscreenButton) return false;
    if (!isVisibleElement(button)) return false;

    const rect = button.getBoundingClientRect();
    if (rect.top < Math.max(240, window.innerHeight * 0.45)) return false;
    if (rect.width < 22 || rect.width > 44 || rect.height < 22 || rect.height > 44) return false;
    if (button.closest('[aria-label*="보관함"], [data-testid="virtuoso-scroller"]')) return false;

    const hasSendPath = !!button.querySelector(
      'svg path[d^="M18.77 11.13"], svg path[d^="M18.77"], svg path[d*="10.27-5.93"], svg path[d*="11.86a1 1"], svg path[d^="M18.38 12.88"], svg path[d*="15.38"], svg path[d*="6.62 6.63"]'
    );
    if (!hasSendPath) return false;

    const cls = String(button.className || '');
    const style = button.getAttribute('style') || '';
    return cls.includes('bg-primary') ||
      cls.includes('text-primary-foreground') ||
      /rgb\(255,\s*68,\s*50\)/i.test(style) ||
      /#FE4532/i.test(style);
  }

  function findBottomSendButton() {
    if (cachedBottomSendButton?.isConnected && isChatComposerSendButton(cachedBottomSendButton)) {
      return cachedBottomSendButton;
    }

    const candidates = [...document.querySelectorAll('button')]
      .filter(isChatComposerSendButton)
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (br.top - ar.top) || (br.left - ar.left);
      });

    cachedBottomSendButton = candidates[0] || null;
    return cachedBottomSendButton;
  }

  function normalizeComposerText(text) {
    return String(text || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  function getEditableText(editable) {
    if (!editable) return '';
    const tag = String(editable.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return editable.value || '';
    if (editable.isContentEditable || editable.getAttribute('contenteditable') === 'true') {
      return editable.innerText || editable.textContent || '';
    }
    return editable.value || editable.innerText || editable.textContent || '';
  }

  function isComposerEditableCandidate(editable, sendButton = findBottomSendButton()) {
    if (!editable || !editable.isConnected) return false;
    if (editable.closest?.(`#${ID.panel}, #${ID.bottomModelPopup}, #${ID.root}`)) return false;

    const tag = String(editable.tagName || '').toLowerCase();
    if (tag === 'input') {
      const type = String(editable.type || '').toLowerCase();
      if (type && !['text', 'search'].includes(type)) return false;
      if (/검색|search/i.test(String(editable.getAttribute('placeholder') || ''))) return false;
    }

    const rect = editable.getBoundingClientRect();
    if (rect.width <= 40 || rect.height <= 8) return false;
    if (rect.top < Math.max(220, window.innerHeight * 0.35)) return false;

    if (sendButton?.isConnected) {
      const sendRect = sendButton.getBoundingClientRect();
      const verticalDistance = Math.abs((rect.top + rect.height / 2) - (sendRect.top + sendRect.height / 2));
      const horizontalDistance = Math.abs((rect.right + rect.left) / 2 - (sendRect.right + sendRect.left) / 2);
      if (verticalDistance > 120 && horizontalDistance > 280) return false;
    }

    return true;
  }

  function isDirectChatComposerEditable(editable) {
    if (!editable?.isConnected || !isEpisodeRoute()) return false;
    if (editable.matches?.('.__chat_input_textarea[contenteditable="true"]')) return true;
    const placeholder = normalizeText(
      editable.getAttribute?.('data-placeholder') || editable.getAttribute?.('placeholder') || ''
    );
    return placeholder === '메시지 보내기' &&
      !!editable.matches?.('textarea, [contenteditable="true"], [role="textbox"]');
  }

  function findChatComposerEditable() {
    if (!isEpisodeRoute()) {
      cachedComposerEditable = null;
      return null;
    }

    const sendButton = findBottomSendButton();
    if (cachedComposerEditable?.isConnected) {
      if (isDirectChatComposerEditable(cachedComposerEditable)) return cachedComposerEditable;
      if (isComposerEditableCandidate(cachedComposerEditable, sendButton)) return cachedComposerEditable;
    }
    cachedComposerEditable = null;

    const direct = document.querySelector(
      '.__chat_input_textarea[contenteditable="true"], [contenteditable="true"][data-placeholder="메시지 보내기"], textarea[placeholder="메시지 보내기"]'
    );
    if (direct && isComposerEditableCandidate(direct, sendButton)) {
      cachedComposerEditable = direct;
      return direct;
    }

    const roots = [];
    let node = sendButton?.parentElement || null;
    for (let i = 0; node && i < 7; i += 1) {
      roots.push(node);
      node = node.parentElement;
    }
    if (document.body) roots.push(document.body);

    const seen = new Set();
    const candidates = [];
    roots.forEach((root, rootIndex) => {
      root.querySelectorAll?.('textarea, input, [contenteditable="true"], [role="textbox"]').forEach((editable) => {
        if (seen.has(editable) || !isComposerEditableCandidate(editable, sendButton)) return;
        seen.add(editable);
        const rect = editable.getBoundingClientRect();
        const sendRect = sendButton?.getBoundingClientRect?.();
        let score = Math.max(0, 20 - rootIndex * 2);
        if (rect.width >= 180) score += 12;
        if (rect.bottom > window.innerHeight * 0.62) score += 10;
        if (sendRect) {
          const verticalDistance = Math.abs((rect.top + rect.height / 2) - (sendRect.top + sendRect.height / 2));
          score += Math.max(0, 22 - verticalDistance / 4);
          if (rect.left <= sendRect.left && rect.right <= sendRect.right + 80) score += 8;
        }
        if (editable.matches?.('textarea, [contenteditable="true"], [role="textbox"]')) score += 6;
        candidates.push({ editable, score });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    cachedComposerEditable = candidates[0]?.editable || null;
    return cachedComposerEditable;
  }

  function isComposerEmptyForSend() {
    const editable = findChatComposerEditable();
    if (!editable) return false;
    return normalizeComposerText(getEditableText(editable)).length === 0;
  }

  function shouldBlockEmptyComposerSend() {
    return emptySendGuard && isEpisodeRoute() && isComposerEmptyForSend();
  }

  function isEmptySendGuardEventTarget(target) {
    const el = target?.nodeType === 1 ? target : target?.parentElement;
    const button = el?.closest?.('button');
    if (!button) return false;
    const sendButton = findBottomSendButton();
    if (sendButton && button === sendButton) return true;
    return isChatComposerSendButton(button);
  }

  function stopEmptySendEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }

  function preserveEmptySendButtonState(sendButton) {
    if (!sendButton) return;
    if (!Object.prototype.hasOwnProperty.call(sendButton.dataset, 'lynnOriginalTitle')) {
      sendButton.dataset.lynnOriginalTitle = sendButton.hasAttribute('title')
        ? sendButton.getAttribute('title') || ''
        : EMPTY_SEND_ABSENT;
    }
    if (!Object.prototype.hasOwnProperty.call(sendButton.dataset, 'lynnOriginalAriaDisabled')) {
      sendButton.dataset.lynnOriginalAriaDisabled = sendButton.hasAttribute('aria-disabled')
        ? sendButton.getAttribute('aria-disabled') || ''
        : EMPTY_SEND_ABSENT;
    }
  }

  function restoreEmptySendButtonState(sendButton) {
    if (!sendButton) return;
    const originalTitle = sendButton.dataset.lynnOriginalTitle;
    if (originalTitle != null) {
      if (originalTitle === EMPTY_SEND_ABSENT) sendButton.removeAttribute('title');
      else sendButton.setAttribute('title', originalTitle);
      delete sendButton.dataset.lynnOriginalTitle;
    }
    const originalAriaDisabled = sendButton.dataset.lynnOriginalAriaDisabled;
    if (originalAriaDisabled != null) {
      if (originalAriaDisabled === EMPTY_SEND_ABSENT) sendButton.removeAttribute('aria-disabled');
      else sendButton.setAttribute('aria-disabled', originalAriaDisabled);
      delete sendButton.dataset.lynnOriginalAriaDisabled;
    }
  }

  function applyEmptySendGuardState() {
    const sendButton = findBottomSendButton();
    if (!sendButton) return;

    const blocked = shouldBlockEmptyComposerSend();
    sendButton.classList.toggle('lynn-empty-send-blocked', blocked);
    sendButton.dataset.lynnEmptySendGuard = emptySendGuard ? '1' : '0';
    sendButton.dataset.lynnEmptySendBlocked = blocked ? '1' : '0';

    if (blocked) {
      preserveEmptySendButtonState(sendButton);
      sendButton.title = '입력창이 비어 있어 재생을 막음';
      sendButton.setAttribute('aria-disabled', 'true');
    } else {
      restoreEmptySendButtonState(sendButton);
    }
  }

  function scheduleEmptySendGuardUiUpdate() {
    if (emptySendGuardUiRaf) return;
    emptySendGuardUiRaf = requestAnimationFrame(() => {
      emptySendGuardUiRaf = 0;
      applyEmptySendGuardState();
    });
  }

  function guardEmptyComposerSendEvent(event) {
    if (!emptySendGuard || !isEpisodeRoute()) return;
    if (!isEmptySendGuardEventTarget(event.target)) return;
    if (!shouldBlockEmptyComposerSend()) return;

    const sendButton = findBottomSendButton();
    if (sendButton) {
      preserveEmptySendButtonState(sendButton);
      sendButton.classList.add('lynn-empty-send-blocked');
      sendButton.dataset.lynnEmptySendBlocked = '1';
      sendButton.title = '입력창이 비어 있어 재생을 막음';
    }
    stopEmptySendEvent(event);
  }

  function isChatComposerTarget(target) {
    const el = target?.nodeType === 1 ? target : target?.parentElement;
    if (!el?.closest) return false;
    if (el.closest(`#${ID.panel}, #${ID.bottomModelPopup}, #${ID.root}`)) return false;
    const editable = el.closest('textarea, input, [contenteditable="true"], [role="textbox"]');
    if (!editable) return false;
    if (isDirectChatComposerEditable(editable)) return true;
    const composer = findChatComposerEditable();
    return editable === composer || !!composer?.contains?.(editable) || !!editable.contains?.(composer);
  }

  function guardEmptyComposerEnterEvent(event) {
    if (!emptySendGuard || !isEpisodeRoute()) return;
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (!isChatComposerTarget(event.target)) return;
    const editable = findChatComposerEditable();
    if (!editable) return;
    const active = document.activeElement;
    const composerFocused = active === editable || editable.contains?.(active);
    if (!composerFocused) return;
    if (normalizeComposerText(getEditableText(editable)).length !== 0) return;
    stopEmptySendEvent(event);
  }

  function createBottomModelButton() {
    const btn = document.createElement('button');
    btn.id = ID.bottomModelButton;
    btn.type = 'button';
    btn.title = '채팅 모델';
    btn.setAttribute('aria-label', '채팅 모델');
    btn.innerHTML = `
      <span class="lynn-model-icon" aria-hidden="true">✦</span>
      <span class="lynn-model-name">모델</span>
    `;
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (syncingOfficialModelInfo) return;
      const now = performance.now();
      if (now - modelPopupInteractionAt < 450) return;
      modelPopupInteractionAt = now;
      toggleBottomModelPopup(btn);
    }, true);
    return btn;
  }

  function syncBottomModelButton() {
    const btn = document.getElementById(ID.bottomModelButton);
    if (!btn) return;
    const info = getCurrentModelInfo();
    const iconWrap = btn.querySelector('.lynn-model-icon');
    const nameEl = btn.querySelector('.lynn-model-name');

    if (iconWrap) {
      const currentImg = iconWrap.querySelector('img');
      if (info.image) {
        if (currentImg?.getAttribute('src') !== info.image || iconWrap.children.length !== 1) {
          const img = document.createElement('img');
          img.src = info.image;
          img.alt = '';
          iconWrap.replaceChildren(img);
        }
      } else if (iconWrap.textContent !== '✦' || iconWrap.children.length) {
        iconWrap.textContent = '✦';
      }
    }

    if (nameEl && nameEl.textContent !== info.name) nameEl.textContent = info.name;
    const label = `채팅 모델: ${info.name}`;
    if (btn.title !== label) btn.title = label;
    if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
  }

  function isNodeBeforeInSameParent(node, target) {
    if (!node || !target || node.parentElement !== target.parentElement) return false;
    let cur = node;
    while ((cur = cur.nextElementSibling)) {
      if (cur === target) return true;
    }
    return false;
  }

  function placeBottomModelButton(btn, sendButton) {
    const parent = sendButton?.parentElement;
    if (!btn || !parent) return false;

    const pureGroup = document.getElementById('crack-pure-send-left-group');
    if (pureGroup?.isConnected && pureGroup.parentElement === parent) {
      if (btn.parentElement !== pureGroup) pureGroup.appendChild(btn);
      btn.dataset.lynnPlacement = 'cooperative-group';
      parent.dataset.lynnBottomModelGroup = '1';
      return true;
    }

    if (btn.parentElement !== parent || !isNodeBeforeInSameParent(btn, sendButton)) {
      parent.insertBefore(btn, sendButton);
    }
    btn.dataset.lynnPlacement = 'send-sibling';
    parent.dataset.lynnBottomModelGroup = '1';
    return true;
  }

  function ensureBottomModelPopup() {
    let popup = document.getElementById(ID.bottomModelPopup);
    if (popup) return popup;
    popup = document.createElement('div');
    popup.id = ID.bottomModelPopup;
    popup.dataset.open = '0';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', '채팅 모델 선택');
    popup.addEventListener('click', (event) => event.stopPropagation());
    popup.addEventListener('pointerdown', (event) => event.stopPropagation());
    document.body.appendChild(popup);
    return popup;
  }

  function positionBottomModelPopup(anchor) {
    const popup = document.getElementById(ID.bottomModelPopup);
    if (!popup || popup.dataset.open !== '1') return;
    const width = Math.min(188, window.innerWidth - 16);
    popup.style.width = `${width}px`;
    const rect = anchor?.getBoundingClientRect();
    const popupHeight = popup.offsetHeight || 292;
    let left = rect ? rect.right - width : window.innerWidth - width - 8;
    let top = rect ? rect.top - popupHeight - 10 : window.innerHeight - popupHeight - 80;
    if (top < 8 && rect) top = rect.bottom + 10;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - popupHeight - 8));
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

  function closeBottomModelPopup(options = {}) {
    const popup = document.getElementById(ID.bottomModelPopup);
    if (popup) {
      popup.dataset.open = '0';
      popup.dataset.busy = '0';
      popup.innerHTML = '';
    }
    if (options.closeOriginal === true) closeOfficialModelMenuIfOpen();
  }

  function isBottomModelPopupOpen() {
    return document.getElementById(ID.bottomModelPopup)?.dataset.open === '1';
  }

  function makeModelOption(model) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lynn-model-option';
    button.dataset.modelName = model.name;
    button.dataset.selected = model.selected ? '1' : '0';
    button.setAttribute('role', 'menuitemradio');
    button.setAttribute('aria-checked', model.selected ? 'true' : 'false');

    const icon = document.createElement('img');
    icon.alt = '';
    icon.src = model.icon || CHAT_MODEL_INFO[model.name]?.image || '';

    const name = document.createElement('span');
    name.className = 'lynn-model-option-name';
    name.textContent = model.name;

    const check = document.createElement('span');
    check.className = 'lynn-model-option-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';

    button.append(icon, name, check);
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      modelPopupInteractionAt = performance.now();
      await selectOriginalModelByName(model.name);
    });
    return button;
  }

  function renderBottomModelPopup(anchor) {
    const popup = ensureBottomModelPopup();
    popup.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'lynn-model-list';
    list.setAttribute('role', 'menu');
    getStaticModelList().forEach((model) => list.appendChild(makeModelOption(model)));
    popup.append(list);

    popup.dataset.open = '1';
    popup.dataset.busy = '0';
    positionBottomModelPopup(anchor);
  }

  function toggleBottomModelPopup(anchor) {
    if (isBottomModelPopupOpen()) {
      closeBottomModelPopup();
      return;
    }
    renderBottomModelPopup(anchor, getStaticModelList());
  }

  async function selectOriginalModelByName(name) {
    if (syncingOfficialModelInfo) return false;
    closeBottomModelPopup({ closeOriginal: false });
    modelPopupInteractionAt = performance.now();
    const ok = await selectModelInvisibly(name);
    setTimeout(() => syncBottomModelButton(), 260);
    return ok;
  }

  function ensureBottomModelButton() {
    const sendButton = findBottomSendButton();
    let btn = document.getElementById(ID.bottomModelButton);
    if (!sendButton?.parentElement) {
      btn?.remove();
      closeBottomModelPopup();
      cachedBottomSendButton = null;
      cachedOriginalModelButton = null;
      return;
    }
    if (!btn) btn = createBottomModelButton();
    placeBottomModelButton(btn, sendButton);
    syncBottomModelButton();
  }

  function isCrackComposerModelButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (button.id === ID.bottomModelButton || button.id === ID.fullscreenButton || button.id === ID.gear || button.id === 'lynn-cbe-launch') return false;
    if (button.closest(`#${ID.panel}, #${ID.root}, #${ID.bottomModelPopup}, [role="menu"], [role="listbox"], [role="dialog"]`)) return false;
    const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`;
    if (label.includes('채팅 모드')) return true;
    const text = normalizeText(button.textContent);
    const namedModel = text && CHAT_MODEL_ORDER.some((name) => text === name || text.startsWith(name));
    const icon = button.querySelector('img[src*="model-icon"], img[srcset*="model-icon"], img[alt="모델 아이콘"]');
    return !!icon && (!!namedModel || button.className.includes('size-7') || button.className.includes('justify-center'));
  }

  function findChatMenuButton(row) {
    const buttons = [...row.querySelectorAll(':scope > button')];
    return buttons.find((button) => {
      const cls = String(button.className || '');
      return cls.includes('size-8') || cls.includes('rounded-md');
    }) || buttons.at(-1) || null;
  }

  function placeCrackModelButton() {
    const row = findChatTitleActionRow();
    if (!row) return;
    const button = [...document.querySelectorAll('button')].find(isCrackComposerModelButton);
    const menu = findChatMenuButton(row);
    if (!button || !menu || button === menu) return;
    if (button.parentElement === row && button.nextElementSibling === menu) return;
    row.insertBefore(button, menu);
  }

  function isLoreLaunchButton(button) {
    if (!(button instanceof HTMLElement)) return false;
    if (button.closest(`#${ID.panel}, #${ID.root}, #${ID.bottomModelPopup}, [role="menu"], [role="listbox"], [role="dialog"]`)) return false;
    const text = normalizeText(button.textContent || '');
    if (/^lore$/i.test(text)) return true;
    const label = normalizeText(`${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`);
    return /^lore$/i.test(label);
  }

  function hideKoreanLoreButton() {
    document.querySelectorAll('button, [role="button"]').forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      if (button.closest(`#${ID.panel}, #${ID.root}, #${ID.bottomModelPopup}`)) return;
      if (normalizeText(button.textContent || '') !== '로어') return;
      button.classList.add('lynn-hide-composer-control');
    });
  }

  function findChatTitleActionRow() {
    if (!isActiveChatRoute()) return null;
    let best = null;
    let bestScore = 0;
    for (const el of document.querySelectorAll('div')) {
      const cls = String(el.className || '');
      if (!cls.includes('h-12') || !cls.includes('justify-between') || !cls.includes('items-center')) continue;
      if (el.closest(`#${ID.panel}, #${ID.root}`)) continue;
      let score = 0;
      if (cls.includes('border-b')) score += 2;
      if (cls.includes('bg-bg_screen') || cls.includes('absolute')) score += 2;
      if (score < 2) continue;
      const action = [...el.querySelectorAll(':scope > div')].reverse().find((child) => (
        String(child.className || '').includes('items-center') &&
        child.querySelector('button')
      ));
      if (!action || score <= bestScore) continue;
      best = action;
      bestScore = score;
    }
    return best;
  }

  function placeLoreOnTitleBar() {
    const row = findChatTitleActionRow();
    if (!row) return;
    const lore = [...document.querySelectorAll('button, [role="button"]')].find(isLoreLaunchButton);
    if (!(lore instanceof HTMLElement)) return;
    const model = [...row.children].find((child) => child instanceof HTMLButtonElement && isCrackComposerModelButton(child));
    const menu = findChatMenuButton(row);
    const before = model?.parentElement === row ? model : menu;
    if (lore.parentElement === row && lore.nextElementSibling === before) return;
    row.insertBefore(lore, before || row.firstChild);
  }

  function ensureBottomModelPicker() {
    hideKoreanLoreButton();
    placeCrackModelButton();
    placeLoreOnTitleBar();
    if (!modelBubbleEnabled) {
      closeBottomModelPopup({ closeOriginal: false });
      document.getElementById(ID.bottomModelButton)?.remove();
      document.getElementById(ID.bottomModelPopup)?.remove();
      cachedBottomSendButton = null;
      return;
    }
    ensureBottomModelButton();
    if (isBottomModelPopupOpen()) {
      positionBottomModelPopup(document.getElementById(ID.bottomModelButton));
    }
  }

  function getFullscreenElement() {
    return document.fullscreenElement || null;
  }

  function findComposerIconSlot() {
    const launch = document.getElementById('lynn-cbe-launch');
    if (launch instanceof HTMLElement && launch.parentElement) {
      return { toolbar: launch.parentElement, after: launch };
    }

    const shortcut = [...document.querySelectorAll('button[aria-label*="단축어"]')]
      .find((button) => button.closest('main, form'));
    const toolbar = shortcut?.parentElement;
    if (!(toolbar instanceof HTMLElement)) return null;

    const natives = [...toolbar.children].filter((element) => (
      element instanceof HTMLButtonElement &&
      element.id !== ID.fullscreenButton &&
      element.id !== 'lynn-cbe-launch' &&
      element.id !== ID.gear &&
      element.id !== ID.bottomModelButton &&
      String(element.className || '').includes('rounded-full')
    ));
    if (!natives.length) return null;

    return {
      toolbar,
      after: natives.length >= 3 ? natives[2] : natives[natives.length - 1],
    };
  }

  function getFullscreenButtonIcon(active) {
    const stateMark = active
      ? '<path d="m8.4 12.4 3.6 3.6 3.6-3.6" stroke-width="1.85" />'
      : '<path d="m8.4 15.6 3.6-3.6 3.6 3.6" stroke-width="1.85" />';
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3.25" y="3.5" width="17.5" height="17" rx="2.25" stroke-width="1.15" />
        <path d="M3.25 8.25h17.5" stroke-width="1.15" />
        ${stateMark}
      </svg>
    `;
  }

  function updateFullscreenButtonUi() {
    const button = document.getElementById(ID.fullscreenButton);
    if (!button) return;
    const active = !!getFullscreenElement();
    const nextState = active ? '1' : '0';
    const label = active ? '전체화면 종료' : '전체화면 시작';
    const span = button.querySelector('span');
    if (span && (button.dataset.active !== nextState || !span.firstElementChild)) {
      span.innerHTML = getFullscreenButtonIcon(active);
    }
    button.dataset.active = nextState;
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  let fullscreenKeyboardSheet = null;
  let fullscreenKeyboardTimer = 0;

  function clearFullscreenKeyboardLayout() {
    document.querySelectorAll('[data-lynn-fs-kb]').forEach((element) => {
      element.style.removeProperty('height');
      element.style.removeProperty('max-height');
      element.style.removeProperty('min-height');
      element.style.removeProperty('top');
      element.style.removeProperty('bottom');
      element.style.removeProperty('overflow-y');
      element.style.removeProperty('box-sizing');
      element.style.removeProperty('flex');
      element.style.removeProperty('flex-shrink');
      delete element.dataset.lynnFsKb;
    });
  }

  function keyboardInset(viewport) {
    if (!viewport) return 0;
    return Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height);
  }

  function containsChatComposer(element) {
    const composer = findChatComposerEditable();
    if (composer && element.contains(composer)) return true;
    const send = findBottomSendButton();
    return !!(send && element.contains(send));
  }

  function isKeyboardPanel(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected || element.hidden) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width >= 48 && rect.height >= 48;
  }

  function sheetFromNode(node) {
    let current = node instanceof HTMLElement ? node.parentElement : null;
    let sheet = null;
    while (current && current !== document.body && current !== document.documentElement) {
      if (containsChatComposer(current)) break;
      const style = getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      const layer = style.position === 'fixed' || style.position === 'absolute';
      if (layer && rect.width >= window.innerWidth * 0.65 && rect.height >= 140) sheet = current;
      current = current.parentElement;
    }
    return sheet;
  }

  function collectKeyboardSheets() {
    const panels = new Set();
    document.querySelectorAll(
      '[role="dialog"], [aria-modal="true"], [data-radix-dialog-content], [data-vaul-drawer], [data-vaul-drawer-content]'
    ).forEach((element) => {
      if (element instanceof HTMLElement) panels.add(element);
    });

    document.querySelectorAll('h1, h2, h3, [role="heading"]').forEach((heading) => {
      const label = heading.textContent.replace(/\s+/g, '');
      if (label !== '유저노트') return;
      const sheet = sheetFromNode(heading);
      if (sheet) panels.add(sheet);
    });

    const active = document.activeElement;
    if (active instanceof HTMLElement && !isChatComposerTarget(active)) {
      const typing = active.closest('textarea, input, [contenteditable="true"], [role="textbox"]');
      if (typing) {
        const sheet = sheetFromNode(active);
        if (sheet) {
          fullscreenKeyboardSheet = sheet;
          panels.add(sheet);
        }
      }
    }

    if (fullscreenKeyboardSheet?.isConnected && isKeyboardPanel(fullscreenKeyboardSheet)) {
      panels.add(fullscreenKeyboardSheet);
    } else {
      fullscreenKeyboardSheet = null;
    }

    return [...panels].filter((element) => isKeyboardPanel(element) && !containsChatComposer(element));
  }

  function releaseKeyboardPanel(element) {
    element.style.removeProperty('height');
    element.style.removeProperty('max-height');
    element.style.removeProperty('min-height');
    element.style.removeProperty('top');
    element.style.removeProperty('bottom');
    element.style.removeProperty('overflow-y');
    element.style.removeProperty('box-sizing');
    element.style.removeProperty('flex');
    element.style.removeProperty('flex-shrink');
    delete element.dataset.lynnFsKb;
  }

  function fitSheetAboveKeyboard(element, viewport) {
    const rect = element.getBoundingClientRect();
    const visibleBottom = viewport.height;
    const markedSheet = element.dataset.lynnFsKb === 'sheet';
    const wide = rect.width >= window.innerWidth * 0.7;
    const reachesBottom = rect.bottom > window.innerHeight * 0.82;
    const sheetLike = wide && (
      markedSheet ||
      rect.height >= window.innerHeight * 0.62 ||
      (rect.top < 40 && reachesBottom)
    );
    const covered = rect.bottom > visibleBottom - 6 || rect.top < -6;
    if (!covered && !markedSheet && element.dataset.lynnFsKb !== 'cap') return;

    if (sheetLike) {
      const top = Math.round(Math.max(0, viewport.offsetTop));
      const height = Math.max(160, Math.round(viewport.height));
      const style = getComputedStyle(element);
      element.dataset.lynnFsKb = 'sheet';
      element.style.setProperty('box-sizing', 'border-box', 'important');
      element.style.setProperty('top', `${top}px`, 'important');
      element.style.setProperty('bottom', 'auto', 'important');
      element.style.setProperty('height', `${height}px`, 'important');
      element.style.setProperty('max-height', `${height}px`, 'important');
      element.style.setProperty('min-height', '0px', 'important');
      element.style.setProperty('overflow-y', 'auto', 'important');
      if (style.display === 'flex' || style.display === 'inline-flex' || style.display === 'grid') {
        [...element.children].forEach((child) => {
          if (!(child instanceof HTMLElement)) return;
          child.dataset.lynnFsKb = 'child';
          child.style.setProperty('min-height', '0px', 'important');
        });
      }
      const field = element.querySelector('textarea, [contenteditable="true"]');
      const scroller = field?.parentElement;
      if (scroller instanceof HTMLElement && scroller !== element) {
        scroller.dataset.lynnFsKb = 'child';
        scroller.style.setProperty('min-height', '0px', 'important');
        scroller.style.setProperty('overflow-y', 'auto', 'important');
        scroller.style.setProperty('flex', '1 1 auto', 'important');
      }
      const save = [...element.querySelectorAll('button')].find((button) => {
        const label = button.textContent.replace(/\s+/g, '');
        return label === '수정' || label === '저장' || label === '완료' || label === '확인';
      });
      const footer = save?.parentElement;
      if (save instanceof HTMLElement) {
        save.dataset.lynnFsKb = 'child';
        save.style.setProperty('flex-shrink', '0', 'important');
      }
      if (footer instanceof HTMLElement && footer !== element && element.contains(footer)) {
        footer.dataset.lynnFsKb = 'child';
        footer.style.setProperty('flex-shrink', '0', 'important');
      }
      fullscreenKeyboardSheet = element;
      return;
    }

    if (rect.bottom <= visibleBottom - 6) return;
    const room = Math.max(96, Math.round(visibleBottom - Math.max(rect.top, 0) - 8));
    element.dataset.lynnFsKb = 'cap';
    element.style.setProperty('max-height', `${room}px`, 'important');
    element.style.setProperty('overflow-y', 'auto', 'important');
  }

  function syncFullscreenKeyboard() {
    const viewport = window.visualViewport;
    const covered = keyboardInset(viewport);
    if (!getFullscreenElement() || !viewport || covered < 72) {
      fullscreenKeyboardSheet = null;
      clearFullscreenKeyboardLayout();
      return;
    }

    const touched = new Set();
    collectKeyboardSheets().forEach((element) => {
      fitSheetAboveKeyboard(element, viewport);
      if (!element.dataset.lynnFsKb) return;
      touched.add(element);
      element.querySelectorAll('[data-lynn-fs-kb]').forEach((child) => touched.add(child));
    });

    document.querySelectorAll('[data-lynn-fs-kb]').forEach((element) => {
      if (touched.has(element)) return;
      releaseKeyboardPanel(element);
    });
  }

  function scheduleFullscreenKeyboard() {
    syncFullscreenKeyboard();
    clearTimeout(fullscreenKeyboardTimer);
    fullscreenKeyboardTimer = setTimeout(syncFullscreenKeyboard, 180);
  }

  function bindFullscreenKeyboard() {
    if (window.__lynnFullscreenKb) return;
    window.__lynnFullscreenKb = true;
    const run = () => scheduleFullscreenKeyboard();
    window.visualViewport?.addEventListener('resize', run);
    window.visualViewport?.addEventListener('scroll', run);
    window.addEventListener('resize', run);
    document.addEventListener('fullscreenchange', run);
    document.addEventListener('focusin', run);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch (error) {
      console.warn('[Lynn] fullscreen', error);
    } finally {
      updateFullscreenButtonUi();
    }
  }

  function removeFullscreenButton() {
    document.getElementById(ID.fullscreenButton)?.remove();
  }

  function ensureFullscreenButton() {
    if (!fullscreenEnabled || !isFullscreenRoute()) {
      removeFullscreenButton();
      return;
    }

    const slot = findComposerIconSlot();
    let button = document.getElementById(ID.fullscreenButton);
    if (!slot?.toolbar || !slot.after) {
      if (button?.isConnected && button.parentElement?.querySelector('button[aria-label*="단축어"]') == null && button.previousElementSibling?.id !== 'lynn-cbe-launch') {
        button.remove();
      }
      return;
    }

    if (!button) {
      button = document.createElement('button');
      button.id = ID.fullscreenButton;
      button.type = 'button';
      button.className = 'relative inline-flex items-center gap-1 rounded-full text-sm font-medium transition-colors border border-border bg-card text-line-gray-1 hover:bg-secondary p-0 size-7 justify-center';
      button.innerHTML = `<span aria-hidden="true">${getFullscreenButtonIcon(false)}</span>`;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFullscreen();
      });
    }

    if (slot.after.nextSibling !== button) slot.after.after(button);
    updateFullscreenButtonUi();
  }

  function renderVisibleModelChoicesHtml() {
    const visible = new Set(getVisibleChatModelNames());
    return CHAT_MODEL_ORDER.map((name) => {
      const selected = visible.has(name);
      const image = CHAT_MODEL_INFO[name]?.image || '';
      return `
        <button type="button" class="lynn-model-choice" data-lynn-visible-model="${escapeHtml(name)}" data-selected="${selected ? '1' : '0'}" aria-checked="${selected ? 'true' : 'false'}" role="checkbox">
          <span class="lynn-choice-mark" aria-hidden="true"></span>
          <img alt="" src="${escapeHtml(image)}">
          <span>${escapeHtml(name)}</span>
        </button>
      `;
    }).join('');
  }

  function updateVisibleModelChoicesUi() {
    const visible = new Set(getVisibleChatModelNames());
    document.querySelectorAll('[data-lynn-visible-model]').forEach((button) => {
      const selected = visible.has(button.dataset.lynnVisibleModel);
      button.dataset.selected = selected ? '1' : '0';
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
  }

  function refreshVisibleModelChoicesPanel() {
    const list = document.querySelector(`#${ID.panel} .lynn-model-choice-list`);
    if (!list) return;
    const signature = CHAT_MODEL_ORDER
      .map((name) => `${name}|${String(CHAT_MODEL_INFO[name]?.image || '')}`)
      .join('\n');
    if (list.dataset.signature !== signature) {
      list.innerHTML = renderVisibleModelChoicesHtml();
      list.dataset.signature = signature;
    }
    updateVisibleModelChoicesUi();
  }

  function toggleVisibleChatModel(name) {
    if (!CHAT_MODEL_ORDER.includes(name)) return;
    const visible = getVisibleChatModelNames();
    const isOn = visible.includes(name);
    if (isOn && visible.length <= 1) {
      updateVisibleModelChoicesUi();
      return;
    }

    visibleChatModelNames = isOn
      ? CHAT_MODEL_ORDER.filter((model) => model !== name && visible.includes(model))
      : CHAT_MODEL_ORDER.filter((model) => model === name || visible.includes(model));

    saveVisibleChatModelNames();
    updateVisibleModelChoicesUi();
    syncOfficialModelVisibility();
    if (isBottomModelPopupOpen()) {
      renderBottomModelPopup(document.getElementById(ID.bottomModelButton), getStaticModelList());
    }
  }

  function syncVisibleModelListOpenUi() {
    const disclosure = document.getElementById(ID.visibleModelDisclosure);
    const panel = document.getElementById(ID.visibleModelPanel);
    if (disclosure) {
      disclosure.dataset.open = visibleModelListOpen ? '1' : '0';
      disclosure.setAttribute('aria-expanded', visibleModelListOpen ? 'true' : 'false');
    }
    if (panel) {
      panel.hidden = !visibleModelListOpen;
      panel.dataset.open = visibleModelListOpen ? '1' : '0';
    }
  }

  function syncSettingsUi() {
    const fullscreenInput = document.getElementById(ID.toggleFullscreen);
    const bubbleInput = document.getElementById(ID.toggleModelBubble);
    const emptyInput = document.getElementById(ID.toggleEmptySend);
    if (fullscreenInput) fullscreenInput.checked = fullscreenEnabled;
    if (bubbleInput) bubbleInput.checked = modelBubbleEnabled;
    const recommendInput = document.getElementById(ID.toggleRecommendReply);
    if (recommendInput) recommendInput.checked = recommendReplyVisible;
    const logToolsInput = document.getElementById(ID.toggleLogTools);
    if (logToolsInput) logToolsInput.checked = logToolsEnabled;
    if (emptyInput) emptyInput.checked = emptySendGuard;
    const lineBreakInput = document.getElementById(ID.toggleLineBreak);
    if (lineBreakInput) lineBreakInput.checked = lineBreakOptimize;
    const chromeInput = document.getElementById(ID.toggleChrome);
    if (chromeInput) chromeInput.checked = chromeHover;
    const barsInput = document.getElementById(ID.toggleBars);
    if (barsInput) barsInput.checked = barsHover;
    syncVisibleModelListOpenUi();
    refreshVisibleModelChoicesPanel();
  }

  function setPanelOpen(nextOpen) {
    panelOpen = nextOpen;
    const backdrop = document.getElementById(ID.backdrop);
    const panel = document.getElementById(ID.panel);
    if (backdrop) backdrop.hidden = !panelOpen;
    if (panel) {
      panel.hidden = !panelOpen;
      panel.dataset.open = panelOpen ? '1' : '0';
    }
    if (panelOpen) {
      syncSettingsUi();
      positionSettingsPanel();
    }
  }

  function findHeader() {
    if (cachedHeader?.isConnected) return cachedHeader;
    cachedHeader = null;

    const byId = document.querySelector('#wrtn-custom-global-header');
    if (byId) {
      cachedHeader = byId;
      return byId;
    }

    const byHeight = document.querySelector('div[height="56"][width="100%"]');
    if (byHeight) {
      cachedHeader = byHeight;
      return byHeight;
    }

    const found = [...document.querySelectorAll('div')].find((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top > 90 || rect.height < 45 || rect.height > 75) return false;
      return !!el.querySelector('a[href="/"]') &&
        !!el.querySelector('input[placeholder*="검색"]') &&
        el.querySelectorAll('button').length >= 2;
    }) || null;

    cachedHeader = found;
    return found;
  }

  function placeGear(gear) {
    if (!gear) return;
    const header = findHeader();
    const phone = window.matchMedia('(max-width: 767px)').matches;

    if (header && phone) {
      const mobileArea = [...header.querySelectorAll('div')].find((el) => {
        const cls = String(el.className || '');
        return cls.includes('md:hidden') && cls.includes('justify-end') && cls.includes('items-center');
      });
      if (mobileArea) {
        const searchButton = [...mobileArea.querySelectorAll('button')].find((button) => {
          if (button.id === ID.gear) return false;
          return !!button.querySelector('svg path[fill-rule="evenodd"], svg path[clip-rule="evenodd"]');
        });
        if (searchButton) mobileArea.insertBefore(gear, searchButton);
        else mobileArea.insertBefore(gear, mobileArea.firstChild);
        gear.dataset.lynnPlacement = 'header-mobile';
        return;
      }

      if (gear.parentElement !== document.body) document.body.appendChild(gear);
      gear.dataset.lynnPlacement = 'fallback';
      return;
    }

    const input = header?.querySelector('input[placeholder*="검색"]');
    const inputWrap = input?.closest('span.relative, span[class*="relative"]') || input?.parentElement;
    const searchBox = inputWrap?.parentElement;
    if (searchBox) {
      let cluster = searchBox.closest('.lynn-search-cluster');
      if (!cluster) {
        cluster = document.createElement('div');
        cluster.className = 'lynn-search-cluster';
        searchBox.parentElement.insertBefore(cluster, searchBox);
        cluster.appendChild(searchBox);
      }
      if (gear.parentElement !== cluster) cluster.insertBefore(gear, cluster.firstChild);
      gear.dataset.lynnPlacement = 'header-desktop';
      return;
    }

    if (gear.parentElement !== document.body) document.body.appendChild(gear);
    gear.dataset.lynnPlacement = 'fallback';
  }

  function positionSettingsPanel() {
    const panel = document.getElementById(ID.panel);
    const gear = document.getElementById(ID.gear);
    if (!panel || panel.hidden) return;

    const rect = gear?.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    panel.style.width = `${width}px`;
    if (!rect || rect.width < 1 || gear?.dataset.lynnPlacement === 'fallback') {
      panel.style.top = '64px';
      panel.style.right = '8px';
      panel.style.left = 'auto';
      panel.style.bottom = 'auto';
      return;
    }

    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    panel.style.left = `${left}px`;
    panel.style.right = 'auto';
    panel.style.top = `${Math.max(8, rect.bottom + 8)}px`;
    panel.style.bottom = 'auto';
  }

  function ensureGear() {
    let gear = document.getElementById(ID.gear);
    if (!gear) {
      gear = document.createElement('button');
      gear.id = ID.gear;
      gear.type = 'button';
      gear.title = 'Lynn 설정';
      gear.setAttribute('aria-label', 'Lynn 설정');
      gear.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"></path>
        </svg>
      `;
      gear.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPanelOpen(!panelOpen);
      });
    }
    placeGear(gear);
    return gear;
  }

  function ensurePanel() {
    ensureGear();
    if (document.getElementById(ID.panel)) return;

    const root = document.createElement('div');
    root.id = ID.root;

    root.innerHTML = `
      <div id="${ID.backdrop}" hidden></div>
      <div id="${ID.panel}" role="dialog" aria-label="Lynn 설정" hidden>
        <div class="lynn-panel-head">
          <div class="lynn-panel-title">Lynn</div>
          <button type="button" class="lynn-panel-close" aria-label="닫기">×</button>
        </div>
        <div class="lynn-panel-body">
          <label class="lynn-row">
            <span class="lynn-row-name">추천 답변</span>
            <span class="lynn-switch-wrap">
              <input id="${ID.toggleRecommendReply}" type="checkbox">
              <span class="lynn-switch" aria-hidden="true"></span>
            </span>
          </label>
          <label class="lynn-row">
            <span class="lynn-row-name">로그 편집</span>
            <span class="lynn-switch-wrap">
              <input id="${ID.toggleLogTools}" type="checkbox">
              <span class="lynn-switch" aria-hidden="true"></span>
            </span>
          </label>
          <label class="lynn-row">
            <span class="lynn-row-name">전체 화면</span>
            <span class="lynn-switch-wrap">
              <input id="${ID.toggleFullscreen}" type="checkbox">
              <span class="lynn-switch" aria-hidden="true"></span>
            </span>
          </label>
          <label class="lynn-row">
            <span class="lynn-row-name">채팅 모델</span>
            <span class="lynn-switch-wrap">
              <input id="${ID.toggleModelBubble}" type="checkbox">
              <span class="lynn-switch" aria-hidden="true"></span>
            </span>
          </label>
          <label class="lynn-row">
            <span class="lynn-row-name">자동 재생 끄기</span>
            <span class="lynn-switch-wrap">
              <input id="${ID.toggleEmptySend}" type="checkbox">
              <span class="lynn-switch" aria-hidden="true"></span>
            </span>
          </label>
          <label class="lynn-row">
            <span class="lynn-row-name">상단바 숨김</span>
            <span class="lynn-switch-wrap">
              <input id="${ID.toggleBars}" type="checkbox">
              <span class="lynn-switch" aria-hidden="true"></span>
            </span>
          </label>
          <label class="lynn-row">
            <span class="lynn-row-name">사이드바 접기</span>
            <span class="lynn-switch-wrap">
              <input id="${ID.toggleChrome}" type="checkbox">
              <span class="lynn-switch" aria-hidden="true"></span>
            </span>
          </label>
          <label class="lynn-row">
            <span class="lynn-row-name">줄바꿈</span>
            <span class="lynn-switch-wrap">
              <input id="${ID.toggleLineBreak}" type="checkbox">
              <span class="lynn-switch" aria-hidden="true"></span>
            </span>
          </label>
          <button type="button" id="lynn-open-backup" class="lynn-row lynn-logtools-open">
            <span class="lynn-row-name"><span class="lynn-backup-heart" aria-hidden="true">♥</span> 채팅 백업 <span class="lynn-backup-heart" aria-hidden="true">♥</span></span>
          </button>
          <button type="button" id="${ID.visibleModelDisclosure}" class="lynn-disclosure" aria-expanded="false" aria-controls="${ID.visibleModelPanel}">
            <span class="lynn-row-name">표시 모델</span>
            <span class="lynn-chevron" aria-hidden="true">▾</span>
          </button>
          <div id="${ID.visibleModelPanel}" class="lynn-model-choice-panel" hidden>
            <div class="lynn-model-choice-list"></div>
          </div>
        </div>
      </div>
    `;

    root.querySelector(`#${ID.backdrop}`).addEventListener('click', () => setPanelOpen(false));
    root.querySelector('.lynn-panel-close').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setPanelOpen(false);
    });
    root.querySelector(`#${ID.panel}`).addEventListener('click', (event) => {
      const choice = event.target.closest?.('[data-lynn-visible-model]');
      if (!choice) return;
      event.preventDefault();
      toggleVisibleChatModel(choice.dataset.lynnVisibleModel);
    });
    root.querySelector(`#${ID.visibleModelDisclosure}`).addEventListener('click', (event) => {
      event.preventDefault();
      visibleModelListOpen = !visibleModelListOpen;
      saveVisibleModelListOpen();
      syncVisibleModelListOpenUi();
    });
    root.querySelector(`#${ID.toggleFullscreen}`).addEventListener('change', (event) => {
      fullscreenEnabled = event.target.checked;
      writeStorage(LS.fullscreen, fullscreenEnabled ? '1' : '0');
      ensureFullscreenButton();
    });
    root.querySelector(`#${ID.toggleModelBubble}`).addEventListener('change', (event) => {
      modelBubbleEnabled = event.target.checked;
      writeStorage(LS.modelBubble, modelBubbleEnabled ? '1' : '0');
      ensureBottomModelPicker();
    });
    root.querySelector(`#${ID.toggleRecommendReply}`).addEventListener('change', (event) => {
      recommendReplyVisible = event.target.checked;
      writeStorage(LS.recommendReply, recommendReplyVisible ? '1' : '0');
      syncComposerControls();
    });
    root.querySelector(`#${ID.toggleLogTools}`).addEventListener('change', (event) => {
      logToolsEnabled = event.target.checked;
      writeStorage(LS.logTools, logToolsEnabled ? '1' : '0');
      window.LynnLogTools?.syncButton();
    });
    root.querySelector(`#${ID.toggleEmptySend}`).addEventListener('change', (event) => {
      emptySendGuard = event.target.checked;
      writeStorage(LS.emptySend, emptySendGuard ? '1' : '0');
      applyEmptySendGuardState();
    });
    root.querySelector(`#${ID.toggleLineBreak}`).addEventListener('change', (event) => {
      lineBreakOptimize = event.target.checked;
      writeStorage(LS.lineBreak, lineBreakOptimize ? '1' : '0');
      applyLineBreakOptimize();
    });
    root.querySelector(`#${ID.toggleChrome}`).addEventListener('change', (event) => {
      chromeHover = event.target.checked;
      writeStorage(LS.chromeHover, chromeHover ? '1' : '0');
      sidebarCollapsedHref = '';
      sidebarCollapseHref = '';
      sidebarCollapseTries = 0;
      applyChromeHover();
    });
    root.querySelector(`#${ID.toggleBars}`).addEventListener('change', (event) => {
      barsHover = event.target.checked;
      writeStorage(LS.barsHover, barsHover ? '1' : '0');
      syncQuietBars();
    });
    root.querySelector('#lynn-open-backup')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setPanelOpen(false);
      window.LynnBackup?.open();
    });

    document.body.appendChild(root);
    syncSettingsUi();
  }

  function addStyle() {
    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&display=swap');
      .lynn-search-cluster {
        display: flex !important;
        align-items: center !important;
        gap: 7px !important;
        min-width: 0 !important;
      }
      #${ID.gear} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 24px !important;
        height: 24px !important;
        min-width: 24px !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        color: #f7c6dc !important;
        cursor: pointer !important;
        flex: 0 0 auto !important;
      }
      #${ID.gear}:hover { opacity: .72 !important; }
      #${ID.gear}[data-lynn-placement="fallback"] {
        position: fixed;
        top: 14px;
        right: 16px;
        z-index: 2147482800;
        width: 28px !important;
        height: 28px !important;
      }
      @media (max-width: 767px) {
        #${ID.gear} {
          width: 26px !important;
          height: 26px !important;
          min-width: 26px !important;
        }
      }
      #${ID.backdrop} {
        position: fixed;
        inset: 0;
        z-index: 2147482900;
        background: rgba(0, 0, 0, .28);
      }
      #${ID.panel} {
        position: fixed;
        top: 64px;
        right: 8px;
        z-index: 2147483000;
        width: min(360px, calc(100vw - 28px));
        max-height: min(560px, calc(100dvh - 80px));
        overflow: auto;
        box-sizing: border-box;
        padding: 12px;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, .12);
        background: rgba(28, 28, 30, .94);
        color: rgba(255, 255, 255, .94);
        box-shadow: 0 18px 46px rgba(0, 0, 0, .32);
        font-family: inherit;
      }
      .lynn-panel-head, .lynn-row, .lynn-disclosure {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .lynn-panel-head { margin-bottom: 8px; }
      .lynn-panel-title {
        font-family: 'Cherry Bomb One', cursive;
        font-size: 24px;
        font-weight: 400;
        line-height: 1.15;
        letter-spacing: .01em;
        color: #f7c6dc;
      }
      .lynn-panel-close {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: inherit;
        font-size: 20px;
        cursor: pointer;
      }
      button.lynn-logtools-open {
        width: 100%;
        justify-content: center;
        border: 1px solid rgba(243, 180, 207, .7);
        background: rgba(243, 180, 207, .16);
        color: inherit;
        text-align: center;
        cursor: pointer;
        font: inherit;
      }
      button.lynn-logtools-open .lynn-row-name { text-align: center; }
      .lynn-row, .lynn-disclosure {
        width: 100%;
        box-sizing: border-box;
        margin-top: 6px;
        padding: 10px 8px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        color: inherit;
        text-align: left;
        font: inherit;
      }
      .lynn-disclosure { cursor: pointer; }
      .lynn-row-name { display: block; font-size: 14px; font-weight: 400; }
      .lynn-row-name::before {
        content: "♥";
        margin-right: 6px;
        color: #f3b4cf;
        font-weight: 500;
      }
      button.lynn-logtools-open .lynn-row-name::before { content: none; }
      .lynn-backup-heart { color: #f3b4cf; font-weight: 500; }
      .lynn-switch-wrap { position: relative; width: 35px; height: 20px; flex: 0 0 auto; }
      .lynn-switch-wrap input {
        position: absolute;
        opacity: 0;
        inset: 0;
        margin: 0;
        cursor: pointer;
      }
      .lynn-switch {
        display: block;
        width: 35px;
        height: 20px;
        border-radius: 999px;
        background: rgba(120, 120, 128, .45);
        pointer-events: none;
      }
      .lynn-switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: #fff;
        transition: transform 160ms ease;
      }
      .lynn-switch-wrap input:checked + .lynn-switch { background: #f3b4cf; }
      .lynn-switch-wrap input:checked + .lynn-switch::after { transform: translateX(15px); }
      .lynn-switch-wrap input:disabled { cursor: not-allowed; }
      .lynn-chevron { transition: transform 160ms ease; }
      .lynn-disclosure[data-open="1"] .lynn-chevron { transform: rotate(180deg); }
      .lynn-model-choice-panel { padding: 0 4px 8px; }
      .lynn-model-choice-list { display: grid; gap: 4px; }
      .lynn-model-choice {
        display: grid;
        grid-template-columns: 16px 18px minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 32px;
        padding: 4px 6px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        font: inherit;
      }
      .lynn-model-choice img { width: 16px; height: 16px; border-radius: 4px; object-fit: cover; }
      .lynn-choice-mark {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, .35);
        box-sizing: border-box;
      }
      .lynn-model-choice[data-selected="1"] .lynn-choice-mark {
        border-color: #f3b4cf;
        background: #f3b4cf;
        box-shadow: inset 0 0 0 2px rgba(28, 28, 30, .92);
      }
      #${ID.fullscreenButton} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        padding: 0 !important;
        border-radius: 999px !important;
        cursor: pointer !important;
        flex: 0 0 auto !important;
      }
      #${ID.fullscreenButton} > span {
        position: absolute !important;
        inset: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        pointer-events: none !important;
      }
      #${ID.fullscreenButton} svg {
        display: block !important;
        width: 19px !important;
        height: 20px !important;
        color: #f7c6dc !important;
        pointer-events: none !important;
      }
      .lynn-hide-composer-control { display: none !important; }
      .lynn-pink-composer-icon,
      .lynn-pink-composer-icon svg,
      .lynn-pink-composer-icon span {
        color: #f7c6dc !important;
      }
      .lynn-suggest-chip {
        border: 1px solid rgba(243, 180, 207, .55) !important;
        background: rgba(243, 180, 207, .16) !important;
        color: rgba(255, 255, 255, .94) !important;
        box-shadow: 0 0 16px rgba(243, 180, 207, .18) !important;
      }
      .lynn-suggest-edit,
      .lynn-suggest-edit svg {
        color: #f7c6dc !important;
      }
      :is(body, html)[data-theme="light"] .lynn-suggest-chip {
        border-color: rgba(229, 154, 184, .85) !important;
        background: rgba(243, 180, 207, .28) !important;
        color: #3a2430 !important;
      }
      :is(body, html)[data-theme="light"] :is(.lynn-suggest-edit, .lynn-suggest-edit svg) {
        color: #d56b98 !important;
      }
      :is(body, html)[data-theme="light"] :is(#${ID.gear}, #${ID.fullscreenButton}, #${ID.fullscreenButton} svg, .lynn-pink-composer-icon, .lynn-pink-composer-icon svg, .lynn-pink-composer-icon span) {
        color: #d56b98 !important;
      }
      #${ID.bottomModelButton} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        max-width: 28px !important;
        box-sizing: border-box !important;
        padding: 0 !important;
        margin: 0 8px 0 0 !important;
        border-radius: 999px !important;
        border: 1px solid var(--border, rgba(120, 120, 128, .28)) !important;
        background: var(--card, rgba(255, 255, 255, .78)) !important;
        color: var(--foreground, #111) !important;
        cursor: pointer !important;
        overflow: hidden !important;
        flex: 0 0 auto !important;
      }
      #${ID.bottomModelButton}[data-lynn-placement="cooperative-group"] { margin: 0 !important; }
      [data-lynn-bottom-model-group="1"] { justify-content: flex-start !important; gap: 0 !important; }
      [data-lynn-bottom-model-group="1"] > :first-child:not(#${ID.bottomModelButton}) { margin-right: auto !important; }
      #${ID.bottomModelButton}:hover { background: var(--secondary, rgba(120, 120, 128, .16)) !important; }
      .lynn-model-icon {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 16px !important;
        height: 16px !important;
      }
      #${ID.bottomModelButton} img, .lynn-model-option img {
        width: 14px !important;
        height: 14px !important;
        border-radius: 4px !important;
        object-fit: cover !important;
      }
      .lynn-model-name { display: none !important; }
      .lynn-empty-send-blocked {
        opacity: .5 !important;
        cursor: not-allowed !important;
        filter: grayscale(.22) !important;
      }
      .lynn-empty-send-blocked svg { pointer-events: none !important; }
      html.lynn-conceal-model-menu :is([data-radix-popper-content-wrapper], [role="menu"], [role="listbox"]):has(img[src*="model-icon"]) {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      #${ID.bottomModelPopup} {
        position: fixed;
        z-index: 2147483100;
        display: none;
        width: 188px;
        max-height: min(360px, calc(100dvh - 88px));
        overflow: auto;
        box-sizing: border-box;
        padding: 4px;
        border: 1px solid rgba(243, 180, 207, .45);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(243, 180, 207, .12), rgba(28, 28, 30, .96) 52%);
        color: rgba(255, 255, 255, .94);
        box-shadow: 0 14px 38px rgba(0, 0, 0, .44), 0 0 18px rgba(243, 180, 207, .08);
        backdrop-filter: blur(12px);
      }
      #${ID.bottomModelPopup}[data-open="1"] { display: block; }
      .lynn-model-list { display: flex; flex-direction: column; gap: 3px; }
      .lynn-model-option {
        display: grid;
        grid-template-columns: 15px minmax(0, 1fr) 12px;
        align-items: center;
        gap: 4px;
        width: 100%;
        min-height: 30px;
        padding: 5px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: rgba(255, 255, 255, .88);
        text-align: left;
        cursor: pointer;
        font: inherit;
      }
      .lynn-model-option:hover { background: rgba(243, 180, 207, .2); color: #ffe4ef; }
      .lynn-model-option[data-selected="1"],
      .lynn-model-option[data-selected="1"]:hover {
        background: linear-gradient(135deg, #f3b4cf, #f7c6dc);
        color: #3a2430;
      }
      .lynn-model-option-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
        font-weight: 800;
      }
      .lynn-model-option-check { color: #3a2430; font-size: 12px; font-weight: 900; opacity: 0; }
      .lynn-model-option[data-selected="1"] .lynn-model-option-check { opacity: 1; }
      .lynn-rs-host { position: relative !important; overflow: visible !important; }
      #lynn-rs {
        position: absolute; top: 6px; left: 8px; right: 8px; z-index: 3;
        display: flex; align-items: center; gap: 6px; max-width: calc(100% - 16px);
        min-width: 0; overflow: hidden;
        pointer-events: none; user-select: none;
        font: 11px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        color: rgba(255, 255, 255, .85);
      }
      #lynn-rs .lynn-rs-track {
        flex: 1 1 0%; width: 0; min-width: 0;
        overflow-x: scroll; overflow-y: hidden; scrollbar-width: none;
        pointer-events: auto; touch-action: pan-x; overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch; cursor: grab;
      }
      #lynn-rs .lynn-rs-track.is-grabbing { cursor: grabbing; }
      #lynn-rs .lynn-rs-track::-webkit-scrollbar { width: 0; height: 0; display: none; }
      #lynn-rs .lynn-rs-row {
        display: flex; align-items: center; gap: 8px;
        width: max-content; min-width: 100%;
      }
      #lynn-rs, #lynn-rs-menu {
        --lynn-heart: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12%2021.35l-1.45-1.32C5.4%2015.36%202%2012.28%202%208.5%202%205.42%204.42%203%207.5%203c1.74%200%203.41.81%204.5%202.09C13.09%203.81%2014.76%203%2016.5%203%2019.58%203%2022%205.42%2022%208.5c0%203.78-3.4%206.86-8.55%2011.54L12%2021.35z'/%3E%3C/svg%3E");
      }
      #lynn-rs .lynn-rs-item { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; white-space: nowrap; }
      #lynn-rs .lynn-rs-item i, #lynn-rs-menu .lynn-rs-heart {
        display: inline-block; width: 10px; height: 9px; flex: 0 0 auto;
        background: currentColor;
        -webkit-mask: var(--lynn-heart) center / contain no-repeat;
        mask: var(--lynn-heart) center / contain no-repeat;
      }
      #lynn-rs-menu .lynn-rs-heart { vertical-align: -1px; }
      #lynn-rs .lynn-rs-item b { font-weight: 700; }
      #lynn-rs .lynn-rs-item em { font-style: normal; font-weight: 900; }
      #lynn-rs .lynn-rs-item span { opacity: .72; }
      #lynn-rs .s-active em, #lynn-rs .s-active i { color: #3ddc84; }
      #lynn-rs .s-degraded em, #lynn-rs .s-degraded i { color: #ffd54a; }
      #lynn-rs .s-impacted em, #lynn-rs .s-impacted i { color: #ff5c5c; }
      #lynn-rs .s-unknown em, #lynn-rs .s-unknown i { color: rgba(255, 255, 255, .45); }
      #lynn-rs .lynn-rs-refresh,
      #lynn-rs .lynn-rs-settings {
        pointer-events: auto; width: 18px; height: 18px; padding: 0;
        border: 0; border-radius: 8px; background: transparent;
        color: inherit; opacity: .65; cursor: pointer; flex: 0 0 auto;
      }
      #lynn-rs .lynn-rs-refresh:hover,
      #lynn-rs .lynn-rs-settings:hover,
      #lynn-rs .lynn-rs-settings[aria-expanded="true"] { opacity: 1; background: rgba(255, 255, 255, .08); }
      #lynn-rs-menu {
        position: fixed; z-index: 2147483000; box-sizing: border-box;
        width: min(240px, calc(100vw - 16px));
        overflow: hidden; padding: 0; border-radius: 12px;
        border: 1px solid rgba(243, 180, 207, .45);
        background: linear-gradient(145deg, rgba(243, 180, 207, .12), rgba(28, 28, 30, .96) 52%);
        color: rgba(255, 255, 255, .94);
        box-shadow: 0 14px 38px rgba(0, 0, 0, .44), 0 0 18px rgba(243, 180, 207, .08);
        backdrop-filter: blur(12px);
        font: 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      #lynn-rs-menu .lynn-rs-menu-scroll {
        max-height: min(360px, 60vh); overflow: auto; overscroll-behavior: contain;
        padding: 8px; touch-action: pan-y;
      }
      #lynn-rs-menu strong { display: block; margin: 2px 4px 8px; font-size: 12px; color: #f7c6dc; }
      #lynn-rs-menu .lynn-rs-title-heart { margin-right: .35em; color: #fff; font-weight: 500; }
      #lynn-rs-menu .lynn-rs-latency {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        width: 100%; box-sizing: border-box; margin: 0 0 6px; padding: 8px;
        border: 1px solid rgba(243, 180, 207, .7); border-radius: 12px;
        background: rgba(243, 180, 207, .16); color: inherit;
        font: inherit; font-size: 13px; text-align: center; cursor: pointer;
      }
      #lynn-rs-menu .lynn-rs-latency-heart { color: #f3b4cf; font-weight: 500; }
      #lynn-rs-menu .lynn-rs-latency[aria-pressed="false"] {
        border-color: rgba(255, 255, 255, .14); background: transparent; opacity: .55;
      }
      #lynn-rs-menu .lynn-rs-latency:hover { background: rgba(243, 180, 207, .28); }
      #lynn-rs-menu label {
        display: flex; align-items: center; gap: 8px;
        min-height: 28px; padding: 2px 4px; border-radius: 8px; cursor: pointer;
      }
      #lynn-rs-menu label:hover { background: rgba(243, 180, 207, .2); color: #ffe4ef; }
      #lynn-rs-menu label span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #lynn-rs-menu input { margin: 0; accent-color: #f3b4cf; }
      :is(body, html)[data-theme="light"] #lynn-rs-menu {
        border-color: rgba(243, 180, 207, .55);
        background: linear-gradient(145deg, rgba(243, 180, 207, .18), rgba(255, 255, 255, .98) 52%);
        color: rgba(17, 24, 39, .94);
      }
      :is(body, html)[data-theme="light"] #lynn-rs-menu strong { color: #e59ab8; }
      :is(body, html)[data-theme="light"] #lynn-rs-menu .lynn-rs-title-heart { color: #fff; }
      :is(body, html)[data-theme="light"] #lynn-rs-menu .lynn-rs-latency {
        border-color: rgba(229, 154, 184, .85);
        background: rgba(243, 180, 207, .2);
      }
      :is(body, html)[data-theme="light"] #lynn-rs-menu .lynn-rs-latency-heart { color: #e59ab8; }
      :is(body, html)[data-theme="light"] #lynn-rs-menu .lynn-rs-latency[aria-pressed="false"] {
        border-color: rgba(17, 24, 39, .12); background: transparent;
      }
      :is(body, html)[data-theme="light"] #lynn-rs-menu label:hover {
        background: rgba(243, 180, 207, .28);
        color: #8a4564;
      }
      :is(body, html)[data-theme="light"] #lynn-rs { color: rgba(0, 0, 0, .85); }
      :is(body, html)[data-theme="light"] #lynn-rs .s-unknown :is(em, i) { color: rgba(0, 0, 0, .4); }
      :is(body, html)[data-theme="light"] #lynn-rs .s-active :is(em, i) { color: #1da851; }
      :is(body, html)[data-theme="light"] #lynn-rs .s-degraded :is(em, i) { color: #d49500; }
      :is(body, html)[data-theme="light"] #lynn-rs .s-impacted :is(em, i) { color: #e03535; }
      [role="menuitem"][data-lynn-official-model-hidden="1"],
      [role="option"][data-lynn-official-model-hidden="1"],
      button[data-lynn-official-model-hidden="1"] { display: none !important; }
      html.lynn-line-break div.break-all,
      html.lynn-line-break .wrtn-markdown,
      html.lynn-line-break .wrtn-markdown *,
      html.lynn-line-break [class*="wrtn-markdown"],
      html.lynn-line-break [class*="wrtn-markdown"] * {
        word-break: keep-all !important;
        overflow-wrap: break-word !important;
      }
      :is(body, html)[data-theme="light"] :is(#${ID.panel}, #${ID.bottomModelPopup}) {
        border-color: rgba(17, 24, 39, .1);
        background: rgba(255, 255, 255, .94);
        color: rgba(17, 24, 39, .94);
      }
      :is(body, html)[data-theme="light"] #${ID.bottomModelPopup} {
        border-color: rgba(243, 180, 207, .55);
        background: linear-gradient(145deg, rgba(243, 180, 207, .18), rgba(255, 255, 255, .98) 52%);
        color: rgba(17, 24, 39, .94);
      }
      :is(body, html)[data-theme="light"] .lynn-model-option { color: #1a1a1a; }
      :is(body, html)[data-theme="light"] .lynn-model-option:hover {
        background: rgba(243, 180, 207, .28);
        color: #8a4564;
      }
      :is(body, html)[data-theme="light"] .lynn-model-option[data-selected="1"],
      :is(body, html)[data-theme="light"] .lynn-model-option[data-selected="1"]:hover {
        background: linear-gradient(135deg, #f3b4cf, #f7c6dc);
        color: #3a2430;
      }
      :is(body, html)[data-theme="light"] .lynn-backup-heart,
      :is(body, html)[data-theme="light"] .lynn-row-name::before { color: #e59ab8; }
      :is(body, html)[data-theme="light"] button.lynn-logtools-open {
        border-color: rgba(229, 154, 184, .85);
        background: rgba(243, 180, 207, .2);
      }
      :is(body, html)[data-theme="light"] .lynn-model-choice[data-selected="1"] .lynn-choice-mark {
        box-shadow: inset 0 0 0 2px #fff;
      }
      html:not(.lynn-bars-hide) #${ID.chromeTop} { display: none !important; }
      html.lynn-bars-hide #${ID.chromeTop} {
        position: fixed; top: 0; left: 0; right: 0; height: 12px;
        z-index: 2147482500; background: transparent;
      }
      html.lynn-bars-hide.lynn-bars-touch #${ID.chromeTop} {
        height: 0;
        pointer-events: none;
      }
      html.lynn-bars-hide [data-lynn-bar="header"],
      html.lynn-bars-hide #wrtn-custom-global-header {
        position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
        width: 100% !important; z-index: 2147482600 !important;
        transform: translateY(-110%) !important;
        transition: transform 180ms ease !important;
      }
      html.lynn-bars-hide.lynn-bars-open [data-lynn-bar="header"],
      html.lynn-bars-hide.lynn-bars-open #wrtn-custom-global-header {
        transform: translateY(0) !important;
        box-shadow: 0 12px 28px rgba(0, 0, 0, .22) !important;
      }
      html.lynn-bars-hide [data-lynn-bar="room"] {
        z-index: 2147482550 !important;
        transform: translateY(-120%) !important;
        transition: transform 180ms ease !important;
      }
      html.lynn-bars-hide.lynn-bars-open [data-lynn-bar="room"] {
        transform: translateY(var(--lynn-room-shift, 0px)) !important;
      }
      html.lynn-bars-hide body [class*="pt-[56px]"],
      html.lynn-bars-hide body [class*="pt-[120px]"] {
        padding-top: 0 !important;
      }
    `;
    const style = document.createElement('style');
    style.id = 'lynn-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  const RADIOSONDE_MODELS = [
    { slug: 'claude-fable-5', label: 'Fable 5', short: 'F5' },
    { slug: 'claude-opus-5.5', label: 'Claude Opus 5.5', short: 'O5.5' },
    { slug: 'claude-opus-5', label: 'Claude Opus 5', short: 'O5' },
    { slug: 'claude-opus-4.8', label: 'Claude Opus 4.8', short: 'O4.8' },
    { slug: 'claude-opus-4.7', label: 'Claude Opus 4.7', short: 'O4.7' },
    { slug: 'claude-opus-4.6', label: 'Claude Opus 4.6', short: 'O4.6' },
    { slug: 'gemini-4-argon', label: 'Gemini 4 Argon', short: 'G4A' },
    { slug: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', short: 'G3.1P' },
    { slug: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', short: 'G2.5P' },
    { slug: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', short: 'G3.7F' },
    { slug: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', short: 'G3.8F' },
  ];
  const RADIOSONDE_API_BASES = [
    'https://igx-radiosonde-api-striker.b-cdn.net/v2/',
    'https://rs.igx.kr/api/v2/',
  ];
  let radiosondeBusy = false;
  let radiosondeStarted = false;
  let radiosondeLiveFetchStarted = false;
  let radiosondeRefreshQueued = false;
  let radiosondeQuickRetries = 0;
  let radiosondeRetryTimer = 0;
  const radiosondeStatus = new Map();
  let radiosondeVisibility = {};
  let radiosondeShowLatency = true;
  try { radiosondeShowLatency = localStorage.getItem('lynn_rs_latency') !== '0'; } catch { }
  try {
    const storedVisibility = JSON.parse(localStorage.getItem('lynn_rs_models') || '{}');
    if (storedVisibility && typeof storedVisibility === 'object') radiosondeVisibility = storedVisibility;
  } catch { }
  try {
    const cachedStatus = JSON.parse(sessionStorage.getItem('lynn_rs_cache') || 'null');
    if (cachedStatus && typeof cachedStatus === 'object') {
      RADIOSONDE_MODELS.forEach((model) => {
        const row = cachedStatus[model.slug];
        if (!row || typeof row !== 'object') return;
        if (!['active', 'degraded', 'impacted', 'unknown'].includes(row.tone)) return;
        radiosondeStatus.set(model.slug, {
          tone: row.tone,
          score: String(row.score ?? '—'),
          latency: String(row.latency ?? '—'),
        });
      });
    }
  } catch { }

  function isRadiosondeShown(slug) {
    return radiosondeVisibility[slug] !== false;
  }

  function saveRadiosondeVisibility() {
    try { localStorage.setItem('lynn_rs_models', JSON.stringify(radiosondeVisibility)); } catch { }
  }

  function saveRadiosondeLatency() {
    try { localStorage.setItem('lynn_rs_latency', radiosondeShowLatency ? '1' : '0'); } catch { }
  }

  function findRadiosondeHost() {
    if (!isFullscreenRoute()) return null;
    const nodes = document.querySelectorAll(
      '.__chat_input_textarea[contenteditable="true"], [contenteditable="true"][data-placeholder="메시지 보내기"], textarea[placeholder="메시지 보내기"], .tiptap.ProseMirror, [contenteditable="true"].ProseMirror'
    );
    let composer = null;
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const rect = nodes[index].getBoundingClientRect();
      if (rect.width >= 120 && rect.height >= 18 && rect.bottom > 0 && rect.top < window.innerHeight) {
        composer = nodes[index];
        break;
      }
    }
    if (!composer) return null;
    return composer.closest('div[class*="py-4"][class*="gap-4"][class*="max-w-[768px]"]') ||
      composer.closest('div[class*="py-4"][class*="gap-4"][class*="w-[calc(100%-40px)]"]');
  }

  function radiosondeTone(status) {
    const value = String(status || '').toLowerCase();
    if (value === 'operational' || value === 'active') return 'active';
    if (value === 'unstable' || value === 'degraded') return 'degraded';
    if (value === 'critical' || value === 'inactive' || value === 'impacted') return 'impacted';
    return 'unknown';
  }

  async function radiosondeFetchSimple(apiId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      return await Promise.any(RADIOSONDE_API_BASES.map(async (base) => {
        const response = await fetch(`${base}simple/${encodeURIComponent(apiId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      }));
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  function radiosondeRowFromPayload(payload) {
    const data = payload?.data;
    if (!payload?.success || !data || typeof data !== 'object') return null;
    const latency = Number(data.latency);
    const score = Number(data.score);
    return {
      tone: radiosondeTone(data.status),
      score: Number.isFinite(score) ? String(Math.round(score)) : '—',
      latency: Number.isFinite(latency) && latency >= 0 ? `${(latency / 1000).toFixed(2)}s` : '—',
    };
  }

  function radiosondeTrackRow(track) {
    let row = track.querySelector('.lynn-rs-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'lynn-rs-row';
      track.replaceChildren(row);
    }
    return row;
  }

  function renderRadiosondeBar() {
    const track = document.querySelector('#lynn-rs .lynn-rs-track');
    if (!track) return;
    const scrollLeft = track.scrollLeft;
    const row = radiosondeTrackRow(track);
    const shown = RADIOSONDE_MODELS.filter((model) => isRadiosondeShown(model.slug));
    if (!shown.length) {
      row.textContent = '선택된 모델 없음';
      return;
    }
    row.replaceChildren(...shown.map((model) => {
      const status = radiosondeStatus.get(model.slug) || { tone: 'unknown', score: '—', latency: '—' };
      const item = document.createElement('span');
      item.className = `lynn-rs-item s-${status.tone}`;
      item.title = model.label;
      item.innerHTML = radiosondeShowLatency ? '<i></i><b></b><em></em><span></span>' : '<i></i><b></b><em></em>';
      item.querySelector('b').textContent = model.short;
      item.querySelector('em').textContent = status.score;
      if (radiosondeShowLatency) item.querySelector('span').textContent = status.latency;
      return item;
    }));
    track.scrollLeft = scrollLeft;
  }

  function rememberRadiosondeStatus() {
    try {
      const payload = {};
      radiosondeStatus.forEach((row, slug) => { payload[slug] = row; });
      sessionStorage.setItem('lynn_rs_cache', JSON.stringify(payload));
    } catch { }
  }

  function radiosondeHasLiveData() {
    return RADIOSONDE_MODELS.some((model) => {
      if (!isRadiosondeShown(model.slug)) return false;
      const row = radiosondeStatus.get(model.slug);
      return !!row && row.score !== '—';
    });
  }

  async function loadRadiosondeModel(model) {
    try {
      const row = radiosondeRowFromPayload(await radiosondeFetchSimple(model.slug));
      if (row) {
        radiosondeStatus.set(model.slug, row);
        rememberRadiosondeStatus();
      }
    } catch {
    }
    renderRadiosondeBar();
  }

  function kickRadiosondeAfterLoad() {
    if (!isFullscreenRoute() || radiosondeHasLiveData()) return;
    radiosondeQuickRetries = 0;
    if (radiosondeBusy) {
      radiosondeRefreshQueued = true;
      return;
    }
    refreshRadiosonde();
  }

  async function refreshRadiosonde() {
    if (!isFullscreenRoute()) return;
    if (radiosondeBusy) {
      radiosondeRefreshQueued = true;
      return;
    }
    if (!document.getElementById('lynn-rs')) return;
    const models = RADIOSONDE_MODELS.filter((model) => isRadiosondeShown(model.slug));
    if (!models.length) return;
    radiosondeLiveFetchStarted = true;
    radiosondeBusy = true;
    const button = document.querySelector('#lynn-rs .lynn-rs-refresh');
    if (button) button.disabled = true;
    try {
      await Promise.all(models.map((model) => loadRadiosondeModel(model)));
    } finally {
      radiosondeBusy = false;
      if (button) button.disabled = false;
    }
    if (radiosondeRefreshQueued) {
      radiosondeRefreshQueued = false;
      if (!radiosondeHasLiveData()) {
        refreshRadiosonde();
        return;
      }
    }
    if (radiosondeHasLiveData()) {
      radiosondeQuickRetries = 0;
    } else if (isFullscreenRoute() && radiosondeQuickRetries < 2) {
      radiosondeQuickRetries += 1;
      clearTimeout(radiosondeRetryTimer);
      radiosondeRetryTimer = setTimeout(() => {
        radiosondeRetryTimer = 0;
        refreshRadiosonde();
      }, 2000);
    }
  }

  function closeRadiosondeMenu() {
    const menu = document.getElementById('lynn-rs-menu');
    const button = document.querySelector('#lynn-rs .lynn-rs-settings');
    if (menu) menu.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function positionRadiosondeMenu() {
    const menu = document.getElementById('lynn-rs-menu');
    const button = document.querySelector('#lynn-rs .lynn-rs-settings');
    if (!menu || menu.hidden || !button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 16);
    menu.style.width = `${width}px`;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    menu.style.left = `${left}px`;
    menu.style.right = 'auto';
    menu.style.top = 'auto';
    menu.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 6)}px`;
  }

  function ensureRadiosondeMenu() {
    let menu = document.getElementById('lynn-rs-menu');
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'lynn-rs-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', '라디오존데 표시 설정');
    const scroll = document.createElement('div');
    scroll.className = 'lynn-rs-menu-scroll';
    const title = document.createElement('strong');
    title.innerHTML = '<span class="lynn-rs-title-heart lynn-rs-heart" aria-hidden="true"></span>표시할 모델';
    scroll.appendChild(title);
    const latencyButton = document.createElement('button');
    latencyButton.type = 'button';
    latencyButton.className = 'lynn-rs-latency';
    latencyButton.setAttribute('aria-pressed', radiosondeShowLatency ? 'true' : 'false');
    latencyButton.innerHTML = '<span class="lynn-rs-latency-heart lynn-rs-heart" aria-hidden="true"></span>응답 시간<span class="lynn-rs-latency-heart lynn-rs-heart" aria-hidden="true"></span>';
    latencyButton.addEventListener('click', () => {
      radiosondeShowLatency = !radiosondeShowLatency;
      latencyButton.setAttribute('aria-pressed', radiosondeShowLatency ? 'true' : 'false');
      saveRadiosondeLatency();
      renderRadiosondeBar();
    });
    scroll.appendChild(latencyButton);
    RADIOSONDE_MODELS.forEach((model) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = isRadiosondeShown(model.slug);
      input.addEventListener('change', () => {
        radiosondeVisibility[model.slug] = input.checked;
        saveRadiosondeVisibility();
        renderRadiosondeBar();
        if (input.checked && !radiosondeStatus.has(model.slug)) loadRadiosondeModel(model);
      });
      const text = document.createElement('span');
      text.textContent = model.label;
      label.append(input, text);
      scroll.appendChild(label);
    });
    menu.appendChild(scroll);
    menu.addEventListener('pointerdown', (event) => event.stopPropagation());
    document.body.appendChild(menu);
    return menu;
  }

  function toggleRadiosondeMenu() {
    const menu = ensureRadiosondeMenu();
    const button = document.querySelector('#lynn-rs .lynn-rs-settings');
    const nextOpen = menu.hidden;
    menu.hidden = !nextOpen;
    if (button) button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    if (nextOpen) positionRadiosondeMenu();
  }

  function radiosondeWheelDelta(event, size) {
    let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= size || 1;
    return delta;
  }

  function bindRadiosondeTrackDrag(track) {
    if (!track) return;
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    track.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (track.scrollWidth <= track.clientWidth + 1) return;
      dragging = true;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      track.classList.add('is-grabbing');
      track.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    track.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      track.scrollLeft = startScroll - (event.clientX - startX);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-grabbing');
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
  }

  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const menuScroll = hit && hit.closest && hit.closest('#lynn-rs-menu .lynn-rs-menu-scroll');
    if (menuScroll && menuScroll.scrollHeight > menuScroll.clientHeight + 1) {
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * menuScroll.clientHeight : event.deltaY;
      const max = menuScroll.scrollHeight - menuScroll.clientHeight;
      const next = Math.max(0, Math.min(max, menuScroll.scrollTop + delta));
      if (next === menuScroll.scrollTop) return;
      menuScroll.scrollTop = next;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const track = document.querySelector('#lynn-rs .lynn-rs-track');
    if (!track || track.scrollWidth <= track.clientWidth + 1) return;
    const rect = track.getBoundingClientRect();
    const overTrack = event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom;
    if (!overTrack) return;
    const delta = radiosondeWheelDelta(event, track.clientWidth);
    if (!delta) return;
    const max = track.scrollWidth - track.clientWidth;
    const next = Math.max(0, Math.min(max, track.scrollLeft + delta));
    if (next === track.scrollLeft) return;
    track.scrollLeft = next;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  function ensureRadiosonde() {
    if (!isFullscreenRoute()) {
      document.getElementById('lynn-rs')?.remove();
      closeRadiosondeMenu();
      return;
    }
    const host = findRadiosondeHost();
    if (!host) return;
    host.classList.add('lynn-rs-host');
    let bar = document.getElementById('lynn-rs');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'lynn-rs';
      bar.innerHTML = '<div class="lynn-rs-track"></div><button type="button" class="lynn-rs-refresh" title="라디오존데 갱신" aria-label="라디오존데 갱신">↻</button><button type="button" class="lynn-rs-settings" title="표시할 모델" aria-label="표시할 모델" aria-expanded="false">⚙</button>';
      bar.querySelector('.lynn-rs-refresh').addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        refreshRadiosonde();
      });
      bar.querySelector('.lynn-rs-settings').addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleRadiosondeMenu();
      });
      bindRadiosondeTrackDrag(bar.querySelector('.lynn-rs-track'));
    }
    if (bar.parentElement !== host) host.appendChild(bar);
    renderRadiosondeBar();
    if (!radiosondeStarted) {
      radiosondeStarted = true;
      setInterval(() => {
        if (!document.hidden) refreshRadiosonde();
      }, 60000);
    }
    if (!radiosondeLiveFetchStarted) refreshRadiosonde();
  }

  window.addEventListener('pageshow', kickRadiosondeAfterLoad);
  if (document.readyState === 'complete') kickRadiosondeAfterLoad();
  else window.addEventListener('load', kickRadiosondeAfterLoad);

  function composerRoot() {
    const editable = findChatComposerEditable();
    if (!editable) return null;
    let node = editable;
    for (let i = 0; i < 8 && node.parentElement; i += 1) {
      node = node.parentElement;
      if (node.querySelector('button[aria-label*="단축어"]')) return node;
      if ([...node.querySelectorAll('button')].some((button) => String(button.innerText || '').includes('추천답변'))) return node;
    }
    return editable.closest('form') || editable.parentElement;
  }

  function composerControlBlob(element) {
    return `${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.textContent || ''}`.replace(/\s+/g, '');
  }

  function isOwnComposerControl(element) {
    return element.id === ID.fullscreenButton || element.id === ID.gear || element.id === ID.bottomModelButton || element.id === 'lynn-cbe-launch';
  }

  function hasComposerIcon(element, pathStart) {
    return [...element.querySelectorAll('svg path')].some((path) => String(path.getAttribute('d') || '').startsWith(pathStart));
  }

  function isStarComposerControl(element) {
    const text = String(element.textContent || '').replace(/\s+/g, '');
    return text === '*' || text === '＊' || text === '✱' || hasComposerIcon(element, 'm12.8 10.62');
  }

  function isSlashComposerControl(element) {
    const label = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''}`;
    const text = String(element.textContent || '').replace(/\s+/g, '');
    return label.includes('단축어') || text === '/' || text === '／';
  }

  function isRecommendComposerControl(element) {
    if (isStarComposerControl(element) || isSlashComposerControl(element)) return false;
    if (element.dataset.lynnRecommend === '1') return true;
    if (hasComposerIcon(element, 'm13.8 2.58')) {
      element.dataset.lynnRecommend = '1';
      return true;
    }
    const blob = composerControlBlob(element);
    if (!blob.includes('추천답변') || blob.length > 40) return false;
    element.dataset.lynnRecommend = '1';
    return true;
  }

  function applyRecommendVisibility(element) {
    element.dataset.lynnRecommend = '1';
    element.classList.toggle('lynn-hide-composer-control', !recommendReplyVisible);
    element.classList.toggle('lynn-pink-composer-icon', recommendReplyVisible);
  }

  function syncComposerControls() {
    const roots = new Set();
    const root = composerRoot();
    if (root) roots.add(root);
    const sendButton = findBottomSendButton();
    let sendScope = sendButton?.parentElement || null;
    for (let i = 0; i < 4 && sendScope; i += 1) {
      roots.add(sendScope);
      sendScope = sendScope.parentElement;
    }
    if (!roots.size) return;
    roots.forEach((scope) => scope.querySelectorAll('button, [role="button"]').forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      if (element.closest(`#${ID.panel}, #${ID.root}, #${ID.bottomModelPopup}, #lynn-cbe-overlay, #lynn-cbe-panel`)) return;
      if (isOwnComposerControl(element)) return;
      if (isRecommendComposerControl(element)) {
        applyRecommendVisibility(element);
        return;
      }
      if (!isStarComposerControl(element) && !isSlashComposerControl(element)) return;
      element.classList.remove('lynn-hide-composer-control');
      element.classList.add('lynn-pink-composer-icon');
    }));
    syncSuggestedReplies();
  }

  function syncSuggestedReplies() {
    document.querySelectorAll('button[aria-label="답변 수정"]').forEach((edit) => {
      if (!(edit instanceof HTMLElement) || edit.closest('[data-message-group-id]')) return;
      edit.classList.add('lynn-suggest-edit');
      const row = edit.parentElement;
      if (!row) return;
      row.querySelectorAll('button').forEach((button) => {
        if (button === edit) return;
        if (String(button.textContent || '').trim().length < 8) return;
        button.classList.add('lynn-suggest-chip');
      });
    });
  }

  function init() {
    ensurePanel();
    ensureGear();
    ensureFullscreenButton();
    bindOfficialModelRegistryScan();
    syncChatModelRegistryFromOfficialMenu();
    ensureBottomModelPicker();
    ensureRadiosonde();
    syncOfficialModelVisibility();
    applyEmptySendGuardState();
    applyChromeHover();
    syncComposerControls();
  }

  function runInit() {
    lastInitRun = performance.now();
    try {
      init();
    } catch (error) {
      console.warn('[Lynn] init', error);
    }
  }

  function scheduleInit() {
    if (initScheduled) return;
    initScheduled = true;
    const elapsed = performance.now() - lastInitRun;
    const delay = elapsed >= 300 ? 0 : 300 - elapsed;
    clearTimeout(initThrottleTimer);
    initThrottleTimer = setTimeout(() => {
      initThrottleTimer = null;
      requestAnimationFrame(() => {
        initScheduled = false;
        runInit();
      });
    }, delay);
  }

  function bindGlobal() {
    if (document.documentElement.dataset.lynnBound === '1') return;
    document.documentElement.dataset.lynnBound = '1';

    document.addEventListener('pointerdown', guardEmptyComposerSendEvent, true);
    document.addEventListener('mousedown', guardEmptyComposerSendEvent, true);
    document.addEventListener('click', (event) => {
      guardEmptyComposerSendEvent(event);
      if (event.defaultPrevented) return;
      const popup = document.getElementById(ID.bottomModelPopup);
      const modelButton = event.target.closest?.(`#${ID.bottomModelButton}`);
      if (event.isTrusted && !syncingOfficialModelInfo && isBottomModelPopupOpen() && popup && !popup.contains(event.target) && !modelButton) {
        closeBottomModelPopup();
      }
      const radiosondeMenu = document.getElementById('lynn-rs-menu');
      const radiosondeSettings = event.target.closest?.('.lynn-rs-settings');
      if (radiosondeMenu && !radiosondeMenu.hidden && !radiosondeMenu.contains(event.target) && !radiosondeSettings) {
        closeRadiosondeMenu();
      }
    }, true);
    document.addEventListener('input', (event) => {
      if (isChatComposerTarget(event.target)) scheduleEmptySendGuardUiUpdate();
    }, true);
    document.addEventListener('keyup', (event) => {
      if (isChatComposerTarget(event.target)) scheduleEmptySendGuardUiUpdate();
    }, true);
    document.addEventListener('keydown', (event) => {
      guardEmptyComposerEnterEvent(event);
      if (event.defaultPrevented || event.key !== 'Escape') return;
      const logOverlay = document.getElementById('lynn-cbe-overlay');
      if (logOverlay && logOverlay.style.display === 'flex') return;
      closeBottomModelPopup({ closeOriginal: false });
      closeRadiosondeMenu();
      setPanelOpen(false);
    }, true);
    document.addEventListener('fullscreenchange', () => {
      updateFullscreenButtonUi();
      syncFullscreenKeyboard();
    });
    bindFullscreenKeyboard();
    window.addEventListener('resize', () => {
      cachedHeader = null;
      applyChromeHover();
      ensureGear();
      if (panelOpen) positionSettingsPanel();
      if (isBottomModelPopupOpen()) positionBottomModelPopup(document.getElementById(ID.bottomModelButton));
      positionRadiosondeMenu();
    });
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      const composer = cachedComposerEditable?.isConnected ? cachedComposerEditable : null;
      const onlyComposer = !!composer && mutations.length > 0 && mutations.every((mutation) =>
        mutation.type === 'childList' &&
        (mutation.target === composer || composer.contains(mutation.target))
      );
      if (onlyComposer) {
        if (emptySendGuard) scheduleEmptySendGuardUiUpdate();
        return;
      }
      scheduleInit();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  addStyle();
  watchChatSwitches();
  ready(() => {
    bindGlobal();
    runInit();
    observe();
  });

  (() => {
  const APP = Object.freeze({
    apiBase: 'https://crack-api.wrtn.ai/crack-gen/v3',
    pageSize: 300,
    hardLimit: 20000,
    patchDelayMs: 220,
    retryCount: 3,
    retryBaseDelayMs: 700,
    maxReplacePreviewItems: 120,
  });

  const ID = Object.freeze({
    launch: 'lynn-cbe-launch',
    statusText: 'lynn-cbe-status-text',
    statusExtra: 'lynn-cbe-status-extra',
    statusActions: 'lynn-cbe-status-actions',
    logToggle: 'lynn-cbe-log-toggle',
    progress: 'lynn-cbe-progress',
    turnVerify: 'lynn-cbe-turn-verify',
    turnMenu: 'lynn-cbe-turn-menu',
    overlay: 'lynn-cbe-overlay',
    panel: 'lynn-cbe-panel',
    status: 'lynn-cbe-status',
    log: 'lynn-cbe-log',
    cancel: 'lynn-cbe-cancel',

    tabReplace: 'lynn-cbe-tab-replace',
    tabTurn: 'lynn-cbe-tab-turn',
    tabRepeat: 'lynn-cbe-tab-repeat',
    paneReplace: 'lynn-cbe-pane-replace',
    paneTurn: 'lynn-cbe-pane-turn',
    paneRepeat: 'lynn-cbe-pane-repeat',

    replacePreview: 'lynn-cbe-replace-preview',
    replaceScan: 'lynn-cbe-replace-scan',
    replaceApply: 'lynn-cbe-replace-apply',
    find: 'lynn-cbe-find',
    replace: 'lynn-cbe-replace',
    target: 'lynn-cbe-target',
    caseSensitive: 'lynn-cbe-case-sensitive',

    turnPattern: 'lynn-cbe-turn-pattern',
    turnAnalyze: 'lynn-cbe-turn-analyze',
    turnApply: 'lynn-cbe-turn-apply',
    turnStartNumber: 'lynn-cbe-turn-start-number',
    turnExpectedEnd: 'lynn-cbe-turn-expected-end',
    turnFilter: 'lynn-cbe-turn-filter',
    turnOnlyReview: 'lynn-cbe-turn-only-review',
    turnCandidateList: 'lynn-cbe-turn-candidates',
    turnSummary: 'lynn-cbe-turn-summary',
    turnRange: 'lynn-cbe-turn-range',
    turnFirstAnchor: 'lynn-cbe-turn-first-anchor',
    turnLatestAnchor: 'lynn-cbe-turn-latest-anchor',
    turnExcludeFiltered: 'lynn-cbe-turn-exclude-filtered',
    turnIncludeFiltered: 'lynn-cbe-turn-include-filtered',

    repeatScan: 'lynn-cbe-repeat-scan',
    repeatList: 'lynn-cbe-repeat-list',

    tabReroll: 'lynn-cbe-tab-reroll',
    paneReroll: 'lynn-cbe-pane-reroll',
    rerollScan: 'lynn-cbe-reroll-scan',
    rerollApply: 'lynn-cbe-reroll-apply',
    rerollList: 'lynn-cbe-reroll-list',
  });

  const state = {
    activeTab: 'replace',
    chatId: '',
    messages: [],
    loadedChatId: '',
    loading: false,
    patching: false,
    cancelling: false,
    truncated: false,
    logLines: [],

    replace: {
      matches: [],
      lastScanSignature: '',
    },

    turn: {
      candidates: [],
      patternText: '',
      target: 'assistant',
      startCandidateId: '',
      endCandidateId: '',
      startNumber: null,
      expectedEnd: null,
      plan: null,
      analyzed: false,
      skippedRerolls: 0,
    },

    repeat: {
      groups: [],
      scanned: false,
      skippedRerolls: 0,
    },

    reroll: {
      items: [],
      scanned: false,
    },
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseChatId() {
    const match = location.pathname.match(/\/stories\/[^/]+\/episodes\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function getCookie(name) {
    const prefix = `${name}=`;
    const item = document.cookie
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));
    return item ? item.slice(prefix.length) : '';
  }

  function buildHeaders(hasBody = false) {
    const token = getCookie('access_token');
    const wrtnId = getCookie('__w_id');
    const headers = {
      Accept: 'application/json, text/plain, */*',
      platform: 'web',
      'wrtn-locale': 'ko-KR',
    };

    if (hasBody) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wrtnId) headers['x-wrtn-id'] = wrtnId;

    return headers;
  }

  async function parseResponseBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }

  function getApiErrorMessage(body, fallback) {
    if (!body) return fallback;
    if (typeof body === 'string') return `${fallback}: ${body.slice(0, 300)}`;

    const message =
      body?.message ||
      body?.error?.message ||
      body?.error ||
      body?.data?.message ||
      body?.result?.message;

    return message ? `${fallback}: ${String(message).slice(0, 300)}` : fallback;
  }

  async function apiFetch(url, options = {}, label = 'API 요청') {
    let lastError = null;

    for (let attempt = 0; attempt <= APP.retryCount; attempt++) {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          ...options,
        });

        const body = await parseResponseBody(response);

        if (response.ok) {
          return { response, body };
        }

        const message = getApiErrorMessage(body, `${label} 실패 (${response.status})`);
        const retriable = response.status === 429 || response.status >= 500;

        if (!retriable || attempt >= APP.retryCount) {
          const error = new Error(message);
          error.status = response.status;
          error.body = body;
          throw error;
        }

        lastError = new Error(message);
      } catch (error) {
        if (error?.status && error.status < 500 && error.status !== 429) {
          throw error;
        }
        lastError = error;
        if (attempt >= APP.retryCount) throw error;
      }

      await sleep(APP.retryBaseDelayMs * (attempt + 1));
    }

    throw lastError || new Error(`${label} 실패`);
  }

  function extractMessagesPayload(body) {
    const root = body?.data ?? body ?? {};
    const messages = Array.isArray(root?.messages) ? root.messages : [];
    const nextCursor = String(root?.nextCursor ?? root?.cursor ?? '');
    return { messages, nextCursor };
  }

  function getMessageId(message) {
    return String(message?._id ?? message?.id ?? '');
  }

  function getMessageRole(message) {
    return String(message?.role ?? '').toLowerCase();
  }

  function getMessageContent(message) {
    const value = message?.content ?? message?.message ?? message?.text ?? '';
    return typeof value === 'string' ? value : '';
  }

  function getMessageCreatedAt(message) {
    return message?.createdAt ?? message?.created_at ?? message?.timestamp ?? '';
  }

  function roleLabel(role) {
    if (role === 'assistant') return 'AI';
    if (role === 'user') return 'USER';
    return role || 'UNKNOWN';
  }

  function roleMatches(role, target) {
    if (target === 'assistant') return role === 'assistant';
    if (target === 'user') return role === 'user';
    return role === 'assistant' || role === 'user';
  }

  async function fetchMessagePage(chatId, cursor = '') {
    const query = new URLSearchParams();
    query.set('limit', String(APP.pageSize));
    if (cursor) query.set('cursor', cursor);

    const url = `${APP.apiBase}/chats/${encodeURIComponent(chatId)}/messages?${query.toString()}`;
    const { body } = await apiFetch(url, {
      method: 'GET',
      headers: buildHeaders(false),
    }, '메시지 조회');

    return extractMessagesPayload(body);
  }

  async function fetchAllMessages(chatId) {
    const collected = [];
    const seenIds = new Set();
    const seenCursors = new Set();
    let cursor = '';
    let pages = 0;
    let truncated = false;

    while (true) {
      if (state.cancelling) throw new Error('사용자가 작업을 취소했습니다.');

      setStatus(`전체 로그 불러오는 중… ${collected.length.toLocaleString()}개`, 'busy');
      const page = await fetchMessagePage(chatId, cursor);
      pages += 1;

      if (!page.messages.length) break;

      for (const raw of page.messages) {
        const id = getMessageId(raw);
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        collected.push(raw);
      }

      if (!page.nextCursor) break;

      if (seenCursors.has(page.nextCursor)) {
        appendLog('같은 cursor가 반복되어 조회를 중단했습니다.');
        break;
      }

      if (collected.length >= APP.hardLimit) {
        truncated = true;
        break;
      }

      seenCursors.add(page.nextCursor);
      cursor = page.nextCursor;
      await sleep(180);
    }

    return {
      messages: collected.slice(0, APP.hardLimit).reverse(),
      truncated,
      pages,
    };
  }

  async function ensureMessagesLoaded(chatId, forceReload = false) {
    if (!forceReload && state.loadedChatId === chatId && state.messages.length) {
      return {
        messages: state.messages,
        truncated: state.truncated,
        cached: true,
      };
    }

    const result = await fetchAllMessages(chatId);
    state.messages = result.messages;
    state.loadedChatId = chatId;
    state.chatId = chatId;
    state.truncated = result.truncated;

    return {
      messages: state.messages,
      truncated: state.truncated,
      cached: false,
    };
  }

  async function patchMessage(chatId, messageId, content) {
    const url = `${APP.apiBase}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`;
    const { body } = await apiFetch(url, {
      method: 'PATCH',
      headers: buildHeaders(true),
      body: JSON.stringify({ message: content }),
    }, '메시지 수정');

    return body;
  }

  async function deleteMessage(chatId, messageId) {
    const url = `${APP.apiBase}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`;
    const { body } = await apiFetch(url, {
      method: 'DELETE',
      headers: buildHeaders(false),
    }, '메시지 삭제');

    return body;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    try {
      return date.toLocaleString('ko-KR');
    } catch (_) {
      return '';
    }
  }

  function truncateText(value, max = 900) {
    const text = String(value ?? '');
    if (text.length <= max) return text;
    return `${text.slice(0, max)}\n… (${(text.length - max).toLocaleString()}자 생략)`;
  }

  function compactText(value, max = 180) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text.length <= max ? text : `${text.slice(0, max)}…`;
  }

  function setStatus(message, type = 'neutral') {
    const el = document.getElementById(ID.status);
    const text = document.getElementById(ID.statusText);
    if (!el) return;

    const empty = !String(message ?? '').trim();
    el.dataset.type = type;
    el.hidden = empty && !state.loading && !state.patching;
    if (text) text.textContent = String(message ?? '');
  }

  function appendLog(message) {
    const stamp = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    state.logLines.push(`[${stamp}] ${message}`);
    if (state.logLines.length > 240) {
      state.logLines.splice(0, state.logLines.length - 240);
    }

    const el = document.getElementById(ID.log);
    if (el) {
      el.textContent = state.logLines.join('\n');
      el.scrollTop = el.scrollHeight;
    }
  }

  function setProgress(current, total) {
    const wrap = document.getElementById(ID.progress);
    if (!wrap) return;

    if (!total) {
      wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    const bar = wrap.querySelector('i');
    if (bar) bar.style.width = `${Math.min(100, (current / total) * 100)}%`;
  }

  function setBusyUi(isBusy) {
    document.querySelectorAll(`#${ID.panel} input, #${ID.panel} select, #${ID.panel} .lynn-cbe-btn, #${ID.panel} .lynn-cbe-tab`)
      .forEach(el => {
        if (el.id === ID.cancel) return;
        el.disabled = isBusy;
      });

    const cancel = document.getElementById(ID.cancel);
    if (cancel) {
      cancel.disabled = !isBusy;
      cancel.style.display = isBusy ? '' : 'none';
    }

    if (!isBusy) {
      setProgress(0, 0);
      syncApplyButtons();
    }
  }

  function syncApplyButtons() {
    const replaceApply = document.getElementById(ID.replaceApply);
    const turnApply = document.getElementById(ID.turnApply);

    if (replaceApply) {
      replaceApply.disabled =
        state.loading ||
        state.patching ||
        !getIncludedReplaceMatches().length;
    }

    if (turnApply) {
      const patchCount = state.turn.plan?.patches?.length || 0;
      turnApply.disabled =
        state.loading ||
        state.patching ||
        !state.turn.analyzed ||
        !patchCount;
    }

    const rerollApply = document.getElementById(ID.rerollApply);
    if (rerollApply) {
      rerollApply.disabled =
        state.loading ||
        state.patching ||
        !state.reroll.scanned ||
        !getIncludedRerollItems().length;
    }
  }

  function buildLiteralRegex(findText, caseSensitive) {
    return new RegExp(escapeRegExp(findText), caseSensitive ? 'g' : 'gi');
  }

  function replaceLiteral(text, findText, replacement, caseSensitive) {
    const regex = buildLiteralRegex(findText, caseSensitive);
    let count = 0;

    const after = text.replace(regex, () => {
      count += 1;
      return replacement;
    });

    return { after, count };
  }

  function getReplaceUiValues() {
    return {
      findText: document.getElementById(ID.find)?.value ?? '',
      replacement: document.getElementById(ID.replace)?.value ?? '',
      target: document.getElementById(ID.target)?.value ?? 'all',
      caseSensitive: !!document.getElementById(ID.caseSensitive)?.checked,
    };
  }

  function makeReplaceSignature(values) {
    return JSON.stringify(values);
  }

  function scanReplaceMessages(messages, values) {
    const results = [];

    for (let index = 0; index < messages.length; index++) {
      const raw = messages[index];
      const role = getMessageRole(raw);

      if (!roleMatches(role, values.target)) continue;

      const before = getMessageContent(raw);
      if (!before) continue;

      const { after, count } = replaceLiteral(
        before,
        values.findText,
        values.replacement,
        values.caseSensitive
      );

      if (!count || after === before) continue;

      results.push({
        index,
        id: getMessageId(raw),
        role,
        before,
        after,
        count,
        createdAt: getMessageCreatedAt(raw),
        excluded: false,
      });
    }

    return results;
  }

  function resetReplaceScan() {
    state.replace.matches = [];
    state.replace.lastScanSignature = '';

    const preview = document.getElementById(ID.replacePreview);

    if (preview) {
      preview.innerHTML = `
        <div class="lynn-cbe-empty">
          <strong>문자열을 한꺼번에 바꿉니다</strong>
          찾을 내용과 바꿀 내용을 넣고 먼저 변경점을 검사하세요.
        </div>`;
    }
    const extra = document.getElementById(ID.statusExtra);
    if (extra) extra.innerHTML = '';

    syncApplyButtons();
  }

  function invalidateReplaceScan() {
    if (state.patching || state.loading) return;
    resetReplaceScan();
    setStatus('치환 조건이 바뀌었습니다. 다시 검사해 주세요.', 'neutral');
  }

  function splitByMatches(text, findText, caseSensitive) {
    const regex = buildLiteralRegex(findText, caseSensitive);
    const parts = [];
    let last = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) parts.push({ hit: false, text: text.slice(last, match.index) });
      parts.push({ hit: true, text: match[0] });
      last = match.index + match[0].length;
      if (match[0] === '') regex.lastIndex += 1;
    }

    if (last < text.length) parts.push({ hit: false, text: text.slice(last) });
    return parts;
  }

  function buildDiffHtml(beforeText, findText, replacement, caseSensitive) {
    const source = truncateText(beforeText, 900);
    const parts = splitByMatches(source, findText, caseSensitive);
    const rep = escapeHtml(replacement);

    let before = '';
    let after = '';
    let inline = '';

    for (const part of parts) {
      const esc = escapeHtml(part.text);

      if (!part.hit) {
        before += esc;
        after += esc;
        inline += esc;
        continue;
      }

      before += `<mark>${esc}</mark>`;
      after += replacement ? `<mark class="g">${rep}</mark>` : '';
      inline += `<del>${esc}</del>` + (replacement ? `<ins>${rep}</ins>` : '');
    }

    return { before, after, inline };
  }

  function renderReplaceSummary(matches, truncated) {
    const extra = document.getElementById(ID.statusExtra);
    if (!extra) return;

    if (!matches.length) {
      extra.innerHTML = '';
      return;
    }

    const aiCount = matches.filter(item => item.role === 'assistant').length;
    const userCount = matches.filter(item => item.role === 'user').length;

    extra.innerHTML =
      (aiCount ? `<span class="lynn-cbe-pill ai">AI ${aiCount.toLocaleString()}</span>` : '') +
      (userCount ? `<span class="lynn-cbe-pill user">USER ${userCount.toLocaleString()}</span>` : '') +
      (truncated ? `<span class="lynn-cbe-pill warn" title="로그가 20,000개를 넘어 조회를 멈췄습니다">일부만 조회됨</span>` : '');
  }

  function getIncludedReplaceMatches() {
    return state.replace.matches.filter(item => !item.excluded && item.after !== item.before);
  }

  function describeReplaceScan() {
    const included = getIncludedReplaceMatches();
    const excludedCount = state.replace.matches.filter(item => item.excluded).length;
    const manualCount = included.filter(item => item.manual).length;
    const autoOccurrences = included.reduce(
      (sum, item) => sum + (item.manual ? 0 : item.count),
      0
    );

    renderReplaceSummary(included, state.truncated);

    if (!state.replace.matches.length) {
      setStatus('변경할 메시지가 없습니다.', 'neutral');
    } else if (!included.length) {
      setStatus('수정할 메시지가 없습니다.', 'neutral');
    } else {
      const notes = [];
      if (manualCount) notes.push(`직접 수정 ${manualCount.toLocaleString()}개`);
      if (autoOccurrences) notes.push(`자동 ${autoOccurrences.toLocaleString()}회`);
      if (excludedCount) notes.push(`${excludedCount.toLocaleString()}개는 제외`);
      const extra = notes.length ? ` · ${notes.join(' · ')}` : '';
      setStatus(`${included.length.toLocaleString()}개 메시지를 수정합니다.${extra}`, 'ok');
    }

    syncApplyButtons();
  }

  function refreshReplaceScanView() {
    renderReplacePreview(state.replace.matches);
    describeReplaceScan();
  }

  function setReplaceMatchExcluded(index, excluded) {
    const item = state.replace.matches.find(match => match.index === index);
    if (!item || item.excluded === excluded) return;
    item.excluded = excluded;
    refreshReplaceScanView();
  }

  function renderReplacePreview(matches) {
    const preview = document.getElementById(ID.replacePreview);
    if (!preview) return;

    if (!matches.length) {
      preview.innerHTML = `
        <div class="lynn-cbe-empty">
          <strong>바꿀 내용이 없습니다</strong>
          찾을 내용이나 대상을 바꿔서 다시 검사해 보세요.
        </div>`;
      return;
    }

    const values = getReplaceUiValues();
    const visible = matches.slice(0, APP.maxReplacePreviewItems);
    const openIndexes = new Set(
      [...preview.querySelectorAll('.lynn-cbe-preview-item:not(.collapsed)')]
        .map(el => el.getAttribute('data-replace-index'))
    );
    const keepOpenState = preview.querySelector('.lynn-cbe-preview-item');

    const html = visible.map((item, order) => {
      const diff = buildDiffHtml(
        item.before,
        values.findText,
        values.replacement,
        values.caseSensitive
      );
      const collapsed = keepOpenState
        ? !openIndexes.has(String(item.index))
        : order !== 0;
      const countLabel = item.excluded
        ? '제외됨'
        : item.after === item.before
          ? '변경 없음'
          : item.manual
            ? '직접 수정'
            : `${item.count.toLocaleString()}회`;
      const action = item.excluded
        ? `<button type="button" class="lynn-cbe-mini-btn" data-replace-include="${item.index}" title="다시 포함">＋</button>`
        : `<button type="button" class="lynn-cbe-mini-btn danger-lite" data-replace-exclude="${item.index}" title="이 메시지는 수정하지 않기">✕</button>`;

      return `
        <article class="lynn-cbe-preview-item ${item.excluded ? 'excluded' : ''} ${collapsed ? 'collapsed' : ''}" data-replace-index="${item.index}">
          <header>
            <span class="lynn-cbe-role ${item.role === 'assistant' ? 'ai' : 'user'}">${escapeHtml(roleLabel(item.role))}</span>
            <b>#${(item.index + 1).toLocaleString()}</b>
            <span class="lynn-cbe-num">${countLabel}</span>
            <time>${escapeHtml(formatDate(item.createdAt))}</time>
            ${action}
            <span class="lynn-cbe-caret">⌄</span>
          </header>
          <div class="lynn-cbe-diff">
            <section class="d-before"><div class="lynn-cbe-k">변경 전</div><pre>${diff.before}</pre></section>
            <section class="d-after"><div class="lynn-cbe-k">변경 후</div><textarea class="lynn-cbe-after" data-replace-after="${item.index}" spellcheck="false" autocomplete="off">${escapeHtml(item.after)}</textarea></section>
            <section class="d-inline"><pre>${diff.inline}</pre></section>
          </div>
        </article>
      `;
    }).join('');

    const hiddenIncluded = matches.slice(visible.length).filter(item => !item.excluded).length;
    const more = matches.length > visible.length
      ? `<div class="lynn-cbe-more">${visible.length.toLocaleString()}개만 미리 보여줍니다. 목록에 없는 ${hiddenIncluded.toLocaleString()}개도 함께 수정됩니다.</div>`
      : '';

    preview.innerHTML = html + more;
  }

  async function handleReplaceScan() {
    if (state.loading || state.patching) return;

    const chatId = parseChatId();
    if (!chatId) {
      setStatus('크랙 채팅방 안에서 실행해 주세요.', 'error');
      return;
    }

    const values = getReplaceUiValues();
    if (!values.findText) {
      setStatus('찾을 내용을 입력해 주세요.', 'error');
      document.getElementById(ID.find)?.focus();
      return;
    }

    state.loading = true;
    state.cancelling = false;
    state.logLines = [];
    resetReplaceScan();
    setBusyUi(true);
    appendLog(`치환 검사 시작 · chatId=${chatId}`);

    try {
      const loaded = await ensureMessagesLoaded(chatId);
      const matches = scanReplaceMessages(loaded.messages, values);

      state.replace.matches = matches;
      state.replace.lastScanSignature = makeReplaceSignature(values);

      refreshReplaceScanView();
      const occurrences = matches.reduce((sum, item) => sum + item.count, 0);

      appendLog(`치환 검사 완료 · ${matches.length.toLocaleString()}개 메시지 · ${occurrences.toLocaleString()}회`);
    } catch (error) {
      const cancelled = state.cancelling || /취소/.test(String(error?.message || ''));
      setStatus(
        cancelled ? '검사를 취소했습니다.' : `검사 실패: ${error.message || error}`,
        cancelled ? 'neutral' : 'error'
      );
      appendLog(cancelled ? '검사 취소' : `검사 실패 · ${error.message || error}`);
    } finally {
      state.loading = false;
      state.cancelling = false;
      setBusyUi(false);
    }
  }

  async function handleReplaceApply() {
    const includedMatches = getIncludedReplaceMatches();
    if (state.loading || state.patching || !includedMatches.length) return;

    const chatId = parseChatId();
    if (!chatId || chatId !== state.loadedChatId) {
      setStatus('검사한 채팅방과 현재 채팅방이 다릅니다. 다시 검사해 주세요.', 'error');
      return;
    }

    const values = getReplaceUiValues();

    if (makeReplaceSignature(values) !== state.replace.lastScanSignature) {
      setStatus('검색 조건이 바뀌었습니다. 다시 검사해 주세요.', 'error');
      resetReplaceScan();
      return;
    }

    const excludedCount = state.replace.matches.filter(item => item.excluded).length;
    const manualCount = includedMatches.filter(item => item.manual).length;
    const autoOccurrences = includedMatches.reduce(
      (sum, item) => sum + (item.manual ? 0 : item.count),
      0
    );
    const ok = confirm(
      `정말 수정할까요?\n\n` +
      `메시지 ${includedMatches.length.toLocaleString()}개\n` +
      (excludedCount ? `제외 ${excludedCount.toLocaleString()}개\n` : '') +
      (manualCount ? `직접 고친 메시지 ${manualCount.toLocaleString()}개\n` : '') +
      `자동 치환 ${autoOccurrences.toLocaleString()}회`
    );

    if (!ok) return;

    await runPatchItems({
      chatId,
      items: includedMatches,
      label: '치환',
      onFinish: () => {
        resetReplaceScan();
        state.loadedChatId = '';
        state.messages = [];
        resetRepeatScan();
        resetRerollScan();
      },
    });
  }

  function loosenTurnPatternPiece(literal) {
    let out = '';
    let index = 0;
    while (index < literal.length) {
      if (/\s/.test(literal[index])) {
        while (index < literal.length && /\s/.test(literal[index])) index += 1;
        out += '(?:[*_~`]+\\s*)*\\s+(?:[*_~`]+\\s*)*';
        continue;
      }
      let end = index;
      while (end < literal.length && !/\s/.test(literal[end])) end += 1;
      out += escapeRegExp(literal.slice(index, end));
      index = end;
    }
    return out;
  }

  function parseTurnPattern(patternText) {
    const token = '{N}';
    const first = patternText.indexOf(token);
    const last = patternText.lastIndexOf(token);

    if (first < 0) {
      throw new Error('턴 패턴에 {N}이 필요합니다. 예: **[{N}]**');
    }

    if (first !== last) {
      throw new Error('{N}은 패턴 안에 한 번만 넣어 주세요.');
    }

    const prefix = patternText.slice(0, first);
    const suffix = patternText.slice(first + token.length);
    const marks = '(?:[*_~`]+\\s*)*';

    const regex = new RegExp(
      `${loosenTurnPatternPiece(prefix)}${marks}(\\d+)${marks}${loosenTurnPatternPiece(suffix)}`,
      'g'
    );

    return { patternText, prefix, suffix, regex };
  }

  function findTurnOccurrences(content, parsedPattern) {
    const results = [];
    const regex = new RegExp(parsedPattern.regex.source, parsedPattern.regex.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const rawNumber = match[1] || '';
      const number = Number.parseInt(rawNumber, 10);

      results.push({
        number,
        rawNumber,
        full: match[0],
        start: match.index,
        end: match.index + match[0].length,
        numberStart: match.index + match[0].indexOf(rawNumber),
        numberEnd: match.index + match[0].indexOf(rawNumber) + rawNumber.length,
      });

      if (match[0] === '') regex.lastIndex += 1;
    }

    return results;
  }

  function getParentTurnId(message) {
    const value = message?.parentTurnId ?? message?.parent_turn_id ?? '';
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeLooseText(value) {
    return String(value ?? '')
      .replace(/[*_~`#>\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findVisibleGroupText(firstMessageId) {
    if (!firstMessageId || typeof document === 'undefined') return '';
    const escaped = window.CSS && typeof CSS.escape === 'function'
      ? CSS.escape(firstMessageId)
      : String(firstMessageId).replace(/"/g, '');
    const group = document.querySelector(`[data-message-group-id="${escaped}"]`);
    if (!(group instanceof HTMLElement) || !isVisibleElement(group)) return '';
    return group.innerText || '';
  }

  function chooseActiveMessageChoice(messages, start, end) {
    let visible = '';
    let seen = false;

    for (let index = start; index < end; index++) {
      const text = normalizeLooseText(findVisibleGroupText(getMessageId(messages[index])));
      if (!text) continue;
      seen = true;
      if (text.length > visible.length) visible = text;
    }

    if (visible.length >= 16) {
      let bestIndex = -1;
      let bestLength = 0;

      for (let index = start; index < end; index++) {
        const normalized = normalizeLooseText(getMessageContent(messages[index]));
        if (normalized.length < 16) continue;

        const limit = Math.min(normalized.length, 240);
        let matched = 0;
        for (let length = 16; length <= limit; length += 8) {
          if (!visible.includes(normalized.slice(0, length))) break;
          matched = length;
        }

        if (matched > bestLength || (matched === bestLength && matched > 0)) {
          bestLength = matched;
          bestIndex = index;
        }
      }

      if (bestIndex >= 0) return { index: bestIndex, seen: true };
    }

    return { index: end - 1, seen };
  }

  function collectDiscardedRerolls(messages) {
    const items = [];
    let index = 0;

    while (index < messages.length) {
      const parentTurnId = getParentTurnId(messages[index]);
      if (getMessageRole(messages[index]) !== 'assistant' || !parentTurnId) {
        index += 1;
        continue;
      }

      let end = index + 1;
      while (
        end < messages.length &&
        getMessageRole(messages[end]) === 'assistant' &&
        getParentTurnId(messages[end]) === parentTurnId
      ) {
        end += 1;
      }

      if (end - index > 1) {
        const choice = chooseActiveMessageChoice(messages, index, end);
        for (let cursor = index; cursor < end; cursor++) {
          if (cursor === choice.index) continue;
          const raw = messages[cursor];
          const id = getMessageId(raw);
          if (!id) continue;
          items.push({
            index: cursor,
            id,
            role: 'assistant',
            before: getMessageContent(raw),
            after: '',
            createdAt: getMessageCreatedAt(raw),
            unseen: !choice.seen,
            excluded: false,
          });
        }
      }

      index = end;
    }

    return items;
  }

  function getDiscardedRerollIds(messages) {
    return new Set(collectDiscardedRerolls(messages).map(item => item.id));
  }

  function findExactAssistantRepeats(messages) {
    const discardedRerolls = getDiscardedRerollIds(messages);
    const groups = new Map();
    let skippedRerolls = 0;

    for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
      const raw = messages[messageIndex];
      if (getMessageRole(raw) !== 'assistant') continue;

      const content = getMessageContent(raw);
      if (!content.trim()) continue;

      const id = getMessageId(raw);
      if (id && discardedRerolls.has(id)) {
        skippedRerolls += 1;
        continue;
      }

      const hits = groups.get(content) || [];
      hits.push({
        index: messageIndex,
        id,
        createdAt: getMessageCreatedAt(raw),
      });
      groups.set(content, hits);
    }

    return {
      groups: [...groups.entries()]
        .filter(([, hits]) => hits.length > 1)
        .map(([content, hits]) => ({ content, hits }))
        .sort((a, b) => a.hits[0].index - b.hits[0].index),
      skippedRerolls,
    };
  }

  function buildTurnCandidates(messages, patternText, target) {
    const parsedPattern = parseTurnPattern(patternText);
    const candidates = [];
    const discardedRerolls = getDiscardedRerollIds(messages);
    let skippedRerolls = 0;

    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
      const raw = messages[messageIndex];
      const role = getMessageRole(raw);
      if (!roleMatches(role, target)) continue;

      const content = getMessageContent(raw);
      if (!content) continue;

      const occurrences = findTurnOccurrences(content, parsedPattern);
      if (!occurrences.length) continue;

      const ambiguous = occurrences.length > 1;
      const id = getMessageId(raw);

      if (id && discardedRerolls.has(id)) {
        skippedRerolls += 1;
        continue;
      }

      candidates.push({
        id,
        messageIndex,
        role,
        content,
        createdAt: getMessageCreatedAt(raw),
        occurrences,
        selectedOccurrence: ambiguous ? -1 : 0,
        mode: ambiguous ? 'review' : 'include',
        ambiguous,
      });
    }

    return { candidates, parsedPattern, skippedRerolls };
  }

  function formatTurnAnalyzeStatus(candidateCount, ambiguousCount, skippedRerolls) {
    let text = `턴 후보 ${candidateCount.toLocaleString()}개를 찾았습니다.`;
    if (skippedRerolls) {
      text += ` · 화면에서 빠진 리롤 ${skippedRerolls.toLocaleString()}개는 제외했습니다.`;
    }
    if (ambiguousCount) {
      text += ` · 다중 패턴 ${ambiguousCount.toLocaleString()}개는 검토 필요로 제외했습니다.`;
    }
    return text;
  }

  function getTurnCandidateById(id) {
    return state.turn.candidates.find(item => item.id === id) || null;
  }

  function getTurnCandidatePosition(id) {
    return state.turn.candidates.findIndex(item => item.id === id);
  }

  function isTurnCandidateCounted(candidate) {
    return (
      candidate &&
      candidate.mode === 'include' &&
      candidate.selectedOccurrence >= 0 &&
      candidate.occurrences[candidate.selectedOccurrence]
    );
  }

  function preserveNumberWidth(number, rawNumber) {
    const text = String(number);
    const source = String(rawNumber || '');

    if (/^0\d+$/.test(source) && source.length > text.length) {
      return text.padStart(source.length, '0');
    }

    return text;
  }

  function replaceOccurrenceNumber(content, occurrence, expectedNumber) {
    const numberText = preserveNumberWidth(expectedNumber, occurrence.rawNumber);

    return (
      content.slice(0, occurrence.numberStart) +
      numberText +
      content.slice(occurrence.numberEnd)
    );
  }

  function inferDefaultTurnAnchors(candidates) {
    const valid = candidates.filter(isTurnCandidateCounted);
    if (!valid.length) {
      return {
        startCandidateId: '',
        endCandidateId: '',
        startNumber: null,
      };
    }

    const first = valid[0];
    const last = valid[valid.length - 1];
    const firstOccurrence = first.occurrences[first.selectedOccurrence];

    return {
      startCandidateId: first.id,
      endCandidateId: last.id,
      startNumber: firstOccurrence?.number ?? null,
    };
  }

  function computeTurnPlan() {
    const candidates = state.turn.candidates;

    if (!candidates.length) {
      state.turn.plan = null;
      return null;
    }

    const startPos = getTurnCandidatePosition(state.turn.startCandidateId);
    const endPos = getTurnCandidatePosition(state.turn.endCandidateId);
    const startNumber = Number.parseInt(String(state.turn.startNumber ?? ''), 10);

    if (startPos < 0 || endPos < 0 || startPos > endPos || !Number.isFinite(startNumber)) {
      state.turn.plan = null;
      return null;
    }

    const inRange = candidates.slice(startPos, endPos + 1);
    const counted = inRange.filter(isTurnCandidateCounted);
    const excluded = inRange.filter(item => item.mode === 'exclude');
    const review = inRange.filter(item => item.mode === 'review' || item.selectedOccurrence < 0);

    let expected = startNumber;
    const rows = [];
    const patches = [];

    for (const candidate of inRange) {
      if (!isTurnCandidateCounted(candidate)) continue;

      const occurrence = candidate.occurrences[candidate.selectedOccurrence];
      const after = replaceOccurrenceNumber(candidate.content, occurrence, expected);
      const changed = after !== candidate.content;

      const row = {
        id: candidate.id,
        role: candidate.role,
        before: candidate.content,
        after,
        createdAt: candidate.createdAt,
        messageIndex: candidate.messageIndex,
        currentNumber: occurrence.number,
        expectedNumber: expected,
        changed,
      };

      rows.push(row);
      if (changed) patches.push(row);
      expected += 1;
    }

    const lastTurn = counted.length ? startNumber + counted.length - 1 : null;
    const expectedEnd = Number.parseInt(String(state.turn.expectedEnd ?? ''), 10);
    const hasExpectedEnd = Number.isFinite(expectedEnd);

    const plan = {
      startPos,
      endPos,
      inRange,
      counted,
      excluded,
      review,
      rows,
      patches,
      startNumber,
      lastTurn,
      expectedEnd: hasExpectedEnd ? expectedEnd : null,
      endDelta: hasExpectedEnd && lastTurn !== null ? lastTurn - expectedEnd : null,
    };

    state.turn.plan = plan;
    return plan;
  }

  function resetTurnAnalysis() {
    state.turn.candidates = [];
    state.turn.patternText = '';
    state.turn.startCandidateId = '';
    state.turn.endCandidateId = '';
    state.turn.startNumber = null;
    state.turn.expectedEnd = null;
    state.turn.plan = null;
    state.turn.analyzed = false;
    state.turn.skippedRerolls = 0;

    const summary = document.getElementById(ID.turnSummary);
    const range = document.getElementById(ID.turnRange);
    const list = document.getElementById(ID.turnCandidateList);

    if (summary) summary.textContent = '패턴을 넣고 분석을 눌러 주세요.';
    if (range) { range.hidden = true; range.innerHTML = ''; }
    if (list) {
      list.innerHTML = `
        <div class="lynn-cbe-empty">
          <strong>턴 번호를 다시 매깁니다</strong>
          숫자 자리에 {N}을 넣은 패턴을 입력하고 분석을 눌러 주세요.
        </div>`;
    }
    const verify = document.getElementById(ID.turnVerify);
    const checkLine = document.getElementById('lynn-cbe-check-line');
    const tools = document.querySelector('[data-lynn-cbe-turn-tools]');
    if (verify) verify.textContent = '';
    if (checkLine) {
      checkLine.hidden = true;
      checkLine.className = 'lynn-cbe-check off';
    }
    if (tools) tools.hidden = true;

    syncApplyButtons();
  }

  function invalidateTurnAnalysis() {
    if (state.loading || state.patching) return;

    if (state.turn.analyzed) {
      resetTurnAnalysis();
      setStatus('턴 패턴이 바뀌었습니다. 다시 분석해 주세요.', 'neutral');
    }
  }

  function syncTurnNumberInputsFromState() {
    const startInput = document.getElementById(ID.turnStartNumber);
    const expectedEndInput = document.getElementById(ID.turnExpectedEnd);

    if (startInput && state.turn.startNumber !== null) {
      startInput.value = String(state.turn.startNumber);
    }

    if (expectedEndInput) {
      expectedEndInput.value =
        state.turn.expectedEnd === null || state.turn.expectedEnd === undefined
          ? ''
          : String(state.turn.expectedEnd);
    }
  }

  function candidateDisplayNumber(candidate) {
    if (!candidate) return '?';

    if (candidate.selectedOccurrence >= 0) {
      return candidate.occurrences[candidate.selectedOccurrence]?.number ?? '?';
    }

    if (candidate.occurrences.length === 1) {
      return candidate.occurrences[0]?.number ?? '?';
    }

    return candidate.occurrences.map(item => item.number).join(' / ');
  }

  function renderTurnRange() {
    const el = document.getElementById(ID.turnRange);
    if (!el) return;

    const start = getTurnCandidateById(state.turn.startCandidateId);
    const end = getTurnCandidateById(state.turn.endCandidateId);

    if (!start || !end) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }

    const plan = state.turn.plan;
    const countLabel = plan
      ? `턴 ${plan.counted.length.toLocaleString()}개 · 제외 ${plan.excluded.length.toLocaleString()}`
      : '구간';

    el.hidden = false;
    el.innerHTML = `
      <div class="lynn-cbe-end">
        <div class="k">시작</div>
        <div class="v">#${(start.messageIndex + 1).toLocaleString()} · ${escapeHtml(candidateDisplayNumber(start))}</div>
        <span class="s">${escapeHtml(compactText(start.content, 90))}</span>
      </div>
      <div class="lynn-cbe-line"><span>${escapeHtml(countLabel)}</span></div>
      <div class="lynn-cbe-end right">
        <div class="k">끝</div>
        <div class="v">#${(end.messageIndex + 1).toLocaleString()} · ${escapeHtml(candidateDisplayNumber(end))}</div>
        <span class="s">${escapeHtml(compactText(end.content, 90))}</span>
      </div>
    `;
  }

  function renderTurnSummary() {
    const el = document.getElementById(ID.turnSummary);
    const verify = document.getElementById(ID.turnVerify);
    const line = document.getElementById('lynn-cbe-check-line');
    if (!el) return;

    const plan = computeTurnPlan();

    if (!plan) {
      el.textContent = '시작점 · 끝점 · 시작 번호를 확인해 주세요.';
      if (verify) verify.textContent = '';
      if (line) {
        line.hidden = !state.turn.analyzed;
        line.className = 'lynn-cbe-check off';
      }
      syncApplyButtons();
      return;
    }

    const reviewNote = plan.review.length
      ? ` · 검토 필요 ${plan.review.length.toLocaleString()}개는 빠짐`
      : '';

    el.innerHTML =
      `${plan.startNumber.toLocaleString()} → ${plan.lastTurn === null ? '-' : plan.lastTurn.toLocaleString()} 로 다시 매김 · ` +
      `<b>${plan.patches.length.toLocaleString()}개</b> 수정${escapeHtml(reviewNote)}`;

    if (line) {
      line.hidden = false;
      line.className = plan.review.length ? 'lynn-cbe-check off' : 'lynn-cbe-check';
    }

    if (verify) {
      if (plan.expectedEnd === null) {
        verify.textContent = '';
      } else if (plan.endDelta === 0) {
        verify.textContent = '일치 ✓';
      } else {
        const sign = plan.endDelta > 0 ? '+' : '';
        verify.textContent = `차이 ${sign}${plan.endDelta}`;
      }
    }

    syncApplyButtons();
  }

  function getTurnFilterValues() {
    return {
      query: (document.getElementById(ID.turnFilter)?.value ?? '').trim().toLowerCase(),
      onlyReview: !!document.getElementById(ID.turnOnlyReview)?.checked,
    };
  }

  function candidateMatchesFilter(candidate, filter) {
    if (filter.onlyReview && candidate.mode !== 'review' && !candidate.ambiguous) {
      return false;
    }

    if (!filter.query) return true;

    const nums = candidate.occurrences.map(item => String(item.number)).join(' ');
    const haystack = [
      candidate.id,
      candidate.role,
      nums,
      candidate.content,
      candidate.mode,
    ].join('\n').toLowerCase();

    return haystack.includes(filter.query);
  }

  function getFilteredTurnCandidates() {
    const filter = getTurnFilterValues();
    return state.turn.candidates.filter(item => candidateMatchesFilter(item, filter));
  }

  function renderOccurrenceChooser(candidate) {
    if (candidate.occurrences.length <= 1) return '';

    return `
      <div class="lynn-cbe-occurrences">
        <strong>이 메시지에서 패턴 ${candidate.occurrences.length}개 발견 · 실제 턴 번호를 선택</strong>
        <div>
          ${candidate.occurrences.map((occ, index) => `
            <button
              type="button"
              class="lynn-cbe-mini-btn ${candidate.selectedOccurrence === index ? 'selected' : ''}"
              data-turn-occurrence="${index}"
              data-turn-id="${escapeHtml(candidate.id)}"
            >${index + 1}. ${escapeHtml(occ.full)} → ${occ.number}</button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderTurnCandidates() {
    const el = document.getElementById(ID.turnCandidateList);
    const tools = document.querySelector('[data-lynn-cbe-turn-tools]');
    if (!el) return;

    if (tools) tools.hidden = !state.turn.analyzed;

    if (!state.turn.analyzed) {
      el.innerHTML = `
        <div class="lynn-cbe-empty">
          <strong>턴 번호를 다시 매깁니다</strong>
          숫자 자리에 {N}을 넣은 패턴을 입력하고 분석을 눌러 주세요.
        </div>`;
      return;
    }

    const filtered = getFilteredTurnCandidates();

    if (!filtered.length) {
      el.innerHTML = `
        <div class="lynn-cbe-empty">
          <strong>맞는 후보가 없습니다</strong>
          검색어를 지우거나 필터를 꺼 보세요.
        </div>`;
      return;
    }

    const planRows = new Map((state.turn.plan?.rows || []).map(row => [row.id, row]));

    const html = filtered.map(candidate => {
      const isStart = candidate.id === state.turn.startCandidateId;
      const isEnd = candidate.id === state.turn.endCandidateId;
      const row = planRows.get(candidate.id);
      const excluded = candidate.mode === 'exclude';

      let move = '';
      if (excluded) {
        move = '<span class="lynn-cbe-move same">제외됨</span>';
      } else if (candidate.mode === 'review') {
        move = '<span class="lynn-cbe-move changed">검토 필요</span>';
      } else if (row) {
        move = `<span class="lynn-cbe-move ${row.changed ? 'changed' : 'same'}">${row.currentNumber} → ${row.expectedNumber}</span>`;
      }

      const statusClass = excluded ? 'excluded' : (candidate.mode === 'review' ? 'review' : '');

      return `
        <article class="lynn-cbe-turn-item ${statusClass} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''}">
          <span class="lynn-cbe-idx">#${(candidate.messageIndex + 1).toLocaleString()}</span>
          <span class="lynn-cbe-text">${escapeHtml(compactText(candidate.content, 160))}</span>
          ${move}
          <span class="lynn-cbe-item-actions">
            <button type="button" class="lynn-cbe-mini-btn" data-turn-start="${escapeHtml(candidate.id)}" title="여기를 시작점으로">시작</button>
            <button type="button" class="lynn-cbe-mini-btn" data-turn-end="${escapeHtml(candidate.id)}" title="여기를 끝점으로">끝</button>
            ${
              excluded
                ? `<button type="button" class="lynn-cbe-mini-btn" data-turn-include="${escapeHtml(candidate.id)}" title="다시 포함">＋</button>`
                : `<button type="button" class="lynn-cbe-mini-btn danger-lite" data-turn-exclude="${escapeHtml(candidate.id)}" title="턴에서 제외">✕</button>`
            }
          </span>
          ${renderOccurrenceChooser(candidate)}
        </article>
      `;
    }).join('');

    el.innerHTML = html;
  }

  function recomputeAndRenderTurn() {
    if (!state.turn.analyzed) return;
    renderTurnRange();
    renderTurnSummary();
    renderTurnCandidates();
  }

  function setTurnCandidateMode(id, mode) {
    const candidate = getTurnCandidateById(id);
    if (!candidate) return;

    if (mode === 'include') {
      if (candidate.selectedOccurrence < 0) {
        if (candidate.occurrences.length === 1) {
          candidate.selectedOccurrence = 0;
        } else {
          candidate.mode = 'review';
          setStatus('패턴이 여러 개라 실제 턴 번호를 먼저 선택해 주세요.', 'warn');
          recomputeAndRenderTurn();
          return;
        }
      }
      candidate.mode = 'include';
    } else if (mode === 'exclude') {
      candidate.mode = 'exclude';
    }

    recomputeAndRenderTurn();
  }

  function chooseTurnOccurrence(id, occurrenceIndex) {
    const candidate = getTurnCandidateById(id);
    if (!candidate) return;

    if (!candidate.occurrences[occurrenceIndex]) return;

    candidate.selectedOccurrence = occurrenceIndex;
    candidate.mode = 'include';

    if (candidate.id === state.turn.startCandidateId) {
      const occurrence = candidate.occurrences[occurrenceIndex];
      if (occurrence && state.turn.startNumber === null) {
        state.turn.startNumber = occurrence.number;
        syncTurnNumberInputsFromState();
      }
    }

    recomputeAndRenderTurn();
  }

  function setTurnStartAnchor(id) {
    const pos = getTurnCandidatePosition(id);
    if (pos < 0) return;

    const endPos = getTurnCandidatePosition(state.turn.endCandidateId);
    if (endPos >= 0 && pos > endPos) {
      state.turn.endCandidateId = id;
    }

    state.turn.startCandidateId = id;

    const candidate = getTurnCandidateById(id);
    if (candidate && candidate.selectedOccurrence >= 0) {
      const occurrence = candidate.occurrences[candidate.selectedOccurrence];
      if (occurrence) {
        state.turn.startNumber = occurrence.number;
        syncTurnNumberInputsFromState();
      }
    }

    recomputeAndRenderTurn();
  }

  function setTurnEndAnchor(id) {
    const pos = getTurnCandidatePosition(id);
    if (pos < 0) return;

    const startPos = getTurnCandidatePosition(state.turn.startCandidateId);
    if (startPos >= 0 && pos < startPos) {
      state.turn.startCandidateId = id;
    }

    state.turn.endCandidateId = id;
    recomputeAndRenderTurn();
  }

  function handleBulkTurnCandidateMode(mode) {
    if (!state.turn.analyzed) return;

    const filtered = getFilteredTurnCandidates();
    if (!filtered.length) return;

    const ok = confirm(
      `현재 검색 결과 ${filtered.length.toLocaleString()}개를 모두 ` +
      `${mode === 'exclude' ? '턴 카운터에서 제외' : '카운트 포함'}할까요?`
    );

    if (!ok) return;

    for (const candidate of filtered) {
      if (mode === 'exclude') {
        candidate.mode = 'exclude';
      } else {
        if (candidate.selectedOccurrence >= 0 || candidate.occurrences.length === 1) {
          if (candidate.selectedOccurrence < 0) candidate.selectedOccurrence = 0;
          candidate.mode = 'include';
        }
      }
    }

    recomputeAndRenderTurn();
  }

  async function handleTurnAnalyze() {
    if (state.loading || state.patching) return;

    const chatId = parseChatId();
    if (!chatId) {
      setStatus('크랙 채팅방 안에서 실행해 주세요.', 'error');
      return;
    }

    const patternText = (document.getElementById(ID.turnPattern)?.value ?? '').trim();
    const target = 'assistant';

    if (!patternText) {
      setStatus('턴 패턴을 입력해 주세요. 예: **[{N}]**', 'error');
      document.getElementById(ID.turnPattern)?.focus();
      return;
    }

    try {
      parseTurnPattern(patternText);
    } catch (error) {
      setStatus(error.message || String(error), 'error');
      return;
    }

    state.loading = true;
    state.cancelling = false;
    state.logLines = [];
    setBusyUi(true);
    appendLog(`턴 번호 분석 시작 · 패턴=${patternText}`);

    try {
      const loaded = await ensureMessagesLoaded(chatId);
      const built = buildTurnCandidates(loaded.messages, patternText, target);

      state.turn.candidates = built.candidates;
      state.turn.patternText = patternText;
      state.turn.target = target;
      state.turn.expectedEnd = null;
      state.turn.analyzed = true;
      state.turn.skippedRerolls = built.skippedRerolls || 0;

      const defaults = inferDefaultTurnAnchors(built.candidates);
      state.turn.startCandidateId = defaults.startCandidateId;
      state.turn.endCandidateId = defaults.endCandidateId;
      state.turn.startNumber = defaults.startNumber;

      syncTurnNumberInputsFromState();

      const ambiguousCount = built.candidates.filter(item => item.ambiguous).length;

      if (!built.candidates.length) {
        state.turn.plan = null;
        renderTurnRange();
        renderTurnSummary();
        renderTurnCandidates();
        setStatus('해당 패턴을 가진 메시지를 찾지 못했습니다.', 'neutral');
      } else {
        recomputeAndRenderTurn();
        setStatus(
          formatTurnAnalyzeStatus(built.candidates.length, ambiguousCount, state.turn.skippedRerolls),
          ambiguousCount ? 'warn' : 'ok'
        );
      }

      appendLog(
        `턴 분석 완료 · 후보 ${built.candidates.length.toLocaleString()}개 · 제외한 리롤 ${state.turn.skippedRerolls.toLocaleString()}개 · 다중 패턴 ${ambiguousCount.toLocaleString()}개`
      );
    } catch (error) {
      const cancelled = state.cancelling || /취소/.test(String(error?.message || ''));
      setStatus(
        cancelled ? '분석을 취소했습니다.' : `분석 실패: ${error.message || error}`,
        cancelled ? 'neutral' : 'error'
      );
      appendLog(cancelled ? '분석 취소' : `분석 실패 · ${error.message || error}`);
    } finally {
      state.loading = false;
      state.cancelling = false;
      setBusyUi(false);
    }
  }

  function handleTurnStartNumberInput() {
    if (!state.turn.analyzed) return;

    const raw = document.getElementById(ID.turnStartNumber)?.value ?? '';
    const parsed = Number.parseInt(raw, 10);
    state.turn.startNumber = Number.isFinite(parsed) ? parsed : null;
    recomputeAndRenderTurn();
  }

  function handleTurnExpectedEndInput() {
    if (!state.turn.analyzed) return;

    const raw = document.getElementById(ID.turnExpectedEnd)?.value ?? '';
    const parsed = Number.parseInt(raw, 10);
    state.turn.expectedEnd = raw.trim() && Number.isFinite(parsed) ? parsed : null;
    recomputeAndRenderTurn();
  }

  function handleTurnCandidateListClick(event) {
    const target = event.target.closest('button');
    if (!target) return;

    const startId = target.dataset.turnStart;
    const endId = target.dataset.turnEnd;
    const excludeId = target.dataset.turnExclude;
    const includeId = target.dataset.turnInclude;
    const occurrenceId = target.dataset.turnId;
    const occurrenceIndex = target.dataset.turnOccurrence;

    if (startId) {
      setTurnStartAnchor(startId);
      return;
    }

    if (endId) {
      setTurnEndAnchor(endId);
      return;
    }

    if (excludeId) {
      setTurnCandidateMode(excludeId, 'exclude');
      return;
    }

    if (includeId) {
      setTurnCandidateMode(includeId, 'include');
      return;
    }

    if (occurrenceId && occurrenceIndex !== undefined) {
      chooseTurnOccurrence(occurrenceId, Number(occurrenceIndex));
    }
  }

  function handleTurnFirstAnchor() {
    const first = state.turn.candidates.find(isTurnCandidateCounted);
    if (first) setTurnStartAnchor(first.id);
  }

  function handleTurnLatestAnchor() {
    const valid = state.turn.candidates.filter(isTurnCandidateCounted);
    const last = valid[valid.length - 1];
    if (last) setTurnEndAnchor(last.id);
  }

  async function handleTurnApply() {
    if (state.loading || state.patching || !state.turn.analyzed) return;

    const plan = computeTurnPlan();
    if (!plan || !plan.patches.length) {
      setStatus('실제로 수정할 턴 번호가 없습니다.', 'neutral');
      return;
    }

    if (plan.review.length) {
      const proceed = confirm(
        `범위 안에 “검토 필요” 후보가 ${plan.review.length.toLocaleString()}개 남아 있습니다.\n` +
        `이 메시지들은 현재 턴 카운터에서 제외된 상태입니다.\n\n` +
        `그래도 현재 계산대로 진행할까요?`
      );
      if (!proceed) return;
    }

    const chatId = parseChatId();
    if (!chatId || chatId !== state.loadedChatId) {
      setStatus('분석한 채팅방과 현재 채팅방이 다릅니다. 다시 분석해 주세요.', 'error');
      return;
    }

    const checkText =
      `턴 번호를 재배치할까요?\n\n` +
      `시작 턴: ${plan.startNumber}\n` +
      `마지막 턴: ${plan.lastTurn}\n` +
      `실제 카운트: ${plan.counted.length.toLocaleString()}개\n` +
      `턴 제외: ${plan.excluded.length.toLocaleString()}개\n` +
      `실제 PATCH: ${plan.patches.length.toLocaleString()}개\n\n` +
      `기존 번호와 이미 같은 메시지는 수정하지 않습니다.`;

    if (!confirm(checkText)) return;

    await runPatchItems({
      chatId,
      items: plan.patches,
      label: '턴 재번호',
      onFinish: () => {
        state.loadedChatId = '';
        state.messages = [];
        resetRepeatScan();
        resetRerollScan();
        state.turn.plan = null;
        state.turn.analyzed = false;
        syncApplyButtons();
      },
    });
  }

  async function runPatchItems({ chatId, items, label, onFinish }) {
    state.patching = true;
    state.cancelling = false;
    setBusyUi(true);

    let success = 0;
    let failed = 0;
    const failures = [];

    appendLog(`${label} 시작 · ${items.length.toLocaleString()}개`);

    for (let i = 0; i < items.length; i++) {
      if (state.cancelling) {
        appendLog(`사용자 취소 · ${success.toLocaleString()}개 성공 후 중단`);
        break;
      }

      const item = items[i];

      setStatus(
        `${label} 중 ${i + 1} / ${items.length} · 성공 ${success} · 실패 ${failed}`,
        'busy'
      );
      setProgress(i + 1, items.length);

      try {
        await patchMessage(chatId, item.id, item.after);
        success += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          id: item.id,
          role: item.role,
          status: error?.status ?? null,
          error: String(error?.message || error),
        });

        appendLog(
          `실패 ${i + 1}/${items.length} · ${roleLabel(item.role)} · ${item.id} · ${error.message || error}`
        );
      }

      if (i < items.length - 1) {
        await sleep(APP.patchDelayMs);
      }
    }

    const wasCancelled = state.cancelling;

    state.patching = false;
    state.cancelling = false;
    setBusyUi(false);

    if (failed) {
      console.warn(`[Lynn] ${label} failures:`, failures);
    }

    if (wasCancelled) {
      setStatus(
        `${label} 중단 · 성공 ${success.toLocaleString()} · 실패 ${failed.toLocaleString()}`,
        'neutral'
      );
    } else if (failed) {
      setStatus(
        `${label} 완료 · 성공 ${success.toLocaleString()} · 실패 ${failed.toLocaleString()} · 작업 로그/콘솔을 확인하세요.`,
        'warn'
      );
    } else {
      setStatus(
        `${label} 완료 · ${success.toLocaleString()}개 메시지를 수정했습니다. 새로고침하면 화면에도 반영됩니다.`,
        'ok'
      );
    }

    appendLog(`${label} 종료 · 성공 ${success.toLocaleString()} · 실패 ${failed.toLocaleString()}`);

    if (typeof onFinish === 'function') onFinish();
    syncApplyButtons();
  }

  function handleCancel() {
    if (!state.loading && !state.patching) return;
    state.cancelling = true;
    setStatus('현재 요청이 끝나는 지점에서 중단합니다…', 'neutral');
    appendLog('중단 요청');
  }

  function repeatStatusText(groups, skippedRerolls) {
    const copies = groups.reduce((sum, group) => sum + group.hits.length - 1, 0);
    let text = groups.length
      ? `같은 AI 메시지 ${groups.length.toLocaleString()}묶음을 찾았습니다. ${copies.toLocaleString()}개가 앞 메시지와 같습니다.`
      : '같은 AI 메시지가 없습니다.';
    if (skippedRerolls) {
      text += ` · 화면에서 빠진 리롤 ${skippedRerolls.toLocaleString()}개는 제외했습니다.`;
    }
    return text;
  }

  function renderRepeatGroups(groups) {
    const preview = document.getElementById(ID.repeatList);
    if (!preview) return;

    if (!groups.length) {
      preview.innerHTML = `
        <div class="lynn-cbe-empty">
          <strong>같은 AI 메시지가 없습니다</strong>
          화면에 남아 있는 AI 메시지 중 본문이 똑같은 것은 없습니다.
        </div>`;
      return;
    }

    const visible = groups.slice(0, APP.maxReplacePreviewItems);
    const html = visible.map((group, order) => {
      const indexes = group.hits
        .map((hit) => `#${(hit.index + 1).toLocaleString()}`)
        .join(' · ');
      return `
        <article class="lynn-cbe-preview-item ${order === 0 ? '' : 'collapsed'}">
          <header>
            <span class="lynn-cbe-role ai">AI</span>
            <b>${group.hits.length.toLocaleString()}회</b>
            <span class="lynn-cbe-num lynn-cbe-repeat-hits">${escapeHtml(indexes)}</span>
            <span class="lynn-cbe-caret">⌄</span>
          </header>
          <div class="lynn-cbe-diff">
            <section class="lynn-cbe-repeat-body"><pre>${escapeHtml(group.content)}</pre></section>
          </div>
        </article>
      `;
    }).join('');

    const more = groups.length > visible.length
      ? `<div class="lynn-cbe-more">${visible.length.toLocaleString()}묶음만 보여줍니다. 같은 메시지는 모두 ${groups.length.toLocaleString()}묶음입니다.</div>`
      : '';

    preview.innerHTML = html + more;
  }

  function resetRepeatScan() {
    state.repeat.groups = [];
    state.repeat.scanned = false;
    state.repeat.skippedRerolls = 0;

    const preview = document.getElementById(ID.repeatList);
    if (!preview) return;
    preview.innerHTML = `
      <div class="lynn-cbe-empty">
        <strong>같은 AI 메시지를 찾습니다</strong>
        화면에 남아 있는 AI 메시지 중 본문이 완전히 같은 것을 검사합니다.
      </div>`;
  }

  async function handleRepeatScan() {
    if (state.loading || state.patching) return;

    const chatId = parseChatId();
    if (!chatId) {
      setStatus('크랙 채팅방 안에서 실행해 주세요.', 'error');
      return;
    }

    state.loading = true;
    state.cancelling = false;
    state.logLines = [];
    resetRepeatScan();
    setBusyUi(true);
    appendLog(`반복 검사 시작 · chatId=${chatId}`);

    try {
      const loaded = await ensureMessagesLoaded(chatId);
      const result = findExactAssistantRepeats(loaded.messages);
      state.repeat.groups = result.groups;
      state.repeat.skippedRerolls = result.skippedRerolls;
      state.repeat.scanned = true;
      renderRepeatGroups(result.groups);
      const text = repeatStatusText(result.groups, result.skippedRerolls);
      setStatus(text, result.groups.length ? 'warn' : 'ok');
      appendLog(text);
    } catch (error) {
      const cancelled = state.cancelling || /취소/.test(String(error?.message || ''));
      setStatus(
        cancelled ? '검사를 취소했습니다.' : `검사 실패: ${error.message || error}`,
        cancelled ? 'neutral' : 'error'
      );
      appendLog(cancelled ? '검사 취소' : `검사 실패 · ${error.message || error}`);
    } finally {
      state.loading = false;
      state.cancelling = false;
      setBusyUi(false);
    }
  }

  function getIncludedRerollItems() {
    return state.reroll.items.filter(item => !item.excluded);
  }

  function rerollStatusText(items) {
    const included = items.filter(item => !item.excluded);
    const unseen = included.filter(item => item.unseen).length;
    if (!items.length) return '화면에 없는 리롤이 없습니다.';
    if (!included.length) return '고른 리롤을 모두 빼서, 삭제할 항목이 없습니다.';
    let text = `화면에 없는 리롤 ${included.length.toLocaleString()}개를 삭제할 수 있습니다.`;
    const excluded = items.length - included.length;
    if (excluded) text += ` · ${excluded.toLocaleString()}개는 제외`;
    if (unseen) {
      text += ` · ${unseen.toLocaleString()}개는 지금 화면 밖이라 같은 묶음의 마지막 답을 남깁니다.`;
    }
    return text;
  }

  function renderRerollItems(items = state.reroll.items) {
    const preview = document.getElementById(ID.rerollList);
    if (!preview) return;

    if (!items.length) {
      preview.innerHTML = `
        <div class="lynn-cbe-empty">
          <strong>지울 리롤이 없습니다</strong>
          같은 답의 다른 버전 중, 지금 화면에 없는 것은 없습니다.
        </div>`;
      return;
    }

    const visible = items.slice(0, APP.maxReplacePreviewItems);
    const openIndexes = new Set(
      [...preview.querySelectorAll('.lynn-cbe-preview-item:not(.collapsed)')]
        .map(el => el.getAttribute('data-reroll-index'))
    );
    const keepOpenState = preview.querySelector('.lynn-cbe-preview-item');
    const html = visible.map((item, order) => {
      const action = item.excluded
        ? `<button type="button" class="lynn-cbe-mini-btn" data-reroll-include="${item.index}" title="다시 포함">＋</button>`
        : `<button type="button" class="lynn-cbe-mini-btn danger-lite" data-reroll-exclude="${item.index}" title="이 리롤은 지우지 않기">✕</button>`;
      const collapsed = keepOpenState
        ? !openIndexes.has(String(item.index))
        : order !== 0;
      return `
        <article class="lynn-cbe-preview-item ${item.excluded ? 'excluded' : ''} ${collapsed ? 'collapsed' : ''}" data-reroll-index="${item.index}">
          <header>
            <span class="lynn-cbe-role ai">AI</span>
            <b>#${(item.index + 1).toLocaleString()}</b>
            <span class="lynn-cbe-num">${item.excluded ? '제외됨' : item.unseen ? '화면 밖' : '리롤'}</span>
            <time>${escapeHtml(formatDate(item.createdAt))}</time>
            ${action}
            <span class="lynn-cbe-caret">⌄</span>
          </header>
          <div class="lynn-cbe-diff">
            <section class="lynn-cbe-repeat-body"><pre>${escapeHtml(item.before)}</pre></section>
          </div>
        </article>
      `;
    }).join('');

    const hiddenIncluded = items.slice(visible.length).filter(item => !item.excluded).length;
    const more = items.length > visible.length
      ? `<div class="lynn-cbe-more">${visible.length.toLocaleString()}개만 미리 보여줍니다. 목록에 없는 ${hiddenIncluded.toLocaleString()}개도 함께 삭제됩니다.</div>`
      : '';

    preview.innerHTML = html + more;
  }

  function resetRerollScan() {
    state.reroll.items = [];
    state.reroll.scanned = false;

    const preview = document.getElementById(ID.rerollList);
    if (!preview) return;
    preview.innerHTML = `
      <div class="lynn-cbe-empty">
        <strong>화면에 없는 리롤을 지웁니다</strong>
        로그에는 남아 있지만 지금 보이지 않는 AI 답변을 찾아 서버에서 삭제합니다.
      </div>`;
  }

  function setRerollItemExcluded(index, excluded) {
    const item = state.reroll.items.find(entry => entry.index === index);
    if (!item || item.excluded === excluded) return;
    item.excluded = excluded;
    renderRerollItems();
    setStatus(rerollStatusText(state.reroll.items), getIncludedRerollItems().length ? 'warn' : 'neutral');
    syncApplyButtons();
  }

  async function handleRerollScan() {
    if (state.loading || state.patching) return;

    const chatId = parseChatId();
    if (!chatId) {
      setStatus('크랙 채팅방 안에서 실행해 주세요.', 'error');
      return;
    }

    state.loading = true;
    state.cancelling = false;
    state.logLines = [];
    resetRerollScan();
    setBusyUi(true);
    appendLog(`빠진 리롤 검사 시작 · chatId=${chatId}`);

    try {
      const loaded = await ensureMessagesLoaded(chatId);
      const items = collectDiscardedRerolls(loaded.messages);
      state.reroll.items = items;
      state.reroll.scanned = true;
      renderRerollItems(items);
      const text = rerollStatusText(items);
      setStatus(text, items.length ? 'warn' : 'ok');
      appendLog(text);
    } catch (error) {
      const cancelled = state.cancelling || /취소/.test(String(error?.message || ''));
      setStatus(
        cancelled ? '검사를 취소했습니다.' : `검사 실패: ${error.message || error}`,
        cancelled ? 'neutral' : 'error'
      );
      appendLog(cancelled ? '검사 취소' : `검사 실패 · ${error.message || error}`);
    } finally {
      state.loading = false;
      state.cancelling = false;
      setBusyUi(false);
    }
  }

  async function runDeleteItems({ chatId, items, label, onFinish }) {
    state.patching = true;
    state.cancelling = false;
    setBusyUi(true);

    let success = 0;
    let failed = 0;
    const failures = [];
    const successIds = [];

    appendLog(`${label} 시작 · ${items.length.toLocaleString()}개`);

    for (let i = 0; i < items.length; i++) {
      if (state.cancelling) {
        appendLog(`사용자 취소 · ${success.toLocaleString()}개 성공 후 중단`);
        break;
      }

      const item = items[i];

      setStatus(
        `${label} 중 ${i + 1} / ${items.length} · 성공 ${success} · 실패 ${failed}`,
        'busy'
      );
      setProgress(i + 1, items.length);

      try {
        await deleteMessage(chatId, item.id);
        success += 1;
        successIds.push(item.id);
      } catch (error) {
        failed += 1;
        failures.push({
          id: item.id,
          role: item.role,
          status: error?.status ?? null,
          error: String(error?.message || error),
        });

        appendLog(
          `실패 ${i + 1}/${items.length} · ${roleLabel(item.role)} · ${item.id} · ${error.message || error}`
        );
      }

      if (i < items.length - 1) {
        await sleep(APP.patchDelayMs);
      }
    }

    const wasCancelled = state.cancelling;

    state.patching = false;
    state.cancelling = false;
    setBusyUi(false);

    if (failed) {
      console.warn(`[Lynn] ${label} failures:`, failures);
    }

    if (wasCancelled) {
      setStatus(
        `${label} 중단 · 성공 ${success.toLocaleString()} · 실패 ${failed.toLocaleString()} · 삭제한 메시지는 되돌릴 수 없습니다.`,
        'neutral'
      );
    } else if (failed) {
      setStatus(
        `${label} 완료 · 성공 ${success.toLocaleString()} · 실패 ${failed.toLocaleString()} · 작업 로그를 확인하세요.`,
        'warn'
      );
    } else {
      setStatus(
        `${label} 완료 · ${success.toLocaleString()}개를 삭제했습니다. 화면에 보이던 답은 그대로입니다.`,
        'ok'
      );
    }

    appendLog(`${label} 종료 · 성공 ${success.toLocaleString()} · 실패 ${failed.toLocaleString()}`);

    if (typeof onFinish === 'function') onFinish({ successIds, failed, wasCancelled });
    syncApplyButtons();
  }

  async function handleRerollApply() {
    if (state.loading || state.patching || !state.reroll.scanned) return;

    const included = getIncludedRerollItems();
    if (!included.length) {
      setStatus('삭제할 리롤이 없습니다.', 'neutral');
      return;
    }

    const chatId = parseChatId();
    if (!chatId || chatId !== state.loadedChatId) {
      setStatus('검사한 채팅방과 현재 채팅방이 다릅니다. 다시 검사해 주세요.', 'error');
      return;
    }

    const unseen = included.filter(item => item.unseen).length;
    const ok = confirm(
      `화면에 없는 리롤 ${included.length.toLocaleString()}개를 서버에서 삭제할까요?\n\n` +
      `지금 화면에 보이는 답은 남습니다.\n` +
      (unseen
        ? `그중 ${unseen.toLocaleString()}개는 지금 화면 밖이라, 같은 묶음의 마지막 답만 남깁니다.\n`
        : '') +
      `\n삭제한 메시지는 되돌릴 수 없습니다.`
    );
    if (!ok) return;

    await runDeleteItems({
      chatId,
      items: included,
      label: '리롤 삭제',
      onFinish: ({ successIds }) => {
        const deleted = new Set(successIds);
        if (deleted.size) {
          state.messages = state.messages.filter(message => !deleted.has(getMessageId(message)));
        }
        state.reroll.items = state.reroll.items.filter(item => !deleted.has(item.id));
        state.reroll.scanned = true;
        renderRerollItems();
        resetReplaceScan();
        resetTurnAnalysis();
        resetRepeatScan();
      },
    });
  }

  function switchTab(tab) {
    const next = tab === 'turn' || tab === 'repeat' || tab === 'reroll' ? tab : 'replace';
    state.activeTab = next;

    document.getElementById(ID.tabReplace)?.classList.toggle('active', next === 'replace');
    document.getElementById(ID.tabTurn)?.classList.toggle('active', next === 'turn');
    document.getElementById(ID.tabRepeat)?.classList.toggle('active', next === 'repeat');
    document.getElementById(ID.tabReroll)?.classList.toggle('active', next === 'reroll');

    const replacePane = document.getElementById(ID.paneReplace);
    const turnPane = document.getElementById(ID.paneTurn);
    const repeatPane = document.getElementById(ID.paneRepeat);
    const rerollPane = document.getElementById(ID.paneReroll);
    if (replacePane) replacePane.hidden = next !== 'replace';
    if (turnPane) turnPane.hidden = next !== 'turn';
    if (repeatPane) repeatPane.hidden = next !== 'repeat';
    if (rerollPane) rerollPane.hidden = next !== 'reroll';

    const replaceApply = document.getElementById(ID.replaceApply);
    const turnApply = document.getElementById(ID.turnApply);
    const rerollApply = document.getElementById(ID.rerollApply);
    if (replaceApply) replaceApply.hidden = next !== 'replace';
    if (turnApply) turnApply.hidden = next !== 'turn';
    if (rerollApply) rerollApply.hidden = next !== 'reroll';

    const extra = document.getElementById(ID.statusExtra);
    if (next !== 'replace' && extra) extra.innerHTML = '';

    if (next === 'replace' && state.replace.matches.length) {
      refreshReplaceScanView();
    } else if (next === 'turn' && state.turn.analyzed) {
      const ambiguousCount = state.turn.candidates.filter(item => item.ambiguous).length;
      setStatus(
        formatTurnAnalyzeStatus(
          state.turn.candidates.length,
          ambiguousCount,
          state.turn.skippedRerolls || 0
        ),
        ambiguousCount ? 'warn' : 'ok'
      );
      renderTurnSummary();
    } else if (next === 'repeat' && state.repeat.scanned) {
      setStatus(
        repeatStatusText(state.repeat.groups, state.repeat.skippedRerolls),
        state.repeat.groups.length ? 'warn' : 'ok'
      );
    } else if (next === 'reroll' && state.reroll.scanned) {
      setStatus(
        rerollStatusText(state.reroll.items),
        getIncludedRerollItems().length ? 'warn' : 'ok'
      );
    } else {
      setStatus('');
    }
  }

  let cbeThemeObserver = null;
  let cbeThemeSyncTimer = 0;

  function detectCbeTheme() {
    const html = document.documentElement;
    const body = document.body;

    const directHints = [
      html.getAttribute('data-theme'),
      body?.getAttribute('data-theme'),
      html.getAttribute('data-cmu-theme'),
      body?.getAttribute('data-cmu-theme'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (/\bdark\b|theme-dark|dark-mode|color-scheme-dark/.test(directHints)) {
      return 'dark';
    }
    if (/\blight\b|theme-light|light-mode|color-scheme-light/.test(directHints)) {
      return 'light';
    }

    const structuralHints = [
      html.className,
      body?.className,
      html.style.colorScheme,
      body?.style?.colorScheme,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (/\bdark\b|theme-dark|dark-mode|color-scheme-dark/.test(structuralHints)) {
      return 'dark';
    }
    if (/\blight\b|theme-light|light-mode|color-scheme-light/.test(structuralHints)) {
      return 'light';
    }

    const parseRgb = value => {
      const m = String(value || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    };

    const luminance = rgb => {
      if (!rgb) return null;
      const [r, g, b] = rgb.map(v => v / 255);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    try {
      const samples = [
        getComputedStyle(body || html).backgroundColor,
        getComputedStyle(html).backgroundColor,
      ];

      for (const sample of samples) {
        const lum = luminance(parseRgb(sample));
        if (lum === null) continue;
        if (lum < 0.35) return 'dark';
        if (lum > 0.65) return 'light';
      }
    } catch (_) {}

    return 'dark';
  }

  function syncCbeTheme() {
    const theme = detectCbeTheme();
    const panel = document.getElementById(ID.panel);
    const overlay = document.getElementById(ID.overlay);

    if (panel) panel.dataset.cbeTheme = theme;
    if (overlay) overlay.dataset.cbeTheme = theme;
  }

  function scheduleCbeThemeSync(delay = 0) {
    clearTimeout(cbeThemeSyncTimer);
    cbeThemeSyncTimer = window.setTimeout(
      syncCbeTheme,
      Math.max(0, Number(delay) || 0)
    );
  }

  function ensureCbeThemeObserver() {
    if (cbeThemeObserver) return;

    const html = document.documentElement;
    const body = document.body;
    const targets = [html, body].filter(Boolean);

    cbeThemeObserver = new MutationObserver(() => {
      scheduleCbeThemeSync(0);
    });

    for (const target of targets) {
      cbeThemeObserver.observe(target, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-cmu-theme', 'class', 'style'],
      });
    }
  }

  function closePanel() {
    if (state.loading || state.patching) {
      const ok = confirm('작업 중입니다. 패널만 닫아도 작업은 계속됩니다. 닫을까요?');
      if (!ok) return;
    }

    const overlay = document.getElementById(ID.overlay);
    if (overlay) overlay.style.display = 'none';
  }

  function openPanel() {
    const chatId = parseChatId();

    if (!chatId) {
      alert('크랙 채팅방 안에서만 사용할 수 있습니다.');
      return;
    }

    ensureUi();
    syncCbeTheme();

    const overlay = document.getElementById(ID.overlay);
    if (overlay) overlay.style.display = 'flex';

    if (state.loadedChatId && state.loadedChatId !== chatId && !state.patching && !state.loading) {
      state.loadedChatId = '';
      state.messages = [];
      resetReplaceScan();
      resetTurnAnalysis();
      resetRepeatScan();
      resetRerollScan();
      state.logLines = [];
      const log = document.getElementById(ID.log);
      if (log) log.textContent = '';
    }

    switchTab(state.activeTab);
  }

  function injectStyles() {
    if (document.getElementById('lynn-cbe-style')) return;

    const style = document.createElement('style');
    style.id = 'lynn-cbe-style';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
      #${ID.launch}.lynn-cbe-native-toolbar-btn {
        pointer-events: auto !important; touch-action: manipulation !important;
        -webkit-tap-highlight-color: transparent;
      }
      #${ID.launch}.lynn-cbe-native-toolbar-btn .lynn-cbe-launch-icon {
        display: inline-flex !important; align-items: center !important; justify-content: center !important;
        width: 16px !important; height: 16px !important; line-height: 1 !important;
        font-size: 16px !important; font-weight: 700 !important;
        color: #f7c6dc !important;
        pointer-events: none !important; transform: translateY(-.25px);
      }
      :is(body, html)[data-theme="light"] #${ID.launch}.lynn-cbe-native-toolbar-btn .lynn-cbe-launch-icon {
        color: #d56b98 !important;
      }

      #${ID.overlay} {
        position: fixed; inset: 0; z-index: 2147483600;
        display: none; align-items: center; justify-content: center;
        padding: 16px; background: rgba(0,0,0,.62); box-sizing: border-box;
      }

      #${ID.panel} {
        --bg:#1c1c1e; --bg2:rgba(255,255,255,.08); --bg3:rgba(255,255,255,.05);
        --line:rgba(255,255,255,.12); --line2:rgba(255,255,255,.14);
        --fg:rgba(255,255,255,.92); --dim:rgba(255,255,255,.72); --dim2:rgba(255,255,255,.52);
        --pri:#f3b4cf; --pri-fg:rgba(255,255,255,.92);
        --ai:#f7c6dc; --ai-bg:rgba(243,180,207,.16);
        --user:#f7c6dc; --user-bg:rgba(243,180,207,.16);
        --ok:#f7c6dc; --ok-bg:rgba(243,180,207,.16);
        --warn:#f7c6dc; --warn-bg:rgba(243,180,207,.16);
        --del:#f7c6dc; --del-bg:rgba(243,180,207,.22); --ins-bg:rgba(243,180,207,.22);
        --busy:#f7c6dc; --busy-bg:rgba(243,180,207,.16);

        width: min(640px,100%); max-height: calc(100vh - 32px);
        display: flex; flex-direction: column; overflow: hidden;
        border-radius: 20px; background: var(--bg); color: var(--fg);
        border: 1px solid var(--line);
        box-shadow: 0 18px 46px rgba(0,0,0,.32);
        font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Pretendard",sans-serif;
        font-size: 13px;
      }

      #${ID.overlay}[data-lynn-cbe-theme="light"] {
        background: rgba(24,24,27,.32);
      }

      #${ID.panel}[data-lynn-cbe-theme="light"] {
        --bg:#ffffff; --bg2:rgba(243,180,207,.12); --bg3:rgba(243,180,207,.08);
        --line:rgba(229,154,184,.4); --line2:rgba(229,154,184,.55);
        --fg:rgba(17,24,39,.94); --dim:rgba(17,24,39,.62); --dim2:rgba(17,24,39,.42);
        --pri:#e59ab8; --pri-fg:#fff;
        --ai:#a85a78; --ai-bg:rgba(243,180,207,.22);
        --user:#a85a78; --user-bg:rgba(243,180,207,.22);
        --ok:#a85a78; --ok-bg:rgba(243,180,207,.28);
        --warn:#a85a78; --warn-bg:rgba(243,180,207,.28);
        --del:#a85a78; --del-bg:rgba(243,180,207,.28); --ins-bg:rgba(243,180,207,.36);
        --busy:#1d4ed8; --busy-bg:rgba(37,99,235,.1);
        box-shadow: 0 24px 70px rgba(0,0,0,.18);
        color-scheme: light;
      }

      #${ID.panel}[data-lynn-cbe-theme="dark"] {
        color-scheme: dark;
      }

      #${ID.panel} * { box-sizing: border-box; }
      #${ID.panel} button { font-family: inherit; cursor: pointer; }
      #${ID.panel} input, #${ID.panel} select { font-family: inherit; font-size: 13px; }
      #${ID.panel} pre {
        margin: 0;
        font: 12px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
        white-space: pre-wrap; overflow-wrap: anywhere;
      }
      #${ID.panel} mark {
        background: var(--del-bg); color: var(--del);
        padding: 0 2px; border-radius: 3px;
      }
      #${ID.panel} mark.g {
        background: var(--ins-bg); color: var(--ok); font-weight: 700;
      }
      #${ID.panel} del {
        background: var(--del-bg); color: var(--del);
        text-decoration: line-through; text-decoration-thickness: 1px;
        padding: 0 2px; border-radius: 3px;
      }
      #${ID.panel} ins {
        background: var(--ins-bg); color: var(--ok); text-decoration: none;
        padding: 0 2px; border-radius: 3px; font-weight: 700;
      }
      .lynn-cbe-num {
        min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }

      .lynn-cbe-head {
        display: flex; align-items: center; gap: 6px;
        padding: 12px 12px 12px 16px;
        border-bottom: 1px solid var(--line); flex: 0 0 auto;
      }
      .lynn-cbe-head strong {
        flex: 1; margin: 0;
        font-family: 'Jua', sans-serif;
        font-size: 24px; font-weight: 400; line-height: 1; letter-spacing: .01em;
        color: rgba(255,255,255,.94);
      }
      .lynn-cbe-heart { margin: 0 .16em; font-weight: 500; color: #f7c6dc; }
      #${ID.panel}[data-lynn-cbe-theme="light"] .lynn-cbe-head strong { color: rgba(17,24,39,.94); }
      #${ID.panel}[data-lynn-cbe-theme="light"] .lynn-cbe-heart { color: #e59ab8; }
      #${ID.panel}[data-lynn-cbe-theme="light"] .lynn-cbe-tab.active { color: #a85a78; }
      .lynn-cbe-icon {
        width: 30px; height: 30px; border-radius: 8px;
        border: 1px solid transparent; background: transparent;
        color: var(--dim); font-size: 14px; line-height: 1;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .lynn-cbe-icon:hover { background: var(--bg2); color: var(--fg); }
      .lynn-cbe-icon:disabled { opacity: .3; cursor: not-allowed; }

      .lynn-cbe-tabs {
        display: inline-flex; flex-wrap: wrap; background: var(--bg2);
        border: 1px solid var(--line2);
        border-radius: 14px; padding: 4px; margin: 12px 16px 0; flex: 0 0 auto;
        max-width: calc(100% - 32px);
      }
      .lynn-cbe-repeat-body { grid-column: 1 / -1; }
      .lynn-cbe-tab {
        height: 28px; padding: 0 14px; border: 0; border-radius: 7px;
        background: transparent; color: var(--dim);
        font-weight: 700; font-size: 12px;
      }
      .lynn-cbe-tab.active {
        background: rgba(243,180,207,.16); color: #f7c6dc;
        box-shadow: 0 0 12px rgba(243,180,207,.14);
      }
      .lynn-cbe-tab:disabled { opacity: .4; cursor: not-allowed; }

      .lynn-cbe-setup {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--bg2);
        padding: 12px;
      }

      .lynn-cbe-control-label {
        display: block;
        margin-bottom: 6px;
        color: var(--dim);
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: .04em;
      }

      .lynn-cbe-control-field { min-width: 0; }
      .lynn-cbe-control-field.grow { flex: 1; }

      .lynn-cbe-control-field input,
      .lynn-cbe-control-field select,
      .lynn-cbe-inline-select select {
        width: 100%;
        height: 36px;
        border: 1px solid var(--line2);
        border-radius: 9px;
        background: var(--bg);
        color: var(--fg);
        padding: 0 10px;
        outline: none;
      }

      .lynn-cbe-control-field input:focus,
      .lynn-cbe-control-field select:focus,
      .lynn-cbe-inline-select select:focus,
      .lynn-cbe-search:focus {
        border-color: color-mix(in srgb, var(--ai) 55%, var(--line2));
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--ai-bg) 70%, transparent);
      }

      .lynn-cbe-control-field input::placeholder { color: var(--dim2); }

      .lynn-cbe-replace-setup { display: grid; gap: 10px; }
      .lynn-cbe-replace-flow {
        display: grid;
        grid-template-columns: minmax(0,1fr) auto minmax(0,1fr);
        gap: 10px;
        align-items: end;
      }
      .lynn-cbe-flow-arrow {
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--dim2);
        font-size: 16px;
        padding-bottom: 1px;
      }
      .lynn-cbe-replace-meta {
        display: flex;
        align-items: end;
        gap: 10px;
      }
      .lynn-cbe-inline-select { width: 118px; }
      .lynn-cbe-inline-select .lynn-cbe-control-label { margin-bottom: 6px; }
      .lynn-cbe-inline-option {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        height: 36px;
        color: var(--dim);
        font-size: 11.5px;
        cursor: pointer;
        white-space: nowrap;
      }
      .lynn-cbe-inline-option input {
        accent-color: var(--ai);
        width: 13px;
        height: 13px;
      }
      .lynn-cbe-setup-spacer { flex: 1; }

      .lynn-cbe-turn-setup { display: grid; gap: 8px; }
      .lynn-cbe-turn-primary {
        display: flex;
        align-items: end;
        gap: 10px;
      }
      .lynn-cbe-turn-pattern input {
        font: 12.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      }
      .lynn-cbe-turn-start { width: 112px; flex: 0 0 112px; }
      .lynn-cbe-turn-hint {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 7px;
        color: var(--dim);
        font-size: 11px;
        line-height: 1.45;
      }
      .lynn-cbe-repeat-setup { display: grid; gap: 10px; }
      .lynn-cbe-repeat-hits { flex: 1; }
      .lynn-cbe-turn-hint code {
        padding: 1px 5px;
        border-radius: 5px;
        background: var(--bg3);
        color: var(--fg);
        font: 10.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      }

      .lynn-cbe-btn {
        height: 34px; padding: 0 16px; border-radius: 9px;
        border: 1px solid var(--line2); background: transparent;
        color: var(--fg); font-weight: 600; font-size: 12.5px;
      }
      .lynn-cbe-btn.primary {
        border: 0;
        background: linear-gradient(135deg,#f3b4cf,#f7c6dc);
        color: rgba(255,255,255,.92);
        box-shadow: 0 4px 14px rgba(243,180,207,.28);
        font-weight: 700;
      }
      .lynn-cbe-btn.danger {
        height: 30px; padding: 0 13px; border-radius: 8px;
        border: 1px solid var(--del-bg); background: var(--del-bg);
        color: var(--del); font-weight: 800; font-size: 12px;
      }
      .lynn-cbe-btn.small { height: 30px; padding: 0 12px; border-radius: 8px; font-size: 12px; }
      .lynn-cbe-btn:disabled { opacity: .38; cursor: not-allowed; }

      #${ID.status} {
        display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
        margin: 11px 16px 0; padding: 9px 12px;
        border-radius: 10px; font-size: 12.5px; line-height: 1.45;
        background: rgba(127,127,127,.12); flex: 0 0 auto;
      }
      #${ID.status}[hidden] { display: none; }
      #${ID.status}[data-type="ok"] { background: var(--ok-bg); }
      #${ID.status}[data-type="error"] { background: var(--del-bg); color: var(--del); }
      #${ID.status}[data-type="warn"] { background: var(--warn-bg); color: var(--warn); }
      #${ID.status}[data-type="busy"] { background: var(--busy-bg); color: var(--busy); }
      #${ID.statusText} { flex: 1; min-width: 120px; }
      #${ID.statusText} b { font-weight: 800; }
      #${ID.statusExtra} { display: inline-flex; gap: 6px; flex-wrap: wrap; }
      #${ID.statusActions} { display: inline-flex; gap: 6px; }

      .lynn-cbe-pill {
        font-size: 10.5px; font-weight: 800; padding: 2px 7px;
        border-radius: 999px; white-space: nowrap;
      }
      .lynn-cbe-pill.ai { background: var(--ai-bg); color: var(--ai); }
      .lynn-cbe-pill.user { background: var(--user-bg); color: var(--user); }
      .lynn-cbe-pill.warn { background: var(--warn-bg); color: var(--warn); }

      #${ID.progress} {
        height: 3px; border-radius: 99px; background: var(--bg3);
        margin: 9px 16px 0; overflow: hidden; flex: 0 0 auto;
      }
      #${ID.progress}[hidden] { display: none; }
      #${ID.progress} i {
        display: block; height: 100%; width: 0%;
        background: var(--busy); transition: width .2s ease;
      }

      .lynn-cbe-body {
        overflow-y: auto; overflow-x: hidden;
        padding: 12px 16px 16px;
        min-width: 0;
      }
      .lynn-cbe-pane[hidden] { display: none !important; }
      .lynn-cbe-pane { min-width: 0; }
      .lynn-cbe-setup + .lynn-cbe-preview-list,
      .lynn-cbe-setup + .lynn-cbe-range,
      .lynn-cbe-check + .lynn-cbe-tools { margin-top: 10px; }
      [data-lynn-cbe-turn-tools][hidden] { display: none !important; }

      .lynn-cbe-empty {
        padding: 32px 18px; border: 1px dashed var(--line2); border-radius: 12px;
        text-align: center; color: var(--dim); font-size: 12.5px; line-height: 1.7;
      }
      .lynn-cbe-empty strong {
        display: block; color: var(--fg); font-size: 13px;
        font-weight: 700; margin-bottom: 5px;
      }
      .lynn-cbe-more {
        margin-top: 7px; padding: 14px; border-radius: 10px;
        background: var(--bg2); color: var(--dim);
        text-align: center; font-size: 12px;
      }

      .lynn-cbe-preview-list {
        display: grid; gap: 7px;
        width: 100%; max-width: 100%; min-width: 0;
        overflow-x: hidden;
      }

      .lynn-cbe-preview-item {
        border: 1px solid var(--line); border-radius: 11px;
        background: var(--bg2); overflow: hidden;
      }
      .lynn-cbe-preview-item > header {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 11px; font-size: 11px; color: var(--dim); cursor: pointer;
      }
      .lynn-cbe-preview-item > header b { color: var(--fg); font-size: 11.5px; }
      .lynn-cbe-preview-item > header time { margin-left: auto; }
      .lynn-cbe-preview-item > header .lynn-cbe-caret { opacity: .5; }
      .lynn-cbe-preview-item.collapsed .lynn-cbe-diff { display: none; }
      .lynn-cbe-preview-item.excluded { opacity: .45; }
      .lynn-cbe-preview-item > header .lynn-cbe-mini-btn { flex: 0 0 auto; }

      .lynn-cbe-role {
        display: inline-flex; align-items: center; justify-content: center;
        height: 19px; padding: 0 7px; border-radius: 5px;
        font-size: 10px; font-weight: 800; letter-spacing: .04em;
      }
      .lynn-cbe-role.ai { background: var(--ai-bg); color: var(--ai); }
      .lynn-cbe-role.user { background: var(--user-bg); color: var(--user); }

      .lynn-cbe-diff {
        display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
        background: var(--line); border-top: 1px solid var(--line);
      }
      .lynn-cbe-diff > section { background: var(--bg); padding: 10px 11px; min-width: 0; }
      .lynn-cbe-diff .lynn-cbe-k {
        font-size: 10px; font-weight: 800; letter-spacing: .06em;
        color: var(--dim2); margin-bottom: 6px;
      }
      .lynn-cbe-diff pre { max-height: 150px; overflow: auto; }
      .lynn-cbe-diff textarea.lynn-cbe-after {
        display: block; width: 100%; min-height: 88px; max-height: 220px;
        box-sizing: border-box; margin: 0; padding: 8px; resize: vertical;
        border: 1px solid var(--line); border-radius: 8px;
        background: var(--bg); color: var(--fg);
        font: 12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
        white-space: pre-wrap;
      }
      .lynn-cbe-diff .d-inline { display: none; }

      .lynn-cbe-range {
        display: flex; align-items: center;
        margin-bottom: 9px; padding: 11px 14px; border-radius: 11px;
        background: var(--bg2); border: 1px solid var(--line);
      }
      .lynn-cbe-range .lynn-cbe-end { min-width: 0; }
      .lynn-cbe-range .lynn-cbe-end .k {
        font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--dim2);
      }
      .lynn-cbe-range .lynn-cbe-end .v {
        font-size: 14px; font-weight: 800; letter-spacing: -.02em; margin-top: 2px;
      }
      .lynn-cbe-range .lynn-cbe-end .s {
        display: block; font-size: 10.5px; color: var(--dim); margin-top: 2px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;
      }
      .lynn-cbe-range .lynn-cbe-line {
        flex: 1; height: 1px; background: var(--line2); margin: 0 14px; position: relative;
      }
      .lynn-cbe-range .lynn-cbe-line span {
        position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
        background: var(--bg2); padding: 0 8px;
        font-size: 10.5px; color: var(--dim); white-space: nowrap;
      }
      .lynn-cbe-range .lynn-cbe-end.right { text-align: right; }
      .lynn-cbe-range .lynn-cbe-end.right .s { margin-left: auto; }

      .lynn-cbe-check {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        margin-bottom: 12px; padding: 8px 13px; border-radius: 10px;
        background: var(--ok-bg); font-size: 12px; color: var(--ok); font-weight: 700;
      }
      .lynn-cbe-check.off { background: var(--bg2); color: var(--dim); }
      .lynn-cbe-check .lynn-cbe-spacer { flex: 1; }
      .lynn-cbe-check label {
        display: inline-flex; align-items: center; gap: 6px;
        font-weight: 600; opacity: .85;
      }
      .lynn-cbe-check input[type="number"] {
        width: 58px; height: 26px; border: 1px solid var(--line2); border-radius: 7px;
        background: var(--bg); color: var(--fg);
        text-align: center; outline: none; font-size: 12px;
      }

      .lynn-cbe-tools { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
      .lynn-cbe-tools .lynn-cbe-search {
        flex: 1; height: 32px; border: 1px solid var(--line2); border-radius: 9px;
        background: var(--bg2); color: var(--fg); padding: 0 11px; outline: none;
      }
      .lynn-cbe-tools .lynn-cbe-search::placeholder { color: var(--dim2); }
      .lynn-cbe-tools .lynn-cbe-toggle {
        display: inline-flex; align-items: center; gap: 6px;
        height: 32px; padding: 0 11px; border-radius: 9px;
        border: 1px solid var(--line2); background: transparent;
        color: var(--dim); font-size: 11.5px; font-weight: 700; cursor: pointer;
      }
      .lynn-cbe-tools .lynn-cbe-toggle input { accent-color: var(--ai); }

      .lynn-cbe-menu { position: relative; }
      .lynn-cbe-menu > summary {
        list-style: none; width: 32px; height: 32px; border-radius: 9px;
        border: 1px solid var(--line2); color: var(--dim);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
      }
      .lynn-cbe-menu > summary::-webkit-details-marker { display: none; }
      .lynn-cbe-menu[open] > summary { background: var(--bg2); color: var(--fg); }
      .lynn-cbe-menu > div {
        position: absolute; right: 0; top: 38px; z-index: 5;
        display: grid; gap: 4px; padding: 6px; min-width: 168px;
        border: 1px solid var(--line2); border-radius: 10px;
        background: var(--bg); box-shadow: 0 12px 32px rgba(0,0,0,.35);
      }
      .lynn-cbe-menu > div button {
        height: 30px; padding: 0 10px; border: 0; border-radius: 7px;
        background: transparent; color: var(--fg);
        font-size: 12px; font-weight: 600; text-align: left;
      }
      .lynn-cbe-menu > div button:hover { background: var(--bg2); }

      .lynn-cbe-turn-item {
        display: flex; align-items: center; gap: 9px;
        width: 100%; max-width: 100%; min-width: 0;
        padding: 8px 10px; border: 1px solid var(--line);
        border-radius: 10px; background: var(--bg2);
        overflow: hidden;
      }
      .lynn-cbe-turn-item.is-start { box-shadow: inset 2px 0 0 var(--ai); }
      .lynn-cbe-turn-item.is-end { box-shadow: inset -2px 0 0 var(--user); }
      .lynn-cbe-turn-item.is-start.is-end { box-shadow: inset 2px 0 0 var(--ai), inset -2px 0 0 var(--user); }
      .lynn-cbe-turn-item.excluded { opacity: .45; }
      .lynn-cbe-turn-item.review { border-color: var(--warn-bg); flex-wrap: wrap; }
      .lynn-cbe-turn-item .lynn-cbe-idx {
        flex: 0 0 auto;
        font-size: 11px; color: var(--dim2); min-width: 42px;
      }
      .lynn-cbe-turn-item .lynn-cbe-text {
        flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        font: 11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; color: var(--dim);
      }
      .lynn-cbe-turn-item .lynn-cbe-move {
        flex: 0 0 auto;
        font-size: 11.5px; font-weight: 800; font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .lynn-cbe-turn-item .lynn-cbe-move.changed { color: var(--warn); }
      .lynn-cbe-turn-item .lynn-cbe-move.same { color: var(--dim2); }
      .lynn-cbe-turn-item .lynn-cbe-item-actions {
        display: none;
        flex: 0 0 auto;
        gap: 4px;
      }
      .lynn-cbe-turn-item:hover .lynn-cbe-item-actions,
      .lynn-cbe-turn-item:focus-within .lynn-cbe-item-actions {
        display: flex;
      }
      .lynn-cbe-mini-btn {
        height: 26px; padding: 0 8px; border-radius: 7px;
        border: 1px solid var(--line2); background: transparent; color: var(--dim);
        font-size: 11px; font-weight: 700;
      }
      .lynn-cbe-mini-btn:hover { background: var(--bg3); color: var(--fg); }
      .lynn-cbe-mini-btn.selected { background: var(--ai-bg); color: var(--ai); border-color: transparent; }
      .lynn-cbe-mini-btn.danger-lite:hover { background: var(--del-bg); color: var(--del); }
      .lynn-cbe-occurrences {
        flex: 1 0 100%; margin-top: 7px; padding: 8px;
        border-radius: 8px; background: var(--warn-bg);
      }
      .lynn-cbe-occurrences strong {
        display: block; font-size: 11px; margin-bottom: 6px; color: var(--warn);
      }
      .lynn-cbe-occurrences > div { display: flex; flex-wrap: wrap; gap: 5px; }

      .lynn-cbe-log-wrap { display: none; margin: 0 16px 14px; flex: 0 0 auto; }
      #${ID.panel}.show-log .lynn-cbe-log-wrap { display: block; }
      #${ID.log} {
        margin: 0; padding: 10px 11px; max-height: 150px; overflow: auto;
        border: 1px solid var(--line); border-radius: 10px;
        background: var(--bg2);
        font: 11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
        white-space: pre-wrap; overflow-wrap: anywhere;
      }

      @media (max-width: 820px) {
        #${ID.overlay} { padding: 8px; align-items: stretch; }
        #${ID.panel} { max-height: calc(100vh - 16px); border-radius: 14px; }
        .lynn-cbe-body { padding: 10px 12px 14px; }
        .lynn-cbe-tabs, #${ID.status}, #${ID.progress} { margin-left: 12px; margin-right: 12px; }
        .lynn-cbe-setup { padding: 10px; }
        .lynn-cbe-replace-flow { grid-template-columns: 1fr; gap: 8px; }
        .lynn-cbe-flow-arrow {
          height: 14px;
          justify-content: flex-start;
          padding-left: 10px;
          transform: rotate(90deg);
          transform-origin: 18px 7px;
        }
        .lynn-cbe-replace-meta { flex-wrap: wrap; align-items: center; }
        .lynn-cbe-inline-select { width: 112px; }
        .lynn-cbe-turn-primary { display: grid; grid-template-columns: 1fr 96px; }
        .lynn-cbe-turn-primary .lynn-cbe-btn { grid-column: 1 / -1; }
        .lynn-cbe-turn-start { width: auto; min-width: 0; }

        .lynn-cbe-diff { grid-template-columns: 1fr; }
        .lynn-cbe-diff .d-before { display: none; }
        .lynn-cbe-diff .d-after { display: block; }
        .lynn-cbe-diff .d-inline { display: block; }

        .lynn-cbe-range { flex-direction: column; align-items: stretch; gap: 8px; }
        .lynn-cbe-range .lynn-cbe-line { display: none; }
        .lynn-cbe-range .lynn-cbe-end.right { text-align: left; }
        .lynn-cbe-range .lynn-cbe-end .s { max-width: 100%; }

        .lynn-cbe-turn-item { flex-wrap: wrap; }
        .lynn-cbe-turn-item .lynn-cbe-text { flex-basis: 0; }
        .lynn-cbe-turn-item .lynn-cbe-item-actions {
          display: flex;
          flex: 1 0 100%;
          justify-content: flex-end;
          padding-top: 2px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureUi() {
    injectStyles();

    if (document.getElementById(ID.overlay)) return;

    const overlay = document.createElement('div');
    overlay.id = ID.overlay;

    overlay.innerHTML = `
      <div id="${ID.panel}" role="dialog" aria-modal="true" aria-label="로그 편집">
        <div class="lynn-cbe-head">
          <strong><span class="lynn-cbe-heart" aria-hidden="true">♥</span>로그 편집<span class="lynn-cbe-heart" aria-hidden="true">♥</span></strong>
          <button type="button" class="lynn-cbe-icon" id="${ID.logToggle}" title="작업 로그">☰</button>
          <button type="button" class="lynn-cbe-icon" data-lynn-cbe-close aria-label="닫기">✕</button>
        </div>

        <div class="lynn-cbe-tabs">
          <button id="${ID.tabReplace}" type="button" class="lynn-cbe-tab active">문자열 치환</button>
          <button id="${ID.tabTurn}" type="button" class="lynn-cbe-tab">연속 번호</button>
          <button id="${ID.tabRepeat}" type="button" class="lynn-cbe-tab">반복 검사</button>
          <button id="${ID.tabReroll}" type="button" class="lynn-cbe-tab">빠진 리롤</button>
        </div>

        <div id="${ID.status}" data-type="neutral" hidden>
          <span id="${ID.statusText}"></span>
          <span id="${ID.statusExtra}"></span>
          <span id="${ID.statusActions}">
            <button id="${ID.replaceApply}" type="button" class="lynn-cbe-btn primary" disabled>일괄 수정</button>
            <button id="${ID.turnApply}" type="button" class="lynn-cbe-btn primary" disabled hidden>재번호 적용</button>
            <button id="${ID.rerollApply}" type="button" class="lynn-cbe-btn primary" disabled hidden>리롤 삭제</button>
            <button id="${ID.cancel}" type="button" class="lynn-cbe-btn small" disabled style="display:none">중단</button>
          </span>
        </div>

        <div id="${ID.progress}" hidden><i></i></div>

        <div class="lynn-cbe-body">
          <section id="${ID.paneReplace}" class="lynn-cbe-pane">
            <div class="lynn-cbe-setup lynn-cbe-replace-setup">
              <div class="lynn-cbe-replace-flow">
                <label class="lynn-cbe-control-field">
                  <span class="lynn-cbe-control-label">찾을 내용</span>
                  <input id="${ID.find}" type="text" autocomplete="off" placeholder="로그에서 찾을 문자열">
                </label>

                <span class="lynn-cbe-flow-arrow" aria-hidden="true">→</span>

                <label class="lynn-cbe-control-field">
                  <span class="lynn-cbe-control-label">바꿀 내용</span>
                  <input id="${ID.replace}" type="text" autocomplete="off" placeholder="비워두면 삭제">
                </label>
              </div>

              <div class="lynn-cbe-replace-meta">
                <label class="lynn-cbe-inline-select">
                  <span class="lynn-cbe-control-label">대상</span>
                  <select id="${ID.target}">
                    <option value="all">전체</option>
                    <option value="assistant">AI만</option>
                    <option value="user">USER만</option>
                  </select>
                </label>

                <label class="lynn-cbe-inline-option">
                  <input id="${ID.caseSensitive}" type="checkbox">
                  대소문자 구분
                </label>

                <span class="lynn-cbe-setup-spacer"></span>
                <button id="${ID.replaceScan}" type="button" class="lynn-cbe-btn primary">변경점 검사</button>
              </div>
            </div>

            <div id="${ID.replacePreview}" class="lynn-cbe-preview-list" style="margin-top:10px">
              <div class="lynn-cbe-empty">
                <strong>문자열을 한꺼번에 바꿉니다</strong>
                찾을 내용과 바꿀 내용을 넣고 먼저 변경점을 검사하세요.
              </div>
            </div>
          </section>

          <section id="${ID.paneTurn}" class="lynn-cbe-pane" hidden>
            <div class="lynn-cbe-setup lynn-cbe-turn-setup">
              <div class="lynn-cbe-turn-primary">
                <label class="lynn-cbe-control-field grow lynn-cbe-turn-pattern">
                  <span class="lynn-cbe-control-label">턴 번호 형식</span>
                  <input id="${ID.turnPattern}" type="text" autocomplete="off"
                         placeholder="예: **[{N}]**"
                         title="실제 숫자가 들어가는 자리를 {N}으로 적습니다">
                </label>

                <label class="lynn-cbe-control-field lynn-cbe-turn-start">
                  <span class="lynn-cbe-control-label">시작 턴</span>
                  <input id="${ID.turnStartNumber}" type="number" step="1" placeholder="자동">
                </label>

                <button id="${ID.turnAnalyze}" type="button" class="lynn-cbe-btn primary">턴 로그 분석</button>
              </div>

              <div class="lynn-cbe-turn-hint">
                <span>AI 메시지만 셉니다.</span>
                <span>숫자 자리만 <code>{N}</code>으로 바꿔 입력하세요.</span>
              </div>
            </div>

            <div id="${ID.turnRange}" class="lynn-cbe-range" hidden></div>

            <div class="lynn-cbe-check off" id="lynn-cbe-check-line" hidden>
              <span id="${ID.turnSummary}"></span>
              <span class="lynn-cbe-spacer"></span>
              <label title="알고 있는 마지막 턴 번호를 넣으면 계산이 맞는지 대조합니다">
                예상 끝
                <input id="${ID.turnExpectedEnd}" type="number" step="1" placeholder="-">
              </label>
              <span id="${ID.turnVerify}"></span>
            </div>

            <div class="lynn-cbe-tools" data-lynn-cbe-turn-tools hidden>
              <input id="${ID.turnFilter}" type="text" autocomplete="off"
                     class="lynn-cbe-search" placeholder="후보 안에서 번호 · 본문 검색">
              <label class="lynn-cbe-toggle">
                <input id="${ID.turnOnlyReview}" type="checkbox">
                검토 필요만
              </label>
              <details class="lynn-cbe-menu" id="${ID.turnMenu}">
                <summary title="더보기">⋯</summary>
                <div>
                  <button id="${ID.turnFirstAnchor}" type="button">첫 후보를 시작점으로</button>
                  <button id="${ID.turnLatestAnchor}" type="button">마지막 후보를 끝점으로</button>
                  <button id="${ID.turnExcludeFiltered}" type="button">검색결과 모두 제외</button>
                  <button id="${ID.turnIncludeFiltered}" type="button">검색결과 모두 포함</button>
                </div>
              </details>
            </div>

            <div id="${ID.turnCandidateList}" class="lynn-cbe-preview-list" style="margin-top:10px">
              <div class="lynn-cbe-empty">
                <strong>턴 번호 구간을 다시 매깁니다</strong>
                위에서 턴 번호 형식과 시작 턴을 정한 뒤 분석하세요.
              </div>
            </div>
          </section>

          <section id="${ID.paneRepeat}" class="lynn-cbe-pane" hidden>
            <div class="lynn-cbe-setup lynn-cbe-repeat-setup">
              <div class="lynn-cbe-turn-hint">
                <span>화면에 남아 있는 AI 메시지 중 본문이 완전히 같은 것을 찾습니다.</span>
                <span>빠진 리롤은 세지 않습니다.</span>
              </div>
              <div class="lynn-cbe-replace-meta">
                <span class="lynn-cbe-setup-spacer"></span>
                <button id="${ID.repeatScan}" type="button" class="lynn-cbe-btn primary">AI 반복 검사</button>
              </div>
            </div>

            <div id="${ID.repeatList}" class="lynn-cbe-preview-list" style="margin-top:10px">
              <div class="lynn-cbe-empty">
                <strong>같은 AI 메시지를 찾습니다</strong>
                화면에 남아 있는 AI 메시지 중 본문이 완전히 같은 것을 검사합니다.
              </div>
            </div>
          </section>

          <section id="${ID.paneReroll}" class="lynn-cbe-pane" hidden>
            <div class="lynn-cbe-setup lynn-cbe-repeat-setup">
              <div class="lynn-cbe-turn-hint">
                <span>로그에는 있지만 지금 화면에 없는 AI 리롤을 찾습니다.</span>
                <span>보이는 답은 남기고, 그 답의 다른 버전만 지웁니다.</span>
              </div>
              <div class="lynn-cbe-replace-meta">
                <span class="lynn-cbe-setup-spacer"></span>
                <button id="${ID.rerollScan}" type="button" class="lynn-cbe-btn primary">빠진 리롤 찾기</button>
              </div>
            </div>

            <div id="${ID.rerollList}" class="lynn-cbe-preview-list" style="margin-top:10px">
              <div class="lynn-cbe-empty">
                <strong>화면에 없는 리롤을 지웁니다</strong>
                로그에는 남아 있지만 지금 보이지 않는 AI 답변을 찾아 서버에서 삭제합니다.
              </div>
            </div>
          </section>
        </div>

        <div class="lynn-cbe-log-wrap"><pre id="${ID.log}"></pre></div>
      </div>
    `;

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closePanel();
    });

    overlay.querySelector('[data-lynn-cbe-close]')?.addEventListener('click', closePanel);
    document.body.appendChild(overlay);
    syncCbeTheme();
    ensureCbeThemeObserver();

    document.getElementById(ID.tabReplace)?.addEventListener('click', () => switchTab('replace'));
    document.getElementById(ID.tabTurn)?.addEventListener('click', () => switchTab('turn'));
    document.getElementById(ID.tabRepeat)?.addEventListener('click', () => switchTab('repeat'));
    document.getElementById(ID.tabReroll)?.addEventListener('click', () => switchTab('reroll'));

    document.getElementById(ID.logToggle)?.addEventListener('click', () => {
      document.getElementById(ID.panel)?.classList.toggle('show-log');
    });

    document.getElementById(ID.replaceScan)?.addEventListener('click', handleReplaceScan);
    document.getElementById(ID.replaceApply)?.addEventListener('click', handleReplaceApply);
    document.getElementById(ID.find)?.addEventListener('input', invalidateReplaceScan);
    document.getElementById(ID.replace)?.addEventListener('input', invalidateReplaceScan);
    document.getElementById(ID.target)?.addEventListener('change', invalidateReplaceScan);
    document.getElementById(ID.caseSensitive)?.addEventListener('change', invalidateReplaceScan);
    document.getElementById(ID.replacePreview)?.addEventListener('input', event => {
      const field = event.target.closest('textarea[data-replace-after]');
      if (!field) return;
      const item = state.replace.matches.find(
        match => match.index === Number(field.getAttribute('data-replace-after'))
      );
      if (!item) return;
      item.after = field.value;
      item.manual = true;
      const badge = field.closest('.lynn-cbe-preview-item')?.querySelector('.lynn-cbe-num');
      if (badge && !item.excluded) {
        badge.textContent = item.after === item.before ? '변경 없음' : '직접 수정';
      }
      describeReplaceScan();
    });
    document.getElementById(ID.replacePreview)?.addEventListener('click', event => {
      const excludeButton = event.target.closest('[data-replace-exclude]');
      const includeButton = event.target.closest('[data-replace-include]');
      if (excludeButton || includeButton) {
        event.preventDefault();
        event.stopPropagation();
        const rawIndex = (excludeButton || includeButton).getAttribute(
          excludeButton ? 'data-replace-exclude' : 'data-replace-include'
        );
        setReplaceMatchExcluded(Number(rawIndex), !!excludeButton);
        return;
      }

      const header = event.target.closest('.lynn-cbe-preview-item > header');
      if (header) header.parentElement.classList.toggle('collapsed');
    });

    document.getElementById(ID.repeatScan)?.addEventListener('click', handleRepeatScan);
    document.getElementById(ID.repeatList)?.addEventListener('click', (event) => {
      const header = event.target.closest('.lynn-cbe-preview-item > header');
      if (header) header.parentElement.classList.toggle('collapsed');
    });

    document.getElementById(ID.rerollScan)?.addEventListener('click', handleRerollScan);
    document.getElementById(ID.rerollApply)?.addEventListener('click', handleRerollApply);
    document.getElementById(ID.rerollList)?.addEventListener('click', (event) => {
      const excludeButton = event.target.closest('[data-reroll-exclude]');
      const includeButton = event.target.closest('[data-reroll-include]');
      if (excludeButton || includeButton) {
        event.preventDefault();
        event.stopPropagation();
        const rawIndex = (excludeButton || includeButton).getAttribute(
          excludeButton ? 'data-reroll-exclude' : 'data-reroll-include'
        );
        setRerollItemExcluded(Number(rawIndex), !!excludeButton);
        return;
      }

      const header = event.target.closest('.lynn-cbe-preview-item > header');
      if (header) header.parentElement.classList.toggle('collapsed');
    });

    document.getElementById(ID.turnAnalyze)?.addEventListener('click', handleTurnAnalyze);
    document.getElementById(ID.turnApply)?.addEventListener('click', handleTurnApply);
    document.getElementById(ID.turnPattern)?.addEventListener('input', invalidateTurnAnalysis);
    document.getElementById(ID.turnStartNumber)?.addEventListener('input', handleTurnStartNumberInput);
    document.getElementById(ID.turnExpectedEnd)?.addEventListener('input', handleTurnExpectedEndInput);
    document.getElementById(ID.turnFilter)?.addEventListener('input', renderTurnCandidates);
    document.getElementById(ID.turnOnlyReview)?.addEventListener('change', renderTurnCandidates);
    document.getElementById(ID.turnCandidateList)?.addEventListener('click', handleTurnCandidateListClick);
    document.getElementById(ID.turnFirstAnchor)?.addEventListener('click', handleTurnFirstAnchor);
    document.getElementById(ID.turnLatestAnchor)?.addEventListener('click', handleTurnLatestAnchor);
    document.getElementById(ID.turnExcludeFiltered)?.addEventListener(
      'click', () => handleBulkTurnCandidateMode('exclude')
    );
    document.getElementById(ID.turnIncludeFiltered)?.addEventListener(
      'click', () => handleBulkTurnCandidateMode('include')
    );

    document.getElementById(ID.cancel)?.addEventListener('click', handleCancel);

    document.addEventListener('keydown', event => {
      if (
        event.key === 'Escape' &&
        document.getElementById(ID.overlay)?.style.display !== 'none'
      ) {
        closePanel();
      }
    });

    switchTab(state.activeTab);
  }

  const CBE_NATIVE_BUTTON_FALLBACK_CLASS = 'relative inline-flex items-center gap-1 rounded-full text-sm font-medium leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:fill-current min-w-7 border border-border bg-card text-line-gray-1 hover:bg-secondary p-0 size-7 justify-center';

  function findCbeChatInput() {
    const selectors = [
      '.__chat_input_textarea',
      'p[data-placeholder*="메시지"], p[data-placeholder*="Message"], p[data-placeholder*="message"]',
      'textarea[placeholder*="메시지"], textarea[placeholder*="Message"], textarea[placeholder*="message"]',
      'div.ProseMirror[contenteditable="true"], div.tiptap[contenteditable="true"]',
    ];

    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (let i = nodes.length - 1; i >= 0; i--) {
        let el = nodes[i];
        if (el.matches?.('p[data-placeholder]')) el = el.closest('[contenteditable="true"]');
        if (!(el instanceof Element) || !el.isConnected || !el.closest('main')) continue;
        if (el.closest(`#${ID.panel}`)) continue;
        return el;
      }
    }

    return null;
  }

  function isUserscriptToolbarButton(btn) {
    const id = String(btn?.id || '');
    if (id === ID.launch) return true;
    if (btn?.getAttribute?.('data-lynn-cbe-toolbar-button') || btn?.getAttribute?.('data-cbe-toolbar-button')) return true;
    return /^(lynn-|cbe-|csp-|cap-|txt-|hlp-|cmu-|lore-|crack-pure|crack-ui|fullscreen)/.test(id);
  }

  function isCrackDefaultIconButton(btn) {
    if (!(btn instanceof HTMLButtonElement)) return false;
    if (isUserscriptToolbarButton(btn)) return false;
    if (btn.closest(`#${ID.panel}, #${ID.overlay}, #lynn-settings-panel, #lynn-bottom-model-popup`)) return false;
    if (typeof isChatComposerSendButton === 'function' && isChatComposerSendButton(btn)) return false;

    const label = String(btn.getAttribute('aria-label') || '');
    if (label.includes('단축어')) return true;

    const cls = String(btn.className || '');
    return cls.includes('rounded-full') && (cls.includes('size-7') || cls.includes('min-w-7'));
  }

  function findDefaultIconRow(scope) {
    if (!(scope instanceof Element)) return null;
    const shortcut = scope.querySelector('button[aria-label*="단축어"]');
    const parent = shortcut?.parentElement;
    if (!parent || !scope.contains(parent)) return null;

    const natives = [...parent.children].filter(isCrackDefaultIconButton);
    if (!natives.length) return null;

    return {
      toolbar: parent,
      base: natives[0],
      anchor: natives.length >= 3 ? natives[2] : natives[natives.length - 1],
    };
  }

  function findCbeToolbarInfo() {
    const scopes = [];
    const cmuWrapper = document.getElementById('cmu-toolbar-wrapper');
    if (cmuWrapper instanceof HTMLElement) scopes.push(cmuWrapper);

    const input = findCbeChatInput();
    if (input) {
      const form = input.closest('form');
      const scope = form || input.parentElement?.parentElement || input.parentElement;
      if (scope instanceof Element) scopes.push(scope);
    }

    for (const scope of scopes) {
      const row = findDefaultIconRow(scope);
      if (row) return row;
    }

    const fallbackScope = scopes[0];
    if (!(fallbackScope instanceof Element)) return null;
    const buttons = [...fallbackScope.querySelectorAll('button')].filter(isCrackDefaultIconButton);
    const base = buttons.find((btn) => btn.querySelector('svg')) || buttons[0] || null;
    if (!base?.parentElement) return null;
    const natives = [...base.parentElement.children].filter(isCrackDefaultIconButton);
    if (!natives.length) return null;
    return {
      toolbar: base.parentElement,
      base: natives[0],
      anchor: natives.length >= 3 ? natives[2] : natives[natives.length - 1],
    };
  }

  function createCbeLaunchButton(baseBtn) {
    const button = document.createElement('button');
    button.id = ID.launch;
    button.type = 'button';
    button.className = baseBtn instanceof HTMLButtonElement
      ? baseBtn.className
      : CBE_NATIVE_BUTTON_FALLBACK_CLASS;
    button.classList.add('lynn-cbe-native-toolbar-btn');
    button.setAttribute('data-lynn-cbe-toolbar-button', 'bulk-editor');
    button.title = '문자열 치환 · 연속번호 · 반복 검사 · 빠진 리롤';
    button.setAttribute('aria-label', '문자열 치환 · 연속번호 · 반복 검사 · 빠진 리롤');
    button.innerHTML = '<span class="lynn-cbe-launch-icon" aria-hidden="true">⇄</span>';
    button.addEventListener('mousedown', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openPanel();
    });
    return button;
  }

  function ensureLaunchButton() {
    injectStyles();

    const chatId = parseChatId();
    let button = document.getElementById(ID.launch);

    if (!logToolsEnabled || !chatId) {
      button?.remove?.();
      return false;
    }

    const info = findCbeToolbarInfo();
    if (!info?.toolbar) {
      button?.remove?.();
      return false;
    }

    if (!(button instanceof HTMLButtonElement)) {
      button?.remove?.();
      button = createCbeLaunchButton(info.base);
    }

    if (info.base instanceof HTMLButtonElement && button.dataset.cbeBaseClass !== info.base.className) {
      const keep = 'lynn-cbe-native-toolbar-btn';
      button.className = info.base.className;
      button.classList.add(keep);
      button.dataset.cbeBaseClass = info.base.className;
    }

    const anchor = info.anchor?.parentElement === info.toolbar ? info.anchor : null;
    if (anchor) {
      if (anchor.nextSibling !== button) info.toolbar.insertBefore(button, anchor.nextSibling);
    } else if (button.parentElement !== info.toolbar) {
      info.toolbar.appendChild(button);
    }

    ensureFullscreenButton();
    return true;
  }

  function init() {
    ensureLaunchButton();
    setInterval(ensureLaunchButton, 1000);
  }

  window.LynnLogTools = { open: openPanel, syncButton: ensureLaunchButton };
  ready(init);
  })();

  (function() {
    'use strict';

    const CONFIG = {
        apiBase: 'https://crack-api.wrtn.ai/crack-gen/v3',
        storageKey: 'HCD_lastTurnCount',
        historyKey: 'HCD_downloadHistory',
        cursorKey: 'HCD_saveCursors',
        incrFormatKey: 'HCD_incrFormat',
        clipboardKey: 'HCD_clipboardOn',
        fullSaveDelay: 1500,
        retryCount: 3,
        retryBaseDelay: 1500,
        paginationDelay: 800,
        chunkSize: 300,
        incrChunkSize: 50,
        hardLimit: 20000,
        maxHistoryItems: 200,
    };

    const ICONS = {
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        note: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
        edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
        disk: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
        spinner: `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
        menu: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
        bookmark: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        highlight: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
        highlightSmall: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
        settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        sidebar: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
        pencil: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
        search: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        moon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
        sun: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
        forward: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`,
        play: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
        stop: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
    };

    const styles = `
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css');
        @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
        .hcd-ctrl-bar{display:none;align-items:center;gap:10px;margin-top:20px;padding:14px;background:var(--hcd-surface);border:1px solid var(--hcd-border);border-radius:14px}
        .hcd-ctrl-bar.active{display:flex}
        .hcd-ctrl-progress{flex:1;min-width:0}
        .hcd-ctrl-text{font-size:13px;font-weight:600;color:var(--hcd-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hcd-ctrl-sub{font-size:11px;color:var(--hcd-text3);margin-top:2px}
        .hcd-stop-btn{width:44px;height:44px;border-radius:12px;border:none;background:var(--hcd-danger);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.2s}.hcd-stop-btn:hover{opacity:.85}
        .hcd-play-btn{width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--hcd-accent),var(--hcd-accent2));color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px var(--hcd-accent-glow);transition:all .25s;min-height:48px}
        .hcd-play-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px var(--hcd-accent-glow)}
        .hcd-play-btn:disabled{opacity:.4;cursor:default;transform:none}
        .hcd-play-btn.danger{background:linear-gradient(135deg,var(--hcd-danger),#ef4444);box-shadow:0 4px 14px rgba(220,38,38,.2)}
        .hcd-clip-row{display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 14px;background:var(--hcd-surface);border:1px solid var(--hcd-border2);border-radius:10px;cursor:pointer;transition:.15s;-webkit-tap-highlight-color:transparent}
        .hcd-clip-row:hover{background:var(--hcd-accent-soft)}
        .hcd-clip-cb{width:18px;height:18px;accent-color:var(--hcd-accent);cursor:pointer;flex-shrink:0;margin:0}
        .hcd-clip-label{font-size:12px;font-weight:600;color:var(--hcd-text2);flex:1}
        .hcd-panel-overlay{--hcd-bg:#1c1c1e;--hcd-bg2:#1c1c1e;--hcd-surface:rgba(255,255,255,.08);--hcd-surface2:rgba(255,255,255,.05);--hcd-border:rgba(255,255,255,.14);--hcd-border2:rgba(255,255,255,.1);--hcd-text:#fff;--hcd-text2:rgba(255,255,255,.92);--hcd-text3:rgba(255,255,255,.72);--hcd-text4:rgba(255,255,255,.52);--hcd-accent:#f3b4cf;--hcd-accent2:#f7c6dc;--hcd-accent-glow:rgba(243,180,207,.28);--hcd-accent-soft:rgba(243,180,207,.16);--hcd-accent-text:#f7c6dc;--hcd-accent-text2:#ffe4ef;--hcd-danger:#ef4444;--hcd-danger-soft:rgba(239,68,68,.1);--hcd-danger-text:#f87171;--hcd-overlay:rgba(0,0,0,.62);--hcd-fab-bg:linear-gradient(135deg,#0f0f0f,#1a1a2e);--hcd-fab-color:#f7c6dc;--hcd-fab-shadow:0 8px 32px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.05) inset;--hcd-fab-hover-shadow:0 12px 40px rgba(0,0,0,.4),0 0 20px rgba(243,180,207,.22);--hcd-panel-shadow:0 18px 46px rgba(0,0,0,.32);--hcd-tab-active-bg:rgba(243,180,207,.16);--hcd-tab-active-color:#f7c6dc;--hcd-tab-active-shadow:0 0 12px rgba(243,180,207,.14);--hcd-btn-sec-bg:rgba(255,255,255,.06);--hcd-btn-sec-color:#9ca3af;--hcd-btn-sec-border:rgba(255,255,255,.08);--hcd-input-bg:rgba(255,255,255,.04);--hcd-input-focus:rgba(243,180,207,.22);--hcd-incr-bg:rgba(243,180,207,.22);--hcd-incr-border:rgba(243,180,207,.48);--hcd-incr-text:#f7c6dc;--hcd-incr-strong:#ffe4ef;--hcd-tag-html-bg:rgba(243,180,207,.2);--hcd-tag-html:#f7c6dc;--hcd-tag-txt-bg:rgba(255,255,255,.06);--hcd-tag-txt:#9ca3af;--hcd-tag-json-bg:rgba(34,197,94,.12);--hcd-tag-json:#4ade80;--hcd-tag-incr-bg:rgba(243,180,207,.2);--hcd-tag-incr:#f7c6dc;--hcd-tag-full-bg:rgba(239,68,68,.1);--hcd-tag-full:#f87171;--hcd-close-hover:rgba(255,80,80,.1);--hcd-close-hover-color:#ff6b6b;--hcd-warn-bg:rgba(239,68,68,.08);--hcd-warn-border:rgba(239,68,68,.15);--hcd-warn-text:#fca5a5;--hcd-status-ok:#4ade80;--hcd-status-err:#f87171;--hcd-grp-cnt-bg:rgba(255,255,255,.05);--hcd-scroll-thumb:rgba(255,255,255,.1);--hcd-rename-hover-bg:rgba(243,180,207,.14);--hcd-rename-hover-color:#f7c6dc}.hcd-panel-overlay.hcd-light{--hcd-bg:rgba(255,255,255,.98);--hcd-bg2:linear-gradient(160deg,rgba(255,255,255,.98),rgba(248,249,250,.98));--hcd-surface:rgba(0,0,0,.03);--hcd-surface2:rgba(0,0,0,.02);--hcd-border:rgba(0,0,0,.08);--hcd-border2:rgba(0,0,0,.05);--hcd-text:#000000;--hcd-text2:#1a1a1a;--hcd-text3:#333333;--hcd-text4:#555555;--hcd-accent:#e59ab8;--hcd-accent2:#f3b4cf;--hcd-accent-glow:rgba(243,180,207,.32);--hcd-accent-soft:rgba(243,180,207,.16);--hcd-accent-text:#e59ab8;--hcd-accent-text2:#ffe4ef;--hcd-danger:#dc2626;--hcd-danger-soft:rgba(239,68,68,.06);--hcd-danger-text:#dc2626;--hcd-overlay:rgba(0,0,0,.3);--hcd-fab-bg:linear-gradient(135deg,#fff,#f8f9fa);--hcd-fab-color:#e59ab8;--hcd-fab-shadow:0 8px 32px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06);--hcd-fab-hover-shadow:0 12px 40px rgba(0,0,0,.18),0 0 20px rgba(243,180,207,.22);--hcd-panel-shadow:0 25px 60px rgba(0,0,0,.15),0 0 0 1px rgba(0,0,0,.06);--hcd-tab-active-bg:rgba(243,180,207,.16);--hcd-tab-active-color:#e59ab8;--hcd-tab-active-shadow:0 0 12px rgba(243,180,207,.14);--hcd-btn-sec-bg:rgba(0,0,0,.04);--hcd-btn-sec-color:#495057;--hcd-btn-sec-border:rgba(0,0,0,.08);--hcd-input-bg:rgba(0,0,0,.02);--hcd-input-focus:rgba(243,180,207,.28);--hcd-incr-bg:rgba(243,180,207,.28);--hcd-incr-border:rgba(229,154,184,.55);--hcd-incr-text:#a85a78;--hcd-incr-strong:#8a4564;--hcd-tag-html-bg:rgba(243,180,207,.16);--hcd-tag-html:#e59ab8;--hcd-tag-txt-bg:rgba(0,0,0,.04);--hcd-tag-txt:#6b7280;--hcd-tag-json-bg:rgba(34,197,94,.06);--hcd-tag-json:#16a34a;--hcd-tag-incr-bg:rgba(243,180,207,.22);--hcd-tag-incr:#e59ab8;--hcd-tag-full-bg:rgba(239,68,68,.06);--hcd-tag-full:#dc2626;--hcd-close-hover:rgba(239,68,68,.06);--hcd-close-hover-color:#ef4444;--hcd-warn-bg:rgba(239,68,68,.04);--hcd-warn-border:rgba(239,68,68,.1);--hcd-warn-text:#ef4444;--hcd-status-ok:#16a34a;--hcd-status-err:#dc2626;--hcd-grp-cnt-bg:rgba(0,0,0,.04);--hcd-scroll-thumb:rgba(0,0,0,.1);--hcd-rename-hover-bg:rgba(243,180,207,.14);--hcd-rename-hover-color:#e59ab8}
        .hcd-panel-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:var(--hcd-overlay);z-index:2147483600;display:flex;align-items:center;justify-content:center;opacity:0;animation:hcdFadeIn .25s cubic-bezier(.4,0,.2,1) forwards}
        .hcd-panel{background:var(--hcd-bg2);width:90%;max-width:460px;border-radius:20px;padding:28px;box-shadow:var(--hcd-panel-shadow);font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,sans-serif;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;color:var(--hcd-text2);scrollbar-width:thin;scrollbar-color:var(--hcd-scroll-thumb) transparent}
        .hcd-panel::-webkit-scrollbar{width:6px}.hcd-panel::-webkit-scrollbar-track{background:transparent}.hcd-panel::-webkit-scrollbar-thumb{background:var(--hcd-scroll-thumb);border-radius:3px}
        .hcd-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .hcd-title{font-size:24px;font-weight:400;color:var(--hcd-text);letter-spacing:.01em;line-height:1;font-family:'Jua',sans-serif}
        .hcd-close-btn{background:var(--hcd-surface);border:1px solid var(--hcd-border);border-radius:10px;cursor:pointer;color:var(--hcd-text3);padding:8px;min-width:40px;min-height:40px;display:flex;align-items:center;justify-content:center;transition:.2s}
        .hcd-close-btn:hover{background:var(--hcd-close-hover);color:var(--hcd-close-hover-color);border-color:var(--hcd-close-hover)}
        .hcd-tabs{display:flex;background:var(--hcd-surface);padding:4px;border-radius:14px;margin-bottom:24px;border:1px solid var(--hcd-border)}
        .hcd-tab{flex:1;padding:10px 6px;border:none;background:none;border-radius:11px;font-weight:600;color:var(--hcd-text3);cursor:pointer;transition:all .25s cubic-bezier(.4,0,.2,1);font-size:13px;min-height:42px;white-space:nowrap;font-family:inherit}
        .hcd-tab.active{background:var(--hcd-tab-active-bg);color:var(--hcd-tab-active-color);box-shadow:var(--hcd-tab-active-shadow)}
        .hcd-tab:hover:not(.active){color:var(--hcd-text2)}
        .hcd-content{display:none}.hcd-content.active{display:block}
        .hcd-label{display:block;font-size:12px;font-weight:600;color:var(--hcd-text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
        .hcd-select{padding:10px 12px;border:1px solid var(--hcd-border);border-radius:10px;font-size:14px;font-weight:600;background:var(--hcd-input-bg);color:var(--hcd-text2);cursor:pointer;outline:none;min-height:40px;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;font-family:inherit;transition:.2s}
        .hcd-select:focus{border-color:var(--hcd-accent);box-shadow:0 0 0 3px var(--hcd-input-focus)}
        .hcd-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:20px}
        .hcd-btn{padding:12px 10px;border:none;border-radius:12px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,var(--hcd-accent),var(--hcd-accent2));color:#fff;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;transition:all .25s cubic-bezier(.4,0,.2,1);min-height:46px;-webkit-tap-highlight-color:transparent;font-family:inherit;box-shadow:0 4px 14px var(--hcd-accent-glow);letter-spacing:-.01em}
        .hcd-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px var(--hcd-accent-glow)}.hcd-btn:active{transform:scale(.97)}
        .hcd-btn.secondary{background:var(--hcd-btn-sec-bg);color:var(--hcd-btn-sec-color);box-shadow:none;border:1px solid var(--hcd-btn-sec-border)}
        .hcd-btn.secondary:hover{background:var(--hcd-accent-soft);color:var(--hcd-accent-text);transform:translateY(-1px)}
        .hcd-status{margin-top:14px;font-size:12px;color:var(--hcd-text3);text-align:center;min-height:20px}
        .hcd-warning{background:var(--hcd-warn-bg);border:1px solid var(--hcd-warn-border);padding:14px;border-radius:12px;font-size:12px;color:var(--hcd-warn-text);line-height:1.6;margin-bottom:16px}
        .hcd-incr-box{background:var(--hcd-incr-bg);border:1px solid var(--hcd-incr-border);padding:16px;border-radius:14px;margin-bottom:18px;font-size:13px;line-height:1.6;color:var(--hcd-incr-text)}
        .hcd-incr-box strong{font-weight:700;color:var(--hcd-incr-strong)}
        .hcd-incr-row{display:flex;gap:8px;margin-top:12px;align-items:center}
        .hcd-incr-btn{flex:1;background:linear-gradient(135deg,#e59ab8,var(--hcd-accent));color:white;border:none;padding:10px 12px;border-radius:10px;font-weight:700;cursor:pointer;min-height:44px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;box-shadow:0 4px 14px rgba(229,154,184,.3);transition:all .25s}
        .hcd-incr-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(229,154,184,.42)}
        .hcd-history-list{max-height:350px;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:var(--hcd-scroll-thumb) transparent}
        .hcd-history-list::-webkit-scrollbar{width:5px}.hcd-history-list::-webkit-scrollbar-track{background:transparent}.hcd-history-list::-webkit-scrollbar-thumb{background:var(--hcd-scroll-thumb);border-radius:3px}
        .hcd-history-group{margin-bottom:12px;border:1px solid var(--hcd-border);border-radius:14px;overflow:hidden;background:var(--hcd-surface2)}
        .hcd-history-group-header{display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--hcd-surface);border-bottom:1px solid var(--hcd-border2);cursor:pointer;min-height:46px;transition:.15s}
        .hcd-history-group-header:hover{background:var(--hcd-accent-soft)}
        .hcd-history-group-name{flex:1;font-weight:700;font-size:13px;color:var(--hcd-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hcd-history-group-count{font-size:11px;color:var(--hcd-text4);flex-shrink:0;background:var(--hcd-grp-cnt-bg);padding:2px 8px;border-radius:6px}
        .hcd-history-group-incr{background:linear-gradient(135deg,#e59ab8,var(--hcd-accent));color:white;border:none;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;min-height:30px;display:flex;align-items:center;gap:4px;font-family:inherit;box-shadow:0 2px 8px rgba(229,154,184,.24);transition:.2s}
        .hcd-history-group-incr:hover{box-shadow:0 4px 12px rgba(229,154,184,.36)}
        .hcd-history-group-body{max-height:0;overflow:hidden;transition:max-height .3s cubic-bezier(.4,0,.2,1)}
        .hcd-history-group.open .hcd-history-group-body{max-height:2000px}
        .hcd-history-item{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--hcd-border2);font-size:13px;transition:.15s}
        .hcd-history-item:last-child{border-bottom:none}
        .hcd-history-item:hover{background:var(--hcd-surface)}
        .hcd-history-type{font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;flex-shrink:0;text-transform:uppercase;letter-spacing:.04em}
        .hcd-history-type.html{background:var(--hcd-tag-html-bg);color:var(--hcd-tag-html)}.hcd-history-type.txt{background:var(--hcd-tag-txt-bg);color:var(--hcd-tag-txt)}.hcd-history-type.json{background:var(--hcd-tag-json-bg);color:var(--hcd-tag-json)}.hcd-history-type.incr{background:var(--hcd-tag-incr-bg);color:var(--hcd-tag-incr)}.hcd-history-type.full{background:var(--hcd-tag-full-bg);color:var(--hcd-tag-full)}
        .hcd-history-info{flex:1;min-width:0}
        .hcd-history-name{font-size:12px;color:var(--hcd-text3);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hcd-history-meta{font-size:11px;color:var(--hcd-text4)}

        .hcd-history-rename, .hcd-history-copy {background:none;border:none;color:var(--hcd-text4);cursor:pointer;padding:4px;min-width:28px;min-height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:8px;transition:.2s}
        .hcd-history-rename:hover{color:var(--hcd-rename-hover-color);background:var(--hcd-rename-hover-bg)}
        .hcd-history-copy:hover{color:var(--hcd-accent-text);background:var(--hcd-accent-soft)}

        .hcd-history-group-cb{width:18px;height:18px;accent-color:var(--hcd-accent);cursor:pointer;flex-shrink:0;display:none;margin-right:8px;}
        .hcd-history-editing .hcd-history-group-cb{display:block;}

        .hcd-history-cb{width:18px;height:18px;accent-color:var(--hcd-accent);cursor:pointer;flex-shrink:0;display:none}
        .hcd-history-editing .hcd-history-cb{display:block}
        .hcd-history-editing .hcd-history-group-incr{display:none}
        .hcd-history-editing .hcd-history-rename, .hcd-history-editing .hcd-history-copy {display:none}
        .hcd-history-empty{text-align:center;padding:40px 20px;color:var(--hcd-text4);font-size:13px}
        .hcd-history-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:8px;flex-wrap:wrap}
        .hcd-history-count{font-size:12px;color:var(--hcd-text4)}
        .hcd-htool-btn{background:var(--hcd-surface);border:1px solid var(--hcd-border);color:var(--hcd-text3);padding:5px 12px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;min-height:30px;transition:.2s;font-family:inherit}.hcd-htool-btn:hover{background:var(--hcd-accent-soft);color:var(--hcd-accent-text)}
        .hcd-htool-btn.danger{border-color:var(--hcd-warn-border);color:var(--hcd-danger-text)}.hcd-htool-btn.danger:hover{background:var(--hcd-danger-soft)}
        .hcd-htool-btn.primary{border-color:var(--hcd-incr-border);color:var(--hcd-accent-text)}.hcd-htool-btn.primary:hover{background:var(--hcd-accent-soft)}
        .hcd-htool-actions{display:none;gap:6px;align-items:center}.hcd-history-editing .hcd-htool-actions{display:flex}
        .hcd-htool-normal{display:flex;gap:6px;align-items:center}.hcd-history-editing .hcd-htool-normal{display:none}
        .hcd-backup-bar{display:flex;gap:8px;margin-bottom:16px;padding:14px;background:var(--hcd-surface2);border:1px solid var(--hcd-border);border-radius:14px;align-items:center}
        .hcd-backup-bar span{font-size:12px;font-weight:700;color:var(--hcd-text3);flex-shrink:0}
        .hcd-backup-btn{flex:1;padding:9px 6px;border:1px solid var(--hcd-border);border-radius:10px;background:var(--hcd-surface);color:var(--hcd-text3);font-size:12px;font-weight:600;cursor:pointer;min-height:38px;display:flex;align-items:center;justify-content:center;gap:4px;transition:.2s;font-family:inherit}
        .hcd-backup-btn:hover{background:var(--hcd-accent-soft);border-color:var(--hcd-incr-border);color:var(--hcd-accent-text)}
        .hcd-backup-btn.import{border-style:dashed}
        .hcd-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px}
        .hcd-stat{background:var(--hcd-surface);border:1px solid var(--hcd-border2);border-radius:10px;padding:10px 12px;text-align:center}
        .hcd-stat-val{font-size:18px;font-weight:700;color:var(--hcd-text);letter-spacing:-.02em}
        .hcd-stat-label{font-size:10px;font-weight:600;color:var(--hcd-text4);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
        .hcd-hsearch{display:flex;gap:8px;margin-bottom:12px;align-items:center}
        .hcd-hsearch-input{flex:1;padding:8px 12px;border:1px solid var(--hcd-border);border-radius:10px;font-size:13px;background:var(--hcd-input-bg);color:var(--hcd-text);font-family:inherit;outline:none;transition:.2s;min-height:36px}.hcd-hsearch-input:focus{border-color:var(--hcd-accent)}
        .hcd-hsearch-input::placeholder{color:var(--hcd-text4)}
        .hcd-batch-btn{width:100%;margin-bottom:14px;padding:10px;background:var(--hcd-surface);border:1px solid var(--hcd-incr-border);border-radius:10px;color:var(--hcd-accent-text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;transition:.2s;min-height:40px}.hcd-batch-btn:hover{background:var(--hcd-accent-soft)}
        .hcd-batch-btn:disabled{opacity:.4;cursor:default}
        .hcd-merge-zone{border:2px dashed var(--hcd-border);border-radius:14px;padding:24px 16px;text-align:center;cursor:pointer;transition:.2s;margin-bottom:16px}
        .hcd-merge-zone:hover{border-color:var(--hcd-accent);background:var(--hcd-accent-soft)}
        .hcd-merge-zone-text{font-size:13px;color:var(--hcd-text3);line-height:1.6}
        .hcd-merge-zone-text strong{color:var(--hcd-text2)}
        .hcd-merge-list{max-height:180px;overflow-y:auto;margin-bottom:14px;scrollbar-width:thin;scrollbar-color:var(--hcd-scroll-thumb) transparent}
        .hcd-merge-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--hcd-border2);border-radius:8px;margin-bottom:6px;font-size:12px;color:var(--hcd-text2)}
        .hcd-merge-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hcd-merge-item-size{color:var(--hcd-text4);font-size:11px;flex-shrink:0}
        .hcd-merge-item-del{background:none;border:none;color:var(--hcd-text4);cursor:pointer;font-size:14px;padding:2px 4px;border-radius:4px;flex-shrink:0}.hcd-merge-item-del:hover{color:var(--hcd-danger-text)}
        @keyframes hcdFadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}.spin{animation:spin 1s linear infinite}@keyframes spin{100%{transform:rotate(360deg)}}
    
.hcd-panel{border:1px solid rgba(255,255,255,.12)}
.hcd-panel-overlay.hcd-light .hcd-panel{border-color:rgba(229,154,184,.4)}
.hcd-title-heart{margin:0 .16em;font-weight:500;color:#f7c6dc}
.hcd-title{color:rgba(255,255,255,.94)}
.hcd-panel-overlay.hcd-light .hcd-title{color:rgba(17,24,39,.94)}
.hcd-panel-overlay.hcd-light .hcd-title-heart{color:#e59ab8}
.hcd-btn:not(.secondary),.hcd-play-btn:not(.danger),.hcd-incr-btn,.hcd-history-group-incr{color:#3a2430}
`;

    const Platform = {
        async download(content, fileName, mime) {
            const fullMime = (mime.startsWith('text/') || mime === 'application/json') ? `${mime};charset=utf-8` : mime;
            const blob = new Blob([content], { type: fullMime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = fileName; a.style.display = 'none';
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
        }
    };

    const Clipboard = {
        isOn() { try { return localStorage.getItem(CONFIG.clipboardKey) === '1'; } catch { return false; } },
        setOn(v) { try { localStorage.setItem(CONFIG.clipboardKey, v ? '1' : '0'); } catch {} },
        async copy(text) {
            try {
                if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
                return this._fallbackCopy(text);
            } catch { return this._fallbackCopy(text); }
        },
        _fallbackCopy(text) {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); return true; }
            catch { return false; }
            finally { document.body.removeChild(ta); }
        }
    };

    const History = {
        _load() { try { return JSON.parse(localStorage.getItem(CONFIG.historyKey) || '[]'); } catch { return []; } },
        _save(list) { try { localStorage.setItem(CONFIG.historyKey, JSON.stringify(list)); } catch {} },
        getAll() { return this._load(); },

        add(entry) {
            const list = this._load();
            list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), timestamp: new Date().toISOString(), ...entry });
            if (list.length > CONFIG.maxHistoryItems) list.length = CONFIG.maxHistoryItems;
            this._save(list);
        },

        rename(id, newName) {
            const list = this._load();
            const item = list.find(h => h.id === id);
            if (item) { item.label = newName; this._save(list); }
        },

        _rebuildCursorsAfterDelete(affectedChatroomIds) {
            const list = this._load();
            for (const crid of affectedChatroomIds) {
                if (crid === '_full_backup_') continue;
                const remaining = list.filter(h => h.chatroomId === crid && h.lastMessageId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (remaining.length > 0) {
                    const latest = remaining[0];
                    let total = 0;
                    const sorted = remaining.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    for (const r of sorted) total = r.incremental ? total + (r.messageCount || 0) : (r.messageCount || 0);
                    this.setCursor(crid, { lastMessageId: latest.lastMessageId, totalSaved: total, savedAt: latest.timestamp, charName: latest.charName });
                } else {
                    this.removeCursor(crid);
                }
            }
        },

        remove(id) {
            const list = this._load();
            const target = list.find(h => h.id === id);
            const crid = target?.chatroomId;
            this._save(list.filter(h => h.id !== id));
            if (crid) this._rebuildCursorsAfterDelete([crid]);
        },

        removeMany(ids) {
            const set = new Set(ids);
            const list = this._load();
            const affected = new Set(list.filter(h => set.has(h.id)).map(h => h.chatroomId).filter(Boolean));
            this._save(list.filter(h => !set.has(h.id)));
            this._rebuildCursorsAfterDelete(affected);
        },

        clear() { this._save([]); const c = this._loadCursors(); for (const k in c) delete c[k]; this._saveCursors(c); },

        _loadCursors() { try { return JSON.parse(localStorage.getItem(CONFIG.cursorKey) || '{}'); } catch { return {}; } },
        _saveCursors(obj) { try { localStorage.setItem(CONFIG.cursorKey, JSON.stringify(obj)); } catch {} },
        getCursor(chatroomId) { return this._loadCursors()[chatroomId] || null; },
        setCursor(chatroomId, data) { const c = this._loadCursors(); c[chatroomId] = data; this._saveCursors(c); },
        removeCursor(chatroomId) { const c = this._loadCursors(); delete c[chatroomId]; this._saveCursors(c); },

        getGrouped() {
            const items = this._load();
            const groups = new Map();
            for (const h of items) {
                const key = h.chatroomId || '_unknown_';
                if (!groups.has(key)) groups.set(key, { charName: h.charName || '알 수 없음', chatroomId: key, items: [] });
                groups.get(key).items.push(h);
            }
            return [...groups.values()];
        },

        getIncrFormat() { try { return localStorage.getItem(CONFIG.incrFormatKey) || 'txt'; } catch { return 'txt'; } },
        setIncrFormat(f) { try { localStorage.setItem(CONFIG.incrFormatKey, f); } catch {} },

        getStats() {
            const items = this._load();
            const cursors = this._loadCursors();
            const cursorEntries = Object.entries(cursors).filter(([k]) => k !== '_full_backup_');
            let totalMessages = 0, totalSaves = items.length;
            const charNames = new Set();
            let lastSaveAt = null;
            for (const h of items) {
                totalMessages += h.messageCount || 0;
                if (h.charName && h.chatroomId !== '_full_backup_') charNames.add(h.charName);
                if (!lastSaveAt || new Date(h.timestamp) > new Date(lastSaveAt)) lastSaveAt = h.timestamp;
            }
            return { totalSaves, totalMessages, charCount: charNames.size, cursorCount: cursorEntries.length, lastSaveAt };
        },

        getAllCursors() {
            const cursors = this._loadCursors();
            return Object.entries(cursors).filter(([k]) => k !== '_full_backup_').map(([chatroomId, data]) => ({ chatroomId, ...data }));
        },

        exportBackup() {
            const payload = {
                _hcdBackup: true,
                version: '1.0.3',
                exportedAt: new Date().toISOString(),
                history: this._load(),
                cursors: this._loadCursors(),
                incrFormat: this.getIncrFormat(),
                lastTurnCount: localStorage.getItem(CONFIG.storageKey) || '100',
            };
            return JSON.stringify(payload, null, 2);
        },

        importBackup(jsonStr, overwrite = false) {
            const data = JSON.parse(jsonStr);
            if (!data._hcdBackup) throw new Error('유효한 백업 파일이 아닙니다.');
            if (overwrite) {
                this._save(data.history || []);
                this._saveCursors(data.cursors || {});
            } else {
                const existing = this._load();
                const existingIds = new Set(existing.map(h => h.id));
                const newItems = (data.history || []).filter(h => !existingIds.has(h.id));
                this._save([...existing, ...newItems]);

                const existingCursors = this._loadCursors();
                const importedCursors = data.cursors || {};
                for (const [k, v] of Object.entries(importedCursors)) {
                    if (!existingCursors[k] || new Date(v.savedAt) > new Date(existingCursors[k].savedAt)) {
                        existingCursors[k] = v;
                    }
                }
                this._saveCursors(existingCursors);
            }
            if (data.incrFormat) this.setIncrFormat(data.incrFormat);
            if (data.lastTurnCount) { try { localStorage.setItem(CONFIG.storageKey, data.lastTurnCount); } catch {} }
            return { historyCount: (data.history || []).length, cursorCount: Object.keys(data.cursors || {}).length };
        },
    };

    const API = {
        getCookie(name) { const v = `; ${document.cookie}`; const p = v.split(`; ${name}=`); return p.length === 2 ? decodeURIComponent(p.pop().split(';').shift()) : null; },
        getUrlInfo() {
            const path = String(window.location.pathname || '').replace(/\/+$/, '');
            let match = path.match(/\/stories\/([^/]+)\/episodes\/([^/]+)/);
            if (match) return { characterId: decodeURIComponent(match[1]), chatroomId: decodeURIComponent(match[2]) };
            match = path.match(/\/characters\/[^/]+\/chats\/([^/]+)/) || path.match(/\/u\/[^/]+\/c\/([^/]+)/);
            return match ? { characterId: '', chatroomId: decodeURIComponent(match[1]) } : null;
        },
                async _rawRequest(endpoint) {
            const token = this.getCookie('access_token');
            if (!token) throw new Error('로그인이 필요합니다.');
            const wrtnId = this.getCookie('__w_id');
            const headers = {
                Accept: 'application/json, text/plain, */*',
                Authorization: 'Bearer ' + token,
                platform: 'web',
                'wrtn-locale': 'ko-KR',
            };
            if (wrtnId) headers['x-wrtn-id'] = wrtnId;
            let res;
            try {
                res = await fetch(CONFIG.apiBase + endpoint, { credentials: 'include', headers });
            } catch {
                throw new Error('네트워크 오류');
            }
            if (res.status === 429) throw new Error('RATE_LIMITED');
            if (!res.ok) throw new Error('API 오류: ' + res.status);
            try { return await res.json(); } catch { throw new Error('JSON 파싱 실패'); }
        },
                async request(endpoint) {
            let lastError;
            for (let attempt = 0; attempt < CONFIG.retryCount; attempt++) {
                try { return await this._rawRequest(endpoint); } catch (e) { lastError = e; if (attempt < CONFIG.retryCount - 1) { await new Promise(r => setTimeout(r, CONFIG.retryBaseDelay * Math.pow(2, attempt))); } }
            }
            throw lastError;
        },
        async fetchAllMessages(chatroomId, cancelToken, onProgress) {
            const collected = []; const seen = new Set();
            let cursor = null; let chunk = 0;
            while (true) {
                if (cancelToken?.cancelled) throw new Error('USER_CANCELLED');
                const url = `/chats/${chatroomId}/messages?limit=${CONFIG.chunkSize}${cursor ? `&cursor=${cursor}` : ''}`;
                const data = await this.request(url);
                const msgs = data.data?.messages || [];
                chunk++;
                if (!msgs.length) break;
                for (const m of msgs) { if (!seen.has(m._id)) { seen.add(m._id); collected.push(m); } }
                if (onProgress) onProgress(collected.length, chunk);
                if (collected.length >= CONFIG.hardLimit) { console.warn(`[HCD] 하드리밋 도달 (${CONFIG.hardLimit}개)`); break; }
                cursor = data.data?.nextCursor;
                if (!cursor) break;
                await new Promise(r => setTimeout(r, 300));
            }
            return collected.reverse();
        },
        async fetchDetail(chatroomId) { return (await this.request(`/chats/${chatroomId}`)).data; },
        async fetchMessagesUntilId(chatroomId, targetId, onProgress) {
            const collected = [];
            const seen = new Set();
            let cursor = null;
            let chunk = 0;

            while (true) {
                const url = `/chats/${chatroomId}/messages?limit=${CONFIG.incrChunkSize}${cursor ? `&cursor=${cursor}` : ''}`;
                const data = await this.request(url);
                const msgs = data.data?.messages || [];
                chunk++;

                if (!msgs.length) break;
                if (chunk > 40) { console.warn('[HCD] 청크 역탐색 안전 제한 도달 (2000개). targetId를 찾지 못해 중단합니다.'); break; }

                let foundTarget = false;
                for (const m of msgs) {
                    if (m._id === targetId) { foundTarget = true; break; }
                    if (!seen.has(m._id)) { seen.add(m._id); collected.push(m); }
                }

                if (onProgress) onProgress(collected.length, chunk);
                if (foundTarget) break;

                cursor = data.data?.nextCursor;
                if (!cursor) break;

                await new Promise(r => setTimeout(r, 300));
            }

            return collected.reverse();
        },
        async fetchAllChatrooms() {
            const rooms = []; let cursor = null, hasMore = true;
            while (hasMore) { const data = await this.request(`/chats?limit=40${cursor ? `&cursor=${cursor}` : ''}`); const chats = data.data?.chats || []; rooms.push(...chats); cursor = data.data?.nextCursor; hasMore = !!(cursor && chats.length); if (hasMore) await new Promise(r => setTimeout(r, CONFIG.paginationDelay)); }
            return rooms;
        }
    };

    const Generator = {
        escapeHtml(text) { return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); },
        getEmbeddedScript(userNote, title) {
            return `
                var userNote = ${JSON.stringify(userNote || '')};
                var docTitle = ${JSON.stringify(title || 'Chat')};
                var editMode = false; var bookmarks = []; var isDark = false;
                try { isDark = localStorage.getItem('hcd_dark') === '1'; } catch(e) {}
                var renderer = new marked.Renderer();
                renderer.code = function(code, language) { if (language) return '<div class="code-header">' + language + '</div><pre class="has-header"><code>' + code + '</code></pre>'; return '<pre><code>' + code + '</code></pre>'; };
                function parseContent(text) { if (!text) return ''; return marked.parse(text.replace(/&&(.+?)&&/g, '<mark>$1</mark>'), { renderer: renderer, breaks: true }); }
                function autoResize(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 5) + 'px'; }
                function getScrollContainer() { return document.querySelector('.content-area'); }
                window.toggleDarkMode = function() { isDark = !isDark; document.body.classList.toggle('dark-mode', isDark); try { localStorage.setItem('hcd_dark', isDark ? '1' : '0'); } catch(e) {} var btn = document.getElementById('darkModeBtn'); if (btn) btn.innerHTML = isDark ? '${ICONS.sun}' : '${ICONS.moon}'; var badge = document.getElementById('darkModeStatus'); if (badge) { badge.textContent = isDark ? 'ON' : 'OFF'; badge.className = 'mode-badge ' + (isDark ? 'on' : 'off'); } };
                if (isDark) document.body.classList.add('dark-mode');
                document.addEventListener('DOMContentLoaded', function() { if (isDark) { var btn = document.getElementById('darkModeBtn'); if (btn) btn.innerHTML = '${ICONS.sun}'; var badge = document.getElementById('darkModeStatus'); if (badge) { badge.textContent = 'ON'; badge.className = 'mode-badge on'; } } });
                var _searchTimer = null;
                window.onSearchInput = function(val) { clearTimeout(_searchTimer); _searchTimer = setTimeout(function() { performSearch(val); }, 250); };
                function performSearch(query) { var list = document.getElementById('searchResults'); var countEl = document.getElementById('searchCount'); if (!list) return; document.querySelectorAll('.msg-wrapper').forEach(function(w) { w.classList.remove('search-match'); }); if (!query || query.length < 2) { list.innerHTML = '<div class="rsb-empty">2글자 이상 입력하세요</div>'; if (countEl) countEl.textContent = ''; return; } var wrappers = document.querySelectorAll('.msg-wrapper'); var results = []; var lq = query.toLowerCase(); wrappers.forEach(function(w, idx) { var mc = w.querySelector('.msg-content'); if (!mc) return; var text = mc.textContent || ''; if (text.toLowerCase().indexOf(lq) === -1) return; var role = w.classList.contains('user') ? 'User' : 'AI'; var pos = text.toLowerCase().indexOf(lq); var start = Math.max(0, pos - 20); var end = Math.min(text.length, pos + query.length + 30); var preview = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : ''); results.push({ idx: idx, role: role, preview: preview }); w.classList.add('search-match'); }); if (countEl) countEl.textContent = results.length + '건'; if (!results.length) { list.innerHTML = '<div class="rsb-empty">검색 결과가 없습니다</div>'; return; } list.innerHTML = results.map(function(r) { var safe = r.preview.replace(/</g,'&lt;').replace(/>/g,'&gt;'); var esc = query.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'); safe = safe.replace(new RegExp('(' + esc + ')', 'gi'), '<span class="search-match-text">$1</span>'); return '<div class="search-item" onclick="scrollToSearch(' + r.idx + ')"><span class="bm-role ' + r.role.toLowerCase() + '">' + r.role + '</span><span class="search-preview">' + safe + '</span></div>'; }).join(''); }
                window.clearSearch = function() { var input = document.getElementById('searchInput'); if (input) input.value = ''; performSearch(''); };
                window.scrollToSearch = function(idx) { var w = document.querySelectorAll('.msg-wrapper')[idx]; if (!w) return; w.classList.add('flash'); setTimeout(function(){ w.classList.remove('flash'); }, 1500); var input = document.getElementById('searchInput'); var query = input ? input.value.trim() : ''; var mc = w.querySelector('.msg-content'); if (query && mc) { var walker = document.createTreeWalker(mc, NodeFilter.SHOW_TEXT, null, false); var lq = query.toLowerCase(); var node, found = false; while (node = walker.nextNode()) { var pos = node.textContent.toLowerCase().indexOf(lq); if (pos === -1) continue; var range = document.createRange(); range.setStart(node, pos); range.setEnd(node, pos + query.length); var span = document.createElement('span'); span.className = 'search-flash'; span.style.cssText = 'background:#ff6b6b;color:#fff;padding:0 2px;border-radius:3px;transition:background 0.3s'; try { range.surroundContents(span); } catch(e) { break; } span.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function(s){ s.style.background = '#ffe066'; s.style.color = '#333'; }, 300, span); setTimeout(function(s){ s.style.background = '#ff6b6b'; s.style.color = '#fff'; }, 600, span); setTimeout(function(s){ s.style.background = '#ffe066'; s.style.color = '#333'; }, 900, span); setTimeout(function(s){ var parent = s.parentNode; if (parent) { parent.replaceChild(document.createTextNode(s.textContent), s); parent.normalize(); } }, 1500, span); found = true; break; } if (found) return; } var bubble = w.querySelector('.msg-bubble'); if (bubble) bubble.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
                window.toggleRightSidebar = function() { document.body.classList.toggle('rsb-open'); };
                window.showPanel = function(panelId) { document.querySelectorAll('.rsb-panel').forEach(function(p){ p.classList.remove('active'); }); document.querySelectorAll('.rsb-icon').forEach(function(i){ i.classList.remove('active'); }); var panel = document.getElementById('panel-' + panelId); var icon = document.querySelector('[data-panel="' + panelId + '"]'); if (panel) panel.classList.add('active'); if (icon) icon.classList.add('active'); if (!document.body.classList.contains('rsb-open')) document.body.classList.add('rsb-open'); if (panelId === 'search') { var si = document.getElementById('searchInput'); if (si) setTimeout(function(){ si.focus(); }, 100); } };
                window.toggleEditMode = function() { var sc = getScrollContainer(); var anchor = null, anchorTop = 0; if (sc) { var wrappers = document.querySelectorAll('.msg-wrapper'); var viewMid = sc.getBoundingClientRect().top + sc.clientHeight / 2; var bestDist = Infinity; wrappers.forEach(function(w) { var r = w.getBoundingClientRect(); var d = Math.abs(r.top + r.height / 2 - viewMid); if (d < bestDist) { bestDist = d; anchor = w; } }); if (anchor) anchorTop = anchor.getBoundingClientRect().top; } editMode = !editMode; document.body.classList.toggle('edit-mode-on', editMode); document.getElementById('editModeStatus').textContent = editMode ? 'ON' : 'OFF'; document.getElementById('editModeStatus').className = 'mode-badge ' + (editMode ? 'on' : 'off'); if (sc && anchor) { void sc.offsetHeight; sc.scrollTop += (anchor.getBoundingClientRect().top - anchorTop); } };
                window.enterEditMode = function(btn) { var wrapper = btn.closest('.msg-wrapper'); var contentDiv = wrapper.querySelector('.msg-content'); var bubble = wrapper.querySelector('.msg-bubble'); var rawText = decodeURIComponent(contentDiv.dataset.raw); var sc = getScrollContainer(); var rect = bubble.getBoundingClientRect(); bubble.style.width = rect.width + 'px'; bubble.style.maxWidth = rect.width + 'px'; bubble.style.minWidth = rect.width + 'px'; var bottomBefore = bubble.getBoundingClientRect().bottom; var editor = document.createElement('textarea'); editor.className = 'edit-area'; editor.value = rawText; editor.addEventListener('input', function() { autoResize(this); }); var actions = wrapper.querySelector('.msg-actions'); actions.innerHTML = '<button onclick="saveEdit(this)" class="action-btn save" title="확인">${ICONS.check}</button><button onclick="cancelEdit(this)" class="action-btn cancel" title="취소">${ICONS.close}</button><button onclick="applyHighlightInEditor(this)" class="action-btn hl-apply" title="형광펜 (&&)">${ICONS.highlightSmall}</button>'; wrapper.classList.add('editing'); contentDiv.style.display = 'none'; bubble.insertBefore(editor, contentDiv); autoResize(editor); editor.focus(); if (sc) { void sc.offsetHeight; sc.scrollTop += (bubble.getBoundingClientRect().bottom - bottomBefore); } };
                window.applyHighlightInEditor = function(btn) { var wrapper = btn.closest('.msg-wrapper'); var editor = wrapper.querySelector('.edit-area'); if (!editor) return; var start = editor.selectionStart, end = editor.selectionEnd; if (start === end) { alert('형광펜을 적용할 텍스트를 드래그로 선택해주세요.'); return; } var text = editor.value, selected = text.substring(start, end); if (text.substring(start - 2, start) === '&&' && text.substring(end, end + 2) === '&&') { editor.value = text.substring(0, start - 2) + selected + text.substring(end + 2); editor.selectionStart = start - 2; editor.selectionEnd = end - 2; } else { editor.value = text.substring(0, start) + '&&' + selected + '&&' + text.substring(end); editor.selectionStart = start + 2; editor.selectionEnd = end + 2; } autoResize(editor); editor.focus(); };
                window.saveEdit = function(btn) { var wrapper = btn.closest('.msg-wrapper'); var bubble = wrapper.querySelector('.msg-bubble'); var editor = wrapper.querySelector('.edit-area'); var contentDiv = wrapper.querySelector('.msg-content'); var sc = getScrollContainer(); var bottomBefore = bubble.getBoundingClientRect().bottom; contentDiv.dataset.raw = encodeURIComponent(editor.value); contentDiv.innerHTML = parseContent(editor.value); editor.remove(); contentDiv.style.display = 'block'; bubble.style.width = ''; bubble.style.maxWidth = ''; bubble.style.minWidth = ''; wrapper.classList.remove('editing'); restoreButtons(wrapper); renderHighlightList(); if (sc) { void sc.offsetHeight; sc.scrollTop += (bubble.getBoundingClientRect().bottom - bottomBefore); } };
                window.cancelEdit = function(btn) { var wrapper = btn.closest('.msg-wrapper'); var bubble = wrapper.querySelector('.msg-bubble'); var sc = getScrollContainer(); var bottomBefore = bubble.getBoundingClientRect().bottom; wrapper.querySelector('.edit-area').remove(); wrapper.querySelector('.msg-content').style.display = 'block'; bubble.style.width = ''; bubble.style.maxWidth = ''; bubble.style.minWidth = ''; wrapper.classList.remove('editing'); restoreButtons(wrapper); if (sc) { void sc.offsetHeight; sc.scrollTop += (bubble.getBoundingClientRect().bottom - bottomBefore); } };
                window.deleteMsg = function(btn) { if(!confirm('이 메시지를 삭제하시겠습니까?')) return; var wrapper = btn.closest('.msg-wrapper'); var idx = Array.from(document.querySelectorAll('.msg-wrapper')).indexOf(wrapper); var bmIdx = bookmarks.findIndex(function(b){return b.idx===idx;}); if(bmIdx > -1) bookmarks.splice(bmIdx, 1); bookmarks.forEach(function(b){ if(b.idx > idx) b.idx--; }); wrapper.remove(); renderBookmarkList(); renderHighlightList(); };
                function restoreButtons(wrapper) { wrapper.querySelector('.msg-actions').innerHTML = '<button onclick="enterEditMode(this)" class="action-btn" title="수정">${ICONS.edit}</button><button onclick="deleteMsg(this)" class="action-btn delete" title="삭제">${ICONS.trash}</button><button onclick="toggleBookmark(this)" class="action-btn bm-btn" title="북마크">${ICONS.bookmark}</button>'; }
                document.addEventListener('mouseup', function() { if (!editMode) return; var sel = window.getSelection(); if (!sel.rangeCount || sel.isCollapsed) return; var range = sel.getRangeAt(0); var container = range.commonAncestorContainer; var msgContent = (container.nodeType === 3 ? container.parentNode : container).closest('.msg-content'); if (!msgContent || msgContent.closest('.right-sidebar')) return; var mark = document.createElement('mark'); try { range.surroundContents(mark); } catch(e) {} sel.removeAllRanges(); syncRawFromDom(msgContent); renderHighlightList(); });
                function syncRawFromDom(msgContent) { var raw = decodeURIComponent(msgContent.dataset.raw); var newRaw = raw; msgContent.querySelectorAll('mark').forEach(function(m) { var t = m.textContent; if (newRaw.includes('&&' + t + '&&')) return; var idx = newRaw.indexOf(t); if (idx !== -1) newRaw = newRaw.substring(0, idx) + '&&' + t + '&&' + newRaw.substring(idx + t.length); }); msgContent.dataset.raw = encodeURIComponent(newRaw); }
                window.clearAllHighlights = function() { if(!confirm('모든 형광펜을 제거하시겠습니까?')) return; document.querySelectorAll('.msg-content').forEach(function(mc) { mc.querySelectorAll('mark').forEach(function(m) { m.parentNode.replaceChild(document.createTextNode(m.textContent), m); }); mc.normalize(); mc.dataset.raw = encodeURIComponent(decodeURIComponent(mc.dataset.raw).replace(/&&(.+?)&&/g, '$1')); }); renderHighlightList(); };
                function renderHighlightList() { var list = document.getElementById('highlightList'); if (!list) return; var items = []; document.querySelectorAll('.msg-wrapper').forEach(function(w, idx) { var marks = w.querySelectorAll('.msg-content mark'); if (!marks.length) return; var role = w.classList.contains('user') ? 'User' : 'AI'; marks.forEach(function(m, mi) { items.push({ idx: idx, markIdx: mi, role: role, text: m.textContent.substring(0, 50) }); }); }); if (!items.length) { list.innerHTML = '<div class="rsb-empty">형광펜이 없습니다</div>'; return; } list.innerHTML = items.map(function(item) { var safeText = item.text.replace(/</g,'&lt;').replace(/>/g,'&gt;'); return '<div class="hl-item" onclick="scrollToMark(' + item.idx + ',' + item.markIdx + ')"><span class="bm-role ' + item.role.toLowerCase() + '">' + item.role + '</span><span class="hl-text" title="' + safeText + '"><mark>' + safeText + '</mark></span><button class="bm-remove" onclick="event.stopPropagation();removeHighlight(' + item.idx + ',' + item.markIdx + ')" title="제거">✕</button></div>'; }).join(''); }
                window.scrollToMark = function(wrapperIdx, markIdx) { var wrapper = document.querySelectorAll('.msg-wrapper')[wrapperIdx]; if (!wrapper) return; var target = wrapper.querySelectorAll('.msg-content mark')[markIdx]; if (!target) { scrollToMsg(wrapperIdx); return; } target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.style.transition = 'background 0.3s'; target.style.background = '#ff6b6b'; setTimeout(function() { target.style.background = '#ffe066'; }, 300); setTimeout(function() { target.style.background = '#ff6b6b'; }, 600); setTimeout(function() { target.style.background = ''; target.style.transition = ''; }, 900); };
                window.removeHighlight = function(wrapperIdx, markIdx) { var wrapper = document.querySelectorAll('.msg-wrapper')[wrapperIdx]; if (!wrapper) return; var msgContent = wrapper.querySelector('.msg-content'); var target = msgContent.querySelectorAll('mark')[markIdx]; if (!target) return; target.parentNode.replaceChild(document.createTextNode(target.textContent), target); msgContent.normalize(); var raw = decodeURIComponent(msgContent.dataset.raw); var regex = /&&(.+?)&&/g; var match, count = 0, newRaw = raw; while ((match = regex.exec(raw)) !== null) { if (count === markIdx) { newRaw = raw.substring(0, match.index) + match[1] + raw.substring(match.index + match[0].length); break; } count++; } msgContent.dataset.raw = encodeURIComponent(newRaw); renderHighlightList(); };
                window.toggleBookmark = function(btn) { var wrapper = btn.closest('.msg-wrapper'); var idx = Array.from(document.querySelectorAll('.msg-wrapper')).indexOf(wrapper); var bmIdx = bookmarks.findIndex(function(b){return b.idx===idx;}); if (bmIdx > -1) { bookmarks.splice(bmIdx, 1); wrapper.classList.remove('bookmarked'); renderBookmarkList(); } else { var preview = (wrapper.querySelector('.msg-content')?.textContent || '').substring(0, 40).trim() || '북마크'; var name = prompt('북마크 이름을 입력하세요:', preview); if (name === null) return; bookmarks.push({ idx: idx, name: name || preview }); wrapper.classList.add('bookmarked'); renderBookmarkList(); } };
                function renderBookmarkList() { var list = document.getElementById('bookmarkList'); if (!list) return; if (!bookmarks.length) { list.innerHTML = '<div class="rsb-empty">북마크가 없습니다</div>'; return; } var sorted = bookmarks.slice().sort(function(a,b){return a.idx-b.idx;}); var wrappers = document.querySelectorAll('.msg-wrapper'); list.innerHTML = sorted.map(function(bm) { var w = wrappers[bm.idx]; if(!w) return ''; var role = w.classList.contains('user') ? 'User' : 'AI'; var safeName = bm.name.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); return '<div class="bm-item" onclick="scrollToMsg(' + bm.idx + ')"><span class="bm-role ' + role.toLowerCase() + '">' + role + '</span><span class="bm-text" title="' + safeName + '">' + safeName + '</span><button class="bm-edit" onclick="event.stopPropagation();renameBm(' + bm.idx + ')" title="이름 변경">${ICONS.pencil}</button><button class="bm-remove" onclick="event.stopPropagation();removeBm(' + bm.idx + ')" title="삭제">✕</button></div>'; }).join(''); }
                window.scrollToMsg = function(idx) { var w = document.querySelectorAll('.msg-wrapper')[idx]; if (!w) return; var bubble = w.querySelector('.msg-bubble'); if (bubble) bubble.scrollIntoView({ behavior: 'smooth', block: 'start' }); w.classList.add('flash'); setTimeout(function(){ w.classList.remove('flash'); }, 1500); };
                window.renameBm = function(idx) { var bm = bookmarks.find(function(b){return b.idx===idx;}); if(!bm) return; var n = prompt('북마크 이름 변경:', bm.name); if(n === null) return; bm.name = n || bm.name; renderBookmarkList(); };
                window.removeBm = function(idx) { var i = bookmarks.findIndex(function(b){return b.idx===idx;}); if(i > -1) bookmarks.splice(i, 1); document.querySelectorAll('.msg-wrapper')[idx]?.classList.remove('bookmarked'); renderBookmarkList(); };
                window.downloadModifiedHtml = function() { if(document.querySelector('.edit-area')) { alert('편집 중인 메시지가 있습니다. 먼저 확인 또는 취소를 눌러주세요.'); return; } var clone = document.documentElement.cloneNode(true); clone.querySelector('body')?.classList.remove('rsb-open','edit-mode-on'); clone.querySelectorAll('.search-match').forEach(function(el) { el.classList.remove('search-match'); }); var si = clone.querySelector('#searchInput'); if (si) si.value = ''; var sr = clone.querySelector('#searchResults'); if (sr) sr.innerHTML = '<div class="rsb-empty">2글자 이상 입력하세요</div>'; var sc = clone.querySelector('#searchCount'); if (sc) sc.textContent = ''; var htmlStr = '<!DOCTYPE html>' + clone.outerHTML; var blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = docTitle + '_edited.html'; document.body.appendChild(a); a.click(); setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300); };
            `;
        },
        buildHtml(title, messages, userNote) {
            const renderer = new marked.Renderer();
            renderer.code = function(code, language) { if (language) return `<div class="code-header">${language}</div><pre class="has-header"><code>${code}</code></pre>`; return `<pre><code>${code}</code></pre>`; };
            const contentHtml = messages.map((msg, i) => { const rawContent = encodeURIComponent(msg.content); const roleClass = msg.role === 'user' ? 'user' : 'assistant'; const rendered = marked.parse(msg.content.replace(/&&(.+?)&&/g, '<mark>$1</mark>'), { renderer, breaks: true }); return `<div class="msg-wrapper ${roleClass}" data-idx="${i}"><div class="msg-bubble"><div class="msg-content" data-raw="${rawContent}">${rendered}</div><div class="msg-actions"><button onclick="enterEditMode(this)" class="action-btn" title="수정">${ICONS.edit}</button><button onclick="deleteMsg(this)" class="action-btn delete" title="삭제">${ICONS.trash}</button><button onclick="toggleBookmark(this)" class="action-btn bm-btn" title="북마크">${ICONS.bookmark}</button></div></div></div>`; }).join('');
            const escapedNote = this.escapeHtml(userNote).replace(/\n/g, '<br>');
            return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"><title>${this.escapeHtml(title)}</title><script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"><\/script><style>:root { --bg: #f8f9fa; --user-bg: #495057; --user-text: white; --ai-bg: #e7f5ff; --text: #333; --header-bg: white; --header-border: #eee; --sidebar-bg: white; --sidebar-icon-bg: #f8f9fa; --sidebar-border: #eee; --panel-header-bg: #fff; --input-bg: #fff; --input-border: #dee2e6; --input-text: #333; --item-hover: #f8f9fa; --item-border: #f1f3f5; --muted: #868e96; --shadow: rgba(0,0,0,0.1); } body.dark-mode { --bg: #1a1b1e; --user-bg: #4dabf7; --user-text: #1a1b1e; --ai-bg: #25262b; --text: #c1c2c5; --header-bg: #25262b; --header-border: #373a40; --sidebar-bg: #25262b; --sidebar-icon-bg: #1a1b1e; --sidebar-border: #373a40; --panel-header-bg: #2c2e33; --input-bg: #2c2e33; --input-border: #495057; --input-text: #c1c2c5; --item-hover: #2c2e33; --item-border: #373a40; --muted: #909296; --shadow: rgba(0,0,0,0.3); } * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; } body { font-family: -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif; background: var(--bg); display: flex; flex-direction: column; transition: background 0.3s, color 0.3s; } .header { background: var(--header-bg); padding: 12px 20px; padding-top: max(12px, env(safe-area-inset-top)); border-bottom: 1px solid var(--header-border); display: flex; justify-content: space-between; align-items: center; z-index: 100; box-shadow: 0 2px 5px var(--shadow); flex-shrink: 0; } .header h1 { margin: 0; font-size: 18px; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .header-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; } .rsb-toggle-btn, .dark-toggle-btn { background: none; border: 1px solid var(--input-border); border-radius: 8px; padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--muted); transition: 0.2s; min-width: 44px; min-height: 44px; justify-content: center; } .rsb-toggle-btn:hover, .dark-toggle-btn:hover { background: var(--item-hover); } .main-wrap { display: flex; flex: 1; min-height: 0; } .content-area { flex: 1; overflow-y: auto; min-width: 0; -webkit-overflow-scrolling: touch; } .container { max-width: 950px; margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; padding-bottom: max(50px, env(safe-area-inset-bottom)); } .right-sidebar { width: 0; overflow: hidden; border-left: none; background: var(--sidebar-bg); transition: width 0.3s, border 0.3s; display: flex; flex-shrink: 0; height: 100%; } body.rsb-open .right-sidebar { width: 320px; border-left: 1px solid var(--sidebar-border); } .rsb-icons { width: 48px; background: var(--sidebar-icon-bg); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; align-items: center; padding: 10px 0; gap: 4px; flex-shrink: 0; height: 100%; overflow: hidden; } .rsb-icon { width: 38px; height: 38px; border: none; background: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: 0.2s; position: relative; flex-shrink: 0; min-width: 38px; min-height: 38px; } .rsb-icon:hover { background: var(--item-hover); color: var(--text); } .rsb-icon.active { background: #d0ebff; color: #1971c2; } body.dark-mode .rsb-icon.active { background: #1c3a5c; color: #74c0fc; } .rsb-icon .icon-tooltip { position: absolute; right: 110%; top: 50%; transform: translateY(-50%); background: #333; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; white-space: nowrap; opacity: 0; pointer-events: none; transition: 0.15s; } .rsb-icon:hover .icon-tooltip { opacity: 1; } .rsb-divider { width: 28px; height: 1px; background: var(--sidebar-border); margin: 4px 0; flex-shrink: 0; } .rsb-content { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%; overflow: hidden; } .rsb-panel { display: none; flex-direction: column; height: 100%; overflow: hidden; } .rsb-panel.active { display: flex; } .rsb-panel-header { padding: 14px 16px; font-weight: 700; font-size: 15px; border-bottom: 1px solid var(--sidebar-border); color: var(--text); background: var(--panel-header-bg); flex-shrink: 0; } .rsb-panel-body { padding: 12px 16px; flex: 1; overflow-y: auto; font-size: 14px; line-height: 1.7; color: var(--text); min-height: 0; -webkit-overflow-scrolling: touch; } .rsb-empty { color: var(--muted); text-align: center; padding: 30px 10px; font-size: 13px; } .bm-item, .hl-item, .search-item { padding: 10px 12px; border-bottom: 1px solid var(--item-border); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.15s; min-height: 44px; } .bm-item:hover, .hl-item:hover, .search-item:hover { background: var(--item-hover); } .bm-role { font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; } .bm-role.user { background: #495057; color: white; } .bm-role.ai { background: #d0ebff; color: #1971c2; } body.dark-mode .bm-role.user { background: #4dabf7; color: #1a1b1e; } body.dark-mode .bm-role.ai { background: #1c3a5c; color: #74c0fc; } .bm-text, .hl-text { flex: 1; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .hl-text mark { background: #ffe066; color: #333; padding: 0 2px; border-radius: 2px; font-size: 12px; } .bm-edit { background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px; flex-shrink: 0; display: flex; align-items: center; min-width: 30px; min-height: 30px; justify-content: center; } .bm-edit:hover { color: #339af0; } .bm-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 14px; padding: 4px; flex-shrink: 0; min-width: 30px; min-height: 30px; display: flex; align-items: center; justify-content: center; } .bm-remove:hover { color: #fa5252; } .search-bar { display: flex; gap: 6px; padding: 12px 16px; border-bottom: 1px solid var(--sidebar-border); flex-shrink: 0; align-items: center; } .search-input { flex: 1; padding: 10px; border: 1px solid var(--input-border); border-radius: 6px; font-size: 16px; background: var(--input-bg); color: var(--input-text); outline: none; -webkit-appearance: none; min-width: 0; } .search-input:focus { border-color: #339af0; } .search-input::placeholder { color: var(--muted); } .search-clear { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 4px; flex-shrink: 0; min-width: 30px; min-height: 30px; display: flex; align-items: center; justify-content: center; } .search-clear:hover { color: #fa5252; } .search-count { font-size: 11px; color: var(--muted); flex-shrink: 0; min-width: 30px; text-align: right; } .search-preview { flex: 1; font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.4; } .search-match-text { background: #ffe066; color: #333; padding: 0 1px; border-radius: 2px; } .edit-panel-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--item-border); } .edit-panel-row:last-child { border-bottom: none; } .edit-panel-label { font-size: 14px; color: var(--text); display: flex; align-items: center; gap: 6px; } .mode-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 700; } .mode-badge.on { background: #d3f9d8; color: #2b8a3e; } .mode-badge.off { background: var(--item-border); color: var(--muted); } .edit-panel-btn { padding: 8px 14px; border: 1px solid var(--input-border); border-radius: 6px; background: var(--input-bg); color: var(--text); cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; min-height: 36px; } .edit-panel-btn:hover { background: var(--item-hover); } .edit-panel-btn.danger { color: #fa5252; border-color: #ffc9c9; } .edit-panel-btn.danger:hover { background: #fff5f5; } body.dark-mode .edit-panel-btn.danger:hover { background: #3b1515; } .edit-panel-btn.primary { background: #339af0; color: white; border-color: #339af0; } .edit-panel-btn.primary:hover { background: #228be6; } .msg-wrapper { display: flex; width: 100%; position: relative; margin-bottom: 12px; } .msg-wrapper.user { justify-content: flex-end; } .msg-wrapper.assistant { justify-content: flex-start; } .msg-wrapper.bookmarked::before { content: ''; position: absolute; left: -8px; top: 0; bottom: 0; width: 4px; background: #ffd43b; border-radius: 2px; } .msg-wrapper.flash { animation: flashAnim 1.5s ease; } @keyframes flashAnim { 0%,100% { background: transparent; } 30% { background: rgba(255,212,59,0.25); } } body.edit-mode-on .msg-wrapper { margin-bottom: 42px; } .msg-bubble { max-width: 95%; padding: 14px 20px; border-radius: 18px; position: relative; font-size: 15.5px; line-height: 1.7; box-shadow: 0 1px 2px var(--shadow); overflow: visible; } .user .msg-bubble { background: var(--user-bg); color: var(--user-text); border-bottom-right-radius: 4px; } .assistant .msg-bubble { background: var(--ai-bg); color: var(--text); border: 1px solid var(--sidebar-border); border-bottom-left-radius: 4px; } .msg-content p { margin: 0 0 16px 0; } .msg-content p:last-child { margin-bottom: 0; } em { font-style: normal; color: var(--muted); } .user em { color: rgba(255,255,255,0.7); } body.dark-mode .user em { color: rgba(26,27,30,0.6); } mark { background-color: #ffe066; color: #333; padding: 0 2px; border-radius: 2px; } img { max-width: 100%; border-radius: 8px; } pre { background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; margin: 10px 0; } pre.has-header { border-top-left-radius: 0; border-top-right-radius: 0; margin-top: 0; } .code-header { background-color: #2d2d2d; color: #ccc; padding: 6px 12px; font-size: 12px; border-top-left-radius: 8px; border-top-right-radius: 8px; font-family: monospace; font-weight: bold; margin-top: 10px; } code { font-family: monospace; white-space: pre-wrap; word-break: break-word; } .edit-area { width: 100%; box-sizing: border-box; min-height: 50px; padding: 10px; border-radius: 8px; border: 2px solid #339af0; background-color: var(--input-bg); color: var(--input-text); resize: vertical; font-family: inherit; font-size: 16px; line-height: 1.6; outline: none; margin-bottom: 5px; -webkit-appearance: none; } .msg-actions { position: absolute; bottom: -30px; left: 0; display: none; gap: 5px; z-index: 5; } .user .msg-actions { left: auto; right: 0; } body.edit-mode-on .msg-wrapper .msg-actions { display: flex; } .action-btn { background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 32px; height: 32px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; } .action-btn:hover { background: rgba(0,0,0,0.8); } .action-btn.delete { background: #fa5252; } .action-btn.save { background: #40c057; } .action-btn.cancel { background: #868e96; } .action-btn.bm-btn { background: #fcc419; } .action-btn.hl-apply { background: #fab005; } .bookmarked .bm-btn { background: #f59f00; } body.edit-mode-on .msg-content { cursor: text; } body.edit-mode-on .msg-content::selection { background: #ffe066; } .rsb-backdrop { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 199; cursor: pointer; } .rsb-close-mobile { display: none; } @media (max-width: 768px) { .container { padding: 10px 6px; gap: 10px; padding-bottom: max(50px, env(safe-area-inset-bottom)); } .msg-bubble { max-width: 100%; width: 100%; font-size: 15px; padding: 12px 14px; border-radius: 14px; } .msg-wrapper.user, .msg-wrapper.assistant { justify-content: center; } .edit-area { min-width: 100%; } .header h1 { font-size: 15px; } .rsb-toggle-btn .rsb-toggle-label { display: none; } .right-sidebar { position: fixed !important; right: 0; top: 0; bottom: 0; z-index: 201; width: 85vw !important; max-width: 320px; transform: translateX(100%); transition: transform 0.25s ease !important; overflow: visible; border-left: 1px solid var(--sidebar-border); box-shadow: none; } body.rsb-open .right-sidebar { transform: translateX(0); box-shadow: -4px 0 15px rgba(0,0,0,0.15); } body.rsb-open .rsb-backdrop { display: block; } .rsb-close-mobile { display: flex; width: 44px; height: 44px; border: none; background: none; border-radius: 8px; cursor: pointer; align-items: center; justify-content: center; color: #fa5252; flex-shrink: 0; } .rsb-close-mobile:hover { background: #fff5f5; } }</style></head><body><div class="header"><h1>${this.escapeHtml(title)}</h1><div class="header-actions"><button class="dark-toggle-btn" id="darkModeBtn" onclick="toggleDarkMode()" title="다크모드">${ICONS.moon}</button><button class="rsb-toggle-btn" onclick="toggleRightSidebar()">${ICONS.sidebar}<span class="rsb-toggle-label"> 도구</span></button></div></div><div class="main-wrap"><div class="content-area"><div class="container">${contentHtml}</div></div><div class="right-sidebar" id="rightSidebar"><div class="rsb-icons"><button class="rsb-close-mobile" onclick="toggleRightSidebar()" title="닫기">${ICONS.close}</button><button class="rsb-icon" data-panel="search" onclick="showPanel('search')" title="검색">${ICONS.search}<span class="icon-tooltip">검색</span></button><button class="rsb-icon active" data-panel="note" onclick="showPanel('note')" title="유저 노트">${ICONS.note}<span class="icon-tooltip">유저 노트</span></button><button class="rsb-icon" data-panel="bookmark" onclick="showPanel('bookmark')" title="북마크">${ICONS.bookmark}<span class="icon-tooltip">북마크</span></button><button class="rsb-icon" data-panel="highlight" onclick="showPanel('highlight')" title="형광펜" style="color:#f59f00;">${ICONS.highlight}<span class="icon-tooltip">형광펜</span></button><div class="rsb-divider"></div><button class="rsb-icon" data-panel="edit" onclick="showPanel('edit')" title="편집 설정">${ICONS.settings}<span class="icon-tooltip">편집 설정</span></button></div><div class="rsb-content"><div class="rsb-panel" id="panel-search"><div class="rsb-panel-header">🔍 검색</div><div class="search-bar"><input type="text" id="searchInput" class="search-input" placeholder="메시지 내용 검색..." oninput="onSearchInput(this.value)" enterkeyhint="search"><span class="search-count" id="searchCount"></span><button class="search-clear" onclick="clearSearch()" title="초기화">✕</button></div><div class="rsb-panel-body" id="searchResults"><div class="rsb-empty">2글자 이상 입력하세요</div></div></div><div class="rsb-panel active" id="panel-note"><div class="rsb-panel-header">📝 유저 노트</div><div class="rsb-panel-body">${userNote ? escapedNote : '<span class="rsb-empty">유저 노트가 없습니다</span>'}</div></div><div class="rsb-panel" id="panel-bookmark"><div class="rsb-panel-header">🔖 북마크</div><div class="rsb-panel-body" id="bookmarkList"><div class="rsb-empty">북마크가 없습니다</div></div></div><div class="rsb-panel" id="panel-highlight"><div class="rsb-panel-header">🖍️ 형광펜</div><div class="rsb-panel-body" id="highlightList"><div class="rsb-empty">형광펜이 없습니다</div></div></div><div class="rsb-panel" id="panel-edit"><div class="rsb-panel-header">⚙️ 편집 설정</div><div class="rsb-panel-body"><div class="edit-panel-row"><span class="edit-panel-label">${ICONS.edit} 편집 모드 <span id="editModeStatus" class="mode-badge off">OFF</span></span><button class="edit-panel-btn" onclick="toggleEditMode()">전환</button></div><div class="edit-panel-row"><span class="edit-panel-label">${ICONS.moon} 다크 모드 <span id="darkModeStatus" class="mode-badge off">OFF</span></span><button class="edit-panel-btn" onclick="toggleDarkMode()">전환</button></div><div class="edit-panel-row"><span class="edit-panel-label">형광펜 전체 제거</span><button class="edit-panel-btn danger" onclick="clearAllHighlights()">초기화</button></div><div style="margin-top:20px;"><button class="edit-panel-btn primary" onclick="downloadModifiedHtml()" style="width:100%; padding:10px; display:flex; align-items:center; justify-content:center; gap:6px;">${ICONS.disk} 변경 사항 저장 (다운로드)</button></div></div></div></div></div></div><div class="rsb-backdrop" onclick="toggleRightSidebar()" ontouchend="event.preventDefault();toggleRightSidebar()"></div><script>${this.getEmbeddedScript(userNote, title)}<\/script></body></html>`;
        }
    };

    function isBackupLightTheme() {
        const nodes = [document.documentElement, document.body];
        for (const node of nodes) {
            const theme = String(node?.getAttribute?.('data-theme') || '');
            if (theme === 'light') return true;
            if (theme === 'dark') return false;
        }
        return !window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function loadBackupLib(src, name) {
        if (window[name]) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-lynn-lib="' + name + '"]');
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('필요한 도구를 불러오지 못했습니다.')), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.lynnLib = name;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('필요한 도구를 불러오지 못했습니다.'));
            (document.head || document.documentElement).appendChild(script);
        });
    }

    async function ensureBackupLibs() {
        await loadBackupLib('https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js', 'marked');
        await loadBackupLib('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js', 'pako');
        if (!window.marked || !window.pako) throw new Error('필요한 도구를 불러오지 못했습니다.');
    }

    const UI = {
        _editingHistory: false,
        _histSearchQuery: '',
        _histSearchCursor: 0,
        _histSearchFocused: false,
        _mergeFiles: [],
        init() {
            document.getElementById('lynn-backup-launch')?.remove();
            if (!document.getElementById('lynn-backup-style')) {
                const style = document.createElement('style');
                style.id = 'lynn-backup-style';
                style.textContent = styles;
                (document.head || document.documentElement).appendChild(style);
            }
        },
        openPanel() {
            if (document.querySelector('.hcd-panel-overlay')) return;
            this._cancelToken = null;
            const info = API.getUrlInfo();
            const cursor = info ? History.getCursor(info.chatroomId) : null;
            const savedFormat = History.getIncrFormat();

            const overlay = document.createElement('div');
            overlay.className = 'hcd-panel-overlay' + (isBackupLightTheme() ? ' hcd-light' : '');

            const incrBlock = cursor ? `
                <div class="hcd-incr-box">
                    <strong>🤍 이어서 저장 가능</strong><br>
                    마지막 저장: ${new Date(cursor.savedAt).toLocaleString('ko-KR')}<br>
                    저장된 메시지: ${cursor.totalSaved}개
                    <div class="hcd-incr-row">
                        <select class="hcd-select" id="hcd-incr-format">
                            <option value="txt"${savedFormat === 'txt' ? ' selected' : ''}>TXT</option>
                            <option value="json"${savedFormat === 'json' ? ' selected' : ''}>JSON</option>
                            <option value="html"${savedFormat === 'html' ? ' selected' : ''}>HTML</option>
                        </select>
                        <button class="hcd-incr-btn" id="hcd-incr-save">${ICONS.forward} 이어서 저장</button>
                    </div>
                </div>` : '';

            overlay.innerHTML = `
                <div class="hcd-panel">
                    <div class="hcd-header"><div class="hcd-title"><span class="hcd-title-heart" aria-hidden="true">♥</span>채팅 백업<span class="hcd-title-heart" aria-hidden="true">♥</span></div><button class="hcd-close-btn">${ICONS.close}</button></div>
                    <div class="hcd-tabs">
                        <button class="hcd-tab active" data-tab="current">현재 채팅</button>
                        <button class="hcd-tab" data-tab="full">전체 백업</button>
                        <button class="hcd-tab" data-tab="history">저장 기록</button>
                        <button class="hcd-tab" data-tab="tools">도구</button>
                    </div>
                    <div id="tab-current" class="hcd-content active">
                        ${incrBlock}
                        <div class="hcd-label" style="margin-bottom:12px">전체 대화 저장 (최대 ${CONFIG.hardLimit.toLocaleString()}개)</div>
                        <div id="hcd-current-actions" class="hcd-actions">
                            <button class="hcd-btn" data-type="html">${ICONS.play} HTML</button>
                            <button class="hcd-btn secondary" data-type="txt">${ICONS.play} TXT</button>
                            <button class="hcd-btn secondary" data-type="json">${ICONS.play} JSON</button>
                        </div>
                        <div class="hcd-ctrl-bar" id="hcd-current-ctrl">
                            <div class="hcd-ctrl-progress"><div class="hcd-ctrl-text" id="hcd-ctrl-text">수집 준비 중...</div><div class="hcd-ctrl-sub" id="hcd-ctrl-sub"></div></div>
                            <button class="hcd-stop-btn" id="hcd-stop-current" title="중지">${ICONS.stop}</button>
                        </div>
                        <label class="hcd-clip-row" for="hcd-clip-cb">
                            <input type="checkbox" class="hcd-clip-cb" id="hcd-clip-cb"${Clipboard.isOn() ? ' checked' : ''}>
                            <span class="hcd-clip-label">TXT/JSON 저장 시 클립보드에도 복사</span>
                        </label>
                    </div>
                    <div id="tab-full" class="hcd-content">
                        <div class="hcd-warning">⚠ <strong>주의:</strong> 모든 채팅방을 가져옵니다. 채팅방이 많을 경우 시간이 오래 걸립니다.</div>
                        <button class="hcd-play-btn danger" id="hcd-start-full">${ICONS.play} 전체 채팅 백업 시작</button>
                        <div class="hcd-ctrl-bar" id="hcd-full-ctrl">
                            <div class="hcd-ctrl-progress"><div class="hcd-ctrl-text" id="hcd-full-ctrl-text">스캔 준비 중...</div><div class="hcd-ctrl-sub" id="hcd-full-ctrl-sub"></div></div>
                            <button class="hcd-stop-btn" id="hcd-stop-full" title="중지">${ICONS.stop}</button>
                        </div>
                    </div>
                    <div id="tab-history" class="hcd-content"><div id="hcd-history-container"></div></div>
                    <div id="tab-tools" class="hcd-content"><div id="hcd-tools-container"></div></div>
                    <div class="hcd-status"></div>
                </div>`;

            document.body.appendChild(overlay);
            overlay.querySelector('.hcd-close-btn').onclick = () => { if (this._cancelToken) { if (!confirm('다운로드가 진행 중입니다. 정말 닫으시겠습니까?')) return; this._cancelToken.cancelled = true; } overlay.remove(); };
            overlay.onclick = (e) => { if (e.target === overlay && !this._cancelToken) overlay.remove(); };
            overlay.querySelectorAll('.hcd-tab').forEach(t => t.onclick = () => {
                overlay.querySelectorAll('.hcd-tab').forEach(x => x.classList.remove('active'));
                overlay.querySelectorAll('.hcd-content').forEach(x => x.classList.remove('active'));
                t.classList.add('active'); overlay.querySelector(`#tab-${t.dataset.tab}`).classList.add('active');
                if (t.dataset.tab === 'history') { this._editingHistory = false; this._histSearchFocused = false; this.renderHistory(); }
                if (t.dataset.tab === 'tools') this.renderTools();
            });
            overlay.querySelectorAll('#tab-current .hcd-btn').forEach(b => {
                b.onclick = () => this.processCurrentChat(b.dataset.type);
            });
            overlay.querySelector('#hcd-start-full').onclick = () => this.processFullBackup();
            overlay.querySelector('#hcd-stop-current').onclick = () => { if (this._cancelToken && confirm('다운로드를 취소하시겠습니까?\n수집된 데이터는 저장되지 않습니다.')) this._cancelToken.cancelled = true; };
            overlay.querySelector('#hcd-stop-full').onclick = () => { if (this._cancelToken && confirm('전체 백업을 취소하시겠습니까?\n수집된 데이터는 저장되지 않습니다.')) this._cancelToken.cancelled = true; };
            const clipCb = overlay.querySelector('#hcd-clip-cb');
            if (clipCb) clipCb.onchange = () => Clipboard.setOn(clipCb.checked);
            const incrFmtEl = overlay.querySelector('#hcd-incr-format');
            if (incrFmtEl) incrFmtEl.onchange = () => History.setIncrFormat(incrFmtEl.value);
            const incrBtn = overlay.querySelector('#hcd-incr-save');
            if (incrBtn) incrBtn.onclick = () => {
                const fmt = overlay.querySelector('#hcd-incr-format')?.value || 'txt';
                this.processIncrementalSave(info.chatroomId, fmt);
            };
        },

        renderHistory() {
            const container = document.getElementById('hcd-history-container'); if (!container) return;
            const groups = History.getGrouped();
            const isEditing = this._editingHistory;
            if (!groups.length) {
                const emptyBackup = `<div class="hcd-backup-bar"><span>💾 세이브</span><button class="hcd-backup-btn" id="hcd-backup-export" disabled style="opacity:.4;cursor:default">내보내기</button><button class="hcd-backup-btn import" id="hcd-backup-import">불러오기</button><input type="file" id="hcd-backup-file" accept=".json" style="display:none"></div>`;
                container.innerHTML = emptyBackup + '<div class="hcd-history-empty">저장 기록이 없습니다</div>';
                const importBtn = container.querySelector('#hcd-backup-import');
                const fileInput = container.querySelector('#hcd-backup-file');
                importBtn.onclick = () => fileInput.click();
                fileInput.onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const mode = confirm('기존 데이터에 병합할까요?\n\n[확인] = 병합\n[취소] = 덮어쓰기'); const result = History.importBackup(ev.target.result, !mode); this.updateStatus(`불러오기 완료! (기록 ${result.historyCount}건, 커서 ${result.cursorCount}개)`, 'success'); this.renderHistory(); } catch (err) { this.updateStatus('불러오기 실패: ' + err.message, 'error'); } }; reader.readAsText(file); fileInput.value = ''; };
                return;
            }
            const totalCount = groups.reduce((s, g) => s + g.items.length, 0);
            const savedFormat = History.getIncrFormat();
            const stats = History.getStats();
            const cursorsAll = History.getAllCursors();
            const searchVal = this._histSearchQuery || '';

            const lastSaveStr = stats.lastSaveAt ? new Date(stats.lastSaveAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const statsHtml = `<div class="hcd-stats">
                <div class="hcd-stat"><div class="hcd-stat-val">${stats.totalSaves}</div><div class="hcd-stat-label">총 저장</div></div>
                <div class="hcd-stat"><div class="hcd-stat-val">${stats.totalMessages.toLocaleString()}</div><div class="hcd-stat-label">메시지</div></div>
                <div class="hcd-stat"><div class="hcd-stat-val">${stats.charCount}</div><div class="hcd-stat-label">작품</div></div>
            </div>`;

            const searchHtml = `<div class="hcd-hsearch"><input type="text" class="hcd-hsearch-input" id="hcd-hist-search" placeholder="작품명 검색..." value="${this._escHtml(searchVal)}"><button class="hcd-htool-btn primary" id="hcd-hist-search-btn" style="flex-shrink:0;min-width:44px;min-height:36px">${ICONS.search}</button></div>`;

            const batchDisabled = cursorsAll.length < 2 ? ' disabled' : '';
            const batchHtml = `<button class="hcd-batch-btn" id="hcd-batch-incr"${batchDisabled}>${ICONS.forward} 전체 이어서 저장 (${cursorsAll.length}개 채팅방)</button>`;

            const toolbar = `<div class="hcd-history-toolbar${isEditing ? ' hcd-history-editing' : ''}">
                <span class="hcd-history-count">총 ${totalCount}건 · ${groups.length}개 작품</span>
                <div class="hcd-htool-normal"><button class="hcd-htool-btn" id="hcd-hist-edit-btn">편집</button></div>
                <div class="hcd-htool-actions"><button class="hcd-htool-btn primary" id="hcd-hist-selall">전체 선택</button><button class="hcd-htool-btn danger" id="hcd-hist-delbtn">선택 삭제</button><button class="hcd-htool-btn" id="hcd-hist-cancel">취소</button></div>
            </div>`;

            const filteredGroups = searchVal ? groups.filter(g => g.charName.toLowerCase().includes(searchVal.toLowerCase())) : groups;

            const groupsHtml = filteredGroups.map((g, gi) => {
                const cursor = History.getCursor(g.chatroomId);
                const hasCursor = !!cursor && g.chatroomId !== '_full_backup_';

                const groupCbHtml = `<input type="checkbox" class="hcd-history-group-cb" data-group-idx="${gi}" title="이 그룹 전체 선택">`;

                const itemsHtml = g.items.map(h => {
                    const d = new Date(h.timestamp);
                    const dateStr = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                    const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                    const typeLabel = h.incremental ? 'incr' : (h.type || 'html');
                    const msgCount = h.messageCount || h.turnCount || '?';
                    const displayName = h.label || '';
                    return `<div class="hcd-history-item" data-id="${h.id}">
                        <input type="checkbox" class="hcd-history-cb" data-hid="${h.id}">
                        <span class="hcd-history-type ${typeLabel}">${typeLabel}</span>
                        <div class="hcd-history-info">
                            ${displayName ? `<div class="hcd-history-name">${this._escHtml(displayName)}</div>` : ''}
                            <div class="hcd-history-meta">${dateStr} ${timeStr} · ${msgCount}개 메시지</div>
                        </div>
                        <button class="hcd-history-copy" data-cid="${h.id}" title="현재 채팅방으로 복제 (분기 채팅방 연결)">${ICONS.copy}</button>
                        <button class="hcd-history-rename" data-rid="${h.id}" title="이름 변경">${ICONS.pencil}</button>
                    </div>`;
                }).join('');
                const incrBtnHtml = hasCursor ? `<button class="hcd-history-group-incr" data-crid="${g.chatroomId}" title="이어서 저장">${ICONS.forward} 이어서</button>` : '';
                return `<div class="hcd-history-group open" data-group="${gi}"><div class="hcd-history-group-header" data-toggle="${gi}">${groupCbHtml}${incrBtnHtml}<span class="hcd-history-group-name">${this._escHtml(g.charName)}</span><span class="hcd-history-group-count">${g.items.length}건</span></div><div class="hcd-history-group-body">${itemsHtml}</div></div>`;
            }).join('');

            const noResult = filteredGroups.length === 0 && searchVal ? '<div class="hcd-history-empty">검색 결과가 없습니다</div>' : '';

            const fmtBar = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:12px;color:var(--hcd-text3)"><span>이어서 저장 형식:</span><select class="hcd-select" id="hcd-hist-incr-fmt" style="font-size:12px;padding:4px 24px 4px 8px;min-height:28px"><option value="txt"${savedFormat === 'txt' ? ' selected' : ''}>TXT</option><option value="json"${savedFormat === 'json' ? ' selected' : ''}>JSON</option><option value="html"${savedFormat === 'html' ? ' selected' : ''}>HTML</option></select></div>`;

            const backupBar = `<div class="hcd-backup-bar">
                <span>💾 세이브</span>
                <button class="hcd-backup-btn" id="hcd-backup-export">내보내기</button>
                <button class="hcd-backup-btn import" id="hcd-backup-import">불러오기</button>
                <input type="file" id="hcd-backup-file" accept=".json" style="display:none">
            </div>`;

            container.innerHTML = statsHtml + searchHtml + toolbar + batchHtml + fmtBar + backupBar + `<div class="hcd-history-list${isEditing ? ' hcd-history-editing' : ''}">${groupsHtml}${noResult}</div>`;

            const searchInput = container.querySelector('#hcd-hist-search');
            const searchBtn = container.querySelector('#hcd-hist-search-btn');
            const doSearch = () => { if (searchInput) { this._histSearchQuery = searchInput.value; this._histSearchCursor = searchInput.selectionStart; this._histSearchFocused = true; this.renderHistory(); } };
            if (searchInput) {
                searchInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } };
                if (this._histSearchFocused) { searchInput.focus(); const pos = this._histSearchCursor != null ? this._histSearchCursor : searchInput.value.length; searchInput.setSelectionRange(pos, pos); }
            }
            if (searchBtn) searchBtn.onclick = doSearch;

            const batchBtn = container.querySelector('#hcd-batch-incr');
            if (batchBtn) batchBtn.onclick = () => this.processBatchIncrSave();

            const fmtEl = container.querySelector('#hcd-hist-incr-fmt');
            if (fmtEl) fmtEl.onchange = () => History.setIncrFormat(fmtEl.value);

            container.querySelectorAll('[data-toggle]').forEach(hdr => {
                hdr.onclick = (e) => {
                    if (e.target.closest('.hcd-history-group-incr') || e.target.closest('.hcd-history-group-cb')) return;
                    hdr.closest('.hcd-history-group').classList.toggle('open');
                };
            });

            container.querySelectorAll('.hcd-history-group-incr').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const fmt = container.querySelector('#hcd-hist-incr-fmt')?.value || 'txt';
                    this.processIncrementalSave(btn.dataset.crid, fmt);
                };
            });

            container.querySelectorAll('.hcd-history-copy').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const histId = btn.dataset.cid;
                    const info = API.getUrlInfo();

                    if (!info) {
                        alert('현재 열려있는 채팅방이 없습니다.\n분기된 새로운 채팅방에 먼저 접속한 상태에서 이 기능을 실행해주세요.');
                        return;
                    }

                    const targetChatroomId = info.chatroomId;
                    const allItems = History.getAll();
                    const sourceItem = allItems.find(h => h.id === histId);

                    if (!sourceItem) return;
                    if (sourceItem.chatroomId === targetChatroomId) {
                        alert('이미 현재 접속해 있는 채팅방의 기록입니다.\n복제할 필요가 없습니다.');
                        return;
                    }

                    if (!confirm(`[${sourceItem.charName}]의 과거 저장 기록을\n현재 접속 중인 채팅방(분기)으로 복제하시겠습니까?\n\n이 기능을 사용하면 분기된 채팅방에서도 이어서 저장이 가능해집니다.`)) return;

                    const newItem = {
                        ...sourceItem,
                        chatroomId: targetChatroomId,
                        label: (sourceItem.label || sourceItem.charName) + ' (복제됨)',
                        timestamp: new Date().toISOString()
                    };
                    delete newItem.id;
                    History.add(newItem);

                    const sourceCursor = History.getCursor(sourceItem.chatroomId);
                    if (sourceCursor) {
                        History.setCursor(targetChatroomId, {
                            ...sourceCursor,
                            savedAt: new Date().toISOString()
                        });
                    } else {
                        History.setCursor(targetChatroomId, {
                            lastMessageId: sourceItem.lastMessageId,
                            totalSaved: sourceItem.messageCount || 0,
                            savedAt: new Date().toISOString(),
                            charName: sourceItem.charName
                        });
                    }

                    this.updateStatus('채팅방 복제가 완료되었습니다! 이제 현재 채팅방에서 이어서 저장이 가능합니다.', 'success');

                    this.renderHistory();
                };
            });

            container.querySelectorAll('.hcd-history-group-cb').forEach(cb => {
                cb.onclick = (e) => {
                    e.stopPropagation();
                    const groupDiv = cb.closest('.hcd-history-group');
                    const childCbs = groupDiv.querySelectorAll('.hcd-history-cb');
                    childCbs.forEach(child => child.checked = cb.checked);
                };
            });

            container.querySelectorAll('.hcd-history-cb').forEach(cb => {
                cb.onclick = (e) => {
                    e.stopPropagation();
                    const groupDiv = cb.closest('.hcd-history-group');
                    const groupCb = groupDiv.querySelector('.hcd-history-group-cb');
                    const childCbs = groupDiv.querySelectorAll('.hcd-history-cb');
                    const allChecked = [...childCbs].every(c => c.checked);
                    if (groupCb) groupCb.checked = allChecked;
                };
            });

            container.querySelectorAll('.hcd-history-rename').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.rid;
                    const item = History.getAll().find(h => h.id === id);
                    const current = item?.label || '';
                    const newName = prompt('저장 기록 이름 변경:', current);
                    if (newName === null) return;
                    History.rename(id, newName);
                    this.renderHistory();
                };
            });

            container.querySelector('#hcd-backup-export').onclick = () => {
                const json = History.exportBackup();
                const dateSuffix = new Date().toISOString().slice(0, 10);
                Platform.download(json, `크랙다운로더_세이브_${dateSuffix}.json`, 'application/json');
                this.updateStatus('세이브 파일 내보내기 완료!', 'success');
            };

            const importBtn = container.querySelector('#hcd-backup-import');
            const fileInput = container.querySelector('#hcd-backup-file');
            importBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const mode = confirm('기존 데이터에 병합할까요?\n\n[확인] = 병합 (기존 + 불러온 데이터)\n[취소] = 덮어쓰기 (기존 데이터 삭제)');
                        const result = History.importBackup(ev.target.result, !mode);
                        this.updateStatus(`불러오기 완료! (기록 ${result.historyCount}건, 커서 ${result.cursorCount}개)`, 'success');
                        this.renderHistory();
                    } catch (err) {
                        console.error(err);
                        this.updateStatus('불러오기 실패: ' + err.message, 'error');
                    }
                };
                reader.readAsText(file);
                fileInput.value = '';
            };

            const editBtn = container.querySelector('#hcd-hist-edit-btn');
            if (editBtn) editBtn.onclick = () => { this._editingHistory = true; this.renderHistory(); };

            const cancelBtn = container.querySelector('#hcd-hist-cancel');
            if (cancelBtn) cancelBtn.onclick = () => { this._editingHistory = false; this.renderHistory(); };

            const selAllBtn = container.querySelector('#hcd-hist-selall');
            if (selAllBtn) {
                selAllBtn.onclick = () => {
                    const itemCbs = container.querySelectorAll('.hcd-history-cb');
                    const allCbs = container.querySelectorAll('.hcd-history-cb, .hcd-history-group-cb');
                    const allChecked = [...itemCbs].every(c => c.checked);
                    allCbs.forEach(c => c.checked = !allChecked);
                    selAllBtn.textContent = allChecked ? '전체 선택' : '전체 해제';
                };
            }

            const delBtn = container.querySelector('#hcd-hist-delbtn');
            if (delBtn) {
                delBtn.onclick = () => {
                    const ids = [...container.querySelectorAll('.hcd-history-cb:checked')].map(c => c.dataset.hid);
                    if (!ids.length) { alert('삭제할 항목을 선택해주세요.'); return; }
                    if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
                    History.removeMany(ids);
                    this._editingHistory = false;
                    this.renderHistory();
                };
            }
        },

        _escHtml(t) { return (t || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
        updateStatus(msg, type = 'info') { const el = document.querySelector('.hcd-status'); if (!el) return; el.innerHTML = type === 'loading' ? `${ICONS.spinner} ${msg}` : msg; el.style.color = type === 'error' ? 'var(--hcd-status-err)' : (type === 'success' ? 'var(--hcd-status-ok)' : 'var(--hcd-text3)'); },

        renderTools() {
            const container = document.getElementById('hcd-tools-container'); if (!container) return;
            const files = this._mergeFiles;
            const fileListHtml = files.length ? files.map((f, i) => `<div class="hcd-merge-item"><span class="hcd-merge-item-name">${this._escHtml(f.name)}</span><span class="hcd-merge-item-size">${(f.size / 1024).toFixed(1)}KB</span><button class="hcd-merge-item-del" data-mi="${i}">✕</button></div>`).join('') : '';

            container.innerHTML = `
                <div class="hcd-label">파일 병합</div>
                <div style="font-size:12px;color:var(--hcd-text3);margin-bottom:12px;line-height:1.5">이어서 저장된 TXT/JSON 파일 여러 개를 하나로 합칩니다.<br>파일 순서대로 병합되며, 드래그 또는 클릭으로 추가하세요.</div>
                <div class="hcd-merge-zone" id="hcd-merge-zone"><div class="hcd-merge-zone-text"><strong>파일을 여기에 드롭</strong>하거나 클릭하여 선택<br>(TXT / JSON)</div><input type="file" id="hcd-merge-input" accept=".txt,.json" multiple style="display:none"></div>
                ${fileListHtml ? `<div class="hcd-merge-list">${fileListHtml}</div>` : ''}
                <div style="display:flex;gap:8px">
                    <button class="hcd-btn secondary" id="hcd-merge-clear" style="flex:1"${files.length ? '' : ' disabled'}>초기화</button>
                    <button class="hcd-btn" id="hcd-merge-run" style="flex:2"${files.length >= 2 ? '' : ' disabled'}>병합 다운로드 (${files.length}개)</button>
                </div>`;

            const zone = container.querySelector('#hcd-merge-zone');
            const input = container.querySelector('#hcd-merge-input');
            zone.onclick = () => input.click();
            zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--hcd-accent)'; };
            zone.ondragleave = () => { zone.style.borderColor = ''; };
            zone.ondrop = (e) => { e.preventDefault(); zone.style.borderColor = ''; this._addMergeFiles(e.dataTransfer.files); };
            input.onchange = (e) => { this._addMergeFiles(e.target.files); input.value = ''; };

            container.querySelectorAll('.hcd-merge-item-del').forEach(btn => {
                btn.onclick = () => { this._mergeFiles.splice(parseInt(btn.dataset.mi), 1); this.renderTools(); };
            });
            const clearBtn = container.querySelector('#hcd-merge-clear');
            if (clearBtn) clearBtn.onclick = () => { this._mergeFiles = []; this.renderTools(); };
            const runBtn = container.querySelector('#hcd-merge-run');
            if (runBtn) runBtn.onclick = () => this._executeMerge();
        },

        _addMergeFiles(fileList) {
            for (const f of fileList) {
                if (!f.name.endsWith('.txt') && !f.name.endsWith('.json')) continue;
                this._mergeFiles.push(f);
            }
            this.renderTools();
        },

        async _executeMerge() {
            if (this._mergeFiles.length < 2) return;
            this.updateStatus('파일 병합 중...', 'loading');
            try {
                const contents = [];
                for (const f of this._mergeFiles) {
                    contents.push(await f.text());
                }
                const isJson = this._mergeFiles[0].name.endsWith('.json');
                let merged, ext, mime;
                if (isJson) {
                    const allMessages = [];
                    for (const c of contents) {
                        try { const d = JSON.parse(c); allMessages.push(...(d.messages || [])); } catch { allMessages.push({ role: 'system', content: '[파싱 실패 파일]' }); }
                    }
                    merged = JSON.stringify({ messages: allMessages, merged: true, fileCount: this._mergeFiles.length, mergedAt: new Date().toISOString() }, null, 2);
                    ext = 'json'; mime = 'application/json';
                } else {
                    merged = contents.join('\n\n===== [파일 구분] =====\n\n');
                    ext = 'txt'; mime = 'text/plain';
                }
                const dateSuffix = new Date().toISOString().slice(0, 10);
                await Platform.download(merged, `병합_${this._mergeFiles.length}개_${dateSuffix}.${ext}`, mime);
                this.updateStatus(`병합 완료! (${this._mergeFiles.length}개 파일 → 1개)`, 'success');
                this._mergeFiles = []; this.renderTools();
            } catch (e) { console.error(e); this.updateStatus('병합 실패: ' + e.message, 'error'); }
        },

        async processBatchIncrSave() {
            const cursors = History.getAllCursors();
            if (cursors.length < 2) return;
            if (!confirm(`${cursors.length}개 채팅방의 새 메시지를 일괄 저장합니다.\n채팅방 간 2초 간격으로 진행됩니다. 계속할까요?`)) return;
            const fmt = History.getIncrFormat();
            let success = 0, fail = 0, noNew = 0;
            for (let i = 0; i < cursors.length; i++) {
                const c = cursors[i];
                this.updateStatus(`[${i + 1}/${cursors.length}] ${c.charName || '알 수 없음'} 처리 중...`, 'loading');
                try {
                    const newMessages = await API.fetchMessagesUntilId(c.chatroomId, c.lastMessageId);
                    if (!newMessages.length) { noNew++; continue; }
                    await new Promise(r => setTimeout(r, 300));
                    const detail = await API.fetchDetail(c.chatroomId);
                    const charName = detail.story?.name || detail.character?.name || c.charName || 'Unknown';
                    const now = new Date(); const dateSuffix = now.toISOString().slice(0, 10) + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
                    const fileName = `${charName}_이어서_${dateSuffix}`;
                    const type = (fmt === 'json') ? 'json' : 'txt';
                    if (type === 'json') {
                        await Platform.download(JSON.stringify({ messages: newMessages, incremental: true, previouslySaved: c.totalSaved }, null, 2), `${fileName}.json`, 'application/json');
                    } else {
                        const txt = newMessages.map(m => `[${m.role === 'user' ? 'User' : charName}]\n${m.content}\n`).join('\n===\n\n');
                        await Platform.download(txt, `${fileName}.txt`, 'text/plain');
                    }
                    const newLastMsg = newMessages[newMessages.length - 1];
                    History.add({ type, charName, chatroomId: c.chatroomId, messageCount: newMessages.length, incremental: true, lastMessageId: newLastMsg._id });
                    History.setCursor(c.chatroomId, { lastMessageId: newLastMsg._id, totalSaved: c.totalSaved + newMessages.length, savedAt: new Date().toISOString(), charName });
                    success++;
                } catch (e) {
                    console.error(e);
                    fail++;
                    if (e.message === '네트워크 오류') { this.updateStatus(`⚠ 인터넷 연결 끊김. 나머지 ${cursors.length - i - 1}개 건너뜀.`, 'error'); break; }
                    if (e.message === 'RATE_LIMITED') { this.updateStatus('⚠ 서버 제한. 30초 대기 후 재개...', 'loading'); await new Promise(r => setTimeout(r, 30000)); }
                }
                if (i < cursors.length - 1) await new Promise(r => setTimeout(r, 2000));
            }
            this.updateStatus(`일괄 저장 완료! (성공 ${success}, 새 메시지 없음 ${noNew}${fail ? `, 실패 ${fail}` : ''})`, success > 0 ? 'success' : 'info');
            this.renderHistory();
        },

        async processCurrentChat(type) {
            const actionsEl = document.getElementById('hcd-current-actions');
            const ctrlEl = document.getElementById('hcd-current-ctrl');
            const ctrlText = document.getElementById('hcd-ctrl-text');
            const ctrlSub = document.getElementById('hcd-ctrl-sub');
            try {
                const info = API.getUrlInfo(); if (!info) throw new Error('채팅방 정보를 찾을 수 없습니다.');
                this._cancelToken = { cancelled: false };
                if (actionsEl) actionsEl.style.display = 'none';
                if (ctrlEl) ctrlEl.classList.add('active');
                ctrlText.textContent = '채팅방 정보 확인 중...'; ctrlSub.textContent = '';

                const detail = await API.fetchDetail(info.chatroomId);
                const charName = detail.story?.name || detail.character?.name || 'Unknown';
                ctrlText.textContent = `${charName} 수집 중...`;

                const messages = await API.fetchAllMessages(info.chatroomId, this._cancelToken,
                    (count, chunks) => { ctrlText.textContent = `${charName} (${count.toLocaleString()}개 수집)`; ctrlSub.textContent = `${chunks}회 요청 · ${type.toUpperCase()} 형식`; }
                );

                if (!messages.length) throw new Error('대화 내용이 없습니다.');
                ctrlText.textContent = '파일 생성 중...'; ctrlSub.textContent = `${messages.length.toLocaleString()}개 메시지`;

                const now = new Date(); const dateSuffix = now.toISOString().slice(0, 10) + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
                const fileName = `${charName}_${dateSuffix}`;
                let clipText = null;
                if (type === 'html') {
                    await ensureBackupLibs();
                    const userNote = detail.story?.userNote?.content || detail.character?.userNote?.content || null;
                    await Platform.download(Generator.buildHtml(charName, messages, userNote), `${fileName}.html`, 'text/html');
                } else if (type === 'json') {
                    const { story, character, ...metaNoNote } = detail; const cleanMeta = { ...metaNoNote };
                    if (story) { const { userNote, ...rest } = story; cleanMeta.story = rest; }
                    if (character) { const { userNote, ...rest } = character; cleanMeta.character = rest; }
                    clipText = JSON.stringify({ meta: cleanMeta, messages }, null, 2);
                    await Platform.download(clipText, `${fileName}.json`, 'application/json');
                } else {
                    clipText = messages.map(m => `[${m.role === 'user' ? 'User' : charName}]\n${m.content}\n`).join('\n===\n\n');
                    await Platform.download(clipText, `${fileName}.txt`, 'text/plain');
                }

                let clipStatus = '';
                if (clipText && Clipboard.isOn() && await Clipboard.copy(clipText)) clipStatus = ' + 클립보드 복사됨';
                const lastMsg = messages[messages.length - 1];
                History.add({ type, charName, chatroomId: info.chatroomId, messageCount: messages.length, incremental: false, lastMessageId: lastMsg._id });
                History.setCursor(info.chatroomId, { lastMessageId: lastMsg._id, totalSaved: messages.length, savedAt: new Date().toISOString(), charName });
                this.updateStatus(`저장 완료! (${messages.length.toLocaleString()}개 메시지${clipStatus})`, 'success');
            } catch (e) {
                if (e.message === 'USER_CANCELLED') { this.updateStatus('다운로드가 취소되었습니다.', 'info'); }
                else { console.error(e); this.updateStatus(e.message, 'error'); }
            } finally {
                this._cancelToken = null;
                if (actionsEl) actionsEl.style.display = '';
                if (ctrlEl) ctrlEl.classList.remove('active');
            }
        },

        async processIncrementalSave(chatroomId, format) {
            try {
                if (!chatroomId) throw new Error('채팅방 정보를 찾을 수 없습니다.');
                const cursor = History.getCursor(chatroomId);
                if (!cursor) throw new Error('이전 저장 기록이 없습니다. 먼저 전체 저장을 해주세요.');
                this.updateStatus('새 메시지 확인 중...', 'loading');
                const newMessages = await API.fetchMessagesUntilId(chatroomId, cursor.lastMessageId,
                    (count, chunks) => this.updateStatus(`새 메시지 탐색 중... (${count}개 발견, ${chunks}회 요청)`, 'loading')
                );
                await new Promise(r => setTimeout(r, 300));
                const detail = await API.fetchDetail(chatroomId);
                if (!newMessages.length) { this.updateStatus('새로운 메시지가 없습니다.', 'info'); return; }
                const charName = detail.story?.name || detail.character?.name || 'Unknown';
                const now = new Date(); const dateSuffix = now.toISOString().slice(0, 10) + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
                const type = format || 'txt';
                const fileName = `${charName}_이어서_${dateSuffix}`;
                History.setIncrFormat(type);
                let clipText = null;
                if (type === 'html') {
                    await ensureBackupLibs();
                    const userNote = detail.story?.userNote?.content || detail.character?.userNote?.content || null;
                    await Platform.download(Generator.buildHtml(charName, newMessages, userNote), `${fileName}.html`, 'text/html');
                } else if (type === 'json') {
                    clipText = JSON.stringify({ messages: newMessages, incremental: true, previouslySaved: cursor.totalSaved }, null, 2);
                    await Platform.download(clipText, `${fileName}.json`, 'application/json');
                } else {
                    clipText = newMessages.map(m => `[${m.role === 'user' ? 'User' : charName}]\n${m.content}\n`).join('\n===\n\n');
                    await Platform.download(clipText, `${fileName}.txt`, 'text/plain');
                }
                let clipStatus = '';
                if (clipText && Clipboard.isOn() && await Clipboard.copy(clipText)) clipStatus = ' + 복사됨';
                const newLastMsg = newMessages[newMessages.length - 1];
                History.add({ type, charName, chatroomId, messageCount: newMessages.length, incremental: true, lastMessageId: newLastMsg._id });
                History.setCursor(chatroomId, { lastMessageId: newLastMsg._id, totalSaved: cursor.totalSaved + newMessages.length, savedAt: new Date().toISOString(), charName });
                this.updateStatus(`이어서 저장 완료! (새 메시지 ${newMessages.length}개${clipStatus})`, 'success');
            } catch (e) {
                console.error(e);
                if (e.message === '네트워크 오류') this.updateStatus('⚠ 인터넷 연결이 끊겼습니다. 네트워크 확인 후 다시 시도해주세요.', 'error');
                else if (e.message === 'RATE_LIMITED') this.updateStatus('⚠ 서버 요청 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.', 'error');
                else if (e.message === '로그인이 필요합니다.') this.updateStatus('⚠ 로그인이 만료되었습니다. 페이지를 새로고침해주세요.', 'error');
                else this.updateStatus('⚠ 이어서 저장 실패: ' + e.message, 'error');
            }
        },

        async processFullBackup() {
            const startBtn = document.querySelector('#hcd-start-full');
            const ctrlEl = document.getElementById('hcd-full-ctrl');
            const ctrlText = document.getElementById('hcd-full-ctrl-text');
            const ctrlSub = document.getElementById('hcd-full-ctrl-sub');
            this._cancelToken = { cancelled: false };
            if (startBtn) startBtn.style.display = 'none';
            if (ctrlEl) ctrlEl.classList.add('active');
            try {
                ctrlText.textContent = '채팅방 목록 스캔 중...'; ctrlSub.textContent = '';
                const rooms = await API.fetchAllChatrooms();
                const allData = []; let currentDelay = CONFIG.fullSaveDelay; let consecutiveErrors = 0;
                for (let i = 0; i < rooms.length; i++) {
                    if (this._cancelToken.cancelled) throw new Error('USER_CANCELLED');
                    const room = rooms[i]; const name = room.story?.name || room.character?.name || 'No Name';
                    ctrlText.textContent = `${name}`; ctrlSub.textContent = `[${i + 1}/${rooms.length}] 수집 중...`;
                    try {
                        const msgs = await API.fetchAllMessages(room._id, this._cancelToken,
                            (count) => { ctrlSub.textContent = `[${i + 1}/${rooms.length}] ${count.toLocaleString()}개 수집`; }
                        );
                        allData.push({ info: room, messages: msgs });
                        consecutiveErrors = 0; currentDelay = Math.max(CONFIG.fullSaveDelay, currentDelay - 200);
                    } catch (e) {
                        if (e.message === 'USER_CANCELLED') throw e;
                        console.error(`Failed ${name}`, e); consecutiveErrors++;
                        currentDelay = Math.min(10000, currentDelay + 1500 * consecutiveErrors);
                        ctrlSub.textContent = `[${i + 1}/${rooms.length}] 실패, 재개 대기...`;
                    }
                    await new Promise(r => setTimeout(r, currentDelay));
                }
                ctrlText.textContent = '데이터 압축 중...'; ctrlSub.textContent = `${rooms.length}개 채팅방, ${allData.reduce((s, d) => s + d.messages.length, 0).toLocaleString()}개 메시지`;
                await ensureBackupLibs();
                const compressed = pako.gzip(new TextEncoder().encode(JSON.stringify(allData)));
                let binary = ''; for (let i = 0; i < compressed.byteLength; i++) binary += String.fromCharCode(compressed[i]);
                const base64Data = btoa(binary);
                const viewerHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"><title>전체 채팅 백업</title><script src="https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"><\/script><script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"><\/script><style>:root{--bg:#f8f9fa;--user-bg:#495057;--user-text:white;--ai-bg:#e7f5ff;--text:#333;--sb-bg:white;--sb-border:#ddd;--item-bg:#f8f9fa;--item-active:#e7f5ff;--item-border:#f1f1f1;--input-bg:#fff;--input-border:#ddd;--input-text:#333}body.dark-mode{--bg:#1a1b1e;--user-bg:#4dabf7;--user-text:#1a1b1e;--ai-bg:#25262b;--text:#c1c2c5;--sb-bg:#25262b;--sb-border:#373a40;--item-bg:#2c2e33;--item-active:#1c3a5c;--item-border:#373a40;--input-bg:#2c2e33;--input-border:#495057;--input-text:#c1c2c5}*{box-sizing:border-box}body{display:flex;margin:0;height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Pretendard",sans-serif;background:var(--bg);overflow:hidden}.sidebar{width:300px;border-right:1px solid var(--sb-border);background:var(--sb-bg);flex-shrink:0;display:flex;flex-direction:column}.sidebar-header{padding:15px;border-bottom:1px solid var(--sb-border);font-weight:bold;font-size:16px;color:var(--text);display:flex;justify-content:space-between;align-items:center;padding-top:max(15px,env(safe-area-inset-top))}.dark-btn{background:none;border:1px solid var(--sb-border);border-radius:6px;padding:6px 10px;cursor:pointer;color:var(--text);font-size:12px;min-width:44px;min-height:36px;display:flex;align-items:center;justify-content:center}.sb-search{padding:10px 15px;border-bottom:1px solid var(--sb-border)}.sb-search-input{width:100%;padding:8px 10px;border:1px solid var(--input-border);border-radius:6px;font-size:14px;background:var(--input-bg);color:var(--input-text);outline:none}.sb-search-input:focus{border-color:#339af0}.chat-list{flex:1;overflow-y:auto}.chat-item{padding:15px;border-bottom:1px solid var(--item-border);cursor:pointer;transition:.2s;min-height:44px}.chat-item:hover{background:var(--item-bg)}.chat-item.active{background:var(--item-active);border-left:4px solid #339af0}.chat-item.hidden{display:none}.chat-name{font-weight:bold;margin-bottom:5px;color:var(--text)}.chat-date{font-size:12px;color:#888}.main{flex:1;display:flex;flex-direction:column;height:100vh;background:var(--bg)}.main-header{padding:10px 15px;border-bottom:1px solid var(--sb-border);background:var(--sb-bg);display:flex;align-items:center;gap:10px}.toggle-btn{background:none;border:none;cursor:pointer;padding:5px;display:flex;align-items:center;border-radius:5px;color:var(--text);min-width:44px;min-height:44px;justify-content:center}.toggle-btn:hover{background:var(--item-bg)}.chat-scroll{flex:1;overflow-y:auto;padding:20px;background:var(--bg)}.chat-content-container{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:10px;padding-bottom:max(50px,env(safe-area-inset-bottom))}body.sidebar-closed .sidebar{width:0;border-right:none;overflow:hidden}.msg-wrapper{display:flex;width:100%;margin-bottom:10px}.msg-wrapper.user{justify-content:flex-end}.msg-wrapper.assistant{justify-content:flex-start}.msg-bubble{max-width:95%;padding:12px 18px;border-radius:18px;font-size:15px;line-height:1.6;box-shadow:0 1px 2px rgba(0,0,0,.1)}.user .msg-bubble{background:var(--user-bg);color:var(--user-text);border-bottom-right-radius:4px}.assistant .msg-bubble{background:var(--ai-bg);color:var(--text);border:1px solid var(--sb-border);border-bottom-left-radius:4px}.msg-bubble p{margin:0 0 16px}.msg-bubble p:last-child{margin-bottom:0}mark{background-color:#ffe066;color:#333;padding:0 2px;border-radius:2px}img{max-width:100%;border-radius:8px}pre{background:#1e1e1e;color:#d4d4d4;padding:10px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;margin:10px 0}pre.has-header{border-top-left-radius:0;border-top-right-radius:0;margin-top:0}.code-header{background-color:#2d2d2d;color:#ccc;padding:6px 12px;font-size:12px;border-top-left-radius:8px;border-top-right-radius:8px;font-family:monospace;font-weight:bold;margin-top:10px}code{font-family:monospace;white-space:pre-wrap;word-break:break-word}em{font-style:normal;color:#868e96}.user em{color:#ced4da}@media(max-width:768px){.sidebar{position:fixed;left:0;top:0;bottom:0;z-index:201;box-shadow:2px 0 5px rgba(0,0,0,.1);width:85vw;max-width:300px;transform:translateX(0);transition:transform .25s ease}body.sidebar-closed .sidebar{transform:translateX(-100%);width:85vw;max-width:300px}.chat-scroll{padding:10px 6px}.msg-bubble{max-width:100%;width:100%;border-radius:14px}.msg-wrapper.user,.msg-wrapper.assistant{justify-content:center}}</style></head><body><div class="sidebar" id="sidebar"><div class="sidebar-header"><span>채팅 목록</span><button class="dark-btn" onclick="toggleDark()">🌙</button></div><div class="sb-search"><input type="text" class="sb-search-input" placeholder="채팅방 검색..." oninput="filterChats(this.value)" enterkeyhint="search"></div><div class="chat-list" id="chatList"></div></div><div class="main"><div class="main-header"><button class="toggle-btn" onclick="toggleSidebar()">${ICONS.menu}</button><h3 id="chatTitle" style="margin:0;font-size:16px;color:var(--text)">채팅방을 선택하세요</h3></div><div class="chat-scroll" id="chatView"></div></div><script id="data" type="application/base64">${base64Data}<\/script><script>var d=document.getElementById('data').textContent,b=atob(d),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);var allData=JSON.parse(new TextDecoder().decode(pako.ungzip(u)));var cl=document.getElementById('chatList'),cv=document.getElementById('chatView'),ct=document.getElementById('chatTitle');try{if(localStorage.getItem('hcd_dark')==='1')document.body.classList.add('dark-mode')}catch(e){}function toggleDark(){document.body.classList.toggle('dark-mode');try{localStorage.setItem('hcd_dark',document.body.classList.contains('dark-mode')?'1':'0')}catch(e){}}function filterChats(q){var items=cl.querySelectorAll('.chat-item');var lq=q.toLowerCase();items.forEach(function(item){var name=item.querySelector('.chat-name').textContent.toLowerCase();item.classList.toggle('hidden',lq.length>0&&name.indexOf(lq)===-1)})}allData.forEach(function(c,i){var d=document.createElement('div');d.className='chat-item';d.innerHTML='<div class="chat-name">'+(c.info.story?.name||c.info.character?.name)+'</div><div class="chat-date">'+new Date(c.info.updatedAt).toLocaleDateString()+'</div>';d.onclick=function(){renderChat(i)};cl.appendChild(d)});function renderChat(i){var c=allData[i];document.querySelectorAll('.chat-item').forEach(function(e){e.classList.remove('active')});cl.children[i].classList.add('active');ct.innerText=c.info.story?.name||c.info.character?.name;var r=new marked.Renderer();r.code=function(code,lang){if(lang)return'<div class="code-header">'+lang+'</div><pre class="has-header"><code>'+code+'</code></pre>';return'<pre><code>'+code+'</code></pre>'};cv.innerHTML='<div class="chat-content-container">'+c.messages.map(function(m){return'<div class="msg-wrapper '+(m.role==='user'?'user':'assistant')+'"><div class="msg-bubble">'+marked.parse(m.content.replace(/&&(.+?)&&/g,'<mark>$1</mark>'),{renderer:r,breaks:true})+'</div></div>'}).join('')+'</div>';if(window.innerWidth<=768)document.body.classList.add('sidebar-closed')}function toggleSidebar(){document.body.classList.toggle('sidebar-closed')};if(window.innerWidth<=768)document.body.classList.add('sidebar-closed')<\/script></body></html>`;
                await Platform.download(viewerHtml, `전체채팅백업_${new Date().toISOString().slice(0, 10)}.html`, 'text/html');
                const totalMsgs = allData.reduce((s, d) => s + d.messages.length, 0);
                History.add({ type: 'full', charName: `전체 백업 (${rooms.length}개 채팅방)`, chatroomId: '_full_backup_', messageCount: totalMsgs, incremental: false });
                this.updateStatus(`성공! ${rooms.length}개 채팅방, ${totalMsgs.toLocaleString()}개 메시지`, 'success');
            } catch (e) {
                if (e.message === 'USER_CANCELLED') { this.updateStatus('전체 백업이 취소되었습니다.', 'info'); }
                else { console.error(e); this.updateStatus('백업 중 오류 발생: ' + e.message, 'error'); }
            } finally {
                this._cancelToken = null;
                if (startBtn) startBtn.style.display = '';
                if (ctrlEl) ctrlEl.classList.remove('active');
            }
        }
    };

    UI.init();
    window.LynnBackup = {
        open() {
            if (!API.getUrlInfo()) {
                alert('크랙 채팅방 안에서만 사용할 수 있습니다.');
                return;
            }
            UI.openPanel();
        },
    };
})();

})();

(function () {
    'use strict';

    var API_BASE = 'https://crack-api.wrtn.ai/crack-gen/v3/chats';
    var TITLE_MAX = 20;
    var SUMMARY_MAX = 300;
    var USER_CARD_LIMIT = 100;
    var READ_GAP_MS = 20;
    var WRITE_GAP_MS = 80;
    var PREFIX_KEY = 'crack_ext_memory_comment_prefix';
    var DEFAULT_PREFIX = 'When you summarize this log, NEVER summarize the contents of this comment.';
    var LOCK_PREFIX = 'crack_ext_auto_memory_lock_v1:';
    var LOCK_MS = 600000;
    var SESSION_ID = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    var busy = false;

    function getChatId() {
        var patterns = [/\/episodes\/([a-f0-9-]+)/i, /\/chats\/([a-f0-9-]+)/i, /\/c\/([a-f0-9-]+)/i];
        for (var i = 0; i < patterns.length; i++) {
            var match = location.pathname.match(patterns[i]);
            if (match) return match[1];
        }
        return '';
    }

    function getToken() {
        var match = document.cookie.match(/(^| )access_token=([^;]+)/);
        return match ? match[2] : '';
    }

    function pause(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function errorText(error) {
        var text = String(error && error.message || error || '알 수 없는 오류');
        var match = text.match(/^Crack API (\d{3}): ([\s\S]*)$/);
        if (!match) return text;
        var detail = match[2].trim();
        try {
            var data = JSON.parse(detail);
            var message = data && (data.message || data.error && (data.error.message || data.error));
            if (Array.isArray(message)) message = message.join(', ');
            if (typeof message === 'string') detail = message;
        } catch (ignored) {}
        return 'Crack API ' + match[1] + ' · ' + detail.replace(/\s+/g, ' ').slice(0, 160);
    }

    function escapeHtml(text) {
        return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function chatRoomId(room) {
        return String(room && (room._id || room.id) || '');
    }

    function chatLabel(room) {
        return String(room && room.title || '').replace(/\s+/g, ' ').trim() || '이름 없음';
    }

    var EMPTY_CHAT_AVATAR = 'https://cdn-image.static.wrtn.ai/crack/graphics/empty/avatar_square_v2.svg';

    function pushImageUrls(urls, image) {
        if (!image) return;
        var values = typeof image === 'string' ? [image] : ['w200', 'w600', 'origin', 'gif600', 'gif'].map(function (key) { return image[key]; });
        values.forEach(function (value) {
            var url = String(value || '');
            if (/^https:\/\/[^\s"'<>]+$/i.test(url) && urls.indexOf(url) === -1) urls.push(url);
        });
    }

    function chatThumbCandidates(room) {
        var story = room && room.story;
        var character = room && room.character;
        var urls = [];
        pushImageUrls(urls, story && story.portraitImage);
        pushImageUrls(urls, story && story.profileImage);
        pushImageUrls(urls, character && character.portraitImage);
        pushImageUrls(urls, character && character.profileImage);
        return urls;
    }

    function fetchChatList() {
        var token = getToken();
        if (!token) return Promise.reject(new Error('인증 정보 또는 채팅 ID를 찾을 수 없습니다.'));
        var wrtn = document.cookie.match(/(?:^|; )__w_id=([^;]*)/);
        var headers = {
            Accept: 'application/json, text/plain, */*',
            Authorization: 'Bearer ' + token,
            platform: 'web',
            'wrtn-locale': 'ko-KR'
        };
        if (wrtn) headers['x-wrtn-id'] = decodeURIComponent(wrtn[1]);
        var rooms = [];
        var cursor = '';
        var seen = {};
        function step() {
            var url = 'https://crack-api.wrtn.ai/crack-gen/v3/chats?limit=40';
            if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
            return fetch(url, { credentials: 'include', headers: headers }).then(function (response) {
                return response.text().then(function (text) {
                    if (!response.ok) throw new Error('Crack API ' + response.status + ': ' + (text || '요청 실패'));
                    var data = JSON.parse(text);
                    var payload = data && data.data ? data.data : data;
                    var chats = payload && Array.isArray(payload.chats) ? payload.chats : [];
                    chats.forEach(function (room) { if (chatRoomId(room)) rooms.push(room); });
                    var next = payload && payload.nextCursor;
                    if (!next || !chats.length || seen[next]) return rooms;
                    seen[next] = true;
                    cursor = String(next);
                    return pause(20).then(step);
                });
            });
        }
        return step().then(function () {
            rooms.sort(function (a, b) {
                var at = Date.parse(a.updatedAt || a.createdAt || '') || 0;
                var bt = Date.parse(b.updatedAt || b.createdAt || '') || 0;
                return bt - at;
            });
            return rooms;
        });
    }

    function apiCall(method, path, body, chatId) {
        var token = getToken();
        chatId = String(chatId || getChatId() || '');
        if (!token || !chatId) return Promise.reject(new Error('인증 정보 또는 채팅 ID를 찾을 수 없습니다.'));
        var opts = { method: method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        return fetch(API_BASE + '/' + chatId + path, opts).then(function (response) {
            return response.text().then(function (text) {
                if (!response.ok) throw new Error('Crack API ' + response.status + ': ' + (text || '요청 실패'));
                if (!text) return { result: 'SUCCESS' };
                try { return JSON.parse(text); }
                catch (error) { throw new Error('Crack API 응답 JSON을 읽지 못했습니다.'); }
            });
        });
    }

    function summaryId(item) {
        return item && (item.id || item._id || item.summaryId || item.summary_id);
    }

    function isUserAdded(item) {
        return !!item && (String(item.createdBy || '').toLowerCase() === 'user' || String(item.badge || '').trim() === '추가');
    }

    function cardSignature(item) {
        return JSON.stringify([String(item && item.title || '').trim(), String(item && item.summary || '').trim()]);
    }

    function cardProblem(card) {
        var title = String(card.title || '').trim();
        var summary = String(card.summary || '').trim();
        if (!title || !summary) return '제목 또는 본문이 비어 있음';
        if (title.length > TITLE_MAX) return '제목 ' + title.length + '자 (최대 ' + TITLE_MAX + '자)';
        if (summary.length > SUMMARY_MAX) return '본문 ' + summary.length + '자 (최대 ' + SUMMARY_MAX + '자)';
        return '';
    }

    async function fetchLongTerm(chatId) {
        var cards = [];
        var cursor = null;
        var seenCursors = new Set();
        var seenIds = new Set();
        var userCount = null;
        while (true) {
            var path = '/summaries?limit=20&type=longTerm&orderBy=newest&filter=all';
            if (cursor) path += '&cursor=' + encodeURIComponent(cursor);
            var res = await apiCall('GET', path, null, chatId);
            if (!res || !res.data || !Array.isArray(res.data.summaries)) throw new Error('장기기억 목록 응답 형식이 올바르지 않습니다.');
            if (userCount == null) {
                var count = Number(res.data.userCreatedCount);
                if (Number.isFinite(count) && count >= 0) userCount = count;
            }
            if (!res.data.summaries.length) {
                if (res.data.nextCursor) throw new Error('장기기억 페이지 응답이 불완전합니다.');
                break;
            }
            res.data.summaries.forEach(function (item) {
                var id = String(summaryId(item) || '').toLowerCase();
                if (id && seenIds.has(id)) throw new Error('장기기억 목록에 중복 ID가 있습니다.');
                if (id) seenIds.add(id);
            });
            cards = cards.concat(res.data.summaries);
            if (!res.data.nextCursor) break;
            cursor = String(res.data.nextCursor);
            if (seenCursors.has(cursor)) throw new Error('장기기억 페이지 커서가 반복되었습니다.');
            seenCursors.add(cursor);
            await pause(READ_GAP_MS);
        }
        if (userCount == null) userCount = cards.filter(isUserAdded).length;
        return { cards: cards, userCount: userCount };
    }

    function oldestFirst(items) {
        return items.slice().sort(function (a, b) {
            var at = Date.parse(a && (a.createdAt || a.updatedAt) || '');
            var bt = Date.parse(b && (b.createdAt || b.updatedAt) || '');
            at = Number.isFinite(at) ? at : 0;
            bt = Number.isFinite(bt) ? bt : 0;
            return at - bt || String(summaryId(a) || '').localeCompare(String(summaryId(b) || ''));
        });
    }

    function commentSafe(text) {
        return String(text || '').replace(/\r\n?/g, '\n').trim().replace(/#/g, 'T').replace(/[()]/g, '/').replace(/\n\s*\n/g, '\n');
    }

    function commentPrefix() {
        var prefix = String(localStorage.getItem(PREFIX_KEY) || '').trim().replace(/\[/g, '(').replace(/\]/g, ')');
        return prefix || DEFAULT_PREFIX;
    }

    function buildComment(cards) {
        var body = cards.map(function (card) {
            return '[' + commentSafe(card.title || '(제목 없음)') + ']\n' + commentSafe(card.summary);
        }).join('\n');
        return '[' + commentPrefix() + ']: # (\n' + body + '\n)';
    }

    function parseComment(text) {
        var raw = String(text || '').replace(/\r\n?/g, '\n').trim();
        if (!raw) throw new Error('붙여 넣을 주석이 비어 있습니다.');
        var open = raw.match(/^\[([\s\S]*?)\]:\s*#\s*\(\s*/);
        var body = (open ? raw.slice(open[0].length).replace(/\n?\)\s*$/, '') : raw).trim();
        if (!body) throw new Error('주석 안에 카드가 없습니다.');
        var cards = [];
        var current = null;
        body.split('\n').forEach(function (line) {
            var title = line.match(/^\[(.+)\]$/);
            if (title) {
                if (current) cards.push(current);
                current = { title: title[1].trim(), summary: '' };
                return;
            }
            if (!current) return;
            current.summary += (current.summary ? '\n' : '') + line;
        });
        if (current) cards.push(current);
        cards.forEach(function (card) { card.summary = card.summary.trim(); });
        cards = cards.filter(function (card) { return card.title && card.summary; });
        if (!cards.length) throw new Error('주석에서 카드를 찾지 못했습니다.');
        return cards;
    }

    async function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try { await navigator.clipboard.writeText(text); return; } catch (ignored) {}
        }
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
        document.body.appendChild(area);
        area.select();
        var copied = false;
        try { copied = document.execCommand('copy'); } catch (ignored) {}
        area.remove();
        if (!copied) throw new Error('브라우저가 클립보드 접근을 막았습니다.');
    }

    function toast(message) {
        var old = document.getElementById('ce-mem-toast');
        if (old) old.remove();
        var node = document.createElement('div');
        node.id = 'ce-mem-toast';
        node.textContent = message;
        document.body.appendChild(node);
        requestAnimationFrame(function () { node.dataset.show = 'true'; });
        setTimeout(function () {
            node.dataset.show = 'false';
            setTimeout(function () { if (node.isConnected) node.remove(); }, 300);
        }, 2600);
    }

    function withLock(chatId, action, watchChatId) {
        if (busy) return Promise.reject(new Error('다른 장기기억 작업이 진행 중입니다.'));
        var key = LOCK_PREFIX + String(chatId).toLowerCase();
        var now = Date.now();
        var current = null;
        try { current = JSON.parse(localStorage.getItem(key) || 'null'); } catch (ignored) {}
        if (current && current.owner !== SESSION_ID && current.expiresAt > now) {
            return Promise.reject(new Error('다른 탭에서 장기기억을 작업 중입니다.'));
        }
        localStorage.setItem(key, JSON.stringify({ owner: SESSION_ID, expiresAt: now + LOCK_MS }));
        busy = true;
        var timer = setInterval(function () {
            try {
                var live = JSON.parse(localStorage.getItem(key) || 'null');
                if (!live || live.owner !== SESSION_ID) return;
                live.expiresAt = Date.now() + LOCK_MS;
                localStorage.setItem(key, JSON.stringify(live));
            } catch (ignored) {}
        }, 60000);
        var watch = String(watchChatId || chatId).toLowerCase();
        return Promise.resolve().then(function () {
            return action(function () {
                if (String(getChatId() || '').toLowerCase() !== watch) throw new Error('작업 중 채팅방이 바뀌었습니다.');
            });
        }).finally(function () {
            clearInterval(timer);
            busy = false;
            try {
                var live = JSON.parse(localStorage.getItem(key) || 'null');
                if (live && live.owner === SESSION_ID) localStorage.removeItem(key);
            } catch (ignored) {}
        });
    }

    function findMemoryDialog() {
        return Array.prototype.find.call(document.querySelectorAll('[role="dialog"]'), function (dialog) {
            if (dialog.closest('.ce-mem-overlay')) return false;
            return Array.prototype.some.call(dialog.querySelectorAll('button'), function (button) {
                return button.textContent.trim() === '장기 기억';
            });
        }) || null;
    }

    function findTab(dialog, label) {
        return Array.prototype.find.call(dialog.querySelectorAll('button'), function (button) {
            return button.textContent.trim() === label;
        }) || null;
    }

    function refreshLongTerm(dialog) {
        var labels = ['장기 기억', '단기 기억', '관계도', '목표'];
        var tabs = labels.map(function (label) { return findTab(dialog, label); }).filter(Boolean);
        var longTab = findTab(dialog, '장기 기억');
        if (!longTab || tabs.length < 2) return;
        var marked = tabs.filter(function (tab) { return tab.classList.contains('bg-primary'); });
        var active = marked.length === 1 ? marked[0] === longTab : false;
        if (!active && tabs.length > 2) {
            var colors = tabs.map(function (tab) { return getComputedStyle(tab).backgroundColor; });
            var mine = colors[tabs.indexOf(longTab)];
            active = colors.filter(function (color) { return color === mine; }).length === 1;
        }
        if (!active) return;
        var other = tabs.find(function (tab) { return tab !== longTab; });
        if (!other) return;
        other.click();
        setTimeout(function () {
            if (!dialog.isConnected) return;
            var next = findTab(dialog, '장기 기억');
            if (next && !next.classList.contains('bg-primary')) next.click();
        }, 150);
    }

    function ensureStyle() {
        var style = document.getElementById('ce-mem-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'ce-mem-style';
            (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = [
            "@import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');",
            'button[data-ce-memory-tool]{background:#f3b4cf!important;color:#fff!important;border-color:#f3b4cf!important}',
            'button[data-ce-memory-tool][hidden]{display:none!important}',
            'button[data-ce-memory-tool]:hover{background:#f7c6dc!important;border-color:#f7c6dc!important}',
            'button[data-ce-memory-tool]:active{background:#e59ab8!important;border-color:#e59ab8!important}',
            '.ce-mem-overlay{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62);pointer-events:auto}',
            '.ce-mem-modal{width:min(420px,92vw);max-height:86vh;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#1c1c1e;color:rgba(255,255,255,.92);box-shadow:0 18px 46px rgba(0,0,0,.32);pointer-events:auto!important;position:relative;z-index:1}',
            '.ce-mem-overlay .ce-mem-head{display:flex!important;align-items:center!important;justify-content:space-between!important}',
            '.ce-mem-overlay .ce-mem-head h3{display:flex!important;align-items:center!important;margin:0!important;font-family:\'Jua\',sans-serif!important;font-size:24px!important;font-weight:400!important;line-height:1!important;letter-spacing:.01em!important;color:rgba(255,255,255,.94)!important}',
            '.ce-mem-overlay .ce-mem-heart{display:inline!important;margin:0 .16em!important;font-weight:500!important;color:#f7c6dc!important}',
            '.ce-mem-overlay .ce-mem-actions{display:flex!important;flex-flow:row nowrap!important;align-items:center!important;gap:6px!important;padding:4px!important;border-radius:14px!important;background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.14)!important}',
            '.ce-mem-overlay .ce-mem-actions .ce-mem-btn{flex:1 1 0!important;width:auto!important;min-width:0!important;height:36px!important;white-space:nowrap!important}',
            '.ce-mem-overlay .ce-mem-actions .ce-mem-btn.is-primary{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;border:0!important;border-radius:12px!important;background:linear-gradient(135deg,#f3b4cf,#f7c6dc)!important;color:rgba(255,255,255,.92)!important;box-shadow:0 4px 14px rgba(243,180,207,.28)!important}',
            '.ce-mem-overlay .ce-mem-actions .ce-mem-btn.is-primary svg{display:block!important;width:16px!important;height:16px!important;flex:0 0 auto!important}',
            '.ce-mem-overlay .ce-mem-pick{display:inline-flex!important;width:36px!important;height:36px!important;flex:0 0 36px!important}',
            '.ce-mem-x{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;padding:8px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.72);cursor:pointer;transition:.2s}',
            '.ce-mem-x:hover{background:rgba(255,80,80,.1);color:#ff6b6b;border-color:rgba(255,80,80,.1)}',
            '.ce-mem-x svg{display:block}',
            '.ce-mem-modal textarea{min-height:120px;resize:vertical;width:100%;box-sizing:border-box;padding:10px;border:1px solid rgba(243,180,207,.48);border-radius:14px;background:rgba(243,180,207,.22);color:rgba(255,255,255,.92);font:inherit;font-size:13px}',
            '.ce-mem-modal textarea::placeholder{color:rgba(255,255,255,.52)}',
            '.ce-mem-actions{display:flex;gap:6px;padding:4px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)}',
            '.ce-mem-actions .ce-mem-btn{flex:1;height:36px;white-space:nowrap}',
            '.ce-mem-pick{width:36px;height:36px;flex:0 0 36px;padding:0;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.92);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}',
            '.ce-mem-pick:hover{background:rgba(243,180,207,.16);color:#f7c6dc}',
            '.ce-mem-pick:disabled{opacity:.45;cursor:not-allowed}',
            '.ce-mem-picker{display:flex;flex-direction:column;gap:8px;padding:8px;border:1px solid rgba(243,180,207,.48);border-radius:14px;background:rgba(243,180,207,.12)}',
            '.ce-mem-picker[hidden]{display:none}',
            '.ce-mem-picker-search{width:100%;box-sizing:border-box;height:36px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:10px!important;background:#1c1c1e!important;color:rgba(255,255,255,.92)!important;padding:0 10px!important;font:inherit!important;font-size:13px!important;line-height:36px!important;outline:none}',
            '.ce-mem-picker-list{display:flex;flex-direction:column;gap:4px;max-height:220px;overflow:auto}',
            '.ce-mem-picker-item{display:flex!important;align-items:center!important;gap:8px!important;box-sizing:border-box;width:100%;min-height:44px!important;height:auto!important;margin:0!important;padding:6px 10px!important;border:0!important;border-radius:10px!important;background:rgba(28,28,30,.72)!important;color:rgba(255,255,255,.94)!important;font-family:inherit!important;font-size:13px!important;font-weight:500!important;line-height:1.35!important;text-align:left!important;cursor:pointer}',
            '.ce-mem-picker-item:hover{background:rgba(243,180,207,.28)!important}',
            '.ce-mem-picker-icon{width:28px;height:28px;flex:0 0 28px;border-radius:999px;object-fit:cover;background:rgba(255,255,255,.08)}',
            '.ce-mem-picker-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.ce-mem-btn{height:36px;padding:0 14px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.06);color:#9ca3af;font:inherit;font-size:13px;font-weight:650;cursor:pointer}',
            '.ce-mem-btn.is-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#f3b4cf,#f7c6dc);border-color:transparent;color:rgba(255,255,255,.92);box-shadow:0 4px 14px rgba(243,180,207,.28);transition:all .25s}',
            '.ce-mem-btn.is-primary svg{display:block;flex:0 0 auto}',
            '.ce-mem-btn.is-primary:hover{background:linear-gradient(135deg,#f7c6dc,#f3b4cf);border-color:transparent;transform:translateY(-1px);box-shadow:0 6px 20px rgba(243,180,207,.28)}',
            '.ce-mem-btn:disabled{opacity:.45;cursor:not-allowed}',
            '.ce-mem-status{min-height:18px;color:rgba(255,255,255,.72);font-size:12px;white-space:pre-wrap}',
            '#ce-mem-toast{position:fixed;left:50%;top:18px;z-index:100001;transform:translateX(-50%) translateY(-8px);padding:10px 14px;border-radius:10px;background:#1c1c1e;color:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.12);opacity:0;transition:opacity .2s,transform .2s}',
            '#ce-mem-toast[data-show="true"]{opacity:1;transform:translateX(-50%) translateY(0)}'
        ].join('');
        (document.head || document.documentElement).appendChild(style);
    }

    function hideMemoryProAd(dialog) {
        var walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
            if ((node.textContent || '').indexOf('메모리 PRO') === -1) continue;
            var el = node.parentElement;
            if (!el) return;
            while (el.parentElement && el.parentElement !== dialog && (el.parentElement.textContent || '').indexOf('장기 기억') === -1) el = el.parentElement;
            if (el !== dialog) el.style.setProperty('display', 'none', 'important');
            return;
        }
    }

    function tabText(node) {
        return (node && node.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function isVisible(node) {
        var el = node;
        while (el && el !== document.documentElement) {
            if (el.hasAttribute && el.hasAttribute('hidden')) return false;
            var style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            el = el.parentElement;
        }
        return !!node;
    }

    function pillLabel(button) {
        return tabText(button).replace(/\s*[▾⌄▼˅∨]\s*$/u, '');
    }

    function memoryPills(dialog) {
        var labels = ['장기 기억', '단기 기억', '관계도', '목표'];
        return labels.map(function (label) {
            return Array.prototype.find.call(dialog.querySelectorAll('button'), function (button) {
                return pillLabel(button) === label;
            }) || null;
        }).filter(Boolean);
    }

    function fillScore(color) {
        var match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return 0;
        var alpha = match[4] == null ? 1 : Number(match[4]);
        if (!alpha) return 0;
        return ((Number(match[1]) * 299 + Number(match[2]) * 587 + Number(match[3]) * 114) / 1000) * alpha;
    }

    function activePill(pills) {
        var marked = pills.filter(function (tab) {
            return tab.classList.contains('bg-primary') || tab.classList.contains('bg-white') || tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('data-state') === 'active';
        });
        if (marked.length === 1) return marked[0];
        var best = null;
        var bestScore = -1;
        var second = -1;
        pills.forEach(function (tab) {
            var score = fillScore(getComputedStyle(tab).backgroundColor);
            if (score > bestScore) {
                second = bestScore;
                bestScore = score;
                best = tab;
            } else if (score > second) {
                second = score;
            }
        });
        if (!best || bestScore < second + 40) return null;
        return best;
    }

    function showsCommentButton(dialog) {
        var pills = memoryPills(dialog);
        var active = activePill(pills);
        return !!(active && pillLabel(active) === '장기 기억');
    }

    function setCommentVisible(button, show) {
        if (!button) return;
        button.hidden = !show;
        if (show) button.style.removeProperty('display');
        else button.style.setProperty('display', 'none', 'important');
    }

    function bindCommentButton(button) {
        if (button.getAttribute('data-lynn-memory') === '1') return button;
        var fresh = button.cloneNode(true);
        fresh.setAttribute('data-lynn-memory', '1');
        fresh.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
        fresh.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            openModal();
        });
        button.replaceWith(fresh);
        return fresh;
    }

    function injectButton() {
        var dialog = findMemoryDialog();
        if (!dialog) return;
        hideMemoryProAd(dialog);
        var existing = dialog.querySelector('[data-ce-memory-tool]');
        var editBtn = null;
        if (showsCommentButton(dialog)) {
            editBtn = Array.prototype.find.call(dialog.querySelectorAll('button'), function (button) {
                if (!isVisible(button) || button.textContent.trim() !== '편집' || button.hasAttribute('data-ce-memory-tool')) return false;
                return button.parentElement && Array.prototype.some.call(button.parentElement.children, function (sibling) {
                    return sibling !== button && sibling.textContent && sibling.textContent.trim() === '추가';
                });
            }) || null;
        }
        if (!editBtn) {
            setCommentVisible(existing, false);
            return;
        }
        if (!existing) {
            ensureStyle();
            existing = document.createElement('button');
            existing.type = 'button';
            existing.className = editBtn.className;
            existing.classList.remove('bg-primary');
            existing.setAttribute('data-ce-memory-tool', 'true');
            existing.setAttribute('data-lynn-memory', '1');
            existing.textContent = '주석';
            existing.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
            existing.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                openModal();
            });
        } else {
            existing = bindCommentButton(existing);
        }
        setCommentVisible(existing, true);
        if (existing.nextElementSibling !== editBtn) editBtn.before(existing);
    }

    var injectQueued = false;
    function scheduleInject() {
        if (injectQueued) return;
        injectQueued = true;
        requestAnimationFrame(function () {
            injectQueued = false;
            injectButton();
        });
    }

    function openModal() {
        var current = document.querySelector('.ce-mem-overlay');
        if (current && current.getAttribute('data-lynn-memory-overlay') === '1') return;
        if (current) current.remove();
        var chatId = getChatId();
        if (!chatId) { toast('채팅방을 찾지 못했습니다.'); return; }
        ensureStyle();
        var overlay = document.createElement('div');
        overlay.className = 'ce-mem-overlay';
        overlay.setAttribute('data-lynn-memory-overlay', '1');
        var copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        var pasteIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>';
        var closeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        var listIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';
        overlay.innerHTML = '<div class="ce-mem-modal" aria-label="장기 기억">' +
            '<div class="ce-mem-head"><h3><span class="ce-mem-heart" aria-hidden="true">♥</span>장기 기억<span class="ce-mem-heart" aria-hidden="true">♥</span></h3><button type="button" class="ce-mem-x" aria-label="닫기">' + closeIcon + '</button></div>' +
            '<div class="ce-mem-actions" style="display:flex;flex-flow:row nowrap;align-items:center;gap:6px;padding:4px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)"><button type="button" class="ce-mem-btn is-primary" data-copy style="display:inline-flex;flex:1 1 0;align-items:center;justify-content:center;gap:6px;height:36px;border:0;border-radius:12px;background:linear-gradient(135deg,#f3b4cf,#f7c6dc);color:rgba(255,255,255,.92);box-shadow:0 4px 14px rgba(243,180,207,.28)">' + copyIcon + '장기 기억 전체 복사</button><button type="button" class="ce-mem-btn is-primary" data-paste style="display:inline-flex;flex:1 1 0;align-items:center;justify-content:center;gap:6px;height:36px;border:0;border-radius:12px;background:linear-gradient(135deg,#f3b4cf,#f7c6dc);color:rgba(255,255,255,.92);box-shadow:0 4px 14px rgba(243,180,207,.28)">' + pasteIcon + '붙여넣기</button><button type="button" class="ce-mem-pick" data-pick aria-label="채팅" style="display:inline-flex;width:36px;height:36px;flex:0 0 36px;align-items:center;justify-content:center">' + listIcon + '</button></div>' +
            '<div class="ce-mem-picker" hidden><input class="ce-mem-picker-search" type="text" autocomplete="off"><div class="ce-mem-picker-list"></div></div>' +
            '<textarea spellcheck="false" placeholder="복사한 주석"></textarea>' +
            '<div class="ce-mem-status" role="status"></div>' +
        '</div>';
        var host = findMemoryDialog() || document.body;
        if (host !== document.body && getComputedStyle(host).position === 'static') host.style.position = 'relative';
        host.appendChild(overlay);
        var copyBtn = overlay.querySelector('[data-copy]');
        var pasteBtn = overlay.querySelector('[data-paste]');
        var pickBtn = overlay.querySelector('[data-pick]');
        var picker = overlay.querySelector('.ce-mem-picker');
        var pickerSearch = overlay.querySelector('.ce-mem-picker-search');
        var pickerList = overlay.querySelector('.ce-mem-picker-list');
        var input = overlay.querySelector('textarea');
        var status = overlay.querySelector('.ce-mem-status');
        var closeBtn = overlay.querySelector('.ce-mem-x');
        var running = false;
        var chatRooms = [];
        function setStatus(message) { status.textContent = message || ''; }
        function setRunning(value) {
            running = value;
            copyBtn.disabled = value;
            pasteBtn.disabled = value;
            pickBtn.disabled = value;
            input.disabled = value;
            pickerSearch.disabled = value;
        }
        function hidePicker() {
            picker.hidden = true;
            input.hidden = false;
        }
        function showPicker() {
            picker.hidden = false;
            input.hidden = true;
        }
        function renderPicker() {
            var query = pickerSearch.value.trim().toLowerCase();
            pickerList.textContent = '';
            chatRooms.forEach(function (room) {
                var name = chatLabel(room);
                if (query && name.toLowerCase().indexOf(query) === -1) return;
                var item = document.createElement('div');
                item.setAttribute('role', 'button');
                item.tabIndex = 0;
                item.className = 'ce-mem-picker-item';
                var thumbs = chatThumbCandidates(room);
                var icon = document.createElement('img');
                icon.className = 'ce-mem-picker-icon';
                icon.alt = '';
                var thumbIndex = 0;
                icon.onerror = function () {
                    thumbIndex += 1;
                    icon.src = thumbs[thumbIndex] || EMPTY_CHAT_AVATAR;
                    if (!thumbs[thumbIndex]) icon.onerror = null;
                };
                icon.src = thumbs[0] || EMPTY_CHAT_AVATAR;
                item.appendChild(icon);
                var label = document.createElement('span');
                label.className = 'ce-mem-picker-name';
                label.textContent = name;
                item.appendChild(label);
                item.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (running) return;
                    hidePicker();
                    pasteInto(chatRoomId(room), name);
                });
                pickerList.appendChild(item);
            });
        }
        function close() {
            if (running || !overlay.isConnected) return;
            document.removeEventListener('keydown', onKey, true);
            overlay.remove();
        }
        function onKey(event) {
            if (event.key !== 'Escape' || !overlay.isConnected) return;
            event.preventDefault();
            event.stopPropagation();
            if (!picker.hidden) { hidePicker(); return; }
            close();
        }
        closeBtn.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
        closeBtn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            close();
        });
        overlay.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
        overlay.addEventListener('click', function (event) {
            event.stopPropagation();
            if (event.target === overlay) close();
        });
        document.addEventListener('keydown', onKey, true);

        copyBtn.addEventListener('click', async function (event) {
            if (event) event.stopPropagation();
            if (running) return;
            setRunning(true);
            setStatus('');
            try {
                var state = await fetchLongTerm(chatId);
                var cards = oldestFirst(state.cards);
                if (!cards.length) { setStatus('장기 기억이 없습니다.'); return; }
                await copyText(buildComment(cards));
                toast('장기 기억 ' + cards.length + '개를 복사했습니다.');
            } catch (error) {
                setStatus(errorText(error));
            } finally {
                setRunning(false);
            }
        });

        pasteBtn.addEventListener('click', function (event) {
            if (event) event.stopPropagation();
            pasteInto(chatId);
        });

        async function readSource() {
            var source = input.value;
            if (!String(source || '').trim()) {
                try { source = await navigator.clipboard.readText(); } catch (ignored) { source = ''; }
                if (!String(source || '').trim()) {
                    setStatus('클립보드를 읽지 못했습니다. 칸에 직접 붙여넣으세요.');
                    return null;
                }
                input.value = source;
            }
            return source;
        }

        function readyCards(source) {
            var imported;
            try { imported = parseComment(source); }
            catch (error) { setStatus(error.message); return null; }
            var problems = [];
            imported.forEach(function (card, index) {
                var problem = cardProblem(card);
                if (problem) problems.push((index + 1) + '번째 [' + card.title.slice(0, 20) + ']: ' + problem);
            });
            if (problems.length) { setStatus(problems.slice(0, 6).join('\n')); return null; }
            return imported;
        }

        async function pasteInto(targetChatId, label) {
            if (running || !targetChatId) return;
            var source = await readSource();
            if (source == null) return;
            var imported = readyCards(source);
            if (!imported) return;
            hidePicker();
            setRunning(true);
            setStatus('');
            try {
                await withLock(targetChatId, async function (assertReady) {
                    var state = await fetchLongTerm(targetChatId);
                    assertReady();
                    var known = new Set(state.cards.map(cardSignature));
                    var additions = [];
                    var skipped = 0;
                    imported.forEach(function (card) {
                        var signature = cardSignature(card);
                        if (known.has(signature)) skipped++;
                        else { additions.push(card); known.add(signature); }
                    });
                    if (!additions.length) { setStatus('이미 있는 카드입니다.'); return; }
                    if (state.userCount + additions.length > USER_CARD_LIMIT) {
                        throw new Error('[추가] 카드 한도 ' + USER_CARD_LIMIT + '개를 넘습니다.');
                    }
                    if (!confirm((label ? label + ' · ' : '') + additions.length + '개 추가')) return;
                    for (var i = 0; i < additions.length; i++) {
                        if (i) await pause(WRITE_GAP_MS);
                        assertReady();
                        setStatus('추가 ' + (i + 1) + '/' + additions.length);
                        var response = await apiCall('POST', '/summaries', { type: 'longTerm', title: additions[i].title, summary: additions[i].summary }, targetChatId);
                        if (!response || response.success === false || /^(?:FAIL|FAILED|FAILURE|ERROR)$/i.test(String(response.result || ''))) {
                            throw new Error('서버가 장기기억 추가를 확인하지 않았습니다.');
                        }
                    }
                    if (String(targetChatId).toLowerCase() === String(chatId).toLowerCase()) {
                        var dialog = findMemoryDialog();
                        if (dialog) refreshLongTerm(dialog);
                    }
                    setStatus('');
                    toast(additions.length + '개 추가' + (skipped ? ' · ' + skipped + '개 건너뜀' : ''));
                }, chatId);
            } catch (error) {
                setStatus(errorText(error));
            } finally {
                setRunning(false);
            }
        }

        pickBtn.addEventListener('click', async function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (running) return;
            if (!picker.hidden) { hidePicker(); return; }
            showPicker();
            pickerList.textContent = '';
            pickerSearch.value = '';
            setRunning(true);
            setStatus('');
            try {
                chatRooms = await fetchChatList();
                renderPicker();
                if (!chatRooms.length) setStatus('채팅방이 없습니다.');
            } catch (error) {
                setStatus(errorText(error));
            } finally {
                setRunning(false);
            }
        });
        pickerSearch.addEventListener('input', function () { renderPicker(); });
    }

    function start() {
        ensureStyle();
        scheduleInject();
        document.addEventListener('click', function (event) {
            var button = event.target && event.target.closest && event.target.closest('button,[role="tab"],[role="menuitem"],[role="option"]');
            if (!button) return;
            var label = pillLabel(button);
            if (label === '장기 기억' || label === '단기 기억' || label === '관계도' || label === '목표' || tabText(button) === '직접 추가') scheduleInject();
        }, true);
        new MutationObserver(function () { scheduleInject(); }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
