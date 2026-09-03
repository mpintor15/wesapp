import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AccesoBadge from './AccesoBadge';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderBadge = (acceso) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<AccesoBadge acceso={acceso} />));
  return container;
};

describe('AccesoBadge', () => {
  test('sin usuario asociado muestra "Sin acceso"', () => {
    const container = renderBadge({ tiene_usuario: false });
    expect(container.textContent).toBe('Sin acceso');
    expect(container.querySelector('.badge-inactive')).toBeTruthy();
  });

  test('usuario pendiente de primer login muestra "Pendiente"', () => {
    const container = renderBadge({
      tiene_usuario: true,
      pendiente: true,
      activo: true,
      tipo_usuario: 'guardia',
    });
    expect(container.textContent).toBe('Pendiente');
    expect(container.querySelector('.badge-pending')).toBeTruthy();
  });

  test('usuario activo muestra el rol', () => {
    const container = renderBadge({
      tiene_usuario: true,
      pendiente: false,
      activo: true,
      tipo_usuario: 'supervisor',
    });
    expect(container.textContent).toBe('Supervisor');
    expect(container.querySelector('.badge-active')).toBeTruthy();
  });

  test('usuario inactivo muestra "Inactivo"', () => {
    const container = renderBadge({
      tiene_usuario: true,
      pendiente: false,
      activo: false,
      tipo_usuario: 'supervisor',
    });
    expect(container.textContent).toBe('Inactivo');
    expect(container.querySelector('.badge-inactive')).toBeTruthy();
  });
});
