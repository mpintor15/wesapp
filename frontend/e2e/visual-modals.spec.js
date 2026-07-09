const { test } = require('@playwright/test');
const { visualViewports } = require('./helpers/viewportMatrix');
const {
  assertMobileDatePlaceholders,
  assertModalInputsFit,
  assertModalInViewport,
  assertNoGlobalHorizontalOverflow,
  captureVisual,
  clickFirstVisible,
  gotoProtectedRoute,
  waitForAppIdle,
} = require('./helpers/visual');

const modalCases = [
  {
    name: 'personal-crear-colaborador',
    path: '/personal',
    open: async (page) =>
      clickFirstVisible(page, [/crear colaborador/i, /nuevo colaborador/i, /crear/i]),
  },
  {
    name: 'personal-reporte',
    path: '/personal',
    open: async (page) => clickFirstVisible(page, [/generar reporte/i, /exportar/i, /reporte/i]),
  },
  {
    name: 'usuarios-crear-usuario',
    path: '/usuarios',
    open: async (page) => clickFirstVisible(page, [/crear usuario/i, /nuevo usuario/i, /crear/i]),
  },
  {
    name: 'usuarios-editar-usuario',
    path: '/usuarios',
    open: async (page) => clickFirstVisible(page, [/editar/i]),
  },
  {
    name: 'usuarios-reenviar-invitacion',
    path: '/usuarios',
    open: async (page) => clickFirstVisible(page, [/reenviar invitaci[oó]n/i, /invitaci[oó]n/i]),
  },
  {
    name: 'inventario-nuevo-articulo',
    path: '/inventario',
    open: async (page) =>
      clickFirstVisible(page, [/nuevo art[ií]culo/i, /crear art[ií]culo/i, /agregar/i]),
  },
  {
    name: 'inventario-crear-movimiento',
    path: '/inventario',
    open: async (page) =>
      clickFirstVisible(page, [/crear movimiento/i, /nuevo movimiento/i, /registrar movimiento/i]),
  },
  {
    name: 'inventario-reporte-movimientos',
    path: '/inventario',
    open: async (page) => {
      await clickFirstVisible(page, [/movimientos/i]);
      return clickFirstVisible(page, [/generar reporte/i, /exportar/i, /reporte/i]);
    },
  },
  {
    name: 'inventario-reporte-bajas',
    path: '/inventario',
    open: async (page) => {
      await clickFirstVisible(page, [/dados de baja|bajas/i]);
      return clickFirstVisible(page, [/generar reporte/i, /exportar/i, /reporte/i]);
    },
  },
  {
    name: 'inventario-dar-de-baja',
    path: '/inventario',
    open: async (page) => clickFirstVisible(page, [/dar de baja/i, /baja/i]),
  },
  {
    name: 'cuentas-crear-factura',
    path: '/cuentas',
    open: async (page) => clickFirstVisible(page, [/crear factura/i, /nueva factura/i]),
  },
  {
    name: 'cuentas-editar-factura',
    path: '/cuentas',
    open: async (page) => clickFirstVisible(page, [/editar/i]),
  },
  {
    name: 'cuentas-anular-factura',
    path: '/cuentas',
    open: async (page) => clickFirstVisible(page, [/anular/i, /cancelar factura/i]),
  },
  {
    name: 'cuentas-pago-lote',
    path: '/cuentas',
    open: async (page) =>
      clickFirstVisible(page, [/registrar pago/i, /pago en lote/i, /nuevo pago/i]),
  },
  {
    name: 'cuentas-reporte-facturas',
    path: '/cuentas',
    open: async (page) =>
      clickFirstVisible(page, [/reporte facturas/i, /generar reporte/i, /exportar/i]),
  },
  {
    name: 'cuentas-reporte-pagos',
    path: '/cuentas',
    open: async (page) => {
      await clickFirstVisible(page, [/pagos/i]);
      return clickFirstVisible(page, [/reporte pagos/i, /generar reporte/i, /exportar/i]);
    },
  },
  {
    name: 'cuentas-reporte-clientes',
    path: '/cuentas',
    open: async (page) => {
      await clickFirstVisible(page, [/clientes/i]);
      return clickFirstVisible(page, [/reporte clientes/i, /generar reporte/i, /exportar/i]);
    },
  },
];

for (const viewport of visualViewports) {
  test.describe(`visual modals ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    for (const modalCase of modalCases) {
      test(modalCase.name, async ({ page }, testInfo) => {
        await gotoProtectedRoute(page, modalCase.path);
        await waitForAppIdle(page);

        const opened = await modalCase.open(page);
        test.skip(!opened, `No reliable trigger or fixture found for ${modalCase.name}.`);

        await page.locator('.app-modal').last().waitFor({ state: 'visible' });
        await assertModalInViewport(page);
        await assertModalInputsFit(page);
        await assertMobileDatePlaceholders(page);
        await assertNoGlobalHorizontalOverflow(page);
        await captureVisual(page, testInfo, `${modalCase.name}-${viewport.name}`, {
          fullPage: false,
        });
      });
    }
  });
}
