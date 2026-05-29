import React, { useState, useMemo } from 'react';
import { addTracksToPlaylist } from '../services/api.js';
import SkeletonCard from './SkeletonCard.jsx';

export default function HomeView({
  tracks, playlists, onPlayTrack, onContextMenu,
  setCurrentView, setSelectedPlaylistId, loadPlaylists
}) {
  const [playlistMenu, setPlaylistMenu] = useState(null);

  const recentTracks = useMemo(() => [...tracks].sort((a, b) => b.id - a.id).slice(0, 6), [tracks]);
  const recommendedTracks = useMemo(() => {
    const shuffled = [...tracks].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 6);
  }, [tracks]);

  const loading = tracks.length === 0 && playlists.length === 0;

  const handleAddToPlaylist = async (playlistId, trackId) => {
    try {
      await addTracksToPlaylist(playlistId, [trackId]);
      loadPlaylists();
      alert('Track added!');
    } catch (err) {
      alert('Failed: ' + err.message);
    }
    setPlaylistMenu(null);
  };

  const handleTrackContext = (e, track) => {
    e.preventDefault();
    e.stopPropagation();
    setPlaylistMenu({ x: e.clientX, y: e.clientY, track });
  };

  const renderTrackCard = (track) => (
    <div
      key={track.id}
      style={{
        width: 160, background: '#181818', borderRadius: 8, padding: 12, cursor: 'pointer'
      }}
      onClick={() => onPlayTrack(track.id, [track.id])}
      onContextMenu={(e) => handleTrackContext(e, track)}
    >
      <div style={{
        width: '100%', height: 136, borderRadius: 4, marginBottom: 8, overflow: 'hidden',
        background: track.cover_art_url ? 'transparent' : 'linear-gradient(135deg, #450af5, #c4efd9)'
      }}>
        {track.cover_art_url ? (
          <img
            src={`/api${track.cover_art_url}`} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<span style="font-size:40px">🎵</span>';
            }}
          />
        ) : (
          <span style={{ fontSize: 40, color: '#fff' }}>🎵</span>
        )}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {track.title || 'Unknown'}
      </div>
      <div style={{ color: '#b3b3b3', fontSize: 12 }}>{track.artist || 'Unknown artist'}</div>
    </div>
  );

  if (loading) {
    return (
      <div>
        <h2 style={{ marginBottom: 24 }}>Home</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Home</h2>

      {/* Playlist cards */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 20, marginBottom: 16 }}>Your Playlists</h3>
        {playlists.length === 0 ? (
          <p style={{ color: '#b3b3b3' }}>No playlists yet. Create one from the sidebar.</p>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {playlists.map(pl => (
              <div
                key={pl.id}
                style={{
                  width: 160, background: '#181818', borderRadius: 8, padding: 12, cursor: 'pointer'
                }}
                onClick={() => { setCurrentView('playlist'); setSelectedPlaylistId(pl.id); }}
              >
                <div style={{
                width: '100%', height: 136,
                backgroundColor: pl.cover_url ? 'transparent' : (pl.cover_color || '#1db954'),
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40, marginBottom: 8,
                backgroundImage: pl.cover_url ? `url(${pl.cover_url})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center'
                }}>
                {!pl.cover_url && '🎵'}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pl.name}
                </div>
                    <div style={{ color: '#b3b3b3', fontSize: 12 }}>{pl.trackCount || 0} tracks</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recently Added */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 20, marginBottom: 16 }}>Recently Added</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {recentTracks.length > 0 ? recentTracks.map(renderTrackCard) : <p style={{ color: '#b3b3b3' }}>No tracks yet.</p>}
        </div>
      </section>

      {/* Recommended */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 20, marginBottom: 16 }}>Recommended</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {recommendedTracks.length > 0 ? recommendedTracks.map(renderTrackCard) : <p style={{ color: '#b3b3b3' }}>No tracks available.</p>}
        </div>
      </section>

      {playlistMenu && (
        <div
          className="context-menu"
          style={{ top: playlistMenu.y, left: playlistMenu.x }}
          onClick={() => setPlaylistMenu(null)}
        >
          {playlists.length === 0 ? (
            <div className="context-menu-item" style={{ cursor: 'default' }}>No playlists yet</div>
          ) : (
            playlists.map(pl => (
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
    </div>
  );
}