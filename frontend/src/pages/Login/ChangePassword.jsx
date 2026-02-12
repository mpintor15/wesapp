import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './ChangePassword.css';

const ChangePassword = () => {
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validaciones
    if (!nuevaPassword || !confirmarPassword) {
      setError('Ambas contraseñas son requeridas');
      return;
    }
    
    if (nuevaPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    
    setLoading(true);
    
    const result = await changePassword(nuevaPassword, confirmarPassword);
    
    setLoading(false);
    
    if (result.success) {
      alert('Contraseña actualizada exitosamente');
      navigate('/');
    } else {
      setError(result.message || 'Error al cambiar contraseña');
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
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn-change-password"
            disabled={loading}
          >
            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;