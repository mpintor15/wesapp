import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SEVERITIES,
  buildFinding,
  getResultFromFindings,
  sanitizeUrl,
} from '../../e2e/qa/helpers/diagnostics';
import {
  buildMarkdownSummary,
  buildReport,
  buildSummary,
  writeReportFiles,
} from '../../e2e/qa/helpers/reportCollector';
import { QA_RESULTS_DIR } from '../../e2e/qa/helpers/evidence';

const screen = (overrides = {}) => ({
  name: 'Dashboard',
  route: '/',
  role: 'gerente',
  viewport: { width: 1440, height: 900, name: '1440x900' },
  result: 'passed',
  screenshot: 'screenshots/dashboard-gerente-1440x900.png',
  load: { routeOk: true },
  pageErrors: [],
  consoleErrors: [],
  consoleWarnings: [],
  failedRequests: [],
  brokenImages: [],
  permissions: { result: 'passed', visible: [], missing: [], unexpected: [] },
  findings: [],
  ...overrides,
});

describe('QA visual report helpers', () => {
  test('sanitiza URLs sensibles sin perder contexto objetivo', () => {
    expect(sanitizeUrl('http://localhost:3201/api/auth/verify?token=abc&next=/cuentas#frag')).toBe(
      'http://localhost:3201/api/auth/verify?token=%5Bredacted%5D&next=%2Fcuentas'
    );
  });

  test('clasifica resultado por severidad', () => {
    expect(getResultFromFindings([])).toBe('passed');
    expect(
      getResultFromFindings([
        buildFinding({ severity: SEVERITIES.HIGH, category: 'Permisos', message: 'X' }),
      ])
    ).toBe('needs-review');
    expect(
      getResultFromFindings([
        buildFinding({ severity: SEVERITIES.BLOCKING, category: 'JS', message: 'X' }),
      ])
    ).toBe('failed');
  });

  test('agrega resumen por resultado y severidad', () => {
    const summary = buildSummary([
      screen(),
      screen({
        result: 'needs-review',
        findings: [buildFinding({ severity: SEVERITIES.HIGH, category: 'Permisos', message: 'X' })],
      }),
      screen({
        result: 'failed',
        findings: [
          buildFinding({ severity: SEVERITIES.BLOCKING, category: 'JS', message: 'X' }),
          buildFinding({ severity: SEVERITIES.MEDIUM, category: 'Consola', message: 'X' }),
          buildFinding({ severity: SEVERITIES.LOW, category: 'Técnico', message: 'X' }),
        ],
      }),
    ]);

    expect(summary).toEqual({
      scenarios: 3,
      passed: 1,
      failed: 1,
      needsReview: 1,
      blocking: 1,
      high: 1,
      medium: 1,
      low: 1,
    });
  });

  test('genera Markdown con secciones obligatorias', () => {
    const markdown = buildMarkdownSummary(
      buildReport({
        startedAt: '2026-08-04T00:00:00.000Z',
        durationMs: 10,
        screens: [screen()],
      })
    );

    expect(markdown).toContain('## Verificado automáticamente');
    expect(markdown).toContain('## Qué debes revisar tú manualmente');
    expect(markdown).toContain('## No necesitas revisar manualmente');
    expect(markdown).toContain('| Dashboard | Calidad estética del degradado |');
  });

  test('serializa reporte JSON y resumen Markdown', () => {
    const report = buildReport({
      startedAt: '2026-08-04T00:00:00.000Z',
      durationMs: 10,
      screens: [screen()],
    });

    writeReportFiles(report);

    const jsonPath = path.join(QA_RESULTS_DIR, 'report.json');
    const markdownPath = path.join(QA_RESULTS_DIR, 'summary.md');

    expect(JSON.parse(fs.readFileSync(jsonPath, 'utf8')).schemaVersion).toBe(1);
    expect(fs.readFileSync(markdownPath, 'utf8')).toContain('QA visual automatizado');

    fs.rmSync(path.join(os.tmpdir(), 'unused-qa-visual-test-dir'), {
      recursive: true,
      force: true,
    });
  });
});
