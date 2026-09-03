import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import bitacorasService from '../../../services/bitacorasService';
import HistorialVisitas from './HistorialVisitas';

jest.mock('../../../services/bitacorasService', () => ({
  __esModule: true,
  default: {
    getVisitas: jest.fn(),
    closeVisita: jest.fn(),
    cancelVisita: jest.fn(),
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const setValue = (element, value) => {
  const prototype =
    element instanceof globalThis.HTMLSelectElement
      ? globalThis.HTMLSelectElement.prototype
      : element instanceof globalThis.HTMLTextAreaElement
        ? globalThis.HTMLTextAreaElement.prototype
        : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
};

const findButtonByText = (container, text) =>
  Array.from(container.querySelectorAll('button')).find((button) => button.textContent === text);

const visitRow = (overrides = {}) => ({
  id: 8,
  entrada_at: '2026-08-20T10:00:00',
  visitante_nombre: 'Carlos Ruiz',
  visitante_documento: '0912345678',
  placa: 'ABC123',
  manzana_nombre: 'A',
  villa_identificador: '1',
  residente_principal_nombre: 'Ana Titular',
  tipo_visita_nombre: 'Vehículo',
  registrado_por_usuario: 'qa_guardia',
  estado: 'ABIERTA',
  requiere_salida: true,
  salida_at: null,
  ...overrides,
});

describe('HistorialVisitas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [visitRow()],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });
    bitacorasService.closeVisita.mockResolvedValue({ success: true, message: 'Cerrada' });
    bitacorasService.cancelVisita.mockResolvedValue({ success: true, message: 'Visita anulada' });
  });

  test('muestra visitas, filtros y registra salida sin anular', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [
        visitRow({
          visitantes: [
            [
              { field_key: 'nombre', value: 'Carlos Ruiz' },
              { field_key: 'cedula', value: '0912345678' },
            ],
            [
              { field_key: 'nombre', value: 'María Pérez' },
              { field_key: 'cedula', value: '0923456789' },
            ],
          ],
        }),
      ],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChanged = jest.fn();
    const showToast = jest.fn();
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={onChanged} showToast={showToast} />)
    );
    await act(async () => flush());

    expect(container.textContent).toContain('Carlos Ruiz');
    expect(container.textContent).toContain('A1');
    expect(container.textContent).toContain('Tipo de visita');
    expect(container.textContent).toContain('Vehículo');
    expect(container.textContent).toContain('Registrado por');
    expect(container.textContent).toContain('qa_guardia');
    expect(container.querySelector('th.bitacoras-visit-state')?.textContent).toContain('Estado');
    expect(container.querySelector('td.bitacoras-visit-state')).not.toBeNull();
    expect(container.querySelector('.records-mobile')).not.toBeNull();
    expect(container.querySelector('[aria-label="Anular visita"]')).toBeNull();
    await act(async () => {
      container.querySelector('[aria-label="Registrar salida"]').click();
      await flush();
    });
    expect(bitacorasService.closeVisita).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Fecha/hora:');
    expect(container.querySelector('.bitacoras-exit-visita-modal.app-modal--md')).not.toBeNull();
    expect(container.querySelectorAll('.bitacoras-exit-visitors strong > span')).toHaveLength(2);
    expect(container.textContent).toContain('María Pérez · 0923456789');
    await act(async () => {
      findButtonByText(container, 'Confirmar').click();
      await flush();
    });

    expect(bitacorasService.closeVisita).toHaveBeenCalledWith(8);
    expect(onChanged).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Cerrada', 'success');
    act(() => root.unmount());
    container.remove();
  });

  test('reporta el total visible vía onTotalChange y lo actualiza tras cerrar y anular', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChanged = jest.fn();
    const showToast = jest.fn();
    const onTotalChange = jest.fn();
    act(() =>
      root.render(
        <HistorialVisitas
          refreshKey={0}
          onChanged={onChanged}
          showToast={showToast}
          canCancelVisita
          onTotalChange={onTotalChange}
        />
      )
    );
    await act(async () => flush());

    expect(onTotalChange).toHaveBeenLastCalledWith(1);

    bitacorasService.getVisitas.mockResolvedValueOnce({
      success: true,
      data: [],
      meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    });
    await act(async () => {
      container.querySelector('[aria-label="Registrar salida"]').click();
      await flush();
    });
    await act(async () => {
      findButtonByText(container, 'Confirmar').click();
      await flush();
    });
    expect(bitacorasService.closeVisita).toHaveBeenCalledWith(8);
    expect(onTotalChange).toHaveBeenLastCalledWith(0);

    act(() => root.unmount());
    container.remove();
  });

  test('expone Anular solo a usuarios con permiso administrador y crea Bitácora vía backend', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChanged = jest.fn();
    const showToast = jest.fn();
    act(() =>
      root.render(
        <HistorialVisitas
          refreshKey={0}
          onChanged={onChanged}
          showToast={showToast}
          canCancelVisita
        />
      )
    );
    await act(async () => flush());

    const cancelButton = container.querySelector('[aria-label="Anular visita"]');
    expect(cancelButton).not.toBeNull();

    await act(async () => {
      cancelButton.click();
      await flush();
    });

    const textarea = container.querySelector('#cancel-visita-motivo');
    expect(textarea).not.toBeNull();
    await act(async () => {
      setValue(textarea, 'Visitante no llegó');
      await flush();
    });

    await act(async () => {
      container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(bitacorasService.cancelVisita).toHaveBeenCalledWith(8, {
      motivo: 'Visitante no llegó',
    });
    expect(onChanged).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Visita anulada', 'success');
    act(() => root.unmount());
    container.remove();
  });

  test('Guardia (sin canCancelVisita) no ve ni puede anular visitas', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(container.querySelector('[aria-label="Anular visita"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  test('respuestas obsoletas no sobrescriben el historial más reciente', async () => {
    let resolveStale;
    const staleResponse = new Promise((resolve) => {
      resolveStale = resolve;
    });
    bitacorasService.getVisitas
      .mockImplementationOnce(() => staleResponse)
      .mockResolvedValueOnce({
        success: true,
        data: [visitRow({ visitante_nombre: 'Visitante Nuevo' })],
        meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    // Second, newer request fires (e.g. a refresh) before the first one resolves.
    act(() =>
      root.render(<HistorialVisitas refreshKey={1} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(container.textContent).toContain('Visitante Nuevo');

    // The stale first request now resolves; it must not clobber the newer state.
    await act(async () => {
      resolveStale({
        success: true,
        data: [visitRow({ visitante_nombre: 'Visitante Viejo' })],
        meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      });
      await flush();
    });

    expect(container.textContent).toContain('Visitante Nuevo');
    expect(container.textContent).not.toContain('Visitante Viejo');
    act(() => root.unmount());
    container.remove();
  });

  test('el reporte usa los mismos filtros efectivos que la tabla, incluido estado=ABIERTA por defecto', async () => {
    const onFiltersChange = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <HistorialVisitas
          refreshKey={0}
          onChanged={jest.fn()}
          showToast={jest.fn()}
          onFiltersChange={onFiltersChange}
        />
      )
    );
    await act(async () => flush());

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'ABIERTA', pageSize: 25 })
    );

    const estadoSelect = container.querySelector('#visitas-filter-estado');
    await act(async () => {
      setValue(estadoSelect, 'CERRADA');
      await flush();
    });
    await act(async () => {
      findButtonByText(container, 'Aplicar').click();
      await flush();
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'CERRADA' })
    );

    act(() => root.unmount());
    container.remove();
  });

  test('combina Visitante/Placa/Casa/Titular en un solo buscador y filtra Creador con dropdown de creadores reales', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [visitRow()],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      filters: {
        creators: [
          { id: 4, nombre: 'Guardia Uno' },
          { id: 9, nombre: 'Guardia Dos' },
        ],
      },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(container.querySelectorAll('.ff-search input')).toHaveLength(1);

    const creatorSelect = container.querySelector('#visitas-filter-creator');
    expect(creatorSelect).not.toBeNull();
    const options = Array.from(creatorSelect.querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(options).toEqual(['Todos', 'Guardia Uno', 'Guardia Dos']);

    const searchInput = container.querySelector('.ff-search input');
    await act(async () => {
      setValue(searchInput, 'Carlos');
      setValue(creatorSelect, 'Guardia Uno');
      findButtonByText(container, 'Aplicar').click();
      await flush();
    });

    expect(bitacorasService.getVisitas).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Carlos', creator: 'Guardia Uno' })
    );
    expect(bitacorasService.getVisitas.mock.calls.at(-1)[0]).not.toHaveProperty('placa');
    expect(bitacorasService.getVisitas.mock.calls.at(-1)[0]).not.toHaveProperty('visitante');
    expect(bitacorasService.getVisitas.mock.calls.at(-1)[0]).not.toHaveProperty('casa');
    expect(bitacorasService.getVisitas.mock.calls.at(-1)[0]).not.toHaveProperty('titular');

    act(() => root.unmount());
    container.remove();
  });

  test('ordena visitas server-side y conserva la búsqueda aplicada', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());
    await act(async () => {
      setValue(container.querySelector('.ff-search input'), 'Carlos');
      findButtonByText(container, 'Aplicar').click();
      await flush();
    });

    const placaSort = Array.from(container.querySelectorAll('.th-sort-btn')).find((button) =>
      button.textContent.includes('Placa')
    );
    await act(async () => {
      placaSort.click();
      await flush();
    });
    expect(bitacorasService.getVisitas).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        search: 'Carlos',
        sortBy: 'placa',
        sortOrder: 'asc',
      })
    );
    act(() => root.unmount());
    container.remove();
  });

  test('oculta Registrar salida cuando el tipo de visita no la requiere', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [visitRow({ requiere_salida: false })],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(container.querySelector('[aria-label="Registrar salida"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: header de Acciones visualmente vacío (solo aria-label)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    const actionsHeader = container.querySelector('th[aria-label="Acciones"]');
    expect(actionsHeader).not.toBeNull();
    expect(actionsHeader.textContent).toBe('');

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: usa la placa de una respuesta dinámica cuando el campo fijo está vacío', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [
        visitRow({
          placa: null,
          respuestas: [{ field_key: 'placa', label: 'Placa', type: 'placa', value: 'XYZ999' }],
        }),
      ],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(container.textContent).toContain('XYZ999');

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: muestra TODOS los visitantes verticalmente, sin truncar con +N', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [
        visitRow({
          visitante_nombre: null,
          visitante_documento: null,
          visitantes: [
            [
              { field_key: 'nombre', label: 'Nombre', type: 'text', value: 'Juan Pérez' },
              { field_key: 'cedula', label: 'Cédula', type: 'cedula', value: '0701234567' },
            ],
            [
              { field_key: 'nombre', label: 'Nombre', type: 'text', value: 'María López' },
              { field_key: 'cedula', label: 'Cédula', type: 'cedula', value: '0709876543' },
            ],
          ],
        }),
      ],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    const list = container.querySelector('.bitacoras-visitantes-list');
    expect(list).not.toBeNull();
    const lines = Array.from(list.children).map((node) => node.textContent);
    expect(lines).toEqual(['Juan Pérez · 0701234567', 'María López · 0709876543']);
    expect(container.textContent).not.toContain('+1');
    expect(container.textContent).toContain('Juan Pérez · 0701234567, María López · 0709876543');

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: columna Salida distingue vacío / "-" / fecha real', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [
        visitRow({ id: 1, requiere_salida: true, salida_at: null }),
        visitRow({ id: 2, requiere_salida: false, salida_at: null, estado: 'CERRADA' }),
        visitRow({
          id: 3,
          requiere_salida: true,
          salida_at: '2026-08-20T15:00:00Z',
          estado: 'CERRADA',
        }),
      ],
      meta: { page: 1, pageSize: 25, totalItems: 3, totalPages: 1 },
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    const cells = Array.from(container.querySelectorAll('.bitacoras-cell-salida'));
    expect(cells.map((cell) => cell.textContent)).toEqual(['', '-', expect.stringContaining('20')]);

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: registrar salida abre confirmación con fecha/hora y evita doble envío', async () => {
    let resolveClose;
    bitacorasService.closeVisita.mockReturnValue(
      new Promise((resolve) => {
        resolveClose = resolve;
      })
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    await act(async () => {
      container.querySelector('[aria-label="Registrar salida"]').click();
      await flush();
    });
    expect(container.textContent).toContain('Fecha/hora:');

    const confirmBtn = findButtonByText(container, 'Confirmar');
    await act(async () => {
      confirmBtn.click();
      confirmBtn.click();
      await flush();
    });
    expect(bitacorasService.closeVisita).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveClose({ success: true, message: 'Cerrada' });
      await flush();
    });

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: Estado muestra ADENTRO/SALIÓ/REGISTRADO/NO AUTORIZADO y NO_AUTORIZADA no ofrece acciones', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [
        visitRow({ id: 1, estado: 'ABIERTA', requiere_salida: true }),
        visitRow({
          id: 2,
          estado: 'CERRADA',
          requiere_salida: true,
          salida_at: '2026-08-20T15:00:00Z',
        }),
        visitRow({
          id: 3,
          estado: 'CERRADA',
          requiere_salida: false,
          salida_at: '2026-08-20T10:00:00Z',
        }),
        visitRow({
          id: 4,
          estado: 'NO_AUTORIZADA',
          requiere_salida: true,
          salida_at: null,
          motivo_no_autorizacion: 'No aparece en lista',
        }),
      ],
      meta: { page: 1, pageSize: 25, totalItems: 4, totalPages: 1 },
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <HistorialVisitas
          refreshKey={0}
          onChanged={jest.fn()}
          showToast={jest.fn()}
          canCancelVisita
        />
      )
    );
    await act(async () => flush());

    const rows = Array.from(document.querySelectorAll('.bitacoras-visits-table tbody tr'));
    const estados = rows.map((row) => Array.from(row.querySelectorAll('td'))[7].textContent);
    expect(estados).toEqual(['ADENTRO', 'SALIÓ', 'REGISTRADO', 'NO AUTORIZADO']);

    // regresión: mismo patrón visual (badge) que FormStatus en Formularios.
    const badges = rows.map((row) => row.querySelector('td .badge'));
    expect(badges.every((badge) => badge)).toBe(true);
    expect(badges[0].className).toContain('badge-active'); // ADENTRO
    expect(badges[3].className).toContain('badge-inactive'); // NO AUTORIZADO

    // regresión: columna Observación solo tiene contenido para NO AUTORIZADO.
    const observaciones = rows.map((row) => Array.from(row.querySelectorAll('td'))[8].textContent);
    expect(observaciones).toEqual(['', '', '', 'No aparece en lista']);

    const noAutorizadaRow = rows[3];
    expect(noAutorizadaRow.querySelector('[aria-label="Registrar salida"]')).toBeNull();
    expect(noAutorizadaRow.querySelector('[aria-label="Anular visita"]')).toBeNull();
    expect(noAutorizadaRow.textContent).toContain('—');

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: filtro de Estado incluye NO AUTORIZADA', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    const options = Array.from(
      document.getElementById('visitas-filter-estado').querySelectorAll('option')
    ).map((option) => option.value);
    expect(options).toContain('NO_AUTORIZADA');

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: registrar salida mantiene la fila visible y actualizada aunque el filtro por defecto (estado=ABIERTA) ya no la incluya, incluso con el refetch automático que dispara onChanged', async () => {
    bitacorasService.getVisitas.mockResolvedValueOnce({
      success: true,
      data: [visitRow({ requiere_salida: true })],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });
    bitacorasService.closeVisita.mockResolvedValue({
      success: true,
      message: 'Cerrada',
      data: { id: 8, estado: 'CERRADA', salida_at: '2026-08-20T12:30:00' },
    });
    // Simula el filtro por defecto estado=ABIERTA excluyendo la visita recién
    // cerrada en TODOS los refetch posteriores (el explícito de confirmExit
    // y el automático que Bitacoras.jsx dispara subiendo refreshKey vía
    // onChanged, tal como en producción).
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [],
      meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    // Reproduce el wiring real de Bitacoras.jsx: onChanged incrementa el
    // refreshKey que se le pasa de vuelta al componente, dando pie a la
    // condición de carrera entre el loadVisits explícito y el automático.
    const Wrapper = () => {
      const [refreshKey, setRefreshKey] = React.useState(0);
      return (
        <HistorialVisitas
          refreshKey={refreshKey}
          onChanged={() => setRefreshKey((current) => current + 1)}
          showToast={jest.fn()}
        />
      );
    };
    act(() => root.render(<Wrapper />));
    await act(async () => flush());

    expect(container.querySelector('[aria-label="Registrar salida"]')).not.toBeNull();

    await act(async () => {
      container.querySelector('[aria-label="Registrar salida"]').click();
      await flush();
    });
    await act(async () => {
      findButtonByText(container, 'Confirmar').click();
      await flush();
      await flush();
    });

    expect(bitacorasService.closeVisita).toHaveBeenCalledWith(8);
    expect(container.textContent).toContain('Carlos Ruiz');
    expect(container.textContent).toContain('SALIÓ');
    expect(container.textContent).toContain('20/08/2026 12:30');
    expect(container.querySelector('[aria-label="Registrar salida"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  test('regresión: una visita que no requiere salida nunca ofrece el botón, ni antes ni después de refrescar', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [visitRow({ requiere_salida: false, estado: 'CERRADA' })],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(container.querySelector('[aria-label="Registrar salida"]')).toBeNull();
    expect(container.textContent).toContain('REGISTRADO');
    expect(bitacorasService.closeVisita).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
