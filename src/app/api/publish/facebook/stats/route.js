import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

// Check token permissions
async function checkPermissions(token) {
    try {
        const res = await fetch(
            `https://graph.facebook.com/v22.0/me/permissions?access_token=${token}`
        );
        const data = await res.json();
        if (data.data) {
            const granted = data.data
                .filter(p => p.status === 'granted')
                .map(p => p.permission);

            const required = {
                'pages_read_engagement': 'อ่านยอด likes/comments',
                'read_insights': 'อ่านยอดวิว (views)',
                'pages_show_list': 'แสดงรายการ Pages'
            };

            const missing = Object.entries(required)
                .filter(([perm]) => !granted.includes(perm))
                .map(([perm, desc]) => ({ permission: perm, description: desc }));

            console.log(`🔑 Token permissions: ${granted.join(', ')}`);
            if (missing.length > 0) {
                console.log(`⚠️ Missing permissions: ${missing.map(m => m.permission).join(', ')}`);
            }

            return { granted, missing };
        }
    } catch (e) {
        console.log('Permission check failed:', e.message);
    }
    return { granted: [], missing: [] };
}

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
        let permissionInfo = null;

        for (const item of items) {
            const { videoId, pageId } = item;
            let fbToken = null;
            let fbPageId = pageId;

            if (pageId) {
                const page = pages.find(p => p.pageId === pageId);
                if (page) fbToken = page.token;
            }
            if (!fbToken && pages.length > 0) {
                fbToken = pages[0].token;
                fbPageId = fbPageId || pages[0].pageId;
            }
            if (!fbToken && settings.facebookPageToken) {
                fbToken = settings.facebookPageToken;
                fbPageId = fbPageId || settings.facebookPageId;
            }
            if (!fbToken) continue;

            // Check permissions once per request
            if (!permissionInfo) {
                permissionInfo = await checkPermissions(fbToken);
            }

            const hasReadEngagement = permissionInfo.granted.includes('pages_read_engagement');
            const hasReadInsights = permissionInfo.granted.includes('read_insights');

            try {
                let views = 0, likes = 0, comments = 0, shares = 0;
                let gotViews = false, gotEngagement = false;

                // Method 1: Direct video fields — ALWAYS works (views, likes, comments)
                try {
                    const videoResponse = await fetch(
                        `https://graph.facebook.com/v22.0/${videoId}?fields=views,likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${fbToken}`
                    );
                    const videoData = await videoResponse.json();

                    if (!videoData.error) {
                        views = videoData.views || 0;
                        likes = videoData.likes?.summary?.total_count || 0;
                        comments = videoData.comments?.summary?.total_count || 0;
                        gotViews = views > 0;
                        gotEngagement = likes > 0 || comments > 0;
                        console.log(`📹 Direct video fields for ${videoId}: views=${views}, likes=${likes}, comments=${comments}`);
                    } else {
                        console.log(`⚠️ Direct video fields failed for ${videoId}: ${videoData.error.message}`);
                    }
                } catch (videoErr) {
                    console.log(`Direct video failed for ${videoId}:`, videoErr.message);
                }

                // Method 2: Video Insights — for more detailed metrics (requires read_insights)
                if (!gotViews) {
                    try {
                        const insightsResponse = await fetch(
                            `https://graph.facebook.com/v22.0/${videoId}/video_insights?metric=total_video_impressions,total_video_reactions_by_type_total&access_token=${fbToken}`
                        );
                        const insightsData = await insightsResponse.json();

                        if (insightsData.data && insightsData.data.length > 0 && !insightsData.error) {
                            for (const metric of insightsData.data) {
                                if (metric.name === 'total_video_impressions') {
                                    const v = metric.values?.[0]?.value || 0;
                                    if (v > views) views = v;
                                }
                                if (metric.name === 'total_video_reactions_by_type_total') {
                                    const reactions = metric.values?.[0]?.value || {};
                                    const totalReactions = Object.values(reactions).reduce((sum, v) => sum + (v || 0), 0);
                                    if (totalReactions > likes) likes = totalReactions;
                                }
                            }
                            gotViews = views > 0;
                            console.log(`📊 Video insights for ${videoId}: views=${views}, likes=${likes}`);
                        }
                    } catch (insightErr) {
                        console.log(`Insights failed for ${videoId}:`, insightErr.message);
                    }
                }

                // Method 3: Search Page feed for engagement (shares, etc.)
                if (!gotEngagement && fbPageId) {
                    try {
                        const feedResponse = await fetch(
                            `https://graph.facebook.com/v22.0/${fbPageId}/published_posts?fields=id,shares,likes.summary(true).limit(0),comments.summary(true).limit(0)&limit=50&access_token=${fbToken}`
                        );
                        const feedData = await feedResponse.json();

                        if (feedData.data && !feedData.error) {
                            for (const post of feedData.data) {
                                const postIdParts = post.id.split('_');
                                const postVideoId = postIdParts[1] || postIdParts[0];

                                if (postVideoId === videoId || post.id.includes(videoId)) {
                                    const postLikes = post.likes?.summary?.total_count || 0;
                                    const postComments = post.comments?.summary?.total_count || 0;
                                    if (postLikes > likes) likes = postLikes;
                                    if (postComments > comments) comments = postComments;
                                    shares = post.shares?.count || 0;
                                    gotEngagement = true;
                                    console.log(`📰 Found in feed (${post.id}): likes=${likes}, comments=${comments}, shares=${shares}`);
                                    break;
                                }
                            }
                        }

                        if (!gotEngagement) {
                            const videosResponse = await fetch(
                                `https://graph.facebook.com/v22.0/${fbPageId}/videos?fields=id,views,likes.summary(true).limit(0),comments.summary(true).limit(0)&limit=50&access_token=${fbToken}`
                            );
                            const videosData = await videosResponse.json();

                            if (videosData.data && !videosData.error) {
                                const match = videosData.data.find(v => v.id === videoId);
                                if (match) {
                                    const matchLikes = match.likes?.summary?.total_count || 0;
                                    const matchComments = match.comments?.summary?.total_count || 0;
                                    const matchViews = match.views || 0;
                                    if (matchLikes > likes) likes = matchLikes;
                                    if (matchComments > comments) comments = matchComments;
                                    if (matchViews > views) views = matchViews;
                                    gotEngagement = true;
                                    console.log(`📹 Found in videos: views=${views}, likes=${likes}, comments=${comments}`);
                                }
                            }
                        }
                    } catch (feedErr) {
                        console.log(`Feed search failed for ${videoId}:`, feedErr.message);
                    }
                }

                stats[videoId] = { views, comments, likes, shares };
                console.log(`📊 Final stats for ${videoId}:`, stats[videoId]);
            } catch (e) {
                console.error(`Stats error for ${videoId}:`, e.message);
            }
        }

        const response = { stats };
        if (permissionInfo && permissionInfo.missing.length > 0) {
            response.missingPermissions = permissionInfo.missing;
        }

        return NextResponse.json(response);
    } catch (err) {
        console.error('Stats fetch error:', err);
        return NextResponse.json({ stats: {} });
    }
}

