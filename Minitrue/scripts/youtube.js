(async function () {
  'use strict';

  const shared = window.Minitrue;
  const blockedList = await shared.loadAllBlocked();
  const blockedSet = new Set(blockedList);
  let blocked = [...blockedSet];

  const removedNodes = new WeakSet();

  function findBlockedUsername(input) {
    return shared.matchBlocked(input, blocked);
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
        const text = node.nodeValue;
        if (!text) continue;
        if (node.parentElement && node.parentElement.closest && node.parentElement.closest('yt-attributed-string')) continue;
        const matched = findBlockedUsername(text);
        if (matched && node.parentElement) matches.push({ el: node.parentElement, name: matched });
      }

      for (const { el, name } of matches) {
        const target = el.closest('ytd-rich-item-renderer')
          || el.closest('yt-lockup-view-model')
          || el.closest('yt-lockup-metadata-view-model')
          || el.closest('ytSubThreadSubThreadContent')
          || el.closest('ytd-comment-thread-renderer')
          || el;

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
