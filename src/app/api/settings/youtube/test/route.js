import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSettings, saveSettings } from '@/lib/settings';

const REDIRECT_URI = 'http://localhost:3000/api/settings/youtube/oauth2callback';

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

        const oauth2Client = new google.auth.OAuth2(youtubeClientId, youtubeClientSecret, REDIRECT_URI);
        oauth2Client.setCredentials(channel.tokens);

        // Listen for token refresh events and save updated tokens
        oauth2Client.on('tokens', async (newTokens) => {
            try {
                const latestSettings = await getSettings();
                const ch = (latestSettings.youtubeChannels || []).find(c => c.id === channelId);
                if (ch) {
                    ch.tokens = { ...ch.tokens, ...newTokens };
                    await saveSettings(latestSettings);
                    console.log('YouTube tokens refreshed and saved for channel:', channelId);
                }
            } catch (e) {
                console.error('Failed to save refreshed tokens:', e);
            }
        });

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

        // Handle invalid_grant specifically - token is expired/revoked
        if (err.message === 'invalid_grant' || err.code === 400) {
            return NextResponse.json({
                success: false,
                message: 'Token หมดอายุหรือถูกเพิกถอน กรุณาเชื่อมต่อ YouTube ใหม่อีกครั้ง (คลิก "เพิ่มช่อง YouTube")',
                needReauth: true
            });
        }

        return NextResponse.json({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบ'
        });
    }
}
