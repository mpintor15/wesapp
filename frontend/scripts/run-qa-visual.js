#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { collectAndWriteReport, REPORT_PATH, SUMMARY_PATH } = require('../e2e/qa/helpers/reportCollector');
const { QA_RESULTS_DIR } = require('../e2e/qa/helpers/evidence');

const requiredEnv = ['E2E_BASE_URL', 'E2E_API_URL', 'E2E_BACKEND_HEALTH_URL'];
const openReport = process.argv.includes('--open-report');

const assertNode20 = () => {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 20) {
    throw new Error(`Node 20 requerido. Version actual: ${process.version}`);
  }
};

const assertRequiredEnv = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Variables requeridas no definidas: ${missing.join(', ')}`);
  }
};

const assertLocalHttpUrl = (rawUrl, label) => {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} debe ser HTTP/HTTPS: ${rawUrl}`);
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error(`${label} debe apuntar a un host local: ${rawUrl}`);
  }
  return url;
};

const cleanQaResults = () => {
  const frontendRoot = path.resolve(__dirname, '..');
  const resolved = path.resolve(QA_RESULTS_DIR);
  if (resolved !== path.join(frontendRoot, 'qa-results')) {
    throw new Error(`Directorio QA inesperado: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
};

const checkUrl = async (rawUrl, label) => {
  const response = await fetch(rawUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`${label} no responde correctamente: HTTP ${response.status} ${rawUrl}`);
  }
};

const runPlaywright = () =>
  spawnSync('npx', ['playwright', 'test', '--config=playwright.qa.config.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: process.env.E2E_BASE_URL,
      E2E_WORKERS: '1',
    },
    stdio: 'inherit',
  });

const main = async () => {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  assertNode20();
  assertRequiredEnv();
  assertLocalHttpUrl(process.env.E2E_BASE_URL, 'E2E_BASE_URL');
  assertLocalHttpUrl(process.env.E2E_API_URL, 'E2E_API_URL');
  assertLocalHttpUrl(process.env.E2E_BACKEND_HEALTH_URL, 'E2E_BACKEND_HEALTH_URL');

  cleanQaResults();
  await checkUrl(process.env.E2E_BACKEND_HEALTH_URL, 'Backend QA');
  await checkUrl(process.env.E2E_BASE_URL, 'Frontend QA');

  const result = runPlaywright();
  const report = collectAndWriteReport({
    startedAt,
    durationMs: Date.now() - startedMs,
  });

  console.log(`QA visual report JSON: ${REPORT_PATH}`);
  console.log(`QA visual summary: ${SUMMARY_PATH}`);
  console.log(`QA visual screenshots: ${path.join(QA_RESULTS_DIR, 'screenshots')}`);
  if (openReport) {
    console.log(`Playwright HTML report: ${path.join(QA_RESULTS_DIR, 'playwright-report', 'index.html')}`);
  }

  if (report.summary.blocking > 0) {
    process.exitCode = 1;
    return;
  }

  if (result.error || (result.status && report.summary.scenarios === 0)) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
