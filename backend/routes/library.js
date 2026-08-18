import { Router } from 'express';
import { scanDirectory, syncFolder } from '../utils/scanner.js';
import { refreshWatcher } from '../utils/watcher.js';
import db from '../db/connection.js';
import config from '../config.js';

const router = Router();

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

async function addScannedFolder(folderPath) {
  const normalized = normalizePath(folderPath);
  const [rows] = await db.query(
    "SELECT value FROM app_settings WHERE key = 'scanned_folders'"
  );
  let list = [];
  if (rows.length > 0) {
    try { list = JSON.parse(rows[0].value); } catch (e) {}
  }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(normalized)) {
    list.push(normalized);
    await db.run(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
      ['scanned_folders', JSON.stringify(list)]
    );
  }
}

router.post('/scan', async (req, res, next) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const results = await scanDirectory(dirPath);
    await addScannedFolder(dirPath);
    if (config.watcherEnabled) await refreshWatcher();
    res.json({ scanned: results.length, results });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', async (req, res, next) => {
  if (!config.syncEnabled) {
    return res.status(404).json({ error: 'Sync is disabled' });
  }

  try {
    const [rows] = await db.query(
      "SELECT value FROM app_settings WHERE key = 'scanned_folders'"
    );
    let folders = [];
    if (rows.length > 0) {
      try { folders = JSON.parse(rows[0].value); } catch (e) {}
    }
    if (!Array.isArray(folders) || folders.length === 0) {
      return res.status(400).json({ error: 'No scanned folders found. Scan a folder first.' });
    }

    let totalAdded = 0, totalRemoved = 0;
    for (const folder of folders) {
      const result = await syncFolder(folder);
      totalAdded += result.added;
      totalRemoved += result.removed;
    }
    if (config.watcherEnabled) await refreshWatcher();
    res.json({ success: true, added: totalAdded, removed: totalRemoved });
  } catch (err) {
    next(err);
  }
});

export default router;