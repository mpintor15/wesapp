import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './ChangePassword.css';

const ChangePassword = () => {
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { changePassword, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nuevaPassword || !confirmarPassword) {
      showToast('Ambas contraseñas son requeridas', 'error');
      return;
    }
    if (nuevaPassword.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    setLoading(true);
    const result = await changePassword(nuevaPassword, confirmarPassword);
    setLoading(false);

    if (result.success) {
      showToast('Contraseña actualizada exitosamente', 'success');
      navigate('/');
    } else {
      showToast(result.message || 'Error al cambiar contraseña', 'error');
    }
  };

  return (
    <div className="change-password-container">
      <div className="change-password-box">
        <div className="change-password-header">
          <h1>Actualizar Contraseña</h1>
          <p>Bienvenido, {user?.usuario}</p>
          <p className="info-text">
            Por seguridad, debes cambiar tu contraseña en el primer inicio de sesión.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="change-password-form">
          <div className="form-group">
            <label htmlFor="nueva-password">Nueva Contraseña</label>
            <input
              type="password"
              id="nueva-password"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Ingrese su nueva contraseña"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmar-password">Confirmar Contraseña</label>
            <input
              type="password"
              id="confirmar-password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="Confirme su nueva contraseña"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-change-password" disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
