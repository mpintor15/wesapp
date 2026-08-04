const fs = require('node:fs');
const path = require('node:path');
const { getScenarioId } = require('../scenarios');
const { toPosixPath } = require('./diagnostics');

const QA_RESULTS_DIR = path.resolve(__dirname, '..', '..', '..', 'qa-results');
const SCREENSHOTS_DIR = path.join(QA_RESULTS_DIR, 'screenshots');
const SCREENS_DIR = path.join(QA_RESULTS_DIR, 'screens');

const ensureQaDirs = () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
};

const getScreenshotName = (scenario) => `${getScenarioId(scenario)}.png`;

const getScreenshotPath = (scenario) => path.join(SCREENSHOTS_DIR, getScreenshotName(scenario));

const getScreenDataPath = (scenario) => path.join(SCREENS_DIR, `${getScenarioId(scenario)}.json`);

const saveScenarioScreenshot = async (page, scenario) => {
  ensureQaDirs();
  const screenshotPath = getScreenshotPath(scenario);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return toPosixPath(path.relative(QA_RESULTS_DIR, screenshotPath));
};

const writeScreenResult = (scenario, result) => {
  ensureQaDirs();
  fs.writeFileSync(getScreenDataPath(scenario), `${JSON.stringify(result, null, 2)}\n`);
};

module.exports = {
  QA_RESULTS_DIR,
  SCREENS_DIR,
  SCREENSHOTS_DIR,
  ensureQaDirs,
  getScreenDataPath,
  getScreenshotName,
  getScreenshotPath,
  saveScenarioScreenshot,
  writeScreenResult,
};
