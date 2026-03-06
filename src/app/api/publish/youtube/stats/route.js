import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSettings } from '@/lib/settings';

// POST /api/publish/youtube/stats
export async function POST(request) {
    try {
        const { videoIds, videoItems } = await request.json();
        const items = videoItems || (videoIds ? videoIds.map(id => ({ videoId: id })) : []);

        if (!items || items.length === 0) {
            return NextResponse.json({ stats: {} });
        }

        const settings = await getSettings();
        const channels = settings.youtubeChannels || [];
        const { youtubeClientId, youtubeClientSecret } = settings;

        if (!youtubeClientId || !youtubeClientSecret || channels.length === 0) {
            return NextResponse.json({ stats: {} }); // Not configred, just return empty
        }

        // Use the first channel to authenticate (for public video stats, any valid oauth client works as long as quota allows, or even API Key)
        // For private videos we'd need the specific channel's token, but we will group them by channelId later if needed.
        // For simplicity, let's group requests by channelId
        const stats = {};

        for (const item of items) {
            const { videoId, channelId } = item;
            let targetChannel = channels.find(c => c.id === channelId);
            if (!targetChannel && channels.length > 0) targetChannel = channels[0];
            if (!targetChannel) continue;

            const redirectUri = 'http://localhost:3000/api/settings/youtube/oauth2callback';
            const oauth2Client = new google.auth.OAuth2(youtubeClientId, youtubeClientSecret, redirectUri);
            oauth2Client.setCredentials(targetChannel.tokens);

            const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

            try {
                const response = await youtube.videos.list({
                    part: 'statistics',
                    id: videoId
                });

                if (response.data.items && response.data.items.length > 0) {
                    const ytStats = response.data.items[0].statistics;
                    stats[videoId] = {
                        views: parseInt(ytStats.viewCount || 0),
                        likes: parseInt(ytStats.likeCount || 0),
                        comments: parseInt(ytStats.commentCount || 0),
                        shares: 0 // YT API doesn't return shares publicly this easily
                    };
                } else {
                    stats[videoId] = { views: 0, likes: 0, comments: 0, shares: 0 };
                }
            } catch (e) {
                console.error(`YouTube Stats error for ${videoId}:`, e.message);
            }
        }

        return NextResponse.json({ stats });
    } catch (err) {
        console.error('YouTube Stats fetch error:', err);
        return NextResponse.json({ stats: {} });
    }
}
