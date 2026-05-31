'use client';

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
    layout: '2x1' | '2x2';
}

export default function MultiviewGrid({ panels, layout }: Props) {
    const count = panels.length;
    const cols = 2;
    const rows = layout === '2x1' ? 1 : Math.ceil(count / 2);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 60px)',
            overflow: 'hidden',
        }}>
            {/* Minimal top bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.4rem 1rem',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
                fontSize: '0.875rem',
            }}>
                <Link href="/multiview" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                    ← Change channels
                </Link>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                    Watching {count} channels
                </span>
            </div>

            {/* Video grid */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: '2px',
                backgroundColor: '#111',
                overflow: 'hidden',
            }}>
                {panels.map(panel => (
                    <div
                        key={`${panel.tunerId}-${panel.channelId}`}
                        style={{
                            position: 'relative',
                            backgroundColor: '#000',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Channel label */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zIndex: 10,
                            padding: '0.25rem 0.5rem',
                            backgroundColor: 'rgba(0,0,0,0.65)',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderBottomRightRadius: '4px',
                            pointerEvents: 'none',
                        }}>
                            {panel.guideNumber} {panel.guideName}
                        </div>

                        {/*
                         * VideoPlayer's CSS module forces max-width:1280px and aspect-ratio:16/9.
                         * We break those by absolutely positioning the player to fill this cell,
                         * then targeting its immediate child div with a global style override.
                         */}
                        <div className="mv-cell" style={{ position: 'absolute', inset: 0 }}>
                            <VideoPlayer
                                playlistUrl={panel.playlistUrl}
                                channelName={panel.guideName}
                                autoplay={true}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/*
             * Global style override for VideoPlayer CSS module inside multiview cells.
             * CSS Modules mangle the class name so we can't target it directly.
             * Instead we target the first child div of .mv-cell which is the videoContainer.
             */}
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
        </div>
    );
}
