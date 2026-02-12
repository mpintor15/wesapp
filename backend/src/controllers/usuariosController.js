const bcrypt = require('bcrypt');
const db = require('../config/database');
const config = require('../config/config');

// ============================================
// USUARIOS
// ============================================

const getUsuarios = async (req, res) => {
  try {
    const { search, tipo_usuario, activo } = req.query;
    let query = 'SELECT id, usuario, tipo_usuario, primer_login, activo, created_at FROM usuarios';
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`usuario ILIKE $${params.length}`);
    }

    if (tipo_usuario) {
      params.push(tipo_usuario);
      conditions.push(`tipo_usuario = $${params.length}`);
    }

    if (activo === 'true' || activo === 'false') {
      params.push(activo === 'true');
      conditions.push(`activo = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY usuario ASC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
};

const createUsuario = async (req, res) => {
  try {
    const { usuario, password, tipo_usuario } = req.body;

    if (!usuario || !tipo_usuario) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y tipo de usuario son requeridos'
      });
    }

    const allowedTypes = ['gerente', 'secretario', 'supervisor', 'contador'];
    if (!allowedTypes.includes(tipo_usuario)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de usuario inválido'
      });
    }

    const rawPassword = password && password.length >= 6 ? password : 'password123';
    const password_hash = await bcrypt.hash(rawPassword, 10);

    const result = await db.query(
      `INSERT INTO usuarios (usuario, password_hash, tipo_usuario, primer_login, activo)
       VALUES ($1, $2, $3, TRUE, TRUE)
       RETURNING id, usuario, tipo_usuario, primer_login, activo`,
      [usuario.trim(), password_hash, tipo_usuario]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya existe'
      });
    }
    console.error('Error al crear usuario:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
};

const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo_usuario, activo } = req.body;
    const updates = [];
    const values = [];

    if (tipo_usuario) {
      const allowedTypes = ['gerente', 'secretario', 'supervisor', 'contador'];
      if (!allowedTypes.includes(tipo_usuario)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de usuario inválido'
        });
      }
      updates.push(`tipo_usuario = $${values.length + 1}`);
      values.push(tipo_usuario);
    }

    if (typeof activo === 'boolean') {
      updates.push(`activo = $${values.length + 1}`);
      values.push(activo);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE usuarios SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, usuario, tipo_usuario, primer_login, activo`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
};

module.exports = {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario
};
