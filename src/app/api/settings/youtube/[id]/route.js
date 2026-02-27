import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

// DELETE /api/settings/youtube/[id]
export async function DELETE(request, { params }) {
    const { id } = await params;
    const settings = await getSettings();
    if (!settings.youtubeChannels) settings.youtubeChannels = [];

    settings.youtubeChannels = settings.youtubeChannels.filter(c => c.id !== id);

    await saveSettings(settings);
    return NextResponse.json({ success: true, message: 'ยกเลิกการเชื่อมต่อ YouTube Channel สำเร็จ' });
}
