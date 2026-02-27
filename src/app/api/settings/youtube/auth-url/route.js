import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSettings } from '@/lib/settings';

// GET /api/settings/youtube/auth-url
export async function GET() {
    const settings = await getSettings();
    const { youtubeClientId, youtubeClientSecret } = settings;

    if (!youtubeClientId || !youtubeClientSecret) {
        return NextResponse.json({ error: 'ไม่มี Client ID / Secret' }, { status: 400 });
    }

    const redirectUri = 'http://localhost:3000/api/settings/youtube/oauth2callback';
    const oauth2Client = new google.auth.OAuth2(youtubeClientId, youtubeClientSecret, redirectUri);

    const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    return NextResponse.json({ url: authUrl });
}
