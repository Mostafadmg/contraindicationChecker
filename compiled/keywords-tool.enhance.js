/**
 * SCR section nav — compact icon rail, click to expand with readable labels.
 */
(function () {
  const NAV_SELECTOR = 'nav[aria-label="Section navigation"]';

  const ICONS = {
    search:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    allergy:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    pill:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-4a2.2 2.2 0 0 0 2.7-2.7l-4-10a2.2 2.2 0 0 0-4.2 0l-4 10a2.2 2.2 0 0 0 2.7 2.7z"/><path d="M8.5 8.5 15 15"/></svg>',
    diagnosis:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
    vitals:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.94a2 2 0 0 1-3.88 0L9.24 2.18a2 2 0 0 0-3.88 0l-2.35 8.94A2 2 0 0 1 1.49 12H0"/></svg>',
    section:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
    chevron:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  };

  function iconKey(title) {
    const t = title.toLowerCase();
    if (t.includes('search')) return 'search';
    if (t.includes('allerg')) return 'allergy';
    if (t.includes('medication') || t.includes('medicines')) return 'pill';
    if (t.includes('diagnos')) return 'diagnosis';
    if (t.includes('observation')) return 'vitals';
    return 'section';
  }

  function shortLabel(title) {
    const t = title.trim();
    if (t.startsWith('Search')) return 'Search record';
    if (t.startsWith('Allergies')) return 'Allergies';
    if (t.startsWith('Acute Medications')) return 'Acute medications';
    if (t.startsWith('Current Repeat')) return 'Repeat medications';
    if (t.startsWith('Discontinued')) return 'Discontinued meds';
    if (t.startsWith('Diagnoses')) return 'Diagnoses';
    if (t.startsWith('Clinical Observations')) return 'Observations';
    if (t.length > 36) return `${t.slice(0, 34)}…`;
    return t;
  }

  function setExpanded(nav, expanded) {
    nav.classList.toggle('edm-section-nav--expanded', expanded);
    nav.dataset.edmExpanded = expanded ? '1' : '0';
    const toggle = nav.querySelector('.edm-nav-toggle');
    if (toggle) {
      toggle.setAttribute(
        'aria-expanded',
        expanded ? 'true' : 'false'
      );
      toggle.setAttribute(
        'aria-label',
        expanded ? 'Collapse sections panel' : 'Expand sections panel'
      );
    }
  }

  function enhanceNav(nav) {
    if (nav.dataset.edmEnhanced === '1') return;
    nav.dataset.edmEnhanced = '1';
    nav.classList.add('edm-section-nav');
    nav.classList.remove('w-[200px]', 'p-2');

    const heading = nav.querySelector('h3');
    if (heading) {
      heading.classList.add('edm-nav-heading');
      heading.textContent = 'Sections';
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'edm-nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Expand sections panel');
    toggle.innerHTML = ICONS.chevron;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setExpanded(nav, !nav.classList.contains('edm-section-nav--expanded'));
    });
    nav.insertBefore(toggle, nav.firstChild);

    nav.querySelectorAll('ul button').forEach((btn) => {
      if (btn.querySelector('.edm-nav-icon')) return;
      const full = btn.textContent.trim();
      btn.classList.remove('break-words', 'text-blue-700');
      btn.classList.add('edm-nav-item');
      btn.title = full;
      btn.innerHTML =
        `<span class="edm-nav-icon" aria-hidden="true">${ICONS[iconKey(full)] || ICONS.section}</span>`
        + `<span class="edm-nav-label">${shortLabel(full)}</span>`;
    });
  }

  function tryEnhance() {
    const nav = document.querySelector(NAV_SELECTOR);
    if (nav) enhanceNav(nav);
  }

  const observer = new MutationObserver(() => tryEnhance());
  observer.observe(document.getElementById('root') || document.body, {
    childList: true,
    subtree: true,
  });

  tryEnhance();
})();
