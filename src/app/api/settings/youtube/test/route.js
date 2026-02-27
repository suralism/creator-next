import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSettings } from '@/lib/settings';

// POST /api/settings/youtube/test
export async function POST(request) {
    try {
        const { channelId } = await request.json();
        if (!channelId) {
            return NextResponse.json({ error: 'กรุณาระบุ Channel ID' }, { status: 400 });
        }

        const settings = await getSettings();
        const channel = (settings.youtubeChannels || []).find(c => c.id === channelId);
        if (!channel || !channel.tokens) {
            return NextResponse.json({ error: 'ไม่พบข้อมูล Channel นี้ในระบบ' }, { status: 404 });
        }

        const { youtubeClientId, youtubeClientSecret } = settings;
        if (!youtubeClientId || !youtubeClientSecret) {
            return NextResponse.json({ error: 'ระบบไม่ได้ตั้งค่า Client ID / Secret ไว้' }, { status: 400 });
        }

        const oauth2Client = new google.auth.OAuth2(youtubeClientId, youtubeClientSecret);
        oauth2Client.setCredentials(channel.tokens);
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        const response = await youtube.channels.list({
            part: 'snippet',
            mine: true
        });

        if (response.data.items && response.data.items.length > 0) {
            return NextResponse.json({
                success: true,
                message: `เชื่อมต่อสำเร็จ! พบช่อง YouTube: ${response.data.items[0].snippet.title}`
            });
        } else {
            return NextResponse.json({
                success: false,
                message: 'ไม่พบช่องที่ผูกไว้กับบัญชีนี้'
            });
        }
    } catch (err) {
        console.error('YouTube test error:', err);
        return NextResponse.json({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบ'
        });
    }
}
