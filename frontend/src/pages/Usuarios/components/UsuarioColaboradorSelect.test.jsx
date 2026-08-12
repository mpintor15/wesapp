import React, { useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import UsuarioCreateModal from './UsuarioCreateModal';
import UsuarioEditModal from './UsuarioEditModal';
import {
  buildUsuarioPayload,
  EMPTY_CREATE_USER_FORM,
  EMPTY_EDIT_USER_FORM,
} from '../utils/usuariosHelpers';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const colaboradores = [
  {
    id: 7,
    nombres_completos: 'Ana Vera',
    cedula: '123',
    cargo: 'Guardia',
    estado: 'activo',
  },
  {
    id: 8,
    nombres_completos: 'Luis Paz',
    cedula: '456',
    cargo: 'Guardia',
    estado: 'inactivo',
  },
];

const renderModal = (element) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const CreateHarness = ({ canManageAssignments = false, initialData = {}, onSubmit }) => {
  const [formData, setFormData] = useState({ ...EMPTY_CREATE_USER_FORM, ...initialData });
  return (
    <UsuarioCreateModal
      colaboradores={[colaboradores[0]]}
      colaboradoresError=""
      colaboradoresLoading={false}
      canManageAssignments={canManageAssignments}
      createErrors={{}}
      formData={formData}
      isCreating={false}
      onCancel={jest.fn()}
      onChange={(field, value) => setFormData((current) => ({ ...current, [field]: value }))}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(buildUsuarioPayload(formData, canManageAssignments));
      }}
      ubicaciones={[
        { id: 4, nombre: 'Norte' },
        { id: 5, nombre: 'Sur' },
      ]}
      ubicacionesError=""
      ubicacionesLoading={false}
    />
  );
};

const EditHarness = ({
  canManageAssignments = false,
  initialData = {},
  initialColaboradorId = '7',
  onSubmit,
}) => {
  const [editData, setEditData] = useState({
    ...EMPTY_EDIT_USER_FORM,
    colaborador_id: initialColaboradorId,
    ...initialData,
  });
  return (
    <UsuarioEditModal
      colaboradores={colaboradores}
      colaboradoresError=""
      colaboradoresLoading={false}
      canManageAssignments={canManageAssignments}
      editData={editData}
      isSaving={false}
      onCancel={jest.fn()}
      onChange={(field, value) => setEditData((current) => ({ ...current, [field]: value }))}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(
          buildUsuarioPayload(
            {
              ...editData,
              colaborador_id: editData.colaborador_id === '' ? null : editData.colaborador_id,
            },
            canManageAssignments
          )
        );
      }}
      selectedUsuario={{ id: 2, nombre: 'Luis', apellido: 'Paz' }}
      ubicaciones={[
        { id: 4, nombre: 'Norte' },
        { id: 5, nombre: 'Sur' },
      ]}
      ubicacionesError=""
      ubicacionesLoading={false}
    />
  );
};

