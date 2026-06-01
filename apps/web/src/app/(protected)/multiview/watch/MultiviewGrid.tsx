'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import VideoPlayer from '@/components/video-player';
import { getStreamUrl } from '@/lib/actions/multiview-stream';
import type { ChannelOption } from '@/lib/actions/multiview-stream';

interface ChannelPanel {
    tunerId: number;
    channelId: number;
    guideName: string;
    guideNumber: string;
    playlistUrl: string;
}

interface Props {
    initialPanels: ChannelPanel[];
    allChannels: ChannelOption[];
    layout: '2x1' | '2x2' | 'pip';
}

export default function MultiviewGrid({ initialPanels, allChannels, layout }: Props) {
    const [panels, setPanels] = useState<ChannelPanel[]>(initialPanels);
    const [activeIndex, setActiveIndex] = useState(0);
    const [pipSwapped, setPipSwapped] = useState(false);
    // pickerOpen: panel index that has the picker open, or null
    const [pickerOpen, setPickerOpen] = useState<number | null>(null);
    const [pickerSearch, setPickerSearch] = useState('');
    const [changingIndex, setChangingIndex] = useState<number | null>(null);

    const gridRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Sync audio/captions across all panels
    const syncAudio = useCallback(() => {
        if (!gridRef.current) return;
        const cells = gridRef.current.querySelectorAll<HTMLElement>('.mv-cell');
        cells.forEach((cell, i) => {
            const video = cell.querySelector('video');
            if (!video) return;
            const isActive = layout === 'pip'
                ? (pipSwapped ? i === 1 : i === 0)
                : i === activeIndex;
            video.muted = !isActive;
            for (let t = 0; t < video.textTracks.length; t++) {
                const track = video.textTracks[t];
                if (track.kind === 'captions' || track.kind === 'subtitles') {
                    track.mode = isActive ? 'disabled' : 'showing';
                }
            }
        });
    }, [activeIndex, pipSwapped, layout]);

    useEffect(() => {
        syncAudio();
        const interval = setInterval(syncAudio, 500);
        return () => clearInterval(interval);
    }, [syncAudio]);

    // Focus search input when picker opens
    useEffect(() => {
        if (pickerOpen !== null) {
            setPickerSearch('');
            setTimeout(() => searchRef.current?.focus(), 50);
        }
    }, [pickerOpen]);

    const handleCellClick = (index: number) => {
        if (pickerOpen !== null) return; // picker is open, ignore
        if (layout === 'pip') {
            setPipSwapped(prev => !prev);
        } else {
            setActiveIndex(index);
        }
    };

    const handleChangeChannel = async (panelIndex: number, ch: ChannelOption) => {
        setPickerOpen(null);
        setChangingIndex(panelIndex);
        try {
            const result = await getStreamUrl(ch.tunerId, ch.id);
            setPanels(prev => prev.map((p, i) => i === panelIndex ? {
                tunerId: ch.tunerId,
                channelId: ch.id,
                guideName: result.guideName,
                guideNumber: result.guideNumber,
                playlistUrl: result.playlistUrl,
            } : p));
        } catch (e) {
            console.error('Failed to change channel', e);
        } finally {
            setChangingIndex(null);
        }
    };

    // Filter channels for picker, excluding already-displayed channels
    const getPickerChannels = (panelIndex: number) => {
        const currentIds = new Set(panels.map((p, i) => i !== panelIndex ? `${p.tunerId}:${p.channelId}` : null).filter(Boolean));
        const q = pickerSearch.toLowerCase();
        return allChannels.filter(ch => {
            if (currentIds.has(`${ch.tunerId}:${ch.id}`)) return false;
            if (!q) return true;
            return ch.guideName.toLowerCase().includes(q) || ch.guideNumber.includes(q);
        });
    };

    const cols = 2;
    const rows = layout === '2x1' ? 1 : layout === 'pip' ? 1 : Math.ceil(panels.length / 2);

    if (layout === 'pip') {
        const mainIndex = pipSwapped ? 1 : 0;
        const pipIndex = pipSwapped ? 0 : 1;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
                <TopBar count={panels.length} extra={
                    <button onClick={() => setPipSwapped(p => !p)} style={topBarButtonStyle}>⇄ Swap</button>
                } />
                <div ref={gridRef} style={{ flex: 1, position: 'relative', backgroundColor: '#000' }}>
                    <ChannelCell
                        panel={panels[mainIndex]}
                        index={mainIndex}
                        isActive={true}
                        isChanging={changingIndex === mainIndex}
                        fillMode="absolute"
                        onActivate={() => handleCellClick(mainIndex)}
                        onOpenPicker={() => setPickerOpen(mainIndex)}
                    />
                    <div style={{
                        position: 'absolute', bottom: '1rem', right: '1rem',
                        width: '15%', aspectRatio: '16/9', zIndex: 20,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                        border: '2px solid rgba(255,255,255,0.25)',
                        borderRadius: '4px', overflow: 'hidden',
                    }}>
                        <ChannelCell
                            panel={panels[pipIndex]}
                            index={pipIndex}
                            isActive={false}
                            isChanging={changingIndex === pipIndex}
                            fillMode="absolute"
                            onActivate={() => handleCellClick(pipIndex)}
                            onOpenPicker={() => setPickerOpen(pipIndex)}
                            compact
                        />
                    </div>
                </div>
                {pickerOpen !== null && (
                    <ChannelPicker
                        channels={getPickerChannels(pickerOpen)}
                        searchRef={searchRef}
                        search={pickerSearch}
                        onSearch={setPickerSearch}
                        onSelect={ch => handleChangeChannel(pickerOpen, ch)}
                        onClose={() => setPickerOpen(null)}
                    />
                )}
                <GridStyles />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
            <TopBar count={panels.length} />
            <div
                ref={gridRef}
                style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    gap: '2px',
                    backgroundColor: '#111',
                    overflow: 'hidden',
                }}
            >
                {panels.map((panel, i) => (
                    <ChannelCell
                        key={`${panel.tunerId}-${panel.channelId}-${i}`}
                        panel={panel}
                        index={i}
                        isActive={i === activeIndex}
                        isChanging={changingIndex === i}
                        fillMode="relative"
                        onActivate={() => handleCellClick(i)}
                        onOpenPicker={() => setPickerOpen(i)}
                    />
                ))}
            </div>
            {pickerOpen !== null && (
                <ChannelPicker
                    channels={getPickerChannels(pickerOpen)}
                    searchRef={searchRef}
                    search={pickerSearch}
                    onSearch={setPickerSearch}
                    onSelect={ch => handleChangeChannel(pickerOpen, ch)}
                    onClose={() => setPickerOpen(null)}
                />
            )}
            <GridStyles />
        </div>
    );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({ count, extra }: { count: number; extra?: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.4rem 1rem', borderBottom: '1px solid var(--color-border)',
            flexShrink: 0, fontSize: '0.875rem',
        }}>
            <Link href="/multiview" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                ← Change channels
            </Link>
            <span style={{ color: 'var(--color-text-secondary)' }}>
                Watching {count} channels · click panel to activate audio · click channel name to change
            </span>
            {extra ?? <span />}
        </div>
    );
}

