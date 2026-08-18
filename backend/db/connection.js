import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'denjify.db');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

sqlite3.verbose();

let db = null;

export async function getDb() {
  if (!db) {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });
    await db.exec('PRAGMA foreign_keys = ON;');
    await db.exec('PRAGMA journal_mode = WAL;');
    await initializeTables();
  }
  return db;
}

async function initializeTables() {
  const db = await getDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cover_color TEXT DEFAULT '#1db954',
      cover_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      title TEXT,
      artist TEXT,
      album TEXT,
      genre TEXT,
      track_number INTEGER,
      disc_number INTEGER,
      year INTEGER,
      duration_seconds INTEGER,
      cover_art_url TEXT,
      cover_art_base64 TEXT,
      last_modified DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id INTEGER NOT NULL,
      track_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, track_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playlist_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      folder_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(playlist_id, folder_path),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
  `);

  // Ensure cover_art_base64 column exists (for upgrade)
  try {
    await db.exec(`ALTER TABLE tracks ADD COLUMN cover_art_base64 TEXT;`);
  } catch (e) {}
}

export async function query(sql, params = []) {
  const db = await getDb();
  const rows = await db.all(sql, params);
  return [rows, null];
}

export async function get(sql, params = []) {
  const db = await getDb();
  return db.get(sql, params);
}

export async function run(sql, params = []) {
  const db = await getDb();
  const result = await db.run(sql, params);
  return result;
}

export async function beginTransaction() {
  const db = await getDb();
  await db.exec('BEGIN TRANSACTION;');
}

export async function commit() {
  const db = await getDb();
  await db.exec('COMMIT;');
}

export async function rollback() {
  const db = await getDb();
  await db.exec('ROLLBACK;');
}

export default {
  query,
  get,
  run,
  beginTransaction,
  commit,
  rollback,
  getConnection: async () => ({
    query,
    get,
    run,
    beginTransaction,
    commit,
    rollback,
    release: () => {},
  }),
};