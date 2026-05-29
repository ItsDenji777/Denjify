import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaMusic, FaXmark, FaCircleExclamation } from 'react-icons/fa6';
import { fetchLyrics } from '../services/lyrics.js';

function getCoverUrl(track) {
  return track?.cover_art_url ? `/api${track.cover_art_url}` : '';
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function rgbString(rgb) {
  return `${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}`;
}

function scaleRgb(rgb, factor) {
  return rgb.map((value) => clamp(value * factor, 0, 255));
}

function averageColorFromImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  canvas.width = 16;
  canvas.height = 16;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.1) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }

  if (!count) return null;
  return [r / count, g / count, b / count];
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isInstrumentalMarker(text) {
  const t = normalizeText(text);
  if (!t) return true;
  return /^(\(\s*\)|\(\s*\.\.\.\s*\))$/.test(t);
}

function parseTimestampToSeconds(minutePart, secondPart, fractionPart) {
  const minutes = Number(minutePart || 0);
  const seconds = Number(secondPart || 0);
  const fraction = Number(`0.${String(fractionPart || '0').padEnd(3, '0').slice(0, 3)}`);
  return minutes * 60 + seconds + fraction;
}

function parseSyncedLyrics(value) {
  if (typeof value !== 'string') return [];

  const lines = value.split(/\r?\n/);
  const output = [];
  const timeTagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const timestamps = [];
    let match;

    while ((match = timeTagRegex.exec(line)) !== null) {
      timestamps.push(parseTimestampToSeconds(match[1], match[2], match[3]));
    }

    if (!timestamps.length) continue;

    const text = line.replace(timeTagRegex, '').trim();

    for (const time of timestamps) {
      output.push({
        time,
        text,
      });
    }
  }

  output.sort((a, b) => a.time - b.time);
  return output;
}

