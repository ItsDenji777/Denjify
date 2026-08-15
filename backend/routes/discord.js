import { Router } from 'express';
import discordRPC from '../utils/discordRPC.js';

const router = Router();

router.post('/update', async (req, res, next) => {
  try {
    const { track } = req.body;
    if (!track) {
      return res.status(400).json({ error: 'track object required' });
    }
    discordRPC.updatePresence(track);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/clear', (req, res) => {
  discordRPC.updatePresence(null);
  res.json({ success: true });
});

router.get('/test', (req, res) => {
  const dummyTrack = {
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    durationSeconds: 180,
  };
  discordRPC.updatePresence(dummyTrack);
  res.json({ success: true, message: 'Test presence sent' });
});

export default router;