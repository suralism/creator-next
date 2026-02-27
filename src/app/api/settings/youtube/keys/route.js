import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

// POST /api/settings/youtube/keys
export async function POST(request) {
    const { clientId, clientSecret } = await request.json();
    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'กรุณาใส่ Client ID และ Client Secret' }, { status: 400 });
    }

    const settings = await getSettings();
    settings.youtubeClientId = clientId.trim();
    if (!clientSecret.includes('•')) {
        settings.youtubeClientSecret = clientSecret.trim();
    }

    await saveSettings(settings);
    return NextResponse.json({ success: true, message: 'บันทึก Google OAuth Credentials สำเร็จ' });
}
