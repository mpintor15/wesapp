/**
 * inventarioController.js — Controlador del módulo de Inventario
 *
 * Gestiona cuatro entidades y sus exportaciones:
 *
 *  UBICACIONES
 *  - getUbicaciones   : Lista todos los lugares de almacenamiento.
 *
 *  ARTÍCULOS (via vista_inventario_alertas)
 *  - getArticulos     : Lista artículos con filtros de tipo, ubicación, estado y búsqueda.
 *  - createArticulo   : Crea un artículo (equipo, placa_balistica, arma, radio, otro).
 *                       Si se proporciona ubicacion_nombre en lugar de ID, crea
 *                       la ubicación automáticamente si no existe.
 *  - updateArticulo   : Actualiza campos permitidos de un artículo existente.
 *  - deleteArticulo   : Para equipos con stock > 1 descuenta cantidad; si el
 *                       stock queda en 0 hace un soft-delete (activo=FALSE).
 *                       Para artículos serializados hace soft-delete directamente.
 *  - exportArticulosExcel : Descarga el inventario filtrado en formato .xlsx.
 *
 *  MOVIMIENTOS (traslados entre ubicaciones)
 *  - getMovimientos        : Lista todos los movimientos con su tipo (entrada/salida/traslado).
 *  - createMovimiento      : Registra un traslado dentro de una transacción:
 *                            · Valida origen ≠ destino para cada artículo.
 *                            · Para equipos con cantidad > 1 permite traslado parcial
 *                              clonando el artículo con la cantidad trasladada.
 *                            · Para artículos serializados solo acepta cantidad = 1.
 *                            · Genera automáticamente un PDF con el acta del traslado.
 *  - downloadMovimientoPdf : Descarga el PDF de acta generado para un movimiento.
 *
 *  PDF
 *  - generateMovimientoPdf : (interno) Genera el PDF con pdfkit, con tabla de
 *                            artículos, datos del traslado y casillas de firma.
 */
const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { createHttpError, isConstraintOrInputError } = require('../utils/http');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');
const ALERTA_ESTADOS = new Set(['vencida', 'proxima_a_vencer', 'vigente']);

