const { test } = require('@playwright/test');
const { loginWithRole } = require('../helpers/criticalFlows');
const { disableAnimations } = require('../helpers/visual');
const { SCENARIOS } = require('./scenarios');
const {
  SEVERITIES,
  buildFinding,
  classifyFailedRequest,
  classifyResponseIssue,
  collectVisibleBrokenImages,
  getResultFromFindings,
  normalizeConsoleMessage,
} = require('./helpers/diagnostics');
const { saveScenarioScreenshot, writeScreenResult } = require('./helpers/evidence');

const navigationLabels = ['Cuentas', 'Clientes', 'Inventario', 'Personal', 'Usuarios'];
const permissionExpectations = {
  gerente: {
    visible: ['Cuentas', 'Clientes', 'Inventario', 'Personal', 'Usuarios'],
    hidden: [],
  },
  contador: {
    visible: ['Cuentas', 'Clientes', 'Personal'],
    hidden: ['Inventario', 'Usuarios'],
  },
};

const waitForStablePage = async (page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 8_000 });
  await page.locator('.spinner, .loading-spinner').first().waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts?.ready;
    window.scrollTo(0, 0);
    document.activeElement?.blur();
  });
};

const getCurrentPathname = (page) => new URL(page.url()).pathname;

const inspectPermissions = async (page, role) => {
  const expectation = permissionExpectations[role];
  if (!expectation) {
    return { result: 'not-applicable', visible: [], missing: [], unexpected: [] };
  }

  const visible = [];
  for (const label of navigationLabels) {
    const locator = page.locator('.module-card').filter({
      has: page.getByRole('heading', { name: new RegExp(`^${label}$`, 'i') }),
    });
    if (await locator.first().isVisible().catch(() => false)) {
      visible.push(label);
    }
  }

  const missing = expectation.visible.filter((label) => !visible.includes(label));
  const unexpected = expectation.hidden.filter((label) => visible.includes(label));

  return {
    result: missing.length === 0 && unexpected.length === 0 ? 'passed' : 'needs-review',
    visible,
    missing,
    unexpected,
  };
};

const buildEmptyScreenResult = (scenario) => ({
  name: scenario.name,
  route: scenario.route,
  role: scenario.role,
  viewport: {
    width: scenario.viewport.width,
    height: scenario.viewport.height,
    name: `${scenario.viewport.width}x${scenario.viewport.height}`,
  },
  result: 'passed',
  screenshot: '',
  load: {
    loginOk: false,
    routeOk: false,
    rootVisible: false,
    headingVisible: false,
    errorBoundaryAbsent: false,
    redirectOk: false,
    finalPath: '',
  },
  pageErrors: [],
  consoleErrors: [],
  consoleWarnings: [],
  failedRequests: [],
  brokenImages: [],
  permissions: {
    result: 'not-applicable',
    visible: [],
    missing: [],
    unexpected: [],
  },
  findings: [],
});

