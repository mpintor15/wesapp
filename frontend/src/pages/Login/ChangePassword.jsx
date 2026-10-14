import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './ChangePassword.css';

const EyeIcon = ({ hidden }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {hidden ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const PasswordInput = ({ id, value, onChange, placeholder, disabled }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="change-password-input-wrap">
      <input
        type={visible ? 'text' : 'password'}
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="new-password"
      />
      <button
        type="button"
        className="change-password-eye"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
      >
        <EyeIcon hidden={!visible} />
      </button>
    </div>
  );
};

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
    if (!/[A-Za-z]/.test(nuevaPassword) || !/\d/.test(nuevaPassword)) {
      showToast('La contraseña debe incluir letras y números', 'error');
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
            <PasswordInput
              id="nueva-password"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Ingrese su nueva contraseña"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmar-password">Confirmar Contraseña</label>
            <PasswordInput
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