const buildInventarioAlertasQuery = ({ tipo, ubicacion_id, estado, search }) => {
  let query = 'SELECT * FROM vista_inventario_alertas';
  const params = [];
  const conditions = [];

  if (tipo) {
    params.push(tipo);
    conditions.push(`tipo_articulo = $${params.length}`);
  }

  if (ubicacion_id) {
    params.push(ubicacion_id);
    conditions.push(`ubicacion_id = $${params.length}`);
  }

  if (estado) {
    params.push(estado);
    conditions.push(`estado_caducidad = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      nombre_articulo ILIKE $${params.length} OR
      numero_serie ILIKE $${params.length} OR
      marca ILIKE $${params.length} OR
      modelo ILIKE $${params.length} OR
      calibre ILIKE $${params.length} OR
      codigo_pantalla ILIKE $${params.length} OR
      codigo_radio ILIKE $${params.length} OR
      version ILIKE $${params.length}
    )`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';
  return { query, params };
};

// ============================================
// UBICACIONES
// ============================================

const getUbicaciones = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, nombre FROM ubicaciones ORDER BY nombre ASC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener ubicaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

// ============================================
// ARTICULOS
// ============================================

const getArticulos = async (req, res) => {
  try {
    const { tipo, ubicacion_id, estado, search } = req.query;
    const normalizedEstado = estado ? String(estado).trim().toLowerCase() : '';
    if (estado && !ALERTA_ESTADOS.has(normalizedEstado)) {
      throw createHttpError(400, 'El filtro estado no es válido');
    }
    const { query, params } = buildInventarioAlertasQuery({
      tipo,
      ubicacion_id,
      estado: estado ? normalizedEstado : undefined,
      search
    });

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener articulos:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const normalizeEmpty = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const isValidTipo = (tipo) => ['equipo', 'placa_balistica', 'arma', 'radio', 'otro'].includes(tipo);
const isStockTipo = (tipo) => tipo === 'equipo' || tipo === 'otro';
const getArticuloSerie = (articulo) => (
  articulo?.tipo_articulo === 'radio' ? articulo.codigo_radio : articulo?.numero_serie
);

const getUniqueArticuloMessage = (error) => {
  const constraint = error.constraint || '';
  const detail = error.detail || '';
  if (constraint.includes('codigo_pantalla') || detail.includes('codigo_pantalla')) {
    return 'Ya existe un artículo con ese código de pantalla';
  }
  if (constraint.includes('codigo_radio') || detail.includes('codigo_radio')) {
    return 'Ya existe un artículo con ese número de serie';
  }
  if (constraint.includes('version') || detail.includes('(version)')) {
    return 'Ya existe un artículo con esa versión';
  }
  return 'Ya existe un artículo con ese número de serie';
};

const createArticulo = async (req, res) => {
  try {
    const {
      tipo_articulo,
      nombre_articulo,
      cantidad,
      talla,
      marca,
      modelo,
      numero_serie,
      calibre,
      fecha_caducidad,
      ubicacion_id,
      ubicacion_nombre,
      codigo_pantalla,
      codigo_radio,
      version
    } = req.body;

    if (!tipo_articulo || !isValidTipo(tipo_articulo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de articulo inválido'
      });
    }

    if (!nombre_articulo || !String(nombre_articulo).trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del artículo es requerido'
      });
    }

    if (isStockTipo(tipo_articulo)) {
      const parsedCantidad = Number(cantidad);
      if (!Number.isInteger(parsedCantidad) || parsedCantidad <= 0) {
        return res.status(400).json({
          success: false,
          message: 'La cantidad debe ser un entero mayor a 0'
        });
      }
    }

    let ubicacionId = ubicacion_id;
    const ubicacionNombre = ubicacion_nombre ? String(ubicacion_nombre).trim() : '';

    if (!ubicacionId && ubicacionNombre) {
      const existente = await db.query(
        'SELECT id FROM ubicaciones WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
        [ubicacionNombre]
      );
      if (existente.rowCount > 0) {
        ubicacionId = existente.rows[0].id;
      } else {
        const creado = await db.query(
          'INSERT INTO ubicaciones (nombre) VALUES ($1) RETURNING id',
          [ubicacionNombre]
        );
        ubicacionId = creado.rows[0].id;
      }
    }

    if (!ubicacionId) {
      return res.status(400).json({
        success: false,
        message: 'La ubicación es requerida'
      });
    }

    const result = await db.query(
      `INSERT INTO articulos (
        tipo_articulo,
        nombre_articulo,
        cantidad,
        talla,
        marca,
        modelo,
        numero_serie,
        calibre,
        fecha_caducidad,
        ubicacion_id,
        codigo_pantalla,
        codigo_radio,
        version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id, tipo_articulo, nombre_articulo, cantidad, talla, marca, modelo, numero_serie, calibre, fecha_caducidad, ubicacion_id, codigo_pantalla, codigo_radio, version`,
      [
        tipo_articulo,
        normalizeEmpty(nombre_articulo),
        cantidad ? parseInt(cantidad, 10) : (!isStockTipo(tipo_articulo) ? 1 : null),
        normalizeEmpty(talla),
        normalizeEmpty(marca),
        normalizeEmpty(modelo),
        tipo_articulo === 'radio' ? null : normalizeEmpty(numero_serie),
        normalizeEmpty(calibre),
        normalizeEmpty(fecha_caducidad),
        parseInt(ubicacionId, 10),
        normalizeEmpty(codigo_pantalla),
        normalizeEmpty(codigo_radio),
        normalizeEmpty(version)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Artículo creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: getUniqueArticuloMessage(error)
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'La ubicación especificada no existe'
      });
    }
    console.error('Error al crear artículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const updateArticulo = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'tipo_articulo',
      'nombre_articulo',
      'cantidad',
      'talla',
      'marca',
      'modelo',
      'numero_serie',
      'calibre',
      'fecha_caducidad',
      'ubicacion_id',
      'codigo_pantalla',
      'codigo_radio',
      'version'
    ];

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, 'tipo_articulo')) {
      if (!isValidTipo(req.body.tipo_articulo)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de articulo inválido'
        });
      }
    }

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        let value = req.body[field];
        if (field === 'cantidad' && value !== null && value !== undefined && value !== '') {
          value = parseInt(value, 10);
        }
        if (field === 'ubicacion_id' && value !== null && value !== undefined && value !== '') {
          value = parseInt(value, 10);
        }
        updates.push(`${field} = $${values.length + 1}`);
        values.push(normalizeEmpty(value));
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE articulos SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, tipo_articulo, nombre_articulo, cantidad, talla, marca, modelo, numero_serie, calibre, fecha_caducidad, ubicacion_id`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Artículo no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Artículo actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: getUniqueArticuloMessage(error)
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'La ubicación especificada no existe'
      });
    }
    console.error('Error al actualizar artículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const deleteArticulo = async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const cantidadParam = req.query.cantidad ? parseInt(req.query.cantidad, 10) : null;

    await client.query('BEGIN');

    const articuloRes = await client.query(
      'SELECT id, tipo_articulo, cantidad FROM articulos WHERE id = $1',
      [id]
    );

    if (articuloRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Artículo no encontrado'
      });
    }

    const articulo = articuloRes.rows[0];

    if (isStockTipo(articulo.tipo_articulo) && articulo.cantidad && articulo.cantidad > 1) {
      if (!cantidadParam || cantidadParam <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Debes indicar la cantidad a eliminar'
        });
      }
      if (cantidadParam > articulo.cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'La cantidad a eliminar supera el stock disponible'
        });
      }

      const restante = articulo.cantidad - cantidadParam;
      if (restante > 0) {
        await client.query(
          'UPDATE articulos SET cantidad = $1 WHERE id = $2',
          [restante, articulo.id]
        );
        await client.query('COMMIT');
        return res.json({
          success: true,
          message: 'Cantidad eliminada exitosamente'
        });
      }
    }

    const result = await client.query(
      'UPDATE articulos SET activo = FALSE, cantidad = 0, ubicacion_id = NULL WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Artículo no encontrado'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Artículo eliminado exitosamente'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar artículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  } finally {
    client.release();
  }
};

// ============================================
// MOVIMIENTOS
// ============================================

const getMovimientos = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        m.id,
        m.fecha_movimiento,
        m.pdf_path,
        u.usuario,
        COALESCE(SUM(d.cantidad), 0)::INT AS items,
        STRING_AGG(
          DISTINCT COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo')
          , ', '
          ORDER BY COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo')
        ) AS articulos_movidos,
        CASE
          WHEN BOOL_AND(d.ubicacion_origen_id IS NULL) THEN 'entrada'
          WHEN BOOL_AND(d.ubicacion_destino_id IS NULL) THEN 'salida'
          ELSE 'traslado'
        END AS tipo_movimiento,
        STRING_AGG(DISTINCT ao.nombre, ', ' ORDER BY ao.nombre) AS ubicacion_origen,
        CASE
          WHEN COUNT(DISTINCT d.ubicacion_destino_id) = 1 THEN MAX(ad.nombre)
          ELSE NULL
        END AS ubicacion_destino,
        CASE
          WHEN COUNT(DISTINCT d.ubicacion_destino_id) = 1 THEN MAX(d.ubicacion_destino_id)
          ELSE NULL
        END AS ubicacion_destino_id
      FROM movimientos m
      LEFT JOIN detalle_movimientos d ON d.movimiento_id = m.id
      LEFT JOIN articulos a ON d.articulo_id = a.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
      LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
      GROUP BY m.id, u.usuario
      ORDER BY m.fecha_movimiento DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const buildMovimientosReporteQuery = ({ from, to, destino_id }) => {
  const params = [];
  const conditions = [];

  if (from) {
    params.push(from);
    conditions.push(`m.fecha_movimiento::date >= $${params.length}::date`);
  }

  if (to) {
    params.push(to);
    conditions.push(`m.fecha_movimiento::date <= $${params.length}::date`);
  }

  if (destino_id) {
    params.push(destino_id);
    conditions.push(`d.ubicacion_destino_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return {
    params,
    query: `
      SELECT
        m.id,
        m.fecha_movimiento,
        u.usuario,
        COALESCE(SUM(d.cantidad), 0)::INT AS items,
        STRING_AGG(
          DISTINCT COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo'),
          ', '
          ORDER BY COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo')
        ) AS articulos_movidos,
        STRING_AGG(DISTINCT ao.nombre, ', ' ORDER BY ao.nombre) AS ubicacion_origen,
        CASE
          WHEN COUNT(DISTINCT d.ubicacion_destino_id) = 1 THEN MAX(ad.nombre)
          ELSE NULL
        END AS ubicacion_destino
      FROM movimientos m
      LEFT JOIN detalle_movimientos d ON d.movimiento_id = m.id
      LEFT JOIN articulos a ON d.articulo_id = a.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
      LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
      ${where}
      GROUP BY m.id, u.usuario
      ORDER BY m.fecha_movimiento DESC`
  };
};

