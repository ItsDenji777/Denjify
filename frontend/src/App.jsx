import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import MainContent from './components/MainContent.jsx';
import NowPlayingBar from './components/NowPlayingBar.jsx';
import LyricsScreen from './components/LyricsScreen.jsx';
import { fetchTracks, fetchPlaylists } from './services/api.js';
import { prefetchLyrics } from './services/lyrics.js';
import { Howl } from 'howler';

let currentSound = null;
let progressInterval = null;
const CROSSFADE_DURATION = 300; // milliseconds

function getFormat(filePath) {
  const ext = filePath?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp3': return ['mp3'];
    case 'flac': return ['flac'];
    case 'aac': return ['aac'];
    case 'ogg': return ['ogg'];
    case 'wav': return ['wav'];
    case 'm4a': return ['m4a'];
    default: return ['mp3'];
  }
}

// ── Keep AudioContext alive (critical for PWA / mobile) ──
function resumeAudioContext() {
  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    Howler.ctx.resume();
  }
}

export default function App() {
  const [allTracks, setAllTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [currentView, setCurrentView] = useState('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const [playing, setPlaying] = useState(false);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(0.8);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');

  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  const [audioLoading, setAudioLoading] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const [fading, setFading] = useState(false);

  const [playingPlaylistId, setPlayingPlaylistId] = useState(null);

  // ── Refs to avoid stale closures ──
  const volumeRef = useRef(volume);
  const repeatRef = useRef(repeat);
  const fadingRef = useRef(false);
  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const shuffleRef = useRef(shuffle);

  // Keep refs synced
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { fadingRef.current = fading; }, [fading]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);

  // ── Force AudioContext resumption on any user interaction ──
  useEffect(() => {
    const resume = () => resumeAudioContext();
    document.addEventListener('click', resume);
    document.addEventListener('keydown', resume);
    return () => {
      document.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };
  }, []);

  const loadAllTracks = useCallback(async () => {
    const data = await fetchTracks(10000, 0, '');
    setAllTracks(data);
  }, []);

  const loadPlaylists = useCallback(async () => {
    const pls = await fetchPlaylists();
    setPlaylists(pls);
  }, []);

  const currentTrack = queue.length > 0 && currentIndex >= 0
    ? allTracks.find(t => t.id === queue[currentIndex])
    : null;

  useEffect(() => {
    loadAllTracks();
    loadPlaylists();
  }, [loadAllTracks, loadPlaylists]);

  useEffect(() => {
    if (!currentTrack) {
      setLyricsOpen(false);
      return;
    }
    prefetchLyrics(currentTrack).catch(() => {});
  }, [currentTrack]);

  const filteredTracks = allTracks.filter(t =>
    !searchQuery ||
    (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.artist && t.artist.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.album && t.album.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Crossfade to a new track ──
  const crossfadeToTrack = useCallback((trackId, newQueue = null) => {
    if (fadingRef.current) return;
    setFading(true);

    const nextQueue = newQueue || queueRef.current;
    const nextIdx = nextQueue.indexOf(trackId);

    if (nextIdx === -1) {
      setFading(false);
      return;
    }

    if (newQueue) setQueue(newQueue);
    setCurrentIndex(nextIdx);

    const targetVolume = volumeRef.current;

    const cleanupCurrentSound = () => {
      if (currentSound) {
        currentSound.stop();
        currentSound.unload();
        currentSound = null;
      }
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    };

    const startNextTrack = () => {
      const streamUrl = `/api/tracks/${nextQueue[nextIdx]}/file`;
      const nextTrack = allTracks.find(t => t.id === nextQueue[nextIdx]);
      const format = getFormat(nextTrack?.file_path);

      const sound = new Howl({
        src: [streamUrl],
        format,
        html5: true,
        preload: true,
        volume: 0,

        onload: () => {
          sound.volume(0);
        },

        onplay: () => {
          resumeAudioContext();

          setAudioLoading(false);
          setDuration(sound.duration());
          setPlaying(true);

          progressInterval = setInterval(() => {
            if (sound && sound.playing()) {
              setProgress(sound.seek() || 0);
            }
          }, 120);

          sound.fade(0, targetVolume, CROSSFADE_DURATION);

          // Absolute fail‑safe
          setTimeout(() => {
            if (sound && sound.playing() && sound.volume() < targetVolume * 0.1) {
              console.warn('Fade‑in may have failed – forcing volume');
              sound.volume(targetVolume);
            }
          }, CROSSFADE_DURATION + 150);
        },

        onend: () => {
          clearInterval(progressInterval);

          if (repeatRef.current === 'one') {
            sound.seek(0);
            sound.play();
            setProgress(0);
            setPlaying(true);
            return;
          }

          // Use refs for latest values
          const currentQueue = queueRef.current;
          const idx = currentIndexRef.current;
          const isShuffle = shuffleRef.current;

          let nextIdx = idx + 1;

          if (isShuffle) {
            nextIdx = Math.floor(Math.random() * currentQueue.length);
          } else if (
            repeatRef.current === 'all' &&
            nextIdx >= currentQueue.length
          ) {
            nextIdx = 0;
          } else if (nextIdx >= currentQueue.length) {
            setPlaying(false);
            return;
          }

          const nextTrackId = currentQueue[nextIdx];

          setTimeout(() => {
            crossfadeToTrack(nextTrackId, currentQueue);
          }, CROSSFADE_DURATION);
        },

        onloaderror: (id, err) => {
          console.error('Load error:', err);
          setAudioLoading(false);
          setFading(false);
        },

        onplayerror: (id, err) => {
          console.error('Play error:', err);
          sound.once('unlock', () => sound.play());
        },
      });

      currentSound = sound;
      setAudioLoading(true);
      sound.play();

      setTimeout(() => {
        setFading(false);
      }, CROSSFADE_DURATION + 100);
    };

    if (currentSound && currentSound.playing()) {
      const currentVol = currentSound.volume();
      currentSound.fade(currentVol, 0, CROSSFADE_DURATION);

      setTimeout(() => {
        cleanupCurrentSound();
        startNextTrack();
      }, CROSSFADE_DURATION);
    } else {
      cleanupCurrentSound();
      startNextTrack();
    }
  }, [allTracks]); // <-- only allTracks needed (refs are stable)

  // ── playTrack (with shuffle) ──
  const playTrack = useCallback((trackId, newQueue = null, enableShuffle = false) => {
    if (!newQueue) {
      const idx = queue.indexOf(trackId);
      if (idx === -1) return;
      setCurrentIndex(idx);
      setPlaying(true);
      crossfadeToTrack(trackId, queue);
      return;
    }

    let finalQueue = newQueue;
    if (enableShuffle) {
      const withoutSelected = newQueue.filter(id => id !== trackId);
      for (let i = withoutSelected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [withoutSelected[i], withoutSelected[j]] = [withoutSelected[j], withoutSelected[i]];
      }
      finalQueue = [trackId, ...withoutSelected];
      setShuffle(true);
    } else {
      setShuffle(false);
    }
    setQueue(finalQueue);
    setCurrentIndex(0);
    setPlaying(true);
    crossfadeToTrack(trackId, finalQueue);
  }, [crossfadeToTrack, queue]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    if (repeatRef.current === 'one') return;
    let nextIdx = currentIndex + 1;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (repeat === 'all' && nextIdx >= queue.length) {
      nextIdx = 0;
    } else if (nextIdx >= queue.length) {
      setPlaying(false);
      return;
    }
    const nextTrackId = queue[nextIdx];
    crossfadeToTrack(nextTrackId);
  }, [queue, currentIndex, shuffle, repeat, crossfadeToTrack]);

  const handlePrev = useCallback(() => {
    if (queue.length === 0) return;
    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) prevIdx = queue.length - 1;
    const prevTrackId = queue[prevIdx];
    crossfadeToTrack(prevTrackId);
  }, [queue, currentIndex, crossfadeToTrack]);

  const stopSound = useCallback(() => {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    if (currentSound) {
      currentSound.stop();
      currentSound.unload();
      currentSound = null;
    }
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    volumeRef.current = volume;
    if (currentSound && typeof currentSound.volume === 'function') {
      currentSound.volume(volume);
    }
  }, [volume]);

  // ── Play / Pause (bullet‑proof) ──
  const togglePlay = useCallback(() => {
    if (!currentSound) return;
    if (currentSound.playing()) {
      currentSound.pause();
      setPlaying(false);
    } else {
      resumeAudioContext();
      currentSound.play();
      setPlaying(true);
    }
  }, []);

  const seek = useCallback((sec) => {
    if (currentSound) {
      currentSound.seek(sec);
      setProgress(sec);
    }
  }, []);

  const toggleLyrics = useCallback(() => {
    if (!currentTrack) return;
    setLyricsOpen((open) => !open);
  }, [currentTrack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (e.ctrlKey) handleNext();
          else if (currentSound) seek(currentSound.seek() + 5);
          break;
        case 'ArrowLeft':
          if (e.ctrlKey) handlePrev();
          else if (currentSound) seek(currentSound.seek() - 5);
          break;
        case 'F6':
          e.preventDefault();
          handlePrev();
          break;
        case 'F7':
          e.preventDefault();
          togglePlay();
          break;
        case 'F8':
          e.preventDefault();
          handleNext();
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, playing, togglePlay, handleNext, handlePrev, seek]);

  const handleContextMenu = (e, track, options) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, track, options });
  };
  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    if (!contextMenu) return;
    const clickHandler = (e) => {
      if (contextMenu && !e.target.closest('.context-menu')) {
        closeContextMenu();
      }
    };
    document.addEventListener('mousedown', clickHandler);
    return () => document.removeEventListener('mousedown', clickHandler);
  }, [contextMenu]);

  useEffect(() => {
    if (!currentTrack) {
      stopSound();
    }
  }, [currentTrack, stopSound]);

  // ── Media Session API ──
  useEffect(() => {
    if (!navigator.mediaSession) return;

    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Unknown',
        artist: currentTrack.artist || 'Unknown artist',
        album: currentTrack.album || '',
        artwork: currentTrack.cover_art_url
          ? [{ src: `/api${currentTrack.cover_art_url}`, sizes: '300x300', type: 'image/jpeg' }]
          : [],
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!navigator.mediaSession) return;

    const handlers = {
      play: togglePlay,
      pause: togglePlay,
      previoustrack: handlePrev,
      nexttrack: handleNext,
      stop: stopSound,
    };

    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) { /* not supported */ }
    }

    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (e) { /* ignore */ }
      }
    };
  }, [togglePlay, handlePrev, handleNext, stopSound]);

  return (
    <>
      <div className="app-layout">
        <Sidebar
          playlists={playlists}
          currentView={currentView}
          setCurrentView={setCurrentView}
          setSelectedPlaylistId={setSelectedPlaylistId}
          selectedPlaylistId={selectedPlaylistId}
          onScanRequest={() => setCurrentView('scan')}
          loadPlaylists={loadPlaylists}
          playingPlaylistId={playingPlaylistId}
        />
        <MainContent
          tracks={filteredTracks}
          allTracks={allTracks}
          playlists={playlists}
          currentView={currentView}
          selectedPlaylistId={selectedPlaylistId}
          setSelectedPlaylistId={setSelectedPlaylistId}
          setCurrentView={setCurrentView}
          onPlayTrack={playTrack}
          onQueueUpdate={setQueue}
          queue={queue}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          loadAllTracks={loadAllTracks}
          loadPlaylists={loadPlaylists}
          onContextMenu={handleContextMenu}
          currentTrack={currentTrack}
          playingPlaylistId={playingPlaylistId}
          setPlayingPlaylistId={setPlayingPlaylistId}
          playing={playing}
          togglePlay={togglePlay}
        />
      </div>
      <NowPlayingBar
        currentTrack={currentTrack}
        playing={playing}
        togglePlay={togglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        progress={progress}
        duration={duration}
        onSeek={seek}
        volume={volume}
        onVolumeChange={setVolume}
        shuffle={shuffle}
        onShuffleToggle={() => setShuffle(!shuffle)}
        repeat={repeat}
        onRepeatToggle={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
        loading={audioLoading}
        lyricsOpen={lyricsOpen}
        onLyricsToggle={toggleLyrics}
      />
      <LyricsScreen
        currentTrack={currentTrack}
        progress={progress}
        playing={playing}
        isOpen={lyricsOpen && !!currentTrack}
        onClose={() => setLyricsOpen(false)}
      />
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={closeContextMenu}
        >
          {contextMenu.options?.map((opt, i) => (
            <div key={i} className="context-menu-item" onClick={() => { opt.action(); closeContextMenu(); }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </>
  );
}