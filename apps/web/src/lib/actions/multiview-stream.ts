'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { getDb } from '@/lib/database/db';
import { channels } from '@/lib/database/schema';
import { generateStreamToken } from '@/lib/stream-token';
import { getTranscodingSettings } from '@/lib/settings';

export interface ChannelOption {
    id: number;
    tunerId: number;
    guideNumber: string;
    guideName: string;
    hd: number;
    isFavorite: boolean;
}

export interface GetStreamUrlResult {
    playlistUrl: string;
    guideName: string;
    guideNumber: string;
}

/**
 * Server action: generate a signed stream URL for a given tuner+channel pair.
 * Used by the multiview grid when the user changes a panel's channel in-place.
 */
export async function getStreamUrl(
    tunerId: number,
    channelId: number
): Promise<GetStreamUrlResult> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error('Unauthorized');

    const settings = await getTranscodingSettings();
    if (!settings.enabled) throw new Error('Transcoding is not enabled');

    const db = await getDb();
    const channel = await db.query.channels.findFirst({
        where: and(
            eq(channels.id, channelId),
            eq(channels.fk_tuner, tunerId),
            eq(channels.is_active, true),
            isNull(channels.deleted_at)
        ),
        with: { tuners: true },
    });

    if (!channel || !channel.tuners?.is_active) {
        throw new Error('Channel not found or tuner inactive');
    }

    const token = await generateStreamToken(tunerId, channelId);
    return {
        playlistUrl: `/api/transcode/${tunerId}/${channelId}/playlist.m3u8?token=${token}`,
        guideName: channel.guideName,
        guideNumber: channel.guideNumber,
    };
}
