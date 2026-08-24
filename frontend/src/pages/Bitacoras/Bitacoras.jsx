import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '../../auth/permissions';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import bitacorasService from '../../services/bitacorasService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import RegistroForm from './components/RegistroForm';
import './Bitacoras.css';

const Bitacoras = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canCreateRegistro = hasPermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR);
  const canViewHistorial = hasPermission(PERMISSIONS.BITACORAS_HISTORIAL_VER);
  const locationsRequestRef = useRef(null);
  const [isRegistroModalOpen, setIsRegistroModalOpen] = useState(false);
  const [lastUbicacionId, setLastUbicacionId] = useState('');
  const [ubicaciones, setUbicaciones] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [locationsLoadAttempted, setLocationsLoadAttempted] = useState(false);
  const [locationsError, setLocationsError] = useState('');

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
    if (canCreateRegistro && !locationsLoaded && !locationsLoadAttempted) void loadUbicaciones();
  }, [canCreateRegistro, loadUbicaciones, locationsLoadAttempted, locationsLoaded]);

  useEffect(() => {
    if (!canCreateRegistro) setIsRegistroModalOpen(false);
  }, [canCreateRegistro]);

  const handleOpenRegistro = () => setIsRegistroModalOpen(true);
  const handleCloseRegistro = () => setIsRegistroModalOpen(false);
  const hasModuleAccess = canCreateRegistro || canViewHistorial;

  return (
    <div className="page-container bitacoras-container">
      <PageHeader
        title="Bitácoras"
        onBack={() => navigate('/')}
        backTitle="Volver al Dashboard"
        actions={
          canCreateRegistro ? (
            <button className="btn btn-ghost btn-sm" type="button" onClick={handleOpenRegistro}>
              Registrar Bitácora
            </button>
          ) : null
        }
      />

      {hasModuleAccess ? (
        <main className="bitacoras-main">
          <h2>Historial de Bitácoras</h2>
          <p>El historial se habilitará en el siguiente subbloque.</p>
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
          onSuccess={handleCloseRegistro}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
};

export default Bitacoras;
