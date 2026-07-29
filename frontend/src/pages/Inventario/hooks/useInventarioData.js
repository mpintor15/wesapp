import { useCallback, useEffect, useState } from 'react';
import clientesService from '../../../services/clientesService';
import inventarioService from '../../../services/inventarioService';

const loadArticulosCatalogo = () =>
  inventarioService.getArticulosCatalogo
    ? inventarioService.getArticulosCatalogo()
    : inventarioService.getArticulos();

const useInventarioData = ({ showMessage }) => {
  const [articulos, setArticulos] = useState([]);
  const [catalogArticulos, setCatalogArticulos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [bajas, setBajas] = useState([]);
  const [articulosPagination, setArticulosPagination] = useState(null);
  const [movimientosPagination, setMovimientosPagination] = useState(null);

  const [loading, setLoading] = useState(true);
  const [movimientosLoading, setMovimientosLoading] = useState(false);
  const [bajasLoading, setBajasLoading] = useState(false);
  const [movimientosLoaded, setMovimientosLoaded] = useState(false);
  const [bajasLoaded, setBajasLoaded] = useState(false);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const [ubicacionesRes, articulosRes, catalogRes, clientesRes] = await Promise.all([
      inventarioService.getUbicaciones(),
      inventarioService.getArticulos(),
      loadArticulosCatalogo(),
      clientesService.listOpcionesUbicaciones(),
    ]);

    if (ubicacionesRes.success) setUbicaciones(ubicacionesRes.data);
    if (clientesRes.success) setClientes(clientesRes.data || []);
    if (articulosRes.success) {
      setArticulos(articulosRes.data);
      setArticulosPagination(articulosRes.pagination);
    }
    if (catalogRes.success) setCatalogArticulos(catalogRes.data);
    if (
      !ubicacionesRes.success ||
      !articulosRes.success ||
      !catalogRes.success ||
      !clientesRes.success
    ) {
      showMessage(
        'error',
        ubicacionesRes.message ||
          articulosRes.message ||
          catalogRes.message ||
          clientesRes.message ||
          'Error al cargar inventario'
      );
    }
    setLoading(false);
  }, [showMessage]);

  const fetchArticulos = useCallback(
    async (params = {}, refreshCatalog = false, options = {}) => {
      if (options.showLoading) setLoading(true);
      const shouldFetchCatalog = refreshCatalog;
      try {
        const [res, catalogRes] = await Promise.all([
          inventarioService.getArticulos(params),
          shouldFetchCatalog ? loadArticulosCatalogo() : Promise.resolve(null),
        ]);
        if (res.success) {
          setArticulos(res.data);
          setArticulosPagination(res.pagination);
        } else {
          showMessage('error', res.message);
        }
        if (catalogRes) {
          if (catalogRes.success) {
            setCatalogArticulos(catalogRes.data);
          } else {
            showMessage('error', catalogRes.message);
          }
        }
      } finally {
        if (options.showLoading) setLoading(false);
      }
    },
    [showMessage]
  );

  const loadMovimientos = useCallback(
    async (params = {}) => {
      setMovimientosLoading(true);
      const res = await inventarioService.getMovimientos(params);
      if (res.success) {
        setMovimientos(res.data);
        setMovimientosPagination(res.pagination);
        setMovimientosLoaded(true);
      } else {
        showMessage('error', res.message);
      }
      setMovimientosLoading(false);
    },
    [showMessage]
  );

  const loadBajas = useCallback(
    async (params = {}) => {
      setBajasLoading(true);
      const res = await inventarioService.getBajasArticulos(params);
      if (res.success) {
        setBajas(res.data);
        setBajasLoaded(true);
      } else {
        showMessage('error', res.message);
      }
      setBajasLoading(false);
    },
    [showMessage]
  );

  const upsertUbicacion = useCallback((ubicacion) => {
    if (!ubicacion?.nombre) return;

    const nextUbicacion = {
      articulos_activos: 0,
      articulos_totales: 0,
      ...ubicacion,
    };

    setUbicaciones((prev) => {
      const index = prev.findIndex((item) => item.id === nextUbicacion.id);
      const next =
        index >= 0
          ? prev.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...nextUbicacion } : item
            )
          : [...prev, nextUbicacion];

      return next.sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        })
      );
    });
  }, []);

  useEffect(() => {
    loadInitialData();
    loadMovimientos();
    loadBajas();
  }, [loadInitialData, loadMovimientos, loadBajas]);

  return {
    articulos,
    catalogArticulos,
    clientes,
    ubicaciones,
    movimientos,
    bajas,
    articulosPagination,
    movimientosPagination,
    loading,
    movimientosLoading,
    bajasLoading,
    movimientosLoaded,
    bajasLoaded,
    fetchArticulos,
    loadMovimientos,
    loadBajas,
    loadInitialData,
    upsertUbicacion,
  };
};

export default useInventarioData;
