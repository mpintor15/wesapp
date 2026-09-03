const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '../../..');
const railwayConfigPath = path.resolve(projectRoot, 'railway.json');

describe('railway.json', () => {
  const config = JSON.parse(fs.readFileSync(railwayConfigPath, 'utf8'));

  it('define un healthcheckPath que apunta al endpoint de disponibilidad', () => {
    expect(config.deploy.healthcheckPath).toBe('/health/ready');
  });

  it('define un healthcheckTimeout numérico y con margen suficiente para migraciones', () => {
    expect(typeof config.deploy.healthcheckTimeout).toBe('number');
    // El arranque con 19 migraciones pendientes tomó ~18s en producción; se exige
    // margen amplio para no reintroducir el corte de tráfico (502) visto sin
    // healthcheck, sin dejar de fallar en un tiempo razonable ante un arranque roto.
    expect(config.deploy.healthcheckTimeout).toBeGreaterThanOrEqual(60);
  });

  it('mantiene el resto de la configuración de deploy sin cambios', () => {
    expect(config.deploy.startCommand).toBe('node backend/src/server.js');
    expect(config.deploy.restartPolicyType).toBe('ON_FAILURE');
    expect(config.deploy.restartPolicyMaxRetries).toBe(10);
  });
});
