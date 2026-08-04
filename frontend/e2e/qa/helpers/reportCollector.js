const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  SEVERITIES,
  countFindingsBySeverity,
  summarizeCheck,
} = require('./diagnostics');
const { QA_RESULTS_DIR, SCREENS_DIR } = require('./evidence');

const REPORT_PATH = path.join(QA_RESULTS_DIR, 'report.json');
const SUMMARY_PATH = path.join(QA_RESULTS_DIR, 'summary.md');

const getGitValue = (args, fallback = '') => {
  try {
    return execFileSync('git', args, {
      cwd: path.resolve(__dirname, '..', '..', '..', '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return fallback;
  }
};

const readScreenResults = () => {
  if (!fs.existsSync(SCREENS_DIR)) return [];

  return fs
    .readdirSync(SCREENS_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(SCREENS_DIR, file), 'utf8')));
};

const buildSummary = (screens) => {
  const severityCounts = countFindingsBySeverity(screens);

  return {
    scenarios: screens.length,
    passed: screens.filter((screen) => screen.result === 'passed').length,
    failed: screens.filter((screen) => screen.result === 'failed').length,
    needsReview: screens.filter((screen) => screen.result === 'needs-review').length,
    ...severityCounts,
  };
};

const buildReport = ({ startedAt, durationMs, screens = readScreenResults() } = {}) => ({
  schemaVersion: 1,
  run: {
    commit: getGitValue(['rev-parse', 'HEAD']),
    branch: getGitValue(['branch', '--show-current']),
    browser: 'chromium',
    os: `${os.platform()} ${os.release()}`,
    startedAt: startedAt || new Date().toISOString(),
    durationMs: Number(durationMs || 0),
  },
  summary: buildSummary(screens),
  screens,
});

const getFindingsBySeverity = (screens, severity) =>
  screens.flatMap((screen) =>
    (screen.findings || [])
      .filter((finding) => finding.severity === severity)
      .map((finding) => ({ screen, finding }))
  );

const formatFindings = (items) => {
  if (items.length === 0) return '- Ninguno.';

  return items
    .map(
      ({ screen, finding }) =>
        `- ${screen.name} (${screen.role}, ${screen.viewport.name}): ${finding.category} - ${finding.message}`
    )
    .join('\n');
};

const buildManualReviewTable = () => [
  '| Pantalla | Qué revisar manualmente | Motivo | Resultado |',
  '|---|---|---|---|',
  '| Dashboard | Calidad estética del degradado | Decisión visual y de marca | Pendiente |',
  '| Dashboard | Tamaño percibido del logo | Equilibrio visual | Pendiente |',
  '| Dashboard | Densidad de tarjetas | Decisión UX | Pendiente |',
  '| Cabeceras | Consistencia visual entre módulos | Criterio humano | Pendiente |',
  '| Cuentas | Claridad de acciones | Decisión UX | Pendiente |',
  '| Clientes | Ritmo visual y legibilidad | Evaluación humana | Pendiente |',
  '| Inventario | Densidad de controles | Preferencia operativa | Pendiente |',
  '| Personal | Jerarquía de acciones | Evaluación humana | Pendiente |',
  '| Usuarios | Claridad de acciones sensibles | Evaluación humana | Pendiente |',
].join('\n');

const buildObjectivePassList = (screens) => {
  const checks = [
    ['Rutas cargadas', screens.every((screen) => screen.load?.routeOk)],
    ['Errores JavaScript', screens.every((screen) => screen.consoleErrors.length === 0)],
    ['Requests fallidas bloqueantes', screens.every((screen) => screen.failedRequests.length === 0)],
    ['Imágenes rotas', screens.every((screen) => screen.brokenImages.length === 0)],
    ['Permisos visibles mínimos', screens.every((screen) => screen.permissions.result !== 'needs-review')],
    ['Screenshots generados', screens.every((screen) => Boolean(screen.screenshot))],
  ];

  const passed = checks.filter(([, ok]) => ok).map(([label]) => `- ${label}.`);
  return passed.length > 0 ? passed.join('\n') : '- Ninguno.';
};

const formatPermissionsCell = (permissions) => {
  if (permissions.result === 'not-applicable') return 'N/A';
  return permissions.result === 'passed' ? 'OK' : 'Revisar';
};

const buildMarkdownSummary = (report) => {
  const rows = report.screens.map((screen) =>
    [
      screen.name,
      screen.route,
      screen.role,
      screen.viewport.name,
      screen.pageErrors.length === 0 ? 'OK' : String(screen.pageErrors.length),
      summarizeCheck(screen.consoleErrors),
      summarizeCheck(screen.failedRequests),
      summarizeCheck(screen.brokenImages),
      formatPermissionsCell(screen.permissions),
      screen.result,
    ].join(' | ')
  );

  return [
    '# QA visual automatizado',
    '',
    '## Resultado general',
    '',
    `- Escenarios: ${report.summary.scenarios}`,
    `- Pasados: ${report.summary.passed}`,
    `- Fallidos: ${report.summary.failed}`,
    `- Requieren revisión: ${report.summary.needsReview}`,
    `- Bloqueantes: ${report.summary.blocking}`,
    `- Altos: ${report.summary.high}`,
    `- Medios: ${report.summary.medium}`,
    `- Bajos: ${report.summary.low}`,
    '',
    '| Pantalla | Ruta | Rol | Viewport | JS | Consola | Red | Imágenes | Permisos | Resultado |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row} |`),
    '',
    '## Hallazgos bloqueantes',
    '',
    formatFindings(getFindingsBySeverity(report.screens, SEVERITIES.BLOCKING)),
    '',
    '## Hallazgos altos',
    '',
    formatFindings(getFindingsBySeverity(report.screens, SEVERITIES.HIGH)),
    '',
    '## Hallazgos medios',
    '',
    formatFindings(getFindingsBySeverity(report.screens, SEVERITIES.MEDIUM)),
    '',
    '## Hallazgos bajos',
    '',
    formatFindings(getFindingsBySeverity(report.screens, SEVERITIES.LOW)),
    '',
    '## Verificado automáticamente',
    '',
    '- Rutas cargadas.',
    '- Errores JavaScript.',
    '- Errores de consola.',
    '- Requests fallidas.',
    '- Imágenes rotas.',
    '- Permisos visibles.',
    '- Screenshots.',
    '',
    '## Qué debes revisar tú manualmente',
    '',
    buildManualReviewTable(),
    '',
    '## No necesitas revisar manualmente',
    '',
    buildObjectivePassList(report.screens),
    '',
    'Codex no declara aprobada la estética; esta suite solo entrega evidencia objetiva.',
    '',
  ].join('\n');
};

const writeReportFiles = (report) => {
  fs.mkdirSync(QA_RESULTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(SUMMARY_PATH, buildMarkdownSummary(report));
};

const collectAndWriteReport = (options = {}) => {
  const report = buildReport(options);
  writeReportFiles(report);
  return report;
};

module.exports = {
  REPORT_PATH,
  SUMMARY_PATH,
  buildMarkdownSummary,
  buildReport,
  buildSummary,
  collectAndWriteReport,
  readScreenResults,
  writeReportFiles,
};
