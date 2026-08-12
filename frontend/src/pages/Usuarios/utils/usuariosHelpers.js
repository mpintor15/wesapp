export const TIPOS_USUARIO = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'secretario', label: 'Secretario' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'contador', label: 'Contador' },
  { value: 'guardia', label: 'Guardia' },
  { value: 'monitorista', label: 'Monitorista' },
];

export const EMPTY_USUARIOS_FILTERS = { search: '', tipo_usuario: '', activo: '' };

export const EMPTY_CREATE_USER_FORM = {
  nombre: '',
  apellido: '',
  usuario: '',
  tipo_usuario: 'secretario',
  colaborador_id: '',
};

export const EMPTY_EDIT_USER_FORM = {
  nombre: '',
  apellido: '',
  tipo_usuario: 'secretario',
  activo: true,
  colaborador_id: '',
};

export const getStatusLabel = (usuario) => {
  if (usuario.primer_login) return 'Pendiente';
  return usuario.activo ? 'Activo' : 'Inactivo';
};

export const getStatusKey = (usuario) => {
  if (usuario.primer_login) return 'pending';
  return usuario.activo ? 'active' : 'inactive';
};

export const isPendingUser = (usuario) => Boolean(usuario.primer_login);

export const fullName = (usuario) =>
  [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || '—';

export const validateCreateForm = (data) => {
  const errors = {};
  if (!data.nombre.trim()) errors.nombre = 'Ingresa el nombre';
  if (!data.apellido.trim()) errors.apellido = 'Ingresa el apellido';
  if (!data.usuario.trim()) errors.usuario = 'Ingresa el usuario';
  if (!data.tipo_usuario) errors.tipo_usuario = 'Selecciona el tipo de usuario';
  return errors;
};

export const sortByField = (rows, field, direction) => {
  const dir = direction === 'desc' ? -1 : 1;
  return [...rows].sort(
    (a, b) =>
      String(a[field] || '')
        .trim()
        .localeCompare(String(b[field] || '').trim(), 'es', { sensitivity: 'base' }) * dir
  );
};

export const getNextSortState = (currentSort, field) => ({
  field,
  direction: currentSort.field === field && currentSort.direction === 'asc' ? 'desc' : 'asc',
});

export const buildFilterParams = (currentFilters) => {
  const params = {};
  if (currentFilters.search) params.search = currentFilters.search;
  if (currentFilters.tipo_usuario) params.tipo_usuario = currentFilters.tipo_usuario;
  if (currentFilters.activo) params.activo = currentFilters.activo;
  return params;
};

export const getEditUserFormData = (usuario) => ({
  nombre: usuario.nombre || '',
  apellido: usuario.apellido || '',
  tipo_usuario: usuario.tipo_usuario,
  activo: usuario.activo,
  colaborador_id: usuario.colaborador_id ? String(usuario.colaborador_id) : '',
});

export const getTipoUsuarioLabel = (tipoUsuario) =>
  TIPOS_USUARIO.find((tipo) => tipo.value === tipoUsuario)?.label ?? tipoUsuario;

export const buildInvitationMessage = (nombre, apellido, usuario, tempPassword) => {
  const url = globalThis.location.origin;
  return `Hola ${nombre} ${apellido}, te damos la bienvenida al sistema WES Security.

A continuación tus datos de acceso:

  Usuario: ${usuario}
  Contraseña temporal: ${tempPassword}

Enlace de ingreso:
  ${url}

Pasos para entrar:
1. Abre el enlace desde cualquier dispositivo o computador.
2. Ingresa tu usuario y contraseña temporal.
3. Al iniciar sesión por primera vez, el sistema te pedirá crear tu propia contraseña segura.

Nota: la contraseña temporal es de un solo uso. Cámbiala en tu primer ingreso.`;
};
