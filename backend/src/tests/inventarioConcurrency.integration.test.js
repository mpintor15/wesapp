const db = require('../config/database');

const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;

describe('inventario PostgreSQL concurrency', () => {
  let schemaName;
  let schemaIdent;

  beforeAll(async () => {
    schemaName = `inventory_concurrency_${Date.now()}`;
    schemaIdent = quoteIdent(schemaName);

    await db.query(`CREATE SCHEMA ${schemaIdent}`);
    await db.query(`
      CREATE TABLE ${schemaIdent}.articulos (
        id SERIAL PRIMARY KEY,
        cantidad INTEGER NOT NULL CHECK (cantidad >= 0)
      )
    `);
    await db.query(`
      CREATE TABLE ${schemaIdent}.movimientos (
        id SERIAL PRIMARY KEY,
        estado TEXT NOT NULL
      )
    `);
    await db.query(`
      CREATE TABLE ${schemaIdent}.audit_log (
        id SERIAL PRIMARY KEY,
        tabla TEXT NOT NULL,
        operacion TEXT NOT NULL,
        registro_id TEXT
      )
    `);
  });

  afterAll(async () => {
    if (schemaIdent) {
      await db.query(`DROP SCHEMA IF EXISTS ${schemaIdent} CASCADE`);
    }
    await db.close();
  });

  const withdrawFour = async (client, articuloId, delayBeforeWriteMs = 0) => {
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const articuloRes = await client.query('SELECT * FROM articulos WHERE id = $1 FOR UPDATE', [
        articuloId,
      ]);
      const currentStock = Number(articuloRes.rows[0].cantidad);

      if (delayBeforeWriteMs > 0) {
        await client.query('SELECT pg_sleep($1)', [delayBeforeWriteMs / 1000]);
      }

      if (currentStock < 4) {
        await client.query('ROLLBACK');
        return { status: 409, code: 'INSUFFICIENT_STOCK' };
      }

      await client.query('UPDATE articulos SET cantidad = cantidad - 4 WHERE id = $1', [
        articuloId,
      ]);
      const movimientoRes = await client.query(
        'INSERT INTO movimientos (estado) VALUES ($$ACTIVO$$) RETURNING id'
      );
      await client.query(
        'INSERT INTO audit_log (tabla, operacion, registro_id) VALUES ($$movimientos$$, $$INSERT$$, $1)',
        [String(movimientoRes.rows[0].id)]
      );
      await client.query('COMMIT');
      return { status: 201, movimientoId: movimientoRes.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  };

  test('dos retiros concurrentes usan bloqueo real y solo uno confirma movimiento', async () => {
    const setupRes = await db.query(
      `INSERT INTO ${schemaIdent}.articulos (cantidad) VALUES (5) RETURNING id`
    );
    const articuloId = setupRes.rows[0].id;

    const clientA = await db.getClient();
    const clientB = await db.getClient();

    try {
      const first = withdrawFour(clientA, articuloId, 250);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = withdrawFour(clientB, articuloId, 0);

      const results = await Promise.all([first, second]);
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);

      const stockRes = await db.query(
        `SELECT cantidad FROM ${schemaIdent}.articulos WHERE id = $1`,
        [articuloId]
      );
      expect(Number(stockRes.rows[0].cantidad)).toBe(1);

      const movimientosRes = await db.query(
        `SELECT COUNT(*)::int AS count FROM ${schemaIdent}.movimientos WHERE estado = 'ACTIVO'`
      );
      expect(movimientosRes.rows[0].count).toBe(1);

      const auditRes = await db.query(
        `SELECT COUNT(*)::int AS count FROM ${schemaIdent}.audit_log WHERE tabla = 'movimientos' AND operacion = 'INSERT'`
      );
      expect(auditRes.rows[0].count).toBe(1);
    } finally {
      clientA.release();
      clientB.release();
    }
  });
});
