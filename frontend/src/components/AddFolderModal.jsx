import React, { useState, useEffect, useRef } from 'react';
import { addTracksToPlaylist, removeTracksFromPlaylist } from '../services/api.js';

export default function AddFolderModal({ playlistId, playlistTrackIds, onClose, onSuccess }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolders, setSelectedFolders] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const initialSelectedRef = useRef(new Set());

  // Load all tracks and extract folders
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const tracks = await fetchTracks(10000, 0, '');
        const folderMap = new Map();
        tracks.forEach(t => {
          if (t.file_path) {
            // Extract directory (cross-platform)
            const sep = t.file_path.includes('\\') ? '\\' : '/';
            const dir = t.file_path.substring(0, t.file_path.lastIndexOf(sep));
            if (dir) {
              if (!folderMap.has(dir)) folderMap.set(dir, []);
              folderMap.get(dir).push(t.id);
            }
          }
        });
        const folderList = Array.from(folderMap.keys()).sort();
        const folderData = folderList.map(f => ({ path: f, trackIds: folderMap.get(f) }));
        setFolders(folderData);

        // Pre-check folders where ALL tracks are already in the playlist
        const initialSelected = new Set();
        folderData.forEach(f => {
          if (f.trackIds.every(id => playlistTrackIds.has(id))) {
            initialSelected.add(f.path);
          }
        });
        setSelectedFolders(initialSelected);
        initialSelectedRef.current = new Set(initialSelected);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load data:', err);
        setLoading(false);
      }
    };
    fetchAll();
  }, [playlistTrackIds]);

  const fetchTracks = (limit, offset, search) => {
    const params = new URLSearchParams({ limit, offset });
    if (search) params.append('q', search);
    return fetch(`/api/tracks?${params}`).then(res => res.json());
  };

  const toggleFolder = (folderPath) => {
    const newSet = new Set(selectedFolders);
    if (newSet.has(folderPath)) newSet.delete(folderPath);
    else newSet.add(folderPath);
    setSelectedFolders(newSet);
  };

  const handleApply = async () => {
    setSubmitting(true);
    try {
      const folderMap = new Map();
      folders.forEach(f => folderMap.set(f.path, f.trackIds));

      // Determine which folders were added (selected but not in initial) and removed (initial but not selected)
      const addedFolders = [];
      const removedFolders = [];
      selectedFolders.forEach(f => {
        if (!initialSelectedRef.current.has(f)) addedFolders.push(f);
      });
      initialSelectedRef.current.forEach(f => {
        if (!selectedFolders.has(f)) removedFolders.push(f);
      });

      // Collect track IDs
      const toAdd = [];
      const toRemove = [];
      addedFolders.forEach(f => {
        const ids = folderMap.get(f);
        if (ids) toAdd.push(...ids);
      });
      removedFolders.forEach(f => {
        const ids = folderMap.get(f);
        if (ids) toRemove.push(...ids);
      });

      // Apply changes
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
          <h2 style={{ margin: 0, fontSize: 20 }}>Manage Folders in Playlist</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b3b3b3', fontSize: 24, cursor: 'pointer' }}>&times;</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#b3b3b3' }}>Loading folders...</div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {folders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#b3b3b3' }}>No folders found in library</div>
            ) : (
              folders.map(folder => (
                <div
                  key={folder.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: selectedFolders.has(folder.path) ? '#1db95420' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => toggleFolder(folder.path)}
                >
                  <input
                    type="checkbox"
                    checked={selectedFolders.has(folder.path)}
                    onChange={() => toggleFolder(folder.path)}
                    style={{ marginRight: 12, cursor: 'pointer' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div style={{ flex: 1, fontSize: 14, color: '#fff' }}>
                    {folder.path}
                  </div>
                  <div style={{ fontSize: 12, color: '#b3b3b3' }}>
                    {folder.trackIds.length} tracks
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