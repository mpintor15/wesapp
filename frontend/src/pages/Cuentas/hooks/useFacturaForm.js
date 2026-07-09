import { useCallback, useEffect, useMemo, useState } from 'react';
import cuentasService from '../../../services/cuentasService';
import {
  buildFacturaPayload,
  calculateFacturaPreview,
  filterClientesBySearch,
  getExistingInvoiceNumbers,
  getNumFacturaError,
  shouldShowFacturaCalculation,
  validateFacturaForm,
} from '../utils/cuentasFacturaForm';
import { getInitialFacturaForm } from '../utils/cuentasState';

const useFacturaForm = ({ clientes, reporte, isGerente, showToast, onCreated = () => {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState(getInitialFacturaForm());
  const [facturaErrors, setFacturaErrors] = useState({});
  const [debouncedFacturaInputs, setDebouncedFacturaInputs] = useState({
    num_factura: '',
    valor_factura: '',
  });
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClienteDropdown && !event.target.closest('.cliente-search-container')) {
        setShowClienteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClienteDropdown]);

  useEffect(() => {
    if (!isOpen) return;
    setFormData((prev) => ({
      ...prev,
      fecha_factura: prev.fecha_factura || new Date().toISOString().split('T')[0],
    }));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timeoutId = window.setTimeout(() => {
      setDebouncedFacturaInputs({
        num_factura: formData.num_factura,
        valor_factura: formData.valor_factura,
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, formData.num_factura, formData.valor_factura]);

  const reset = useCallback(() => {
    setFormData(getInitialFacturaForm());
    setFacturaErrors({});
    setDebouncedFacturaInputs({ num_factura: '', valor_factura: '' });
    setClienteSearch('');
    setSelectedCliente(null);
    setShowClienteDropdown(false);
  }, []);

  const open = useCallback(() => {
    reset();
    setIsOpen(true);
  }, [reset]);

  const close = useCallback(() => {
    setIsOpen(false);
    reset();
  }, [reset]);

  const handleFormChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'incluye_iva' && !checked ? { incluye_retencion_iva: false } : {}),
    }));
    setFacturaErrors((prev) => ({ ...prev, [name]: '' }));
  }, []);

  const handleClienteSelect = useCallback((cliente) => {
    setFormData((prev) => ({ ...prev, cliente_id: cliente.id }));
    setClienteSearch(cliente.nombre);
    setSelectedCliente(cliente);
    setShowClienteDropdown(false);
    setFacturaErrors((prev) => ({ ...prev, cliente_id: '' }));
  }, []);

  const handleClienteSearchChange = useCallback(
    (event) => {
      const value = event.target.value;
      setClienteSearch(value);
      setShowClienteDropdown(true);
      if (!value || (selectedCliente && value !== selectedCliente.nombre)) {
        setFormData((prev) => ({ ...prev, cliente_id: '' }));
        setSelectedCliente(null);
      }
    },
    [selectedCliente]
  );

  const filteredClientes = filterClientesBySearch(clientes, clienteSearch);
  const existingInvoiceNumbers = useMemo(() => getExistingInvoiceNumbers(reporte), [reporte]);
  const numFacturaError = getNumFacturaError(
    debouncedFacturaInputs.num_factura,
    existingInvoiceNumbers,
    facturaErrors.num_factura
  );
  const facturaPreview = calculateFacturaPreview(formData);
  const showFacturaCalculation = shouldShowFacturaCalculation(debouncedFacturaInputs, formData);

  const flushFacturaNumericInputs = useCallback(() => {
    setDebouncedFacturaInputs({
      num_factura: formData.num_factura,
      valor_factura: formData.valor_factura,
    });
  }, [formData.num_factura, formData.valor_factura]);

  const handleCreateFactura = useCallback(
    async (event) => {
      event.preventDefault();
      if (!isGerente) {
        showToast('Solo un usuario Gerente puede crear facturas', 'error');
        return;
      }

      const errors = validateFacturaForm(formData, existingInvoiceNumbers);
      if (Object.keys(errors).length > 0) {
        setFacturaErrors(errors);
        const firstError = Object.values(errors)[0];
        showToast(firstError, 'error');
        return;
      }

      const result = await cuentasService.createFactura(buildFacturaPayload(formData));

      if (result.success) {
        showToast('Factura creada exitosamente', 'success');
        close();
        onCreated();
      } else {
        showToast(result.message, 'error');
      }
    },
    [close, existingInvoiceNumbers, formData, isGerente, onCreated, showToast]
  );

  return {
    isOpen,
    open,
    close,
    formData,
    facturaErrors,
    numFacturaError,
    clienteSearch,
    showClienteDropdown,
    setShowClienteDropdown,
    filteredClientes,
    selectedCliente,
    facturaPreview,
    showFacturaCalculation,
    handleFormChange,
    handleClienteSearchChange,
    handleClienteSelect,
    flushFacturaNumericInputs,
    handleCreateFactura,
  };
};

export default useFacturaForm;
