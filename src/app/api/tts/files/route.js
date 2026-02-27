import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { AUDIO_DIR } from '@/lib/paths';

export async function GET() {
    try {
        const files = fs.readdirSync(AUDIO_DIR)
            .filter(f => f.endsWith('.wav') || f.endsWith('.mp3'))
            .map(f => {
                const stats = fs.statSync(path.join(AUDIO_DIR, f));
                return {
                    fileName: f,
                    filePath: `/api/uploads/audio/${f}`,
                    size: stats.size,
                    createdAt: stats.birthtime
                };
            });
        return NextResponse.json(files);
    } catch (err) {
        return NextResponse.json([]);
    }
}
