(async function () {
  'use strict';

  const shared = window.Minitrue;
  const blockedSet = new Set(await shared.loadAllBlocked());
  let blocked = [...blockedSet];

  const removedNodes = new WeakSet();

  function findBlockedUsername(value) {
    return shared.matchBlocked(value, blocked);
  }

  function normalizeAnchorText(text) {
    if (!text) return '';
    let t = String(text).trim();
    // ignore leading @ if present (common on Bluesky)
    if (t.startsWith('@')) t = t.slice(1);
    return t.toLowerCase();
  }

  function findCssContainer(node) {
    if (!node) return null;

    let current = node;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.tagName && current.tagName.toLowerCase() === 'div') {
        const cls = current.getAttribute && current.getAttribute('class');
        const style = current.getAttribute && current.getAttribute('style');
        if (cls && !style) {
          // must be exactly a single class like "css-g5y9jx" (no other classes)
          if (cls.indexOf(' ') === -1) {
            // match class that starts with "css-" followed by at least four alphanumeric chars
            const m = /^css-[A-Za-z0-9]{4,}$/.exec(cls);
            if (m) return current;
          }
        }
      }
      current = current.parentElement;
    }

    return null;
  }

  function scanAndRemove() {
    if (blocked.length === 0) return;
    const root = document.body || document.documentElement;
    if (!root) return;

    try {
      const anchors = Array.from(root.querySelectorAll('a'));
      if (!anchors.length) return;

      for (const a of anchors) {
        if (!a || removedNodes.has(a)) continue;
        const text = normalizeAnchorText(a.textContent || '');
        if (!text) continue;
        const matched = findBlockedUsername(text);
        if (!matched) continue;

        // prefer exact css-... container as described
        const cssContainer = findCssContainer(a);
        let target = cssContainer || a.parentElement || a;
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
      // swallow errors to avoid breaking the host page
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

  // initial run
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
