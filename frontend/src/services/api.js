const BASE = '/api';

export async function fetchTracks(limit = 1000, offset = 0, search = '') {
  const params = new URLSearchParams({ limit, offset });
  if (search) params.append('q', search);
  const res = await fetch(`${BASE}/tracks?${params}`);
  return res.json();
}

export async function fetchTrack(id) {
  const res = await fetch(`${BASE}/tracks/${id}`);
  return res.json();
}

export async function getStreamUrl(id) {
  return `${BASE}/tracks/${id}/file`;
}

export async function fetchPlaylists() {
  const res = await fetch(`${BASE}/playlists`);
  return res.json();
}

export async function fetchPlaylistTracks(playlistId) {
  const res = await fetch(`${BASE}/playlists/${playlistId}/tracks`);
  return res.json();
}

export async function createPlaylist(name, description, cover_color, cover_url) {
  const res = await fetch(`${BASE}/playlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, cover_color, cover_url }),
  });
  return res.json();
}

export async function updatePlaylist(id, data) {
  await fetch(`${BASE}/playlists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deletePlaylist(id) {
  await fetch(`${BASE}/playlists/${id}`, { method: 'DELETE' });
}

export async function addTracksToPlaylist(playlistId, trackIds, position = null) {
  await fetch(`${BASE}/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackIds, position }),
  });
}

export async function removeTracksFromPlaylist(playlistId, trackIds) {
  await fetch(`${BASE}/playlists/${playlistId}/tracks`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackIds }),
  });
}

export async function reorderPlaylistTrack(playlistId, trackId, newPosition) {
  await fetch(`${BASE}/playlists/${playlistId}/tracks/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId, newPosition }),
  });
}

export async function scanLibrary(dirPath) {
  const res = await fetch(`${BASE}/library/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath }),
  });
  return res.json();
}

export async function addFolderToPlaylist(playlistId, folderPath) {
  const res = await fetch(`${BASE}/playlists/${playlistId}/add-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath }),
  });
  return res.json();
}

export async function updatePlaylistCover(playlistId, coverColor) {
  await fetch(`${BASE}/playlists/${playlistId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cover_color: coverColor }),
  });
}

