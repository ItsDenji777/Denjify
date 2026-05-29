const API_BASE = '/api/lyrics';
const MEMORY_CACHE = new Map();
const IN_FLIGHT = new Map();
const STORAGE_PREFIX = 'denjify:lyrics:v1:';

function norm(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function buildKey(track = {}) {
  return [
    norm(track.title),
    norm(track.artist),
    norm(track.album),
    norm(track.duration_seconds ?? track.duration ?? ''),
  ].join('||').toLowerCase();
}

function parseTimestamp(raw) {
  const mm = Number(raw[1] || 0);
  const ss = Number(raw[2] || 0);
  const frac = raw[3] ? Number(`0.${raw[3].slice(0, 3)}`) : 0;
  return mm * 60 + ss + frac;
}

export function parseSyncedLyrics(input = '') {
  if (!input || typeof input !== 'string') return [];
  const lines = [];
  const chunks = input.split(/\r?\n/);

  for (const chunk of chunks) {
    const timestamps = [...chunk.matchAll(/\[(\d+):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    if (!timestamps.length) continue;
    const text = chunk.replace(/\[(\d+):(\d{2})(?:\.(\d{2,3}))?\]/g, '').trim();
    for (const ts of timestamps) {
      lines.push({
        time: parseTimestamp(ts),
        text,
      });
    }
  }

  return lines
    .sort((a, b) => a.time - b.time)
    .map((line, index) => ({ ...line, index }));
}

export function parsePlainLyrics(input = '') {
  if (!input || typeof input !== 'string') return [];
  return input
    .split(/\r?\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
}

function hydrate(raw) {
  if (!raw) return null;
  const synced = typeof raw.syncedLyrics === 'string' ? raw.syncedLyrics : '';
  const plain = typeof raw.plainLyrics === 'string' ? raw.plainLyrics : '';
  const parsedSynced = parseSyncedLyrics(synced);
  const plainBlocks = parsePlainLyrics(plain);

  return {
    ...raw,
    found: raw.found !== false && (parsedSynced.length > 0 || plainBlocks.length > 0 || plain.trim().length > 0),
    syncedLyrics: synced,
    plainLyrics: plain,
    synced: parsedSynced,
    plainBlocks,
  };
}

function readStorage(key) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return raw ? hydrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Ignore quota and private mode issues.
  }
}

async function fetchLyricsFromApi(track, signal) {
  const params = new URLSearchParams();
  params.set('track', norm(track?.title));
  params.set('artist', norm(track?.artist));
  params.set('album', norm(track?.album));
  if (track?.duration_seconds) params.set('duration', String(Math.round(track.duration_seconds)));

  const res = await fetch(`${API_BASE}?${params.toString()}`, { signal });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(errorText || `Lyrics request failed (${res.status})`);
  }

  const data = await res.json();
  return hydrate(data);
}

export async function fetchLyrics(track, { signal, force = false } = {}) {
  const key = buildKey(track);
  if (!key) return null;

  if (!force) {
    const cached = MEMORY_CACHE.get(key) || readStorage(key);
    if (cached) {
      MEMORY_CACHE.set(key, cached);
      return cached;
    }
  }

  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key);
  }

  const request = (async () => {
    const result = await fetchLyricsFromApi(track, signal);
    if (result) {
      MEMORY_CACHE.set(key, result);
      writeStorage(key, result);
    }
    return result;
  })();

  IN_FLIGHT.set(key, request);

  try {
    return await request;
  } finally {
    IN_FLIGHT.delete(key);
  }
}

export function prefetchLyrics(track) {
  const key = buildKey(track);
  if (!key) return Promise.resolve(null);
  if (MEMORY_CACHE.has(key) || readStorage(key)) {
    return Promise.resolve(MEMORY_CACHE.get(key) || readStorage(key));
  }
  return fetchLyrics(track).catch(() => null);
}

export function getLyricsKey(track) {
  return buildKey(track);
}
