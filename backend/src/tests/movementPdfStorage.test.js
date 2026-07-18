const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMovementPdfStorage } = require('../utils/movementPdfStorage');

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wesapp-pdf-storage-'));

describe('movementPdfStorage', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  test('construye referencias relativas portables dentro del directorio configurado', () => {
    tempDir = makeTempDir();
    const storage = createMovementPdfStorage(tempDir);

    expect(storage.buildMovementPdfReference(10)).toBe('movimientos/movimiento-10.pdf');
    expect(storage.normalizeReference('movimientos/movimiento-10.pdf')).toBe(
      'movimientos/movimiento-10.pdf'
    );
    expect(storage.resolveReference('movimientos/movimiento-10.pdf')).toBe(
      path.join(tempDir, 'movimientos', 'movimiento-10.pdf')
    );
  });

  test('mantiene compatibilidad con referencias legacy guardadas en DB', () => {
    tempDir = makeTempDir();
    const storage = createMovementPdfStorage(tempDir);

    expect(storage.normalizeReference('storage/movimientos/movimiento-10.pdf')).toBe(
      'movimientos/movimiento-10.pdf'
    );
    expect(storage.normalizeReference('backend/src/storage/movimientos/movimiento-10.pdf')).toBe(
      'movimientos/movimiento-10.pdf'
    );
    expect(storage.normalizeReference('movimiento-10.pdf')).toBe('movimientos/movimiento-10.pdf');
  });

  test('rechaza traversal, URLs y nombres fuera del patrón esperado', () => {
    tempDir = makeTempDir();
    const storage = createMovementPdfStorage(tempDir);

    expect(() => storage.resolveReference('../movimiento-10.pdf')).toThrow(/ruta inválida/i);
    expect(() => storage.resolveReference('movimientos/../secreto.pdf')).toThrow(/ruta inválida/i);
    expect(() => storage.resolveReference('https://example.com/movimiento-10.pdf')).toThrow(
      /ruta inválida/i
    );
    expect(() => storage.resolveReference('movimientos/reporte.pdf')).toThrow(/ruta inválida/i);
  });

  test('crea el directorio configurable y escribe PDFs de forma atómica', async () => {
    tempDir = makeTempDir();
    const storage = createMovementPdfStorage(tempDir);
    const writer = await storage.createAtomicWrite(10);

    writer.stream.end(Buffer.from('pdf-data'));
    await writer.finished;

    expect(fs.existsSync(writer.tempPath)).toBe(true);
    expect(fs.existsSync(writer.fullPath)).toBe(false);

    await writer.commit();

    expect(fs.existsSync(writer.tempPath)).toBe(false);
    expect(fs.readFileSync(writer.fullPath, 'utf8')).toBe('pdf-data');
    expect(writer.relativePath).toBe('movimientos/movimiento-10.pdf');
  });

  test('limpia el archivo temporal ante error de generación', async () => {
    tempDir = makeTempDir();
    const storage = createMovementPdfStorage(tempDir);
    const writer = await storage.createAtomicWrite(11);

    writer.stream.end(Buffer.from('partial-data'));
    await writer.finished;
    expect(fs.existsSync(writer.tempPath)).toBe(true);

    await writer.cleanup();

    expect(fs.existsSync(writer.tempPath)).toBe(false);
    expect(fs.existsSync(writer.fullPath)).toBe(false);
  });

  test('reporta archivo ausente sin crear archivos residuales', async () => {
    tempDir = makeTempDir();
    const storage = createMovementPdfStorage(tempDir);

    await storage.ensureReady();

    expect(storage.exists('movimientos/movimiento-99.pdf')).toBe(false);
    expect(fs.readdirSync(path.join(tempDir, 'movimientos'))).toEqual([]);
  });
});
