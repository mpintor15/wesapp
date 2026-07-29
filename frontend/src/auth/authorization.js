import { KNOWN_PERMISSIONS } from './permissions';
import { ROLES, rolePermissions } from './rolePermissions';

const getExplicitPermissions = (user) => {
  const permissions = user?.permisos || user?.permissions;
  if (!Array.isArray(permissions)) return null;
  return permissions.filter((permission) => typeof permission === 'string' && permission.trim());
};

const hasFallbackPermission = (user, permission) => {
  if (user?.tipo_usuario === ROLES.GERENTE) return true;
  return Boolean(rolePermissions[user?.tipo_usuario]?.includes(permission));
};

export const can = (user, permission) => {
  if (!user?.id || user.activo === false || !user.tipo_usuario) return false;
  if (typeof permission !== 'string' || !KNOWN_PERMISSIONS.has(permission)) return false;

  const explicitPermissions = getExplicitPermissions(user);
  if (explicitPermissions) {
    return explicitPermissions.includes(permission);
  }

  return hasFallbackPermission(user, permission);
};

export const canAny = (user, permissions) => {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  if (list.length === 0) return false;
  return list.some((permission) => can(user, permission));
};

// Vacuous truth keeps composed guards predictable: no missing required permissions means allowed.
export const canAll = (user, permissions) => {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  return list.every((permission) => can(user, permission));
};
