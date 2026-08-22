(async function () {
  'use strict';

  const shared = window.Minitrue;
  const blockedSet = new Set(await shared.loadAllBlocked());
  let blocked = [...blockedSet];

  const removedNodes = new WeakSet();

  function findBlockedUsername(value) {
    return shared.matchBlocked(value, blocked);
  }

  function parseStyleAttr(style) {
    const map = {};
    if (!style) return map;
    const parts = style.split(';');
    for (const part of parts) {
      const pair = part.split(':');
      if (pair.length < 2) continue;
      const key = pair[0].trim().toLowerCase();
      const value = pair.slice(1).join(':').trim().toLowerCase();
      if (key) map[key] = value;
    }
    return map;
  }

  function styleMatchesRequired(styleAttr) {
    const required = {
      height: '100%',
      display: 'inline-block',
      float: 'left',
      position: 'relative',
      margin: '4px'
    };
    const parsed = parseStyleAttr(styleAttr);
    for (const key of Object.keys(required)) {
      if (!(key in parsed)) return false;
      if (parsed[key] !== required[key]) return false;
    }
    return true;
  }

  function scanAndRemove() {
    if (blocked.length === 0) return;
    const nodes = Array.from(document.querySelectorAll('[data-username], a[aria-label]'));
    const matches = [];

    for (const el of nodes) {
      let value = '';
      if (el.hasAttribute('data-username')) {
        value = (el.getAttribute('data-username') || '').toLowerCase();
      } else if (el.tagName && el.tagName.toLowerCase() === 'a' && el.hasAttribute('aria-label')) {
        value = (el.getAttribute('aria-label') || '').toLowerCase();
      }
      if (!value) continue;
      const matched = findBlockedUsername(value);
      if (matched) matches.push({ el, name: matched });
    }

    for (const { el, name } of matches) {
      let target = el.closest('div[data-commentid]');
      if (!target) {
        let parent = el.parentElement;
        while (parent) {
          if (parent.tagName && parent.tagName.toLowerCase() === 'div') {
            const style = parent.getAttribute('style');
            if (style && styleMatchesRequired(style)) {
              target = parent;
              break;
            }
          }
          parent = parent.parentElement;
        }
      }
      if (!target) target = el;
      if (target === document.documentElement || target === document.body) continue;
      if (removedNodes.has(target)) continue;

      try {
        removedNodes.add(target);
        target.remove();
      } catch (error) {
      }
    }
  }

  let scanTimeout = null;
  function scheduleScan() {
    if (scanTimeout) return;
    scanTimeout = setTimeout(() => {
      scanTimeout = null;
      scanAndRemove();
    }, 150);
  }

  function updateBlocked(values) {
    const next = [...new Set(values.map((item) => String(item).toLowerCase().trim()).filter(Boolean))];
    blockedSet.clear();
    for (const item of next) blockedSet.add(item);
    blocked = [...blockedSet];
    scheduleScan();
  }

  scanAndRemove();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes && mutation.addedNodes.length) { scheduleScan(); break; }
      if (mutation.type === 'characterData') { scheduleScan(); break; }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  shared.listenForOverrides((values) => updateBlocked(values));
})();
