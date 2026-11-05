import React from 'react';

// Botón (llave) que abre el modal de acceso al portal de visitas de un cliente.
const AccesoPortalButton = ({ clienteNombre, onClick }) => (
  <button
    className="action-btn action-btn-edit"
    type="button"
    onClick={onClick}
    title="Acceso al portal de visitas"
    aria-label={`Acceso al portal de ${clienteNombre}`}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10 13l9-9" />
      <path d="M16 7l3 3" />
      <path d="M14 9l2 2" />
    </svg>
  </button>
);

export default AccesoPortalButton;
