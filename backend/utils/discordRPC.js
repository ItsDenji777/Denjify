import RPC from 'discord-rpc';
import config from '../config.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.join(__dirname, '..', 'covers');
const CACHE_FILE = path.join(__dirname, '..', 'cache', 'cover_cache.json');

const IMGBB_API_KEY = config.imgbbApiKey || '';
const DEFAULT_ASSET_KEY = 'logo';

if (!fs.existsSync(path.dirname(CACHE_FILE))) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
}

class DiscordRPC {
  constructor() {
    this.client = null;
    this.connected = false;
    this.startTimestamp = null;
    this.retryTimer = null;
    this.coverCache = this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('Failed to load cover cache:', e.message);
    }
    return {};
  }

  saveCache() {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.coverCache, null, 2));
    } catch (e) {
      console.warn('Failed to save cover cache:', e.message);
    }
  }

  async uploadToImgBB(imageBuffer) {
    if (!IMGBB_API_KEY) {
      throw new Error('ImgBB API key not configured');
    }

    const base64 = imageBuffer.toString('base64');
    const formData = new FormData();
    formData.append('image', base64);
    formData.append('expiration', '3600');

    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      formData,
      {
        headers: { ...formData.getHeaders() },
        timeout: 20000,
      }
    );

    if (response.data?.success && response.data?.data?.url) {
      return response.data.data.url;
    }
    throw new Error(`ImgBB upload failed: ${response.data?.error?.message || 'Unknown error'}`);
  }

  async uploadWithRetry(imagePath) {
    const cacheKey = path.basename(imagePath);

    if (this.coverCache[cacheKey]) {
      try {
        await axios.head(this.coverCache[cacheKey], { timeout: 5000 });
        return this.coverCache[cacheKey];
      } catch (e) {
        delete this.coverCache[cacheKey];
        this.saveCache();
      }
    }

    if (!fs.existsSync(imagePath)) {
      console.warn('Cover file not found:', imagePath);
      return null;
    }

    const imageBuffer = fs.readFileSync(imagePath);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const url = await this.uploadToImgBB(imageBuffer);
        if (url) {
          this.coverCache[cacheKey] = url;
          this.saveCache();
          console.log(`Cover uploaded: ${url}`);
          return url;
        }
      } catch (e) {
        const delay = attempt * 1000;
        console.warn(`Upload attempt ${attempt} failed: ${e.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.warn('All upload attempts failed. Using default asset.');
    return null;
  }

  async connect() {
    if (this.connected) return;

    const clientId = config.discordClientId;
    if (!clientId) {
      console.warn('Discord Client ID not set. RPC disabled.');
      return;
    }

    this.client = new RPC.Client({ transport: 'ipc' });

    try {
      await this.client.login({ clientId });
      this.connected = true;
      console.log('Discord RPC connected');
    } catch (err) {
      console.error('Discord RPC connection failed:', err.message);
      this.connected = false;
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        this.connect();
      }, 5000);
    }
  }

  async updatePresence(track) {
    if (!this.connected || !this.client) {
      this.connect();
      return;
    }

    if (!track) {
      this.client.clearActivity();
      this.startTimestamp = null;
      return;
    }

    this.startTimestamp = Date.now();

    const presence = {
      pid: process.pid,
      details: track.title || 'Unknown Track',
      state: track.artist || 'Unknown Artist',
      startTimestamp: this.startTimestamp,
    };

    if (track.durationSeconds && track.durationSeconds > 0) {
      presence.endTimestamp = this.startTimestamp + (track.durationSeconds * 1000);
    }

    let coverUrl = null;
    if (track.coverArtUrl) {
      let filename = track.coverArtUrl;
      if (filename.startsWith('/covers/')) {
        filename = filename.replace('/covers/', '');
      }
      const coverPath = path.join(COVERS_DIR, filename);
      coverUrl = await this.uploadWithRetry(coverPath);
    }

    if (coverUrl) {
      presence.largeImageKey = coverUrl;
      presence.largeImageText = track.album || 'Album';
    } else if (DEFAULT_ASSET_KEY) {
      presence.largeImageKey = DEFAULT_ASSET_KEY;
      presence.largeImageText = 'Denjify';
    }

    this.client.setActivity(presence)
      .then(() => console.log(`Presence updated: ${track.title}`))
      .catch(err => console.error('Failed to set activity:', err));
  }

  destroy() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.client) {
      this.client.destroy();
      this.connected = false;
      console.log('Discord RPC disconnected');
    }
  }
}

export default new DiscordRPC();