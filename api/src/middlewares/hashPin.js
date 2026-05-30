const crypto = require('crypto');

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin), 'utf8').digest('hex');
}

function verifyPin(pin, hash) {
  if (!hash) return false;

  // Formato legado: PIN guardado en texto plano
  if (String(hash) === String(pin)) {
    return true;
  }

  // Compatibilidad hacia atrás: algunos ambientes antiguos usan el formato literal "HASH:<pin>"
  if (String(hash).startsWith('HASH:')) {
    return hash === `HASH:${pin}`;
  }

  // Formato moderno: SHA-256 hex
  return hashPin(pin) === hash;
}

module.exports = { hashPin, verifyPin };