import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

// PUT /api/settings/api-keys/[id]/activate
export async function PUT(request, { params }) {
    const { id } = await params;
    const settings = await getSettings();
    const found = settings.apiKeys.find(k => k.id === id);
    if (!found) {
        return NextResponse.json({ error: 'ไม่พบ API Key นี้' }, { status: 404 });
    }
    settings.activeKeyId = id;
    await saveSettings(settings);
    return NextResponse.json({ success: true, activeKeyId: id });
}
