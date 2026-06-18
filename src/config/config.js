/**
 * Extension-wide behavioural flags and timing defaults.
 * Timings aligned with MedExpress SCR (fast 100ms DOM polling).
 */

/** Auto-click consent Yes — matches MedExpress automation speed. */
export const AUTO_CONFIRM_CONSENT = true;

/** DOM wait timeout (MedExpress: 5s). */
export const DOM_WAIT_TIMEOUT_MS = 5000;

/** Default timeout for waitForElement across portal automation steps. */
export const DEFAULT_TIMEOUT_MS = DOM_WAIT_TIMEOUT_MS;

/** Fast poll interval for NHS SPA steps (MedExpress: 100ms). */
export const DOM_POLL_INTERVAL_MS = 100;

/** Inject a fallback "Scan SCR" button next to the order-page trigger. */
export const INJECT_FALLBACK_SCAN_BUTTON = false;

/**
 * Dev override: replace `.scr-cta` href (NHS auth URL) with PORTAL.entryUrl (/find_patient).
 */
export const OVERRIDE_SCR_CTA_URL = true;

/** Debounce for EDM order-page SPA only — NHS portal runs steps immediately. */
export const DEBOUNCE_MS = 100;

/** Minimum gap between repeated landing confirm attempts. */
export const LANDING_RETRY_MS = 400;

/** Expected NHS Smartcard org code on portal landing (EveryDayMeds). */
export const NHS_AUTH_ORG_CODE = 'FJE59';

/** Match org name or code in landing page HTML. */
export const NHS_AUTH_TEXT_SUBSTRING = 'FJE59';

/** Optional full org label shown on NHS landing (for clearer errors). */
export const NHS_AUTH_ORG_LABEL = 'EVERYDAYMEDS';
