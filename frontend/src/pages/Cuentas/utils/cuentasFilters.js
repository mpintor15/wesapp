import { formatMoney } from './cuentasFormatters';

export const toReportDate = (dateValue) => {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') {
    const normalized = dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00`;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const onlyDate = dateValue.split('T')[0];
    const fallback = new Date(`${onlyDate}T00:00:00`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const filterAndSortFacturas = (reporte, filters, sort) => {
  const rows = reporte.filter((row) => {
    const rowDate = toReportDate(row.fecha_factura);
    const startDate = toReportDate(filters.fechaInicio);
    const endDate = toReportDate(filters.fechaFin);

    if (startDate && rowDate && rowDate < startDate) return false;
    if (endDate && rowDate && rowDate > endDate) return false;
    if (filters.conSaldo && (row.cancelada || parseFloat(row.saldo_pendiente) <= 0)) return false;
    if (filters.estado === 'activa' && row.cancelada) return false;
    if (filters.estado === 'anulada' && !row.cancelada) return false;

    if (filters.search) {
      const search = filters.search.trim().toLowerCase();
      const matchFactura = String(row.num_factura || '')
        .toLowerCase()
        .includes(search);
      const matchCliente = String(row.cliente || '')
        .toLowerCase()
        .includes(search);
      if (!matchFactura && !matchCliente) return false;
    }

    return true;
  });

  if (sort.field) {
    return [...rows].sort((a, b) => {
      const direction = sort.direction === 'asc' ? 1 : -1;
      if (sort.field === 'num_factura') {
        return (Number(a.num_factura) - Number(b.num_factura)) * direction;
      }
      if (sort.field === 'cliente') {
        return (
          String(a.cliente || '').localeCompare(String(b.cliente || ''), 'es', {
            sensitivity: 'base',
            numeric: true,
          }) * direction
        );
      }
      if (sort.field === 'identificacion') {
        return (
          String(a.identificacion || '').localeCompare(String(b.identificacion || ''), 'es', {
            sensitivity: 'base',
            numeric: true,
          }) * direction
        );
      }
      if (sort.field === 'fecha_factura') {
        const aDate = toReportDate(a.fecha_factura)?.getTime() || 0;
        const bDate = toReportDate(b.fecha_factura)?.getTime() || 0;
        return (aDate - bDate) * direction;
      }
      return 0;
    });
  }

  if (!filters.ordenAlfabetico) return rows;

  const groups = new Map();
  for (const row of rows) {
    const groupKey = String(row.identificacion || row.cliente || '');
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(row);
  }

  const orderedGroups = Array.from(groups.values())
    .map((items) => ({
      items,
      minNumFactura: Math.min(
        ...items.map((item) => Number(item.num_factura) || Number.MAX_SAFE_INTEGER)
      ),
      cliente: String(items[0]?.cliente || ''),
    }))
    .sort((a, b) => {
      const byMinNum = a.minNumFactura - b.minNumFactura;
      if (byMinNum !== 0) return byMinNum;
      return a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base', numeric: true });
    });

  return orderedGroups.flatMap((group) =>
    group.items.sort((a, b) => Number(a.num_factura) - Number(b.num_factura))
  );
};

export const filterAndSortPagos = (pagos, filters, sort) => {
  const rows = pagos.filter((pago) => {
    const pagoDate = toReportDate(pago.fecha);
    const startDate = toReportDate(filters.fechaInicio);
    const endDate = toReportDate(filters.fechaFin);

    if (startDate && pagoDate && pagoDate < startDate) return false;
    if (endDate && pagoDate && pagoDate > endDate) return false;
    if (filters.metodoPago && String(pago.metodo_pago || '').toLowerCase() !== filters.metodoPago) {
      return false;
    }

    if (filters.search) {
      const search = filters.search.trim().toLowerCase();
      const total = Number(pago.total || 0);
      const matchCliente = String(pago.cliente || '')
        .toLowerCase()
        .includes(search);
      const matchValor =
        String(pago.total || '')
          .toLowerCase()
          .includes(search) ||
        total.toFixed(2).includes(search) ||
        formatMoney(total).toLowerCase().includes(search);
      if (!matchCliente && !matchValor) return false;
    }

    return true;
  });

  const getPagoCreatedTime = (pago) =>
    toReportDate(pago.created_at)?.getTime() || toReportDate(pago.fecha)?.getTime() || 0;

  if (filters.agruparCliente) {
    const groups = new Map();
    for (const row of rows) {
      const groupKey = String(row.cliente_id || row.identificacion || row.cliente || '');
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(row);
    }

    return Array.from(groups.values())
      .map((items) => ({
        cliente: String(items[0]?.cliente || ''),
        minCreatedAt: Math.min(
          ...items.map((item) => getPagoCreatedTime(item) || Number.MAX_SAFE_INTEGER)
        ),
        items,
      }))
      .sort((a, b) => {
        const byCliente = a.cliente.localeCompare(b.cliente, 'es', {
          sensitivity: 'base',
          numeric: true,
        });
        if (byCliente !== 0) return byCliente;
        return a.minCreatedAt - b.minCreatedAt;
      })
      .flatMap((group) =>
        group.items.sort((a, b) => {
          const byCreatedAt = getPagoCreatedTime(b) - getPagoCreatedTime(a);
          if (byCreatedAt !== 0) return byCreatedAt;
          return Number(b.id) - Number(a.id);
        })
      );
  }

  return [...rows].sort((a, b) => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    if (sort.field === 'fecha') {
      const aDate = toReportDate(a.fecha)?.getTime() || 0;
      const bDate = toReportDate(b.fecha)?.getTime() || 0;
      const byDate = (aDate - bDate) * direction;
      if (byDate !== 0) return byDate;
      return (Number(a.id) - Number(b.id)) * direction;
    }
    if (sort.field === 'total') {
      const byTotal = (Number(a.total || 0) - Number(b.total || 0)) * direction;
      if (byTotal !== 0) return byTotal;
      const bDate = toReportDate(b.fecha)?.getTime() || 0;
      const aDate = toReportDate(a.fecha)?.getTime() || 0;
      return bDate - aDate;
    }
    return 0;
  });
};

export const paginateRows = (rows, page, rowsPerPage) =>
  rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

export const calculateFacturaTotals = (facturas) =>
  facturas
    .filter((row) => !row.cancelada)
    .reduce(
      (acc, row) => ({
        subtotal: acc.subtotal + parseFloat(row.subtotal || 0),
        iva: acc.iva + parseFloat(row.iva || 0),
        total: acc.total + parseFloat(row.subtotal || 0) + parseFloat(row.iva || 0),
        retencion_fuente: acc.retencion_fuente + parseFloat(row.retencion_fuente || 0),
        retencion_iva: acc.retencion_iva + parseFloat(row.retencion_iva || 0),
        por_cobrar: acc.por_cobrar + parseFloat(row.por_cobrar || 0),
        total_abonos: acc.total_abonos + parseFloat(row.total_abonos || 0),
        saldo_pendiente: acc.saldo_pendiente + parseFloat(row.saldo_pendiente || 0),
      }),
      {
        subtotal: 0,
        iva: 0,
        total: 0,
        retencion_fuente: 0,
        retencion_iva: 0,
        por_cobrar: 0,
        total_abonos: 0,
        saldo_pendiente: 0,
      }
    );
