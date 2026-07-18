const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { createHttpError } = require('./http');

const MOVEMENTS_DIR = 'movimientos';
const MOVEMENT_PDF_NAME_PATTERN = /^movimiento-\d+\.pdf$/;
const LEGACY_PREFIXES = [
  'storage/movimientos/',
  'src/storage/movimientos/',
  'backend/src/storage/movimientos/',
];

const toPortablePath = (value) => value.split(path.sep).join('/');

const isInsideDirectory = (baseDir, candidatePath) => {
  const relative = path.relative(baseDir, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const createMovementPdfStorage = (basePath = config.pdfStorage.path) => {
  const baseDir = path.resolve(basePath);
  const movementsDir = path.join(baseDir, MOVEMENTS_DIR);

  const ensureInsideBase = (candidatePath) => {
    if (!isInsideDirectory(baseDir, candidatePath)) {
      throw createHttpError(400, 'Ruta inválida');
    }
  };

  const ensureMovementReference = (relativePath) => {
    const normalized = path.normalize(relativePath);
    const movementPrefix = `${MOVEMENTS_DIR}${path.sep}`;

    if (!normalized.startsWith(movementPrefix)) {
      throw createHttpError(400, 'Ruta inválida');
    }

    const filename = path.basename(normalized);
    if (!MOVEMENT_PDF_NAME_PATTERN.test(filename)) {
      throw createHttpError(400, 'Ruta inválida');
    }

    return toPortablePath(normalized);
  };

  const normalizeReference = (reference) => {
    if (!reference) {
      return null;
    }

    const raw = String(reference).trim();
    if (!raw) {
      return null;
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      throw createHttpError(400, 'Ruta inválida');
    }

    const portableRaw = raw.replace(/\\/g, '/');
    if (path.isAbsolute(raw)) {
      const absolutePath = path.resolve(raw);
      if (isInsideDirectory(baseDir, absolutePath)) {
        return ensureMovementReference(path.relative(baseDir, absolutePath));
      }

      const marker = '/storage/movimientos/';
      const markerIndex = portableRaw.lastIndexOf(marker);
      if (markerIndex >= 0) {
        return ensureMovementReference(
          `${MOVEMENTS_DIR}/${portableRaw.slice(markerIndex + marker.length)}`
        );
      }

      throw createHttpError(400, 'Ruta inválida');
    }

    let candidate = portableRaw.replace(/^\.\//, '');
    for (const prefix of LEGACY_PREFIXES) {
      if (candidate.startsWith(prefix)) {
        candidate = `${MOVEMENTS_DIR}/${candidate.slice(prefix.length)}`;
        break;
      }
    }
    if (!candidate.includes('/')) {
      candidate = `${MOVEMENTS_DIR}/${candidate}`;
    }

    const absoluteCandidate = path.resolve(baseDir, candidate);
    ensureInsideBase(absoluteCandidate);
    return ensureMovementReference(path.relative(baseDir, absoluteCandidate));
  };

  const resolveReference = (reference) => {
    const normalizedReference = normalizeReference(reference);
    if (!normalizedReference) {
      return null;
    }

    const fullPath = path.resolve(baseDir, normalizedReference);
    ensureInsideBase(fullPath);
    return fullPath;
  };

  const buildMovementPdfReference = (movementId) => {
    const id = Number(movementId);
    if (!Number.isInteger(id) || id <= 0) {
      throw createHttpError(400, 'El id del movimiento es inválido');
    }
    return `${MOVEMENTS_DIR}/movimiento-${id}.pdf`;
  };

  const ensureReady = async () => {
    await fs.promises.mkdir(movementsDir, { recursive: true });
    await fs.promises.access(movementsDir, fs.constants.R_OK | fs.constants.W_OK);
    return { ready: true };
  };

  const checkReady = async () => {
    try {
      await ensureReady();
      return { ready: true };
    } catch (error) {
      return { ready: false, code: error.code };
    }
  };

  const exists = (reference) => {
    const fullPath = resolveReference(reference);
    return Boolean(fullPath && fs.existsSync(fullPath));
  };

  const createAtomicWrite = async (movementId) => {
    await ensureReady();

    const relativePath = buildMovementPdfReference(movementId);
    const fullPath = resolveReference(relativePath);
    const filename = path.basename(fullPath);
    const tempPath = path.join(
      movementsDir,
      `.${filename}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
    );
    const stream = fs.createWriteStream(tempPath, { flags: 'wx' });
    const finished = new Promise((resolve, reject) => {
      stream.once('finish', resolve);
      stream.once('error', reject);
    });

    return {
      stream,
      fullPath,
      tempPath,
      relativePath,
      finished,
      commit: async () => {
        await fs.promises.rename(tempPath, fullPath);
      },
      cleanup: async () => {
        await fs.promises.rm(tempPath, { force: true });
      },
    };
  };

  return {
    baseDir,
    movementsDir,
    normalizeReference,
    resolveReference,
    buildMovementPdfReference,
    createAtomicWrite,
    checkReady,
    ensureReady,
    exists,
  };
};

const defaultStorage = createMovementPdfStorage();

module.exports = {
  createMovementPdfStorage,
  ...defaultStorage,
};
