import React, { useState } from 'react';
import { addTracksToPlaylist } from '../services/api.js';

export default function TrackList({ tracks, playlists, refreshPlaylists, onPlayTrack, onContextMenu, currentTrackId }) {
  const [playlistMenu, setPlaylistMenu] = useState(null);

  const formatTime = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddToPlaylist = async (playlistId, trackId) => {
    try {
      await addTracksToPlaylist(playlistId, [trackId]);
      if (refreshPlaylists) refreshPlaylists();
      alert('Track added!');
    } catch (err) {
      alert('Failed: ' + err.message);
    }
    setPlaylistMenu(null);
  };

  const handleContextMenu = (e, track) => {
    e.preventDefault();
    onContextMenu(e, track, [
      {
        label: 'Add to playlist',
        action: () => {
          setPlaylistMenu({ x: e.clientX, y: e.clientY, track });
        },
      },
    ]);
  };

  return (
    <>
      <div className="track-list">
        {tracks.map((track, idx) => (
          <div
            key={track.id}
            className={`track-row ${currentTrackId === track.id ? 'playing' : ''}`}
            onClick={() => onPlayTrack(track.id)}
            onContextMenu={(e) => handleContextMenu(e, track)}
          >
            <div className="track-index">{idx + 1}</div>
            <div className="track-info">
              <div className="track-cover">
                {track.cover_art_url ? (
                  <img
                    src={`/api${track.cover_art_url}`}
                    alt=""
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentNode.innerHTML = '<span style="font-size:18px;color:#fff">🎵</span>';
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '18px', color: '#fff' }}>🎵</span>
                )}
              </div>
              <div>
                <div className="track-title">{track.title || 'Unknown'}</div>
                <div className="track-artist">{track.artist || 'Unknown artist'}</div>
              </div>
            </div>
            <div className="track-album">{track.album || ''}</div>
            <div className="track-duration">{formatTime(track.duration_seconds)}</div>
          </div>
        ))}
      </div>

      {playlistMenu && (
        <div
          className="context-menu"
          style={{ top: playlistMenu.y, left: playlistMenu.x }}
          onClick={() => setPlaylistMenu(null)}
        >
          {playlists.length === 0 ? (
            <div className="context-menu-item" style={{ cursor: 'default' }}>No playlists yet</div>
          ) : (
            playlists.map((pl) => (
              <div
                key={pl.id}
                className="context-menu-item"
                onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(pl.id, playlistMenu.track.id); }}
              >
                {pl.name}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}