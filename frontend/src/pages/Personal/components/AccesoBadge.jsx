import { getTipoUsuarioLabel } from '../utils/usuariosHelpers';

const AccesoBadge = ({ acceso }) => {
  if (!acceso?.tiene_usuario) {
    return <span className="badge badge-inactive">Sin acceso</span>;
  }

  const label = acceso.pendiente
    ? 'Pendiente'
    : acceso.activo
      ? getTipoUsuarioLabel(acceso.tipo_usuario)
      : 'Inactivo';
  const variant = acceso.pendiente ? 'pending' : acceso.activo ? 'active' : 'inactive';

  return (
    <span className={`badge badge-${variant}`} title={acceso.usuario ? `@${acceso.usuario}` : ''}>
      {label}
    </span>
  );
};

export default AccesoBadge;
