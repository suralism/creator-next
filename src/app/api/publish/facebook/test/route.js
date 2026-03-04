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
            `https://graph.facebook.com/v22.0/${pageId}?fields=name,id&access_token=${tokenToUse}`
        );
        const data = await response.json();

        if (data.error) {
            return NextResponse.json({
                success: false,
                message: `Token ใช้งานไม่ได้: ${data.error.message}`
            });
        }

        // Check token permissions for engagement stats
        let permissions = [];
        let missingPerms = [];
        try {
            const debugRes = await fetch(
                `https://graph.facebook.com/v22.0/me/permissions?access_token=${tokenToUse}`
            );
            const debugData = await debugRes.json();
            if (debugData.data) {
                permissions = debugData.data
                    .filter(p => p.status === 'granted')
                    .map(p => p.permission);

                const required = ['pages_read_engagement', 'read_insights', 'pages_show_list'];
                missingPerms = required.filter(p => !permissions.includes(p));
            }
        } catch (e) {
            console.log('Permission check failed:', e.message);
        }

        let message = `เชื่อมต่อสำเร็จ! Page: ${data.name} (ID: ${data.id})`;
        if (missingPerms.length > 0) {
            message += `\n⚠️ ขาด permissions สำหรับดึง Engagement: ${missingPerms.join(', ')}`;
        } else if (permissions.length > 0) {
            message += `\n✅ มี permissions ครบสำหรับดึง Engagement`;
        }

        return NextResponse.json({
            success: true,
            message,
            permissions: permissions.length > 0 ? permissions : undefined,
            missingPermissions: missingPerms.length > 0 ? missingPerms : undefined
        });
    } catch (err) {
        return NextResponse.json({ success: false, message: `Error: ${err.message}` });
    }
}

