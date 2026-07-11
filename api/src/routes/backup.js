const express = require('express');
const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const backupConfigStore = require('../services/backup/backupConfigStore');
const {
  restartBackupScheduler,
  runBackupCycle,
} = require('../services/backup/scheduler');
const {
  createOAuthStart,
  completeOAuthCallback,
  getOAuthRedirectUri,
  revokeGoogleAccess,
} = require('../services/backup/googleDrive');
const {
  restoreFromUploadBuffer,
  scheduleProcessRestart,
} = require('../services/backup/restoreBackup');

const adminOnly = [auth, requireRol('admin')];

function handleError(res, err, status = 500) {
  return res.status(status).json({ error: err.message || 'Error interno' });
}

function decodeFilenameHeader(value) {
  if (!value) return 'backup.db.gz';
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

router.get('/config', ...adminOnly, (req, res) => {
  try {
    return res.status(200).json(backupConfigStore.getPublicConfig());
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/config', ...adminOnly, (req, res) => {
  try {
    const {
      backupEnabled,
      intervalMinutes,
      runOnStart,
      fileName,
      googleDriveEnabled,
      googleDriveFolderId,
    } = req.body || {};

    const updates = {};

    if (backupEnabled !== undefined) {
      updates.backupEnabled = Boolean(backupEnabled);
    }

    if (intervalMinutes !== undefined) {
      const minutes = Number(intervalMinutes);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 59) {
        return res.status(400).json({ error: 'intervalMinutes debe estar entre 1 y 59' });
      }
      updates.intervalMinutes = minutes;
    }

    if (runOnStart !== undefined) {
      updates.runOnStart = Boolean(runOnStart);
    }

    if (fileName !== undefined) {
      const normalized = String(fileName).trim();
      if (!normalized) {
        return res.status(400).json({ error: 'fileName no puede estar vacío' });
      }
      updates.fileName = normalized;
    }

    if (googleDriveEnabled !== undefined) {
      updates.googleDriveEnabled = Boolean(googleDriveEnabled);
    }

    if (googleDriveFolderId !== undefined) {
      updates.googleDriveFolderId = String(googleDriveFolderId).trim();
    }

    if (googleDriveEnabled === true) {
      const current = backupConfigStore.getConfig();
      const folderId = googleDriveFolderId !== undefined
        ? String(googleDriveFolderId).trim()
        : current.googleDriveFolderId;

      if (!backupConfigStore.isCredentialsReady() || !folderId) {
        return res.status(400).json({
          error:
            'Para activar Google Drive necesitas Conectar con Google y configurar el ID de carpeta',
        });
      }
    }

    const config = backupConfigStore.saveConfig(updates);
    restartBackupScheduler();

    return res.status(200).json(config);
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/credentials/status', ...adminOnly, (req, res) => {
  try {
    return res.status(200).json(backupConfigStore.getCredentialsStatus());
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/credentials', ...adminOnly, async (req, res) => {
  try {
    const result = await revokeGoogleAccess();
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/oauth/start', ...adminOnly, (req, res) => {
  try {
    const result = createOAuthStart();
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, 400);
  }
});

// Callback público: Google redirige el navegador aquí (sin JWT).
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res
        .status(400)
        .send(`<h2>Autorización cancelada</h2><p>${String(error)}</p><p>Puedes cerrar esta ventana.</p>`);
    }

    const status = await completeOAuthCallback({
      code: typeof code === 'string' ? code : '',
      state: typeof state === 'string' ? state : '',
    });

    return res.status(200).send(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Google Drive conectado</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 480px; margin: 48px auto; padding: 0 16px; color: #111827; }
            .ok { color: #047857; }
          </style>
        </head>
        <body>
          <h2 class="ok">Cuenta de Google conectada</h2>
          <p>${status.credentialsEmail ? `Sesión: <strong>${status.credentialsEmail}</strong>` : 'Autorización completada.'}</p>
          <p>Vuelve a SmartTable, activa Google Drive si hace falta y pulsa <strong>Guardar configuración</strong>.</p>
          <p>Ya puedes cerrar esta ventana.</p>
        </body>
      </html>
    `);
  } catch (err) {
    return res.status(400).send(`
      <!doctype html>
      <html lang="es">
        <head><meta charset="utf-8" /><title>Error OAuth</title></head>
        <body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 48px auto; padding: 0 16px;">
          <h2 style="color:#b91c1c">No se pudo conectar Google Drive</h2>
          <p>${err.message || 'Error desconocido'}</p>
          <p>URI de redirección esperada: <code>${getOAuthRedirectUri()}</code></p>
          <p>Añade esa URI exacta en Google Cloud → Credenciales → tu cliente OAuth → URIs de redirección autorizadas.</p>
        </body>
      </html>
    `);
  }
});

router.post('/run', ...adminOnly, async (req, res) => {
  try {
    const result = await runBackupCycle();

    if (!result.success) {
      return res.status(409).json({ error: result.error || 'No se pudo ejecutar el respaldo' });
    }

    return res.status(200).json({
      message: 'Respaldo ejecutado correctamente',
      ...result,
      config: backupConfigStore.getPublicConfig(),
    });
  } catch (err) {
    return handleError(res, err);
  }
});

router.post(
  '/restore',
  ...adminOnly,
  express.raw({
    type: () => true,
    limit: '200mb',
  }),
  async (req, res) => {
    try {
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
      if (!buffer.length) {
        return res.status(400).json({
          error: 'Debes subir el archivo de respaldo (.db.gz, .db o .sqlite)',
        });
      }

      const fileName = decodeFilenameHeader(req.headers['x-backup-filename']);
      const result = await restoreFromUploadBuffer(buffer, fileName);

      res.status(200).json(result);
      if (result.requiresRestart) {
        scheduleProcessRestart(result.restartExitCode);
      }
    } catch (err) {
      return handleError(res, err, 400);
    }
  }
);

module.exports = router;
