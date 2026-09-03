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
