const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const { runBackupCycle } = require('./scheduler');

runBackupCycle()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backup] Falló la ejecución manual:', error.message);
    process.exit(1);
  });
