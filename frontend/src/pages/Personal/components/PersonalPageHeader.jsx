import PageHeader from '../../../components/PageHeader';

const PersonalPageHeader = ({ canCreate, canExport, onBack, onCreate, onExport, onRefresh }) => (
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
