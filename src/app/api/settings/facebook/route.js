import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

// GET /api/settings/facebook
export async function GET() {
    const settings = await getSettings();

    // Backward compatibility: migrate old single-page to array
    if (settings.facebookPageToken && !settings.facebookPages) {
        settings.facebookPages = [{
            id: `fb_${Date.now()}`,
            pageId: settings.facebookPageId,
            pageName: settings.facebookPageName || '',
            token: settings.facebookPageToken,
            addedAt: new Date().toISOString()
        }];
        delete settings.facebookPageId;
        delete settings.facebookPageToken;
        delete settings.facebookPageName;
        await saveSettings(settings);
    }

    const pages = (settings.facebookPages || []).map(p => ({
        id: p.id,
        pageId: p.pageId,
        pageName: p.pageName,
        hasToken: !!p.token,
        tokenMasked: p.token ? '•'.repeat(Math.max(0, p.token.length - 12)) + p.token.slice(-12) : '',
        addedAt: p.addedAt
    }));

    return NextResponse.json({ pages });
}

// POST /api/settings/facebook - Add new page
export async function POST(request) {
    const { pageId, pageToken, pageName } = await request.json();

    if (!pageId || !pageToken) {
        return NextResponse.json({ error: 'กรุณาใส่ Page ID และ Token' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings.facebookPages) settings.facebookPages = [];

    const existing = settings.facebookPages.find(p => p.pageId === pageId.trim());
    if (existing) {
        existing.token = pageToken.trim();
        existing.pageName = pageName || existing.pageName;
        await saveSettings(settings);
        return NextResponse.json({ success: true, message: `อัพเดท Token สำหรับ Page ${existing.pageName || pageId} สำเร็จ!` });
    }

    const newPage = {
        id: `fb_${Date.now()}`,
        pageId: pageId.trim(),
        token: pageToken.trim(),
        pageName: pageName || '',
        addedAt: new Date().toISOString()
    };

    settings.facebookPages.push(newPage);
    await saveSettings(settings);

    return NextResponse.json({
        success: true,
        message: `เพิ่ม Page ${pageName || pageId} สำเร็จ!`
    });
}
