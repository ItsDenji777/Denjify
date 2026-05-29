import React, { useState, useRef, useEffect } from 'react';
import { createPlaylist } from '../services/api.js';
import {
  FaHouse,
  FaMagnifyingGlass,
  FaBookOpen,
  FaPlus,
  FaVolumeHigh,
  FaFolder,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa6';
import denjifyLogo from '/images/logo.png';

/* ── helper hook for tag scroll arrows ── */
function useTagScroll(tagsRef) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const check = () => {
    const el = tagsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    check();
    const el = tagsRef.current;
    if (el) {
      el.addEventListener('scroll', check, { passive: true });
      window.addEventListener('resize', check);
    }
    return () => {
      if (el) el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  return { canScrollLeft, canScrollRight, check };
}

/* ──────────────────────────────────────────── */

export default function Sidebar({
  playlists,
  currentView,
  setCurrentView,
  setSelectedPlaylistId,
  selectedPlaylistId,
  onScanRequest,
  loadPlaylists,
  playingPlaylistId,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#1db954');
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [uploadedCover, setUploadedCover] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [showLibrarySearch, setShowLibrarySearch] = useState(false);
  const [activeTag, setActiveTag] = useState('playlists'); // playlists | podcasts | radio | audiobooks

  const tagsRef = useRef(null);
  const { canScrollLeft, canScrollRight, check } = useTagScroll(tagsRef);

  const scrollTags = (dir) => {
    const el = tagsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -140 : 140, behavior: 'smooth' });
    setTimeout(check, 350);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const coverUrl = uploadedCover || newCoverUrl.trim() || null;
    await createPlaylist(newName.trim(), '', newColor, coverUrl);
    await loadPlaylists();
    setNewName('');
    setNewCoverUrl('');
    setUploadedCover('');
    setShowCreate(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedCover(ev.target.result);
      setNewCoverUrl('');
    };
    reader.readAsDataURL(file);
  };

  const filteredPlaylists = playlists.filter((pl) =>
    pl.name.toLowerCase().includes(librarySearch.toLowerCase())
  );

  const localFilesItem = {
    id: 'localFiles',
    name: 'Local Files',
    type: 'Local Files',
    cover_color: '#1e3264',
    cover_url: null,
  };

  const allItems = activeTag === 'playlists' ? [localFilesItem, ...filteredPlaylists] : [];
  const isPlaying = (id) => playingPlaylistId === id;

  /* helper to render placeholder text for non‑playlist tags */
  const placeholderText = {
    podcasts: 'Podcasts coming soon',
    radio: 'Radio coming soon',
    audiobooks: 'Audio Books coming soon',
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <img src={denjifyLogo} alt="Denjify" style={{ width: 130, filter: 'invert(1)' }} />
      </div>

      {/* ── Home + Search ── */}
      <div className="sidebar-section home-search-section">
        <div
          className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => { setCurrentView('home'); setSelectedPlaylistId(null); }}
        >
          <FaHouse size={24} />
          <span>Home</span>
        </div>
        <div
          className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => { setCurrentView('search'); setSelectedPlaylistId(null); }}
        >
          <FaMagnifyingGlass size={24} />
          <span>Search</span>
        </div>
      </div>

      <div style={{ height: 8 }} />

      {/* ── Your Library ── */}
      <div className="sidebar-section library-section">
        <div className="sidebar-section-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaBookOpen size={18} />
            Your Library
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{ background: 'none', border: 'none', color: '#b3b3b3', cursor: 'pointer', fontSize: 20 }}
            title="Create Playlist"
          >
            <FaPlus size={18} />
          </button>
        </div>

        <div className="library-content">
          {/* ── Tag scroller ── */}
          <div className="tag-scroller">
            {canScrollLeft && (
              <div className="tag-fade left">
                <button className="tag-arrow" onClick={() => scrollTags('left')}>
                  <FaChevronLeft size={14} />
                </button>
              </div>
            )}

            <div className="library-tags" ref={tagsRef} onScroll={check}>
              <button className={`library-tag ${activeTag === 'playlists' ? 'active' : ''}`} onClick={() => setActiveTag('playlists')}>Playlists</button>
              <button className={`library-tag ${activeTag === 'podcasts' ? 'active' : ''}`} onClick={() => setActiveTag('podcasts')}>Podcasts</button>
              <button className={`library-tag ${activeTag === 'audiobooks' ? 'active' : ''}`} onClick={() => setActiveTag('audiobooks')}>Audio Books</button>
              <button className={`library-tag ${activeTag === 'radio' ? 'active' : ''}`} onClick={() => setActiveTag('radio')}>Radio</button>

            </div>

            {canScrollRight && (
              <div className="tag-fade right">
                <button className="tag-arrow" onClick={() => scrollTags('right')}>
                  <FaChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Search in library */}
          <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {showLibrarySearch ? (
              <input
                type="text"
                placeholder="Search in Your Library"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                onBlur={() => { if (!librarySearch) setShowLibrarySearch(false); }}
                autoFocus
                style={{ width: '100%', padding: '6px 8px', background: '#2a2a2a', border: 'none', borderRadius: 4, color: '#fff', fontSize: 13 }}
              />
            ) : (
              <button
                onClick={() => setShowLibrarySearch(true)}
                style={{ background: 'none', border: 'none', color: '#b3b3b3', cursor: 'pointer', fontSize: 16 }}
                title="Search in library"
              >
                <FaMagnifyingGlass size={16} />
              </button>
            )}
          </div>

          {showCreate && (
            <div style={{ padding: '0 16px', marginBottom: 12 }}>
              <input type="text" placeholder="Playlist name" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: 4, background: '#282828', border: '1px solid #535353', borderRadius: 4, color: '#fff' }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 12, color: '#b3b3b3' }}>Color:</label>
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 30, height: 20, border: 'none', background: 'transparent' }} />
              </div>
              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 12, color: '#b3b3b3' }}>Cover URL (optional):</label>
                <input type="text" placeholder="http://..." value={newCoverUrl} onChange={e => setNewCoverUrl(e.target.value)} style={{ width: '100%', padding: '6px', background: '#282828', border: '1px solid #535353', borderRadius: 4, color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 12, color: '#b3b3b3' }}>Or upload an image:</label>
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ fontSize: 12, color: '#b3b3b3' }} />
              </div>
              <button onClick={handleCreate} style={{ background: '#1db954', border: 'none', color: '#000', fontWeight: 700, padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}>Create</button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTag === 'playlists' && allItems.map(pl => {
              const isLocal = pl.id === 'localFiles';
              const playing = isPlaying(pl.id);
              return (
                <div
                  key={pl.id}
                  className="playlist-item"
                  style={{ background: selectedPlaylistId === pl.id && currentView === (isLocal ? 'localFiles' : 'playlist') ? '#333' : 'transparent' }}
                  onClick={() => {
                    setCurrentView(isLocal ? 'localFiles' : 'playlist');
                    setSelectedPlaylistId(isLocal ? 'localFiles' : pl.id);
                  }}
                >
                  <div className="playlist-item-img" style={{
                    backgroundColor: pl.cover_url ? 'transparent' : pl.cover_color,
                    backgroundImage: pl.cover_url ? `url(${pl.cover_url})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center'
                  }}>
                    {isLocal ? <FaFolder size={24} color="#1db954" /> : (!pl.cover_url && '🎵')}
                  </div>
                  <div className="playlist-item-info">
                    <div className="playlist-item-name" style={{ color: playing ? '#1db954' : '#fff' }}>{pl.name}</div>
                    <div className="playlist-item-type">{isLocal ? 'Local Files' : 'Playlist'}</div>
                  </div>
                  {playing && <FaVolumeHigh className="playlist-item-playing-icon" />}
                </div>
              );
            })}
            {activeTag !== 'playlists' && (
              <div style={{ padding: 16, color: '#b3b3b3', textAlign: 'center', fontSize: 14 }}>
                {placeholderText[activeTag] || 'Coming soon'}
              </div>
            )}
          </div>
        </div>
      </div>

      <button className="scan-folder-btn" onClick={onScanRequest}>Scan Folder</button>
    </div>
  );
}