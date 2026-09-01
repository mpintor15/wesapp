const { test, expect } = require('@playwright/test');
const {
  assertBackendAvailable,
  assertFrontendAvailable,
  clearBrowserSession,
  getApiURL,
  loginWithRole,
} = require('./helpers/criticalFlows');

test.beforeEach(async ({ page, request }) => {
  await assertFrontendAvailable(request);
  await assertBackendAvailable(request);
  await clearBrowserSession(page);
});

test('Guardia ve Bitácoras y Visitas, pero no Formularios (permiso denegado también en la API)', async ({
  page,
  request,
}) => {
  const session = await loginWithRole({ request, page, role: 'guardia' });

  const registrosResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/bitacoras/registros') &&
      response.status() === 200
  );
  await page.goto('/bitacoras');
  await registrosResponse;

  await expect(page.locator('.bitacoras-container')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Registro' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Visitas' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Formularios' })).toHaveCount(0);

  const visitasResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/bitacoras/visitas') &&
      response.status() === 200
  );
  await page.getByRole('tab', { name: 'Visitas' }).click();
  await visitasResponse;
  await expect(page.locator('.bitacoras-history')).toBeVisible();

  const formulariosApiResponse = await request.get(`${getApiURL()}/bitacoras/formularios-visitas`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  expect(formulariosApiResponse.status()).toBe(403);
});

test('Supervisor ve las 3 tabs de Bitácoras, incluida Formularios', async ({ page, request }) => {
  await loginWithRole({ request, page, role: 'supervisor' });

  const registrosResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/bitacoras/registros') &&
      response.status() === 200
  );
  await page.goto('/bitacoras');
  await registrosResponse;
  await expect(page.locator('.bitacoras-container')).toBeVisible();

  const visitasResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/bitacoras/visitas') &&
      response.status() === 200
  );
  await page.getByRole('tab', { name: 'Visitas' }).click();
  await visitasResponse;
  await expect(page.locator('.bitacoras-history')).toBeVisible();

  const formulariosResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/bitacoras/formularios-visitas') &&
      response.status() === 200
  );
  await page.getByRole('tab', { name: 'Formularios' }).click();
  await formulariosResponse;
  await expect(page.getByRole('button', { name: 'Crear formulario' })).toBeVisible();
});

