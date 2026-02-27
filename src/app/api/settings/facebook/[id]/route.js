import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

// DELETE /api/settings/facebook/[id]
export async function DELETE(request, { params }) {
    const { id } = await params;
    const settings = await getSettings();
    if (!settings.facebookPages) settings.facebookPages = [];
    settings.facebookPages = settings.facebookPages.filter(p => p.id !== id);
    await saveSettings(settings);
    return NextResponse.json({ success: true });
}
