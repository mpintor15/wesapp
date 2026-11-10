import PropTypes from 'prop-types';

export const NIVEL_LABELS = { ninguno: 'Sin acceso', ver: 'Solo lectura', editar: 'Edición' };

// Resumen corto para la tabla: "3 tabs · 1 con edición".
export const summarizeAccesos = (accesos) => {
  if (!accesos) return 'Según su rol';
  const niveles = Object.values(accesos);
  if (niveles.length === 0) return 'Sin acceso';
  const edicion = niveles.filter((nivel) => nivel === 'editar').length;
  const tabs = `${niveles.length} ${niveles.length === 1 ? 'tab' : 'tabs'}`;
  return edicion > 0 ? `${tabs} · ${edicion} con edición` : `${tabs} · solo lectura`;
};

// Matriz módulo → tab → nivel. `value` es { '<tab>': 'ver' | 'editar' }; sin entrada = sin acceso.
const CuentaAccesosMatrix = ({ catalogo, value, onChange, disabled }) => {
  const setNivel = (tabId, nivel) => {
    const next = { ...value };
    if (nivel === 'ninguno') delete next[tabId];
    else next[tabId] = nivel;
    onChange(next);
  };

  return (
    <div className="cuenta-accesos">
      {catalogo.map((modulo) => (
        <fieldset key={modulo.id} className="cuenta-accesos__modulo" disabled={disabled}>
          <legend>{modulo.label}</legend>
          {modulo.tabs.map((tab) => {
            const nivel = value[tab.id] || 'ninguno';
            const niveles = tab.puedeEditar ? ['ninguno', 'ver', 'editar'] : ['ninguno', 'ver'];
            return (
              <div key={tab.id} className="cuenta-accesos__tab">
                <span className="cuenta-accesos__tab-label">{tab.label}</span>
                <div
                  className="cuenta-accesos__niveles"
                  role="radiogroup"
                  aria-label={`${modulo.label} · ${tab.label}`}
                >
                  {niveles.map((opcion) => (
                    <label
                      key={opcion}
                      className={`cuenta-accesos__nivel${nivel === opcion ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`acceso-${tab.id}`}
                        checked={nivel === opcion}
                        onChange={() => setNivel(tab.id, opcion)}
                      />
                      {NIVEL_LABELS[opcion]}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
};

CuentaAccesosMatrix.propTypes = {
  catalogo: PropTypes.arrayOf(PropTypes.object).isRequired,
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default CuentaAccesosMatrix;
