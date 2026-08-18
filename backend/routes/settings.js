import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT `key`, value FROM app_settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await db.run(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
        [key, value]
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;