// ─── ChannelCell ──────────────────────────────────────────────────────────────

interface CellProps {
    panel: ChannelPanel;
    index: number;
    isActive: boolean;
    isChanging: boolean;
    fillMode: 'absolute' | 'relative';
    onActivate: () => void;
    onOpenPicker: () => void;
    compact?: boolean;
}

function ChannelCell({ panel, isActive, isChanging, fillMode, onActivate, onOpenPicker, compact }: CellProps) {
    const containerStyle = fillMode === 'absolute'
        ? { position: 'absolute' as const, inset: 0, backgroundColor: '#000', overflow: 'hidden' }
        : { position: 'relative' as const, backgroundColor: '#000', overflow: 'hidden' };

    return (
        <div style={containerStyle} onClick={onActivate}>
            {isActive && (
                <div style={{
                    position: 'absolute', inset: 0,
                    border: '2px solid var(--color-accent, #3b82f6)',
                    zIndex: 15, pointerEvents: 'none', borderRadius: '1px',
                }} />
            )}

            {/* Channel label — clicking opens the picker */}
            {!compact && (
                <div
                    onClick={e => { e.stopPropagation(); onOpenPicker(); }}
                    title="Click to change channel"
                    style={{
                        position: 'absolute', top: 0, left: 0, zIndex: 10,
                        padding: '0.25rem 0.5rem',
                        backgroundColor: isActive ? 'rgba(59,130,246,0.75)' : 'rgba(0,0,0,0.65)',
                        color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                        borderBottomRightRadius: '4px',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    <span>{isActive ? '🔊' : '🔇'}</span>
                    <span>{panel.guideNumber} {panel.guideName}</span>
                    <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>▼</span>
                </div>
            )}

            {isChanging && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 20,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '0.875rem',
                }}>
                    Loading…
                </div>
            )}

            <div className="mv-cell" style={{ position: 'absolute', inset: 0 }}>
                <VideoPlayer
                    playlistUrl={panel.playlistUrl}
                    channelName={panel.guideName}
                    autoplay={true}
                />
            </div>
        </div>
    );
}