const changeSelect = (select, value) => {
  act(() => {
    select.value = value;
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
};

const submitForm = (container) => {
  act(() => {
    container
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
};

describe('selector Usuario-Colaborador', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('crear ofrece Sin colaborador y solo las opciones entregadas por el backend', () => {
    const view = renderModal(
      <UsuarioCreateModal
        colaboradores={[colaboradores[0]]}
        colaboradoresError=""
        colaboradoresLoading={false}
        createErrors={{}}
        formData={EMPTY_CREATE_USER_FORM}
        isCreating={false}
        onCancel={jest.fn()}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    const options = [...view.container.querySelectorAll('#u-colaborador option')].map(
      (option) => option.textContent
    );
    expect(options).toEqual(['Sin colaborador', 'Ana Vera — 123']);
    view.unmount();
  });

  test('editar conserva y etiqueta el colaborador inactivo actualmente vinculado', () => {
    const view = renderModal(
      <UsuarioEditModal
        colaboradores={[colaboradores[1]]}
        colaboradoresError=""
        colaboradoresLoading={false}
        editData={{ ...EMPTY_EDIT_USER_FORM, colaborador_id: '8' }}
        isSaving={false}
        onCancel={jest.fn()}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        selectedUsuario={{ id: 2, nombre: 'Luis', apellido: 'Paz' }}
      />
    );

    const select = view.container.querySelector('#e-colaborador');
    expect(select.value).toBe('8');
    expect(select.textContent).toContain('Luis Paz — 456 (Inactivo)');
    view.unmount();
  });

  test('muestra loading y error accesible', () => {
    const view = renderModal(
      <UsuarioCreateModal
        colaboradores={[]}
        colaboradoresError="No se pudo cargar"
        colaboradoresLoading
        createErrors={{}}
        formData={EMPTY_CREATE_USER_FORM}
        isCreating={false}
        onCancel={jest.fn()}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    expect(view.container.querySelector('#u-colaborador').disabled).toBe(true);
    expect(view.container.querySelector('[role="alert"]').textContent).toContain(
      'No se pudo cargar'
    );
    view.unmount();
  });

  test('cambia efectivamente la selección y la envía al crear', () => {
    const onSubmit = jest.fn();
    const view = renderModal(<CreateHarness onSubmit={onSubmit} />);

    const select = view.container.querySelector('#u-colaborador');
    changeSelect(select, '7');
    expect(select.value).toBe('7');
    submitForm(view.container);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ colaborador_id: '7' }));
    view.unmount();
  });

  test('envía la nueva selección al editar', () => {
    const onSubmit = jest.fn();
    const view = renderModal(<EditHarness onSubmit={onSubmit} />);

    const select = view.container.querySelector('#e-colaborador');
    changeSelect(select, '8');
    expect(select.value).toBe('8');
    submitForm(view.container);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ colaborador_id: '8' }));
    view.unmount();
  });

  test('envía null al desvincular durante edición', () => {
    const onSubmit = jest.fn();
    const view = renderModal(<EditHarness onSubmit={onSubmit} />);

    changeSelect(view.container.querySelector('#e-colaborador'), '');
    submitForm(view.container);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ colaborador_id: null }));
    view.unmount();
  });

  test.each([[[]], [['4']], [['4', '5']]])('Guardia permite seleccionar %s puntos', (selected) => {
    const onChange = jest.fn();
    const view = renderModal(
      <UsuarioCreateModal
        canManageAssignments
        colaboradores={[]}
        colaboradoresError=""
        colaboradoresLoading={false}
        createErrors={{}}
        formData={{ ...EMPTY_CREATE_USER_FORM, tipo_usuario: 'guardia', ubicacion_ids: selected }}
        isCreating={false}
        onCancel={jest.fn()}
        onChange={onChange}
        onSubmit={jest.fn()}
        ubicaciones={[
          { id: 4, nombre: 'Norte' },
          { id: 5, nombre: 'Sur' },
        ]}
        ubicacionesError=""
        ubicacionesLoading={false}
      />
    );
    expect(view.container.querySelectorAll('.usuarios-puntos input:checked')).toHaveLength(
      selected.length
    );
    view.unmount();
  });

  test('otros roles no muestran selector de puntos', () => {
    const view = renderModal(
      <UsuarioEditModal
        canManageAssignments
        colaboradores={[]}
        colaboradoresError=""
        colaboradoresLoading={false}
        editData={{ ...EMPTY_EDIT_USER_FORM, tipo_usuario: 'supervisor' }}
        isSaving={false}
        onCancel={jest.fn()}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        selectedUsuario={{ id: 2, nombre: 'Ana', apellido: 'Vera' }}
        ubicaciones={[{ id: 4, nombre: 'Norte' }]}
        ubicacionesError=""
        ubicacionesLoading={false}
      />
    );
    expect(view.container.querySelector('.usuarios-puntos')).toBeNull();
    view.unmount();
  });

  test('edición preserva varios puntos y permite retirar uno', () => {
    const onChange = jest.fn();
    const view = renderModal(
      <UsuarioEditModal
        canManageAssignments
        colaboradores={[]}
        colaboradoresError=""
        colaboradoresLoading={false}
        editData={{ ...EMPTY_EDIT_USER_FORM, tipo_usuario: 'guardia', ubicacion_ids: ['4', '5'] }}
        isSaving={false}
        onCancel={jest.fn()}
        onChange={onChange}
        onSubmit={jest.fn()}
        selectedUsuario={{ id: 2, nombre: 'Ana', apellido: 'Vera' }}
        ubicaciones={[
          { id: 4, nombre: 'Norte' },
          { id: 5, nombre: 'Sur' },
        ]}
        ubicacionesError=""
        ubicacionesLoading={false}
      />
    );
    const selected = view.container.querySelectorAll('.usuarios-puntos input:checked');
    expect(selected).toHaveLength(2);
    act(() => selected[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    expect(onChange).toHaveBeenCalledWith('ubicacion_ids', ['5']);
    view.unmount();
  });

  test('submit de creación sin permiso omite ubicacion_ids', () => {
    const onSubmit = jest.fn();
    const view = renderModal(<CreateHarness onSubmit={onSubmit} />);
    submitForm(view.container);
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('ubicacion_ids');
    view.unmount();
  });

  test('submit de edición sin administrar asignaciones omite ubicacion_ids', () => {
    const onSubmit = jest.fn();
    const view = renderModal(
      <EditHarness
        initialData={{ tipo_usuario: 'guardia', ubicacion_ids: ['4'] }}
        onSubmit={onSubmit}
      />
    );
    submitForm(view.container);
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('ubicacion_ids');
    view.unmount();
  });

  test('Guardia que cambia de rol no envía IDs heredados', () => {
    const onSubmit = jest.fn();
    const view = renderModal(
      <EditHarness
        canManageAssignments
        initialData={{ tipo_usuario: 'supervisor', ubicacion_ids: ['4', '5'] }}
        onSubmit={onSubmit}
      />
    );
    submitForm(view.container);
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('ubicacion_ids');
    view.unmount();
  });

  test.each([[[]], [['4']], [['4', '5']]])(
    'submit de Guardia con permiso envía %s puntos',
    (ubicacionIds) => {
      const onSubmit = jest.fn();
      const view = renderModal(
        <CreateHarness
          canManageAssignments
          initialData={{ tipo_usuario: 'guardia', ubicacion_ids: ubicacionIds }}
          onSubmit={onSubmit}
        />
      );
      submitForm(view.container);
      expect(onSubmit.mock.calls[0][0].ubicacion_ids).toEqual(ubicacionIds);
      view.unmount();
    }
  );
});
