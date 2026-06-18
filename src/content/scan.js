/**
 * Run SCR parse + MedExpress keyword scan, persist scanResult, and open results tab.
 */

import { getFlow, setFlow, getPendingPatient, setScanResult } from '../lib/storage.js';
import { EXTRACTORS } from '../config/rules.config.js';
import { evaluateRules } from '../engine/rulesEngine.js';
import { scanMedexpressHtml } from '../engine/medexpressKeywordEngine.js';
import { extractBmiFromDocument } from '../engine/bmiExtractor.js';
import { parseScr, isScrContentPresent } from './scrParser.js';
import { toast } from '../lib/toast.js';

let scanInProgress = false;

/**
 * Parse SCR, evaluate MedExpress rules, save results, and request results tab.
 * Idempotent — runs once per active flow.
 */
export async function handleScan() {
  if (scanInProgress) return;

  const flow = await getFlow();
  if (!flow.active || flow.scanComplete) return;
  if (!isScrContentPresent()) return;

  scanInProgress = true;

  try {
    const html = document.documentElement.innerHTML;
    const parsed = parseScr();
    const medexpress = scanMedexpressHtml(html);
    const bmi = extractBmiFromDocument();
    const supplementary = evaluateRules(parsed, { FLAG_RULES: [], EXTRACTORS, COMPUTED: [] });
    const pendingPatient = await getPendingPatient();

    const patient = {
      ...parsed.banner,
      firstName: pendingPatient?.firstName,
      lastName: pendingPatient?.lastName,
    };

    const scanResult = {
      patient,
      scan: {
        ...supplementary,
        banner: parsed.banner,
        medications: parsed.medications,
        medexpress: {
          overallPass: medexpress.overallPass,
          findings: medexpress.findings,
        },
        bmi,
      },
      generatedAt: new Date().toISOString(),
    };

    await setScanResult(scanResult);
    await setFlow({ ...flow, scanComplete: true, active: false });

    chrome.runtime.sendMessage({ type: 'OPEN_RESULTS_TAB' }, (response) => {
      if (chrome.runtime.lastError) {
        toast('Scan complete but could not open results tab.', 'warn');
      } else if (response?.error) {
        toast('Scan complete but could not open results tab.', 'warn');
      } else {
        toast('SCR scan complete — review results in the new tab.', 'info');
      }
    });
  } catch (err) {
    console.error('[edm-scr] Scan failed:', err);
    toast('SCR scan failed. Check console for details.', 'error');
    const flow = await getFlow();
    await setFlow({ ...flow, active: false });
  } finally {
    scanInProgress = false;
  }
}
