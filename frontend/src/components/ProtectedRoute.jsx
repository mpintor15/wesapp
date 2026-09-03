import React from 'react';
import PropTypes from 'prop-types';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/branding/logo_hexagono.png';
import './ProtectedRoute.css';

const ProtectedRoute = ({ children, requiredPermission = undefined }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="app-splash">
        <div className="app-splash-card">
          <img
            src={logo}
            alt="WES Security Cía. Ltda."
            className="app-splash-logo"
            width="1187"
            height="922"
          />
          <span className="spinner app-splash-spinner" />
          <p className="app-splash-text">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si es primer login, redirigir a cambiar contraseña
  if (user?.primer_login && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Si requiere permiso específico o lista any y no lo tiene, mostrar error
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="protected-route-denied">
        <h1>Acceso Denegado</h1>
        <p>No tienes permisos para acceder a esta sección.</p>
        <button onClick={() => navigate(-1)}>Volver</button>
      </div>
    );
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredPermission: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
};

export default ProtectedRoute;
