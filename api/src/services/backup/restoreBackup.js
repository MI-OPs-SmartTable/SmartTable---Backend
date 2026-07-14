const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { createWriteStream } = require('fs');
const Database = require('better-sqlite3');
const { getBackupDir, getDbPath } = require('./createBackup');

const SQLITE_HEADER = Buffer.from('SQLite format 3\0');
const RESTART_EXIT_CODE = 42;
const SKIP_BACKUP_MARKER = '.skip-backup-on-start';

function getSkipBackupMarkerPath() {
  return path.join(getBackupDir(), SKIP_BACKUP_MARKER);
}

function markSkipBackupOnStart() {
  fs.writeFileSync(getSkipBackupMarkerPath(), new Date().toISOString(), 'utf8');
}

function consumeSkipBackupOnStart() {
  const marker = getSkipBackupMarkerPath();
  if (!fs.existsSync(marker)) {
    return false;
  }
  try {
    fs.unlinkSync(marker);
  } catch {
    // ignore
  }
  return true;
}

function isGzipBuffer(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function looksLikeSqlite(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    return header.equals(SQLITE_HEADER);
  } finally {
    fs.closeSync(fd);
  }
}

function assertValidSqlite(filePath) {
  if (!looksLikeSqlite(filePath)) {
    throw new Error('El archivo no es una base de datos SQLite válida');
  }

  const probe = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const row = probe
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'usuarios' LIMIT 1")
      .get();
    if (!row) {
      throw new Error('El respaldo no parece ser una base SmartTable (falta la tabla usuarios)');
    }
  } finally {
    probe.close();
  }
}

async function writeBufferToFile(buffer, destPath) {
  await pipeline(Readable.from(buffer), createWriteStream(destPath));
}

async function decompressGzipToFile(gzPath, destPath) {
  await pipeline(
    fs.createReadStream(gzPath),
    zlib.createGunzip(),
    createWriteStream(destPath)
  );
}

function removeSidecars(dbPath) {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const side = `${dbPath}${suffix}`;
    if (fs.existsSync(side)) {
      fs.unlinkSync(side);
    }
  }
}

function safeUnlink(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function checkpointAndCloseLiveDb(dbPath) {
  // Cierra el singleton de la app
  try {
    const db = require('../../database/db');
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // puede fallar si ya estaba cerrada
    }
    if (typeof db.close === 'function') {
      db.close();
    }
  } catch (err) {
    console.warn('[restore] No se pudo cerrar la conexión de la app:', err.message);
  }

  // Checkpoint extra con una conexión nueva (por si quedó WAL suelto)
  if (!fs.existsSync(dbPath)) {
    return;
  }
  try {
    const temp = new Database(dbPath);
    try {
      temp.pragma('wal_checkpoint(TRUNCATE)');
    } finally {
      temp.close();
    }
  } catch (err) {
    console.warn('[restore] Checkpoint extra falló:', err.message);
  }
}

async function materializeUploadToDb(buffer, originalName, destDbPath) {
  const backupDir = getBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = String(originalName || 'backup').replace(/[^\w.\-]+/g, '_');
  const uploadPath = path.join(backupDir, `restore-upload-${stamp}-${safeName}`);

  await writeBufferToFile(buffer, uploadPath);
  try {
    const nameLower = safeName.toLowerCase();
    const treatAsGzip = nameLower.endsWith('.gz') || isGzipBuffer(buffer);
    if (treatAsGzip) {
      await decompressGzipToFile(uploadPath, destDbPath);
    } else {
      fs.copyFileSync(uploadPath, destDbPath);
    }
    assertValidSqlite(destDbPath);
  } finally {
    safeUnlink(uploadPath);
  }
}

function readDbStats(dbPath) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const count = (sql) => {
      try {
        return Number(db.prepare(sql).get()?.total || 0);
      } catch {
        return 0;
      }
    };
    const usuarios = count('SELECT COUNT(*) AS total FROM usuarios');
    const nombres = db
      .prepare('SELECT nombre_completo AS nombre FROM usuarios ORDER BY nombre_completo LIMIT 8')
      .all()
      .map((r) => r.nombre);
    return {
      usuarios,
      mesas: count('SELECT COUNT(*) AS total FROM mesas'),
      productos: count('SELECT COUNT(*) AS total FROM productos'),
      insumos: count('SELECT COUNT(*) AS total FROM insumos'),
      categorias: count('SELECT COUNT(*) AS total FROM categorias'),
      nombresUsuarios: nombres,
    };
  } finally {
    db.close();
  }
}

