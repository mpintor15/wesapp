import React, { useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import SearchableSelect from '../../../components/SearchableSelect';
import UsuarioCreateModal from './UsuarioCreateModal';
import UsuarioEditModal from './UsuarioEditModal';
import {
  buildUsuarioPayload,
  EMPTY_CREATE_USER_FORM,
  EMPTY_EDIT_USER_FORM,
} from '../utils/usuariosHelpers';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const colaboradores = [
  { id: 7, nombres_completos: 'Ana María Vera', cedula: '123', estado: 'activo' },
  { id: 8, nombres_completos: 'Luis Paz', cedula: '456', estado: 'inactivo' },
];
const ubicaciones = [
  { id: 4, nombre: 'Norte', direccion: 'Av. Amazonas', cliente_nombre: 'Cliente A' },
  { id: 5, nombre: 'Sur', direccion: 'Av. Maldonado', cliente_nombre: 'Cliente B' },
  { id: 6, nombre: 'Valle', direccion: 'Cumbayá', cliente_nombre: 'Cliente A' },
  {
    id: 7,
    nombre: 'Punto con nombre largo para validar ajuste de texto',
    direccion: 'Dirección extensa con referencia interna y número de lote 12345',
    cliente_nombre: 'Cliente A',
  },
];

const renderModal = (element) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => act(() => root.unmount()) };
};

const CreateHarness = ({
  canManageAssignments = false,
  initialData = {},
  onSubmit = jest.fn(),
}) => {
  const [formData, setFormData] = useState({ ...EMPTY_CREATE_USER_FORM, ...initialData });
  return (
    <UsuarioCreateModal
      colaboradores={colaboradores}
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
      ubicaciones={ubicaciones}
      ubicacionesError=""
      ubicacionesLoading={false}
    />
  );
};

const EditHarness = ({ canManageAssignments = false, initialData = {}, onSubmit = jest.fn() }) => {
  const [editData, setEditData] = useState({
    ...EMPTY_EDIT_USER_FORM,
    colaborador_id: '7',
    tipo_usuario: 'secretario',
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
        onSubmit(buildUsuarioPayload(editData, canManageAssignments));
      }}
      selectedUsuario={{ id: 2, nombre: 'Luis', apellido: 'Paz' }}
      ubicaciones={ubicaciones}
      ubicacionesError=""
      ubicacionesLoading={false}
    />
  );
};

const inputText = (input, value) =>
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
const click = (element) =>
  act(() => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
const mouseDown = (element) =>
  act(() => element.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })));
const submit = (container) =>
  act(() =>
    container
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  );
const pressKey = (element, key) =>
  act(() => element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true })));

