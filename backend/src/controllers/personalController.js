/**
 * personalController.js — Controlador del módulo de Personal
 *
 * Gestiona el registro de colaboradores de la organización:
 *
 *  - getColaboradores      : Lista colaboradores con filtros de búsqueda,
 *                            estado (activo/inactivo) y cargo.
 *  - createColaborador     : Registra un nuevo colaborador con sus datos
 *                            personales, laborales y bancarios. La cédula
 *                            debe ser única en el sistema.
 *  - updateColaborador     : Actualiza campos permitidos de un colaborador.
 *                            Solo modifica los campos que se envían en el body.
 *  - deleteColaborador     : Elimina permanentemente un colaborador por ID.
 *  - exportColaboradoresExcel : Genera y descarga la lista de colaboradores
 *                              (con los mismos filtros) en formato .xlsx.
 */
const db = require('../config/database');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');
const { logAudit, auditFromReq } = require('../utils/audit');
const {
  parseStrictPositiveNumber,
  validateRequiredDateString,
} = require('../utils/inputValidation');
const ESTADOS_COLABORADOR = new Set(['activo', 'inactivo']);

const buildColaboradoresQuery = ({ search, estado, cargo }) => {
  let query = 'SELECT * FROM colaboradores';
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      nombres_completos ILIKE $${params.length}
      OR cedula ILIKE $${params.length}
      OR celular ILIKE $${params.length}
      OR numero_cuenta ILIKE $${params.length}
    )`);
  }

  if (estado) {
    params.push(estado);
    conditions.push(`estado = $${params.length}`);
  }

  if (cargo) {
    params.push(cargo);
    conditions.push(`cargo ILIKE $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY nombres_completos ASC';
  return { query, params };
};

// ============================================
// COLABORADORES
// ============================================

const getColaboradores = async (req, res) => {
  try {
    const { search, estado, cargo } = req.query;
    const estadoNormalizado = estado ? String(estado).trim().toLowerCase() : '';
    if (estado && !ESTADOS_COLABORADOR.has(estadoNormalizado)) {
      throw createHttpError(400, 'El filtro estado debe ser activo o inactivo');
    }
    const { query, params } = buildColaboradoresQuery({
      search,
      estado: estado ? estadoNormalizado : undefined,
      cargo,
    });

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener colaboradores:');
  }
};

const createColaborador = async (req, res) => {
  try {
    const {
      nombres_completos,
      cedula,
      fecha_nacimiento,
      cargo,
      celular,
      banco,
      numero_cuenta,
      sueldo,
      estado,
    } = req.body;
    const estadoNormalizado = estado ? String(estado).trim().toLowerCase() : 'activo';

    if (!nombres_completos || !cedula || !fecha_nacimiento || !cargo) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: nombres_completos, cedula, fecha_nacimiento, cargo',
      });
    }

    if (!ESTADOS_COLABORADOR.has(estadoNormalizado)) {
      throw createHttpError(400, 'El estado debe ser activo o inactivo');
    }

    const fechaValidation = validateRequiredDateString(
      fecha_nacimiento,
      'La fecha de nacimiento no es válida'
    );
    if (!fechaValidation.valid) {
      throw createHttpError(fechaValidation.status, fechaValidation.message);
    }

    const sueldoNormalizado =
      sueldo === undefined || sueldo === null || sueldo === ''
        ? null
        : parseStrictPositiveNumber(sueldo, 'El sueldo no es válido');

    if (sueldoNormalizado !== null && !sueldoNormalizado.valid) {
      throw createHttpError(sueldoNormalizado.status, sueldoNormalizado.message);
    }

    const result = await db.query(
      `INSERT INTO colaboradores (
        nombres_completos,
        cedula,
        fecha_nacimiento,
        cargo,
        celular,
        banco,
        numero_cuenta,
        sueldo,
        estado
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        nombres_completos.trim(),
        cedula.trim(),
        fecha_nacimiento,
        cargo.trim(),
        celular || null,
        banco || null,
        numero_cuenta || null,
        sueldoNormalizado ? sueldoNormalizado.value : null,
        estadoNormalizado,
      ]
    );

    await logAudit(db, {
      tabla: 'colaboradores',
      operacion: 'INSERT',
      registro_id: String(result.rows[0].id),
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    res.status(201).json({
      success: true,
      message: 'Colaborador creado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'La cédula ya está registrada',
      });
    }
    return handleControllerError(res, error, 'Error al crear colaborador:');
  }
};

const updateColaborador = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del colaborador es inválido');

    const allowedFields = [
      'nombres_completos',
      'cedula',
      'fecha_nacimiento',
      'cargo',
      'celular',
      'banco',
      'numero_cuenta',
      'sueldo',
      'estado',
    ];

    const updates = [];
    const values = [];

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        let value = req.body[field];
        if (field === 'sueldo' && value !== null && value !== undefined && value !== '') {
          const sueldoValidation = parseStrictPositiveNumber(value, 'El sueldo no es válido');
          if (!sueldoValidation.valid) {
            throw createHttpError(sueldoValidation.status, sueldoValidation.message);
          }
          value = sueldoValidation.value;
        }
        if (typeof value === 'string') {
          value = value.trim();
        }
        if (field === 'estado' && value !== null && value !== undefined && value !== '') {
          value = String(value).toLowerCase();
          if (!ESTADOS_COLABORADOR.has(value)) {
            throw createHttpError(400, 'El estado debe ser activo o inactivo');
          }
        }
        if (field === 'fecha_nacimiento' && value !== null && value !== undefined && value !== '') {
          const fechaValidation = validateRequiredDateString(
            value,
            'La fecha de nacimiento no es válida'
          );
          if (!fechaValidation.valid) {
            throw createHttpError(fechaValidation.status, fechaValidation.message);
          }
        }
        updates.push(`${field} = $${values.length + 1}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar',
      });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE colaboradores SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Colaborador no encontrado' });
    }

    await logAudit(db, {
      tabla: 'colaboradores',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    res.json({
      success: true,
      message: 'Colaborador actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'La cédula ya está registrada',
      });
    }
    return handleControllerError(res, error, 'Error al actualizar colaborador:');
  }
};

