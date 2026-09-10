import { useCallback, useState } from 'react';
import useRequestGuard from '../../../hooks/useRequestGuard';
import cuentasService from '../../../services/cuentasService';

const loadFacturasCatalogoFromService = () =>
  cuentasService.getFacturasCatalogo
    ? cuentasService.getFacturasCatalogo()
    : cuentasService.getReporte();

const useCuentasData = ({ showToast }) => {
  const [clientes, setClientes] = useState([]);
  const [reporte, setReporte] = useState([]);
  const [facturasCatalogo, setFacturasCatalogo] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [reportePagination, setReportePagination] = useState(null);
  const [pagosPagination, setPagosPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clientesLoaded, setClientesLoaded] = useState(false);
  const [facturasCatalogoLoaded, setFacturasCatalogoLoaded] = useState(false);
  const [pagosLoading, setPagosLoading] = useState(false);
  const [pagosLoaded, setPagosLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const pagosGuard = useRequestGuard();
  const reporteGuard = useRequestGuard();

  const loadPagos = useCallback(
    async (params = {}) => {
      const token = pagosGuard.start();
      setPagosLoading(true);
      const pagosRes = await cuentasService.getPagos(params);
      if (!pagosGuard.isCurrent(token)) return pagosRes.success;

      if (pagosRes.success) {
        setPagos(pagosRes.data);
        setPagosPagination(pagosRes.pagination);
        setPagosLoaded(true);
      } else {
        const message = pagosRes.message || 'Error al cargar pagos';
        setLoadError(message);
        showToast(message, 'error');
      }
      setPagosLoading(false);
      return pagosRes.success;
    },
    [pagosGuard, showToast]
  );

  const loadFacturasCatalogo = useCallback(async () => {
    const facturasRes = (await loadFacturasCatalogoFromService()) || { success: true, data: [] };
    if (facturasRes.success) {
      setFacturasCatalogo(facturasRes.data);
      setFacturasCatalogoLoaded(true);
    } else {
      const message = facturasRes.message || 'Error al cargar catálogo de facturas';
      setLoadError(message);
      showToast(message, 'error');
    }
    return facturasRes.success;
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

  const loadReporte = useCallback(
    async (params = {}) => {
      const token = reporteGuard.start();
      setLoading(true);
      setLoadError('');
      const reporteRes = await cuentasService.getReporte(params);
      if (!reporteGuard.isCurrent(token)) return reporteRes.success;

      if (reporteRes.success) {
        setReporte(reporteRes.data);
        setReportePagination(reporteRes.pagination);
      }
      if (!reporteRes.success) {
        const message = reporteRes.message || 'Error al cargar facturas';
        setLoadError(message);
        showToast(message, 'error');
      }
      setLoading(false);
      return reporteRes.success;
    },
    [reporteGuard, showToast]
  );

  const refreshFinancialData = useCallback(
    async (reporteParams = {}, pagosParams = {}) => {
      const requests = [loadReporte(reporteParams)];
      if (facturasCatalogoLoaded) requests.push(loadFacturasCatalogo());
      if (pagosLoaded) requests.push(loadPagos(pagosParams));
      await Promise.all(requests);
    },
    [facturasCatalogoLoaded, loadFacturasCatalogo, loadPagos, loadReporte, pagosLoaded]
  );

  return {
    clientes,
    reporte,
    facturasCatalogo,
    pagos,
    reportePagination,
    pagosPagination,
    loading,
    clientesLoading,
    clientesLoaded,
    facturasCatalogoLoaded,
    pagosLoading,
    pagosLoaded,
    loadError,
    loadClientes,
    loadPagos,
    loadReporte,
    loadFacturasCatalogo,
    refreshFinancialData,
  };
};

export default useCuentasData;
