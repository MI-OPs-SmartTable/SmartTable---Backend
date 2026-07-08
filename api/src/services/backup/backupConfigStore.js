const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  backupEnabled: true,
  intervalMinutes: 5,
  runOnStart: true,
  fileName: 'smarttable-backup.db.gz',
  googleDriveEnabled: false,
  googleDriveFolderId: '',
  lastRunAt: null,
  lastRunStatus: 'idle',
  lastRunError: null,
  lastLocalSizeBytes: null,
  lastDriveFileId: null,
};

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, '../../../pos.db');
}

function getConfigPath() {
  if (process.env.CONFIG_PATH) {
    return process.env.CONFIG_PATH;
  }

  return path.join(path.dirname(getDbPath()), 'backup-config.json');
}

function readConfigFile() {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('[backup] No se pudo leer backup-config.json:', error.message);
    return null;
  }
}

function getConfig() {
  const stored = readConfigFile();
  const merged = {
    ...DEFAULTS,
    ...(stored || {}),
  };

  return {
    ...merged,
    credentialsConfigured: hasCredentialsFile(),
    credentialsEmail: getCredentialsEmail(),
  };
}

function getPublicConfig() {
  const config = getConfig();

  return {
    backupEnabled: config.backupEnabled,
    intervalMinutes: config.intervalMinutes,
    runOnStart: config.runOnStart,
    fileName: config.fileName,
    googleDriveEnabled: config.googleDriveEnabled,
    googleDriveFolderId: config.googleDriveFolderId,
    credentialsConfigured: config.credentialsConfigured,
    credentialsEmail: config.credentialsEmail,
    lastRunAt: config.lastRunAt,
    lastRunStatus: config.lastRunStatus,
    lastRunError: config.lastRunError,
    lastLocalSizeBytes: config.lastLocalSizeBytes,
    lastDriveFileId: config.lastDriveFileId,
  };
}

function saveConfig(updates) {
  const current = getConfig();
  const next = {
    ...current,
    ...updates,
    credentialsConfigured: undefined,
    credentialsEmail: undefined,
  };

  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');

  return getPublicConfig();
}

function recordBackupResult({ success, error, sizeBytes, driveFileId }) {
  return saveConfig({
    lastRunAt: new Date().toISOString(),
    lastRunStatus: success ? 'success' : 'error',
    lastRunError: success ? null : (error || 'Error desconocido'),
    lastLocalSizeBytes: sizeBytes ?? null,
    lastDriveFileId: driveFileId ?? null,
  });
}

function getCredentialsPath() {
  if (process.env.GOOGLE_DRIVE_CREDENTIALS_PATH) {
    const configured = process.env.GOOGLE_DRIVE_CREDENTIALS_PATH;
    return path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured);
  }

  return path.join(path.dirname(getDbPath()), 'credentials', 'google-service-account.json');
}

function hasCredentialsFile() {
  return fs.existsSync(getCredentialsPath());
}

function getCredentialsEmail() {
  const credentialsPath = getCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    return credentials.client_email || null;
  } catch {
    return null;
  }
}

function saveCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    throw new Error('Credenciales inválidas');
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('El JSON debe ser de una cuenta de servicio de Google (client_email y private_key)');
  }

  const credentialsPath = getCredentialsPath();
  fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), 'utf8');

  return {
    configured: true,
    credentialsEmail: credentials.client_email,
  };
}

function deleteCredentials() {
  const credentialsPath = getCredentialsPath();

  if (fs.existsSync(credentialsPath)) {
    fs.unlinkSync(credentialsPath);
  }

  return { configured: false, credentialsEmail: null };
}

function isBackupEnabled() {
  return Boolean(getConfig().backupEnabled);
}

function isDriveEnabled() {
  return Boolean(getConfig().googleDriveEnabled);
}

function getIntervalMinutes() {
  const value = Number(getConfig().intervalMinutes);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

function shouldRunOnStart() {
  return Boolean(getConfig().runOnStart);
}

function getBackupFileName() {
  const configured = String(getConfig().fileName || '').trim();
  return configured || DEFAULTS.fileName;
}

function getGoogleDriveFolderId() {
  return String(getConfig().googleDriveFolderId || '').trim();
}

module.exports = {
  getConfig,
  getPublicConfig,
  saveConfig,
  recordBackupResult,
  getCredentialsPath,
  hasCredentialsFile,
  getCredentialsEmail,
  saveCredentials,
  deleteCredentials,
  isBackupEnabled,
  isDriveEnabled,
  getIntervalMinutes,
  shouldRunOnStart,
  getBackupFileName,
  getGoogleDriveFolderId,
};
