import express from 'express';
import cors from 'cors';
import tracksRouter from './routes/tracks.js';
import playlistsRouter from './routes/playlists.js';
import libraryRouter from './routes/library.js';
import settingsRouter from './routes/settings.js';
import coversRouter from './routes/covers.js';
import lyricsRouter from './routes/lyrics.js';
import config from './config.js';
import discordRPC from './utils/discordRPC.js';
import discordRoutes from './routes/discord.js';
import { startWatcher } from './utils/watcher.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/tracks', tracksRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/library', libraryRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/covers', coversRouter);
app.use('/api/lyrics', lyricsRouter);
app.use('/api/discord', discordRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(config.port, async () => {
  console.log(`Backend listening on port ${config.port}`);
  discordRPC.connect();

  if (config.watcherEnabled) {
    await startWatcher();
    console.log('[Watcher] Started');
  } else {
    console.log('[Watcher] Disabled (set watcherEnabled: true in config.js to enable)');
  }
});

process.on('SIGINT', () => {
  discordRPC.destroy();
  process.exit();
});