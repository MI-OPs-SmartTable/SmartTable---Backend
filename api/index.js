require('dotenv').config();
const app = require('./src/app');
const { runMigrations } = require('./src/database/migrations');

runMigrations();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

if (require.main === module) {
  const PORT = process.env.PORT || 8080;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
