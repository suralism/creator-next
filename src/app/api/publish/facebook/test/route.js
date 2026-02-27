import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

// POST /api/publish/facebook/test
export async function POST(request) {
    try {
        const { token, pageId, useExistingToken } = await request.json();
        let tokenToUse = token;

        if (useExistingToken && pageId) {
            const settings = await getSettings();
            const pages = settings.facebookPages || [];
            const page = pages.find(p => p.pageId === pageId);
            if (page) {
                tokenToUse = page.token;
            } else {
                return NextResponse.json({ error: 'ไม่พบ Page ID นี้ในระบบ' }, { status: 404 });
            }
        }

        if (!tokenToUse || !pageId) {
            return NextResponse.json({ error: 'กรุณาใส่ Token และ Page ID' }, { status: 400 });
        }

        const response = await fetch(
            `https://graph.facebook.com/v19.0/${pageId}?fields=name,id&access_token=${tokenToUse}`
        );
        const data = await response.json();

        if (data.error) {
            return NextResponse.json({
                success: false,
                message: `Token ใช้งานไม่ได้: ${data.error.message}`
            });
        }

        return NextResponse.json({
            success: true,
            message: `เชื่อมต่อสำเร็จ! Page: ${data.name} (ID: ${data.id})`
        });
    } catch (err) {
        return NextResponse.json({ success: false, message: `Error: ${err.message}` });
    }
}
