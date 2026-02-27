import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

// PUT /api/settings/api-keys/[id] - Update key
export async function PUT(request, { params }) {
    const { id } = await params;
    const settings = await getSettings();
    const found = settings.apiKeys.find(k => k.id === id);
    if (!found) {
        return NextResponse.json({ error: 'ไม่พบ API Key นี้' }, { status: 404 });
    }
    const body = await request.json();
    if (body.label) found.label = body.label;
    if (body.key) found.key = body.key.trim();
    await saveSettings(settings);
    return NextResponse.json({ success: true });
}

// DELETE /api/settings/api-keys/[id]
export async function DELETE(request, { params }) {
    const { id } = await params;
    const settings = await getSettings();
    settings.apiKeys = settings.apiKeys.filter(k => k.id !== id);

    if (settings.activeKeyId === id) {
        settings.activeKeyId = settings.apiKeys[0]?.id || null;
    }

    await saveSettings(settings);
    return NextResponse.json({ success: true });
}
