export const ROWS_PER_PAGE = 25;

export const EMPTY_PERSONAL_FILTERS = { search: '', estado: '', cargo: '' };

export const EMPTY_PERSONAL_EXPORT_FILTERS = { estado: '', cargo: '' };

export const EMPTY_COLABORADOR_FORM = {
  nombres_completos: '',
  cedula: '',
  fecha_nacimiento: '',
  cargo: '',
  celular: '',
  banco: '',
  numero_cuenta: '',
  sueldo: '',
  estado: 'activo',
};

export const buildPersonalFilterParams = (currentFilters) => {
  const params = {};
  if (currentFilters.search) params.search = currentFilters.search;
  if (currentFilters.estado) params.estado = currentFilters.estado;
  if (currentFilters.cargo) params.cargo = currentFilters.cargo;
  return params;
};

export const buildPersonalExportParams = (exportFilters) => {
  const params = {};
  if (exportFilters.estado) params.estado = exportFilters.estado;
  if (exportFilters.cargo) params.cargo = exportFilters.cargo;
  return params;
};

export const getUniqueCargos = (colaboradores) => {
  const unique = Array.from(new Set((colaboradores || []).map((c) => c.cargo).filter(Boolean)));
  unique.sort((a, b) => a.localeCompare(b, 'es'));
  return unique;
};

export const getColaboradorFormData = (colaborador) => ({
  nombres_completos: colaborador.nombres_completos || '',
  cedula: colaborador.cedula || '',
  fecha_nacimiento: colaborador.fecha_nacimiento ? colaborador.fecha_nacimiento.split('T')[0] : '',
  cargo: colaborador.cargo || '',
  celular: colaborador.celular || '',
  banco: colaborador.banco || '',
  numero_cuenta: colaborador.numero_cuenta || '',
  sueldo: colaborador.sueldo ?? '',
  estado: colaborador.estado || 'activo',
});

// Celular, banco, número de cuenta y sueldo son obligatorios solo al CREAR
// (no al editar, para no romper colaboradores legacy que no los tienen).
// Banco/cuenta/sueldo además solo aplican a quien puede verlos y
// escribirlos (gerente/secretario); un supervisor puede crear sin ellos
// porque el backend nunca los aceptaría de su parte.
export const validateColaboradorForm = (
  formData,
  { isEditing = false, canAccessSensitive = true } = {}
) => {
  const errors = {};
  if (!formData.nombres_completos.trim()) errors.nombres_completos = 'Ingresa el nombre completo';
  if (!formData.cedula.trim()) errors.cedula = 'Ingresa la cédula';
  if (!formData.fecha_nacimiento) errors.fecha_nacimiento = 'Selecciona la fecha de nacimiento';
  if (!formData.cargo.trim()) errors.cargo = 'Ingresa el cargo';

  if (!isEditing) {
    if (!formData.celular.trim()) errors.celular = 'Ingresa el celular';

    if (canAccessSensitive) {
      if (!formData.banco.trim()) errors.banco = 'Ingresa el banco';
      if (!formData.numero_cuenta.trim()) errors.numero_cuenta = 'Ingresa el número de cuenta';
      const sueldoValue = Number(formData.sueldo);
      if (formData.sueldo === '' || formData.sueldo === null || formData.sueldo === undefined) {
        errors.sueldo = 'Ingresa el sueldo';
      } else if (!Number.isFinite(sueldoValue) || sueldoValue <= 0) {
        errors.sueldo = 'El sueldo no es válido';
      }
    }
  }

  return errors;
};

export const buildColaboradorPayload = (formData) => ({
  ...formData,
  sueldo: formData.sueldo ? Number.parseFloat(formData.sueldo) : null,
});

export const getNextSortState = (currentSort, field) => {
  if (currentSort.field === field) {
    return { field, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: 'asc' };
};

export const sortColaboradores = (colaboradores, tableSort) => {
  const rows = [...colaboradores];
  const direction = tableSort.direction === 'desc' ? -1 : 1;
  const field = tableSort.field || 'nombres_completos';

  rows.sort((a, b) => {
    if (field === 'sueldo') {
      const aNum = Number(a.sueldo || 0);
      const bNum = Number(b.sueldo || 0);
      return (aNum - bNum) * direction;
    }

    const aVal = String(a[field] || '').trim();
    const bVal = String(b[field] || '').trim();
    return aVal.localeCompare(bVal, 'es', { sensitivity: 'base', numeric: true }) * direction;
  });

  return rows;
};

export const getTotalPages = (rows, rowsPerPage = ROWS_PER_PAGE) =>
  Math.max(1, Math.ceil(rows.length / rowsPerPage));

export const paginateRows = (rows, page, rowsPerPage = ROWS_PER_PAGE) =>
  rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
