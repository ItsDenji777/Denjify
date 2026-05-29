import React, { useState, useMemo, useEffect, useRef } from 'react';
import TrackList from './TrackList.jsx';
import {
  addFolderToPlaylist,
  removeTracksFromPlaylist,
  updatePlaylist,
} from '../services/api.js';
import {
  FaPlay,
  FaPause,
  FaShuffle,
  FaMagnifyingGlass,
} from 'react-icons/fa6';

// In‑memory cache for dominant colors
const COLOR_CACHE = {};

export default function PlaylistView({
  playlist,
  onPlayTrack,
  onContextMenu,
  onDeletePlaylist,
  onRefresh,
  currentTrackId,
  setPlayingPlaylistId,
  playingPlaylistId,     // new – which playlist is playing
  playing,               // new – global playing state
  togglePlay,            // new – global pause/resume
}) {
  const [folderPath, setFolderPath] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [showCoverInput, setShowCoverInput] = useState(false);
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [uploadedCover, setUploadedCover] = useState('');
  const [dominantColor, setDominantColor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [colorLoading, setColorLoading] = useState(true);

  const canvasRef = useRef(document.createElement('canvas'));

  const tracks = playlist.tracks || [];

  // Filter tracks based on search query
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = searchQuery.toLowerCase();
    return tracks.filter(t =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.album && t.album.toLowerCase().includes(q))
    );
  }, [tracks, searchQuery]);

  const totalDuration = useMemo(() => {
    let sec = 0;
    filteredTracks.forEach(t => { if (t.duration_seconds) sec += t.duration_seconds; });
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
  }, [filteredTracks]);

  // Extract dominant color from cover, with caching
  useEffect(() => {
    const coverSrc = playlist.cover_url;
    if (!coverSrc) {
      setDominantColor(null);
      setColorLoading(false);
      return;
    }

    if (COLOR_CACHE[coverSrc]) {
      setDominantColor(COLOR_CACHE[coverSrc]);
      setColorLoading(false);
      return;
    }

    setColorLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = coverSrc;

    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const color = `rgb(${r},${g},${b})`;
      COLOR_CACHE[coverSrc] = color;
      setDominantColor(color);
      setColorLoading(false);
    };

    img.onerror = () => {
      setDominantColor(null);
      setColorLoading(false);
    };
  }, [playlist.cover_url]);

  const headerBg = colorLoading
    ? '#181818'
    : dominantColor || playlist.cover_color || '#1db954';

  const gradientStyle = {
    background: `linear-gradient(to bottom, ${headerBg}, #121212)`,
    transition: 'background 0.3s ease',
  };

  // ── New: is this playlist currently playing? ──
  const isThisPlaying = playing && playingPlaylistId === playlist.id;

  const handleAddFolder = async () => {
    if (!folderPath.trim()) return;
    try {
      const res = await addFolderToPlaylist(playlist.id, folderPath.trim());
      alert(`Added ${res.added} tracks.`);
      onRefresh();
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setShowFolderInput(false);
    setFolderPath('');
  };

  const handleCoverChange = async () => {
    const coverUrl = uploadedCover || newCoverUrl.trim();
    if (!coverUrl) return;
    try {
      await updatePlaylist(playlist.id, { cover_url: coverUrl });
      onRefresh();
    } catch (err) {
      alert('Error updating cover: ' + err.message);
    }
    setShowCoverInput(false);
    setNewCoverUrl('');
    setUploadedCover('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedCover(ev.target.result);
    reader.readAsDataURL(file);
  };

  // ── New: play / pause toggle ──
  const handlePlayPause = () => {
    if (isThisPlaying) {
      togglePlay();                     // pause the current playback
    } else {
      playAll();                        // start playing this playlist
    }
  };

  const playAll = () => {
    if (filteredTracks.length === 0) return;
    setPlayingPlaylistId(playlist.id);
    onPlayTrack(filteredTracks[0].id, filteredTracks.map(t => t.id), false);
  };

  const shufflePlay = () => {
    if (filteredTracks.length === 0) return;
    setPlayingPlaylistId(playlist.id);
    const shuffled = [...filteredTracks].sort(() => 0.5 - Math.random());
    onPlayTrack(shuffled[0].id, shuffled.map(t => t.id), true);
  };

  const coverSrc = playlist.cover_url || null;

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Header */}
      <div style={{ ...gradientStyle, padding: '32px 0 24px', display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <div style={{
          width: 200, height: 200, borderRadius: 4,
          backgroundColor: coverSrc ? 'transparent' : (playlist.cover_color || '#1db954'),
          backgroundImage: coverSrc ? `url(${coverSrc})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 60, marginLeft: 24
        }}>
          {!coverSrc && '🎵'}
        </div>
        <div style={{ flex: 1, marginRight: 24 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#b3b3b3' }}>Playlist</div>
          <h1 style={{ fontSize: 48, fontWeight: 700, margin: '4px 0' }}>{playlist.name}</h1>
          {playlist.description && <p style={{ color: '#b3b3b3', marginBottom: 8 }}>{playlist.description}</p>}
          <div style={{ fontSize: 14, color: '#b3b3b3', marginBottom: 16 }}>
            {filteredTracks.length} songs{searchQuery ? ` (filtered from ${tracks.length})` : ''}, {totalDuration}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Play / Pause button */}
            <button
              onClick={handlePlayPause}
              style={{
                background: '#1db954',
                border: 'none',
                color: '#000',
                fontWeight: 700,
                padding: '8px 24px',
                borderRadius: 20,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isThisPlaying ? (
                <>
                  <FaPause size={14} color="#000" />
                  Pause
                </>
              ) : (
                <>
                  <FaPlay size={14} color="#000" />
                  Play
                </>
              )}
            </button>

            {/* Shuffle button */}
            <button onClick={shufflePlay} style={{
              background: 'transparent', border: '1px solid #b3b3b3', color: '#fff',
              padding: '8px 24px', borderRadius: 20, cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <FaShuffle size={14} color="#fff" /> Shuffle
            </button>

            {/* Search toggle */}
            <button onClick={() => setShowSearch(!showSearch)} title="Search in playlist" style={{
              background: 'transparent', border: '1px solid transparent', color: '#b3b3b3',
              cursor: 'pointer', fontSize: 18, padding: 8, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#b3b3b3')}>
              <FaMagnifyingGlass size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Controls + search bar */}
      <div style={{ padding: '0 24px', display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={() => setShowFolderInput(!showFolderInput)}
          style={{ background: 'none', border: '1px solid #535353', color: '#b3b3b3', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>
          Add folder
        </button>
        <button onClick={() => setShowCoverInput(!showCoverInput)}
          style={{ background: 'none', border: '1px solid #535353', color: '#b3b3b3', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>
          Change cover
        </button>
        <button onClick={onDeletePlaylist}
          style={{ background: 'none', border: '1px solid #535353', color: '#b3b3b3', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}>
          Delete
        </button>
        <div style={{ flex: 1 }} />
        {showSearch && (
          <input type="text" placeholder="Find in playlist..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} autoFocus
            style={{
              padding: '6px 12px', background: '#2a2a2a', border: 'none',
              borderRadius: 20, color: '#fff', fontSize: 14, width: 220
            }} />
        )}
      </div>

      {showFolderInput && (
        <div style={{ padding: '0 24px', marginBottom: 16 }}>
          <input type="text" placeholder="Folder path" value={folderPath}
            onChange={e => setFolderPath(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 8, background: '#121212', border: '1px solid #535353', borderRadius: 4, color: '#fff' }} />
          <button onClick={handleAddFolder} style={{ background: '#1db954', border: 'none', color: '#000', fontWeight: 700, padding: '6px 16px', borderRadius: 4, cursor: 'pointer' }}>Add</button>
        </div>
      )}

      {showCoverInput && (
        <div style={{ padding: '0 24px', marginBottom: 16 }}>
          <input type="text" placeholder="Cover URL (http://...)" value={newCoverUrl}
            onChange={e => setNewCoverUrl(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 8, background: '#121212', border: '1px solid #535353', borderRadius: 4, color: '#fff' }} />
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#b3b3b3' }}>Or upload an image:</label>
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'block', marginTop: 4 }} />
          </div>
          <button onClick={handleCoverChange} style={{ background: '#1db954', border: 'none', color: '#000', fontWeight: 700, padding: '6px 16px', borderRadius: 4, cursor: 'pointer' }}>Set Cover</button>
        </div>
      )}

      {/* Track list */}
      <div style={{ padding: '0 24px' }}>
        <TrackList
          tracks={filteredTracks}
          playlists={[]}
          refreshPlaylists={() => {}}
          onPlayTrack={(trackId) => onPlayTrack(trackId, filteredTracks.map(t => t.id))}
          onContextMenu={(e, track) =>
            onContextMenu(e, track, [
              {
                label: 'Remove from playlist',
                action: async () => {
                  await removeTracksFromPlaylist(playlist.id, [track.id]);
                  onRefresh();
                }
              },
            ])
          }
          currentTrackId={currentTrackId}
        />
      </div>
    </div>
  );
}