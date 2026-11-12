import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AUTO_REFRESH_MS } from '../../hooks/useAutoRefresh';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import portalService from '../../services/portalService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import HistorialVisitas from '../Bitacoras/components/HistorialVisitas';
import ReportFiltersModal from '../Bitacoras/components/ReportFiltersModal';
import '../Bitacoras/Bitacoras.css';

const EMPTY_REPORT_FILTERS = {
  ubicacion_id: '',
  fecha_desde: '',
  fecha_hasta: '',
  estado: '',
  creator: '',
  search: '',
};

// Vista de solo lectura de las visitas de las urbanizaciones del cliente autenticado.
const PortalVisitas = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportFilters, setReportFilters] = useState(EMPTY_REPORT_FILTERS);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const loadUbicaciones = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await portalService.getUbicaciones();
    if (result.success) {
      setUbicaciones(Array.isArray(result.data) ? result.data : []);
    } else {
      setError(getVisibleErrorMessage(result, 'No se pudieron cargar tus urbanizaciones.'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUbicaciones();
  }, [loadUbicaciones]);

  const exportReport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const result = await portalService.exportVisitas(reportFilters);
    setIsExporting(false);
    if (result.success) {
      showToast('Reporte exportado exitosamente.', 'success');
      setIsReportOpen(false);
    } else if (!result.cancelled) {
      showToast(result.message || 'No se pudo exportar el reporte.', 'error');
    }
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="bitacoras-container tabular-page">
      <PageHeader
        title="Visitas"
        actions={
          <>
            {ubicaciones.length > 0 ? (
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setIsReportOpen(true)}
                disabled={isExporting}
              >
                Generar reporte de Visitas
              </button>
            ) : null}
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
            >
              Cerrar sesión
            </button>
          </>
        }
        onRefresh={() => setRefreshKey((current) => current + 1)}
        refreshLabel="Actualizar visitas"
      />
      <main className="bitacoras-main bitacoras-module-workspace">
        {loading ? (
          <div className="loading bitacoras-history-state">Cargando…</div>
        ) : error ? (
          <div className="bitacoras-history-state" role="alert">
            <p>{error}</p>
            <button className="btn btn-secondary" type="button" onClick={loadUbicaciones}>
              Reintentar
            </button>
          </div>
        ) : ubicaciones.length === 0 ? (
          <div className="bitacoras-history-state bitacoras-history-empty">
            <p>Tu cliente no tiene urbanizaciones registradas.</p>
          </div>
        ) : (
          <HistorialVisitas
            ubicaciones={ubicaciones}
            refreshKey={refreshKey}
            showToast={showToast}
            readOnly
            autoRefreshMs={AUTO_REFRESH_MS}
            fetchVisitas={portalService.getVisitas}
          />
        )}
      </main>
      <ReportFiltersModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onExport={exportReport}
        onFilterChange={(field, value) =>
          setReportFilters((current) => ({ ...current, [field]: value }))
        }
        onClear={() => setReportFilters(EMPTY_REPORT_FILTERS)}
        isSubmitting={isExporting}
        filters={reportFilters}
        ubicaciones={ubicaciones.filter((ubicacion) => ubicacion.tipo_punto === 'URBANIZACION')}
        hideUbicacion={ubicaciones.length <= 1}
        activeView="visitas"
      />
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

export default PortalVisitas;
