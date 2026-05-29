import { Router } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.join(__dirname, '..', 'covers');

const router = Router();

router.get('/:filename', async (req, res, next) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(COVERS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).end();
    }
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

export default router;