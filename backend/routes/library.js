import { Router } from 'express';
import { scanDirectory } from '../utils/scanner.js';

const router = Router();

// POST /api/library/scan
router.post('/scan', async (req, res, next) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const results = await scanDirectory(dirPath);
    res.json({ scanned: results.length, results });
  } catch (err) {
    next(err);
  }
});

export default router;