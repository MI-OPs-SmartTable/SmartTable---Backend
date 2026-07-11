function logger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const path = req.originalUrl.split('?')[0];
  const isSse = path === '/api/events';

  if (isSse) {
    console.log(`[${timestamp}] ${req.method} ${path} - ${req.ip} - SSE open`);
    res.on('close', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${path} - ${req.ip} - SSE close (${duration}ms)`);
    });
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${path} - ${req.ip} - ${duration}ms`);
  });

  return next();
}

module.exports = logger;