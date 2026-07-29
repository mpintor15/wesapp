import { useCallback, useState } from 'react';
import cuentasService from '../../../services/cuentasService';
import useSubmitState from '../../../hooks/useSubmitState';
import {
  buildFacturasReportParams,
  buildPagosReportParams,
  getInitialFacturasReportFilters,
  getInitialPagosReportFilters,
} from '../utils/cuentasReportParams';

const useCuentasReports = ({ showToast }) => {
  const { isSubmitting: isExportingFacturas, withSubmit: withFacturasExportSubmit } =
    useSubmitState();
  const { isSubmitting: isExportingPagos, withSubmit: withPagosExportSubmit } = useSubmitState();

  const [showFacturasReportModal, setShowFacturasReportModal] = useState(false);
  const [showPagosReportModal, setShowPagosReportModal] = useState(false);
  const [facturasFilters, setFacturasFilters] = useState(getInitialFacturasReportFilters());
  const [pagosFilters, setPagosFilters] = useState(getInitialPagosReportFilters());

  const handleFacturasFilterChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setFacturasFilters((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const toggleFacturasFilter = useCallback((field) => {
    setFacturasFilters((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const clearFacturasFilters = useCallback(() => {
    setFacturasFilters(getInitialFacturasReportFilters());
  }, []);

  const handlePagosFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setPagosFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const clearPagosFilters = useCallback(() => {
    setPagosFilters(getInitialPagosReportFilters());
  }, []);

  const exportFacturas = withFacturasExportSubmit(async () => {
    const result = await cuentasService.exportExcel(buildFacturasReportParams(facturasFilters));
    if (result.success) {
      showToast('Reporte exportado exitosamente', 'success');
    } else {
      showToast(result.message || 'Error al exportar', 'error');
    }
  });

  const exportPagos = withPagosExportSubmit(async () => {
    const result = await cuentasService.exportPagosExcel(buildPagosReportParams(pagosFilters));
    if (result.success) {
      showToast('Reporte de pagos exportado exitosamente', 'success');
      setShowPagosReportModal(false);
      return;
    }
    if (!result.cancelled) {
      showToast(result.message || 'Error al exportar pagos', 'error');
    }
  });

  return {
    facturas: {
      isOpen: showFacturasReportModal,
      filters: facturasFilters,
      isExporting: isExportingFacturas,
      open: () => setShowFacturasReportModal(true),
      close: () => setShowFacturasReportModal(false),
      handleFilterChange: handleFacturasFilterChange,
      toggleSoloDeudores: () => toggleFacturasFilter('soloDeudores'),
      toggleAgruparCliente: () => toggleFacturasFilter('agruparCliente'),
      clear: clearFacturasFilters,
      export: exportFacturas,
    },
    pagos: {
      isOpen: showPagosReportModal,
      filters: pagosFilters,
      isExporting: isExportingPagos,
      open: () => setShowPagosReportModal(true),
      close: () => setShowPagosReportModal(false),
      handleFilterChange: handlePagosFilterChange,
      clear: clearPagosFilters,
      export: exportPagos,
    },
  };
};

export default useCuentasReports;
