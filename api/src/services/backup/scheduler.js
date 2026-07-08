const path = require('path');
const cron = require('node-cron');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const { createBackup } = require('./createBackup');
const { isDriveEnabled, uploadBackup } = require('./googleDrive');
const {
  isBackupEnabled,
  getIntervalMinutes,
  shouldRunOnStart,
  getBackupFileName,
  recordBackupResult,
} = require('./backupConfigStore');

let isRunning = false;
let scheduledTask = null;

async function runBackupCycle() {
  if (isRunning) {
    const message = 'Ya hay un respaldo en ejecución';
    console.warn(`[backup] ${message}`);
    return { success: false, error: message };
  }

  isRunning = true;
  const startedAt = new Date().toISOString();
  const fileName = getBackupFileName();

  try {
    console.log(`[backup] Iniciando copia de seguridad (${startedAt})...`);
    const backup = await createBackup();
    console.log(`[backup] Copia local sobrescrita: ${backup.fileName} (${backup.sizeBytes} bytes)`);

    let driveFileId = null;

    if (isDriveEnabled()) {
      const uploaded = await uploadBackup(backup);
      driveFileId = uploaded.id;
      const action = uploaded.overwritten ? 'actualizado' : 'creado';
      console.log(`[backup] Archivo ${action} en Google Drive: ${uploaded.name} (${uploaded.id})`);
    } else {
      console.log('[backup] Google Drive deshabilitado; solo se guardó copia local.');
    }

    recordBackupResult({
      success: true,
      sizeBytes: backup.sizeBytes,
      driveFileId,
    });

    console.log('[backup] Ciclo completado correctamente.');

    return {
      success: true,
      fileName: backup.fileName,
      sizeBytes: backup.sizeBytes,
      driveFileId,
    };
  } catch (error) {
    recordBackupResult({
      success: false,
      error: error.message,
    });
    console.error('[backup] Error en el ciclo de respaldo:', error.message);
    return { success: false, error: error.message };
  } finally {
    isRunning = false;
  }
}

function startBackupScheduler() {
  if (!isBackupEnabled()) {
    console.log('[backup] Servicio de respaldo deshabilitado.');
    return null;
  }

  const minutes = getIntervalMinutes();

  if (minutes < 1 || minutes > 59) {
    throw new Error('intervalMinutes debe estar entre 1 y 59.');
  }

  const cronExpression = `*/${minutes} * * * *`;

  scheduledTask = cron.schedule(cronExpression, () => {
    runBackupCycle().catch((error) => {
      console.error('[backup] Error en ciclo programado:', error.message);
    });
  }, {
    scheduled: false,
  });

  scheduledTask.start();
  console.log(`[backup] Programado cada ${minutes} minuto(s). Archivo fijo: ${getBackupFileName()}`);

  if (shouldRunOnStart()) {
    runBackupCycle().catch((error) => {
      console.error('[backup] Error en respaldo inicial:', error.message);
    });
  }

  return scheduledTask;
}

function stopBackupScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

function restartBackupScheduler() {
  stopBackupScheduler();
  return startBackupScheduler();
}

module.exports = {
  startBackupScheduler,
  stopBackupScheduler,
  restartBackupScheduler,
  runBackupCycle,
};
