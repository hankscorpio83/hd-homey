import { and, asc, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { getDb } from '@/lib/database/db';
import { channels, tuners, userChannelPreferences } from '@/lib/database/schema';
import { generateStreamToken } from '@/lib/stream-token';
import { getTranscodingSettings } from '@/lib/settings';
import { auth } from '@/lib/auth/auth';
import type { Session } from '@/lib/auth/types';
import MultiviewGrid from './MultiviewGrid';
import type { ChannelOption } from '@/lib/actions/multiview-stream';

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

    const rawSession = await auth.api.getSession({ headers: await headers() });
    const session = rawSession as unknown as Session | null;
    if (!session?.user) notFound();
    const userId = session.user.id;

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

    // Build the initial panels
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
        panels.push({
            tunerId,
            channelId,
            guideName: channel.guideName,
            guideNumber: channel.guideNumber,
            playlistUrl: `/api/transcode/${tunerId}/${channelId}/playlist.m3u8?token=${token}`,
        });
    }

    if (panels.length < 2) notFound();

    // Fetch all available channels (with favorites) for the in-grid picker
    const tunerList = await db.query.tuners.findMany({
        where: and(isNull(tuners.deleted_at), eq(tuners.is_active, true)),
    });
    const tunerMap = Object.fromEntries(tunerList.map(t => [t.id, t.name]));

    const allChannelRows = await db
        .select({
            id: channels.id,
            fk_tuner: channels.fk_tuner,
            guideNumber: channels.guideNumber,
            guideName: channels.guideName,
            hd: channels.hd,
            isFavorite: userChannelPreferences.isFavorite,
        })
        .from(channels)
        .leftJoin(
            userChannelPreferences,
            and(
                eq(userChannelPreferences.channelId, channels.id),
                eq(userChannelPreferences.userId, userId)
            )
        )
        .where(and(eq(channels.is_active, true), isNull(channels.deleted_at)))
        .orderBy(asc(channels.guideNumber))
        .all();

    const allChannels: ChannelOption[] = allChannelRows
        .filter(r => tunerMap[r.fk_tuner])
        .sort((a, b) => parseFloat(a.guideNumber) - parseFloat(b.guideNumber))
        .map(r => ({
            id: r.id,
            tunerId: r.fk_tuner,
            guideNumber: r.guideNumber,
            guideName: r.guideName,
            hd: r.hd,
            isFavorite: r.isFavorite === true,
        }));

    const gridLayout = layout === '2x1' ? '2x1' : layout === 'pip' ? 'pip' : '2x2';

    return (
        <MultiviewGrid
            initialPanels={panels}
            allChannels={allChannels}
            layout={gridLayout}
        />
    );
}
