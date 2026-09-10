(async function () {
  'use strict';

  const shared = window.Minitrue;
  const blockedSet = new Set(await shared.loadAllBlocked());
  let blocked = [...blockedSet];

  const removedNodes = new WeakSet();

  function findBlockedUsername(value) {
    return shared.matchBlocked(value, blocked);
  }

  function findTargetElement(node) {
    if (!node) return null;

    // Prefer the nearest article
    let article = node.closest && node.closest('article');
    if (article) return article;

    // Next prefer a <shreddit-comment> element (used by some reddit clients/extensions)
    let shred = node.closest && node.closest('shreddit-comment');
    if (shred) return shred;

    // Walk up until we find an element that looks like a reasonable container
    let current = node;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.tagName && current.tagName.toLowerCase() === 'div') {
        // If the div has role article or comment-like attributes, prefer it
        const role = current.getAttribute && current.getAttribute('role');
        if (role === 'article' || role === 'article' || role === 'group') return current;
      }
      current = current.parentElement;
    }

    // fallback to the node's parentElement or the node itself
    return node.parentElement || node;
  }

  function scanAndRemove() {
    if (blocked.length === 0) return;
    const root = document.body || document.documentElement;
    if (!root) return;

    try {
      // Select spans with class whitespace-nowrap and explicit dir, and anchor tags
      const selectors = [
        'span.whitespace-nowrap[dir="auto"]',
        'a'
      ].join(',');

      const elements = Array.from(root.querySelectorAll(selectors));
      if (!elements.length) return;

      for (const el of elements) {
        if (!el || removedNodes.has(el)) continue;

        const text = (el.textContent || '').toLowerCase();
        if (!text) continue;

        const matched = findBlockedUsername(text);
        if (!matched) continue;

        const target = findTargetElement(el);
        if (!target || target === document.documentElement || target === document.body) continue;
        if (removedNodes.has(target)) continue;

        try {
          removedNodes.add(target);
          target.remove();
        } catch (err) {
          // ignore removal errors
        }
      }
    } catch (error) {
      // swallow errors to avoid breaking page scripts
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
    }, 150);
  }

  function updateBlocked(values) {
    const next = [...new Set(values.map((item) => String(item).toLowerCase().trim()).filter(Boolean))];
    blockedSet.clear();
    for (const item of next) blockedSet.add(item);
    blocked = [...blockedSet];
    scheduleScan();
  }

  // initial scan
  scanAndRemove();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes && mutation.addedNodes.length) { scheduleScan(); break; }
      if (mutation.type === 'characterData') { scheduleScan(); break; }
      if (mutation.type === 'attributes') { scheduleScan(); break; }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  shared.listenForOverrides((values) => updateBlocked(values));
})();
