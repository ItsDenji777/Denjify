import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import { fileURLToPath } from 'url';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'lyrics');
const LRCLIB_BASE = 'https://lrclib.net/api/get';

function norm(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function makeCacheKey({ track, artist, album, duration }) {
  const payload = JSON.stringify({
    track: norm(track).toLowerCase(),
    artist: norm(artist).toLowerCase(),
    album: norm(album).toLowerCase(),
    duration: duration ? String(duration) : '',
  });
  return crypto.createHash('sha1').update(payload).digest('hex');
}

async function ensureCacheDir() {
  await fs.ensureDir(CACHE_DIR);
}

function readJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const { statusCode } = res;
      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (statusCode === 404) return resolve(null);
        if (statusCode < 200 || statusCode >= 300) {
          return reject(new Error(`LRCLIB request failed (${statusCode})`));
        }
        try {
          resolve(body ? JSON.parse(body) : null);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error('LRCLIB request timed out'));
    });
  });
}

router.get('/', async (req, res, next) => {
  try {
    await ensureCacheDir();

    const track = norm(req.query.track);
    const artist = norm(req.query.artist);
    const album = norm(req.query.album);
    const duration = norm(req.query.duration);

    if (!track) {
      return res.status(400).json({ found: false, error: 'track is required' });
    }

    const cacheKey = makeCacheKey({ track, artist, album, duration });
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

    if (await fs.pathExists(cacheFile)) {
      const cached = await fs.readJson(cacheFile);
      return res.json({ ...cached, cached: true });
    }

    const params = new URLSearchParams();
    params.set('track_name', track);
    if (artist) params.set('artist_name', artist);
    if (album) params.set('album_name', album);
    if (duration) params.set('duration', duration);

    const remote = await readJson(`${LRCLIB_BASE}?${params.toString()}`);

    const payload = remote
      ? {
          found: true,
          source: 'lrclib',
          track,
          artist,
          album,
          duration: duration || null,
          syncedLyrics: remote.syncedLyrics || '',
          plainLyrics: remote.plainLyrics || '',
          cached: false,
        }
      : {
          found: false,
          source: 'lrclib',
          track,
          artist,
          album,
          duration: duration || null,
          syncedLyrics: '',
          plainLyrics: '',
          cached: false,
        };

    await fs.writeJson(cacheFile, payload, { spaces: 2 });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
