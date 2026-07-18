/**
 * cuentasController.js — Controlador del módulo de Cuentas por Cobrar
 *
 * Gestiona tres entidades principales y un reporte:
 *
 *  CLIENTES
 *  - getClientes    : Lista todos los clientes ordenados por nombre.
 *  - exportClientesExcel : Genera y descarga la lista de clientes en .xlsx.
 *  - createCliente  : Crea un cliente con nombre e identificación únicos.
 *  - deleteCliente  : Elimina un cliente solo si no tiene facturas asociadas.
 *
 *  FACTURAS
 *  - createFactura  : Registra una factura con opciones de IVA y retenciones.
 *                     Calcula los montos en la vista vista_reporte_cuentas.
 *  - deleteFactura  : Elimina una factura (incluye sus abonos por CASCADE).
 *  - cancelFactura  : Marca una factura como cancelada (cancelada = TRUE)
 *                     sin eliminarla del historial.
 *
 *  ABONOS (pagos aplicados a facturas)
 *  - getAbonosByFactura : Lista los abonos de una factura específica.
 *  - createBatchAbono   : Registra un pago con su detalle (tabla pagos) y distribuye
 *                         atómica (todos se guardan o ninguno). Valida que
 *                         cada num_factura exista y que el monto sea > 0.
 *
 *  REPORTE
 *  - getReporte         : Consulta la vista vista_reporte_cuentas con filtros
 *                         opcionales de fecha y solo_deudores.
 *  - exportReporteExcel : Genera y descarga el reporte en formato .xlsx
 *                         con cabecera azul y formato de moneda.
 */
const db = require('../config/database');
const cuentasAbonosRepository = require('../repositories/cuentasAbonosRepository');
const cuentasClientesRepository = require('../repositories/cuentasClientesRepository');
const cuentasFacturasRepository = require('../repositories/cuentasFacturasRepository');
const cuentasPagosRepository = require('../repositories/cuentasPagosRepository');
const { createHttpError, handleControllerError } = require('../utils/http');
const { logAudit, auditFromReq } = require('../utils/audit');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');
const { validateOptionalDateRange } = require('../utils/inputValidation');
const {
  parsePositiveIntegerId,
  validateBatchPaymentPayload,
  validateClientePayload,
  validateFacturaCancellationDetail,
  validateFacturaCreatePayload,
  validateFacturaUpdatePayload,
} = require('../modules/cuentas/cuentas.validators');
const { PAYMENT_METHODS } = require('../modules/cuentas/cuentas.constants');

// Cache de introspección de esquema — se llena en el primer request y se reutiliza.
// El servidor se reinicia con cada deploy, así que no hay riesgo de valores obsoletos.
const _schemaCache = {};

const tableColumnExists = async (tableName, columnName) => {
  const key = `${tableName}.${columnName}`;
  if (key in _schemaCache) {
    return _schemaCache[key];
  }
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  _schemaCache[key] = result.rowCount > 0;
  return _schemaCache[key];
};

const tableExists = async (tableName) => {
  const key = `table::${tableName}`;
  if (key in _schemaCache) {
    return _schemaCache[key];
  }
  const result = await db.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
  _schemaCache[key] = Boolean(result.rows[0]?.table_name);
  return _schemaCache[key];
};

const validateBooleanFilter = (value, message) => {
  if (value === undefined || value === null || value === '') {
    return;
  }
  if (value !== 'true' && value !== 'false') {
    throw createHttpError(400, message);
  }
};

const validateFechaInicioFin = (fecha_inicio, fecha_fin) => {
  const validation = validateOptionalDateRange(fecha_inicio, fecha_fin, {
    bothRequiredMessage: 'Debes enviar fecha_inicio y fecha_fin juntas',
    invalidDateMessage: 'Las fechas deben tener formato YYYY-MM-DD y ser reales',
    invertedRangeMessage: 'El rango de fechas es inválido',
  });
  if (!validation.valid) {
    throw createHttpError(validation.status, validation.message);
  }
};

// ============================================
// CLIENTES
// ============================================

const getClientes = async (req, res) => {
  try {
    const result = await cuentasClientesRepository.findAllClientes();

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener clientes:');
  }
};

