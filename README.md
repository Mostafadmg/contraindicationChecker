# contraindicationChecker

Chrome extension for EveryDayMeds that automates NHS Summary Care Record (SCR) retrieval and runs clinical keyword pre-screening before prescribing.

## Features

- Opens NHS SCR from EveryDayMeds Rx order pages
- Auto-fills patient search (name, DOB, sex)
- Navigates to Clinical tab and extracts SCR content
- Screens for contraindication keywords (R001–R006)
- Presents results with PASS/FAIL summary, BMI/measurements, and highlighted matches

## Install (development)

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select this folder (the repo root)
5. Reload the extension after code changes

## Usage

1. Open an order at `https://rx.everydaymeds.co.uk/order/*`
2. Click **Go to NHS SCR** on the order page
3. The extension opens NHS, searches the patient, and opens the results tab when the SCR is retrieved

## Project structure

| Path | Purpose |
|------|---------|
| `manifest.json` | Extension manifest |
| `main-page.js` | Order page integration |
| `automate-scr.js` | NHS portal automation |
| `src/background.js` | Tab orchestration |
| `keywords-tool.html` | Results UI |
| `compiled/` | Bundled keyword tool + theme |
| `rules.html` | Screening rules reference |

## Disclaimer

This tool is an administrative aid only. Clinical decision-making must not be based on tool output alone. Prescribers must independently review the full Summary Care Record before prescribing.
