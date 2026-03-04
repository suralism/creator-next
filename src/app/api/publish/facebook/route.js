import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSettings } from '@/lib/settings';
import { ROOT_DIR } from '@/lib/paths';

// POST /api/publish/facebook - Upload Reels
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
        const videoSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(1);
        console.log(`📤 Uploading to Facebook Page (${videoSizeMB} MB)...`);

        const caption = [title, '', description].filter(Boolean).join('\n');

        // Step 1: Initialize upload session
        const initResponse = await fetch(
            `https://graph.facebook.com/v22.0/${fbPageId}/video_reels`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    upload_phase: 'start',
                    access_token: fbToken,
                }),
            }
        );

        const initData = await initResponse.json();
        if (initData.error) {
            return NextResponse.json({ error: `Facebook Error: ${initData.error.message}` }, { status: 400 });
        }

        const videoId = initData.video_id;

        // Step 2: Upload binary
        const uploadResponse = await fetch(
            `https://rupload.facebook.com/video-upload/v22.0/${videoId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `OAuth ${fbToken}`,
                    'offset': '0',
                    'file_size': videoBuffer.length.toString(),
                    'Content-Type': 'application/octet-stream',
                },
                body: videoBuffer,
            }
        );

        const uploadData = await uploadResponse.json();
        if (uploadData.error) {
            return NextResponse.json({ error: `Facebook Upload Error: ${uploadData.error.message}` }, { status: 400 });
        }

        // Step 3: Finish
        const finishBody = {
            upload_phase: 'finish',
            access_token: fbToken,
            video_id: videoId,
            title: title || '',
            description: caption,
        };

        if (scheduledTime) {
            const scheduledUnix = Math.floor(new Date(scheduledTime).getTime() / 1000);
            finishBody.video_state = 'SCHEDULED';
            finishBody.scheduled_publish_time = scheduledUnix;
        } else {
            finishBody.video_state = 'PUBLISHED';
        }

        const finishResponse = await fetch(
            `https://graph.facebook.com/v22.0/${fbPageId}/video_reels`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finishBody),
            }
        );

        const finishData = await finishResponse.json();
        if (finishData.error) {
            return NextResponse.json({ error: `Facebook Publish Error: ${finishData.error.message}` }, { status: 400 });
        }

        const isScheduled = !!scheduledTime;

        return NextResponse.json({
            success: true,
            videoId: videoId,
            postUrl: `https://www.facebook.com/reel/${videoId}`,
            scheduled: isScheduled,
            scheduledTime: scheduledTime || null,
            message: isScheduled
                ? `⏰ ตั้งเวลา Reels สำเร็จ! จะเผยแพร่ ${new Date(scheduledTime).toLocaleString('th-TH')}`
                : 'เผยแพร่ Reels ไป Facebook Page สำเร็จ!'
        });

    } catch (err) {
        console.error('Facebook Publish Error:', err);
        return NextResponse.json({ error: `Facebook Error: ${err.message}` }, { status: 500 });
    }
}
