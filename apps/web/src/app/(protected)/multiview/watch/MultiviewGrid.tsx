'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import VideoPlayer from '@/components/video-player';

interface ChannelPanel {
    tunerId: number;
    channelId: number;
    guideName: string;
    guideNumber: string;
    playlistUrl: string;
}

interface Props {
    panels: ChannelPanel[];
    layout: '2x1' | '2x2' | 'pip';
}

export default function MultiviewGrid({ panels, layout }: Props) {
    const count = panels.length;
    // First panel is active by default
    const [activeIndex, setActiveIndex] = useState(0);
    // For PiP layout: track which panel is "main" vs "pip"
    const [pipSwapped, setPipSwapped] = useState(false);

    const gridRef = useRef<HTMLDivElement>(null);

    // After each render, sync mute state and captions on all video elements
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

            // Attempt to enable/disable captions
            for (let t = 0; t < video.textTracks.length; t++) {
                const track = video.textTracks[t];
                if (track.kind === 'captions' || track.kind === 'subtitles') {
                    track.mode = isActive ? 'disabled' : 'showing';
                }
            }
        });
    }, [activeIndex, pipSwapped, layout]);

    // Run sync whenever active index or layout changes,
    // and also on a short polling interval to catch videos that load after render
    useEffect(() => {
        syncAudio();
        const interval = setInterval(syncAudio, 500);
        return () => clearInterval(interval);
    }, [syncAudio]);

    const handleCellClick = (index: number) => {
        if (layout === 'pip') {
            setPipSwapped(prev => !prev);
        } else {
            setActiveIndex(index);
        }
    };

    const cols = 2;
    const rows = layout === '2x1' ? 1 : layout === 'pip' ? 1 : Math.ceil(count / 2);

    if (layout === 'pip') {
        const mainIndex = pipSwapped ? 1 : 0;
        const pipIndex = pipSwapped ? 0 : 1;
        const mainPanel = panels[mainIndex];
        const pipPanel = panels[pipIndex];

        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 60px)',
                overflow: 'hidden',
            }}>
                <TopBar count={count} onBack="/multiview" extra={
                    <button
                        onClick={() => setPipSwapped(p => !p)}
                        style={topBarButtonStyle}
                        title="Swap main and PiP channels"
                    >
                        ⇄ Swap
                    </button>
                } />

                {/* Main panel fills everything */}
                <div ref={gridRef} style={{ flex: 1, position: 'relative', backgroundColor: '#000' }}>
                    <ChannelCell
                        panel={mainPanel}
                        index={mainIndex}
                        isActive={true}
                        onClick={() => handleCellClick(mainIndex)}
                        fillMode="absolute"
                    />

                    {/* PiP panel: bottom-right, ~15% width */}
                    <div style={{
                        position: 'absolute',
                        bottom: '1rem',
                        right: '1rem',
                        width: '15%',
                        aspectRatio: '16/9',
                        zIndex: 20,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                        border: '2px solid rgba(255,255,255,0.25)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                    }}
                        onClick={() => handleCellClick(pipIndex)}
                        title="Click to swap"
                    >
                        <ChannelCell
                            panel={pipPanel}
                            index={pipIndex}
                            isActive={false}
                            onClick={() => handleCellClick(pipIndex)}
                            fillMode="absolute"
                        />
                    </div>
                </div>

                <GridStyles />
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 60px)',
            overflow: 'hidden',
        }}>
            <TopBar count={count} onBack="/multiview" />

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
                        key={`${panel.tunerId}-${panel.channelId}`}
                        panel={panel}
                        index={i}
                        isActive={i === activeIndex}
                        onClick={() => handleCellClick(i)}
                        fillMode="relative"
                    />
                ))}
            </div>

            <GridStyles />
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TopBar({ count, onBack, extra }: { count: number; onBack: string; extra?: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
            fontSize: '0.875rem',
        }}>
            <Link href={onBack} style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                ← Change channels
            </Link>
            <span style={{ color: 'var(--color-text-secondary)' }}>
                Watching {count} channels · click a panel to activate audio
            </span>
            {extra ?? <span />}
        </div>
    );
}

interface CellProps {
    panel: ChannelPanel;
    index: number;
    isActive: boolean;
    onClick: () => void;
    fillMode: 'absolute' | 'relative';
}

function ChannelCell({ panel, isActive, onClick, fillMode }: CellProps) {
    const containerStyle = fillMode === 'absolute'
        ? { position: 'absolute' as const, inset: 0, backgroundColor: '#000', overflow: 'hidden' }
        : { position: 'relative' as const, backgroundColor: '#000', overflow: 'hidden' };

    return (
        <div style={containerStyle} onClick={onClick}>
            {/* Active indicator border */}
            {isActive && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px solid var(--color-accent, #3b82f6)',
                    zIndex: 15,
                    pointerEvents: 'none',
                    borderRadius: '1px',
                }} />
            )}

            {/* Channel label */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 10,
                padding: '0.25rem 0.5rem',
                backgroundColor: isActive ? 'rgba(59,130,246,0.75)' : 'rgba(0,0,0,0.65)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderBottomRightRadius: '4px',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
            }}>
                {isActive && <span title="Audio active">🔊</span>}
                {!isActive && <span title="Muted">🔇</span>}
                {panel.guideNumber} {panel.guideName}
            </div>

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

const topBarButtonStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    padding: '0.25rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md, 6px)',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
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
