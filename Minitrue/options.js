document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('list');
  const saveBtn = document.getElementById('save');
  const clearBtn = document.getElementById('clear');
  const fetchBtn = document.getElementById('fetch');
  const status = document.getElementById('status');

  function showStatus(msg, ok = true) {
    status.textContent = msg;
    status.style.color = ok ? 'green' : '#d71920';
    setTimeout(() => { status.textContent = ''; }, 3000);
  }

  function readCurrentList() {
    return ta.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function writeList(lines) {
    const cleaned = [...new Set(lines.map((item) => String(item).trim()).filter(Boolean))];
    ta.value = cleaned.join('\n');
    chrome.storage.local.set({ overrides: cleaned }, () => {});
  }

  chrome.storage.local.get(['overrides'], (res) => {
    const arr = Array.isArray(res.overrides) ? res.overrides : [];
    ta.value = arr.join('\n');
  });

  saveBtn.addEventListener('click', () => {
    const lines = readCurrentList();
    chrome.storage.local.set({ overrides: lines }, () => {
      showStatus('Saved');
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ overrides: [] }, () => {
      ta.value = '';
      showStatus('Cleared');
    });
  });

  fetchBtn.addEventListener('click', async () => {
    fetchBtn.disabled = true;
    showStatus('Fetching latest list...', true);
    try {
      const list = await window.Minitrue.fetchRemoteList();
      if (!list.length) {
        throw new Error('No usernames returned');
      }
      writeList(list);
      showStatus('Updated from GitHub');
    } catch (error) {
      showStatus('Failed to fetch latest list', false);
    } finally {
      fetchBtn.disabled = false;
    }
  });
});
