import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

// GET /api/publish/facebook/debug — Debug Facebook Token & Permissions
export async function GET() {
    try {
        const settings = await getSettings();
        const pages = settings.facebookPages || [];

        if (pages.length === 0) {
            return NextResponse.json({ error: 'ไม่มี Facebook Page ในระบบ' }, { status: 400 });
        }

        const page = pages[0];
        const token = page.token;
        const pageId = page.pageId;
        const results = {};

        // 1. Token info
        try {
            const res = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${token}`);
            results.tokenInfo = await res.json();
        } catch (e) {
            results.tokenInfo = { error: e.message };
        }

        // 2. Debug token — shows actual scopes and app info
        try {
            const res = await fetch(`https://graph.facebook.com/v22.0/debug_token?input_token=${token}&access_token=${token}`);
            const data = await res.json();
            results.debugToken = data.data || data;
        } catch (e) {
            results.debugToken = { error: e.message };
        }

        // 3. Page info
        try {
            const res = await fetch(`https://graph.facebook.com/v22.0/${pageId}?fields=id,name,fan_count&access_token=${token}`);
            results.pageInfo = await res.json();
        } catch (e) {
            results.pageInfo = { error: e.message };
        }

        // 4. List recent videos with ALL possible engagement fields
        try {
            const res = await fetch(`https://graph.facebook.com/v22.0/${pageId}/videos?fields=id,title,created_time,likes.summary(true).limit(0),comments.summary(true).limit(0)&limit=5&access_token=${token}`);
            results.recentVideos = await res.json();
        } catch (e) {
            results.recentVideos = { error: e.message };
        }

        // 5. Try video_insights with different metrics on first video
        const firstVideoId = results.recentVideos?.data?.[0]?.id;
        if (firstVideoId) {
            // Try all common video metrics
            const metricsToTry = [
                'total_video_impressions',
                'total_video_views',
                'total_video_views_unique',
                'total_video_reactions_by_type_total',
                'total_video_view_total_time',
                'total_video_impressions_unique',
            ];

            for (const metric of metricsToTry) {
                try {
                    const res = await fetch(`https://graph.facebook.com/v22.0/${firstVideoId}/video_insights?metric=${metric}&access_token=${token}`);
                    const data = await res.json();
                    if (!results.videoInsightsDetail) results.videoInsightsDetail = {};
                    results.videoInsightsDetail[metric] = data.data?.length > 0 ? data.data[0] : (data.error || 'empty');
                } catch (e) {
                    if (!results.videoInsightsDetail) results.videoInsightsDetail = {};
                    results.videoInsightsDetail[metric] = { error: e.message };
                }
            }

            // Also try querying the video directly with different field combos
            try {
                const res = await fetch(`https://graph.facebook.com/v22.0/${firstVideoId}?fields=id,title,description,length,live_status,views,permalink_url&access_token=${token}`);
                results.videoDirectFields = await res.json();
            } catch (e) {
                results.videoDirectFields = { error: e.message };
            }
        }

        // 6. Try published_posts with full engagement
        try {
            const res = await fetch(`https://graph.facebook.com/v22.0/${pageId}/published_posts?fields=id,message,shares,likes.summary(true).limit(0),comments.summary(true).limit(0)&limit=5&access_token=${token}`);
            results.recentPosts = await res.json();
        } catch (e) {
            results.recentPosts = { error: e.message };
        }

        // 7. Check if this is a Reel — try video_reels endpoint
        try {
            const res = await fetch(`https://graph.facebook.com/v22.0/${pageId}/video_reels?fields=id,description,created_time,likes.summary(true).limit(0),comments.summary(true).limit(0)&limit=5&access_token=${token}`);
            results.recentReels = await res.json();
        } catch (e) {
            results.recentReels = { error: e.message };
        }

        // Summary
        const scopes = results.debugToken?.scopes || [];
        results._summary = {
            tokenType: results.debugToken?.type || 'unknown',
            appId: results.debugToken?.app_id || 'unknown',
            scopes: scopes,
            hasReadEngagement: scopes.includes('pages_read_engagement'),
            hasReadInsights: scopes.includes('read_insights'),
            hasPagesShowList: scopes.includes('pages_show_list'),
            isValid: results.debugToken?.is_valid ?? 'unknown',
            expiresAt: results.debugToken?.expires_at ? new Date(results.debugToken.expires_at * 1000).toISOString() : 'never',
            diagnosis: !scopes.includes('pages_read_engagement')
                ? '❌ Token ขาด pages_read_engagement — ไม่สามารถอ่าน likes/comments ได้'
                : scopes.includes('read_insights')
                    ? '✅ Token มี permissions ครบ — ถ้ายังไม่ขึ้นอาจเป็นเพราะวิดีโอใหม่เกินไป หรือ App อยู่ใน Development Mode'
                    : '⚠️ Token ขาด read_insights — อ่าน likes/comments ได้ แต่อ่านยอดวิวไม่ได้'
        };

        return NextResponse.json(results, { status: 200 });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

