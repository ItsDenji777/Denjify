import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMetadata } from './metadata.js';
import db from '../db/connection.js';
import config from '../config.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.join(__dirname, '..', 'covers');
fs.ensureDirSync(COVERS_DIR);

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a']);

function isAudioFile(file) {
  return SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase());
}

// Normalize path to use forward slashes for consistency
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

export async function processFile(filePath) {
  const normalizedPath = normalizePath(filePath);
  console.log(`[Scanner] Processing: ${normalizedPath}`);
  const metadata = await extractMetadata(normalizedPath);
  if (!metadata) {
    console.warn(`[Scanner] No metadata for: ${normalizedPath}`);
    return null;
  }

  let coverUrl = null;
  if (metadata.pictureData) {
    let trackId;
    const [existing] = await db.query('SELECT id FROM tracks WHERE file_path = ?', [normalizedPath]);
    if (existing.length > 0) {
      trackId = existing[0].id;
    } else {
      const result = await db.run('INSERT INTO tracks (file_path) VALUES (?)', [normalizedPath]);
      trackId = result.lastID;
    }

    const ext = metadata.pictureFormat.split('/')[1] || 'jpg';
    const coverFilename = `${trackId}.${ext}`;
    const coverPath = path.join(COVERS_DIR, coverFilename);
    await sharp(metadata.pictureData)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .toFile(coverPath);
    coverUrl = `/covers/${coverFilename}`;
  }

  const fileStats = await fs.stat(normalizedPath);
  const lastModified = new Date(fileStats.mtimeMs);

  const [existing] = await db.query('SELECT id FROM tracks WHERE file_path = ?', [normalizedPath]);
  if (existing.length > 0) {
    await db.run(
      `UPDATE tracks SET
        title = ?, artist = ?, album = ?, genre = ?, track_number = ?, disc_number = ?,
        year = ?, duration_seconds = ?, cover_art_url = ?, last_modified = ?
       WHERE file_path = ?`,
      [metadata.title, metadata.artist, metadata.album, metadata.genre,
        metadata.trackNumber, metadata.discNumber, metadata.year,
        metadata.durationSeconds, coverUrl, lastModified, normalizedPath]
    );
    return { filePath: normalizedPath, action: 'updated' };
  } else {
    await db.run(
      `INSERT INTO tracks (file_path, title, artist, album, genre, track_number, disc_number, year, duration_seconds, cover_art_url, last_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [normalizedPath, metadata.title, metadata.artist, metadata.album, metadata.genre,
        metadata.trackNumber, metadata.discNumber, metadata.year,
        metadata.durationSeconds, coverUrl, lastModified]
    );
    return { filePath: normalizedPath, action: 'added' };
  }
}

export async function removeTrack(filePath) {
  const normalizedPath = normalizePath(filePath);
  console.log(`[Scanner] Removing: ${normalizedPath}`);
  await db.run('DELETE FROM tracks WHERE file_path = ?', [normalizedPath]);
}

export async function scanDirectory(rootPath) {
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
    const result = await processFile(filePath);
    if (result) results.push(result);
  }
  return results;
}

// Efficient sync
export async function syncFolder(folderPath) {
  const normalizedFolder = normalizePath(folderPath);
  console.log(`[Scanner] Syncing folder: ${normalizedFolder}`);
  if (!fs.existsSync(normalizedFolder)) return { added: 0, removed: 0 };

  // Get all audio files in folder (recursively)
  const allFiles = [];
  const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && isAudioFile(entry.name)) allFiles.push(fullPath);
    }
  };
  await walk(normalizedFolder);

  // Normalize all file paths
  const normalizedAllFiles = allFiles.map(f => normalizePath(f));

  // Get tracks in DB from this folder
  const [dbTracks] = await db.query('SELECT id, file_path FROM tracks WHERE file_path LIKE ?', [`${normalizedFolder}%`]);
  const dbFilePaths = new Set(dbTracks.map(t => normalizePath(t.file_path)));

  const toAdd = normalizedAllFiles.filter(f => !dbFilePaths.has(f));
  const toRemove = dbTracks.filter(t => !normalizedAllFiles.includes(normalizePath(t.file_path)));

  console.log(`[Scanner] ${normalizedFolder}: ${toAdd.length} new, ${toRemove.length} removed`);

  let added = 0;
  for (const filePath of toAdd) {
    const result = await processFile(filePath);
    if (result && result.action === 'added') added++;
  }
  for (const track of toRemove) {
    await removeTrack(track.file_path);
  }

  return { added, removed: toRemove.length };
}

export async function syncLibrary(rootPath) {
  return await syncFolder(rootPath);
}