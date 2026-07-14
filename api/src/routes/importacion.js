const router = require('express').Router();
const multer = require('multer');
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const importacion = require('../models/importacion');

const XLSX_MIMETYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const isXlsxName = /\.xlsx$/i.test(file.originalname || '');
    if (!isXlsxName || !XLSX_MIMETYPES.has(file.mimetype)) {
      return cb(new Error('El archivo debe ser un .xlsx'));
    }
    return cb(null, true);
  },
});

function handleError(res, err) {
  const message = String(err.message || '');
  if (message.toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: message });
  }
  if (
    message.includes('El archivo debe ser') ||
    message.includes('No se encontró la fila de encabezados') ||
    message.includes('Faltan columnas requeridas') ||
    message.includes('El archivo Excel no contiene hojas')
  ) {
    return res.status(400).json({ error: message });
  }

  return res.status(500).json({ error: message });
}

router.use(auth, requireRol('admin'));

router.post('/excel', (req, res) => {
  upload.single('archivo')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return handleError(res, uploadErr);
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Campo archivo requerido' });
    }

    try {
      const resumen = await importacion.importFromWorkbook(req.file.buffer);
      return res.status(200).json(resumen);
    } catch (err) {
      return handleError(res, err);
    }
  });
});

module.exports = router;
