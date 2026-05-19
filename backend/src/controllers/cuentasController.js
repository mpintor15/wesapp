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
const { createHttpError, handleControllerError } = require('../utils/http');
const { logAudit, auditFromReq } = require('../utils/audit');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');

const tableColumnExists = async (tableName, columnName) => {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  return result.rowCount > 0;
};

// ============================================
// CLIENTES
// ============================================

const getClientes = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, nombre, identificacion FROM clientes ORDER BY nombre ASC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const exportClientesExcel = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT nombre, identificacion FROM clientes ORDER BY nombre ASC'
    );

    const { workbook, worksheet } = createWorkbook('Clientes', [
      { header: 'Cliente',        key: 'cliente',        width: 40 },
      { header: 'Identificación', key: 'identificacion', width: 24 },
    ]);

    result.rows.forEach((row) => worksheet.addRow({
      cliente:        row.nombre,
      identificacion: row.identificacion,
    }));

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'clientes.xlsx');
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar clientes:');
  }
};

const createCliente = async (req, res) => {
  try {
    const { nombre, identificacion } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del cliente es requerido'
      });
    }

    if (!identificacion || !identificacion.trim()) {
      return res.status(400).json({
        success: false,
        message: 'La identificación del cliente es requerida'
      });
    }

    const result = await db.query(
      'INSERT INTO clientes (nombre, identificacion) VALUES ($1, $2) RETURNING id, nombre, identificacion',
      [nombre.trim(), identificacion.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un cliente con ese nombre o identificación'
      });
    }
    console.error('Error al crear cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const deleteCliente = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw createHttpError(400, 'El id del cliente es inválido');
    }

    const hasFacturas = await db.query(
      'SELECT 1 FROM cuentas WHERE cliente_id = $1 LIMIT 1',
      [id]
    );

    if (hasFacturas.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el cliente porque tiene facturas asociadas'
      });
    }

    const result = await db.query(
      'DELETE FROM clientes WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Cliente eliminado exitosamente'
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el cliente porque tiene facturas asociadas'
      });
    }
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

// ============================================
// FACTURAS (CUENTAS)
// ============================================