test('flujo crítico versionado de Formularios y Visitas', async ({ page, request }) => {
  const supervisorSession = await loginWithRole({ request, page, role: 'supervisor' });

  const supervisorRegistrosResponse = page.waitForResponse(
    (response) => response.url().includes('/api/bitacoras/registros') && response.status() === 200
  );
  await page.goto('/bitacoras');
  await supervisorRegistrosResponse;

  const formulariosListResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/bitacoras/formularios-visitas') && response.status() === 200
  );
  await page.getByRole('tab', { name: 'Formularios' }).click();
  await formulariosListResponse;

  await page.getByRole('button', { name: 'Crear formulario' }).click();
  const builderDialog = page.getByRole('dialog', { name: 'Crear formulario de visitas' });

  const activeTemplateResponse = page.waitForResponse((response) =>
    response.url().includes('/formulario-visitas/activo')
  );
  await builderDialog
    .getByLabel('Urbanización')
    .selectOption({ label: 'Urbanización E2E Bitácoras' });
  await activeTemplateResponse;

  await builderDialog.getByLabel('Nuevo tipo de visita').fill('Peatón');
  await builderDialog.getByRole('button', { name: 'Agregar tipo' }).click();
  await builderDialog.getByLabel('Nuevo tipo de visita').fill('Vehículo');
  await builderDialog.getByRole('button', { name: 'Agregar tipo' }).click();
  await builderDialog.getByLabel('Nuevo tipo de visita').fill('Delivery');
  await builderDialog.getByRole('button', { name: 'Agregar tipo' }).click();
  for (const tipo of ['Peatón', 'Vehículo', 'Delivery']) {
    await expect(builderDialog.getByText(tipo, { exact: true })).toBeVisible();
  }

  const questionRows = builderDialog.locator('.bitacoras-form-field-row');
  const allTypesQuestion = questionRows.first();
  await allTypesQuestion.getByLabel('Pregunta del campo').fill('Nombre de contacto');
  await allTypesQuestion.locator('.bitacoras-required-input input').check();

  await builderDialog.getByRole('button', { name: 'Agregar pregunta' }).click();
  const deliveryQuestion = questionRows.nth(1);
  await deliveryQuestion.getByLabel('Pregunta del campo').fill('Código de entrega');
  await deliveryQuestion.getByLabel('Tipo de campo').selectOption('number');
  await deliveryQuestion.getByLabel('Aplica a').selectOption('SELECCIONADOS');
  await deliveryQuestion
    .locator('.bitacoras-applies-types label')
    .filter({ hasText: 'Delivery' })
    .locator('input')
    .check();
  await deliveryQuestion.locator('.bitacoras-required-input').click();

  await builderDialog.getByRole('button', { name: 'Agregar pregunta' }).click();
  await questionRows.last().getByLabel('Pregunta del campo').fill('Pregunta borrador eliminada');
  await questionRows.last().getByRole('button', { name: 'Eliminar pregunta' }).click();
  await expect(builderDialog.getByText('Pregunta borrador eliminada')).toHaveCount(0);
  await expect(questionRows).toHaveCount(2);

  const publishResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/formulario-visitas/publicar')
  );
  await page.getByRole('button', { name: 'Publicar versión' }).click();
  const publishApiResponse = await publishResponse;
  expect(publishApiResponse.status()).toBe(201);
  await expect(page.locator('.toast-text')).toContainText(/formulario de visitas publicado/i);
  let activeFormRow = page
    .locator('.bitacoras-forms-table tbody tr')
    .filter({ hasText: 'Urbanización E2E Bitácoras' })
    .filter({ hasText: 'ACTIVO' });
  await expect(activeFormRow).toBeVisible();
  await expect(activeFormRow).toContainText('1');

  await activeFormRow.getByRole('button', { name: /Editar formulario/ }).click();
  await builderDialog.getByText(/reemplazará la versión activa 1/i).waitFor();
  await builderDialog.getByLabel('Nombre').fill('Formulario E2E versión 2');
  const publishV2Response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/formulario-visitas/publicar')
  );
  await builderDialog.getByRole('button', { name: 'Publicar versión' }).click();
  expect((await publishV2Response).status()).toBe(201);
  activeFormRow = page
    .locator('.bitacoras-forms-table tbody tr')
    .filter({ hasText: 'Formulario E2E versión 2' })
    .filter({ hasText: 'ACTIVO' });
  await expect(activeFormRow).toContainText('2');

  await activeFormRow.getByRole('button', { name: /Archivar formulario/ }).click();
  const archiveResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/archivar')
  );
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archivar' }).click();
  expect((await archiveResponse).status()).toBe(200);

  const locationsResponse = await request.get(`${getApiURL()}/bitacoras/ubicaciones`, {
    headers: { Authorization: `Bearer ${supervisorSession.token}` },
  });
  expect(locationsResponse.status()).toBe(200);
  const locationsBody = await locationsResponse.json();
  const urbanizacion = locationsBody.data.find(
    (location) => location.nombre === 'Urbanización E2E Bitácoras'
  );
  expect(urbanizacion).toBeTruthy();

  const v3Payload = {
    titulo: 'Formulario E2E activo',
    mostrar_fecha_hora: true,
    tipos_visita: ['Peatón', 'Vehículo', 'Delivery'],
    fields: [
      {
        field_key: 'nombre_de_contacto',
        label: 'Nombre de contacto',
        type: 'text',
        required: true,
        aplica_a: 'TODOS',
        options: [],
      },
      {
        field_key: 'codigo_de_entrega',
        label: 'Código de entrega',
        type: 'number',
        required: true,
        aplica_a: ['Delivery'],
        options: [],
      },
    ],
  };
  const publishV3Response = await request.post(
    `${getApiURL()}/bitacoras/ubicaciones/${urbanizacion.id}/formulario-visitas/publicar`,
    {
      headers: { Authorization: `Bearer ${supervisorSession.token}` },
      data: v3Payload,
    }
  );
  expect(publishV3Response.status()).toBe(201);

  await clearBrowserSession(page);
  const guardiaSession = await loginWithRole({ request, page, role: 'guardia' });

  const guardiaRegistrosResponse = page.waitForResponse(
    (response) => response.url().includes('/api/bitacoras/registros') && response.status() === 200
  );
  await page.goto('/bitacoras');
  await guardiaRegistrosResponse;

  await expect(page.getByRole('tab', { name: 'Formularios' })).toHaveCount(0);

  const guardiaVisitasResponse = page.waitForResponse(
    (response) => response.url().includes('/api/bitacoras/visitas') && response.status() === 200
  );
  await page.getByRole('tab', { name: 'Visitas' }).click();
  await guardiaVisitasResponse;

  const manzanasResponse = page.waitForResponse((response) => response.url().includes('/manzanas'));
  const visitaFormActiveResponse = page.waitForResponse((response) =>
    response.url().includes('/formulario-visitas/activo')
  );
  await page.getByRole('button', { name: 'Registrar Visita' }).click();
  await manzanasResponse;
  await visitaFormActiveResponse;

  const villasResponse = page.waitForResponse((response) => response.url().includes('/villas'));
  await page.getByLabel('Manzana').click();
  await page.getByRole('option', { name: 'Manzana E2E' }).click();
  await villasResponse;

  await page.getByLabel('Villa').click();
  await page.getByRole('option', { name: 'V1 E2E' }).click();
  await expect(page.getByText(/titular:\s*residente e2e principal/i)).toBeVisible();

  await expect(page.getByLabel('Nombre de contacto')).toHaveCount(0);
  await page.locator('#visita-tipo-visita').selectOption({ label: 'Delivery' });
  await expect(page.getByLabel('Nombre de contacto')).toBeVisible();
  await expect(page.getByLabel('Código de entrega')).toBeVisible();

  const visitanteDocumento = '0912345678';
  await page.locator('#visita-visitante_nombre').fill('Visitante E2E');
  await page.locator('#visita-visitante_documento').fill(visitanteDocumento);
  await page.locator('#visita-visitante_telefono').fill('0991112233');
  await page.getByLabel('Nombre de contacto').fill('Recepción E2E');

  await page.getByRole('button', { name: 'Registrar ingreso' }).click();
  await expect(page.getByText('Código de entrega es requerido.')).toBeVisible();
  await page.getByLabel('Código de entrega').fill('42');

  const createVisitResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/bitacoras\/visitas$/.test(new URL(response.url()).pathname)
  );
  await page.getByRole('button', { name: 'Registrar ingreso' }).click();
  const createVisitApiResponse = await createVisitResponse;
  expect(createVisitApiResponse.status()).toBe(201);
  await expect(page.locator('.toast-text')).toContainText(/visita registrada/i);

  const visitRow = page
    .locator('.bitacoras-visits-table tbody tr')
    .filter({ hasText: visitanteDocumento });
  await expect(visitRow).toBeVisible();
  await expect(visitRow).toContainText('ABIERTA');
  await expect(visitRow.getByRole('button', { name: /anular/i })).toHaveCount(0);

  const closeVisitResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/cerrar')
  );
  await visitRow.getByRole('button', { name: 'Registrar salida' }).click();
  const closeVisitApiResponse = await closeVisitResponse;
  expect(closeVisitApiResponse.status()).toBe(200);

  // The default Visitas filter only shows ABIERTA visits, so the just-closed row drops out of
  // view — switch the Estado filter to CERRADA to confirm it persisted with the new state.
  const closedListResponse = page.waitForResponse(
    (response) => response.url().includes('/api/bitacoras/visitas') && response.status() === 200
  );
  await page.locator('#visitas-filter-estado').selectOption('CERRADA');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await closedListResponse;

  await expect(visitRow).toBeVisible();
  await expect(visitRow).toContainText('CERRADA');

  const activeFormResponse = await request.get(
    `${getApiURL()}/bitacoras/ubicaciones/${urbanizacion.id}/formulario-visitas/activo`,
    { headers: { Authorization: `Bearer ${guardiaSession.token}` } }
  );
  expect(activeFormResponse.status()).toBe(200);
  const activeForm = (await activeFormResponse.json()).data;
  const deliveryType = activeForm.tipos.find((tipo) => tipo.nombre === 'Delivery');
  const blocksResponse = await request.get(
    `${getApiURL()}/bitacoras/ubicaciones/${urbanizacion.id}/manzanas`,
    { headers: { Authorization: `Bearer ${guardiaSession.token}` } }
  );
  const block = (await blocksResponse.json()).data.find((item) => item.nombre === 'Manzana E2E');
  const villasApiResponse = await request.get(
    `${getApiURL()}/bitacoras/manzanas/${block.id}/villas`,
    { headers: { Authorization: `Bearer ${guardiaSession.token}` } }
  );
  const villa = (await villasApiResponse.json()).data.find(
    (item) => item.identificador === 'V1 E2E'
  );
  const cancellableVisitResponse = await request.post(`${getApiURL()}/bitacoras/visitas`, {
    headers: { Authorization: `Bearer ${guardiaSession.token}` },
    data: {
      ubicacion_id: urbanizacion.id,
      manzana_id: block.id,
      villa_id: villa.id,
      visitante_nombre: 'Visitante E2E Anulable',
      visitante_documento: '0923456789',
      visitante_telefono: '0992223344',
      tipo_visita_id: deliveryType.id,
      respuestas: { nombre_de_contacto: 'Recepción E2E', codigo_de_entrega: 84 },
    },
  });
  expect(cancellableVisitResponse.status()).toBe(201);
  const cancellableVisit = (await cancellableVisitResponse.json()).data;

  const cancelResponse = await request.post(
    `${getApiURL()}/bitacoras/visitas/${cancellableVisit.id}/anular`,
    {
      headers: { Authorization: `Bearer ${supervisorSession.token}` },
      data: { motivo: 'Anulación E2E autorizada' },
    }
  );
  expect(cancelResponse.status()).toBe(200);
  expect((await cancelResponse.json()).data.estado).toBe('ANULADA');

  for (const reportPath of [
    `/bitacoras/registros/excel?ubicacion_id=${urbanizacion.id}`,
    '/bitacoras/visitas/excel?search=Visitante%20E2E',
    `/bitacoras/formularios-visitas/excel?ubicacion_id=${urbanizacion.id}`,
  ]) {
    const reportResponse = await request.get(`${getApiURL()}${reportPath}`, {
      headers: { Authorization: `Bearer ${supervisorSession.token}` },
    });
    expect(reportResponse.status()).toBe(200);
    expect(reportResponse.headers()['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }
});