const exportClientesExcel = async (req, res) => {
  try {
    const result = await cuentasClientesRepository.findClientesForExport();

    const { workbook, worksheet } = createWorkbook('Clientes', [
      { header: 'Cliente', key: 'cliente', width: 40 },
      { header: 'Identificación', key: 'identificacion', width: 24 },
    ]);

    result.rows.forEach((row) =>
      worksheet.addRow({
        cliente: row.nombre,
        identificacion: row.identificacion,
      })
    );

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'clientes.xlsx');
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar clientes:');
  }
};

const createCliente = async (req, res) => {
  try {
    const validation = validateClientePayload(req.body);
    if (!validation.valid) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }

    const result = await cuentasClientesRepository.createCliente(validation.value);

    await logAudit(db, {
      tabla: 'clientes',
      operacion: 'INSERT',
      registro_id: String(result.rows[0].id),
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un cliente con ese nombre o identificación',
      });
    }
    return handleControllerError(res, error, 'Error al crear cliente:');
  }
};

const deleteCliente = async (req, res) => {
  try {
    const idValidation = parsePositiveIntegerId(req.params.id, 'El id del cliente es inválido');
    if (!idValidation.valid) {
      throw createHttpError(idValidation.status, idValidation.message);
    }
    const id = idValidation.value;

    const hasFacturas = await cuentasClientesRepository.findClienteFacturasDependency(id);

    if (hasFacturas.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el cliente porque tiene facturas asociadas',
      });
    }

    const result = await cuentasClientesRepository.deleteClienteById(id);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado',
      });
    }

    await logAudit(db, {
      tabla: 'clientes',
      operacion: 'DELETE',
      registro_id: String(id),
      datos_anteriores: result.rows[0],
      ...auditFromReq(req),
    });

    res.json({
      success: true,
      message: 'Cliente eliminado exitosamente',
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el cliente porque tiene facturas asociadas',
      });
    }
    return handleControllerError(res, error, 'Error al eliminar cliente:');
  }
};

// ============================================
// FACTURAS (CUENTAS)
// ============================================

const createFactura = async (req, res) => {
  try {
    const validation = validateFacturaCreatePayload(req.body);
    if (!validation.valid) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }
    const {
      parsedNumFactura,
      parsedClienteId,
      parsedValorFactura,
      fecha_factura,
      incluye_iva,
      incluye_retencion_fuente,
      incluye_retencion_iva,
    } = validation.value;

    const clienteExists = await db.query('SELECT id FROM clientes WHERE id = $1 LIMIT 1', [
      parsedClienteId,
    ]);

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'El cliente especificado no existe',
      });
    }

    const result = await cuentasFacturasRepository.createFactura({
      numFactura: parsedNumFactura,
      clienteId: parsedClienteId,
      fechaFactura: fecha_factura,
      valorFactura: parsedValorFactura,
      incluyeIva: !!incluye_iva,
      incluyeRetencionFuente: !!incluye_retencion_fuente,
      incluyeRetencionIva: !!incluye_retencion_iva,
    });

    await logAudit(db, {
      tabla: 'cuentas',
      operacion: 'INSERT',
      registro_id: String(result.rows[0].num_factura),
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    res.status(201).json({
      success: true,
      message: 'Factura creada exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una factura con ese número',
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'El cliente especificado no existe',
      });
    }
    return handleControllerError(res, error, 'Error al crear factura:');
  }
};

const deleteFactura = async (req, res) => {
  try {
    const numFacturaValidation = parsePositiveIntegerId(
      req.params.num_factura,
      'El número de factura es inválido'
    );
    if (!numFacturaValidation.valid) {
      throw createHttpError(numFacturaValidation.status, numFacturaValidation.message);
    }
    const parsedNumFactura = numFacturaValidation.value;

    const result = await cuentasFacturasRepository.deleteFacturaByNumero(parsedNumFactura);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada',
      });
    }

    await logAudit(db, {
      tabla: 'cuentas',
      operacion: 'DELETE',
      registro_id: String(parsedNumFactura),
      datos_anteriores: result.rows[0],
      ...auditFromReq(req),
    });

    res.json({
      success: true,
      message: 'Factura eliminada exitosamente',
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar factura:');
  }
};