const createFactura = async (req, res) => {
  try {
    const {
      num_factura,
      cliente_id,
      fecha_factura,
      valor_factura,
      incluye_iva,
      incluye_retencion_fuente,
      incluye_retencion_iva
    } = req.body;

    if (!num_factura || !cliente_id || !fecha_factura || !valor_factura) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos: num_factura, cliente_id, fecha_factura, valor_factura'
      });
    }

    const parsedNumFactura = Number(num_factura);
    const parsedClienteId = Number(cliente_id);
    const parsedValorFactura = Number(valor_factura);
    const parsedFecha = new Date(`${fecha_factura}T00:00:00`);

    if (!Number.isInteger(parsedNumFactura) || parsedNumFactura <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El número de factura debe ser un entero mayor a 0'
      });
    }

    if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El cliente especificado no es válido'
      });
    }

    if (!Number.isFinite(parsedValorFactura) || parsedValorFactura <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor de la factura debe ser mayor a 0'
      });
    }

    if (Number.isNaN(parsedFecha.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de factura no es válida'
      });
    }

    if (incluye_retencion_iva && !incluye_iva) {
      return res.status(400).json({
        success: false,
        message: 'La retención de IVA requiere que IVA esté habilitado'
      });
    }

    const clienteExists = await db.query(
      'SELECT id FROM clientes WHERE id = $1 LIMIT 1',
      [parsedClienteId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'El cliente especificado no existe'
      });
    }

    const result = await db.query(
      `INSERT INTO cuentas (num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva`,
      [
        parsedNumFactura,
        parsedClienteId,
        fecha_factura,
        parsedValorFactura,
        !!incluye_iva,
        !!incluye_retencion_fuente,
        !!incluye_retencion_iva
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Factura creada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una factura con ese número'
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'El cliente especificado no existe'
      });
    }
    console.error('Error al crear factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const deleteFactura = async (req, res) => {
  try {
    const parsedNumFactura = Number(req.params.num_factura);
    if (!Number.isInteger(parsedNumFactura) || parsedNumFactura <= 0) {
      throw createHttpError(400, 'El número de factura es inválido');
    }

    const result = await db.query(
      'DELETE FROM cuentas WHERE num_factura = $1 RETURNING num_factura',
      [parsedNumFactura]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Factura eliminada exitosamente'
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar factura:');
  }
};

const cancelFactura = async (req, res) => {
  try {
    const parsedNumFactura = Number(req.params.num_factura);
    const { detalle_anulacion } = req.body;

    if (!Number.isInteger(parsedNumFactura) || parsedNumFactura <= 0) {
      throw createHttpError(400, 'El número de factura es inválido');
    }

    if (!detalle_anulacion || !detalle_anulacion.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El detalle de anulación es obligatorio'
      });
    }

    const result = await db.query(
      `UPDATE cuentas
       SET cancelada = TRUE,
           detalle_anulacion = $2,
           fecha_anulacion = CURRENT_TIMESTAMP
       WHERE num_factura = $1
       RETURNING num_factura, detalle_anulacion, fecha_anulacion`,
      [parsedNumFactura, detalle_anulacion.trim()]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Factura anulada exitosamente',
      data: {
        num_factura: result.rows[0].num_factura,
        detalle_anulacion: result.rows[0].detalle_anulacion,
        fecha_anulacion: result.rows[0].fecha_anulacion
      }
    });
  } catch (error) {
    if (error.code === '42703') {
      return res.status(500).json({
        success: false,
        message: 'Configuración incompleta de base de datos: faltan columnas de anulación'
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
    const parsedNumFactura = Number(req.params.num_factura);
    if (!Number.isInteger(parsedNumFactura) || parsedNumFactura <= 0) {
      throw createHttpError(400, 'El número de factura es inválido');
    }

    const result = await db.query(
      `SELECT
         a.id,
         a.pago_id,
         a.fecha_abono,
         a.valor_abono,
         p.fecha AS fecha_pago,
         p.metodo_pago,
         p.referencia,
         p.notas,
         p.total AS pago_total,
         CASE
           WHEN a.pago_id IS NULL THEN 1
           ELSE (
             SELECT COUNT(*)
             FROM abonos a2
             WHERE a2.pago_id = a.pago_id
           )
         END AS pago_facturas_count
       FROM abonos a
       LEFT JOIN pagos p ON p.id = a.pago_id
       WHERE a.num_factura = $1
       ORDER BY a.fecha_abono DESC, a.id DESC`,
      [parsedNumFactura]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener abonos de factura:');
  }
};

const getPagos = async (req, res) => {
  try {
    const pagosHasCreatedAt = await tableColumnExists('pagos', 'created_at');
    const cuentasHasCancelada = await tableColumnExists('cuentas', 'cancelada');
    const createdAtSelect = pagosHasCreatedAt ? 'p.created_at' : 'p.fecha';
    const orderByCreatedAt = pagosHasCreatedAt ? 'p.created_at DESC,' : '';
    const canceladaSelect = cuentasHasCancelada ? 'c.cancelada' : 'FALSE';

    const result = await db.query(
      `SELECT
         p.id,
         p.fecha,
         p.metodo_pago,
         p.referencia,
         p.notas,
         p.total,
         ${createdAtSelect} AS created_at,
         cl.id AS cliente_id,
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
               'saldo_pendiente', v.saldo_pendiente
             )
             ORDER BY a.num_factura
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'::json
         ) AS facturas
       FROM pagos p
       JOIN clientes cl ON cl.id = p.cliente_id
       LEFT JOIN abonos a ON a.pago_id = p.id
       LEFT JOIN cuentas c ON c.num_factura = a.num_factura
       LEFT JOIN vista_reporte_cuentas v ON v.num_factura = a.num_factura
       GROUP BY p.id, cl.id, cl.nombre, cl.identificacion
       ORDER BY ${orderByCreatedAt} p.fecha DESC, p.id DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener pagos:');
  }
};

const exportPagosExcel = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, metodo_pago } = req.query;

    const conditions = [];
    const params = [];

    if (fecha_inicio && fecha_fin) {
      params.push(fecha_inicio, fecha_fin);
      conditions.push(`p.fecha BETWEEN $${params.length - 1} AND $${params.length}`);
    }
    if (metodo_pago) {
      params.push(metodo_pago.toLowerCase());
      conditions.push(`LOWER(COALESCE(p.metodo_pago, '')) = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
         p.id,
         p.fecha,
         COALESCE(cl.nombre, '-') AS cliente,
         COALESCE(p.metodo_pago, '-') AS metodo_pago,
         COALESCE(p.notas, '') AS notas,
         p.total,
         STRING_AGG(
           '#' || a.num_factura::text || ' (' || TO_CHAR(a.valor_abono, 'FM999999990.00') || ')',
           ', ' ORDER BY a.num_factura
         ) AS facturas
       FROM pagos p
       JOIN clientes cl ON cl.id = p.cliente_id
       LEFT JOIN abonos a ON a.pago_id = p.id
       ${where}
       GROUP BY p.id, cl.nombre
       ORDER BY p.fecha DESC, p.id DESC`,
      params
    );

    const { workbook, worksheet } = createWorkbook('Pagos', [
      { header: 'Pago',           key: 'id',          width: 12 },
      { header: 'Fecha',          key: 'fecha',        width: 14 },
      { header: 'Cliente',        key: 'cliente',      width: 36 },
      { header: 'Método de pago', key: 'metodo_pago',  width: 18 },
      { header: 'Valor',          key: 'total',        width: 16, numFmt: '$#,##0.00' },
      { header: 'Facturas',       key: 'facturas',     width: 50 },
      { header: 'Notas',          key: 'notas',        width: 40 },
    ]);

    result.rows.forEach((row) => worksheet.addRow({
      id:          row.id,
      fecha:       row.fecha ? new Date(row.fecha).toLocaleDateString('es-EC') : '-',
      cliente:     row.cliente,
      metodo_pago: row.metodo_pago,
      total:       Number(row.total || 0),
      facturas:    row.facturas || '-',
      notas:       row.notas,
    }));

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

    if ((fecha_inicio && !fecha_fin) || (!fecha_inicio && fecha_fin)) {
      throw createHttpError(400, 'Debes enviar fecha_inicio y fecha_fin juntas');
    }

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
      data
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al generar reporte:');
  }
};

const exportReporteExcel = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, solo_deudores, agrupar_cliente } = req.query;
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

    if ((fecha_inicio && !fecha_fin) || (!fecha_inicio && fecha_fin)) {
      throw createHttpError(400, 'Debes enviar fecha_inicio y fecha_fin juntas');
    }

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
      { header: 'N° Factura',       key: 'num_factura',      width: 14 },
      { header: 'Cliente',          key: 'cliente',          width: 30 },
      { header: 'Identificación',   key: 'identificacion',   width: 18 },
      { header: 'Fecha',            key: 'fecha_factura',    width: 14 },
      { header: 'Subtotal',         key: 'subtotal',         width: 14, numFmt: MONEY },
      { header: 'IVA',              key: 'iva',              width: 13, numFmt: MONEY },
      { header: 'Ret. Fuente',      key: 'retencion_fuente', width: 14, numFmt: MONEY },
      { header: 'Ret. IVA',         key: 'retencion_iva',    width: 13, numFmt: MONEY },
      { header: 'Por Cobrar',       key: 'por_cobrar',       width: 14, numFmt: MONEY },
      { header: 'Total Abonos',     key: 'total_abonos',     width: 14, numFmt: MONEY },
      { header: 'Saldo Pendiente',  key: 'saldo_pendiente',  width: 16, numFmt: MONEY },
    ]);

    data.forEach((row) => worksheet.addRow({
      num_factura:      row.num_factura,
      cliente:          row.cliente,
      identificacion:   row.identificacion,
      fecha_factura:    row.fecha_factura ? new Date(row.fecha_factura).toLocaleDateString('es-EC') : '',
      subtotal:         Number.parseFloat(row.subtotal),
      iva:              Number.parseFloat(row.iva),
      retencion_fuente: Number.parseFloat(row.retencion_fuente),
      retencion_iva:    Number.parseFloat(row.retencion_iva),
      por_cobrar:       Number.parseFloat(row.por_cobrar),
      total_abonos:     Number.parseFloat(row.total_abonos),
      saldo_pendiente:  Number.parseFloat(row.saldo_pendiente),
    }));

    ['subtotal', 'iva', 'retencion_fuente', 'retencion_iva', 'por_cobrar', 'total_abonos', 'saldo_pendiente']
      .forEach((key) => { worksheet.getColumn(key).numFmt = MONEY; });

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'reporte_cuentas.xlsx');
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar reporte:');
  }
};

const createBatchAbono = async (req, res) => {
  const { cliente_id, fecha, metodo_pago, referencia, notas, abonos } = req.body;

  const parsedClienteId = Number(cliente_id);
  const parsedFecha = fecha ? new Date(`${fecha}T00:00:00`) : null;
  const metodoPagoNormalizado = metodo_pago ? String(metodo_pago).trim().toLowerCase() : null;
  const metodosPermitidos = new Set(['efectivo', 'transferencia', 'cheque', 'otro']);
  const referenciaNormalizada = typeof referencia === 'string' ? referencia.trim() : null;
  const notasNormalizadas = typeof notas === 'string' ? notas.trim() : null;

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere un cliente válido para registrar el pago'
    });
  }

  if (!fecha || Number.isNaN(parsedFecha?.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'La fecha del pago es obligatoria y debe ser válida'
    });
  }

  if (metodoPagoNormalizado && !metodosPermitidos.has(metodoPagoNormalizado)) {
    return res.status(400).json({
      success: false,
      message: 'El método de pago no es válido'
    });
  }

  if (referenciaNormalizada && referenciaNormalizada.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'La referencia no puede superar los 100 caracteres'
    });
  }

  if (notasNormalizadas && notasNormalizadas.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Las notas no pueden superar los 500 caracteres'
    });
  }

  if (!Array.isArray(abonos) || abonos.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Debes seleccionar al menos una factura con monto'
    });
  }

  const seenFacturas = new Set();
  const abonosNormalizados = [];

  for (const item of abonos) {
    const numFactura = Number(item?.num_factura);
    const valorAbono = Number(item?.valor_abono);

    if (!Number.isInteger(numFactura) || numFactura <= 0 || !Number.isFinite(valorAbono) || valorAbono <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cada abono debe tener num_factura y valor_abono mayor a 0'
      });
    }

    if (seenFacturas.has(numFactura)) {
      return res.status(400).json({
        success: false,
        message: `La factura #${numFactura} está repetida en la distribución`
      });
    }

    seenFacturas.add(numFactura);
    abonosNormalizados.push({
      num_factura: numFactura,
      valor_abono: Math.round(valorAbono * 100) / 100
    });
  }

  const total = Math.round(abonosNormalizados.reduce((sum, a) => sum + a.valor_abono, 0) * 100) / 100;

  try {
    await db.transaction(async (client) => {
      const clienteResult = await client.query(
        'SELECT id FROM clientes WHERE id = $1 LIMIT 1',
        [parsedClienteId]
      );

      if (clienteResult.rowCount === 0) {
        const err = new Error('CLIENTE_NO_EXISTE');
        err.code = 'CLIENTE_NO_EXISTE';
        throw err;
      }

      const facturasResult = await client.query(
        `SELECT
           c.num_factura,
           c.cliente_id,
           c.cancelada,
           COALESCE(v.saldo_pendiente, 0) AS saldo_pendiente
         FROM cuentas c
         LEFT JOIN vista_reporte_cuentas v ON v.num_factura = c.num_factura
         WHERE c.num_factura = ANY($1::int[])`,
        [abonosNormalizados.map((a) => a.num_factura)]
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

      const pagoResult = await client.query(
        'INSERT INTO pagos (cliente_id, fecha, metodo_pago, referencia, notas, total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [
          parsedClienteId,
          fecha,
          metodoPagoNormalizado || null,
          referenciaNormalizada || null,
          notasNormalizadas || null,
          total
        ]
      );
      const pago_id = pagoResult.rows[0].id;

      for (const abono of abonosNormalizados) {
        await client.query(
          'INSERT INTO abonos (pago_id, num_factura, fecha_abono, valor_abono) VALUES ($1, $2, $3, $4)',
          [pago_id, abono.num_factura, fecha, abono.valor_abono]
        );
      }
    });

    res.status(201).json({
      success: true,
      message: `${abonosNormalizados.length} abono(s) registrado(s) exitosamente`
    });
  } catch (error) {
    if (error.code === 'CLIENTE_NO_EXISTE') {
      return res.status(400).json({
        success: false,
        message: 'El cliente seleccionado no existe'
      });
    }
    if (error.code === 'FACTURA_NO_EXISTE') {
      return res.status(400).json({
        success: false,
        message: `La factura #${error.num_factura} no existe`
      });
    }
    if (error.code === 'FACTURA_CLIENTE_INVALIDO') {
      return res.status(400).json({
        success: false,
        message: `La factura #${error.num_factura} no pertenece al cliente seleccionado`
      });
    }
    if (error.code === 'FACTURA_CANCELADA') {
      return res.status(400).json({
        success: false,
        message: `La factura #${error.num_factura} está anulada y no admite pagos`
      });
    }
    if (error.code === 'ABONO_EXCEDE_SALDO') {
      return res.status(400).json({
        success: false,
        message: `El abono de la factura #${error.num_factura} excede su saldo pendiente (${error.saldo.toFixed(2)})`
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Una o más facturas especificadas no existen'
      });
    }
    console.error('Error al crear abonos en batch:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const getNextNumFactura = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT COALESCE(MAX(num_factura), 0) + 1 AS next_num FROM cuentas'
    );
    res.json({
      success: true,
      data: { next_num_factura: result.rows[0].next_num }
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener siguiente número de factura:');
  }
};

const updateFactura = async (req, res) => {
  try {
    const parsedNumFactura = Number(req.params.num_factura);
    if (!Number.isInteger(parsedNumFactura) || parsedNumFactura <= 0) {
      throw createHttpError(400, 'El número de factura es inválido');
    }

    const { cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva } = req.body;

    if (!cliente_id || !fecha_factura || !valor_factura) {
      throw createHttpError(400, 'Campos requeridos: cliente_id, fecha_factura, valor_factura');
    }

    const parsedClienteId = Number(cliente_id);
    const parsedValorFactura = Number(valor_factura);

    if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
      throw createHttpError(400, 'El cliente especificado no es válido');
    }

    if (!Number.isFinite(parsedValorFactura) || parsedValorFactura <= 0) {
      throw createHttpError(400, 'El valor de la factura debe ser mayor a 0');
    }

    const current = await db.query(
      'SELECT num_factura, cancelada, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva FROM cuentas WHERE num_factura = $1',
      [parsedNumFactura]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }

    if (current.rows[0].cancelada) {
      return res.status(400).json({ success: false, message: 'No se puede editar una factura anulada' });
    }

    const ivaFinal = !!incluye_iva;
    const retencionIvaFinal = ivaFinal ? !!incluye_retencion_iva : false;

    const result = await db.query(
      `UPDATE cuentas
       SET cliente_id = $2, fecha_factura = $3, valor_factura = $4,
           incluye_iva = $5, incluye_retencion_fuente = $6, incluye_retencion_iva = $7
       WHERE num_factura = $1
       RETURNING num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva`,
      [parsedNumFactura, parsedClienteId, fecha_factura, parsedValorFactura, ivaFinal, !!incluye_retencion_fuente, retencionIvaFinal]
    );

    await logAudit(db, {
      tabla: 'cuentas',
      operacion: 'UPDATE',
      registro_id: String(parsedNumFactura),
      datos_anteriores: current.rows[0],
      datos_nuevos: result.rows[0],
      ...auditFromReq(req)
    });

    res.json({
      success: true,
      message: 'Factura actualizada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al actualizar factura:');
  }
};

const deletePago = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw createHttpError(400, 'El id del pago es inválido');
    }

    const current = await db.query(
      `SELECT
         p.id,
         p.cliente_id,
         p.fecha,
         p.metodo_pago,
         p.referencia,
         p.notas,
         p.total,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'id', a.id,
               'num_factura', a.num_factura,
               'fecha_abono', a.fecha_abono,
               'valor_abono', a.valor_abono
             )
             ORDER BY a.id
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'::json
         ) AS abonos
       FROM pagos p
       LEFT JOIN abonos a ON a.pago_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    }

    await db.query('DELETE FROM pagos WHERE id = $1', [id]);

    await logAudit(db, {
      tabla: 'pagos',
      operacion: 'DELETE',
      registro_id: String(id),
      datos_anteriores: current.rows[0],
      ...auditFromReq(req)
    });

    res.json({ success: true, message: 'Pago eliminado exitosamente' });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar pago:');
  }
};

const deleteAbono = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw createHttpError(400, 'El id del abono es inválido');
    }

    const current = await db.query(
      'SELECT id, pago_id, num_factura, valor_abono FROM abonos WHERE id = $1',
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Abono no encontrado' });
    }

    const abono = current.rows[0];

    await db.transaction(async (client) => {
      await client.query('DELETE FROM abonos WHERE id = $1', [id]);

      if (abono.pago_id) {
        const remaining = await client.query(
          'SELECT COUNT(*) AS cnt FROM abonos WHERE pago_id = $1',
          [abono.pago_id]
        );
        if (Number(remaining.rows[0].cnt) === 0) {
          await client.query('DELETE FROM pagos WHERE id = $1', [abono.pago_id]);
        } else {
          await client.query(
            'UPDATE pagos SET total = (SELECT COALESCE(SUM(valor_abono), 0) FROM abonos WHERE pago_id = $1) WHERE id = $1',
            [abono.pago_id]
          );
        }
      }
    });

    await logAudit(db, {
      tabla: 'abonos',
      operacion: 'DELETE',
      registro_id: String(id),
      datos_anteriores: abono,
      ...auditFromReq(req)
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
  deleteAbono
};
