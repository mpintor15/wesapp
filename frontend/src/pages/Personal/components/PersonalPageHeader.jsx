import PageHeader from '../../../components/PageHeader';

const PersonalPageHeader = ({
  canCreate,
  canCreateCuenta,
  canExport,
  onBack,
  onCreate,
  onCreateCuenta,
  onExport,
  onRefresh,
}) => (
  <PageHeader
    title="Personal"
    onBack={onBack}
    onRefresh={onRefresh}
    actions={
      <>
        {canCreate ? (
          <button className="btn btn-ghost btn-sm" onClick={onCreate} type="button">
            Crear nuevo colaborador
          </button>
        ) : null}
        {canCreateCuenta ? (
          <button className="btn btn-ghost btn-sm" onClick={onCreateCuenta} type="button">
            Crear cuenta de módulo
          </button>
        ) : null}
        {canExport ? (
          <button className="btn btn-ghost btn-sm" onClick={onExport} type="button">
            Generar reporte de Personal
          </button>
        ) : null}
      </>
    }
  />
);

export default PersonalPageHeader;
