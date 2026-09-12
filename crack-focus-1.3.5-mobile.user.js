// ==UserScript==
// @name         크랙 집중 모드
// @namespace    local.crack.focus
// @version      1.3.5
// @description  버튼 하나로 대화와 입력칸만 표시하고 원래 화면으로 복원합니다. 모바일: 터치로 전환, 길게 눌렀다 떼어 숨길 버튼 선택.
// @match        https://crack.wrtn.ai/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const ID = 'crack-focus-toggle';
  if (document.getElementById(ID)) return;
  const ATTR = 'data-crack-focus';
  const marked = new Map();
  let active = false;
  let panel = null;
  let route = location.pathname;
  let timer;
  let selectionStep = 0;
  let selectedInput = null;
  const extraTargets = new Set();
  const extraStyles = new Map();
  const extraSelectors = new Set();
  const extraCSS = document.createElement('style');
  document.head.append(extraCSS);
  function rememberExtra(target) {
    extraTargets.add(target);
    // CrackSafe resets inline display every five seconds. Match replacement nodes too.
    if (target.matches('.hcd-fab') || target.querySelector('.hcd-fab')) extraSelectors.add('.hcd-fab');
    else if (target.id) extraSelectors.add('#' + CSS.escape(target.id));
    updateExtraCSS();
  }
  function updateExtraCSS() {
    const selectors = [...extraSelectors].map(s => 'html[data-crack-focus-active] ' + s);
    const css = selectors.length ? selectors.join(',') + '{display:none!important;visibility:hidden!important;transition:none!important;animation:none!important;}' : '';
    if (extraCSS.textContent !== css) extraCSS.textContent = css;
  }
  let picker = null;

  function hideExtras() {
    for (const target of extraTargets) {
      if (!target.isConnected || target.contains(button) || target.contains(panel)) continue;
      if (!extraStyles.has(target)) extraStyles.set(target, {
        value: target.style.getPropertyValue('display'),
        priority: target.style.getPropertyPriority('display')
      });
      if (target.style.getPropertyValue('display') !== 'none' || target.style.getPropertyPriority('display') !== 'important') target.style.setProperty('display', 'none', 'important');
    }
  }

  function restoreExtras() {
    for (const [target, previous] of extraStyles) {
      if (previous.value) target.style.setProperty('display', previous.value, previous.priority);
      else target.style.removeProperty('display');
    }
    extraStyles.clear();
  }

  function extraTarget(clicked, explicit = false) {
    if (!(clicked instanceof Element) || !panel || clicked.contains(button) ||
        button.contains(clicked) || clicked.contains(panel) || clicked === picker ||
        clicked.closest('textarea, input, [contenteditable="true"]')) return null;
    let chosen = clicked.closest('button, [role="button"], a') || clicked;
    let floating = false;
    // 작은 고정형 위젯은 배지와 그림자까지 함께 숨긴다.
    // Shadow DOM 내부 버튼은 문서에 노출된 호스트를 대상으로 한다.
    for (let node = chosen; node && node !== document.body; node = node.parentElement) {
      if (node.contains(panel) || node.contains(button)) break;
      const r = node.getBoundingClientRect();
      if (r.width > 480 || r.height > 240) break;
      if (getComputedStyle(node).position === 'fixed') { chosen = node; floating = true; }
    }
    if (chosen.contains(panel) || chosen.contains(button) ||
        chosen.querySelector('textarea, input, [contenteditable="true"]')) return null;
    const bounds = chosen.getBoundingClientRect();
    if (bounds.width > 480 || bounds.height > 240) return null;
    if (panel.contains(clicked) && !floating && !explicit) return null;
    return chosen;
  }

  function closePicker() {
    picker?.remove();
    picker = null;
  }

  function resetExtras() {
    restoreExtras();
    extraTargets.clear();
    extraSelectors.clear();
    updateExtraCSS();
  }

  function openPicker(event) {
    if (!active) return;
    event.preventDefault();
    closePicker();
    picker = document.createElement('div');
    picker.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;cursor:crosshair!important;background:transparent!important;touch-action:none!important;';
    const hint = document.createElement('div');
    hint.textContent = '숨길 버튼을 터치/클릭하세요';
    hint.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);background:#222;color:white;padding:12px 18px;border-radius:10px;font:14px sans-serif;pointer-events:none;max-width:calc(100vw - 32px);box-sizing:border-box;text-align:center;';
    const actions = document.createElement('div');
    actions.style.cssText = 'position:absolute;top:76px;left:50%;transform:translateX(-50%);display:flex;gap:8px;white-space:nowrap;';
    const cancel = document.createElement('button');
    const reset = document.createElement('button');
    cancel.textContent = '취소';
    reset.textContent = '숨김 지정 초기화';
    for (const control of [cancel, reset]) {
      control.type = 'button';
      control.style.cssText = 'min-height:44px;padding:8px 14px;border:1px solid #777;border-radius:8px;background:#222;color:#fff;font:14px sans-serif;touch-action:manipulation;';
      actions.append(control);
    }
    picker.append(hint, actions);
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click']) {
      picker.addEventListener(type, e => {
        // Let touch/pen pointerdown produce its normal click in Firefox.
        if (type === 'click' || type === 'mousedown' || type === 'mouseup' || e.pointerType === 'mouse') e.preventDefault();
        e.stopImmediatePropagation();
        if (type !== 'click') return;
        if (cancel.contains(e.target)) { closePicker(); return; }
        if (reset.contains(e.target)) { resetExtras(); closePicker(); return; }
        if (actions.contains(e.target)) return;
        picker.style.setProperty('pointer-events', 'none', 'important');
        const clicked = document.elementFromPoint(e.clientX, e.clientY);
        picker.style.removeProperty('pointer-events');
        const target = extraTarget(clicked, true);
        if (!target) { hint.textContent = '작은 버튼 안쪽을 터치/클릭하세요'; return; }
        rememberExtra(target);
        hideExtras();
        closePicker();
      });
    }
    document.body.append(picker);
  }

  const style = document.createElement('style');
  style.textContent = `
    [${ATTR}="hide"] { display: none !important; }
    [${ATTR}="ancestor"] {
      transform: none !important; filter: none !important;
      perspective: none !important; contain: none !important;
      overflow: visible !important; clip-path: none !important;
    }
    [${ATTR}="panel"] {
      position: fixed !important; inset: 0 !important;
      width: 100% !important; height: 100dvh !important;
      min-width: 0 !important; max-width: none !important;
      min-height: 0 !important; max-height: none !important;
      margin: 0 !important; padding: 0 !important;
      flex: none !important; z-index: 30 !important;
      box-sizing: border-box !important;
    }
    #${ID} {
      position: fixed !important; inset: auto !important;
      left: var(--cf-left, calc(100vw - 52px)) !important; top: var(--cf-top, calc(100dvh - 56px)) !important;
      z-index: 2147483646 !important; width: 30px !important; height: 30px !important;
      display: inline-flex !important; align-items: center !important; justify-content: center !important;
      padding: 0 !important; margin: 0 !important; border-radius: 5px !important;
      border: 0 !important; background: transparent !important;
      color: #b5b8bd !important; font: 24px/1 system-ui,sans-serif !important;
      touch-action: none !important; user-select: none !important; -webkit-user-select: none !important;
      cursor: pointer !important; box-shadow: none !important; opacity: .65 !important;
    }
    #${ID}:hover, #${ID}:focus-visible { opacity: 1 !important; background: #b5b8bd18 !important; }
    #${ID}:focus-visible { outline: 2px solid #b5b8bd; outline-offset: 2px; }
    #${ID}[hidden] { display: none !important; }
    html[data-crack-focus-active] :is([role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]) { z-index: 100 !important; }
  `;
  document.head.append(style);
  const button = document.createElement('button');
  button.id = ID;
  button.type = 'button';
  document.body.append(button);

  function visible(element) {
    const r = element.getBoundingClientRect();
    return r.width > 10 && r.height > 10 && r.bottom > 0 && r.top < innerHeight &&
      r.right > 0 && r.left < innerWidth && getComputedStyle(element).visibility !== 'hidden';
  }

  function chatInputs() {
    return [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
      .filter(el => visible(el) && !el.closest('[role="dialog"],[role="alertdialog"]'))
      .sort((a,b) => b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom);
  }
  function findSend() {
    for (const input of chatInputs()) {
      const ir=input.getBoundingClientRect();
      for (let root=input.parentElement; root && root !== document.body; root=root.parentElement) {
        const candidates=[...root.querySelectorAll('button,[role="button"]')].filter(el => {
          if (el===button || !visible(el)) return false;
          const r=el.getBoundingClientRect();
          return r.top <= ir.bottom+100 && r.bottom >= ir.top-16;
        });
        const explicit=candidates.find(el => /보내기|전송|send/i.test([el.getAttribute('aria-label'),el.title,el.getAttribute('data-testid'),el.textContent].join(' ')));
        if (explicit) return explicit;
        const submit=candidates.find(el => el.matches('button[type="submit"]'));
        if (submit) return submit;
        // Icon-only send buttons can be disabled while the composer is empty.
        const icon=candidates.filter(el => {
          const r=el.getBoundingClientRect();
          return el.querySelector('svg,img') && !el.textContent.trim() &&
            r.width<=72 && r.height<=72 && r.left >= ir.right-100;
        }).sort((a,b)=>b.getBoundingClientRect().right-a.getBoundingClientRect().right)[0];
        if (icon) return icon;
        if (root === panel || root.querySelector('.stick-to-bottom')) break;
      }
    }
    return null;
  }
  function placeButton() {
    // Keep our control out of React-managed/overflow-clipped input wrappers.
    if (button.parentElement !== document.body) document.body.append(button);
    const anchor=findSend();
    const input=chatInputs()[0];
    const chatRoute=/^\/stories\/[^/]+\/episodes(?:\/|$)/.test(location.pathname);
    button.hidden=!(anchor || input || active || selectionStep || chatRoute);
    let x=innerWidth-48, y=innerHeight-52;
    if (anchor) {
      const r=anchor.getBoundingClientRect();
      x=r.left-36; y=r.top+(r.height-30)/2;
    } else if (input) {
      const r=input.getBoundingClientRect();
      x=r.right+8; y=r.bottom-32;
      if (x+30 > innerWidth-8) { x=r.right-34; y=r.top-36; }
    }
    button.style.setProperty('--cf-left',Math.max(8,Math.min(innerWidth-38,x))+'px');
    button.style.setProperty('--cf-top',Math.max(8,Math.min(innerHeight-38,y))+'px');
  }
  const popups='[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]';
  function findPanel() {
    if (!/^\/stories\/[^/]+\/episodes(?:\/|$)/.test(location.pathname)) return null;
    // 공개 플레이 화면에서 확인한 대화 스크롤 영역과 입력칸.
    if (active && panel?.isConnected) return panel;
    const inputs = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'))
      .filter(el => visible(el) && !el.closest('[role="dialog"], [role="alertdialog"]'))
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    for (const input of inputs) {
      if (!input.getClientRects().length) continue;
      const scroll = input.closest('.stick-to-bottom');
      if (scroll?.parentElement && scroll.parentElement !== document.body) return scroll.parentElement;
      // 입력칸이 스크롤 영역 바깥에 있는 배치에서는 공통 부모를 찾는다.
      for (let parent = input.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (parent.matches('#__next') || parent.querySelector('nav, aside')) break;
        if (parent.querySelector('.stick-to-bottom')) return parent;
        // 클래스 이름이 다른 화면은 입력칸과 별개의 큰 스크롤 영역으로 찾는다.
        const r = parent.getBoundingClientRect();
        if (r.height < 250 || r.width < 250) continue;
        const hasMenu = Array.from(parent.querySelectorAll('button, [role="button"]'))
          .some(el => el.textContent.trim() === '키보드 단축키');
        if (hasMenu) break;
        const conversation = Array.from(parent.querySelectorAll('div, section, [role="log"]'))
          .find(el => {
            if (el.contains(input) || !visible(el)) return false;
            const rect = el.getBoundingClientRect();
            return rect.height > 200 && rect.width > 250 &&
              /auto|scroll/.test(getComputedStyle(el).overflowY);
          });
        if (conversation) return parent;
      }
    }
    return null;
  }

  function mark(element, value) {
    if (!marked.has(element)) marked.set(element, element.getAttribute(ATTR));
    if (element.getAttribute(ATTR) !== value) element.setAttribute(ATTR, value);
  }

  function restore() {
    closePicker();
    document.documentElement.removeAttribute('data-crack-focus-active');
    restoreExtras();
    for (const [element, previous] of marked) {
      if (previous === null) element.removeAttribute(ATTR);
      else element.setAttribute(ATTR, previous);
    }
    marked.clear();
    panel = null;
  }

  function apply(target) {
    if (panel && panel !== target) restore();
    panel = target;
    document.documentElement.setAttribute('data-crack-focus-active','');
    mark(target, 'panel');
    // 요소를 이동하거나 삭제하지 않고 주변 영역만 숨긴다.
    // body 바로 아래의 대화상자와 알림은 유지한다.
    for (let child = target; child.parentElement && child.parentElement !== document.body;
      child = child.parentElement) {
      const parent = child.parentElement;
      mark(parent, 'ancestor');
      for (const sibling of parent.children) {
        if (sibling === child || sibling === button || sibling.matches('script,style,link,section') || sibling.matches(popups) || sibling.querySelector(popups)) {
          if (sibling.getAttribute(ATTR)==='hide') {
            const previous=marked.get(sibling);
            if (previous == null) sibling.removeAttribute(ATTR); else sibling.setAttribute(ATTR,previous);
            marked.delete(sibling);
          }
          continue;
        }
        mark(sibling, 'hide');
      }
    }
    hideExtras();
  }

  function refreshButton() {
    const text = selectionStep ? '×' : active ? '↙' : '□';
    if (button.textContent !== text) button.textContent = text;
    const label = active ? '원래 화면으로 돌아가기' : '집중 모드 켜기';
    button.title = label + ' (Option/Alt+Shift+F)\n길게 눌렀다 떼기/우클릭: 숨길 버튼 선택\nAlt/Option+클릭: 외부 버튼 숨기기\nOption/Alt+Shift+R: 숨김 지정 초기화';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(active));
    placeButton();
  }

  function sync() {
    const target = findPanel();
    if (route !== location.pathname || !target) {
      route = location.pathname;
      if (active || marked.size) restore();
      active = false;
    }
    button.hidden = false;
    if (!button.isConnected) document.body.append(button);
    if (active && target) apply(target);
    refreshButton();
  }

  function toggle() {
    if (selectionStep) { selectionStep = 0; selectedInput = null; refreshButton(); return; }
    if (active) {
      active = false;
      restore();
    } else {
      const target = findPanel();
      if (!target) {
        selectionStep = 1;
        refreshButton();
        alert('화면 구조가 달라 직접 영역을 지정합니다.\n\n1. 메시지를 쓰는 입력칸 안쪽을 클릭하세요.\n2. 대화 본문의 글이나 그림을 클릭하세요.\n\n두 영역의 공통 공간만 집중 모드로 표시합니다. 선택은 Esc로 취소할 수 있습니다.');
        return;
      }
      active = true;
      placeButton();
      apply(target);
    }
    refreshButton();
  }

  button.addEventListener('click', toggle);
  let touchPress = null;
  let suppressTouchClickUntil = 0;
  let lastTouchAt = -Infinity;
  // Capture only this control: chat scrolling and ordinary taps stay unchanged.
  button.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    lastTouchAt = performance.now();
    if (!event.isPrimary) {
      // Keep the primary press until release so its eventual click is suppressed.
      if (touchPress) touchPress.moved = true;
      return;
    }
    touchPress = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), moved: false };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (touchPress?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - touchPress.x, event.clientY - touchPress.y) > 12) touchPress.moved = true;
  });
  button.addEventListener('pointerup', event => {
    if (touchPress?.id !== event.pointerId) return;
    const press = touchPress;
    touchPress = null;
    lastTouchAt = performance.now();
    if (!press.moved && performance.now() - press.at < 550) return;
    event.preventDefault();
    // A long press must not also toggle the mode or select through the overlay.
    suppressTouchClickUntil = performance.now() + 800;
    if (press.moved) return;
    if (!active) toggle();
    if (active) openPicker(event);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, event => {
      if (touchPress?.id !== event.pointerId) return;
      touchPress = null;
      suppressTouchClickUntil = performance.now() + 800;
    });
  }
  // A new physical tap is intentional, even immediately after a long press.
  window.addEventListener('pointerdown', () => { suppressTouchClickUntil = 0; }, true);
  window.addEventListener('click', event => {
    if (performance.now() >= suppressTouchClickUntil) return;
    suppressTouchClickUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  button.addEventListener('contextmenu', event => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen' ||
        touchPress || performance.now() - lastTouchAt < 1200) {
      event.preventDefault();
      return;
    }
    openPicker(event);
  });
  // 대상 버튼의 원래 동작보다 먼저 이벤트를 막는다.
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    window.addEventListener(type, event => {
      if (!active || !event.altKey || selectionStep || picker) return;
      const target = extraTarget(event.target);
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (type === 'click') {
        rememberExtra(target);
        hideExtras();
      }
    }, true);
  }
  document.addEventListener('click', event => {
    if (!selectionStep || button.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (selectionStep === 1) {
      selectedInput = event.target.closest('textarea, input, [contenteditable="true"], [role="textbox"]');
      if (!selectedInput) return;
      selectionStep = 2;
      alert('이제 대화 본문의 글이나 그림을 클릭하세요.');
      return;
    }
    if (event.target === selectedInput || selectedInput.contains(event.target)) return;
    let target = selectedInput.parentElement;
    while (target && !target.contains(event.target)) target = target.parentElement;
    if (!target || target.matches('body, html, #__next') || target.getBoundingClientRect().height < 200) {
      alert('대화 본문 안쪽을 다시 클릭해 주세요.');
      return;
    }
    selectionStep = 0;
    selectedInput = null;
    active = true;
    placeButton();
    apply(target);
    refreshButton();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && picker) { event.preventDefault(); closePicker(); return; }
    if (event.altKey && event.shiftKey && event.code === 'KeyR' && !event.repeat) {
      event.preventDefault();
      resetExtras();
      return;
    }
    if (event.key === 'Escape' && selectionStep) {
      selectionStep = 0; selectedInput = null; refreshButton(); return;
    }
    if (event.altKey && event.shiftKey && event.code === 'KeyF' && !event.repeat && !event.isComposing) {
      event.preventDefault();
      toggle();
    }
  });
  // 새 답변이나 화면 이동으로 요소가 다시 생성되는 경우에도 적용한다.
  new MutationObserver(records => {
    if (records.every(record => record.target === button || button.contains(record.target))) return;
    if (timer) return;
    timer = requestAnimationFrame(() => { timer = 0; sync(); });
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', placeButton);
  window.addEventListener('scroll', placeButton, true);
  window.visualViewport?.addEventListener('resize', placeButton);
  window.visualViewport?.addEventListener('scroll', placeButton);
  // Also covers style-only layout changes and late-loading composers.
  setInterval(placeButton, 500);
  window.addEventListener('popstate', sync);
  setInterval(() => { if (route !== location.pathname) sync(); }, 800);
  sync();
})();
