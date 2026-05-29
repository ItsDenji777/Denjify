import React, { useRef, useEffect, useState } from 'react';
import {
  FaPlay,
  FaPause,
  FaBackwardStep,
  FaForwardStep,
  FaShuffle,
  FaRepeat,
  FaVolumeHigh,
  FaUpRightAndDownLeftFromCenter,
  FaDownLeftAndUpRightToCenter,
} from 'react-icons/fa6';

export default function NowPlayingBar({
  currentTrack,
  playing,
  togglePlay,
  onNext,
  onPrev,
  progress,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  shuffle,
  onShuffleToggle,
  repeat,
  onRepeatToggle,
  loading,
  lyricsOpen,
  onLyricsToggle,
}) {
  const firstSpanRef = useRef(null);
  const scrollerRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const rafRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const initialDelayRef = useRef(null);
  const positionRef = useRef(0);
  const speedRef = useRef(40);
  const gapPxRef = useRef(0);

  useEffect(() => {
    if (containerRef.current && currentTrack) {
      const container = containerRef.current;
      const el = firstSpanRef.current;
      if (el && el.scrollWidth > container.clientWidth) {
        setShouldScroll(true);
      } else {
        setShouldScroll(false);
        setIsScrolling(false);
        positionRef.current = 0;
        if (scrollerRef.current) {
          scrollerRef.current.style.transform = 'translateX(0)';
        }
      }
    } else {
      setShouldScroll(false);
      setIsScrolling(false);
      positionRef.current = 0;
      if (scrollerRef.current) {
        scrollerRef.current.style.transform = 'translateX(0)';
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!shouldScroll || !firstSpanRef.current || !scrollerRef.current || !containerRef.current) return;

    if (gapPxRef.current === 0) {
      const remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const gapRem = parseFloat(getComputedStyle(scrollerRef.current).getPropertyValue('--gap'));
      gapPxRef.current = gapRem * remToPx;
    }

    const firstWidth = firstSpanRef.current.offsetWidth;
    const gap = gapPxRef.current;
    const cycleWidth = firstWidth + gap;

    let lastTime = performance.now();
    let currentPos = positionRef.current;

    const animate = (now) => {
      if (pauseTimerRef.current || initialDelayRef.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const dt = now - lastTime;
      lastTime = now;
      currentPos -= (speedRef.current * dt) / 1000;

      if (currentPos <= -cycleWidth) {
        currentPos = 0;
        setIsScrolling(false);
        pauseTimerRef.current = setTimeout(() => {
          pauseTimerRef.current = null;
          setIsScrolling(true);
          lastTime = performance.now();
        }, 3000);
      }

      positionRef.current = currentPos;
      if (scrollerRef.current) {
        scrollerRef.current.style.transform = `translateX(${currentPos}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    setIsScrolling(false);
    positionRef.current = 0;
    if (scrollerRef.current) {
      scrollerRef.current.style.transform = 'translateX(0)';
    }

    initialDelayRef.current = setTimeout(() => {
      initialDelayRef.current = null;
      setIsScrolling(true);
      lastTime = performance.now();
      rafRef.current = requestAnimationFrame(animate);
    }, 2000);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      if (initialDelayRef.current) clearTimeout(initialDelayRef.current);
      setIsScrolling(false);
    };
  }, [shouldScroll, currentTrack]);

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  const titleText = currentTrack?.title || 'Unknown';

  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      );
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  return (
    <div className="now-playing-bar">
      <div className="player-left">
        {currentTrack ? (
          <>
            <div className="player-cover">
              {currentTrack.cover_art_url ? (
                <img
                  src={`/api${currentTrack.cover_art_url}`}
                  alt=""
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = '<span style="font-size:24px">🎵</span>';
                  }}
                />
              ) : (
                <span style={{ fontSize: 24 }}>🎵</span>
              )}
            </div>
            <div className="player-track-info">
              <div
                className={`player-track-title-container ${shouldScroll ? 'scrollable' : ''} ${isScrolling ? 'scrolling' : ''}`}
                ref={containerRef}
              >
                <div className="marquee-scroller" ref={scrollerRef}>
                  <span ref={firstSpanRef} className="player-track-title">
                    {titleText}
                  </span>
                  {shouldScroll && (
                    <span className="player-track-title second-copy">
                      {titleText}
                    </span>
                  )}
                </div>
              </div>
              <div className="player-track-artist">{currentTrack.artist || 'Unknown artist'}</div>
            </div>
          </>
        ) : (
          <div style={{ color: '#b3b3b3', fontSize: 14 }}>No track selected</div>
        )}
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button className={`control-btn ${shuffle ? 'active' : ''}`} onClick={onShuffleToggle} title="Shuffle">
            <FaShuffle size={18} color={shuffle ? '#1db954' : '#b3b3b3'} />
            <div className="green-dot" />
          </button>
          <button className="control-btn" onClick={onPrev} title="Previous">
            <FaBackwardStep size={18} />
          </button>
          <button className="play-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? <FaPause size={22} color="#000" /> : <FaPlay size={22} color="#000" />}
          </button>
          <button className="control-btn" onClick={onNext} title="Next">
            <FaForwardStep size={18} />
          </button>
          <button
            className={`control-btn ${repeat !== 'off' ? 'active' : ''}`}
            onClick={onRepeatToggle}
            title="Repeat"
            style={{ position: 'relative' }}
          >
            <FaRepeat size={18} color={repeat !== 'off' ? '#1db954' : '#b3b3b3'} />
            <div className="green-dot" />
            {repeat === 'one' && (
              <span
                style={{
                  position: 'absolute', top: -4, right: -6, fontSize: 10, fontWeight: 700,
                  color: '#1db954', background: '#181818', borderRadius: '50%',
                  width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >1</span>
            )}
          </button>
        </div>

        <div className="progress-container">
          <span className="time-display">{formatTime(progress)}</span>
          <div className="progress-bar" onClick={handleProgressClick}>
            <div className="progress-bar-filled" style={{ width: `${(progress / duration) * 100 || 0}%`, background: '#fff' }}></div>
          </div>
          <span className="time-display">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
      <button
        className={`control-btn lyrics-btn ${lyricsOpen ? 'active' : ''}`}
        onClick={onLyricsToggle}
        title={lyricsOpen ? 'Close lyrics' : 'Open lyrics'}
        aria-label={lyricsOpen ? 'Close lyrics' : 'Open lyrics'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M13.426 2.574a2.831 2.831 0 0 0-4.797 1.55l3.247 3.247a2.831 2.831 0 0 0 1.55-4.797M10.5 8.118l-2.619-2.62L4.74 9.075 2.065 12.12a1.287 1.287 0 0 0 1.816 1.816l3.06-2.688 3.56-3.129zM7.12 4.094a4.331 4.331 0 1 1 4.786 4.786l-3.974 3.493-3.06 2.689a2.787 2.787 0 0 1-3.933-3.933l2.676-3.045z" />
        </svg>

        {lyricsOpen && <span className="green-dot"></span>}
      </button>
        
        <FaVolumeHigh size={16} color="#b3b3b3" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="volume-slider"
          style={{
            '--volume-percent': `${volume * 100}%`
          }}
        />
        <button
          className="control-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? (
            <FaDownLeftAndUpRightToCenter size={16} />
          ) : (
            <FaUpRightAndDownLeftFromCenter size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
