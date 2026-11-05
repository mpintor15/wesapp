jest.mock('../config/database', () => ({
  transaction: jest.fn(),
  query: jest.fn(),
}));
jest.mock('../utils/audit', () => ({ logAudit: jest.fn() }));

const db = require('../config/database');
const { logAudit } = require('../utils/audit');
const {
  buildAutoCloseNote,
  closeStaleVisits,
  DEFAULT_DAYS,
} = require('../services/visitasCierreAutomaticoService');

describe('cierre automático de visitas', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = { query: jest.fn() };
    db.transaction.mockImplementation(async (callback) => callback(client));
  });

  test('cierra las visitas abiertas vencidas sin salida ni responsable y deja constancia', async () => {
    client.query.mockResolvedValue({
      rows: [
        { id: 10, ubicacion_id: 3, estado: 'CERRADA', entrada_at: '2026-10-01T10:00:00' },
        { id: 11, ubicacion_id: 3, estado: 'CERRADA', entrada_at: '2026-10-01T11:00:00' },
      ],
    });

    const closed = await closeStaleVisits();

    expect(closed).toBe(2);
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/estado = 'CERRADA'/);
    expect(sql).toContain('salida_at = NULL');
    expect(sql).toContain('cerrado_por_usuario_id = NULL');
    expect(sql).toContain('cerrado_por_colaborador_id = NULL');
    expect(sql).toMatch(/bv\.estado = 'ABIERTA'/);
    expect(sql).toContain('SKIP LOCKED');
    expect(params).toEqual([DEFAULT_DAYS, buildAutoCloseNote(DEFAULT_DAYS)]);
    expect(logAudit).toHaveBeenCalledTimes(2);
    expect(logAudit.mock.calls[0][1]).toMatchObject({
      tabla: 'bitacora_visitas',
      operacion: 'UPDATE',
      registro_id: '10',
      usuario_nombre: 'sistema',
    });
  });

  test('sin visitas vencidas no escribe auditoría', async () => {
    client.query.mockResolvedValue({ rows: [] });

    await expect(closeStaleVisits({ days: 7 })).resolves.toBe(0);
    expect(logAudit).not.toHaveBeenCalled();
  });

  test.each([[undefined], ['abc'], [0], [-3]])(
    'un plazo inválido (%p) usa el valor por defecto',
    async (days) => {
      client.query.mockResolvedValue({ rows: [] });

      await closeStaleVisits({ days });

      expect(client.query.mock.calls[0][1][0]).toBe(DEFAULT_DAYS);
    }
  );

  test('respeta un plazo configurado', async () => {
    client.query.mockResolvedValue({ rows: [] });

    await closeStaleVisits({ days: '10' });

    expect(client.query.mock.calls[0][1]).toEqual([10, buildAutoCloseNote(10)]);
  });
});
