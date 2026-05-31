import { and, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { getDb } from '@/lib/database/db';
import { tuners, channels } from '@/lib/database/schema';
import { PageContainer, PageHeader } from '@/components/layouts';
import MultiviewSelector from './MultiviewSelector';
import { getTranscodingSettings } from '@/lib/settings';
import { Card } from '@/components';

export const dynamic = 'force-dynamic';

export default async function MultiviewPage() {
    const db = await getDb();
    const settings = await getTranscodingSettings();

    const tunerList = await db.query.tuners.findMany({
        where: and(
            isNull(tuners.deleted_at),
            eq(tuners.is_active, true)
        ),
        with: {
            channels: {
                where: and(
                    eq(channels.is_active, true),
                    isNull(channels.deleted_at)
                ),
                orderBy: (c, { asc }) => [asc(c.guideNumber)],
            },
        },
    });

    const allChannels = tunerList.flatMap(tuner =>
        tuner.channels.map(ch => ({
            id: ch.id,
            tunerId: tuner.id,
            tunerName: tuner.name,
            guideNumber: ch.guideNumber,
            guideName: ch.guideName,
            hd: ch.hd,
        }))
    );

    if (!settings.enabled) {
        return (
            <PageContainer>
                <PageHeader
                    title="Multiview"
                    subtitle="Watch multiple channels simultaneously"
                />
                <Card className="p-4" style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' }}>
                    <h3 style={{ color: 'var(--color-warning)', marginTop: 0 }}>Transcoding Not Available</h3>
                    <p>Multiview requires transcoding to be enabled. Please enable it in{' '}
                        <Link href="/settings">Settings</Link>.
                    </p>
                </Card>
            </PageContainer>
        );
    }

    if (allChannels.length === 0) {
        return (
            <PageContainer>
                <PageHeader
                    title="Multiview"
                    subtitle="Watch multiple channels simultaneously"
                />
                <p>No channels available. Add a tuner and scan for channels first.</p>
                <Link href="/tuners">→ Go to Tuners</Link>
            </PageContainer>
        );
    }

    return (
        <PageContainer maxWidth="xl">
            <PageHeader
                title="Multiview"
                subtitle="Select up to 4 channels to watch simultaneously"
            />
            <MultiviewSelector channels={allChannels} maxSessions={settings.maxSessions} />
        </PageContainer>
    );
}
