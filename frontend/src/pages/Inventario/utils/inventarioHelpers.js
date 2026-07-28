export const ROWS_PER_PAGE = 50;

export const INVENTARIO_TIPOS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'equipo', label: 'Equipo' },
  { value: 'placa_balistica', label: 'Placa Balística' },
  { value: 'arma', label: 'Arma' },
  { value: 'radio', label: 'Radio' },
  { value: 'otro', label: 'Otro' },
];

export const ARTICULO_TIPOS = INVENTARIO_TIPOS.filter((tipo) => tipo.value);

export const INVENTARIO_ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'sin_alerta', label: 'Sin alerta' },
  { value: 'vigente', label: 'Vigente' },
  { value: 'proxima_a_vencer', label: 'Próxima a vencer' },
  { value: 'vencida', label: 'Vencida' },
];

export const isStockTipo = (tipo) => tipo === 'equipo' || tipo === 'otro';

export const ESTADO_OPERATIVO_LABELS = {
  ACTIVO: 'Activo',
  ANULADO: 'Anulado',
  ELIMINADO: 'Eliminado administrativamente',
};

export const REVERSAL_STATUS_LABELS = {
  COMPLETE: 'Reversible',
  INCOMPLETE: 'Histórico no reversible',
  ALREADY_VOIDED: 'Ya anulado',
  ADMINISTRATIVELY_DELETED: 'Eliminado administrativamente',
};

export const getEstadoOperativo = (estado) => String(estado || 'ACTIVO').toUpperCase();

export const getEstadoOperativoLabel = (estado) =>
  ESTADO_OPERATIVO_LABELS[getEstadoOperativo(estado)] || getEstadoOperativo(estado);

export const getEstadoOperativoClass = (estado) => {
  const normalized = getEstadoOperativo(estado);
  if (normalized === 'ANULADO') return 'status-badge--warning';
  if (normalized === 'ELIMINADO') return 'status-badge--danger';
  return 'status-badge--success';
};

export const getReversalStatus = (record) =>
  String(record?.reversal_status || (record?.reversible ? 'COMPLETE' : 'INCOMPLETE')).toUpperCase();

export const canVoidRecord = (record) =>
  getEstadoOperativo(record?.estado) === 'ACTIVO' &&
  record?.reversible === true &&
  getReversalStatus(record) === 'COMPLETE';

export const canDeleteAdminRecord = (record) => getEstadoOperativo(record?.estado) === 'ANULADO';

export const getNonReversibleReason = (record, entity = 'movimiento') => {
  const estado = getEstadoOperativo(record?.estado);
  const status = getReversalStatus(record);
  if (estado === 'ANULADO') return `Este ${entity} ya fue anulado.`;
  if (estado === 'ELIMINADO') return `Este ${entity} fue eliminado administrativamente.`;
  if (status === 'INCOMPLETE') {
    return `Este ${entity} histórico no puede anularse automáticamente porque no contiene trazabilidad completa de stock.`;
  }
  return `Este ${entity} no puede anularse en su estado actual.`;
};

export const validateMotivoAdministrativo = (value) => {
  const motivo = typeof value === 'string' ? value.trim() : '';
  if (!motivo) return 'Ingresa un motivo';
  if (motivo.length < 10) return 'El motivo debe tener al menos 10 caracteres';
  if (motivo.length > 500) return 'El motivo no puede exceder 500 caracteres';
  return '';
};

export const getMovimientoActionState = (movimiento, permissions) => {
  if (getEstadoOperativo(movimiento?.estado) === 'ELIMINADO') {
    return {
      canDownloadPdf: false,
      canRegeneratePdf: false,
      canVoid: false,
      canDelete: false,
      showDisabledVoid: false,
      disabledVoidReason: '',
      hasAnyAction: false,
    };
  }

  const canDownloadPdf = permissions.can('movimientos.pdf.download');
  const canRegeneratePdf = permissions.can('movimientos.pdf.regenerate');
  const canVoid = permissions.can('movimientos.void') && canVoidRecord(movimiento);
  const canDelete = permissions.can('movimientos.deleteAdmin') && canDeleteAdminRecord(movimiento);
  const showDisabledVoid =
    permissions.can('movimientos.void') &&
    getEstadoOperativo(movimiento?.estado) === 'ACTIVO' &&
    !canVoid;

  return {
    canDownloadPdf,
    canRegeneratePdf,
    canVoid,
    canDelete,
    showDisabledVoid,
    disabledVoidReason: showDisabledVoid ? getNonReversibleReason(movimiento, 'movimiento') : '',
    hasAnyAction: canDownloadPdf || canRegeneratePdf || canVoid || canDelete || showDisabledVoid,
  };
};

