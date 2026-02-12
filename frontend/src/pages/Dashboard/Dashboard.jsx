import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';
import logo from '../../assets/icons/wes-logo.png';
import iconCuentas from '../../assets/icons/invoice.png';
import iconInventario from '../../assets/icons/inventory.png';
import iconPersonal from '../../assets/icons/audience.png';
import iconUsuarios from '../../assets/icons/user.png';

const Dashboard = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-logo">
          <img src={logo} alt="WES Security" />
        </div>
        <div className="user-info">
          <span>Usuario: <strong>{user?.usuario}</strong></span>
          <button onClick={handleLogout} className="btn-logout">
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <h2>Bienvenido al sistema de control de WES Security</h2>
        <p>Seleccione un módulo:</p>

        <div className="modules-grid">
          {hasPermission('cuentas') && (
            <div className="module-card" onClick={() => navigate('/cuentas')}>
              <div className="module-card-header centered">
                <img src={iconCuentas} alt="Cuentas" className="module-icon" />
                <h3>Cuentas</h3>
              </div>
            </div>
          )}

          {hasPermission('inventario') && (
            <div className="module-card" onClick={() => navigate('/inventario')}>
              <div className="module-card-header centered">
                <img src={iconInventario} alt="Inventario" className="module-icon" />
                <h3>Inventario</h3>
              </div>
            </div>
          )}

          {hasPermission('personal') && (
            <div className="module-card" onClick={() => navigate('/personal')}>
              <div className="module-card-header centered">
                <img src={iconPersonal} alt="Personal" className="module-icon" />
                <h3>Personal</h3>
              </div>
            </div>
          )}

          {hasPermission('usuarios') && (
            <div className="module-card" onClick={() => navigate('/usuarios')}>
              <div className="module-card-header centered">
                <img src={iconUsuarios} alt="Usuarios" className="module-icon" />
                <h3>Usuarios</h3>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
