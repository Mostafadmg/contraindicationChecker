/**
 * DOM utilities for NHS SPA interaction — waiting, native value setting, SPA observation.
 */

import { DOM_WAIT_TIMEOUT_MS, DOM_POLL_INTERVAL_MS } from '../config/config.js';

/**
 * Fast poll until any selector matches (MedExpress-style).
 * @param {string[]} selectors
 * @param {{ timeout?: number, interval?: number, root?: ParentNode }} [options]
 * @returns {Promise<Element>}
 */
export function waitForContentChange(
  selectors,
  { timeout = DOM_WAIT_TIMEOUT_MS, interval = DOM_POLL_INTERVAL_MS, root = document } = {}
) {
  return new Promise((resolve, reject) => {
    const check = () => {
      for (const sel of selectors) {
        const el = root.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const found = check();
    if (found) {
      resolve(found);
      return;
    }

    const poller = setInterval(() => {
      const el = check();
      if (el) {
        clearInterval(poller);
        clearTimeout(timer);
        resolve(el);
      }
    }, interval);

    const timer = setTimeout(() => {
      clearInterval(poller);
      reject(new Error(`waitForContentChange timeout: ${selectors.join(', ')}`));
    }, timeout);
  });
}

/**
 * Poll and observe until an element matching selector appears, or reject on timeout.
 * @param {string} selector
 * @param {{ timeout?: number, root?: ParentNode }} [options]
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, { timeout = 15000, root = document } = {}) {
  return new Promise((resolve, reject) => {
    const existing = root.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      reject(new Error(`waitForElement timeout: ${selector}`));
    }, timeout);

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el && !settled) {
        settled = true;
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(root === document ? document.documentElement : root, {
      childList: true,
      subtree: true,
    });
  });
}

/**
 * Set input value in a way NHS framework-managed inputs recognise.
 * @param {HTMLInputElement|HTMLTextAreaElement} el
 * @param {string} value
 */
export function setNativeValue(el, value) {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Register callbacks for SPA navigation and DOM mutations (debounced).
 * @param {() => void} callback
 * @param {number} debounceMs
 * @param {{ observeMutations?: boolean }} [options]
 * @returns {() => void} cleanup function
 */
export function observeSpaChanges(callback, debounceMs = 300, { observeMutations = true } = {}) {
  let timer = null;

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(callback, debounceMs);
  };

  const onPopState = () => schedule();
  window.addEventListener('popstate', onPopState);

  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPush(...args);
    schedule();
  };

  history.replaceState = (...args) => {
    originalReplace(...args);
    schedule();
  };

  let observer = null;
  if (observeMutations) {
    observer = new MutationObserver(() => schedule());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  schedule();

  return () => {
    clearTimeout(timer);
    window.removeEventListener('popstate', onPopState);
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    observer?.disconnect();
  };
}

/** @param {Element|null} el */
export function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** @param {Element} el */
export function scrollIntoViewIfNeeded(el) {
  if (!isElementVisible(el)) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Click an NHS UI button in a way SPA frameworks recognise.
 * @param {HTMLElement} btn
 */
export function clickNhsButton(btn) {
  scrollIntoViewIfNeeded(btn);
  btn.focus();

  const rect = btn.getBoundingClientRect();
  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };

  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    const EventClass = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    btn.dispatchEvent(new EventClass(type, eventInit));
  }

  const form = btn.closest('form');
  if (form && typeof form.requestSubmit === 'function') {
    form.requestSubmit(btn);
  } else {
    btn.click();
  }
}

/**
 * Submit a form — click submit button first, fall back to dispatching submit event.
 * @param {HTMLFormElement} form
 * @param {string} submitSelector
 */
export function dispatchSubmit(form, submitSelector) {
  const btn = form.querySelector(submitSelector) || form.querySelector('button[type="submit"]');
  if (btn) {
    btn.click();
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/**
 * Run async fn with toast on waitForElement failure.
 * @param {string} stepName
 * @param {() => Promise<void>} fn
 * @param {(msg: string, type?: string) => void} toast
 */
export async function withStepErrorHandling(stepName, fn, toast) {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('waitForElement timeout')) {
      const selector = msg.replace('waitForElement timeout: ', '');
      toast(
        `${stepName} failed: element not found (${selector}). Check selectors.config.js.`,
        'error'
      );
    } else {
      toast(`${stepName} failed: ${msg}`, 'error');
    }
    throw err;
  }
}