export const getBajaActionState = (baja, permissions) => {
  if (getEstadoOperativo(baja?.estado) === 'ELIMINADO') {
    return {
      canVoid: false,
      canDelete: false,
      showDisabledVoid: false,
      disabledVoidReason: '',
      hasAnyAction: false,
    };
  }

  const canVoid = permissions.can('bajas.void') && canVoidRecord(baja);
  const canDelete = permissions.can('bajas.deleteAdmin') && canDeleteAdminRecord(baja);
  const showDisabledVoid =
    permissions.can('bajas.void') && getEstadoOperativo(baja?.estado) === 'ACTIVO' && !canVoid;

  return {
    canVoid,
    canDelete,
    showDisabledVoid,
    disabledVoidReason: showDisabledVoid ? getNonReversibleReason(baja, 'baja') : '',
    hasAnyAction: canVoid || canDelete || showDisabledVoid,
  };
};

export const EMPTY_ARTICULO_FORM = {
  tipo_articulo: '',
  nombre_articulo: '',
  cantidad: '',
  talla: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  calibre: '',
  fecha_caducidad: '',
  cliente_id: '',
  ubicacion_id: '',
  ubicacion_nombre: '',
  codigo_pantalla: '',
  codigo_radio: '',
  version: '',
};

export const EMPTY_ARTICULOS_FILTERS = {
  tipo: '',
  ubicacion_id: '',
  estado: '',
  search: '',
};

export const EMPTY_MOVIMIENTOS_FILTERS = {
  search: '',
  destino_id: '',
  from: '',
  to: '',
};

export const EMPTY_BAJAS_FILTERS = {
  search: '',
  from: '',
  to: '',
};

export const EMPTY_BAJAS_EXPORT_FILTERS = {
  from: '',
  to: '',
};

export const EMPTY_ARTICULOS_EXPORT_FILTERS = {
  tipo: '',
  ubicacion_id: '',
  estado: '',
};

export const EMPTY_MOVIMIENTOS_EXPORT_FILTERS = {
  destino_id: '',
  from: '',
  to: '',
};

export const createMovimientoForm = () => ({
  tipo_movimiento: 'traslado',
  fecha_movimiento: getTodayLocalISO(),
  cliente_destino_id: '',
  ubicacion_destino_id: '',
  ubicacion_destino_nombre: '',
  items: [{ articulo_id: '', cantidad: 1, talla: '' }],
});

