/**
 * Results page — reads scanResult from session storage and renders MedExpress-style summary.
 */

import medexpressRules from '../config/medexpress.rules.json' with { type: 'json' };
import { buildScanResultFromScrHtml } from '../background/buildScanResult.js';

/** @type {object|null} */
let scanData = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const data = await chrome.storage.session.get(['scanResult', 'pendingScrScan']);
  scanData = data.scanResult;

  if (!scanData && data.pendingScrScan?.html) {
    scanData = buildScanResultFromScrHtml(
      data.pendingScrScan.html,
      data.pendingScrScan.userData || {}
    );
    await chrome.storage.session.set({ scanResult: scanData });
    await chrome.storage.session.remove('pendingScrScan');
  }

  if (!scanData) {
    showError('No scan results found. Run an SCR scan from an order page first.');
    return;
  }

  renderOverallResult(scanData);
  renderPatientHeader(scanData);
  renderMedexpressRules(scanData.scan);
  renderKeyData(scanData.scan);
  renderSupplementary(scanData.scan);
  bindToolbar();

  window.addEventListener('beforeunload', () => {
    chrome.storage.session.remove('scanResult');
  });
}

/** @param {string} msg */
function showError(msg) {
  document.getElementById('patient-header').innerHTML =
    `<p class="error-state">${escapeHtml(msg)}</p>`;
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('overall-result')?.setAttribute('hidden', '');
}

/** @param {object} data */
function renderOverallResult(data) {
  const medexpress = data.scan?.medexpress;
  const section = document.getElementById('overall-result');
  const inner = document.getElementById('overall-result-inner');
  if (!section || !inner || !medexpress) return;

  section.removeAttribute('hidden');
  const pass = medexpress.overallPass;
  inner.className = `overall-result__inner overall-result__inner--${pass ? 'pass' : 'fail'}`;
  inner.innerHTML = `
    <div class="overall-result__status">
      <span class="overall-result__badge">${pass ? 'PASS' : 'FAIL'}</span>
      <div>
        <strong>${pass ? 'No keywords detected' : 'Keywords detected in SCR'}</strong>
        <p>${pass
    ? 'None of the 6 clinical keyword rules (R001–R006) matched the Summary Care Record.'
    : `${medexpress.findings.length} keyword match${medexpress.findings.length === 1 ? '' : 'es'} found — review rules below.`}</p>
      </div>
    </div>
  `;
}

/** @param {object} data */
function renderPatientHeader(data) {
  const p = data.patient || data.scan?.banner || {};
  const generated = data.generatedAt
    ? new Date(data.generatedAt).toLocaleString('en-GB')
    : 'Unknown';

  const nhs = p.nhsNumber || '';
  const el = document.getElementById('patient-header');
  el.innerHTML = `
    <div class="patient-band__grid">
      <div class="patient-band__item"><label>Name</label><div>${escapeHtml(p.name || [p.firstName, p.lastName].filter(Boolean).join(' ') || '—')}</div></div>
      <div class="patient-band__item"><label>DOB</label><div>${escapeHtml(p.dob || '—')}</div></div>
      <div class="patient-band__item"><label>Age</label><div>${escapeHtml(p.age || '—')}</div></div>
      <div class="patient-band__item"><label>Gender</label><div>${escapeHtml(p.gender || '—')}</div></div>
      <div class="patient-band__item">
        <label>NHS Number</label>
        <div>${escapeHtml(nhs || '—')}${nhs ? `<button type="button" class="btn-copy no-print" id="btn-copy-nhs">Copy</button>` : ''}</div>
      </div>
      <div class="patient-band__item"><label>Address</label><div>${escapeHtml(p.address || '—')}</div></div>
    </div>
    <p class="patient-band__meta">Scan generated at ${escapeHtml(generated)}</p>
  `;

  document.getElementById('btn-copy-nhs')?.addEventListener('click', () => {
    navigator.clipboard.writeText(nhs.replace(/\s/g, ' '));
  });
}

/** @param {object} scan */
function renderMedexpressRules(scan) {
  const container = document.getElementById('rules-findings');
  const medexpress = scan?.medexpress;
  if (!container || !medexpress) {
    if (container) container.innerHTML = '<p class="empty-state">No rule scan data available.</p>';
    return;
  }

  const findingsByRule = groupFindingsByRule(medexpress.findings);
  container.innerHTML = medexpressRules
    .map((rule) => renderRuleCard(rule, findingsByRule[rule.id] || []))
    .join('');

  container.querySelectorAll('.finding-card__header').forEach((header) => {
    header.addEventListener('click', () => toggleCard(header.closest('.finding-card')));
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCard(header.closest('.finding-card'));
      }
    });
  });
}

/** @param {object[]} findings */
function groupFindingsByRule(findings) {
  return findings.reduce((acc, f) => {
    const id = f.ruleId || 'unknown';
    if (!acc[id]) acc[id] = [];
    acc[id].push(f);
    return acc;
  }, {});
}

