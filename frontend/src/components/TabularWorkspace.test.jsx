import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import TabularWorkspace from './TabularWorkspace';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('TabularWorkspace', () => {
  test('separa controles, resumen, datos y paginación', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <TabularWorkspace
          controls={<button type="button">Filtrar</button>}
          summary={<span>10 resultados</span>}
          pagination={<button type="button">Siguiente</button>}
        >
          <table>
            <tbody>
              <tr>
                <td>Dato</td>
              </tr>
            </tbody>
          </table>
        </TabularWorkspace>
      );
    });

    expect(container.querySelector('.tabular-workspace__controls').textContent).toBe('Filtrar');
    expect(container.querySelector('.tabular-workspace__summary').textContent).toBe(
      '10 resultados'
    );
    expect(container.querySelector('.tabular-workspace__data table')).not.toBeNull();
    expect(container.querySelector('.tabular-workspace__pagination').textContent).toBe('Siguiente');

    act(() => root.unmount());
  });
});
