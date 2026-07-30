const { expect } = require('@playwright/test');
const { assertNoGlobalHorizontalOverflow, disableAnimations } = require('./visual');

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

const stabilizeVisualState = async (page) => {
  await disableAnimations(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await expect(page.locator('.spinner, .loading-spinner')).toHaveCount(0);
};

const assertElementWithinViewportWidth = async (locator) => {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();

  expect(box, 'Expected visible element to have a bounding box').toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
};

const assertTableIsContained = async (page) => {
  const shell = page.locator('.app-table-shell:visible').first();
  if ((await shell.count()) === 0) {
    await expect(page.locator('.records-mobile:visible').first()).toBeVisible();
    return;
  }

  const metrics = await shell.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      overflowX: style.overflowX,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    };
  });

  expect(metrics.left).toBeGreaterThanOrEqual(-1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    expect(['auto', 'scroll']).toContain(metrics.overflowX);
  }
};

const assertResponsiveStructure = async (page, primaryLocator, options = {}) => {
  await assertNoGlobalHorizontalOverflow(page);
  await assertElementWithinViewportWidth(primaryLocator);

  if (options.table) {
    await assertTableIsContained(page);
  }
};

const expectBaselineScreenshot = async (page, name) => {
  await stabilizeVisualState(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });
};

module.exports = {
  VIEWPORTS,
  assertResponsiveStructure,
  expectBaselineScreenshot,
  stabilizeVisualState,
};
