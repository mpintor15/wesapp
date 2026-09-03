import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Building2, ClipboardList, Receipt, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import './Dashboard.css';
import logo from '../../assets/branding/logo_horizontal_header.png';
import { MODULE_ACCESS_PERMISSIONS } from '../../auth/modulePermissions';

const MODULE_META = {
  bitacoras: { description: 'Registro y consulta de novedades operativas' },
  cuentas: { description: 'Control de facturas, pagos y clientes' },
  configuracion: {
    description: 'Clientes, ubicaciones y organización del inventario',
  },
  inventario: { description: 'Artículos, equipos y movimientos de bodega' },
  personal: { description: 'Colaboradores, cargos, nómina y accesos al sistema' },
};

const DASHBOARD_MODULES = [
  {
    key: 'cuentas',
    permission: MODULE_ACCESS_PERMISSIONS.cuentas,
    label: 'Cuentas',
    Icon: Receipt,
    path: '/cuentas',
  },
  {
    key: 'configuracion',
    permission: MODULE_ACCESS_PERMISSIONS.configuracion,
    label: 'Clientes',
    Icon: Building2,
    path: '/configuracion',
  },
  {
    key: 'bitacoras',
    permission: MODULE_ACCESS_PERMISSIONS.bitacoras,
    label: 'Bitácoras',
    Icon: ClipboardList,
    path: '/bitacoras',
  },
  {
    key: 'inventario',
    permission: MODULE_ACCESS_PERMISSIONS.inventario,
    label: 'Inventario',
    Icon: Boxes,
    path: '/inventario',
  },
  {
    key: 'personal',
    permission: MODULE_ACCESS_PERMISSIONS.personal,
    label: 'Personal',
    Icon: UserRound,
    path: '/personal',
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
      guardia: 'Guardia',
      monitorista: 'Monitorista',
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
            const ModuleIcon = module.Icon;
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
                    <ModuleIcon className="module-icon" aria-hidden="true" strokeWidth={2} />
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
