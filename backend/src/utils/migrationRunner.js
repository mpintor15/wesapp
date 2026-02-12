const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

/**
 * Sistema de migración de base de datos
 * Ejecuta migraciones SQL en orden y mantiene registro de versiones
 */

class MigrationRunner {
  constructor(migrationsDir = path.join(__dirname, '../../..', 'database', 'migrations')) {
    this.migrationsDir = migrationsDir;
  }

  /**
   * Inicializa la tabla de versiones si no existe
   */
  async initialize() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          description TEXT,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabla schema_version inicializada');
    } catch (error) {
      console.error('❌ Error al inicializar schema_version:', error);
      throw error;
    }
  }

  /**
   * Obtiene la versión actual de la base de datos
   */
  async getCurrentVersion() {
    try {
      const result = await db.query(
        'SELECT MAX(version) as current_version FROM schema_version'
      );
      return result.rows[0].current_version || 0;
    } catch (error) {
      console.error('❌ Error al obtener versión actual:', error);
      return 0;
    }
  }

  /**
   * Obtiene todas las migraciones disponibles
   */
  async getAvailableMigrations() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const sqlFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Orden alfabético (001_..., 002_...)

      return sqlFiles.map(file => {
        const match = file.match(/^(\d+)_(.+)\.sql$/);
        if (match) {
          return {
            version: parseInt(match[1]),
            description: match[2].replace(/_/g, ' '),
            filename: file,
            filepath: path.join(this.migrationsDir, file)
          };
        }
        return null;
      }).filter(Boolean);
    } catch (error) {
      console.error('❌ Error al leer directorio de migraciones:', error);
      return [];
    }
  }

  /**
   * Ejecuta una migración específica
   */
  async runMigration(migration) {
    const client = await db.getClient();
    try {
      console.log(`\n📄 Ejecutando migración ${migration.version}: ${migration.description}`);

      // Leer el archivo SQL
      const sql = await fs.readFile(migration.filepath, 'utf8');

      // Ejecutar en una transacción
      await client.query('BEGIN');

      // Ejecutar el SQL de la migración
      await client.query(sql);

      // Registrar la migración
      await client.query(
        'INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
        [migration.version, migration.description]
      );

      await client.query('COMMIT');

      console.log(`✅ Migración ${migration.version} completada exitosamente`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error en migración ${migration.version}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Ejecuta todas las migraciones pendientes
   */
  async runPending() {
    try {
      await this.initialize();

      const currentVersion = await this.getCurrentVersion();
      const availableMigrations = await getAvailableMigrations();

      const pendingMigrations = availableMigrations.filter(
        m => m.version > currentVersion
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No hay migraciones pendientes. Base de datos actualizada.');
        return { success: true, applied: 0 };
      }

      console.log(`\n🔄 Encontradas ${pendingMigrations.length} migraciones pendientes\n`);

      let appliedCount = 0;
      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
        appliedCount++;
      }

      console.log(`\n✅ ${appliedCount} migraciones aplicadas exitosamente\n`);
      return { success: true, applied: appliedCount };
    } catch (error) {
      console.error('\n❌ Error al ejecutar migraciones:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Muestra el estado de las migraciones
   */
  async status() {
    try {
      await this.initialize();

      const currentVersion = await this.getCurrentVersion();
      const availableMigrations = await this.getAvailableMigrations();

      console.log('\n📊 Estado de migraciones:\n');
      console.log(`   Versión actual: ${currentVersion}`);
      console.log(`   Migraciones disponibles: ${availableMigrations.length}\n`);

      for (const migration of availableMigrations) {
        const status = migration.version <= currentVersion ? '✅ Aplicada' : '⏳ Pendiente';
        console.log(`   ${status} - ${migration.version}: ${migration.description}`);
      }

      console.log('');
    } catch (error) {
      console.error('❌ Error al obtener estado:', error);
    }
  }
}

// Función helper para ejecutar desde CLI
const getAvailableMigrations = async () => {
  const migrationsDir = path.join(__dirname, '../../..', 'database', 'migrations');
  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();

    return sqlFiles.map(file => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (match) {
        return {
          version: parseInt(match[1]),
          description: match[2].replace(/_/g, ' '),
          filename: file,
          filepath: path.join(migrationsDir, file)
        };
      }
      return null;
    }).filter(Boolean);
  } catch (error) {
    console.error('❌ Error al leer directorio de migraciones:', error);
    return [];
  }
};

module.exports = MigrationRunner;

// Permitir ejecución desde CLI
if (require.main === module) {
  const runner = new MigrationRunner();
  const command = process.argv[2] || 'run';

  (async () => {
    try {
      if (command === 'run' || command === 'migrate') {
        await runner.runPending();
      } else if (command === 'status') {
        await runner.status();
      } else {
        console.log('\nUso: node migrationRunner.js [command]');
        console.log('\nComandos:');
        console.log('  run, migrate  - Ejecutar migraciones pendientes');
        console.log('  status        - Ver estado de migraciones\n');
      }

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error);
      await db.close();
      process.exit(1);
    }
  })();
}
