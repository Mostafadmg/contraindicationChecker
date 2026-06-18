/**
 * Entry point — EDM order page wiring + MedExpress-style NHS portal pipeline.
 */

import { URLS } from '../config/selectors.config.js';
import { DEBOUNCE_MS } from '../config/config.js';
import { observeSpaChanges } from '../lib/dom.js';
import { initOrderPageTrigger } from './orderPage.js';
import { isNhsPortalUrl, runPortalPipeline } from './portalPipeline.js';

init();

function init() {
  const onRouteChange = () => {
    if (URLS.orderPage(location.href)) {
      initOrderPageTrigger();
    }
    if (isNhsPortalUrl()) {
      runPortalPipeline();
    }
  };

  // Rx order workspace: history events only — a document-wide mutation observer
  // fights the page SPA and can stop prescription content from rendering.
  observeSpaChanges(onRouteChange, DEBOUNCE_MS, {
    observeMutations: !URLS.orderPage(location.href),
  });

  if (URLS.orderPage(location.href)) {
    initOrderPageTrigger();
  }

  if (isNhsPortalUrl()) {
    runPortalPipeline();

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (
          area === 'session'
          && (changes.flow || changes.pendingPatient || changes.scanPending)
        ) {
          runPortalPipeline();
        }
      });
    }

    // Keep trying pipeline steps while a scan is in progress (MedExpress-style).
    setInterval(async () => {
      const data = await chrome.storage.session.get(['flow', 'scanPending']);
      const flow = data.flow || {};
      if (flow.active && !flow.scanComplete) {
        runPortalPipeline();
      } else if (data.scanPending && !flow.scanComplete) {
        runPortalPipeline();
      }
    }, 400);
  }
}
