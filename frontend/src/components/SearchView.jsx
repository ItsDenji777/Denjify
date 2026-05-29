import React from 'react';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import TrackList from './TrackList.jsx';

export default function SearchView({ searchQuery, setSearchQuery, tracks, onPlayTrack, onContextMenu, currentTrackId }) {
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <FaMagnifyingGlass size={20} color="#b3b3b3" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          className="search-input"
          placeholder="What do you want to listen to?"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', fontSize: 24, padding: '12px 12px 12px 48px' }}
        />
      </div>
      {searchQuery.trim() === '' ? (
        <div style={{ color: '#b3b3b3', textAlign: 'center', marginTop: 80 }}>
          <p style={{ fontSize: 24 }}>Start typing to find tracks</p>
        </div>
      ) : tracks.length === 0 ? (
        <div style={{ color: '#b3b3b3', textAlign: 'center', marginTop: 80 }}>
          <p style={{ fontSize: 18 }}>No results for “{searchQuery}”</p>
        </div>
      ) : (
        <div>
          <h2 style={{ marginBottom: 16 }}>Search results</h2>
          <TrackList
            tracks={tracks}
            onPlayTrack={(trackId) => onPlayTrack(trackId, tracks.map(t => t.id))}
            onContextMenu={onContextMenu}
            currentTrackId={currentTrackId}
          />
        </div>
      )}
    </div>
  );
}