const deleteColaborador = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del colaborador es inválido');

    const result = await db.query('DELETE FROM colaboradores WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Colaborador no encontrado' });
    }

    await logAudit(db, {
      tabla: 'colaboradores',
      operacion: 'DELETE',
      registro_id: String(id),
      datos_anteriores: result.rows[0],
      ...auditFromReq(req),
    });

    res.json({ success: true, message: 'Colaborador eliminado exitosamente' });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar colaborador:');
  }
};

const exportColaboradoresExcel = async (req, res) => {
  try {
    const { search, estado, cargo } = req.query;
    const estadoNormalizado = estado ? String(estado).trim().toLowerCase() : '';
    if (estado && !ESTADOS_COLABORADOR.has(estadoNormalizado)) {
      throw createHttpError(400, 'El filtro estado debe ser activo o inactivo');
    }
    const { query, params } = buildColaboradoresQuery({
      search,
      estado: estado ? estadoNormalizado : undefined,
      cargo,
    });

    const result = await db.query(query, params);

    const { workbook, worksheet } = createWorkbook('Colaboradores', [
      { header: 'Nombres', key: 'nombres_completos', width: 30 },
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Fecha Nacimiento', key: 'fecha_nacimiento', width: 16 },
      { header: 'Cargo', key: 'cargo', width: 20 },
      { header: 'Celular', key: 'celular', width: 15 },
      { header: 'Banco', key: 'banco', width: 20 },
      { header: 'Cuenta', key: 'numero_cuenta', width: 20 },
      { header: 'Sueldo', key: 'sueldo', width: 14, numFmt: '$#,##0.00' },
      { header: 'Estado', key: 'estado', width: 12 },
    ]);

    result.rows.forEach((row) =>
      worksheet.addRow({
        nombres_completos: row.nombres_completos,
        cedula: row.cedula,
        fecha_nacimiento: row.fecha_nacimiento
          ? new Date(row.fecha_nacimiento).toLocaleDateString('es-EC')
          : '',
        cargo: row.cargo,
        celular: row.celular || '',
        banco: row.banco || '',
        numero_cuenta: row.numero_cuenta || '',
        sueldo: row.sueldo ? Number.parseFloat(row.sueldo) : '',
        estado: row.estado,
      })
    );

    worksheet.getColumn('sueldo').numFmt = '$#,##0.00';
    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'colaboradores.xlsx');
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar colaboradores:');
  }
};

module.exports = {
  getColaboradores,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  exportColaboradoresExcel,
};
