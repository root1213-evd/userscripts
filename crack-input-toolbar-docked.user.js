// ==UserScript==
// @name         크랙 입력창 버튼 플로팅바
// @namespace    https://crack.wrtn.ai/
// @version      1.1.0
// @description  크랙 입력창 왼쪽 아래의 …로 기본 버튼, Muse Writer와 Wish RP Manager를 접고 펼칩니다.
// @match        https://crack.wrtn.ai/*
// @run-at       document-start
// @noframes
// @grant        none
// @downloadURL  none
// ==/UserScript==

(() => {
    'use strict';

    const STYLE_ID = 'crack-toolbar-docked-style';
    const CHAT_PATH = /\/(?:episodes|chats?)\/[^/]+|^\/u\/[^/]+\/c\/[^/]+/;
    const EDITOR = [
        '.__chat_input_textarea',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"][translate="no"]',
        '[contenteditable="true"][data-placeholder*="메시지"]',
        'textarea[placeholder*="메시지"]',
    ].join(',');
    const ROW = 'div.justify-between';
    const EXCLUDED = [
        '[role="dialog"]', '[aria-modal="true"]', '.wrtn-markdown',
        '#wish-rp-root', '#wish-rp-quick', '.wish-rpcore-refiner-ui',
        '#crack-ai-panel', '#igx-live-popup', '#igx-live-settings',
        '#novcap-popup', '#novcap-editor-overlay', '#novcap-result-popup',
    ].join(',');
    const ADDON = [
        '[data-crack-native-toolbar-addon]', '#novcap-toolbar-btn',
        '#crack-pure-send-left-group', '#wish-rp-monitor', '#igx-live-popup',
    ].join(',');
    const SHORTCUT = /단축어|단축키|shortcuts?/i;
    const SEND = /보내기|전송|send\b|중지|stop\b/i;
    const CAMERA_SIZE = 22;
    const CAMERA_GAP = 3;

    let active = null;
    let frame = 0;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        [data-ctbd-row] {
            display: flex !important;
            align-items: center;
            justify-content: flex-start !important;
        }
        [data-ctbd-relative] { position: relative !important; }
        [data-ctbd-row="open"] { flex-wrap: wrap; row-gap: 5px; }

        #crack-toolbar-docked-toggle {
            order: -1;
            flex: 0 0 auto;
            display: inline-grid;
            place-items: center;
            width: 28px;
            height: 26px;
            padding: 0 0 2px;
            margin: 0 auto 0 0 !important;
            color: inherit;
            opacity: .86;
            background: transparent;
            border: 0;
            border-radius: 6px;
            font: 700 19px/1 system-ui, sans-serif;
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        [data-ctbd-inline-camera] #crack-toolbar-docked-toggle {
            margin-left: 28px !important;
        }
        #crack-toolbar-docked-toggle:hover,
        #crack-toolbar-docked-toggle:focus-visible,
        #crack-toolbar-docked-toggle[aria-expanded="true"] {
            background: rgba(127, 127, 127, .14);
            opacity: 1;
        }
        #crack-toolbar-docked-toggle:focus-visible {
            outline: 1px solid currentColor;
            outline-offset: 1px;
        }

        [data-ctbd-row="closed"] [data-ctbd-left] {
            position: absolute !important;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            margin: 0 !important;
            pointer-events: none !important;
        }
        /* 캡처기는 기본 버튼의 크기와 visibility로 삽입 위치를 찾습니다. */
        [data-ctbd-hidden] {
            opacity: 0 !important;
            pointer-events: none !important;
        }
        [data-ctbd-row="closed"] :is(#crack-pure-send-left-group, #wish-rp-monitor) {
            display: none !important;
        }
        [data-ctbd-row="open"] [data-ctbd-left] {
            order: -2;
            flex: 0 0 100%;
            max-width: 100%;
            flex-wrap: wrap;
            margin-inline: 0 !important;
        }

        [data-ctbd-row] #novcap-toolbar-btn {
            display: inline-grid !important;
            place-items: center;
            position: relative !important;
            flex: 0 0 ${CAMERA_SIZE}px !important;
            box-sizing: border-box;
            width: ${CAMERA_SIZE}px !important;
            min-width: ${CAMERA_SIZE}px !important;
            max-width: ${CAMERA_SIZE}px !important;
            height: ${CAMERA_SIZE}px !important;
            min-height: ${CAMERA_SIZE}px !important;
            max-height: ${CAMERA_SIZE}px !important;
            padding: 0;
            border: 1px solid #d5dbd7 !important;
            border-radius: 7px !important;
            background: #f8faf8;
            color: #38423e;
            cursor: pointer;
        }
        [data-ctbd-row] #novcap-toolbar-btn > span { display: none; }
        [data-ctbd-row] #novcap-toolbar-btn::before,
        [data-ctbd-row] #novcap-toolbar-btn::after {
            content: '';
            box-sizing: border-box;
            position: absolute;
            border: 1.4px solid currentColor;
        }
        [data-ctbd-row] #novcap-toolbar-btn::before {
            width: 13px;
            height: 10px;
            border-radius: 3px;
            top: 6px;
            box-shadow: 0 -4px 0 -3px currentColor;
        }
        [data-ctbd-row] #novcap-toolbar-btn::after {
            width: 5px;
            height: 5px;
            top: 8.5px;
            border-radius: 50%;
        }
        [data-ctbd-row="closed"] #novcap-toolbar-btn {
            position: absolute !important;
            z-index: 2;
            margin: 0 !important;
            left: var(--ctbd-camera-x, 0px) !important;
            top: var(--ctbd-camera-y, 0px) !important;
            pointer-events: auto !important;
        }
    `;

    function nativeButtons(branch) {
        if (branch.matches(ADDON) || branch.closest(EXCLUDED)) return [];
        const buttons = branch.matches('button') ? [branch] : [...branch.querySelectorAll('button')];
        return buttons.filter(button => !button.closest(ADDON) && !button.closest(EXCLUDED));
    }

    function findComposer() {
        if (!CHAT_PATH.test(location.pathname)) return null;

        const editors = [...document.querySelectorAll(EDITOR)].filter(editor =>
            !editor.closest(EXCLUDED) && editor.offsetWidth && editor.offsetHeight
        );
        editors.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
        for (const editor of editors) {
            const editorRect = editor.getBoundingClientRect();
            for (let box = editor.parentElement, depth = 0; box && depth < 6;
                box = box.parentElement, depth++) {
                if (box === document.body || box.offsetHeight > Math.max(420, editorRect.height + 180)) break;
                for (const row of box.querySelectorAll(ROW)) {
                    if (row.contains(editor) || row.closest(EXCLUDED) || !row.offsetHeight) continue;
                    const top = row.getBoundingClientRect().top;
                    if (top < editorRect.bottom - 10 || top > editorRect.bottom + 100) continue;

                    const branches = [...row.children].map(element => ({ element, buttons: nativeButtons(element) }))
                        .filter(branch => branch.buttons.length);
                    if (branches.length < 2) continue;
                    // 순정 좌측 그룹을 선택합니다. 앞에 끼어든 상태 표시와 전송 쪽 확장 버튼은 제외합니다.
                    const left = branches[0];
                    if (!left.element.matches('div,span') || left.buttons.some(button =>
                        button.getAttribute('type') === 'submit' || SEND.test(button.title + ' ' + (button.getAttribute('aria-label') || ''))
                    )) continue;
                    const hasShortcut = left.buttons.some(button =>
                        SHORTCUT.test(button.title + ' ' + (button.getAttribute('aria-label') || '')) ||
                        button.textContent.trim() === '/'
                    );
                    if (!hasShortcut && !box.matches('.rounded-lg.border, [class*="rounded"][class*="border"], form')) continue;
                    const border = editor.closest('.rounded-lg.border, [class*="rounded"][class*="border"]');
                    return { editor, row, left: left.element, box: border?.contains(row) ? border : box };
                }
            }
        }
        return null;
    }

    function setHidden(state, camera) {
        const hide = new Set();
        if (!state.open) {
            let parent = state.left;
            while (parent && parent !== camera) {
                for (const child of parent.children) {
                    if (!child.contains(camera)) hide.add(child);
                }
                parent = camera ? [...parent.children].find(child => child.contains(camera)) : null;
            }
        }
        for (const element of state.hidden) {
            if (hide.has(element)) continue;
            element.removeAttribute('data-ctbd-hidden');
            if (state.inert.delete(element)) element.removeAttribute('inert');
        }
        for (const element of hide) {
            if (state.hidden.has(element)) continue;
            element.setAttribute('data-ctbd-hidden', '');
            if (!element.hasAttribute('inert')) {
                element.setAttribute('inert', '');
                state.inert.add(element);
            }
        }
        state.hidden = hide;
    }

    function positionCamera(state, camera) {
        const { box, row, toggle, open } = state;
        if (state.camera && (state.camera !== camera || open)) {
            state.camera.style.removeProperty('--ctbd-camera-x');
            state.camera.style.removeProperty('--ctbd-camera-y');
        }
        state.camera = camera;
        if (open || !camera) {
            row.removeAttribute('data-ctbd-inline-camera');
            return;
        }

        const boxRect = box.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
        const outsideX = boxRect.left - CAMERA_SIZE - CAMERA_GAP;
        let outside = outsideX >= viewportLeft + CAMERA_GAP;
        for (let parent = camera.parentElement; outside && parent && parent !== document.body;
            parent = parent.parentElement) {
            if (getComputedStyle(parent).overflowX === 'visible') continue;
            if (parent.getBoundingClientRect().left > outsideX) outside = false;
        }

        row.toggleAttribute('data-ctbd-inline-camera', !outside);
        const x = outside ? outsideX : rowRect.left;
        const y = outside ? boxRect.bottom - CAMERA_SIZE + 1 : toggle.getBoundingClientRect().top + 2;
        const rect = camera.getBoundingClientRect();
        const computed = getComputedStyle(camera);
        const left = parseFloat(computed.left) || 0;
        const top = parseFloat(computed.top) || 0;
        camera.style.setProperty('--ctbd-camera-x', `${left + x - rect.left}px`);
        camera.style.setProperty('--ctbd-camera-y', `${top + y - rect.top}px`);
    }

    function paint(state) {
        const { row, toggle, open } = state;
        const camera = row.querySelector('#novcap-toolbar-btn');
        row.setAttribute('data-ctbd-row', open ? 'open' : 'closed');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? '입력창 도구 접기' : '입력창 도구 펼치기');
        setHidden(state, camera);
        positionCamera(state, camera);
    }

    const sizeObserver = new ResizeObserver(() => schedule());

    function detach() {
        if (!active) return;
        sizeObserver.disconnect();
        active.open = true;
        setHidden(active, null);
        positionCamera(active, null);
        active.row.removeAttribute('data-ctbd-row');
        active.row.removeAttribute('data-ctbd-relative');
        active.row.removeAttribute('data-ctbd-inline-camera');
        active.left.removeAttribute('data-ctbd-left');
        active.toggle.remove();
        active = null;
    }

    function attach(composer) {
        const { row, left, box } = composer;
        const toggle = document.createElement('button');
        toggle.id = 'crack-toolbar-docked-toggle';
        toggle.type = 'button';
        toggle.textContent = '⋯';
        toggle.setAttribute('data-crack-native-toolbar-addon', 'docked-toggle');
        toggle.addEventListener('mousedown', event => event.preventDefault());

        const state = { ...composer, toggle, open: false, path: location.pathname, hidden: new Set(), inert: new Set() };
        toggle.addEventListener('click', () => {
            state.open = !state.open;
            paint(state);
        });
        if (getComputedStyle(row).position === 'static') row.setAttribute('data-ctbd-relative', '');
        left.setAttribute('data-ctbd-left', '');
        row.insertBefore(toggle, left);
        active = state;
        paint(state);
        sizeObserver.observe(row);
        if (box !== row) sizeObserver.observe(box);
    }

    function update() {
        frame = 0;
        if (active && (
            active.path !== location.pathname || !active.row.isConnected || !active.row.offsetHeight ||
            !active.editor.isConnected || active.left.parentElement !== active.row ||
            active.toggle.parentElement !== active.row
        )) detach();
        if (active) {
            paint(active);
        } else {
            const composer = findComposer();
            if (composer) attach(composer);
        }
    }

    function schedule() {
        if (!frame) frame = requestAnimationFrame(update);
    }

    function boot() {
        if (document.getElementById(STYLE_ID)) return;
        document.documentElement.appendChild(style);
        const observer = new MutationObserver(records => {
            if (!active || active.path !== location.pathname || !active.row.isConnected ||
                !active.editor.isConnected || records.some(record => active.row.contains(record.target))) {
                schedule();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener('popstate', () => schedule());
        window.addEventListener('resize', () => schedule(), { passive: true });
        window.visualViewport?.addEventListener('resize', () => schedule(), { passive: true });
        window.visualViewport?.addEventListener('scroll', () => schedule(), { passive: true });
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || event.defaultPrevented || !active?.open ||
                !active.row.contains(document.activeElement)) return;
            active.open = false;
            paint(active);
            active.toggle.focus();
        });

        schedule();
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
