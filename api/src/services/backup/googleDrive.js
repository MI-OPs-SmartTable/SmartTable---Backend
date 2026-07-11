const fs = require('fs');
const { google } = require('googleapis');
const {
  readCredentialsFile,
  getBundledOAuthClient,
  getBackupFileName,
  getGoogleDriveFolderId,
  isDriveEnabled,
  saveAuthorizedUserCredentials,
  deleteCredentials,
} = require('./backupConfigStore');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const pendingOAuthStates = new Map();

function isDriveEnabledExport() {
  return isDriveEnabled();
}

function getOAuthRedirectUri() {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }

  const port = process.env.PORT || 8080;
  return `http://127.0.0.1:${port}/api/backup/oauth/callback`;
}

function resolveOAuthClientCredentials() {
  const bundled = getBundledOAuthClient();
  if (bundled) {
    return bundled;
  }

  const stored = readCredentialsFile();
  if (stored?.type === 'oauth_client' && stored.client_id && stored.client_secret) {
    return stored;
  }

  if (stored?.type === 'authorized_user' && stored.client_id && stored.client_secret) {
    return {
      type: 'oauth_client',
      client_id: stored.client_id,
      client_secret: stored.client_secret,
    };
  }

  return null;
}

function createOAuth2Client(clientId, clientSecret) {
  return new google.auth.OAuth2(clientId, clientSecret, getOAuthRedirectUri());
}

function mapDriveError(error) {
  const message = error?.message || String(error);

  if (
    message.includes('Service Accounts do not have storage quota')
    || message.includes('storage quota')
  ) {
    return new Error(
      'Las cuentas de servicio no pueden guardar en Drive personal. '
      + 'Desconecta y usa “Conectar con Google” con la cuenta del cliente.'
    );
  }

  return error instanceof Error ? error : new Error(message);
}

async function getDriveClient() {
  const credentials = readCredentialsFile();

  if (credentials?.type === 'authorized_user' && credentials.refresh_token) {
    const oauth2Client = createOAuth2Client(credentials.client_id, credentials.client_secret);
    oauth2Client.setCredentials({ refresh_token: credentials.refresh_token });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  if (getBundledOAuthClient() || credentials?.type === 'oauth_client') {
    throw new Error(
      'Falta autorizar la cuenta de Google del cliente. Pulsa “Conectar con Google” en Configuración → Respaldo.'
    );
  }

  if (credentials?.type === 'service_account' || (credentials?.client_email && credentials?.private_key)) {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [DRIVE_SCOPE],
    });

    return google.drive({ version: 'v3', auth });
  }

  throw new Error(
    'Google Drive no está listo. Configura GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en el .env de la app.'
  );
}

function createOAuthStart() {
  const oauthClient = resolveOAuthClientCredentials();

  if (!oauthClient) {
    throw new Error(
      'Falta el cliente OAuth de SmartTable. El proveedor debe configurar GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en el .env.'
    );
  }

  const oauth2Client = createOAuth2Client(oauthClient.client_id, oauthClient.client_secret);
  const state = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  pendingOAuthStates.set(state, {
    createdAt: Date.now(),
    client_id: oauthClient.client_id,
    client_secret: oauthClient.client_secret,
  });

  const maxAgeMs = 15 * 60 * 1000;
  for (const [key, value] of pendingOAuthStates.entries()) {
    if (Date.now() - value.createdAt > maxAgeMs) {
      pendingOAuthStates.delete(key);
    }
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_SCOPE],
    state,
  });

  return {
    authUrl,
    redirectUri: getOAuthRedirectUri(),
    state,
  };
}

async function completeOAuthCallback({ code, state }) {
  if (!code) {
    throw new Error('Falta el código de autorización de Google');
  }

  const pending = state ? pendingOAuthStates.get(state) : null;
  const bundled = resolveOAuthClientCredentials();

  const clientId = pending?.client_id || bundled?.client_id;
  const clientSecret = pending?.client_secret || bundled?.client_secret;

  if (!clientId || !clientSecret) {
    throw new Error('No hay cliente OAuth configurado. Vuelve a pulsar “Conectar con Google”.');
  }

  if (state && !pending) {
    throw new Error('La autorización expiró o es inválida. Vuelve a pulsar “Conectar con Google”.');
  }

  const oauth2Client = createOAuth2Client(clientId, clientSecret);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google no devolvió refresh_token. Revoca el acceso de la app en tu cuenta Google y vuelve a autorizar.'
    );
  }

  oauth2Client.setCredentials(tokens);

  let email = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const me = await oauth2.userinfo.get();
    email = me.data.email || null;
  } catch {
    email = null;
  }

  const status = saveAuthorizedUserCredentials({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
    email,
  });

  if (state) {
    pendingOAuthStates.delete(state);
  }

  return status;
}

async function revokeGoogleAccess() {
  const credentials = readCredentialsFile();
  const token = credentials?.refresh_token || credentials?.access_token || null;

  if (token && credentials?.client_id && credentials?.client_secret) {
    try {
      const oauth2Client = createOAuth2Client(credentials.client_id, credentials.client_secret);
      await oauth2Client.revokeToken(String(token));
    } catch (error) {
      // Si el token ya estaba revocado o expiró, igual limpiamos localmente.
      console.warn('[backup] Error al revocar acceso en Google:', error.message);
    }
  } else if (token) {
    try {
      const body = new URLSearchParams({ token: String(token) });
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (error) {
      console.warn('[backup] Error al revocar acceso en Google:', error.message);
    }
  }

  return deleteCredentials();
}

async function findRemoteBackup(drive, folderId, fileName) {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
  });

  return response.data.files?.[0] || null;
}

async function uploadBackup({ backupPath, fileName = getBackupFileName() }) {
  const folderId = getGoogleDriveFolderId();

  if (!folderId) {
    throw new Error('El ID de carpeta de Google Drive no está configurado.');
  }

  try {
    const drive = await getDriveClient();
    const existing = await findRemoteBackup(drive, folderId, fileName);
    const media = {
      mimeType: 'application/gzip',
      body: fs.createReadStream(backupPath),
    };

    if (existing) {
      const response = await drive.files.update({
        fileId: existing.id,
        media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });

      return { ...response.data, overwritten: true };
    }

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    return { ...response.data, overwritten: false };
  } catch (error) {
    throw mapDriveError(error);
  }
}

module.exports = {
  isDriveEnabled: isDriveEnabledExport,
  uploadBackup,
  createOAuthStart,
  completeOAuthCallback,
  revokeGoogleAccess,
  getOAuthRedirectUri,
};
