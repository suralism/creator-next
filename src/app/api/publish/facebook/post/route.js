import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { ROOT_DIR } from '@/lib/paths';

// POST /api/publish/facebook/post - Upload as regular video post
export async function POST(request) {
    try {
        const { videoFilePath, title, description, pageId: selectedPageId, scheduledTime } = await request.json();

        const settings = await getSettings();
        const pages = settings.facebookPages || [];

        let fbPageId = selectedPageId;
        let fbToken = null;

        if (fbPageId) {
            const page = pages.find(p => p.pageId === fbPageId);
            if (page) fbToken = page.token;
        }
        if (!fbToken && pages.length > 0) {
            fbPageId = pages[0].pageId;
            fbToken = pages[0].token;
        }
        if (!fbToken && settings.facebookPageToken) {
            fbToken = settings.facebookPageToken;
            fbPageId = settings.facebookPageId;
        }

        if (!fbToken || !fbPageId) {
            return NextResponse.json({ error: 'กรุณาเพิ่ม Facebook Page ในหน้าตั้งค่า' }, { status: 400 });
        }

        const absVideoPath = path.join(ROOT_DIR, 'data', videoFilePath.replace('/api/uploads/', '').replace('/uploads/', ''));
        if (!fs.existsSync(absVideoPath)) {
            return NextResponse.json({ error: 'ไม่พบไฟล์วิดีโอ' }, { status: 400 });
        }

        const videoBuffer = fs.readFileSync(absVideoPath);
        const caption = [title, '', description].filter(Boolean).join('\n');

        const boundary = '----FormBoundary' + Date.now();
        const parts = [];

        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${fbToken}`);
        if (title) {
            parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${title}`);
        }
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\n${caption}`);
        if (scheduledTime) {
            const scheduledUnix = Math.floor(new Date(scheduledTime).getTime() / 1000);
            parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="scheduled_publish_time"\r\n\r\n${scheduledUnix}`);
            parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="published"\r\n\r\nfalse`);
        }
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`);

        const header = Buffer.from(parts.join('\r\n') + '\r\n');
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([header, videoBuffer, footer]);

        const response = await fetch(
            `https://graph.facebook.com/v22.0/${fbPageId}/videos`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                body: body,
            }
        );

        const data = await response.json();
        if (data.error) {
            return NextResponse.json({ error: `Facebook Error: ${data.error.message}` }, { status: 400 });
        }

        const isScheduled = !!scheduledTime;

        return NextResponse.json({
            success: true,
            videoId: data.id,
            postUrl: `https://www.facebook.com/${fbPageId}/videos/${data.id}`,
            scheduled: isScheduled,
            scheduledTime: scheduledTime || null,
            message: isScheduled
                ? `⏰ ตั้งเวลาวิดีโอสำเร็จ! จะเผยแพร่ ${new Date(scheduledTime).toLocaleString('th-TH')}`
                : 'โพสวิดีโอไป Facebook Page สำเร็จ!'
        });

    } catch (err) {
        console.error('Facebook Post Error:', err);
        return NextResponse.json({ error: `Facebook Error: ${err.message}` }, { status: 500 });
    }
}