const getMovimientoDataForPdf = async (movimientoId) => {
  const result = await db.query(
    `SELECT 
      m.id,
      m.fecha_movimiento,
      u.usuario,
      d.cantidad,
      a.tipo_articulo,
      a.nombre_articulo,
      a.numero_serie,
      a.codigo_radio,
      a.marca,
      a.modelo,
      a.calibre,
      ao.nombre AS ubicacion_origen,
      ad.nombre AS ubicacion_destino
    FROM movimientos m
    JOIN usuarios u ON m.usuario_id = u.id
    JOIN detalle_movimientos d ON d.movimiento_id = m.id
    JOIN articulos a ON d.articulo_id = a.id
    LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
    LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
    WHERE m.id = $1
    ORDER BY d.id ASC`,
    [movimientoId]
  );

  return result.rows;
};

// ============================================
// EXPORTAR INVENTARIO (EXCEL)
// ============================================

const TIPO_LABELS = {
  equipo: 'Equipo', placa_balistica: 'Placa Balística',
  arma: 'Arma', radio: 'Radio', otro: 'Otro',
};
const ESTADO_LABELS = {
  vencida: 'Vencida', proxima_a_vencer: 'Próxima a vencer', vigente: 'Vigente',
};

const exportArticulosExcel = async (req, res) => {
  try {
    const { tipo, ubicacion_id, estado, search } = req.query;
    const normalizedEstado = estado ? String(estado).trim().toLowerCase() : '';
    if (estado && !ALERTA_ESTADOS.has(normalizedEstado)) {
      throw createHttpError(400, 'El filtro estado no es válido');
    }
    const { query, params } = buildInventarioAlertasQuery({
      tipo, ubicacion_id, search,
      estado: estado ? normalizedEstado : undefined,
    });

    const result = await db.query(query, params);

    const { workbook, worksheet } = createWorkbook('Inventario', [
      { header: 'Tipo',          key: 'tipo',            width: 16 },
      { header: 'Artículo',      key: 'nombre',          width: 28 },
      { header: 'Serie',         key: 'serie',           width: 18 },
      { header: 'Cantidad',      key: 'cantidad',        width: 10 },
      { header: 'Talla',         key: 'talla',           width: 10 },
      { header: 'Marca',         key: 'marca',           width: 16 },
      { header: 'Modelo',        key: 'modelo',          width: 16 },
      { header: 'Calibre',       key: 'calibre',         width: 12 },
      { header: 'Cód. Pantalla', key: 'codigo_pantalla', width: 16 },
      { header: 'Versión',       key: 'version',         width: 14 },
      { header: 'Caducidad',     key: 'caducidad',       width: 14 },
      { header: 'Ubicación',     key: 'ubicacion',       width: 20 },
      { header: 'Estado',        key: 'estado',          width: 16 },
    ]);

    result.rows.forEach((row) => worksheet.addRow({
      tipo:            TIPO_LABELS[row.tipo_articulo] ?? row.tipo_articulo ?? '',
      nombre:          row.nombre_articulo || '',
      serie:           getArticuloSerie(row) || '',
      cantidad:        row.cantidad || '',
      talla:           row.talla || '',
      marca:           row.marca || '',
      modelo:          row.modelo || '',
      calibre:         row.calibre || '',
      codigo_pantalla: row.codigo_pantalla || '',
      version:         row.version || '',
      caducidad:       row.fecha_caducidad ? new Date(row.fecha_caducidad).toLocaleDateString('es-EC') : '',
      ubicacion:       row.ubicacion_nombre || '',
      estado:          ESTADO_LABELS[row.estado_caducidad] ?? 'Sin alerta',
    }));

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'inventario.xlsx');
  } catch (error) {
    console.error('Error al exportar inventario:', error);
    res.status(500).json({ success: false, message: 'Error al exportar Excel' });
  }
};

