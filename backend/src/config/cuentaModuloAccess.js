const { PERMISSIONS: P } = require('./permissions');

// Catálogo de lo que se puede conceder a una cuenta de módulo: módulo → tabs.
// "ver" habilita la consulta del tab; "editar" suma las acciones que modifican datos.
// Personal y Usuarios nunca se ofrecen: una cuenta compartida no administra accesos.
const MODULOS_CUENTA = [
  {
    id: 'clientes',
    label: 'Clientes',
    tabs: [
      {
        id: 'clientes.directorio',
        label: 'Directorio',
        ver: [P.CLIENTES_VER],
        editar: [
          P.CLIENTES_CREAR,
          P.CLIENTES_EDITAR,
          P.CLIENTES_ELIMINAR,
          P.CLIENTES_ACCESO_PORTAL_CREAR,
          P.CLIENTES_ACCESO_PORTAL_ADMINISTRAR,
        ],
      },
      {
        id: 'clientes.ubicaciones',
        label: 'Ubicaciones',
        ver: [P.INVENTARIO_UBICACIONES_VER],
        editar: [
          P.INVENTARIO_UBICACIONES_CREAR,
          P.INVENTARIO_UBICACIONES_EDITAR,
          P.INVENTARIO_UBICACIONES_ELIMINAR,
          P.INVENTARIO_UBICACIONES_REASIGNAR_CLIENTE,
        ],
      },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    tabs: [
      {
        id: 'inventario.articulos',
        label: 'Artículos',
        ver: [P.INVENTARIO_ARTICULOS_VER],
        editar: [
          P.INVENTARIO_ARTICULOS_CREAR,
          P.INVENTARIO_ARTICULOS_EDITAR,
          P.INVENTARIO_ARTICULOS_ELIMINAR,
          P.INVENTARIO_ARTICULOS_DAR_BAJA,
        ],
      },
      {
        id: 'inventario.movimientos',
        label: 'Movimientos',
        ver: [P.INVENTARIO_MOVIMIENTOS_VER],
        editar: [
          P.INVENTARIO_MOVIMIENTOS_CREAR,
          P.INVENTARIO_MOVIMIENTOS_ANULAR,
          P.INVENTARIO_MOVIMIENTOS_ELIMINAR,
          P.INVENTARIO_MOVIMIENTOS_REGENERAR_PDF,
        ],
      },
      {
        id: 'inventario.bajas',
        label: 'Bajas',
        ver: [P.INVENTARIO_BAJAS_VER],
        editar: [P.INVENTARIO_BAJAS_CREAR, P.INVENTARIO_BAJAS_ANULAR, P.INVENTARIO_BAJAS_ELIMINAR],
      },
    ],
  },
  {
    id: 'bitacoras',
    label: 'Bitácoras',
    // Registro y Visitas comparten el permiso de consulta del historial; el módulo de
    // Bitácoras los muestra juntos. Registrar y publicar formularios exige un colaborador.
    tabs: [
      {
        id: 'bitacoras.registro',
        label: 'Bitácoras',
        ver: [P.BITACORAS_HISTORIAL_VER, P.BITACORAS_PUNTOS_VER_TODOS],
        editar: [P.BITACORAS_REGISTRO_CREAR],
      },
      {
        id: 'bitacoras.visitas',
        label: 'Visitas',
        ver: [P.BITACORAS_HISTORIAL_VER, P.BITACORAS_PUNTOS_VER_TODOS],
        editar: [P.BITACORAS_REGISTRO_CREAR],
      },
      {
        id: 'bitacoras.formularios',
        label: 'Formularios',
        ver: [P.BITACORAS_FORMULARIOS_ADMINISTRAR],
        editar: [P.BITACORAS_FORMULARIOS_GESTIONAR],
      },
    ],
  },
  {
    id: 'cuentas',
    label: 'Cuentas',
    tabs: [
      {
        id: 'cuentas.clientes',
        label: 'Clientes',
        ver: [P.CUENTAS_CLIENTES_VER],
        editar: [P.CUENTAS_CLIENTES_CREAR, P.CUENTAS_CLIENTES_EDITAR, P.CUENTAS_CLIENTES_ELIMINAR],
      },
      {
        id: 'cuentas.facturas',
        label: 'Facturas',
        ver: [P.CUENTAS_FACTURAS_VER],
        editar: [
          P.CUENTAS_FACTURAS_CREAR,
          P.CUENTAS_FACTURAS_EDITAR,
          P.CUENTAS_FACTURAS_CANCELAR,
          P.CUENTAS_FACTURAS_ELIMINAR,
        ],
      },
      {
        id: 'cuentas.pagos',
        label: 'Pagos',
        ver: [P.CUENTAS_PAGOS_VER],
        editar: [P.CUENTAS_PAGOS_CREAR, P.CUENTAS_PAGOS_ANULAR, P.CUENTAS_PAGOS_ELIMINAR],
      },
      {
        id: 'cuentas.abonos',
        label: 'Abonos',
        ver: [P.CUENTAS_ABONOS_VER],
        editar: [P.CUENTAS_ABONOS_CREAR, P.CUENTAS_ABONOS_ELIMINAR],
      },
    ],
  },
];

const NIVELES = ['ver', 'editar'];

const TABS_BY_ID = new Map(MODULOS_CUENTA.flatMap((modulo) => modulo.tabs).map((t) => [t.id, t]));

// { 'inventario.articulos': 'editar' } → lista plana de permisos (editar incluye ver).
const expandAccesos = (accesos) => {
  const permisos = new Set();
  Object.entries(accesos || {}).forEach(([tabId, nivel]) => {
    const tab = TABS_BY_ID.get(tabId);
    if (!tab) {
      return;
    }
    tab.ver.forEach((permiso) => permisos.add(permiso));
    if (nivel === 'editar') {
      tab.editar.forEach((permiso) => permisos.add(permiso));
    }
  });
  return [...permisos];
};

// Devuelve un mensaje de error o null. `canGrant(permiso)` indica si quien concede lo posee.
const validateAccesos = (accesos, canGrant) => {
  for (const [tabId, nivel] of Object.entries(accesos || {})) {
    const tab = TABS_BY_ID.get(tabId);
    if (!tab) {
      return `Acceso desconocido: ${tabId}`;
    }
    if (!NIVELES.includes(nivel)) {
      return `Nivel de acceso inválido para ${tab.label}`;
    }
    if (nivel === 'editar' && tab.editar.length === 0) {
      return `${tab.label} solo admite consulta`;
    }
    const needed = expandAccesos({ [tabId]: nivel });
    if (!needed.every(canGrant)) {
      return `No puedes conceder acceso a ${tab.label} porque tú no lo tienes`;
    }
  }
  return null;
};

// Permisos efectivos de una fila de `usuarios`: solo las cuentas de módulo con accesos
// definidos tienen lista explícita; el resto usa los de su rol (undefined).
const permisosDeUsuario = (row) =>
  row?.es_cuenta_compartida && row.accesos_cuenta ? expandAccesos(row.accesos_cuenta) : undefined;

module.exports = { MODULOS_CUENTA, expandAccesos, validateAccesos, permisosDeUsuario };
