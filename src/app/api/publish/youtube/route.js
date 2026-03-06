import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { getSettings, saveSettings } from '@/lib/settings';
import { ROOT_DIR } from '@/lib/paths';

// POST /api/publish/youtube
export async function POST(request) {
    try {
        const { videoFilePath, thumbnailPath, title, description, tags, privacyStatus = 'public', scheduledTime, channelId } = await request.json();

        const settings = await getSettings();
        const { youtubeClientId, youtubeClientSecret, youtubeChannels } = settings;
        const channels = youtubeChannels || [];

        if (!youtubeClientId || !youtubeClientSecret || channels.length === 0) {
            return NextResponse.json({ error: 'กรุณาเชื่อมต่อ YouTube ในหน้าตั้งค่าก่อน' }, { status: 400 });
        }

        let selectedChannel = null;
        if (channelId) {
            selectedChannel = channels.find(c => c.id === channelId);
        }
        if (!selectedChannel) {
            selectedChannel = channels[0];
        }

        const absVideoPath = path.join(ROOT_DIR, 'data', videoFilePath.replace('/api/uploads/', '').replace('/uploads/', ''));
        if (!fs.existsSync(absVideoPath)) {
            return NextResponse.json({ error: 'ไม่พบไฟล์วิดีโอ' }, { status: 400 });
        }

        const redirectUri = 'http://localhost:3000/api/settings/youtube/oauth2callback';
        const oauth2Client = new google.auth.OAuth2(youtubeClientId, youtubeClientSecret, redirectUri);
        oauth2Client.setCredentials(selectedChannel.tokens);

        oauth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                selectedChannel.tokens.refresh_token = tokens.refresh_token;
            }
            selectedChannel.tokens.access_token = tokens.access_token;
            selectedChannel.tokens.expiry_date = tokens.expiry_date;

            getSettings().then(updatedSettings => {
                if (updatedSettings.youtubeChannels) {
                    const index = updatedSettings.youtubeChannels.findIndex(c => c.id === selectedChannel.id);
                    if (index > -1) {
                        updatedSettings.youtubeChannels[index].tokens = selectedChannel.tokens;
                        saveSettings(updatedSettings);
                    }
                }
            });
        });

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        const fileSize = fs.statSync(absVideoPath).size;
        console.log(`📤 Uploading to YouTube: ${absVideoPath} (${(fileSize / (1024 * 1024)).toFixed(1)} MB)`);

        const requestBody = {
            snippet: {
                title: title || 'วิดีโอจาก Creator Studio',
                description: description || '',
                tags: tags ? tags.split(',').map(t => t.trim()) : [],
                categoryId: '22',
            },
            status: {
                privacyStatus: scheduledTime ? 'private' : privacyStatus,
                selfDeclaredMadeForKids: false
            }
        };

        if (scheduledTime) {
            requestBody.status.publishAt = new Date(scheduledTime).toISOString();
        }

        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody,
            media: {
                body: fs.createReadStream(absVideoPath),
            },
        });

        const videoId = response.data.id;
        const isScheduled = !!scheduledTime;

        // Set custom thumbnail (first frame of video)
        let thumbnailSet = false;
        if (thumbnailPath) {
            try {
                const absThumbPath = path.join(ROOT_DIR, 'data', thumbnailPath.replace('/api/uploads/', '').replace('/uploads/', ''));
                if (fs.existsSync(absThumbPath)) {
                    await youtube.thumbnails.set({
                        videoId: videoId,
                        media: {
                            mimeType: 'image/jpeg',
                            body: fs.createReadStream(absThumbPath),
                        },
                    });
                    thumbnailSet = true;
                    console.log('🖼️ Custom thumbnail set successfully for video:', videoId);
                } else {
                    console.log('⚠️ Thumbnail file not found:', absThumbPath);
                }
            } catch (thumbErr) {
                // Custom thumbnails require channel verification
                console.error('⚠️ Failed to set thumbnail (channel may not be verified):', thumbErr.message);
            }
        }

        return NextResponse.json({
            success: true,
            videoId: videoId,
            postUrl: `https://youtu.be/${videoId}`,
            thumbnailSet,
            scheduled: isScheduled,
            scheduledTime: scheduledTime || null,
            message: isScheduled
                ? `⏰ ตั้งเวลาเผยแพร่ YouTube สำเร็จ! จะเผยแพร่ ${new Date(scheduledTime).toLocaleString('th-TH')}`
                : 'เผยแพร่วิดีโอไป YouTube สำเร็จ!' + (thumbnailSet ? ' (ตั้ง thumbnail แล้ว)' : '')
        });

    } catch (err) {
        console.error('YouTube Upload Error:', err);
        const msg = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
        return NextResponse.json({ error: `YouTube Error: ${msg}` }, { status: 500 });
    }
}
