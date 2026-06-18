import { useEffect, useMemo, useState } from 'react';
import {
  autoDistribute,
  calculateBatchPaymentSummary,
  getPendingInvoicesForCustomer,
} from '../utils/cuentasBatchPayment';
import { filterClientesBySearch } from '../utils/cuentasFacturaForm';

const getToday = () => new Date().toISOString().split('T')[0];

const useBatchPaymentState = ({ clientes, reporte }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [date, setDate] = useState(getToday());
  const [totalCredit, setTotalCredit] = useState('');
  const [selections, setSelections] = useState({});
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [notas, setNotas] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.bp-cliente-search-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const invoices = useMemo(
    () => getPendingInvoicesForCustomer(reporte, customer),
    [customer, reporte]
  );
  const filteredClientes = filterClientesBySearch(clientes, customerSearch);
  const summary = calculateBatchPaymentSummary(invoices, selections, totalCredit);

  const open = () => {
    setDate((prev) => prev || getToday());
    setErrors({});
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setCustomerSearch('');
    setShowDropdown(false);
    setCustomer(null);
    setTotalCredit('');
    setDate(getToday());
    setSelections({});
    setMetodoPago('efectivo');
    setNotas('');
    setErrors({});
  };

  const selectCustomer = (nextCustomer) => {
    setCustomer(nextCustomer);
    setCustomerSearch(nextCustomer.nombre);
    setShowDropdown(false);
    setErrors((prev) => ({ ...prev, cliente: '', abonos: '' }));
    const pendingInvoices = getPendingInvoicesForCustomer(reporte, nextCustomer);
    if (totalCredit && parseFloat(totalCredit) > 0) {
      setSelections(autoDistribute(totalCredit, pendingInvoices));
    } else {
      setSelections({});
    }
  };

  const handleCustomerSearchChange = (event) => {
    const value = event.target.value;
    setCustomerSearch(value);
    setShowDropdown(true);
    setErrors((prev) => ({ ...prev, cliente: '' }));
    if (!value || (customer && value !== customer.nombre)) {
      setCustomer(null);
      setSelections({});
    }
  };

  const handleTotalCreditChange = (event) => {
    const value = event.target.value;
    setTotalCredit(value);
    setErrors((prev) => ({ ...prev, total: '', abonos: '' }));
    if (customer && invoices.length > 0 && parseFloat(value) > 0) {
      setSelections(autoDistribute(value, invoices));
    } else if (!value) {
      setSelections({});
    }
  };

  const toggleInvoice = (numFactura) => {
    setErrors((prev) => ({ ...prev, abonos: '', [`amount_${numFactura}`]: '' }));
    setSelections((prev) => {
      const current = prev[numFactura] || {};
      return {
        ...prev,
        [numFactura]: {
          selected: !current.selected,
          amount: current.selected ? '' : current.amount || '',
        },
      };
    });
  };

  const changeAmount = (numFactura, value) => {
    setErrors((prev) => ({ ...prev, abonos: '', [`amount_${numFactura}`]: '' }));
    setSelections((prev) => ({
      ...prev,
      [numFactura]: { ...(prev[numFactura] || {}), selected: true, amount: value },
    }));
  };

  const payFull = (invoice) => {
    setSelections((prev) => ({
      ...prev,
      [invoice.num_factura]: {
        selected: true,
        amount: String(parseFloat(invoice.saldo_pendiente).toFixed(2)),
      },
    }));
    setErrors((prev) => ({ ...prev, abonos: '', [`amount_${invoice.num_factura}`]: '' }));
  };

  const autoDistributeCurrent = () => {
    if (!customer || !invoices.length) return;
    const total = parseFloat(totalCredit);
    if (!totalCredit || Number.isNaN(total) || total <= 0) {
      setErrors((prev) => ({ ...prev, total: 'Ingresa primero el monto total del pago' }));
      return;
    }
    setSelections(autoDistribute(total, invoices));
    setErrors((prev) => ({ ...prev, total: '', abonos: '' }));
  };

  const clearSelections = () => {
    setSelections({});
    setErrors((prev) => ({ ...prev, abonos: '' }));
  };

  const handleDateChange = (event) => {
    setDate(event.target.value);
    setErrors((prev) => ({ ...prev, fecha: '' }));
  };

  const handleMetodoPagoChange = (event) => {
    setMetodoPago(event.target.value);
  };

  const handleNotasChange = (event) => {
    setNotas(event.target.value);
    setErrors((prev) => ({ ...prev, notas: '' }));
  };

  return {
    isOpen,
    open,
    close,
    customerSearch,
    showDropdown,
    setShowDropdown,
    customer,
    date,
    totalCredit,
    selections,
    metodoPago,
    notas,
    errors,
    setErrors,
    filteredClientes,
    invoices,
    totalPendiente: summary.totalPendiente,
    totalAllocated: summary.totalAllocated,
    remaining: summary.remaining,
    selectCustomer,
    handleCustomerSearchChange,
    handleTotalCreditChange,
    toggleInvoice,
    changeAmount,
    payFull,
    autoDistributeCurrent,
    clearSelections,
    handleDateChange,
    handleMetodoPagoChange,
    handleNotasChange,
  };
};

export default useBatchPaymentState;