export const getTodayLocalISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateSafe = (dateStr) => {
  if (!dateStr) return null;
  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (dateStr) => {
  const parsed = parseDateSafe(dateStr);
  if (!parsed) return '-';
  return parsed.toLocaleDateString('es-EC');
};

export const getTipoLabel = (tipo) => {
  const found = INVENTARIO_TIPOS.find((item) => item.value === tipo);
  return found ? found.label : tipo;
};

export const getCaducidadClass = (estado) => {
  if (estado === 'vencida') return 'is-expired';
  if (estado === 'proxima_a_vencer') return 'is-warning';
  return '';
};

export const getSerieDisplay = (articulo) =>
  articulo.tipo_articulo === 'radio' ? articulo.codigo_radio || '-' : articulo.numero_serie || '-';

export const getArticuloLabel = (articulo) => {
  const name = articulo.nombre_articulo || 'Artículo';
  const ubicacion = articulo.ubicacion_nombre ? ` (${articulo.ubicacion_nombre})` : '';
  const serieValue =
    articulo.tipo_articulo === 'radio' ? articulo.codigo_radio : articulo.numero_serie;
  const serie = serieValue ? ` - ${serieValue}` : '';
  const talla = articulo.talla ? ` | Talla: ${articulo.talla}` : '';
  const cant =
    isStockTipo(articulo.tipo_articulo) && articulo.cantidad ? ` [x${articulo.cantidad}]` : '';
  return `${name}${serie}${talla}${cant}${ubicacion}`;
};

export const getArticuloTypeFormData = (currentFormData, nextTipo) => {
  const base = { ...currentFormData, tipo_articulo: nextTipo };

  if (nextTipo === 'equipo' || nextTipo === 'otro') {
    return {
      ...base,
      nombre_articulo: '',
      marca: '',
      modelo: '',
      numero_serie: '',
      calibre: '',
      fecha_caducidad: '',
      codigo_pantalla: '',
      codigo_radio: '',
      version: '',
    };
  }

  if (nextTipo === 'placa_balistica') {
    return {
      ...base,
      nombre_articulo: 'Placa Balística',
      cantidad: '',
      talla: '',
      marca: '',
      modelo: '',
      calibre: '',
      codigo_pantalla: '',
      codigo_radio: '',
      version: '',
    };
  }

  if (nextTipo === 'arma') {
    return {
      ...base,
      nombre_articulo: '',
      cantidad: '',
      talla: '',
      fecha_caducidad: '',
      codigo_pantalla: '',
      codigo_radio: '',
      version: '',
    };
  }

  if (nextTipo === 'radio') {
    return {
      ...base,
      nombre_articulo: 'Radio',
      cantidad: '',
      talla: '',
      numero_serie: '',
      calibre: '',
      fecha_caducidad: '',
    };
  }

  return base;
};

export const validateArticuloForm = (formData) => {
  const errors = {};
  if (!formData.tipo_articulo) errors.tipo_articulo = 'Selecciona un tipo de artículo';
  if (!formData.nombre_articulo.trim()) errors.nombre_articulo = 'Ingresa el nombre del artículo';
  if (!formData.cliente_id && !formData.ubicacion_id) errors.cliente_id = 'Selecciona un cliente';
  if (!formData.ubicacion_id && !formData.ubicacion_nombre.trim()) {
    errors.ubicacion_nombre = 'Selecciona la ubicación';
  }
  if (isStockTipo(formData.tipo_articulo) && !formData.cantidad) {
    errors.cantidad = 'Ingresa la cantidad';
  }
  if (formData.tipo_articulo === 'placa_balistica' && !formData.numero_serie.trim()) {
    errors.numero_serie = 'Ingresa el número de serie';
  }
  if (formData.tipo_articulo === 'placa_balistica' && !formData.fecha_caducidad) {
    errors.fecha_caducidad = 'Ingresa la fecha de caducidad';
  }
  if (formData.tipo_articulo === 'arma' && !formData.marca.trim()) {
    errors.marca = 'Ingresa la marca';
  }
  if (formData.tipo_articulo === 'arma' && !formData.numero_serie.trim()) {
    errors.numero_serie = 'Ingresa el número de serie';
  }
  if (formData.tipo_articulo === 'arma' && !formData.calibre.trim()) {
    errors.calibre = 'Ingresa el calibre';
  }
  if (formData.tipo_articulo === 'radio' && !formData.codigo_pantalla.trim()) {
    errors.codigo_pantalla = 'Ingresa el código de pantalla';
  }
  if (formData.tipo_articulo === 'radio' && !formData.codigo_radio.trim()) {
    errors.codigo_radio = 'Ingresa el número de serie';
  }
  if (formData.tipo_articulo === 'radio' && !formData.version.trim()) {
    errors.version = 'Ingresa la versión';
  }
  if (formData.tipo_articulo === 'radio' && !formData.modelo.trim()) {
    errors.modelo = 'Ingresa el modelo';
  }
  if (formData.tipo_articulo === 'radio' && !formData.marca.trim()) {
    errors.marca = 'Ingresa la marca';
  }
  return errors;
};

export const buildArticuloPayload = (formData) => {
  let cantidadFinal = formData.cantidad ? Number.parseInt(formData.cantidad, 10) : null;
  if (!cantidadFinal && !isStockTipo(formData.tipo_articulo)) {
    cantidadFinal = 1;
  }
  return { ...formData, cantidad: cantidadFinal };
};

export const validateMovimientoForm = (movimientoForm) => {
  const errors = {};
  if (!movimientoForm.tipo_movimiento) {
    errors.tipo_movimiento = 'Selecciona un tipo de movimiento';
  }
  if (!movimientoForm.fecha_movimiento) {
    errors.fecha_movimiento = 'Selecciona la fecha del movimiento';
  }
  if (movimientoForm.items.some((item) => !item.articulo_id)) {
    errors.items = 'Selecciona los artículos del movimiento';
  }
  if (!movimientoForm.cliente_destino_id) {
    errors.cliente_destino_id = 'Selecciona el cliente destino';
  }
  if (!movimientoForm.ubicacion_destino_id && !movimientoForm.ubicacion_destino_nombre.trim()) {
    errors.ubicacion_destino_nombre = 'Ingresa la ubicación destino';
  }
  return errors;
};

export const buildMovimientoPayload = (movimientoForm) => {
  const payload = {
    cliente_destino_id: Number.parseInt(movimientoForm.cliente_destino_id, 10),
    fecha_movimiento: movimientoForm.fecha_movimiento,
    items: movimientoForm.items.map((item) => ({
      articulo_id: Number.parseInt(item.articulo_id, 10),
      cantidad: item.cantidad ? Number.parseInt(item.cantidad, 10) : 1,
      talla: item.talla || '',
    })),
  };

  if (movimientoForm.ubicacion_destino_id) {
    payload.ubicacion_destino_id = Number.parseInt(movimientoForm.ubicacion_destino_id, 10);
  } else {
    payload.ubicacion_destino_nombre = movimientoForm.ubicacion_destino_nombre;
  }

  return payload;
};

export const updateMovimientoItem = (items, index, field, value) =>
  items.map((item, idx) => (idx === index ? { ...item, [field]: value } : item));

export const addMovimientoItem = (items) => [...items, { articulo_id: '', cantidad: 1, talla: '' }];

export const removeMovimientoItem = (items, index) => items.filter((_, idx) => idx !== index);

export const updateIndexedValue = (values, index, nextValue) =>
  values.map((value, idx) => (idx === index ? nextValue : value));

export const filterArticulosForMovimiento = (articulos, searchTerm) => {
  if (!searchTerm.trim()) return articulos;
  const term = searchTerm.toLowerCase();
  return articulos.filter((articulo) => getArticuloLabel(articulo).toLowerCase().includes(term));
};

export const validateBajaForm = (bajaTarget, bajaForm) => {
  const cantidad = isStockTipo(bajaTarget.tipo_articulo)
    ? Number.parseInt(bajaForm.cantidad, 10)
    : 1;
  const motivoError = validateMotivoAdministrativo(bajaForm.motivo);

  if (motivoError) {
    return { message: motivoError };
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return { message: 'Ingresa una cantidad válida' };
  }
  if (isStockTipo(bajaTarget.tipo_articulo) && cantidad > Number(bajaTarget.cantidad || 0)) {
    return { message: 'La cantidad supera el stock disponible' };
  }

  return null;
};

export const buildBajaPayload = (bajaTarget, bajaForm) => ({
  cantidad: isStockTipo(bajaTarget.tipo_articulo) ? Number.parseInt(bajaForm.cantidad, 10) : 1,
  motivo: bajaForm.motivo.trim(),
});

export const buildArticuloFilterParams = (filters) => {
  const params = {};
  if (filters.tipo) params.tipo = filters.tipo;
  if (filters.ubicacion_id) params.ubicacion_id = filters.ubicacion_id;
  if (filters.estado) params.estado = filters.estado;
  if (filters.search) params.search = filters.search;
  return params;
};

export const buildBajasFilterParams = (filters) => {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return params;
};

export const buildArticulosExportParams = (filters) => {
  const params = {};
  if (filters.tipo) params.tipo = filters.tipo;
  if (filters.ubicacion_id) params.ubicacion_id = filters.ubicacion_id;
  if (filters.estado) params.estado = filters.estado;
  return params;
};

export const buildMovimientosExportParams = (filters) => {
  const params = {};
  if (filters.destino_id) params.destino_id = filters.destino_id;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return params;
};

export const getNextSortState = (currentSort, field) => {
  if (currentSort.field === field) {
    return { field, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: 'asc' };
};

export const paginateRows = (rows, page, rowsPerPage = ROWS_PER_PAGE) =>
  rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

export const getTotalPages = (rows, rowsPerPage = ROWS_PER_PAGE) =>
  Math.max(1, Math.ceil(rows.length / rowsPerPage));

const getString = (value) => String(value || '').trim();

const getNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const getDateTime = (value) => {
  if (!value) return Number.NaN;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : Number.NaN;
};

const compareMissingLast = (aMissing, bMissing) => {
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return null;
};

export const sortArticulos = (articulos, sort) => {
  const rows = [...articulos];
  rows.sort((a, b) => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const field = sort.field;

    if (field === 'cantidad') {
      const aNum = getNumber(a.cantidad);
      const bNum = getNumber(b.cantidad);
      const missing = compareMissingLast(Number.isNaN(aNum), Number.isNaN(bNum));
      if (missing !== null) return missing;
      return (aNum - bNum) * direction;
    }

    if (field === 'fecha_caducidad') {
      const aDate = getDateTime(a.fecha_caducidad);
      const bDate = getDateTime(b.fecha_caducidad);
      const missing = compareMissingLast(Number.isNaN(aDate), Number.isNaN(bDate));
      if (missing !== null) return missing;
      return (aDate - bDate) * direction;
    }

    if (field === 'serie') {
      const aStr = getString(a.tipo_articulo === 'radio' ? a.codigo_radio : a.numero_serie);
      const bStr = getString(b.tipo_articulo === 'radio' ? b.codigo_radio : b.numero_serie);
      const missing = compareMissingLast(!aStr, !bStr);
      if (missing !== null) return missing;
      return aStr.localeCompare(bStr, 'es', { sensitivity: 'base', numeric: true }) * direction;
    }

    const aStr = getString(a[field]);
    const bStr = getString(b[field]);
    const missing = compareMissingLast(!aStr, !bStr);
    if (missing !== null) return missing;
    return aStr.localeCompare(bStr, 'es', { sensitivity: 'base', numeric: true }) * direction;
  });
  return rows;
};

export const filterMovimientos = (movimientos, filters) =>
  movimientos.filter((mov) => {
    const q = filters.search.trim().toLowerCase();
    const searchable = [mov.articulos_movidos, mov.ubicacion_origen, mov.usuario]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (q && !searchable.includes(q)) return false;

    if (
      filters.destino_id &&
      String(mov.ubicacion_destino_id || '') !== String(filters.destino_id)
    ) {
      return false;
    }

    const movDate = parseDateSafe(mov.fecha_movimiento);
    if (!movDate) return false;

    if (filters.from) {
      const fromDate = parseDateSafe(filters.from);
      if (fromDate && movDate < fromDate) return false;
    }

    if (filters.to) {
      const toDate = parseDateSafe(filters.to);
      if (toDate && movDate > toDate) return false;
    }

    return true;
  });

export const sortMovimientos = (movimientos, sort) => {
  const rows = [...movimientos];
  const direction = sort.direction === 'asc' ? 1 : -1;
  const field = sort.field;

  rows.sort((a, b) => {
    if (field === 'fecha_movimiento') {
      const aDate = parseDateSafe(a.fecha_movimiento)?.getTime() ?? Number.NaN;
      const bDate = parseDateSafe(b.fecha_movimiento)?.getTime() ?? Number.NaN;
      const missing = compareMissingLast(Number.isNaN(aDate), Number.isNaN(bDate));
      if (missing !== null) return missing;
      return (aDate - bDate) * direction;
    }

    if (field === 'items') {
      const aNum = Number(a.items);
      const bNum = Number(b.items);
      const aSafe = Number.isFinite(aNum) ? aNum : Number.NaN;
      const bSafe = Number.isFinite(bNum) ? bNum : Number.NaN;
      const missing = compareMissingLast(Number.isNaN(aSafe), Number.isNaN(bSafe));
      if (missing !== null) return missing;
      return (aSafe - bSafe) * direction;
    }

    const aStr = getString(a[field]);
    const bStr = getString(b[field]);
    const missing = compareMissingLast(!aStr, !bStr);
    if (missing !== null) return missing;
    return aStr.localeCompare(bStr, 'es', { sensitivity: 'base', numeric: true }) * direction;
  });

  return rows;
};
