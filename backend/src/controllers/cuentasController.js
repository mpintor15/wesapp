/**
 * cuentasController.js — Controlador del módulo de Cuentas por Cobrar
 *
 * Gestiona tres entidades principales y un reporte:
 *
 *  CLIENTES
 *  - getClientes    : Lista todos los clientes ordenados por nombre.
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
 *  - createAbono        : Registra un único abono sobre una factura.
 *  - createBatchAbono   : Registra múltiples abonos en una sola transacción
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
    const { id } = req.params;

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

    if (isNaN(num_factura) || isNaN(valor_factura)) {
      return res.status(400).json({
        success: false,
        message: 'Número de factura y valor deben ser numéricos'
      });
    }

    if (parseFloat(valor_factura) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor de la factura debe ser mayor a 0'
      });
    }

    const result = await db.query(
      `INSERT INTO cuentas (num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva`,
      [
        parseInt(num_factura),
        cliente_id,
        fecha_factura,
        parseFloat(valor_factura),
        incluye_iva || false,
        incluye_retencion_fuente || false,
        incluye_retencion_iva || false
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
    const { num_factura } = req.params;

    const result = await db.query(
      'DELETE FROM cuentas WHERE num_factura = $1 RETURNING num_factura',
      [num_factura]
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
    console.error('Error al eliminar factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const cancelFactura = async (req, res) => {
  try {
    const { num_factura } = req.params;

    const result = await db.query(
      'UPDATE cuentas SET cancelada = TRUE WHERE num_factura = $1 RETURNING num_factura',
      [num_factura]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Factura anulada exitosamente'
    });
  } catch (error) {
    console.error('Error al cancelar factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

// ============================================
// ABONOS
// ============================================

const getAbonosByFactura = async (req, res) => {
  try {
    const { num_factura } = req.params;

    const result = await db.query(
      `SELECT id, fecha_abono, valor_abono
       FROM abonos
       WHERE num_factura = $1
       ORDER BY fecha_abono DESC`,
      [num_factura]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener abonos de factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const createAbono = async (req, res) => {
  try {
    const { num_factura, fecha_abono, valor_abono } = req.body;

    if (!num_factura || !fecha_abono || !valor_abono) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos: num_factura, fecha_abono, valor_abono'
      });
    }

    if (isNaN(valor_abono)) {
      return res.status(400).json({
        success: false,
        message: 'El valor del abono debe ser numérico'
      });
    }

    if (parseFloat(valor_abono) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor del abono debe ser mayor a 0'
      });
    }

    const result = await db.query(
      `INSERT INTO abonos (num_factura, fecha_abono, valor_abono)
       VALUES ($1, $2, $3)
       RETURNING id, num_factura, fecha_abono, valor_abono`,
      [parseInt(num_factura), fecha_abono, parseFloat(valor_abono)]
    );

    res.status(201).json({
      success: true,
      message: 'Abono registrado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'La factura especificada no existe'
      });
    }
    console.error('Error al crear abono:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

// ============================================
// REPORTE
// ============================================

const getReporte = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, solo_deudores } = req.query;

    let query = 'SELECT * FROM vista_reporte_cuentas';
    const params = [];
    const conditions = [];

    if (fecha_inicio && fecha_fin) {
      conditions.push(`fecha_factura BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(fecha_inicio, fecha_fin);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY num_factura ASC';

    let result = await db.query(query, params);
    let data = result.rows;

    if (solo_deudores === 'true') {
      data = data.filter(row => parseFloat(row.saldo_pendiente) > 0);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const exportReporteExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { fecha_inicio, fecha_fin, solo_deudores } = req.query;

    let query = 'SELECT * FROM vista_reporte_cuentas';
    const params = [];
    const conditions = [];

    if (fecha_inicio && fecha_fin) {
      conditions.push(`fecha_factura BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(fecha_inicio, fecha_fin);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY num_factura ASC';

    let result = await db.query(query, params);
    let data = result.rows;

    if (solo_deudores === 'true') {
      data = data.filter(row => parseFloat(row.saldo_pendiente) > 0);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cuentas por Cobrar');

    worksheet.columns = [
      { header: 'Num Factura', key: 'num_factura', width: 15 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Identificación', key: 'identificacion', width: 18 },
      { header: 'Fecha Factura', key: 'fecha_factura', width: 15 },
      { header: 'Subtotal', key: 'subtotal', width: 15 },
      { header: 'IVA', key: 'iva', width: 15 },
      { header: 'Retención Fuente', key: 'retencion_fuente', width: 18 },
      { header: 'Retención IVA', key: 'retencion_iva', width: 15 },
      { header: 'Por Cobrar', key: 'por_cobrar', width: 15 },
      { header: 'Total Abonos', key: 'total_abonos', width: 15 },
      { header: 'Saldo Pendiente', key: 'saldo_pendiente', width: 18 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    data.forEach(row => {
      worksheet.addRow({
        num_factura: row.num_factura,
        cliente: row.cliente,
        identificacion: row.identificacion,
        fecha_factura: row.fecha_factura ? new Date(row.fecha_factura).toLocaleDateString('es-EC') : '',
        subtotal: parseFloat(row.subtotal),
        iva: parseFloat(row.iva),
        retencion_fuente: parseFloat(row.retencion_fuente),
        retencion_iva: parseFloat(row.retencion_iva),
        por_cobrar: parseFloat(row.por_cobrar),
        total_abonos: parseFloat(row.total_abonos),
        saldo_pendiente: parseFloat(row.saldo_pendiente)
      });
    });

    // Format money columns
    ['E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => {
      worksheet.getColumn(col).numFmt = '$#,##0.00';
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_cuentas.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar el archivo Excel'
    });
  }
};

const createBatchAbono = async (req, res) => {
  const { fecha_abono, abonos } = req.body;

  if (!fecha_abono || !Array.isArray(abonos) || abonos.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere fecha_abono y al menos un abono'
    });
  }

  for (const abono of abonos) {
    if (!abono.num_factura || !abono.valor_abono || parseFloat(abono.valor_abono) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cada abono debe tener num_factura y valor_abono mayor a 0'
      });
    }
  }

  try {
    await db.transaction(async (client) => {
      for (const abono of abonos) {
        await client.query(
          'INSERT INTO abonos (num_factura, fecha_abono, valor_abono) VALUES ($1, $2, $3)',
          [parseInt(abono.num_factura), fecha_abono, parseFloat(abono.valor_abono)]
        );
      }
    });

    res.status(201).json({
      success: true,
      message: `${abonos.length} abono(s) registrado(s) exitosamente`
    });
  } catch (error) {
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

module.exports = {
  getClientes,
  createCliente,
  deleteCliente,
  createFactura,
  deleteFactura,
  cancelFactura,
  getAbonosByFactura,
  createAbono,
  createBatchAbono,
  getReporte,
  exportReporteExcel
};
