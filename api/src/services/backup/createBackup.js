const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { createReadStream, createWriteStream } = require('fs');
const Database = require('better-sqlite3');
const { getBackupFileName } = require('./backupConfigStore');

const defaultDbPath = path.join(__dirname, '../../../pos.db');

function getDbPath() {
  return process.env.DB_PATH || defaultDbPath;
}

function getBackupDir() {
  if (process.env.BACKUP_LOCAL_DIR) {
    const dir = path.isAbsolute(process.env.BACKUP_LOCAL_DIR)
      ? process.env.BACKUP_LOCAL_DIR
      : path.join(process.cwd(), process.env.BACKUP_LOCAL_DIR);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  const dir = path.join(path.dirname(getDbPath()), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function createSqliteBackup(tempDbPath) {
  const dbPath = getDbPath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(`No se encontró la base de datos en: ${dbPath}`);
  }

  const source = new Database(dbPath, { readonly: true, fileMustExist: true });

  try {
    await source.backup(tempDbPath);
  } finally {
    source.close();
  }
}

async function compressFile(inputPath, outputPath) {
  await pipeline(
    createReadStream(inputPath),
    zlib.createGzip({ level: 9 }),
    createWriteStream(outputPath)
  );
}

async function createBackup() {
  const backupDir = getBackupDir();
  const fileName = getBackupFileName();
  const backupPath = path.join(backupDir, fileName);
  const tempDbPath = path.join(backupDir, `${fileName}.tmp.db`);
  const tempGzPath = path.join(backupDir, `${fileName}.tmp.gz`);

  await createSqliteBackup(tempDbPath);
  await compressFile(tempDbPath, tempGzPath);
  fs.unlinkSync(tempDbPath);
  fs.renameSync(tempGzPath, backupPath);

  return {
    fileName,
    backupPath,
    sizeBytes: fs.statSync(backupPath).size,
  };
}

module.exports = {
  createBackup,
  getBackupDir,
  getDbPath,
};
