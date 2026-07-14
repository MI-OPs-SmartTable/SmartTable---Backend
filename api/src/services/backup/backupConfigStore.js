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

  const credentials = getCredentialsStatus();

  return {
    ...merged,
    credentialsConfigured: credentials.configured,
    credentialsEmail: credentials.credentialsEmail,
    credentialsType: credentials.credentialsType,
    oauthPending: credentials.oauthPending,
    oauthClientConfigured: credentials.oauthClientConfigured,
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
    credentialsType: config.credentialsType,
    oauthPending: config.oauthPending,
    oauthClientConfigured: config.oauthClientConfigured,
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
    credentialsType: undefined,
    oauthPending: undefined,
    oauthClientConfigured: undefined,
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

function getBundledOAuthClient() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();

  if (clientId && clientSecret) {
    return {
      type: 'oauth_client',
      client_id: clientId,
      client_secret: clientSecret,
    };
  }

  const clientPath = String(process.env.GOOGLE_OAUTH_CLIENT_PATH || '').trim();
  if (!clientPath) {
    return null;
  }

  const resolved = path.isAbsolute(clientPath)
    ? clientPath
    : path.join(process.cwd(), clientPath);

  if (!fs.existsSync(resolved)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    const installed = raw.installed || raw.web || raw;
    if (installed?.client_id && installed?.client_secret) {
      return {
        type: 'oauth_client',
        client_id: installed.client_id,
        client_secret: installed.client_secret,
      };
    }
  } catch (error) {
    console.error('[backup] No se pudo leer GOOGLE_OAUTH_CLIENT_PATH:', error.message);
  }

  return null;
}

function readCredentialsFile() {
  const credentialsPath = getCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeCredentialsFile(credentials) {
  const credentialsPath = getCredentialsPath();
  fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), 'utf8');
}

function hasCredentialsFile() {
  return Boolean(readCredentialsFile());
}

function getCredentialsStatus() {
  const bundled = getBundledOAuthClient();
  const credentials = readCredentialsFile();

  if (credentials?.type === 'authorized_user' && credentials.refresh_token) {
    return {
      configured: true,
      credentialsEmail: credentials.email || 'Cuenta Google conectada',
      credentialsType: 'oauth',
      oauthPending: false,
      oauthClientConfigured: true,
    };
  }

  if (bundled) {
    return {
      configured: false,
      credentialsEmail: null,
      credentialsType: 'oauth_pending',
      oauthPending: true,
      oauthClientConfigured: true,
    };
  }

  if (credentials?.type === 'oauth_client' && credentials.client_id && credentials.client_secret) {
    return {
      configured: false,
      credentialsEmail: null,
      credentialsType: 'oauth_pending',
      oauthPending: true,
      oauthClientConfigured: true,
    };
  }

  if (credentials?.type === 'service_account' || (credentials?.client_email && credentials?.private_key)) {
    return {
      configured: true,
      credentialsEmail: credentials.client_email || null,
      credentialsType: 'service_account',
      oauthPending: false,
      oauthClientConfigured: Boolean(bundled),
    };
  }

  return {
    configured: false,
    credentialsEmail: null,
    credentialsType: 'none',
    oauthPending: false,
    oauthClientConfigured: false,
  };
}

function getCredentialsEmail() {
  return getCredentialsStatus().credentialsEmail;
}

function isCredentialsReady() {
  return getCredentialsStatus().configured;
}

function saveAuthorizedUserCredentials({ client_id, client_secret, refresh_token, email }) {
  writeCredentialsFile({
    type: 'authorized_user',
    client_id,
    client_secret,
    refresh_token,
    email: email || null,
  });

  return getCredentialsStatus();
}

function deleteCredentials() {
  const credentialsPath = getCredentialsPath();

  if (fs.existsSync(credentialsPath)) {
    fs.unlinkSync(credentialsPath);
  }

  return getCredentialsStatus();
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
  readCredentialsFile,
  getBundledOAuthClient,
  getCredentialsStatus,
  getCredentialsEmail,
  isCredentialsReady,
  saveAuthorizedUserCredentials,
  deleteCredentials,
  isBackupEnabled,
  isDriveEnabled,
  getIntervalMinutes,
  shouldRunOnStart,
  getBackupFileName,
  getGoogleDriveFolderId,
};
