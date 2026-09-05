/**
 * Solo gerente y secretario pueden ver o modificar banco, número de cuenta
 * y sueldo de un colaborador (regla de negocio de la integración
 * Usuarios→Personal). El resto de roles con acceso a Personal (contador,
 * supervisor) no deben recibir esos campos por ninguna vía: listado,
 * exportación ni escritura.
 */
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn(() => ({ usuario_id: 1, ip: '127.0.0.1' })),
}));

const db = require('../config/database');
const {
  getColaboradores,
  createColaborador,
  updateColaborador,
} = require('../controllers/personalController');

const mockReq = ({ body = {}, params = {}, query = {}, user } = {}) => ({
  body,
  params,
  query,
  user,
  ip: '127.0.0.1',
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const colaboradorRow = {
  id: 1,
  nombres_completos: 'Ana Torres',
  cedula: '0102030405',
  banco: 'Banco Pichincha',
  numero_cuenta: '2200123456',
  sueldo: '850.00',
  estado: 'activo',
  total_count: 1,
  usuario_id: null,
  usuario_usuario: null,
  usuario_tipo_usuario: null,
  usuario_activo: null,
  usuario_primer_login: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('personalController — acceso a datos sensibles por rol', () => {
  describe.each([
    ['gerente', true],
    ['secretario', true],
    ['contador', false],
    ['supervisor', false],
  ])('rol %s', (tipo_usuario, canAccessSensitive) => {
    test(`getColaboradores ${canAccessSensitive ? 'incluye' : 'oculta'} banco, numero_cuenta y sueldo`, async () => {
      db.query.mockResolvedValueOnce({ rows: [colaboradorRow], rowCount: 1 });
      const res = mockRes();

      await getColaboradores(mockReq({ query: {}, user: { id: 9, tipo_usuario } }), res);

      const body = res.json.mock.calls[0][0];
      const row = body.data[0];
      if (canAccessSensitive) {
        expect(row.banco).toBe('Banco Pichincha');
        expect(row.numero_cuenta).toBe('2200123456');
        expect(row.sueldo).toBe('850.00');
      } else {
        expect(row).not.toHaveProperty('banco');
        expect(row).not.toHaveProperty('numero_cuenta');
        expect(row).not.toHaveProperty('sueldo');
      }
      // El resto de campos siempre viaja, con o sin acceso sensible.
      expect(row.nombres_completos).toBe('Ana Torres');
    });

    test(`getColaboradores con ?search= ${canAccessSensitive ? 'sí' : 'no'} usa numero_cuenta como criterio de búsqueda`, async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = mockRes();

      await getColaboradores(
        mockReq({ query: { search: '2200123456' }, user: { id: 9, tipo_usuario } }),
        res
      );

      const [sql] = db.query.mock.calls[0];
      if (canAccessSensitive) {
        expect(sql).toContain('c.numero_cuenta ILIKE');
      } else {
        // Sin acceso a datos sensibles, buscar por un fragmento de cuenta
        // bancaria no debe poder confirmar/enumerar cuentas reales aunque el
        // campo venga redactado en la respuesta.
        expect(sql).not.toContain('numero_cuenta');
      }
    });

    test(`createColaborador ${canAccessSensitive ? 'guarda' : 'ignora'} banco, numero_cuenta y sueldo enviados en el body`, async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 5, nombres_completos: 'Nuevo Colaborador' }],
        rowCount: 1,
      });
      const res = mockRes();

      await createColaborador(
        mockReq({
          body: {
            nombres_completos: 'Nuevo Colaborador',
            cedula: '9988776655',
            fecha_nacimiento: '1990-01-01',
            cargo: 'Guardia',
            celular: '0987654321',
            banco: 'Banco del Pacífico',
            numero_cuenta: '999999',
            sueldo: 500,
          },
          user: { id: 9, tipo_usuario },
        }),
        res
      );

      expect(res.status).not.toHaveBeenCalledWith(400);
      const [, values] = db.query.mock.calls[0];
      // Orden del INSERT: [..., celular, banco, numero_cuenta, sueldo, estado]
      const [banco, numeroCuenta, sueldo] = values.slice(5, 8);
      if (canAccessSensitive) {
        expect(banco).toBe('Banco del Pacífico');
        expect(numeroCuenta).toBe('999999');
        expect(sueldo).toBe(500);
      } else {
        expect(banco).toBeNull();
        expect(numeroCuenta).toBeNull();
        expect(sueldo).toBeNull();
      }
    });

    test(`updateColaborador ${canAccessSensitive ? 'permite' : 'bloquea'} modificar banco, numero_cuenta y sueldo`, async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, nombres_completos: 'Ana Torres' }],
        rowCount: 1,
      });
      const res = mockRes();

      await updateColaborador(
        mockReq({
          params: { id: '1' },
          body: { banco: 'Banco Guayaquil', numero_cuenta: '111', sueldo: 700 },
          user: { id: 9, tipo_usuario },
        }),
        res
      );

      if (canAccessSensitive) {
        expect(res.status).not.toHaveBeenCalledWith(400);
        const [sql, values] = db.query.mock.calls[0];
        expect(sql).toContain('banco');
        expect(sql).toContain('numero_cuenta');
        expect(sql).toContain('sueldo');
        expect(values).toContain('Banco Guayaquil');
      } else {
        // Ningún campo permitido quedó en el body -> "No hay campos para actualizar".
        expect(db.query).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        const body = res.json.mock.calls[0][0];
        expect(body.message).toMatch(/no hay campos/i);
      }
    });
  });
});

