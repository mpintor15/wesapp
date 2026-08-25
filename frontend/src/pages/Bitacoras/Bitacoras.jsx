import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '../../auth/permissions';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import bitacorasService from '../../services/bitacorasService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import HistorialBitacoras from './components/HistorialBitacoras';
import RegistroForm from './components/RegistroForm';
import './Bitacoras.css';

const Bitacoras = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const hasCreatePermission = hasPermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR);
  const canCreateBitacora =
    hasCreatePermission &&
    Number.isInteger(Number(user?.colaborador_id)) &&
    Number(user.colaborador_id) > 0;
  const canViewHistorial = hasPermission(PERMISSIONS.BITACORAS_HISTORIAL_VER);
  const locationsRequestRef = useRef(null);
  const [isRegistroModalOpen, setIsRegistroModalOpen] = useState(false);
  const [lastUbicacionId, setLastUbicacionId] = useState('');
  const [ubicaciones, setUbicaciones] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [locationsLoadAttempted, setLocationsLoadAttempted] = useState(false);
  const [locationsError, setLocationsError] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

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
    if ((canCreateBitacora || canViewHistorial) && !locationsLoaded && !locationsLoadAttempted) {
      void loadUbicaciones();
    }
  }, [
    canCreateBitacora,
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
  const hasModuleAccess = hasCreatePermission || canViewHistorial;

  return (
    <div className="page-container bitacoras-container">
      <PageHeader
        title="Bitácoras"
        onBack={() => navigate('/')}
        backTitle="Volver al Dashboard"
        onRefresh={
          canViewHistorial ? () => setHistoryRefreshKey((current) => current + 1) : undefined
        }
        refreshLabel="Actualizar historial"
        actions={
          canCreateBitacora ? (
            <button className="btn btn-ghost btn-sm" type="button" onClick={handleOpenRegistro}>
              Registrar Bitácora
            </button>
          ) : null
        }
      />

      {hasModuleAccess ? (
        <main className="bitacoras-main">
          {canViewHistorial ? (
            <HistorialBitacoras
              ubicaciones={ubicaciones}
              locationsLoading={locationsLoading || (!locationsLoaded && !locationsError)}
              locationsError={locationsError}
              onReloadUbicaciones={loadUbicaciones}
              refreshKey={historyRefreshKey}
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
    </div>
  );
};

export default Bitacoras;