// ─── ChannelPicker overlay ────────────────────────────────────────────────────

interface PickerProps {
    channels: ChannelOption[];
    search: string;
    searchRef: React.RefObject<HTMLInputElement | null>;
    onSearch: (q: string) => void;
    onSelect: (ch: ChannelOption) => void;
    onClose: () => void;
}

function ChannelPicker({ channels, search, searchRef, onSearch, onSelect, onClose }: PickerProps) {
    const favorites = channels.filter(c => c.isFavorite);
    const rest = channels.filter(c => !c.isFavorite);

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                }}
            />
            {/* Panel */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%', zIndex: 101,
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 8px)',
                width: 'min(480px, 90vw)',
                maxHeight: '70vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)',
                    flexShrink: 0,
                }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Change Channel</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--color-text-secondary)' }}>✕</button>
                </div>

                {/* Search */}
                <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search channels…"
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '0.4rem 0.6rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm, 4px)',
                            backgroundColor: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '0.875rem', boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* Channel list */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {channels.length === 0 && (
                        <div style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
                            No channels found
                        </div>
                    )}
                    {favorites.length > 0 && (
                        <PickerGroup label="⭐ Favorites" channels={favorites} onSelect={onSelect} />
                    )}
                    {rest.length > 0 && (
                        <PickerGroup label={favorites.length > 0 ? "All Channels" : undefined} channels={rest} onSelect={onSelect} />
                    )}
                </div>
            </div>
        </>
    );
}

function PickerGroup({ label, channels, onSelect }: { label?: string; channels: ChannelOption[]; onSelect: (ch: ChannelOption) => void }) {
    return (
        <div>
            {label && (
                <div style={{
                    padding: '0.4rem 1rem 0.2rem',
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
                }}>
                    {label}
                </div>
            )}
            {channels.map(ch => (
                <button
                    key={`${ch.tunerId}-${ch.id}`}
                    onClick={() => onSelect(ch)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        width: '100%', padding: '0.5rem 1rem',
                        background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                        borderBottom: '1px solid var(--color-border)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                    <span style={{ minWidth: '2.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                        {ch.guideNumber}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ch.guideName}
                    </span>
                    {ch.hd === 1 && (
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 600,
                            padding: '0.1rem 0.35rem',
                            backgroundColor: 'var(--color-info-bg)',
                            color: 'var(--color-info)', borderRadius: '3px',
                        }}>HD</span>
                    )}
                </button>
            ))}
        </div>
    );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const topBarButtonStyle: React.CSSProperties = {
    fontSize: '0.875rem', padding: '0.25rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md, 6px)',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)', cursor: 'pointer',
};

function GridStyles() {
    return (
        <style>{`
            .mv-cell > div {
                position: absolute !important;
                inset: 0 !important;
                max-width: none !important;
                aspect-ratio: unset !important;
                margin: 0 !important;
                width: 100% !important;
                height: 100% !important;
            }
            .mv-cell > div video {
                object-fit: contain;
            }
        `}</style>
    );
}
