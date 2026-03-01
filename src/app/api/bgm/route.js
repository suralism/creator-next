import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { BGM_DIR } from '@/lib/paths';

// GET /api/bgm - List all BGM files
export async function GET() {
    try {
        if (!fs.existsSync(BGM_DIR)) {
            fs.mkdirSync(BGM_DIR, { recursive: true });
        }

        const metaPath = path.join(BGM_DIR, '_meta.json');
        if (!fs.existsSync(metaPath)) {
            return NextResponse.json([]);
        }

        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        // Filter out entries whose files no longer exist
        const valid = meta.filter(m => fs.existsSync(path.join(BGM_DIR, m.fileName)));
        return NextResponse.json(valid);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/bgm - Upload a BGM file
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const label = formData.get('label') || 'Untitled BGM';

        if (!file) {
            return NextResponse.json({ error: 'กรุณาเลือกไฟล์เพลง' }, { status: 400 });
        }

        const ext = path.extname(file.name) || '.mp3';
        const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        if (!allowedExts.includes(ext.toLowerCase())) {
            return NextResponse.json({ error: `รองรับไฟล์: ${allowedExts.join(', ')}` }, { status: 400 });
        }

        const id = uuidv4();
        const fileName = `${id}${ext}`;
        const filePath = path.join(BGM_DIR, fileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        const entry = {
            id,
            label,
            fileName,
            originalName: file.name,
            size: buffer.length,
            uploadedAt: new Date().toISOString()
        };

        // Update meta
        const metaPath = path.join(BGM_DIR, '_meta.json');
        let meta = [];
        if (fs.existsSync(metaPath)) {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        }
        meta.push(entry);
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        return NextResponse.json(entry, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
