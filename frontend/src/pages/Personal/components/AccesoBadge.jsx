const AccesoBadge = ({ acceso }) => {
  if (!acceso?.tiene_usuario || !acceso.activo) {
    return <span className="badge badge-inactive">Sin acceso</span>;
  }

  return (
    <span className="badge badge-active" title={acceso.usuario ? `@${acceso.usuario}` : ''}>
      Con acceso
    </span>
  );
};

export default AccesoBadge;
