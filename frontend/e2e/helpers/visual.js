const { expect } = require('@playwright/test');

const disableAnimations = async (page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
      }
    `,
  });
};

const waitForAppIdle = async (page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible' });
};

const isAuthApiURL = (url) => /\/api\/auth\/(verify|login)/.test(url);

const createRouteDiagnostics = (page) => {
  const events = [];

  const onResponse = async (response) => {
    if (!isAuthApiURL(response.url()) || response.status() < 400) return;

    const headers = await response.allHeaders().catch(() => ({}));
    let message = '';
    try {
      const body = await response.json();
      message = body?.message || '';
    } catch (_error) {
      message = response.statusText();
    }

    events.push({
      type: 'response',
      url: response.url(),
      status: response.status(),
      retryAfter: headers['retry-after'],
      message,
    });
  };

  const onRequestFailed = (request) => {
    if (!isAuthApiURL(request.url())) return;

    events.push({
      type: 'requestfailed',
      url: request.url(),
      failure: request.failure()?.errorText || 'unknown network error',
    });
  };

  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);

  return {
    events,
    dispose: () => {
      page.off('response', onResponse);
      page.off('requestfailed', onRequestFailed);
    },
  };
};

const getLocalAuthState = async (page) =>
  page
    .evaluate(() => ({
      hasToken: Boolean(localStorage.getItem('token')),
      hasUser: Boolean(localStorage.getItem('user')),
    }))
    .catch(() => ({ hasToken: false, hasUser: false }));

const buildAuthDiagnosticMessage = async (page, routePath, diagnostics = []) => {
  const pathname = new URL(page.url()).pathname;
  const authState = await getLocalAuthState(page);
  const rateLimited = diagnostics.find((event) => event.status === 429);
  const unauthorized = diagnostics.find((event) => event.status === 401);
  const networkError = diagnostics.find((event) => event.type === 'requestfailed');

  if (rateLimited) {
    return [
      `Navigation to ${routePath} was blocked by auth API rate limiting.`,
      `Observed HTTP 429 from ${rateLimited.url}${rateLimited.retryAfter ? `; Retry-After=${rateLimited.retryAfter}s` : ''}.`,
      rateLimited.message ? `Backend message: ${rateLimited.message}` : null,
      'Start backend with E2E_MODE=true and regenerate storageState with npm run test:e2e:auth.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (unauthorized) {
    return [
      `Navigation to ${routePath} reached /login after auth verification returned HTTP 401.`,
      'The stored token is invalid or expired; run npm run test:e2e:auth.',
    ].join(' ');
  }

  if (networkError) {
    return `Navigation to ${routePath} could not verify auth because ${networkError.url} failed: ${networkError.failure}.`;
  }

  if (!authState.hasToken) {
    return `Navigation to ${routePath} reached ${pathname} and localStorage has no token. Run npm run test:e2e:auth.`;
  }

  return `Navigation to ${routePath} reached ${pathname}. No 401/429 auth API evidence was captured; inspect trace for redirect cause.`;
};

const waitForProtectedRoute = async (page, routePath, diagnostics = []) => {
  await page
    .locator(
      [
        '.dashboard-container',
        '.cuentas-container',
        '.inventario-container',
        '.page-container',
        '.protected-route-denied',
        '.login-container',
        '.change-password-container',
      ].join(', ')
    )
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });

  const pathname = new URL(page.url()).pathname;
  if (pathname === '/login') {
    throw new Error(await buildAuthDiagnosticMessage(page, routePath, diagnostics));
  }
  if (pathname === '/change-password') {
    throw new Error(
      'E2E user is marked as primer_login; use an account with password already set.'
    );
  }

  const denied = await page
    .getByText(/acceso denegado/i)
    .isVisible()
    .catch(() => false);
  if (denied) {
    throw new Error(`Authenticated E2E user cannot access ${routePath}.`);
  }
};

const gotoProtectedRoute = async (page, routePath) => {
  const diagnostics = createRouteDiagnostics(page);
  try {
    await page.goto(routePath, { waitUntil: 'domcontentloaded' });
    await waitForProtectedRoute(page, routePath, diagnostics.events);
  } finally {
    diagnostics.dispose();
  }
};

const assertNoGlobalHorizontalOverflow = async (page) => {
  const metrics = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body?.scrollWidth || 0;
    const viewportWidth = window.innerWidth;
    return {
      viewportWidth,
      documentWidth,
      bodyWidth,
      documentOverflow: documentWidth > viewportWidth + 1,
      bodyOverflow: bodyWidth > viewportWidth + 1,
    };
  });

  expect(metrics.documentOverflow, JSON.stringify(metrics)).toBeFalsy();
  expect(metrics.bodyOverflow, JSON.stringify(metrics)).toBeFalsy();
};

const assertPageLooksLoaded = async (page) => {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByText(/error boundary|something went wrong/i)).toHaveCount(0);
};

const assertModalInViewport = async (page) => {
  const modal = page.locator('.app-modal').last();
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  const viewport = page.viewportSize();

  expect(box, 'Modal should have a bounding box').toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(modal.locator('.app-modal__close')).toBeVisible();
  await expect(modal.locator('.app-modal__footer')).toBeVisible();
};

const assertModalInputsFit = async (page) => {
  const overflowingInputs = await page
    .locator('.app-modal input, .app-modal select, .app-modal textarea')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const parent = node.closest('.app-modal__body')?.getBoundingClientRect();
          return parent && rect.width > parent.width + 1;
        })
        .map((node) => node.outerHTML)
    );

  expect(overflowingInputs, `Inputs overflow modal body: ${overflowingInputs.join('\n')}`).toEqual(
    []
  );
};

const assertMobileDatePlaceholders = async (page) => {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 600) return;

  const badInputs = await page
    .locator('input.ff-date-input:visible')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => !node.value && node.getAttribute('placeholder') !== 'dd/mm/aaaa')
        .map((node) => node.outerHTML)
    );

  expect(badInputs, `Date inputs without dd/mm/aaaa placeholder: ${badInputs.join('\n')}`).toEqual(
    []
  );
};

const captureVisual = async (page, testInfo, name, options = {}) => {
  await disableAnimations(page);
  await waitForAppIdle(page);
  await assertPageLooksLoaded(page);

  if (process.env.E2E_ASSERT_SNAPSHOTS === '1') {
    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: 'disabled',
      fullPage: options.fullPage ?? true,
    });
    return;
  }

  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: options.fullPage ?? true,
    animations: 'disabled',
  });
};

const clickFirstVisible = async (page, candidates) => {
  for (const candidate of candidates) {
    const locator = page.getByRole('button', { name: candidate }).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      await locator.click();
      return true;
    }
  }
  return false;
};

module.exports = {
  assertMobileDatePlaceholders,
  assertModalInputsFit,
  assertModalInViewport,
  assertNoGlobalHorizontalOverflow,
  assertPageLooksLoaded,
  captureVisual,
  clickFirstVisible,
  disableAnimations,
  gotoProtectedRoute,
  waitForAppIdle,
  waitForProtectedRoute,
};