const exportMovimientosExcel = async (req, res) => {
  try {
    const { from, to, destino_id } = req.query;
    const { query, params } = buildMovimientosReporteQuery({ from, to, destino_id });
    const result = await db.query(query, params);

    const { workbook, worksheet } = createWorkbook('Movimientos', [
      { header: 'Fecha',          key: 'fecha',     width: 14 },
      { header: 'Cant. Artíc.',   key: 'items',     width: 14 },
      { header: 'Artículos',      key: 'articulos', width: 40 },
      { header: 'Origen',         key: 'origen',    width: 24 },
      { header: 'Destino',        key: 'destino',   width: 24 },
      { header: 'Usuario',        key: 'usuario',   width: 18 },
    ]);

    result.rows.forEach((row) => worksheet.addRow({
      fecha:     row.fecha_movimiento ? new Date(row.fecha_movimiento).toLocaleDateString('es-EC') : '',
      items:     row.items || 0,
      articulos: row.articulos_movidos || '',
      origen:    row.ubicacion_origen || '',
      destino:   row.ubicacion_destino || '',
      usuario:   row.usuario || '',
    }));

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'movimientos-inventario.xlsx');
  } catch (error) {
    console.error('Error al exportar movimientos:', error);
    res.status(500).json({ success: false, message: 'Error al exportar movimientos' });
  }
};