const cancelFactura = async (req, res) => {
  try {
    const numFacturaValidation = parsePositiveIntegerId(
      req.params.num_factura,
      'El número de factura es inválido'
    );
    if (!numFacturaValidation.valid) {
      throw createHttpError(numFacturaValidation.status, numFacturaValidation.message);
    }
    const parsedNumFactura = numFacturaValidation.value;
    const detailValidation = validateFacturaCancellationDetail(req.body.detalle_anulacion);
    if (!detailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: detailValidation.message,
      });
    }

    const result = await cuentasFacturasRepository.cancelFacturaByNumero(
      parsedNumFactura,
      detailValidation.value
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada',
      });
    }

    await logAudit(db, {
      tabla: 'cuentas',
      operacion: 'UPDATE',
      registro_id: String(parsedNumFactura),
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    res.json({
      success: true,
      message: 'Factura anulada exitosamente',
      data: {
        num_factura: result.rows[0].num_factura,
        detalle_anulacion: result.rows[0].detalle_anulacion,
        fecha_anulacion: result.rows[0].fecha_anulacion,
      },
    });
  } catch (error) {
    if (error.code === '42703') {
      return res.status(500).json({
        success: false,
        message: 'Configuración incompleta de base de datos: faltan columnas de anulación',
      });
    }
    return handleControllerError(res, error, 'Error al cancelar factura:');
  }
};

// ============================================
// ABONOS
// ============================================

const getAbonosByFactura = async (req, res) => {
  try {
    const numFacturaValidation = parsePositiveIntegerId(
      req.params.num_factura,
      'El número de factura es inválido'
    );
    if (!numFacturaValidation.valid) {
      throw createHttpError(numFacturaValidation.status, numFacturaValidation.message);
    }
    const parsedNumFactura = numFacturaValidation.value;

    const result = await cuentasAbonosRepository.findAbonosByFactura(parsedNumFactura);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener abonos de factura:');
  }
};

