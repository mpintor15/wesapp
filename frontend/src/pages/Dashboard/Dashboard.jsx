import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import './Dashboard.css';
import logo from '../../assets/branding/logo_horizontal_header.png';
import iconCuentas from '../../assets/icons/invoice.png';
import iconInventario from '../../assets/icons/inventory.png';
import iconPersonal from '../../assets/icons/audience.png';
import iconUsuarios from '../../assets/icons/user.png';
import { MODULE_ACCESS_PERMISSIONS } from '../../auth/modulePermissions';

const MODULE_META = {
  cuentas: { description: 'Control de facturas, pagos y clientes' },
  configuracion: {
    description: 'Clientes, ubicaciones y organización del inventario',
  },
  inventario: { description: 'Artículos, equipos y movimientos de bodega' },
  personal: { description: 'Colaboradores, cargos y nómina' },
  usuarios: { description: 'Cuentas de acceso y permisos del sistema' },
};

const DASHBOARD_MODULES = [
  {
    key: 'cuentas',
    permission: MODULE_ACCESS_PERMISSIONS.cuentas,
    label: 'Cuentas',
    icon: iconCuentas,
    path: '/cuentas',
  },
  {
    key: 'configuracion',
    permission: MODULE_ACCESS_PERMISSIONS.configuracion,
    label: 'Clientes',
    icon: iconInventario,
    path: '/configuracion',
  },
  {
    key: 'inventario',
    permission: MODULE_ACCESS_PERMISSIONS.inventario,
    label: 'Inventario',
    icon: iconInventario,
    path: '/inventario',
  },
  {
    key: 'personal',
    permission: MODULE_ACCESS_PERMISSIONS.personal,
    label: 'Personal',
    icon: iconPersonal,
    path: '/personal',
  },
  {
    key: 'usuarios',
    permission: MODULE_ACCESS_PERMISSIONS.usuarios,
    label: 'Usuarios',
    icon: iconUsuarios,
    path: '/usuarios',
  },
];

const Dashboard = () => {
  useScrollToTopOnMount();

  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loadingModule, setLoadingModule] = useState(null);

  const handleLogout = () => setShowLogoutConfirm(true);

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  const handleModuleClick = (module) => {
    if (loadingModule) return;
    setLoadingModule(module.key);
    navigate(module.path);
  };

  const modules = DASHBOARD_MODULES.filter((m) => hasPermission(m.permission));

  const roleLabel =
    {
      gerente: 'Gerente',
      secretario: 'Secretario',
      supervisor: 'Supervisor',
      contador: 'Contador',
    }[user?.tipo_usuario] ??
    user?.tipo_usuario ??
    '';

  const displayName =
    user?.nombre && user?.apellido ? `${user.nombre} ${user.apellido}` : (user?.usuario ?? '');

  return (
    <div className="dashboard-container">
      <header className="brand-header dashboard-header">
        <div className="header-logo">
          <img src={logo} alt="WES Security Cía. Ltda." width="1725" height="1000" />
        </div>

        <div className="header-user">
          <div className="header-user-info">
            <span className="header-username">{user?.usuario}</span>
            {roleLabel && <span className="header-role">{roleLabel}</span>}
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="15"
              height="15"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-welcome">
          <h2>
            Bienvenido, <span>{displayName}</span>
          </h2>
          <p>Selecciona un módulo para comenzar</p>
        </div>

        <div className="modules-grid">
          {modules.map((module) => {
            const meta = MODULE_META[module.key] ?? {};
            return (
              <button
                key={module.key}
                className={`module-card${loadingModule === module.key ? ' module-card--loading' : ''}`}
                onClick={() => handleModuleClick(module)}
                disabled={!!loadingModule}
                type="button"
              >
                <div className="module-card-icon-wrap">
                  {loadingModule === module.key ? (
                    <span className="spinner" />
                  ) : (
                    <img src={module.icon} alt="" className="module-icon" />
                  )}
                </div>
                <div className="module-card-body">
                  <h3>{module.label}</h3>
                  {meta.description && <p>{meta.description}</p>}
                </div>
                <span className="module-card-arrow">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
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
