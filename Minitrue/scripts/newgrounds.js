(async function () {
  'use strict';

  const shared = window.Minitrue;
  const blockedSet = new Set(await shared.loadAllBlocked());
  let blocked = [...blockedSet];

  const removedNodes = new WeakSet();

  function getMatchValue(str) {
    return shared.matchBlocked(str, blocked);
  }

  function findTarget(el) {
    if (!el) return null;

    const direct = el.closest('.item-portalsubmission-featured');
    if (direct) return direct;

    let parent = el.parentElement;
    while (parent) {
      if (parent.tagName && parent.tagName.toLowerCase() === 'li' && parent.querySelector && parent.querySelector('div.audio-wrapper')) {
        return parent;
      }
      parent = parent.parentElement;
    }

    parent = el.parentElement;
    while (parent) {
      if (parent.tagName && parent.tagName.toLowerCase() === 'div') {
        const classes = parent.classList;
        if (classes && classes.contains('span-1')) {
          if (parent.closest('.footer-features-blogposts')) return parent;
        }
      }
      parent = parent.parentElement;
    }

    return el.closest('.portalitem-art-cell') || el.closest('.portalsubmission-cell') || null;
  }

  function scanAndRemove() {
    if (blocked.length === 0) return;
    const root = document.body || document.documentElement;
    if (!root) return;

    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      const matches = [];
      let node;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent) continue;
        const text = node.nodeValue || '';
        const matched = getMatchValue(text);
        if (matched) {
          matches.push({ el: parent, name: matched });
          continue;
        }

        for (const attr of ['data-username', 'data-author', 'aria-label', 'title']) {
          const value = parent.getAttribute ? parent.getAttribute(attr) : null;
          const attrMatch = getMatchValue(value);
          if (attrMatch) {
            matches.push({ el: parent, name: attrMatch });
            break;
          }
        }
      }

      for (const { el, name } of matches) {
        const target = findTarget(el) || el;
        if (target === document.documentElement || target === document.body) continue;
        if (removedNodes.has(target)) continue;

        try {
          removedNodes.add(target);
          target.remove();
        } catch (error) {
        }
      }
    } catch (error) {
    }
  }

  let scanTimeout = null;
  function scheduleScan() {
    if (scanTimeout) return;
    scanTimeout = window.requestAnimationFrame ? window.requestAnimationFrame(() => {
      scanTimeout = null;
      scanAndRemove();
    }) : setTimeout(() => {
      scanTimeout = null;
      scanAndRemove();
    }, 100);
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
      if (mutation.type === 'attributes' || mutation.type === 'characterData' || (mutation.addedNodes && mutation.addedNodes.length) || (mutation.removedNodes && mutation.removedNodes.length)) {
        scheduleScan();
        break;
      }
    }
  });

  const observeRoot = document.body || document.documentElement;
  if (observeRoot) {
    observer.observe(observeRoot, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-username', 'data-author', 'aria-label', 'title', 'class', 'style']
    });
  }

  shared.listenForOverrides((values) => updateBlocked(values));
})();