const getPagos = async (req, res) => {
  try {
    const pagosTableExists = await tableExists('pagos');
    const [
      abonosHasPagoId,
      pagosHasClienteId,
      pagosHasFecha,
      pagosHasMetodoPago,
      pagosHasReferencia,
      pagosHasNotas,
      pagosHasTotal,
      pagosHasCreatedAt,
      cuentasHasCancelada,
      cuentasHasIncluyeIva,
      cuentasHasIncluyeRetencionFuente,
      cuentasHasIncluyeRetencionIva,
    ] = await Promise.all([
      tableColumnExists('abonos', 'pago_id'),
      pagosTableExists ? tableColumnExists('pagos', 'cliente_id') : Promise.resolve(false),
      pagosTableExists ? tableColumnExists('pagos', 'fecha') : Promise.resolve(false),
      pagosTableExists ? tableColumnExists('pagos', 'metodo_pago') : Promise.resolve(false),
      pagosTableExists ? tableColumnExists('pagos', 'referencia') : Promise.resolve(false),
      pagosTableExists ? tableColumnExists('pagos', 'notas') : Promise.resolve(false),
      pagosTableExists ? tableColumnExists('pagos', 'total') : Promise.resolve(false),
      pagosTableExists ? tableColumnExists('pagos', 'created_at') : Promise.resolve(false),
      tableColumnExists('cuentas', 'cancelada'),
      tableColumnExists('cuentas', 'incluye_iva'),
      tableColumnExists('cuentas', 'incluye_retencion_fuente'),
      tableColumnExists('cuentas', 'incluye_retencion_iva'),
    ]);

    if (!pagosTableExists || !abonosHasPagoId) {
      const legacyResult = await db.query(
        `WITH totales_abonos AS (
           SELECT num_factura, SUM(valor_abono) AS total_abonos
           FROM abonos
           GROUP BY num_factura
         )
         SELECT
           a.id,
           a.fecha_abono AS fecha,
           NULL::varchar AS metodo_pago,
           NULL::varchar AS referencia,
           NULL::text AS notas,
           a.valor_abono AS total,
           a.created_at,
           cl.id AS cliente_id,
           cl.nombre AS cliente,
           cl.identificacion,
           1::int AS facturas_count,
           JSON_BUILD_ARRAY(
             JSON_BUILD_OBJECT(
               'abono_id', a.id,
               'num_factura', a.num_factura,
               'fecha_factura', c.fecha_factura,
               'valor_factura', c.valor_factura,
               'valor_abono', a.valor_abono,
               'cancelada', ${cuentasHasCancelada ? 'c.cancelada' : 'FALSE'},
               'saldo_pendiente',
                 (
                   c.valor_factura
                   + CASE WHEN ${cuentasHasIncluyeIva ? 'COALESCE(c.incluye_iva, FALSE)' : 'FALSE'} THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
                   - CASE WHEN ${cuentasHasIncluyeRetencionFuente ? 'COALESCE(c.incluye_retencion_fuente, FALSE)' : 'FALSE'} THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
                   - CASE WHEN ${cuentasHasIncluyeRetencionIva ? 'COALESCE(c.incluye_retencion_iva, FALSE)' : 'FALSE'} AND ${cuentasHasIncluyeIva ? 'COALESCE(c.incluye_iva, FALSE)' : 'FALSE'} THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
                   - COALESCE(ta.total_abonos, 0)
                 )
             )
           ) AS facturas
         FROM abonos a
         JOIN cuentas c ON c.num_factura = a.num_factura
         JOIN clientes cl ON cl.id = c.cliente_id
         LEFT JOIN totales_abonos ta ON ta.num_factura = c.num_factura
         ORDER BY a.created_at DESC, a.fecha_abono DESC, a.id DESC`
      );

      return res.json({
        success: true,
        data: legacyResult.rows,
      });
    }

    const pagoFechaSelect = pagosHasFecha ? 'p.fecha' : 'MIN(a.fecha_abono)';
    const pagoCreatedAtSelect = pagosHasCreatedAt ? 'p.created_at' : pagoFechaSelect;
    const pagoMetodoSelect = pagosHasMetodoPago ? 'p.metodo_pago' : 'NULL::varchar';
    const pagoReferenciaSelect = pagosHasReferencia ? 'p.referencia' : 'NULL::varchar';
    const pagoNotasSelect = pagosHasNotas ? 'p.notas' : 'NULL::text';
    const pagoTotalSelect = pagosHasTotal ? 'p.total' : 'COALESCE(SUM(a.valor_abono), 0)';
    const pagoClienteIdSelect = pagosHasClienteId ? 'COALESCE(p.cliente_id, cl.id)' : 'cl.id';
    const clienteJoinKey = pagosHasClienteId
      ? 'COALESCE(p.cliente_id, c.cliente_id)'
      : 'c.cliente_id';
    const canceladaSelect = cuentasHasCancelada ? 'c.cancelada' : 'FALSE';
    const incluyeIvaSelect = cuentasHasIncluyeIva ? 'COALESCE(c.incluye_iva, FALSE)' : 'FALSE';
    const incluyeRetFuenteSelect = cuentasHasIncluyeRetencionFuente
      ? 'COALESCE(c.incluye_retencion_fuente, FALSE)'
      : 'FALSE';
    const incluyeRetIvaSelect = cuentasHasIncluyeRetencionIva
      ? 'COALESCE(c.incluye_retencion_iva, FALSE)'
      : 'FALSE';

    const result = await db.query(
      `WITH totales_abonos AS (
         SELECT num_factura, SUM(valor_abono) AS total_abonos
         FROM abonos
         GROUP BY num_factura
       )
       SELECT
         p.id,
         ${pagoFechaSelect} AS fecha,
         ${pagoMetodoSelect} AS metodo_pago,
         ${pagoReferenciaSelect} AS referencia,
         ${pagoNotasSelect} AS notas,
         ${pagoTotalSelect} AS total,
         ${pagoCreatedAtSelect} AS created_at,
         ${pagoClienteIdSelect} AS cliente_id,
         cl.nombre AS cliente,
         cl.identificacion,
         COUNT(a.id)::int AS facturas_count,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'abono_id', a.id,
               'num_factura', a.num_factura,
               'fecha_factura', c.fecha_factura,
               'valor_factura', c.valor_factura,
               'valor_abono', a.valor_abono,
               'cancelada', ${canceladaSelect},
               'saldo_pendiente',
                 CASE
                   WHEN c.num_factura IS NULL THEN NULL
                   ELSE (
                     c.valor_factura
                     + CASE WHEN ${incluyeIvaSelect} THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
                     - CASE WHEN ${incluyeRetFuenteSelect} THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
                     - CASE WHEN ${incluyeRetIvaSelect} AND ${incluyeIvaSelect} THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
                     - COALESCE(ta.total_abonos, 0)
                   )
                 END
             )
             ORDER BY a.num_factura
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'::json
         ) AS facturas
       FROM pagos p
       LEFT JOIN abonos a ON a.pago_id = p.id
       LEFT JOIN cuentas c ON c.num_factura = a.num_factura
       LEFT JOIN totales_abonos ta ON ta.num_factura = c.num_factura
       LEFT JOIN clientes cl ON cl.id = ${clienteJoinKey}
       GROUP BY p.id, cl.id, cl.nombre, cl.identificacion
       ORDER BY created_at DESC, fecha DESC, p.id DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener pagos:');
  }
};

const exportPagosExcel = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, metodo_pago } = req.query;
    validateFechaInicioFin(fecha_inicio, fecha_fin);
    const metodoPagoNormalizado = metodo_pago
      ? String(metodo_pago).trim().toLowerCase()
      : undefined;
    if (metodoPagoNormalizado && !PAYMENT_METHODS.includes(metodoPagoNormalizado)) {
      throw createHttpError(400, 'El método de pago no es válido');
    }
    const result = await cuentasPagosRepository.findPagosForExport({
      fecha_inicio,
      fecha_fin,
      metodo_pago: metodoPagoNormalizado,
    });

    const { workbook, worksheet } = createWorkbook('Pagos', [
      { header: 'Pago', key: 'id', width: 12 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Cliente', key: 'cliente', width: 36 },
      { header: 'Método de pago', key: 'metodo_pago', width: 18 },
      { header: 'Valor', key: 'total', width: 16, numFmt: '$#,##0.00' },
      { header: 'Facturas', key: 'facturas', width: 50 },
      { header: 'Notas', key: 'notas', width: 40 },
    ]);

    result.rows.forEach((row) =>
      worksheet.addRow({
        id: row.id,
        fecha: row.fecha ? new Date(row.fecha).toLocaleDateString('es-EC') : '-',
        cliente: row.cliente,
        metodo_pago: row.metodo_pago,
        total: Number(row.total || 0),
        facturas: row.facturas || '-',
        notas: row.notas,
      })
    );

    worksheet.getColumn('total').numFmt = '$#,##0.00';
    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'pagos.xlsx');
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar pagos:');
  }
};

// ============================================
// REPORTE
// ============================================

const getReporte = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, solo_deudores, agrupar_cliente } = req.query;
    validateFechaInicioFin(fecha_inicio, fecha_fin);
    validateBooleanFilter(solo_deudores, 'El filtro solo_deudores debe ser true o false');
    validateBooleanFilter(agrupar_cliente, 'El filtro agrupar_cliente debe ser true o false');
    const cuentasHasDetalleAnulacion = await tableColumnExists('cuentas', 'detalle_anulacion');
    const cuentasHasFechaAnulacion = await tableColumnExists('cuentas', 'fecha_anulacion');

    let query = `SELECT
      v.*,
      c.cliente_id,
      ${cuentasHasDetalleAnulacion ? 'c.detalle_anulacion' : 'NULL::text'} AS detalle_anulacion,
      ${cuentasHasFechaAnulacion ? 'c.fecha_anulacion' : 'NULL::timestamp'} AS fecha_anulacion
    FROM vista_reporte_cuentas v
    JOIN cuentas c ON c.num_factura = v.num_factura`;
    const params = [];
    const conditions = [];

    if (fecha_inicio && fecha_fin) {
      conditions.push(`v.fecha_factura BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(fecha_inicio, fecha_fin);
    }

    if (solo_deudores === 'true') {
      conditions.push('v.saldo_pendiente > 0');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    if (agrupar_cliente === 'true') {
      query += ` ORDER BY
        MIN(v.num_factura) OVER (PARTITION BY COALESCE(v.identificacion, v.cliente)),
        v.cliente ASC,
        v.num_factura ASC`;
    } else {
      query += ' ORDER BY v.num_factura ASC';
    }

    const result = await db.query(query, params);
    const data = result.rows;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al generar reporte:');
  }
};

const exportReporteExcel = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, solo_deudores, agrupar_cliente } = req.query;
    validateFechaInicioFin(fecha_inicio, fecha_fin);
    validateBooleanFilter(solo_deudores, 'El filtro solo_deudores debe ser true o false');
    validateBooleanFilter(agrupar_cliente, 'El filtro agrupar_cliente debe ser true o false');
    const cuentasHasDetalleAnulacion = await tableColumnExists('cuentas', 'detalle_anulacion');
    const cuentasHasFechaAnulacion = await tableColumnExists('cuentas', 'fecha_anulacion');

    let query = `SELECT
      v.*,
      c.cliente_id,
      ${cuentasHasDetalleAnulacion ? 'c.detalle_anulacion' : 'NULL::text'} AS detalle_anulacion,
      ${cuentasHasFechaAnulacion ? 'c.fecha_anulacion' : 'NULL::timestamp'} AS fecha_anulacion
    FROM vista_reporte_cuentas v
    JOIN cuentas c ON c.num_factura = v.num_factura`;
    const params = [];
    const conditions = [];

    if (fecha_inicio && fecha_fin) {
      conditions.push(`v.fecha_factura BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(fecha_inicio, fecha_fin);
    }

    if (solo_deudores === 'true') {
      conditions.push('v.saldo_pendiente > 0');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    if (agrupar_cliente === 'true') {
      query += ` ORDER BY
        MIN(v.num_factura) OVER (PARTITION BY COALESCE(v.identificacion, v.cliente)),
        v.cliente ASC,
        v.num_factura ASC`;
    } else {
      query += ' ORDER BY v.num_factura ASC';
    }

    const result = await db.query(query, params);
    const data = result.rows;

    const MONEY = '$#,##0.00';
    const { workbook, worksheet } = createWorkbook('Cuentas por Cobrar', [
      { header: 'N° Factura', key: 'num_factura', width: 14 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Identificación', key: 'identificacion', width: 18 },
      { header: 'Fecha', key: 'fecha_factura', width: 14 },
      { header: 'Subtotal', key: 'subtotal', width: 14, numFmt: MONEY },
      { header: 'IVA', key: 'iva', width: 13, numFmt: MONEY },
      { header: 'Ret. Fuente', key: 'retencion_fuente', width: 14, numFmt: MONEY },
      { header: 'Ret. IVA', key: 'retencion_iva', width: 13, numFmt: MONEY },
      { header: 'Por Cobrar', key: 'por_cobrar', width: 14, numFmt: MONEY },
      { header: 'Total Abonos', key: 'total_abonos', width: 14, numFmt: MONEY },
      { header: 'Saldo Pendiente', key: 'saldo_pendiente', width: 16, numFmt: MONEY },
    ]);

    data.forEach((row) =>
      worksheet.addRow({
        num_factura: row.num_factura,
        cliente: row.cliente,
        identificacion: row.identificacion,
        fecha_factura: row.fecha_factura
          ? new Date(row.fecha_factura).toLocaleDateString('es-EC')
          : '',
        subtotal: Number.parseFloat(row.subtotal),
        iva: Number.parseFloat(row.iva),
        retencion_fuente: Number.parseFloat(row.retencion_fuente),
        retencion_iva: Number.parseFloat(row.retencion_iva),
        por_cobrar: Number.parseFloat(row.por_cobrar),
        total_abonos: Number.parseFloat(row.total_abonos),
        saldo_pendiente: Number.parseFloat(row.saldo_pendiente),
      })
    );

    [
      'subtotal',
      'iva',
      'retencion_fuente',
      'retencion_iva',
      'por_cobrar',
      'total_abonos',
      'saldo_pendiente',
    ].forEach((key) => {
      worksheet.getColumn(key).numFmt = MONEY;
    });

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'reporte_cuentas.xlsx');
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar reporte:');
  }
};

const createBatchAbono = async (req, res) => {
  const validation = validateBatchPaymentPayload(req.body);
  if (!validation.valid) {
    return res.status(validation.status).json({
      success: false,
      message: validation.message,
    });
  }
  const {
    parsedClienteId,
    fecha,
    metodoPagoNormalizado,
    referenciaNormalizada,
    notasNormalizadas,
    abonosNormalizados,
    total,
  } = validation.value;

  let createdPago = null;
  try {
    await db.transaction(async (client) => {
      const clienteResult = await cuentasClientesRepository.findClienteIdById(
        parsedClienteId,
        client
      );

      if (clienteResult.rowCount === 0) {
        const err = new Error('CLIENTE_NO_EXISTE');
        err.code = 'CLIENTE_NO_EXISTE';
        throw err;
      }

      const facturaIds = abonosNormalizados.map((a) => a.num_factura);
      await cuentasFacturasRepository.lockFacturasByNumeros(facturaIds, client);

      const facturasResult = await cuentasFacturasRepository.findFacturasForPaymentValidation(
        facturaIds,
        client
      );

      const facturasMap = new Map(facturasResult.rows.map((r) => [Number(r.num_factura), r]));
      for (const abono of abonosNormalizados) {
        const factura = facturasMap.get(abono.num_factura);
        if (!factura) {
          const err = new Error(`FACTURA_NO_EXISTE_${abono.num_factura}`);
          err.code = 'FACTURA_NO_EXISTE';
          err.num_factura = abono.num_factura;
          throw err;
        }

        if (Number(factura.cliente_id) !== parsedClienteId) {
          const err = new Error(`FACTURA_CLIENTE_INVALIDO_${abono.num_factura}`);
          err.code = 'FACTURA_CLIENTE_INVALIDO';
          err.num_factura = abono.num_factura;
          throw err;
        }

        if (factura.cancelada) {
          const err = new Error(`FACTURA_CANCELADA_${abono.num_factura}`);
          err.code = 'FACTURA_CANCELADA';
          err.num_factura = abono.num_factura;
          throw err;
        }

        const saldo = Number(factura.saldo_pendiente || 0);
        if (abono.valor_abono > Math.round((saldo + 0.00001) * 100) / 100) {
          const err = new Error(`ABONO_EXCEDE_SALDO_${abono.num_factura}`);
          err.code = 'ABONO_EXCEDE_SALDO';
          err.num_factura = abono.num_factura;
          err.saldo = saldo;
          throw err;
        }
      }

      const pagoResult = await cuentasPagosRepository.createPago(
        {
          clienteId: parsedClienteId,
          fecha,
          metodoPago: metodoPagoNormalizado || null,
          referencia: referenciaNormalizada || null,
          notas: notasNormalizadas || null,
          total,
        },
        client
      );
      const pago_id = pagoResult.rows[0].id;
      createdPago = {
        id: pago_id,
        cliente_id: parsedClienteId,
        fecha,
        metodo_pago: metodoPagoNormalizado || null,
        referencia: referenciaNormalizada || null,
        notas: notasNormalizadas || null,
        total,
        abonos: abonosNormalizados,
      };

      for (const abono of abonosNormalizados) {
        await cuentasAbonosRepository.createAbono(
          {
            pagoId: pago_id,
            numFactura: abono.num_factura,
            fechaAbono: fecha,
            valorAbono: abono.valor_abono,
          },
          client
        );
      }
    });

    await logAudit(db, {
      tabla: 'pagos',
      operacion: 'INSERT',
      registro_id: String(createdPago.id),
      datos_nuevos: createdPago,
      ...auditFromReq(req),
    });

    res.status(201).json({
      success: true,
      message: `${abonosNormalizados.length} abono(s) registrado(s) exitosamente`,
    });
  } catch (error) {
    if (error.code === 'CLIENTE_NO_EXISTE') {
      return res.status(400).json({
        success: false,
        message: 'El cliente seleccionado no existe',
      });
    }
    if (error.code === 'FACTURA_NO_EXISTE') {
      return res.status(400).json({
        success: false,
        message: `La factura #${error.num_factura} no existe`,
      });
    }
    if (error.code === 'FACTURA_CLIENTE_INVALIDO') {
      return res.status(400).json({
        success: false,
        message: `La factura #${error.num_factura} no pertenece al cliente seleccionado`,
      });
    }
    if (error.code === 'FACTURA_CANCELADA') {
      return res.status(400).json({
        success: false,
        message: `La factura #${error.num_factura} está anulada y no admite pagos`,
      });
    }
    if (error.code === 'ABONO_EXCEDE_SALDO') {
      return res.status(400).json({
        success: false,
        message: `El abono de la factura #${error.num_factura} excede su saldo pendiente (${error.saldo.toFixed(2)})`,
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Una o más facturas especificadas no existen',
      });
    }
    return handleControllerError(res, error, 'Error al crear abonos en batch:');
  }
};

