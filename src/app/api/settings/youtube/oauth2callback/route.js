import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSettings, saveSettings } from '@/lib/settings';

// GET /api/settings/youtube/oauth2callback
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL(`/?youtube_oauth=error&msg=${error}`, request.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL(`/?youtube_oauth=error&msg=no_code`, request.url));
    }

    const settings = await getSettings();
    const { youtubeClientId, youtubeClientSecret } = settings;

    const redirectUri = 'http://localhost:3000/api/settings/youtube/oauth2callback';
    const oauth2Client = new google.auth.OAuth2(youtubeClientId, youtubeClientSecret, redirectUri);

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        const channelRes = await youtube.channels.list({
            part: 'snippet',
            mine: true
        });

        const channel = channelRes.data.items[0];

        if (!settings.youtubeChannels) {
            settings.youtubeChannels = [];
        }

        const existing = settings.youtubeChannels.find(c => c.id === channel.id);
        if (existing) {
            existing.tokens = tokens;
            existing.title = channel.snippet.title;
        } else {
            settings.youtubeChannels.push({
                id: channel.id,
                title: channel.snippet.title,
                tokens: tokens,
                addedAt: new Date().toISOString()
            });
        }

        await saveSettings(settings);

        return NextResponse.redirect(new URL(`/?youtube_oauth=success`, request.url));
    } catch (err) {
        console.error('OAuth Callback Error:', err);
        return NextResponse.redirect(new URL(`/?youtube_oauth=error&msg=${encodeURIComponent(err.message)}`, request.url));
    }
}
