import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '../../auth/permissions';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import bitacorasService from '../../services/bitacorasService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import FormularioVisitasAdmin from './components/FormularioVisitasAdmin';
import HistorialBitacoras from './components/HistorialBitacoras';
import HistorialVisitas from './components/HistorialVisitas';
import RegistroForm from './components/RegistroForm';
import VisitaForm from './components/VisitaForm';
import './Bitacoras.css';

const Bitacoras = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const hasCreatePermission = hasPermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR);
  const canManageVisitForms = hasPermission(PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR);
  const canGestionarFormularios = hasPermission(PERMISSIONS.BITACORAS_FORMULARIOS_GESTIONAR);
  const canCreateBitacora =
    hasCreatePermission &&
    Number.isInteger(Number(user?.colaborador_id)) &&
    Number(user.colaborador_id) > 0;
  const canViewHistorial = hasPermission(PERMISSIONS.BITACORAS_HISTORIAL_VER);
  const locationsRequestRef = useRef(null);
  const [isRegistroModalOpen, setIsRegistroModalOpen] = useState(false);
  const [isVisitaModalOpen, setIsVisitaModalOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [activeView, setActiveView] = useState('historial');
  const [lastUbicacionId, setLastUbicacionId] = useState('');
  const [ubicaciones, setUbicaciones] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [locationsLoadAttempted, setLocationsLoadAttempted] = useState(false);
  const [locationsError, setLocationsError] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [formsRefreshKey, setFormsRefreshKey] = useState(0);
  const [reportFilters, setReportFilters] = useState({
    historial: {},
    visitas: {},
    formularios: {},
  });
  const [isExporting, setIsExporting] = useState(false);
  const [tabCounts, setTabCounts] = useState({
    historial: null,
    visitas: null,
    formularios: null,
  });

  const loadUbicaciones = useCallback(
    async ({ background = false } = {}) => {
      if (locationsRequestRef.current) return locationsRequestRef.current;

      setLocationsLoadAttempted(true);
      if (!background) {
        setLocationsLoading(true);
        setLocationsError('');
      }
      const request = bitacorasService.getUbicaciones();
      locationsRequestRef.current = request;
      try {
        const result = await request;
        if (result.success) {
          const nextLocations = Array.isArray(result.data) ? result.data : [];
          setUbicaciones(nextLocations);
          setLocationsLoaded(true);
          setLocationsError('');
          return nextLocations;
        }

        const message = getVisibleErrorMessage(result, 'No se pudieron cargar las Ubicaciones.');
        if (!background) {
          setLocationsError(message);
          showToast(message, 'error');
        }
        return null;
      } finally {
        locationsRequestRef.current = null;
        if (!background) setLocationsLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (
      (canCreateBitacora || canViewHistorial || canManageVisitForms) &&
      !locationsLoaded &&
      !locationsLoadAttempted
    ) {
      void loadUbicaciones();
    }
  }, [
    canCreateBitacora,
    canManageVisitForms,
    canViewHistorial,
    loadUbicaciones,
    locationsLoadAttempted,
    locationsLoaded,
  ]);

  useEffect(() => {
    if (!canCreateBitacora) setIsRegistroModalOpen(false);
  }, [canCreateBitacora]);

  const handleOpenRegistro = () => setIsRegistroModalOpen(true);
  const handleCloseRegistro = () => setIsRegistroModalOpen(false);
  const handleRegistroSuccess = () => {
    handleCloseRegistro();
    if (canViewHistorial) setHistoryRefreshKey((current) => current + 1);
  };
  const handleVisitaSuccess = () => {
    setIsVisitaModalOpen(false);
    if (canViewHistorial) setHistoryRefreshKey((current) => current + 1);
  };
  const exportActiveReport = async () => {
    if (isExporting) return;
    const exporters = {
      historial: bitacorasService.exportRegistros.bind(bitacorasService),
      visitas: bitacorasService.exportVisitas.bind(bitacorasService),
      formularios: bitacorasService.exportFormulariosVisitas.bind(bitacorasService),
    };
    const exporter = exporters[activeView];
    if (!exporter) return;
    setIsExporting(true);
    const result = await exporter(reportFilters[activeView]);
    setIsExporting(false);
    if (result.success) showToast('Reporte exportado exitosamente.', 'success');
    else if (!result.cancelled)
      showToast(result.message || 'No se pudo exportar el reporte.', 'error');
  };
  const updateHistorialReportFilters = useCallback(
    (filters) => setReportFilters((current) => ({ ...current, historial: filters })),
    []
  );
  const updateVisitasReportFilters = useCallback(
    (filters) => setReportFilters((current) => ({ ...current, visitas: filters })),
    []
  );
  const updateFormulariosReportFilters = useCallback(
    (filters) => setReportFilters((current) => ({ ...current, formularios: filters })),
    []
  );
  const updateTabCount = useCallback((tabId, total) => {
    setTabCounts((current) => {
      if (current[tabId] === total) return current;
      return { ...current, [tabId]: total };
    });
  }, []);
  const handleHistorialTotalChange = useCallback(
    (total) => updateTabCount('historial', total),
    [updateTabCount]
  );
  const handleVisitasTotalChange = useCallback(
    (total) => updateTabCount('visitas', total),
    [updateTabCount]
  );
  const handleFormulariosTotalChange = useCallback(
    (total) => updateTabCount('formularios', total),
    [updateTabCount]
  );
  const handleFormsChanged = useCallback(() => setFormsRefreshKey((current) => current + 1), []);
  const hasModuleAccess = hasCreatePermission || canViewHistorial || canManageVisitForms;

  useEffect(() => {
    if (!canViewHistorial && !canManageVisitForms) return undefined;
    let cancelled = false;
    bitacorasService.getResumen().then((result) => {
      if (cancelled || !result.success) return;
      setTabCounts((current) => ({
        historial: result.data.registros ?? current.historial,
        visitas: result.data.visitas ?? current.visitas,
        formularios: result.data.formularios ?? current.formularios,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [canManageVisitForms, canViewHistorial, historyRefreshKey, formsRefreshKey]);

  const visibleTabs = useMemo(
    () =>
      [
        canViewHistorial ? { id: 'historial', label: 'Registro' } : null,
        canViewHistorial ? { id: 'visitas', label: 'Visitas' } : null,
        canManageVisitForms ? { id: 'formularios', label: 'Formularios' } : null,
      ].filter(Boolean),
    [canManageVisitForms, canViewHistorial]
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeView)) {
      setActiveView(visibleTabs[0]?.id || 'historial');
    }
  }, [activeView, visibleTabs]);

  return (
    <div className="bitacoras-container tabular-page">
      <PageHeader
        title="Bitácoras"
        onBack={() => navigate('/')}
        backTitle="Volver al Dashboard"
        onRefresh={
          canViewHistorial ? () => setHistoryRefreshKey((current) => current + 1) : undefined
        }
        refreshLabel="Actualizar historial"
        actions={
          <>
            {activeView === 'historial' && canCreateBitacora ? (
              <button className="btn btn-ghost btn-sm" type="button" onClick={handleOpenRegistro}>
                Registrar Bitácora
              </button>
            ) : null}
            {activeView === 'historial' && canViewHistorial ? (
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={exportActiveReport}
                disabled={isExporting}
              >
                Generar reporte de Bitácoras
              </button>
            ) : null}
            {activeView === 'visitas' && canCreateBitacora ? (
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setIsVisitaModalOpen(true)}
              >
                Registrar Visita
              </button>
            ) : null}
            {activeView === 'visitas' && canViewHistorial ? (
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={exportActiveReport}
                disabled={isExporting}
              >
                Generar reporte de Visitas
              </button>
            ) : null}
            {activeView === 'formularios' && canManageVisitForms ? (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => setIsFormBuilderOpen(true)}
                >
                  Crear formulario
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={exportActiveReport}
                  disabled={isExporting}
                >
                  Generar reporte de Formularios
                </button>
              </>
            ) : null}
          </>
        }
      />

      {hasModuleAccess ? (
        <main className="bitacoras-main bitacoras-module-workspace">
          {visibleTabs.length > 1 ? (
            <div className="module-tabs bitacoras-tabs" role="tablist" aria-label="Bitácoras">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tab ${activeView === tab.id ? 'active' : ''}`}
                  role="tab"
                  aria-selected={activeView === tab.id}
                  onClick={() => setActiveView(tab.id)}
                >
                  {tab.label}
                  {tabCounts[tab.id] > 0 && <span className="tab-badge">{tabCounts[tab.id]}</span>}
                </button>
              ))}
            </div>
          ) : null}
          {activeView === 'historial' && canViewHistorial ? (
            <HistorialBitacoras
              ubicaciones={ubicaciones}
              locationsLoading={locationsLoading || (!locationsLoaded && !locationsError)}
              locationsError={locationsError}
              onReloadUbicaciones={loadUbicaciones}
              refreshKey={historyRefreshKey}
              onFiltersChange={updateHistorialReportFilters}
              onTotalChange={handleHistorialTotalChange}
            />
          ) : activeView === 'visitas' && canViewHistorial ? (
            <HistorialVisitas
              refreshKey={historyRefreshKey}
              onChanged={() => setHistoryRefreshKey((current) => current + 1)}
              showToast={showToast}
              onFiltersChange={updateVisitasReportFilters}
              canCancelVisita={canManageVisitForms}
              onTotalChange={handleVisitasTotalChange}
            />
          ) : activeView === 'formularios' && canManageVisitForms ? (
            <FormularioVisitasAdmin
              ubicaciones={ubicaciones}
              showToast={showToast}
              isBuilderOpen={isFormBuilderOpen}
              onOpenBuilder={() => setIsFormBuilderOpen(true)}
              onCloseBuilder={() => setIsFormBuilderOpen(false)}
              onFiltersChange={updateFormulariosReportFilters}
              canGestionar={canGestionarFormularios}
              canDelete={user?.tipo_usuario === 'gerente'}
              onTotalChange={handleFormulariosTotalChange}
              onFormsChanged={handleFormsChanged}
            />
          ) : (
            <section className="bitacoras-history-unavailable">
              <h2>Historial de Bitácoras</h2>
              <p>No tienes permiso para consultar el historial.</p>
            </section>
          )}
        </main>
      ) : (
        <main className="bitacoras-main bitacoras-main--denied">
          <h2>Acceso no disponible</h2>
          <p>No tienes permisos para usar las funciones de Bitácoras.</p>
        </main>
      )}

      {isRegistroModalOpen ? (
        <RegistroForm
          isOpen
          ubicaciones={ubicaciones}
          locationsLoading={locationsLoading || (!locationsLoaded && !locationsError)}
          locationsError={locationsError}
          initialUbicacionId={lastUbicacionId}
          onUbicacionChange={setLastUbicacionId}
          onReloadUbicaciones={loadUbicaciones}
          onClose={handleCloseRegistro}
          onSuccess={handleRegistroSuccess}
          showToast={showToast}
        />
      ) : null}
      {isVisitaModalOpen ? (
        <VisitaForm
          isOpen
          ubicaciones={ubicaciones}
          onClose={() => setIsVisitaModalOpen(false)}
          onSuccess={handleVisitaSuccess}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
};

export default Bitacoras;
