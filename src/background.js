/**
 * Background — MedExpress SCR pattern (in-memory userData per NHS tab).
 */

const NHS_URL =
  'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/find_patient';
const KEYWORDS_TOOL_PATH = 'keywords-tool.html';

/** @type {Map<number, { userData: object, originalTabId?: number, created: number }>} */
const nhsTabData = new Map();
/** @type {number|''} */
let nhsTabId = '';
/** Patient data for the tab being opened (avoids NHS load race). */
let pendingOpen = null;

/** @type {{ tabId?: number, resolve?: () => void }} */
const tabLoadingTrap = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping_automate_scr') {
    sendResponse({ loaded: true });
    return false;
  }

  switch (request.action) {
    case 'openNHSPage':
      handleOpenNHSPage(request, sender, sendResponse);
      return true;

    case 'should_run_automation':
      handleShouldRunAutomation(request, sender, sendResponse);
      return false;

    case 'scrContentRetrieved':
      handleScrContentRetrieved(request, sender, sendResponse);
      return true;

    case 'noSearchResults':
    case 'multiplePatientsFound':
    case 'noSCRForPatient':
    case 'patientSearchNotLoaded':
      console.warn('[edm-scr]', request.action, request.userData);
      sendResponse({ ok: true });
      return false;

    default:
      return false;
  }
});

function handleOpenNHSPage(request, sender, sendResponse) {
  const nhsUrl = request.url || NHS_URL;

  pendingOpen = {
    userData: request.userData,
    originalTabId: sender.tab?.id,
  };

  if (nhsTabId) {
    chrome.tabs.remove(nhsTabId, () => {
      void chrome.runtime.lastError;
    });
  }

  chrome.tabs.create({ url: nhsUrl, active: true }, (tab) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (tab.id != null) {
      nhsTabData.set(tab.id, {
        userData: request.userData,
        originalTabId: sender.tab?.id,
        created: Date.now(),
      });
      nhsTabId = tab.id;
      pendingOpen = null;
    }

    sendResponse({ success: true, tabId: tab.id });
  });
}

function handleShouldRunAutomation(_request, sender, sendResponse) {
  const tabId = sender.tab?.id;

  if (tabId != null && nhsTabData.has(tabId)) {
    sendResponse({
      shouldRun: true,
      userData: nhsTabData.get(tabId).userData,
    });
    return;
  }

  if (pendingOpen) {
    sendResponse({
      shouldRun: true,
      userData: pendingOpen.userData,
    });
    return;
  }

  sendResponse({ shouldRun: false });
}

/** MedExpress: open keywords-tool.html and push SCR HTML via renderSCRContent. */
async function handleScrContentRetrieved(request, _sender, sendResponse) {
  const { content, userData } = request;

  try {
    await openKeywordToolPage(userData || {}, content);
    sendResponse({ success: true });
  } catch (err) {
    console.error('[edm-scr] Failed to open keyword tool:', err);
    sendResponse({ success: false, error: String(err) });
  }
}

async function openKeywordToolPage(userData, content) {
  const toolUrl = chrome.runtime.getURL(KEYWORDS_TOOL_PATH);
  const tab = await chrome.tabs.create({ url: toolUrl, active: true });
  if (tab.id == null) {
    throw new Error('Failed to create keyword tool tab');
  }

  await waitForTabLoadingToComplete(tab.id);

  const payload = { action: 'renderSCRContent', content, userData };
  const maxAttempts = 8;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, payload, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  throw lastError ?? new Error('Keyword tool did not respond');
}

function waitForTabLoadingToComplete(tabId) {
  tabLoadingTrap.tabId = tabId;
  return new Promise((resolve) => {
    tabLoadingTrap.resolve = resolve;
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === tabLoadingTrap.tabId && changeInfo.status === 'complete') {
    tabLoadingTrap.resolve?.();
    tabLoadingTrap.tabId = undefined;
    tabLoadingTrap.resolve = undefined;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  nhsTabData.delete(tabId);
  if (tabId === nhsTabId) {
    nhsTabId = '';
  }
});