for (const scenario of SCENARIOS) {
  test(`${scenario.name} ${scenario.role} ${scenario.viewport.width}x${scenario.viewport.height}`, async ({
    page,
    request,
  }) => {
    const screen = buildEmptyScreenResult(scenario);
    const findings = screen.findings;
    const responseIssues = [];

    page.on('pageerror', (error) => {
      screen.pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      findings.push(
        buildFinding({
          severity: SEVERITIES.BLOCKING,
          category: 'JavaScript',
          message: error.message,
        })
      );
    });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        screen.consoleErrors.push(normalizeConsoleMessage(message));
        findings.push(
          buildFinding({
            severity: SEVERITIES.BLOCKING,
            category: 'Consola',
            message: message.text(),
          })
        );
      }

      if (message.type() === 'warning') {
        screen.consoleWarnings.push(normalizeConsoleMessage(message));
        findings.push(
          buildFinding({
            severity: SEVERITIES.MEDIUM,
            category: 'Consola',
            message: message.text(),
          })
        );
      }
    });

    page.on('requestfailed', (requestItem) => {
      const issue = classifyFailedRequest(requestItem);
      if (!issue) return;

      screen.failedRequests.push(issue);
      findings.push(
        buildFinding({
          severity: issue.severity,
          category: 'Red',
          message: `${issue.method} ${issue.url} falló: ${issue.failure}`,
        })
      );
    });

    page.on('response', (response) => {
      const issue = classifyResponseIssue(response);
      if (issue) responseIssues.push(issue);
    });

    try {
      await page.setViewportSize(scenario.viewport);
      await disableAnimations(page);
      await loginWithRole({ request, page, role: scenario.role });
      screen.load.loginOk = true;
    } catch (error) {
      findings.push(
        buildFinding({
          severity: SEVERITIES.BLOCKING,
          category: 'Login',
          message: error.message,
        })
      );
    }

    try {
      await page.goto(scenario.route, { waitUntil: 'domcontentloaded', timeout: 12_000 });
      await waitForStablePage(page);
    } catch (error) {
      findings.push(
        buildFinding({
          severity: SEVERITIES.BLOCKING,
          category: 'Carga',
          message: error.message,
        })
      );
    }

    screen.load.finalPath = getCurrentPathname(page);
    screen.load.redirectOk = screen.load.finalPath === scenario.route;
    screen.load.routeOk = screen.load.redirectOk;
    if (!screen.load.redirectOk) {
      findings.push(
        buildFinding({
          severity: SEVERITIES.BLOCKING,
          category: 'Ruta',
          message: `Ruta final inesperada: ${screen.load.finalPath}`,
        })
      );
    }

    screen.load.rootVisible = await page
      .locator(scenario.rootSelector)
      .first()
      .isVisible()
      .catch(() => false);
    if (!screen.load.rootVisible) {
      findings.push(
        buildFinding({
          severity: SEVERITIES.BLOCKING,
          category: 'Carga',
          message: `Root esperado no visible: ${scenario.rootSelector}`,
        })
      );
    }

    screen.load.headingVisible = await page
      .getByRole('heading', { name: scenario.heading })
      .first()
      .isVisible()
      .catch(() => false);
    if (!screen.load.headingVisible) {
      findings.push(
        buildFinding({
          severity: SEVERITIES.BLOCKING,
          category: 'Carga',
          message: 'Heading principal ausente',
        })
      );
    }

    const hasErrorBoundary = await page
      .getByText(/error boundary|something went wrong|ha ocurrido un error/i)
      .first()
      .isVisible()
      .catch(() => false);
    screen.load.errorBoundaryAbsent = !hasErrorBoundary;
    if (hasErrorBoundary) {
      findings.push(
        buildFinding({
          severity: SEVERITIES.BLOCKING,
          category: 'Carga',
          message: 'Error Boundary visible',
        })
      );
    }

    for (const issue of responseIssues) {
      screen.failedRequests.push(issue);
      findings.push(
        buildFinding({
          severity: issue.severity,
          category: 'Red',
          message: issue.message,
          evidence: { url: issue.url, status: issue.status },
        })
      );
    }

    screen.brokenImages = await collectVisibleBrokenImages(page);
    for (const image of screen.brokenImages) {
      findings.push(
        buildFinding({
          severity: SEVERITIES.HIGH,
          category: 'Imágenes',
          message: `Imagen visible rota: ${image.alt || image.src || 'sin texto alternativo'}`,
          evidence: {
            src: image.src,
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
          },
        })
      );
    }

    if (scenario.route === '/') {
      screen.permissions = await inspectPermissions(page, scenario.role);
      for (const label of screen.permissions.missing) {
        findings.push(
          buildFinding({
            severity: SEVERITIES.HIGH,
            category: 'Permisos',
            message: `${scenario.role} no ve ${label}`,
          })
        );
      }
      for (const label of screen.permissions.unexpected) {
        findings.push(
          buildFinding({
            severity: SEVERITIES.HIGH,
            category: 'Permisos',
            message: `${scenario.role} ve ${label} sin permiso esperado`,
          })
        );
      }
    }

    screen.screenshot = await saveScenarioScreenshot(page, scenario).catch((error) => {
      findings.push(
        buildFinding({
          severity: SEVERITIES.BLOCKING,
          category: 'Screenshot',
          message: error.message,
        })
      );
      return '';
    });

    screen.result = getResultFromFindings(findings);
    writeScreenResult(scenario, screen);
  });
}
