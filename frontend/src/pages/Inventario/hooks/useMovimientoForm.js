import { useCallback, useState } from 'react';
import inventarioService from '../../../services/inventarioService';
import {
  addMovimientoItem,
  buildMovimientoPayload,
  createMovimientoForm,
  filterArticulosForMovimiento,
  getArticuloLabel,
  removeMovimientoItem,
  updateIndexedValue,
  updateMovimientoItem,
  validateMovimientoForm,
} from '../utils/inventarioHelpers';

const useMovimientoForm = ({
  catalogArticulos,
  canRegeneratePdf = false,
  showMessage,
  onCreated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [movimientoForm, setMovimientoForm] = useState(createMovimientoForm);
  const [itemSearchTerms, setItemSearchTerms] = useState(['']);
  const [itemDropdownOpen, setItemDropdownOpen] = useState([false]);
  const [movimientoErrors, setMovimientoErrors] = useState({});

  const open = useCallback(() => {
    setMovimientoForm(createMovimientoForm());
    setItemSearchTerms(['']);
    setItemDropdownOpen([false]);
    setMovimientoErrors({});
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleMovimientoFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setMovimientoForm((prev) => ({ ...prev, [name]: value }));
    setMovimientoErrors((prev) => ({ ...prev, [name]: '' }));
  }, []);

  const handleMovimientoItemChange = useCallback((index, field, value) => {
    setMovimientoForm((prev) => ({
      ...prev,
      items: updateMovimientoItem(prev.items, index, field, value),
    }));
  }, []);

  const handleAddMovimientoItem = useCallback(() => {
    setMovimientoForm((prev) => ({
      ...prev,
      items: addMovimientoItem(prev.items),
    }));
    setItemSearchTerms((prev) => [...prev, '']);
    setItemDropdownOpen((prev) => [...prev, false]);
  }, []);

  const handleRemoveMovimientoItem = useCallback((index) => {
    setMovimientoForm((prev) => ({
      ...prev,
      items: removeMovimientoItem(prev.items, index),
    }));
    setItemSearchTerms((prev) => removeMovimientoItem(prev, index));
    setItemDropdownOpen((prev) => removeMovimientoItem(prev, index));
  }, []);

  const filterArticulos = useCallback(
    (searchTerm) => filterArticulosForMovimiento(catalogArticulos, searchTerm),
    [catalogArticulos]
  );

  const selectArticuloForItem = useCallback(
    (index, articulo) => {
      handleMovimientoItemChange(index, 'articulo_id', String(articulo.id));
      handleMovimientoItemChange(index, 'talla', articulo.talla || '');
      handleMovimientoItemChange(index, 'cantidad', 1);
      setItemSearchTerms((prev) => updateIndexedValue(prev, index, getArticuloLabel(articulo)));
      setItemDropdownOpen((prev) => updateIndexedValue(prev, index, false));
    },
    [handleMovimientoItemChange]
  );

  const clearArticuloForItem = useCallback(
    (index) => {
      handleMovimientoItemChange(index, 'articulo_id', '');
      handleMovimientoItemChange(index, 'talla', '');
      handleMovimientoItemChange(index, 'cantidad', 1);
      setItemSearchTerms((prev) => updateIndexedValue(prev, index, ''));
    },
    [handleMovimientoItemChange]
  );

  const handleCreateMovimiento = useCallback(
    async (e) => {
      e.preventDefault();
      const errors = validateMovimientoForm(movimientoForm);

      if (Object.keys(errors).length > 0) {
        setMovimientoErrors(errors);
        showMessage('error', Object.values(errors)[0]);
        return;
      }

      const result = await inventarioService.createMovimiento(
        buildMovimientoPayload(movimientoForm)
      );
      if (result.success) {
        showMessage('success', result.message || 'Movimiento registrado exitosamente');
        if (result.pdf?.available === false) {
          const regenerateHint = canRegeneratePdf
            ? ' Puedes regenerarlo desde la tabla de movimientos.'
            : '';
          showMessage(
            'warning',
            `${result.pdf.message || 'El PDF no pudo generarse.'}${regenerateHint}`
          );
        }
        setIsOpen(false);
        await onCreated?.();
      } else {
        showMessage('error', result.message);
      }
    },
    [canRegeneratePdf, movimientoForm, onCreated, showMessage]
  );

  return {
    isOpen,
    open,
    close,
    movimientoForm,
    movimientoErrors,
    itemSearchTerms,
    itemDropdownOpen,
    setItemSearchTerms,
    setItemDropdownOpen,
    handleMovimientoFormChange,
    handleMovimientoItemChange,
    handleAddMovimientoItem,
    handleRemoveMovimientoItem,
    filterArticulos,
    selectArticuloForItem,
    clearArticuloForItem,
    handleCreateMovimiento,
  };
};

export default useMovimientoForm;
