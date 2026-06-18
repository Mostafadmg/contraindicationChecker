// SCR Automation script for SCR Clinical Check Tool Extension
(function () {
  console.log("SCR Automation Script - Running automate-scr.js");

  // Initialize handlers procedurally based on explicit calls
  const currentUrl = window.location.href;
  const currentPath = window.location.pathname;

  // Allow background script to detect that this content script is loaded
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping_automate_scr") {
      sendResponse({ loaded: true });
    }
  });

  // Initialize NHS page handler if on NHS page
  if (currentUrl.includes("/nationalcarerecordsservice")) {
    console.log("SCR site, running automation")
    initializeNHSPageHandler();
    scheduleScrResultsRecovery();
  }

  // Initialize NHS page handler - only called when needed
  function initializeNHSPageHandler() {
    let attempts = 0;
    const maxAttempts = 30;

    function tryStart() {
      chrome.runtime.sendMessage(
        { action: "should_run_automation" },
        (response) => {
          if (response && response.shouldRun) {
            startSummaryCareRecordAutomation(response.userData);
            return;
          }
          if (attempts++ < maxAttempts) {
            setTimeout(tryStart, 200);
          }
        }
      );
    }

    tryStart();
  }

  /** If automation reached Clinical tab but missed SCR extract, retry (SPA timing). */
  function scheduleScrResultsRecovery() {
    let attempts = 0;
    const maxAttempts = 45;

    const tick = () => {
      if (window.__edmScrResultsSent) return;

      if (!location.pathname.includes("/app/patient")) {
        if (++attempts < maxAttempts) setTimeout(tick, 2000);
        return;
      }

      const hasScr =
        document.querySelector(".scr-print-wrapper")
        || document.querySelector("table.scr-table")
        || document.querySelector("#AllergiesandAdverseReactions");

      if (hasScr) {
        chrome.runtime.sendMessage(
          { action: "should_run_automation" },
          (response) => {
            if (response?.shouldRun && !window.__edmScrResultsSent) {
              console.log("Recovering SCR keyword scan on patient clinical tab");
              void checkClinicalPageContent(response.userData);
            }
          }
        );
        return;
      }

      if (++attempts < maxAttempts) {
        setTimeout(tick, 2000);
      }
    };

    setTimeout(tick, 2000);
  }

  // Wait for content changes using polling
  function waitForContentChange(
    selectors,
    timeout = SCR_CONFIG.DOM_WAIT_TIMEOUT,
    interval = 100
  ) {
    return new Promise((resolve, reject) => {
      // Function to check if any selector matches
      const check = () => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return el;
        }
        return null;
      };

      // Initial check in case the element is already present
      const found = check();
      if (found) {
        resolve(found);
        return;
      }

      // Start polling
      const poller = setInterval(() => {
        const el = check();
        if (el) {
          clearInterval(poller);
          clearTimeout(timer);
          resolve(el);
        }
      }, interval);

      // Handle timeout
      const timer = setTimeout(() => {
        clearInterval(poller);

        // Log what's currently on the page for debugging
        console.error("Timeout waiting for selectors:", selectors);
        console.error("Current URL:", window.location.href);
        console.error("Page title:", document.title);

        // Try to find any forms or tabs on the page
        const forms = document.querySelectorAll("form");
        const tabs = document.querySelectorAll('[role="tab"], [id*="tab"]');
        console.error("Forms found:", forms.length);
        console.error("Tabs found:", tabs.length);
        if (tabs.length > 0) {
          console.error(
            "Available tabs:",
            Array.from(tabs).map((t) => ({
              id: t.id,
              text: t.textContent?.trim(),
            }))
          );
        }

        reject(
          new Error(
            `Timeout: None of the selectors appeared in time. Selectors: ${selectors.join(
              ", "
            )}`
          )
        );
      }, timeout);
    });
  }

  // Start SCR processing - procedural workflow
  async function startSummaryCareRecordAutomation(userData) {
    if (window.__edmScrAutomationStarted) {
      console.log("SCR automation already running — skipping duplicate start");
      return;
    }
    window.__edmScrAutomationStarted = true;
    console.log("Starting SCR processing");

    try {
      // Step 1: Check authentication
      await executeAuthentication(userData)
      await verifyPatientSearchLoaded()

      // Step 2: Fill form
      const patientFound = await executeFormFilling(userData);

      // Step 3: Get Summary Care Record
      if (patientFound){
        await executeGetSummaryCareRecord(userData);
        console.log("SCR processing completed successfully");
      } else{
        console.log("Patient not found / multiple results")
      }

    } catch (error) {
      console.error("SCR processing failed:", error);
      handleStepError("processing", error.message);
    }
  }

  // Execute authentication step
  async function executeAuthentication(userData) {
    if (
      document.querySelector('#basic-search-tab')
      || document.querySelector('#advanced-search-tab')
    ) {
      console.log('Patient search already visible — skipping role confirm');
      return;
    }
    await waitForAuthenticationAndProcess();
  }

  // Wait for authentication page to load and process authentication
  async function waitForAuthenticationAndProcess() {
    console.log("Waiting for authentication page elements...");
    // Wait for the authentication header to appear
    await waitForContentChange(["#select-role-header"]);

    // Check if the user is logged in with the correct organization
    const pageContent = document.body.textContent || document.body.innerText;
    const orgOk =
      pageContent.includes(SCR_CONFIG.AUTH_TEXT)
      || (SCR_CONFIG.AUTH_ORG_CODE && pageContent.includes(SCR_CONFIG.AUTH_ORG_CODE));
    if (!orgOk) {
      throw new Error(
        `Wrong organization — expected ${SCR_CONFIG.AUTH_TEXT} (${SCR_CONFIG.AUTH_ORG_CODE})`
      );
    }

    // Find and click the continue button
    const continueButton = findContinueButton();
    console.log("Clicking continue button...");
    continueButton.click();
  }

  // Wait for React component to update and show patient search page (with tabs)
  async function verifyPatientSearchLoaded() {
    console.log("Waiting for patient search page to load...");
    console.log("Current URL:", window.location.href);
    try {
      await waitForContentChange(["#basic-search-tab", "#advanced-search-tab"]);

      // Additional check for patient search content
      const pageContent = document.body.textContent || document.body.innerText;
      const hasPatientSearchContent =
        pageContent.includes("Find patient") &&
        pageContent.includes("NHS Number") &&
        (pageContent.includes("Basic") || pageContent.includes("Advanced"));

      if (!hasPatientSearchContent) {
        chrome.runtime.sendMessage({ action: "patientSearchNotLoaded" });
        throw new Error("Patient search content not found");
      }
    } catch (error) {
      console.error("Error in verifyPatientSearchLoaded:", error);

      // Check if it's a timeout error
      if (error.message && error.message.includes("Timeout")) {
        throw new Error(
          `React update timeout - Patient search page did not appear within ${
            SCR_CONFIG.DOM_WAIT_TIMEOUT / 1000
          } seconds after clicking continue`
        );
      } else {
        // Re-throw the original error for non-timeout errors
        throw error;
      }
    }
  }

  // Wait for Advanced tab form elements to load after clicking Advanced tab
  async function waitForAdvancedTabForm() {
    await waitForContentChange(["#advanced-search-form-gender-1"]);
    console.log("Advanced tab form elements loaded");
  }

  // Click the "single date" link to switch from date range to single date
  async function clickSingleDateLink() {
    const singleDateLink = document.querySelector(
      "#advanced-search-form-dob-control-a"
    );
    if (!singleDateLink) {
      throw new Error("Single date link not found");
    }
    singleDateLink.click();
    console.log("Single date link clicked");
    // Wait for single date field to appear
    await waitForContentChange(["#advanced-search-form-dob-single"]);
  }

  // Wait for NHS number form elements to load
  async function waitForNhsNumberForm() {
    await waitForContentChange([
      "#nhs-number-search-form-nhs-number",
      ".patient-search-form__button",
    ]);
  }

  // Wait for patient page to load after search
  async function waitForPatientPage() {
    await waitForContentChange(["#patient-clinicals-navigation-tab"]);
  }

  // Wait for either permission modal or clinical page to appear
  async function waitForPermissionModalOrClinicalPage() {
    console.log("Waiting for either permission modal or clinical page...");

    // Wait for either permission modal or clinical page
    const element = await waitForContentChange([
      "#access-management-yes", // Permission modal
      ".clinicals-page", // Clinical page (direct access)
    ]);

    // Check which element was found
    if (element.id === "access-management-yes") {
      console.log("Permission modal detected");
      // Additional check for permission text
      const pageContent = document.body.textContent || document.body.innerText;
      if (
        !pageContent.includes(
          "Has this patient given permission to view their Summary Care Record?"
        )
      ) {
        throw new Error("Permission modal text not found");
      }
      return "permission-modal";
    } else if (element.classList.contains("clinicals-page")) {
      console.log("Clinical page detected (direct access)");
      return "clinical-page";
    }

    throw new Error("Unexpected element found");
  }

  // Execute form filling step
  async function executeFormFilling(userData) {
    // Step 1: Click Advanced tab
    clickAdvancedTab();

    // Step 2: Wait for Advanced tab form to load
    await waitForAdvancedTabForm();

    // Step 3: Click single date link
    await clickSingleDateLink();

    // Step 4: Select gender
    selectGender(userData.gender);

    // Step 5: Fill first name
    fillFirstName(userData.firstName);

    // Step 6: Fill last name
    fillLastName(userData.lastName);

    // Step 7: Fill date of birth
    fillDateOfBirth(userData.dateOfBirth);

    // Step 8: Click find patient button
    clickFindPatientButton();

    // Wait for search results to load
    const hasResults = await waitForSearchResults(userData);

    if (!hasResults) {
      // No results found - handle patient not found
      await handlePatientNotFound(userData);
      return false;
    }

    // Check that we have exactly 1 search result
    const hasExactlyOneResult = await checkSearchResultsCount(userData);

    if (!hasExactlyOneResult){
      return false
    }

    // Click the relevant search result
    await clickRelevantSearchResult(userData);

    console.log("Form filling completed successfully");
    return true;
  }

  // Wait for search results to load
  async function waitForSearchResults(userData) {
    console.log("Waiting for search results...");

    // Wait for either search results or no results message
    const element = await waitForContentChange([".query-results-container"]);

    // Check if it's the no results heading
    if (
      element.tagName === "H1" &&
      element.textContent.includes("No results found for the following:")
    ) {
      console.log("No search results found");
      chrome.runtime.sendMessage({ action: "noSearchResults", userData });

      return false; // Indicate no results
    }

    return true; // Indicate results found
  }

  // Check search results count to ensure only 1 result
  async function checkSearchResultsCount(userData) {
    console.log("Checking search results count...");

    const heroWrapper = document.querySelector(".nhsuk-hero__wrapper");
    if (!heroWrapper) {
      throw new Error("Search results header not found");
    }

    const headerText = heroWrapper.textContent.trim();
    console.log("Search results header text:", headerText);

    // Check if no results found
    if (headerText.includes("No results found")) {
      console.log("No search results found for patient");
      chrome.runtime.sendMessage({ action: "noSearchResults", userData });
      return false;
    }

    // Match patterns like "2 Basic Search Results" or "1 Advanced Search Results"
    const match = headerText.match(/(\d+)\s+\w+\s+Search Result/);

    if (!match) {
      throw new Error("Could not parse search results count from header");
    }

    const resultCount = parseInt(match[1]);
    console.log("Search results count:", resultCount);

    if (resultCount !== 1) {
      chrome.runtime.sendMessage({ action: "multiplePatientsFound", userData });

      return false
      // Show alert to user
      // alert(`Expected only 1 search result, but found ${resultCount} results`);

      
    }

    return true;
  }

  async function clickRelevantSearchResult(userData) {
    console.log(
      "Looking for patient in search results:",
      userData.firstName,
      userData.lastName
    );

    // Find all result rows - try multiple selectors
    let resultRows = document.querySelectorAll(
      ".query-results-table__data-row"
    );

    // If no rows found, try table rows in query results container
    if (resultRows.length === 0) {
      resultRows = document.querySelectorAll(
        ".query-results-container tr.query-results-table__data-row"
      );
    }

    // If still no rows, try all table rows with tabindex
    if (resultRows.length === 0) {
      resultRows = document.querySelectorAll('tr[tabindex="0"]');
    }

    console.log("Total search results found:", resultRows.length);

    // Debug: log what's actually on the page
    if (resultRows.length === 0) {
      console.log("No rows found. Debugging page content:");
      console.log("All tables:", document.querySelectorAll("table").length);
      console.log("All tr elements:", document.querySelectorAll("tr").length);
      console.log(
        "Query results container:",
        document.querySelector(".query-results-container")
      );

      // Try to find any tr with patient data
      const allTrs = document.querySelectorAll("tr");
      allTrs.forEach((tr, index) => {
        if (
          tr.textContent.includes("D'SOUZA") ||
          tr.textContent.includes("Dwayne")
        ) {
          console.log(`Found potential row at index ${index}:`, tr);
          console.log("Row classes:", tr.className);
          console.log("Row HTML:", tr.outerHTML);
        }
      });
    }

    // Build the expected name pattern (firstName lastName, case insensitive)
    const firstName = userData.firstName.toLowerCase();
    const lastName = userData.lastName.toLowerCase();

    // Find matching rows
    const matchingRows = [];

    resultRows.forEach((row) => {
      // Get the name from the first cell
      const nameCell = row.querySelector(".query-results-table__data-row-name");
      if (nameCell) {
        const nameText = nameCell.textContent.trim().toLowerCase();

        // Check if the name contains both first and last name
        // Handle different apostrophe types and case variations
        const normalizedNameText = nameText.replace(/['']/g, "'");
        const normalizedLastName = lastName.replace(/['']/g, "'");

        // Debug logging
        console.log("Checking row:", {
          originalText: nameCell.textContent.trim(),
          normalizedText: normalizedNameText,
          searchingFor: `${firstName} + ${normalizedLastName}`,
          includesFirstName: normalizedNameText.includes(firstName),
          includesLastName: normalizedNameText.includes(normalizedLastName),
        });

        if (
          normalizedNameText.includes(firstName) &&
          normalizedNameText.includes(normalizedLastName)
        ) {
          matchingRows.push(row);
          console.log("Found matching patient:", nameCell.textContent.trim());
        }
      }
    });

    // Handle results
    if (matchingRows.length === 0) {
      await handlePatientNotFound(userData);
      return
      throw new Error(
        `No patient found with name: ${userData.firstName} ${userData.lastName}`
      );
    } else if (matchingRows.length > 1) {
      return;
      throw new Error(
        `Multiple patients found with name: ${userData.firstName} ${userData.lastName}. Found ${matchingRows.length} matches.`
      );
    } else {
      // Exactly one match found - click it
      console.log("Clicking on patient row");
      matchingRows[0].click();

      // Wait for patient page to load
      await waitForPatientPage();
    }
  }

  async function executeFormFillingWithNhsNumber(userData) {
    console.log("Executing form filling with NHS number");

    // Wait for NHS number form to be available
    await waitForNhsNumberForm();

    // Fill NHS number field with the hardcoded value
    const nhsNumber = "999 040 2132";
    fillNhsNumber(nhsNumber);

    // Click find patient button
    clickFindPatientButton();

    // Wait for patient page to load after clicking find patient
    await waitForPatientPage();

    console.log(
      "NHS number form filling and patient page load completed successfully"
    );
  }

  async function executeGetSummaryCareRecord(userData) {
    console.log("Executing get summary care record");

    console.log("About to click clinical tab...");
    console.log("Current URL:", window.location.href);
    console.log("Page title:", document.title);

    // Click the clinical tab
    clickClinicalTab();

    console.log("Clinical tab clicked, waiting for next page...");

    // Wait for either permission modal or clinical page
    const pageType = await waitForPermissionModalOrClinicalPage();

    if (pageType === "permission-modal") {
      console.log("Permission modal appeared, clicking Yes button...");
      // Click the Yes button in the permission modal
      clickPermissionYesButton();

      // Wait for clinical page to load after clicking Yes
      await waitForContentChange([".clinicals-page"]);
      console.log("Clinical page loaded after permission");
    }

    // At this point we should be on the clinical page
    // Check what type of content is available
    await checkClinicalPageContent(userData);

    console.log("Summary care record access completed successfully");
  }

  // Check what type of content is available on the clinical page
  async function checkClinicalPageContent(userData) {
    console.log("Checking clinical page content...");

    await waitForContentChange(
      [
        ".scr-print-wrapper",
        "table.scr-table",
        "#AllergiesandAdverseReactions",
        "#CurrentRepeatMedications",
        ".nhsuk-warning-callout",
      ],
      20000
    );

    const warningCallout = document.querySelector(".nhsuk-warning-callout");
    if (warningCallout) {
      const pageContent = document.body.textContent || document.body.innerText;
      if (pageContent.includes("No Summary Care Record exists")) {
        console.log("No Summary Care Record exists for this patient");
        chrome.runtime.sendMessage({ action: "noSCRForPatient", userData });
        return;
      }
    }

    const scrHtml = extractScrHtml();
    if (scrHtml) {
      console.log("SCR content found — sending to background for keyword scan");
      sendScrContentToBackground(scrHtml, userData);
      return;
    }

    throw new Error("Unable to determine clinical page content type");
  }

  /** NHS sometimes omits .scr-print-wrapper — grab clinical SCR HTML anyway. */
  function extractScrHtml() {
    const wrapper = document.querySelector(".scr-print-wrapper");
    if (wrapper?.innerHTML?.trim()) {
      return wrapper.innerHTML;
    }

    const clinicals = document.querySelector(".clinicals-page");
    if (
      clinicals
      && clinicals.querySelector(
        "table.scr-table, #AllergiesandAdverseReactions, #CurrentRepeatMedications"
      )
    ) {
      return clinicals.innerHTML;
    }

    const scrTable = document.querySelector("table.scr-table");
    if (scrTable) {
      const root =
        scrTable.closest(".clinicals-page")
        || scrTable.closest(".nhsuk-main-wrapper")
        || scrTable.closest("main");
      if (root?.innerHTML?.trim()) return root.innerHTML;
    }

    const gpHeading = Array.from(document.querySelectorAll("h1, h2")).find((h) =>
      (h.textContent || "").includes("General Practice Summary")
    );
    if (gpHeading) {
      const root =
        gpHeading.closest(".clinicals-page")
        || gpHeading.closest(".nhsuk-grid-column-two-thirds")
        || gpHeading.parentElement;
      if (root?.innerHTML?.trim()) return root.innerHTML;
    }

    return "";
  }

  function sendScrContentToBackground(scrContent, userData) {
    if (window.__edmScrResultsSent) {
      console.log("SCR results already sent — skipping duplicate");
      return;
    }
    window.__edmScrResultsSent = true;

    chrome.runtime.sendMessage(
      {
        action: "scrContentRetrieved",
        content: scrContent,
        userData: userData,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to send SCR content:",
            chrome.runtime.lastError
          );
          return;
        }
        if (response?.success) {
          console.log("SCR keyword scan complete — results tab opened");
        } else {
          console.error("SCR results failed:", response?.error);
        }
      }
    );
  }

  // Handle patient not found case
  async function handlePatientNotFound(userData) {
    console.log("Patient not found - stopping automation");
    // Message already sent to background script by caller
  }

  // Handle step errors
  function handleStepError(stepName, errorMessage) {
    console.error(`❌ Step ${stepName} failed: ${errorMessage}`);

    // Show error to user
    alert(
      `Summary Care Record Automation Error in ${stepName}: ${errorMessage}`
    );

    // Don't close tab on error - let user handle it
    console.log(
      "Processing stopped due to error. Tab remains open for user review."
    );
  }

  // Find the continue button (NHS page)
  function findContinueButton() {
    const buttons = document.querySelectorAll(
      'button, input[type="submit"], a'
    );

    for (const button of buttons) {
      const text = button.textContent || button.value || button.innerText;

      if (
        text &&
        (text.includes("Confirm and continue to Find a patient") ||
          text.includes("Continue") ||
          text.includes("Find a patient"))
      ) {
        return button;
      }
    }

    throw new Error("Continue button not found on authentication page");
  }

  // Click Advanced tab
  function clickAdvancedTab() {
    const advancedTab = document.querySelector("#advanced-search-tab");
    if (!advancedTab) {
      throw new Error("Advanced tab not found");
    }
    advancedTab.click();
  }

  // Select gender radio button
  function selectGender(gender) {
    const g = (gender || "").toLowerCase();
    let genderSelector;

    if (g === "male") {
      genderSelector = "#advanced-search-form-gender-2";
    } else if (g === "female") {
      genderSelector = "#advanced-search-form-gender-1";
    } else {
      genderSelector = "#advanced-search-form-gender-3";
    }

    const genderRadio = document.querySelector(genderSelector);
    if (!genderRadio) {
      throw new Error(`Gender radio button not found: ${genderSelector}`);
    }

    genderRadio.click();
    genderRadio.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Fill first name field
  function fillFirstName(firstName) {
    const firstNameInput = document.querySelector(
      "#advanced-search-form-firstname"
    );
    if (!firstNameInput) {
      throw new Error("First name input not found");
    }

    firstNameInput.value = firstName;
    firstNameInput.dispatchEvent(new Event("input", { bubbles: true }));
    firstNameInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Fill last name field
  function fillLastName(lastName) {
    const lastNameInput = document.querySelector(
      "#advanced-search-form-surname"
    );
    if (!lastNameInput) {
      throw new Error("Last name input not found");
    }

    lastNameInput.value = lastName;
    lastNameInput.dispatchEvent(new Event("input", { bubbles: true }));
    lastNameInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Fill date of birth field
  function fillDateOfBirth(dateOfBirth) {
    const dobInput = document.querySelector("#advanced-search-form-dob-single");
    if (!dobInput) {
      throw new Error("Date of birth input not found");
    }

    dobInput.value = dateOfBirth;
    dobInput.dispatchEvent(new Event("input", { bubbles: true }));
    dobInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Fill NHS number field
  function fillNhsNumber(nhsNumber) {
    const nhsNumberInput = document.querySelector(
      "#nhs-number-search-form-nhs-number"
    );
    if (!nhsNumberInput) {
      throw new Error("NHS number input not found");
    }

    nhsNumberInput.value = nhsNumber;
    nhsNumberInput.dispatchEvent(new Event("input", { bubbles: true }));
    nhsNumberInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Click Find a patient button
  function clickFindPatientButton() {
    const findPatientButton = document.querySelector(
      ".patient-search-form__button"
    );
    if (!findPatientButton) {
      throw new Error("Find a patient button not found");
    }

    findPatientButton.click();
  }

  // Click Clinical tab
  function clickClinicalTab() {
    const clinicalTab = document.querySelector(
      "#patient-clinicals-navigation-tab"
    );

    if (!clinicalTab) {
      // Debug: show what tabs are available
      const allTabs = document.querySelectorAll('[id*="tab"], [role="tab"]');
      console.error(
        "Available tabs:",
        Array.from(allTabs).map((tab) => ({
          id: tab.id,
          className: tab.className,
          text: tab.textContent?.trim(),
        }))
      );
      throw new Error("Clinical tab not found");
    }

    console.log("Clinical tab found, checking properties:", {
      id: clinicalTab.id,
      className: clinicalTab.className,
      textContent: clinicalTab.textContent?.trim(),
      isVisible: clinicalTab.offsetParent !== null,
      isDisabled: clinicalTab.disabled || clinicalTab.getAttribute("disabled"),
    });

    // Try multiple click approaches
    clinicalTab.click();

    // Also try dispatching a click event
    clinicalTab.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );

    console.log("Clinical tab clicked");
  }

  // Click Yes button in permission modal
  function clickPermissionYesButton() {
    const yesButton = document.querySelector("#access-management-yes");
    if (!yesButton) {
      throw new Error("Permission Yes button not found");
    }

    yesButton.click();
  }
})(); // End of IIFE
