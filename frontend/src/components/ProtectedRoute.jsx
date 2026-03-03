import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ProtectedRoute.css';

/**
 * Componente para proteger rutas que requieren autenticación
 */
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { isAuthenticated, user, loading, hasPermission } = useAuth();

  // Mostrar loader mientras verifica autenticación
  if (loading) {
    return (
      <div className="protected-route-loader">
        <p>Cargando...</p>
      </div>
    );
  }

  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si es primer login, redirigir a cambiar contraseña
  if (user?.primer_login && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Si requiere un permiso específico y no lo tiene, mostrar error
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="protected-route-denied">
        <h1>Acceso Denegado</h1>
        <p>No tienes permisos para acceder a esta sección.</p>
        <button onClick={() => window.history.back()}>Volver</button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
