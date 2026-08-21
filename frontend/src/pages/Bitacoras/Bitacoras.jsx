import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '../../auth/permissions';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import './Bitacoras.css';

const TAB_DEFINITIONS = [
  {
    id: 'registrar',
    label: 'Registrar',
    permission: PERMISSIONS.BITACORAS_REGISTRO_CREAR,
    description: 'La captura de registros se habilitará en el siguiente subbloque.',
  },
  {
    id: 'historial',
    label: 'Historial',
    permission: PERMISSIONS.BITACORAS_HISTORIAL_VER,
    description: 'La consulta del historial se habilitará en el subbloque correspondiente.',
  },
];

const Bitacoras = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const allowedTabs = TAB_DEFINITIONS.filter((tab) => hasPermission(tab.permission));
  const [activeTab, setActiveTab] = useState(() => allowedTabs[0]?.id ?? null);
  const tabRefs = useRef({});

  useEffect(() => {
    if (!allowedTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id ?? null);
    }
  }, [activeTab, allowedTabs]);

  const selectedTab = allowedTabs.find((tab) => tab.id === activeTab) ?? allowedTabs[0];

  const handleTabKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + allowedTabs.length) % allowedTabs.length;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % allowedTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = allowedTabs.length - 1;

    const nextTab = allowedTabs[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  };

  return (
    <div className="page-container bitacoras-container">
      <PageHeader title="Bitácoras" onBack={() => navigate('/')} backTitle="Volver al Dashboard" />

      {allowedTabs.length > 0 ? (
        <main className="bitacoras-main">
          <div className="bitacoras-tabs" role="tablist" aria-label="Vistas de Bitácoras">
            {allowedTabs.map((tab, index) => {
              const isActive = tab.id === selectedTab?.id;
              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current[tab.id] = node;
                  }}
                  id={`bitacoras-tab-${tab.id}`}
                  className={`tab${isActive ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-controls={`bitacoras-panel-${tab.id}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {selectedTab ? (
            <section
              id={`bitacoras-panel-${selectedTab.id}`}
              className="tab-content bitacoras-panel"
              role="tabpanel"
              aria-labelledby={`bitacoras-tab-${selectedTab.id}`}
            >
              <h2>{selectedTab.label}</h2>
              <p>{selectedTab.description}</p>
            </section>
          ) : null}
        </main>
      ) : (
        <main className="bitacoras-panel bitacoras-panel--denied">
          <h2>Acceso no disponible</h2>
          <p>No tienes permisos para usar las funciones de Bitácoras.</p>
        </main>
      )}
    </div>
  );
};

export default Bitacoras;
