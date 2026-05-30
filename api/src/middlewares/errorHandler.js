function errorHandler(err, req, res, next) {
  console.error(err);

  const message = err && err.message ? err.message : 'Error interno';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('requerido')) {
    return res.status(400).json({ error: message });
  }

  if (lowerMessage.includes('no encontrado')) {
    return res.status(404).json({ error: message });
  }

  if (lowerMessage.includes('no autorizado')) {
    return res.status(403).json({ error: message });
  }

  return res.status(500).json({ error: message });
}

module.exports = errorHandler;