function parsePlainLyrics(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function normalizeLyricsPayload(payload) {
  if (!payload) {
    return {
      found: false,
      synced: [],
      plainBlocks: [],
      plainLyrics: '',
    };
  }

  const rawSynced =
    payload.synced ||
    payload.syncedLines ||
    payload.syncedLyrics ||
    payload.lyrics?.syncedLyrics ||
    '';

  const rawPlain =
    payload.plainLyrics ||
    payload.lyrics?.plainLyrics ||
    payload.text ||
    '';

  const synced = Array.isArray(rawSynced)
    ? rawSynced
        .map((item) => ({
          time: Number(item?.time ?? 0),
          text: normalizeText(item?.text ?? ''),
        }))
        .filter((item) => Number.isFinite(item.time))
        .sort((a, b) => a.time - b.time)
    : parseSyncedLyrics(rawSynced);

  const plainBlocks = Array.isArray(payload.plainBlocks)
    ? payload.plainBlocks.map((block) => normalizeText(block)).filter(Boolean)
    : parsePlainLyrics(rawPlain);

  const found =
    payload.found ?? Boolean(synced.length || plainBlocks.length || normalizeText(rawPlain));

  return {
    found,
    synced,
    plainBlocks,
    plainLyrics: normalizeText(rawPlain),
  };
}

function calcGapFill(progress, startTime, endTime) {
  const span = Math.max(endTime - startTime, 0.35);
  return clamp((progress - startTime) / span, 0, 1);
}

export default function LyricsScreen({
  currentTrack,
  progress = 0,
  playing = false,
  isOpen = false,
  onClose,
}) {
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualScroll, setManualScroll] = useState(false);
  const [bgColors, setBgColors] = useState({
    base: '22, 22, 22',
    mid: '16, 16, 16',
    dark: '10, 10, 10',
    deep: '4, 4, 4',
  });

  const scrollRef = useRef(null);
  const lineRefs = useRef([]);
  const scrollTimerRef = useRef(null);
  const abortRef = useRef(null);
  const scrollAnimRef = useRef(0);
  const programmaticScrollRef = useRef(false);

  const coverUrl = getCoverUrl(currentTrack);

  const stopScrollAnimation = () => {
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = 0;
    }
    programmaticScrollRef.current = false;
  };

  const handleManualScroll = () => {
    if (programmaticScrollRef.current) return;

    setManualScroll(true);

    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      setManualScroll(false);
      scrollTimerRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    if (!coverUrl) {
      setBgColors({
        base: '22, 22, 22',
        mid: '16, 16, 16',
        dark: '10, 10, 10',
        deep: '4, 4, 4',
      });
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = coverUrl;

    img.onload = () => {
      if (cancelled) return;

      try {
        const avg = averageColorFromImage(img);
        if (!avg) return;

        const base = avg;
        const mid = scaleRgb(avg, 0.72);
        const dark = scaleRgb(avg, 0.45);
        const deep = scaleRgb(avg, 0.22);

        setBgColors({
          base: rgbString(base),
          mid: rgbString(mid),
          dark: rgbString(dark),
          deep: rgbString(deep),
        });
      } catch {
        // keep fallback
      }
    };

    img.onerror = () => {
      if (cancelled) return;

      setBgColors({
        base: '22, 22, 22',
        mid: '16, 16, 16',
        dark: '10, 10, 10',
        deep: '4, 4, 4',
      });
    };

    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  useEffect(() => {
    if (!currentTrack) {
      setLyrics(null);
      setLoading(false);
      setError('');
      stopScrollAnimation();
      return;
    }

    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    setManualScroll(false);
    stopScrollAnimation();

    fetchLyrics(currentTrack, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setLyrics(normalizeLyricsPayload(data));
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLyrics(null);
        setLoading(false);
        setError(err?.message || 'Failed to load lyrics.');
      });

    return () => controller.abort();
  }, [currentTrack?.id]);

  useEffect(() => {
    lineRefs.current = [];
  }, [currentTrack?.id]);

  const syncedLines = lyrics?.synced || [];
  const plainBlocks = lyrics?.plainBlocks || [];
  const hasSynced = syncedLines.length > 0;
  const hasPlain = plainBlocks.length > 0;
  const hasAnyLyrics =
    !!lyrics?.found &&
    (hasSynced || hasPlain || (lyrics?.plainLyrics || '').trim().length > 0);

  const activeIndex = useMemo(() => {
    if (!hasSynced) return -1;

    let idx = -1;
    for (let i = 0; i < syncedLines.length; i += 1) {
      if (progress >= syncedLines[i].time) idx = i;
      else break;
    }
    return idx;
  }, [hasSynced, syncedLines, progress]);

  useLayoutEffect(() => {
    if (!isOpen || !hasSynced || activeIndex < 0 || manualScroll) return;

    const panel = scrollRef.current;
    const activeEl = lineRefs.current[activeIndex];

    if (!panel || !activeEl) return;

    const panelRect = panel.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    const targetScroll =
      panel.scrollTop +
      (activeRect.top - panelRect.top) -
      panel.clientHeight / 2 +
      activeRect.height / 2;

    const maxScroll = Math.max(
      0,
      panel.scrollHeight - panel.clientHeight
    );

    const target = clamp(targetScroll, 0, maxScroll);

    stopScrollAnimation();
    programmaticScrollRef.current = true;

    const start = panel.scrollTop;
    const distance = target - start;

    if (Math.abs(distance) < 0.5) {
      panel.scrollTop = target;
      programmaticScrollRef.current = false;
      return;
    }

    const duration = 520;
    const startTime = performance.now();

    // ultra smooth spotify-like easing
    const ease = (t) => {
      return 1 - Math.pow(1 - t, 4);
    };

    const animate = (now) => {
      const elapsed = now - startTime;

      const progress = clamp(elapsed / duration, 0, 1);

      const eased = ease(progress);

      panel.scrollTop = start + distance * eased;

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(animate);
      } else {
        panel.scrollTop = target;
        scrollAnimRef.current = 0;
        programmaticScrollRef.current = false;
      }
    };

    scrollAnimRef.current = requestAnimationFrame(animate);

    return () => stopScrollAnimation();
  }, [
    activeIndex,
    hasSynced,
    manualScroll,
    isOpen,
    currentTrack?.id,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      stopScrollAnimation();
      abortRef.current?.abort?.();
    };
  }, []);

  if (!currentTrack || typeof document === 'undefined') return null;

  const screen = (
    <section
      className={`lyrics-screen${isOpen ? ' is-open' : ''}`}
      style={{
        '--lyrics-cover-rgb': bgColors.base,
        '--lyrics-cover-rgb-2': bgColors.mid,
        '--lyrics-cover-rgb-3': bgColors.dark,
        '--lyrics-cover-rgb-4': bgColors.deep,
      }}
      aria-hidden={!isOpen}
    >
      <div
        className="lyrics-screen__bg"
        style={{
          backgroundImage: coverUrl ? `url(${coverUrl})` : 'none',
        }}
      />
      <div className="lyrics-screen__overlay" />

      <div className="lyrics-screen__content">
        <div
          className="lyrics-screen__panel"
          ref={scrollRef}
          onScroll={handleManualScroll}
        >
          {loading ? (
            <div className="lyrics-screen__state">
              <div className="lyrics-screen__spinner" />
              <div>Loading lyrics…</div>
            </div>
          ) : error ? (
            <div className="lyrics-screen__state lyrics-screen__state--error">
              <FaCircleExclamation size={30} />
              <div>{error}</div>
            </div>
          ) : !hasAnyLyrics ? (
            <div className="lyrics-screen__state">
              <FaMusic size={32} />
              <div>No lyrics available</div>
            </div>
          ) : hasSynced ? (
            <div className="lyrics-screen__lines">
              {syncedLines.map((line, idx) => {
                const text = normalizeText(line.text);
                const isGap = isInstrumentalMarker(text);
                const isActive = idx === activeIndex;
                const isPast = activeIndex >= 0 && idx < activeIndex;
                const isFuture = activeIndex >= 0 && idx > activeIndex;

                const nextTime =
                  syncedLines[idx + 1]?.time ??
                  (currentTrack?.duration_seconds || line.time + 3);

                const gapFill = isGap
                  ? calcGapFill(progress, line.time, nextTime)
                  : 0;

                const classes = [
                  'lyrics-line',
                  isGap ? 'is-gap' : '',
                  isActive ? 'is-active' : '',
                  isPast ? 'is-past' : '',
                  isFuture ? 'is-future' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={`${line.time}-${idx}`}
                    ref={(node) => {
                      lineRefs.current[idx] = node;
                    }}
                    className={classes}
                  >
                    {isGap ? (
                      <span
                        className={`lyrics-gap ${isActive ? 'is-active' : ''}`}
                        aria-label="Instrumental"
                      >
                        {[0, 1, 2].map((dotIndex) => {
                          const segment = 1 / 3;
                          const start = dotIndex * segment;

                          const dotFill = clamp(
                            (gapFill - start) / segment,
                            0,
                            1
                          );

                          return (
                            <span
                              key={dotIndex}
                              className="lyrics-gap__dot"
                              style={{
                                '--dot-fill': dotFill.toFixed(3),
                              }}
                            />
                          );
                        })}
                      </span>
                    ) : (
                      text || '\u00A0'
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="lyrics-screen__plain">
              {plainBlocks.map((block, idx) => (
                <p key={idx}>{block}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return createPortal(screen, document.body);
}