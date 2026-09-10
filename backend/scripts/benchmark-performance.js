const { performance } = require('node:perf_hooks');
const { Pool } = require('pg');
require('../src/config/config');

const iterations = Number.parseInt(process.env.PERF_ITERATIONS || '30', 10);
const warmups = Number.parseInt(process.env.PERF_WARMUPS || '5', 10);
const baseUrl = process.env.PERF_BASE_URL || 'http://localhost:3001';

const percentile = (values, value) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((value / 100) * sorted.length) - 1)];
};

const summarize = (name, type, samples, rows) => ({
  name,
  type,
  samples: samples.length,
  rows,
  p50: Number(percentile(samples, 50).toFixed(2)),
  p95: Number(percentile(samples, 95).toFixed(2)),
});

const measure = async (callback) => {
  const start = performance.now();
  const rows = await callback();
  return { duration: performance.now() - start, rows };
};

const countPlanRows = (node) =>
  (node['Actual Rows'] || 0) * (node['Actual Loops'] || 1) +
  (node.Plans || []).reduce((total, child) => total + countPlanRows(child), 0);

const getToken = async () => {
  if (process.env.PERF_TOKEN) return process.env.PERF_TOKEN;
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      usuario: process.env.PERF_USERNAME || 'e2e_gerente',
      password: process.env.PERF_PASSWORD || 'E2E_Local_Password_123!',
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.data?.token) throw new Error('No se pudo obtener el token de medición');
  return body.data.token;
};

const apiOperations = [
  ['Personal', '/api/personal/colaboradores?page=1&pageSize=25'],
  ['Inventario', '/api/inventario/articulos?page=1&pageSize=25'],
  ['Cuentas', '/api/cuentas/reporte?page=1&pageSize=25'],
  ['Bitácora', '/api/bitacoras/registros?page=1&pageSize=25'],
  ['Visitas', '/api/bitacoras/visitas?page=1&pageSize=25'],
];

const sqlOperations = [
  [
    'Personal SQL',
    `SELECT c.id FROM colaboradores c LEFT JOIN usuarios u ON u.colaborador_id = c.id ORDER BY c.nombres_completos, c.id LIMIT 25`,
  ],
  [
    'Inventario SQL',
    `SELECT a.id FROM articulos a LEFT JOIN ubicaciones u ON u.id = a.ubicacion_id WHERE a.activo = TRUE ORDER BY a.id DESC LIMIT 25`,
  ],
  [
    'Cuentas SQL',
    `SELECT c.id, COALESCE(SUM(ct.valor_factura), 0) FROM clientes c LEFT JOIN cuentas ct ON ct.cliente_id = c.id GROUP BY c.id ORDER BY c.id LIMIT 25`,
  ],
  [
    'Bitácora SQL',
    `SELECT br.id FROM bitacora_registros br WHERE br.origen = 'MANUAL' ORDER BY br.ocurrido_at DESC, br.id DESC LIMIT 25`,
  ],
  [
    'Visitas SQL',
    `SELECT bv.id FROM bitacora_visitas bv ORDER BY bv.entrada_at DESC, bv.id DESC LIMIT 25`,
  ],
];

const benchmarkApi = async (token) => {
  const results = [];
  for (const [name, path] of apiOperations) {
    const samples = [];
    let rows = 0;
    for (let index = 0; index < warmups + iterations; index += 1) {
      const sample = await measure(async () => {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(`${name} respondió ${response.status}`);
        return Array.isArray(body.data) ? body.data.length : 0;
      });
      rows = sample.rows;
      if (index >= warmups) samples.push(sample.duration);
    }
    results.push(summarize(name, 'API', samples, rows));
  }
  return results;
};

const benchmarkSql = async (pool) => {
  const results = [];
  for (const [name, sql] of sqlOperations) {
    const samples = [];
    const planResult = await pool.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`);
    const rows = countPlanRows(planResult.rows[0]['QUERY PLAN'][0].Plan);
    for (let index = 0; index < warmups + iterations; index += 1) {
      const sample = await measure(async () => {
        const result = await pool.query(sql);
        return result.rowCount;
      });
      if (index >= warmups) samples.push(sample.duration);
    }
    results.push(summarize(name, 'SQL', samples, rows));
  }
  return results;
};

const printReport = (results) => {
  console.log('| Operación | Tipo | Muestras | Filas | p50 ms | p95 ms | Objetivo p95 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|');
  results.forEach((item) => {
    const target = item.type === 'API' ? 500 : 300;
    console.log(
      `| ${item.name} | ${item.type} | ${item.samples} | ${item.rows} | ${item.p50} | ${item.p95} | ${target} |`
    );
  });
  console.log('\nCinco operaciones más lentas por p95:');
  results
    .toSorted((a, b) => b.p95 - a.p95)
    .slice(0, 5)
    .forEach((item, index) => console.log(`${index + 1}. ${item.name}: ${item.p95} ms`));
};

const main = async () => {
  if (
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    !Number.isInteger(warmups) ||
    warmups < 0
  ) {
    throw new Error('PERF_ITERATIONS y PERF_WARMUPS deben ser enteros válidos');
  }
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  try {
    const token = await getToken();
    printReport([...(await benchmarkApi(token)), ...(await benchmarkSql(pool))]);
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
