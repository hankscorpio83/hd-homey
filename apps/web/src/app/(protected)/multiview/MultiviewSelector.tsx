'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components';

interface ChannelOption {
    id: number;
    tunerId: number;
    tunerName: string;
    guideNumber: string;
    guideName: string;
    hd: number;
}

interface Props {
    channels: ChannelOption[];
    maxSessions: number;
}

const MAX_PANELS = 4;

export default function MultiviewSelector({ channels, maxSessions }: Props) {
    const router = useRouter();
    const [selected, setSelected] = useState<ChannelOption[]>([]);
    const [layout, setLayout] = useState<'2x1' | '2x2' | 'pip'>('2x2');

    const pipLimit = layout === 'pip' ? 2 : MAX_PANELS;
    const limit = Math.min(pipLimit, maxSessions);

    const handleLayoutChange = (l: '2x1' | '2x2' | 'pip') => {
        setLayout(l);
        if (l === 'pip') setSelected(prev => prev.slice(0, 2));
    };

    const toggle = (ch: ChannelOption) => {
        setSelected(prev => {
            const exists = prev.find(s => s.id === ch.id && s.tunerId === ch.tunerId);
            if (exists) {
                return prev.filter(s => !(s.id === ch.id && s.tunerId === ch.tunerId));
            }
            if (prev.length >= limit) return prev;
            return [...prev, ch];
        });
    };

    const isSelected = (ch: ChannelOption) =>
        selected.some(s => s.id === ch.id && s.tunerId === ch.tunerId);

    const handleWatch = () => {
        if (selected.length < 2) return;
        const params = selected
            .map(ch => `${ch.tunerId}:${ch.id}`)
            .join(',');
        router.push(`/multiview/watch?channels=${params}&layout=${layout}`);
    };

    // Group channels by tuner for display
    const byTuner = channels.reduce<Record<string, { tunerName: string; channels: ChannelOption[] }>>(
        (acc, ch) => {
            const key = String(ch.tunerId);
            if (!acc[key]) acc[key] = { tunerName: ch.tunerName, channels: [] };
            acc[key].channels.push(ch);
            return acc;
        },
        {}
    );

    return (
        <div>
            {/* Selection controls */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
                marginBottom: '1.5rem',
                padding: '1rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-secondary)',
            }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <strong>{selected.length}</strong> of <strong>{limit}</strong> channels selected
                    {selected.length > 0 && (
                        <span style={{ marginLeft: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            {selected.map(s => `${s.guideNumber} ${s.guideName}`).join(' · ')}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Layout:</label>
                    <select
                        value={layout}
                        onChange={e => handleLayoutChange(e.target.value as '2x1' | '2x2' | 'pip')}
                        style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                    >
                        <option value="2x1">2 panels (side by side)</option>
                        <option value="2x2">4 panels (2×2 grid)</option>
                        <option value="pip">Picture-in-picture (2 channels)</option>
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                        onClick={() => setSelected([])}
                        disabled={selected.length === 0}
                    >
                        Clear
                    </Button>
                    <Button
                        onClick={handleWatch}
                        disabled={selected.length < 2}
                    >
                        ▶ Watch ({selected.length})
                    </Button>
                </div>
            </div>

            {/* Channel list per tuner */}
            {Object.entries(byTuner).map(([tunerId, { tunerName, channels: chs }]) => (
                <div key={tunerId} style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
                        📡 {tunerName}
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '0.5rem',
                    }}>
                        {chs.map(ch => {
                            const sel = isSelected(ch);
                            const atLimit = selected.length >= limit && !sel;
                            return (
                                <button
                                    key={`${ch.tunerId}-${ch.id}`}
                                    onClick={() => toggle(ch)}
                                    disabled={atLimit}
                                    aria-pressed={sel}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.625rem 0.875rem',
                                        border: sel
                                            ? '2px solid var(--color-accent)'
                                            : '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: sel
                                            ? 'var(--color-accent-bg, color-mix(in srgb, var(--color-accent) 12%, transparent))'
                                            : 'var(--color-bg-primary)',
                                        cursor: atLimit ? 'not-allowed' : 'pointer',
                                        opacity: atLimit ? 0.45 : 1,
                                        textAlign: 'left',
                                        width: '100%',
                                        transition: 'border-color 0.15s, background-color 0.15s',
                                    }}
                                >
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        minWidth: '2.5rem',
                                        color: sel ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                    }}>
                                        {ch.guideNumber}
                                    </span>
                                    <span style={{
                                        flex: 1,
                                        fontSize: '0.875rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        color: 'var(--color-text-primary)',
                                    }}>
                                        {ch.guideName}
                                    </span>
                                    {ch.hd === 1 && (
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            padding: '0.1rem 0.35rem',
                                            backgroundColor: 'var(--color-info-bg)',
                                            color: 'var(--color-info)',
                                            borderRadius: '3px',
                                        }}>
                                            HD
                                        </span>
                                    )}
                                    {sel && (
                                        <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
