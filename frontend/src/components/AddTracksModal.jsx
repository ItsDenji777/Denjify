import React, { useState, useEffect } from 'react';
import { addTracksToPlaylist, removeTracksFromPlaylist } from '../services/api.js';

export default function AddTracksModal({ playlistId, playlistTrackIds, onClose, onSuccess }) {
  const [search, setSearch] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Fetch all tracks and pre-check those already in playlist
  useEffect(() => {
    setLoading(true);
    fetchTracks(10000, 0, '')
      .then(data => {
        setTracks(data);
        // Pre-check tracks that are already in the playlist
        const initialSelected = new Set();
        data.forEach(t => {
          if (playlistTrackIds.has(t.id)) {
            initialSelected.add(t.id);
          }
        });
        setSelectedIds(initialSelected);
      })
      .catch(err => console.error('Failed to fetch tracks:', err))
      .finally(() => setLoading(false));
  }, [playlistTrackIds]);

  // If we don't have fetchTracks imported, we'll import it
  const fetchTracks = (limit, offset, search) => {
    const params = new URLSearchParams({ limit, offset });
    if (search) params.append('q', search);
    return fetch(`/api/tracks?${params}`).then(res => res.json());
  };

  const filtered = tracks.filter(t =>
    (t.title && t.title.toLowerCase().includes(search.toLowerCase())) ||
    (t.artist && t.artist.toLowerCase().includes(search.toLowerCase())) ||
    (t.album && t.album.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleTrack = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleApply = async () => {
    setSubmitting(true);
    try {
      // Determine which tracks to add (selected but not originally in playlist)
      const toAdd = [];
      const toRemove = [];
      selectedIds.forEach(id => {
        if (!playlistTrackIds.has(id)) toAdd.push(id);
      });
      playlistTrackIds.forEach(id => {
        if (!selectedIds.has(id)) toRemove.push(id);
      });

      // Perform additions and removals
      if (toAdd.length > 0) {
        await addTracksToPlaylist(playlistId, toAdd);
      }
      if (toRemove.length > 0) {
        await removeTracksFromPlaylist(playlistId, toRemove);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      alert('Failed to update playlist: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Manage Tracks in Playlist</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b3b3b3', fontSize: 24, cursor: 'pointer' }}>&times;</button>
        </div>
        <input
          type="text"
          placeholder="Search tracks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            marginBottom: 16,
            background: '#2a2a2a',
            border: 'none',
            borderRadius: 20,
            color: '#fff',
            fontSize: 14,
            outline: 'none'
          }}
        />
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#b3b3b3' }}>Loading tracks...</div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#b3b3b3' }}>No tracks found</div>
            ) : (
              filtered.map(track => (
                <div
                  key={track.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: selectedIds.has(track.id) ? '#1db95420' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => toggleTrack(track.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(track.id)}
                    onChange={() => toggleTrack(track.id)}
                    style={{ marginRight: 12, cursor: 'pointer' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                    {track.cover_art_url ? (
                      <img
                        src={`/api${track.cover_art_url}`}
                        alt=""
                        style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }}
                        onError={(e) => { e.target.src = ''; e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 4, background: '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎵</div>
                    )}
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: '#fff' }}>{track.title || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: '#b3b3b3' }}>{track.artist || 'Unknown artist'}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#b3b3b3' }}>
                    {track.duration_seconds ? `${Math.floor(track.duration_seconds / 60)}:${String(track.duration_seconds % 60).padStart(2, '0')}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #535353',
              color: '#b3b3b3',
              padding: '8px 24px',
              borderRadius: 20,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={submitting}
            style={{
              background: '#1db954',
              border: 'none',
              color: '#000',
              padding: '8px 24px',
              borderRadius: 20,
              cursor: submitting ? 'default' : 'pointer',
              fontSize: 14,
              fontWeight: 700,
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Updating...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}