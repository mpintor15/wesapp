import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import './Dashboard.css';
import logo from '../../assets/icons/wes-logo.png';
import iconCuentas from '../../assets/icons/invoice.png';
import iconInventario from '../../assets/icons/inventory.png';
import iconPersonal from '../../assets/icons/audience.png';
import iconUsuarios from '../../assets/icons/user.png';

const MODULE_META = {
  cuentas:    { description: 'Control de facturas, pagos y clientes' },
  inventario: { description: 'Artículos, equipos y movimientos de bodega' },
  personal:   { description: 'Colaboradores, cargos y nómina' },
  usuarios:   { description: 'Cuentas de acceso y permisos del sistema' },
};

const Dashboard = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => setShowLogoutConfirm(true);

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  const modules = [
    { key: 'cuentas',    label: 'Cuentas',    icon: iconCuentas,    path: '/cuentas' },
    { key: 'inventario', label: 'Inventario', icon: iconInventario, path: '/inventario' },
    { key: 'personal',   label: 'Personal',   icon: iconPersonal,   path: '/personal' },
    { key: 'usuarios',   label: 'Usuarios',   icon: iconUsuarios,   path: '/usuarios' },
  ].filter((m) => hasPermission(m.key));

  const roleLabel = {
    gerente:    'Gerente',
    secretario: 'Secretario',
    supervisor: 'Supervisor',
    contador:   'Contador',
  }[user?.tipo_usuario] ?? user?.tipo_usuario ?? '';

  const displayName = (user?.nombre && user?.apellido)
    ? `${user.nombre} ${user.apellido}`
    : displayName ?? '';

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-logo">
          <img src={logo} alt="WES Security" />
        </div>

        <div className="header-user">
          <div className="header-user-info">
            <span className="header-username">{user?.usuario}</span>
            {roleLabel && <span className="header-role">{roleLabel}</span>}
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-welcome">
          <h2>Bienvenido, <span>{displayName}</span></h2>
          <p>Selecciona un módulo para comenzar</p>
        </div>

        <div className="modules-grid">
          {modules.map((module) => {
            const meta = MODULE_META[module.key] ?? {};
            return (
              <button
                key={module.key}
                className="module-card"
                onClick={() => navigate(module.path)}
                type="button"
              >
                <div className="module-card-icon-wrap">
                  <img src={module.icon} alt="" className="module-icon" />
                </div>
                <div className="module-card-body">
                  <h3>{module.label}</h3>
                  {meta.description && <p>{meta.description}</p>}
                </div>
                <span className="module-card-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Cerrar sesión"
        message="¿Estás seguro de que deseas cerrar sesión?"
        confirmText="Cerrar sesión"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

export default Dashboard;
