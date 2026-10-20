import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useToast } from '../../context/ToastContext';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import portalService from '../../services/portalService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import HistorialVisitas from '../Bitacoras/components/HistorialVisitas';
import '../Bitacoras/Bitacoras.css';

// Vista de solo lectura de las visitas de las urbanizaciones del cliente autenticado.
const PortalVisitas = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { showToast } = useToast();
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="bitacoras-container tabular-page">
      <PageHeader
        title="Visitas"
        onBack={() => navigate('/')}
        backTitle="Volver al Dashboard"
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
            fetchVisitas={portalService.getVisitas}
          />
        )}
      </main>
    </div>
  );
};

export default PortalVisitas;
