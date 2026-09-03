/**
 * cuentasController.js — Controlador del módulo de Cuentas por Cobrar
 *
 * Gestiona tres entidades principales y un reporte:
 *
 *  CLIENTES
 *  - getClientes    : Lista todos los clientes ordenados por nombre.
 *  - exportClientesExcel : Genera y descarga la lista de clientes en .xlsx.
 *  - createCliente  : Crea un cliente con nombre e identificación únicos.
 *  - deleteCliente  : Elimina un cliente solo si no tiene relaciones históricas.
 *
 *  FACTURAS
 *  - createFactura  : Registra una factura con opciones de IVA y retenciones.
 *                     Calcula los montos en la vista vista_reporte_cuentas.
 *  - deleteFactura  : Rechaza la eliminación física para preservar historial.
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
const cuentasReadRepository = require('../repositories/cuentasReadRepository');
const {
  CLIENT_HAS_RELATIONS_MESSAGE,
  deleteClienteWithoutRelations,
} = require('../services/clientesDeletionService');
const { assertClienteActivoForOperation } = require('../services/clientesStateService');
const {
  PAYMENT_CANNOT_BE_VOIDED_MESSAGE,
  rejectPaymentVoidingWithoutModel,
  rejectPhysicalInvoiceDeletion,
  voidInvoice,
} = require('../services/cuentasVoidingService');
const { createHttpError, handleControllerError } = require('../utils/http');
const { logAudit, auditFromReq } = require('../utils/audit');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');
const { validateOptionalDateRange } = require('../utils/inputValidation');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const {
  parsePositiveIntegerId,
  validateBatchPaymentPayload,
  validateClientePayload,
  validateFacturaCancellationDetail,
  validateFacturaCreatePayload,
  validateFacturaUpdatePayload,
} = require('../modules/cuentas/cuentas.validators');
const {
  FACTURAS_SORT_COLUMNS,
  PAGOS_SORT_COLUMNS,
  PAYMENT_METHODS,
} = require('../modules/cuentas/cuentas.constants');

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

    await db.transaction(async (client) => {
      await deleteClienteWithoutRelations({
        executor: client,
        clienteId: id,
        audit: (deletedCliente) =>
          logAudit(client, {
            tabla: 'clientes',
            operacion: 'DELETE',
            registro_id: String(id),
            datos_anteriores: deletedCliente,
            ...auditFromReq(req),
          }),
      });
    });

    res.json({
      success: true,
      message: 'Cliente eliminado exitosamente',
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        code: 'CLIENT_HAS_RELATIONS',
        message: CLIENT_HAS_RELATIONS_MESSAGE,
        details: { ubicaciones: 0, facturas: 0, pagos: 0 },
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

    const result = await db.transaction(async (client) => {
      await assertClienteActivoForOperation({
        executor: client,
        clienteId: parsedClienteId,
        lockClause: 'FOR SHARE',
      });

      return cuentasFacturasRepository.createFactura(
        {
          numFactura: parsedNumFactura,
          clienteId: parsedClienteId,
          fechaFactura: fecha_factura,
          valorFactura: parsedValorFactura,
          incluyeIva: !!incluye_iva,
          incluyeRetencionFuente: !!incluye_retencion_fuente,
          incluyeRetencionIva: !!incluye_retencion_iva,
        },
        client
      );
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
      return res.status(404).json({
        success: false,
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado',
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

    await rejectPhysicalInvoiceDeletion({ executor: db, numFactura: parsedNumFactura });
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

    const voided = await db.transaction(async (client) =>
      voidInvoice({
        executor: client,
        numFactura: parsedNumFactura,
        detalleAnulacion: detailValidation.value,
      })
    );

    await logAudit(db, {
      tabla: 'cuentas',
      operacion: 'UPDATE',
      registro_id: String(parsedNumFactura),
      datos_anteriores: voided.previous,
      datos_nuevos: voided.invoice,
      ...auditFromReq(req),
    });

    res.json({
      success: true,
      message: 'Factura anulada exitosamente',
      data: {
        num_factura: voided.invoice.num_factura,
        detalle_anulacion: voided.invoice.detalle_anulacion,
        fecha_anulacion: voided.invoice.fecha_anulacion,
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

const handleDeprecatedPaymentVoid = async (req, res) => {
  try {
    const idValidation = parsePositiveIntegerId(req.params.id, 'El id del pago es inválido');
    if (!idValidation.valid) {
      throw createHttpError(idValidation.status, idValidation.message);
    }

    await rejectPaymentVoidingWithoutModel({ executor: db, pagoId: idValidation.value });
  } catch (error) {
    return handleControllerError(res, error, 'Error al anular pago:');
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
    const { fecha_inicio, fecha_fin, metodo_pago, search } = req.query;
    validateFechaInicioFin(fecha_inicio, fecha_fin);
    const metodoPagoNormalizado = metodo_pago
      ? String(metodo_pago).trim().toLowerCase()
      : undefined;
    if (metodoPagoNormalizado && !PAYMENT_METHODS.includes(metodoPagoNormalizado)) {
      throw createHttpError(400, 'El método de pago no es válido');
    }
    const pagination = normalizePaginationQuery(req.query, {
      sortBy: 'created_at',
      allowedSorts: PAGOS_SORT_COLUMNS,
    });
    const { countResult, result } = await cuentasReadRepository.findPagos({
      filters: {
        fecha_inicio,
        fecha_fin,
        metodo_pago: metodoPagoNormalizado,
        search,
      },
      pagination,
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: buildPaginationMetadata({
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: countResult.rows[0]?.total,
      }),
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
    const { fecha_inicio, fecha_fin, solo_deudores, agrupar_cliente, estado, search } = req.query;
    validateFechaInicioFin(fecha_inicio, fecha_fin);
    validateBooleanFilter(solo_deudores, 'El filtro solo_deudores debe ser true o false');
    validateBooleanFilter(agrupar_cliente, 'El filtro agrupar_cliente debe ser true o false');
    if (estado && !['activa', 'anulada'].includes(String(estado))) {
      throw createHttpError(400, 'El filtro estado no es válido');
    }
    const pagination = normalizePaginationQuery(req.query, {
      sortBy: agrupar_cliente === 'true' ? 'cliente' : 'num_factura',
      allowedSorts: FACTURAS_SORT_COLUMNS,
    });
    const { countResult, result } = await cuentasReadRepository.findReporte({
      filters: {
        fecha_inicio,
        fecha_fin,
        solo_deudores,
        agrupar_cliente,
        estado,
        search,
        sortBy: req.query.sortBy,
      },
      pagination,
    });
    const data = result.rows;

    res.json({
      success: true,
      data,
      pagination: buildPaginationMetadata({
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: countResult.rows[0]?.total,
      }),
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al generar reporte:');
  }
};

const getFacturasCatalogo = async (req, res) => {
  try {
    const result = await cuentasReadRepository.findFacturasCatalogo();

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener catálogo de facturas:');
  }
};

const exportReporteExcel = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, solo_deudores, agrupar_cliente } = req.query;
    validateFechaInicioFin(fecha_inicio, fecha_fin);
    validateBooleanFilter(solo_deudores, 'El filtro solo_deudores debe ser true o false');
    validateBooleanFilter(agrupar_cliente, 'El filtro agrupar_cliente debe ser true o false');
    const result = await cuentasReadRepository.findReporteForExport({
      fecha_inicio,
      fecha_fin,
      solo_deudores,
      agrupar_cliente,
    });
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
      await assertClienteActivoForOperation({
        executor: client,
        clienteId: parsedClienteId,
        lockClause: 'FOR SHARE',
      });

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
      return res.status(404).json({
        success: false,
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado',
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

    const { current, result } = await db.transaction(async (client) => {
      const currentResult = await cuentasFacturasRepository.findFacturaForUpdate(
        parsedNumFactura,
        client
      );

      if (currentResult.rowCount === 0) {
        throw createHttpError(404, 'Factura no encontrada');
      }

      if (currentResult.rows[0].cancelada) {
        const error = createHttpError(409, 'No se puede editar una factura anulada');
        error.appCode = 'INVOICE_ALREADY_VOIDED';
        throw error;
      }

      await assertClienteActivoForOperation({
        executor: client,
        clienteId: parsedClienteId,
        lockClause: 'FOR SHARE',
      });

      const updateResult = await cuentasFacturasRepository.updateFacturaByNumero(
        {
          numFactura: parsedNumFactura,
          clienteId: parsedClienteId,
          fechaFactura: fecha_factura,
          valorFactura: parsedValorFactura,
          incluyeIva: ivaFinal,
          incluyeRetencionFuente: incluye_retencion_fuente,
          incluyeRetencionIva: retencionIvaFinal,
        },
        client
      );

      return { current: currentResult, result: updateResult };
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
  return handleDeprecatedPaymentVoid(req, res);
};

const voidPago = async (req, res) => handleDeprecatedPaymentVoid(req, res);

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

    res.status(409).json({
      success: false,
      code: 'PAYMENT_CANNOT_BE_VOIDED',
      message: PAYMENT_CANNOT_BE_VOIDED_MESSAGE,
    });
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
  getFacturasCatalogo,
  exportReporteExcel,
  getNextNumFactura,
  updateFactura,
  deletePago,
  voidPago,
  deleteAbono,
};
