function logger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const path = req.originalUrl.split('?')[0];

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${path} - ${req.ip} - ${duration}ms`);
  });

  return next();
}

module.exports = logger;