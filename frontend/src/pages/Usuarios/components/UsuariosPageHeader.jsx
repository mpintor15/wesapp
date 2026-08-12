import PageHeader from '../../../components/PageHeader';

const UsuariosPageHeader = ({ canCreate, onBack, onCreate, onRefresh }) => (
  <PageHeader
    title="Usuarios"
    onBack={onBack}
    onRefresh={onRefresh}
    actions={
      canCreate ? (
        <button className="btn btn-ghost btn-sm" onClick={onCreate} type="button">
          Crear nuevo usuario
        </button>
      ) : null
    }
  />
);

export default UsuariosPageHeader;
