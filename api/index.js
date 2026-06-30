const app = require('./src/app');
const db = require('./src/database/db');
const { runMigrations } = require('./src/database/migrations');
const { runSeeds } = require('./src/database/seeds');

function seedIfEmpty() {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get();

  if (total > 0) {
    return;
  }

  console.log('Base de datos vacía: ejecutando seeds iniciales...');
  runSeeds();
}

function startServer(port = process.env.PORT || 8080) {
  runMigrations();

  if (process.env.SMARTTABLE_AUTO_SEED === '1') {
    seedIfEmpty();
  }

  const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