describe('personalController.createColaborador — campos obligatorios por rol', () => {
  const baseBody = {
    nombres_completos: 'Nuevo Colaborador',
    cedula: '9988776655',
    fecha_nacimiento: '1990-01-01',
    cargo: 'Guardia',
  };

  test.each(['gerente', 'secretario'])(
    'rol %s: rechaza si falta celular, banco, numero_cuenta o sueldo',
    async (tipo_usuario) => {
      const sensitiveBody = {
        celular: '0987654321',
        banco: 'Banco del Pacífico',
        numero_cuenta: '999999',
        sueldo: 500,
      };
      const cases = [
        { ...sensitiveBody, celular: undefined },
        { ...sensitiveBody, celular: '   ' },
        { ...sensitiveBody, banco: undefined },
        { ...sensitiveBody, banco: '   ' },
        { ...sensitiveBody, numero_cuenta: undefined },
        { ...sensitiveBody, numero_cuenta: '   ' },
        { ...sensitiveBody, sueldo: undefined },
        { ...sensitiveBody, sueldo: '' },
      ];

      for (const overrides of cases) {
        const res = mockRes();
        // eslint-disable-next-line no-await-in-loop
        await createColaborador(
          mockReq({ body: { ...baseBody, ...overrides }, user: { id: 9, tipo_usuario } }),
          res
        );
        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.query).not.toHaveBeenCalled();
      }
    }
  );

  test('gerente: crea con éxito cuando los 4 campos obligatorios están completos', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 5, nombres_completos: 'Nuevo Colaborador' }],
      rowCount: 1,
    });
    const res = mockRes();

    await createColaborador(
      mockReq({
        body: {
          ...baseBody,
          celular: '0987654321',
          banco: 'Banco del Pacífico',
          numero_cuenta: '999999',
          sueldo: 500,
        },
        user: { id: 9, tipo_usuario: 'gerente' },
      }),
      res
    );

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(db.query).toHaveBeenCalled();
  });

  test('supervisor: rechaza sin celular', async () => {
    const res = mockRes();

    await createColaborador(
      mockReq({ body: { ...baseBody }, user: { id: 9, tipo_usuario: 'supervisor' } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/celular/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('supervisor: crea con éxito solo con celular, sin banco/numero_cuenta/sueldo', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 6, nombres_completos: 'Nuevo Colaborador' }],
      rowCount: 1,
    });
    const res = mockRes();

    await createColaborador(
      mockReq({
        body: { ...baseBody, celular: '0987654321' },
        user: { id: 9, tipo_usuario: 'supervisor' },
      }),
      res
    );

    expect(res.status).not.toHaveBeenCalledWith(400);
    const [, values] = db.query.mock.calls[0];
    const [celular, banco, numeroCuenta, sueldo] = values.slice(4, 8);
    expect(celular).toBe('0987654321');
    expect(banco).toBeNull();
    expect(numeroCuenta).toBeNull();
    expect(sueldo).toBeNull();
  });

  test('supervisor: intento directo de enviar banco/numero_cuenta/sueldo sigue ignorado, no bloquea la creación', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 7, nombres_completos: 'Nuevo Colaborador' }],
      rowCount: 1,
    });
    const res = mockRes();

    await createColaborador(
      mockReq({
        body: {
          ...baseBody,
          celular: '0987654321',
          banco: 'Banco Hackeado',
          numero_cuenta: '000000',
          sueldo: 99999,
        },
        user: { id: 9, tipo_usuario: 'supervisor' },
      }),
      res
    );

    expect(res.status).not.toHaveBeenCalledWith(400);
    const [, values] = db.query.mock.calls[0];
    const [banco, numeroCuenta, sueldo] = values.slice(5, 8);
    expect(banco).toBeNull();
    expect(numeroCuenta).toBeNull();
    expect(sueldo).toBeNull();
  });
});
