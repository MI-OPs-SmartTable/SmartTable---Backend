const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const backupConfigStore = require('../services/backup/backupConfigStore');
const {
  restartBackupScheduler,
  runBackupCycle,
} = require('../services/backup/scheduler');

const adminOnly = [auth, requireRol('admin')];

function handleError(res, err, status = 500) {
  return res.status(status).json({ error: err.message || 'Error interno' });
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

      if (!backupConfigStore.hasCredentialsFile() || !folderId) {
        return res.status(400).json({
          error: 'Para activar Google Drive necesitas subir credenciales y configurar el ID de carpeta',
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
    return res.status(200).json({
      configured: backupConfigStore.hasCredentialsFile(),
      credentialsEmail: backupConfigStore.getCredentialsEmail(),
    });
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/credentials', ...adminOnly, (req, res) => {
  try {
    const result = backupConfigStore.saveCredentials(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, 400);
  }
});

router.delete('/credentials', ...adminOnly, (req, res) => {
  try {
    const result = backupConfigStore.deleteCredentials();
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
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

module.exports = router;
