import { and, asc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/database/db';
import { tuners, channels, userChannelPreferences } from '@/lib/database/schema';
import { PageHeader } from '@/components/layouts';
import MultiviewSelector from './MultiviewSelector';
import { getTranscodingSettings } from '@/lib/settings';
import { Card } from '@/components';
import { auth } from '@/lib/auth/auth';
import type { Session } from '@/lib/auth/types';

export const dynamic = 'force-dynamic';

export default async function MultiviewPage() {
    const db = await getDb();
    const settings = await getTranscodingSettings();

    const rawSession = await auth.api.getSession({ headers: await headers() });
    const session = rawSession as unknown as Session | null;
    if (!session?.user) notFound();
    const userId = session.user.id;

    const tunerList = await db.query.tuners.findMany({
        where: and(
            isNull(tuners.deleted_at),
            eq(tuners.is_active, true)
        ),
    });

    // Fetch all active channels across all tuners, LEFT JOIN user preferences
    const rows = await db
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
        .where(and(
            eq(channels.is_active, true),
            isNull(channels.deleted_at)
        ))
        .orderBy(asc(channels.guideNumber))
        .all();

    const tunerMap = Object.fromEntries(tunerList.map(t => [t.id, t.name]));

    // Sort numerically, then attach tuner name and favorite flag
    const allChannels = rows
        .filter(r => tunerMap[r.fk_tuner]) // only channels whose tuner is active
        .sort((a, b) => parseFloat(a.guideNumber) - parseFloat(b.guideNumber))
        .map(r => ({
            id: r.id,
            tunerId: r.fk_tuner,
            tunerName: tunerMap[r.fk_tuner],
            guideNumber: r.guideNumber,
            guideName: r.guideName,
            hd: r.hd,
            isFavorite: r.isFavorite === true,
        }));

    if (!settings.enabled) {
        return (
            <div style={{ padding: '0 var(--space-4)' }}>
                <PageHeader title="Multiview" subtitle="Watch multiple channels simultaneously" />
                <Card className="p-4" style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' }}>
                    <h3 style={{ color: 'var(--color-warning)', marginTop: 0 }}>Transcoding Not Available</h3>
                    <p>Multiview requires transcoding to be enabled. Please enable it in{' '}
                        <Link href="/settings">Settings</Link>.
                    </p>
                </Card>
            </div>
        );
    }

    if (allChannels.length === 0) {
        return (
            <div style={{ padding: '0 var(--space-4)' }}>
                <PageHeader title="Multiview" subtitle="Watch multiple channels simultaneously" />
                <p>No channels available. Add a tuner and scan for channels first.</p>
                <Link href="/tuners">→ Go to Tuners</Link>
            </div>
        );
    }

    return (
        <div style={{ padding: '0 var(--space-4)' }}>
            <PageHeader
                title="Multiview"
                subtitle="Select up to 4 channels to watch simultaneously"
            />
            <MultiviewSelector channels={allChannels} maxSessions={settings.maxSessions} />
        </div>
    );
}
