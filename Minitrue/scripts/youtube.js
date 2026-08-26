(async function () {
  'use strict';

  const shared = window.Minitrue;
  const blockedList = await shared.loadAllBlocked();
  const blockedSet = new Set(blockedList);
  let blocked = [...blockedSet];

  const removedNodes = new WeakSet();
  const YT_DEBUG = false;

  function findBlockedUsername(input) {
    return shared.matchBlocked(input, blocked);
  }

  function scanAndRemove() {
    if (blocked.length === 0) return;
    const root = document.body || document.documentElement;
    if (!root) return;

    try {
        const selectors = [
          'span.style-scope.ytd-comment-view-model',
          'span.ytAttributedStringHost',
          'a.yt-simple-endpoint.style-scope.yt-formatted-string',
          'a.ytAttributedStringLink.ytAttributedStringLinkCallToActionColor.ytAttributedStringLinkInheritColor'
        ].join(',');

        const elements = Array.from(root.querySelectorAll(selectors));
        if (!elements.length) return;

        for (const el of elements) {
          if (!el || removedNodes.has(el)) continue;

          const text = (el.textContent || '').toLowerCase();
          if (!text) continue;

          const matched = findBlockedUsername(text);
          if (!matched) continue;

          function findNearestRenderer(node) {
            const selector = 'ytd-video-renderer, ytd-rich-item-renderer, yt-lockup-view-model, ytd-comment-thread-renderer';
            let found = node.closest && node.closest(selector);
            if (found) return found;

            let current = node;
            while (current) {
              const root = current.getRootNode && current.getRootNode();
              if (!root) break;
              if (root instanceof ShadowRoot) {
                const host = root.host;
                if (!host || !(host instanceof Element)) break;
                found = host.closest && host.closest(selector);
                if (found) return found;
                current = host;
                continue;
              }
              break;
            }

            // final fallback to parentElement or the element itself
            return node.parentElement || node;
          }
          const target = findNearestRenderer(el);

          if (!target || target === document.documentElement || target === document.body) continue;
          if (removedNodes.has(target)) continue;

          try {
            if (YT_DEBUG) console.debug('Minitrue: matched', { matched, text, foundTarget: (target && (target.tagName || target.nodeName)), target });
            removedNodes.add(target);
            target.remove();
          } catch (err) {
            // ignore removal errors
          }
        }
      } catch (error) {
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
    observer.observe(document.body, { childList: true, subtree: true });
  }

  shared.listenForOverrides((values) => updateBlocked(values));
})();
