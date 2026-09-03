import { useCallback, useEffect, useState } from 'react';
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
  const [pagosLoading, setPagosLoading] = useState(false);
  const [pagosLoaded, setPagosLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadPagos = useCallback(
    async (params = {}) => {
      setPagosLoading(true);
      const pagosRes = await cuentasService.getPagos(params);

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
    [showToast]
  );

  const loadFacturasCatalogo = useCallback(async () => {
    const facturasRes = (await loadFacturasCatalogoFromService()) || { success: true, data: [] };
    if (facturasRes.success) {
      setFacturasCatalogo(facturasRes.data);
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
      setLoading(true);
      setLoadError('');
      const reporteRes = await cuentasService.getReporte(params);
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
    [showToast]
  );

  const refreshFinancialData = useCallback(
    async (reporteParams = {}, pagosParams = {}) => {
      const requests = [loadReporte(reporteParams), loadFacturasCatalogo()];
      if (pagosLoaded) requests.push(loadPagos(pagosParams));
      await Promise.all(requests);
    },
    [loadFacturasCatalogo, loadPagos, loadReporte, pagosLoaded]
  );

  // Preload clientes and the facturas catalog on entry — neither depends on
  // filters, and nothing else fetches them. Reporte and pagos are NOT
  // fetched here: the caller (Cuentas.jsx) owns the filtered `params` for
  // both and fetches them itself. Fetching them here too, with no params,
  // used to race that filtered fetch — whichever response landed last won,
  // so the default filters sometimes looked applied in the UI but weren't
  // actually reflected in the loaded data.
  useEffect(() => {
    loadClientes();
    loadFacturasCatalogo();
  }, [loadClientes, loadFacturasCatalogo]);

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