/** @param {object} rule @param {object[]} hits */
function renderRuleCard(rule, hits) {
  const pass = hits.length === 0;
  const severity = pass ? 'pass' : 'fail';
  const keywords = hits.map((h) => h.keyword).filter(Boolean);
  const uniqueKeywords = [...new Set(keywords)];

  const hitsHtml = hits.length
    ? hits
      .map(
        (h) => `
        <div class="rule-hit" data-search="${escapeHtml(normaliseMedexpressSearch(h))}">
          <p><strong>Keyword:</strong> ${escapeHtml(h.keyword)}${h.actualMatch && h.actualMatch !== h.keyword ? ` → matched "${escapeHtml(h.actualMatch)}"` : ''}</p>
          ${h.snippet ? `<div class="finding-card__excerpt">${escapeHtml(h.snippet)}</div>` : ''}
        </div>`
      )
      .join('')
    : '<p class="empty-state">No keywords matched for this rule.</p>';

  return `
    <article class="finding-card finding-card--${severity} rule-card ${pass ? 'is-expanded' : ''}" data-search="${escapeHtml([rule.id, rule.name, ...uniqueKeywords].join(' ').toLowerCase())}">
      <div class="finding-card__header" role="button" tabindex="0" aria-expanded="${pass ? 'true' : 'false'}">
        <span class="severity-pill severity-pill--${severity}">${pass ? 'PASS' : 'FAIL'}</span>
        <strong>${escapeHtml(rule.id)} — ${escapeHtml(rule.name)}</strong>
        <span class="category-tag">${escapeHtml(rule.category || '')}</span>
        ${hits.length ? `<span class="hit-count">${hits.length} hit${hits.length === 1 ? '' : 's'}</span>` : ''}
      </div>
      <div class="finding-card__body">
        ${hitsHtml}
      </div>
    </article>
  `;
}

/** @param {object} f */
function normaliseMedexpressSearch(f) {
  return [f.ruleId, f.ruleName, f.keyword, f.snippet, f.actualMatch].filter(Boolean).join(' ').toLowerCase();
}

/** @param {object} scan */
function renderKeyData(scan) {
  const grid = document.getElementById('key-data-grid');
  const bmi = scan?.bmi || {};
  const items = [];

  if (bmi.weight != null) {
    items.push({
      label: 'Weight',
      value: String(bmi.weight),
      unit: 'kg',
      date: bmi.weightDate,
    });
  }
  if (bmi.height != null) {
    items.push({
      label: 'Height',
      value: String(bmi.height),
      unit: 'cm',
      date: bmi.heightDate,
    });
  }
  if (bmi.bmi != null) {
    items.push({
      label: 'BMI',
      value: String(bmi.bmi),
      unit: 'kg/m²',
      date: bmi.bmiDate,
    });
  }

  const extractors = scan?.extractors || [];
  for (const item of extractors) {
    items.push(item);
  }

  if (!items.length) {
    grid.innerHTML = '<p class="empty-state">No BMI or vitals extracted from Clinical Observations.</p>';
  } else {
    grid.innerHTML = items
      .map(
        (item) => `
      <div class="key-data-item">
        <label>${escapeHtml(item.label)}</label>
        <div class="value">${escapeHtml(item.value)}${item.unit ? ` ${escapeHtml(item.unit)}` : ''}</div>
        ${item.date ? `<div class="date">${escapeHtml(item.date)}</div>` : ''}
      </div>
    `
      )
      .join('');
  }

  const medsEl = document.getElementById('medications-list');
  const meds = scan?.medications || [];
  if (!meds.length) {
    medsEl.innerHTML = '<h3>Current / recent medications</h3><p class="empty-state">None extracted.</p>';
  } else {
    medsEl.innerHTML = `
      <h3>Current / recent medications</h3>
      <ul>
        ${meds.map((m) => `<li>${escapeHtml(m.name)}${m.date ? ` <span class="med-date">(${escapeHtml(m.date)})</span>` : ''}</li>`).join('')}
      </ul>
    `;
  }
}

/** @param {object} scan */
function renderSupplementary(scan) {
  const flags = scan?.flags || [];
  const section = document.getElementById('supplementary-section');
  const container = document.getElementById('supplementary-findings');
  if (!flags.length || !section || !container) return;

  section.removeAttribute('hidden');
  container.innerHTML = flags
    .map(
      (f) => `
    <article class="finding-card finding-card--${escapeHtml(f.severity || 'info')}">
      <div class="finding-card__header">
        <span class="severity-pill severity-pill--${escapeHtml(f.severity || 'info')}">${escapeHtml(f.severity || 'info')}</span>
        <strong>${escapeHtml(f.label || '')}</strong>
      </div>
      <div class="finding-card__body">
        ${f.matchedExcerpt ? `<div class="finding-card__excerpt">${escapeHtml(f.matchedExcerpt)}</div>` : ''}
      </div>
    </article>`
    )
    .join('');
}

function bindToolbar() {
  document.getElementById('btn-print')?.addEventListener('click', () => window.print());
  document.getElementById('btn-expand-all')?.addEventListener('click', () => setAllExpanded(true));
  document.getElementById('btn-collapse-all')?.addEventListener('click', () => setAllExpanded(false));

  document.getElementById('filter-input')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.finding-card, .rule-hit').forEach((el) => {
      const text = el.getAttribute('data-search') || '';
      el.classList.toggle('is-filtered-out', q && !text.includes(q));
    });
  });
}

/** @param {Element|null} card */
function toggleCard(card) {
  if (!card) return;
  card.classList.toggle('is-expanded');
  const header = card.querySelector('.finding-card__header');
  header?.setAttribute('aria-expanded', card.classList.contains('is-expanded'));
}

/** @param {boolean} expanded */
function setAllExpanded(expanded) {
  document.querySelectorAll('.finding-card').forEach((card) => {
    card.classList.toggle('is-expanded', expanded);
    card.querySelector('.finding-card__header')?.setAttribute('aria-expanded', String(expanded));
  });
}

/** @param {string} str */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