/** Solo valida y resume el contenido del archivo, sin tocar la BD activa. */
async function previewUploadBuffer(buffer, originalName = 'backup.db.gz') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) {
    throw new Error('Archivo de respaldo vacío o inválido');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const decodedDbPath = path.join(getBackupDir(), `restore-preview-${stamp}.db`);

  try {
    await materializeUploadToDb(buffer, originalName, decodedDbPath);
    const stats = readDbStats(decodedDbPath);
    return {
      ok: true,
      fileName: originalName,
      sizeBytes: buffer.length,
      ...stats,
      aviso:
        stats.usuarios <= 1 && stats.productos === 0
          ? 'Este archivo parece un inicio vacío (solo seed). Si esperabas todos tus datos, el respaldo de Drive probablemente se sobrescribió después de borrar la BD.'
          : null,
    };
  } finally {
    safeUnlink(decodedDbPath);
  }
}

/**
 * Restaura la BD activa desde un buffer subido (.db.gz, .db o .sqlite).
 * Tras éxito, el proceso debe reiniciarse (exit 42 en Electron).
 */
async function restoreFromUploadBuffer(buffer, originalName = 'backup.db.gz') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) {
    throw new Error('Archivo de respaldo vacío o inválido');
  }

  const backupDir = getBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const stagingPath = path.join(backupDir, `restore-staging-${stamp}.db`);
  const dbPath = getDbPath();
  const safetyPath = path.join(backupDir, `pre-restore-${stamp}.db`);
  const oldDbPath = `${dbPath}.pre-restore-old`;

  try {
    await materializeUploadToDb(buffer, originalName, stagingPath);
    const stats = readDbStats(stagingPath);

    const { stopBackupScheduler } = require('./scheduler');
    stopBackupScheduler();

    // Copia de seguridad de la BD actual (antes de cerrar del todo)
    if (fs.existsSync(dbPath)) {
      try {
        const live = new Database(dbPath, { readonly: true, fileMustExist: true });
        try {
          await live.backup(safetyPath);
        } finally {
          live.close();
        }
      } catch {
        try {
          fs.copyFileSync(dbPath, safetyPath);
        } catch {
          // ignore
        }
      }
    }

    checkpointAndCloseLiveDb(dbPath);
    await new Promise((r) => setTimeout(r, 300));

    // Quitar WAL/SHM para que no se reapliquen sobre el archivo restaurado
    removeSidecars(dbPath);
    safeUnlink(oldDbPath);

    if (fs.existsSync(dbPath)) {
      fs.renameSync(dbPath, oldDbPath);
    }

    fs.copyFileSync(stagingPath, dbPath);
    removeSidecars(dbPath);

    // Verificación final
    const verifyStats = readDbStats(dbPath);

    safeUnlink(oldDbPath);
    markSkipBackupOnStart();

    console.log(
      `[restore] BD restaurada en ${dbPath} (${verifyStats.usuarios} usuarios, ${verifyStats.productos} productos). Se omitirá el backup al reiniciar.`
    );

    return {
      success: true,
      requiresRestart: true,
      restartExitCode: RESTART_EXIT_CODE,
      dbPath,
      userCount: verifyStats.usuarios,
      stats: verifyStats,
      safetyBackup: fs.existsSync(safetyPath) ? path.basename(safetyPath) : null,
      message:
        `Base restaurada: ${verifyStats.usuarios} usuario(s), ${verifyStats.productos} producto(s), ${verifyStats.mesas} mesa(s). ` +
        'La app se reiniciará; vuelve a iniciar sesión.',
      aviso:
        verifyStats.usuarios <= 1 && verifyStats.productos === 0
          ? 'Este archivo parece un inicio vacío (solo seed). Si esperabas todos tus datos, el respaldo de Drive probablemente se sobrescribió después de borrar la BD.'
          : null,
    };
  } finally {
    safeUnlink(stagingPath);
  }
}

function scheduleProcessRestart(exitCode = RESTART_EXIT_CODE) {
  setTimeout(() => {
    console.log(`[restore] Reiniciando proceso (código ${exitCode}) para aplicar la BD restaurada...`);
    process.exit(exitCode);
  }, 800);
}

module.exports = {
  restoreFromUploadBuffer,
  previewUploadBuffer,
  scheduleProcessRestart,
  consumeSkipBackupOnStart,
  RESTART_EXIT_CODE,
};
