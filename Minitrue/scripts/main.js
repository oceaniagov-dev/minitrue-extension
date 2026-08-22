window.Minitrue = (() => {
  const remoteUrls = [
    'https://github.com/oceaniagov-dev/minitrue-unpersons/raw/main/unpersons.txt'
  ];

  function normalize(value) {
    return String(value ?? '').toLowerCase().replace(/[\/\-]+/g, '');
  }

  function matchBlocked(value, blocked) {
    if (value == null) return null;
    const raw = String(value).toLowerCase();
    const fixed = normalize(value);
    for (const name of blocked) {
      if (!name) continue;
      const lower = String(name).toLowerCase();
      const clean = normalize(name);
      const variants = [lower, clean].filter((item, index, arr) => item && arr.indexOf(item) === index);
      for (const variant of variants) {
        if (raw.includes(variant) || fixed.includes(variant)) return name;
      }
    }
    return null;
  }

  async function loadBlockedList() {
    const list = [];
    try {
      const url = chrome.runtime.getURL('blocked_users.json');
      const response = await fetch(url);
      if (!response.ok) return list;
      const json = await response.json();
      if (!Array.isArray(json)) return list;
      return json.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
    } catch (error) {
      return list;
    }
  }

  async function loadRemoteList() {
    for (const url of remoteUrls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;
        const text = await response.text();
        const lines = text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
        if (lines.length) return lines.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
      } catch (error) {
      }
    }
    return [];
  }

  async function loadOverrides() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['overrides'], (result) => {
          const values = Array.isArray(result.overrides) ? result.overrides : [];
          resolve(values.map((item) => String(item).toLowerCase().trim()).filter(Boolean));
        });
      } catch (error) {
        resolve([]);
      }
    });
  }

  async function shouldAutoFetch() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['lastFetch'], (res) => {
          const last = res.lastFetch ? new Date(res.lastFetch).getTime() : 0;
          const now = Date.now();
          const sixHours = 6 * 60 * 60 * 1000;
          resolve(!last || (now - last) > sixHours);
        });
      } catch (e) { resolve(false); }
    });
  }

  async function loadAllBlocked() {
    const packaged = await loadBlockedList();
    const stored = await loadOverrides();

    // Try to auto-fetch remote list on start if enough time passed; persist on success
    try {
      const doFetch = await shouldAutoFetch();
      if (doFetch) {
        const remote = await loadRemoteList();
        if (remote && remote.length) {
          const cleaned = [...new Set(remote.map((i) => String(i).toLowerCase().trim()).filter(Boolean))];
          chrome.storage.local.set({ overrides: cleaned, lastFetch: new Date().toISOString() }, () => {});
          // merge packaged + remote + stored
          return [...new Set([...packaged, ...cleaned, ...stored])];
        } else {
          // if fetch failed or empty, just merge packaged + stored
          return [...new Set([...packaged, ...stored])];
        }
      }
    } catch (e) {
      // proceed to merge without remote
    }

    return [...new Set([...packaged, ...stored])];
  }

  function listenForOverrides(onChange) {
    try {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.overrides) {
          const next = Array.isArray(changes.overrides.newValue) ? changes.overrides.newValue : [];
          onChange(next);
        }
      });
    } catch (error) {
    }
  }

  async function fetchRemoteList() {
    const list = await loadRemoteList();
    if (!list.length) return [];
    const cleaned = [...new Set(list.map((item) => String(item).toLowerCase().trim()).filter(Boolean))];
    chrome.storage.local.set({ overrides: cleaned }, () => {});
    return cleaned;
  }

  return { normalize, matchBlocked, loadBlockedList, loadRemoteList, loadOverrides, loadAllBlocked, listenForOverrides, fetchRemoteList };
})();
