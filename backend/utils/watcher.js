import chokidar from 'chokidar';
import path from 'path';
import { processFile, removeTrack } from './scanner.js';
import db from '../db/connection.js';

let watcher = null;

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

async function getWatchedFolders() {
  const folders = new Set();

  // Scanned folders
  const [scannedRows] = await db.query(
    "SELECT value FROM app_settings WHERE key = 'scanned_folders'"
  );
  if (scannedRows.length > 0) {
    try {
      const arr = JSON.parse(scannedRows[0].value);
      if (Array.isArray(arr)) arr.forEach(f => folders.add(normalizePath(f)));
    } catch (e) {}
  }

  // Playlist-linked folders
  const [playlistRows] = await db.query('SELECT DISTINCT folder_path FROM playlist_folders');
  playlistRows.forEach(r => folders.add(normalizePath(r.folder_path)));

  return Array.from(folders).filter(f => f && f.trim());
}

function isAudioFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a'].includes(ext);
}

async function handleFileAdd(filePath) {
  const normalized = normalizePath(filePath);
  if (!isAudioFile(normalized)) return;
  console.log(`[Watcher] Handling add: ${normalized}`);
  const folder = path.dirname(normalized);

  // 1. Add to database (if not already)
  const result = await processFile(normalized);
  if (!result) return;

  // 2. If this folder is linked to playlists, add the track to those playlists
  const [rows] = await db.query('SELECT playlist_id FROM playlist_folders WHERE folder_path = ?', [folder]);
  if (rows.length === 0) return;

  const [trackRow] = await db.query('SELECT id FROM tracks WHERE file_path = ?', [normalized]);
  if (trackRow.length === 0) return;
  const trackId = trackRow[0].id;

  for (const row of rows) {
    const [exists] = await db.query('SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [row.playlist_id, trackId]);
    if (exists.length > 0) continue;
    const posRow = await db.get('SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM playlist_tracks WHERE playlist_id = ?', [row.playlist_id]);
    const pos = posRow.nextPos || 0;
    await db.run('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [row.playlist_id, trackId, pos]);
    console.log(`[Watcher] Added track ${trackId} to playlist ${row.playlist_id}`);
  }
}

async function handleFileRemove(filePath) {
  const normalized = normalizePath(filePath);
  if (!isAudioFile(normalized)) return;
  console.log(`[Watcher] Handling remove: ${normalized}`);
  await removeTrack(normalized);
}

export async function startWatcher() {
  if (watcher) {
    await watcher.close();
  }

  const folders = await getWatchedFolders();
  if (folders.length === 0) {
    console.log('[Watcher] No folders to watch – run a scan first.');
    return;
  }

  try {
    watcher = chokidar.watch(folders, {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: undefined,
      ignored: /(^|[\/\\])\../,
    });

    watcher
      .on('add', async (filePath) => {
        console.log(`[Watcher] File added: ${filePath}`);
        await handleFileAdd(filePath);
      })
      .on('unlink', async (filePath) => {
        console.log(`[Watcher] File removed: ${filePath}`);
        await handleFileRemove(filePath);
      })
      .on('change', async (filePath) => {
        console.log(`[Watcher] File changed: ${filePath}`);
        await handleFileAdd(filePath);
      })
      .on('error', (error) => console.error('Watcher error:', error));

    console.log(`[Watcher] Watching ${folders.length} folders`);
  } catch (err) {
    console.error('Failed to start watcher:', err.message);
    watcher = null;
  }
}

export async function stopWatcher() {
  if (watcher) {
    await watcher.close();
    watcher = null;
    console.log('[Watcher] Stopped');
  }
}

export async function refreshWatcher() {
  await startWatcher();
}