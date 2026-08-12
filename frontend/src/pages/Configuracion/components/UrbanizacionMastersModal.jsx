import React, { useCallback, useEffect, useState } from 'react';
import AppModal from '../../../components/AppModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import inventarioService from '../../../services/inventarioService';

const UrbanizacionMastersModal = ({ ubicacion, onClose }) => {
  const [manzanas, setManzanas] = useState([]);
  const [villasByManzana, setVillasByManzana] = useState({});
  const [residentesByVilla, setResidentesByVilla] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [manzanaNombre, setManzanaNombre] = useState('');
  const [villaDrafts, setVillaDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [residentTarget, setResidentTarget] = useState(null);
  const [residentDraft, setResidentDraft] = useState({ nombre: '', contacto: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const manzanasResult = await inventarioService.getManzanas(ubicacion.id);
    if (!manzanasResult.success) {
      setError(manzanasResult.message || 'No se pudieron cargar las Manzanas.');
      setLoading(false);
      return;
    }
    const villaResults = await Promise.all(
      manzanasResult.data.map(async (manzana) => [
        manzana.id,
        await inventarioService.getVillas(manzana.id),
      ])
    );
    const failed = villaResults.find(([, result]) => !result.success);
    if (failed) {
      setError(failed[1].message || 'No se pudieron cargar las Villas.');
      setLoading(false);
      return;
    }
    const villas = villaResults.flatMap(([, result]) => result.data);
    const residentResults = await Promise.all(
      villas.map(async (villa) => [
        villa.id,
        await inventarioService.getResidentePrincipal(villa.id),
      ])
    );
    const residentFailed = residentResults.find(([, result]) => !result.success);
    if (residentFailed) {
      setError(residentFailed[1].message || 'No se pudieron cargar los Residentes principales.');
      setLoading(false);
      return;
    }
    setManzanas(manzanasResult.data);
    setVillasByManzana(
      Object.fromEntries(villaResults.map(([manzanaId, result]) => [manzanaId, result.data]))
    );
    setResidentesByVilla(
      Object.fromEntries(residentResults.map(([villaId, result]) => [villaId, result.data]))
    );
    setLoading(false);
  }, [ubicacion.id]);

  useEffect(() => {
    load();
  }, [load]);

  const createManzana = async (event) => {
    event.preventDefault();
    if (!manzanaNombre.trim()) return;
    setSaving(true);
    const result = await inventarioService.createManzana(ubicacion.id, {
      nombre: manzanaNombre.trim(),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.message || 'No se pudo crear la Manzana.');
      return;
    }
    setManzanaNombre('');
    await load();
  };

  const createVilla = async (event, manzanaId) => {
    event.preventDefault();
    const identificador = (villaDrafts[manzanaId] || '').trim();
    if (!identificador) return;
    setSaving(true);
    const result = await inventarioService.createVilla(manzanaId, { identificador });
    setSaving(false);
    if (!result.success) {
      setError(result.message || 'No se pudo crear la Villa.');
      return;
    }
    setVillaDrafts((current) => ({ ...current, [manzanaId]: '' }));
    await load();
  };

  const changeState = async () => {
    if (!confirmTarget) return;
    const { kind, item, estado } = confirmTarget;
    if (kind === 'resident-replace') {
      beginResident(confirmTarget.villa, item, 'replace');
      setConfirmTarget(null);
      return;
    }
    setSaving(true);
    const result =
      kind === 'manzana'
        ? await inventarioService.updateManzana(item.id, { estado })
        : kind === 'villa'
          ? await inventarioService.updateVilla(item.id, { estado })
          : await inventarioService.updateResidentePrincipal(item.id, {
              activo: estado === 'activo',
            });
    setSaving(false);
    setConfirmTarget(null);
    if (!result.success) {
      setError(result.message || 'No se pudo actualizar el estado.');
      return;
    }
    await load();
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const value = editValue.trim();
    if (!editTarget || !value) return;
    setSaving(true);
    const result =
      editTarget.kind === 'manzana'
        ? await inventarioService.updateManzana(editTarget.item.id, { nombre: value })
        : await inventarioService.updateVilla(editTarget.item.id, { identificador: value });
    setSaving(false);
    if (!result.success) {
      setError(result.message || 'No se pudo guardar el cambio.');
      return;
    }
    setEditTarget(null);
    setEditValue('');
    await load();
  };

  const beginEdit = (kind, item) => {
    setEditTarget({ kind, item });
    setEditValue(kind === 'manzana' ? item.nombre : item.identificador);
  };

  const beginResident = (villa, resident = null, mode = 'create') => {
    setResidentTarget({ villa, resident, mode });
    setResidentDraft({
      nombre: resident?.nombre || '',
      contacto: resident?.contacto || '',
    });
  };

  const saveResident = async (event) => {
    event.preventDefault();
    if (!residentTarget || !residentDraft.nombre.trim() || !residentDraft.contacto.trim()) return;
    const payload = {
      nombre: residentDraft.nombre.trim(),
      contacto: residentDraft.contacto.trim(),
    };
    setSaving(true);
    const result =
      residentTarget.mode === 'edit'
        ? await inventarioService.updateResidentePrincipal(residentTarget.resident.id, payload)
        : await inventarioService.createResidentePrincipal(residentTarget.villa.id, {
            ...payload,
            ...(residentTarget.mode === 'replace' ? { reemplazar: true } : {}),
          });
    setSaving(false);
    if (!result.success) {
      setError(result.message || 'No se pudo guardar el Residente principal.');
      return;
    }
    setResidentTarget(null);
    setResidentDraft({ nombre: '', contacto: '' });
    await load();
  };

  return (
    <>
      <AppModal
        isOpen
        onClose={onClose}
        title={`Manzanas y Villas · ${ubicacion.nombre}`}
        className="urbanizacion-masters-modal"
      >
        <AppModal.Body>
          {error && (
            <div className="alert alert-error" role="alert">
              {error} <button onClick={load}>Reintentar</button>
            </div>
          )}
          {loading ? (
            <div className="urbanizacion-masters-state" role="status">
              Cargando Manzanas y Villas…
            </div>
          ) : (
            <div className="urbanizacion-masters">
              {editTarget && (
                <form className="urbanizacion-inline-form" onSubmit={saveEdit}>
                  <label htmlFor="urbanizacion-edit-value">
                    Editar {editTarget.kind === 'manzana' ? 'Manzana' : 'Villa'}
                  </label>
                  <div>
                    <input
                      id="urbanizacion-edit-value"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      maxLength={100}
                      disabled={saving}
                    />
                    <button className="btn btn-primary" disabled={saving || !editValue.trim()}>
                      Guardar
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => setEditTarget(null)}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
              {residentTarget && (
                <form className="urbanizacion-resident-form" onSubmit={saveResident}>
                  <h3>
                    {residentTarget.mode === 'replace'
                      ? 'Reemplazar Residente principal'
                      : residentTarget.mode === 'edit'
                        ? 'Editar Residente principal'
                        : 'Nuevo Residente principal'}
                  </h3>
                  <label htmlFor="residente-nombre">Nombre</label>
                  <input
                    id="residente-nombre"
                    value={residentDraft.nombre}
                    onChange={(event) =>
                      setResidentDraft((current) => ({ ...current, nombre: event.target.value }))
                    }
                    maxLength={150}
                    autoFocus
                    disabled={saving}
                  />
                  <label htmlFor="residente-contacto">Contacto</label>
                  <input
                    id="residente-contacto"
                    value={residentDraft.contacto}
                    onChange={(event) =>
                      setResidentDraft((current) => ({ ...current, contacto: event.target.value }))
                    }
                    maxLength={150}
                    disabled={saving}
                  />
                  <div className="urbanizacion-card-actions">
                    <button
                      className="btn btn-primary"
                      disabled={
                        saving || !residentDraft.nombre.trim() || !residentDraft.contacto.trim()
                      }
                    >
                      Guardar Residente
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => setResidentTarget(null)}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
              <form className="urbanizacion-inline-form" onSubmit={createManzana}>
                <label htmlFor="manzana-nombre">Nueva Manzana</label>
                <div>
                  <input
                    id="manzana-nombre"
                    value={manzanaNombre}
                    onChange={(event) => setManzanaNombre(event.target.value)}
                    maxLength={100}
                    disabled={saving}
                  />
                  <button className="btn btn-primary" disabled={saving || !manzanaNombre.trim()}>
                    Crear Manzana
                  </button>
                </div>
              </form>

              {manzanas.length === 0 ? (
                <div className="urbanizacion-masters-state" role="status">
                  Esta Urbanización todavía no tiene Manzanas.
                </div>
              ) : (
                <ul className="urbanizacion-manzanas-list">
                  {manzanas.map((manzana) => {
                    const villas = villasByManzana[manzana.id] || [];
                    return (
                      <li key={manzana.id} className="urbanizacion-manzana-card">
                        <header>
                          <div>
                            <h3>{manzana.nombre}</h3>
                            <span className={`status-badge ${manzana.estado}`}>
                              {manzana.estado}
                            </span>
                          </div>
                          <div className="urbanizacion-card-actions">
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={() => beginEdit('manzana', manzana)}
                              disabled={saving}
                            >
                              Editar Manzana
                            </button>
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={() =>
                                setConfirmTarget({
                                  kind: 'manzana',
                                  item: manzana,
                                  estado: manzana.estado === 'activo' ? 'inactivo' : 'activo',
                                })
                              }
                              disabled={saving}
                            >
                              {manzana.estado === 'activo'
                                ? 'Desactivar Manzana'
                                : 'Reactivar Manzana'}
                            </button>
                          </div>
                        </header>

                        {manzana.estado === 'activo' && (
                          <form
                            className="urbanizacion-inline-form urbanizacion-villa-form"
                            onSubmit={(event) => createVilla(event, manzana.id)}
                          >
                            <label htmlFor={`villa-${manzana.id}`}>Nueva Villa</label>
                            <div>
                              <input
                                id={`villa-${manzana.id}`}
                                value={villaDrafts[manzana.id] || ''}
                                onChange={(event) =>
                                  setVillaDrafts((current) => ({
                                    ...current,
                                    [manzana.id]: event.target.value,
                                  }))
                                }
                                maxLength={100}
                                disabled={saving}
                              />
                              <button
                                className="btn btn-primary"
                                disabled={saving || !(villaDrafts[manzana.id] || '').trim()}
                              >
                                Crear Villa
                              </button>
                            </div>
                          </form>
                        )}

                        {villas.length === 0 ? (
                          <p className="urbanizacion-villas-empty">Sin Villas registradas.</p>
                        ) : (
                          <ul className="urbanizacion-villas-list">
                            {villas.map((villa) => {
                              const resident = residentesByVilla[villa.id];
                              return (
                                <li key={villa.id} className="urbanizacion-villa-card">
                                  <div className="urbanizacion-villa-heading">
                                    <strong>{villa.identificador}</strong>
                                    <span className={`status-badge ${villa.estado}`}>
                                      {villa.estado}
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() => beginEdit('villa', villa)}
                                      disabled={saving}
                                    >
                                      Editar Villa
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() =>
                                        setConfirmTarget({
                                          kind: 'villa',
                                          item: villa,
                                          estado: villa.estado === 'activo' ? 'inactivo' : 'activo',
                                        })
                                      }
                                      disabled={saving}
                                    >
                                      {villa.estado === 'activo' ? 'Desactivar' : 'Reactivar'}
                                    </button>
                                  </div>
                                  <section className="urbanizacion-resident-card">
                                    <h4>Residente principal</h4>
                                    {!resident ? (
                                      <>
                                        <p>Sin Residente principal.</p>
                                        {villa.estado === 'activo' && (
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => beginResident(villa)}
                                            disabled={saving}
                                          >
                                            Crear Residente
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <p>
                                          <strong>{resident.nombre}</strong> · {resident.contacto}
                                        </p>
                                        <span
                                          className={`status-badge ${resident.activo ? 'activo' : 'inactivo'}`}
                                        >
                                          {resident.activo ? 'activo' : 'inactivo'}
                                        </span>
                                        <div className="urbanizacion-card-actions">
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => beginResident(villa, resident, 'edit')}
                                            disabled={saving}
                                          >
                                            Editar Residente
                                          </button>
                                          {resident.activo && (
                                            <button
                                              type="button"
                                              className="btn btn-secondary"
                                              onClick={() =>
                                                setConfirmTarget({
                                                  kind: 'resident-replace',
                                                  item: resident,
                                                  villa,
                                                  estado: 'replace',
                                                })
                                              }
                                              disabled={saving}
                                            >
                                              Reemplazar Residente
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() =>
                                              setConfirmTarget({
                                                kind: 'residente',
                                                item: resident,
                                                estado: resident.activo ? 'inactivo' : 'activo',
                                              })
                                            }
                                            disabled={saving}
                                          >
                                            {resident.activo
                                              ? 'Desactivar Residente'
                                              : 'Reactivar Residente'}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </section>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </AppModal.Body>
        <AppModal.Footer>
          <button className="btn btn-modal-clear" type="button" onClick={onClose} disabled={saving}>
            Cerrar
          </button>
        </AppModal.Footer>
      </AppModal>
      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        title={
          confirmTarget?.estado === 'replace'
            ? 'Confirmar reemplazo'
            : confirmTarget?.estado === 'inactivo'
              ? 'Confirmar desactivación'
              : 'Confirmar reactivación'
        }
        message={
          confirmTarget
            ? confirmTarget.estado === 'replace'
              ? 'El Residente principal actual quedará inactivo. ¿Continuar con el reemplazo?'
              : `${confirmTarget.estado === 'inactivo' ? 'Desactivar' : 'Reactivar'} ${
                  confirmTarget.kind === 'manzana'
                    ? 'la Manzana'
                    : confirmTarget.kind === 'villa'
                      ? 'la Villa'
                      : 'el Residente principal'
                } seleccionado?`
            : ''
        }
        confirmText={
          confirmTarget?.estado === 'replace'
            ? 'Continuar'
            : confirmTarget?.estado === 'inactivo'
              ? 'Desactivar'
              : 'Reactivar'
        }
        onConfirm={changeState}
        onCancel={() => setConfirmTarget(null)}
        isSubmitting={saving}
      />
    </>
  );
};

export default UrbanizacionMastersModal;
