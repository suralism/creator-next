import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from '@/lib/paths';

// POST /api/publish/upload-video
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('video');

        if (!file) {
            return NextResponse.json({ error: 'ไม่พบไฟล์วิดีโอ' }, { status: 400 });
        }

        const dir = path.join(ROOT_DIR, 'data', 'videos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const ext = file.name.split('.').pop() || 'mp4';
        const fileName = `replaced_${Date.now()}.${ext}`;
        const filePath = path.join(dir, fileName);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        fs.writeFileSync(filePath, buffer);

        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
        console.log(`📤 Video replaced: ${fileName} (${fileSizeMB} MB)`);

        return NextResponse.json({
            success: true,
            filePath: `/api/uploads/videos/${fileName}`,
            fileName: fileName,
            fileSize: buffer.length,
            message: `อัพโหลดวิดีโอสำเร็จ! (${fileSizeMB} MB)`
        });
    } catch (err) {
        console.error('Video upload error:', err);
        return NextResponse.json({ error: `Upload Error: ${err.message}` }, { status: 500 });
    }
}
