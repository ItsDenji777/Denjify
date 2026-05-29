import React, { useEffect, useState } from 'react';
import TrackList from './TrackList.jsx';
import PlaylistView from './PlaylistView.jsx';
import HomeView from './HomeView.jsx';
import SearchView from './SearchView.jsx';
import { fetchPlaylistTracks, scanLibrary, deletePlaylist } from '../services/api.js';

export default function MainContent({
  tracks, allTracks, playlists, currentView, selectedPlaylistId, setSelectedPlaylistId,
  setCurrentView, onPlayTrack, onQueueUpdate, queue, searchQuery, setSearchQuery,
  loadAllTracks, loadPlaylists, onContextMenu, currentTrack,
  playingPlaylistId, setPlayingPlaylistId,
  playing,          // ← NEW
  togglePlay,       // ← NEW
}) {
  const [scanPath, setScanPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [playlistData, setPlaylistData] = useState(null);

  // Reset playlist data when switching playlists
  useEffect(() => {
    if (currentView === 'playlist') {
      setPlaylistData(null);
    }
  }, [selectedPlaylistId, currentView]);

  useEffect(() => {
    if (currentView === 'playlist' && selectedPlaylistId) {
      fetchPlaylistTracks(selectedPlaylistId).then(data => setPlaylistData(data));
    } else {
      setPlaylistData(null);
    }
  }, [currentView, selectedPlaylistId]);

  const handleScan = async () => {
    if (!scanPath) return;
    setScanning(true);
    try {
      await scanLibrary(scanPath);
      await loadAllTracks();
    } catch (err) {
      alert('Scan error: ' + err.message);
    }
    setScanning(false);
    setScanPath('');
  };

  if (currentView === 'scan') {
    return (
      <div className="main-content">
        <div className="scan-modal">
          <h2>Scan Music Folder</h2>
          <input
            type="text"
            placeholder="Enter absolute path (e.g., C:\\Music)"
            value={scanPath}
            onChange={e => setScanPath(e.target.value)}
          />
          <button onClick={handleScan} disabled={scanning}>
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'playlist') {
    if (!playlistData) {
      return (
        <div className="main-content" style={{ padding: 0 }}>
          <div style={{ padding: 24 }}>
            {/* Skeleton placeholder */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
              <div style={{ width: 200, height: 200, borderRadius: 4, background: '#282828', animation: 'pulse 1.5s infinite' }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: '30%', height: 14, background: '#282828', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
                <div style={{ width: '60%', height: 36, background: '#282828', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
                <div style={{ width: '40%', height: 14, background: '#282828', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
                <div style={{ width: '50%', height: 20, background: '#282828', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
              </div>
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 80px', alignItems: 'center', padding: '8px 0', gap: 16 }}>
                <div style={{ width: 16, height: 16, background: '#282828', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, background: '#282828', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                  <div>
                    <div style={{ width: 120, height: 12, background: '#282828', borderRadius: 2, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
                    <div style={{ width: 80, height: 10, background: '#282828', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
                  </div>
                </div>
                <div style={{ width: 100, height: 12, background: '#282828', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
                <div style={{ width: 40, height: 12, background: '#282828', borderRadius: 2, animation: 'pulse 1.5s infinite', justifySelf: 'end' }} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="main-content" style={{ padding: 0 }}>
        <PlaylistView
          playlist={playlistData}
          onPlayTrack={(trackId, newQueue, enableShuffle) => onPlayTrack(trackId, newQueue, enableShuffle)}
          onContextMenu={onContextMenu}
          onDeletePlaylist={async () => {
            await deletePlaylist(playlistData.id);
            setSelectedPlaylistId(null);
            loadPlaylists();
          }}
          onRefresh={() => {
            fetchPlaylistTracks(selectedPlaylistId).then(setPlaylistData);
            loadPlaylists();
          }}
          currentTrackId={currentTrack?.id}
          setPlayingPlaylistId={setPlayingPlaylistId}
          playingPlaylistId={playingPlaylistId}    // ← NEW
          playing={playing}                        // ← NEW
          togglePlay={togglePlay}                  // ← NEW
        />
      </div>
    );
  }

  if (currentView === 'localFiles') {
    return (
      <div className="main-content">
        <div className="header">
          <h2>Local Files</h2>
          <input
            className="search-input"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <TrackList
          tracks={tracks}
          playlists={playlists}
          refreshPlaylists={loadPlaylists}
          onPlayTrack={(trackId) => {
            setPlayingPlaylistId('localFiles');
            onPlayTrack(trackId, tracks.map(t => t.id));
          }}
          onContextMenu={onContextMenu}
          currentTrackId={currentTrack?.id}
        />
      </div>
    );
  }

  if (currentView === 'home') {
    return (
      <div className="main-content">
        <HomeView
          tracks={allTracks}
          playlists={playlists}
          onPlayTrack={onPlayTrack}
          onContextMenu={onContextMenu}
          setCurrentView={setCurrentView}
          setSelectedPlaylistId={setSelectedPlaylistId}
          setSearchQuery={setSearchQuery}
          loadPlaylists={loadPlaylists}
        />
      </div>
    );
  }

  if (currentView === 'search') {
    return (
      <div className="main-content">
        <SearchView
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          tracks={tracks}
          onPlayTrack={onPlayTrack}
          onContextMenu={onContextMenu}
          currentTrackId={currentTrack?.id}
        />
      </div>
    );
  }

  // Fallback library view
  return (
    <div className="main-content">
      <div className="header">
        <h2>Your Library</h2>
        <input
          className="search-input"
          placeholder="Search tracks..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>
      <TrackList
        tracks={tracks}
        playlists={playlists}
        refreshPlaylists={loadPlaylists}
        onPlayTrack={(trackId) => onPlayTrack(trackId, tracks.map(t => t.id))}
        onContextMenu={onContextMenu}
        currentTrackId={currentTrack?.id}
      />
    </div>
  );
}