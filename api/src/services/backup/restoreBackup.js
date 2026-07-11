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
  const safeName = String(originalName || 'backup').replace(/[^\w.\-]+/g, '_');
  const uploadPath = path.join(backupDir, `restore-upload-${stamp}-${safeName}`);
  const decodedDbPath = path.join(backupDir, `restore-decoded-${stamp}.db`);
  const stagingPath = path.join(backupDir, `restore-staging-${stamp}.db`);
  const dbPath = getDbPath();
  const safetyPath = path.join(backupDir, `pre-restore-${stamp}.db`);
  const oldDbPath = `${dbPath}.pre-restore-old`;

  await writeBufferToFile(buffer, uploadPath);

  try {
    const nameLower = safeName.toLowerCase();
    const treatAsGzip = nameLower.endsWith('.gz') || isGzipBuffer(buffer);

    if (treatAsGzip) {
      await decompressGzipToFile(uploadPath, decodedDbPath);
    } else {
      fs.copyFileSync(uploadPath, decodedDbPath);
    }

    assertValidSqlite(decodedDbPath);
    fs.copyFileSync(decodedDbPath, stagingPath);

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

    // Verificación final: la BD activa debe abrir y tener usuarios del respaldo
    const verify = new Database(dbPath, { readonly: true, fileMustExist: true });
    let userCount = 0;
    try {
      userCount = Number(verify.prepare('SELECT COUNT(*) AS total FROM usuarios').get()?.total || 0);
    } finally {
      verify.close();
    }

    safeUnlink(oldDbPath);
    markSkipBackupOnStart();

    console.log(`[restore] BD restaurada en ${dbPath} (${userCount} usuarios). Se omitirá el backup al reiniciar.`);

    return {
      success: true,
      requiresRestart: true,
      restartExitCode: RESTART_EXIT_CODE,
      dbPath,
      userCount,
      safetyBackup: fs.existsSync(safetyPath) ? path.basename(safetyPath) : null,
      message:
        'Base de datos restaurada. La aplicación se reiniciará para cargar todos los datos. Vuelve a iniciar sesión.',
    };
  } finally {
    for (const p of [uploadPath, decodedDbPath, stagingPath]) {
      try {
        safeUnlink(p);
      } catch {
        // ignore cleanup errors
      }
    }
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
  scheduleProcessRestart,
  consumeSkipBackupOnStart,
  RESTART_EXIT_CODE,
};
