import Clientes from '../Clientes';
import { CuentasLoading } from './CuentasStatus';

const ClientesTab = ({
  clientes,
  loading,
  showClienteForm,
  setShowClienteForm,
  onClienteCreated,
  onClienteDeleted,
}) => (
  <div className="tab-content">
    {loading ? (
      <CuentasLoading message="Cargando clientes…" />
    ) : (
      <Clientes
        clientes={clientes}
        onClienteCreated={onClienteCreated}
        onClienteDeleted={onClienteDeleted}
        showClienteForm={showClienteForm}
        setShowClienteForm={setShowClienteForm}
      />
    )}
  </div>
);

export default ClientesTab;
