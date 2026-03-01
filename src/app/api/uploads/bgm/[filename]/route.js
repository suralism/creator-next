import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { BGM_DIR } from '@/lib/paths';

export async function GET(request, { params }) {
    try {
        const { filename } = await params;
        const filePath = path.join(BGM_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            '.flac': 'audio/flac'
        };

        return new Response(buffer, {
            headers: {
                'Content-Type': mimeTypes[ext] || 'audio/mpeg',
                'Content-Length': buffer.length.toString()
            }
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
