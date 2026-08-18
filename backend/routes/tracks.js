import { Router } from 'express';
import db from '../db/connection.js';
import fs from 'fs';
import path from 'path';

const router = Router();

const MIME_MAP = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

// GET /api/tracks
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.q;

    let query = 'SELECT * FROM tracks';
    const params = [];

    if (search) {
      query += ' WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY album, disc_number, track_number, id LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/tracks/folders - unique folder paths
router.get('/folders', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT file_path FROM tracks WHERE file_path IS NOT NULL AND file_path != ""');
    const folders = new Set();
    for (const row of rows) {
      const dir = path.dirname(row.file_path);
      if (dir) folders.add(dir);
    }
    res.json(Array.from(folders).sort());
  } catch (err) {
    next(err);
  }
});

// GET /api/tracks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM tracks WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Track not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/tracks/:id/file
router.get('/:id/file', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT file_path FROM tracks WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Track not found' });

    const filePath = rows[0].file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': getContentType(filePath),
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': getContentType(filePath),
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
});

export default router;