import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET all playlists (with first 5 tracks preview + total track count)
router.get('/', async (req, res, next) => {
  try {
    // Fetch all playlists
    const [playlists] = await pool.query('SELECT * FROM playlists ORDER BY created_at DESC');

    // Get total track counts for all playlists in one query
    const [counts] = await pool.query(
      `SELECT playlist_id, COUNT(*) AS total 
       FROM playlist_tracks 
       WHERE playlist_id IN (${playlists.map(() => '?').join(',')}) 
       GROUP BY playlist_id`,
      playlists.map(p => p.id)
    );

    // Map of playlist_id -> total count
    const countMap = {};
    counts.forEach(row => { countMap[row.playlist_id] = row.total; });

    // Attach preview tracks and total count to each playlist
    for (const pl of playlists) {
      pl.trackCount = countMap[pl.id] || 0;   // total tracks

      // Still fetch preview tracks (first 5) for any display
      const [tracks] = await pool.query(
        `SELECT t.id, t.title, t.artist, t.album, t.duration_seconds, t.cover_art_url
         FROM playlist_tracks pt JOIN tracks t ON pt.track_id = t.id
         WHERE pt.playlist_id = ?
         ORDER BY pt.position
         LIMIT 5`, [pl.id]
      );
      pl.preview_tracks = tracks;
    }

    res.json(playlists);
  } catch (err) {
    next(err);
  }
});

// GET single playlist with all tracks
router.get('/:id/tracks', async (req, res, next) => {
  try {
    const [playlist] = await pool.query('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
    if (playlist.length === 0) return res.status(404).json({ error: 'Playlist not found' });

    const [tracks] = await pool.query(
      `SELECT t.*, pt.position FROM playlist_tracks pt JOIN tracks t ON pt.track_id = t.id
       WHERE pt.playlist_id = ? ORDER BY pt.position`, [req.params.id]
    );
    res.json({ ...playlist[0], tracks });
  } catch (err) {
    next(err);
  }
});

// Create playlist
router.post('/', async (req, res, next) => {
  try {
    const { name, description, cover_color, cover_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const color = cover_color || '#1db954';
    const [result] = await pool.query(
      'INSERT INTO playlists (name, description, cover_color, cover_url) VALUES (?, ?, ?, ?)',
      [name, description || null, color, cover_url || null]
    );
    res.status(201).json({ id: result.insertId, name, description, cover_color: color, cover_url });
  } catch (err) {
    next(err);
  }
});

// Update playlist (supports partial updates)
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
    await pool.query(
      `UPDATE playlists SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Delete playlist
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM playlists WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Add tracks to playlist
router.post('/:id/tracks', async (req, res, next) => {
  try {
    const { trackIds, position } = req.body;
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({ error: 'trackIds array required' });
    }

    let pos = position != null ? parseInt(position) : null;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (pos == null) {
        const [max] = await conn.query(
          'SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM playlist_tracks WHERE playlist_id = ?',
          [req.params.id]
        );
        pos = max[0].nextPos;
      } else {
        await conn.query(
          'UPDATE playlist_tracks SET position = position + ? WHERE playlist_id = ? AND position >= ?',
          [trackIds.length, req.params.id, pos]
        );
      }

      for (let i = 0; i < trackIds.length; i++) {
        await conn.query(
          'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE position = VALUES(position)',
          [req.params.id, trackIds[i], pos + i]
        );
      }
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

// Remove tracks from playlist
router.delete('/:id/tracks', async (req, res, next) => {
  try {
    const { trackIds } = req.body;
    if (!trackIds || !Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds array required' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id IN (?)', [req.params.id, trackIds]);
      await conn.query('SET @pos = -1');
      await conn.query('UPDATE playlist_tracks SET position = (@pos := @pos + 1) WHERE playlist_id = ? ORDER BY position', [req.params.id]);
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

// Reorder track within playlist
router.put('/:id/tracks/reorder', async (req, res, next) => {
  try {
    const { trackId, newPosition } = req.body;
    if (trackId == null || newPosition == null) return res.status(400).json({ error: 'trackId and newPosition required' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [req.params.id, trackId]);
      await conn.query('UPDATE playlist_tracks SET position = position + 1 WHERE playlist_id = ? AND position >= ?', [req.params.id, newPosition]);
      await conn.query('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [req.params.id, trackId, newPosition]);
      await conn.query('SET @pos = -1');
      await conn.query('UPDATE playlist_tracks SET position = (@pos := @pos + 1) WHERE playlist_id = ? ORDER BY position', [req.params.id]);
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

// Add entire folder to playlist
router.post('/:id/add-folder', async (req, res, next) => {
  try {
    let { folderPath } = req.body;
    if (!folderPath) return res.status(400).json({ error: 'folderPath required' });
    folderPath = folderPath.replace(/\\/g, '\\\\');
    const [tracks] = await pool.query(
      'SELECT id FROM tracks WHERE file_path LIKE ?',
      [`${folderPath}%`]
    );
    if (tracks.length === 0) return res.json({ added: 0 });
    const trackIds = tracks.map(t => t.id);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [max] = await conn.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM playlist_tracks WHERE playlist_id = ?',
        [req.params.id]
      );
      let pos = max[0].nextPos;
      for (const tid of trackIds) {
        await conn.query(
          'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE position = position',
          [req.params.id, tid, pos++]
        );
      }
      await conn.commit();
      res.json({ added: trackIds.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;