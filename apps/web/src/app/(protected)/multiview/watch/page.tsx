import { and, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDb } from '@/lib/database/db';
import { channels, tuners } from '@/lib/database/schema';
import { generateStreamToken } from '@/lib/stream-token';
import { getTranscodingSettings } from '@/lib/settings';
import MultiviewGrid from './MultiviewGrid';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ channels?: string; layout?: string }>;
}

interface ChannelPanel {
    tunerId: number;
    channelId: number;
    guideName: string;
    guideNumber: string;
    playlistUrl: string;
}

export default async function MultiviewWatchPage({ searchParams }: PageProps) {
    const { channels: channelsParam, layout = '2x2' } = await searchParams;

    if (!channelsParam) {
        return (
            <div style={{ padding: '2rem' }}>
                <p>No channels selected. <Link href="/multiview">← Back to channel selection</Link></p>
            </div>
        );
    }

    const settings = await getTranscodingSettings();
    if (!settings.enabled) {
        return (
            <div style={{ padding: '2rem' }}>
                <p>Transcoding is not enabled. <Link href="/settings">Go to Settings</Link></p>
            </div>
        );
    }

    // Parse channel pairs: "tunerId:channelId,tunerId:channelId,..."
    const pairs = channelsParam
        .split(',')
        .slice(0, 4)
        .map(p => {
            const [t, c] = p.split(':').map(Number);
            return { tunerId: t, channelId: c };
        })
        .filter(p => !isNaN(p.tunerId) && !isNaN(p.channelId));

    if (pairs.length < 2) {
        return (
            <div style={{ padding: '2rem' }}>
                <p>Please select at least 2 channels. <Link href="/multiview">← Back</Link></p>
            </div>
        );
    }

    const db = await getDb();

    // Fetch and validate each channel, then generate tokens
    const panels: ChannelPanel[] = [];

    for (const { tunerId, channelId } of pairs) {
        const channel = await db.query.channels.findFirst({
            where: and(
                eq(channels.id, channelId),
                eq(channels.fk_tuner, tunerId),
                isNull(channels.deleted_at),
                eq(channels.is_active, true)
            ),
            with: { tuners: true },
        });

        if (!channel || !channel.tuners?.is_active) continue;

        const token = await generateStreamToken(tunerId, channelId);
        const playlistUrl = `/api/transcode/${tunerId}/${channelId}/playlist.m3u8?token=${token}`;

        panels.push({
            tunerId,
            channelId,
            guideName: channel.guideName,
            guideNumber: channel.guideNumber,
            playlistUrl,
        });
    }

    if (panels.length < 2) {
        notFound();
    }

    const gridLayout = layout === '2x1' ? '2x1' : '2x2';

    return (
        <MultiviewGrid panels={panels} layout={gridLayout} />
    );
}
