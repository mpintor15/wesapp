const AccesoBadge = ({ acceso }) => {
  if (!acceso?.tiene_usuario || !acceso.activo) {
    return <span className="badge badge-inactive">Sin acceso</span>;
  }

  if (acceso.pendiente) {
    return (
      <span
        className="badge badge-pending"
        title={`Invitación pendiente${acceso.usuario ? ` · @${acceso.usuario}` : ''}`}
      >
        Pendiente
      </span>
    );
  }

  return (
    <span className="badge badge-active" title={acceso.usuario ? `@${acceso.usuario}` : ''}>
      Con acceso
    </span>
  );
};

export default AccesoBadge;
