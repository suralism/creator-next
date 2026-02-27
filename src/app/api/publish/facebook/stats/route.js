import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

// POST /api/publish/facebook/stats
export async function POST(request) {
    try {
        const { videoIds, videoItems } = await request.json();
        const items = videoItems || (videoIds ? videoIds.map(id => ({ videoId: id })) : []);

        if (!items || items.length === 0) {
            return NextResponse.json({ stats: {} });
        }

        const settings = await getSettings();
        const pages = settings.facebookPages || [];
        const stats = {};

        for (const item of items) {
            const { videoId, pageId } = item;
            let fbToken = null;

            if (pageId) {
                const page = pages.find(p => p.pageId === pageId);
                if (page) fbToken = page.token;
            }
            if (!fbToken && pages.length > 0) fbToken = pages[0].token;
            if (!fbToken && settings.facebookPageToken) fbToken = settings.facebookPageToken;
            if (!fbToken) continue;

            try {
                const response = await fetch(
                    `https://graph.facebook.com/v19.0/${videoId}?fields=views,comments.summary(true).limit(0),likes.summary(true).limit(0),shares&access_token=${fbToken}`
                );
                const data = await response.json();

                if (!data.error) {
                    stats[videoId] = {
                        views: data.views || 0,
                        comments: data.comments?.summary?.total_count || 0,
                        likes: data.likes?.summary?.total_count || 0,
                        shares: data.shares?.count || 0
                    };
                }
            } catch (e) {
                console.error(`Stats error for ${videoId}:`, e.message);
            }
        }

        return NextResponse.json({ stats });
    } catch (err) {
        console.error('Stats fetch error:', err);
        return NextResponse.json({ stats: {} });
    }
}
