import { useCallback, useEffect, useState } from 'react';
import cuentasService from '../../../services/cuentasService';

const useCuentasData = ({ showToast }) => {
  const [clientes, setClientes] = useState([]);
  const [reporte, setReporte] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clientesLoaded, setClientesLoaded] = useState(false);
  const [pagosLoading, setPagosLoading] = useState(false);
  const [pagosLoaded, setPagosLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadPagos = useCallback(async () => {
    setPagosLoading(true);
    const pagosRes = await cuentasService.getPagos();

    if (pagosRes.success) {
      setPagos(pagosRes.data);
      setPagosLoaded(true);
    } else {
      const message = pagosRes.message || 'Error al cargar pagos';
      setLoadError(message);
      showToast(message, 'error');
    }
    setPagosLoading(false);
    return pagosRes.success;
  }, [showToast]);

  const loadClientes = useCallback(async () => {
    setClientesLoading(true);
    const clientesRes = await cuentasService.getClientes();

    if (clientesRes.success) {
      setClientes(clientesRes.data);
      setClientesLoaded(true);
    } else {
      const message = clientesRes.message || 'Error al cargar clientes';
      setLoadError(message);
      showToast(message, 'error');
    }
    setClientesLoading(false);
    return clientesRes.success;
  }, [showToast]);

  const loadReporte = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const reporteRes = await cuentasService.getReporte();
    if (reporteRes.success) setReporte(reporteRes.data);
    if (!reporteRes.success) {
      const message = reporteRes.message || 'Error al cargar facturas';
      setLoadError(message);
      showToast(message, 'error');
    }
    setLoading(false);
    return reporteRes.success;
  }, [showToast]);

  const refreshFinancialData = useCallback(async () => {
    const requests = [loadReporte()];
    if (pagosLoaded) requests.push(loadPagos());
    await Promise.all(requests);
  }, [loadPagos, loadReporte, pagosLoaded]);

  // Load all datasets on entry so tab badges and row counters are available from the start.
  useEffect(() => {
    loadReporte();
    loadPagos();
    loadClientes();
  }, [loadClientes, loadPagos, loadReporte]);

  return {
    clientes,
    reporte,
    pagos,
    loading,
    clientesLoading,
    clientesLoaded,
    pagosLoading,
    pagosLoaded,
    loadError,
    loadClientes,
    loadPagos,
    loadReporte,
    refreshFinancialData,
  };
};

export default useCuentasData;