const generateMovimientoPdf = async (movimientoId) => {
  const detalles = await getMovimientoDataForPdf(movimientoId);
  if (!detalles.length) {
    return null;
  }

  const fechaMovimiento = detalles[0].fecha_movimiento;
  const usuario = detalles[0].usuario || 'N/A';
  const ubicacionDestino = detalles[0].ubicacion_destino || 'N/A';

  const storageDir = path.join(__dirname, '..', 'storage', 'movimientos');
  fs.mkdirSync(storageDir, { recursive: true });
  const filename = `movimiento-${movimientoId}.pdf`;
  const fullPath = path.join(storageDir, filename);

  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);

  // Header with optional logo
  const logoPath = path.join(__dirname, '..', 'assets', 'wes-logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 480, 25, { width: 70 });
  }
  doc.fontSize(18).text('Movimiento de Inventario', { align: 'center' });
  doc.moveDown(1.8);

  // Movement info
  doc.fontSize(11);
  const infoLeft = 60;
  doc.text(`Movimiento realizado por: ${usuario}`, infoLeft);
  doc.text(`Fecha del movimiento: ${new Date(fechaMovimiento).toLocaleDateString('es-EC')}`, infoLeft);
  doc.text(`Ubicación destino: ${ubicacionDestino}`, infoLeft);
  doc.moveDown();

  // Table header
  const tableTop = doc.y + 5;
  const colQty = 40;
  const colItem = 110;
  const colSerial = 360;
  const colOrigin = 470;

  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('Cantidad', colQty, tableTop);
  doc.text('Artículo', colItem, tableTop);
  doc.text('Serie', colSerial, tableTop);
  doc.text('Ubicación actual', colOrigin, tableTop);
  doc.moveTo(40, tableTop + 15).lineTo(555, tableTop + 15).stroke();

  doc.font('Helvetica');
  let rowY = tableTop + 25;
  detalles.forEach((item) => {
    const qty = item.cantidad || 1;
    const name = item.nombre_articulo || 'Artículo';
    const serial = getArticuloSerie(item) || '-';
    const origin = item.ubicacion_origen || '-';
    doc.text(String(qty), colQty, rowY);
    doc.text(name, colItem, rowY, { width: 240 });
    doc.text(serial, colSerial, rowY, { width: 90 });
    doc.text(origin, colOrigin, rowY, { width: 120 });
    rowY += 18;
  });

  doc.moveDown(2);

  // Signature boxes
  const lineWidth = 220;
  const signatureTop = doc.page.height - 90;
  const pageCenter = doc.page.width / 2;
  const gapBetween = 40;
  const leftLineStart = pageCenter - gapBetween / 2 - lineWidth;
  const rightLineStart = pageCenter + gapBetween / 2;

  doc.moveTo(leftLineStart, signatureTop).lineTo(leftLineStart + lineWidth, signatureTop).stroke();
  doc.moveTo(rightLineStart, signatureTop).lineTo(rightLineStart + lineWidth, signatureTop).stroke();

  doc.fontSize(10).text(
    'Firma de quien realiza',
    leftLineStart,
    signatureTop + 6,
    { width: lineWidth, align: 'center' }
  );
  doc.text(
    'Firma de quien recibe',
    rightLineStart,
    signatureTop + 6,
    { width: lineWidth, align: 'center' }
  );

  doc.end();

  await new Promise((resolve) => stream.on('finish', resolve));

  const relativePath = path.join('storage', 'movimientos', filename);
  return { fullPath, relativePath };
};

