import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

router.get('/', async (req, res, next) => {
  try {
    const [playlists] = await db.query('SELECT * FROM playlists ORDER BY created_at DESC');

    if (playlists.length === 0) return res.json([]);

    const [counts] = await db.query(
      `SELECT playlist_id, COUNT(*) AS total 
       FROM playlist_tracks 
       WHERE playlist_id IN (${playlists.map(() => '?').join(',')}) 
       GROUP BY playlist_id`,
      playlists.map(p => p.id)
    );

    const countMap = {};
    counts.forEach(row => { countMap[row.playlist_id] = row.total; });

    for (const pl of playlists) {
      pl.trackCount = countMap[pl.id] || 0;
      const [tracks] = await db.query(
        `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.cover_art_url
         FROM playlist_tracks pt JOIN tracks t ON pt.track_id = t.id
         WHERE pt.playlist_id = ?
         ORDER BY pt.position
         LIMIT 5`,
        [pl.id]
      );
      pl.preview_tracks = tracks;
    }

    res.json(playlists);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/tracks', async (req, res, next) => {
  try {
    const [playlist] = await db.query('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
    if (playlist.length === 0) return res.status(404).json({ error: 'Playlist not found' });

    const [tracks] = await db.query(
      `SELECT t.*, pt.position FROM playlist_tracks pt JOIN tracks t ON pt.track_id = t.id
       WHERE pt.playlist_id = ? ORDER BY pt.position`,
      [req.params.id]
    );
    res.json({ ...playlist[0], tracks });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description, cover_color, cover_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const color = cover_color || '#1db954';
    const result = await db.run(
      'INSERT INTO playlists (name, description, cover_color, cover_url) VALUES (?, ?, ?, ?)',
      [name, description || null, color, cover_url || null]
    );
    res.status(201).json({ id: result.lastID, name, description, cover_color: color, cover_url });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'cover_color', 'cover_url'];
    const fields = [];
    const values = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(req.params.id);
    await db.run(
      `UPDATE playlists SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await db.run('DELETE FROM playlists WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/tracks', async (req, res, next) => {
  try {
    const { trackIds, position } = req.body;
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({ error: 'trackIds array required' });
    }

    let pos = position != null ? parseInt(position) : null;

    await db.beginTransaction();
    try {
      if (pos == null) {
        const row = await db.get(
          'SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM playlist_tracks WHERE playlist_id = ?',
          [req.params.id]
        );
        pos = row.nextPos || 0;
      } else {
        await db.run(
          'UPDATE playlist_tracks SET position = position + ? WHERE playlist_id = ? AND position >= ?',
          [trackIds.length, req.params.id, pos]
        );
      }

      for (let i = 0; i < trackIds.length; i++) {
        await db.run(
          'INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
          [req.params.id, trackIds[i], pos + i]
        );
      }

      await db.commit();
      res.json({ success: true });
    } catch (err) {
      await db.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/tracks', async (req, res, next) => {
  try {
    const { trackIds } = req.body;
    if (!trackIds || !Array.isArray(trackIds)) {
      return res.status(400).json({ error: 'trackIds array required' });
    }

    await db.beginTransaction();
    try {
      const placeholders = trackIds.map(() => '?').join(',');
      await db.run(
        `DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id IN (${placeholders})`,
        [req.params.id, ...trackIds]
      );

      // Reorder positions
      await db.run(
        `UPDATE playlist_tracks SET position = (
          SELECT new_pos FROM (
            SELECT row_number() OVER (ORDER BY position) - 1 AS new_pos, rowid
            FROM playlist_tracks
            WHERE playlist_id = ?
          ) WHERE rowid = playlist_tracks.rowid
        ) WHERE playlist_id = ?`,
        [req.params.id, req.params.id]
      );

      await db.commit();
      res.json({ success: true });
    } catch (err) {
      await db.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.put('/:id/tracks/reorder', async (req, res, next) => {
  try {
    const { trackId, newPosition } = req.body;
    if (trackId == null || newPosition == null) {
      return res.status(400).json({ error: 'trackId and newPosition required' });
    }

    await db.beginTransaction();
    try {
      await db.run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [req.params.id, trackId]);
      await db.run(
        'UPDATE playlist_tracks SET position = position + 1 WHERE playlist_id = ? AND position >= ?',
        [req.params.id, newPosition]
      );
      await db.run(
        'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
        [req.params.id, trackId, newPosition]
      );
      await db.run(
        `UPDATE playlist_tracks SET position = (
          SELECT new_pos FROM (
            SELECT row_number() OVER (ORDER BY position) - 1 AS new_pos, rowid
            FROM playlist_tracks
            WHERE playlist_id = ?
          ) WHERE rowid = playlist_tracks.rowid
        ) WHERE playlist_id = ?`,
        [req.params.id, req.params.id]
      );
      await db.commit();
      res.json({ success: true });
    } catch (err) {
      await db.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.post('/:id/add-folder', async (req, res, next) => {
  try {
    const folderPath = normalizePath(req.body.folderPath);
    if (!folderPath) return res.status(400).json({ error: 'folderPath required' });

    const [tracks] = await db.query(
      'SELECT id FROM tracks WHERE file_path LIKE ?',
      [`${folderPath}%`]
    );

    if (tracks.length === 0) return res.json({ added: 0 });

    const trackIds = tracks.map(t => t.id);

    await db.beginTransaction();
    try {
      const row = await db.get(
        'SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM playlist_tracks WHERE playlist_id = ?',
        [req.params.id]
      );
      let pos = row.nextPos || 0;
      for (const tid of trackIds) {
        await db.run(
          'INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
          [req.params.id, tid, pos++]
        );
      }

      // Store folder association for auto-add on new files
      await db.run(
        'INSERT OR IGNORE INTO playlist_folders (playlist_id, folder_path) VALUES (?, ?)',
        [req.params.id, folderPath]
      );

      await db.commit();
      res.json({ added: trackIds.length });
    } catch (err) {
      await db.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

export default router;