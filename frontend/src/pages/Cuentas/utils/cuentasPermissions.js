export const getCuentasPermissions = (user) => {
  const hasAdministrativeRole = user?.tipo_usuario === 'gerente';

  return {
    canCreateFactura: hasAdministrativeRole,
    canEditFactura: hasAdministrativeRole,
    canCancelFactura: hasAdministrativeRole,
    canDeleteFactura: hasAdministrativeRole,
    canExportReportes: true,
    canCreatePago: true,
    canManageClientes: true,
  };
};
