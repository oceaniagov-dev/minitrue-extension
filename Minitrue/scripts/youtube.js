
(async function () {
  'use strict';

  const shared = window.Minitrue;
  const blockedList = await shared.loadAllBlocked();
  const blockedSet = new Set(blockedList);
  let blocked = [...blockedSet];

  const removedNodes = new WeakSet();
  const YT_DEBUG = false;

  // Normalize names so spaces, punctuation and capitalization
  // don't prevent a match.
  function normalizeUsername(input) {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/[\s\p{P}\p{S}]/gu, '');
  }

  function findBlockedUsername(input) {
    const username = normalizeUsername(input);
    if (!username) return null;

    for (const name of blocked) {
      const blockedUsername = normalizeUsername(name);

      if (blockedUsername && username === blockedUsername) {
        return name;
      }
    }

    return null;
  }

  // Check both visible text and href for the author's identity.
  function findMatchForElement(el) {
    const text = (el.textContent || '').trim();

    if (text) {
      const matched = findBlockedUsername(text);
      if (matched) return matched;
    }

    const href = el.getAttribute && el.getAttribute('href');

    if (href && href.indexOf('/@') !== -1) {
      const match = /\/@([^/?#]+)/.exec(href);

      if (match) {
        const matched = findBlockedUsername(match[1]);
        if (matched) return matched;
      }
    }

    return null;
  }

  function scanAndRemove() {
    if (blocked.length === 0) return;

    const root = document.body || document.documentElement;
    if (!root) return;

    try {
      const selectors = [
        'span.ytd-comment-view-model',
        'span.ytAttributedStringHost',
        'a.yt-simple-endpoint',
        'a.ytAttributedStringLink'
      ].join(',');

      const elements = Array.from(root.querySelectorAll(selectors));
      if (!elements.length) return;

      for (const el of elements) {
        if (!el || removedNodes.has(el)) continue;

        const text = (el.textContent || '').toLowerCase();
        if (!text) continue;

        const matched = findMatchForElement(el);
        if (!matched) continue;

        function findNearestRenderer(node) {
          // Prefer the comment/video container itself.
          const selector = [
            'ytd-video-renderer',
            'ytd-rich-item-renderer',
            'yt-lockup-view-model',
            'ytd-comment-thread-renderer'
          ].join(',');

          let found = node.closest && node.closest(selector);
          if (found) return found;

          found = node.closest &&
            node.closest('ytd-comment-view-model, yt-comment-view-model');

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

          return node.parentElement || node;
        }

        const target = findNearestRenderer(el);

        if (
          !target ||
          target === document.documentElement ||
          target === document.body
        ) continue;

        if (removedNodes.has(target)) continue;

        try {
          console.debug(
            'Minitrue: removed comment by @' +
            String(matched).replace(/^@/, '')
          );

          if (YT_DEBUG) {
            console.debug('Minitrue: matched', {
              matched,
              text,
              foundTarget: target.tagName || target.nodeName,
              target
            });
          }

          removedNodes.add(target);
          target.remove();

        } catch (err) {
          // Ignore removal errors.
        }
      }

    } catch (error) {
      console.warn('Minitrue: comment scan failed', error);
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
    const next = [
      ...new Set(
        values
          .map(item => String(item).toLowerCase().trim())
          .filter(Boolean)
      )
    ];

    blockedSet.clear();

    for (const item of next) {
      blockedSet.add(item);
    }

    blocked = [...blockedSet];
    scheduleScan();
  }

  // Initial scan.
  scanAndRemove();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        (mutation.addedNodes && mutation.addedNodes.length) ||
        mutation.type === 'characterData'
      ) {
        scheduleScan();
        break;
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  shared.listenForOverrides((values) => updateBlocked(values));

})();
