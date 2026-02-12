const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

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
        calibre ILIKE $${params.length}
      )`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

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

const isValidTipo = (tipo) => ['equipo', 'placa_balistica', 'arma'].includes(tipo);

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
      ubicacion_nombre
    } = req.body;

    if (!tipo_articulo || !isValidTipo(tipo_articulo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de articulo inválido'
      });
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
        ubicacion_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, tipo_articulo, nombre_articulo, cantidad, talla, marca, modelo, numero_serie, calibre, fecha_caducidad, ubicacion_id`,
      [
        tipo_articulo,
        normalizeEmpty(nombre_articulo),
        cantidad ? parseInt(cantidad, 10) : (tipo_articulo !== 'equipo' ? 1 : null),
        normalizeEmpty(talla),
        normalizeEmpty(marca),
        normalizeEmpty(modelo),
        normalizeEmpty(numero_serie),
        normalizeEmpty(calibre),
        normalizeEmpty(fecha_caducidad),
        parseInt(ubicacionId, 10)
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
        message: 'Ya existe un artículo con ese número de serie'
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
      'ubicacion_id'
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
        message: 'Ya existe un artículo con ese número de serie'
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

    if (articulo.tipo_articulo === 'equipo' && articulo.cantidad && articulo.cantidad > 1) {
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
        COUNT(d.id) AS items,
        CASE
          WHEN BOOL_AND(d.ubicacion_origen_id IS NULL) THEN 'entrada'
          WHEN BOOL_AND(d.ubicacion_destino_id IS NULL) THEN 'salida'
          ELSE 'traslado'
        END AS tipo_movimiento,
        CASE
          WHEN COUNT(DISTINCT d.ubicacion_origen_id) = 1 THEN MAX(ao.nombre)
          ELSE NULL
        END AS ubicacion_origen,
        CASE
          WHEN COUNT(DISTINCT d.ubicacion_destino_id) = 1 THEN MAX(ad.nombre)
          ELSE NULL
        END AS ubicacion_destino
      FROM movimientos m
      LEFT JOIN detalle_movimientos d ON d.movimiento_id = m.id
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

const getMovimientoDetalles = async (req, res) => {
  try {
    const { id } = req.params;

    const hasActivoColumn = await db.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'articulos' AND column_name = 'activo'
       LIMIT 1`
    );

    const activoSelect = hasActivoColumn.rowCount > 0 ? 'a.activo' : 'TRUE AS activo';

    const result = await db.query(
      `SELECT 
        d.id,
        d.cantidad,
        a.id AS articulo_id,
        a.tipo_articulo,
        a.nombre_articulo,
        a.numero_serie,
        a.marca,
        a.modelo,
        a.calibre,
        ${activoSelect},
        ao.nombre AS ubicacion_origen,
        ad.nombre AS ubicacion_destino
      FROM detalle_movimientos d
      JOIN articulos a ON d.articulo_id = a.id
      LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
      LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
      WHERE d.movimiento_id = $1
      ORDER BY d.id ASC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener detalles del movimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
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

const determineTipoMovimiento = () => 'traslado';

// ============================================
// EXPORTAR INVENTARIO (EXCEL)
// ============================================

const exportArticulosExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { tipo, ubicacion_id, estado, search } = req.query;

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
        calibre ILIKE $${params.length}
      )`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    const data = result.rows;

    const tipoLabel = (tipoValue) => {
      switch (tipoValue) {
        case 'equipo': return 'Equipo';
        case 'placa_balistica': return 'Placa Balística';
        case 'arma': return 'Arma';
        default: return tipoValue || '';
      }
    };

    const estadoLabel = (estadoValue) => {
      switch (estadoValue) {
        case 'vencida': return 'Vencida';
        case 'proxima_a_vencer': return 'Próxima a vencer';
        case 'vigente': return 'Vigente';
        default: return 'Sin alerta';
      }
    };

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario');

    worksheet.columns = [
      { header: 'Tipo', key: 'tipo', width: 16 },
      { header: 'Artículo', key: 'nombre', width: 28 },
      { header: 'Serie', key: 'serie', width: 18 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Talla', key: 'talla', width: 10 },
      { header: 'Marca', key: 'marca', width: 16 },
      { header: 'Modelo', key: 'modelo', width: 16 },
      { header: 'Calibre', key: 'calibre', width: 12 },
      { header: 'Caducidad', key: 'caducidad', width: 14 },
      { header: 'Ubicación', key: 'ubicacion', width: 20 },
      { header: 'Estado', key: 'estado', width: 16 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF2519' }
    };

    data.forEach(row => {
      worksheet.addRow({
        tipo: tipoLabel(row.tipo_articulo),
        nombre: row.nombre_articulo || '',
        serie: row.numero_serie || '',
        cantidad: row.cantidad || '',
        talla: row.talla || '',
        marca: row.marca || '',
        modelo: row.modelo || '',
        calibre: row.calibre || '',
        caducidad: row.fecha_caducidad ? new Date(row.fecha_caducidad).toLocaleDateString('es-EC') : '',
        ubicacion: row.ubicacion_nombre || '',
        estado: estadoLabel(row.estado_caducidad)
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventario.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar inventario:', error);
    res.status(500).json({ success: false, message: 'Error al exportar Excel' });
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
    const serial = item.numero_serie || '-';
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
  try {
    const { ubicacion_destino_id, ubicacion_destino_nombre, items } = req.body;

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

    await client.query('BEGIN');

    const movimientoRes = await client.query(
      `INSERT INTO movimientos (usuario_id, fecha_movimiento)
       VALUES ($1, $2)
       RETURNING id, fecha_movimiento`,
      [req.user.id, new Date()]
    );

    const movimientoId = movimientoRes.rows[0].id;

    for (const item of items) {
      const articuloId = item.articulo_id;
      if (!articuloId) {
        throw new Error('Artículo inválido');
      }

      const articuloRes = await client.query(
        'SELECT id, tipo_articulo, nombre_articulo, cantidad, talla, marca, modelo, numero_serie, calibre, fecha_caducidad, ubicacion_id FROM articulos WHERE id = $1',
        [articuloId]
      );

      if (articuloRes.rowCount === 0) {
        throw new Error('Artículo no encontrado');
      }

      const articulo = articuloRes.rows[0];
      let cantidad = item.cantidad ? parseInt(item.cantidad, 10) : 1;
      const tallaMovimiento = item.talla ? String(item.talla).trim() : '';
      if (!cantidad || cantidad <= 0) {
        throw new Error('Cantidad inválida');
      }

      if (articulo.tipo_articulo !== 'equipo' && cantidad > 1) {
        throw new Error('La cantidad debe ser 1 para artículos serializados');
      }

      const origenArticuloId = articulo.ubicacion_id;
      if (!origenArticuloId) {
        throw new Error('El artículo no tiene ubicación origen');
      }
      if (String(origenArticuloId) === String(destinoId)) {
        throw new Error('El destino no puede ser igual al origen del artículo');
      }

      let movedArticuloId = articulo.id;

      if (articulo.tipo_articulo === 'equipo') {
        if (articulo.talla && !tallaMovimiento) {
          throw new Error('Debes indicar la talla del artículo');
        }
        if (articulo.talla && tallaMovimiento && articulo.talla !== tallaMovimiento) {
          throw new Error('La talla indicada no coincide con el artículo');
        }
        const actual = articulo.cantidad || 0;
        if (cantidad > actual) {
          throw new Error('Cantidad supera el stock disponible');
        }
        if (cantidad < actual && articulo.numero_serie) {
          throw new Error('No se puede fraccionar un artículo con número de serie');
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
          throw new Error('La cantidad debe ser 1 para artículos serializados');
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
    await client.query('ROLLBACK');
    const message = error.message || 'Error en el servidor';
    console.error('Error al crear movimiento:', error);
    res.status(400).json({
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
  getMovimientoDetalles,
  createMovimiento,
  downloadMovimientoPdf,
  exportArticulosExcel
};