const getNextNumFactura = async (req, res) => {
  try {
    const result = await cuentasFacturasRepository.findNextFacturaNumber();
    res.json({
      success: true,
      data: { next_num_factura: result.rows[0].next_num },
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener siguiente número de factura:');
  }
};

const updateFactura = async (req, res) => {
  try {
    const numFacturaValidation = parsePositiveIntegerId(
      req.params.num_factura,
      'El número de factura es inválido'
    );
    if (!numFacturaValidation.valid) {
      throw createHttpError(numFacturaValidation.status, numFacturaValidation.message);
    }
    const parsedNumFactura = numFacturaValidation.value;
    const validation = validateFacturaUpdatePayload(req.body);
    if (!validation.valid) {
      throw createHttpError(validation.status, validation.message);
    }
    const {
      parsedClienteId,
      parsedValorFactura,
      fecha_factura,
      incluye_iva: ivaFinal,
      incluye_retencion_fuente,
      incluye_retencion_iva: retencionIvaFinal,
    } = validation.value;

    const current = await cuentasFacturasRepository.findFacturaForUpdate(parsedNumFactura);

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }

    if (current.rows[0].cancelada) {
      return res
        .status(400)
        .json({ success: false, message: 'No se puede editar una factura anulada' });
    }

    const result = await cuentasFacturasRepository.updateFacturaByNumero({
      numFactura: parsedNumFactura,
      clienteId: parsedClienteId,
      fechaFactura: fecha_factura,
      valorFactura: parsedValorFactura,
      incluyeIva: ivaFinal,
      incluyeRetencionFuente: incluye_retencion_fuente,
      incluyeRetencionIva: retencionIvaFinal,
    });

    await logAudit(db, {
      tabla: 'cuentas',
      operacion: 'UPDATE',
      registro_id: String(parsedNumFactura),
      datos_anteriores: current.rows[0],
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    res.json({
      success: true,
      message: 'Factura actualizada exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al actualizar factura:');
  }
};

const deletePago = async (req, res) => {
  try {
    const idValidation = parsePositiveIntegerId(req.params.id, 'El id del pago es inválido');
    if (!idValidation.valid) {
      throw createHttpError(idValidation.status, idValidation.message);
    }
    const id = idValidation.value;

    const current = await cuentasPagosRepository.findPagoForDeletion(id);

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    }

    await cuentasPagosRepository.deletePagoById(id);

    await logAudit(db, {
      tabla: 'pagos',
      operacion: 'DELETE',
      registro_id: String(id),
      datos_anteriores: current.rows[0],
      ...auditFromReq(req),
    });

    res.json({ success: true, message: 'Pago eliminado exitosamente' });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar pago:');
  }
};

const deleteAbono = async (req, res) => {
  try {
    const idValidation = parsePositiveIntegerId(req.params.id, 'El id del abono es inválido');
    if (!idValidation.valid) {
      throw createHttpError(idValidation.status, idValidation.message);
    }
    const id = idValidation.value;

    const current = await cuentasAbonosRepository.findAbonoForDeletion(id);

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Abono no encontrado' });
    }

    const abono = current.rows[0];

    await db.transaction(async (client) => {
      await cuentasAbonosRepository.deleteAbonoById(id, client);

      if (abono.pago_id) {
        const remaining = await cuentasAbonosRepository.countAbonosByPagoId(abono.pago_id, client);
        if (Number(remaining.rows[0].cnt) === 0) {
          await cuentasPagosRepository.deletePagoById(abono.pago_id, client);
        } else {
          await cuentasPagosRepository.updatePagoTotalFromAbonos(abono.pago_id, client);
        }
      }
    });

    await logAudit(db, {
      tabla: 'abonos',
      operacion: 'DELETE',
      registro_id: String(id),
      datos_anteriores: abono,
      ...auditFromReq(req),
    });

    res.json({ success: true, message: 'Abono eliminado exitosamente' });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar abono:');
  }
};

module.exports = {
  getClientes,
  exportClientesExcel,
  createCliente,
  deleteCliente,
  createFactura,
  deleteFactura,
  cancelFactura,
  getAbonosByFactura,
  getPagos,
  exportPagosExcel,
  createBatchAbono,
  getReporte,
  exportReporteExcel,
  getNextNumFactura,
  updateFactura,
  deletePago,
  deleteAbono,
};