const createMovimiento = async (req, res) => {
  const client = await db.getClient();
  let transactionStarted = false;
  try {
    const { ubicacion_destino_id, ubicacion_destino_nombre, items, fecha_movimiento } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes agregar al menos un artículo'
      });
    }

    let destinoId = ubicacion_destino_id;
    const destinoNombre = ubicacion_destino_nombre ? String(ubicacion_destino_nombre).trim() : '';

    if (!destinoId && destinoNombre) {
      const existente = await client.query(
        'SELECT id FROM ubicaciones WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
        [destinoNombre]
      );
      if (existente.rowCount > 0) {
        destinoId = existente.rows[0].id;
      } else {
        const creado = await client.query(
          'INSERT INTO ubicaciones (nombre) VALUES ($1) RETURNING id',
          [destinoNombre]
        );
        destinoId = creado.rows[0].id;
      }
    }

    if (!destinoId) {
      return res.status(400).json({
        success: false,
        message: 'La ubicación destino es requerida para traslados'
      });
    }

    destinoId = Number(destinoId);
    if (!Number.isInteger(destinoId) || destinoId <= 0) {
      throw createHttpError(400, 'La ubicación destino es inválida');
    }

    await client.query('BEGIN');
    transactionStarted = true;

    const movimientoRes = await client.query(
      `INSERT INTO movimientos (usuario_id, fecha_movimiento)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE))
       RETURNING id, fecha_movimiento`,
      [req.user.id, fecha_movimiento || null]
    );

    const movimientoId = movimientoRes.rows[0].id;

    for (const item of items) {
      const articuloId = Number(item?.articulo_id);
      if (!Number.isInteger(articuloId) || articuloId <= 0) {
        throw createHttpError(400, 'Artículo inválido');
      }

      const articuloRes = await client.query(
        'SELECT id, tipo_articulo, nombre_articulo, cantidad, talla, marca, modelo, numero_serie, calibre, fecha_caducidad, ubicacion_id FROM articulos WHERE id = $1',
        [articuloId]
      );

      if (articuloRes.rowCount === 0) {
        throw createHttpError(400, `Artículo #${articuloId} no encontrado`);
      }

      const articulo = articuloRes.rows[0];
      const cantidad = item.cantidad === undefined ? 1 : Number(item.cantidad);
      const tallaMovimiento = item.talla ? String(item.talla).trim() : '';
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw createHttpError(400, 'Cantidad inválida');
      }

      if (!isStockTipo(articulo.tipo_articulo) && cantidad > 1) {
        throw createHttpError(400, 'La cantidad debe ser 1 para artículos serializados');
      }

      const origenArticuloId = articulo.ubicacion_id;
      if (!origenArticuloId) {
        throw createHttpError(400, 'El artículo no tiene ubicación origen');
      }
      if (String(origenArticuloId) === String(destinoId)) {
        throw createHttpError(400, 'El destino no puede ser igual al origen del artículo');
      }

      let movedArticuloId = articulo.id;

      if (isStockTipo(articulo.tipo_articulo)) {
        if (articulo.talla && !tallaMovimiento) {
          throw createHttpError(400, 'Debes indicar la talla del artículo');
        }
        if (articulo.talla && tallaMovimiento && articulo.talla !== tallaMovimiento) {
          throw createHttpError(400, 'La talla indicada no coincide con el artículo');
        }
        const actual = articulo.cantidad || 0;
        if (cantidad > actual) {
          throw createHttpError(400, 'Cantidad supera el stock disponible');
        }
        if (cantidad < actual && articulo.numero_serie) {
          throw createHttpError(400, 'No se puede fraccionar un artículo con número de serie');
        }
        if (cantidad < actual) {
          const tallaFinal = tallaMovimiento || articulo.talla || null;
          const insertRes = await client.query(
            `INSERT INTO articulos (
              tipo_articulo,
              nombre_articulo,
              cantidad,
              talla,
              marca,
              modelo,
              numero_serie,
              calibre,
              fecha_caducidad,
              ubicacion_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING id`,
            [
              articulo.tipo_articulo,
              articulo.nombre_articulo,
              cantidad,
              tallaFinal,
              articulo.marca,
              articulo.modelo,
              articulo.numero_serie,
              articulo.calibre,
              articulo.fecha_caducidad,
              destinoId
            ]
          );
          await client.query(
            'UPDATE articulos SET cantidad = $1 WHERE id = $2',
            [actual - cantidad, articulo.id]
          );
          movedArticuloId = insertRes.rows[0].id;
        } else {
          await client.query(
            'UPDATE articulos SET ubicacion_id = $1 WHERE id = $2',
            [destinoId, articulo.id]
          );
        }
      } else {
        if (cantidad !== 1) {
          throw createHttpError(400, 'La cantidad debe ser 1 para artículos serializados');
        }
        await client.query(
          'UPDATE articulos SET ubicacion_id = $1 WHERE id = $2',
          [destinoId, articulo.id]
        );
      }

      await client.query(
        `INSERT INTO detalle_movimientos (
          movimiento_id,
          articulo_id,
          cantidad,
          ubicacion_origen_id,
          ubicacion_destino_id
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          movimientoId,
          movedArticuloId,
          cantidad,
          origenArticuloId,
          destinoId
        ]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;

    const pdfResult = await generateMovimientoPdf(movimientoId);
    if (pdfResult) {
      await db.query(
        'UPDATE movimientos SET pdf_path = $1 WHERE id = $2',
        [pdfResult.relativePath, movimientoId]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Movimiento registrado exitosamente',
      data: {
        id: movimientoId,
        pdf_path: pdfResult?.relativePath || null
      }
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error al hacer rollback de createMovimiento:', rollbackError);
      }
    }

    const status = error.status || (isConstraintOrInputError(error) ? 400 : 500);
    const message = status >= 500 ? 'Error en el servidor' : (error.message || 'Solicitud inválida');
    console.error('Error al crear movimiento:', error);

    res.status(status).json({
      success: false,
      message
    });
  } finally {
    client.release();
  }
};

const downloadMovimientoPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT pdf_path FROM movimientos WHERE id = $1', [id]);
    if (result.rowCount === 0 || !result.rows[0].pdf_path) {
      return res.status(404).json({
        success: false,
        message: 'PDF no encontrado'
      });
    }

    const relativePath = result.rows[0].pdf_path;
    const fullPath = path.resolve(__dirname, '..', relativePath);
    const baseDir = path.resolve(__dirname, '..', 'storage', 'movimientos');
    if (!fullPath.startsWith(baseDir)) {
      return res.status(400).json({
        success: false,
        message: 'Ruta inválida'
      });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=movimiento-${id}.pdf`);
    return res.sendFile(fullPath);
  } catch (error) {
    console.error('Error al descargar PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

module.exports = {
  getUbicaciones,
  getArticulos,
  createArticulo,
  updateArticulo,
  deleteArticulo,
  getMovimientos,
  createMovimiento,
  downloadMovimientoPdf,
  exportArticulosExcel,
  exportMovimientosExcel
};
