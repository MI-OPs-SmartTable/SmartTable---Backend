const fs = require('fs');
const { google } = require('googleapis');
const {
  getCredentialsPath,
  getBackupFileName,
  getGoogleDriveFolderId,
  isDriveEnabled,
} = require('./backupConfigStore');

function isDriveEnabledExport() {
  return isDriveEnabled();
}

function getDriveClient() {
  const credentialsPath = getCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    throw new Error('Credenciales de Google Drive no configuradas. Súbelas desde Configuración.');
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

async function findRemoteBackup(drive, folderId, fileName) {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  return response.data.files?.[0] || null;
}

async function uploadBackup({ backupPath, fileName = getBackupFileName() }) {
  const folderId = getGoogleDriveFolderId();

  if (!folderId) {
    throw new Error('El ID de carpeta de Google Drive no está configurado.');
  }

  const drive = getDriveClient();
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
  });

  return { ...response.data, overwritten: false };
}

module.exports = {
  isDriveEnabled: isDriveEnabledExport,
  uploadBackup,
};
