import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMetadata } from './metadata.js';
import pool from '../db/connection.js';
import config from '../config.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.join(__dirname, '..', 'covers');
fs.ensureDirSync(COVERS_DIR);

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a']);

function isAudioFile(file) {
  return SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function scanDirectory(rootPath) {
  if (config.musicLibraryRoot && !rootPath.startsWith(config.musicLibraryRoot)) {
    throw new Error(`Access denied. Path must be under ${config.musicLibraryRoot}`);
  }

  const stats = await fs.stat(rootPath);
  if (!stats.isDirectory()) throw new Error(`Not a directory: ${rootPath}`);

  const allFiles = [];
  const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && isAudioFile(entry.name)) allFiles.push(fullPath);
    }
  };
  await walk(rootPath);

  const results = [];
  for (const filePath of allFiles) {
    const metadata = await extractMetadata(filePath);
    if (!metadata) continue;

    let coverUrl = null;
    if (metadata.pictureData) {
      const connection = await pool.getConnection();
      try {
        const [existing] = await connection.query('SELECT id FROM tracks WHERE file_path = ?', [filePath]);
        let trackId;
        if (existing.length > 0) {
          trackId = existing[0].id;
        } else {
          const [insert] = await connection.query('INSERT INTO tracks (file_path) VALUES (?)', [filePath]);
          trackId = insert.insertId;
        }

        const ext = metadata.pictureFormat.split('/')[1] || 'jpg';
        const coverFilename = `${trackId}.${ext}`;
        const coverPath = path.join(COVERS_DIR, coverFilename);
        // Resize to max 300x300, keeping aspect ratio
        await sharp(metadata.pictureData)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .toFile(coverPath);
        coverUrl = `/covers/${coverFilename}`;
      } finally {
        connection.release();
      }
    }

    const fileStats = await fs.stat(filePath);
    const lastModified = new Date(fileStats.mtimeMs);

    const connection = await pool.getConnection();
    try {
      const [existing] = await connection.query('SELECT id FROM tracks WHERE file_path = ?', [filePath]);
      if (existing.length > 0) {
        await connection.query(
          `UPDATE tracks SET
            title = ?, artist = ?, album = ?, genre = ?, track_number = ?, disc_number = ?,
            year = ?, duration_seconds = ?, cover_art_url = ?, last_modified = ?
           WHERE file_path = ?`,
          [metadata.title, metadata.artist, metadata.album, metadata.genre,
            metadata.trackNumber, metadata.discNumber, metadata.year,
            metadata.durationSeconds, coverUrl, lastModified, filePath]
        );
      } else {
        await connection.query(
          `INSERT INTO tracks (file_path, title, artist, album, genre, track_number, disc_number, year, duration_seconds, cover_art_url, last_modified)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [filePath, metadata.title, metadata.artist, metadata.album, metadata.genre, metadata.trackNumber, metadata.discNumber, metadata.year, metadata.durationSeconds, coverUrl, lastModified]
        );
      }
      results.push({ filePath, success: true });
    } catch (err) {
      results.push({ filePath, success: false, error: err.message });
    } finally {
      connection.release();
    }
  }
  return results;
}

export { scanDirectory };