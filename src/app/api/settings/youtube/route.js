import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

// GET /api/settings/youtube
export async function GET() {
    const settings = await getSettings();

    // Backwards compatibility migration
    if (settings.youtubeTokens && !settings.youtubeChannels) {
        settings.youtubeChannels = [{
            id: settings.youtubeChannelId || `yt_${Date.now()}`,
            title: settings.youtubeChannelTitle || 'Unnamed Channel',
            tokens: settings.youtubeTokens,
            addedAt: new Date().toISOString()
        }];
        delete settings.youtubeTokens;
        delete settings.youtubeChannelId;
        delete settings.youtubeChannelTitle;
        await saveSettings(settings);
    }

    const channels = settings.youtubeChannels || [];

    return NextResponse.json({
        clientId: settings.youtubeClientId || '',
        clientSecretMasked: settings.youtubeClientSecret ? '•'.repeat(16) : '',
        hasKeys: !!(settings.youtubeClientId && settings.youtubeClientSecret),
        channels: channels.map(c => ({
            id: c.id,
            title: c.title,
            addedAt: c.addedAt
        }))
    });
}