describe('UX de selectores de Usuarios', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('Tipo de usuario inicia vacío y Colaborador no ofrece desvinculación', () => {
    const view = renderModal(<CreateHarness />);
    expect(view.container.querySelector('#u-tipo').value).toBe('');
    expect(view.container.textContent).not.toContain('Sin colaborador');
    expect(view.container.querySelector('label[for="u-colaborador"]').textContent).toContain('*');
    view.unmount();
  });

  test.each(['Ana', 'Vera', '123'])('busca colaborador por %s', (term) => {
    const view = renderModal(<CreateHarness />);
    const input = view.container.querySelector('#u-colaborador');
    act(() => input.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true })));
    inputText(input, term);
    expect(view.container.querySelector('[role="option"]').textContent).toContain('Ana María Vera');
    view.unmount();
  });

  test('selecciona colaborador y envía el vínculo al crear', () => {
    const onSubmit = jest.fn();
    const view = renderModal(
      <CreateHarness
        initialData={{ nombre: 'A', apellido: 'V', usuario: 'av', tipo_usuario: 'secretario' }}
        onSubmit={onSubmit}
      />
    );
    const input = view.container.querySelector('#u-colaborador');
    act(() => input.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true })));
    click(view.container.querySelector('[role="option"]'));
    submit(view.container);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ colaborador_id: '7' }));
    view.unmount();
  });

  test('edición conserva y etiqueta al colaborador inactivo', () => {
    const view = renderModal(
      <UsuarioEditModal
        colaboradores={[colaboradores[1]]}
        colaboradoresError=""
        colaboradoresLoading={false}
        editData={{ ...EMPTY_EDIT_USER_FORM, tipo_usuario: 'guardia', colaborador_id: '8' }}
        isSaving={false}
        onCancel={jest.fn()}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        selectedUsuario={{ nombre: 'Luis', apellido: 'Paz' }}
      />
    );
    expect(view.container.querySelector('#e-colaborador').value).toContain(
      'Luis Paz — 456 (Inactivo)'
    );
    view.unmount();
  });

  test('Guardia muestra puntos agrupados y busca por cliente, nombre y dirección', () => {
    const view = renderModal(
      <CreateHarness canManageAssignments initialData={{ tipo_usuario: 'guardia' }} />
    );
    click(view.container.querySelector('.selection-trigger'));
    expect(
      [...view.container.querySelectorAll('.selection-group h4')].map((node) => node.textContent)
    ).toEqual(['Cliente A', 'Cliente B']);
    const search = view.container.querySelector('#u-puntos');
    for (const term of ['Cliente B', 'Sur', 'Maldonado']) {
      inputText(search, term);
      expect(view.container.querySelector('.selection-group label').textContent).toContain('Sur');
    }
    view.unmount();
  });

  test('selector de puntos usa filas compactas con checkbox seguido del texto', () => {
    const view = renderModal(
      <EditHarness canManageAssignments initialData={{ tipo_usuario: 'guardia' }} />
    );
    click(view.container.querySelector('.selection-trigger'));

    const rows = view.container.querySelectorAll('.selection-option-row');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.children).toHaveLength(2);
      expect(row.children[0].tagName).toBe('INPUT');
      expect(row.children[0].getAttribute('type')).toBe('checkbox');
      expect(row.children[1].tagName).toBe('SPAN');
      expect(row.children[1].textContent.trim()).not.toBe('');
    });
    expect(view.container.querySelector('.selection-multi-panel > input#e-puntos')).not.toBeNull();
    expect(view.container.textContent).toContain('Punto con nombre largo');
    view.unmount();
  });

  test.each([[[]], [['4']], [['4', '5']]])('Guardia conserva selección 0/1/N: %s', (selected) => {
    const onSubmit = jest.fn();
    const view = renderModal(
      <CreateHarness
        canManageAssignments
        initialData={{ tipo_usuario: 'guardia', colaborador_id: '7', ubicacion_ids: selected }}
        onSubmit={onSubmit}
      />
    );
    expect(view.container.querySelector('.selection-trigger').textContent).toContain(
      String(selected.length)
    );
    submit(view.container);
    expect(onSubmit.mock.calls[0][0].ubicacion_ids).toEqual(selected);
    view.unmount();
  });

  test('permite seleccionar y retirar puntos desde el selector múltiple', () => {
    const view = renderModal(
      <EditHarness
        canManageAssignments
        initialData={{ tipo_usuario: 'guardia', ubicacion_ids: ['4'] }}
      />
    );
    click(view.container.querySelector('.selection-trigger'));
    const checks = view.container.querySelectorAll('.selection-group input');
    expect([...checks].filter((check) => check.checked)).toHaveLength(1);
    click(checks[1]);
    expect(view.container.querySelector('.selection-trigger').textContent).toContain('2 puntos');
    view.unmount();
  });

  test('selector de puntos en edición cierra al hacer click afuera sin romper selección interna', () => {
    const view = renderModal(
      <EditHarness
        canManageAssignments
        initialData={{ tipo_usuario: 'guardia', ubicacion_ids: ['4'] }}
      />
    );
    click(view.container.querySelector('.selection-trigger'));
    expect(view.container.querySelector('.selection-multi-panel')).not.toBeNull();

    const secondCheck = view.container.querySelectorAll('.selection-group input')[1];
    mouseDown(secondCheck);
    expect(view.container.querySelector('.selection-multi-panel')).not.toBeNull();
    click(secondCheck);
    expect(view.container.querySelector('.selection-trigger').textContent).toContain('2 puntos');

    mouseDown(document.body);
    expect(view.container.querySelector('.selection-multi-panel')).toBeNull();
    expect(view.container.querySelector('.selection-trigger').textContent).toContain('2 puntos');
    view.unmount();
  });

  test('selector de colaborador en edición cierra al hacer click afuera y conserva selección normal', () => {
    const view = renderModal(
      <EditHarness initialData={{ tipo_usuario: 'secretario', colaborador_id: '' }} />
    );
    const input = view.container.querySelector('#e-colaborador');

    act(() => input.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true })));
    expect(view.container.querySelector('[role="listbox"]')).not.toBeNull();
    mouseDown(document.body);
    expect(view.container.querySelector('[role="listbox"]')).toBeNull();

    act(() => input.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true })));
    click(view.container.querySelector('[role="option"]'));
    expect(input.value).toContain('Ana María Vera');
    expect(view.container.querySelector('[role="listbox"]')).toBeNull();
    view.unmount();
  });

  test.each(['secretario', 'supervisor', 'monitorista'])(
    '%s no muestra selector de puntos',
    (tipo) => {
      const view = renderModal(
        <CreateHarness canManageAssignments initialData={{ tipo_usuario: tipo }} />
      );
      expect(view.container.querySelector('.usuarios-puntos')).toBeNull();
      view.unmount();
    }
  );

  test('loading y error de Colaborador son accesibles', () => {
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

  test('teclado opera únicamente sobre las primeras 50 opciones renderizadas', () => {
    const options = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      label: `Opción ${String(index + 1).padStart(2, '0')}`,
    }));
    const onChange = jest.fn();
    const view = renderModal(
      <SearchableSelect
        inputId="large-select"
        options={options}
        value=""
        onChange={onChange}
        getOptionLabel={(option) => option.label}
      />
    );
    const input = view.container.querySelector('#large-select');
    act(() => input.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true })));

    expect(view.container.querySelectorAll('[role="option"]')).toHaveLength(50);
    for (let index = 0; index < 55; index += 1) pressKey(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('large-select-50');
    expect(document.getElementById(input.getAttribute('aria-activedescendant'))).not.toBeNull();
    pressKey(input, 'ArrowUp');
    expect(input.getAttribute('aria-activedescendant')).toBe('large-select-49');
    pressKey(input, 'Enter');

    expect(onChange).toHaveBeenCalledWith('49');
    expect(onChange).not.toHaveBeenCalledWith('51');
    view.unmount();
  });
});
